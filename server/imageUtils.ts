/**
 * imageUtils.ts
 * 伺服器端圖片工具。目前提供 WebP 轉換，減少 S3 存儲體積 30-50%。
 */

/**
 * 將任意圖片 Buffer 轉換為 WebP。
 * - GIF 直接原樣返回（保留動畫）
 * - 其他格式（JPEG / PNG / WebP）均以 quality 85 輸出 WebP
 * 返回 { buffer, mimeType } 供 storagePut 使用。
 */
export async function convertToWebP(
  input: Buffer,
  originalMime: string
): Promise<{ buffer: Buffer; mimeType: string }> {
  // GIF 保持原樣（sharp 不保留動畫 GIF）
  if (originalMime === 'image/gif') {
    return { buffer: input, mimeType: originalMime };
  }

  try {
    const sharp = (await import('sharp')).default;
    const buffer = await sharp(input)
      .webp({ quality: 85, effort: 4 })
      .toBuffer();
    return { buffer, mimeType: 'image/webp' };
  } catch (err) {
    // 若 sharp 失敗（極少情況），原樣返回，不中斷上傳
    console.warn('[imageUtils] WebP conversion failed, using original:', err);
    return { buffer: input, mimeType: originalMime };
  }
}

/** 將檔名副檔名換成 .webp（e.g. photo.jpg → photo.webp） */
export function toWebPFilename(fileName: string): string {
  return fileName.replace(/\.(jpe?g|png|webp|gif)$/i, '.webp');
}
