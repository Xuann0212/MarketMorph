import type { CSSProperties } from "react";
import type { DesignSpec, InputPayload } from "@/lib/designSchema";
import { paywallLabels, planPrice, trialDetails } from "@/lib/paywallContent";
import Icon from "./Icon";

export default function PaywallPreview({ input, spec }: { input: InputPayload; spec: DesignSpec }) {
  const chinese = input.outputLanguage !== "en";
  const labels = paywallLabels[input.outputLanguage];
  const trials = trialDetails(input);
  const plansById = new Map(input.subscriptionPlans.map((plan) => [plan.id, plan]));
  const theme = {
    background: spec.theme.background,
    color: spec.theme.text,
    "--paywall-cta-text": spec.theme.surface,
    "--paywall-accent": spec.theme.accent,
    "--paywall-surface": spec.theme.surface,
  } as CSSProperties;
  const sections = {
    headline: <div className="paywall-copy"><h3>{spec.headline}</h3>{spec.subtitle && <p>{spec.subtitle}</p>}</div>,
    benefits: (
      <div className="benefits-list">
        {spec.benefitsCopy.map((benefit) => (
          <div key={benefit.benefitId}><span aria-hidden="true"><Icon name="check" size={11} /></span><p>{benefit.text}</p></div>
        ))}
      </div>
    ),
    plans: (
      <div className="plans">
        {spec.planOrder.map((id) => {
          const plan = plansById.get(id);
          if (!plan) return null;
          const monthly = plan.price.billingPeriod === "month";
          const featured = spec.featuredPlanId === id;
          return (
            <div className={`plan-card confirmed-plan ${featured ? "highlighted" : ""}`} key={id}>
              <span className="radio" aria-hidden="true"><i /></span>
              <div className="plan-name">
                <b>{plan.name}</b>
                <small>{labels[plan.price.billingPeriod]}</small>
                {plan.benefitIds?.length ? <small>{spec.benefitsCopy.filter((benefit) => plan.benefitIds?.includes(benefit.benefitId)).map((benefit) => benefit.text).join(" · ")}</small> : null}
              </div>
              <div className="plan-price">
                <b>{planPrice(plan)}</b>
                <small>{chinese ? (monthly ? "/ 月" : "/ 年") : (monthly ? "/ month" : "/ year")}</small>
              </div>
            </div>
          );
        })}
      </div>
    ),
    trial: trials.map((trial) => (
      <div className="paywall-facts" key={trial.planIds.join(",")}>
        <strong>{trial.days}{labels.trial} · {trial.planNames.join(" / ")}</strong>
        <p>{trial.eligibility}</p>
      </div>
    )),
    cta: (
      <button className="paywall-cta" type="button" disabled title="預覽按鈕，無法付款">
        {spec.ctaText}<Icon name="arrow" size={13} />
      </button>
    ),
    disclosures: (
      <div className="paywall-facts">
        {trials.map((trial) => <p key={trial.planIds.join(",")}>{trial.planNames.join(" / ")} · {trial.renewalDisclosure}</p>)}
        {!input.trialTerms.days && input.trialTerms.renewalDisclosure && <p>{input.trialTerms.renewalDisclosure}</p>}
        {input.subscriptionPlans.map((plan) => plan.terms && <p key={plan.id}>{plan.name} · {plan.terms}</p>)}
        <p className="paywall-preview-note">{labels.preview}</p>
      </div>
    ),
  };
  return (
    <div className="phone generated">
      <div className="phone-speaker" aria-hidden="true" />
      <div className="paywall-content" tabIndex={0} lang={input.outputLanguage} aria-label="本地化訂閱頁面內容" style={theme}>
        <div className="phone-topline" aria-hidden="true"><span>9:42</span><span className="phone-status">● ◒</span></div>
        <span className="phone-close" aria-hidden="true">×</span>
        <div className="paywall-brand"><span><Icon name="sparkles" size={18} /></span><b>{input.productName}</b></div>
        {spec.sectionOrder.map((section) => <div key={section}>{sections[section]}</div>)}
      </div>
    </div>
  );
}
