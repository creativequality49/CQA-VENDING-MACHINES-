// The owner's "new job" text. Pure functions, unit-tested directly.
// Ported from Jobrin's owner alert, where it was already unit-tested.
import { formatAuPhone } from './phone';

export type Urgency = 'emergency' | 'urgent' | 'routine';

export function normalizeUrgency(value: unknown): Urgency | null {
  const v = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return v === 'emergency' || v === 'urgent' || v === 'routine' ? v : null;
}

// Keeps a message in the GSM-7 alphabet. One em dash, curly quote or emoji
// silently switches an SMS to UCS-2, which more than halves the characters
// per segment and doubles the cost. Callers' words come through
// speech-to-text and the model, so they can contain any of these.
const GSM_BASIC = "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
const REPLACEMENTS: Record<string, string> = {
  '‘': "'", '’': "'", '‚': "'", '‛': "'", '′': "'",
  '“': '"', '”': '"', '„': '"', '″': '"',
  '–': '-', '—': '-', '―': '-', '−': '-', '‐': '-', '‑': '-',
  '…': '...', ' ': ' ', ' ': ' ', ' ': ' ', '\t': ' ',
};

export function toGsm7(text: string): string {
  let out = '';
  for (const char of text) {
    if (REPLACEMENTS[char] !== undefined) out += REPLACEMENTS[char];
    else if (GSM_BASIC.includes(char)) out += char;
    else {
      const stripped = char.normalize('NFD').replace(/[̀-ͯ]/g, '');
      out += GSM_BASIC.includes(stripped) ? stripped : '';
    }
  }
  return out.replace(/ {2,}/g, ' ');
}

export type OwnerAlertInput = {
  callerName?: string | null;
  callerNumber?: string | null;
  suburb?: string | null;
  jobType?: string | null;
  urgency?: Urgency | null;
  details?: string | null;
  callUrl: string;
};

// Three SMS segments at most (459 GSM-7 characters).
export const OWNER_ALERT_MAX_LENGTH = 459;

export function buildOwnerAlertSms(input: OwnerAlertInput): string {
  const clean = (value: string | null | undefined, max: number) => toGsm7((value ?? '').replace(/\s+/g, ' ').trim()).slice(0, max).trim();
  const job = clean(input.jobType, 80);
  const suburb = clean(input.suburb, 60);
  const name = clean(input.callerName, 60);
  const number = input.callerNumber ? formatAuPhone(input.callerNumber) : '';
  const prefix = input.urgency === 'emergency' ? 'EMERGENCY - ' : input.urgency === 'urgent' ? 'URGENT - ' : '';

  const headline = job ? `${prefix}New job: ${job}${suburb ? `, ${suburb}` : ''}.` : `${prefix}Missed job details${suburb ? ` from ${suburb}` : ''}.`;
  const who = name && number ? `${name}, ${number}.` : name ? `${name} (no number).` : number ? `Caller ${number}.` : 'Number withheld.';
  const action = number ? `Call back on ${number}.` : '';
  const tail = `Details: ${input.callUrl}`;

  const fixed = ['Callhand:', headline, who, action, tail].filter(Boolean).join(' ');
  const room = OWNER_ALERT_MAX_LENGTH - fixed.length - 3;
  const details = room > 20 ? clean(input.details, room) : '';
  const body = details
    ? ['Callhand:', headline, who, `"${details}"`, action, tail].filter(Boolean).join(' ')
    : fixed;
  return body.slice(0, OWNER_ALERT_MAX_LENGTH);
}
