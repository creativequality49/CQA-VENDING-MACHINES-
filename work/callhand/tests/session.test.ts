import assert from 'node:assert/strict';
import test from 'node:test';
import type { Chat, ChatMessage, ChatReply } from '../server/calls/openai';
import { buildSystemPrompt, welcomeGreeting, type CallContext, type ReceptionistSettings } from '../server/calls/prompt';
import { CallSession, MAX_TURNS, type CallStore, type JobDetails, type TranscriptEntry } from '../server/calls/session';

const SETTINGS: ReceptionistSettings = {
  enabled: true, assistant_name: 'Sam', greeting: 'Thanks for calling Alpha Plumbing.',
  about: 'Family plumbing business since 1998.', services: 'Blocked drains, hot water, leaks', service_area: 'Inner West Sydney',
  hours: 'Mon-Fri 7am-5pm', pricing_wording: 'The team will give you a price once they know more.',
  callback_window: 'within the hour', emergency_instructions: 'For flooding, tell them to turn off the water at the meter.',
  owner_alert_number: '+61400000001',
};
const CONTEXT: CallContext = { businessId: 'biz', businessName: 'Alpha Plumbing', timezone: 'Australia/Sydney', settings: SETTINGS, callerNumber: '+61412345678' };

function memoryStore(context: CallContext | null = CONTEXT) {
  const saved: JobDetails[] = [];
  const transcripts: TranscriptEntry[][] = [];
  const events: string[] = [];
  const store: CallStore = {
    async loadContext() { return context; },
    async saveDetails(_sid, details) { events.push('save'); saved.push(details); },
    async saveTranscript(_b, _s, transcript) { transcripts.push([...transcript]); },
  };
  return { store, saved, transcripts, events };
}

const toolCall = (name: string, args: Record<string, unknown>, id = `t-${name}`) => ({ id, type: 'function' as const, function: { name, arguments: JSON.stringify(args) } });

function scriptedChat(replies: ChatReply[], seen: ChatMessage[][] = []): Chat {
  return async (messages) => {
    seen.push(messages.map((m) => ({ ...m })) as ChatMessage[]);
    const next = replies.shift();
    if (!next) throw new Error('no scripted reply');
    return next;
  };
}

test('the greeting always discloses that the caller is speaking with an AI', () => {
  assert.equal(welcomeGreeting(SETTINGS), "Thanks for calling Alpha Plumbing. You're speaking with Sam, the AI receptionist. How can I help?");
  assert.equal(welcomeGreeting({ greeting: 'G day from Bravo', assistant_name: 'Jo' }), "G day from Bravo. You're speaking with Jo, the AI receptionist. How can I help?");
});

test('the prompt carries the business facts and the hard rules', () => {
  const prompt = buildSystemPrompt(CONTEXT, new Date('2026-11-09T01:00:00Z'));
  for (const fact of ['Alpha Plumbing', 'Blocked drains, hot water, leaks', 'Inner West Sydney', 'Mon-Fri 7am-5pm', 'within the hour', 'turn off the water at the meter', '0412 345 678', 'triple zero (000)']) {
    assert.ok(prompt.includes(fact), `missing: ${fact}`);
  }
  assert.match(prompt, /Never give a price/);
  assert.match(prompt, /"The team will give you a price once they know more\."/);
  assert.match(prompt, /You are not a person/);
  assert.match(prompt, /Monday 9 November at 12:00 pm/, 'local Sydney time, not UTC');
  const unknown = buildSystemPrompt({ ...CONTEXT, callerNumber: null, settings: { ...SETTINGS, hours: '' } });
  assert.match(unknown, /Caller ID: withheld/);
  assert.match(unknown, /Hours: \(not provided - do not guess\)/);
});

test('details are saved before the reply is spoken', async () => {
  const { store, saved, events } = memoryStore();
  const chat: Chat = async (messages) => {
    if (messages.at(-1)?.role === 'user') return { content: null, toolCalls: [toolCall('save_job_details', { job_type: 'Burst pipe', urgency: 'emergency', suburb: '  ', bogus: 'x' })] };
    events.push('second-model-call');
    return { content: 'Oh no. What suburb are you in?', toolCalls: [] };
  };
  const session = new CallSession({ businessId: 'biz', callSid: 'CA1', store, chat });
  await session.start();
  const result = await session.handleCallerText('My pipe burst and water is everywhere');
  assert.deepEqual(result, { reply: 'Oh no. What suburb are you in?', endCall: false });
  assert.deepEqual(saved, [{ job_type: 'Burst pipe', urgency: 'emergency' }], 'blank and unknown fields dropped');
  assert.deepEqual(events, ['save', 'second-model-call']);
});

test('the model can hang up after saying goodbye', async () => {
  const { store } = memoryStore();
  const session = new CallSession({ businessId: 'biz', callSid: 'CA1', store, chat: scriptedChat([
    { content: 'Thanks Alice, the team will call you back within the hour. Bye!', toolCalls: [toolCall('end_call', { reason: 'done' })] },
  ]) });
  await session.start();
  const result = await session.handleCallerText("No, that's all");
  assert.deepEqual(result, { reply: 'Thanks Alice, the team will call you back within the hour. Bye!', endCall: true });
  assert.equal(session.ended, true);
  const after = await session.handleCallerText('hello?');
  assert.equal(after.endCall, true, 'nothing more is processed once the call is ending');
});

