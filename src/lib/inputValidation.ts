import {
  BILLING_PERIODS,
  MAX_PLANS,
  DESIGN_GOALS,
  LANGUAGES,
  MARKETS,
  MARKET_CURRENCY,
} from "./designSchema.ts";
import type { InputPayload } from "./designSchema.ts";
export type InputErrors = Record<string, string>;
const record = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
const nonempty = (v: unknown) => typeof v === "string" && v.trim().length > 0;
/** Decimal text → minor units without floating point multiplication or silent rounding. */
export function parseAmountMinor(text: string): number | null {
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) return null;
  const [whole, fraction = ""] = text.split(".");
  const result = Number(whole + fraction.padEnd(2, "0"));
  return Number.isSafeInteger(result) ? result : null;
}
export function formatAmountMinor(value: number): string {
  return `${Math.floor(value / 100)}.${String(value % 100).padStart(2, "0")}`;
}
function hasConflictingPrice(text: unknown, plans: unknown[]): boolean {
  if (typeof text !== "string") return false;
  const quotes = text.matchAll(/(?:\b(USD|HKD)\s*|(US|HK)\$\s*)(\d[\d,]*(?:\.\d+)?)/gi);
  return Array.from(quotes).some(([, code, prefix, amount]) => {
    const value = parseAmountMinor(amount.replaceAll(",", ""));
    if (value === 0) return false; // Free trials and zero-cost disclosures.
    const currency = (code ?? prefix + "D").toUpperCase();
    return value === null || !plans.some((plan) => {
      const price = record(record(plan).price);
      return price.currency === currency && price.amountMinor === value;
    });
  });
}
/** Also accepts unknown so a future server endpoint can reuse these checks. */
export function validateInput(value: unknown): InputErrors {
  const p = record(value);
  const errors: InputErrors = {};
  if (p.originalPaywall !== undefined) {
    const source = record(p.originalPaywall);
    if (
      !["demo", "image"].includes(String(source.kind)) ||
      !nonempty(source.id)
    )
      errors.originalPaywall = "原始頁面來源類型或 ID 無效。";
    for (const key of ["sourceMarket", "sourceLanguage"]) {
      if (source[key] !== undefined && (!nonempty(source[key]) || String(source[key]).length > 80))
        errors.originalPaywall = "原始市場或語言資料無效。";
    }
    if (
      source.kind === "image" &&
      (!nonempty(source.name) ||
        !["image/png", "image/jpeg", "image/webp"].includes(
          String(source.mime),
        ) ||
        !Number.isSafeInteger(source.width) ||
        !Number.isSafeInteger(source.height) ||
        Number(source.width) <= 0 ||
        Number(source.height) <= 0)
    )
      errors.originalPaywall = "圖片來源必須包含有效名稱、格式及尺寸。";
  }
  if (!nonempty(p.productName) || String(p.productName).length > 200)
    errors.productName = "請填寫產品名稱（最多 200 字）。";
  for (const key of ["productCategory", "productDescription", "targetAudience", "brandStyle"]) {
    const limit = key === "productCategory" ? 200 : 5000;
    if (typeof p[key] !== "string" || p[key].length > limit) errors[key] = "此欄位的文字無效或過長。";
  }
  if (p.schemaVersion !== "1.0" || !["simulation", "confirmed"].includes(String(p.dataMode)))
    errors.form = "不支援此資料版本。";
  if (!MARKETS.includes(p.targetMarket as never))
    errors.targetMarket = "請選擇目標市場。";
  if (!LANGUAGES.includes(p.outputLanguage as never))
    errors.outputLanguage = "請選擇輸出語言。";
  if (!DESIGN_GOALS.includes(p.designGoal as never))
    errors.designGoal = "请选择预设展示目标。";
  if (typeof p.additionalInstructions !== "string" || p.additionalInstructions.length > 10000)
    errors.additionalInstructions = "补充要求必须是文字。";
  const colors = record(p.brandColors);
  for (const key of ["allowed", "forbidden"]) {
    const list = colors[key];
    if (
      !Array.isArray(list) ||
      list.length > 24 ||
      list.some((c) => typeof c !== "string" || !/^#[0-9a-f]{6}$/i.test(c))
    )
      errors[`brandColors.${key}`] =
        "請使用六位 HEX 顏色，例如 #2563EB。";
  }
  if (typeof colors.backgroundPreference !== "string" || colors.backgroundPreference.length > 5000)
    errors["brandColors.backgroundPreference"] = "背景配色偏好必須為有效文字。";
  if (
    Array.isArray(colors.allowed) &&
    Array.isArray(colors.forbidden) &&
    colors.allowed.some((c) =>
      (colors.forbidden as unknown[]).some(
        (f) => String(f).toLowerCase() === String(c).toLowerCase(),
      ),
    )
  )
    errors["brandColors.forbidden"] = "允许颜色与禁止颜色不能重叠。";
  const plans = Array.isArray(p.subscriptionPlans) ? p.subscriptionPlans : [];
  if (!plans.length || plans.length > MAX_PLANS)
    errors.subscriptionPlans = "請提供至少一個訂閱方案，最多 12 個。";
  const benefits = Array.isArray(p.benefits) ? p.benefits : [];
  const benefitIds = new Set<string>();
  if (!benefits.length || benefits.length > 20 || benefits.some((value) => {
    const benefit = record(value);
    const id = String(benefit.id);
    const invalid = !nonempty(benefit.id) || id.length > 100 || benefitIds.has(id) ||
      !nonempty(benefit.description) || String(benefit.description).length > 1500;
    benefitIds.add(id);
    return invalid;
  })) errors.benefits = "請填寫至少一項會員權益，最多 20 項，且 ID 不可重複。";
  const ids = new Set<string>();
  const productIds = new Set<string>();
  const configurations = new Set<string>();
  plans.forEach((value, i) => {
    const plan = record(value);
    const price = record(plan.price);
    const prefix = "subscriptionPlans." + i;
    const id = String(plan.id).trim();
    if (!nonempty(plan.id) || id.length > 100 || ids.has(id))
      errors[prefix + ".id"] = "方案 ID 必須填寫且不可重複。";
    ids.add(id);
    if (!nonempty(plan.name) || String(plan.name).length > 200)
      errors[prefix + ".name"] = "請填寫方案名稱（最多 200 字）。";
    if (plan.market !== p.targetMarket) errors[prefix + ".market"] = "方案必須屬於目標市場。";
    const currency = MARKET_CURRENCY[p.targetMarket as InputPayload["targetMarket"]];
    if (!currency || price.currency !== currency)
      errors[prefix + ".price.currency"] = "幣種必須符合目標市場。";
    if (!Number.isSafeInteger(price.amountMinor) || Number(price.amountMinor) < 0)
      errors[prefix + ".price.amountMinor"] = "請填寫有效的目標市場價格（非負、最多兩位小數）。";
    if (!BILLING_PERIODS.includes(price.billingPeriod as never))
      errors[prefix + ".price.billingPeriod"] = "請選擇每月或每年計費。";
    if (plan.productId !== undefined) {
      const productId = String(plan.productId).trim();
      if (!nonempty(plan.productId) || productId.length > 200 || productIds.has(productId))
        errors[prefix + ".productId"] = "商品 ID 無效或已用於另一方案。";
      productIds.add(productId);
    }
    if (plan.benefitIds !== undefined && (!Array.isArray(plan.benefitIds) ||
      new Set(plan.benefitIds).size !== plan.benefitIds.length ||
      plan.benefitIds.some((benefitId) => typeof benefitId !== "string" || !benefitIds.has(benefitId))))
      errors[prefix + ".benefitIds"] = "請選擇已填寫的會員權益。";
    if (plan.terms !== undefined && (!nonempty(plan.terms) || String(plan.terms).length > 5000))
      errors[prefix + ".terms"] = "方案條款無效或過長。";
    if (hasConflictingPrice(plan.terms, plans))
      errors[prefix + ".terms"] = "條款列出的金額或幣種與已填寫的方案不一致。";
    if (plan.trial !== undefined) {
      const trial = record(plan.trial);
      if (!Number.isSafeInteger(trial.days) || Number(trial.days) < 1 || Number(trial.days) > 365)
        errors[prefix + ".trial.days"] = "請填寫 1 至 365 天的試用時長。";
      for (const key of ["eligibility", "renewalDisclosure"]) {
        if (!nonempty(trial[key]) || String(trial[key]).length > 5000)
          errors[prefix + ".trial." + key] = key === "eligibility" ? "請填寫試用適用條件。" : "請填寫試用後收費說明。";
      }
    }
    if (hasConflictingPrice(record(plan.trial).renewalDisclosure, [plan]))
      errors[prefix + ".trial.renewalDisclosure"] = "試用後收費須符合此方案的金額及幣種。";
    const configuration = JSON.stringify([
      String(plan.name).trim().toLowerCase(), price.billingPeriod, price.amountMinor,
      price.currency, plan.productId ?? "", [...(Array.isArray(plan.benefitIds) && plan.benefitIds.length ? plan.benefitIds.filter((id) => typeof id === "string") : benefitIds)].sort(),
      record(plan.trial).days, record(plan.trial).eligibility, record(plan.trial).renewalDisclosure, plan.terms ?? "",
    ]);
    if (configurations.has(configuration)) errors[prefix + ".name"] = "已有完全相同的訂閱方案。";
    configurations.add(configuration);
  });
  const trial = record(p.trialTerms);
  const hasLegacyTrial = Number(trial.days) > 0;
  if (!Number.isSafeInteger(trial.days) || Number(trial.days) < 0 || Number(trial.days) > 365)
    errors["trialTerms.days"] = "試用天數必須是 0 至 365 的整數。";
  if (typeof trial.eligibility !== "string" || trial.eligibility.length > 5000 ||
    (hasLegacyTrial && !nonempty(trial.eligibility)))
    errors["trialTerms.eligibility"] = "請填寫試用適用條件。";
  if (typeof trial.renewalDisclosure !== "string" || trial.renewalDisclosure.length > 5000 ||
    (hasLegacyTrial && !nonempty(trial.renewalDisclosure)))
    errors["trialTerms.renewalDisclosure"] = "請填寫試用後收費說明。";
  if (hasConflictingPrice(trial.renewalDisclosure, plans))
    errors["trialTerms.renewalDisclosure"] = "續費說明的金額或幣種與目標市場方案不一致。";
  if (!Array.isArray(trial.eligiblePlanIds) ||
    new Set(trial.eligiblePlanIds).size !== trial.eligiblePlanIds.length ||
    hasLegacyTrial !== Boolean(trial.eligiblePlanIds.length) ||
    trial.eligiblePlanIds.some((id) => !ids.has(id) || plans.some((plan) => record(plan).id === id && record(plan).trial !== undefined)))
    errors["trialTerms.eligiblePlanIds"] = "請核對適用方案，並避免同一方案重複設定試用。";
  if (p.designGoal === "annual" && !plans.some((plan) => record(record(plan).price).billingPeriod === "year"))
    errors.designGoal = "目前沒有年費方案，請新增年費方案或調整設計目標。";
  if (p.designGoal === "trial" && !hasLegacyTrial && !plans.some((plan) => record(plan).trial))
    errors.designGoal = "目前沒有免費試用，請新增試用條款或調整設計目標。";
  return errors;
}
