"use client";
import Link from "next/link";
import Icon from "./Icon";
import { Logo } from "./Navigation";
import { useState } from "react";
import { LANGUAGE_LABELS, MARKET_CONFIG, MARKETS, LANGUAGES } from "@/lib/designSchema";
import type { InputPayload, TargetMarket, OutputLanguage, PageSection } from "@/lib/designSchema";
import { validateInput } from "@/lib/inputValidation";
import type { InputErrors } from "@/lib/inputValidation";
import { paywallCopyIssues } from "@/lib/paywallContent";
import { isProductField, prepareInput } from "@/lib/workspaceData";
import { chooseTargetMarket, generationInput, mergeImport, projectDraft, updateDraft } from "@/lib/productDraft";
import type { ProductDraft } from "@/lib/productDraft";
import { productFingerprint, resultIsStale } from "@/lib/studioTypes";
import type { ConfirmationStatus, GenerationStatus } from "@/lib/studioTypes";
import type { AiAvailability } from "@/lib/generationTypes";
import type { ImageInspection } from "@/lib/imageInspection";
import { useStudioSource } from "./StudioProvider";
import ProductSummary from "./ProductSummary";
import ProductEditor from "./ProductEditor";
import ProductDataTools from "./ProductDataTools";
import AdvancedSettings from "./AdvancedSettings";
import BackgroundPicker from "./BackgroundPicker";
import BeforeAfter from "./BeforeAfter";
import DesignReview from "./DesignReview";
import ResultChanges from "./ResultChanges";
import CopyEditor from "./CopyEditor";
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
const AREA_LABELS = { top: "原圖上方", middle: "原圖中段", bottom: "原圖下方", unknown: "位置待核對" };
export default function DesignSetup({ aiStatus = "available" }: { aiStatus?: AiAvailability }) {
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
  const generationMode = aiStatus === "unavailable" ? "demo" : store.mode ?? result?.mode ??
    (aiStatus === "requires-code" ? "demo" : "live");
  const [accessToken, setAccessToken] = useState("");
  const [accessDraft, setAccessDraft] = useState("");
  const [accessError, setAccessError] = useState("");
  const [accessOpen, setAccessOpen] = useState<"generate" | "inspect" | null>(null);
  const [inspecting, setInspecting] = useState(false);
  const [inspection, setInspection] = useState<{ sourceId: string; data?: ImageInspection; error?: string }>();
  const [locate, setLocate] = useState<{ section: PageSection }>();
  const [copyOpen, setCopyOpen] = useState(false);
  const busy = store.generationLock;
  const loading = store.generating || generation === "loading";
  const currentInspection = inspection?.sourceId === source?.id ? inspection : undefined;
  const [colorEdit, setColorEdit] = useState<{ colors: typeof design.brandColors; key: "allowed" | "forbidden"; text: string }>();
  const colorText = {
    allowed: design.brandColors.allowed.join(", "),
    forbidden: design.brandColors.forbidden.join(", "),
    ...(colorEdit?.colors === design.brandColors ? { [colorEdit.key]: colorEdit.text } : {}),
  };

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
    setNotice("草稿已更新，請確認訂閱資料後生成。");
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
      } else if (Object.keys(issues).length) {
        focusIssue(Object.keys(issues)[0]);
      }
      return;
    }
    setConfirmed(productFingerprint(effectiveInput));
    setConfirmation("confirmed");
    setNotice("產品資料已確認。");
  }
  function focusIssue(field: string) {
    if (isProductField(field)) {
      setEditorErrors({ ...productIssues(), ...copyIssues });
      setEditorOpen(true);
    }
    requestAnimationFrame(() => {
      const element = document.getElementById(field === "form" ? "studio-source" : field);
      if (element?.closest("details")) element.closest("details")!.open = true;
      const control = element?.matches("input, select, textarea, button") ? element
        : element?.querySelector<HTMLElement>("button:not(:disabled)") ?? element;
      control?.focus({ preventScroll: true });
      control?.scrollIntoView?.({ block: "center" });
    });
  }
  const copyIssues = effectiveInput ? paywallCopyIssues(effectiveInput, generationMode) : {};
  const blockers: InputErrors = {
    ...(!source ? { form: "請先提供原始頁面或使用示例。" } : {}),
    ...targetIssues(),
    ...(target.market ? productIssues() : {}),
    ...(!isConfirmed ? { confirmation: "請先確認訂閱資料。" } : {}),
    ...(effectiveInput ? validateInput(effectiveInput) : {}),
    ...copyIssues,
  };
  const firstBlocker = Object.entries(blockers)[0];
  const currentStep = !source || !target.market || !target.language ? 0 : !isConfirmed ? 1 : 2;
  function prepareGenerationInput(): InputPayload | null {
    setErrors(blockers);
    return source && effectiveInput && !firstBlocker ? structuredClone(effectiveInput) : null;
  }
  function jumpTo(id: string) {
    const section = document.getElementById(id);
    section?.focus({ preventScroll: true });
    section?.scrollIntoView?.({ block: "start" });
  }
  function showResult() {
    jumpTo("workspace-title");
  }
  function requestAccess(action: "generate" | "inspect", rejected = false) {
    if (rejected) setAccessToken("");
    setAccessDraft("");
    setAccessError(rejected ? "存取驗證失敗，請核對工作區存取碼。" : "");
    setAccessOpen(action);
  }
  async function handleGenerate(token = accessToken) {
    if (busy.current || inspecting) return;
    setGenerationError("");
    const payload = prepareGenerationInput();
    if (!payload) {
      if (firstBlocker) focusIssue(firstBlocker[0]);
      return;
    }
    if (generationMode === "live" && aiStatus === "requires-code" && !token.trim()) {
      requestAccess("generate");
      return;
    }
    busy.current = true;
    setReviewOpen(false);
    setLocate(undefined);
    setGeneration("loading");
    store.setGenerating(true);
    try {
      if (generationMode === "live") {
        const { generateRealDesign } = await import("@/lib/generationClient");
        setResult(
          await generateRealDesign(payload, source!, confirmed, token),
        );
        setGeneration("success");
      } else {
        const started = performance.now();
        const engine = await import("@/lib/demoEngine");
        const spec = engine.simulateDesign(payload);
        setResult({
          inputSnapshot: payload,
          sourceId: source!.id,
          spec,
          audit: engine.auditDesign(payload, spec),
          mode: "demo",
          generationDurationMs: Math.round(performance.now() - started),
        });
        setGeneration("success");
      }
      if (window.matchMedia?.("(max-width: 800px)").matches) {
        requestAnimationFrame(showResult);
      }
    } catch (e) {
      setGeneration("error");
      if (e instanceof Error && "code" in e && e.code === "ACCESS_DENIED") requestAccess("generate", true);
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
  async function handleInspect(token = accessToken) {
    if (source?.kind !== "image" || aiStatus === "unavailable" || busy.current || inspecting) return;
    if (aiStatus === "requires-code" && !token.trim()) {
      requestAccess("inspect");
      return;
    }
    setInspecting(true);
    setInspection(undefined);
    try {
      const { inspectSource } = await import("@/lib/generationClient");
      setInspection({ sourceId: source.id, data: await inspectSource(source, token) });
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ACCESS_DENIED") requestAccess("inspect", true);
      setInspection({ sourceId: source.id, error: error instanceof Error && error.name === "ClientGenerationError"
        && !("code" in error && error.code === "DESIGN_INVALID")
        ? error.message : "未能辨識原圖，請重試或手動填寫。" });
    } finally {
      setInspecting(false);
    }
  }
  const reviewedJson = jsonOpen ? JSON.stringify({ source: metadata, target, product, input: effectiveInput, confirmed: isConfirmed }, null, 2) : "";
  const goalError = target.market ? blockers.designGoal : undefined;
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
  function switchMode(mode: "live" | "demo") {
    store.setMode(mode);
    setGenerationError("");
    setGeneration(result ? "success" : "idle");
    setAccessOpen(null);
  }
  function editIssue(section: "product" | "brand") {
    if (section === "product") setEditorOpen(true);
    else focusIssue("brandColors.allowed");
  }
  function closeCopy() {
    setCopyOpen(false);
    requestAnimationFrame(() => document.getElementById("edit-result-copy")?.focus());
  }
  const candidateList = currentInspection?.data && (
    <>
      <p className="helper">請對照原圖，並使用已核實的目標市場資料填寫價格與試用條款。</p>
      {currentInspection.data.status === "limited" && <p className="helper">部分文字未能清楚辨識。</p>}
      {currentInspection.data.candidates.length ? (
        <ul>{currentInspection.data.candidates.map(({ label, text, area }, index) => (
          <li key={index}><strong>{label}</strong> <small>{AREA_LABELS[area]}</small><p>{text}</p></li>
        ))}</ul>
      ) : <p className="helper">沒有可供核對的文字，請手動填寫資料。</p>}
    </>
  );
  return (
    <main className={loading ? "studio-page initial-studio is-generating" : "studio-page initial-studio"} aria-busy={loading}>
      <header className="studio-nav">
        <Logo />
        <span className="studio-divider" />
        <span className="studio-title">設計工作台</span>
        <Link className="back-home" href="/">返回首頁</Link>
      </header>
      <nav className="studio-steps-nav" aria-label="工作台步驟">
        <ol className="studio-steps">
          {[
            { title: "設定市場", id: "targetMarket" },
            { title: "核對訂閱資料", id: "studio-product-title" },
            { title: "生成與檢查", id: result ? "workspace-title" : "generationMode" },
          ].map(({ title, id }, index) => (
            <li key={title}>
              <a href={"#" + id} aria-current={index === currentStep ? "step" : undefined}
                onClick={(event) => { event.preventDefault(); jumpTo(id); }}>
                <span aria-hidden="true">{index < currentStep ? "✓" : index + 1}</span>{title}
              </a>
            </li>
          ))}
        </ol>
      </nav>
      <div className="studio-shell">
      <aside className="setup-panel" aria-labelledby="setup-title">
        <div className="setup-scroll">
        <div className="setup-heading"><h1 id="setup-title">設計設定</h1></div>
        {store.restoredAt && <div className="restored-draft">
          <p className="helper">已恢復草稿 · {new Date(store.restoredAt).toLocaleString("zh-HK")}</p>
          {result && <button className="text-button" type="button" onClick={showResult}>查看已恢復的結果 →</button>}
        </div>}
        {store.draftError && <p className="helper" role="status">此瀏覽器未能保存草稿。</p>}
        {(source || target.market || result || store.restoredAt) && <details className="draft-controls">
          <summary>此瀏覽器的草稿</summary>
          <p className="helper">會保存設定、訂閱資料及最近結果。重新整理後，請重新選擇上傳的圖片。</p>
          <button className="text-button" type="button" disabled={loading || inspecting} onClick={() => {
            store.forgetDraft();
            setAccessToken("");
            markDirty();
            setReviewOpen(false);
            setGeneration("idle");
            setGenerationError("");
          }}>清除草稿與結果</button>
        </details>}
        <section className="studio-section" id="studio-source" tabIndex={-1} aria-label="原始訂閱頁面">
          <h2>原始訂閱頁面 *</h2>
          <SourcePicker compact />
          {source?.kind === "image" && aiStatus !== "unavailable" && (
            <div className="source-inspection">
              <p className="helper">辨識會將原圖傳送至 DeepSeek，擷取可見文字供核對。</p>
              <button className="secondary" type="button" disabled={loading || inspecting} onClick={() => void handleInspect()}>
                {inspecting ? "正在辨識原圖…" : currentInspection?.data ? "重新辨識原圖" : "辨識原圖資料"}
              </button>
              {currentInspection?.error && <p role="alert" className="error">{currentInspection.error}</p>}
              {candidateList && <section aria-label="待核對資料" aria-live="polite">
                <h3>待核對資料</h3>
                {candidateList}
                <button className="text-button" type="button" onClick={() => target.market
                  ? setEditorOpen(true) : focusIssue("targetMarket")}>核對並填寫訂閱資料 →</button>
              </section>}
            </div>
          )}
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
            <h2 id="studio-product-title" tabIndex={-1}>產品與訂閱資料</h2>
            <span className={"data-status state-" + confirmationState}>{isConfirmed ? "資料已確認" : confirmationState === "error" ? "需要修正" : confirmationState === "updated" ? "需要重新確認" : confirmationState === "checking" ? "檢查中" : "待確認"}</span>
          </div>
          <ProductSummary input={input} market={target.market} onEdit={() => setEditorOpen(true)} />
          {target.market && input.subscriptionPlans.some((plan) => !Number.isSafeInteger(plan.price.amountMinor)) && (
            <button className="text-button missing-price" type="button" onClick={() => focusIssue(
              "subscriptionPlans." + input.subscriptionPlans.findIndex((plan) => !Number.isSafeInteger(plan.price.amountMinor)) + ".price.amountMinor",
            )}>填寫{MARKET_CONFIG[target.market].label}市場的訂閱價格 →</button>
          )}
          {product.importedMetadata?.language && <p className="helper">匯入檔標示語言 · {LANGUAGE_LABELS[product.importedMetadata.language]}</p>}
          <ProductDataTools product={product} market={target.market} onImport={replaceProduct} onReview={() => { setJsonMessage(""); setJsonOpen(true); }} />
          <div className={"product-confirmation confirmation-row state-" + confirmationState}>
            <div className="confirmation-copy">
              <span><Icon name={isConfirmed ? "check" : confirmation === "error" ? "close" : "info"} size={18} /></span>
              <div><b role="status">{confirmationText}</b><p>請核對套餐價格、試用條款及會員權益。</p></div>
            </div>
            <button id="confirmation" className={isConfirmed ? "confirmation-secondary" : "confirmation-primary"} type="button" onClick={isConfirmed ? () => setEditorOpen(true) : confirmProduct}>
              {isConfirmed ? "重新檢視資料" : "確認訂閱資料"}
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
          <fieldset className="ai-fields">
          <legend>AI 設計偏好</legend>
          {generationMode === "demo" && <p className="helper">規則預覽會套用背景圖片。風格及補充要求只用於 AI 本地化。</p>}
          <fieldset className="ai-text-controls" disabled={generationMode === "demo"}>
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
          </fieldset>
          <BackgroundPicker tint={result?.spec.theme.background ?? "#ffffff"} />
          </fieldset>
        <AdvancedSettings
          input={input}
          errors={errors}
          colorText={colorText}
          aiEnabled={generationMode === "live"}
          onColorChange={(key, text) => {
            const colors = { ...design.brandColors, [key]: text.trim() ? text.split(",").map((c) => c.trim()) : [] };
            setColorEdit({ colors, key, text });
            change({
              ...input,
              brandColors: colors,
            });
          }}
          onChange={change}
        />
        </section>
        {Object.keys(errors).length > 0 && (
          <div className="setup-errors" role="alert">
            {Object.entries(errors).map(([key, message]) => (
              <button className="text-button" type="button" key={key} onClick={() => focusIssue(key)}>{message}</button>
            ))}
          </div>
        )}
        <p className="workspace-notice" role="status">{notice}</p>
        </div>
        <div className="generate-wrap">
          <Field label="生成模式" path="generationMode">
            <select
              id="generationMode"
              value={generationMode}
              disabled={loading}
              onChange={(e) => switchMode(e.target.value as "live" | "demo")}
            >
              <option value="demo">規則預覽</option>
              <option value="live" disabled={aiStatus === "unavailable"}>AI 本地化（DeepSeek）</option>
            </select>
          </Field>
          <p className="mode-explanation">
            {generationMode === "demo"
              ? "依已確認資料套用模板。補充要求與風格描述會保留，切換至 AI 本地化後才會應用。"
              : "生成時會將原圖、已確認資料及設計要求傳送至 DeepSeek。"}
          </p>
          {aiStatus === "unavailable" && <p>AI 本地化目前未開放。你可以使用規則預覽。</p>}
          {aiStatus === "requires-code" && <p>AI 本地化需要工作區存取碼。</p>}
          {!loading && firstBlocker && <button className="text-button blocker-link" type="button" onClick={() => focusIssue(firstBlocker[0])}>{firstBlocker[1]} →</button>}
          <button
            type="button"
            className="generate-button"
            onClick={() => void handleGenerate()}
            disabled={loading || inspecting || !store.draftReady}
          >
            {loading ? <span className="spinner" /> : <Icon name="sparkles" size={19} />}
            {loading ? "正在生成設計…" : "生成本地化設計"}
            <Icon name="arrow" size={18} />
          </button>
        </div>
      </aside>
      <section className="workspace" aria-labelledby="workspace-title">
        <div className="workspace-header">
          <h2 id="workspace-title" tabIndex={-1}>{reviewOpen ? "設計檢查" : result ? "訂閱頁面對比" : "訂閱頁面預覽"}</h2>
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
                <div><b>{source ? "設計要求已更新，請重新生成" : "請重新選擇原圖"}</b><p>目前顯示的是上一次生成結果。{source ? "請重新生成以套用新設定。" : "加入原圖後可重新生成。"}</p></div>
              </div>
            )}
            {generationError && (
              <div className="generation-error-banner error-banner" role="alert">
                <span><Icon name="close" size={19} /></span>
                <div><b>未能完成本地化設計</b><p>{generationError}</p></div>
                <div className="error-actions">
                  <button onClick={() => void handleGenerate()} disabled={loading}>重試生成</button>
                  {generationMode === "live" && <button onClick={() => switchMode("demo")} disabled={loading}>改用規則預覽</button>}
                </div>
              </div>
            )}
            {result && store.backgroundNeedsUpload && <p className="helper" role="status">此草稿的背景圖片需要重新上傳，目前顯示原有背景。</p>}
            <BeforeAfter source={source} generated={result} loading={loading} locate={locate} background={store.background.asset} />
            {result?.mode === "live" && result.meta?.visualAnalysis.status === "limited" && (
              <p className="helper" role="status">原圖部分內容未能清楚辨識，請核對預覽及設計檢查。</p>
            )}
            {result && !loading && (
              <ResultChanges result={result} uploadedBackground={Boolean(store.background.asset)} onLocate={(section) => setLocate({ section })}
                onEditCopy={!stale ? () => setCopyOpen(true) : undefined} />
            )}
          </>}
          <DesignReview result={result} stale={stale} open={reviewOpen} onOpen={() => setReviewOpen(true)}
            background={store.background.asset} onEditIssue={editIssue} onCompare={() => setReviewOpen(false)} />
          {result && !loading && <ExportDesign result={result} stale={stale} background={store.background.asset}
            backgroundBusy={store.background.busy} backgroundNeedsUpload={store.backgroundNeedsUpload} />}
        </div>
      </section>
      </div>
      {copyOpen && result && !stale && <CopyEditor result={result} onClose={closeCopy} onSave={(next) => {
        setResult(next);
        closeCopy();
      }} />}
      <ProductEditor open={editorOpen} draft={form} market={target.market} errors={editorErrors}
        reference={editorOpen && candidateList && source?.kind === "image" ? (
          <details className="source-inspection inspection-reference" open>
            <summary>待核對的原圖資料</summary>
            <a className="text-button" href={source.url} target="_blank" rel="noreferrer">查看原圖 ↗</a>
            {candidateList}
          </details>
        ) : undefined}
        onChange={(next) => {
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
      <Modal open={Boolean(accessOpen)} onClose={() => setAccessOpen(null)} title="AI 本地化需要工作區存取碼">
        <form onSubmit={(event) => {
          event.preventDefault();
          const action = accessOpen;
          const token = accessDraft.trim();
          if (!token) {
            setAccessError("請輸入工作區存取碼。");
            return;
          }
          setAccessToken(token);
          setAccessOpen(null);
          if (action === "inspect") void handleInspect(token);
          else void handleGenerate(token);
        }}>
          <Field label="工作區存取碼" path="generationAccessToken">
            <input id="generationAccessToken" type="password" autoComplete="off" required value={accessDraft} onChange={(event) => setAccessDraft(event.target.value)} />
          </Field>
          {accessError && <p role="alert" className="error">{accessError}</p>}
          <button className="primary" type="submit">{accessOpen === "inspect" ? "驗證並辨識" : "驗證並生成"}</button>
          <button className="text-button" type="button" onClick={() => switchMode("demo")}>改用規則預覽</button>
        </form>
      </Modal>
    </main>
  );
}
