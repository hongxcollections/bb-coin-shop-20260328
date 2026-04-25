/**
 * Watermark Utility
 * 支援位置選擇、透明度、陰影 + 打包 NotoSansSC 字體
 */

import path from "path";
import { fileURLToPath } from "url";

const _dirname =
  typeof __dirname !== "undefined"
    ? __dirname
    : path.dirname(fileURLToPath(import.meta.url));

const FONT_PATH = path.join(_dirname, "fonts", "NotoSansSC-Regular.otf");

export type WatermarkPosition =
  | "center-horizontal"
  | "center-diagonal"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

export interface WatermarkOptions {
  opacity: number;        // 1-100，預設 45
  shadow: boolean;        // 預設 true
  position: WatermarkPosition; // 預設 center-diagonal
  size: number;           // 1-100（%），控制文字高度佔較短邊比例，預設 12
}

const DEFAULT_OPTS: WatermarkOptions = {
  opacity: 45,
  shadow: true,
  position: "center-diagonal",
  size: 12,
};

export async function applyWatermark(
  buffer: Buffer,
  text: string,
  mimeType = "image/jpeg",
  opts?: Partial<WatermarkOptions>
): Promise<Buffer> {
  const options: WatermarkOptions = { ...DEFAULT_OPTS, ...opts };

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
  const minDim = Math.min(w, h);

  try {
    // ── 目標文字高度 ──────────────────────────────────────────
    // size(1-100) → 文字高度為較短邊的 size%
    // 角落位置再縮小 60%，避免過大
    const isCorner = options.position !== "center-horizontal" && options.position !== "center-diagonal";
    const sizeRatio = Math.max(1, Math.min(100, options.size ?? 12)) / 100;
    const targetH = Math.max(4, isCorner
      ? Math.round(minDim * sizeRatio * 0.6)
      : Math.round(minDim * sizeRatio));

    const rotationAngle = options.position === "center-diagonal" ? -30 : 0;

    // ── 渲染文字（固定 DPI，之後再 resize 到精確 targetH）────
    const rawTextBuf = await (sharp as any)({
      text: {
        text,
        fontfile: FONT_PATH,
        rgba: true,
        dpi: 300,           // 固定高解析度渲染，然後縮放
      },
    }).png().toBuffer();

    const tm = await (sharp as any)(rawTextBuf).metadata();
    const origW: number = tm.width ?? 200;
    const origH: number = tm.height ?? 40;

    // 按比例縮放到 targetH
    const scale = targetH / origH;
    const scaledW = Math.max(1, Math.round(origW * scale));
    const scaledH = targetH;

    const scaledTextBuf = await (sharp as any)(rawTextBuf)
      .resize(scaledW, scaledH, { fit: "fill", kernel: "lanczos3" })
      .png()
      .toBuffer();

    const tw: number = scaledW;
    const th: number = scaledH;

    // ── 正規化 alpha + 製作白字 / 陰影 ───────────────────────
    const rawPx = await (sharp as any)(scaledTextBuf).raw().toBuffer();
    const totalBytes = rawPx.length;

    let maxAlpha = 0;
    for (let i = 3; i < totalBytes; i += 4) {
      if (rawPx[i] > maxAlpha) maxAlpha = rawPx[i];
    }
    if (maxAlpha === 0) return buffer;

    const WHITE_ALPHA = Math.round(Math.min(100, Math.max(1, options.opacity)) * 255 / 100);
    const SHADOW_ALPHA = Math.round(WHITE_ALPHA * 0.5);

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

    const shadowTextRaw = await (sharp as any)(shadowPx, {
      raw: { width: tw, height: th, channels: 4 },
    });
    const shadowTextBuf = options.shadow
      ? await shadowTextRaw.blur(Math.max(2, Math.round(th * 0.18))).png().toBuffer()
      : await shadowTextRaw.png().toBuffer();

    // ── 旋轉 ─────────────────────────────────────────────────
    const rotateOpts = { background: { r: 0, g: 0, b: 0, alpha: 0 } };
    const rotatedWhite = await (sharp as any)(whiteTextBuf).rotate(rotationAngle, rotateOpts).png().toBuffer();
    const rotatedShadow = await (sharp as any)(shadowTextBuf).rotate(rotationAngle, rotateOpts).png().toBuffer();

    const rm = await (sharp as any)(rotatedWhite).metadata();
    const rw: number = rm.width ?? tw;
    const rh: number = rm.height ?? th;

    // ── 計算放置座標 ──────────────────────────────────────────
    const PADDING = Math.round(minDim * 0.03); // 邊距 3%
    const SHADOW_OFFSET = options.shadow ? 3 : 1;

    let left = 0;
    let top = 0;

    switch (options.position) {
      case "center-horizontal":
      case "center-diagonal":
        left = Math.round((w - rw) / 2);
        top = Math.round((h - rh) / 2);
        break;
      case "top-left":
        left = PADDING;
        top = PADDING;
        break;
      case "top-right":
        left = w - rw - PADDING;
        top = PADDING;
        break;
      case "bottom-left":
        left = PADDING;
        top = h - rh - PADDING;
        break;
      case "bottom-right":
        left = w - rw - PADDING;
        top = h - rh - PADDING;
        break;
    }

    // 確保不超出畫布（負座標 Sharp 會裁切）
    const safeLeft = Math.max(0, left);
    const safeTop = Math.max(0, top);
    const sl = Math.max(0, Math.min(left + SHADOW_OFFSET, w - 1));
    const st = Math.max(0, Math.min(top + SHADOW_OFFSET, h - 1));

    const composites: { input: Buffer; left: number; top: number; blend: string }[] = [
      { input: rotatedShadow, left: sl, top: st, blend: "over" },
      { input: rotatedWhite, left: safeLeft, top: safeTop, blend: "over" },
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
