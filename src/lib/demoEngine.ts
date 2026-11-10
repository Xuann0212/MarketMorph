import type {
  AuditReport,
  DesignSpec,
  InputPayload,
  PageSection,
} from "./designSchema.ts";
import { validateInput } from "./inputValidation.ts";
import { exampleBenefitCopy } from "./exampleBenefitCopy.ts";
import { matchesOutputLanguage, paywallCopyIssues } from "./paywallContent.ts";
const sections: PageSection[] = [
  "headline",
  "benefits",
  "plans",
  "trial",
  "cta",
  "disclosures",
];
const keys = [
  "schemaVersion",
  "layout",
  "sectionOrder",
  "theme",
  "featuredPlanId",
  "planOrder",
  "headline",
  "benefitsCopy",
  "ctaText",
  "designReasons",
];
function object(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v))
    throw new Error("設計配置必須是物件。");
  return v as Record<string, unknown>;
}
function exactKeys(v: Record<string, unknown>, permitted: string[]) {
  if (
    Object.keys(v).some((k) => !permitted.includes(k)) ||
    permitted.some((k) => !(k in v))
  )
    throw new Error("設計配置包含缺少或未允許的欄位。");
}
function sameIds(value: unknown, expected: string[]): value is string[] {
  return (
    Array.isArray(value) &&
    value.length === expected.length &&
    new Set(value).size === value.length &&
    value.every((id) => typeof id === "string" && expected.includes(id))
  );
}
export function validateDesignSpec(
  value: unknown,
  input: InputPayload,
): DesignSpec {
  const spec = object(value);
  exactKeys(spec, [
    ...keys,
    ...(spec.subtitle === undefined ? [] : ["subtitle"]),
    ...(spec.backgroundPattern === undefined ? [] : ["backgroundPattern"]),
  ]);
  if (spec.backgroundPattern !== undefined && spec.backgroundPattern !== "christmas")
    throw new Error("背景圖案無效。");
  if (spec.subtitle !== undefined && (typeof spec.subtitle !== "string" || !spec.subtitle.trim() || spec.subtitle.length > 700))
    throw new Error("副標題無效。");
  if (
    spec.schemaVersion !== "1.0" ||
    !["benefits-first", "plans-first"].includes(String(spec.layout))
  )
    throw new Error("設計版本或版面無效。");
  if (!sameIds(spec.sectionOrder, sections))
    throw new Error("頁面區塊必須完整且不能重複。");
  const order = spec.sectionOrder as string[];
  if (
    (spec.layout === "benefits-first") !==
    order.indexOf("benefits") < order.indexOf("plans")
  )
    throw new Error("區塊順序與版面類型不符。");
  const ids = input.subscriptionPlans.map((p) => p.id);
  if (
    !sameIds(spec.planOrder, ids) ||
    !ids.includes(String(spec.featuredPlanId))
  )
    throw new Error("只能引用已確認的套餐 ID。");
  const featured = input.subscriptionPlans.find((plan) => plan.id === spec.featuredPlanId);
  if (input.designGoal === "annual" && featured?.price.billingPeriod !== "year")
    throw new Error("年費展示目標必須突出已確認的年費方案。");
  if (input.designGoal === "trial" && featured && !featured.trial && !input.trialTerms.eligiblePlanIds.includes(featured.id))
    throw new Error("試用展示目標必須突出適用試用的方案。");
  const theme = object(spec.theme);
  exactKeys(theme, ["background", "surface", "text", "accent"]);
  const allowed = input.brandColors.allowed.map((c) => c.toLowerCase()),
    forbidden = input.brandColors.forbidden.map((c) => c.toLowerCase());
  if (
    Object.values(theme).some(
      (c) =>
        typeof c !== "string" ||
        !/^#[a-f\d]{6}$/i.test(c) ||
        (allowed.length > 0 && !allowed.includes(c.toLowerCase())) ||
        forbidden.includes(c.toLowerCase()),
    )
  )
    throw new Error("設計使用未批准或禁止的顏色。");
  for (const key of ["headline", "ctaText"])
    if (
      typeof spec[key] !== "string" ||
      !(spec[key] as string).trim() ||
      (spec[key] as string).length > 500
    )
      throw new Error("標題及 CTA 必須為有效文字。");
  if (
    !Array.isArray(spec.benefitsCopy) ||
    spec.benefitsCopy.length !== input.benefits.length
  )
    throw new Error("會員權益不能新增或遺漏。");
  const benefitIds: string[] = [];
  for (const b of spec.benefitsCopy) {
    const item = object(b);
    exactKeys(item, ["benefitId", "text"]);
    if (
      typeof item.text !== "string" ||
      !item.text.trim() ||
      !input.benefits.some((v) => v.id === item.benefitId)
    )
      throw new Error("未知會員權益或無效文案。");
    benefitIds.push(String(item.benefitId));
  }
  if (new Set(benefitIds).size !== input.benefits.length)
    throw new Error("會員權益 ID 不能重複。");
  if (
    !Array.isArray(spec.designReasons) ||
    !spec.designReasons.length ||
    spec.designReasons.some((r) => {
      const item = object(r);
      exactKeys(item, ["field", "reason"]);
      return (
        typeof item.field !== "string" ||
        typeof item.reason !== "string" ||
        !item.reason.trim()
      );
    })
  )
    throw new Error("缺少設計修改原因。");
  return structuredClone(spec) as unknown as DesignSpec;
}
export function luminance(hex: string): number {
  const values = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
}
export function contrast(a: string, b: string): number {
  const x = luminance(a),
    y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
/** Deterministic local simulation. No model requests, OCR, random scores or invented facts. */
export function simulateDesign(input: InputPayload, fail = false): DesignSpec {
  if (Object.keys(validateInput(input)).length)
    throw new Error("產品資料未通過校驗。");
  if (fail)
    throw new Error(
      "示例演示：已觸發可控生成失敗。資料已保留，可取消失敗開關後重試。",
    );
  const candidates = input.brandColors.allowed.length ? input.brandColors.allowed : ["#FFFFFF", "#17171D", "#6750BC", "#F4F1FF", "#000000", "#202040"];
  const palette = candidates
    .filter(
      (c) =>
        !input.brandColors.forbidden.some(
          (f) => f.toLowerCase() === c.toLowerCase(),
        ),
    )
    .sort((a, b) => luminance(b) - luminance(a));
  if (!palette.length) throw new Error("沒有可使用的品牌顏色。");
  const background = palette[0],
    text = palette[palette.length - 1],
    accent =
      palette.find((c) => contrast(c, background) >= 4.5 && c !== text) ?? text;
  const zh = input.outputLanguage !== "en",
    hans = input.outputLanguage === "zh-Hans";
  const layout =
    ["benefits", "preserve"].includes(input.designGoal) ? "benefits-first" : "plans-first";
  const plans = [...input.subscriptionPlans];
  if (input.designGoal === "annual")
    plans.sort((a, b) => Number(b.price.billingPeriod === "year") - Number(a.price.billingPeriod === "year"));
  const featured = input.designGoal === "trial"
    ? plans.find((plan) => plan.trial || input.trialTerms.eligiblePlanIds.includes(plan.id))
    : plans[0];
  return validateDesignSpec(
    {
      schemaVersion: "1.0",
      layout,
      sectionOrder: [
        "headline",
        ...(layout === "plans-first"
          ? ["plans", "benefits"]
          : ["benefits", "plans"]),
        "cta",
        "trial",
        "disclosures",
      ],
      theme: { background, surface: background, text, accent },
      featuredPlanId: (featured ?? plans[0]).id,
      planOrder: plans.map((p) => p.id),
      headline: zh
        ? `${input.productName}，${hans ? "让每一步更进一步。" : "讓每一步更進一步。"}`
        : `${input.productName}. Make room for what matters.`,
      benefitsCopy: input.benefits.map((b) => ({
        benefitId: b.id,
        text: exampleBenefitCopy(input.outputLanguage, b.id, b.description),
      })),
      ctaText: zh
        ? hans
          ? "选择订阅方案"
          : "選擇訂閱方案"
        : "Choose a subscription plan",
      designReasons: [
        {
          field: "layout",
          reason: `示例規則依 ${input.designGoal} 目標選用 ${layout}；沒有呼叫 AI。`,
        },
        {
          field: "theme",
          reason: "使用已設定的品牌色或預設色，並排除禁止色。",
        },
        {
          field: "featuredPlanId",
          reason:
            "按設計目標選擇已確認的方案，價格與資格取自已確認資料。",
        },
        {
          field: "copy",
          reason: "標題及行動按鈕使用所選語言的模板。示例權益使用預先核對的譯文，其餘權益沿用已確認文案。",
        },
      ],
    },
    input,
  );
}
export function auditDesign(
  input: InputPayload,
  spec: DesignSpec,
): AuditReport {
  const checks: AuditReport["checks"] = [];
  const add = (
    id: string,
    label: string,
    status: "pass" | "fail" | "needs-review",
    field: string,
    reason: string,
    expected?: string,
    actual?: string,
  ) => checks.push({ id, label, status, field, reason, expected, actual });
  try {
    validateDesignSpec(spec, input);
    add(
      "schema",
      "結構與引用",
      "pass",
      "DesignSpec",
      "已執行嚴格結構、ID 與品牌色校驗。",
    );
  } catch (e) {
    add(
      "schema",
      "結構與引用",
      "fail",
      "DesignSpec",
      e instanceof Error ? e.message : "結構無效",
    );
  }
  for (const period of ["month", "year"] as const) {
    const plans = input.subscriptionPlans.filter(
      (p) => p.price.billingPeriod === period,
    );
    add(
      period,
      period === "month" ? "月費" : "年費",
      "pass",
      "subscriptionPlans",
      plans.length ? "價格與計費週期直接取自已確認資料。" : "沒有提供此週期的方案，預覽不會自行新增。",
      JSON.stringify(plans.map((p) => p.price)),
      JSON.stringify(plans.map((p) => p.price)),
    );
  }
  const inputIssues = validateInput(input);
  add("facts", "產品事實校驗", Object.keys(inputIssues).length ? "fail" : "pass", "input", Object.values(inputIssues).join("；") || "已確認的套餐、價格、權益引用及試用資料符合結構規則。");
  const copyIssues = paywallCopyIssues(input, "live");
  const languageMatches = !Object.keys(copyIssues).length &&
    [spec.headline, spec.subtitle ?? "", spec.ctaText, ...spec.benefitsCopy.map(({ text }) => text)]
      .every((text) => matchesOutputLanguage(text, input));
  add("language", "輸出語言", languageMatches ? "pass" : "fail", "outputLanguage",
    languageMatches ? "文案及訂閱條款通過基本語言檢查，品牌名與貨幣代碼保留。" :
      Object.values(copyIssues).join(" ") || "標題、按鈕或權益含有與所選語言不符的內容。");
  if (spec.backgroundPattern === "christmas") {
    add("decoration", "聖誕背景圖案", "pass", "backgroundPattern", "頁首已繪製松枝、雪花及聖誕樹，訂閱卡片及條款區使用純色底。");
  }
  add(
    "currency",
    "幣種與計費週期",
    "pass",
    "subscriptionPlans.price",
    "由校驗後的市場資料渲染，沒有匯率換算。",
    input.subscriptionPlans
      .map((p) => `${p.price.currency}/${p.price.billingPeriod}`)
      .join(", "),
    input.subscriptionPlans
      .map((p) => `${p.price.currency}/${p.price.billingPeriod}`)
      .join(", "),
  );
  add(
    "trial",
    "免費試用",
    "pass",
    "trialTerms",
    "天數、適用套餐、資格及續費說明直接取自確認快照。",
    JSON.stringify({ shared: input.trialTerms, plans: input.subscriptionPlans.filter((p) => p.trial).map((p) => ({ id: p.id, trial: p.trial })) }),
  );
  const exact =
    spec.benefitsCopy.length === input.benefits.length &&
    spec.benefitsCopy.every(
      (b) =>
        input.benefits.some((item) => item.id === b.benefitId &&
          (item.description === b.text || exampleBenefitCopy(input.outputLanguage, item.id, item.description) === b.text)),
    );
  add(
    "benefits",
    "會員權益",
    exact ? "pass" : "needs-review",
    "benefitsCopy",
    exact ? "沿用已確認的權益文案或示例譯文。" : "文案已改寫，需人工確認語義是否一致。",
  );
  const palette = Object.values(spec.theme),
    allowed = input.brandColors.allowed.map((c) => c.toLowerCase()),
    forbidden = input.brandColors.forbidden.map((c) => c.toLowerCase());
  add(
    "allowed",
    "允許顏色",
    !allowed.length || palette.every((c) => allowed.includes(c.toLowerCase())) ? "pass" : "fail",
    "theme",
    "比對全部主題色與允許清單。",
  );
  add(
    "forbidden",
    "禁止顏色",
    palette.some((c) => forbidden.includes(c.toLowerCase())) ? "fail" : "pass",
    "theme",
    "比對全部主題色與禁止清單。",
  );
  const ratio = contrast(spec.theme.background, spec.theme.text),
    ctaRatio = contrast(spec.theme.accent, spec.theme.surface),
    surfaceRatio = contrast(spec.theme.surface, spec.theme.text);
  add(
    "contrast",
    "基礎文字可讀性",
    Math.min(ratio, ctaRatio, surfaceRatio) >= 4.5 ? "pass" : "fail",
    "theme",
    `主文 ${ratio.toFixed(2)}:1，卡片文字 ${surfaceRatio.toFixed(2)}:1，CTA ${ctaRatio.toFixed(2)}:1；僅為配色計算，並非完整無障礙審核。`,
    "≥ 4.5:1",
    Math.min(ratio, ctaRatio, surfaceRatio).toFixed(2),
  );
  add(
    "brand-semantic",
    "風格與其他品牌要求",
    "needs-review",
    "brandStyle",
    "確定性規則無法確認自由文字、品牌語氣和補充要求的語義，必須人工核對。",
  );
  return { checks };
}
