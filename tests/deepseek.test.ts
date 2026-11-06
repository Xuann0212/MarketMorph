import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import sharp from "sharp";
import {
  createGenerateHandler,
  createRateLimiter,
} from "../src/lib/server/generateHandler.ts";
import {
  DEEPSEEK_MODEL,
  DEEPSEEK_URL,
  callDeepSeek,
} from "../src/lib/server/deepseek.ts";
import { prepareModelImage } from "../src/lib/server/modelImage.ts";
import { MAX_REQUEST_BYTES } from "../src/lib/generationSchema.ts";
import { parseProductData, selectMarket } from "../src/lib/workspaceData.ts";
import { productFingerprint } from "../src/lib/studioTypes.ts";
import { simulateDesign } from "../src/lib/demoEngine.ts";
import type { InputPayload } from "../src/lib/designSchema.ts";

const example = JSON.parse(
  readFileSync(
    new URL("../public/example_input.json", import.meta.url),
    "utf8",
  ),
);
const demoImage = await prepareModelImage({ kind: "demo", id: "fixture-demo" });
const key = "mock-key-not-a-real-credential";
const env = () => ({ DEEPSEEK_API_KEY: key, NODE_ENV: "test" });
const output = (
  input: InputPayload,
  visual: "understood" | "limited" = "understood",
) => ({
  design: simulateDesign(input),
  visualAnalysis: {
    status: visual,
    summary: "Synthetic test observation, not real model output.",
  },
});
const provider = (
  content: string | null,
  usage?: { prompt_tokens: number; completion_tokens: number },
) =>
  Response.json({
    id: "mock-upstream-id",
    usage,
    choices: [{ finish_reason: "stop", message: { content } }],
  });
function payload(
  market: "US" | "HK" = "US",
  language: InputPayload["outputLanguage"] = "en",
) {
  const data = parseProductData(example),
    input = selectMarket(data.input, market, data.markets);
  input.outputLanguage = language;
  const source = { kind: "demo" as const, id: "fixture-demo" };
  input.originalPaywall = source;
  return {
    input,
    source,
    confirmation: { confirmed: true, fingerprint: productFingerprint(input) },
  };
}
function request(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost:3000/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}
function handler(
  fetcher: typeof fetch,
  settings: Parameters<typeof createGenerateHandler>[0] = {},
) {
  return createGenerateHandler({ env, fetcher, logger: () => {}, ...settings });
}

