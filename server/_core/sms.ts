import twilio from "twilio";
import Dysmsapi, * as dysmsapiModels from "@alicloud/dysmsapi20170525";
import * as OpenApi from "@alicloud/openapi-client";

const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_FROM = process.env.TWILIO_FROM_NUMBER || process.env.TWILIO_MESSAGING_SERVICE_SID;

const ALI_KEY_ID = process.env.ALIBABA_ACCESS_KEY_ID;
const ALI_KEY_SECRET = process.env.ALIBABA_ACCESS_KEY_SECRET;
const ALI_SIGN_NAME = process.env.ALIBABA_SMS_SIGN_NAME;
const ALI_TEMPLATE_CODE = process.env.ALIBABA_SMS_TEMPLATE_CODE;

function isMainlandChina(phone: string): boolean {
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

async function sendViaTwilio(to: string, message: string): Promise<boolean> {
  const client = getTwilioClient();
  if (!client || !TWILIO_FROM) {
    console.log(`[SMS DEV/Twilio] To: ${to} | ${message}`);
    return true;
  }
  try {
    const fromOpts = TWILIO_FROM.startsWith("MG")
      ? { messagingServiceSid: TWILIO_FROM }
      : { from: TWILIO_FROM };
    await client.messages.create({ body: message, to, ...fromOpts });
    return true;
  } catch (err) {
    console.error("[SMS/Twilio] Failed:", err);
    return false;
  }
}

async function sendViaAlibaba(phone: string, otpCode: string): Promise<boolean> {
  const client = getAliClient();
  if (!client || !ALI_SIGN_NAME || !ALI_TEMPLATE_CODE) {
    console.log(`[SMS DEV/Alibaba] To: ${phone} | OTP: ${otpCode}`);
    return true;
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
      console.error("[SMS/Alibaba] API error:", resp.body?.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[SMS/Alibaba] Failed:", err);
    return false;
  }
}

/**
 * Send OTP SMS. Routes +86 to Alibaba Cloud, others to Twilio.
 */
export async function sendOtpSms(phone: string, otpCode: string): Promise<boolean> {
  const message = `【大BB錢幣店】您的驗證碼為 ${otpCode}，10分鐘內有效，請勿洩露給他人。`;
  if (isMainlandChina(phone)) {
    return sendViaAlibaba(phone, otpCode);
  }
  return sendViaTwilio(phone, message);
}

export function getSmsProviderStatus() {
  return {
    twilio: !!(TWILIO_SID && TWILIO_TOKEN && TWILIO_FROM),
    alibaba: !!(ALI_KEY_ID && ALI_KEY_SECRET && ALI_SIGN_NAME && ALI_TEMPLATE_CODE),
  };
}
