import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import React, { act } from "react";
import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";

// DOM-level integration tests, not browser/visual QA. Image decoding and native dialog
// behaviour are stubbed explicitly; production uses real browser Image and <dialog>.
const dom = new JSDOM(
  "<!doctype html><html><body><div id='root'></div></body></html>",
  { url: "http://localhost:3000" },
);
for (const key of [
  "window",
  "document",
  "HTMLElement",
  "HTMLInputElement",
  "HTMLTextAreaElement",
  "HTMLSelectElement",
  "HTMLDialogElement",
  "Event",
  "MouseEvent",
  "File",
] as const)
  Object.defineProperty(globalThis, key, {
    value: dom.window[key],
    configurable: true,
    writable: true,
  });
Object.defineProperty(globalThis, "navigator", {
  value: dom.window.navigator,
  configurable: true,
});
Object.assign(globalThis, {
  IS_REACT_ACT_ENVIRONMENT: true,
  requestAnimationFrame: (fn: FrameRequestCallback) =>
    setTimeout(() => fn(0), 0),
});
Object.defineProperty(globalThis, "self", {
  value: dom.window,
  configurable: true,
});
Object.defineProperty(dom.window.HTMLDialogElement.prototype, "showModal", {
  value: function () {
    this.open = true;
  },
});
Object.defineProperty(dom.window.HTMLDialogElement.prototype, "close", {
  value: function () {
    this.open = false;
  },
});
let blobIndex = 0;
const revoked: string[] = [];
URL.createObjectURL = () => `blob:test-${++blobIndex}`;
URL.revokeObjectURL = (url) => revoked.push(url);
class DecodedImage {
  naturalWidth = 300;
  naturalHeight = 650;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  set src(_url: string) {
    queueMicrotask(() => this.onload?.());
  }
}
Object.defineProperty(globalThis, "Image", {
  value: DecodedImage,
  configurable: true,
  writable: true,
});
const { createRoot } = await import("react-dom/client");
const { default: StudioProvider } =
  await import("../src/components/StudioProvider.tsx");
const { default: DesignSetup } =
  await import("../src/components/DesignSetup.tsx");
const { default: Landing } = await import("../src/components/Landing.tsx");
const { default: Evaluation } =
  await import("../src/components/Evaluation.tsx");
const { AppRouterContext } =
  await import("next/dist/shared/lib/app-router-context.shared-runtime.js");
let root: ReturnType<typeof createRoot>;
let mounted = false;
afterEach(async () => {
  if (mounted) await unmount();
});
const container = document.getElementById("root")!;
function text() {
  return container.textContent ?? "";
}
function button(label: string) {
  const b = [...container.querySelectorAll("button")].find(
    (b) => b.textContent?.trim() === label,
  );
  assert.ok(b, `Missing button: ${label}`);
  return b;
}
async function click(label: string) {
  await act(async () => {
    button(label).click();
  });
}
async function fill(id: string, value: string) {
  const el = document.getElementById(id) as
    HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
  assert.ok(el, id);
  await act(async () => {
    const proto =
      el.tagName === "TEXTAREA"
        ? dom.window.HTMLTextAreaElement.prototype
        : el.tagName === "SELECT"
          ? dom.window.HTMLSelectElement.prototype
          : dom.window.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, value);
    el.dispatchEvent(
      new dom.window.Event(el.tagName === "SELECT" ? "change" : "input", {
        bubbles: true,
      }),
    );
  });
}
async function mount(child: React.ReactNode, demo = true) {
  root = createRoot(container);
  mounted = true;
  await act(async () => {
    root.render(<StudioProvider>{child}</StudioProvider>);
  });
  if (demo && document.getElementById("generationMode"))
    await fill("generationMode", "demo");
}
async function unmount() {
  await act(async () => root.unmount());
  mounted = false;
}
async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 35));
  });
}
async function file(id: string, file: File) {
  const input = document.getElementById(id) as HTMLInputElement;
  assert.ok(input);
  await act(async () => {
    Object.defineProperty(input, "files", {
      value: [file],
      configurable: true,
    });
    input.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
  });
  await settle();
}
function jsonFile(value: unknown) {
  const string = typeof value === "string" ? value : JSON.stringify(value);
  const f = new dom.window.File([string], "product.json", {
    type: "application/json",
  });
  Object.defineProperty(f, "text", { value: async () => string });
  return f;
}
const example = JSON.parse(
  readFileSync(
    new URL("../public/example_input.json", import.meta.url),
    "utf8",
  ),
);

