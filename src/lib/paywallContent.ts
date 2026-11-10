import type { InputPayload, OutputLanguage, SubscriptionPlan } from "./designSchema.ts";
import { LANGUAGE_LABELS } from "./designSchema.ts";
import { formatAmountMinor } from "./inputValidation.ts";
import type { InputErrors } from "./inputValidation.ts";
import { exampleBenefitCopy, examplePaywallCopy } from "./exampleBenefitCopy.ts";

const scriptMarkers = {
  "zh-Hant": /[学习练资费权订阅试续语请开复录记过适仅结简图庆圣样购确优]/u,
  "zh-Hans": /[學習練資費權訂閱試續語請開複錄記過適僅結簡圖慶聖樣購確優]/u,
};

export function matchesOutputLanguage(text: string, input: InputPayload) {
  const copy = text.replaceAll(input.productName, "").replace(/\b(?:App Store|Google Play|Apple Pay|Google Pay)\b/gi, "");
  const hasHan = /\p{Script=Han}/u.test(copy);
  if (input.outputLanguage === "en") return !hasHan;
  if (!hasHan) return !/[A-Za-z]/.test(copy);
  return !scriptMarkers[input.outputLanguage].test(copy) &&
    !/[A-Za-z]{2,}(?:[ \t]+[A-Za-z]{2,}){2,}/.test(copy);
}

export function paywallCopyIssues(input: InputPayload, mode: "demo" | "live"): InputErrors {
  const display = examplePaywallCopy(input);
  const language = LANGUAGE_LABELS[input.outputLanguage];
  const issues: InputErrors = {};
  function check(path: string, text: string | undefined, label: string) {
    if (text && !matchesOutputLanguage(text, input)) issues[path] = "請提供" + language + "的" + label + "。";
  }
  display.subscriptionPlans.forEach((plan, index) => {
    const prefix = "subscriptionPlans." + index;
    check(prefix + ".name", plan.name, "方案名稱");
    check(prefix + ".terms", plan.terms, "方案條款");
    check(prefix + ".trial.eligibility", plan.trial?.eligibility, "試用適用條件");
    check(prefix + ".trial.renewalDisclosure", plan.trial?.renewalDisclosure, "試用後收費說明");
  });
  if (display.trialTerms.days) check("trialTerms.eligibility", display.trialTerms.eligibility, "試用適用條件");
  check("trialTerms.renewalDisclosure", display.trialTerms.renewalDisclosure, "續費說明");
  if (mode === "demo" && input.benefits.some(({ id, description }) =>
    !matchesOutputLanguage(exampleBenefitCopy(input.outputLanguage, id, description), input))) {
    issues.benefits = "請填寫" + language + "的會員權益，或切換至 AI 本地化翻譯權益。";
  }
  return issues;
}

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
