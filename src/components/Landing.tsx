"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import SourcePicker from "./SourcePicker";
import { useStudioSource } from "./StudioProvider";
import { Logo } from "./Navigation";
import LandingShowcase from "./LandingShowcase";
import Icon from "./Icon";

export default function Landing() {
  const store = useStudioSource();
  const router = useRouter();
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const [sourceError, setSourceError] = useState("");
  const steps = [
    ["upload", "上傳原始訂閱頁面"],
    ["globe", "設定目標市場"],
    ["sparkles", "生成本地化設計"],
    ["layout", "比較與檢查"],
  ];
  useEffect(() => {
    const field = promptRef.current;
    if (!field) return;
    field.style.height = "0px";
    field.style.height = Math.min(field.scrollHeight, 118) + "px";
  }, [store.instructions]);
  function startLocalization() {
    if (!store.source) {
      setSourceError("請先上傳原始訂閱頁面，或選擇示例訂閱頁面。");
      document.getElementById("home")?.scrollIntoView?.({ behavior: "smooth" });
      return;
    }
    setSourceError("");
    router.push("/studio");
  }
  return (
    <main className="landing" id="home" lang="zh-HK">
      <section className="hero">
        <div className="hero-glow glow-one" />
        <div className="hero-glow glow-two" />
        <h1>
          把現有訂閱頁
          <br />
          <em>改成適合目標市場的版本</em>
        </h1>
        <p className="hero-copy">
          選擇市場與語言，核對價格和試用條款，再比較設計並匯出交付檔案。
        </p>
        <div
          className={`prompt-shell localization-composer ${
            sourceError && !store.source ? "has-error" : ""
          }`}
        >
          <SourcePicker />
          <div className="prompt-entry">
            <div className="prompt-icon">
              <Icon name="wand" size={22} />
            </div>
            <textarea
              id="hero-instructions"
              ref={promptRef}
              value={store.instructions}
              onChange={(e) => store.setInstructions(e.target.value)}
              placeholder="補充 AI 本地化要求（選填）……"
              aria-label="本地化設計要求"
            />
          </div>
          <button
            className="button button-dark prompt-button"
            onClick={startLocalization}
          >
            前往設計工作台 <Icon name="arrow" size={18} />
          </button>
          {sourceError && !store.source && (
            <p className="source-error" role="alert">
              <Icon name="info" size={15} />
              {sourceError}
            </p>
          )}
        </div>
      </section>

      <LandingShowcase />

      <section className="section how merged-workflow" id="how">
        <div className="center-heading">
          <h2>訂閱頁面本地化流程</h2>
        </div>
        <div className="steps">
          {steps.map(([icon, title], i) => (
            <div className="step" key={title}>
              <span className="step-number">0{i + 1}</span>
              <span className="step-icon">
                <Icon name={icon} size={20} />
              </span>
              <h3>{title}</h3>
              {i < 3 && <span className="step-line" />}
            </div>
          ))}
        </div>
        <button
          className="button button-dark workflow-cta"
          onClick={startLocalization}
        >
          前往設計工作台 <Icon name="arrow" size={18} />
        </button>
      </section>

      <footer>
        <Logo href="#home" />
        <span>為不同市場而設的訂閱頁面設計工具。</span>
        <span>香港城市大學 · IS5542</span>
      </footer>
    </main>
  )
}
