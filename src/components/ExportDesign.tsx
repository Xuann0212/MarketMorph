"use client";
import { useRef, useState } from "react";
import type { StudioResult } from "@/lib/studioTypes";
import { deliveryBlock, deliveryFiles, deliveryZip } from "@/lib/delivery";
import Modal from "./Modal";
import PaywallPreview from "./PaywallPreview";

const formats = [
  ["zip", "完整 ZIP 交付包", "MarketMorph_Export.zip", "application/zip"],
  ["design-spec.json", "DesignSpec JSON", "design-spec.json", "application/json"],
  ["preview.png", "PNG 預覽", "preview.png", "image/png"],
  ["audit-report.json", "設計檢查報告", "audit-report.json", "application/json"],
  ["react-native/LocalizedPaywall.tsx", "React Native 元件", "LocalizedPaywall.tsx", "text/plain"],
  ["INTEGRATION.md", "開發接入說明", "INTEGRATION.md", "text/markdown"],
] as const;
type Format = typeof formats[number][0];

export default function ExportDesign({ result, stale }: { result: StudioResult; stale: boolean }) {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<Format>("zip");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const stage = useRef<HTMLDivElement>(null);
  const blocked = deliveryBlock(result, stale);
  const needsReview = result.audit.checks.some((check) => check.status === "needs-review");

  async function download() {
    if (busy || blocked) return;
    setBusy(true);
    setMessage("");
    try {
      const files = deliveryFiles(result);
      const selected = formats.find(([value]) => value === format)!;
      let blob: Blob;
      if (format === "zip" || format === "preview.png") {
        const paywall = stage.current?.querySelector<HTMLElement>(".paywall-content");
        if (!paywall) throw new Error("未能取得預覽，請重新開啟匯出。");
        await document.fonts.ready;
        const { toBlob } = await import("html-to-image");
        const png = await toBlob(paywall, { pixelRatio: 2, skipFonts: true });
        if (!png?.size) throw new Error("未能產生 PNG，請重試。");
        blob = format === "zip"
          ? new Blob([new Uint8Array(deliveryZip(files, new Uint8Array(await png.arrayBuffer())))], { type: selected[3] })
          : png;
      } else {
        blob = new Blob([files[format]], { type: selected[3] });
      }
      const href = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = href;
      link.download = selected[2];
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(href), 1000);
      setMessage("已開始下載 " + selected[2]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "匯出失敗，請重試。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="localization-review-card delivery-card">
      <div className="review-card-copy">
        <h3>匯出設計</h3>
        <p>{blocked ?? (needsReview ? "此成果包含需要人工確認的項目，狀態會保留在報告中。" : "下載預覽、設計規格及開發接入檔案。")}</p>
      </div>
      <button type="button" disabled={Boolean(blocked)} onClick={() => { setOpen(true); setMessage(""); }}>匯出設計 →</button>
      <Modal open={open} onClose={() => { if (!busy) setOpen(false); }} title="匯出設計">
        {result.mode === "demo" && <p className="helper">本次設計由本機規則生成。</p>}
        {needsReview && <p className="helper">匯出包保留人工確認項目。請在開發交付前核對報告。</p>}
        <label className="field">
          <span>檔案格式</span>
          <div className="select-wrap"><select value={format} disabled={busy} onChange={(event) => setFormat(event.target.value as Format)}>
            {formats.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select></div>
        </label>
        <button className="primary" type="button" disabled={busy || Boolean(blocked)} onClick={() => void download()}>
          {busy ? "正在建立檔案…" : "下載"}
        </button>
        {message && <p role="status">{message}</p>}
        {open && <div className="export-preview" aria-hidden="true" inert ref={stage}>
          <PaywallPreview input={result.inputSnapshot} spec={result.spec} />
        </div>}
      </Modal>
    </section>
  );
}
