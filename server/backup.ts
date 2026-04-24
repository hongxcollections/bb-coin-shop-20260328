/**
 * Database Backup Module
 * - 每日 HKT 02:00（UTC 18:00）自動備份
 * - 純 JS 生成 SQL dump（不依賴 mysqldump binary）
 * - 壓縮 gzip 後上傳至 S3 backups/ 目錄
 * - 保留策略：每日備份保留 30 天，每週快照（週日）保留 3 個月
 */

import { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { createGzip } from "zlib";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import { ENV } from "./_core/env";
import { getRawPool } from "./db";

// ── S3 client（共用同一套設定）──
const s3 = new S3Client({
  region: "ap-southeast-1",
  credentials: {
    accessKeyId: ENV.s3AccessKey || "",
    secretAccessKey: ENV.s3SecretKey || "",
  },
  endpoint: ENV.s3Endpoint || undefined,
  forcePathStyle: true,
});

function getBucket() {
  return ENV.s3Bucket || "";
}

// ── 純 JS MySQL dump ──
async function generateSqlDump(): Promise<string> {
  const pool = await getRawPool();
  const lines: string[] = [];

  lines.push(`-- ============================================================`);
  lines.push(`-- 大BB錢幣店 Database Backup`);
  lines.push(`-- Generated: ${new Date().toISOString()}`);
  lines.push(`-- ============================================================\n`);
  lines.push(`SET NAMES utf8mb4;`);
  lines.push(`SET FOREIGN_KEY_CHECKS=0;\n`);

  const [tables]: any = await pool.execute("SHOW TABLES");
  const tableNames: string[] = tables.map((r: any) => Object.values(r)[0] as string);

  for (const table of tableNames) {
    lines.push(`-- ---- Table: \`${table}\` ----`);

    // DDL
    const [ddlRows]: any = await pool.execute(`SHOW CREATE TABLE \`${table}\``);
    const ddl: string = ddlRows[0]["Create Table"];
    lines.push(`DROP TABLE IF EXISTS \`${table}\`;`);
    lines.push(`${ddl};\n`);

    // Data
    const [rows]: any = await pool.execute(`SELECT * FROM \`${table}\``);
    if ((rows as any[]).length === 0) continue;

    const cols = Object.keys(rows[0]).map((c: string) => `\`${c}\``).join(", ");
    const chunks: string[] = [];

    for (const row of rows as any[]) {
      const vals = Object.values(row).map((v: any) => {
        if (v === null || v === undefined) return "NULL";
        if (typeof v === "number" || typeof v === "bigint") return String(v);
        if (typeof v === "boolean") return v ? "1" : "0";
        if (v instanceof Date) return `'${v.toISOString().slice(0, 19).replace("T", " ")}'`;
        if (Buffer.isBuffer(v)) return `0x${v.toString("hex")}`;
        // Escape string
        return `'${String(v)
          .replace(/\\/g, "\\\\")
          .replace(/'/g, "\\'")
          .replace(/\n/g, "\\n")
          .replace(/\r/g, "\\r")
          .replace(/\x00/g, "\\0")}'`;
      });
      chunks.push(`(${vals.join(", ")})`);
    }

    // Batch inserts in groups of 500 to keep file manageable
    const BATCH = 500;
    for (let i = 0; i < chunks.length; i += BATCH) {
      lines.push(`INSERT INTO \`${table}\` (${cols}) VALUES`);
      lines.push(chunks.slice(i, i + BATCH).join(",\n") + ";");
    }
    lines.push("");
  }

  lines.push(`SET FOREIGN_KEY_CHECKS=1;`);
  return lines.join("\n");
}

// ── gzip 壓縮 buffer ──
async function gzip(input: string): Promise<Buffer> {
  const chunks: Buffer[] = [];
  const gz = createGzip();
  gz.on("data", (chunk: Buffer) => chunks.push(chunk));

  await pipeline(Readable.from([Buffer.from(input, "utf8")]), gz);
  return Buffer.concat(chunks);
}

// ── 上傳到 S3 ──
async function uploadToS3(key: string, data: Buffer): Promise<string> {
  const bucket = getBucket();
  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: data,
    ContentType: "application/gzip",
  }));
  if (ENV.s3Endpoint && !ENV.s3Endpoint.includes("amazonaws.com")) {
    return `${ENV.s3Endpoint.replace(/\/+$/, "")}/${bucket}/${key}`;
  }
  return `https://${bucket}.s3.ap-southeast-1.amazonaws.com/${key}`;
}

