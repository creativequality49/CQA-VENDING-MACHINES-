import { Machine, Product } from "./types";

export const tierDisplayOrder = ["basic", "pro", "elite", "subscription"] as const;

export const machines: Machine[] = [
  {
    slug: "store",
    title: "CQA Premium Digital Product Vault",
    subtitle: "Original CQA systems, playbooks and creator assets. Products only become purchasable after delivery, payment and mobile fulfilment checks pass.",
    products: [
      {
        id: "money-wealth-system",
        title: "CQA Money & Wealth Operating System",
        description: "A practical personal-money system covering budgeting, debt reduction, savings, income expansion and beginner investing workflows.",
        tier: "pro",
        priceLabel: "$149 AUD",
        assetKey: "",
        stripePriceEnv: "STRIPE_PRICE_MONEY_WEALTH",
        status: "draft",
        version: "1.0.0",
        canvaDesignId: "DAG68VVO8SA",
        licence: "Single-customer personal-use licence. No resale or redistribution.",
        accessPolicy: "Permanent access to the purchased version and included updates stated at checkout.",
        deliverables: [
          "Money Mastery core guide",
          "Budget and cash-flow planner",
          "Debt reduction system",
          "Savings challenge pack",
          "Side-hustle action toolkit",
          "Beginner investing guide",
          "Money prompt library and calculators",
          "30-day implementation challenge"
        ]
      },
      {
        id: "faceless-income-machine",
        title: "CQA Faceless Income Machine",
        description: "A complete content-to-offer operating system for building and monetising a faceless digital brand.",
        tier: "pro",
        priceLabel: "$129 AUD",
        assetKey: "",
        stripePriceEnv: "STRIPE_PRICE_FACELESS_INCOME",
        status: "draft",
        version: "1.0.0",
        canvaDesignId: "DAHAEOPrEHY",
        licence: "Single-business commercial-use licence for the purchaser's own brand. No redistribution of source files.",
        accessPolicy: "Permanent access to the purchased version.",
        deliverables: [
          "Faceless brand positioning workbook",
          "30-day content plan",
          "Hook, caption and call-to-action library",
          "Offer creation system",
          "Traffic and conversion workflow",
          "Automation setup checklist",
          "Launch dashboard and tracking sheets"
        ]
      },
      {
        id: "creator-prompt-vault",
        title: "CQA Creator Prompt Vault",
        description: "A quality-controlled prompt library for brand strategy, content production, offers, sales and automation.",
        tier: "basic",
        priceLabel: "$79 AUD",
        assetKey: "",
        stripePriceEnv: "STRIPE_PRICE_CREATOR_PROMPT_VAULT",
        status: "draft",
        version: "1.0.0",
        canvaDesignId: "DAG8xYJstfs",
        licence: "Single-customer commercial-use licence for generated outputs. Prompt library may not be resold or redistributed.",
        accessPolicy: "Permanent access to the purchased version.",
        deliverables: [
          "200 individually validated prompts",
          "Prompts organised by business outcome",
          "Copy-and-paste usage guide",
          "Brand consistency prompt framework",
          "Content batching workflow",
          "Offer and conversion prompt section"
        ]
      },
      {
        id: "muscle-growth-system",
        title: "CQA 30-Day Muscle Growth System",
        description: "A structured hypertrophy education and planning system with training, recovery and progress-tracking resources.",
        tier: "pro",
        priceLabel: "$97 AUD",
        assetKey: "",
        stripePriceEnv: "STRIPE_PRICE_MUSCLE_GROWTH",
        status: "quality_review",
        version: "1.0.0",
        canvaDesignId: "DAHHeY_KS1U",
        licence: "Single-customer personal-use licence. No coaching, medical or professional-health licence is granted.",
        accessPolicy: "Permanent access to the purchased version.",
        disclaimer: "General educational information only. Customers should seek qualified medical or fitness advice before beginning a new exercise program.",
        deliverables: [
          "30-day hypertrophy training plan",
          "Exercise and progression guidance",
          "Training log and progress tracker",
          "Recovery and consistency checklist",
          "Nutrition education overview",
          "Mobile-friendly final PDF"
        ]
      },
      {
        id: "anxiety-wellness-system",
        title: "CQA Anxiety & Mental Wellness Toolkit",
        description: "A non-clinical self-reflection and wellbeing toolkit supporting calming routines, journaling and everyday coping practices.",
        tier: "basic",
        priceLabel: "$67 AUD",
        assetKey: "",
        stripePriceEnv: "STRIPE_PRICE_ANXIETY_WELLNESS",
        status: "draft",
        version: "1.0.0",
        canvaDesignId: "DAG7BsfmhoM",
        licence: "Single-customer personal-use licence. No resale, redistribution, diagnosis or treatment rights.",
        accessPolicy: "Permanent access to the purchased version.",
        disclaimer: "This product is not therapy, diagnosis, crisis support or medical treatment. Customers requiring urgent support should contact appropriate local professional or emergency services.",
        deliverables: [
          "Guided reflection workbook",
          "Calming routine cards",
          "Grounding and breathing practice guide",
          "Trigger and pattern journal",
          "Weekly wellbeing planner",
          "Support and professional-help guidance"
        ]
      }
    ]
  }
];

export function getMachine(slug: string) {
  return machines.find((machine) => machine.slug === slug);
}

export function getProductById(productId: string) {
  return machines.flatMap((machine) => machine.products).find((product) => product.id === productId);
}

export function getProductReadiness(product: Product) {
  const checks = {
    approved: product.status === "live",
    assetAttached: Boolean(product.assetKey.trim()),
    stripePriceConfigured: Boolean(process.env[product.stripePriceEnv]?.trim()),
    deliverablesDefined: product.deliverables.length > 0,
    noPlaceholderAsset: !/placeholder|example|template-only/i.test(product.assetKey)
  };

  return {
    checks,
    sellable: Object.values(checks).every(Boolean)
  };
}
