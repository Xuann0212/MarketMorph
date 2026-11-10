# MarketMorph

MarketMorph 是跨市場訂閱頁面本地化及開發交付工具。使用既有 Paywall 圖片或示例，選擇目標市場與輸出語言，確認產品資料後生成及檢查設計。從結果可以下載設計 JSON、PNG、React Native 元件、檢查報告及接入說明。

## 啟動

使用 Node.js 22.18+ 和 npm。

```powershell
npm ci
npm run dev -- --hostname 127.0.0.1 --port 3000
```

[首頁](http://127.0.0.1:3000/) · [設計工作台](http://127.0.0.1:3000/studio)

在首頁選擇圖片或示例素材後進入工作台。選擇目標市場後可改選輸出語言。工作台在目前瀏覽器保存設定、訂閱草稿及最近結果。上傳圖片只保留在目前工作階段，重新整理後須重新選擇。

可直接填寫產品資料，或在 Studio 匯入 `public/example_input.json`、舊版 InputPayload 或 `public/example_product_v2.json`。匯入預覽提供保留原值和取代目前資料的選項。跨市場價格分開儲存。確認完成後選擇生成模式並提交。

## 生成與匯出

在「補充要求」下方可上傳最多 5 MB 的靜態 JPG、PNG 或 WebP。可調整裁切焦點、縮放和遮罩，並在現有結果即時核對。背景圖片在瀏覽器內處理，只保留在目前工作階段。若要交付設計規格及 React Native 元件，請下載完整 ZIP，讓背景資源與元件一併交付。

「AI 本地化」使用 `/api/generate` 和 DeepSeek `deepseek-flash`。在私有 `.env.local` 依 `.env.example` 設定 `DEEPSEEK_API_KEY` 後重啟服務。生產模式另須 `MARKETMORPH_ACCESS_TOKEN`。同一受保護端點可從上傳原圖辨識待核對文字，使用者須核對後手動填寫目標市場資料。「規則預覽」可在未配置 DeepSeek 的環境使用，套用設計目標、語言模板及品牌色限制。

生成後可從「本地化內容與依據」定位預覽區塊，或選擇「只修改文案」。在「本地化設計檢查」核對結果。通過必要檢查的當前結果可從「匯出設計」下載完整 ZIP 或個別檔案。需要人工確認的項目保留於檢查報告。

## React Native 驗證

將下載的 ZIP 接入示例：

```powershell
node --import tsx scripts/prepare-native-example.ts "C:\path\to\MarketMorph_Export.zip"
cd examples/react-native-paywall
npm ci
npm run typecheck
npm run web
```

不帶 ZIP 執行準備指令會生成明示的雙套餐示例。示例 App 使用沙盒回調。正式 App 必須連接商店或訂閱 SDK 商品、本地化價格、購買與恢復流程。匯出元件可用於開發集成，但不代表已通過生產支付及發布審核。

## 開發檢查

```powershell
npm run typecheck
npm run lint
npm test
npm run build
```

公開部署與生成模式設定見 [Vercel 部署指南](docs/DEPLOYMENT.md)。
