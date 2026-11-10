"use client";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import example from "../../public/example_input.json";
import { parseProductData } from "@/lib/workspaceData";
import { blankProduct, defaultDesignSettings, toDraft } from "@/lib/productDraft";
import type { DesignSettings, ProductDraft, TargetSettings } from "@/lib/productDraft";
import { stableJson, validateImageMetadata } from "@/lib/studioTypes";
import type { OriginalSource, UploadStatus, StudioResult } from "@/lib/studioTypes";
import { restoreStudioDraft, STUDIO_DRAFT_KEY } from "@/lib/studioDraft";
import { useStudioBackground } from "./useStudioBackground";

const sampleProduct = toDraft(parseProductData(example));

interface SharedStudio {
  background: ReturnType<typeof useStudioBackground>;
  backgroundNeedsUpload: boolean;
  product: ProductDraft;
  setProduct: React.Dispatch<React.SetStateAction<ProductDraft>>;
  target: TargetSettings;
  setTarget: (target: TargetSettings) => void;
  design: DesignSettings;
  setDesign: (design: DesignSettings) => void;
  setSourceDetails: (details: Pick<OriginalSource, "sourceMarket" | "sourceLanguage">) => void;
  generationLock: { current: boolean };
  generating: boolean;
  setGenerating: (value: boolean) => void;
  result: StudioResult | null;
  setResult: (value: StudioResult | null) => void;
  confirmed: string;
  setConfirmed: (value: string) => void;
  source: OriginalSource | null;
  instructions: string;
  setInstructions: (text: string) => void;
  uploadStatus: UploadStatus;
  uploadError: string;
  loadImage: (file: File) => Promise<void>;
  removeSource: () => void;
  useDemo: () => void;
  draftReady: boolean;
  restoredAt: string;
  draftError: boolean;
  forgetDraft: () => void;
  mode?: "live" | "demo";
  setMode: (mode: "live" | "demo") => void;
}
const Context = createContext<SharedStudio | null>(null);
export function useStudioSource() {
  const value = useContext(Context);
  if (!value) throw new Error("StudioProvider missing");
  return value;
}
export default function StudioProvider({ children }: { children: ReactNode }) {
  const background = useStudioBackground();
  const hasBackground = Boolean(background.asset);
  const [backgroundNeedsUpload, setBackgroundNeedsUpload] = useState(false);
  const [source, setSource] = useState<OriginalSource | null>(null);
  const [product, setProduct] = useState(blankProduct);
  const [target, setTarget] = useState<TargetSettings>({ market: "", language: "", languageChosen: false });
  const [design, setDesign] = useState(defaultDesignSettings);
  const generationLock = useRef(false);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<StudioResult | null>(null);
  const [confirmed, setConfirmed] = useState("");
  const [instructions, setInstructions] = useState("");
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>("idle");
  const [uploadError, setUploadError] = useState("");
  const [draftReady, setDraftReady] = useState(false);
  const [restoredAt, setRestoredAt] = useState("");
  const [draftError, setDraftError] = useState(false);
  const [mode, setMode] = useState<"live" | "demo">();
  const lastSaved = useRef("");
  const sourceRef = useRef<OriginalSource | null>(null),
    operation = useRef(0);
  function assign(next: OriginalSource | null) {
    const old = sourceRef.current;
    sourceRef.current = next;
    setSource(next);
    if (
      old?.kind === "image" &&
      (next?.kind !== "image" || old.url !== next.url)
    )
      URL.revokeObjectURL(old.url);
  }
  useEffect(
    () => () => {
      operation.current++;
      if (sourceRef.current?.kind === "image")
        URL.revokeObjectURL(sourceRef.current.url);
    },
    [],
  );
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STUDIO_DRAFT_KEY);
      const saved = raw ? restoreStudioDraft(raw) : null;
      if (saved) {
        const { savedAt, ...snapshot } = saved;
        lastSaved.current = stableJson(snapshot);
        sourceRef.current = snapshot.source;
        setSource(snapshot.source);
        setProduct(stableJson(snapshot.product) === stableJson(sampleProduct) ? sampleProduct : snapshot.product);
        setTarget(snapshot.target);
        setDesign(snapshot.design);
        setInstructions(snapshot.instructions);
        setConfirmed(snapshot.confirmed);
        setResult(snapshot.result);
        setMode(snapshot.mode);
        setRestoredAt(savedAt);
        setBackgroundNeedsUpload(Boolean(snapshot.hadBackground));
      }
    } catch {
      // An unavailable store or an invalid saved draft leaves the workspace usable.
    }
    setDraftReady(true);
  }, []);
  useEffect(() => {
    if (!draftReady) return;
    try {
      const blank = !hasBackground && !source && !result && !instructions && !target.market && !target.language &&
        stableJson(product) === stableJson(blankProduct()) &&
        stableJson(design) === stableJson(defaultDesignSettings);
      const snapshot = {
        product, target, design, instructions, confirmed, mode,
        source: source?.kind === "demo" ? source : null,
        result: result && { ...result, meta: undefined, generationDurationMs: undefined },
        hadBackground: hasBackground || backgroundNeedsUpload,
      };
      const content = blank ? "" : stableJson(snapshot);
      if (content === lastSaved.current) return;
      if (blank) window.localStorage.removeItem(STUDIO_DRAFT_KEY);
      else window.localStorage.setItem(STUDIO_DRAFT_KEY, JSON.stringify({ savedAt: new Date().toISOString(), ...snapshot }));
      lastSaved.current = content;
      setDraftError(false);
    } catch {
      setDraftError(true);
    }
  }, [draftReady, product, target, design, instructions, confirmed, source, result, mode, hasBackground, backgroundNeedsUpload]);
  function forgetDraft() {
    operation.current++;
    assign(null);
    background.remove();
    setBackgroundNeedsUpload(false);
    setProduct(blankProduct());
    setTarget({ market: "", language: "", languageChosen: false });
    setDesign(defaultDesignSettings);
    setInstructions("");
    setConfirmed("");
    setResult(null);
    setMode(undefined);
    setRestoredAt("");
    setUploadStatus("idle");
    setUploadError("");
  }
  function useDemo() {
    operation.current++;
    assign({ kind: "demo", id: "learnloop-demo-" + crypto.randomUUID(), sourceMarket: "US", sourceLanguage: "en" });
    setProduct((current) => !current.facts.productName && !Object.keys(current.offersByMarket).length
      ? sampleProduct : current);
    setUploadError("");
    setUploadStatus("success");
  }
  function removeSource() {
    operation.current++;
    assign(null);
    setUploadError("");
    setUploadStatus("removed");
  }
  async function loadImage(file: File) {
    const token = ++operation.current;
    setUploadStatus(sourceRef.current ? "replacing" : "validating");
    setUploadError("");
    let url: string | null = null;
    try {
      const error = validateImageMetadata(file);
      if (error) throw new Error(error);
      url = URL.createObjectURL(file);
      const dimensions = await new Promise<{ width: number; height: number }>(
        (resolve, reject) => {
          const image = new Image();
          image.onload = () =>
            resolve({ width: image.naturalWidth, height: image.naturalHeight });
          image.onerror = () =>
            reject(new Error("無法讀取圖片，請更換有效檔案。"));
          image.src = url!;
        },
      );
      if (!dimensions.width || !dimensions.height)
        throw new Error("圖片尺寸無效。 ");
      if (token !== operation.current) {
        URL.revokeObjectURL(url);
        return;
      }
      setProduct((current) => current === sampleProduct ? blankProduct() : current);
      assign({
        kind: "image",
        id: crypto.randomUUID(),
        url,
        name: file.name,
        mime: file.type,
        size: file.size,
        ...dimensions,
      });
      setUploadStatus("success");
    } catch (error) {
      if (url) URL.revokeObjectURL(url);
      if (token === operation.current) {
        setUploadError(
          error instanceof Error ? error.message : "無法讀取圖片。",
        );
        setUploadStatus("error");
      }
    }
  }
  return (
    <Context.Provider
      value={{
        background: {
          ...background,
          remove: () => { background.remove(); setBackgroundNeedsUpload(false); },
        },
        backgroundNeedsUpload: backgroundNeedsUpload && !hasBackground,
        product,
        setProduct,
        target,
        setTarget,
        design,
        setDesign,
        setSourceDetails: (details) => {
          if (sourceRef.current?.kind === "image") assign({ ...sourceRef.current, ...details });
        },
        generationLock,
        generating,
        setGenerating,
        result,
        setResult,
        confirmed,
        setConfirmed,
        source,
        instructions,
        setInstructions,
        uploadStatus,
        uploadError,
        loadImage,
        removeSource,
        useDemo,
        draftReady,
        restoredAt,
        draftError,
        forgetDraft,
        mode,
        setMode,
      }}
    >
      {children}
    </Context.Provider>
  );
}