test("DOM A/E/F/G: demo, confirmation, independent language, localized comparison and stale", async () => {
  await mount(<DesignSetup />);
  await click("生成本地化設計");
  assert.match(text(), /請先提供原始頁面/);
  await click("使用示例訂閱頁面LearnLoop AI");
  assert.match(text(), /LearnLoop AI/);
  assert.equal((document.getElementById("targetMarket") as HTMLSelectElement).value, "");
  await fill("targetMarket", "US");
  await fill("outputLanguage", "en");
  await click("確認產品資料");
  assert.match(text(), /已確認/);
  await fill("targetMarket", "HK");
  assert.match(text(), /HKD 78.00/);
  assert.match(text(), /HKD 588.00/);
  assert.equal(
    (document.getElementById("outputLanguage") as HTMLSelectElement).value,
    "en",
  );
  await fill("outputLanguage", "zh-Hant");
  await click("確認產品資料");
  await click("生成本地化設計");
  await settle();
  assert.ok(
    container.querySelector('[aria-label="本地化訂閱頁面內容"]'),
  );
  assert.match(
    container.querySelector(".generated-side")!.textContent!,
    /HKD 588.00/,
  );
  assert.match(
    container.querySelector(".original-side")!.textContent!,
    /原始版本・美國/,
  );
  await fill("designGoal", "benefits");
  assert.match(text(), /設計要求已更新/);
  assert.equal(container.querySelector(".workspace-header .initial-state-badge"), null);
  assert.match(container.querySelector(".generated-side")!.textContent!, /本地化版本・香港/);
  const summary = container.querySelector(".result-summary")!.textContent!;
  for (const title of ["版面結構", "視覺風格", "重點方案", "文案調整"]) {
    assert.ok(summary.includes(title));
  }
  assert.doesNotMatch(summary, /layout|theme|featuredPlanId|Demo Simulation/);
  assert.ok(button("匯出設計 →").disabled);
  await click("生成本地化設計");
  await settle();
  assert.ok(!container.querySelector(".stale-banner"));
  assert.ok(!container.querySelector(".error-banner"));
  await click("查看檢查結果 →");
  assert.ok(container.querySelector(".interactive-review"));
  assert.match(text(), /需要人工確認/);
  assert.match(text(), /未執行該項檢查/);
  await click("重新執行檢查");
  await settle();
  await unmount();
});
test("DOM D: drafts survive close, invalid price/trial block save; confirmation invalidates", async () => {
  await mount(<DesignSetup />);
  await click("使用示例訂閱頁面LearnLoop AI");
  await fill("targetMarket", "US");
  await click("確認產品資料");
  await click("手動填寫");
  await fill("subscriptionPlans.0.price.amountMinor", "-2");
  await fill("trialTerms.eligibility", "");
  await click("儲存產品資料");
  assert.ok(
    document.getElementById("subscriptionPlans.0.price.amountMinor-error"),
  );
  assert.ok(document.getElementById("trialTerms.eligibility-error"));
  const close = container.querySelector(
    '[aria-label="關閉產品資料編輯器"]',
  ) as HTMLButtonElement;
  await act(async () => close.click());
  await click("手動填寫");
  assert.equal(
    (
      document.getElementById(
        "subscriptionPlans.0.price.amountMinor",
      ) as HTMLInputElement
    ).value,
    "-2",
  );
  await fill("subscriptionPlans.0.price.amountMinor", "12.34");
  await fill("trialTerms.renewalDisclosure", "Annual renewal USD 79.99. Monthly plan USD 12.34.");
  await fill("trialTerms.eligibility", "Approved new users only.");
  await click("儲存產品資料");
  assert.match(text(), /USD 12.34/);
  assert.match(text(), /資料已更新，請重新確認/);
  await click("確認產品資料");
  assert.match(text(), /已確認/);
  await click("檢視完整輸入資料");
  const json = JSON.parse(
    container.querySelector('[aria-label="Reviewed InputPayload JSON"]')!
      .textContent!,
  );
  assert.equal(json.input.subscriptionPlans[0].price.amountMinor, 1234);
  assert.equal(json.input.trialTerms.eligibility, "Approved new users only.");
  await unmount();
});
test("DOM JSON: invalid import preserves product; valid import needs explicit confirmation", async () => {
  await mount(<DesignSetup />);
  await click("使用示例訂閱頁面LearnLoop AI");
  await file("main-product-import", jsonFile("{invalid"));
  assert.match(text(), /JSON 解析/);
  assert.match(text(), /LearnLoop AI/);
  const data = structuredClone(example);
  data.input.productName = "Imported Product";
  await file("main-product-import", jsonFile(data));
  assert.ok(
    !container
      .querySelector(".product-identity")!
      .textContent!.includes("Imported Product"),
  );
  await click("以匯入資料取代目前資料");
  assert.equal((document.getElementById("productName") as HTMLInputElement).value, "Imported Product");
  assert.match(
    container.querySelector(".product-identity")!.textContent!,
    /Imported Product/,
  );
  assert.match(text(), /已匯入資料，請核對並確認/);
  await unmount();
});
test("DOM B/C: image reference persists on invalid replacement, requirements survive; decode failure is explicit", async () => {
  await mount(<DesignSetup />);
  const upload = container.querySelector(
    ".source-area input[type=file]",
  ) as HTMLInputElement;
  const valid = new dom.window.File(["mock image bytes"], "my-paywall.png", {
    type: "image/png",
  });
  await file(upload.id, valid);
  const image = container.querySelector(
    ".uploaded-original img",
  ) as HTMLImageElement;
  assert.ok(image);
  assert.match(image.src, /blob:test-/);
  const src = image.src;
  assert.equal((document.getElementById("targetMarket") as HTMLSelectElement).value, "");
  assert.match(text(), /my-paywall\.png/);
  assert.ok(
    !container
      .querySelector(".product-identity")!
      .textContent!.includes("LearnLoop AI"),
  );
  await fill("additionalInstructions", "Keep my custom requirements");
  await file(
    upload.id,
    new dom.window.File(["bad"], "bad.gif", { type: "image/gif" }),
  );
  assert.match(text(), /格式不支援/);
  assert.equal(
    (container.querySelector(".uploaded-original img") as HTMLImageElement).src,
    src,
  );
  assert.equal(
    (document.getElementById("additionalInstructions") as HTMLTextAreaElement)
      .value,
    "Keep my custom requirements",
  );
  const large = new dom.window.File(
    [new Uint8Array(10 * 1024 * 1024 + 1)],
    "large.png",
    { type: "image/png" },
  );
  await file(upload.id, large);
  assert.match(text(), /圖片過大/);
  Object.defineProperty(globalThis, "Image", {
    value: class extends DecodedImage {
      set src(_url: string) {
        queueMicrotask(() => this.onerror?.());
      }
    },
    configurable: true,
  });
  await file(upload.id, valid);
  assert.match(text(), /無法讀取圖片/);
  assert.equal(
    (container.querySelector(".uploaded-original img") as HTMLImageElement).src,
    src,
  );
  Object.defineProperty(globalThis, "Image", {
    value: DecodedImage,
    configurable: true,
  });
  const custom = structuredClone(example.input);
  custom.productName = "My Screenshot Product";
  custom.trialTerms.eligibility = "Approved screenshot users only.";
  custom.benefits = [
    { id: "own-benefit", description: "My approved screenshot benefit" },
  ];
  await file("main-product-import", jsonFile(custom));
  await fill("targetMarket", "US");
  await click("以匯入資料取代目前資料");
  await click("儲存產品資料");
  await click("確認產品資料");
  await click("生成本地化設計");
  await settle();
  assert.match(
    container.querySelector(".generated-side")!.textContent!,
    /My Screenshot Product/,
  );
  assert.ok(
    !container
      .querySelector(".generated-side")!
      .textContent!.includes("LearnLoop"),
  );
  assert.equal(
    (container.querySelector(".uploaded-original img") as HTMLImageElement).src,
    src,
  );
  const remove = container.querySelector(
    '[aria-label="移除原始頁面"]',
  ) as HTMLButtonElement;
  await act(async () => remove.click());
  assert.ok(!container.querySelector(".uploaded-original img"));
  assert.match(text(), /設計要求已更新/);
  assert.match(text(), /My Screenshot Product/);
  await unmount();
  assert.ok(revoked.includes(src));
});
test("DOM landing: source gate, free text and navigation handoff preserve shared state", async () => {
  const routes: string[] = [];
  const router = {
    push: (url: string) => routes.push(url),
    replace() {},
    refresh() {},
    back() {},
    forward() {},
    prefetch: async () => {},
  };
  await mount(
    <AppRouterContext.Provider value={router as never}>
      <Landing />
    </AppRouterContext.Provider>,
  );
  await click("前往設計工作台");
  assert.match(text(), /請先上傳原始訂閱頁面/);
  assert.equal(routes.length, 0);
  const prompt = "請突出年費方案，使用簡潔的紫色風格";
  await fill("hero-instructions", prompt);
  await click("使用示例訂閱頁面LearnLoop AI");
  await click("前往設計工作台");
  assert.equal(routes[0], "/studio");
  assert.equal(
    (document.getElementById("hero-instructions") as HTMLTextAreaElement).value,
    prompt,
  );
  await unmount();
});
test("DOM evaluation starts empty, never invents experiment numbers", async () => {
  await mount(<Evaluation />);
  assert.match(text(), /尚未載入評估數據/);
  assert.ok(!container.querySelector("table"));
  await unmount();
});

