import type { AuditReport, DesignSpec, InputPayload } from "./designSchema.ts";
import type { GenerationMeta } from "./generationTypes.ts";
export type OriginalSource = { sourceMarket?: string; sourceLanguage?: string } & (
  | { kind: "demo"; id: string }
  | {
      kind: "image";
      id: string;
      url: string;
      name: string;
      mime: string;
      size: number;
      width: number;
      height: number;
    });
export type UploadStatus =
  "idle" | "validating" | "success" | "error" | "replacing" | "removed";
export type ConfirmationStatus =
  "draft" | "validating" | "confirmed" | "error" | "dirty";
export type GenerationStatus =
  "idle" | "validating" | "loading" | "success" | "error" | "stale";
export type CheckStatus =
  "pending" | "checking" | "pass" | "fail" | "human_review" | "not_checked";
export interface StudioResult {
  inputSnapshot: InputPayload;
  sourceId: string;
  spec: DesignSpec;
  audit: AuditReport;
  mode: "demo" | "live";
  generationDurationMs?: number;
  meta?: GenerationMeta;
}
export interface EvalRecord {
  testCaseId: string;
  method: "generic-baseline" | "marketmorph";
  results: { requirements: number; facts: number; brand: number };
  scores: { humanRating: number | null };
  timing: { durationMs: number | null };
  cost?: { currency: "USD"; amount: number };
  isExample: boolean;
}
export function productFingerprint(input: InputPayload): string {
  return stableJson({
    name: input.productName,
    category: input.productCategory,
    description: input.productDescription,
    audience: input.targetAudience,
    market: input.targetMarket,
    plans: input.subscriptionPlans,
    trial: input.trialTerms,
    benefits: input.benefits,
  });
}
export function resultIsStale(
  result: StudioResult,
  input: InputPayload | null,
  source: OriginalSource | null,
): boolean {
  return (
    !input ||
    !source ||
    source.id !== result.sourceId ||
    stableJson(result.inputSnapshot) !== stableJson(input)
  );
}
export function stableJson(value: unknown): string {
  function ordered(v: unknown): unknown {
    if (Array.isArray(v)) return v.map(ordered);
    if (v && typeof v === "object")
      return Object.fromEntries(
        Object.keys(v)
          .sort()
          .filter((key) => (v as Record<string, unknown>)[key] !== undefined)
          .map((key) => [key, ordered((v as Record<string, unknown>)[key])]),
      );
    return v;
  }
  return JSON.stringify(ordered(value));
}
export function validateImageMetadata(file: {
  name: string;
  type: string;
  size: number;
}): string | null {
  if (
    !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
    !/\.(png|jpe?g|webp)$/i.test(file.name)
  )
    return "格式不支援，請選擇 PNG、JPG、JPEG 或 WebP 圖片。";
  if (file.size > 10 * 1024 * 1024) return "圖片過大，最大支援 10 MB。";
  if (file.size === 0) return "無法讀取圖片，檔案內容為空。";
  return null;
}
