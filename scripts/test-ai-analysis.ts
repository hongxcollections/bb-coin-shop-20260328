#!/usr/bin/env tsx
/**
 * 本地 AI 分析測試腳本
 * 用法：cd bb-coin-shop && npx tsx scripts/test-ai-analysis.ts
 * 說明：在部署 UAT 前本地完整驗證 AI 分析流程
 */

import * as https from "https";
import * as http from "http";

// ── 讀取本地 .env ───────────────────────────────────────────────
const dotenv = await import("dotenv");
dotenv.config({ path: new URL("../.env", import.meta.url).pathname });

const GEMINI_KEY_1 = process.env.GEMINI_API_KEY ?? "";
const GEMINI_KEY_2 = process.env.GEMINI_API_KEY_2 ?? "";
const OR_KEY = process.env.OPENROUTER_API_KEY ?? "";
const GG = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const OR = "https://openrouter.ai/api/v1/chat/completions";

// ── extractJson（與 routers.ts 完全同步）──────────────────────
function repairJson(s: string): string {
  let result = "";
  let inStr = false;
  let esc = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (esc) { result += ch; esc = false; continue; }
    if (ch === "\\" && inStr) { result += ch; esc = true; continue; }
    if (ch === '"') { inStr = !inStr; result += ch; continue; }
    if (inStr && (ch === "\n" || ch === "\r")) { result += ch === "\n" ? "\\n" : "\\r"; continue; }
    if (inStr && ch === "\t") { result += "\\t"; continue; }
    result += ch;
  }
  return result;
}

function extractJson(raw: unknown): Record<string, unknown> | null {
  let content =
    typeof raw === "string"
      ? raw
      : Array.isArray(raw)
        ? (raw as Array<{ type: string; text?: string }>).find((p) => p.type === "text")?.text ?? ""
        : "";

  content = content.replace(/<thinking>[\s\S]*?<\/thinking>/gi, "");
  content = content.replace(/```(?:json)?\s*/gi, "").replace(/```\s*/g, "");

  const startIdx = content.indexOf("{");
  if (startIdx === -1) return null;

  let depth = 0, inStr = false, esc = false, endIdx = -1;
  for (let i = startIdx; i < content.length; i++) {
    const ch = content[i];
    if (esc) { esc = false; continue; }
    if (ch === "\\" && inStr) { esc = true; continue; }
    if (ch === '"') { inStr = !inStr; continue; }
    if (!inStr) {
      if (ch === "{") depth++;
      else if (ch === "}") { depth--; if (depth === 0) { endIdx = i; break; } }
    }
  }
  if (endIdx === -1) return null;

  const slice = content.substring(startIdx, endIdx + 1);
  try {
    const parsed = JSON.parse(slice);
    if (typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return Object.keys(parsed).length >= 3 ? parsed : null;
  } catch {
    try {
      const parsed = JSON.parse(repairJson(slice));
      if (typeof parsed !== "object" || Array.isArray(parsed)) return null;
      return Object.keys(parsed).length >= 3 ? parsed : null;
    } catch { return null; }
  }
}

// ── 下載圖片轉 base64 ─────────────────────────────────────────
function downloadImage(url: string): Promise<{ base64: string; mime: string }> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;
    client.get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        downloadImage(res.headers.location).then(resolve, reject);
        return;
      }
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => {
        const buf = Buffer.concat(chunks);
        const mime = (res.headers["content-type"] as string)?.split(";")[0]?.trim() || "image/jpeg";
        resolve({ base64: buf.toString("base64"), mime });
      });
      res.on("error", reject);
    }).on("error", reject);
  });
}

