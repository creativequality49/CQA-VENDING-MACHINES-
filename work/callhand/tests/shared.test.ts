import assert from 'node:assert/strict';
import test from 'node:test';
import { buildOwnerAlertSms, normalizeUrgency, OWNER_ALERT_MAX_LENGTH, toGsm7 } from '../shared/alertSms';
import { formatAuPhone, toE164 } from '../shared/phone';
import { goLiveChecklist } from '../shared/readiness';
import { issueCallToken, verifyCallToken, CALL_TOKEN_TTL_SECONDS } from '../server/calls/token';

const GSM = /^[@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&'()*+,\-./0-9:;<=>?¡A-ZÄÖÑÜ§¿a-zäöñüà]*$/;

test('Australian numbers are read the way people type them', () => {
  assert.equal(toE164('0412 345 678'), '+61412345678');
  assert.equal(toE164('(02) 9123 4567'), '+61291234567');
  assert.equal(toE164('+61 412 345 678'), '+61412345678');
  assert.equal(toE164('61412345678'), '+61412345678');
  assert.equal(toE164('+14155550100'), '+14155550100');
  for (const bad of ['', '1234', 'call me', '0412 345', '000']) assert.equal(toE164(bad), null, bad);
});

test('numbers are shown in Australian format', () => {
  assert.equal(formatAuPhone('+61412345678'), '0412 345 678');
  assert.equal(formatAuPhone('+61291234567'), '02 9123 4567');
  assert.equal(formatAuPhone('+14155550100'), '+14155550100');
});

test('urgency only accepts the three levels', () => {
  assert.equal(normalizeUrgency(' URGENT '), 'urgent');
  assert.equal(normalizeUrgency('emergency'), 'emergency');
  assert.equal(normalizeUrgency('asap'), null);
  assert.equal(normalizeUrgency(3), null);
});

test('owner alert reads clearly and leads with emergencies', () => {
  const sms = buildOwnerAlertSms({ callerName: 'Alice', callerNumber: '+61412345678', suburb: 'Newtown', jobType: 'Burst pipe', urgency: 'emergency', details: 'Water through the ceiling.', callUrl: 'https://callhand.test/calls/1' });
  assert.equal(sms, 'Callhand: EMERGENCY - New job: Burst pipe, Newtown. Alice, 0412 345 678. "Water through the ceiling." Call back on 0412 345 678. Details: https://callhand.test/calls/1');
  const withheld = buildOwnerAlertSms({ callUrl: 'https://callhand.test/calls/2' });
  assert.equal(withheld, 'Callhand: Missed job details. Number withheld. Details: https://callhand.test/calls/2');
});

test('owner alert stays within three plain SMS segments', () => {
  const sms = buildOwnerAlertSms({ callerName: 'Zoë “Zed” O’Brien 🙂', callerNumber: '+61412345678', suburb: 'Surry Hills', jobType: 'Switchboard — tripping', urgency: 'urgent', details: 'x'.repeat(2000), callUrl: 'https://callhand.test/calls/3' });
  assert.ok(sms.length <= OWNER_ALERT_MAX_LENGTH, `length ${sms.length}`);
  assert.match(sms, GSM);
  assert.match(sms, /URGENT - New job: Switchboard - tripping/);
  assert.match(sms, /Details: https:\/\/callhand\.test\/calls\/3$/, 'the link survives truncation');
  assert.equal(toGsm7('“quote” – dash…'), '"quote" - dash...');
});

test('go-live checklist lists exactly what is missing', () => {
  const ready = goLiveChecklist({ hasPhoneNumber: true, ownerAlertNumber: '+61412345678', about: 'Plumber', services: '', serverMissing: [] });
  assert.equal(ready.ok, true);
  const notReady = goLiveChecklist({ hasPhoneNumber: false, ownerAlertNumber: null, about: ' ', services: '', serverMissing: ['OpenAI key'] });
  assert.equal(notReady.ok, false);
  assert.deepEqual(notReady.items.filter((i) => !i.done).map((i) => i.key), ['phone_number', 'owner_alert_number', 'business_info', 'server']);
  assert.match(notReady.items[3].hint, /OpenAI key/);
});

const BIZ = '11111111-1111-4111-8111-111111111111';
const SID = `CA${'a'.repeat(32)}`;
const SECRET = 's'.repeat(40);

test('a call token round-trips for the call it was issued for', () => {
  const token = issueCallToken({ businessId: BIZ, callSid: SID }, SECRET, 1000);
  assert.deepEqual(verifyCallToken(token, SECRET, 1000 + CALL_TOKEN_TTL_SECONDS), { businessId: BIZ, callSid: SID });
});

test('a call token is refused when expired, tampered with, or signed with another secret', () => {
  const token = issueCallToken({ businessId: BIZ, callSid: SID }, SECRET, 1000);
  assert.equal(verifyCallToken(token, SECRET, 1001 + CALL_TOKEN_TTL_SECONDS), null, 'expired');
  assert.equal(verifyCallToken(token, 't'.repeat(40), 1000), null, 'other secret');
  const [v, body, sig] = token.split('.');
  const forged = Buffer.from(JSON.stringify({ b: '22222222-2222-4222-8222-222222222222', c: SID, exp: 99999 })).toString('base64url');
  assert.equal(verifyCallToken(`${v}.${forged}.${sig}`, SECRET, 1000), null, 'swapped business');
  assert.equal(verifyCallToken(`${v}.${body}.${sig.slice(0, -2)}xx`, SECRET, 1000), null, 'bad signature');
  assert.equal(verifyCallToken('garbage', SECRET, 1000), null);
  assert.equal(verifyCallToken('', SECRET, 1000), null);
});

test('call tokens cannot be issued or checked without a strong secret', () => {
  assert.throws(() => issueCallToken({ businessId: BIZ, callSid: SID }, 'short'), /CALL_TOKEN_SECRET_NOT_CONFIGURED/);
  assert.equal(verifyCallToken('v1.a.b', 'short'), null);
});