test("DOM navigation preserves confirmed result/reference; advanced settings and comparison tabs retain values", async () => {
  await mount(<DesignSetup />);
  await click("使用示例訂閱頁面LearnLoop AI");
  await fill("targetMarket", "HK");
  await click("確認產品資料");
  await click("生成本地化設計");
  await settle();
  await act(async () =>
    root.render(
      <StudioProvider>
        <Evaluation />
      </StudioProvider>,
    ),
  );
  await act(async () =>
    root.render(
      <StudioProvider>
        <DesignSetup />
      </StudioProvider>,
    ),
  );
  assert.ok(
    container.querySelector('[aria-label="本地化訂閱頁面內容"]'),
  );
  assert.match(
    container.querySelector(".original-side")!.textContent!,
    /原始版本・美國/,
  );
  assert.match(
    container.querySelector(".generated-side")!.textContent!,
    /HKD 588.00/,
  );
  assert.match(
    container.querySelector(".confirmation-row")!.textContent!,
    /已確認/,
  );
  const summary = container.querySelector(".advanced summary") as HTMLElement;
  await act(async () => summary.click());
  await fill("brandColors.forbidden", "#FF0000, #FF00FF");
  await act(async () => summary.click());
  await act(async () => summary.click());
  assert.equal(
    (document.getElementById("brandColors.forbidden") as HTMLInputElement)
      .value,
    "#FF0000, #FF00FF",
  );
  const localized = container.querySelector(
    ".mobile-preview-tabs button:last-child",
  ) as HTMLButtonElement;
  await act(async () => localized.click());
  assert.equal(localized.getAttribute("aria-selected"), "true");
  assert.ok(container.querySelector(".initial-comparison.show-generated"));
  await unmount();
});

