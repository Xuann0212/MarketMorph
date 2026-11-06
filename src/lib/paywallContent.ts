import type { InputPayload, OutputLanguage, SubscriptionPlan } from "./designSchema.ts";
import { formatAmountMinor } from "./inputValidation.ts";

export const paywallLabels = {
  en: { month: "Billed monthly", year: "Billed annually", trial: "-day free trial", restore: "Restore purchases", close: "Close", preview: "Design preview · No payment is taken" },
  "zh-Hant": { month: "每月計費", year: "每年計費", trial: " 天免費試用", restore: "恢復購買", close: "關閉", preview: "僅供設計預覽，不會收費" },
  "zh-Hans": { month: "按月计费", year: "按年计费", trial: " 天免费试用", restore: "恢复购买", close: "关闭", preview: "仅供设计预览，不会收费" },
} satisfies Record<OutputLanguage, Record<string, string>>;

export function planPrice(plan: SubscriptionPlan) {
  return plan.price.currency + " " + formatAmountMinor(plan.price.amountMinor);
}

export function trialDetails(input: InputPayload) {
  const individual = input.subscriptionPlans.flatMap((plan) => plan.trial ? [{
    planIds: [plan.id], planNames: [plan.name], ...plan.trial,
  }] : []);
  const shared = input.trialTerms;
  return shared.days > 0 ? [...individual, {
    planIds: shared.eligiblePlanIds,
    planNames: input.subscriptionPlans.filter((plan) => shared.eligiblePlanIds.includes(plan.id)).map((plan) => plan.name),
    days: shared.days, eligibility: shared.eligibility, renewalDisclosure: shared.renewalDisclosure,
  }] : individual;
}
