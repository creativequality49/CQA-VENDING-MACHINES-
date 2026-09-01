import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function AgeCheckPage() {
  redirect("https://fanxfantasy-cqa.vercel.app/age-check");
}
