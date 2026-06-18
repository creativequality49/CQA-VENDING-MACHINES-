export type BrandAssetKey =
  | "homeVendingMachine"
  | "cqaLogo"
  | "fitnessCollection"
  | "activewearCollection"
  | "aiAssistant"
  | "revenueDashboard"
  | "spiritualMachine"
  | "pricingMachine";

export const brandAssets: Record<BrandAssetKey, string | null> = {
  homeVendingMachine: null,
  cqaLogo: null,
  fitnessCollection: null,
  activewearCollection: null,
  aiAssistant: null,
  revenueDashboard: null,
  spiritualMachine: null,
  pricingMachine: null,
};
