import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api } from '../lib/api';
import { formatAuPhone, toE164 } from '../../shared/phone';
import { Button, ErrorNote } from '../components/ui';

type Line = { role: 'caller' | 'receptionist'; text: string };
type Captured = Partial<Record<'caller_name' | 'callback_number' | 'suburb' | 'job_type' | 'urgency' | 'details', string>>;
type TryReply = { sessionId: string | null; greeting: string | null; reply: string; endCall: boolean; captured: Captured; aiReady: boolean };

const LABELS: Array<[keyof Captured, string]> = [
  ['job_type', 'Job'], ['suburb', 'Suburb'], ['urgency', 'Urgency'], ['caller_name', 'Name'], ['callback_number', 'Number'], ['details', 'Details'],
];

export function TryPage() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [captured, setCaptured] = useState<Captured>({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [ended, setEnded] = useState(false);
  const [aiReady, setAiReady] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => { bottom.current?.scrollIntoView?.({ block: 'nearest' }); }, [lines]);

  const send = async (event: FormEvent) => {
    event.preventDefault();
    const text = message.trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    setMessage('');
    setLines((current) => [...current, { role: 'caller', text }]);
    try {
      const result = await api<TryReply>('/try', { method: 'POST', body: { message: text, ...(sessionId ? { sessionId } : {}) } });
      setLines((current) => {
        const withGreeting = result.greeting ? [{ role: 'receptionist' as const, text: result.greeting }, ...current] : current;
        return result.reply ? [...withGreeting, { role: 'receptionist', text: result.reply }] : withGreeting;
      });
      setCaptured(result.captured);
      setSessionId(result.sessionId);
      setEnded(result.endCall);
      setAiReady(result.aiReady);
    } catch (err) {
      setError((err as Error).message);
      setMessage(text);
      setLines((current) => current.slice(0, -1));
    } finally {
      setBusy(false);
      input.current?.focus();
    }
  };

  const restart = () => {
    setSessionId(null);
    setLines([]);
    setCaptured({});
    setEnded(false);
    setError(null);
    input.current?.focus();
  };

  const capturedRows = LABELS.filter(([key]) => captured[key]);

  return (
    <div className="grid gap-8 md:grid-cols-[1fr_15rem]">
      <section>
        <h1 className="docket-title text-5xl">Try it</h1>
        <p className="mt-3 max-w-prose text-slate">Type what a customer would say on the phone. It's the same receptionist, with your settings. Nothing is saved and no text is sent.</p>
        {!aiReady && <p className="mt-4 rounded-lg border-[1.5px] border-ink bg-card p-3">The AI isn't connected on the server yet, so you're seeing the backup script it uses when the AI is down.</p>}

        <div className="mt-6 min-h-48 space-y-3" aria-live="polite">
          {lines.length === 0 && <p className="text-slate">Start like a caller would, for example: "Hi, my hot water system is leaking everywhere."</p>}
          {lines.map((line, index) => (
            <p key={index} className={`max-w-[85%] rounded-lg px-4 py-2.5 leading-relaxed ${line.role === 'caller' ? 'ml-auto bg-ink text-paper' : 'border-[1.5px] border-rule bg-card'}`}>
              <span className="sr-only">{line.role === 'caller' ? 'You: ' : 'Receptionist: '}</span>{line.text}
            </p>
          ))}
          {busy && <p className="text-slate" role="status">Receptionist is replying…</p>}
          {ended && <p className="pt-2 font-semibold">The receptionist ended the call here.</p>}
          <div ref={bottom} />
        </div>

        {error && <div className="mt-4"><ErrorNote>{error}</ErrorNote></div>}

        <form onSubmit={send} className="mt-5 flex gap-2">
          <label htmlFor="try-message" className="sr-only">What the caller says</label>
          <input id="try-message" ref={input} className="field" maxLength={500} autoComplete="off" placeholder={ended ? 'Start over to try another call' : 'What the caller says'}
            disabled={ended} value={message} onChange={(e) => setMessage(e.target.value)} />
          <Button type="submit" disabled={busy || ended || !message.trim()}>Send</Button>
        </form>
        {(lines.length > 0) && <Button variant="quiet" className="mt-2 px-0" onClick={restart}>Start over</Button>}
      </section>

      <aside className="md:pt-24">
        <h2 className="font-bold">What it took down</h2>
        {capturedRows.length === 0 ? (
          <p className="mt-2 text-sm text-slate">Details appear here as the receptionist saves them, just as they would on your job docket.</p>
        ) : (
          <dl className="mt-3 space-y-3 rounded-lg bg-card p-4 tape">
            {capturedRows.map(([key, label]) => (
              <div key={key}>
                <dt className="text-sm text-slate">{label}</dt>
                <dd className={key === 'job_type' ? 'docket-title text-2xl' : 'font-medium'}>
                  {key === 'callback_number' ? formatAuPhone(toE164(captured[key]) ?? captured[key]) : key === 'urgency' ? captured[key]!.charAt(0).toUpperCase() + captured[key]!.slice(1) : captured[key]}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </aside>
    </div>
  );
}
