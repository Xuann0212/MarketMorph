import { z } from "zod";
import type { AuditReport } from "./designSchema.ts";

export const BACKGROUND_LIMIT = 5 * 1024 * 1024;
export const BACKGROUND_PATH = "react-native/assets/background.png";
export const TEXT_SURFACE_THRESHOLD = 0.55;
export const backgroundSettingsSchema = z.object({
  focalPoint: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }).strict(),
  scale: z.number().min(1).max(2),
  overlayOpacity: z.number().min(0.2).max(0.9),
}).strict();
export type BackgroundSettings = z.infer<typeof backgroundSettingsSchema>;
export const defaultBackgroundSettings: BackgroundSettings = {
  focalPoint: { x: 0.5, y: 0.5 }, scale: 1, overlayOpacity: 0.65,
};
export const backgroundConfigSchema = backgroundSettingsSchema.extend({
  type: z.literal("uploaded"),
  assetId: z.uuid(),
  assetPath: z.literal(BACKGROUND_PATH),
  originalName: z.string().min(1).max(255),
  mimeType: z.literal("image/png"),
  width: z.number().int().positive().max(2400),
  height: z.number().int().positive().max(2400),
  fit: z.literal("cover"),
});
export type BackgroundConfig = z.infer<typeof backgroundConfigSchema>;
export interface StudioBackground {
  config: BackgroundConfig;
  image: Blob;
  url: string;
  originalWidth: number;
  originalHeight: number;
}

export function backgroundCheck(background: StudioBackground): AuditReport["checks"][number] {
  const { config } = background;
  return {
    id: "uploaded-background",
    label: "背景圖片及文字可讀性",
    status: "needs-review",
    field: "background",
    reason: `已套用等比例裁切及 ${Math.round(config.overlayOpacity * 100)}% 遮罩。價格卡及按鈕使用純色底。` +
      (config.overlayOpacity < TEXT_SURFACE_THRESHOLD ? "低遮罩設定已加入半透明文字底板。" : "") +
      "請核對標題、權益及條款是否清晰，並確認圖中沒有過時價格或優惠。",
  };
}
