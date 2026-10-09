"use client";

import { FormEvent, Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getBrowserSupabaseClient } from "@/lib/cqa-marketplace";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => getBrowserSupabaseClient(), []);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [messageAction, setMessageAction] = useState<"confirmation" | "signin" | null>(null);

  const requestedNext = searchParams.get("next") || "/owner/dashboard";
  const next = requestedNext.startsWith("/") && !requestedNext.startsWith("//") && !/[\\\u0000-\u0020]/.test(requestedNext) ? requestedNext : "/owner/dashboard";
  const confirmationUrl = `${typeof window === "undefined" ? "" : window.location.origin}/auth/confirm?next=${encodeURIComponent(next)}`;

  function switchMode(value: "login" | "signup") {
    if (loading) return;
    setMode(value); setError(""); setMessage(""); setMessageAction(null);
  }

  async function runAuthAction(action: () => Promise<void>) {
    setError(""); setMessage(""); setMessageAction(null); setLoading(true);
    try { await action(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Account service could not be reached. Please try again."); }
    finally { setLoading(false); }
  }

  async function resendConfirmation() {
    await runAuthAction(async () => {
      const { error: authError } = await supabase.auth.resend({ type: "signup", email: email.trim(), options: { emailRedirectTo: confirmationUrl } });
      if (authError) throw authError;
      setMessageAction("confirmation");
      setMessage("If this address needs confirmation, check Inbox and Spam for a fresh confirmation link.");
    });
  }

  async function sendSignInLink() {
    await runAuthAction(async () => {
      const address = email.trim();
      if (!address || !/^[^\s@]+@[^\s@]+$/.test(address)) throw new Error("Enter a valid email address first.");
      const { error: authError } = await supabase.auth.signInWithOtp({ email: address, options: { shouldCreateUser: false, emailRedirectTo: confirmationUrl } });
      if (authError) throw new Error("The sign-in email could not be sent. Check your account email, or wait a moment and retry.");
      setMessageAction("signin");
      setMessage("If this address has an existing CQA account, check Inbox and Spam for your sign-in link. Open the latest email link to securely log in.");
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runAuthAction(async () => {
      if (mode === "signup") {
        const { data, error: authError } = await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: confirmationUrl } });
        if (authError) throw authError;
        if (!data.session) {
          const existingAccount = (data.user?.identities?.length ?? 0) === 0;
          setMessage(existingAccount ? "This email may already have a CQA account. Try Log in, or request a fresh confirmation link." : "Account created. Check your email for the confirmation link to continue to CQA.");
          setMessageAction("confirmation");
          setMode("login");
          return;
        }
      } else {
        const { data, error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (authError) throw new Error(authError.message === "Invalid login credentials" ? "Incorrect email or password. You can use an email sign-in link below." : authError.message);
        if (!data.session) throw new Error("No authenticated session was returned. Please try again.");
      }
      router.push(next); router.refresh();
    });
  }

  return (
    <section className="glass-card" style={{ width: "100%", maxWidth: 540, padding: "1.5rem" }}>
      <div style={{ marginBottom: "1.25rem" }}>
        <span className="eyebrow">CQA BUSINESS OWNER ACCESS</span>
        <h1 style={{ marginBottom: ".55rem" }}>{mode === "login" ? "Log in to your machine" : "Create your owner account"}</h1>
        <p className="small" style={{ margin: 0 }}>Manage your CQA business machine, offers, bookings, AI workers and launch status.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: ".5rem", marginBottom: "1rem" }}>
        <button className={`button ${mode === "login" ? "primary" : "ghost"}`} type="button" disabled={loading} onClick={() => switchMode("login")}>Log in</button>
        <button className={`button ${mode === "signup" ? "primary" : "ghost"}`} type="button" disabled={loading} onClick={() => switchMode("signup")}>Create account</button>
      </div>

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: "1rem" }}>
        <label style={{ display: "grid", gap: ".45rem" }}>
          <span className="small">Email address</span>
          <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@business.com" style={{ width: "100%", padding: ".9rem 1rem", borderRadius: 12, border: "1px solid rgba(255,255,255,.14)", background: "rgba(255,255,255,.04)", color: "inherit" }} />
        </label>
        <label style={{ display: "grid", gap: ".45rem" }}>
          <span className="small">Password</span>
          <input type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} required minLength={mode === "signup" ? 8 : undefined} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimum 8 characters" style={{ width: "100%", padding: ".9rem 1rem", borderRadius: 12, border: "1px solid rgba(255,255,255,.14)", background: "rgba(255,255,255,.04)", color: "inherit" }} />
        </label>
        {error ? <div role="alert" style={{ padding: ".8rem 1rem", borderRadius: 10, border: "1px solid rgba(255,70,100,.4)", background: "rgba(255,70,100,.08)" }}><span className="small">{error}</span></div> : null}
        {message ? <div role="status" style={{ display: "grid", gap: ".75rem", padding: ".8rem 1rem", borderRadius: 10, border: "1px solid rgba(80,255,180,.35)", background: "rgba(80,255,180,.07)" }}><span className="small">{message}</span><button className="button ghost" type="button" disabled={loading || !email} onClick={messageAction === "signin" ? sendSignInLink : resendConfirmation}>{messageAction === "signin" ? "Send a fresh sign-in link" : "Resend confirmation email"}</button></div> : null}
        {mode === "login" ? <button className="button ghost" type="button" disabled={loading || !email.trim()} onClick={sendSignInLink}>Email me a sign-in link</button> : null}
        <button className="button primary" type="submit" disabled={loading} style={{ width: "100%", justifyContent: "center" }}>{loading ? "Working…" : mode === "login" ? "Log in" : "Create owner account"}</button>
      </form>

      <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap", marginTop: "1.2rem" }}>
        <Link className="text-link" href="/reset-password">Forgot password?</Link>
        <Link className="text-link" href="/">← Back to CQA</Link>
        <Link className="text-link" href="/pricing">View plans</Link>
      </div>
    </section>
  );
}

export default function LoginPage() {
  return <main className="container" style={{ minHeight: "82vh", display: "grid", placeItems: "center", paddingTop: "3rem", paddingBottom: "3rem" }}><Suspense fallback={<p>Loading secure owner access…</p>}><LoginForm /></Suspense></main>;
}
