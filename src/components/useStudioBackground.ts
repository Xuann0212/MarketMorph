"use client";
import { useEffect, useRef, useState } from "react";
import { BACKGROUND_PATH, backgroundSettingsSchema, defaultBackgroundSettings } from "@/lib/background";
import type { BackgroundSettings, StudioBackground } from "@/lib/background";

export function useStudioBackground() {
  const [asset, setAsset] = useState<StudioBackground | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const operation = useRef(0);
  const processing = useRef(false);
  const currentUrl = useRef<string | null>(null);
  function release() {
    if (currentUrl.current) URL.revokeObjectURL(currentUrl.current);
    currentUrl.current = null;
  }
  useEffect(() => () => {
    operation.current++;
    if (currentUrl.current) URL.revokeObjectURL(currentUrl.current);
  }, []);

  async function upload(file: File) {
    if (processing.current) return;
    processing.current = true;
    const request = ++operation.current;
    setBusy(true);
    setError("");
    try {
      const { prepareBackgroundImage } = await import("@/lib/backgroundImage");
      const { image, width, height, originalWidth, originalHeight } = await prepareBackgroundImage(file);
      if (operation.current !== request) return;
      const assetId = crypto.randomUUID();
      const url = URL.createObjectURL(image);
      release();
      currentUrl.current = url;
      setAsset({
        image, url, originalWidth, originalHeight,
        config: {
          ...defaultBackgroundSettings, type: "uploaded", assetId,
          assetPath: BACKGROUND_PATH, originalName: file.name.slice(0, 255),
          width, height, mimeType: "image/png", fit: "cover",
        },
      });
    } catch (cause) {
      if (operation.current === request) {
        setError(cause instanceof Error ? cause.message : "未能處理圖片，請重新選擇。");
      }
    } finally {
      processing.current = false;
      if (operation.current === request) setBusy(false);
    }
  }
  function remove() {
    operation.current++;
    release();
    setAsset(null);
    setError("");
    setBusy(false);
  }
  function adjust(id: string, settings: BackgroundSettings) {
    const parsed = backgroundSettingsSchema.safeParse(settings);
    if (parsed.success) {
      setAsset((previous) => previous?.config.assetId === id
        ? { ...previous, config: { ...previous.config, ...parsed.data } }
        : previous);
    }
  }
  return { asset, busy, error, upload, remove, adjust };
}
