"use client";

import { FormEvent, useRef, useState } from "react";
import Link from "next/link";
import { createFoundingEnquirySender } from "@/lib/cqa-founding-enquiry";
import styles from "./founding.module.css";

export default function FoundingForm() {
  const sender = useRef(createFoundingEnquirySender());
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setError(""); setStatus("saving");
    try {
      await sender.current({ name: String(data.get("name") || ""), email: String(data.get("email") || ""), businessKind: String(data.get("businessKind") || ""), offer: String(data.get("offer") || ""), updates: data.get("updates") === "on", website: String(data.get("website") || "") });
      setStatus("saved");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Your request could not be saved."); setStatus("idle"); }
  }
  if (status === "saved") return <div className={styles.confirmation} role="status"><h3>Your early-access request is saved.</h3><p>CQA will review your business and contact you at the email you provided about programme readiness and next steps. No payment has been taken, no subscription has started, and a place is not guaranteed.</p><Link href="/#machine-build-demo" className="button ghost">Watch the example build</Link></div>;
  return <form className={styles.form} onSubmit={submit}>
    <label>Your name<input name="name" autoComplete="name" minLength={2} maxLength={120} required /></label>
    <label>Business email<input name="email" type="email" autoComplete="email" maxLength={200} required /></label>
    <label>Business kind<input name="businessKind" placeholder="For example, beauty services or consulting" minLength={2} maxLength={120} required /></label>
    <label>What would you sell first?<textarea name="offer" placeholder="Describe one service or offer you want customers to buy." minLength={10} maxLength={1600} rows={4} required /></label>
    <label className={styles.trap} aria-hidden="true">Leave this blank<input name="website" tabIndex={-1} autoComplete="off" /></label>
    <label className={styles.consent}><input name="updates" type="checkbox" required /><span>Contact me about my founding-customer request, launch readiness and onboarding. This does not sign me up for general marketing.</span></label>
    <p className="small">Your details are saved privately in CQA’s enquiry pipeline to review and respond to this request. Do not include customer records or payment details. You can ask CQA to stop programme updates when contacted.</p>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    <button className="button primary" type="submit" disabled={status === "saving"}>{status === "saving" ? "Saving your request…" : "Request early access"}</button>
    <p className="small">No card required. No charge. No guaranteed reservation.</p>
  </form>;
}
