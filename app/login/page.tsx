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

  const next = searchParams.get("next") || "/owner/dashboard";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    if (mode === "signup") {
      const { data, error: authError } = await supabase.auth.signUp({ email, password });
      if (authError) {
        setError(authError.message);
        setLoading(false);
        return;
      }
      if (!data.session) {
        setMessage("Account created. Check your email to confirm your address, then log in to continue.");
        setMode("login");
        setLoading(false);
        return;
      }
      router.push("/onboarding");
      router.refresh();
      return;
    }

    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) {
      setError(authError.message === "Invalid login credentials" ? "Incorrect email or password." : authError.message);
      setLoading(false);
      return;
    }

    router.push(next.startsWith("/") ? next : "/owner/dashboard");
    router.refresh();
  }

  return (
    <section className="glass-card" style={{ width: "100%", maxWidth: 540, padding: "1.5rem" }}>
      <div style={{ marginBottom: "1.25rem" }}>
        <span className="eyebrow">CQA BUSINESS OWNER ACCESS</span>
        <h1 style={{ marginBottom: ".55rem" }}>{mode === "login" ? "Log in to your machine" : "Create your owner account"}</h1>
        <p className="small" style={{ margin: 0 }}>Manage your CQA business machine, offers, bookings, AI workers and launch status.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: ".5rem", marginBottom: "1rem" }}>
        <button className={`button ${mode === "login" ? "primary" : "ghost"}`} type="button" onClick={() => setMode("login")}>Log in</button>
        <button className={`button ${mode === "signup" ? "primary" : "ghost"}`} type="button" onClick={() => setMode("signup")}>Create account</button>
      </div>

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: "1rem" }}>
        <label style={{ display: "grid", gap: ".45rem" }}>
          <span className="small">Email address</span>
          <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@business.com" style={{ width: "100%", padding: ".9rem 1rem", borderRadius: 12, border: "1px solid rgba(255,255,255,.14)", background: "rgba(255,255,255,.04)", color: "inherit" }} />
        </label>
        <label style={{ display: "grid", gap: ".45rem" }}>
          <span className="small">Password</span>
          <input type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimum 8 characters" style={{ width: "100%", padding: ".9rem 1rem", borderRadius: 12, border: "1px solid rgba(255,255,255,.14)", background: "rgba(255,255,255,.04)", color: "inherit" }} />
        </label>
        {error ? <div role="alert" style={{ padding: ".8rem 1rem", borderRadius: 10, border: "1px solid rgba(255,70,100,.4)", background: "rgba(255,70,100,.08)" }}><span className="small">{error}</span></div> : null}
        {message ? <div role="status" style={{ padding: ".8rem 1rem", borderRadius: 10, border: "1px solid rgba(80,255,180,.35)", background: "rgba(80,255,180,.07)" }}><span className="small">{message}</span></div> : null}
        <button className="button primary" type="submit" disabled={loading} style={{ width: "100%", justifyContent: "center" }}>{loading ? "Working…" : mode === "login" ? "Log in" : "Create owner account"}</button>
      </form>

      <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap", marginTop: "1.2rem" }}>
        <Link className="text-link" href="/">← Back to CQA</Link>
        <Link className="text-link" href="/pricing">View plans</Link>
      </div>
    </section>
  );
}

export default function LoginPage() {
  return <main className="container" style={{ minHeight: "82vh", display: "grid", placeItems: "center", paddingTop: "3rem", paddingBottom: "3rem" }}><Suspense fallback={<p>Loading secure owner access…</p>}><LoginForm /></Suspense></main>;
}
