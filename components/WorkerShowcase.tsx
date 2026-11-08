import Link from "next/link";
import { CQA_WORKERS } from "@/lib/cqa-marketplace";

const workerDetails = {
  receptionist: {
    label: "YOUR FRONT DESK",
    title: "A thoughtful first response.",
    description: "Turn customer questions into clear reply drafts and booking requests you can review.",
    sample: "Thanks for your enquiry. Which service are you interested in, and what day would suit you? I can pass your preferences to the owner.",
    outputs: ["FAQ reply drafts", "Enquiry summaries", "Booking request preparation"],
    path: "M4 13v-2a8 8 0 0 1 16 0v2 M4 12H3v6h4v-6H4 M20 12h1v6h-4v-6h3 M20 18v1a3 3 0 0 1-3 3h-3",
  },
  sales: {
    label: "YOUR SALES ASSISTANT",
    title: "A clearer next conversation.",
    description: "Help qualify enquiries, match your existing offers and prepare relevant follow-up drafts.",
    sample: "You mentioned needing help with your first launch. The guided setup may be relevant. Would you like the owner to explain the scope and costs?",
    outputs: ["Lead qualification", "Existing offer matching", "Follow-up drafts"],
    path: "M4 3v17h17 M7 14l4-4 4 2 5-7 M16 5h4v4",
  },
  marketing: {
    label: "YOUR CONTENT PARTNER",
    title: "More direction. Less blank page.",
    description: "Create campaign ideas, social captions and email drafts grounded in your business information.",
    sample: "Meet the business behind the brand. This week, introduce your most-requested service, explain who it helps and invite customers to send an enquiry.",
    outputs: ["Campaign concepts", "Social caption drafts", "Email copy for review"],
    path: "M12 3l2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3 M20 2v4 M18 4h4",
  },
} as const;

export default function WorkerShowcase({ compact = false }: { compact?: boolean }) {
  return (
    <section className={compact ? "studio-workers studio-workers-compact" : "studio-workers"} aria-label="CQA AI draft workers">
      <div className="studio-worker-grid">
        {CQA_WORKERS.map(([id, name, price]) => {
          const details = workerDetails[id];
          return (
            <article className="studio-worker" key={id}>
              <div className="studio-worker-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d={details.path} /></svg>
              </div>
              <span className="studio-kicker">{details.label}</span>
              <h3>{name}</h3>
              <strong className="studio-worker-title">{details.title}</strong>
              <p>{details.description}</p>
              <div className="studio-worker-sample">
                <span className="studio-kicker">EXAMPLE DRAFT</span>
                <p>“{details.sample}”</p>
              </div>
              <ul>{details.outputs.map(output => <li key={output}>{output}</li>)}</ul>
              <div className="studio-meta"><strong>Included with Pro &amp; Enterprise</strong><span>Starter add-on · ${price} AUD/month</span></div>
            </article>
          );
        })}
      </div>
      <p className="studio-meta">Examples are illustrative. Workers prepare drafts; they do not automatically confirm bookings, send replies or publish campaigns.</p>
    </section>
  );
}
