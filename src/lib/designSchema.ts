/** Shared M1–M8 contract. Monetary values are integer minor units (100 = $1). */
export const MARKETS = ["US", "HK"] as const;
export const LANGUAGES = ["en", "zh-Hant", "zh-Hans"] as const;
export const DESIGN_GOALS = ["preserve", "annual", "trial", "benefits"] as const;
export type TargetMarket = (typeof MARKETS)[number];
export type OutputLanguage = (typeof LANGUAGES)[number];
export type DesignGoal = (typeof DESIGN_GOALS)[number];
export const MARKET_CONFIG = {
  US: { label: "美國", currency: "USD", language: "en" },
  HK: { label: "香港", currency: "HKD", language: "zh-Hant" },
} as const satisfies Record<TargetMarket, { label: string; currency: string; language: OutputLanguage }>;
export const MARKET_CURRENCY = { US: MARKET_CONFIG.US.currency, HK: MARKET_CONFIG.HK.currency } as const;
export const LANGUAGE_LABELS = { en: "英語", "zh-Hant": "繁體中文（香港）", "zh-Hans": "簡體中文" } as const;
export const BILLING_PERIODS = ["month", "year"] as const;
export const MAX_PLANS = 12;
export interface PlanTrial {
  days: number;
  eligibility: string;
  renewalDisclosure: string;
}
export interface SubscriptionPlan {
  id: string;
  name: string;
  market: TargetMarket;
  productId?: string;
  benefitIds?: string[];
  terms?: string;
  trial?: PlanTrial;
  price: {
    currency: "USD" | "HKD";
    amountMinor: number;
    billingPeriod: (typeof BILLING_PERIODS)[number];
  };
}
export interface TrialTerms {
  days: number;
  eligibility: string;
  renewalDisclosure: string;
  eligiblePlanIds: string[];
}
export interface InputPayload {
  /** Optional source metadata; local blob URLs and image bytes never enter this payload. */
  originalPaywall?: {
    kind: "demo" | "image";
    id: string;
    name?: string;
    mime?: string;
    width?: number;
    height?: number;
    sourceMarket?: string;
    sourceLanguage?: string;
  };
  schemaVersion: "1.0";
  dataMode: "simulation" | "confirmed";
  productName: string;
  productCategory: string;
  productDescription: string;
  targetAudience: string;
  targetMarket: TargetMarket;
  outputLanguage: OutputLanguage;
  designGoal: DesignGoal;
  brandStyle: string;
  brandColors: {
    allowed: string[];
    forbidden: string[];
    backgroundPreference: string;
  };
  subscriptionPlans: SubscriptionPlan[];
  trialTerms: TrialTerms;
  benefits: { id: string; description: string }[];
  additionalInstructions: string;
}
/** Public example file: full default payload plus independently approved market profiles. */
export interface ExampleInput {
  schemaVersion: "1.0";
  simulationNotice: string;
  input: InputPayload;
  markets: Record<
    TargetMarket,
    {
      outputLanguage: OutputLanguage;
      subscriptionPlans: SubscriptionPlan[];
      trialTerms: TrialTerms;
    }
  >;
}
export type PageSection =
  "headline" | "benefits" | "plans" | "trial" | "cta" | "disclosures";
/** AI may reference approved facts only. This type has no price/trial mutation fields.
 * Future API must runtime-validate IDs, colors and copy against the original payload.
 */
export interface DesignSpec {
  schemaVersion: "1.0";
  layout: "benefits-first" | "plans-first";
  sectionOrder: PageSection[];
  theme: { background: string; surface: string; text: string; accent: string };
  featuredPlanId: string;
  planOrder: string[];
  headline: string;
  subtitle?: string;
  benefitsCopy: { benefitId: string; text: string }[];
  ctaText: string;
  designReasons: { field: string; reason: string }[];
}
export interface AuditReport {
  checks: {
    id: string;
    label: string;
    status: "pass" | "fail" | "needs-review";
    field: string;
    reason: string;
    expected?: string;
    actual?: string;
  }[];
}
