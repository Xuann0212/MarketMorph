"use client";
import { useId, useRef } from "react";
import { useStudioSource } from "./StudioProvider";
import Icon from "./Icon";

export default function SourcePicker({ compact = false }: { compact?: boolean }) {
  const inputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const { source, uploadStatus, uploadError, loadImage, removeSource, useDemo, setSourceDetails } = useStudioSource();
  const busy = uploadStatus === "validating" || uploadStatus === "replacing";
  const chooseFile = () => fileRef.current?.click();
  const name = source?.kind === "image" ? source.name : "LearnLoop AI · 美國原始版本";
  const thumbnail = (
    <div className={`source-thumbnail ${source?.kind ?? "sample"}`}>
      {source?.kind === "image" ? (
        <img src={source.url} alt="已載入原始訂閱頁面縮圖" />
      ) : (
        <span><Icon name={compact ? "layout" : "sparkles"} size={20} /></span>
      )}
    </div>
  );
  return (
    <div className="source-area">
      <input
        id={inputId}
        ref={fileRef}
        className="source-file-input"
        type="file"
        tabIndex={-1}
        aria-label="上傳原始訂閱頁面"
        accept="image/png,image/jpeg,image/webp"
        disabled={busy}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void loadImage(file);
          event.target.value = "";
        }}
      />
      {busy ? (
        <div className="source-validating" role="status">
          <span className="spinner" />
          <div><b>正在檢查圖片……</b><small>正在確認檔案格式、大小及圖片尺寸。</small></div>
        </div>
      ) : compact && source ? (
        <div className="studio-source-summary">
          {thumbnail}
          <div><span>原始訂閱頁面</span><b title={name}>{name}</b></div>
          <button type="button" onClick={chooseFile}>更換</button>
          <button type="button" aria-label="移除原始頁面" onClick={removeSource}>移除</button>
        </div>
      ) : source ? (
        <div className="source-selected">
          {thumbnail}
          <div className="source-file-meta">
            <b><Icon name="check" size={15} />原始訂閱頁面已加入</b>
            <span title={name}>{name}</span>
            {source.kind === "image" && <small>{source.mime.split("/")[1].toUpperCase()} · {source.width} × {source.height}px</small>}
          </div>
          <div className="source-actions">
            <button type="button" onClick={chooseFile}>更換</button>
            <button className="remove-source" type="button" aria-label="移除原始頁面" onClick={removeSource}>移除</button>
          </div>
        </div>
      ) : (
        <div className="source-empty">
          <button className="source-choice" type="button" onClick={chooseFile}>
            <span><Icon name="upload" size={21} /></span>
            <div><b>上傳原始訂閱頁面</b><small>PNG、JPG 或 WebP</small></div>
          </button>
          <em>或</em>
          <button className="source-choice" type="button" onClick={useDemo}>
            <span><Icon name="layout" size={21} /></span>
            <div><b>使用示例訂閱頁面</b><small>LearnLoop AI</small></div>
          </button>
        </div>
      )}
      {compact && source && (
        <div className="source-details">
          <a href={source.kind === "image" ? source.url : "/demo-paywall.png"} target="_blank" rel="noreferrer" className="text-button">查看原始頁面</a>
          {source.kind === "image" && <button type="button" className="text-button" disabled={busy} onClick={useDemo}>重新選擇示例</button>}
          {source.kind === "demo" ? <p className="helper">原始市場：美國 · 原始語言：英語</p> : (
            <div className="two-cols">
              <label className="field"><span>原始市場（選填）</span><input maxLength={80} value={source.sourceMarket ?? ""} placeholder="未設定" onChange={(event) => setSourceDetails({ sourceMarket: event.target.value })} /></label>
              <label className="field"><span>原始語言（選填）</span><input maxLength={80} value={source.sourceLanguage ?? ""} placeholder="未設定" onChange={(event) => setSourceDetails({ sourceLanguage: event.target.value })} /></label>
            </div>
          )}
        </div>
      )}
      {!source && <p className="helper">上傳圖片只保留在目前工作階段。生成或辨識前會說明是否傳送至 DeepSeek。</p>}
      {uploadError && (
        <div className="upload-error-state" role="alert">
          <span><Icon name="close" size={18} /></span>
          <div><b>圖片校驗失敗</b><p>{uploadError}{source?.kind === "image" && " 上一張有效圖片已保留。"}</p></div>
          <button type="button" onClick={chooseFile}>重新選擇圖片</button>
        </div>
      )}
      {uploadStatus === "removed" && <p className="helper" role="status">已移除原始頁面。其他輸入已保留。</p>}
    </div>
  );
}
