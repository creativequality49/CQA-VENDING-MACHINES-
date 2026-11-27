import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useBusiness } from '../App';
import { api, ApiError, type Settings } from '../lib/api';
import { formatAuPhone } from '../lib/format';
import { Button, ErrorNote, Field } from '../components/ui';

// Show the alert mobile the way people write it (0412 345 678); the API
// stores it in international format.
const toForm = (settings: Settings): Settings => ({ ...settings, owner_alert_number: settings.owner_alert_number ? formatAuPhone(settings.owner_alert_number) : '' });

export function SettingsPage() {
  const { me, reload } = useBusiness();
  const isOwner = me.business.role === 'owner';
  const [form, setForm] = useState<Settings>(() => toForm(me.settings));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; field?: string } | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => { setForm(toForm(me.settings)); }, [me.settings]);

  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setSaved(false);
  };
  const dirty = JSON.stringify(form) !== JSON.stringify(toForm(me.settings));

  const save = async (next: Settings = form) => {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await api('/settings', { method: 'PUT', body: { ...next, owner_alert_number: next.owner_alert_number?.trim() || null } });
      await reload();
      setSaved(true);
    } catch (err) {
      setError({ message: (err as Error).message, field: err instanceof ApiError ? err.field : undefined });
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void save();
  };

  const fieldError = (key: keyof Settings) => (error?.field === key ? error.message : null);
  const text = (key: keyof Settings, props: { max: number; rows?: number; placeholder?: string; type?: string; autoComplete?: string }) => {
    const common = {
      className: 'field',
      value: (form[key] as string | null) ?? '',
      maxLength: props.max,
      placeholder: props.placeholder,
      disabled: !isOwner,
      'aria-invalid': error?.field === key,
      onChange: (e: { target: { value: string } }) => set(key, e.target.value as never),
    };
    return props.rows ? <textarea {...common} rows={props.rows} /> : <input {...common} type={props.type ?? 'text'} autoComplete={props.autoComplete} />;
  };

  const preview = `${form.greeting.trim()}${/[.!?]$/.test(form.greeting.trim()) ? '' : '.'} You're speaking with ${form.assistant_name.trim() || 'Sam'}, the AI receptionist. How can I help?`;

  return (
    <form onSubmit={onSubmit} className="space-y-10 pb-24">
      <h1 className="docket-title text-5xl">Settings</h1>
      {!isOwner && <p className="rounded-lg bg-card p-4 text-slate">Only the business owner can change these settings.</p>}

      <Section title="Answering calls">
        <div className="rounded-lg border-[1.5px] border-rule bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-lg font-semibold">{me.settings.enabled ? 'The receptionist is answering calls' : 'The receptionist is not answering calls'}</p>
              <p className="text-slate">
                {me.phoneNumbers.length
                  ? <>Your Callhand number is <strong className="text-ink">{me.phoneNumbers.map(formatAuPhone).join(', ')}</strong>. Forward your business line to it when you're busy or after hours.</>
                  : 'We\'ll give you a Callhand number to forward your calls to.'}
              </p>
            </div>
            {isOwner && (
              <Button
                type="button"
                variant={me.settings.enabled ? 'secondary' : 'primary'}
                disabled={busy || (!me.settings.enabled && !me.checklist.items.every((i) => i.done || i.key === 'owner_alert_number' || i.key === 'business_info'))}
                onClick={() => void save({ ...form, enabled: !me.settings.enabled })}
              >
                {me.settings.enabled ? 'Stop answering' : 'Start answering'}
              </Button>
            )}
          </div>
          {!me.checklist.ok && (
            <ul className="mt-4 space-y-1.5 border-t border-rule pt-4 text-sm">
              {me.checklist.items.filter((item) => !item.done).map((item) => (
                <li key={item.key}><span className="font-semibold">{item.label}:</span> <span className="text-slate">{item.hint}</span></li>
              ))}
            </ul>
          )}
        </div>
      </Section>

      <Section title="Job alerts">
        <Field label="Your mobile" hint="We text every new job here as soon as the call ends." error={fieldError('owner_alert_number')}>
          {text('owner_alert_number', { max: 30, placeholder: '0412 345 678', type: 'tel', autoComplete: 'tel' })}
        </Field>
      </Section>

      <Section title="How it answers">
        <Field label="Receptionist's name" error={fieldError('assistant_name')}>{text('assistant_name', { max: 40 })}</Field>
        <Field label="Opening line" hint="Said first on every call." error={fieldError('greeting')}>{text('greeting', { max: 300 })}</Field>
        <p className="rounded-lg bg-card p-4 leading-relaxed"><span className="block text-sm text-slate">Callers will hear</span>"{preview}"</p>
      </Section>

      <Section title="Your business" note="The receptionist only shares what you write here. Anything else, it tells the caller you'll answer when you call back.">
        <Field label="What you do" error={fieldError('about')}>{text('about', { max: 2000, rows: 3, placeholder: 'Licensed plumbers in Sydney\'s inner west since 2008. Residential and small commercial.' })}</Field>
        <Field label="Services" error={fieldError('services')}>{text('services', { max: 2000, rows: 3, placeholder: 'Blocked drains, hot water repairs and installs, leaking taps and toilets, gas fitting' })}</Field>
        <Field label="Areas you cover" error={fieldError('service_area')}>{text('service_area', { max: 500, placeholder: 'Inner West and Canterbury-Bankstown' })}</Field>
        <Field label="Hours" error={fieldError('hours')}>{text('hours', { max: 500, placeholder: 'Mon to Fri 7am to 5pm. Emergencies 24/7.' })}</Field>
      </Section>

      <Section title="Rules for callers">
        <Field label="When someone asks about price" hint="Said word for word. Don't include a dollar amount." error={fieldError('pricing_wording')}>{text('pricing_wording', { max: 300 })}</Field>
        <Field label="When you'll call back" hint={`Used as "the team will call you back ${form.callback_window || '…'}".`} error={fieldError('callback_window')}>{text('callback_window', { max: 120 })}</Field>
        <Field label="Emergencies" hint="Optional. What to tell callers with an emergency, beyond calling 000 if anyone is in danger." error={fieldError('emergency_instructions')}>
          {text('emergency_instructions', { max: 500, rows: 2, placeholder: 'Turn off the water at the meter. We\'ll call back within 30 minutes.' })}
        </Field>
      </Section>

      {isOwner && (
        <div className="fixed inset-x-0 bottom-0 border-t border-rule bg-paper/95 backdrop-blur">
          <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
            <Button type="submit" disabled={busy || !dirty}>{busy ? 'Saving…' : 'Save changes'}</Button>
            {saved && !dirty && <span role="status" className="font-medium text-ok">Saved</span>}
            {dirty && !busy && <span className="text-sm text-slate">Unsaved changes</span>}
            {error && <div className="w-full"><ErrorNote>{error.message}</ErrorNote></div>}
          </div>
        </div>
      )}
    </form>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-xl font-bold">{title}</h2>
        {note && <p className="mt-1 max-w-prose text-slate">{note}</p>}
      </div>
      {children}
    </section>
  );
}
