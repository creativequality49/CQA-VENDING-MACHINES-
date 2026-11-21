import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function AgeCheckPage() {
  if (process.env.VERCEL_ENV === "production") {
    redirect("https://fanxfantasy-cqa.vercel.app/age-check");
  }
  return (
    <main style={{ maxWidth: 680, margin: "80px auto", padding: "24px", lineHeight: 1.7 }}>
      <p style={{ fontWeight: 700 }}>FanXFantasy · Protected access</p>
      <h1>Age verification is required</h1>
      <p>Age-restricted features remain locked until a verified age-assurance service confirms eligibility.</p>
      <p role="status">Verification is currently unavailable. The provider integration must be validated before verification can start.</p>
      <p>You can continue browsing public previews. No verification result or access permission has been granted.</p>
      <Link href="/fanxfantasy">Back to public previews</Link>
      {" · "}
      <Link href="/contact">Contact support</Link>
    </main>
  );
}
