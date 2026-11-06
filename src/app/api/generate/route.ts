import { createGenerateHandler } from "@/lib/server/generateHandler";
export const runtime = "nodejs";
export const maxDuration = 120;
export const POST = createGenerateHandler();
