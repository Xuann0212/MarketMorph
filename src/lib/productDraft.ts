import { LANGUAGES, MARKETS, MARKET_CONFIG } from "./designSchema.ts";
import type { InputPayload, OutputLanguage, SubscriptionPlan, TargetMarket, TrialTerms } from "./designSchema.ts";
import { parseAmountMinor } from "./inputValidation.ts";
import { InputSchema } from "./generationSchema.ts";
import { createProductDraft, parseProductData, prepareInput, readImportJson } from "./workspaceData.ts";
import type { ProductData, ProductFormDraft } from "./workspaceData.ts";
import { stableJson } from "./studioTypes.ts";

const FACTS = ["productName", "productCategory", "productDescription", "targetAudience", "benefits"] as const;
type ProductFacts = Pick<InputPayload, typeof FACTS[number]>;
export type DesignSettings = Pick<InputPayload, "designGoal" | "brandStyle" | "brandColors">;
type OfferDraft = Pick<InputPayload, "subscriptionPlans" | "trialTerms"> & { amounts: string[]; days: string };
export interface ProductDraft {
  facts: ProductFacts;
  offersByMarket: Partial<Record<TargetMarket, OfferDraft>>;
  dataMode: InputPayload["dataMode"];
  importedMetadata?: { market?: TargetMarket; language?: OutputLanguage; fileName?: string };
}
export interface TargetSettings {
  market: TargetMarket | "";
  language: OutputLanguage | "";
  languageChosen: boolean;
}

export const defaultDesignSettings: DesignSettings = {
  designGoal: "preserve",
  brandStyle: "簡約：字體清晰，留白充足，營造沉穩的閱讀感。",
  brandColors: { allowed: [], forbidden: [], backgroundPreference: "" },
};

export function emptyTrial(): TrialTerms {
  return { days: 0, eligibility: "", renewalDisclosure: "", eligiblePlanIds: [] };
}

export function blankProduct(): ProductDraft {
  return {
    facts: { productName: "", productCategory: "", productDescription: "", targetAudience: "", benefits: [] },
    offersByMarket: {},
    dataMode: "confirmed",
  };
}

export function blankPlan(market: TargetMarket, id: string): SubscriptionPlan {
  return { id, name: "", market, price: { amountMinor: NaN, currency: MARKET_CONFIG[market].currency, billingPeriod: "month" } };
}

function pickFacts(input: InputPayload): ProductFacts {
  const { productName, productCategory, productDescription, targetAudience, benefits } = input;
  return { productName, productCategory, productDescription, targetAudience, benefits };
}

export function projectDraft(product: ProductDraft, target: TargetSettings, design: DesignSettings): ProductFormDraft {
  const market = target.market || "US";
  const offer = target.market ? product.offersByMarket[target.market] : undefined;
  return {
    input: {
      ...product.facts,
      ...design,
      schemaVersion: "1.0",
      dataMode: product.dataMode,
      targetMarket: market,
      outputLanguage: target.language || MARKET_CONFIG[market].language,
      subscriptionPlans: offer?.subscriptionPlans ?? (target.market ? [blankPlan(target.market, target.market.toLowerCase() + "-plan-1")] : []),
      trialTerms: offer?.trialTerms ?? emptyTrial(),
      additionalInstructions: "",
    },
    amounts: offer?.amounts ?? [""],
    days: offer?.days ?? "0",
  };
}

export function updateDraft(product: ProductDraft, market: TargetMarket | "", form: ProductFormDraft): ProductDraft {
  const { subscriptionPlans, trialTerms } = form.input;
  return {
    ...product,
    facts: pickFacts(form.input),
    offersByMarket: market
      ? { ...product.offersByMarket, [market]: { subscriptionPlans, trialTerms, amounts: form.amounts, days: form.days } }
      : product.offersByMarket,
  };
}

export function toDraft(data: ProductData): ProductDraft {
  let draft: ProductDraft = { facts: pickFacts(data.input), dataMode: data.input.dataMode, offersByMarket: {} };
  for (const market of MARKETS) {
    const profile = data.markets[market];
    if (!profile) continue;
    const form = createProductDraft({ ...data.input, ...profile, targetMarket: market });
    draft = updateDraft(draft, market, form);
  }
  return structuredClone(draft);
}

