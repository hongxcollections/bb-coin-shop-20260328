import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ENV } from './_core/env';

const s3Client = new S3Client({
  region: "ap-southeast-1",
  credentials: {
    accessKeyId: ENV.s3AccessKey || '',
    secretAccessKey: ENV.s3SecretKey || '',
  },
  endpoint: ENV.s3Endpoint || undefined,
  forcePathStyle: true,
});

function buildPublicUrl(key: string): string {
  const bucket = ENV.s3Bucket || '';
  if (ENV.s3Endpoint && !ENV.s3Endpoint.includes("amazonaws.com")) {
    return `${ENV.s3Endpoint.replace(/\/+$/, "")}/${bucket}/${key}`;
  }
  return `https://${bucket}.s3.ap-southeast-1.amazonaws.com/${key}`;
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const key = relKey.replace(/^\/+/, "");
  const bucket = ENV.s3Bucket || '';

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: data,
    ContentType: contentType,
  });

  try {
    await s3Client.send(command);
    return { key, url: buildPublicUrl(key) };
  } catch (error) {
    console.error("S3 upload error:", error);
    throw new Error(`Storage upload failed: ${(error as Error).message}`);
  }
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = relKey.replace(/^\/+/, "");
  return { key, url: buildPublicUrl(key) };
}

/**
 * 簽發 S3 presigned PUT URL，畀 client 直接上載到 S3，跳過 server proxy。
 * Client 收到 URL 後 fetch(url, { method: 'PUT', body: file })。
 * 上載完成後再用 finalUrl 入 DB。
 */
export async function storageSignPut(
  relKey: string,
  contentType: string,
  expiresInSeconds = 300
): Promise<{ key: string; uploadUrl: string; finalUrl: string }> {
  const key = relKey.replace(/^\/+/, "");
  const bucket = ENV.s3Bucket || '';
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  });
  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds });
  return { key, uploadUrl, finalUrl: buildPublicUrl(key) };
}
