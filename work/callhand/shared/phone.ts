// Phone helpers shared by the server and the dashboard.

export const E164 = /^\+[1-9]\d{7,14}$/;

// Accepts what people type in Australia ("0412 345 678", "(02) 9123 4567",
// "+61 412 345 678") and returns E.164, or null if it isn't a usable number.
export function toE164(value: string | null | undefined): string | null {
  const raw = (value ?? '').trim();
  if (!raw) return null;
  const digits = raw.replace(/[^\d+]/g, '');
  if (/^0[2-478]\d{8}$/.test(digits)) return `+61${digits.slice(1)}`;
  if (/^61[2-478]\d{8}$/.test(digits)) return `+${digits}`;
  return E164.test(digits) ? digits : null;
}

// +61412345678 -> 0412 345 678; +61291234567 -> 02 9123 4567. Anything else
// (overseas, malformed) is returned unchanged so nothing is lost.
export function formatAuPhone(value: string | null | undefined): string {
  const raw = (value ?? '').trim();
  const match = raw.match(/^\+61(\d{9})$/);
  if (!match) return raw;
  const local = `0${match[1]}`;
  if (local.startsWith('04') || local.startsWith('05')) return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`;
  return `${local.slice(0, 2)} ${local.slice(2, 6)} ${local.slice(6)}`;
}
