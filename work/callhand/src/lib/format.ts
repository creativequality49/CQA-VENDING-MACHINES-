import { formatAuPhone } from '../../shared/phone';

export { formatAuPhone };

export function callbackNumber(call: { callback_number: string | null; from_number: string | null }) {
  return call.callback_number || call.from_number;
}

// "9:41 am" today, "Yesterday 4:10 pm", "Mon 3 Nov, 8:02 am" otherwise.
export function when(iso: string, timezone = 'Australia/Sydney', now = new Date()) {
  const date = new Date(iso);
  const day = (d: Date) => new Intl.DateTimeFormat('en-AU', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  const time = new Intl.DateTimeFormat('en-AU', { timeZone: timezone, hour: 'numeric', minute: '2-digit' }).format(date);
  if (day(date) === day(now)) return time;
  if (day(date) === day(new Date(now.getTime() - 86_400_000))) return `Yesterday ${time}`;
  const dayPart = new Intl.DateTimeFormat('en-AU', { timeZone: timezone, weekday: 'short', day: 'numeric', month: 'short' }).format(date);
  return `${dayPart}, ${time}`;
}

export function duration(seconds: number | null) {
  if (seconds == null) return null;
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, '0')}s`;
}

export function jobTitle(call: { job_type: string | null; outcome: string | null; status: string }) {
  if (call.job_type) return call.job_type;
  if (call.status === 'in_progress') return 'Call in progress';
  return 'No job details';
}
