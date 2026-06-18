export type VendingSlot = {
  id: string;
  title: string;
  description?: string | null;
  priceLabel: string;
  kind: "product" | "subscription" | "service" | "membership";
  tierLabel?: string | null;
  stripeReady?: boolean;
  productId?: string;
};

export type MachinePreview = {
  slug: string;
  title: string;
  logoText: string;
  category: string;
  description?: string | null;
  accent: string;
  slots: VendingSlot[];
};
