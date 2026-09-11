"use client";

import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CQA_PLANS, getBrowserSupabaseClient, type PlanKey } from "@/lib/cqa-marketplace";

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 64);
}

function OnboardingForm() {
  const router = useRouter();
  const search = useSearchParams();
  const supabase = useMemo(() => getBrowserSupabaseClient(), []);
  const requestedPlan = search.get("plan");
  const initialPlan: PlanKey = requestedPlan === "pro" || requestedPlan === "elite" ? requestedPlan : "starter";
  const [userId, setUserId] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Trades & Services");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("South Australia");
  const [phone, setPhone] = useState("");
  const [businessEmail, setBusinessEmail] = useState("");
  const [plan, setPlan] = useState<PlanKey>(initialPlan);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user.id ?? null);
      setBusinessEmail(data.session?.user.email ?? "");
      setChecking(false);
    });
  }, [supabase]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId) return;
    setLoading(true);
    setError("");

    const baseSlug = slugify(name);
    if (!baseSlug) {
      setError("Enter a valid business name.");
      setLoading(false);
      return;
    }

    const { data: existing } = await supabase.from("cqa_businesses").select("id").eq("owner_id", userId).limit(1);
    if (existing?.length) {
      router.push("/owner/dashboard");
      return;
    }

    let business: { id: string } | null = null;
    for (let attempt = 0; attempt < 3 && !business; attempt += 1) {
      const slug = attempt === 0 ? baseSlug : `${baseSlug}-${Math.floor(1000 + Math.random() * 9000)}`;
      const { data, error: businessError } = await supabase
        .from("cqa_businesses")
        .insert({ owner_id: userId, name, slug, category, description, location_text: location, phone: phone || null, email: businessEmail || null, plan, status: "review" })
        .select("id")
        .single();
      if (!businessError && data) business = data as { id: string };
      else if (businessError?.code !== "23505") {
        setError(businessError?.message || "Could not create the business record.");
        setLoading(false);
        return;
      }
    }

    if (!business) {
      setError("That business name is already in use. Please adjust the name and try again.");
      setLoading(false);
      return;
    }

    const machineSlug = `${baseSlug}-machine-${business.id.slice(0, 6)}`;
    const { error: machineError } = await supabase.from("cqa_machines").insert({
      business_id: business.id,
      slug: machineSlug,
      title: `${name} Machine`,
      subtitle: description || `The official ${name} digital vending machine.`,
      theme: plan === "elite" ? "gold" : plan === "pro" ? "cyan" : "pink",
      status: "review",
      assistant_enabled: true
    });

    if (machineError) {
      await supabase.from("cqa_businesses").delete().eq("id", business.id);
      setError(machineError.message);
      setLoading(false);
      return;
    }

    router.push("/owner/dashboard?created=1");
    router.refresh();
  }

  if (checking) return <p>Checking secure owner access…</p>;
  if (!userId) {
    return (
      <section className="glass-card" style={{ padding: "1.5rem", maxWidth: 700, margin: "0 auto" }}>
        <span className="eyebrow">OWNER ACCOUNT REQUIRED</span>
        <h1>Create or log in to your CQA owner account first.</h1>
        <p className="small">Your owner account protects your business data and ensures only you can manage your machine.</p>
        <Link href="/login?next=/onboarding" className="button primary">Continue to secure login</Link>
      </section>
    );
  }

  return (
    <form onSubmit={submit} className="glass-card" style={{ padding: "1.5rem", maxWidth: 850, margin: "0 auto", display: "grid", gap: "1rem" }}>
      <div><span className="eyebrow">CQA BUSINESS ONBOARDING</span><h1>Build your business machine.</h1><p className="small">Submit the business details CQA will use to prepare your storefront. Your machine stays in review until it is ready for public customers.</p></div>
      <label><span className="small">Business name</span><input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Example: Summit Plumbing Co." /></label>
      <label><span className="small">Business category</span><select value={category} onChange={(e) => setCategory(e.target.value)}><option>Trades & Services</option><option>Beauty</option><option>Fitness</option><option>Coaching</option><option>Professional Services</option><option>Retail</option><option>Creator</option><option>Other</option></select></label>
      <label><span className="small">What does the business provide?</span><textarea required rows={4} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe your services, products and ideal customers." /></label>
      <div className="grid grid-2">
        <label><span className="small">Service area / location</span><input required value={location} onChange={(e) => setLocation(e.target.value)} /></label>
        <label><span className="small">Business phone</span><input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Optional" /></label>
      </div>
      <label><span className="small">Business contact email</span><input type="email" required value={businessEmail} onChange={(e) => setBusinessEmail(e.target.value)} /></label>
      <fieldset style={{ border: 0, padding: 0, margin: 0 }}><legend className="small" style={{ marginBottom: ".6rem" }}>Machine plan</legend><div className="grid grid-3">{CQA_PLANS.map((item) => <label key={item.key} className="glass-card" style={{ padding: "1rem", cursor: "pointer", border: plan === item.key ? "1px solid #ff7bd3" : undefined }}><input type="radio" name="plan" checked={plan === item.key} onChange={() => setPlan(item.key)} /> <strong>{item.name}</strong><br/><span className="small">${item.price}/month · {item.fee}% sale fee</span></label>)}</div></fieldset>
      {error ? <div role="alert" style={{ padding: ".8rem 1rem", borderRadius: 10, border: "1px solid rgba(255,70,100,.4)" }}>{error}</div> : null}
      <button className="button primary" type="submit" disabled={loading} style={{ justifyContent: "center" }}>{loading ? "Creating your machine…" : "Submit Business for CQA Review"}</button>
      <p className="small">Submitting creates your private owner workspace. Public publication and live customer payments remain disabled until CQA verification and Stripe onboarding are complete.</p>
    </form>
  );
}

export default function OnboardingPage() {
  return <main className="container" style={{ paddingTop: "2.5rem", paddingBottom: "4rem" }}><Suspense fallback={<p>Loading onboarding…</p>}><OnboardingForm /></Suspense></main>;
}
