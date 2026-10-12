"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { completeCqaAuthCallback, cqaAuthCleanUrl, cqaAuthDestination } from "@/lib/cqa-auth-callback";
import { getBrowserSupabaseClient } from "@/lib/cqa-marketplace";

function ConfirmEmailContent() {
  const supabase = useMemo(() => getBrowserSupabaseClient(), []);
  const callbackSnapshot = useRef<URL | null>(null);
  const [status, setStatus] = useState("Confirming your CQA account…");
  const [error, setError] = useState("");
  const [next, setNext] = useState("/owner/dashboard");

  useEffect(() => {
    let active = true;
    const url = callbackSnapshot.current ||= new URL(window.location.href);
    const destination = cqaAuthDestination(url);
    setNext(destination);
    // Keep the callback snapshot and next destination independent of Next's history updates.
    window.history.replaceState(null, "", cqaAuthCleanUrl(url));
    const timeout = window.setTimeout(() => {
      if (active) {
        setStatus("");
        setError("Confirmation is taking longer than expected. Try logging in, or request a fresh email if needed.");
      }
    }, 20000);
    void completeCqaAuthCallback(supabase, url).then(({ session, recovery }) => {
      if (!active) return;
      window.clearTimeout(timeout);
      if (!session) { setStatus("No active session was found. Log in or request a fresh confirmation email."); return; }
      setError("");
      setStatus("Account confirmed. Opening your workspace…");
      // A full document navigation avoids a stalled client-router transition after
      // scrubbing credentials. setSession has already persisted the verified session.
      window.location.replace(recovery ? "/reset-password?flow=recovery" : destination);
    }).catch((failure) => {
      window.clearTimeout(timeout);
      if (active) { setError(failure instanceof Error ? failure.message : "This email link could not be verified."); setStatus(""); }
    });
    return () => { active = false; window.clearTimeout(timeout); };
  }, [supabase]);

  return (
    <section className="glass-card" style={{ width: "100%", maxWidth: 560, padding: "1.5rem" }}>
      <span className="eyebrow">CQA ACCOUNT CONFIRMATION</span>
      <h1>Email confirmation</h1>
      {status ? <p>{status}</p> : null}
      {error ? <div role="alert" style={{ padding: ".8rem 1rem", borderRadius: 10, border: "1px solid rgba(255,70,100,.4)", background: "rgba(255,70,100,.08)", marginBottom: "1rem" }}>{error}</div> : null}
      <div style={{ display: "flex", gap: ".75rem", flexWrap: "wrap" }}>
        <Link className="button primary" href={`/login?next=${encodeURIComponent(next)}`}>Log in or request a fresh email</Link>
        <Link className="button ghost" href="/reset-password">Password recovery</Link>
        <Link className="button ghost" href="/">CQA Home</Link>
      </div>
    </section>
  );
}

export default function ConfirmEmailPage() {
  return (
    <main className="container" style={{ minHeight: "82vh", display: "grid", placeItems: "center", paddingTop: "3rem", paddingBottom: "3rem" }}>
      <Suspense fallback={<p>Confirming your CQA account…</p>}>
        <ConfirmEmailContent />
      </Suspense>
    </main>
  );
}