// ── 呼叫模型並回傳結果 ─────────────────────────────────────────
async function callModel(
  url: string, key: string, model: string,
  imageBase64: string, mime: string
): Promise<{ ok: boolean; result?: Record<string, unknown>; error?: string; raw?: string }> {
  const systemPrompt = `你是世界頂尖的錢幣學家。請極仔細分析圖片中的錢幣，以 JSON 格式回覆。
必須只輸出純 JSON 物件，不要有任何額外文字、不要有 markdown 代碼塊。
格式：{"type":"錢幣","name":"完整官方名稱","country":"發行國家","year":"年份","denomination":"面額","material":"材質","condition":"品相","rarity":"稀有程度","estimatedValue":"估值","historicalBackground":"歷史背景"}`;

  const payload = {
    model,
    max_tokens: 1800,
    temperature: 0.1,
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: [
          { type: "image_url", image_url: { url: `data:${mime};base64,${imageBase64}`, detail: "high" } },
          { type: "text", text: "請根據以上指引詳細鑑定圖片。必須只輸出純 JSON 物件，直接以 { 開始，以 } 結尾。" },
        ],
      },
    ],
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 40_000);
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!resp.ok) {
      const errBody = await resp.text();
      return { ok: false, error: `HTTP ${resp.status}: ${errBody.substring(0, 200)}` };
    }
    const json = await resp.json() as { choices: Array<{ message: { content: unknown } }> };
    const raw = json.choices?.[0]?.message?.content;
    const rawText = typeof raw === "string" ? raw : JSON.stringify(raw) ?? "";
    const parsed = extractJson(raw);
    if (!parsed) {
      return { ok: false, error: "extractJson 失敗", raw: rawText.substring(0, 600) };
    }
    return { ok: true, result: parsed };
  } catch (e: unknown) {
    clearTimeout(timer);
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg.includes("abort") ? "TIMEOUT(40s)" : msg };
  }
}

// ── 單元測試：extractJson ─────────────────────────────────────
function testExtractJson() {
  console.log("\n══ 單元測試：extractJson ══");

  const tests: Array<{ label: string; input: string; shouldPass: boolean }> = [
    { label: "正常 JSON", input: `{"type":"錢幣","name":"test","country":"HK","year":"2020"}`, shouldPass: true },
    { label: "Markdown ```json 包裝", input: "```json\n{\"type\":\"錢幣\",\"name\":\"test\",\"country\":\"HK\"}\n```", shouldPass: true },
    { label: "Markdown ``` 包裝（無 json）", input: "```\n{\"type\":\"錢幣\",\"name\":\"test\",\"country\":\"HK\"}\n```", shouldPass: true },
    { label: "字串內含配對 {}", input: `{"type":"錢幣","name":"test","country":"HK","historicalBackground":"清朝{光緒}年間（1875-1908）"}`, shouldPass: true },
    { label: "字串內含不配對 {", input: `{"type":"錢幣","name":"test","country":"HK","historicalBackground":"屬於{清朝末期的貨幣"}`, shouldPass: true },
    { label: "前有說明文字", input: `以下是我的分析：\n{"type":"錢幣","name":"test","country":"HK","year":"1900"}`, shouldPass: true },
    { label: "<thinking> 標籤", input: `<thinking>分析中...</thinking>\n{"type":"錢幣","name":"test","country":"HK","year":"2000"}`, shouldPass: true },
    { label: "字串內有未逸出換行（repairJson）", input: `{"type":"錢幣","name":"test","country":"HK","historicalBackground":"第一行\n第二行\n第三行"}`, shouldPass: true },
    { label: "轉義字符 \\\"", input: `{"type":"錢幣","name":"test \\\"特殊\\\"","country":"HK","year":"2020"}`, shouldPass: true },
    { label: "無 JSON", input: "對不起，我無法分析這張圖片。", shouldPass: false },
    { label: "欄位不足（<3 鍵）", input: `{"type":"錢幣","name":"test"}`, shouldPass: false },
  ];

  let pass = 0, fail = 0;
  for (const t of tests) {
    const result = extractJson(t.input);
    const ok = t.shouldPass ? result !== null : result === null;
    const icon = ok ? "✅" : "❌";
    console.log(`  ${icon} ${t.label}`);
    if (!ok) {
      console.log(`     期望 ${t.shouldPass ? "通過" : "失敗"}，實際 ${result !== null ? "通過" : "失敗"}`);
      fail++;
    } else {
      pass++;
    }
  }
  console.log(`  結果：${pass} 通過 / ${fail} 失敗`);
  return fail === 0;
}

