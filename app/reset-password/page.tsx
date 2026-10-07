"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getBrowserSupabaseClient } from "@/lib/cqa-marketplace";

export default function ResetPasswordPage() {
  const supabase = useMemo(() => getBrowserSupabaseClient(), []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [recovery, setRecovery] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const recoveryLink = hash.get("type") === "recovery";
    if (hash.get("error_description")) setError(hash.get("error_description")!);
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (active && session && (event === "PASSWORD_RECOVERY" || recoveryLink)) setRecovery(true);
    });
    void supabase.auth.getSession().then(({ data: sessionData, error: sessionError }) => {
      if (!active) return;
      if (sessionError) setError(sessionError.message);
      if (recoveryLink && sessionData.session) setRecovery(true);
    });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, [supabase]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(""); setMessage("");
    if (recovery && password !== confirmation) { setError("Passwords must match."); return; }
    setLoading(true);
    try {
      if (recovery) {
        const { error: updateError } = await supabase.auth.updateUser({ password });
        if (updateError) throw updateError;
        await supabase.auth.signOut();
        setRecovery(false); setPassword(""); setConfirmation("");
        setMessage("Password updated. Log in with your new password.");
      } else {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`
        });
        if (resetError) throw resetError;
        setMessage("If this email has a CQA account, a recovery link has been sent. Check your inbox and spam folder.");
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to reset your password. Please try again.");
    } finally { setLoading(false); }
  }

  return <main className="container" style={{ minHeight: "82vh", display: "grid", placeItems: "center", paddingBlock: "3rem" }}>
    <section className="glass-card" style={{ width: "100%", maxWidth: 540, padding: "1.5rem" }}>
      <span className="eyebrow">CQA OWNER ACCOUNT</span>
      <h1>{recovery ? "Choose a new password" : "Reset your password"}</h1>
      <p>{recovery ? "Enter your new password twice to update your account." : "Enter your account email to receive a secure recovery link."}</p>
      <form onSubmit={submit} style={{ display: "grid", gap: "1rem" }}>
        {recovery ? <>
          <label>New password<input style={{ width: "100%" }} type="password" autoComplete="new-password" required minLength={8} value={password} onChange={event => setPassword(event.target.value)} /></label>
          <label>Confirm password<input style={{ width: "100%" }} type="password" autoComplete="new-password" required minLength={8} value={confirmation} onChange={event => setConfirmation(event.target.value)} /></label>
        </> : <label>Email address<input style={{ width: "100%" }} type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} /></label>}
        {error && <p role="alert">{error}</p>}
        {message && <p role="status">{message}</p>}
        <button className="button primary" disabled={loading} type="submit">{loading ? "Working…" : recovery ? "Update password" : "Send recovery link"}</button>
        <Link href="/login">Return to login</Link>
      </form>
    </section>
  </main>;
}
