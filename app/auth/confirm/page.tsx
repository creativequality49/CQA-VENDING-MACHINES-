"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getBrowserSupabaseClient } from "@/lib/cqa-marketplace";

function ConfirmEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => getBrowserSupabaseClient(), []);
  const [status, setStatus] = useState("Confirming your CQA account…");
  const [error, setError] = useState("");

  const requestedNext = searchParams.get("next") || "/owner/dashboard";
  const next = requestedNext.startsWith("/") && !requestedNext.startsWith("//") ? requestedNext : "/owner/dashboard";

  useEffect(() => {
    let active = true;
    let redirected = false;

    const finish = () => {
      if (!active || redirected) return;
      redirected = true;
      router.replace(next);
      router.refresh();
    };

    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const hashError = hash.get("error_description");
    if (hashError) {
      setError(decodeURIComponent(hashError.replace(/\+/g, " ")));
      setStatus("");
      return;
    }

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) finish();
    });

    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return;
      if (sessionError) {
        setError(sessionError.message);
        setStatus("");
        return;
      }
      if (data.session) finish();
    });

    const timer = window.setTimeout(async () => {
      if (!active || redirected) return;
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        finish();
      } else {
        setStatus("Your email is confirmed. Log in once to open your CQA owner dashboard.");
      }
    }, 4500);

    return () => {
      active = false;
      window.clearTimeout(timer);
      listener.subscription.unsubscribe();
    };
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
