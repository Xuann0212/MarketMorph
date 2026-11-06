"use client";
import { useState } from "react";
import Link from "next/link";
import Icon from "./Icon";
import type { EvalRecord } from "@/lib/studioTypes";
import { parseEvaluation } from "@/lib/evaluation";
export default function Evaluation() {
  const [records, setRecords] = useState<EvalRecord[]>([]),
    [error, setError] = useState("");
  async function load(file?: File) {
    if (!file) return;
    setError("");
    try {
      if (!/\.json$/i.test(file.name) || file.size > 256 * 1024)
        throw new Error("請提供不超過 256 KB 的 JSON 文件。");
      setRecords(parseEvaluation(JSON.parse(await file.text())));
    } catch (e) {
      setError(e instanceof Error ? e.message : "資料無效。");
    }
  }
  function mean(rows: EvalRecord[], key: "requirements" | "facts" | "brand") {
    return rows.length
      ? `${((rows.reduce((s, r) => s + r.results[key], 0) / rows.length) * 100).toFixed(1)}%`
      : "—";
  }
  const marketMorph = records.filter((record) => record.method === "marketmorph");
  const baseline = records.filter((record) => record.method === "generic-baseline");
  function formatMean(values: (number | null | undefined)[], suffix: string) {
    const measured = values.filter((value): value is number => typeof value === "number");
    return measured.length ? (measured.reduce((sum, value) => sum + value, 0) / measured.length).toFixed(1) + suffix : "—";
  }
  function metric(group: EvalRecord[], index: number) {
    return [
      mean(group, "requirements"),
      mean(group, "facts"),
      formatMean(group.map((r) => r.scores.humanRating), " / 5"),
      formatMean(group.map((r) => r.timing.durationMs), " ms"),
      formatMean(group.map((r) => r.cost?.amount), " USD"),
      mean(group, "brand"),
      "—",
    ][index];
  }
  const kpis = [
    ["設計要求完成率", mean(marketMorph, "requirements"), "MarketMorph", "check"],
    ["訂閱資料準確率", mean(marketMorph, "facts"), "MarketMorph", "shield"],
    ["人工評分", formatMean(marketMorph.map((r) => r.scores.humanRating), " / 5"), "MarketMorph", "sparkles"],
    ["生成時間", formatMean(marketMorph.map((r) => r.timing.durationMs), " ms"), "MarketMorph", "clock"],
  ]
  const rows = [
    "設計目標符合程度",
    "訂閱資料準確程度",
    "人工評分",
    "完成時間",
    "模型使用成本",
    "品牌規則通過率",
    "人工修改時間",
  ]
  return (
    <main className="evaluation-page">
      <header className="workspace-header evaluation-heading"><h1>評估看板</h1></header>
      <div className="workspace-body">
      <div className="evaluation-toolbar">
        <label className="secondary" htmlFor="evaluation-import">
          載入評估 JSON
        </label>
        <input
          className="visually-hidden"
          id="evaluation-import"
          type="file"
          accept=".json,application/json"
          onChange={(e) => {
            void load(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <Link className="text-button" href="/studio">
          返回設計工作台 ↗
        </Link>
        {records.length > 0 && (
          <button className="text-button" onClick={() => setRecords([])}>
            清除本次資料
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    <div className="evaluation">
      <div className="evaluation-note">
        <Icon name="info" size={17} />
        <p>
          <b>{records.length ? (records.some((r) => r.isExample) ? "包含範本紀錄" : "使用者匯入資料") : "成效評估框架 · 尚未載入評估數據。"}</b>
          {records.length ? " 這些資料尚未經系統獨立驗證。" : " 目前尚無可顯示的實驗數值。"}
        </p>
      </div>
      <div className="kpi-grid">
        {kpis.map((k) => (
          <div className="kpi-card" key={k[0]}>
            <span>
              <Icon name={k[3]} size={19} />
            </span>
            <small>{k[0]}</small>
            <b>{k[1]}</b>
            <p>{k[2]}</p>
          </div>
        ))}
      </div>
      <div className="evaluation-main">
        <section className="comparison-table">
          <div className="panel-heading">
            <div>
              <span className="kicker">未來實驗</span>
              <h3>一般 AI 與 MarketMorph 的表現比較</h3>
            </div>
            <span className="placeholder-badge">{records.length ? "已載入資料" : "尚未測試"}</span>
          </div>
          <div className="table-head">
            <span>評估指標</span>
            <b>一般 AI</b>
            <b>MarketMorph</b>
          </div>
          {rows.map((r, index) => (
            <div className="table-row" key={r}>
              <span>{r}</span>
              <i>{metric(baseline, index)}</i>
              <i>{metric(marketMorph, index)}</i>
            </div>
          ))}
        </section>
        <section className="impact-panel">
          <div className="panel-heading">
            <div>
              <span className="kicker">商業效益</span>
              <h3>日後將會量度的項目</h3>
            </div>
          </div>
          <div className="impact-item">
            <span>
              <Icon name="clock" size={18} />
            </span>
            <div>
              <b>預計節省時間</b>
              <p>比較原有流程與新流程所需時間</p>
            </div>
            <em>—</em>
          </div>
          <div className="impact-item">
            <span>
              <Icon name="chart" size={18} />
            </span>
            <div>
              <b>預計工作流程成本</b>
              <p>模型使用成本加上人工修改時間</p>
            </div>
            <em>—</em>
          </div>
          <div className="assumptions">
            <b>評估假設</b>
            <p>
              兩種流程會使用相同的產品資料、設計要求及評分準則。樣本數量及評審背景仍有待確認。
            </p>
          </div>
        </section>
      </div>
    </div>
        {records.length > 0 && (
          <details className="evaluation-schema">
            <summary>查看匯入的人工評分、耗時及成本</summary>
            <pre>{JSON.stringify(records, null, 2)}</pre>
          </details>
        )}
      <details className="evaluation-schema">
        <summary>EvalRecord 資料格式</summary>
        <p>
          results 為 0–1；humanRating 為 0–5 或 null；durationMs 為非負數或
          null。沒有真實成本時省略 cost。每筆必須註明 isExample。
        </p>
        <pre>
          {JSON.stringify(
            {
              testCaseId: "your-case-id",
              method: "marketmorph",
              results: { requirements: "0–1", facts: "0–1", brand: "0–1" },
              scores: { humanRating: null },
              timing: { durationMs: null },
              isExample: false,
            },
            null,
            2,
          )}
        </pre>
      </details>
      </div>
    </main>
  );
}
