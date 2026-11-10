import { useState } from "react";
import type { StudioResult } from "@/lib/studioTypes";
import type { DesignSpec } from "@/lib/designSchema";
import { stableJson } from "@/lib/studioTypes";
import { auditDesign } from "@/lib/demoEngine";
import { validateOutput } from "@/lib/generationSchema";
import Modal from "./Modal";

export default function CopyEditor({ result, onClose, onSave }: {
  result: StudioResult;
  onClose: () => void;
  onSave: (result: StudioResult) => void;
}) {
  const [copy, setCopy] = useState(() => ({
    headline: result.spec.headline,
    subtitle: result.spec.subtitle ?? "",
    ctaText: result.spec.ctaText,
    benefitsCopy: result.spec.benefitsCopy,
  }));
  const [error, setError] = useState("");
  function save() {
    const next: DesignSpec = {
      ...result.spec,
      headline: copy.headline,
      subtitle: copy.subtitle,
      ctaText: copy.ctaText,
      benefitsCopy: copy.benefitsCopy,
    };
    if (!copy.subtitle.trim()) delete next.subtitle;
    if (stableJson(next) === stableJson(result.spec)) {
      onClose();
      return;
    }
    try {
      const { design } = validateOutput({
        design: next, visualAnalysis: result.meta?.visualAnalysis ?? { status: "limited", summary: "Manual copy revision" },
      }, result.inputSnapshot);
      design.designReasons = [
        ...design.designReasons.filter((item) => !["copy", "manual-copy"].includes(item.field)).slice(0, 11),
        { field: "manual-copy", reason: "已手動修訂文案，沿用原版面、品牌色、價格和試用條款。" },
      ];
      const audit = auditDesign(result.inputSnapshot, design);
      audit.checks.push(
        ...result.audit.checks.filter((check) => check.id === "vision"),
        {
          id: "edited-copy", field: "headline / benefitsCopy / ctaText", label: "手動修訂文案",
          status: "needs-review", reason: "請核對修訂後的翻譯、促銷語意和品牌語氣。",
        },
      );
      onSave({ ...result, spec: design, audit });
    } catch (cause) {
      setError(cause instanceof Error && cause.message === "BUSINESS_COPY"
        ? "請移除文案中的價格、折扣、試用天數或資格宣稱。訂閱條款可在產品資料中更新。"
        : "請核對必填文字、長度及輸出語言，並使用純文字。");
    }
  }
  return (
    <Modal title="只修改文案" open onClose={onClose}>
      <p className="helper">版面、配色及已確認的訂閱資料會沿用目前結果。</p>
      <form className="copy-form" onSubmit={(event) => { event.preventDefault(); save(); }}>
        <label className="field">主標題<input required maxLength={500} value={copy.headline} onChange={(event) => setCopy({ ...copy, headline: event.target.value })} /></label>
        <label className="field">副標題（選填）<textarea rows={2} maxLength={700} value={copy.subtitle} onChange={(event) => setCopy({ ...copy, subtitle: event.target.value })} /></label>
        {copy.benefitsCopy.map((item, index) => (
          <label className="field" key={item.benefitId}>會員權益 {index + 1}
            <textarea required rows={2} maxLength={1500} value={item.text} onChange={(event) => setCopy({
              ...copy, benefitsCopy: copy.benefitsCopy.map((current) => current.benefitId === item.benefitId
                ? { ...current, text: event.target.value } : current),
            })} />
          </label>
        ))}
        <label className="field">行動按鈕<input id="result-cta-copy" required maxLength={200} value={copy.ctaText} onChange={(event) => setCopy({ ...copy, ctaText: event.target.value })} /></label>
        {error && <p role="alert" className="error">{error}</p>}
        <button className="primary" type="submit">套用文案</button>
      </form>
    </Modal>
  );
}
