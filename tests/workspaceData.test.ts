import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  applyProductFacts,
  createProductDraft,
  marketProfile,
  MAX_IMPORT_BYTES,
  parseImportText,
  parseProductData,
  prepareInput,
  selectMarket,
} from "../src/lib/workspaceData.ts";
import { validateInput } from "../src/lib/inputValidation.ts";
const example = JSON.parse(
  readFileSync(
    new URL("../public/example_input.json", import.meta.url),
    "utf8",
  ),
);
const metadata = { name: "product.json", type: "application/json", size: 8000 };
test("existing example imports both markets; plain payload imports only its own market", () => {
  const data = parseProductData(example);
  assert.deepEqual(data.input, example.input);
  assert.deepEqual(Object.keys(data.markets), ["US", "HK"]);
  const plain = parseProductData(example.input);
  assert.deepEqual(Object.keys(plain.markets), ["US"]);
  assert.throws(
    () => selectMarket(plain.input, "HK", plain.markets),
    /没有 HK 市场/,
  );
});
test("market changes use independent prices, retain language and preserve input edits", () => {
  const data = parseProductData(example);
  data.input.subscriptionPlans[0].price.amountMinor = 1234;
  data.input.outputLanguage = "zh-Hans";
  data.markets.US = marketProfile(data.input);
  const hk = selectMarket(data.input, "HK", data.markets);
  assert.equal(hk.subscriptionPlans[0].price.amountMinor, 7800);
  assert.equal(hk.trialTerms.eligiblePlanIds[0], "hk-annual");
  assert.equal(hk.outputLanguage, "zh-Hans");
  assert.equal(
    selectMarket(hk, "US", data.markets).subscriptionPlans[0].price.amountMinor,
    1234,
  );
  assert.deepEqual(validateInput(hk), {});
});
test("invalid import extension, size, MIME, syntax and schema provide specific errors", () => {
  assert.throws(
    () => parseImportText("{}", { ...metadata, name: "image.png" }),
    /仅支持/,
  );
  assert.throws(
    () => parseImportText("{}", { ...metadata, size: MAX_IMPORT_BYTES + 1 }),
    /256 KB/,
  );
  assert.throws(
    () => parseImportText("{}", { ...metadata, type: "application/pdf" }),
    /文件类型/,
  );
  assert.throws(() => parseImportText("{bad", metadata), /JSON 解析失败/);
  assert.throws(() => parseImportText("{}", metadata), /productName/);
  assert.throws(() => parseProductData(null), /顶层/);
  const bad = structuredClone(example);
  bad.markets.HK.subscriptionPlans[0].price.currency = "USD";
  assert.throws(() => parseProductData(bad), /HK.*currency/);
});
test("UTF-8 BOM, standard JSON files and missing MIME are accepted", () => {
  assert.deepEqual(
    parseImportText("\uFEFF" + JSON.stringify(example), {
      ...metadata,
      type: "",
    }).input,
    example.input,
  );
});
test("confirmed payload remains authoritative if envelope has different selected-market prices", () => {
  const changed = structuredClone(example);
  changed.input.subscriptionPlans[0].price.amountMinor = 1111;
  changed.input.trialTerms.renewalDisclosure = changed.input.trialTerms.renewalDisclosure.replace("USD 9.99", "USD 11.11");
  const data = parseProductData(changed);
  assert.equal(data.markets.US?.subscriptionPlans[0].price.amountMinor, 1111);
});
test("drafts preserve raw invalid numbers and are isolated from confirmed product facts", () => {
  const input = parseProductData(example).input;
  const draft = createProductDraft(input);
  draft.amounts[0] = "-12";
  draft.days = "1.5";
  draft.input.trialTerms.eligibility = "";
  const issues = validateInput(prepareInput(draft));
  assert.ok(issues["subscriptionPlans.0.price.amountMinor"]);
  assert.ok(issues["trialTerms.days"]);
  assert.equal(input.subscriptionPlans[0].price.amountMinor, 999);
  assert.equal(draft.amounts[0], "-12");
});
test("confirming product edits does not overwrite main inputs or brand rules", () => {
  const input = parseProductData(example).input;
  const draft = createProductDraft(input);
  draft.input.productName = "Edited App";
  draft.amounts[0] = "12.34";
  const current = {
    ...input,
    designGoal: "trial" as const,
    brandStyle: "Warm & Friendly",
  };
  const confirmed = applyProductFacts(current, prepareInput(draft));
  assert.equal(confirmed.productName, "Edited App");
  assert.equal(confirmed.subscriptionPlans[0].price.amountMinor, 1234);
  assert.equal(confirmed.brandStyle, "Warm & Friendly");
  assert.equal(confirmed.designGoal, "trial");
  assert.deepEqual(
    confirmed.brandColors.forbidden,
    input.brandColors.forbidden,
  );
});
test("references retain source market while current target changes", () => {
  const data = parseProductData(example);
  const current = selectMarket(data.input, "HK", data.markets);
  const original = {
    ...current,
    ...data.markets.US,
    targetMarket: "US",
    outputLanguage: "en",
  };
  assert.equal(original.subscriptionPlans[0].price.currency, "USD");
  assert.equal(original.subscriptionPlans[0].price.amountMinor, 999);
});
