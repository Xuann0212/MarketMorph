import { mkdir, readFile, writeFile } from "node:fs/promises";
import { strFromU8, unzipSync } from "fflate";
import { DeliverySpecSchema, deliveryFiles } from "../src/lib/delivery.ts";
import { auditDesign, simulateDesign } from "../src/lib/demoEngine.ts";
import { nativeTemplate } from "../src/lib/exportTemplate.ts";
import { parseProductData, selectMarket } from "../src/lib/workspaceData.ts";

const destination = new URL("../examples/react-native-paywall/generated/", import.meta.url);
const zipPath = process.argv[2];
let design: string;
let component: string;
if (zipPath) {
  const entries = unzipSync(new Uint8Array(await readFile(zipPath)), {
    filter: ({ name }) => ["design-spec.json", "react-native/LocalizedPaywall.tsx"].includes(name),
  });
  if (!entries["design-spec.json"] || !entries["react-native/LocalizedPaywall.tsx"]) throw new Error("The export is missing required files.");
  design = strFromU8(entries["design-spec.json"]);
  DeliverySpecSchema.parse(JSON.parse(design));
  component = strFromU8(entries["react-native/LocalizedPaywall.tsx"]);
  if (component !== nativeTemplate) throw new Error("The component does not match this repository's controlled template.");
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
await Promise.all([
  writeFile(new URL("design-spec.json", destination), design),
  writeFile(new URL("LocalizedPaywall.tsx", destination), component),
]);
console.log(zipPath ? "Loaded exported design and verified the native template." : "Generated labeled demo fixture using the delivery pipeline.");
