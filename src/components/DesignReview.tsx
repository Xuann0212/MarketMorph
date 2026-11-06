"use client";
import { useState } from "react";
import type { CheckStatus, StudioResult } from "@/lib/studioTypes";
import type { AuditReport } from "@/lib/designSchema";
import Icon from "./Icon";
import { describeDesignChanges } from "@/lib/designSummary";
const LABELS: Record<CheckStatus, string> = {
  pending: "待檢查",
  checking: "檢查中",
  pass: "已檢查且通過",
  fail: "發現問題",
  human_review: "需要人工確認",
  not_checked: "未執行該項檢查",
};
export default function DesignReview({
  result,
  stale,
  open,
  onOpen,
}: {
  result: StudioResult | null;
  stale: boolean;
  open: boolean;
  onOpen: () => void;
}) {
  const [running, setRunning] = useState(false),
    [rerun, setRerun] = useState<{
      source: StudioResult;
      report: AuditReport;
    } | null>(null),
    [error, setError] = useState("");
  const report = rerun?.source === result ? rerun.report : result?.audit;
  const overall: CheckStatus = running
    ? "checking"
    : !result
      ? "pending"
      : report?.checks.some((c) => c.status === "fail")
        ? "fail"
        : report?.checks.some((c) => c.status === "needs-review")
          ? "human_review"
          : "pass";
  async function check() {
    if (!result || running) return;
    setRunning(true);
    setError("");
    try {
      const { auditDesign } = await import("@/lib/demoEngine");
      const report = auditDesign(result.inputSnapshot, result.spec);
      if (result.mode === "live")
        report.checks.push(
          ...result.audit.checks.filter((check) =>
            ["vision", "model-copy"].includes(check.id),
          ),
        );
      setRerun({
        source: result,
        report,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "檢查失敗。");
    } finally {
      setRunning(false);
    }
  }
  function checks(ids: string[]) {
    return report?.checks
      .filter((c) => ids.includes(c.id))
      .map((c) => (
        <div className="audit-row" key={c.id}>
          <div>
            <strong>{c.label}</strong>
            <p>{c.id === "vision"
              ? result?.meta?.visualAnalysis.status === "limited"
                ? "原圖部分內容未能清楚辨識，請人工核對。"
                : "已參考原圖，仍須人工核對辨識結果。"
              : c.reason}</p>
            {c.expected && (
              <details>
                <summary>預期與實際值</summary>
                <pre>
                  {JSON.stringify(
                    { expected: c.expected, actual: c.actual },
                    null,
                    2,
                  )}
                </pre>
              </details>
            )}
          </div>
          <span
            className={`state-badge ${c.status === "pass" ? "pass" : c.status === "fail" ? "fail" : "human_review"}`}
          >
            {c.status === "pass"
              ? LABELS.pass
              : c.status === "fail"
                ? LABELS.fail
                : LABELS.human_review}
          </span>
        </div>
      ));
  }
  const appearance = {
    pending: { tone: "neutral", card: "waiting", icon: "shield" },
    checking: { tone: "neutral", card: "checking", icon: "clock" },
    pass: { tone: "success", card: "complete", icon: "check" },
    fail: { tone: "error", card: "issue", icon: "close" },
    human_review: { tone: "warning", card: "manual", icon: "info" },
  }[overall];
  if (!open) {
    return (
      <section className={"localization-review-card state-" + (stale ? "waiting" : appearance.card)}>
        <div className="review-card-icon"><Icon name={appearance.icon} size={24} /></div>
        <div className="review-card-copy">
          <div><h3>本地化設計檢查</h3>{!stale && <span role="status">{!result ? "等待生成" : LABELS[overall]}</span>}</div>
          <p>{result ? "核對訂閱資料與品牌要求，了解 AI 的設計理由。" : "完成本地化設計後，可在這裏查看檢查結果。"}</p>
        </div>
        <button type="button" onClick={onOpen} disabled={!result}>查看檢查結果 <span aria-hidden="true">→</span></button>
      </section>
    );
  }
  return (
    <section className="interactive-review" aria-label="本地化設計檢查">
      <section className={"review-state-hero " + appearance.tone}>
        <span><Icon name={appearance.icon} size={24} /></span>
        <div>
          <h3 role="status">{LABELS[overall]}</h3>
          <p>{stale ? "以下僅對應上一次生成的確認快照，請重新生成。" : "核對訂閱資料、品牌規範及設計修改原因。"}</p>
        </div>
        {result && <button className="button button-light review-rerun" onClick={check} disabled={running}>{running ? "檢查中…" : "重新執行檢查"}</button>}
      </section>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="interactive-review-grid">
        <article>
          <div><Icon name="shield" size={19} /><h4>訂閱資料檢查</h4></div>
          <p>核對套餐價格、幣種、試用條款及會員權益。</p>
          <a href="#subscription-checks">查看明細</a>
        </article>
        <article>
          <div><Icon name="palette" size={19} /><h4>品牌限制檢查</h4></div>
          <p>核對顏色限制、對比度及品牌要求。</p>
          <a href="#brand-checks">查看明細</a>
        </article>
        <article>
          <div><Icon name="sparkles" size={19} /><h4>設計修改原因</h4></div>
          <p>解釋文案、配色及版面的修改依據。</p>
          <a href="#design-reasons">查看明細</a>
        </article>
      </div>
      {result && <>
        <section className="review-detail-panel" id="subscription-checks">
          <h3>訂閱資料檢查</h3>
          {checks(["schema", "facts", "month", "year", "currency", "trial", "benefits", "model-copy", "vision"])}
        </section>
        <section className="review-detail-panel" id="brand-checks">
          <h3>品牌限制檢查</h3>
          {checks(["allowed", "forbidden", "contrast", "brand-semantic"])}
          <div className="audit-row"><strong>完整無障礙與法律條款審核</strong><span className="state-badge not_checked">{LABELS.not_checked}</span></div>
        </section>
        <section className="review-detail-panel" id="design-reasons">
          <h3>設計修改原因</h3>
          <p>以下按本次設計的呈現方式整理。</p>
          {describeDesignChanges(result).map(({ title, description }) => (
            <div className="reason-row" key={title}><strong>{title}</strong><p>{description}</p></div>
          ))}
        </section>
      </>}
      <p className="review-demo-note">
        <Icon name="info" size={16} />
        {result?.mode === "live" ? "設計由 DeepSeek 生成，資料及品牌規則另行核對。" : "本機檢查以已確認資料為準。"}
      </p>
      {result?.meta && (
        <div className="helper">
          <p>模型：{result.meta.model} · 耗時：{result.meta.durationMs} 毫秒 · 嘗試次數：{result.meta.calls.length}</p>
          <p>詞元用量：輸入 {result.meta.calls.at(-1)?.inputTokens ?? "未返回"}／輸出 {result.meta.calls.at(-1)?.outputTokens ?? "未返回"}（由服務回報）</p>
          <p>請求編號：{result.meta.requestId} · 版本：{result.meta.version}</p>
        </div>
      )}
    </section>
  );
}
