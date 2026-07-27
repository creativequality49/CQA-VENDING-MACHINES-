"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import styles from "./quiz.module.css";

type Answer = { label: string; points: number; hours: number };

const questions: { title: string; answers: Answer[] }[] = [
  {
    title: "How many hours a week do you spend on manual admin? (rosters, DMs, bookings, posting)",
    answers: [
      { label: "Less than 5 hours", points: 1, hours: 2 },
      { label: "5–10 hours", points: 2, hours: 8 },
      { label: "10–20 hours", points: 3, hours: 15 },
      { label: "20+ hours — it never ends", points: 4, hours: 25 },
    ],
  },
  {
    title: "How fast do new leads or enquiries get a reply?",
    answers: [
      { label: "Instantly — it is automated", points: 1, hours: 0 },
      { label: "Within a few hours", points: 2, hours: 0 },
      { label: "Usually the next day", points: 3, hours: 0 },
      { label: "Honestly… some never get replies", points: 4, hours: 0 },
    ],
  },
  {
    title: "Are you currently using any AI or automation in your business?",
    answers: [
      { label: "Yes, several systems are running", points: 1, hours: 0 },
      { label: "I tried a tool or two, but it did not stick", points: 2, hours: 0 },
      { label: "I want to, but do not know where to start", points: 3, hours: 0 },
      { label: "None — everything is manual", points: 4, hours: 0 },
    ],
  },
];

export default function QuizPage() {
  const [step, setStep] = useState(0);
  const [painScore, setPainScore] = useState(0);
  const [hoursLost, setHoursLost] = useState(0);
  const [email, setEmail] = useState("");
  const [resultVisible, setResultVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const readiness = useMemo(() => Math.max(10, Math.round(100 - (painScore / 12) * 90)), [painScore]);
  const monthlyLoss = useMemo(() => Math.round(hoursLost * 4 * 55), [hoursLost]);
  const yearlyLoss = monthlyLoss * 12;

  const result = useMemo(() => {
    if (readiness >= 70) return { verdict: "AI-Ready — you are ahead of most", detail: "You have solid foundations. Your audit will identify the next automations that can remove bottlenecks and support faster growth." };
    if (readiness >= 40) return { verdict: "On the Edge — your business is leaking time weekly", detail: "Too much of your operation still depends on manual work. The highest-impact missing systems can be prioritised into a focused implementation roadmap." };
    return { verdict: "Critically Behind — every manual week is costing you", detail: "Competitors using automation can reply faster, publish more consistently and reduce repetitive admin. Your business is positioned to gain quickly from a targeted AI installation." };
  }, [readiness]);

  function selectAnswer(answer: Answer) {
    setPainScore((value) => value + answer.points);
    setHoursLost((value) => value + answer.hours);
    setStep((value) => value + 1);
    setError("");
  }

  async function revealScore(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError("Enter a valid business email to receive your score.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/quiz-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, readiness, monthlyLoss, yearlyLoss, painScore, hoursLost }),
      });
      if (!response.ok) throw new Error("Lead capture failed");
      setResultVisible(true);
    } catch {
      setError("We could not save your report details. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const progress = resultVisible ? 100 : (step / 4) * 100;

  return (
    <main className={styles.page}>
      <section className={styles.box}>
        <div className={styles.kicker}>AI ONRAMP BY CQA</div>
        <h1>Your <span>AI Readiness</span> Score</h1>
        <p className={styles.sub}>3 questions. 60 seconds. See how much your business may be losing without AI.</p>
        <div className={styles.bar}><div className={styles.fill} style={{ width: `${progress}%` }} /></div>

        {!resultVisible && step < questions.length && (
          <div>
            <h2>{step + 1}. {questions[step].title}</h2>
            {questions[step].answers.map((answer) => (
              <button className={styles.option} key={answer.label} onClick={() => selectAnswer(answer)}>{answer.label}</button>
            ))}
          </div>
        )}

        {!resultVisible && step === questions.length && (
          <form onSubmit={revealScore}>
            <h2>Almost done — where should we send your score and custom report?</h2>
            <label className={styles.srOnly} htmlFor="quiz-email">Business email</label>
            <input id="quiz-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@business.com.au" autoComplete="email" />
            {error && <p className={styles.error}>{error}</p>}
            <button className={styles.primary} type="submit" disabled={submitting}>{submitting ? "Calculating…" : "Reveal My Score →"}</button>
          </form>
        )}

        {resultVisible && (
          <div className={styles.result}>
            <p className={styles.resultLabel}>YOUR AI READINESS SCORE</p>
            <div className={styles.score}>{readiness}</div>
            <div className={styles.verdict}>{result.verdict}</div>
            <div className={styles.loss}>Estimated monthly time and opportunity loss <strong>${monthlyLoss.toLocaleString("en-AU")}</strong><small>Approximately ${yearlyLoss.toLocaleString("en-AU")} per year</small></div>
            <p className={styles.detail}>{result.detail}</p>
            <Link className={styles.primary} href="/contact?service=ai-readiness-audit&price=497">Book Your $497 AI Audit →</Link>
            <Link className={styles.secondary} href="/machines">View CQA Automation Machines</Link>
          </div>
        )}

        <div className={styles.brand}>AI OnRamp — a Creative Quality Australia brand</div>
      </section>
    </main>
  );
}
