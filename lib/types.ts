export type TierKey = "basic" | "pro" | "elite" | "subscription";
export type ProductStatus = "draft" | "quality_review" | "live";

export type Product = {
  id: string;
  title: string;
  description: string;
  tier: TierKey;
  priceLabel: string;
  assetKey: string;
  stripePriceEnv: string;
  status: ProductStatus;
  version: string;
  deliverables: string[];
  licence: string;
  accessPolicy: string;
  canvaDesignId?: string;
  disclaimer?: string;
  subscriberOnly?: boolean;
};

export type Machine = {
  slug: string;
  title: string;
  subtitle: string;
  products: Product[];
};

export type Entitlement = {
  userId: string;
  productId: string;
  active: boolean;
  source: "one_time" | "subscription";
  expiresAt?: string;
};
