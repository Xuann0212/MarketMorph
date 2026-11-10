import { z } from "zod";
import { BILLING_PERIODS, DESIGN_GOALS, LANGUAGES, MARKETS } from "./designSchema.ts";
import { DesignSpecSchema, InputSchema } from "./generationSchema.ts";
import { auditDesign, validateDesignSpec } from "./demoEngine.ts";
import { exampleBenefitCopy } from "./exampleBenefitCopy.ts";

export const STUDIO_DRAFT_KEY = "marketmorph:studio:v1";
const plan = z.object({
  id: z.string(), name: z.string(), market: z.enum(MARKETS), productId: z.string().optional(),
  benefitIds: z.array(z.string()).optional(), terms: z.string().optional(),
  trial: z.object({
    days: z.number().nullable().transform((value) => value ?? NaN),
    eligibility: z.string(), renewalDisclosure: z.string(),
  }).optional(),
  price: z.object({
    currency: z.enum(["USD", "HKD"]), billingPeriod: z.enum(BILLING_PERIODS),
    amountMinor: z.number().nullable().transform((value) => value ?? NaN),
  }),
});
const offer = z.object({
  subscriptionPlans: z.array(plan), amounts: z.array(z.string()), days: z.string(),
  trialTerms: z.object({
    days: z.number(), eligibility: z.string(), renewalDisclosure: z.string(), eligiblePlanIds: z.array(z.string()),
  }),
});
const storedResult = z.object({
  mode: z.enum(["live", "demo"]),
  sourceId: z.string(),
  inputSnapshot: InputSchema,
  spec: DesignSpecSchema,
  audit: z.object({ checks: z.array(z.object({
    id: z.string(), label: z.string(), status: z.enum(["pass", "fail", "needs-review"]),
    field: z.string(), reason: z.string(), expected: z.string().optional(), actual: z.string().optional(),
  })) }),
}).transform((result, ctx) => {
  try {
    validateDesignSpec(result.spec, result.inputSnapshot);
    if (result.mode === "demo") {
      const input = result.inputSnapshot;
      const benefitsCopy = result.spec.benefitsCopy.map((item) => {
        const original = input.benefits.find(({ id }) => id === item.benefitId);
        const text = original?.description === item.text
          ? exampleBenefitCopy(input.outputLanguage, item.benefitId, item.text)
          : item.text;
        return text === item.text ? item : { ...item, text };
      });
      if (benefitsCopy.some((item, index) => item !== result.spec.benefitsCopy[index])) {
        const spec = { ...result.spec, benefitsCopy };
        const audit = auditDesign(input, spec);
        audit.checks.push(...result.audit.checks.filter(({ id }) => id === "edited-copy"));
        return { ...result, spec, audit };
      }
    }
    return result;
  } catch {
    ctx.addIssue({ code: "custom", message: "Invalid saved design" });
    return z.NEVER;
  }
});
const draft = z.object({
  savedAt: z.iso.datetime(),
  hadBackground: z.boolean().optional(),
  product: z.object({
    dataMode: z.enum(["confirmed", "simulation"]),
    facts: z.object({
      productName: z.string(), productCategory: z.string(), productDescription: z.string(),
      targetAudience: z.string(), benefits: z.array(z.object({ id: z.string(), description: z.string() })),
    }),
    offersByMarket: z.object({ US: offer.optional(), HK: offer.optional() }),
    importedMetadata: z.object({
      market: z.enum(MARKETS).optional(), language: z.enum(LANGUAGES).optional(), fileName: z.string().optional(),
    }).optional(),
  }),
  target: z.object({ market: z.enum(["", ...MARKETS]), language: z.enum(["", ...LANGUAGES]), languageChosen: z.boolean() }),
  design: z.object({
    designGoal: z.enum(DESIGN_GOALS), brandStyle: z.string(),
    brandColors: z.object({ allowed: z.array(z.string()), forbidden: z.array(z.string()), backgroundPreference: z.string() }),
  }),
  mode: z.enum(["live", "demo"]).optional(),
  confirmed: z.string(),
  instructions: z.string(),
  source: z.object({
    kind: z.literal("demo"), id: z.string(), sourceMarket: z.string().optional(), sourceLanguage: z.string().optional(),
  }).nullable(),
  result: storedResult.nullable().catch(null),
});

export function restoreStudioDraft(raw: string) {
  const parsed = draft.safeParse(JSON.parse(raw));
  return parsed.success ? parsed.data : null;
}