// ── 主測試流程 ────────────────────────────────────────────────
async function main() {
  console.log("🔬 大BB錢幣店 AI 分析完整測試\n");

  // 1. 單元測試
  const unitOk = testExtractJson();
  if (!unitOk) {
    console.log("\n❌ 單元測試失敗，先修復再測試 API");
    process.exit(1);
  }

  // 2. 下載測試用錢幣圖片（袁大頭）
  console.log("\n══ 下載測試圖片 ══");
  let imageBase64 = "";
  let imageMime = "image/jpeg";
  const imageUrls = [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c6/Yuan_Shikai_dollar_obverse.jpg/480px-Yuan_Shikai_dollar_obverse.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/c/c6/Yuan_Shikai_dollar_obverse.jpg",
  ];
  for (const url of imageUrls) {
    try {
      const img = await downloadImage(url);
      if (img.base64.length > 1000) {
        imageBase64 = img.base64;
        imageMime = img.mime;
        const kb = Math.round(imageBase64.length * 0.75 / 1024);
        console.log(`  ✅ 圖片下載成功 (${kb}KB) from ${url.substring(0, 60)}...`);
        break;
      }
    } catch (e) {
      console.log(`  ⚠️  ${url.substring(0, 60)}... 失敗：${e}`);
    }
  }
  if (!imageBase64) {
    console.log("  ❌ 所有圖片下載均失敗");
    process.exit(1);
  }

  // 3. 測試各模型
  console.log("\n══ API 模型測試 ══");
  const models: Array<{ label: string; url: string; key: string; model: string }> = [];

  if (GEMINI_KEY_1) {
    models.push({ label: "Gemini 2.0 Flash (key1)", url: GG, key: GEMINI_KEY_1, model: "gemini-2.0-flash" });
    models.push({ label: "Gemini 2.5 Flash (key1)", url: GG, key: GEMINI_KEY_1, model: "gemini-2.5-flash" });
  }
  if (GEMINI_KEY_2) {
    models.push({ label: "Gemini 2.0 Flash (key2)", url: GG, key: GEMINI_KEY_2, model: "gemini-2.0-flash" });
    models.push({ label: "Gemini 2.5 Flash (key2)", url: GG, key: GEMINI_KEY_2, model: "gemini-2.5-flash" });
  }
  if (OR_KEY) {
    models.push({ label: "OR: gemini-2.0-flash-thinking-exp:free", url: OR, key: OR_KEY, model: "google/gemini-2.0-flash-thinking-exp:free" });
    models.push({ label: "OR: qwen2.5-vl-7b:free", url: OR, key: OR_KEY, model: "qwen/qwen2.5-vl-7b-instruct:free" });
    models.push({ label: "OR: qwen2.5-vl-72b:free", url: OR, key: OR_KEY, model: "qwen/qwen2.5-vl-72b-instruct:free" });
    models.push({ label: "OR: pixtral-12b-2409:free", url: OR, key: OR_KEY, model: "mistralai/pixtral-12b-2409:free" });
  }

  if (models.length === 0) {
    console.log("  ❌ 沒有設定任何 API key");
    process.exit(1);
  }

  const results: Array<{ label: string; ok: boolean; ms: number; info?: string }> = [];
  for (const m of models) {
    process.stdout.write(`  測試 ${m.label}... `);
    const t0 = Date.now();
    const res = await callModel(m.url, m.key, m.model, imageBase64, imageMime);
    const elapsed = Date.now() - t0;
    if (res.ok) {
      const name = String(res.result?.name ?? "").substring(0, 30);
      const year = String(res.result?.year ?? "");
      console.log(`✅ 成功 (${elapsed}ms) | name: ${name} | year: ${year}`);
      results.push({ label: m.label, ok: true, ms: elapsed, info: name });
    } else {
      console.log(`❌ 失敗 (${elapsed}ms): ${res.error}`);
      if (res.raw) {
        console.log(`     原始回應前300字: ${res.raw.substring(0, 300)}`);
      }
      results.push({ label: m.label, ok: false, ms: elapsed });
    }
  }

  // 4. 摘要
  console.log("\n══ 摘要 ══");
  const ok = results.filter(r => r.ok);
  const fail = results.filter(r => !r.ok);
  console.log(`  ✅ 成功: ${ok.length}/${results.length} 個模型`);
  if (ok.length > 0) console.log(`  首選模型：${ok[0].label} (${ok[0].ms}ms)`);
  if (fail.length > 0) console.log(`  ❌ 失敗：${fail.map(r => r.label).join(", ")}`);

  if (ok.length === 0) {
    console.log("\n❌ 所有模型均失敗！不可部署。");
    process.exit(1);
  } else {
    console.log("\n✅ 測試通過，可以部署 UAT。");
  }
}

main().catch((e) => { console.error("❌ 腳本錯誤：", e); process.exit(1); });
