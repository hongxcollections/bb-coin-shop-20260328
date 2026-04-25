/**
 * Watermark Utility
 * 單個居中斜線水印，帶邊緣陰影，高透明度
 * 使用 Sharp text input + 打包字體 NotoSansSC
 */

import path from "path";
import { fileURLToPath } from "url";

const _dirname =
  typeof __dirname !== "undefined"
    ? __dirname
    : path.dirname(fileURLToPath(import.meta.url));

const FONT_PATH = path.join(_dirname, "fonts", "NotoSansSC-Regular.otf");

export async function applyWatermark(
  buffer: Buffer,
  text: string,
  mimeType = "image/jpeg"
): Promise<Buffer> {
  let sharp: typeof import("sharp");
  try {
    sharp = (await import("sharp")).default as any;
  } catch {
    console.warn("[watermark] sharp not available, skipping watermark");
    return buffer;
  }

  const img = sharp(buffer);
  const meta = await img.metadata();
  const w = meta.width ?? 800;
  const h = meta.height ?? 600;

  try {
    const minDim = Math.min(w, h);

    // 文字大小：較短邊的 12%，DPI 線性縮放（dpi=150 → 25px 高）
    const targetH = Math.round(minDim * 0.12);
    const dpi = Math.round(150 * (targetH / 25));

    // 1. 渲染文字（黑底透明）
    const rawTextBuf = await (sharp as any)({
      text: {
        text,
        fontfile: FONT_PATH,
        rgba: true,
        dpi,
      },
    })
      .png()
      .toBuffer();

    const tm = await (sharp as any)(rawTextBuf).metadata();
    const tw: number = tm.width ?? 200;
    const th: number = tm.height ?? 40;

    // 2. 正規化 alpha，製作白字 + 陰影兩版
    const rawPx = await (sharp as any)(rawTextBuf).raw().toBuffer();
    const totalBytes = rawPx.length;

    let maxAlpha = 0;
    for (let i = 3; i < totalBytes; i += 4) {
      if (rawPx[i] > maxAlpha) maxAlpha = rawPx[i];
    }
    if (maxAlpha === 0) return buffer;

    // 白字：半透明 45%（高透明度）
    const WHITE_ALPHA = 115;
    // 陰影：黑色，45% 不透明（用於模糊擴散產生邊緣陰影）
    const SHADOW_ALPHA = 115;

    const whitePx = Buffer.allocUnsafe(totalBytes);
    const shadowPx = Buffer.allocUnsafe(totalBytes);
    for (let i = 0; i < totalBytes; i += 4) {
      const a = rawPx[i + 3];
      const na = Math.min(255, Math.round((a / maxAlpha) * WHITE_ALPHA));
      const sa = Math.min(255, Math.round((a / maxAlpha) * SHADOW_ALPHA));
      whitePx[i] = 255; whitePx[i + 1] = 255; whitePx[i + 2] = 255;
      whitePx[i + 3] = na;
      shadowPx[i] = 0; shadowPx[i + 1] = 0; shadowPx[i + 2] = 0;
      shadowPx[i + 3] = sa;
    }

    const whiteTextBuf = await (sharp as any)(whitePx, {
      raw: { width: tw, height: th, channels: 4 },
    }).png().toBuffer();

    // 陰影：先模糊（製造邊緣光暈效果），再旋轉
    const shadowTextBuf = await (sharp as any)(shadowPx, {
      raw: { width: tw, height: th, channels: 4 },
    })
      .blur(Math.max(2, Math.round(th * 0.15))) // 模糊半徑 = 字高 15%
      .png()
      .toBuffer();

    // 3. 旋轉 -30 度（斜線方向）
    const rotateOpts = { background: { r: 0, g: 0, b: 0, alpha: 0 } };
    const rotatedWhite = await (sharp as any)(whiteTextBuf)
      .rotate(-30, rotateOpts)
      .png()
      .toBuffer();
    const rotatedShadow = await (sharp as any)(shadowTextBuf)
      .rotate(-30, rotateOpts)
      .png()
      .toBuffer();

    const rm = await (sharp as any)(rotatedWhite).metadata();
    const rw: number = rm.width ?? tw;
    const rh: number = rm.height ?? th;

    // 4. 居中放置（允許超出邊界，Sharp 會自動裁切）
    const left = Math.round((w - rw) / 2);
    const top = Math.round((h - rh) / 2);

    // 陰影偏移（右下方 3px），確保不超出邊界
    const sl = Math.max(0, Math.min(left + 3, w - 1));
    const st = Math.max(0, Math.min(top + 3, h - 1));

    const composites: { input: Buffer; left: number; top: number; blend: string }[] = [
      { input: rotatedShadow, left: sl, top: st, blend: "over" },
      { input: rotatedWhite, left: Math.max(0, left), top: Math.max(0, top), blend: "over" },
    ];

    const composed = await sharp(buffer).composite(composites);

    if (mimeType === "image/png") return await composed.png({ compressionLevel: 8 }).toBuffer();
    if (mimeType === "image/webp") return await composed.webp({ quality: 88 }).toBuffer();
    return await composed.jpeg({ quality: 90 }).toBuffer();
  } catch (err) {
    console.error("[watermark] Failed to apply watermark:", err);
    return buffer;
  }
}
