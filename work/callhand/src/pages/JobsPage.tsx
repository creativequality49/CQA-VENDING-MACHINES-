import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Phone } from 'lucide-react';
import { useBusiness } from '../App';
import { api, type CallSummary } from '../lib/api';
import { callbackNumber, formatAuPhone, jobTitle, when } from '../lib/format';
import { Button, ErrorNote, Spinner, UrgencyTag } from '../components/ui';

type Filter = 'open' | 'all';
const REFRESH_MS = 30_000;

export function JobsPage() {
  const { me } = useBusiness();
  const [filter, setFilter] = useState<Filter>('open');
  const [calls, setCalls] = useState<CallSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api<{ calls: CallSummary[] }>(`/calls?filter=${filter}`);
      setCalls(data.calls);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [filter]);

  useEffect(() => {
    setCalls(null);
    void load();
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void load(); }, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  const markDone = async (call: CallSummary) => {
    setBusyId(call.id);
    try {
      await api(`/calls/${call.id}/handled`, { method: 'POST', body: { handled: !call.handled_at } });
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const tab = (value: Filter, label: string) => (
    <button
      role="tab"
      aria-selected={filter === value}
      onClick={() => setFilter(value)}
      className={`-mb-[2px] border-b-[3px] px-1 pb-2 font-semibold ${filter === value ? 'border-ink text-ink' : 'border-transparent text-slate hover:text-ink'}`}
    >
      {label}
    </button>
  );

  return (
    <>
      {!me.settings.enabled && <SetupPanel />}

      <div role="tablist" aria-label="Which calls" className="flex gap-6 border-b-2 border-rule">
        {tab('open', 'To call back')}
        {tab('all', 'All calls')}
      </div>

      <div className="mt-5 space-y-3">
        {error && <ErrorNote onRetry={load}>{error}</ErrorNote>}
        {!calls && !error && <Spinner label="Loading calls" />}
        {calls && calls.length === 0 && (
          <div className="py-12">
            <p className="text-xl font-semibold">{filter === 'open' ? 'Nothing to call back.' : 'No calls yet.'}</p>
            <p className="mt-2 max-w-md text-slate">
              {me.settings.enabled
                ? 'New jobs land here as soon as a call ends, and we text you each one.'
                : 'Once answering is switched on, every job the receptionist takes down shows up here.'}
            </p>
            {!me.settings.enabled && <Link to="/try" className="mt-4 inline-block font-semibold underline underline-offset-4">Try the receptionist by text</Link>}
          </div>
        )}
        {calls?.map((call) => (
          <Docket key={call.id} call={call} timezone={me.business.timezone} busy={busyId === call.id} onToggleDone={() => markDone(call)} />
        ))}
      </div>
    </>
  );
}

function Docket({ call, timezone, busy, onToggleDone }: { call: CallSummary; timezone: string; busy: boolean; onToggleDone: () => void }) {
  const number = callbackNumber(call);
  const open = !call.handled_at;
  const edge = open ? (call.urgency === 'emergency' ? 'tape-emergency' : 'tape') : '';
  return (
    <article className={`relative rounded-lg border-[1.5px] border-rule bg-card py-4 pl-6 pr-4 sm:pl-7 ${edge} ${open ? '' : 'opacity-75'}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate">
        <time dateTime={call.started_at}>{when(call.started_at, timezone)}</time>
        {call.suburb && <span className="font-semibold text-ink">{call.suburb}</span>}
        <UrgencyTag urgency={call.urgency} />
        {!open && <span className="inline-flex items-center gap-1"><Check size={14} aria-hidden />Done</span>}
      </div>

      <h2 className="docket-title mt-2 text-[2rem] sm:text-[2.4rem]">
        {/* The whole docket opens the call; the buttons below sit above this link. */}
        <Link to={`/calls/${call.id}`} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:rounded-lg focus-visible:after:outline focus-visible:after:outline-3 focus-visible:after:outline-ink">
          {jobTitle(call)}
        </Link>
      </h2>

      <p className="mt-1.5 text-lg">
        {call.caller_name ?? 'Caller'}
        {number ? <span className="text-slate">, {formatAuPhone(number)}</span> : <span className="text-slate">, number withheld</span>}
      </p>
      {call.details && <p className="mt-2 line-clamp-2 max-w-prose leading-relaxed text-slate">{call.details}</p>}

      <div className="relative z-10 mt-4 flex flex-wrap gap-2">
        {number && (
          <a href={`tel:${number}`} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-ink px-4 py-2.5 font-semibold text-paper hover:bg-[#2b3746]">
            <Phone size={18} aria-hidden /> Call {call.caller_name?.split(' ')[0] ?? 'back'}
          </a>
        )}
        <Button variant="secondary" disabled={busy} onClick={onToggleDone}>
          {busy ? 'Saving…' : open ? 'Mark done' : 'Move back to call list'}
        </Button>
      </div>
    </article>
  );
}

function SetupPanel() {
  const { me } = useBusiness();
  const remaining = me.checklist.items.filter((item) => !item.done);
  return (
    <section className="mb-8 rounded-lg bg-ink p-5 text-paper sm:p-6">
      <h2 className="condensed text-2xl font-extrabold">{me.checklist.ok ? 'Ready to answer calls' : 'Finish setting up'}</h2>
      {me.checklist.ok ? (
        <p className="mt-2 text-paper/80">Everything is in place. Switch answering on in Settings when you want the receptionist to take calls.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {me.checklist.items.map((item) => (
            <li key={item.key} className="flex gap-3">
              <span aria-hidden className={`mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-sm ${item.done ? 'bg-hivis text-ink' : 'border-[1.5px] border-paper/50'}`}>{item.done && <Check size={12} strokeWidth={3} />}</span>
              <span><span className="font-semibold">{item.label}</span>{item.done ? <span className="sr-only"> (done)</span> : <span className="block text-sm text-paper/70">{item.hint}</span>}</span>
            </li>
          ))}
        </ul>
      )}
      {remaining.some((item) => item.key !== 'phone_number' && item.key !== 'server') || me.checklist.ok ? (
        <Link to="/settings" className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-hivis px-4 py-2.5 font-semibold text-ink">Open settings</Link>
      ) : null}
    </section>
  );
}
