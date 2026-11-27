import assert from 'node:assert/strict';
import test from 'node:test';
import { completeCall, type CompleteDeps } from '../server/calls/complete';
import { BIZ_A, FakeDb, installClaimRpc, sid } from './fakeDb';

const CALL_ID = '33333333-3333-4333-8333-333333333333';

function setup(call: Record<string, unknown> = {}, settings: Record<string, unknown> = { owner_alert_number: '+61400000001' }, options: { smsReady?: boolean; failSend?: boolean } = {}) {
  const db = new FakeDb({
    calls: [{ id: CALL_ID, business_id: BIZ_A, call_sid: sid('a'), from_number: '+61412345678', to_number: '+61255550101', status: 'in_progress', caller_name: 'Alice', callback_number: null, suburb: 'Newtown', job_type: 'Burst pipe', urgency: 'emergency', details: 'Water through the ceiling.', ...call }],
    receptionist_settings: [{ business_id: BIZ_A, ...settings }],
  });
  installClaimRpc(db);
  const sent: Array<{ to: string; body: string; from?: string | null }> = [];
  const deps: CompleteDeps = {
    db: () => db.client(),
    sendSms: async (input) => {
      if (options.failSend) throw Object.assign(new Error('nope'), { code: 21610 });
      sent.push(input);
      return { sid: `SM${sent.length}` };
    },
    smsReady: () => options.smsReady ?? true,
    appUrl: 'https://callhand.test',
  };
  return { db, sent, deps };
}

test('a finished call texts the owner once, from the business line, with a link to the call', async () => {
  const { db, sent, deps } = setup();
  assert.equal(await completeCall(sid('a'), { durationSeconds: 95.4 }, deps), 'sent');
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, '+61400000001');
  assert.equal(sent[0].from, '+61255550101');
  assert.match(sent[0].body, /^Callhand: EMERGENCY - New job: Burst pipe, Newtown\. Alice, 0412 345 678\./);
  assert.match(sent[0].body, new RegExp(`Details: https://callhand.test/calls/${CALL_ID}$`));
  const call = db.rows('calls')[0];
  assert.equal(call.status, 'completed');
  assert.equal(call.outcome, 'job_captured');
  assert.equal(call.duration_seconds, 95);
  assert.ok(call.ended_at);
  const alert = db.rows('alert_deliveries')[0];
  assert.equal(alert.status, 'sent');
  assert.equal(alert.provider_message_id, 'SM1');
});

test('both call-end paths running at once still send only one text', async () => {
  const { db, sent, deps } = setup();
  const results = await Promise.all([completeCall(sid('a'), {}, deps), completeCall(sid('a'), { durationSeconds: 60 }, deps), completeCall(sid('a'), {}, deps)]);
  assert.deepEqual([...results].sort(), ['already_handled', 'already_handled', 'sent']);
  assert.equal(sent.length, 1);
  assert.equal(db.rows('alert_deliveries').length, 1);
});

test('the number the caller gave is preferred over caller ID', async () => {
  const { sent, deps } = setup({ callback_number: '+61499888777' });
  await completeCall(sid('a'), {}, deps);
  assert.match(sent[0].body, /Alice, 0499 888 777\. .*Call back on 0499 888 777\./);
});

test('a hang-up with caller ID still tells the owner who rang', async () => {
  const { db, sent, deps } = setup({ caller_name: null, suburb: null, job_type: null, urgency: null, details: null });
  assert.equal(await completeCall(sid('a'), {}, deps), 'sent');
  assert.equal(db.rows('calls')[0].outcome, 'no_details');
  assert.match(sent[0].body, /^Callhand: Missed job details\. Caller 0412 345 678\. Call back on 0412 345 678\./);
});

test('no text when there is nothing to act on, no owner mobile, or no SMS setup', async () => {
  const withheld = setup({ from_number: null, caller_name: null, suburb: null, job_type: null, urgency: null, details: null });
  assert.equal(await completeCall(sid('a'), {}, withheld.deps), 'skipped');
  assert.match(withheld.db.rows('alert_deliveries')[0].detail, /Nothing to act on/);

  const noMobile = setup({}, { owner_alert_number: null });
  assert.equal(await completeCall(sid('a'), {}, noMobile.deps), 'skipped');
  assert.match(noMobile.db.rows('alert_deliveries')[0].detail, /No owner mobile/);

  const noSms = setup({}, undefined, { smsReady: false });
  assert.equal(await completeCall(sid('a'), {}, noSms.deps), 'skipped');
  for (const run of [withheld, noMobile, noSms]) assert.equal(run.sent.length, 0);
});

test('a failed text is recorded and not retried into a duplicate', async () => {
  const { db, deps } = setup({}, undefined, { failSend: true });
  assert.equal(await completeCall(sid('a'), {}, deps), 'failed');
  const alert = db.rows('alert_deliveries')[0];
  assert.equal(alert.status, 'failed');
  assert.match(alert.detail, /Twilio 21610/);
  assert.equal(await completeCall(sid('a'), {}, deps), 'already_handled');
});

test('an unknown call is ignored', async () => {
  const { sent, deps } = setup();
  assert.equal(await completeCall(sid('f'), {}, deps), 'unknown_call');
  assert.equal(sent.length, 0);
});

test('ended_at is kept from the first completion', async () => {
  const { db, deps } = setup({ status: 'completed', ended_at: '2026-11-08T00:00:00.000Z' });
  await completeCall(sid('a'), {}, deps);
  assert.equal(db.rows('calls')[0].ended_at, '2026-11-08T00:00:00.000Z');
});
