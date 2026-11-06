import { z } from "zod";
import { validateInput } from "./inputValidation.ts";
import { validateDesignSpec } from "./demoEngine.ts";
import { BILLING_PERIODS, DESIGN_GOALS, LANGUAGES, MARKETS, MAX_PLANS } from "./designSchema.ts";
import type { DesignSpec, InputPayload } from "./designSchema.ts";
export const MAX_REQUEST_BYTES = 4 * 1024 * 1024;
export const MAX_MODEL_IMAGE_BYTES = 2800000;
const text = (max = 5000) =>
  z
    .string()
    .min(1)
    .max(max)
    .refine((value) => value.trim().length > 0);
const hex = z.string().regex(/^#[0-9a-f]{6}$/i);
const modelText = (max: number) =>
  text(max).refine((value) => !/<\/?[a-z][^>]*>|```/i.test(value));
export const InputSchema = z
  .object({
    schemaVersion: z.literal("1.0"),
    dataMode: z.enum(["simulation", "confirmed"]),
    originalPaywall: z
      .object({
        kind: z.enum(["demo", "image"]),
        id: text(200),
        name: z.string().max(300).optional(),
        mime: z.string().max(100).optional(),
        width: z.number().int().positive().optional(),
        height: z.number().int().positive().optional(),
        sourceMarket: text(80).optional(),
        sourceLanguage: text(80).optional(),
      })
      .strict()
      .optional(),
    productName: text(200),
    productCategory: z.string().max(200),
    productDescription: z.string().max(5000),
    targetAudience: z.string().max(5000),
    targetMarket: z.enum(MARKETS),
    outputLanguage: z.enum(LANGUAGES),
    designGoal: z.enum(DESIGN_GOALS),
    brandStyle: z.string().max(5000),
    brandColors: z
      .object({
        allowed: z.array(hex).max(24),
        forbidden: z.array(hex).max(24),
        backgroundPreference: z.string().max(5000),
      })
      .strict(),
    subscriptionPlans: z
      .array(
        z
          .object({
            id: text(100),
            name: text(200),
            market: z.enum(MARKETS),
            productId: text(200).optional(),
            benefitIds: z.array(text(100)).max(20).optional(),
            terms: text().optional(),
            trial: z.object({ days: z.number().int().min(1).max(365), eligibility: text(), renewalDisclosure: text() }).strict().optional(),
            price: z
              .object({
                currency: z.enum(["USD", "HKD"]),
                amountMinor: z
                  .number()
                  .int()
                  .nonnegative()
                  .max(Number.MAX_SAFE_INTEGER),
                billingPeriod: z.enum(BILLING_PERIODS),
              })
              .strict(),
          })
          .strict(),
      )
      .min(1)
      .max(MAX_PLANS),
    trialTerms: z
      .object({
        days: z.number().int().nonnegative().max(365),
        eligibility: z.string().max(5000),
        renewalDisclosure: z.string().max(5000),
        eligiblePlanIds: z.array(text(100)).max(MAX_PLANS),
      })
      .strict(),
    benefits: z
      .array(z.object({ id: text(100), description: text(1500) }).strict())
      .min(1)
      .max(20),
    additionalInstructions: z.string().max(10000),
  })
  .strict()
  .superRefine((v, ctx) => {
    for (const [field, reason] of Object.entries(validateInput(v)))
      ctx.addIssue({ code: "custom", path: field.split("."), message: reason });
  });
export const DesignSpecSchema = z
  .object({
    schemaVersion: z.literal("1.0"),
    layout: z.enum(["benefits-first", "plans-first"]),
    sectionOrder: z
      .array(
        z.enum([
          "headline",
          "benefits",
          "plans",
          "trial",
          "cta",
          "disclosures",
        ]),
      )
      .length(6),
    theme: z
      .object({ background: hex, surface: hex, text: hex, accent: hex })
      .strict(),
    featuredPlanId: text(100),
    planOrder: z.array(text(100)).min(1).max(MAX_PLANS),
    headline: modelText(500),
    subtitle: modelText(700).optional(),
    benefitsCopy: z
      .array(z.object({ benefitId: text(100), text: modelText(1500) }).strict())
      .min(1)
      .max(20),
    ctaText: modelText(200),
    designReasons: z
      .array(z.object({ field: text(100), reason: modelText(2000) }).strict())
      .min(1)
      .max(12),
  })
  .strict();
export const ModelOutputSchema = z
  .object({
    design: DesignSpecSchema,
    visualAnalysis: z
      .object({
        status: z.enum(["understood", "limited"]),
        summary: modelText(2000),
      })
      .strict(),
  })
  .strict();
export const GenerateRequestSchema = z
  .object({
    input: InputSchema,
    confirmation: z
      .object({ confirmed: z.literal(true), fingerprint: text(MAX_REQUEST_BYTES) })
      .strict(),
    source: z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("demo"), id: text(200) }).strict(),
      z
        .object({
          kind: z.literal("image"),
          id: text(200),
          dataUrl: z
            .string()
            .max(Math.ceil((MAX_MODEL_IMAGE_BYTES * 4) / 3) + 100),
        })
        .strict(),
    ]),
  })
  .strict();
export type GenerateRequest = z.infer<typeof GenerateRequestSchema>;
export function validateOutput(
  value: unknown,
  input: InputPayload,
): {
  design: DesignSpec;
  visualAnalysis: { status: "understood" | "limited"; summary: string };
} {
  const result = ModelOutputSchema.parse(value);
  const design = validateDesignSpec(result.design, input);
  // Pricing/qualification tokens belong in immutable fact sections, not generated prose.
  const freeCopy = [
    design.headline,
    design.subtitle ?? "",
    design.ctaText,
    ...design.benefitsCopy
      .filter(
        (b) =>
          input.benefits.find((approved) => approved.id === b.benefitId)
            ?.description !== b.text,
      )
      .map((b) => b.text),
  ];
  const protectedClaim =
    /(?:\b(?:USD|HKD|EUR|CNY|discount(?:ed)?|lifetime free|free forever|eligibility|eligible for|qualifies?)\b|\p{Sc}|\d\s*(?:%|percent|元)|[\d零一二兩三四五六七八九十百]+\s*(?:days?|天|日|months?|月|years?|年)|折扣|促銷|促销|限[時时][優优]惠|[終终]身免[費费]|合[資资]格)/iu;
  if (
    freeCopy.some(
      (copy) =>
        protectedClaim.test(copy) ||
        (input.trialTerms.days === 0 && !input.subscriptionPlans.some((plan) => plan.trial) &&
          /free trial|免[費费][試试]用/i.test(copy)),
    )
  )
    throw new Error("BUSINESS_COPY");
  return { design, visualAnalysis: result.visualAnalysis };
}
