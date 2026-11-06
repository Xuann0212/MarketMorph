import sharp from "sharp";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { MAX_MODEL_IMAGE_BYTES } from "../generationSchema.ts";
import type { GenerateRequest } from "../generationSchema.ts";
import { GenerationError } from "./generationError.ts";
export async function prepareModelImage(source: GenerateRequest["source"]) {
  let buffer: Buffer, mime: string;
  if (source.kind === "demo") {
    buffer = await readFile(
      path.join(process.cwd(), "public", "demo-paywall.png"),
    );
    mime = "image/png";
  } else {
    const match =
      /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(
        source.dataUrl,
      );
    if (!match || match[2].length % 4 !== 0)
      throw new GenerationError("IMAGE_INVALID");
    mime = match[1];
    buffer = Buffer.from(match[2], "base64");
    if (buffer.toString("base64") !== match[2])
      throw new GenerationError("IMAGE_INVALID");
  }
  if (!buffer.length || buffer.length > MAX_MODEL_IMAGE_BYTES)
    throw new GenerationError("PAYLOAD_TOO_LARGE", 413);
  try {
    const metadata = await sharp(buffer, {
      limitInputPixels: 32000000,
      failOn: "error",
    }).metadata();
    const expected = {
      "image/png": "png",
      "image/jpeg": "jpeg",
      "image/webp": "webp",
    }[mime];
    if (
      !expected ||
      metadata.format !== expected ||
      !metadata.width ||
      !metadata.height ||
      metadata.width > 8192 ||
      metadata.height > 8192 ||
      (metadata.pages ?? 1) > 1
    )
      throw new GenerationError("IMAGE_INVALID");
    const converted = await sharp(buffer, {
      limitInputPixels: 32000000,
      failOn: "error",
    })
      .rotate()
      .webp({ lossless: true, effort: 2 })
      .toBuffer({ resolveWithObject: true });
    const useCopy = converted.data.length < buffer.length;
    const bytes = useCopy ? converted.data : buffer;
    return {
      dataUrl: `data:${useCopy ? "image/webp" : mime};base64,${bytes.toString("base64")}`,
      info: {
        width: useCopy ? converted.info.width : metadata.width,
        height: useCopy ? converted.info.height : metadata.height,
        bytes: bytes.length,
        losslessCopy: useCopy,
      },
    };
  } catch (error) {
    if (error instanceof GenerationError) throw error;
    throw new GenerationError("IMAGE_INVALID");
  }
}
