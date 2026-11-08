import Image from "next/image";
import styles from "./MachineArtwork.module.css";

/** The supplied reference is artwork only; customer actions remain real HTML. */
export default function MachineArtwork({ variant = "cabinet", decorative = false, priority = false, className = "" }: {
  variant?: "scene" | "cabinet"; decorative?: boolean; priority?: boolean; className?: string;
}) {
  return <div className={`${styles.artwork} ${styles[variant]} ${className}`} aria-hidden={decorative || undefined}>
    <Image src="/images/cqa-vending-reference.png" alt={decorative ? "" : "CQA vending machine concept with a black cabinet, illuminated glass compartments and pink and aqua lighting"} fill sizes={variant === "scene" ? "(max-width: 700px) 100vw, 55vw" : "(max-width: 640px) 38vw, 300px"} priority={priority} />
  </div>;
}
