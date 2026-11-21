import { z } from "zod";
import { physicalShippingConfig, supportedShippingCountries } from "@/lib/cqa-offer-readiness";

export const ownerProductHeaders = { "Cache-Control": "private, no-store" };
const text = z.string().trim().max(5000);

/** Product images are public URLs; reject credentials, local networks and executable URL schemes. */
export function isSafeProductImage(value: string) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return url.protocol === "https:" && !url.username && !url.password && (!url.port || url.port === "443") &&
      host.includes(".") && !host.endsWith(".localhost") && !host.endsWith(".local") &&
      !host.endsWith(".internal") && !/^\d+(?:\.\d+){3}$/.test(host) && !host.includes(":") &&
      !/[\x00-\x20\\]/.test(value);
  } catch { return false; }
}

export const ownerProductSchema = z.object({
  businessId: z.string().uuid(), machineId: z.string().uuid(), id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(200), description: text,
  priceCents: z.number().int().min(50).max(99_999_999),
  currency: z.literal("aud"),
  kind: z.enum(["digital", "physical"]), imageUrl: z.string().max(2048).refine(isSafeProductImage).nullable(),
  active: z.boolean(), inventoryDelta: z.number().int().min(-1_000_000).max(1_000_000).default(0),
  expectedRevision: z.number().int().nonnegative().optional(),
  shipping: z.object({
    supportedRegions: z.array(z.string().regex(/^[A-Z]{2}$/).refine(value => supportedShippingCountries.has(value), "Choose a supported shipping country.")).max(30).refine(values => new Set(values).size === values.length),
    flatFeeCents: z.number().int().min(0).max(1_000_000), dispatchTiming: z.string().trim().max(1000)
  }).strict().optional(),
  deliveryDescription: text, deliveryTiming: text, supportDetails: text, refundTerms: text
}).strict().superRefine((product, context) => {
  const issue = (path: string, message: string) => context.addIssue({ code: "custom", path: [path], message });
  if (!product.id && product.inventoryDelta < 0) issue("inventoryDelta", "Initial stock cannot be negative.");
  if (product.id && product.expectedRevision === undefined) issue("expectedRevision", "Refresh the product before saving changes.");
  if (!product.id && product.expectedRevision !== undefined) issue("expectedRevision", "New products do not have a revision yet.");
  if (product.kind === "digital" && product.inventoryDelta !== 0) issue("inventoryDelta", "Digital products do not use physical stock.");
  if (product.kind === "digital" && product.shipping) issue("shipping", "Digital products do not ship physical goods.");
  if (product.active) {
    if (!product.description) issue("description", "Describe the product before publishing.");
    for (const key of ["deliveryDescription", "deliveryTiming", "supportDetails", "refundTerms"] as const)
      if (!product[key]) issue(key, "Publish delivery, timing, support and refund details first.");
    if (product.kind === "physical" && !physicalShippingConfig({ provider: "merchant", shipping: product.shipping, deliveryDescription: product.deliveryDescription, deliveryTiming: product.deliveryTiming, supportDetails: product.supportDetails, refundTerms: product.refundTerms }))
      issue("shipping", "Choose supported delivery countries and dispatch timing before publishing.");
  }
});
export type OwnerProductInput = z.infer<typeof ownerProductSchema>;

export function isPrivateProductAssetReady(businessId: string, offerId: string, value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const config = value as Record<string, unknown>;
  const key = config.asset_key;
  const prefix = `marketplace/${businessId}/${offerId}/`;
  return typeof key === "string" && key.startsWith(prefix) && key.length > prefix.length &&
    !key.includes("..") && !/[\\?#\x00-\x20]/.test(key) &&
    Number.isSafeInteger(config.asset_size_bytes) && Number(config.asset_size_bytes) > 0 &&
    Number(config.asset_size_bytes) <= 4 * 1024 * 1024 &&
    ["application/pdf", "application/zip", "image/png", "image/jpeg", "text/plain"].includes(String(config.asset_content_type));
}

export function productSaveFailure(status: number, message: string): never {
  throw Object.assign(new Error(message), { status });
}

/** Reject oversized JSON before parsing so request validation cannot allocate without a bound. */
export async function readOwnerProductBody(request: Request) {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") || "") || !request.body)
    productSaveFailure(400, "Send a JSON product form.");
  const reader = request.body!.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > 48 * 1024) { await reader.cancel(); productSaveFailure(413, "The product form is too large."); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
  catch { return productSaveFailure(400, "The product form must contain valid JSON."); }
}
