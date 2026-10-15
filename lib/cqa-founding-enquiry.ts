export type FoundingEnquiry = { name: string; email: string; businessKind: string; offer: string; updates: boolean; website?: string };

export function createFoundingEnquirySender(fetcher: typeof fetch = fetch) {
  let pending: Promise<void> | null = null;
  let saved = false;
  return (details: FoundingEnquiry): Promise<void> => {
    if (saved) return Promise.resolve();
    if (pending) return pending;
    pending = (async () => {
      if (details.website || !details.updates || details.name.trim().length < 2 || details.name.trim().length > 120 || details.email.trim().length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(details.email.trim()) || details.businessKind.trim().length < 2 || details.businessKind.trim().length > 120 || details.offer.trim().length < 10 || details.offer.trim().length > 1600) {
        throw new Error("Please complete the required details and request programme updates.");
      }
      const response = await fetcher("/api/contact", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: details.name.trim(), email: details.email.trim(), service: "founding-customer-early-access", price: "AUD97/mo + 5% sales + Stripe fees", message: `Founding customer early-access request.\nBusiness kind: ${details.businessKind.trim()}\nWhat I want to sell: ${details.offer.trim()}\nI request contact about this programme and launch readiness. No general marketing consent. No payment, guaranteed place or subscription requested.` })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.ok !== true) throw new Error(result.error || "Your request could not be saved. Please try again.");
      saved = true;
    })().finally(() => { pending = null; });
    return pending;
  };
}
