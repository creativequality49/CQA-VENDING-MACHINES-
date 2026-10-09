"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { completeCqaAuthCallback } from "@/lib/cqa-auth-callback";
import { getBrowserSupabaseClient } from "@/lib/cqa-marketplace";

function ConfirmEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => getBrowserSupabaseClient(), []);
  const callbackSnapshot = useRef<URL | null>(null);
  const [status, setStatus] = useState("Confirming your CQA account…");
  const [error, setError] = useState("");

  const requestedNext = searchParams.get("next") || "/owner/dashboard";
  const nextCandidate = requestedNext.startsWith("/") && !requestedNext.startsWith("//") && !/[\\\u0000-\u0020]/.test(requestedNext) ? requestedNext : "/owner/dashboard";
  const next = useRef(nextCandidate).current;

  useEffect(() => {
    let active = true;
    const url = callbackSnapshot.current ||= new URL(window.location.href);
    // Keep only the in-memory snapshot while verification runs, including failures.
    if (url.hash || url.searchParams.has("code") || url.searchParams.has("token_hash") || url.searchParams.has("error") || url.searchParams.has("error_code") || url.searchParams.has("error_description")) window.history.replaceState(null, "", window.location.pathname);
    void completeCqaAuthCallback(supabase, url).then(({ session, recovery }) => {
      if (!active) return;
      if (!session) { setStatus("No active session was found. Log in or request a fresh confirmation email."); return; }
      // Remove credentials from the address bar before navigating.
      window.history.replaceState(null, "", window.location.pathname);
      router.replace(recovery ? "/reset-password?flow=recovery" : next);
      router.refresh();
    }).catch((failure) => {
      if (active) { setError(failure instanceof Error ? failure.message : "This email link could not be verified."); setStatus(""); }
    });
    return () => { active = false; };
  }, [next, router, supabase]);

  return (
    <section className="glass-card" style={{ width: "100%", maxWidth: 560, padding: "1.5rem" }}>
      <span className="eyebrow">CQA ACCOUNT CONFIRMATION</span>
      <h1>Email confirmation</h1>
      {status ? <p>{status}</p> : null}
      {error ? <div role="alert" style={{ padding: ".8rem 1rem", borderRadius: 10, border: "1px solid rgba(255,70,100,.4)", background: "rgba(255,70,100,.08)", marginBottom: "1rem" }}>{error}</div> : null}
      <div style={{ display: "flex", gap: ".75rem", flexWrap: "wrap" }}>
        <Link className="button primary" href={`/login?next=${encodeURIComponent(next)}`}>Log in</Link>
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
