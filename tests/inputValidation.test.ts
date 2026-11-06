import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  parseAmountMinor,
  formatAmountMinor,
  validateInput,
} from "../src/lib/inputValidation.ts";
import type { ExampleInput } from "../src/lib/designSchema.ts";
const example = JSON.parse(
  readFileSync(
    new URL("../public/example_input.json", import.meta.url),
    "utf8",
  ),
) as ExampleInput;
test("both independent market profiles are valid and retain their prices", () => {
  assert.deepEqual(validateInput(example.input), {});
  for (const targetMarket of ["US", "HK"] as const)
    assert.deepEqual(
      validateInput({
        ...example.input,
        ...example.markets[targetMarket],
        targetMarket,
      }),
      {},
    );
  assert.equal(example.markets.US.subscriptionPlans[0].price.amountMinor, 999);
  assert.equal(example.markets.HK.subscriptionPlans[0].price.amountMinor, 7800);
  assert.equal(
    example.markets.HK.subscriptionPlans[1].price.amountMinor,
    58800,
  );
});
test("decimal parser is exact and rejects blank, negative, exponent and excess precision", () => {
  for (const [text, expected] of [
    ["0", 0],
    ["9.99", 999],
    ["79.9", 7990],
    ["0.29", 29],
  ] as const)
    assert.equal(parseAmountMinor(text), expected);
  for (const text of [
    "",
    "-1",
    "1.001",
    "abc",
    "Infinity",
    "1e2",
    " 1 ",
    "9007199254740991",
  ])
    assert.equal(parseAmountMinor(text), null);
  assert.equal(formatAmountMinor(999), "9.99");
});
test("required fields and preset enums reject invalid values", () => {
  const p = structuredClone(example.input);
  p.productName = " ";
  p.targetAudience = "";
  const e = validateInput({
    ...p,
    targetMarket: "CN",
    outputLanguage: "fr",
    designGoal: "conversion",
  });
  for (const k of [
    "productName",
    "targetMarket",
    "outputLanguage",
    "designGoal",
  ])
    assert.ok(e[k]);
});
test("negative, unsafe and non-integer prices are rejected", () => {
  for (const amount of [-1, NaN, Infinity, 1.1, Number.MAX_SAFE_INTEGER + 1]) {
    const p = structuredClone(example.input);
    p.subscriptionPlans[0].price.amountMinor = amount;
    assert.ok(validateInput(p)["subscriptionPlans.0.price.amountMinor"]);
  }
});
test("wrong-market plans and currencies are rejected without symbol substitution", () => {
  const p = structuredClone(example.input);
  p.targetMarket = "HK";
  assert.ok(validateInput(p)["subscriptionPlans.0.market"]);
  assert.ok(validateInput(p)["subscriptionPlans.0.price.currency"]);
});
test("duplicate IDs and missing annual goal compatibility are rejected", () => {
  const p = structuredClone(example.input);
  p.subscriptionPlans[1].id = p.subscriptionPlans[0].id;
  p.subscriptionPlans[1].price.billingPeriod = "month";
  assert.ok(validateInput(p)["subscriptionPlans.1.id"]);
  assert.ok(validateInput(p).designGoal);
});
test("missing trial eligibility is reported, never invented; references must exist", () => {
  const p = structuredClone(example.input);
  p.trialTerms.eligibility = "";
  p.trialTerms.eligiblePlanIds = ["invented-plan"];
  assert.ok(validateInput(p)["trialTerms.eligibility"]);
  assert.ok(validateInput(p)["trialTerms.eligiblePlanIds"]);
  assert.equal(p.trialTerms.eligibility, "");
});
test("brand conflicts, missing benefits and malformed unknown payloads do not pass", () => {
  const p = structuredClone(example.input);
  p.brandColors.forbidden = ["#2563eb"];
  p.benefits = [];
  assert.ok(validateInput(p)["brandColors.forbidden"]);
  assert.ok(validateInput(p).benefits);
  for (const value of [
    null,
    undefined,
    {},
    { subscriptionPlans: [null], benefits: [null] },
  ])
    assert.ok(Object.keys(validateInput(value)).length > 0);
});
