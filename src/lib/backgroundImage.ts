import { BACKGROUND_LIMIT } from "./background.ts";

const INVALID = "無法讀取圖片，請選擇有效的 JPG、PNG 或 WebP 檔案。";
const FORMAT = "格式不支援，請選擇靜態 JPG、PNG 或 WebP 圖片。";
const MAX_PIXELS = 20_000_000;
const MAX_DIMENSION = 8192;

function dimensions(width: number, height: number) {
  if (!width || !height) throw new Error(INVALID);
  if (width > MAX_DIMENSION || height > MAX_DIMENSION || width * height > MAX_PIXELS) {
    throw new Error("圖片尺寸超出上限。每邊最多 8192 像素，總像素不可超過 2000 萬。");
  }
  return { width, height };
}

export function inspectBackgroundBytes(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const ascii = (offset: number, length: number) => String.fromCharCode(...bytes.subarray(offset, offset + length));
  const uint24 = (offset: number) => bytes[offset] + bytes[offset + 1] * 256 + bytes[offset + 2] * 65536;
  if (bytes.length >= 33 && view.getUint32(0) === 0x89504e47 && view.getUint32(4) === 0x0d0a1a0a) {
    if (view.getUint32(8) !== 13 || ascii(12, 4) !== "IHDR") throw new Error(INVALID);
    const size = dimensions(view.getUint32(16), view.getUint32(20));
    for (let offset = 8; offset + 12 <= bytes.length;) {
      const length = view.getUint32(offset);
      const type = ascii(offset + 4, 4);
      const end = offset + 12 + length;
      if (end > bytes.length) throw new Error(INVALID);
      if (type === "acTL" || type === "fcTL" || type === "fdAT") throw new Error(FORMAT);
      if (type === "IEND" && length === 0 && end === bytes.length) return { mime: "image/png", ...size };
      offset = end;
    }
    throw new Error(INVALID);
  }
  if (bytes.length >= 20 && ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") {
    if (view.getUint32(4, true) + 8 !== bytes.length) throw new Error(INVALID);
    let frame: ReturnType<typeof dimensions> | undefined;
    let canvas: ReturnType<typeof dimensions> | undefined;
    let offset = 12;
    for (; offset + 8 <= bytes.length;) {
      const type = ascii(offset, 4);
      const length = view.getUint32(offset + 4, true);
      const start = offset + 8;
      offset = start + length + (length % 2);
      if (offset > bytes.length) throw new Error(INVALID);
      if (type === "ANIM" || type === "ANMF") throw new Error(FORMAT);
      if (type === "VP8X" && length === 10) {
        if (bytes[start] & 2) throw new Error(FORMAT);
        canvas = dimensions(1 + uint24(start + 4), 1 + uint24(start + 7));
      }
      if (type === "VP8 " || type === "VP8L") {
        if (frame) throw new Error(INVALID);
        if (type === "VP8 " && length >= 10 && uint24(start + 3) === 0x2a019d) {
          frame = dimensions(view.getUint16(start + 6, true) & 0x3fff, view.getUint16(start + 8, true) & 0x3fff);
        } else if (type === "VP8L" && length >= 5 && bytes[start] === 0x2f) {
          const packed = view.getUint32(start + 1, true);
          frame = dimensions(1 + (packed & 0x3fff), 1 + ((packed >>> 14) & 0x3fff));
        } else throw new Error(INVALID);
      }
    }
    if (!frame || offset !== bytes.length || (canvas && (canvas.width !== frame.width || canvas.height !== frame.height))) throw new Error(INVALID);
    return { mime: "image/webp", ...frame };
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let size: ReturnType<typeof dimensions> | undefined;
    for (let offset = 2; offset + 3 < bytes.length;) {
      if (bytes[offset++] !== 0xff) throw new Error(INVALID);
      while (bytes[offset] === 0xff) offset++;
      const marker = bytes[offset++];
      if (offset + 2 > bytes.length) break;
      const length = view.getUint16(offset);
      if (length < 2 || offset + length > bytes.length) throw new Error(INVALID);
      if (marker === 0xda && size) return { mime: "image/jpeg", ...size };
      if ([0xc0, 0xc1, 0xc2].includes(marker)) {
        if (length < 8 || size) throw new Error(INVALID);
        size = dimensions(view.getUint16(offset + 5), view.getUint16(offset + 3));
      }
      offset += length;
    }
    throw new Error(INVALID);
  }
  throw new Error(FORMAT);
}

export async function prepareBackgroundImage(file: File) {
  if (file.size > BACKGROUND_LIMIT) throw new Error("圖片大小超過 5 MB，請壓縮後重新上傳。");
  const extension = /\.(png|jpe?g|webp)$/i.exec(file.name)?.[1].toLowerCase();
  if (!extension || (file.type && !["image/png", "image/jpeg", "image/webp"].includes(file.type))) throw new Error(FORMAT);
  const buffer = await file.arrayBuffer();
  const { mime } = inspectBackgroundBytes(buffer);
  const expected = extension === "png" ? "image/png" : extension === "webp" ? "image/webp" : "image/jpeg";
  if (mime !== expected || (file.type && mime !== file.type)) throw new Error("檔案內容與圖片格式不符，請重新選擇圖片。");
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(new Blob([buffer], { type: mime }), { imageOrientation: "from-image" });
  } catch {
    throw new Error(INVALID);
  }
  const canvas = document.createElement("canvas");
  try {
    const { width, height } = dimensions(bitmap.width, bitmap.height);
    const context = canvas.getContext("2d");
    if (!context) throw new Error(INVALID);
    let ratio = Math.min(1, 2400 / Math.max(width, height));
    // PNG keeps transparency and works in browser screenshots and native asset bundles.
    for (let attempt = 0; attempt < 3; attempt++) {
      canvas.width = Math.max(1, Math.round(width * ratio));
      canvas.height = Math.max(1, Math.round(height * ratio));
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const image = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!image) throw new Error(INVALID);
      if (image.size <= BACKGROUND_LIMIT) {
        return { image, width: canvas.width, height: canvas.height, originalWidth: width, originalHeight: height };
      }
      ratio *= 0.65;
    }
    throw new Error("未能將圖片縮小至可匯出的大小，請選擇較小的圖片。");
  } finally {
    bitmap.close();
    canvas.width = 0;
    canvas.height = 0;
  }
}
