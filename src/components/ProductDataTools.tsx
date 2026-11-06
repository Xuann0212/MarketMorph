"use client";
import Icon from "./Icon";
import { useRef, useState } from "react";
import { MARKET_CONFIG } from "@/lib/designSchema";
import type { TargetMarket } from "@/lib/designSchema";
import { compareImport, parseWorkspaceImport } from "@/lib/productDraft";
import type { ProductDraft, WorkspaceImport } from "@/lib/productDraft";
import { MAX_IMPORT_BYTES } from "@/lib/workspaceData";
export default function ProductDataTools({
  product,
  market,
  onImport,
  onReview,
}: {
  product: ProductDraft;
  market: TargetMarket | "";
  onImport: (draft: ProductDraft, mode: "fill" | "replace", switchTo?: TargetMarket) => void;
  onReview: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<WorkspaceImport | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [switchMarket, setSwitchMarket] = useState(false);
  const importMarket = pending?.draft.importedMetadata?.market;
  const mismatch = market && importMarket && market !== importMarket;
  function apply(mode: "fill" | "replace") {
    if (!pending) return;
    onImport(pending.draft, mode, switchMarket && mismatch ? importMarket : undefined);
    setPending(null);
  }
  async function read(file?: File) {
    if (!file) return;
    setPending(null);
    setError("");
    setSwitchMarket(false);
    setBusy(true);
    try {
      if (file.size > MAX_IMPORT_BYTES)
        throw new Error("JSON 文件不能超過 256 KB。");
      if (!/\.json$/i.test(file.name)) throw new Error("僅支援 .json 文件。");
      setPending(parseWorkspaceImport(await file.text(), file));
    } catch (e) {
      setError(e instanceof Error ? e.message : "讀取失敗。");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="product-data-tools">
      <div className="product-data-actions">
        <button type="button" disabled={busy} onClick={() => fileRef.current?.click()}>
          <span><Icon name="upload" size={20} /></span>匯入產品資料
        </button>
        <input
          className="visually-hidden"
          type="file"
          id="main-product-import"
          ref={fileRef}
          aria-label="匯入產品資料 JSON"
          tabIndex={-1}
          accept=".json,application/json"
          disabled={busy}
          onChange={(e) => {
            void read(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <button type="button" onClick={onReview}>
          <span><Icon name="layout" size={20} /></span>
          檢視完整輸入資料
        </button>
      </div>
      {error && (
        <p className="error import-error" role="alert">
          {error}
        </p>
      )}
      {busy && <p role="status">校驗 JSON 中…</p>}
      {pending && (
        <div className="import-confirm">
          <strong>{pending.draft.facts.productName}</strong>
          {mismatch && (
            <fieldset className="checks">
              <legend>匯入資料屬於{MARKET_CONFIG[importMarket].label}，目前目標是{MARKET_CONFIG[market].label}。</legend>
              <label><input type="radio" name="import-target" checked={!switchMarket} onChange={() => setSwitchMarket(false)} />保留目前目標，匯入共用及原市場資料</label>
              <label><input type="radio" name="import-target" checked={switchMarket} onChange={() => setSwitchMarket(true)} />切換至{MARKET_CONFIG[importMarket].label}</label>
            </fieldset>
          )}
          <ul className="import-diff">
            {compareImport(product, pending.draft).map(({ key, change }) => <li key={key}>{key} · {change}</li>)}
          </ul>
          {pending.unknownFields.length > 0 && <p className="helper">無法識別的欄位：{pending.unknownFields.join("、")}</p>}
          <div className="button-row">
            <button type="button" className="secondary" onClick={() => apply("fill")}>只填入空白欄位</button>
            <button type="button" className="secondary" onClick={() => apply("replace")}>以匯入資料取代目前資料</button>
            <button type="button" className="text-button" onClick={() => setPending(null)}>取消匯入</button>
          </div>
        </div>
      )}
    </div>
  );
}
