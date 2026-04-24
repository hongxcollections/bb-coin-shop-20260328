/**
 * Watermark Utility
 * 在圖片中央加上商戶名稱透明水印（30 度打斜）
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
  // 動態 import sharp（避免啟動時若平台缺 binary 導致整個 server 掛掉）
  let sharp: typeof import("sharp");
  try {
    sharp = (await import("sharp")).default as any;
  } catch {
    console.warn("[watermark] sharp not available, skipping watermark");
    return buffer;
  }

  // 讀取圖片 metadata 取得寬高
  const img = sharp(buffer);
  const meta = await img.metadata();
  const w = meta.width ?? 800;
  const h = meta.height ?? 600;

  // 字型大小：依圖片較短邊的 6%~8%，最小 24px，最大 80px
  const minDim = Math.min(w, h);
  const fontSize = Math.max(24, Math.min(80, Math.round(minDim * 0.07)));

  // 估算文字寬度（每字元約 0.6 × fontSize，取最大不超過 w*0.7）
  const estTextW = Math.min(text.length * fontSize * 0.65, w * 0.8);
  const estTextH = fontSize * 1.4;

  // SVG 水印層：文字置中、旋轉 -30 度
  // 白色文字 + 輕微黑色陰影，在淺色/深色背景都可見
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
    <!-- 黑色陰影層（略偏移）提升在淺色背景的可讀性 -->
    <text
      x="${w / 2 + 2}"
      y="${h / 2 + 2}"
      transform="rotate(-30, ${w / 2 + 2}, ${h / 2 + 2})"
      fill="rgba(0,0,0,0.25)"
    >${escapeXml(text)}</text>
    <!-- 主水印文字：白色半透明 -->
    <text
      x="${w / 2}"
      y="${h / 2}"
      transform="rotate(-30, ${w / 2}, ${h / 2})"
      fill="rgba(255,255,255,0.45)"
    >${escapeXml(text)}</text>
  </svg>`;

  // 合成
  try {
    const svgBuffer = Buffer.from(svg);
    const composed = await sharp(buffer)
      .composite([{ input: svgBuffer, blend: "over" }]);

    // 輸出格式與原圖一致（保持 JPEG 或 PNG）
    if (mimeType === "image/png") {
      return await composed.png({ compressionLevel: 8 }).toBuffer();
    }
    if (mimeType === "image/webp") {
      return await composed.webp({ quality: 88 }).toBuffer();
    }
    // 預設輸出 JPEG
    return await composed.jpeg({ quality: 90 }).toBuffer();
  } catch (err) {
    console.error("[watermark] Failed to apply watermark:", err);
    return buffer; // 失敗時返回原圖，確保上傳不中斷
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
