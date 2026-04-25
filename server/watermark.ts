/**
 * Watermark Utility
 * 在圖片上以 -30 度斜線平鋪商戶名稱透明水印
 */

/**
 * 在圖片 buffer 加上文字水印後返回新 buffer
 * @param buffer   原始圖片（JPEG / PNG / WebP）
 * @param text     水印文字（商戶名稱）
 * @param mimeType 原始 MIME 類型（決定輸出格式）
 */
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

  // 字型大小：較短邊的 10%，最小 32px，最大 140px
  const minDim = Math.min(w, h);
  const fontSize = Math.max(32, Math.min(140, Math.round(minDim * 0.10)));

  // 估算單個水印文字所佔的寬高（每字元約 0.6 × fontSize）
  const charW = fontSize * 0.62;
  const textW = text.length * charW;
  const textH = fontSize * 1.2;

  // 平鋪間距（橫向 / 縱向）
  const gapX = textW * 1.6;
  const gapY = textH * 3.5;

  // 產生覆蓋整張圖的所有水印座標（加 padding 確保邊角也有）
  const positions: { x: number; y: number }[] = [];
  const cols = Math.ceil(w / gapX) + 2;
  const rows = Math.ceil(h / gapY) + 2;

  for (let row = -1; row < rows; row++) {
    for (let col = -1; col < cols; col++) {
      // 奇數列偏移半個 gapX，形成錯排效果
      const offsetX = row % 2 === 0 ? 0 : gapX / 2;
      positions.push({
        x: col * gapX + offsetX,
        y: row * gapY,
      });
    }
  }

  // 把所有水印文字合成為一個 SVG
  const textElements = positions
    .map(({ x, y }) => {
      const cx = x + textW / 2;
      const cy = y + textH / 2;
      return `
    <text
      x="${cx + 2}"
      y="${cy + 2}"
      transform="rotate(-30, ${cx + 2}, ${cy + 2})"
      fill="rgba(0,0,0,0.22)"
    >${escapeXml(text)}</text>
    <text
      x="${cx}"
      y="${cy}"
      transform="rotate(-30, ${cx}, ${cy})"
      fill="rgba(255,255,255,0.50)"
    >${escapeXml(text)}</text>`;
    })
    .join("\n");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <style>
    text {
      font-family: "Noto Sans CJK TC", "PingFang TC", "Microsoft JhengHei", "Arial", sans-serif;
      font-size: ${fontSize}px;
      font-weight: bold;
      text-anchor: middle;
      dominant-baseline: middle;
    }
  </style>
  ${textElements}
</svg>`;

  try {
    const svgBuffer = Buffer.from(svg);
    const composed = await sharp(buffer)
      .composite([{ input: svgBuffer, blend: "over" }]);

    if (mimeType === "image/png") {
      return await composed.png({ compressionLevel: 8 }).toBuffer();
    }
    if (mimeType === "image/webp") {
      return await composed.webp({ quality: 88 }).toBuffer();
    }
    return await composed.jpeg({ quality: 90 }).toBuffer();
  } catch (err) {
    console.error("[watermark] Failed to apply watermark:", err);
    return buffer;
  }
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
