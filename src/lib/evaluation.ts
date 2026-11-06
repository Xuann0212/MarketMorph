import type { EvalRecord } from "./studioTypes.ts";
export function parseEvaluation(value: unknown): EvalRecord[] {
  if (!Array.isArray(value) || !value.length || value.length > 500)
    throw new Error("評估資料須為 1–500 筆 EvalRecord 陣列。");
  const ids = new Set<string>();
  for (const v of value) {
    if (
      !v ||
      typeof v !== "object" ||
      !v.testCaseId ||
      typeof v.testCaseId !== "string" ||
      !["generic-baseline", "marketmorph"].includes(v.method) ||
      typeof v.isExample !== "boolean"
    )
      throw new Error("缺少 testCaseId、method 或 isExample。");
    const key = `${v.testCaseId}/${v.method}`;
    if (ids.has(key)) throw new Error("同一測試及方法不能重複。");
    ids.add(key);
    for (const k of ["requirements", "facts", "brand"]) {
      const n = v.results?.[k];
      if (typeof n !== "number" || !Number.isFinite(n) || n < 0 || n > 1)
        throw new Error("results 指標必須在 0 至 1 之間。");
    }
    if (
      !v.scores ||
      !(
        v.scores.humanRating === null ||
        (typeof v.scores.humanRating === "number" &&
          Number.isFinite(v.scores.humanRating) &&
          v.scores.humanRating >= 0 &&
          v.scores.humanRating <= 5)
      )
    )
      throw new Error("humanRating 必須為 null 或 0–5。");
    if (
      !v.timing ||
      !(
        v.timing.durationMs === null ||
        (typeof v.timing.durationMs === "number" &&
          Number.isFinite(v.timing.durationMs) &&
          v.timing.durationMs >= 0)
      )
    )
      throw new Error("durationMs 必須為 null 或非負數。");
    if (
      v.cost &&
      !(
        v.cost.currency === "USD" &&
        typeof v.cost.amount === "number" &&
        Number.isFinite(v.cost.amount) &&
        v.cost.amount >= 0
      )
    )
      throw new Error("成本必須為有效 USD 非負數。");
  }
  return structuredClone(value);
}
