import "server-only";
import { getCqaSupabaseAdmin } from "@/lib/cqa-supabase-admin";

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

export async function notifyCqaOrder(input: { businessId: string; orderId: string; checkoutId: string; customerEmail: string; offerId?: string | null; amountCents: number; currency: string }) {
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
  if (input.customerEmail) await sendCqaTransactionalEmail(`order/${input.checkoutId}/customer`, input.customerEmail, `Payment confirmed — ${business.name}`, `Thanks for your purchase from ${business.name}.\n\n${details}\n\n${business.email ? `For fulfilment or booking enquiries, contact ${business.email}.` : "The business will arrange fulfilment or booking with you."}`, business.email || undefined);
  if (business.email) await sendCqaTransactionalEmail(`order/${input.checkoutId}/owner`, business.email, `New paid order — ${business.name}`, `${details}\nCustomer: ${input.customerEmail || "No email supplied"}\n\nArrange fulfilment or booking from your owner dashboard.`);
}
