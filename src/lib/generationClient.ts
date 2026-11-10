import {
  MAX_MODEL_IMAGE_BYTES,
  MAX_REQUEST_BYTES,
  validateOutput,
} from "./generationSchema";
import { ERROR_MESSAGES } from "./generationTypes";
import type { GenerationErrorCode, GenerationMeta } from "./generationTypes";
import type { InputPayload, AuditReport } from "./designSchema";
import type { OriginalSource, StudioResult } from "./studioTypes";
import { stableJson } from "./studioTypes";
import { InspectionSchema } from "./imageInspection";
export class ClientGenerationError extends Error {
  constructor(
    public code: GenerationErrorCode,
    public requestId?: string,
  ) {
    super(ERROR_MESSAGES[code]);
    this.name = "ClientGenerationError";
  }
}
function dataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new ClientGenerationError("IMAGE_INVALID"));
    reader.readAsDataURL(blob);
  });
}
export async function modelImageCopy(
  source: Extract<OriginalSource, { kind: "image" }>,
): Promise<string> {
  if (!source.url.startsWith("blob:"))
    throw new ClientGenerationError("IMAGE_INVALID");
  let image: Blob;
  try {
    const response = await fetch(source.url);
    if (!response.ok) throw new Error();
    image = await response.blob();
  } catch {
    throw new ClientGenerationError("IMAGE_INVALID");
  }
  if (
    source.width > 8192 ||
    source.height > 8192 ||
    source.width * source.height > 32000000
  )
    throw new ClientGenerationError("IMAGE_INVALID");
  if (image.size > MAX_MODEL_IMAGE_BYTES) {
    const bitmap = await createImageBitmap(image);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext("2d");
      if (!context) throw new ClientGenerationError("IMAGE_INVALID");
      context.drawImage(bitmap, 0, 0);
      const png = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png"),
      );
      if (png && png.size < image.size) image = png;
    } finally {
      bitmap.close();
    }
  }
  // Keep the exact pixel resolution; reject instead of silently making text unreadable.
  if (image.size > MAX_MODEL_IMAGE_BYTES)
    throw new ClientGenerationError("PAYLOAD_TOO_LARGE");
  return dataUrl(image);
}
async function requestAgent(payload: object, accessToken: string) {
  const body = JSON.stringify(payload);
  if (new TextEncoder().encode(body).length > MAX_REQUEST_BYTES)
    throw new ClientGenerationError("PAYLOAD_TOO_LARGE");
  let response: Response;
  try {
    response = await fetch("/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { "x-marketmorph-access-token": accessToken } : {}),
      },
      body,
      signal: AbortSignal.timeout(110000),
    });
  } catch (error) {
    throw new ClientGenerationError(
      error instanceof Error &&
        ["TimeoutError", "AbortError"].includes(error.name)
        ? "TIMEOUT"
        : "NETWORK_ERROR",
    );
  }
  let result;
  try {
    result = await response.json();
  } catch {
    throw new ClientGenerationError(
      response.status === 413 ? "PAYLOAD_TOO_LARGE" : "PROVIDER_UNAVAILABLE",
    );
  }
  if (!result || typeof result !== "object")
    throw new ClientGenerationError(
      response.ok ? "DESIGN_INVALID" : "PROVIDER_UNAVAILABLE",
    );
  if (!response.ok || result.ok !== true) {
    const code = result.error?.code;
    throw new ClientGenerationError(
      typeof code === "string" && Object.hasOwn(ERROR_MESSAGES, code)
        ? (code as GenerationErrorCode)
        : "INTERNAL_ERROR",
      typeof result.requestId === "string" ? result.requestId : undefined,
    );
  }
  return result;
}

export async function inspectSource(source: Extract<OriginalSource, { kind: "image" }>, accessToken: string) {
  const dataUrl = await modelImageCopy(source);
  const result = await requestAgent({ task: "inspect", source: { kind: "image", id: source.id, dataUrl } }, accessToken);
  const inspection = InspectionSchema.safeParse(result.inspection);
  if (!inspection.success) throw new ClientGenerationError("DESIGN_INVALID");
  return inspection.data;
}

export async function generateRealDesign(
  input: InputPayload,
  source: OriginalSource,
  confirmation: string,
  accessToken: string,
): Promise<StudioResult> {
  const sourceInput =
    source.kind === "demo"
      ? { kind: "demo", id: source.id }
      : { kind: "image", id: source.id, dataUrl: await modelImageCopy(source) };
  const result = await requestAgent({
    input, source: sourceInput, confirmation: { confirmed: true, fingerprint: confirmation },
  }, accessToken);
  try {
    if (
      result.mode !== "live" ||
      stableJson(result.inputSnapshot) !== stableJson(input) ||
      typeof result.meta?.requestId !== "string" ||
      result.meta.model !== "deepseek-flash" ||
      !Array.isArray(result.audit?.checks)
    )
      throw new Error("invalid");
    const output = validateOutput(
      { design: result.spec, visualAnalysis: result.meta.visualAnalysis },
      input,
    );
    return {
      inputSnapshot: input,
      sourceId: source.id,
      spec: output.design,
      audit: result.audit as AuditReport,
      mode: "live",
      meta: result.meta as GenerationMeta,
    };
  } catch {
    throw new ClientGenerationError("DESIGN_INVALID");
  }
}
