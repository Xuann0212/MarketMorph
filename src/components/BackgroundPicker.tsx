"use client";
import { useLayoutEffect, useRef, useState } from "react";
import { defaultBackgroundSettings } from "@/lib/background";
import type { BackgroundSettings, StudioBackground } from "@/lib/background";
import { useStudioSource } from "./StudioProvider";
import Icon from "./Icon";
import Modal from "./Modal";
import PaywallBackground from "./PaywallBackground";

function CropEditor({ asset, tint, onClose, onConfirm }: {
  asset: StudioBackground;
  tint: string;
  onClose: () => void;
  onConfirm: (settings: BackgroundSettings) => void;
}) {
  const { focalPoint, scale, overlayOpacity } = asset.config;
  const [settings, setSettings] = useState<BackgroundSettings>({ focalPoint, scale, overlayOpacity });
  const [ratio, setRatio] = useState<number>();
  const measure = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const viewport = document.querySelector<HTMLElement>(".generated-side .paywall-viewport");
    const device = measure.current;
    const update = () => {
      const frame = viewport?.clientWidth && viewport.clientHeight ? viewport : device;
      if (frame?.clientWidth && frame.clientHeight) setRatio(frame.clientWidth / frame.clientHeight);
    };
    update();
    // Native dialogs become measurable after showModal.
    const observer = new ResizeObserver(update);
    if (device) observer.observe(device);
    if (viewport) observer.observe(viewport);
    return () => observer.disconnect();
  }, []);
  function slider(label: string, value: number, min: number, max: number, update: (next: number) => void) {
    return <label className="background-slider"><span>{label} · {value}%</span>
      <input type="range" min={min} max={max} value={value} onChange={(event) => update(event.target.valueAsNumber)} />
    </label>;
  }
  return (
    <Modal open onClose={onClose} title="調整背景圖片裁切">
      <div className="background-editor">
        <div ref={measure} className="phone generated background-device-measure" aria-hidden="true" />
        <div className="phone generated background-crop-device" style={ratio ? { aspectRatio: ratio, height: "auto", width: "min(100%, 260px)" } : undefined}>
          <PaywallBackground asset={asset} tint={tint} settings={settings} />
        </div>
        <div className="background-controls">
          <p className="helper">按訂閱頁面比例裁切。若圖片在某個方向已填滿畫面，可先放大再移動焦點。</p>
          {slider("水平焦點", Math.round(settings.focalPoint.x * 100), 0, 100, (x) => setSettings({ ...settings, focalPoint: { ...settings.focalPoint, x: x / 100 } }))}
          {slider("垂直焦點", Math.round(settings.focalPoint.y * 100), 0, 100, (y) => setSettings({ ...settings, focalPoint: { ...settings.focalPoint, y: y / 100 } }))}
          {slider("縮放", Math.round(settings.scale * 100), 100, 200, (scale) => setSettings({ ...settings, scale: scale / 100 }))}
          {slider("遮罩強度", Math.round(settings.overlayOpacity * 100), 20, 90, (overlayOpacity) => setSettings({ ...settings, overlayOpacity: overlayOpacity / 100 }))}
          <div className="button-row">
            <button className="secondary" type="button" onClick={() => setSettings(defaultBackgroundSettings)}>恢復預設</button>
            <button className="primary" type="button" onClick={() => onConfirm(settings)}>確認裁切</button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default function BackgroundPicker({ tint }: { tint: string }) {
  const { background, backgroundNeedsUpload } = useStudioSource();
  const { asset, busy, error, upload, remove, adjust } = background;
  const input = useRef<HTMLInputElement>(null);
  const cropButton = useRef<HTMLButtonElement>(null);
  const [editing, setEditing] = useState(false);
  const [dragging, setDragging] = useState(false);
  function closeEditor() {
    setEditing(false);
    requestAnimationFrame(() => cropButton.current?.focus());
  }
  return (
    <section className="background-picker" aria-labelledby="background-label">
      <h3 id="background-label">背景圖片（選填）</h3>
      <p className="helper">上傳品牌背景圖片，套用至本地化訂閱頁面。系統會自動調整尺寸與比例。</p>
      <input ref={input} id="background-image" type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" disabled={busy}
        hidden onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void upload(file);
        }} />
      <div className={`background-drop${dragging ? " is-dragging" : ""}`}
        onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
        onDragLeave={(event) => {
          if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          const file = event.dataTransfer.files[0];
          if (file) void upload(file);
        }}>
        {asset ? <>
          <div className="background-file">
            <img src={asset.url} alt="背景圖片縮圖" />
            <div><strong title={asset.config.originalName}>{asset.config.originalName}</strong>
              <span>{asset.originalWidth} × {asset.originalHeight} · 已自動適配</span></div>
          </div>
          <div className="background-actions">
            <button ref={cropButton} className="secondary" type="button" disabled={busy} onClick={() => setEditing(true)}>調整裁切</button>
            <button className="secondary" type="button" disabled={busy} onClick={() => input.current?.click()}>更換圖片</button>
            <button className="text-button" type="button" disabled={busy} onClick={remove}>移除圖片</button>
          </div>
        </> : <button className="background-select" type="button" disabled={busy} onClick={() => input.current?.click()}>
          <Icon name="upload" size={22} /><strong>點擊上傳或拖曳圖片至此</strong>
          <span>支援 JPG、PNG、WebP，最大 5 MB</span>
        </button>}
      </div>
      {busy && <p className="helper" role="status">正在驗證及適配背景圖片……</p>}
      {error && <p className="error" role="alert">{error}</p>}
      {asset && (asset.originalWidth < 540 || asset.originalHeight < 900) &&
        <p className="helper">圖片解像度較低，放大後可能影響顯示效果。</p>}
      {asset && asset.originalWidth >= asset.originalHeight &&
        <p className="helper">方形或橫向圖片套用至直向頁面時，兩側可能被裁切。</p>}
      <p className="helper">建議使用直向圖片，系統會自動裁切以配合頁面比例。</p>
      <p className="helper">圖片只保存在目前工作階段。重新整理後須重新上傳。</p>
      {backgroundNeedsUpload && <p className="helper" role="status">草稿的背景圖片需要重新上傳。
        <button className="text-button" type="button" onClick={remove}>使用原有背景</button>
      </p>}
      {editing && asset && <CropEditor key={asset.config.assetId} asset={asset} tint={tint} onClose={closeEditor}
        onConfirm={(settings) => { adjust(asset.config.assetId, settings); closeEditor(); }} />}
    </section>
  );
}
