import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { strFromU8, unzipSync } from "fflate";
import sharp from "sharp";
import { InputSchema } from "../src/lib/generationSchema.ts";
import { validateInput } from "../src/lib/inputValidation.ts";
import { auditDesign, simulateDesign } from "../src/lib/demoEngine.ts";
import { blankProduct, chooseTargetMarket, compareImport, defaultDesignSettings, generationInput, mergeImport, parseWorkspaceImport, projectDraft } from "../src/lib/productDraft.ts";
import { createDeliverySpec, DeliverySpecSchema, deliveryBlock, deliveryFiles, deliveryZip } from "../src/lib/delivery.ts";
import { checkAccess } from "../src/lib/server/generateHandler.ts";

const legacy = JSON.parse(readFileSync(new URL("../public/example_input.json", import.meta.url), "utf8"));
const modern = readFileSync(new URL("../public/example_product_v2.json", import.meta.url), "utf8");
function importDraft(text: string) {
  return parseWorkspaceImport(text, { name: "plans.json", type: "application/json", size: Buffer.byteLength(text) });
}
function inputFor(draft = importDraft(modern).draft, market = "HK" as "HK" | "US") {
  const target = chooseTargetMarket({ market: "", language: "", languageChosen: false }, market);
  return generationInput(projectDraft(draft, target, defaultDesignSettings), target, "", {
    kind: "image", id: "source", name: "original.png", mime: "image/png", width: 360, height: 780,
    sourceMarket: "Taiwan", sourceLanguage: "Traditional Chinese",
  })!;
}

test("one monthly plan and one annual plan both generate with independently confirmed facts", () => {
  for (const market of ["US", "HK"] as const) {
    const input = inputFor(importDraft(modern).draft, market);
    assert.equal(input.subscriptionPlans.length, 1);
    assert.deepEqual(validateInput(input), {});
    assert.ok(InputSchema.safeParse(input).success);
    const spec = simulateDesign(input);
    assert.deepEqual(spec.planOrder, [input.subscriptionPlans[0].id]);
    assert.ok(auditDesign(input, spec).checks.every((item) => item.status !== "fail"));
  }
  const monthly = inputFor(importDraft(modern).draft, "US");
  assert.match(validateInput({ ...monthly, designGoal: "annual" }).designGoal, /沒有年費方案/);
  assert.match(validateInput({ ...monthly, designGoal: "trial" }).designGoal, /沒有免費試用/);
});

test("same benefits and multiple plans per period are supported, conflicting identities are rejected", () => {
  const input = inputFor();
  const original = input.subscriptionPlans[0];
  input.subscriptionPlans.push({ ...original, id: "plus", productId: "plus", name: "Annual Plus" });
  assert.deepEqual(validateInput(input), {});
  input.subscriptionPlans[1] = { ...original, id: "duplicate" };
  const errors = validateInput(input);
  assert.ok(errors["subscriptionPlans.1.name"]);
  assert.ok(errors["subscriptionPlans.1.productId"]);
  input.subscriptionPlans[0].trial!.renewalDisclosure = "Renews at HKD 99.00 per year.";
  assert.ok(validateInput(input)["subscriptionPlans.0.trial.renewalDisclosure"]);
  input.subscriptionPlans[0].trial!.eligibility = "";
  assert.ok(validateInput(input)["subscriptionPlans.0.trial.eligibility"]);
});

test("legacy USD import preserves HK selection, fills shared facts and cannot pass with missing HK prices", () => {
  const incoming = importDraft(JSON.stringify({ ...legacy.input, unrecognized: "skip" }));
  assert.deepEqual(incoming.unknownFields, ["unrecognized"]);
  const existing = blankProduct();
  existing.facts.productName = "Manual name";
  const target = chooseTargetMarket({ market: "", language: "zh-Hant", languageChosen: true }, "HK");
  assert.equal(chooseTargetMarket(target, "US").language, "zh-Hant");
  assert.ok(compareImport(existing, incoming.draft).some((item) => item.key === "productName" && item.change === "修改／衝突"));
  const filled = mergeImport(existing, incoming.draft, "fill");
  assert.equal(filled.facts.productName, "Manual name");
  assert.equal(filled.offersByMarket.US?.subscriptionPlans[0].price.currency, "USD");
  assert.equal(filled.importedMetadata?.language, "en");
  const input = inputFor(filled);
  assert.equal(input.targetMarket, "HK");
  assert.equal(input.subscriptionPlans[0].price.currency, "HKD");
  assert.ok(Number.isNaN(input.subscriptionPlans[0].price.amountMinor));
  assert.ok(validateInput(input)["subscriptionPlans.0.price.amountMinor"]);
});

test("delivery is versioned, uses the exact plan order and records provenance, audit and mapping", async () => {
  const input = inputFor();
  input.additionalInstructions = "unnecessary private prompt";
  const spec = simulateDesign(input);
  const result = { inputSnapshot: input, sourceId: "source", spec, audit: auditDesign(input, spec), mode: "demo" } as const;
  const payload = createDeliverySpec(result);
  assert.ok(DeliverySpecSchema.safeParse(payload).success);
  assert.deepEqual(payload.plans.map((plan) => plan.id), spec.planOrder);
  assert.equal(payload.plans[0].previewPrice, "HKD 599.00");
  assert.equal(payload.source.market, "Taiwan");
  assert.equal(payload.interactions.mappingComplete, true);
  assert.equal(payload.provenance.mode, "demo");
  assert.equal(payload.provenance.reviewRequired, true);
  assert.match(payload.terms.trial[0], /5 天免費試用/);
  assert.doesNotMatch(JSON.stringify(payload), /unnecessary private prompt/);
  assert.ok(deliveryBlock(result, true));
  const invalid = { ...result, audit: { checks: [{ id: "facts", label: "Price", status: "fail" as const, field: "price", reason: "Mismatch" }] } };
  assert.throws(() => createDeliverySpec(invalid), /未通過/);
  const png = await sharp({ create: { width: 2, height: 3, channels: 4, background: "#cfc2ec" } }).png().toBuffer();
  const zip = unzipSync(deliveryZip(deliveryFiles(result), png));
  assert.deepEqual(Object.keys(zip).sort(), ["INTEGRATION.md", "audit-report.json", "design-spec.json", "preview.png", "react-native/LocalizedPaywall.tsx"]);
  assert.equal((await sharp(zip["preview.png"]).metadata()).height, 3);
  assert.equal(JSON.parse(strFromU8(zip["audit-report.json"])).status, "requires-human-review");
  assert.match(strFromU8(zip["react-native/LocalizedPaywall.tsx"]), /onPurchase\(selectedProduct, chosen.id\)/);
});

test("loopback browser Host can differ from Next's internal URL and cross-origin requests stay blocked", () => {
  const request = (origin: string, token?: string) => new Request("http://localhost:3000/api/generate", {
    headers: { host: "127.0.0.1:3000", origin, ...(token ? { "x-marketmorph-access-token": token } : {}) },
  });
  assert.doesNotThrow(() => checkAccess(request("http://127.0.0.1:3000"), { NODE_ENV: "development" }));
  assert.throws(() => checkAccess(request("https://other.example"), { NODE_ENV: "development" }), { code: "ACCESS_DENIED" });
  const protectedEnv = { NODE_ENV: "production", MARKETMORPH_ACCESS_TOKEN: "test-secret" };
  assert.throws(() => checkAccess(request("http://127.0.0.1:3000"), protectedEnv), { code: "ACCESS_DENIED" });
  assert.doesNotThrow(() => checkAccess(request("http://127.0.0.1:3000", "test-secret"), protectedEnv));
});
