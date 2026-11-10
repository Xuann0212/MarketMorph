import DesignSetup from "@/components/DesignSetup";
import { connection } from "next/server";

export default async function Studio() {
  await connection();
  const hasCode = Boolean(process.env.MARKETMORPH_ACCESS_TOKEN?.trim());
  const enabled = Boolean(process.env.DEEPSEEK_API_KEY?.trim()) && (process.env.NODE_ENV !== "production" || hasCode);
  return <DesignSetup aiStatus={enabled ? (hasCode ? "requires-code" : "available") : "unavailable"} />;
}
