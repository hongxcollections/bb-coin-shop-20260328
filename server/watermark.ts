/**
 * Watermark Utility
 * 使用 Sharp text input + 打包字體，在圖片上平鋪商戶名稱斜線水印
 * 支援中英文字，無需伺服器安裝字體
 */

import path from "path";
import { fileURLToPath } from "url";

// ESM 打包後 __dirname 無效，改用 import.meta
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

    // DPI 控制文字大小：較短邊 ~7%，限制 120-250 之間
    const dpi = Math.max(120, Math.min(250, Math.round(minDim * 0.25)));

    // 1. 渲染黑色透明文字
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

    // 2. 製作白色文字 + 黑色陰影兩個版本
    const rawPx = await (sharp as any)(rawTextBuf).raw().toBuffer();
    const totalBytes = rawPx.length;

    // 找最大 alpha（用於正規化）
    let maxAlpha = 0;
    for (let i = 3; i < totalBytes; i += 4) {
      if (rawPx[i] > maxAlpha) maxAlpha = rawPx[i];
    }
    if (maxAlpha === 0) return buffer; // 空文字

    const whitePx = Buffer.allocUnsafe(totalBytes);
    const shadowPx = Buffer.allocUnsafe(totalBytes);
    for (let i = 0; i < totalBytes; i += 4) {
      const a = rawPx[i + 3];
      // 正規化到最大 200（78%），確保文字清晰可見
      const na = Math.min(255, Math.round((a / maxAlpha) * 200));
      whitePx[i] = 255; whitePx[i + 1] = 255; whitePx[i + 2] = 255;
      whitePx[i + 3] = na;
      shadowPx[i] = 0; shadowPx[i + 1] = 0; shadowPx[i + 2] = 0;
      shadowPx[i + 3] = Math.round(na * 0.45);
    }

    const whiteTextBuf = await (sharp as any)(whitePx, {
      raw: { width: tw, height: th, channels: 4 },
    }).png().toBuffer();
    const shadowTextBuf = await (sharp as any)(shadowPx, {
      raw: { width: tw, height: th, channels: 4 },
    }).png().toBuffer();

    // 3. 旋轉 -30 度
    const rotateOpts = { background: { r: 0, g: 0, b: 0, alpha: 0 } };
    const rotatedWhite = await (sharp as any)(whiteTextBuf).rotate(-30, rotateOpts).png().toBuffer();
    const rotatedShadow = await (sharp as any)(shadowTextBuf).rotate(-30, rotateOpts).png().toBuffer();

    const rm = await (sharp as any)(rotatedWhite).metadata();
    const rw: number = rm.width ?? tw;
    const rh: number = rm.height ?? th;

    // 4. 平鋪：生成 composites 列表（陰影 + 白字，錯排）
    // 每格間距：水印寬度 × 1.2，高度 × 2.2
    const gapX = Math.round(rw * 1.2);
    const gapY = Math.round(rh * 2.0);
    const composites: { input: Buffer; left: number; top: number; blend: string }[] = [];

    // 從 0 開始鋪（避免負座標 clamping 問題），確保全圖覆蓋
    let row = 0;
    for (let y = 0; y < h + rh; y += gapY, row++) {
      const xOffset = row % 2 === 0 ? 0 : Math.round(gapX / 2);
      for (let x = xOffset; x < w + rw; x += gapX) {
        const left = Math.round(x);
        const top = Math.round(y);
        if (left >= w || top >= h) continue;
        const sl = Math.min(left + 2, w - 1);
        const st = Math.min(top + 2, h - 1);
        composites.push({ input: rotatedShadow, left: sl, top: st, blend: "over" });
        composites.push({ input: rotatedWhite, left, top, blend: "over" });
      }
    }

    if (composites.length === 0) return buffer;

    const composed = await sharp(buffer).composite(composites);

    if (mimeType === "image/png") return await composed.png({ compressionLevel: 8 }).toBuffer();
    if (mimeType === "image/webp") return await composed.webp({ quality: 88 }).toBuffer();
    return await composed.jpeg({ quality: 90 }).toBuffer();
  } catch (err) {
    console.error("[watermark] Failed to apply watermark:", err);
    return buffer;
  }
}
