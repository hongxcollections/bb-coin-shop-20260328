import twilio from "twilio";
import Dysmsapi, * as dysmsapiModels from "@alicloud/dysmsapi20170525";
import * as OpenApi from "@alicloud/openapi-client";

const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_VERIFY_SID = process.env.TWILIO_VERIFY_SERVICE_SID; // VAxxxxxxxxxxxxxxxx

const ALI_KEY_ID = process.env.ALIBABA_ACCESS_KEY_ID;
const ALI_KEY_SECRET = process.env.ALIBABA_ACCESS_KEY_SECRET;
const ALI_SIGN_NAME = process.env.ALIBABA_SMS_SIGN_NAME;
const ALI_TEMPLATE_CODE = process.env.ALIBABA_SMS_TEMPLATE_CODE;

export function isMainlandChina(phone: string): boolean {
  const cleaned = phone.replace(/\s+/g, "");
  return cleaned.startsWith("+86") || cleaned.startsWith("86");
}

function getTwilioClient() {
  if (!TWILIO_SID || !TWILIO_TOKEN) return null;
  return twilio(TWILIO_SID, TWILIO_TOKEN);
}

function getAliClient() {
  if (!ALI_KEY_ID || !ALI_KEY_SECRET) return null;
  const config = new OpenApi.Config({ accessKeyId: ALI_KEY_ID, accessKeySecret: ALI_KEY_SECRET });
  config.endpoint = "dysmsapi.aliyuncs.com";
  return new Dysmsapi(config);
}

// ─── Twilio Verify ────────────────────────────────────────────────────────────

async function sendViaTwilioVerify(phone: string): Promise<{ ok: boolean; error?: string }> {
  const client = getTwilioClient();

  // No credentials at all — dev mode, just log
  if (!client) {
    console.log(`[SMS DEV/TwilioVerify] Would send verify to: ${phone}`);
    return { ok: true };
  }

  // Verify Service SID not set — fall back to dev log
  if (!TWILIO_VERIFY_SID) {
    console.log(`[SMS DEV/TwilioVerify] TWILIO_VERIFY_SERVICE_SID not set. Phone: ${phone}`);
    return { ok: true };
  }

  try {
    const verification = await client.verify.v2
      .services(TWILIO_VERIFY_SID)
      .verifications.create({ to: phone, channel: "sms" });
    console.log(`[SMS/TwilioVerify] Sent. Status: ${verification.status}`);
    return { ok: true };
  } catch (err: any) {
    const detail = err?.message || String(err);
    console.error(`[SMS/TwilioVerify] Failed to: ${phone} | ${detail}`);
    return { ok: false, error: `Twilio Verify: ${detail}` };
  }
}

export async function checkViaTwilioVerify(phone: string, code: string): Promise<"approved" | "pending" | "failed" | "error"> {
  const client = getTwilioClient();

  // Dev mode (no credentials or no verify SID) — accept any 6-digit code
  if (!client || !TWILIO_VERIFY_SID) {
    console.log(`[SMS DEV/TwilioVerify] Skipping check for ${phone}, code: ${code}`);
    return "approved";
  }

  try {
    const check = await client.verify.v2
      .services(TWILIO_VERIFY_SID)
      .verificationChecks.create({ to: phone, code });
    console.log(`[SMS/TwilioVerify] Check result: ${check.status}`);
    return (check.status as "approved" | "pending") || "failed";
  } catch (err: any) {
    const detail = err?.message || String(err);
    console.error(`[SMS/TwilioVerify] Check failed for ${phone}: ${detail}`);
    return "error";
  }
}

// ─── Alibaba Cloud (China +86) ────────────────────────────────────────────────

async function sendViaAlibaba(phone: string, otpCode: string): Promise<{ ok: boolean; error?: string }> {
  const client = getAliClient();
  if (!client || !ALI_SIGN_NAME || !ALI_TEMPLATE_CODE) {
    console.log(`[SMS DEV/Alibaba] To: ${phone} | OTP: ${otpCode}`);
    return { ok: true };
  }
  try {
    const cleaned = phone.replace(/^\+86/, "").replace(/^86/, "").replace(/\s+/g, "");
    const req = new dysmsapiModels.SendSmsRequest({
      phoneNumbers: cleaned,
      signName: ALI_SIGN_NAME,
      templateCode: ALI_TEMPLATE_CODE,
      templateParam: JSON.stringify({ code: otpCode }),
    });
    const resp = await client.sendSms(req);
    if (resp.body?.code !== "OK") {
      const detail = resp.body?.message || resp.body?.code || "unknown";
      console.error(`[SMS/Alibaba] API error: ${detail}`);
      return { ok: false, error: `Alibaba: ${detail}` };
    }
    console.log(`[SMS/Alibaba] Sent OK to ${phone}`);
    return { ok: true };
  } catch (err: any) {
    const detail = err?.message || String(err);
    console.error(`[SMS/Alibaba] Failed to: ${phone} | ${detail}`);
    return { ok: false, error: `Alibaba: ${detail}` };
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Send OTP SMS.
 * - +86 China  → Alibaba Cloud (uses our own otpStore for verification)
 * - Others     → Twilio Verify (Twilio manages the code + verification)
 */
export async function sendOtpSms(
  phone: string,
  otpCode: string  // used only for Alibaba; Twilio Verify generates its own code
): Promise<{ ok: boolean; error?: string }> {
  if (isMainlandChina(phone)) {
    return sendViaAlibaba(phone, otpCode);
  }
  return sendViaTwilioVerify(phone);
}

export function getSmsProviderStatus() {
  return {
    twilioVerify: !!(TWILIO_SID && TWILIO_TOKEN && TWILIO_VERIFY_SID),
    alibaba: !!(ALI_KEY_ID && ALI_KEY_SECRET && ALI_SIGN_NAME && ALI_TEMPLATE_CODE),
  };
}
