"use client";
import Link from "next/link";
import Icon from "./Icon";
import { Logo } from "./Navigation";
import { useState } from "react";
import { LANGUAGE_LABELS, MARKET_CONFIG, MARKETS, LANGUAGES } from "@/lib/designSchema";
import type { InputPayload, TargetMarket, OutputLanguage } from "@/lib/designSchema";
import { validateInput } from "@/lib/inputValidation";
import type { InputErrors } from "@/lib/inputValidation";
import { isProductField, prepareInput } from "@/lib/workspaceData";
import { chooseTargetMarket, generationInput, mergeImport, projectDraft, updateDraft } from "@/lib/productDraft";
import type { ProductDraft } from "@/lib/productDraft";
import { productFingerprint, resultIsStale } from "@/lib/studioTypes";
import type { ConfirmationStatus, GenerationStatus } from "@/lib/studioTypes";
import { useStudioSource } from "./StudioProvider";
import ProductSummary from "./ProductSummary";
import ProductEditor from "./ProductEditor";
import ProductDataTools from "./ProductDataTools";
import AdvancedSettings from "./AdvancedSettings";
import BeforeAfter from "./BeforeAfter";
import DesignReview from "./DesignReview";
import { describeDesignChanges } from "@/lib/designSummary";
import ExportDesign from "./ExportDesign";
import SourcePicker from "./SourcePicker";
import Modal from "./Modal";
import Field, { fieldAttrs } from "./FormField";

