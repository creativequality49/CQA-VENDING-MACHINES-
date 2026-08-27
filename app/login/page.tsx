"use client";

import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const next = searchParams.get("next") || "/lead-machine";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!supabaseUrl || !supabaseAnonKey) {
      setError("Customer login is not configured yet. Please contact CQA support.");
      return;
    }

    setLoading(true);
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setError(authError.message === "Invalid login credentials" ? "Incorrect email or password." : authError.message);
      setLoading(false);
      return;
    }

    router.push(next.startsWith("/") ? next : "/lead-machine");
    router.refresh();
  }

  return (
    <section className="glass-card" style={{ width: "100%", maxWidth: 520, padding: "1.5rem" }}>
      <div style={{ marginBottom: "1.5rem" }}>
        <span className="eyebrow">CQA CUSTOMER ACCESS</span>
        <h1 style={{ marginBottom: ".55rem" }}>Log in to your workspace</h1>
        <p className="small" style={{ margin: 0 }}>
          Access your purchased machines, lead workspace, delivery files and account tools.
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: "1rem" }}>
        <label style={{ display: "grid", gap: ".45rem" }}>
          <span className="small">Email address</span>
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@business.com"
            style={{ width: "100%", padding: ".9rem 1rem", borderRadius: 12, border: "1px solid rgba(255,255,255,.14)", background: "rgba(255,255,255,.04)", color: "inherit" }}
          />
        </label>

        <label style={{ display: "grid", gap: ".45rem" }}>
          <span className="small">Password</span>
          <input
            type="password"
            autoComplete="current-password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            style={{ width: "100%", padding: ".9rem 1rem", borderRadius: 12, border: "1px solid rgba(255,255,255,.14)", background: "rgba(255,255,255,.04)", color: "inherit" }}
          />
        </label>

        {error ? (
          <div role="alert" style={{ padding: ".8rem 1rem", borderRadius: 10, border: "1px solid rgba(255,70,100,.4)", background: "rgba(255,70,100,.08)" }}>
            <span className="small">{error}</span>
          </div>
        ) : null}

        <button className="button primary" type="submit" disabled={loading} style={{ width: "100%", justifyContent: "center" }}>
          {loading ? "Signing in…" : "Log in"}
        </button>
      </form>

      <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap", marginTop: "1.2rem" }}>
        <Link className="text-link" href="/">← Back to CQA</Link>
        <span className="small">Secure customer workspace</span>
      </div>
    </section>
  );
}

function LoginFallback() {
  return (
    <section className="glass-card" style={{ width: "100%", maxWidth: 520, padding: "1.5rem" }}>
      <span className="eyebrow">CQA CUSTOMER ACCESS</span>
      <h1 style={{ marginBottom: ".55rem" }}>Loading login…</h1>
      <p className="small" style={{ margin: 0 }}>Preparing your secure customer workspace.</p>
    </section>
  );
}

export default function LoginPage() {
  return (
    <main className="container" style={{ minHeight: "82vh", display: "grid", placeItems: "center", paddingTop: "3rem", paddingBottom: "3rem" }}>
      <Suspense fallback={<LoginFallback />}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
