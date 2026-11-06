"use client";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import example from "../../public/example_input.json";
import { parseProductData } from "@/lib/workspaceData";
import { blankProduct, defaultDesignSettings, toDraft } from "@/lib/productDraft";
import type { DesignSettings, ProductDraft, TargetSettings } from "@/lib/productDraft";
import { validateImageMetadata } from "@/lib/studioTypes";
import type { OriginalSource, UploadStatus, StudioResult } from "@/lib/studioTypes";

const sampleProduct = toDraft(parseProductData(example));

interface SharedStudio {
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
}
const Context = createContext<SharedStudio | null>(null);
export function useStudioSource() {
  const value = useContext(Context);
  if (!value) throw new Error("StudioProvider missing");
  return value;
}
export default function StudioProvider({ children }: { children: ReactNode }) {
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
      }}
    >
      {children}
    </Context.Provider>
  );
}
