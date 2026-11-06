import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  auditDesign,
  simulateDesign,
  validateDesignSpec,
} from "../src/lib/demoEngine.ts";
import { parseProductData, selectMarket } from "../src/lib/workspaceData.ts";
import {
  productFingerprint,
  resultIsStale,
  validateImageMetadata,
} from "../src/lib/studioTypes.ts";
import { parseEvaluation } from "../src/lib/evaluation.ts";
import { validateInput } from "../src/lib/inputValidation.ts";
import type { StudioResult } from "../src/lib/studioTypes.ts";
const example = JSON.parse(
  readFileSync(
    new URL("../public/example_input.json", import.meta.url),
    "utf8",
  ),
);
test("demo is deterministic, obeys target prices and never mutates approved facts", () => {
  const data = parseProductData(example);
  const input = selectMarket(data.input, "HK", data.markets);
  input.outputLanguage = "zh-Hant";
  const before = structuredClone(input);
  const spec = simulateDesign(input);
  assert.deepEqual(spec, simulateDesign(input));
  assert.deepEqual(input, before);
  assert.equal(spec.featuredPlanId, "hk-annual");
  assert.equal(spec.layout, "plans-first");
  assert.equal(input.subscriptionPlans[0].price.amountMinor, 7800);
  assert.equal(input.subscriptionPlans[1].price.amountMinor, 58800);
  assert.deepEqual(
    spec.benefitsCopy.map((b) => b.text),
    input.benefits.map((b) => b.description),
  );
  assert.ok(
    auditDesign(input, spec).checks.some((c) => c.status === "needs-review"),
  );
});
test("controlled layouts and trial emphasis reference existing eligible plans", () => {
  const input = parseProductData(example).input;
  input.designGoal = "benefits";
  let spec = simulateDesign(input);
  assert.equal(spec.layout, "benefits-first");
  assert.ok(
    spec.sectionOrder.indexOf("benefits") < spec.sectionOrder.indexOf("plans"),
  );
  input.designGoal = "trial";
  spec = simulateDesign(input);
  assert.ok(input.trialTerms.eligiblePlanIds.includes(spec.featuredPlanId));
});
test("strict output schema rejects invented prices, plans, missing or duplicate sections and benefit IDs", () => {
  const input = parseProductData(example).input,
    spec = simulateDesign(input);
  for (const bad of [
    { ...spec, price: 123 },
    { ...spec, featuredPlanId: "unknown" },
    { ...spec, planOrder: ["new-plan"] },
    { ...spec, sectionOrder: ["headline", "plans"] },
    {
      ...spec,
      benefitsCopy: spec.benefitsCopy.map((b) => ({
        ...b,
        benefitId: "invented",
      })),
    },
    { ...spec, theme: { ...spec.theme, accent: "#FF0000" } },
    { ...spec, theme: { ...spec.theme, script: "danger" } },
  ])
    assert.throws(() => validateDesignSpec(bad, input));
});
test("audit detects brand and readability failures instead of auto-passing", () => {
  const input = parseProductData(example).input,
    spec = simulateDesign(input);
  const changed = {
    ...spec,
    theme: { ...spec.theme, accent: "#FF0000", text: spec.theme.background },
  };
  const report = auditDesign(input, changed);
  for (const id of ["schema", "allowed", "forbidden", "contrast"])
    assert.equal(report.checks.find((c) => c.id === id)?.status, "fail");
});
test("controlled simulation failure preserves source payload and can retry", () => {
  const input = parseProductData(example).input,
    before = structuredClone(input);
  assert.throws(() => simulateDesign(input, true), /可控生成失敗/);
  assert.deepEqual(input, before);
  assert.ok(simulateDesign(input).headline);
});
test("stale tracks changed settings, source and prices while original snapshots remain immutable", () => {
  const input = parseProductData(example).input;
  const source = { kind: "demo" as const, id: "demo" };
  const result: StudioResult = {
    inputSnapshot: structuredClone(input),
    sourceId: "demo",
    spec: simulateDesign(input),
    audit: { checks: [] },
    mode: "demo",
  };
  assert.equal(resultIsStale(result, input, source), false);
  assert.equal(
    resultIsStale(result, { ...input, outputLanguage: "zh-Hant" }, source),
    true,
  );
  assert.equal(resultIsStale(result, input, { ...source, id: "other" }), true);
  assert.equal(resultIsStale(result, input, null), true);
  const changed = structuredClone(input);
  changed.subscriptionPlans[0].price.amountMinor = 1234;
  assert.equal(resultIsStale(result, changed, source), true);
  assert.equal(
    result.inputSnapshot.subscriptionPlans[0].price.amountMinor,
    999,
  );
});
test("business confirmation ignores style but changes on facts and target market", () => {
  const input = parseProductData(example).input;
  assert.equal(
    productFingerprint(input),
    productFingerprint({ ...input, brandStyle: "Modern Tech" }),
  );
  assert.notEqual(
    productFingerprint(input),
    productFingerprint({ ...input, productName: "Changed" }),
  );
  assert.notEqual(
    productFingerprint(input),
    productFingerprint({ ...input, targetMarket: "HK" }),
  );
});
test("image metadata validates MIME, extension, 10 MB cap and empty files", () => {
  const base = { name: "paywall.png", type: "image/png", size: 100 };
  assert.equal(validateImageMetadata(base), null);
  assert.match(validateImageMetadata({ ...base, type: "image/gif" })!, /格式/);
  assert.match(validateImageMetadata({ ...base, name: "image.svg" })!, /格式/);
  assert.match(
    validateImageMetadata({ ...base, size: 10 * 1024 * 1024 + 1 })!,
    /10 MB/,
  );
  assert.match(validateImageMetadata({ ...base, size: 0 })!, /無法讀取/);
});
test("optional original metadata keeps legacy payload valid and rejects malformed image sources", () => {
  const input = parseProductData(example).input;
  assert.deepEqual(validateInput(input), {});
  assert.ok(
    validateInput({
      ...input,
      originalPaywall: { kind: "image", id: "1", width: 0 },
    }).originalPaywall,
  );
});
test("evaluation validates declared provenance, duplicate cases and metric ranges", () => {
  const record = {
    testCaseId: "t1",
    method: "marketmorph",
    results: { requirements: 0.9, facts: 1, brand: 0.8 },
    scores: { humanRating: null },
    timing: { durationMs: null },
    isExample: true,
  };
  assert.equal(parseEvaluation([record]).length, 1);
  assert.throws(() => parseEvaluation([{ ...record, isExample: undefined }]));
  assert.throws(() => parseEvaluation([record, record]));
  assert.throws(() =>
    parseEvaluation([
      { ...record, results: { ...record.results, facts: 1.1 } },
    ]),
  );
  assert.throws(() =>
    parseEvaluation([{ ...record, cost: { currency: "USD", amount: -1 } }]),
  );
});
