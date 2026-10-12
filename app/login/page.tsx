"use client";

import { FormEvent, Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getBrowserSupabaseClient } from "@/lib/cqa-marketplace";
import { cqaLoginFailure } from "@/lib/cqa-login-feedback";

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
  const busy = useRef(false);
  const emailRetryAt = useRef(0);
  const [emailWait, setEmailWait] = useState(0);

  useEffect(() => {
    if (!emailWait) return;
    const timer = window.setInterval(() => setEmailWait(Math.max(0, Math.ceil((emailRetryAt.current - Date.now()) / 1000))), 1000);
    return () => window.clearInterval(timer);
  }, [emailWait]);

  function startEmailCooldown(seconds = 60) {
    emailRetryAt.current = Date.now() + seconds * 1000;
    setEmailWait(seconds);
  }

  const requestedNext = searchParams.get("next") || "/owner/dashboard";
  const next = requestedNext.startsWith("/") && !requestedNext.startsWith("//") && !/[\\\u0000-\u0020]/.test(requestedNext) ? requestedNext : "/owner/dashboard";
  const confirmationUrl = `${typeof window === "undefined" ? "" : window.location.origin}/auth/confirm?next=${encodeURIComponent(next)}`;

  function switchMode(value: "login" | "signup") {
    if (loading) return;
    setMode(value); setError(""); setMessage(""); setMessageAction(null);
  }

  async function runAuthAction(action: () => Promise<void>, sendsEmail = false) {
    if (busy.current || (sendsEmail && emailRetryAt.current > Date.now())) return;
    busy.current = true;
    setError(""); setMessage(""); setMessageAction(null); setLoading(true);
    try { await action(); }
    catch (failure) {
      const feedback = cqaLoginFailure(failure, sendsEmail);
      if (feedback.cooldown) startEmailCooldown(feedback.cooldown);
      if (failure && typeof failure === "object" && "code" in failure && failure.code === "email_not_confirmed") {
        setMessageAction("confirmation");
        setMessage("If this address needs confirmation, request a fresh email and check your inbox and spam folder.");
      }
      setError(feedback.message);
    }
    finally { busy.current = false; setLoading(false); }
  }

  async function resendConfirmation() {
    await runAuthAction(async () => {
      const { error: authError } = await supabase.auth.resend({ type: "signup", email: email.trim(), options: { emailRedirectTo: confirmationUrl } });
      if (authError) throw authError;
      startEmailCooldown();
      setMessageAction("confirmation");
      setMessage("If this address needs confirmation, check Inbox and Spam for a fresh confirmation link.");
    }, true);
  }

  async function sendSignInLink() {
    const address = email.trim();
    if (!address || !/^[^\s@]+@[^\s@]+$/.test(address)) { setError("Enter a valid email address first."); return; }
    await runAuthAction(async () => {
      const { error: authError } = await supabase.auth.signInWithOtp({ email: address, options: { shouldCreateUser: false, emailRedirectTo: confirmationUrl } });
      if (authError) throw authError;
      startEmailCooldown();
      setMessageAction("signin");
      setMessage("If this address has an existing CQA account, check Inbox and Spam for your sign-in link. Open the latest email link to securely log in.");
    }, true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runAuthAction(async () => {
      if (mode === "signup") {
        const { data, error: authError } = await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: confirmationUrl } });
        if (authError) throw authError;
        if (!data.session) {
          startEmailCooldown();
          setMessage("If this address needs confirmation, check your inbox and spam folder for the latest link. Existing account holders can log in.");
          setMessageAction("confirmation");
          setMode("login");
          return;
        }
      } else {
        const { data, error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (authError) throw authError;
        if (!data.session) throw new Error("No authenticated session was returned. Please try again.");
      }
      router.push(next); router.refresh();
    }, mode === "signup");
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
        {message ? <div role="status" style={{ display: "grid", gap: ".75rem", padding: ".8rem 1rem", borderRadius: 10, border: "1px solid rgba(80,255,180,.35)", background: "rgba(80,255,180,.07)" }}><span className="small">{message}</span><button className="button ghost" type="button" disabled={loading || !email || emailWait > 0} onClick={messageAction === "signin" ? sendSignInLink : resendConfirmation}>{emailWait > 0 ? `Request another email in ${emailWait}s` : messageAction === "signin" ? "Send a fresh sign-in link" : "Resend confirmation email"}</button></div> : null}
        {emailWait > 0 ? <p className="small" role="status">Email requests are paused for {emailWait}s. Check your inbox and spam folder for the latest link. You can still log in with your password.</p> : null}
        {mode === "login" ? <button className="button ghost" type="button" disabled={loading || !email.trim() || emailWait > 0} onClick={sendSignInLink}>Email me a sign-in link</button> : null}
        <button className="button primary" type="submit" disabled={loading || (mode === "signup" && emailWait > 0)} style={{ width: "100%", justifyContent: "center" }}>{loading ? "Working…" : mode === "login" ? "Log in" : "Create owner account"}</button>
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
