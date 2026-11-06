import type { InputPayload, TargetMarket } from "@/lib/designSchema";
import { formatAmountMinor } from "@/lib/inputValidation";
import Icon from "./Icon";

export default function ProductSummary({ input, market, onEdit }: { input: InputPayload; market: TargetMarket | ""; onEdit: () => void }) {
  return (
    <div aria-label="產品資料摘要" role="region">
      <div className="product-data-overview product-identity">
        <div className="app-symbol"><Icon name="sparkles" size={19} /></div>
        <div>
          <b>{input.productName || "尚未填寫產品名稱"}</b>
          <p>{input.productDescription || "產品資料待確認"}</p>
        </div>
        <button type="button" onClick={onEdit}><Icon name="edit" size={16} />手動填寫</button>
      </div>
      {market && <div className="product-data-facts">
        {input.subscriptionPlans.map(({ id, price }) => (
          <span key={id}>{price.billingPeriod === "month" ? "月費" : "年費"}{" "}
            <b>{price.currency} {Number.isSafeInteger(price.amountMinor) ? formatAmountMinor(price.amountMinor) : "待填寫"}</b>
          </span>
        ))}
        <span>{input.trialTerms.days || input.subscriptionPlans.some((plan) => plan.trial) ? "已填寫試用" : "沒有試用"}</span>
      </div>}
      <p className="benefit-summary">會員權益：{input.benefits.length ? `${input.benefits.length} 項已填寫` : "待填寫"}</p>
    </div>
  );
}