const STYLES = [
  {
    label: "簡約",
    colors: ["#fff", "#b8a7ff"],
    value: "簡約：字體清晰，留白充足，營造沉穩的閱讀感。",
  },
  {
    label: "科技感",
    colors: ["#17171d", "#8fa5ff"],
    value:
      "科技感：排版俐落，採用簡潔的現代科技風格。",
  },
  {
    label: "溫暖親切",
    colors: ["#fff5ea", "#efad88"],
    value: "溫暖親切：語調友善，採用柔和的視覺元素。",
  },
];
export default function DesignSetup() {
  const store = useStudioSource();
  const { source, product, target, design, confirmed, setConfirmed, result, setResult } = store;
  const form = projectDraft(product, target, design);
  const input = prepareInput(form);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorErrors, setEditorErrors] = useState<InputErrors>({});
  const [errors, setErrors] = useState<InputErrors>({});
  const [jsonOpen, setJsonOpen] = useState(false);
  const [jsonMessage, setJsonMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmation, setConfirmation] = useState<ConfirmationStatus>("draft");
  const [generation, setGeneration] = useState<GenerationStatus>(result ? "success" : "idle");
  const [generationError, setGenerationError] = useState("");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [generationMode, setGenerationMode] = useState<"live" | "demo">(result?.mode ?? "live");
  const [accessToken, setAccessToken] = useState("");
  const [accessOpen, setAccessOpen] = useState(false);
  const busy = store.generationLock;
  const loading = store.generating || generation === "loading";
  const [colorText, setColorText] = useState({
    allowed: design.brandColors.allowed.join(", "),
    forbidden: design.brandColors.forbidden.join(", "),
  });

  const metadata = source ? {
    kind: source.kind,
    id: source.id,
    ...(source.sourceMarket?.trim() ? { sourceMarket: source.sourceMarket.trim() } : {}),
    ...(source.sourceLanguage?.trim() ? { sourceLanguage: source.sourceLanguage.trim() } : {}),
    ...(source.kind === "image"
      ? { name: source.name, mime: source.mime, width: source.width, height: source.height }
      : { name: "LearnLoop AI" }),
  } : undefined;
  const effectiveInput = generationInput(form, target, store.instructions, metadata);
  const isConfirmed = Boolean(confirmed && effectiveInput && confirmed === productFingerprint(effectiveInput));

  function change(next: InputPayload) {
    store.setDesign({ designGoal: next.designGoal, brandStyle: next.brandStyle, brandColors: next.brandColors });
    setErrors({});
  }
  function markDirty() {
    if (confirmed || confirmation === "confirmed") setConfirmation("dirty");
    setConfirmed("");
    setErrors({});
    setEditorErrors({});
    setNotice("");
  }
  function switchMarket(market: TargetMarket | "") {
    if (market === target.market) return;
    markDirty();
    store.setTarget(chooseTargetMarket(target, market));
  }
  function replaceProduct(incoming: ProductDraft, mode: "fill" | "replace", market?: TargetMarket) {
    markDirty();
    store.setProduct((current) => mergeImport(current, incoming, mode));
    if (market) store.setTarget(chooseTargetMarket(target, market));
    setEditorOpen(true);
    setNotice("已匯入資料，請核對並確認。");
  }
  function productIssues() {
    return Object.fromEntries(Object.entries(validateInput({ ...input, designGoal: "preserve" }))
      .filter(([field]) => isProductField(field) && (target.market || !field.startsWith("subscriptionPlans"))));
  }
  function saveProduct() {
    const issues = productIssues();
    setEditorErrors(issues);
    if (Object.keys(issues).length) {
      requestAnimationFrame(() => document.querySelector<HTMLElement>('dialog[open] [aria-invalid="true"]')?.focus());
      return;
    }
    setEditorOpen(false);
    setNotice("資料已儲存，請確認產品資料後生成。");
  }
  function targetIssues(): InputErrors {
    return {
      ...(!target.market ? { targetMarket: "請選擇目標市場。" } : {}),
      ...(!target.language ? { outputLanguage: "請選擇輸出語言。" } : {}),
    };
  }
  function confirmProduct() {
    setConfirmation("validating");
    const issues = { ...targetIssues(), ...productIssues() };
    setErrors(issues);
    if (!effectiveInput || Object.keys(issues).length) {
      setConfirmed("");
      setConfirmation("error");
      if (target.market && Object.keys(productIssues()).length) {
        setEditorErrors(productIssues());
        setEditorOpen(true);
      }
      return;
    }
    setConfirmed(productFingerprint(effectiveInput));
    setConfirmation("confirmed");
    setNotice("產品資料已確認。");
  }
  function prepareGenerationInput(): InputPayload | null {
    const issues = effectiveInput ? validateInput(effectiveInput) : targetIssues();
    if (!source) issues.form = "請先提供原始頁面或使用示例。";
    if (!isConfirmed) issues.confirmation = "請先確認產品資料。";
    setErrors(issues);
    return source && effectiveInput && !Object.keys(issues).length ? structuredClone(effectiveInput) : null;
  }
  async function handleGenerate(token = accessToken) {
    if (busy.current) return;
    busy.current = true;
    setGeneration("validating");
    setGenerationError("");
    const payload = prepareGenerationInput();
    if (!payload) {
      setGeneration("error");
      setGenerationError("請完成來源及產品資料確認後重試。");
      busy.current = false;
      return;
    }
    setReviewOpen(false);
    setGeneration("loading");
    store.setGenerating(true);
    try {
      if (generationMode === "live") {
        const { generateRealDesign } = await import("@/lib/generationClient");
        setResult(
          await generateRealDesign(payload, source!, confirmed, token),
        );
        setGeneration("success");
        return;
      }
      const started = performance.now();
      const engine = await import("@/lib/demoEngine");
      const spec = engine.validateDesignSpec(
        engine.simulateDesign(payload),
        payload,
      );
      const audit = engine.auditDesign(payload, spec);
      setResult({
        inputSnapshot: payload,
        sourceId: source!.id,
        spec,
        audit,
        mode: "demo",
        generationDurationMs: Math.round(performance.now() - started),
      });
      setGeneration("success");
    } catch (e) {
      setGeneration("error");
      if (e instanceof Error && "code" in e && e.code === "ACCESS_DENIED") setAccessOpen(true);
      const safe =
        e instanceof Error &&
        (generationMode === "demo" || e.name === "ClientGenerationError");
      const id =
        safe && "requestId" in e && typeof e.requestId === "string"
          ? ` 請求編號：${e.requestId}`
          : "";
      setGenerationError(
        safe ? `${e.message}${id}` : "生成失敗，原始圖片與輸入已保留。",
      );
    } finally {
      busy.current = false;
      store.setGenerating(false);
    }
  }
  const reviewedJson = jsonOpen ? JSON.stringify({ source: metadata, target, product, input: effectiveInput, confirmed: isConfirmed }, null, 2) : "";
  const goalError = target.market ? validateInput(input).designGoal : undefined;
  const goalErrors = goalError ? { ...errors, designGoal: goalError } : errors;
  const style =
    STYLES.find((s) => s.value === input.brandStyle)?.value ?? "custom";
  const stale = Boolean(
    result && (!isConfirmed || resultIsStale(result, effectiveInput, source)),
  );
  const status = loading
    ? "loading"
    : stale && generation !== "error"
      ? "stale"
      : generation === "idle" && result
        ? "success"
        : generation;
  const confirmationState = isConfirmed ? "confirmed" : confirmation === "dirty" || confirmation === "confirmed" ? "updated" : confirmation === "validating" ? "checking" : confirmation;
  const confirmationText = {
    confirmed: "訂閱資料已確認",
    draft: "訂閱資料待確認",
    updated: "資料已更新，請重新確認",
    checking: "正在檢查資料……",
    error: "部分訂閱資料需要修正",
  }[confirmationState];
  return (
    <main className={loading ? "studio-page initial-studio is-generating" : "studio-page initial-studio"} aria-busy={loading}>
      <header className="studio-nav">
        <Logo />
        <span className="studio-divider" />
        <span className="studio-title">設計工作台</span>
        <Link className="back-home" href="/">返回首頁</Link>
      </header>
      <div className="studio-shell">
      <aside className="setup-panel" aria-labelledby="setup-title">
        <div className="setup-heading"><h1 id="setup-title">設計設定</h1></div>
        <section className="studio-section" aria-label="原始訂閱頁面">
          <h2>原始訂閱頁面 *</h2>
          <SourcePicker compact />
        </section>
        <section className="studio-section input-stack" aria-label="目標市場與語言">
          <h2>目標市場與語言</h2>
          <Field label="目標市場 *" path="targetMarket" errors={errors}>
            <select {...fieldAttrs("targetMarket", errors)} required value={target.market} onChange={(event) => switchMarket(event.target.value as TargetMarket | "")}>
              <option value="">請選擇目標市場</option>
              {MARKETS.map((market) => <option key={market} value={market}>{MARKET_CONFIG[market].label}</option>)}
            </select>
          </Field>
          <Field label="輸出語言 *" path="outputLanguage" errors={errors}>
            <select {...fieldAttrs("outputLanguage", errors)} required value={target.language} onChange={(event) => {
              store.setTarget({ ...target, language: event.target.value as OutputLanguage | "", languageChosen: Boolean(event.target.value) });
              setErrors({});
            }}>
              <option value="">請選擇輸出語言</option>
              {LANGUAGES.map((language) => <option key={language} value={language}>{LANGUAGE_LABELS[language]}</option>)}
            </select>
          </Field>
        </section>
        <section className="product-data-module" aria-label="產品與訂閱資料">
          <div className="product-data-header">
            <h2>產品與訂閱資料</h2>
            <span className={"data-status state-" + confirmationState}>{isConfirmed ? "資料已確認" : confirmationState === "error" ? "需要修正" : confirmationState === "updated" ? "需要重新確認" : confirmationState === "checking" ? "檢查中" : "待確認"}</span>
          </div>
          <ProductSummary input={input} market={target.market} onEdit={() => setEditorOpen(true)} />
          {target.market && !input.subscriptionPlans.some((plan) => Number.isSafeInteger(plan.price.amountMinor)) && (
            <p className="helper">請填寫{MARKET_CONFIG[target.market].label}市場的訂閱價格。</p>
          )}
          {product.importedMetadata?.language && <p className="helper">匯入檔標示語言 · {LANGUAGE_LABELS[product.importedMetadata.language]}</p>}
          <ProductDataTools product={product} market={target.market} onImport={replaceProduct} onReview={() => { setJsonMessage(""); setJsonOpen(true); }} />
          <div className={"product-confirmation confirmation-row state-" + confirmationState}>
            <div className="confirmation-copy">
              <span><Icon name={isConfirmed ? "check" : confirmation === "error" ? "close" : "info"} size={18} /></span>
              <div><b role="status">{confirmationText}</b><p>請核對套餐價格、試用條款及會員權益。</p></div>
            </div>
            <button className={isConfirmed ? "confirmation-secondary" : "confirmation-primary"} type="button" onClick={isConfirmed ? () => setEditorOpen(true) : confirmProduct}>
              {isConfirmed ? "重新檢視資料" : "確認產品資料"}
            </button>
          </div>
        </section>
        <section className="studio-section input-stack" aria-label="本地化設計要求">
          <h2>本地化設計要求</h2>
          <Field label="設計目標（選填）" path="designGoal" errors={goalErrors}>
            <select
              {...fieldAttrs("designGoal", goalErrors)}
              value={input.designGoal}
              onChange={(e) =>
                change({
                  ...input,
                  designGoal: e.target.value as InputPayload["designGoal"],
                })
              }
            >
              <option value="preserve">維持原有展示重點</option>
              <option value="annual">突出年費方案</option>
              <option value="trial">突出免費試用</option>
              <option value="benefits">突出會員權益</option>
            </select>
          </Field>
          <div className="input-block" role="group" aria-labelledby="visualStyle">
            <label id="visualStyle">視覺風格</label>
            <div className="style-options">
              {STYLES.map((option) => (
                <button type="button" key={option.label} className={style === option.value ? "active" : ""}
                  aria-pressed={style === option.value} onClick={() => change({ ...input, brandStyle: option.value })}>
                  <span aria-hidden="true">{option.colors.map((color) => <i key={color} style={{ background: color }} />)}</span>
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <Field label="補充要求（選填）" path="additionalInstructions" errors={errors}>
            <textarea
              {...fieldAttrs("additionalInstructions", errors)}
              rows={3}
              value={store.instructions}
              onChange={(e) => {
                store.setInstructions(e.target.value);
                setErrors({});
              }}
              placeholder="描述你希望如何調整訂閱頁面……"
            />
          </Field>
        <AdvancedSettings
          input={input}
          errors={errors}
          colorText={colorText}
          onColorChange={(key, text) => {
            setColorText({ ...colorText, [key]: text });
            change({
              ...input,
              brandColors: {
                ...input.brandColors,
                [key]: text.trim() ? text.split(",").map((c) => c.trim()) : [],
              },
            });
          }}
          onChange={change}
        />
        </section>
        <div className="generate-wrap">
          <Field label="生成模式" path="generationMode">
            <select
              id="generationMode"
              value={generationMode}
              disabled={loading}
              onChange={(e) => {
                setGenerationMode(e.target.value as "live" | "demo");
                setGenerationError("");
              }}
            >
              <option value="live">DeepSeek 生成</option>
              <option value="demo">本機生成</option>
            </select>
          </Field>
          <button
            type="button"
            className="generate-button"
            onClick={() => void handleGenerate()}
            disabled={loading || generation === "validating"}
          >
            {loading ? <span className="spinner" /> : <Icon name="sparkles" size={19} />}
            {loading ? "正在生成設計…" : "生成本地化設計"}
            <Icon name="arrow" size={18} />
          </button>
          <p>
            {generationMode === "live"
              ? "原始頁面及已確認資料將傳送至 DeepSeek 作設計參考。"
              : "使用本機規則按已確認資料生成。"}
          </p>
        </div>
        {Object.keys(errors).length > 0 && (
          <div className="setup-errors" role="alert">
            {Object.entries(errors).map(([key, message]) => (
              <p key={key}>{message}</p>
            ))}
          </div>
        )}
        <p className="workspace-notice" role="status">
          {notice}
        </p>
      </aside>
      <section className="workspace" aria-labelledby="workspace-title">
        <div className="workspace-header">
          <h2 id="workspace-title">{reviewOpen ? "設計檢查" : result ? "訂閱頁面對比" : "訂閱頁面預覽"}</h2>
          {reviewOpen ? (
            <button className="return-comparison" onClick={() => setReviewOpen(false)}>
              <Icon name="arrow" size={17} />返回頁面對比
            </button>
          ) : status !== "stale" && (
            <span className={"initial-state-badge state-" + status} role="status">
              {status === "loading" ? "生成中" : status === "error" ? "生成失敗" : result ? "本地化設計已生成" : "等待生成"}
            </span>
          )}
        </div>
        <div className="workspace-body">
          {!reviewOpen && <>
            {stale && (
              <div className="result-stale-alert stale-banner" role="status">
                <Icon name="info" size={18} />
                <div><b>設計要求已更新，請重新生成</b><p>目前顯示的是上一次生成結果，請重新生成以套用新設定。</p></div>
              </div>
            )}
            {generationError && (
              <div className="generation-error-banner error-banner" role="alert">
                <span><Icon name="close" size={19} /></span>
                <div><b>未能完成本地化設計</b><p>{generationError}</p></div>
                <button onClick={() => void handleGenerate()} disabled={loading}>重試生成</button>
              </div>
            )}
            <BeforeAfter source={source} generated={result} loading={loading} />
            {result?.mode === "live" && result.meta?.visualAnalysis.status === "limited" && (
              <p className="helper" role="status">原圖部分內容未能清楚辨識，請核對預覽及設計檢查。</p>
            )}
            {result && !loading && (
              <section className="result-summary">
                <div className="result-section-heading">
                  <div><h3>本次設計改動</h3>{result.mode === "live" && <span>DeepSeek</span>}</div>
                </div>
                <div className="result-summary-grid">
                  {describeDesignChanges(result).map(({ title, description }) => (
                    <article key={title}>
                      <span><Icon name="sparkles" /></span>
                      <div><b>{title}</b><p>{description}</p></div>
                    </article>
                  ))}
                </div>
              </section>
            )}
          </>}
          <DesignReview result={result} stale={stale} open={reviewOpen} onOpen={() => setReviewOpen(true)} />
          {result && !loading && <ExportDesign result={result} stale={stale} />}
        </div>
      </section>
      </div>
      <ProductEditor open={editorOpen} draft={form} market={target.market} errors={editorErrors} onChange={(next) => {
        markDirty();
        store.setProduct((current) => updateDraft(current, target.market, next));
      }} onClose={() => setEditorOpen(false)} onSave={saveProduct} />
      <Modal open={jsonOpen} onClose={() => setJsonOpen(false)} title="完整輸入資料">
        <p>這是目前的產品草稿與設計設定。生成時使用重新確認的目標市場資料。</p>
        <button className="secondary" type="button" onClick={async () => {
          try {
            await navigator.clipboard.writeText(reviewedJson);
            setJsonMessage("已複製 JSON。");
          } catch {
            setJsonMessage("未能存取剪貼簿，請選取文字複製。");
          }
        }}>複製 JSON</button>
        {jsonMessage && <p role="status">{jsonMessage}</p>}
        <pre tabIndex={0} aria-label="Reviewed InputPayload JSON">
          {reviewedJson}
        </pre>
      </Modal>
      <Modal open={accessOpen} onClose={() => setAccessOpen(false)} title="存取驗證">
        <form onSubmit={(event) => {
          event.preventDefault();
          setAccessOpen(false);
          void handleGenerate(accessToken);
        }}>
          <Field label="工作區存取碼" path="generationAccessToken">
            <input id="generationAccessToken" type="password" autoComplete="off" required value={accessToken} onChange={(event) => setAccessToken(event.target.value)} />
          </Field>
          <button className="primary" type="submit">驗證並重試</button>
        </form>
      </Modal>
    </main>
  );
}
