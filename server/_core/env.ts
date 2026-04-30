const _ownerOpenId = process.env.OWNER_OPEN_ID ?? "";
console.log(`[ENV] OWNER_OPEN_ID loaded: "${_ownerOpenId}" (length: ${_ownerOpenId.length})`);

// Support BB_DATABASE_URL as fallback (Replit reserves DATABASE_URL)
const _databaseUrl = process.env.BB_DATABASE_URL || process.env.DATABASE_URL || "";

export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: _databaseUrl,
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  // SITE_URL = 電郵連結用的網站根 URL（例：https://hongxcollections.com）
  // 必須在 Railway Production 設定此環境變數才能正確生成電郵連結
  siteUrl: (process.env.SITE_URL || "").replace(/\/$/, ""),
  ownerOpenId: _ownerOpenId,
  isProduction: process.env.NODE_ENV === "production" && process.env.SANDBOX_MODE !== "true",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  openAiApiKey: process.env.OPENAI_API_KEY ?? "",
  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
  geminiApiKey2: process.env.GEMINI_API_KEY_2 ?? "",
  openRouterApiKey: process.env.OPENROUTER_API_KEY ?? "",
  webhookSecret: process.env.WEBHOOK_SECRET ?? "",
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  s3AccessKey: process.env.S3_ACCESS_KEY ?? "",
  s3SecretKey: process.env.S3_SECRET_KEY ?? "",
  s3Bucket: process.env.S3_BUCKET ?? "",
  s3Endpoint: process.env.S3_ENDPOINT ?? "",
};