// ── 清理舊備份 ──
// 每日備份保留 30 天；帶 "-weekly" 的保留 90 天
async function pruneOldBackups() {
  const bucket = getBucket();
  const prefix = "backups/";
  const now = Date.now();
  const DAY = 86_400_000;

  let continuationToken: string | undefined;
  const toDelete: string[] = [];

  do {
    const resp: any = await s3.send(new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
      ContinuationToken: continuationToken,
    }));
    for (const obj of (resp.Contents ?? [])) {
      const key: string = obj.Key ?? "";
      const lastMod: Date = obj.LastModified ?? new Date(0);
      const age = now - lastMod.getTime();
      const isWeekly = key.includes("-weekly");
      const maxAge = isWeekly ? 90 * DAY : 30 * DAY;
      if (age > maxAge) toDelete.push(key);
    }
    continuationToken = resp.IsTruncated ? resp.NextContinuationToken : undefined;
  } while (continuationToken);

  for (const key of toDelete) {
    await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    console.log(`[backup] Deleted old backup: ${key}`);
  }
  if (toDelete.length === 0) console.log("[backup] No old backups to prune.");
}

// ── 列出所有備份 ──
export async function listBackups(): Promise<Array<{ key: string; size: number; lastModified: Date }>> {
  const bucket = getBucket();
  const results: Array<{ key: string; size: number; lastModified: Date }> = [];
  let continuationToken: string | undefined;
  do {
    const resp: any = await s3.send(new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: "backups/",
      ContinuationToken: continuationToken,
    }));
    for (const obj of (resp.Contents ?? [])) {
      results.push({
        key: obj.Key ?? "",
        size: obj.Size ?? 0,
        lastModified: obj.LastModified ?? new Date(0),
      });
    }
    continuationToken = resp.IsTruncated ? resp.NextContinuationToken : undefined;
  } while (continuationToken);
  return results.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());
}

// ── 主備份函數（可手動呼叫）──
export async function runBackup(): Promise<{ key: string; url: string; sizeKb: number }> {
  console.log("[backup] Starting database backup...");

  // 產生 SQL
  const sql = await generateSqlDump();
  console.log(`[backup] SQL dump generated: ${Math.round(sql.length / 1024)} KB`);

  // gzip 壓縮
  const compressed = await gzip(sql);
  console.log(`[backup] Compressed to: ${Math.round(compressed.length / 1024)} KB`);

  // 檔名：backups/2026-04-24_18-00.sql.gz（週日加 -weekly 標籤）
  const now = new Date();
  const isWeekly = now.getUTCDay() === 0; // Sunday UTC
  const dateStr = now.toISOString().slice(0, 16).replace("T", "_").replace(":", "-");
  const key = `backups/${dateStr}${isWeekly ? "-weekly" : ""}.sql.gz`;

  // 上傳
  const url = await uploadToS3(key, compressed);
  console.log(`[backup] Uploaded to S3: ${key}`);

  // 清理舊備份
  await pruneOldBackups();

  console.log(`[backup] Done. Key: ${key}`);
  return { key, url, sizeKb: Math.round(compressed.length / 1024) };
}

// ── 啟動定時排程（每日 HKT 02:00 = UTC 18:00）──
export function startBackupCron() {
  // 動態 import node-cron 避免載入時出錯
  import("node-cron").then(({ default: cron }) => {
    // "0 18 * * *" = 每日 UTC 18:00 (HKT 02:00)
    cron.schedule("0 18 * * *", async () => {
      try {
        const result = await runBackup();
        console.log(`[backup] Daily backup complete: ${result.key} (${result.sizeKb} KB)`);
      } catch (err) {
        console.error("[backup] Daily backup FAILED:", err);
      }
    });
    console.log("[backup] Cron scheduled: daily at HKT 02:00 (UTC 18:00)");
  }).catch(err => {
    console.error("[backup] Failed to load node-cron:", err);
  });
}
