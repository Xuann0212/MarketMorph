import type {
  ExampleInput,
  InputPayload,
  TargetMarket,
} from "./designSchema.ts";
import {
  formatAmountMinor,
  parseAmountMinor,
  validateInput,
} from "./inputValidation.ts";

export const MAX_IMPORT_BYTES = 256 * 1024;
export type MarketProfile = ExampleInput["markets"][TargetMarket];
export type MarketProfiles = Partial<Record<TargetMarket, MarketProfile>>;
export interface ProductData {
  input: InputPayload;
  markets: MarketProfiles;
}
export interface ProductFormDraft {
  input: InputPayload;
  amounts: string[];
  days: string;
}

export function createProductDraft(input: InputPayload): ProductFormDraft {
  return {
    input: structuredClone(input),
    amounts: input.subscriptionPlans.map((p) =>
      Number.isSafeInteger(p.price.amountMinor)
        ? formatAmountMinor(p.price.amountMinor)
        : "",
    ),
    days: String(input.trialTerms.days),
  };
}
export function prepareInput(draft: ProductFormDraft): InputPayload {
  return {
    ...draft.input,
    subscriptionPlans: draft.input.subscriptionPlans.map((p, i) => ({
      ...p,
      price: {
        ...p.price,
        amountMinor: parseAmountMinor(draft.amounts[i] ?? "") ?? NaN,
      },
    })),
    trialTerms: {
      ...draft.input.trialTerms,
      days: /^\d+$/.test(draft.days) ? Number(draft.days) : NaN,
    },
  };
}
export function marketProfile(input: InputPayload): MarketProfile {
  return structuredClone({
    outputLanguage: input.outputLanguage,
    subscriptionPlans: input.subscriptionPlans,
    trialTerms: input.trialTerms,
  });
}
/** Keep language and product-wide facts when changing only the target market. */
export function selectMarket(
  input: InputPayload,
  market: TargetMarket,
  profiles: MarketProfiles,
): InputPayload {
  const profile = profiles[market];
  if (!profile)
    throw new Error(
      `没有 ${market} 市场的已批准价格。请导入含两个市场的示例格式；不会换算价格或沿用其他产品的数据。`,
    );
  return {
    ...input,
    ...structuredClone(profile),
    targetMarket: market,
    outputLanguage: input.outputLanguage,
  };
}
export function applyProductFacts(
  current: InputPayload,
  edited: InputPayload,
): InputPayload {
  return {
    ...current,
    productName: edited.productName,
    productCategory: edited.productCategory,
    productDescription: edited.productDescription,
    targetAudience: edited.targetAudience,
    benefits: edited.benefits,
    subscriptionPlans: edited.subscriptionPlans,
    trialTerms: edited.trialTerms,
  };
}
export function isProductField(path: string): boolean {
  return (
    [
      "productName",
      "productCategory",
      "productDescription",
      "targetAudience",
      "benefits",
    ].includes(path) ||
    path.startsWith("subscriptionPlans") ||
    path.startsWith("trialTerms")
  );
}
function assertValid(
  value: unknown,
  context: string,
): asserts value is InputPayload {
  const errors = validateInput(value);
  if (Object.keys(errors).length)
    throw new Error(
      `${context}：${Object.entries(errors)
        .map(([field, reason]) => `${field}: ${reason}`)
        .join("；")}`,
    );
}
/** Accept a plain InputPayload or the existing two-market ExampleInput envelope. */
export function parseProductData(value: unknown): ProductData {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("JSON 顶层必须是 InputPayload 或示例对象。");
  const data = value as Record<string, unknown>;
  if ("input" in data) {
    if (data.schemaVersion !== "1.0")
      throw new Error("示例 schemaVersion 必须为 1.0。");
    assertValid(data.input, "产品资料无效");
    if (!data.markets || typeof data.markets !== "object")
      throw new Error("示例格式需要 markets.US 和 markets.HK。");
    const markets = data.markets as Record<string, unknown>;
    const profiles: MarketProfiles = {};
    for (const market of ["US", "HK"] as const) {
      const profile = markets[market];
      if (!profile || typeof profile !== "object" || Array.isArray(profile))
        throw new Error(`缺少 markets.${market} 资料。`);
      const candidate = { ...data.input, ...profile, targetMarket: market };
      assertValid(candidate, `${market} 市场资料无效`);
      profiles[market] = marketProfile(candidate);
    }
    // The selected payload is authoritative; never silently replace confirmed prices.
    profiles[data.input.targetMarket] = marketProfile(data.input);
    return structuredClone({ input: data.input, markets: profiles });
  }
  assertValid(value, "InputPayload 无效");
  return {
    input: structuredClone(value),
    markets: { [value.targetMarket]: marketProfile(value) },
  };
}
export function readImportJson(
  text: string,
  file: { name: string; size: number; type: string },
 ): unknown {
  if (!/\.json$/i.test(file.name)) throw new Error("仅支持 .json 文件。");
  if (file.size > MAX_IMPORT_BYTES)
    throw new Error("JSON 文件不能超过 256 KB。");
  if (
    file.type &&
    !["application/json", "text/json", "text/plain"].includes(file.type)
  )
    throw new Error("文件类型必须为 JSON。");
  let value: unknown;
  try {
    value = JSON.parse(text.replace(/^\uFEFF/, ""));
  } catch (error) {
    throw new Error(
      `JSON 解析失败：${error instanceof Error ? error.message : "语法错误"}`,
    );
  }
  return value;
}
export function parseImportText(text: string, file: { name: string; size: number; type: string }): ProductData {
  return parseProductData(readImportJson(text, file));
}