test("mock official connection: sends original inline image, strict JSON and facts across market/language combinations", async () => {
  for (const [market, language] of [
    ["US", "en"],
    ["HK", "zh-Hant"],
    ["HK", "en"],
    ["US", "zh-Hans"],
  ] as const) {
    const p = payload(market, language),
      logs: Record<string, unknown>[] = [];
    const handle = handler(
      async (url, init) => {
        assert.equal(url, DEEPSEEK_URL);
        const body = JSON.parse(String(init?.body));
        assert.equal(body.model, DEEPSEEK_MODEL);
        assert.equal(body.response_format.type, "json_object");
        assert.equal(body.messages[1].content[1].image_url.detail, "original");
        assert.match(
          body.messages[1].content[1].image_url.url,
          /^data:image\/(png|webp);base64,/,
        );
        assert.match(body.messages[0].content, /Full JSON example/);
        assert.match(
          body.messages[1].content[0].text,
          new RegExp(`"targetMarket":"${market}"`),
        );
        return provider(JSON.stringify(output(p.input)), {
          prompt_tokens: 823,
          completion_tokens: 211,
        });
      },
      { logger: (record) => logs.push(record) },
    );
    const res = await handle(request(p)),
      body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.mode, "live");
    assert.deepEqual(
      body.inputSnapshot.subscriptionPlans,
      p.input.subscriptionPlans,
    );
    assert.deepEqual(body.inputSnapshot.trialTerms, p.input.trialTerms);
    assert.deepEqual(body.inputSnapshot.benefits, p.input.benefits);
    assert.equal(body.inputSnapshot.outputLanguage, language);
    assert.equal(body.meta.calls[0].inputTokens, 823);
    assert.equal(body.meta.calls[0].outputTokens, 211);
    assert.equal(body.meta.image.width, 900);
    assert.equal(body.meta.image.height, 1880);
    assert.ok(
      body.audit.checks.some(
        (c: { id: string; status: string }) =>
          c.id === "model-copy" && c.status === "needs-review",
      ),
    );
    assert.ok(!JSON.stringify(logs).includes(key));
    assert.ok(!JSON.stringify(logs).includes("base64"));
    assert.ok(!JSON.stringify(logs).includes(p.input.productName));
  }
});
test("user PNG, JPEG and WebP are actually decoded before mock provider; limited vision stays explicit", async () => {
  for (const format of ["png", "jpeg", "webp"] as const) {
    const file = await sharp({
      create: { width: 540, height: 940, channels: 3, background: "#ebe8ff" },
    })
      .toFormat(format)
      .toBuffer();
    const mime = `image/${format}`,
      p = payload();
    p.input.originalPaywall = {
      kind: "image",
      id: "custom-image",
      name: `test.${format}`,
      mime,
      width: 540,
      height: 940,
    };
    const result = await handler(async (_url, init) => {
      const data = JSON.parse(String(init?.body)).messages[1].content[1]
        .image_url.url;
      const meta = await sharp(
        Buffer.from(data.split(",")[1], "base64"),
      ).metadata();
      assert.equal(meta.width, 540);
      assert.equal(meta.height, 940);
      return provider(JSON.stringify(output(p.input, "limited")));
    })(
      request({
        ...p,
        source: {
          kind: "image",
          id: "custom-image",
          dataUrl: `data:${mime};base64,${file.toString("base64")}`,
        },
      }),
    );
    assert.equal(result.status, 200);
    const body = await result.json();
    assert.equal(body.meta.visualAnalysis.status, "limited");
    assert.equal(body.meta.calls[0].inputTokens, null);
    assert.equal(body.meta.calls[0].outputTokens, null);
    assert.ok(
      body.audit.checks
        .find((c: { id: string }) => c.id === "vision")
        .reason.includes("受限"),
    );
  }
});
test("missing API key, unconfirmed or modified facts, and invalid images stop before provider", async () => {
  let calls = 0;
  const fn: typeof fetch = async () => {
    calls++;
    throw new Error("must not call provider");
  };
  const p = payload();
  for (const [handle, body, expected] of [
    [handler(fn, { env: () => ({ NODE_ENV: "test" }) }), p, "CONFIG_MISSING"],
    [
      handler(fn),
      { ...p, confirmation: { confirmed: true, fingerprint: "changed" } },
      "CONFIRMATION_REQUIRED",
    ],
    [
      handler(fn),
      { ...p, source: { kind: "demo", id: "other" } },
      "IMAGE_INVALID",
    ],
    [
      handler(fn),
      {
        ...p,
        input: {
          ...p.input,
          originalPaywall: {
            kind: "image",
            id: "x",
            mime: "image/png",
            name: "broken.png",
            width: 20,
            height: 20,
          },
        },
        source: {
          kind: "image",
          id: "x",
          dataUrl: "data:image/png;base64,AAAA",
        },
      },
      "IMAGE_INVALID",
    ],
  ] as const) {
    const res = await handle(request(body));
    assert.equal((await res.json()).error.code, expected);
  }
  assert.equal(calls, 0);
});
test("actual image format and dimensional bounds are checked; cannot fetch arbitrary image URLs", async () => {
  const png = await sharp({
    create: { width: 20, height: 20, channels: 3, background: "#fff" },
  })
    .png()
    .toBuffer();
  await assert.rejects(
    () =>
      prepareModelImage({
        kind: "image",
        id: "x",
        dataUrl: `data:image/jpeg;base64,${png.toString("base64")}`,
      }),
    { code: "IMAGE_INVALID" },
  );
  await assert.rejects(
    () =>
      prepareModelImage({
        kind: "image",
        id: "x",
        dataUrl: "https://example.com/should-not-fetch.png",
      }),
    { code: "IMAGE_INVALID" },
  );
  const long = await sharp({
    create: { width: 8193, height: 5, channels: 3, background: "#fff" },
  })
    .png()
    .toBuffer();
  await assert.rejects(
    () =>
      prepareModelImage({
        kind: "image",
        id: "x",
        dataUrl: `data:image/png;base64,${long.toString("base64")}`,
      }),
    { code: "IMAGE_INVALID" },
  );
});
test("public production route is gated, cross-origin is rejected and rate limits reset", async () => {
  let n = 0;
  const p = payload();
  const handle = handler(
    async () => {
      n++;
      return provider(JSON.stringify(output(p.input)));
    },
    {
      env: () => ({
        ...env(),
        NODE_ENV: "production",
        MARKETMORPH_ACCESS_TOKEN: "test-code",
      }),
    },
  );
  assert.equal((await handle(request(p))).status, 403);
  assert.equal(
    (
      await handle(
        request(p, {
          origin: "https://another.example",
          "x-marketmorph-access-token": "test-code",
        }),
      )
    ).status,
    403,
  );
  assert.equal(
    (await handle(request(p, { "x-marketmorph-access-token": "test-code" })))
      .status,
    200,
  );
  assert.equal(n, 1);
  const limiter = createRateLimiter();
  for (let i = 0; i < 5; i++) assert.ok(limiter("a", 0));
  assert.equal(limiter("a", 1), false);
  assert.equal(limiter("a", 60001), true);
});
test("bounded request size and malformed JSON return explicit errors", async () => {
  const run = handler(async () => {
    throw new Error("not reached");
  });
  const big = await run(request("x".repeat(MAX_REQUEST_BYTES + 1)));
  assert.equal(big.status, 413);
  assert.equal((await big.json()).error.code, "PAYLOAD_TOO_LARGE");
  const bad = await run(request("{broken"));
  assert.equal(bad.status, 400);
  assert.equal((await bad.json()).error.code, "INPUT_INVALID");
});
test("provider HTTP errors map to Hong Kong messages; only transient server errors retry", async () => {
  for (const [http, category, count] of [
    [401, "AUTH_INVALID", 1],
    [402, "BALANCE_INSUFFICIENT", 1],
    [400, "PARAMETERS_INVALID", 1],
    [422, "PARAMETERS_INVALID", 1],
    [429, "RATE_LIMITED", 1],
    [500, "PROVIDER_UNAVAILABLE", 2],
    [503, "PROVIDER_UNAVAILABLE", 2],
  ] as const) {
    let n = 0;
    const handle = handler(async () => {
      n++;
      return new Response("provider-private-message", { status: http });
    });
    const res = await handle(request(payload()));
    const data = await res.json();
    assert.equal(data.error.code, category);
    assert.equal(n, count);
    assert.ok(!JSON.stringify(data).includes("provider-private-message"));
    assert.equal(data.calls.length, count);
    assert.ok(
      data.calls.every((c: { success: boolean }) => c.success === false),
    );
  }
});
test("blank, malformed JSON, extra price fields and invented claims never return success", async () => {
  const p = payload(),
    base = output(p.input);
  for (const [content, code] of [
    ["   ", "EMPTY_OUTPUT"],
    ["{broken", "JSON_INVALID"],
    [
      JSON.stringify({ ...base, design: { ...base.design, price: 100 } }),
      "DESIGN_INVALID",
    ],
    [
      JSON.stringify({
        ...base,
        design: { ...base.design, headline: "Only USD 1 per year" },
      }),
      "BUSINESS_INVALID",
    ],
    [
      JSON.stringify({
        ...base,
        design: {
          ...base.design,
          theme: { ...base.design.theme, accent: "#ff0000" },
        },
      }),
      "DESIGN_INVALID",
    ],
  ] as const) {
    const res = await handler(async () => provider(content))(request(p));
    const data = await res.json();
    assert.equal(res.status, 502);
    assert.equal(data.ok, false);
    assert.equal(data.error.code, code);
    assert.equal(data.calls.length, 2);
    assert.equal(data.spec, undefined);
  }
});
test("bounded repair succeeds on second request; logs actual failed and successful usage", async () => {
  const p = payload();
  let n = 0;
  const base = output(p.input);
  const res = await handler(async (_url, init) => {
    n++;
    const body = JSON.parse(String(init?.body));
    if (n === 2) {
      assert.match(body.messages[0].content, /design.theme.accent/);
      assert.equal(body.messages[1].content[1].image_url.detail, "original");
    }
    const value = n === 1 ? { ...base, design: { ...base.design, theme: { ...base.design.theme, accent: "purple" } } } : base;
    return provider(JSON.stringify(value), {
      prompt_tokens: 12,
      completion_tokens: n,
    });
  })(request(p));
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.meta.calls[0].errorCategory, "DESIGN_INVALID");
  assert.equal(body.meta.calls[1].success, true);
  assert.equal(body.meta.calls[1].outputTokens, 2);
});
test("timeout aborts the provider request without automatic duplicate billing", async () => {
  let n = 0;
  const p = payload();
  const fn: typeof fetch = async (_url, init) => {
    n++;
    return new Promise<Response>((_resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("timeout did not fire")),
        200,
      );
      init?.signal?.addEventListener(
        "abort",
        () => {
          clearTimeout(timer);
          reject(init.signal?.reason);
        },
        { once: true },
      );
    });
  };
  await assert.rejects(
    () =>
      callDeepSeek(p.input, demoImage.dataUrl, {
        apiKey: key,
        requestId: "timeout-test",
        fetcher: fn,
        timeoutMs: 10,
      }),
    { code: "TIMEOUT" },
  );
  assert.equal(n, 1);
});
