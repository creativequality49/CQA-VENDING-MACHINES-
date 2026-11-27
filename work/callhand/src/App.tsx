import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { api, type Me } from './lib/api';
import { supabase, supabaseReady } from './lib/supabase';
import { Button, ErrorNote, Spinner } from './components/ui';
import { LoginPage } from './pages/LoginPage';
import { SetupPage } from './pages/SetupPage';
import { JobsPage } from './pages/JobsPage';
import { CallPage } from './pages/CallPage';
import { SettingsPage } from './pages/SettingsPage';
import { TryPage } from './pages/TryPage';

type Business = Extract<Me, { business: object }>;
const BusinessContext = createContext<{ me: Business; reload: () => Promise<void> } | null>(null);

export function useBusiness() {
  const value = useContext(BusinessContext);
  if (!value) throw new Error('useBusiness outside the signed-in app');
  return value;
}

export function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  if (!supabaseReady) {
    return (
      <main className="mx-auto max-w-lg px-5 py-16">
        <h1 className="docket-title text-4xl">Callhand isn't connected yet</h1>
        <p className="mt-4 text-slate">Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to the environment and rebuild the dashboard.</p>
      </main>
    );
  }
  if (session === undefined) return <main className="mx-auto max-w-2xl px-5"><Spinner /></main>;
  if (!session) return <LoginPage />;
  return <SignedIn />;
}

function SignedIn() {
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setError(null);
      setMe(await api<Me>('/me'));
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);
  useEffect(() => { void reload(); }, [reload]);

  if (error && !me) return <main className="mx-auto max-w-2xl px-5 py-10"><ErrorNote onRetry={reload}>{error}</ErrorNote></main>;
  if (!me) return <main className="mx-auto max-w-2xl px-5"><Spinner /></main>;
  if (!me.business) return <SetupPage onCreated={reload} />;

  return (
    <BusinessContext.Provider value={{ me, reload }}>
      <Shell me={me}>
        <Routes>
          <Route path="/" element={<JobsPage />} />
          <Route path="/calls/:id" element={<CallPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/try" element={<TryPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Shell>
    </BusinessContext.Provider>
  );
}

function Shell({ me, children }: { me: Business; children: React.ReactNode }) {
  const link = ({ isActive }: { isActive: boolean }) =>
    `rounded-md px-3 py-2 font-semibold ${isActive ? 'bg-paper text-ink' : 'text-paper/80 hover:text-paper'}`;
  const answering = me.settings.enabled;
  return (
    <div className="min-h-dvh">
      <header className="bg-ink text-paper">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
          <div className="mr-auto min-w-0">
            <p className="condensed truncate text-xl font-extrabold leading-tight">{me.business.name}</p>
            <p className="flex items-center gap-1.5 text-sm text-paper/75">
              <span className={`h-2 w-2 rounded-full ${answering ? 'bg-hivis' : 'bg-paper/40'}`} aria-hidden />
              {answering ? 'Answering calls' : 'Not answering calls'}
            </p>
          </div>
          <nav aria-label="Main" className="flex items-center gap-1 text-sm">
            <NavLink to="/" end className={link}>Jobs</NavLink>
            <NavLink to="/try" className={link}>Try it</NavLink>
            <NavLink to="/settings" className={link}>Settings</NavLink>
            <Button variant="quiet" className="min-h-9 px-2 text-sm text-paper/70 hover:text-paper" onClick={() => void supabase!.auth.signOut()}>Sign out</Button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 pb-16 pt-6 sm:px-6">{children}</main>
    </div>
  );
}
