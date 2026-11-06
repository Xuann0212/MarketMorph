import Icon from "./Icon";

function ShowcaseBenefit({ children }: { children: React.ReactNode }) {
  return (
    <li>
      <span>
        <Icon name="check" size={12} />
      </span>
      {children}
    </li>
  )
}

export default function LandingShowcase() {
  return (
    <section className="product-showcase" aria-labelledby="showcase-title">
      <div className="showcase-shell">
        <div className="showcase-heading">
          <div>
            <span className="kicker">設計預覽</span>
            <h2 id="showcase-title">一鍵本地化設計訂閱頁</h2>
          </div>
          <p>從同一款應用程式出發，打造適合不同市場的訂閱體驗。</p>
        </div>

        <div className="showcase-comparison">
          <article className="showcase-side">
            <div className="showcase-label">
              <span className="showcase-flag">US</span>
              <div>
                <b>原始版本・美國</b>
                <small>會員權益優先 · 英語</small>
              </div>
            </div>
            <div className="showcase-phone showcase-phone-dark" lang="en">
              <div className="showcase-island" />
              <div className="showcase-status">
                <span>9:41</span>
                <span>● ◒</span>
              </div>
              <div className="showcase-app">
                <span>
                  <Icon name="sparkles" size={20} />
                </span>
                <b>LearnLoop AI</b>
              </div>
              <div className="showcase-copy">
                <h3>Unlock Your Learning Potential</h3>
                <p>Get unlimited access to premium learning tools.</p>
              </div>
              <ul className="showcase-benefits">
                <ShowcaseBenefit>Unlimited practice</ShowcaseBenefit>
                <ShowcaseBenefit>Personalized learning</ShowcaseBenefit>
                <ShowcaseBenefit>Progress tracking</ShowcaseBenefit>
              </ul>
              <div className="showcase-plans">
                <div className="showcase-plan selected">
                  <span className="showcase-radio" />
                  <div>
                    <b>Monthly</b>
                    <small>Billed every month</small>
                  </div>
                  <strong>
                    US$4.99<small>/month</small>
                  </strong>
                </div>
                <div className="showcase-plan">
                  <span className="showcase-radio" />
                  <div>
                    <b>Annual</b>
                    <small>Billed once a year</small>
                  </div>
                  <strong>
                    US$39.99<small>/year</small>
                  </strong>
                </div>
              </div>
              <button className="showcase-phone-cta">
                Continue with Premium <Icon name="arrow" size={14} />
              </button>
              <p className="showcase-terms">
                3 days for eligible users. Subscription renews automatically
                unless cancelled before the current period ends.
              </p>
            </div>
          </article>

          <div className="showcase-transform" aria-hidden="true">
            <span>
              <Icon name="swap" size={20} />
            </span>
            <b>調整</b>
            <small>市場 · 版面 · 方案</small>
          </div>

          <article className="showcase-side">
            <div className="showcase-label">
              <span className="showcase-flag showcase-flag-hk">HK</span>
              <div>
                <b>本地化版本・香港</b>
                <small>訂閱方案優先 · 繁體中文</small>
              </div>
            </div>
            <div className="showcase-phone showcase-phone-light" lang="zh-Hant">
              <div className="showcase-island" />
              <div className="showcase-status">
                <span>9:42</span>
                <span>● ◒</span>
              </div>
              <div className="showcase-app">
                <span>
                  <Icon name="sparkles" size={20} />
                </span>
                <b>LearnLoop AI</b>
              </div>
              <div className="showcase-copy">
                <h3>解鎖進階學習體驗</h3>
                <p>以更適合你的方式，持續提升學習進度。</p>
              </div>
              <div className="showcase-plans">
                <div className="showcase-plan featured selected">
                  <em>重點方案</em>
                  <span className="showcase-radio" />
                  <div>
                    <b>全年會籍</b>
                    <small>每年收費</small>
                  </div>
                  <strong>
                    HK$298<small>/年</small>
                  </strong>
                </div>
                <div className="showcase-plan">
                  <span className="showcase-radio" />
                  <div>
                    <b>月費會籍</b>
                    <small>每月收費</small>
                  </div>
                  <strong>
                    HK$38<small>/月</small>
                  </strong>
                </div>
              </div>
              <ul className="showcase-benefits">
                <ShowcaseBenefit>無限次學習練習</ShowcaseBenefit>
                <ShowcaseBenefit>個人化學習內容</ShowcaseBenefit>
                <ShowcaseBenefit>學習進度追蹤</ShowcaseBenefit>
              </ul>
              <button className="showcase-phone-cta">
                開始進階會籍體驗 <Icon name="arrow" size={14} />
              </button>
              <p className="showcase-terms">
                符合資格的用戶可試用 3 天。訂閱將自動續期，可於當期結束前取消。
              </p>
            </div>
          </article>
        </div>

        <div className="showcase-summary">
          <div>
            <span>
              <Icon name="globe" size={16} />
            </span>
            <b>內容已本地化</b>
          </div>
          <div>
            <span>
              <Icon name="chart" size={16} />
            </span>
            <b>突出年費方案</b>
          </div>
          <div>
            <span>
              <Icon name="palette" size={16} />
            </span>
            <b>已調整版面及配色</b>
          </div>
        </div>
      </div>
    </section>
  )
}
