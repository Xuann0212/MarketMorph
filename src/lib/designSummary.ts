import { LANGUAGE_LABELS } from "./designSchema.ts";
import type { PageSection } from "./designSchema.ts";
import { luminance } from "./demoEngine.ts";
import { trialDetails } from "./paywallContent.ts";
import type { StudioResult } from "./studioTypes.ts";

export function describeDesignChanges({ spec, inputSnapshot }: StudioResult) {
  const sections: Record<PageSection, string> = {
    headline: spec.subtitle ? "主標題及補充說明" : "主標題",
    benefits: "會員權益",
    plans: "訂閱方案",
    trial: "試用資訊",
    cta: "行動按鈕",
    disclosures: "條款說明",
  };
  const hasTrial = trialDetails(inputSnapshot).length > 0;
  const hasTerms = hasTrial || Boolean(inputSnapshot.trialTerms.renewalDisclosure) ||
    inputSnapshot.subscriptionPlans.some((plan) => plan.terms);
  const order = spec.sectionOrder
    .filter((section) => section !== "trial" || hasTrial)
    .filter((section) => section !== "disclosures" || hasTerms)
    .map((section) => sections[section])
    .join("、");

  const background = luminance(spec.theme.background) > 0.45 ? "淺色" : "深色";
  const featured = inputSnapshot.subscriptionPlans.find((plan) => plan.id === spec.featuredPlanId);
  const featuredName = featured?.price.billingPeriod === "year" ? "年費方案" : "月費方案";
  const firstPlan = spec.planOrder.length > 1 && spec.planOrder[0] === spec.featuredPlanId;
  const benefitCopyChanged = spec.benefitsCopy.some((item) =>
    inputSnapshot.benefits.find((benefit) => benefit.id === item.benefitId)?.description !== item.text,
  );

  return [
    {
      title: "版面結構",
      description: "採用單欄版面，由產品名稱帶出" + order + "，讓閱讀次序更清晰。",
    },
    {
      title: "視覺風格",
      description: "採用" + background + "背景，並以重點色突顯行動按鈕及推薦方案。",
    },
    {
      title: "重點方案",
      description: featured
        ? "以重點色標示" + featuredName + (firstPlan ? "，並把它放在方案列表首位。" : "，方便讀者辨識。")
        : "按已確認的資料呈現各項訂閱方案。",
    },
    {
      title: "文案調整",
      description: "主標題及按鈕文字按" + LANGUAGE_LABELS[inputSnapshot.outputLanguage] + "設定呈現。" +
        (benefitCopyChanged ? "會員權益說明已調整措辭。" : "會員權益說明沿用已確認文案。"),
    },
  ];
}
