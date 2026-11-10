"use client";
import { useEffect, useRef, useState } from "react";
import { MARKET_CONFIG, MARKETS } from "@/lib/designSchema";
import type { PageSection } from "@/lib/designSchema";
import type { OriginalSource, StudioResult } from "@/lib/studioTypes";
import type { StudioBackground } from "@/lib/background";
import Icon from "./Icon";
import PaywallPreview from "./PaywallPreview";

export type GeneratedDesign = StudioResult;

export default function BeforeAfter({ source, generated, loading, locate, background }: {
  source: OriginalSource | null;
  generated: StudioResult | null;
  loading: boolean;
  locate?: { section: PageSection };
  background?: StudioBackground | null;
}) {
  const [selection, setSelection] = useState<{ result: StudioResult | null; tab: "original" | "generated"; locate?: typeof locate }>();
  const tab = locate && selection?.locate !== locate ? "generated"
    : selection?.result === generated ? selection.tab : generated ? "generated" : "original";
  const previewRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!locate || !generated || loading) return;
    const item = previewRef.current?.querySelector<HTMLElement>(`[data-paywall-section="${locate.section}"]`);
    item?.scrollIntoView?.({ block: "center" });
    item?.focus({ preventScroll: true });
  }, [locate, generated, loading]);
  const image = source?.kind === "image" ? source : null;
  const sourceMarket = source?.sourceMarket?.trim();
  const marketCode = MARKETS.find((market) => market === sourceMarket?.toUpperCase());
  const originalMarket = marketCode ? MARKET_CONFIG[marketCode].label : sourceMarket;
  return (
    <>
      <div className="mobile-preview-tabs" role="tablist" aria-label="版本切換">
        <button type="button" role="tab" aria-selected={tab === "original"} className={tab === "original" ? "active" : ""} onClick={() => setSelection({ result: generated, tab: "original", locate })}>原始版本</button>
        <button type="button" role="tab" aria-selected={tab === "generated"} className={tab === "generated" ? "active" : ""} onClick={() => setSelection({ result: generated, tab: "generated", locate })}>本地化版本</button>
      </div>
      <div className={`phone-comparison initial-comparison show-${tab}`} aria-label="訂閱頁面版本對比">
        <section className="phone-column original-column original-side">
          <div className="phone-label">
            <span>{originalMarket ? "原始版本・" + originalMarket : "原始版本"}</span>
          </div>
          {source ? (
            <div className="phone uploaded-source-phone uploaded-original">
              <div className="phone-speaker" aria-hidden="true" />
              <img src={image?.url ?? "/demo-paywall.png"} alt={image ? "原始訂閱頁面：" + image.name : "LearnLoop AI 原始訂閱頁面"} />
            </div>
          ) : (
            <div className="empty-generated">
              <span><Icon name="upload" size={28} /></span>
              <h3>從原始頁面開始</h3>
              <p>上傳圖片或載入內置訂閱頁面。</p>
            </div>
          )}
        </section>
        <section className="phone-column generated-column generated-side" ref={previewRef}>
          <div className="phone-label">
            <span>{generated && !loading ? "本地化版本・" + MARKET_CONFIG[generated.inputSnapshot.targetMarket].label : "本地化版本"}</span>
          </div>
          {loading ? (
            <div className="generating-state" role="status">
              <span className="loader-orb"><Icon name="sparkles" size={26} /></span>
              <h3>正在建立本地化版本……</h3>
              <p>根據已確認資料調整內容、版面與方案展示。</p>
              <div className="progress"><i /></div>
            </div>
          ) : generated ? (
            <PaywallPreview input={generated.inputSnapshot} spec={generated.spec} focusedSection={locate?.section} background={background} />
          ) : (
            <div className="empty-generated">
              <span><Icon name="wand" size={28} /></span>
              <h3>等待本地化改版</h3>
              <p>完成設定及資料確認後，本地化版本會顯示在這裏。</p>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
