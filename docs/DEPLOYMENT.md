# MarketMorph 在 Vercel 部署

1. 在 Vercel 匯入 MarketMorph 的 GitHub 倉庫，選擇 Next.js 框架，根目錄維持倉庫根目錄。
2. 使用 `main` 作為 Production Branch。安裝和建置命令使用 `npm ci` 和 `npm run build`。
3. 首次部署可使用「規則預覽」驗證工作台、訂閱頁面對比及匯出。

如需啟用 DeepSeek，在 Vercel 專案的 **Settings → Environment Variables** 為 Production 設定服務端變數：

| 變數 | 用途 |
| --- | --- |
| `DEEPSEEK_API_KEY` | DeepSeek API 金鑰 |
| `MARKETMORPH_ACCESS_TOKEN` | 獨立、強隨機的工作區存取碼；用來保護付費生成端點 |

新增或修改變數後重新部署。使用者只在工作台的存取驗證視窗輸入工作區存取碼。設定完成後，工作台可使用 AI 本地化及原圖辨識。未配置完整時仍可使用規則預覽。請勿把服務端金鑰放入 `.env.example`、瀏覽器或 Git 歷史。
