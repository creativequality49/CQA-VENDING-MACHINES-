import { getCqaOfferCheckoutHold, isSafeProductImage } from "@/lib/cqa-offer-readiness";
import { MAX_MARKETPLACE_ASSET_BYTES, MARKETPLACE_ASSET_EXTENSIONS } from "@/lib/cqa-marketplace-assets";

export type MachineReadinessCheck = { code: string; message: string; offerId?: string; offerName?: string };
export type MachineReadinessOffer = { id: string; name?: string; machine_id?: string; active?: boolean; price_cents?: number | null; offer_type?: string; fulfillment_type?: string; fulfillment_config?: unknown; shipping_required?: boolean; fulfilment_type?: string; external_url?: string; supplier_provider?: string; supplier_variant_sku?: string; inventory_tracking?: boolean; inventory_quantity?: number | null };
type ReadinessInput = { businessId: string; machineId: string; title?: string; offers: MachineReadinessOffer[]; siteUrl?: string; environment: Record<string, string | undefined>; verifyAsset: (key: string, size: number, type: string) => Promise<boolean> };

/** Checks configuration and actual object metadata, never claims a successful payment or email. */
export async function evaluateCqaMachineReadiness(input: ReadinessInput) {
  const checks: MachineReadinessCheck[] = [];
  const add = (code: string, message: string, offer?: MachineReadinessOffer) => checks.push({ code, message, ...(offer ? { offerId: offer.id, offerName: offer.name || "Untitled offer" } : {}) });
  if (!input.title?.trim()) add("MACHINE_TITLE_REQUIRED", "Add a storefront title.");
  const offers = input.offers.filter(offer => offer.active !== false && offer.machine_id === input.machineId);
  if (!offers.length) add("ACTIVE_OFFER_REQUIRED", "Activate at least one offer in this storefront.");
  try {
    const url = new URL(input.siteUrl || "");
    if (url.protocol !== "https:" || url.username || url.password || ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) throw Error();
  } catch { add("SECURE_SITE_URL_REQUIRED", "Configure the public HTTPS site URL for customer receipt and login links."); }
  for (const offer of offers) {
    if (offer.fulfilment_type === "affiliate_link" && (!offer.external_url || !isSafeProductImage(offer.external_url)))
      add("AFFILIATE_URL_REQUIRED", "Set a valid HTTPS referral URL.", offer);
    if (offer.fulfilment_type === "supplier_shipped" && (!["mock", "cjdropshipping"].includes(offer.supplier_provider || "") || !offer.supplier_variant_sku))
      add("SUPPLIER_VARIANT_REQUIRED", "Choose a supplier and enter its variant SKU.", offer);
    if (typeof offer.price_cents === "number" && offer.price_cents > 0 && !Number.isSafeInteger(offer.price_cents))
      add("VALID_PRICE_REQUIRED", "Set a valid price in whole cents before publishing.", offer);
  }
  const paid = offers.filter(offer => offer.fulfilment_type !== "affiliate_link" && Number.isSafeInteger(offer.price_cents) && Number(offer.price_cents) > 0);
  if (paid.length && (!input.environment.RESEND_API_KEY?.trim() || !(input.environment.CQA_EMAIL_FROM || input.environment.CQA_AUTOMATION_FROM_EMAIL)?.trim()))
    add("RECEIPT_EMAIL_CONFIGURATION_REQUIRED", "Configure transactional email and a verified sender, then test a customer receipt. Configuration alone does not verify delivery.");
  for (const offer of paid) {
    const hold = getCqaOfferCheckoutHold(offer);
    if (hold) add(hold.code, hold.message, offer);
    const physical = offer.offer_type === "physical_product" || offer.fulfillment_type === "shipping" || offer.shipping_required;
    if (physical && offer.fulfilment_type !== "supplier_shipped" && (offer.inventory_tracking !== true || !Number.isSafeInteger(offer.inventory_quantity) || Number(offer.inventory_quantity) <= 0))
      add("PHYSICAL_STOCK_REQUIRED", "Enable inventory tracking and add available stock before publishing this physical product.", offer);
    if (offer.offer_type !== "digital_product" && offer.fulfillment_type !== "digital") continue;
    const config = offer.fulfillment_config && typeof offer.fulfillment_config === "object" && !Array.isArray(offer.fulfillment_config) ? offer.fulfillment_config as Record<string, unknown> : {};
    const key = config.asset_key, size = config.asset_size_bytes, type = config.asset_content_type;
    const prefix = `marketplace/${input.businessId}/${offer.id}/`;
    if (typeof key !== "string" || !key.startsWith(prefix) || key.length <= prefix.length || key.includes("..") || /[\\?#]/.test(key) || !Number.isSafeInteger(size) || Number(size) < 1 || Number(size) > MAX_MARKETPLACE_ASSET_BYTES || typeof type !== "string" || !Object.hasOwn(MARKETPLACE_ASSET_EXTENSIONS, type)) {
      add("PRIVATE_PRODUCT_FILE_REQUIRED", "Upload a valid private product file attached to this offer.", offer); continue;
    }
    if (!["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"].every(key => input.environment[key]?.trim()) || input.environment.R2_PUBLIC_URL?.trim() || input.environment.R2_PUBLIC_BASE_URL?.trim()) {
      add("PRIVATE_STORAGE_CONFIGURATION_REQUIRED", "Configure private download storage without a public bucket URL, then verify its access policy.", offer); continue;
    }
    try {
      if (!await input.verifyAsset(key, Number(size), type)) add("PRIVATE_PRODUCT_FILE_MISMATCH", "The private file is missing or differs from its saved size/type. Upload it again.", offer);
    } catch { add("PRIVATE_STORAGE_UNVERIFIED", "The private product file could not be checked. Confirm storage credentials and object availability.", offer); }
  }
  return { merchantReady: checks.length === 0, checks, activeOfferCount: offers.length, paidOfferCount: paid.length, providerChecks: "Configuration and object metadata checks only; payment, email delivery and bucket access policy require acceptance testing." };
}