export function generationInput(form: ProductFormDraft, target: TargetSettings, instructions: string, source?: InputPayload["originalPaywall"]): InputPayload | null {
  if (!target.market || !target.language) return null;
  return { ...prepareInput(form), additionalInstructions: instructions, ...(source ? { originalPaywall: source } : {}) };
}

export function chooseTargetMarket(target: TargetSettings, market: TargetSettings["market"]): TargetSettings {
  return { ...target, market, language: target.languageChosen ? target.language : market ? MARKET_CONFIG[market].language : "" };
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("資料必須為 JSON 物件。");
  return value as Record<string, unknown>;
}

function parseModern(data: Record<string, unknown>, unknownFields: string[]): ProductDraft {
  if (data.schemaVersion !== "2.0") throw new Error("產品草稿的 schemaVersion 必須為 2.0。");
  const offers = asRecord(data.offersByMarket ?? {});
  let draft = blankProduct();
  const facts = {
    productName: data.productName ?? "",
    productCategory: data.productCategory ?? "",
    productDescription: data.productDescription ?? data.description ?? "",
    targetAudience: data.targetAudience ?? "",
    benefits: Array.isArray(data.benefits) ? data.benefits.map((benefit, i) =>
      typeof benefit === "string" ? { id: "benefit-" + (i + 1), description: benefit } : benefit) : data.benefits ?? [],
  };
  const base = {
    ...facts, ...defaultDesignSettings, schemaVersion: "1.0", dataMode: "confirmed",
    additionalInstructions: "", trialTerms: emptyTrial(), subscriptionPlans: [],
  };
  for (const market of MARKETS) {
    if (!(market in offers)) continue;
    const profile = asRecord(offers[market]);
    const plans = profile.subscriptionPlans ?? profile.plans;
    if (!Array.isArray(plans)) throw new Error(market + " 缺少訂閱方案清單。");
    const subscriptionPlans = plans.map((value, i) => {
      const plan = asRecord(value);
      const path = "offersByMarket." + market + ".plans." + i;
      const known = ["id", "planId", "name", "planName", "market", "price", "currency",
        "billingPeriod", "productId", "benefitIds", "terms", "trial"];
      unknownFields.push(...Object.keys(plan).filter((key) => !known.includes(key)).map((key) => path + "." + key));
      const price = typeof plan.price === "number" || typeof plan.price === "string"
        ? { amountMinor: parseAmountMinor(String(plan.price)), currency: plan.currency, billingPeriod: plan.billingPeriod }
        : asRecord(plan.price);
      return {
        id: plan.id ?? plan.planId, name: plan.name ?? plan.planName, market: plan.market ?? market,
        productId: plan.productId, benefitIds: plan.benefitIds, terms: plan.terms, trial: plan.trial,
        price: { amountMinor: price.amountMinor, currency: price.currency, billingPeriod: price.billingPeriod },
      };
    });
    const parsed = InputSchema.safeParse({
      ...base, targetMarket: market, outputLanguage: MARKET_CONFIG[market].language,
      subscriptionPlans, trialTerms: profile.trialTerms ?? emptyTrial(),
    });
    if (!parsed.success) {
      const error = parsed.error.issues[0];
      throw new Error(market + " " + error.path.join(".") + "： " + error.message);
    }
    draft = updateDraft(draft, market, createProductDraft(parsed.data));
  }
  // A facts-only file can populate an empty draft before a target is chosen.
  if (!Object.keys(draft.offersByMarket).length) {
    const probe = InputSchema.safeParse({
      ...base, targetMarket: "US", outputLanguage: "en",
      subscriptionPlans: [{ ...blankPlan("US", "import-check"), name: "Import check", price: { currency: "USD", billingPeriod: "month", amountMinor: 0 } }],
    });
    if (!probe.success) {
      const error = probe.error.issues[0];
      throw new Error(error.path.join(".") + "： " + error.message);
    }
    draft.facts = pickFacts(probe.data);
  }
  return draft;
}

