import { z } from "zod";
import { strToU8, zipSync } from "fflate";
import { BILLING_PERIODS, LANGUAGES, MARKETS, MAX_PLANS } from "./designSchema.ts";
import { DesignSpecSchema } from "./generationSchema.ts";
import { auditDesign } from "./demoEngine.ts";
import { paywallLabels, planPrice, trialDetails } from "./paywallContent.ts";
import type { StudioResult } from "./studioTypes.ts";
import { integrationGuide, nativeTemplate } from "./exportTemplate.ts";

const MoneySchema = z.object({
  currency: z.enum(["USD", "HKD"]), amountMinor: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  billingPeriod: z.enum(BILLING_PERIODS),
}).strict();
export const DeliverySpecSchema = z.object({
  schemaVersion: z.literal("1.0"),
  product: z.object({ name: z.string().min(1) }).strict(),
  source: z.object({
    type: z.enum(["sample", "upload"]), name: z.string().optional(),
    market: z.string().optional(), language: z.string().optional(),
    width: z.number().int().positive().optional(), height: z.number().int().positive().optional(),
  }).strict(),
  targetMarket: z.enum(MARKETS),
  outputLanguage: z.enum(LANGUAGES),
  design: DesignSpecSchema,
  plans: z.array(z.object({
    id: z.string(), name: z.string(), productId: z.string().optional(), price: MoneySchema,
    previewPrice: z.string(), periodLabel: z.string(), benefitIds: z.array(z.string()).optional(),
  }).strict()).min(1).max(MAX_PLANS),
  terms: z.object({ trial: z.array(z.string()), disclosures: z.array(z.string()) }).strict(),
  interactions: z.object({
    purchase: z.literal("select-plan-and-call-host"), restore: z.string(), close: z.string(),
    storePriceRequired: z.literal(true), mappingComplete: z.boolean(),
  }).strict(),
  provenance: z.object({
    mode: z.enum(["live", "demo"]), reviewRequired: z.boolean(), simulatedFacts: z.boolean(),
  }).strict(),
}).strict();
export type DeliverySpec = z.infer<typeof DeliverySpecSchema>;

export function deliveryBlock(result: StudioResult, stale: boolean): string | null {
  if (stale) return "設計要求已更新，請重新生成後再匯出。";
  if (!result.inputSnapshot.originalPaywall) return "缺少原始訂閱頁面資料。";
  if ([...result.audit.checks, ...auditDesign(result.inputSnapshot, result.spec).checks].some((check) => check.status === "fail"))
    return "有未通過的檢查，請修正後再匯出。";
  return null;
}

export function createDeliverySpec(result: StudioResult): DeliverySpec {
  const blocked = deliveryBlock(result, false);
  if (blocked) throw new Error(blocked);
  const input = result.inputSnapshot;
  const source = input.originalPaywall!;
  const labels = paywallLabels[input.outputLanguage];
  const trials = trialDetails(input);
  const plans = result.spec.planOrder.map((id) => {
    const plan = input.subscriptionPlans.find((item) => item.id === id)!;
    return {
      id, name: plan.name, productId: plan.productId, benefitIds: plan.benefitIds,
      price: plan.price, previewPrice: planPrice(plan), periodLabel: labels[plan.price.billingPeriod],
    };
  });
  return DeliverySpecSchema.parse({
    schemaVersion: "1.0",
    product: { name: input.productName },
    source: {
      type: source.kind === "demo" ? "sample" : "upload", name: source.name,
      market: source.sourceMarket, language: source.sourceLanguage, width: source.width, height: source.height,
    },
    targetMarket: input.targetMarket,
    outputLanguage: input.outputLanguage,
    design: result.spec,
    plans,
    terms: {
      trial: trials.map((trial) => trial.days + labels.trial + " · " + trial.planNames.join(" / ") + "\n" + trial.eligibility),
      disclosures: [
        ...trials.map((trial) => trial.planNames.join(" / ") + " · " + trial.renewalDisclosure),
        ...(!input.trialTerms.days && input.trialTerms.renewalDisclosure ? [input.trialTerms.renewalDisclosure] : []),
        ...input.subscriptionPlans.flatMap((plan) => plan.terms ? [plan.name + " · " + plan.terms] : []),
      ],
    },
    interactions: {
      purchase: "select-plan-and-call-host", close: labels.close, restore: labels.restore,
      storePriceRequired: true, mappingComplete: plans.every((plan) => Boolean(plan.productId)),
    },
    provenance: {
      mode: result.mode, reviewRequired: result.audit.checks.some((check) => check.status === "needs-review"),
      simulatedFacts: input.dataMode === "simulation",
    },
  });
}

const encode = (value: unknown) => JSON.stringify(value, null, 2) + "\n";

export function deliveryFiles(result: StudioResult) {
  return {
    "design-spec.json": encode(createDeliverySpec(result)),
    "audit-report.json": encode({
      schemaVersion: "1.0",
      mode: result.mode,
      status: result.audit.checks.some((check) => check.status === "needs-review") ? "requires-human-review" : "automated-checks-passed",
      checks: result.audit.checks,
      measured: {
        generationDurationMs: result.meta?.durationMs ?? result.generationDurationMs ?? null,
        tokenUsage: result.meta?.calls.map(({ inputTokens, outputTokens }) => ({ inputTokens, outputTokens })) ?? null,
        cost: null,
        manualCorrections: null,
        integrationDurationMs: null,
      },
    }),
    "react-native/LocalizedPaywall.tsx": nativeTemplate,
    "INTEGRATION.md": integrationGuide,
  };
}

export function deliveryZip(files: ReturnType<typeof deliveryFiles>, png: Uint8Array) {
  return zipSync({
    ...Object.fromEntries(Object.entries(files).map(([name, content]) => [name, strToU8(content)])),
    "preview.png": png,
  }, { level: 6 });
}
