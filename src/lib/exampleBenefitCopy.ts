import example from "../../public/example_input.json";
import type { InputPayload, OutputLanguage } from "./designSchema.ts";

const traditionalChinese: Record<string, string> = {
  practice: "用自己的溫習筆記製作練習題。",
  review: "透過 AI 輔助解說重溫概念。",
  routine: "記錄每日學習時段及連續學習日數。",
};
const originalCopy = new Map(example.input.benefits.map(({ id, description }) => [id, description]));
const simplifiedChinese: Record<string, string> = {
  practice: "用自己的复习笔记制作练习题。",
  review: "通过人工智能辅助讲解复习概念。",
  routine: "记录每日学习时段及连续学习天数。",
};

export function exampleBenefitCopy(language: OutputLanguage, id: string, text: string) {
  if (originalCopy.get(id) !== text) return text;
  if (language === "zh-Hant") return traditionalChinese[id] ?? text;
  if (language === "zh-Hans") return simplifiedChinese[id] ?? text;
  return text;
}

const trialCopy: Record<InputPayload["targetMarket"], Partial<Record<OutputLanguage, Pick<InputPayload["trialTerms"], "eligibility" | "renewalDisclosure">>>> = {
  US: {
    "zh-Hant": {
      eligibility: "僅限 LearnLoop 新訂戶，每人一次。只適用於年付方案。",
      renewalDisclosure: "3 天免費試用結束後，年付方案將自動以每年 USD 79.99 續訂，除非在試用結束前取消。月付方案為每月 USD 9.99，不設免費試用。",
    },
    "zh-Hans": {
      eligibility: "仅限 LearnLoop 新订户，每人一次。仅适用于年付方案。",
      renewalDisclosure: "3 天免费试用结束后，年付方案将自动按每年 USD 79.99 续订，除非在试用结束前取消。月付方案为每月 USD 9.99，不提供免费试用。",
    },
  },
  HK: {
    en: {
      eligibility: "Available only to people who have never subscribed to LearnLoop, once per person. The trial applies only to the annual plan.",
      renewalDisclosure: "After the 3-day free trial, the annual plan renews automatically at HKD 588.00 per year unless cancelled before the trial ends. The monthly plan is HKD 78.00 per month with no free trial.",
    },
    "zh-Hans": {
      eligibility: "仅限从未订阅 LearnLoop 的新用户，每人一次；仅适用于年付方案。",
      renewalDisclosure: "3 天免费试用结束后，年付方案将自动按每年 HKD 588.00 续订，除非在试用结束前取消。月付方案为每月 HKD 78.00，不提供免费试用。",
    },
  },
};

const planNames = {
  en: { month: "Monthly", year: "Annual" },
  "zh-Hant": { month: "月付方案", year: "年付方案" },
  "zh-Hans": { month: "月付方案", year: "年付方案" },
};

export function examplePaywallCopy(input: InputPayload): InputPayload {
  const profile = example.markets[input.targetMarket];
  const approvedTrial = input.trialTerms;
  const originalTrial = profile.trialTerms;
  const localized = trialCopy[input.targetMarket][input.outputLanguage];
  const pricesMatch = input.subscriptionPlans.length === profile.subscriptionPlans.length &&
    profile.subscriptionPlans.every(({ id, price }) => input.subscriptionPlans.some((plan) =>
      plan.id === id && plan.price.amountMinor === price.amountMinor && plan.price.currency === price.currency &&
      plan.price.billingPeriod === price.billingPeriod));
  const sameTrial = pricesMatch && approvedTrial.days === originalTrial.days &&
    approvedTrial.eligiblePlanIds.length === originalTrial.eligiblePlanIds.length &&
    originalTrial.eligiblePlanIds.every((id) => approvedTrial.eligiblePlanIds.includes(id));
  return {
    ...input,
    subscriptionPlans: input.subscriptionPlans.map((plan) => {
      const known = profile.subscriptionPlans.some(({ id, name, price }) =>
        id === plan.id && name === plan.name && price.billingPeriod === plan.price.billingPeriod);
      return known ? { ...plan, name: planNames[input.outputLanguage][plan.price.billingPeriod] } : plan;
    }),
    trialTerms: localized && sameTrial ? {
      ...approvedTrial,
      eligibility: approvedTrial.eligibility === originalTrial.eligibility ? localized.eligibility : approvedTrial.eligibility,
      renewalDisclosure: approvedTrial.renewalDisclosure === originalTrial.renewalDisclosure ? localized.renewalDisclosure : approvedTrial.renewalDisclosure,
    } : approvedTrial,
  };
}
