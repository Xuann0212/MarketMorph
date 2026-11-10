import type { CSSProperties } from "react";
import type { DesignSpec, InputPayload, PageSection } from "@/lib/designSchema";
import { paywallLabels, planPrice, trialDetails } from "@/lib/paywallContent";
import { examplePaywallCopy } from "@/lib/exampleBenefitCopy";
import { christmasPaths, christmasViewBox } from "@/lib/christmasBackground";
import type { StudioBackground } from "@/lib/background";
import { TEXT_SURFACE_THRESHOLD } from "@/lib/background";
import PaywallBackground from "./PaywallBackground";
import Icon from "./Icon";

export default function PaywallPreview({ input, spec, focusedSection, background }: {
  input: InputPayload;
  spec: DesignSpec;
  focusedSection?: PageSection;
  background?: StudioBackground | null;
}) {
  const chinese = input.outputLanguage !== "en";
  const labels = paywallLabels[input.outputLanguage];
  const display = examplePaywallCopy(input);
  const trials = trialDetails(display);
  const plansById = new Map(display.subscriptionPlans.map((plan) => [plan.id, plan]));
  const theme = {
    color: spec.theme.text,
    "--paywall-cta-text": spec.theme.surface,
    "--paywall-accent": spec.theme.accent,
    "--paywall-background": spec.theme.background,
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
      <button className="paywall-cta" type="button" disabled title={labels.preview}>
        {spec.ctaText}<Icon name="arrow" size={13} />
      </button>
    ),
    disclosures: (
      <div className="paywall-facts">
        {trials.map((trial) => <p key={trial.planIds.join(",")}>{trial.planNames.join(" / ")} · {trial.renewalDisclosure}</p>)}
        {!display.trialTerms.days && display.trialTerms.renewalDisclosure && <p>{display.trialTerms.renewalDisclosure}</p>}
        {display.subscriptionPlans.map((plan) => plan.terms && <p key={plan.id}>{plan.name} · {plan.terms}</p>)}
        <p className="paywall-preview-note">{labels.preview}</p>
      </div>
    ),
  };
  return (
    <div className="phone generated">
      <div className="phone-speaker" aria-hidden="true" />
      <div className="paywall-viewport" style={{ backgroundColor: spec.theme.background }}
        data-text-surface={background && background.config.overlayOpacity < TEXT_SURFACE_THRESHOLD ? "true" : undefined}>
      {background && <PaywallBackground asset={background} tint={spec.theme.background} />}
      <div className="paywall-content" tabIndex={0} lang={input.outputLanguage} aria-label="本地化訂閱頁面內容" style={{ ...theme, background: "transparent" }}>
        <div className="phone-topline" aria-hidden="true"><span>9:42</span><span className="phone-status">● ◒</span></div>
        <span className="phone-close" aria-hidden="true">×</span>
        {!background && spec.backgroundPattern === "christmas" && (
          <svg className="paywall-christmas" data-background-pattern="christmas" viewBox={christmasViewBox}
            aria-hidden="true" focusable="false" fill="none" stroke={spec.theme.accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            {christmasPaths.map(({ d, opacity }) => <path key={d} d={d} strokeOpacity={opacity} />)}
          </svg>
        )}
        <div className="paywall-brand"><span><Icon name="sparkles" size={18} /></span><b>{input.productName}</b></div>
        {spec.sectionOrder.map((section) => (
          <div key={section} data-paywall-section={section} tabIndex={focusedSection === section ? -1 : undefined}
            className={focusedSection === section ? "preview-section-focused" : undefined}>{sections[section]}</div>
        ))}
      </div>
      </div>
    </div>
  );
}
