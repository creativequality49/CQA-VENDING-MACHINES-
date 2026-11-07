import "server-only";
import { getCqaSupabaseAdmin } from "@/lib/cqa-supabase-admin";
import { getCqaSiteUrl } from "@/lib/cqa-site-url";

// Provider idempotency protects retries after payment is durably recorded.
export async function sendCqaTransactionalEmail(key: string, to: string, subject: string, text: string, replyTo?: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.CQA_EMAIL_FROM || process.env.CQA_AUTOMATION_FROM_EMAIL;
  if (!apiKey || !from) throw new Error("Transactional email provider is not configured.");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": key },
    body: JSON.stringify({ from, to: [to], subject, text, ...(replyTo ? { reply_to: replyTo } : {}) })
  });
  if (!response.ok) throw new Error(`Transactional email delivery failed (${response.status}).`);
}

export async function notifyCqaOrder(input: { businessId: string; orderId: string; checkoutId: string; customerEmail: string; offerId?: string | null; amountCents: number; currency: string; digital?: boolean; buyerEmail?: string | null }) {
  if (input.digital && !input.buyerEmail) throw new Error("Verified digital buyer email is required for receipt delivery.");
  const admin = getCqaSupabaseAdmin();
  const { data: business, error } = await admin.from("cqa_businesses").select("name,email").eq("id", input.businessId).single();
  if (error) throw error;
  let offerName = "Your order";
  if (input.offerId) {
    const { data: offer, error: offerError } = await admin.from("cqa_offers").select("name").eq("business_id", input.businessId).eq("id", input.offerId).maybeSingle();
    if (offerError) throw offerError;
    offerName = offer?.name || offerName;
  }
  const total = new Intl.NumberFormat("en-AU", { style: "currency", currency: input.currency.toUpperCase() }).format(input.amountCents / 100);
  const details = `${offerName}\nTotal paid: ${total}\nOrder reference: ${input.orderId}`;
  const recipient = input.digital ? input.buyerEmail : input.customerEmail;
  const delivery = input.digital
    ? `Open your private purchases: ${getCqaSiteUrl()}/marketplace/library\nSign in with the verified account used for this purchase. Download access is checked each time you request a link. ${business.email ? `For help, contact ${business.email}.` : "Contact the business if you need help accessing your purchase."}`
    : business.email ? `For fulfilment or booking enquiries, contact ${business.email}.` : "The business will arrange fulfilment or booking with you.";
  if (recipient) await sendCqaTransactionalEmail(`order/${input.checkoutId}/customer`, recipient, `Payment confirmed — ${business.name}`, `Thanks for your purchase from ${business.name}.\n\n${details}\n\n${delivery}`, business.email || undefined);
  if (business.email) await sendCqaTransactionalEmail(`order/${input.checkoutId}/owner`, business.email, `New paid order — ${business.name}`, `${details}\nCustomer: ${input.customerEmail || "No email supplied"}\n\n${input.digital ? "Private download instructions have been sent to the verified buyer account. Manage support from your owner dashboard." : "Arrange fulfilment or booking from your owner dashboard."}`);
}
