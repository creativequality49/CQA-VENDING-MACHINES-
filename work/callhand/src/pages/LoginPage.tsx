import { useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { Button, ErrorNote, Field } from '../components/ui';

type Mode = 'sign_in' | 'sign_up';

export function LoginPage() {
  const [mode, setMode] = useState<Mode>('sign_in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    if (mode === 'sign_up' && password.length < 8) return setError('Use at least 8 characters for your password.');
    setBusy(true);
    try {
      if (mode === 'sign_in') {
        const { error: signInError } = await supabase!.auth.signInWithPassword({ email, password });
        if (signInError) setError(signInError.message === 'Invalid login credentials' ? 'That email and password don\'t match an account.' : signInError.message);
      } else {
        const { data, error: signUpError } = await supabase!.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
        if (signUpError) setError(signUpError.message);
        else if (!data.session) setNotice(`Check ${email} for a link to confirm your account, then sign in.`);
      }
    } finally {
      setBusy(false);
    }
  };

  const sendLink = async () => {
    setError(null);
    setNotice(null);
    if (!email) return setError('Enter your email first.');
    setBusy(true);
    const { error: linkError } = await supabase!.auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: window.location.origin } });
    setBusy(false);
    if (linkError) setError(linkError.message);
    else setNotice(`We've emailed a sign-in link to ${email}.`);
  };

  return (
    <main className="mx-auto grid min-h-dvh max-w-5xl content-center gap-10 px-5 py-12 md:grid-cols-[1.1fr_1fr] md:gap-16">
      <section className="arrive">
        <p className="condensed text-2xl font-extrabold">Callhand</p>
        <h1 className="docket-title mt-6 text-5xl sm:text-6xl">Your phone, answered while you're on the tools.</h1>
        <p className="mt-5 max-w-md text-lg leading-relaxed text-slate">
          An AI receptionist picks up when you can't, takes down the job, and texts it to you so you can call back.
        </p>
      </section>

      <section className="rounded-xl border-[1.5px] border-rule bg-card p-6 sm:p-8">
        <h2 className="text-2xl font-bold">{mode === 'sign_in' ? 'Sign in' : 'Create your account'}</h2>
        <form onSubmit={submit} className="mt-6 space-y-5" noValidate>
          <Field label="Email">
            <input className="field" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Password" hint={mode === 'sign_up' ? 'At least 8 characters.' : undefined}>
            <input className="field" type="password" autoComplete={mode === 'sign_in' ? 'current-password' : 'new-password'} required value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          {error && <ErrorNote>{error}</ErrorNote>}
          {notice && <p role="status" className="rounded-lg bg-paper px-4 py-3">{notice}</p>}
          <Button type="submit" disabled={busy || !email || !password} className="w-full">
            {busy ? 'Working…' : mode === 'sign_in' ? 'Sign in' : 'Create account'}
          </Button>
        </form>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-2 text-sm">
          <Button variant="quiet" className="min-h-9 px-0" onClick={() => { setMode(mode === 'sign_in' ? 'sign_up' : 'sign_in'); setError(null); setNotice(null); }}>
            {mode === 'sign_in' ? 'New here? Create an account' : 'Already have an account? Sign in'}
          </Button>
          {mode === 'sign_in' && <Button variant="quiet" className="min-h-9 px-0" disabled={busy} onClick={sendLink}>Email me a sign-in link</Button>}
        </div>
      </section>
    </main>
  );
}
