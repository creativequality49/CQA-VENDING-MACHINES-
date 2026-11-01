import { createHash } from "node:crypto";

// UUIDv5 URL namespace. This is a durable identity, not an access credential.
const namespace = Buffer.from("6ba7b8119dad11d180b400c04fd430c8", "hex");

export function purchaseAutomationRunId(businessId: string, automationId: string, checkoutSessionId: string) {
  if (!businessId || !automationId || typeof checkoutSessionId !== "string" ||
      checkoutSessionId.length > 255 || !/^cs_[A-Za-z0-9_]+$/.test(checkoutSessionId)) {
    throw new Error("Purchase automation requires a valid checkout session.");
  }
  const bytes = createHash("sha1").update(namespace)
    .update(JSON.stringify(["cqa-purchase-run-v1", businessId, automationId, checkoutSessionId]))
    .digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
