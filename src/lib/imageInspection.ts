import { z } from "zod";
import { UploadedSourceSchema } from "./generationSchema.ts";

export const InspectionRequestSchema = z.object({
  task: z.literal("inspect"),
  source: UploadedSourceSchema,
}).strict();

export const IMAGE_AREAS = ["top", "middle", "bottom", "unknown"] as const;
const candidate = z.object({
  label: z.string().trim().min(1).max(160),
  text: z.string().trim().min(1).max(600),
  area: z.enum(IMAGE_AREAS),
}).strict();
export const InspectionSchema = z.object({
  status: z.enum(["readable", "limited"]),
  candidates: z.array(candidate).max(20),
}).strict();
export type ImageInspection = z.infer<typeof InspectionSchema>;
