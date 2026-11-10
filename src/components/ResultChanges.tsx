import type { PageSection } from "@/lib/designSchema";
import type { StudioResult } from "@/lib/studioTypes";
import { describeDesignChanges } from "@/lib/designSummary";
import { examplePaywallCopy } from "@/lib/exampleBenefitCopy";
import { paywallLabels, planPrice, trialDetails } from "@/lib/paywallContent";
import Icon from "./Icon";

export default function ResultChanges({ result, onLocate, onEditCopy, uploadedBackground }: {
  result: StudioResult;
  onLocate: (section: PageSection) => void;
  onEditCopy?: () => void;
  uploadedBackground?: boolean;
}) {
  const input = examplePaywallCopy(result.inputSnapshot);
  const { spec } = result;
  const labels = paywallLabels[input.outputLanguage];
  const trials = trialDetails(input);
  const featured = input.subscriptionPlans.find((plan) => plan.id === spec.featuredPlanId);
  const [layout, theme] = describeDesignChanges(result, uploadedBackground);
  const items: { title: string; description: string; section: PageSection; basis: string; disabled?: boolean }[] = [
    { title: "價格與計費週期", description: input.subscriptionPlans.map((plan) =>
      `${plan.name} · ${planPrice(plan)} · ${labels[plan.price.billingPeriod]}`).join("／"),
      section: "plans", basis: "依據 · 已確認的目標市場價格" },
    { title: "試用資格", description: trials.map((trial) =>
      `${trial.planNames.join("／")} · ${trial.days} 天 · ${trial.eligibility}`).join("／") || "已確認資料沒有試用方案。",
      section: "trial", basis: "依據 · 已確認的試用條款", disabled: !trials.length },
    { title: "續費與訂閱條款", description: [
      ...trials.map((trial) => trial.renewalDisclosure),
      ...(!input.trialTerms.days ? [input.trialTerms.renewalDisclosure] : []),
      ...input.subscriptionPlans.map((plan) => plan.terms),
    ].filter(Boolean).join("／") || "已確認資料沒有其他訂閱條款。",
      section: "disclosures", basis: "依據 · 已確認的續費與訂閱條款" },
    { title: "行動按鈕文案", description: spec.ctaText, section: "cta",
      basis: spec.designReasons.some((reason) => reason.field === "manual-copy") ? "依據 · 工作台手動修訂"
        : result.mode === "live" ? "依據 · AI 本地化，需核對語意" : "依據 · 所選語言的文案模板" },
    { title: "重點方案", description: featured?.name ?? "依確認資料顯示各方案。", section: "plans",
      basis: "依據 · 設計目標及已確認的訂閱方案" },
    { ...layout, section: "headline", basis: "依據 · 本次版面配置" },
    { ...theme, section: "headline", basis: "依據 · 本次配色及品牌設定" },
  ];
  return (
    <section className="result-summary">
      <div className="result-section-heading">
        <div><h3>本地化內容與依據</h3><span>{result.mode === "live" ? "DeepSeek" : "規則預覽"}</span></div>
        {onEditCopy && <button id="edit-result-copy" className="text-button" type="button" onClick={onEditCopy}>只修改文案</button>}
      </div>
      <div className="result-summary-grid">
        {items.map(({ title, description, section, basis, disabled }) => (
          <article key={title}>
            <div>
              <b>{title}</b><p>{description}</p><small>{basis}</small>
              {!disabled && <button className="text-button" type="button" onClick={() => onLocate(section)} aria-label={`在預覽中查看${title}`}>
                在預覽中查看 <Icon name="arrow" size={13} />
              </button>}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