export interface WorkspaceImport {
  draft: ProductDraft;
  unknownFields: string[];
}
export function parseWorkspaceImport(text: string, file: { name: string; size: number; type: string }): WorkspaceImport {
  const value = asRecord(readImportJson(text, file));
  const modern = "offersByMarket" in value;
  const legacy = "input" in value ? asRecord(value.input) : value;
  const unknownFields: string[] = [];
  const draft = modern
    ? parseModern(value, unknownFields)
    : toDraft(parseProductData("input" in value
      ? { ...value, input: { ...legacy, designGoal: "preserve" } }
      : { ...legacy, designGoal: "preserve" }));
  const importedMarkets = MARKETS.filter((market) => draft.offersByMarket[market]);
  const explicitMarket = modern ? value.sourceDataMarket : legacy.targetMarket;
  const market = (explicitMarket ?? (importedMarkets.length === 1 ? importedMarkets[0] : undefined)) as TargetMarket;
  const language = (modern ? value.sourceDataLanguage : legacy.outputLanguage) as OutputLanguage;
  draft.importedMetadata = {
    ...(MARKETS.includes(market) ? { market } : {}),
    ...(LANGUAGES.includes(language) ? { language } : {}),
    fileName: file.name,
  };
  const known = modern
    ? [...FACTS, "schemaVersion", "description", "offersByMarket", "sourceDataMarket", "sourceDataLanguage"]
    : [...FACTS, "schemaVersion", "dataMode", "input", "markets", "simulationNotice", "targetMarket", "outputLanguage",
       "subscriptionPlans", "trialTerms", "designGoal", "brandStyle", "brandColors", "additionalInstructions", "originalPaywall"];
  unknownFields.push(...Object.keys(value).filter((key) => !known.includes(key)));
  if (modern) unknownFields.push(...Object.keys(asRecord(value.offersByMarket)).filter((key) => !MARKETS.includes(key as TargetMarket)).map((key) => "offersByMarket." + key));
  return { draft, unknownFields };
}

const isBlank = (value: string | unknown[]) => typeof value === "string" ? !value.trim() : !value.length;
export function compareImport(current: ProductDraft, incoming: ProductDraft) {
  const fields = [
    ...FACTS.map((key) => ({ key, old: current.facts[key], value: incoming.facts[key] })),
    ...MARKETS.map((key) => ({ key: key + " 訂閱方案", old: current.offersByMarket[key] ?? "", value: incoming.offersByMarket[key] ?? "" })),
  ];
  return fields.map(({ key, old, value }) => {
    if (stableJson(old) === stableJson(value) || (typeof value === "string" && value === ""))
      return { key, change: "保留不變" };
    const empty = (typeof old === "string" || Array.isArray(old)) && isBlank(old);
    return { key, change: empty ? "新增" : "修改／衝突" };
  });
}

export function mergeImport(current: ProductDraft, incoming: ProductDraft, mode: "fill" | "replace"): ProductDraft {
  const facts = { ...current.facts };
  for (const key of FACTS) {
    const value = incoming.facts[key];
    if (isBlank(value) || (mode === "fill" && !isBlank(current.facts[key]))) continue;
    Object.assign(facts, { [key]: structuredClone(value) });
  }
  const offersByMarket = { ...current.offersByMarket };
  for (const market of MARKETS) {
    const offer = incoming.offersByMarket[market];
    if (!offer) continue;
    const existing = offersByMarket[market];
    if (!existing || mode === "replace" || existing.subscriptionPlans.every((plan, i) => !plan.name.trim() && !existing.amounts[i]?.trim() && !plan.productId && !plan.terms && !plan.trial)) {
      offersByMarket[market] = structuredClone(offer);
      continue;
    }
    const plans = existing.subscriptionPlans.map((plan, i) => {
      const match = offer.subscriptionPlans.findIndex((item) => item.id === plan.id ||
        (plan.productId && item.productId === plan.productId));
      const candidate = offer.subscriptionPlans[match];
      if (!candidate) return { plan, amount: existing.amounts[i] };
      return {
        plan: { ...candidate, ...plan, name: plan.name.trim() ? plan.name : candidate.name },
        amount: existing.amounts[i]?.trim() ? existing.amounts[i] : offer.amounts[match],
      };
    });
    for (const [i, plan] of offer.subscriptionPlans.entries()) {
      if (!plans.some(({ plan: currentPlan }) => currentPlan.id === plan.id || (plan.productId && currentPlan.productId === plan.productId)))
        plans.push({ plan, amount: offer.amounts[i] });
    }
    offersByMarket[market] = { ...existing, subscriptionPlans: plans.map(({ plan }) => plan), amounts: plans.map(({ amount }) => amount) };
  }
  const dataMode = current.dataMode === "simulation" || incoming.dataMode === "simulation" ? "simulation" : "confirmed";
  return { facts, offersByMarket, dataMode, importedMetadata: incoming.importedMetadata };
}
