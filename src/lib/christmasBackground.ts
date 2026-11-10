import type { InputPayload } from "./designSchema.ts";

export function wantsChristmasBackground(input: InputPayload) {
  const request = input.brandColors.backgroundPreference + "\n" + input.additionalInstructions;
  const christmas = "(?:聖誕|圣诞|christmas|xmas)";
  const decoration = "(?:背景|底紋|底纹|圖案|图案|裝飾|装饰|主題|主题|background|pattern|decorations?|motifs?|theme)";
  const nearby = "[^。！？.!?;；\\n，,]{0,28}";
  const phrase = new RegExp(christmas + nearby + decoration + "|" + decoration + nearby + christmas, "i");
  const optOut = new RegExp("(?:不要|不加|避免|移除|禁用|不用|無需|无需|\\bno|\\bwithout|\\bavoid|\\bremove)\\s*(?:加入|使用|任何|有|any)?\\s*" +
    christmas + "\\s*" + decoration, "i");
  return phrase.test(request) && !optOut.test(request);
}

// The main artwork sits at the edges, leaving the centre clear for the product name and headline.
export const christmasViewBox = "0 0 320 104";
export const christmasPaths = [
  { d: "M0 23Q24 21 63 0M12 22l9-16m3 12 13 5m-4-8 9-14m1 9 11 3M0 40Q28 31 53 19M9 37l7-12m6 8 10 3m-1-7 7-10", opacity: 0.40 },
  { d: "M320 19Q291 17 255 0m55 17-9-13m-2 10-11 4m1-9-6-8m-7 5-10 3M320 31Q291 24 273 16m35 12-7-9m-1 6-10 3", opacity: 0.36 },
  { d: "M292 31l-13 19h8l-15 17h10l-16 15h52l-16-15h10l-15-17h8zm0 51v10m-7 0h14m-7-72v8m-4-4h8", opacity: 0.52 },
  { d: "M37 64v16m-8-8h16m-14-6 12 12m0-12L31 78M244 42v12m-6-6h12m-10-4 8 8m0-8-8 8M79 29v10m-5-5h10M257 71v10m-5-5h10", opacity: 0.34 },
  { d: "M62 54h.1M87 68h.1M101 22h.1M225 31h.1M235 69h.1M265 25h.1M16 61h.1", opacity: 0.48 },
] as const;
