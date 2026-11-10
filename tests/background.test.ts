import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import sharp from "sharp";
import { unzipSync, strFromU8 } from "fflate";
import { BACKGROUND_PATH, defaultBackgroundSettings } from "../src/lib/background.ts";
import type { StudioBackground } from "../src/lib/background.ts";
import { inspectBackgroundBytes } from "../src/lib/backgroundImage.ts";
import { auditDesign, simulateDesign } from "../src/lib/demoEngine.ts";
import { deliveryFiles, deliveryZip } from "../src/lib/delivery.ts";
import { parseProductData } from "../src/lib/workspaceData.ts";

const canvas = () => sharp({ create: { width: 32, height: 40, channels: 4, background: "#d32b64" } });
const buffer = (bytes: Uint8Array) => new Uint8Array(bytes).buffer;

test("checks PNG, JPEG and WebP dimensions before decoding and rejects disguised and oversized images", async () => {
  for (const format of ["png", "jpeg", "webp"] as const) {
    const encoded = await canvas().toFormat(format).toBuffer();
    assert.deepEqual(inspectBackgroundBytes(buffer(encoded)), { width: 32, height: 40, mime: "image/" + format });
  }
  const oversized = await canvas().png().toBuffer();
  oversized.writeUInt32BE(6000, 16);
  oversized.writeUInt32BE(6000, 20);
  assert.throws(() => inspectBackgroundBytes(buffer(oversized)), /2000 萬/);
  assert.throws(() => inspectBackgroundBytes(buffer(Buffer.from("<svg/>"))), /格式不支援/);
  const animated = Buffer.alloc(30);
  animated.write("RIFF");
  animated.writeUInt32LE(22, 4);
  animated.write("WEBPVP8X", 8);
  animated.writeUInt32LE(10, 16);
  animated[20] = 2;
  assert.throws(() => inspectBackgroundBytes(buffer(animated)), /靜態/);
});

test("uploads affect the delivery reference and audit without changing model or approved facts", async () => {
  const sample = JSON.parse(readFileSync(new URL("../public/example_input.json", import.meta.url), "utf8"));
  const input = parseProductData(sample).input;
  input.originalPaywall = { kind: "demo", id: "original" };
  const spec = simulateDesign(input);
  const result = { mode: "demo", sourceId: "original", inputSnapshot: input, spec, audit: auditDesign(input, spec) } as const;
  const image = new Uint8Array(await canvas().png().toBuffer());
  const asset: StudioBackground = {
    image: new Blob([image], { type: "image/png" }), url: "blob:test-background", originalWidth: 32, originalHeight: 40,
    config: {
      ...defaultBackgroundSettings, type: "uploaded", originalName: "brand.webp", assetPath: BACKGROUND_PATH, fit: "cover",
      assetId: "cad72321-f0ce-46ba-ac2a-1b54cbfd9d4b", mimeType: "image/png", width: 32, height: 40,
    },
  };
  const files = deliveryFiles(result, asset);
  assert.throws(() => deliveryZip(files, image), /缺少有效的背景圖片/);
  const contents = unzipSync(deliveryZip(files, image, image));
  const delivered = JSON.parse(strFromU8(contents["design-spec.json"]));
  assert.deepEqual(contents[delivered.background.assetPath], image);
  assert.deepEqual(delivered.design, spec);
  assert.deepEqual(delivered.plans.map(({ price }: { price: unknown }) => price), input.subscriptionPlans.map(({ price }) => price).reverse());
  assert.doesNotMatch(files["design-spec.json"], /blob:|base64/);
  assert.match(files["audit-report.json"], /背景圖片及文字可讀性/);
});
