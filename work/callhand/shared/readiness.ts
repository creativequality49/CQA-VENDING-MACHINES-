// What must be true before the receptionist can answer real calls. The API
// enforces it when the owner switches answering on; the dashboard shows it
// as a checklist.

export type ReadinessItem = { key: string; label: string; done: boolean; hint: string };

export function goLiveChecklist(input: {
  hasPhoneNumber: boolean;
  ownerAlertNumber: string | null | undefined;
  about: string | null | undefined;
  services: string | null | undefined;
  serverMissing: string[];
}): { ok: boolean; items: ReadinessItem[] } {
  const items: ReadinessItem[] = [
    {
      key: 'phone_number', label: 'Callhand phone number', done: input.hasPhoneNumber,
      hint: 'We assign your Callhand number. Then forward your business line to it when you are busy or after hours.',
    },
    {
      key: 'owner_alert_number', label: 'Your mobile for job alerts', done: Boolean(input.ownerAlertNumber),
      hint: 'Where we text each new job.',
    },
    {
      key: 'business_info', label: 'What your business does', done: Boolean(input.about?.trim() || input.services?.trim()),
      hint: 'Add a short description or your services so the receptionist can answer basic questions.',
    },
    {
      key: 'server', label: 'Callhand service', done: input.serverMissing.length === 0,
      hint: input.serverMissing.length ? `Not ready yet: ${input.serverMissing.join(', ')}.` : 'Ready.',
    },
  ];
  return { ok: items.every((item) => item.done), items };
}
