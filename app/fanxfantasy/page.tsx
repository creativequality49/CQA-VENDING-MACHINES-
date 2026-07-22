import { cookies } from "next/headers";
import Link from "next/link";
import {
  FANVUE_SESSION_COOKIE,
  FanvueTokenSet,
  getFanvueUser,
  unseal,
} from "../../lib/fanvue-oauth";

export const dynamic = "force-dynamic";

export default async function FanXFantasyPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; connected?: string }>;
}) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const session = unseal<FanvueTokenSet>(cookieStore.get(FANVUE_SESSION_COOKIE)?.value);
  const fanvueUser = await getFanvueUser(session);

  return (
    <main style={{ minHeight: "100vh", background: "#050505", color: "white", padding: "clamp(24px, 6vw, 72px)" }}>
      <section style={{ maxWidth: 960, margin: "0 auto" }}>
        <p style={{ color: "#ff2d8d", fontWeight: 800, letterSpacing: ".16em", textTransform: "uppercase" }}>
          Creative Quality Australia
        </p>
        <h1 style={{ fontSize: "clamp(2.5rem, 8vw, 5.5rem)", lineHeight: .92, margin: "12px 0" }}>
          Fan X Fantasy
        </h1>
        <p style={{ color: "#b5b5c4", maxWidth: 680, fontSize: "1.05rem", lineHeight: 1.7 }}>
          Connect a Fanvue account to the CQA vending ecosystem while keeping Stripe checkout, subscriptions,
          secure downloads and the customer vault inside the existing CQA platform.
        </p>

        {params.error ? (
          <div style={{ marginTop: 24, border: "1px solid rgba(255,45,141,.5)", borderRadius: 18, padding: 18, color: "#ff9ac4" }}>
            {params.error}
          </div>
        ) : null}

        <div style={{ marginTop: 32, border: "1px solid rgba(0,229,255,.28)", borderRadius: 28, padding: "clamp(22px, 5vw, 40px)", background: "linear-gradient(145deg, rgba(255,45,141,.09), rgba(0,229,255,.07))", boxShadow: "0 30px 90px rgba(0,0,0,.45)" }}>
          {fanvueUser ? (
            <>
              <p style={{ color: "#00e5ff", fontWeight: 800 }}>Fanvue connected</p>
              <h2 style={{ fontSize: "clamp(1.6rem, 4vw, 2.6rem)", margin: "8px 0" }}>
                Your Fan X Fantasy connection is active.
              </h2>
              <p style={{ color: "#b5b5c4" }}>
                The account is authenticated and ready for future entitlement, creator-profile and content-sync workflows.
              </p>
              <pre style={{ overflowX: "auto", marginTop: 20, padding: 18, borderRadius: 18, background: "rgba(0,0,0,.45)", color: "#d8faff", fontSize: 12 }}>
                {JSON.stringify(fanvueUser, null, 2)}
              </pre>
              <form action="/api/fanvue/logout" method="post" style={{ marginTop: 20 }}>
                <button type="submit" style={{ border: 0, borderRadius: 999, padding: "13px 20px", fontWeight: 800, cursor: "pointer" }}>
                  Disconnect Fanvue
                </button>
              </form>
            </>
          ) : (
            <>
              <p style={{ color: "#00e5ff", fontWeight: 800 }}>Fanvue connection</p>
              <h2 style={{ fontSize: "clamp(1.6rem, 4vw, 2.6rem)", margin: "8px 0" }}>
                Connect Fan X Fantasy to CQA.
              </h2>
              <p style={{ color: "#b5b5c4", lineHeight: 1.7 }}>
                This connects the Fanvue identity layer without replacing the CQA storefront, vending machines,
                Stripe billing, vault or secure delivery system.
              </p>
              <a href="/api/fanvue/login" style={{ display: "inline-flex", marginTop: 18, borderRadius: 999, padding: "14px 22px", fontWeight: 900, color: "white", textDecoration: "none", background: "linear-gradient(135deg, #ff2d8d, #7c3cff, #00e5ff)" }}>
                Connect with Fanvue
              </a>
            </>
          )}
        </div>

        <div style={{ marginTop: 26 }}>
          <Link href="/" style={{ color: "#00e5ff" }}>← Back to CQA</Link>
        </div>
      </section>
    </main>
  );
}
