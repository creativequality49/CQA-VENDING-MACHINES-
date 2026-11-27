// Owner dashboard API.
import crypto from 'node:crypto';
import express, { Router, type Response } from 'express';
import { z } from 'zod';
import { goLiveChecklist } from '../../shared/readiness';
import { E164, toE164 } from '../../shared/phone';
import { requireBusiness, requireOwner, requireUser, type AuthDeps, type AuthedRequest } from '../auth';
import { createOpenAiChat, type Chat } from '../calls/openai';
import type { ReceptionistSettings } from '../calls/prompt';
import { CallSession, type CallStore, type JobDetails } from '../calls/session';
import { SETTINGS_COLUMNS } from '../calls/store';
import { env, openaiConfigured } from '../env';

export type ApiDeps = {
  auth: AuthDeps;
  serverMissing: () => string[];
  chat: () => Chat | null;
};

const line = (max: number) => z.string().trim().max(max);

const settingsSchema = z.object({
  enabled: z.boolean(),
  assistant_name: z.string().trim().min(1).max(40),
  greeting: z.string().trim().min(10).max(300),
  about: line(2000),
  services: line(2000),
  service_area: line(500),
  hours: line(500),
  // A quoted figure here would be read out as if it were a firm price.
  pricing_wording: z.string().trim().min(10).max(300).refine((v) => !/[$]\s*\d|\d+\s*(dollars|bucks)/i.test(v), 'Use general wording, not a price.'),
  callback_window: z.string().trim().min(3).max(120),
  emergency_instructions: line(500),
  owner_alert_number: z.string().trim().max(30).nullable().transform((v, ctx) => {
    if (!v) return null;
    const e164 = toE164(v);
    if (!e164 || !E164.test(e164)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Enter a mobile number like 0412 345 678.' });
      return z.NEVER;
    }
    return e164;
  }),
}).strict();

const businessSchema = z.object({ name: z.string().trim().min(2).max(120) }).strict();
const handledSchema = z.object({ handled: z.boolean() }).strict();
const trySchema = z.object({ sessionId: z.string().uuid().optional(), message: z.string().trim().min(1).max(500) }).strict();

const CALL_LIST_COLUMNS = 'id,started_at,ended_at,duration_seconds,status,from_number,caller_name,callback_number,suburb,job_type,urgency,details,outcome,handled_at';

function invalid(res: Response, error: z.ZodError) {
  const issue = error.issues[0];
  return res.status(400).json({ error: 'INVALID_INPUT', field: issue?.path.join('.'), message: issue?.message ?? 'Check the form and try again.' });
}

// ---- "Try it": the real conversation engine, no phone call, nothing saved ----

type TrySession = { session: CallSession; details: JobDetails; userId: string; touched: number };
const trySessions = new Map<string, TrySession>();
const TRY_TTL_MS = 15 * 60_000;
const tryHits = new Map<string, number[]>();
const TRY_LIMIT_PER_MINUTE = 20;

function tryRateLimited(userId: string, now = Date.now()) {
  const hits = (tryHits.get(userId) ?? []).filter((at) => now - at < 60_000);
  hits.push(now);
  tryHits.set(userId, hits);
  return hits.length > TRY_LIMIT_PER_MINUTE;
}

function sweepTrySessions(now = Date.now()) {
  for (const [id, entry] of trySessions) if (now - entry.touched > TRY_TTL_MS) trySessions.delete(id);
  while (trySessions.size > 200) trySessions.delete(trySessions.keys().next().value as string);
}

