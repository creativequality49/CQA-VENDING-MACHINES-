import { useState, type FormEvent } from 'react';
import { api } from '../lib/api';
import { supabase } from '../lib/supabase';
import { Button, ErrorNote, Field } from '../components/ui';

export function SetupPage({ onCreated }: { onCreated: () => Promise<void> }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api('/business', { method: 'POST', body: { name } });
      await onCreated();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto max-w-lg px-5 py-16">
      <p className="condensed text-2xl font-extrabold">Callhand</p>
      <h1 className="docket-title mt-8 text-5xl">What's your business called?</h1>
      <p className="mt-4 text-slate">The receptionist uses this name when it answers.</p>
      <form onSubmit={submit} className="mt-8 space-y-5">
        <Field label="Business name">
          <input className="field" autoFocus maxLength={120} placeholder="e.g. Harbour City Plumbing" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        {error && <ErrorNote>{error}</ErrorNote>}
        <div className="flex items-center gap-4">
          <Button type="submit" disabled={busy || name.trim().length < 2}>{busy ? 'Setting up…' : 'Continue'}</Button>
          <Button variant="quiet" type="button" onClick={() => void supabase!.auth.signOut()}>Sign out</Button>
        </div>
      </form>
    </main>
  );
}
