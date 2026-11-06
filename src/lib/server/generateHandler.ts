import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import {
  GenerateRequestSchema,
  MAX_REQUEST_BYTES,
} from "../generationSchema.ts";
import { productFingerprint } from "../studioTypes.ts";
import { auditDesign } from "../demoEngine.ts";
import { ERROR_MESSAGES } from "../generationTypes.ts";
import type { CallRecord } from "../generationTypes.ts";
import { callDeepSeek, DEEPSEEK_MODEL } from "./deepseek.ts";
import { prepareModelImage } from "./modelImage.ts";
import { GenerationError } from "./generationError.ts";
type Environment = Record<string, string | undefined>;
export function createRateLimiter() {
  const entries = new Map<string, { count: number; until: number }>();
  return (key: string, now = Date.now()) => {
    for (const [id, value] of entries)
      if (value.until <= now) entries.delete(id);
    if (entries.size > 1000) return false;
    for (const [id, max] of [
      ["global", 10],
      [key, 5],
    ] as const) {
      const bucket = entries.get(id);
      if (bucket && bucket.count >= max) return false;
    }
    for (const id of ["global", key]) {
      const old = entries.get(id);
      entries.set(id, {
        count: (old?.count ?? 0) + 1,
        until: old?.until ?? now + 60000,
      });
    }
    return true;
  };
}
async function readJson(request: Request) {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new GenerationError("INPUT_INVALID", 400);
  if (Number(request.headers.get("content-length") ?? 0) > MAX_REQUEST_BYTES)
    throw new GenerationError("PAYLOAD_TOO_LARGE", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new GenerationError("INPUT_INVALID", 400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_REQUEST_BYTES) {
      await reader.cancel();
      throw new GenerationError("PAYLOAD_TOO_LARGE", 413);
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new GenerationError("INPUT_INVALID", 400);
  }
}
function hash(text: string) {
  return createHash("sha256").update(text).digest();
}
export function checkAccess(request: Request, env: Environment) {
  const origin = request.headers.get("origin");
  const url = new URL(request.url);
  // Next.js can normalize loopback request URLs to localhost. The HTTP Host is
  // the browser-facing authority; keep the scheme check and ignore forwarded hosts.
  const host = request.headers.get("host");
  const expectedOrigin = host ? url.protocol + "//" + host.toLowerCase() : url.origin;
  if (origin && origin !== expectedOrigin)
    throw new GenerationError("ACCESS_DENIED", 403);
  const token = env.MARKETMORPH_ACCESS_TOKEN?.trim();
  if (env.NODE_ENV === "production" && !token)
    throw new GenerationError("ACCESS_DENIED", 503);
  if (
    token &&
    !timingSafeEqual(
      hash(request.headers.get("x-marketmorph-access-token") ?? ""),
      hash(token),
    )
  )
    throw new GenerationError("ACCESS_DENIED", 403);
}
export interface HandlerOptions {
  env?: () => Environment;
  fetcher?: typeof fetch;
  rateLimit?: (key: string) => boolean;
  logger?: (record: Record<string, unknown>) => void;
  timeoutMs?: number;
  maxAttempts?: number;
}
export function createGenerateHandler(options: HandlerOptions = {}) {
  const rateLimit = options.rateLimit ?? createRateLimiter();
  const log =
    options.logger ??
    ((record) =>
      console.info(
        JSON.stringify({ event: "marketmorph.generation", ...record }),
      ));
  return async function POST(request: Request) {
    const requestId = randomUUID(),
      start = Date.now();
    try {
      const env = options.env?.() ?? process.env;
      checkAccess(request, env);
      const identity = hash(
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          "local",
      ).toString("hex");
      if (!rateLimit(identity)) throw new GenerationError("RATE_LIMITED", 429);
      const parsed = GenerateRequestSchema.safeParse(await readJson(request));
      if (!parsed.success) {
        const issues = parsed.error.issues;
        if (
          issues.some(
            (issue) =>
              issue.code === "too_big" && issue.path.includes("dataUrl"),
          )
        )
          throw new GenerationError("PAYLOAD_TOO_LARGE", 413);
        if (issues.some((issue) => issue.path[0] === "confirmation"))
          throw new GenerationError("CONFIRMATION_REQUIRED", 422);
        throw new GenerationError("INPUT_INVALID", 422);
      }
      const { input, source, confirmation } = parsed.data;
      if (confirmation.fingerprint !== productFingerprint(input))
        throw new GenerationError("CONFIRMATION_REQUIRED", 422);
      if (
        !input.originalPaywall ||
        input.originalPaywall.kind !== source.kind ||
        input.originalPaywall.id !== source.id
      )
        throw new GenerationError("IMAGE_INVALID", 422);
      const image = await prepareModelImage(source);
      const apiKey = env.DEEPSEEK_API_KEY?.trim();
      if (!apiKey) throw new GenerationError("CONFIG_MISSING", 503);
      const output = await callDeepSeek(input, image.dataUrl, {
        apiKey,
        requestId,
        fetcher: options.fetcher,
        timeoutMs: options.timeoutMs,
        maxAttempts: options.maxAttempts,
        signal: request.signal,
        onCall: (call) => log({ ...call }),
      });
      const audit = auditDesign(input, output.design);
      audit.checks.push({
        id: "model-copy",
        label: "模型自由文案與語義",
        status: "needs-review",
        field: "headline / benefitsCopy / ctaText",
        reason:
          "已阻擋價格／數字試用及折扣宣稱。翻譯語義、促銷暗示和品牌語氣仍須人工確認；模型解釋不是獨立事實檢查。",
      });
      audit.checks.push({
        id: "vision",
        label: "原圖視覺分析",
        status: "needs-review",
        field: "visualAnalysis",
        reason:
          output.visualAnalysis.status === "limited"
            ? `模型回報視覺分析受限：${output.visualAnalysis.summary}`
            : `模型回報已參考圖片，但辨識準確度未經獨立驗證：${output.visualAnalysis.summary}`,
      });
      const meta = {
        model: DEEPSEEK_MODEL,
        requestId,
        version: output.version,
        durationMs: Date.now() - start,
        calls: output.calls,
        visualAnalysis: output.visualAnalysis,
        image: image.info,
      };
      return Response.json(
        {
          ok: true,
          mode: "live",
          inputSnapshot: input,
          spec: output.design,
          audit,
          meta,
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    } catch (error) {
      const failure =
        error instanceof GenerationError
          ? error
          : new GenerationError("INTERNAL_ERROR", 500);
      const calls = (error as { calls?: CallRecord[] })?.calls;
      log({
        requestId,
        success: false,
        errorCategory: failure.code,
        durationMs: Date.now() - start,
      });
      return Response.json(
        {
          ok: false,
          error: { code: failure.code, message: ERROR_MESSAGES[failure.code] },
          requestId,
          ...(calls ? { calls } : {}),
        },
        {
          status: failure.status,
          headers: {
            "Cache-Control": "no-store",
            ...(failure.status === 429 ? { "Retry-After": "60" } : {}),
          },
        },
      );
    }
  };
}