export function apiRouter(deps: ApiDeps) {
  const router = Router();
  router.use(express.json({ limit: '32kb' }));

  router.get('/health', (_req, res) => { res.json({ ok: true }); });

  router.use(requireUser(deps.auth));

  router.get('/me', async (req: AuthedRequest, res) => {
    if (!req.membership) return res.json({ business: null });
    const db = req.db!;
    const id = req.membership.businessId;
    const [business, settings, numbers] = await Promise.all([
      db.from('businesses').select('id,name,timezone').eq('id', id).maybeSingle(),
      db.from('receptionist_settings').select(SETTINGS_COLUMNS).eq('business_id', id).maybeSingle(),
      db.from('phone_numbers').select('phone_number').eq('business_id', id).eq('active', true),
    ]);
    if (business.error || settings.error || numbers.error) return res.status(500).json({ error: 'LOAD_FAILED', message: 'Could not load your business. Try again.' });
    const s = settings.data as ReceptionistSettings | null;
    const phoneNumbers = (numbers.data ?? []).map((row) => row.phone_number as string);
    res.json({
      business: { ...business.data, role: req.membership.role },
      settings: s,
      phoneNumbers,
      checklist: goLiveChecklist({ hasPhoneNumber: phoneNumbers.length > 0, ownerAlertNumber: s?.owner_alert_number, about: s?.about, services: s?.services, serverMissing: deps.serverMissing() }),
    });
  });

  router.post('/business', async (req: AuthedRequest, res) => {
    const parsed = businessSchema.safeParse(req.body);
    if (!parsed.success) return invalid(res, parsed.error);
    if (req.membership) return res.status(409).json({ error: 'ALREADY_HAS_BUSINESS', message: 'Your account already has a business.' });
    const { data, error } = await req.db!.rpc('create_business', { p_name: parsed.data.name });
    if (error) return res.status(400).json({ error: 'CREATE_FAILED', message: 'Could not create your business. Try again.' });
    res.status(201).json({ businessId: data });
  });

  router.put('/settings', requireBusiness, requireOwner, async (req: AuthedRequest, res) => {
    const parsed = settingsSchema.safeParse(req.body);
    if (!parsed.success) return invalid(res, parsed.error);
    const db = req.db!;
    const id = req.membership!.businessId;
    if (parsed.data.enabled) {
      const { data: numbers } = await db.from('phone_numbers').select('id').eq('business_id', id).eq('active', true).limit(1);
      const checklist = goLiveChecklist({
        hasPhoneNumber: Boolean(numbers?.length), ownerAlertNumber: parsed.data.owner_alert_number,
        about: parsed.data.about, services: parsed.data.services, serverMissing: deps.serverMissing(),
      });
      if (!checklist.ok) {
        const missing = checklist.items.filter((item) => !item.done).map((item) => item.label.toLowerCase());
        return res.status(409).json({ error: 'NOT_READY', message: `Answering can be switched on once these are done: ${missing.join(', ')}.`, checklist });
      }
    }
    const { data, error } = await db.from('receptionist_settings')
      .update({ ...parsed.data, updated_at: new Date().toISOString() })
      .eq('business_id', id).select(SETTINGS_COLUMNS).maybeSingle();
    if (error || !data) return res.status(400).json({ error: 'SAVE_FAILED', message: 'Could not save your settings. Try again.' });
    res.json({ settings: data });
  });

  router.get('/calls', requireBusiness, async (req: AuthedRequest, res) => {
    let query = req.db!.from('calls').select(CALL_LIST_COLUMNS)
      .eq('business_id', req.membership!.businessId)
      .order('started_at', { ascending: false }).limit(100);
    if (req.query.filter === 'open') query = query.is('handled_at', null);
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: 'LOAD_FAILED', message: 'Could not load calls. Try again.' });
    res.json({ calls: data ?? [] });
  });

  router.get('/calls/:id', requireBusiness, async (req: AuthedRequest, res) => {
    if (!z.string().uuid().safeParse(req.params.id).success) return res.status(404).json({ error: 'NOT_FOUND', message: 'Call not found.' });
    const db = req.db!;
    const [call, alert] = await Promise.all([
      db.from('calls').select(`${CALL_LIST_COLUMNS},to_number,transcript`).eq('business_id', req.membership!.businessId).eq('id', req.params.id).maybeSingle(),
      db.from('alert_deliveries').select('status,detail,sent_at,recipient').eq('business_id', req.membership!.businessId).eq('call_id', req.params.id).maybeSingle(),
    ]);
    if (call.error) return res.status(500).json({ error: 'LOAD_FAILED', message: 'Could not load this call. Try again.' });
    if (!call.data) return res.status(404).json({ error: 'NOT_FOUND', message: 'Call not found.' });
    res.json({ call: call.data, alert: alert.data ?? null });
  });

  router.post('/calls/:id/handled', requireBusiness, async (req: AuthedRequest, res) => {
    const parsed = handledSchema.safeParse(req.body);
    if (!parsed.success) return invalid(res, parsed.error);
    if (!z.string().uuid().safeParse(req.params.id).success) return res.status(404).json({ error: 'NOT_FOUND', message: 'Call not found.' });
    const { data, error } = await req.db!.from('calls')
      .update({ handled_at: parsed.data.handled ? new Date().toISOString() : null })
      .eq('business_id', req.membership!.businessId).eq('id', req.params.id)
      .select('id,handled_at').maybeSingle();
    if (error) return res.status(500).json({ error: 'SAVE_FAILED', message: 'Could not update this call. Try again.' });
    if (!data) return res.status(404).json({ error: 'NOT_FOUND', message: 'Call not found.' });
    res.json({ call: data });
  });

  // Text the receptionist exactly as a caller would, using the saved settings.
  router.post('/try', requireBusiness, async (req: AuthedRequest, res) => {
    const parsed = trySchema.safeParse(req.body);
    if (!parsed.success) return invalid(res, parsed.error);
    if (tryRateLimited(req.userId!)) return res.status(429).json({ error: 'SLOW_DOWN', message: 'Too many test messages. Wait a minute and try again.' });
    sweepTrySessions();

    let entry = parsed.data.sessionId ? trySessions.get(parsed.data.sessionId) : undefined;
    if (entry && entry.userId !== req.userId) entry = undefined;
    let sessionId = parsed.data.sessionId && entry ? parsed.data.sessionId : crypto.randomUUID();
    let greeting: string | null = null;

    if (!entry) {
      const db = req.db!;
      const id = req.membership!.businessId;
      const [business, settings] = await Promise.all([
        db.from('businesses').select('name,timezone').eq('id', id).maybeSingle(),
        db.from('receptionist_settings').select(SETTINGS_COLUMNS).eq('business_id', id).maybeSingle(),
      ]);
      if (!business.data || !settings.data) return res.status(500).json({ error: 'LOAD_FAILED', message: 'Could not load your settings.' });
      const details: JobDetails = {};
      const store: CallStore = {
        async loadContext(businessId) {
          return { businessId, businessName: business.data!.name as string, timezone: business.data!.timezone as string, settings: settings.data as unknown as ReceptionistSettings, callerNumber: null };
        },
        async saveDetails(_callSid, next) { Object.assign(details, next); },
        async saveTranscript() { /* nothing is saved for a test */ },
      };
      const session = new CallSession({ businessId: id, callSid: `try-${sessionId}`, store, chat: deps.chat() });
      await session.start();
      greeting = session.transcript[0]?.text ?? null;
      entry = { session, details, userId: req.userId!, touched: Date.now() };
      trySessions.set(sessionId, entry);
    }
    entry.touched = Date.now();
    const result = await entry.session.handleCallerText(parsed.data.message);
    if (result.endCall) { trySessions.delete(sessionId); sessionId = ''; }
    res.json({ sessionId: sessionId || null, greeting, reply: result.reply, endCall: result.endCall, captured: entry.details, aiReady: deps.chat() !== null });
  });

  return router;
}

export const defaultChat = () => (openaiConfigured() ? createOpenAiChat(env.OPENAI_API_KEY, env.OPENAI_MODEL) : null);
