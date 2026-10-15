import Link from "next/link";
import styles from "./MachineBuildDemo.module.css";

const stages = [
  ["00:00", "Explore the preview", "Start with an illustrative template before you pay."],
  ["00:10", "Make it your business", "Add your business name, description and colours."],
  ["00:20", "Shape your offers", "Give services clear names, descriptions and prices."],
  ["00:30", "Review your plan", "Check the inclusions, monthly price and any optional setup fee before activating."],
  ["00:40", "Connect your payments", "After activation, connect Stripe and complete its verification requirements."],
  ["00:50", "Review, publish and share", "Check your machine, publish when your plan and payment account are ready, then see the customer view."],
];

export default function MachineBuildDemo() {
  return (
    <section id="machine-build-demo" className={`cqa-home-shell ${styles.section}`} aria-labelledby="machine-build-title">
      <header className={styles.header}>
        <div>
          <p className="cqa-kicker"><i /> FROM IDEA TO CUSTOMER VIEW</p>
          <h2 id="machine-build-title">Watch your machine <span>come together.</span></h2>
        </div>
        <p>A one-minute example of the journey: preview your design, add your business and offers, then prepare it for customers.</p>
      </header>
      <div className={styles.player}>
        <div className={styles.bar}><span><i /> CQA BUILD WALKTHROUGH</span><span>60 SECONDS · ILLUSTRATIVE DEMO</span></div>
        <video className={styles.video} controls playsInline preload="metadata" poster="/videos/cqa-machine-build-poster.jpg" aria-label="Example of building a CQA digital business machine" aria-describedby="machine-build-note">
          <source src="/videos/cqa-machine-build.webm" type="video/webm" />
          <source src="/videos/cqa-machine-build.mp4" type="video/mp4" />
          <track default kind="captions" src="/videos/cqa-machine-build.vtt" srcLang="en" label="English" />
          Your browser cannot play this video. Read the walkthrough below or <a href="/videos/cqa-machine-build.mp4">open the video</a>.
        </video>
      </div>
      <div className={styles.below}>
        <p id="machine-build-note">Illustrative example with sample business details; no real payment is shown. This is a condensed walkthrough, not a promise of a one-minute launch. Plan activation and Stripe verification are required before publishing. Features, including AI assistance, depend on your plan.</p>
        <Link href="/onboarding?plan=pro" className="button primary">Try your own preview <b>→</b></Link>
      </div>
      <details className={styles.transcript}>
        <summary>Read the step-by-step walkthrough</summary>
        <ol>{stages.map(([time, title, description]) => <li key={time}><span>{time}</span><div><h3>{title}</h3><p>{description}</p></div></li>)}</ol>
      </details>
    </section>
  );
}
