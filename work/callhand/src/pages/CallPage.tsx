import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Phone } from 'lucide-react';
import { useBusiness } from '../App';
import { api, ApiError, type AlertInfo, type CallDetail } from '../lib/api';
import { callbackNumber, duration, formatAuPhone, jobTitle, when } from '../lib/format';
import { Button, ErrorNote, Spinner, UrgencyTag } from '../components/ui';

export function CallPage() {
  const { id } = useParams();
  const { me } = useBusiness();
  const tz = me.business.timezone;
  const [data, setData] = useState<{ call: CallDetail; alert: AlertInfo } | null>(null);
  const [error, setError] = useState<{ message: string; notFound: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await api(`/calls/${id}`));
      setError(null);
    } catch (err) {
      setError({ message: (err as Error).message, notFound: err instanceof ApiError && err.status === 404 });
    }
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  const toggleDone = async () => {
    if (!data) return;
    setBusy(true);
    try {
      await api(`/calls/${data.call.id}/handled`, { method: 'POST', body: { handled: !data.call.handled_at } });
      await load();
    } catch (err) {
      setError({ message: (err as Error).message, notFound: false });
    } finally {
      setBusy(false);
    }
  };

  const back = <Link to="/" className="inline-flex items-center gap-1.5 font-semibold text-slate hover:text-ink"><ArrowLeft size={18} aria-hidden />Jobs</Link>;

  if (error?.notFound) return <>{back}<p className="mt-8 text-xl font-semibold">This call doesn't exist or isn't yours.</p></>;
  if (!data) return <>{back}{error ? <div className="mt-6"><ErrorNote onRetry={load}>{error.message}</ErrorNote></div> : <Spinner label="Loading call" />}</>;

  const { call, alert } = data;
  const number = callbackNumber(call);
  const facts: Array<[string, string | null]> = [
    ['Caller', call.caller_name],
    ['Call back on', number ? formatAuPhone(number) : 'Withheld'],
    ['Suburb', call.suburb],
    ['Rang', `${when(call.started_at, tz)}${duration(call.duration_seconds) ? `, ${duration(call.duration_seconds)}` : ''}`],
    ['Called from', call.from_number && call.from_number !== number ? formatAuPhone(call.from_number) : null],
  ];

  return (
    <>
      {back}
      {error && <div className="mt-4"><ErrorNote>{error.message}</ErrorNote></div>}
      <header className="mt-5">
        <div className="flex flex-wrap items-center gap-3">
          <UrgencyTag urgency={call.urgency} />
          {call.handled_at && <span className="text-slate">Done {when(call.handled_at, tz)}</span>}
        </div>
        <h1 className="docket-title mt-2 text-5xl sm:text-6xl">{jobTitle(call)}</h1>
      </header>

      <dl className="mt-6 grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2.5 text-lg">
        {facts.filter(([, value]) => value).map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-slate">{label}</dt>
            <dd className="font-medium">{value}</dd>
          </div>
        ))}
      </dl>

      {call.details && <p className="mt-6 max-w-prose rounded-lg border-[1.5px] border-rule bg-card p-4 text-lg leading-relaxed">{call.details}</p>}

      <div className="mt-6 flex flex-wrap gap-2">
        {number && (
          <a href={`tel:${number}`} className="inline-flex min-h-12 items-center gap-2 rounded-lg bg-ink px-5 py-3 text-lg font-semibold text-paper hover:bg-[#2b3746]">
            <Phone size={20} aria-hidden /> Call {formatAuPhone(number)}
          </a>
        )}
        <Button variant="secondary" className="min-h-12" disabled={busy} onClick={toggleDone}>
          {busy ? 'Saving…' : call.handled_at ? 'Move back to call list' : 'Mark done'}
        </Button>
      </div>

      <p className="mt-4 text-sm text-slate">{alertLine(alert, tz)}</p>

      <section className="mt-10">
        <h2 className="text-xl font-bold">What was said</h2>
        {call.transcript.length === 0 ? (
          <p className="mt-3 text-slate">{call.status === 'in_progress' ? 'The call is still going. The transcript appears when it ends.' : 'No transcript was saved for this call.'}</p>
        ) : (
          <ol className="mt-4 space-y-3">
            {call.transcript.map((entry, index) => (
              <li key={index} className={`max-w-[85%] rounded-lg px-4 py-2.5 leading-relaxed ${entry.role === 'caller' ? 'ml-auto bg-ink text-paper' : 'border-[1.5px] border-rule bg-card'}`}>
                <span className="sr-only">{entry.role === 'caller' ? 'Caller: ' : 'Receptionist: '}</span>
                {entry.text}
              </li>
            ))}
          </ol>
        )}
      </section>
    </>
  );
}

function alertLine(alert: AlertInfo, tz: string) {
  if (!alert) return 'No text has been sent for this call yet.';
  if (alert.status === 'sent') return `Texted to ${formatAuPhone(alert.recipient)}${alert.sent_at ? ` at ${when(alert.sent_at, tz)}` : ''}.`;
  if (alert.status === 'failed') return `The text to ${formatAuPhone(alert.recipient)} didn't send. ${alert.detail ?? ''}`.trim();
  if (alert.status === 'skipped') return `No text sent. ${alert.detail ?? ''}`.trim();
  return 'Sending the text…';
}