test("DOM live UI uses local API only, never falls back after error, then renders verified result and marks stale", async () => {
  const { createGenerateHandler } =
    await import("../src/lib/server/generateHandler.ts");
  const { simulateDesign } = await import("../src/lib/demoEngine.ts");
  let configured = false,
    requests = 0,
    providerCalls = 0;
  const handler = createGenerateHandler({
    env: () => ({
      DEEPSEEK_API_KEY: configured ? "mock-only" : undefined,
      NODE_ENV: "test",
    }),
    rateLimit: () => true,
    logger: () => {},
    fetcher: async (_url, init) => {
      providerCalls++;
      const prompt = JSON.parse(String(init?.body)).messages[1].content[0].text;
      const raw = prompt.slice(
        prompt.indexOf("\n") + 1,
        prompt.lastIndexOf("\n"),
      );
      const input = JSON.parse(raw);
      assert.equal(input.outputLanguage, "zh-Hant");
      assert.equal(input.subscriptionPlans[1].price.amountMinor, 8250);
      assert.equal(input.additionalInstructions, providerCalls === 1 ? "請突出年費方案，使用簡潔的紫色風格" : "Update visual hierarchy");
      assert.equal(input.originalPaywall.sourceLanguage, "en");
      return Response.json({
        choices: [
          {
            message: {
              content: JSON.stringify({
                design: simulateDesign(input),
                visualAnalysis: {
                  status: "limited",
                  summary: "Mock fixture: image text too small.",
                },
              }),
            },
          },
        ],
        usage: { prompt_tokens: 304, completion_tokens: 120 },
      });
    },
  });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    requests++;
    assert.equal(url, "/api/generate");
    return handler(new Request("http://localhost:3000/api/generate", init));
  };
  async function until(match: () => boolean) {
    for (let i = 0; i < 30 && !match(); i++) await settle();
    assert.ok(match(), "async UI did not reach expected state");
  }
  try {
    const prompt = "請突出年費方案，使用簡潔的紫色風格";
    const router = { push() {}, prefetch: async () => {} };
    await mount(<AppRouterContext.Provider value={router as never}><Landing /></AppRouterContext.Provider>, false);
    await fill("hero-instructions", prompt);
    await click("使用示例訂閱頁面LearnLoop AI");
    await click("前往設計工作台");
    await act(async () => root.render(<StudioProvider><DesignSetup /></StudioProvider>));
    assert.equal((document.getElementById("additionalInstructions") as HTMLTextAreaElement).value, prompt);
    assert.equal(requests, 0);
    await fill("targetMarket", "US");
    await fill("outputLanguage", "zh-Hant");
    await click("手動填寫");
    await fill("subscriptionPlans.1.price.amountMinor", "82.50");
    await fill("trialTerms.renewalDisclosure", "Annual renewal USD 82.50. Monthly plan USD 9.99.");
    await click("儲存產品資料");
    await click("確認產品資料");
    await click("生成本地化設計");
    await until(() => text().includes("尚未設定服務端 DeepSeek 密鑰"));
    assert.equal(providerCalls, 0);
    assert.ok(
      !container.querySelector('[aria-label="本地化訂閱頁面內容"]'),
    );
    assert.ok(!text().includes("本地化設計已生成"));
    assert.ok(container.querySelector('img[src="/demo-paywall.png"]'));
    configured = true;
    await click("重試生成");
    await until(() => text().includes("本地化設計已生成"));
    assert.equal(requests, 2);
    assert.equal(providerCalls, 1);
    assert.match(text(), /原圖部分內容未能清楚辨識/);
    assert.match(
      container.querySelector(".generated-side")!.textContent!,
      /USD 82.50/,
    );
    await click("查看檢查結果 →");
    assert.match(text(), /輸入 304／輸出 120/);
    assert.match(text(), /需.*人工確認/);
    await click("返回頁面對比");
    await fill("additionalInstructions", "Update visual hierarchy");
    assert.match(text(), /設計要求已更新/);
    await click("生成本地化設計");
    await until(
      () =>
        !container.querySelector('.stale-banner[role="status"]') ||
        text().includes("本地化設計已生成"),
    );
    assert.equal(requests, 3);
    assert.equal(providerCalls, 2);
    await unmount();
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("DOM HK target keeps USD import separate and shows the current draft after editing", async () => {
  await mount(<DesignSetup />);
  await fill("targetMarket", "HK");
  const incoming = { ...example.input, productName: "English imported facts" };
  await file("main-product-import", jsonFile(incoming));
  assert.match(text(), /匯入資料屬於美國，目前目標是香港/);
  assert.match(text(), /productName · 新增/);
  await click("只填入空白欄位");
  assert.equal((document.getElementById("targetMarket") as HTMLSelectElement).value, "HK");
  assert.equal((document.getElementById("productName") as HTMLInputElement).value, "English imported facts");
  assert.equal((document.getElementById("subscriptionPlans.0.price.currency") as HTMLInputElement).value, "HKD");
  assert.equal((document.getElementById("subscriptionPlans.0.price.amountMinor") as HTMLInputElement).value, "");
  await fill("subscriptionPlans.0.name", "HK Monthly");
  await fill("subscriptionPlans.0.price.amountMinor", "66.00");
  await click("儲存產品資料");
  await click("檢視完整輸入資料");
  const info = JSON.parse(container.querySelector('[aria-label="Reviewed InputPayload JSON"]')!.textContent!);
  assert.equal(info.input.subscriptionPlans[0].price.amountMinor, 6600);
  assert.equal(info.product.offersByMarket.US.subscriptionPlans[0].price.currency, "USD");
  assert.equal(info.product.importedMetadata.language, "en");
  assert.equal(info.input.outputLanguage, "zh-Hant");
});

test("DOM add and remove plans independently, preserving the other plan price and trial", async () => {
  await mount(<DesignSetup />);
  await click("使用示例訂閱頁面LearnLoop AI");
  await fill("targetMarket", "HK");
  await click("手動填寫");
  await click("＋ 新增訂閱方案");
  await fill("subscriptionPlans.2.name", "Plus");
  await fill("subscriptionPlans.2.price.amountMinor", "108.00");
  const remove = [...container.querySelectorAll("button")].filter((item) => item.textContent === "移除方案");
  await act(async () => remove[0].click());
  await act(async () => {
    const removePlus = [...container.querySelectorAll("button")].filter((item) => item.textContent === "移除方案");
    removePlus[1].click();
  });
  assert.equal((document.getElementById("subscriptionPlans.0.price.amountMinor") as HTMLInputElement).value, "588.00");
  assert.equal(button("移除方案").disabled, true);
  await fill("trialTerms.renewalDisclosure", "年費方案以 HKD 588.00 續訂。");
  await click("儲存產品資料");
  await click("確認產品資料");
  await click("生成本地化設計");
  await settle();
  assert.equal(container.querySelectorAll(".generated-side .confirmed-plan").length, 1);
  assert.match(container.querySelector(".generated-side")!.textContent!, /HKD 588.00/);
  assert.match(container.querySelector(".generated-side")!.textContent!, /3 天免費試用/);
});
