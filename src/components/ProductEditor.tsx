"use client";
import type { InputPayload, SubscriptionPlan, TargetMarket } from "@/lib/designSchema";
import { MARKET_CONFIG, MAX_PLANS } from "@/lib/designSchema";
import type { ProductFormDraft } from "@/lib/workspaceData";
import type { InputErrors } from "@/lib/inputValidation";
import { blankPlan, emptyTrial } from "@/lib/productDraft";
import Modal from "./Modal";
import Field, { fieldAttrs } from "./FormField";

export default function ProductEditor({ open, draft, market, errors, onChange, onClose, onSave }: {
  open: boolean;
  draft: ProductFormDraft;
  market: TargetMarket | "";
  errors: InputErrors;
  onChange: (draft: ProductFormDraft) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const { input } = draft;
  const plans = input.subscriptionPlans;
  function update<K extends keyof InputPayload>(key: K, value: InputPayload[K]) {
    onChange({ ...draft, input: { ...input, [key]: value } });
  }
  function updatePlan(index: number, plan: SubscriptionPlan) {
    update("subscriptionPlans", plans.map((current, i) => i === index ? plan : current));
  }
  function removePlan(index: number) {
    onChange({
      ...draft,
      amounts: draft.amounts.filter((_, i) => i !== index),
      input: {
        ...input,
        subscriptionPlans: plans.filter((_, i) => i !== index),
        trialTerms: { ...input.trialTerms, eligiblePlanIds: input.trialTerms.eligiblePlanIds.filter((id) => id !== plans[index].id) },
      },
    });
  }
  const fields = [
    ["productName", "產品名稱 *"],
    ["productCategory", "產品類別（選填）"],
    ["targetAudience", "目標用戶（選填）"],
  ] as const;
  return (
    <Modal open={open} onClose={onClose} title="編輯產品與訂閱資料" closeLabel="關閉產品資料編輯器">
      <form noValidate onSubmit={(event) => { event.preventDefault(); onSave(); }}>
        <div className="product-editor-fields">
          {fields.map(([key, label]) => (
            <Field key={key} label={label} path={key} errors={errors}>
              <input {...fieldAttrs(key, errors)} required={key === "productName"} value={input[key]} onChange={(event) => update(key, event.target.value)} />
            </Field>
          ))}
          <Field label="產品簡介（選填）" path="productDescription" errors={errors}>
            <textarea {...fieldAttrs("productDescription", errors)} rows={3} value={input.productDescription} onChange={(event) => update("productDescription", event.target.value)} />
          </Field>
          <Field label="會員權益 *" path="benefits" errors={errors} hint="每行一項。">
            <textarea {...fieldAttrs("benefits", errors)} required rows={3} value={input.benefits.map((item) => item.description).join("\n")} onChange={(event) => {
              const lines = event.target.value ? event.target.value.split("\n") : [];
              update("benefits", lines.map((description, i) => ({ id: input.benefits[i]?.id ?? crypto.randomUUID(), description })));
            }} />
          </Field>
          <h3>訂閱方案 {market && "· " + MARKET_CONFIG[market].label}</h3>
          {!market && <p className="helper">請先選擇目標市場，再填寫該市場價格。</p>}
          {market && plans.map((plan, index) => {
            const prefix = "subscriptionPlans." + index;
            const field = (key: string) => fieldAttrs(prefix + "." + key, errors);
            return (
              <fieldset className="plan-editor product-editor-fields" key={plan.id}>
                <legend>訂閱方案 {index + 1}</legend>
                <Field label="方案名稱 *" path={prefix + ".name"} errors={errors}>
                  <input {...field("name")} required value={plan.name} onChange={(event) => updatePlan(index, { ...plan, name: event.target.value })} />
                </Field>
                <div className="two-cols">
                  <Field label="計費週期 *" path={prefix + ".price.billingPeriod"} errors={errors}>
                    <select {...field("price.billingPeriod")} required value={plan.price.billingPeriod} onChange={(event) => updatePlan(index, { ...plan, price: { ...plan.price, billingPeriod: event.target.value as SubscriptionPlan["price"]["billingPeriod"] } })}>
                      <option value="month">每月</option><option value="year">每年</option>
                    </select>
                  </Field>
                  <Field label="幣種 *" path={prefix + ".price.currency"} errors={errors}>
                    <input {...field("price.currency")} readOnly value={plan.price.currency} />
                  </Field>
                </div>
                <Field label="價格 *" path={prefix + ".price.amountMinor"} errors={errors}>
                  <input {...field("price.amountMinor")} required inputMode="decimal" value={draft.amounts[index] ?? ""} onChange={(event) => onChange({
                    ...draft, amounts: draft.amounts.map((amount, i) => i === index ? event.target.value : amount),
                  })} />
                </Field>
                <Field label="商品 ID（選填）" path={prefix + ".productId"} errors={errors}>
                  <input {...field("productId")} value={plan.productId ?? ""} onChange={(event) => updatePlan(index, { ...plan, productId: event.target.value || undefined })} />
                </Field>
                <fieldset className="checks">
                  <legend>適用權益（選填）</legend>
                  <p className="helper">全部未選時沿用產品的所有權益。</p>
                  {input.benefits.filter((benefit) => benefit.description.trim()).map((benefit) => (
                    <label key={benefit.id}>
                      <input type="checkbox" checked={plan.benefitIds?.includes(benefit.id) ?? false} onChange={(event) => {
                        const ids = event.target.checked ? [...(plan.benefitIds ?? []), benefit.id] : plan.benefitIds?.filter((id) => id !== benefit.id);
                        updatePlan(index, { ...plan, benefitIds: ids?.length ? ids : undefined });
                      }} />
                      {benefit.description}
                    </label>
                  ))}
                  {errors[prefix + ".benefitIds"] && <p className="error" role="alert">{errors[prefix + ".benefitIds"]}</p>}
                </fieldset>
                <Field label="其他條款（選填）" path={prefix + ".terms"} errors={errors}>
                  <textarea {...field("terms")} value={plan.terms ?? ""} rows={2} onChange={(event) => updatePlan(index, { ...plan, terms: event.target.value || undefined })} />
                </Field>
                {!input.trialTerms.eligiblePlanIds.includes(plan.id) && (
                  <label><input type="checkbox" checked={Boolean(plan.trial)} onChange={(event) => updatePlan(index, {
                    ...plan, trial: event.target.checked ? { days: 0, eligibility: "", renewalDisclosure: "" } : undefined,
                  })} /> 提供免費試用</label>
                )}
                {plan.trial && (
                  <>
                    <Field label="試用天數 *" path={prefix + ".trial.days"} errors={errors}>
                      <input {...field("trial.days")} required inputMode="numeric" value={Number.isNaN(plan.trial.days) ? "" : plan.trial.days} onChange={(event) => updatePlan(index, { ...plan, trial: { ...plan.trial!, days: Number(event.target.value) } })} />
                    </Field>
                    {([["eligibility", "試用適用條件 *"], ["renewalDisclosure", "試用後收費說明 *"]] as const).map(([key, label]) => (
                      <Field key={key} label={label} path={prefix + ".trial." + key} errors={errors}>
                        <textarea {...field("trial." + key)} required value={plan.trial?.[key] ?? ""} rows={2} onChange={(event) => updatePlan(index, { ...plan, trial: { ...plan.trial!, [key]: event.target.value } })} />
                      </Field>
                    ))}
                  </>
                )}
                {errors[prefix + ".id"] && <p role="alert" className="error">{errors[prefix + ".id"]}</p>}
                <button className="text-button" type="button" disabled={plans.length < 2} onClick={() => removePlan(index)}>移除方案</button>
              </fieldset>
            );
          })}
          {errors.subscriptionPlans && <p role="alert" className="error">{errors.subscriptionPlans}</p>}
          {market && <button type="button" className="secondary" disabled={plans.length >= MAX_PLANS} onClick={() => onChange({
            ...draft, amounts: [...draft.amounts, ""],
            input: { ...input, subscriptionPlans: [...plans, blankPlan(market, crypto.randomUUID())] },
          })}>＋ 新增訂閱方案</button>}
          {market && (draft.days !== "0" || input.trialTerms.eligiblePlanIds.length > 0 || input.trialTerms.renewalDisclosure) && (
            <fieldset className="plan-editor product-editor-fields">
              <legend>已匯入的共用試用條款</legend>
              <Field label="免費試用天數" path="trialTerms.days" errors={errors}>
                <input {...fieldAttrs("trialTerms.days", errors)} inputMode="numeric" value={draft.days} onChange={(event) => onChange({ ...draft, days: event.target.value })} />
              </Field>
              {([["eligibility", "試用適用條件"], ["renewalDisclosure", "試用後收費說明"]] as const).map(([key, label]) => (
                <Field key={key} label={label} path={"trialTerms." + key} errors={errors}>
                  <textarea {...fieldAttrs("trialTerms." + key, errors)} value={input.trialTerms[key]} rows={2} onChange={(event) => update("trialTerms", { ...input.trialTerms, [key]: event.target.value })} />
                </Field>
              ))}
              <fieldset className="checks">
                <legend>適用方案</legend>
                {plans.map((plan) => (
                  <label key={plan.id}><input type="checkbox" checked={input.trialTerms.eligiblePlanIds.includes(plan.id)} onChange={(event) => update("trialTerms", {
                    ...input.trialTerms, eligiblePlanIds: event.target.checked ? [...input.trialTerms.eligiblePlanIds, plan.id] : input.trialTerms.eligiblePlanIds.filter((id) => id !== plan.id),
                  })} />{plan.name}</label>
                ))}
                {errors["trialTerms.eligiblePlanIds"] && <p role="alert" className="error">{errors["trialTerms.eligiblePlanIds"]}</p>}
              </fieldset>
              <button className="text-button" type="button" onClick={() => onChange({ ...draft, days: "0", input: { ...input, trialTerms: emptyTrial() } })}>移除共用試用條款</button>
            </fieldset>
          )}
          <div className="button-row"><button type="submit" className="primary">儲存產品資料</button></div>
        </div>
      </form>
    </Modal>
  );
}
