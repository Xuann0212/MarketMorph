export type AiAvailability = "available" | "requires-code" | "unavailable";

export type GenerationErrorCode =
  | "CONFIG_MISSING"
  | "ACCESS_DENIED"
  | "CONFIRMATION_REQUIRED"
  | "INPUT_INVALID"
  | "IMAGE_INVALID"
  | "PAYLOAD_TOO_LARGE"
  | "AUTH_INVALID"
  | "BALANCE_INSUFFICIENT"
  | "PARAMETERS_INVALID"
  | "RATE_LIMITED"
  | "PROVIDER_UNAVAILABLE"
  | "TIMEOUT"
  | "NETWORK_ERROR"
  | "EMPTY_OUTPUT"
  | "JSON_INVALID"
  | "DESIGN_INVALID"
  | "BUSINESS_INVALID"
  | "INTERNAL_ERROR";
export interface CallRecord {
  requestId: string;
  providerRequestId?: string;
  model: string;
  durationMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
  success: boolean;
  errorCategory: GenerationErrorCode | null;
  targetMarket: string;
  outputLanguage: string;
  version: string;
  attempt: number;
}
export interface GenerationMeta {
  model: string;
  requestId: string;
  version: string;
  durationMs: number;
  calls: CallRecord[];
  visualAnalysis: { status: "understood" | "limited"; summary: string };
  image: {
    width: number;
    height: number;
    bytes: number;
    losslessCopy: boolean;
  };
}
export const ERROR_MESSAGES: Record<GenerationErrorCode, string> = {
  CONFIG_MISSING: "尚未設定服務端 DeepSeek 密鑰，請完成設定後重試。",
  ACCESS_DENIED: "存取驗證失敗，請核對工作區存取碼。",
  CONFIRMATION_REQUIRED: "產品資料已變更或尚未確認，請重新確認後生成。",
  INPUT_INVALID: "輸入資料不完整或無效，請核對標記欄位。",
  IMAGE_INVALID: "圖片格式、尺寸或內容無效，請提供可讀的 PNG、JPEG 或 WebP。",
  PAYLOAD_TOO_LARGE:
    "模型輸入超過大小限制。原圖已保留，請提供較小且文字清晰的圖片。",
  AUTH_INVALID: "DeepSeek 密鑰 無效，請檢查服務端設定。",
  BALANCE_INSUFFICIENT: "DeepSeek 帳戶餘額不足，請檢查帳戶後重試。",
  PARAMETERS_INVALID: "DeepSeek 不接受目前請求參數，請檢查圖片與輸入設定。",
  RATE_LIMITED: "請求過於頻繁，請稍後再試。",
  PROVIDER_UNAVAILABLE: "DeepSeek 服務暫時異常，請稍後重試。",
  TIMEOUT: "生成請求逾時，原始圖片與資料已保留，可稍後重試。",
  NETWORK_ERROR: "無法連線至 DeepSeek，請稍後再試。",
  EMPTY_OUTPUT: "模型沒有返回有效內容，請重試。",
  JSON_INVALID: "模型返回的 JSON 無法解析，未套用結果。",
  DESIGN_INVALID: "模型返回的設計配置未通過校驗，未套用結果。",
  BUSINESS_INVALID: "模型文案包含未批准的商業資料，未套用結果。",
  INTERNAL_ERROR: "服務暫時無法完成生成，請使用請求編號 聯絡維護者。",
};
