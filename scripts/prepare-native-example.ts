import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { strFromU8, unzipSync } from "fflate";
import { DeliverySpecSchema, deliveryFiles } from "../src/lib/delivery.ts";
import { auditDesign, simulateDesign } from "../src/lib/demoEngine.ts";
import { nativeTemplate } from "../src/lib/exportTemplate.ts";
import { parseProductData, selectMarket } from "../src/lib/workspaceData.ts";
import { BACKGROUND_LIMIT, BACKGROUND_PATH } from "../src/lib/background.ts";
import { inspectBackgroundBytes } from "../src/lib/backgroundImage.ts";
import sharp from "sharp";

const outputDirectory = process.argv[3];
const destination = outputDirectory ? pathToFileURL(resolve(outputDirectory) + sep)
  : new URL("../examples/react-native-paywall/generated/", import.meta.url);
const zipPath = process.argv[2];
let design: string;
let component: string;
let background: Uint8Array | undefined;
if (zipPath) {
  const entries = unzipSync(new Uint8Array(await readFile(zipPath)), {
    filter: ({ name, originalSize }) => ["design-spec.json", "react-native/LocalizedPaywall.tsx"].includes(name) ||
      (name === BACKGROUND_PATH && originalSize <= BACKGROUND_LIMIT),
  });
  if (!entries["design-spec.json"] || !entries["react-native/LocalizedPaywall.tsx"]) throw new Error("The export is missing required files.");
  design = strFromU8(entries["design-spec.json"]);
  const spec = DeliverySpecSchema.parse(JSON.parse(design));
  component = strFromU8(entries["react-native/LocalizedPaywall.tsx"]);
  if (component !== nativeTemplate(spec.design.backgroundPattern, Boolean(spec.background))) throw new Error("The component does not match this repository's controlled template.");
  if (spec.background) {
    background = entries[BACKGROUND_PATH];
    if (!background) throw new Error("交付包缺少背景圖片。");
    const image = inspectBackgroundBytes(new Uint8Array(background).buffer);
    if (image.mime !== "image/png" || image.width !== spec.background.width || image.height !== spec.background.height) {
      throw new Error("背景圖片與設計規格不符。");
    }
    await sharp(background, { limitInputPixels: 2400 ** 2, failOn: "error" }).stats();
  }
} else {
  const source = JSON.parse(await readFile(new URL("../public/example_input.json", import.meta.url), "utf8"));
  const data = parseProductData(source);
  const input = selectMarket(data.input, "HK", data.markets);
  input.outputLanguage = "zh-Hant";
  input.originalPaywall = { kind: "demo", id: "expo-fixture", name: "LearnLoop AI", sourceMarket: "US", sourceLanguage: "en" };
  input.subscriptionPlans = input.subscriptionPlans.map((plan) => ({ ...plan, productId: "sandbox.learnloop." + plan.id }));
  const spec = simulateDesign(input);
  const files = deliveryFiles({ inputSnapshot: input, sourceId: "expo-fixture", spec, audit: auditDesign(input, spec), mode: "demo" });
  design = files["design-spec.json"];
  component = files["react-native/LocalizedPaywall.tsx"];
}
await mkdir(destination, { recursive: true });
if (background) {
  await mkdir(new URL("assets/", destination), { recursive: true });
  await writeFile(new URL("assets/background.png", destination), background);
}
await Promise.all([
  writeFile(new URL("design-spec.json", destination), design),
  writeFile(new URL("LocalizedPaywall.tsx", destination), component),
]);
console.log(zipPath ? "Loaded exported design and verified the native template." : "Generated labeled demo fixture using the delivery pipeline.");
