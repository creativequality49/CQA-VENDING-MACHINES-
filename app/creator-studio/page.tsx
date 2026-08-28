"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Mode = "chat" | "image" | "video";
type Status = { chat: boolean; image: boolean; video: boolean; fanvueMessaging: boolean };
type ChatItem = { role: "user" | "assistant"; content: string };

const card: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,.1)",
  background: "linear-gradient(145deg, rgba(255,45,141,.08), rgba(0,229,255,.06))",
  borderRadius: 24,
  padding: 20,
};

export default function CreatorStudioPage() {
  const [mode, setMode] = useState<Mode>("chat");
  const [adultConfirmed, setAdultConfirmed] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");
  const [status, setStatus] = useState<Status | null>(null);
  const [chat, setChat] = useState<ChatItem[]>([]);

  useEffect(() => {
    fetch("/api/creator/run", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setStatus(d.configured ?? null))
      .catch(() => setStatus(null));
  }, []);

  const activeConfigured = useMemo(() => (status ? status[mode] : false), [status, mode]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!prompt.trim()) return;
    setBusy(true);
    setResult("");

    const currentPrompt = prompt.trim();
    if (mode === "chat") setChat((items) => [...items, { role: "user", content: currentPrompt }]);

    try {
      const response = await fetch("/api/creator/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          message: mode === "chat" ? currentPrompt : undefined,
          prompt: mode !== "chat" ? currentPrompt : undefined,
          character: "Scarlett May",
          adultConfirmed,
          conversation: chat,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setResult(data.error || "Request failed.");
        return;
      }

      if (mode === "chat") {
        const text = data.text || "No reply returned.";
        setChat((items) => [...items, { role: "assistant", content: text }]);
        setPrompt("");
      } else {
        setResult(JSON.stringify(data.result, null, 2));
      }
    } catch {
      setResult("The creator API could not be reached.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", background: "#050505", color: "white", padding: "clamp(22px,5vw,64px)" }}>
      <section style={{ maxWidth: 1180, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div>
            <p style={{ color: "#ff2d8d", fontWeight: 900, letterSpacing: ".16em", textTransform: "uppercase", margin: 0 }}>
              Creative Quality Australia
            </p>
            <h1 style={{ fontSize: "clamp(2.4rem,7vw,5rem)", lineHeight: .95, margin: "12px 0" }}>Creator Studio</h1>
            <p style={{ color: "#b7b7c7", maxWidth: 720, lineHeight: 1.7 }}>
              Scarlett May image, video and customer-chat command centre. Generation keys stay server-side and adult content requires an 18+ confirmation.
            </p>
          </div>
          <Link href="/fanxfantasy" style={{ color: "#00e5ff", textDecoration: "none", fontWeight: 800 }}>Fan X Fantasy →</Link>
        </div>

        <div style={{ ...card, marginTop: 24 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {(["chat", "image", "video"] as Mode[]).map((item) => (
              <button
                key={item}
                onClick={() => { setMode(item); setResult(""); }}
                style={{
                  border: item === mode ? "1px solid #00e5ff" : "1px solid rgba(255,255,255,.12)",
                  background: item === mode ? "rgba(0,229,255,.12)" : "rgba(255,255,255,.04)",
                  color: "white",
                  borderRadius: 999,
                  padding: "11px 18px",
                  cursor: "pointer",
                  fontWeight: 900,
                  textTransform: "capitalize",
                }}
              >
                {item}
              </button>
            ))}
          </div>

          <div style={{ marginTop: 18, display: "grid", gap: 12 }}>
            <div style={{ color: activeConfigured ? "#7dffb2" : "#ffca72", fontWeight: 800 }}>
              {status ? (activeConfigured ? `${mode} provider connected` : `${mode} provider needs configuration`) : "Checking provider status…"}
            </div>
            <div style={{ color: status?.fanvueMessaging ? "#7dffb2" : "#b7b7c7", fontSize: 14 }}>
              Fanvue messaging: {status?.fanvueMessaging ? "API key detected" : "awaiting approved API access/key"}
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 18, marginTop: 18 }}>
          <form onSubmit={submit} style={card}>
            <label style={{ display: "block", fontWeight: 900, marginBottom: 10 }}>
              {mode === "chat" ? "Message Scarlett" : mode === "image" ? "Image prompt" : "Video prompt"}
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={
                mode === "chat"
                  ? "Hey Scarlett, what are you up to tonight?"
                  : mode === "image"
                    ? "Scarlett May, luxury penthouse, confident pose, cinematic soft lighting, 85mm portrait..."
                    : "Scarlett May walking through a neon city at night, subtle hair movement, cinematic camera push-in..."
              }
              style={{ width: "100%", minHeight: 170, resize: "vertical", borderRadius: 18, border: "1px solid rgba(255,255,255,.12)", background: "rgba(0,0,0,.35)", color: "white", padding: 16, boxSizing: "border-box", font: "inherit" }}
            />

            {mode !== "chat" ? (
              <label style={{ display: "flex", gap: 10, alignItems: "flex-start", marginTop: 14, color: "#d4d4df", lineHeight: 1.5 }}>
                <input type="checkbox" checked={adultConfirmed} onChange={(e) => setAdultConfirmed(e.target.checked)} style={{ marginTop: 4 }} />
                I confirm I am 18+ and any adult generation request involves fictional or consenting adult subjects only.
              </label>
            ) : null}

            <button
              type="submit"
              disabled={busy}
              style={{ marginTop: 16, border: 0, borderRadius: 999, padding: "14px 22px", fontWeight: 900, cursor: busy ? "wait" : "pointer", color: "white", background: "linear-gradient(135deg,#ff2d8d,#7c3cff,#00e5ff)", opacity: busy ? .65 : 1 }}
            >
              {busy ? "Running…" : mode === "chat" ? "Send message" : mode === "image" ? "Generate image" : "Generate video"}
            </button>
          </form>

          <section style={card}>
            <h2 style={{ marginTop: 0 }}>{mode === "chat" ? "Conversation" : "Generation output"}</h2>
            {mode === "chat" ? (
              <div style={{ display: "grid", gap: 10, maxHeight: 460, overflowY: "auto" }}>
                {chat.length === 0 ? <p style={{ color: "#9494a8" }}>No messages yet.</p> : null}
                {chat.map((item, index) => (
                  <div key={`${item.role}-${index}`} style={{ padding: 13, borderRadius: 16, background: item.role === "assistant" ? "rgba(255,45,141,.1)" : "rgba(0,229,255,.08)", border: "1px solid rgba(255,255,255,.08)" }}>
                    <strong style={{ color: item.role === "assistant" ? "#ff7cb8" : "#6ef4ff" }}>{item.role === "assistant" ? "Scarlett" : "Customer"}</strong>
                    <div style={{ marginTop: 6, whiteSpace: "pre-wrap", lineHeight: 1.55 }}>{item.content}</div>
                  </div>
                ))}
                {result ? <div style={{ color: "#ffca72" }}>{result}</div> : null}
              </div>
            ) : (
              <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", color: result ? "#d8faff" : "#9494a8", lineHeight: 1.6 }}>
                {result || "Generated provider response will appear here."}
              </pre>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}