test('hanging up without words still says goodbye with the callback window', async () => {
  const { store } = memoryStore();
  const session = new CallSession({ businessId: 'biz', callSid: 'CA1', store, chat: scriptedChat([
    { content: null, toolCalls: [toolCall('end_call', {})] },
    { content: null, toolCalls: [toolCall('end_call', {})] },
    { content: null, toolCalls: [toolCall('end_call', {})] },
    { content: null, toolCalls: [toolCall('end_call', {})] },
  ]) });
  await session.start();
  const result = await session.handleCallerText('bye');
  assert.deepEqual(result, { reply: 'Thanks for calling. The team will call you back within the hour. Goodbye.', endCall: true });
});

test('conversation history carries over between turns', async () => {
  const { store } = memoryStore();
  const seen: ChatMessage[][] = [];
  const session = new CallSession({ businessId: 'biz', callSid: 'CA1', store, chat: scriptedChat([
    { content: 'What suburb?', toolCalls: [] },
    { content: 'Thanks.', toolCalls: [] },
  ], seen) });
  await session.start();
  await session.handleCallerText('Leaking tap');
  await session.handleCallerText('Newtown');
  const second = seen[1];
  assert.equal(second[0].role, 'system');
  assert.deepEqual(second.slice(1).map((m) => [m.role, m.content]), [['user', 'Leaking tap'], ['assistant', 'What suburb?'], ['user', 'Newtown']]);
});

test('if the model fails, the call falls back to a scripted message-take', async () => {
  const { store, saved } = memoryStore();
  const chat: Chat = async () => { throw new Error('OPENAI_FAILED:500'); };
  const session = new CallSession({ businessId: 'biz', callSid: 'CA1', store, chat });
  await session.start();
  const first = await session.handleCallerText('My hot water system is leaking');
  assert.equal(first.endCall, false);
  assert.match(first.reply, /name, your suburb, and the best number/);
  const second = await session.handleCallerText('Bob, Marrickville, 0412 000 111');
  assert.equal(second.endCall, true);
  assert.match(second.reply, /call you back within the hour/);
  assert.deepEqual(saved.at(-1), { details: 'Caller said: My hot water system is leaking / Bob, Marrickville, 0412 000 111' });
});

test('with no model configured the same scripted message-take runs', async () => {
  const { store, saved } = memoryStore();
  const session = new CallSession({ businessId: 'biz', callSid: 'CA1', store, chat: null });
  await session.start();
  assert.equal((await session.handleCallerText('Blocked drain')).endCall, false);
  assert.equal((await session.handleCallerText('Jo, 0400 111 222')).endCall, true);
  assert.equal(saved.length, 2);
});

test('long calls are wrapped up politely', async () => {
  const { store } = memoryStore();
  const replies = Array.from({ length: MAX_TURNS }, () => ({ content: 'Go on.', toolCalls: [] }));
  const session = new CallSession({ businessId: 'biz', callSid: 'CA1', store, chat: scriptedChat(replies) });
  await session.start();
  for (let i = 0; i < MAX_TURNS; i += 1) assert.equal((await session.handleCallerText(`turn ${i}`)).endCall, false);
  const last = await session.handleCallerText('one more thing');
  assert.equal(last.endCall, true);
  assert.match(last.reply, /wrap up now/);

  let clock = 0;
  const timed = new CallSession({ businessId: 'biz', callSid: 'CA2', store, chat: scriptedChat([{ content: 'Sure.', toolCalls: [] }]), now: () => clock });
  await timed.start();
  clock = 13 * 60_000;
  assert.equal((await timed.handleCallerText('still there?')).endCall, true);
});

test('turns run in order even when they arrive together', async () => {
  const { store } = memoryStore();
  const order: string[] = [];
  const chat: Chat = async (messages) => {
    const text = String(messages.at(-1)?.content);
    await new Promise((r) => setTimeout(r, text === 'first' ? 30 : 1));
    order.push(text);
    return { content: `re: ${text}`, toolCalls: [] };
  };
  const session = new CallSession({ businessId: 'biz', callSid: 'CA1', store, chat });
  await session.start();
  const [a, b] = await Promise.all([session.handleCallerText('first'), session.handleCallerText('second')]);
  assert.deepEqual(order, ['first', 'second']);
  assert.equal(a.reply, 're: first');
  assert.equal(b.reply, 're: second');
});

test('the transcript is saved once, with the greeting, both sides, in order', async () => {
  const { store, transcripts } = memoryStore();
  const session = new CallSession({ businessId: 'biz', callSid: 'CA1', store, chat: scriptedChat([{ content: 'Which suburb?', toolCalls: [] }]) });
  await session.start();
  await session.handleCallerText('Leaking tap');
  await Promise.all([session.finish(), session.finish()]);
  await session.finish();
  assert.equal(transcripts.length, 1);
  assert.deepEqual(transcripts[0].map((e) => [e.role, e.text]), [
    ['receptionist', "Thanks for calling Alpha Plumbing. You're speaking with Sam, the AI receptionist. How can I help?"],
    ['caller', 'Leaking tap'],
    ['receptionist', 'Which suburb?'],
  ]);
});

test('a call whose business cannot be loaded does not start', async () => {
  const { store } = memoryStore(null);
  const session = new CallSession({ businessId: 'biz', callSid: 'CA1', store, chat: null });
  assert.equal(await session.start(), false);
});
