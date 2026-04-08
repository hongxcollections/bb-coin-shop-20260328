import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
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
    // Removed ACL: 'public-read' to support buckets with Object Ownership enabled
  });

  try {
    await s3Client.send(command);
    
    // Construct the public URL
    // For AWS S3, the standard URL is: https://{bucket}.s3.{region}.amazonaws.com/{key}
    // Or if using a custom endpoint: {endpoint}/{bucket}/{key}
    let url = "";
    if (ENV.s3Endpoint && !ENV.s3Endpoint.includes("amazonaws.com")) {
      url = `${ENV.s3Endpoint.replace(/\/+$/, "")}/${bucket}/${key}`;
    } else {
      url = `https://${bucket}.s3.ap-southeast-1.amazonaws.com/${key}`;
    }

    return { key, url };
  } catch (error) {
    console.error("S3 upload error:", error);
    throw new Error(`Storage upload failed: ${(error as Error).message}`);
  }
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = relKey.replace(/^\/+/, "");
  const bucket = ENV.s3Bucket || '';
  
  let url = "";
  if (ENV.s3Endpoint && !ENV.s3Endpoint.includes("amazonaws.com")) {
    url = `${ENV.s3Endpoint.replace(/\/+$/, "")}/${bucket}/${key}`;
  } else {
    url = `https://${bucket}.s3.ap-southeast-1.amazonaws.com/${key}`;
  }

  return { key, url };
}
