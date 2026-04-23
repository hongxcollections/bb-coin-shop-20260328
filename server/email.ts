import { Resend } from "resend";

// Lazy-init Resend client so missing API key only fails at send time
let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error("RESEND_API_KEY is not set");
    _resend = new Resend(key);
  }
  return _resend;
}

export interface EmailOptions {
  to: string;
  senderName: string;
  senderEmail: string;
}

// ─── Template helpers ────────────────────────────────────────────────────────

function baseLayout(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="zh-HK">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    body { margin:0; padding:0; background:#fdf8f0; font-family:'Helvetica Neue',Arial,sans-serif; color:#333; }
    .wrapper { max-width:560px; margin:32px auto; background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 2px 12px rgba(0,0,0,.08); }
    .header { background:linear-gradient(135deg,#d97706,#b45309); padding:28px 32px; text-align:center; }
    .header h1 { margin:0; color:#fff; font-size:22px; letter-spacing:.5px; }
    .header p { margin:4px 0 0; color:#fde68a; font-size:13px; }
    .body { padding:28px 32px; }
    .body h2 { margin:0 0 12px; font-size:18px; color:#92400e; }
    .body p { margin:0 0 12px; line-height:1.6; font-size:14px; }
    .highlight { background:#fef3c7; border-left:4px solid #d97706; border-radius:4px; padding:12px 16px; margin:16px 0; }
    .highlight .label { font-size:12px; color:#92400e; font-weight:600; text-transform:uppercase; letter-spacing:.5px; }
    .highlight .value { font-size:22px; font-weight:700; color:#b45309; margin-top:4px; }
    .btn { display:inline-block; margin-top:20px; padding:12px 28px; background:#d97706; color:#fff; text-decoration:none; border-radius:8px; font-weight:600; font-size:14px; }
    .footer { background:#fdf8f0; padding:16px 32px; text-align:center; font-size:12px; color:#9ca3af; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>💰 hongxcollections</h1>
      <p>專業錢幣拍賣平台</p>
    </div>
    <div class="body">${body}</div>
    <div class="footer">此郵件由系統自動發送，請勿直接回覆。</div>
  </div>
</body>
</html>`;
}

// ─── Email: outbid ────────────────────────────────────────────────────────────

export interface OutbidEmailParams extends EmailOptions {
  userName: string;
  auctionTitle: string;
  auctionId: number;
  newHighestBid: number;
  currency: string;
  auctionUrl: string;
}

export async function sendOutbidEmail(params: OutbidEmailParams): Promise<boolean> {
  const { to, senderName, senderEmail, userName, auctionTitle, newHighestBid, currency, auctionUrl } = params;
  const body = `
    <h2>您的出價已被超越</h2>
    <p>親愛的 <strong>${userName}</strong>，</p>
    <p>您在以下拍賣的出價已被其他買家超越：</p>
    <div class="highlight">
      <div class="label">拍賣品</div>
      <div style="font-size:16px;font-weight:600;color:#333;margin-top:4px;">${auctionTitle}</div>
    </div>
    <div class="highlight">
      <div class="label">目前最高出價</div>
      <div class="value">${currency} ${newHighestBid.toLocaleString()}</div>
    </div>
    <p>如您仍有意競投，請立即前往拍賣頁面重新出價！</p>
    <a href="${auctionUrl}" class="btn">立即出價 →</a>
  `;
  return sendEmail({ to, senderName, senderEmail, subject: `【出價被超越】${auctionTitle}`, html: baseLayout("出價被超越通知", body) });
}

// ─── Email: won ───────────────────────────────────────────────────────────────

export interface WonEmailParams extends EmailOptions {
  userName: string;
  auctionTitle: string;
  auctionId: number;
  finalPrice: number;
  currency: string;
  auctionUrl: string;
  paymentInstructions?: string | null;
  deliveryInfo?: string | null;
  merchantName?: string | null;
  merchantWhatsapp?: string | null;
}

/** Convert newlines to <br> for HTML display */
function nl2br(text: string): string {
  return text.replace(/\n/g, '<br />');
}

export async function sendWonEmail(params: WonEmailParams): Promise<boolean> {
  const { to, senderName, senderEmail, userName, auctionTitle, finalPrice, currency, auctionUrl, paymentInstructions, deliveryInfo, merchantName, merchantWhatsapp } = params;

  const defaultPayment = '接受付款方式：FPS、八達通、微信支付、支付寶、BOCPay、Visa\n請聯絡 hongxcollections 安排付款。';
  const defaultDelivery = '建議順豐到付（買家承擔運費），或歡迎來店自取（請提前聯絡預約）。';

  const paymentHtml = nl2br(paymentInstructions || defaultPayment);
  const deliveryHtml = nl2br(deliveryInfo || defaultDelivery);

  // 生成商戶聯絡區塊
  const displayMerchantName = merchantName || 'hongxcollections';
  let contactHtml = '';
  if (merchantWhatsapp) {
    const waNumber = merchantWhatsapp.replace(/\D/g, '');
    const waMessage = encodeURIComponent(`您好，我在 hongxcollections 以 ${currency}$${finalPrice.toLocaleString()} 得標「${auctionTitle}」，想查詢付款及交收安排，謝謝！`);
    const waUrl = `https://wa.me/${waNumber}?text=${waMessage}`;
    contactHtml = `
    <div style="margin-top:24px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px 20px;">
      <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#15803d;">📞 聯絡商戶</p>
      <p style="margin:0 0 12px;font-size:13px;color:#166534;">如有查詢，歡迎直接聯絡 <strong>${displayMerchantName}</strong></p>
      <a href="${waUrl}" style="display:inline-block;background:#25d366;color:#fff;text-decoration:none;padding:9px 20px;border-radius:6px;font-size:13px;font-weight:600;">
        💬 WhatsApp 聯絡商戶
      </a>
    </div>`;
  } else {
    contactHtml = `<p style="margin-top:20px;font-size:13px;color:#6b7280;">如有任何查詢，請聯絡商戶 <strong>${displayMerchantName}</strong>。我們期待與您完成交易！</p>`;
  }

  const body = `
    <h2>🎉 恭喜您成功得標！</h2>
    <p>親愛的 <strong>${userName}</strong>，</p>
    <p>恭喜您在以下拍賣中以最高出價成功得標！</p>

    <div class="highlight">
      <div class="label">得標拍賣品</div>
      <div style="font-size:16px;font-weight:600;color:#333;margin-top:4px;">${auctionTitle}</div>
    </div>
    <div class="highlight">
      <div class="label">成交價格</div>
      <div class="value">${currency} ${finalPrice.toLocaleString()}</div>
    </div>

    <h2 style="margin-top:24px;font-size:16px;color:#92400e;">💳 付款方式</h2>
    <div style="background:#f0fdf4;border-left:4px solid #16a34a;border-radius:4px;padding:12px 16px;margin:8px 0;font-size:14px;line-height:1.8;">
      ${paymentHtml}
    </div>

    <h2 style="margin-top:20px;font-size:16px;color:#92400e;">📦 交收安排</h2>
    <div style="background:#eff6ff;border-left:4px solid #3b82f6;border-radius:4px;padding:12px 16px;margin:8px 0;font-size:14px;line-height:1.8;">
      ${deliveryHtml}
    </div>

    ${contactHtml}
    <a href="${auctionUrl}" class="btn" style="margin-top:20px;">查看拍賣詳情 →</a>
  `;
  return sendEmail({ to, senderName, senderEmail, subject: `🎉 【恭喜得標】${auctionTitle} — 成交價 ${currency} ${finalPrice.toLocaleString()}`, html: baseLayout("得標通知", body) });
}

// ─── Email: ending soon ───────────────────────────────────────────────────────

export interface EndingSoonEmailParams extends EmailOptions {
  userName: string;
  auctionTitle: string;
  auctionId: number;
  currentPrice: number;
  currency: string;
  minutesLeft: number;
  auctionUrl: string;
}

export async function sendEndingSoonEmail(params: EndingSoonEmailParams): Promise<boolean> {
  const { to, senderName, senderEmail, userName, auctionTitle, currentPrice, currency, minutesLeft, auctionUrl } = params;
  const timeLabel = minutesLeft >= 60 ? `${Math.round(minutesLeft / 60)} 小時` : `${minutesLeft} 分鐘`;
  const body = `
    <h2>⏰ 拍賣即將結束</h2>
    <p>親愛的 <strong>${userName}</strong>，</p>
    <p>您參與競投的拍賣將於 <strong>${timeLabel}</strong> 後結束：</p>
    <div class="highlight">
      <div class="label">拍賣品</div>
      <div style="font-size:16px;font-weight:600;color:#333;margin-top:4px;">${auctionTitle}</div>
    </div>
    <div class="highlight">
      <div class="label">目前最高出價</div>
      <div class="value">${currency} ${currentPrice.toLocaleString()}</div>
    </div>
    <p>把握最後機會，立即前往出價！</p>
    <a href="${auctionUrl}" class="btn">立即出價 →</a>
  `;
  return sendEmail({ to, senderName, senderEmail, subject: `【即將結束】${auctionTitle} — 還剩 ${timeLabel}`, html: baseLayout("拍賣即將結束通知", body) });
}

// ─── Email: merchant won (auction ended, notify seller) ──────────────────────

export interface MerchantWonEmailParams extends EmailOptions {
  merchantName: string;
  auctionTitle: string;
  auctionId: number;
  finalPrice: number;
  currency: string;
  winnerName: string;
  winnerPhone: string | null;
  auctionUrl: string;
}

export async function sendMerchantWonEmail(params: MerchantWonEmailParams): Promise<boolean> {
  const { to, senderName, senderEmail, merchantName, auctionTitle, auctionId, finalPrice, currency, winnerName, winnerPhone, auctionUrl } = params;

  const body = `
    <h2>🏆 您的拍賣已結標！</h2>
    <p>親愛的 <strong>${merchantName}</strong>，</p>
    <p>您的拍賣品已成功結標，以下是得標者資訊：</p>

    <div class="highlight">
      <div class="label">得標拍賣品</div>
      <div style="font-size:16px;font-weight:600;color:#333;margin-top:4px;">${auctionTitle}</div>
    </div>
    <div class="highlight">
      <div class="label">成交價格</div>
      <div class="value">${currency} ${finalPrice.toLocaleString()}</div>
    </div>
    <div class="highlight">
      <div class="label">得標者</div>
      <div style="font-size:16px;font-weight:600;color:#333;margin-top:4px;">${winnerName}</div>
      ${winnerPhone ? `<div style="font-size:13px;color:#6b7280;margin-top:4px;">📞 ${winnerPhone}</div>` : ''}
    </div>

    <p style="margin-top:20px;font-size:13px;color:#6b7280;">請盡快與得標者聯絡安排付款及交收事宜。</p>
    <a href="${auctionUrl}" class="btn">查看拍賣詳情 →</a>
  `;
  return sendEmail({ to, senderName, senderEmail, subject: `🏆 【拍賣結標】${auctionTitle} — 成交價 ${currency} ${finalPrice.toLocaleString()}`, html: baseLayout("拍賣結標通知", body) });
}

// ─── Email: OTP fallback (phone registration via email verification) ─────────

export interface OtpFallbackEmailParams {
  to: string;
  senderName: string;
  senderEmail: string;
  code: string;
  phone: string;
}

export async function sendOtpFallbackEmail(params: OtpFallbackEmailParams): Promise<boolean> {
  const { to, senderName, senderEmail, code, phone } = params;
  const body = `
    <h2>📱 手機號碼驗證碼</h2>
    <p>您正在使用電郵驗證作為短訊的備用方式，以完成手機號碼 <strong>${phone}</strong> 的註冊。</p>
    <div class="highlight">
      <div class="label">您的驗證碼</div>
      <div class="value" style="letter-spacing:8px;">${code}</div>
    </div>
    <p style="font-size:13px;color:#6b7280;">驗證碼有效期為 <strong>10 分鐘</strong>，請勿將驗證碼告知他人。</p>
    <p style="font-size:12px;color:#9ca3af;margin-top:16px;">如您並未嘗試在 hongxcollections 註冊，請忽略此郵件。</p>
  `;
  return sendEmail({
    to,
    senderName,
    senderEmail,
    subject: `【hongxcollections】手機驗證碼：${code}`,
    html: baseLayout("手機號碼驗證碼", body),
  });
}

// ─── Internal send ────────────────────────────────────────────────────────────

async function sendEmail(opts: {
  to: string;
  senderName: string;
  senderEmail: string;
  subject: string;
  html: string;
}): Promise<boolean> {
  const result = await sendEmailWithDetails(opts);
  return result.ok;
}

/** Send email and return structured result with error details for debugging. */
export async function sendEmailWithDetails(opts: {
  to: string;
  senderName: string;
  senderEmail: string;
  subject: string;
  html: string;
}): Promise<{ ok: boolean; emailId?: string; resendError?: string }> {
  try {
    const resend = getResend();
    const { data, error } = await resend.emails.send({
      from: `${opts.senderName} <${opts.senderEmail}>`,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    });
    if (error) {
      const errStr = JSON.stringify(error);
      console.error(`[Email] Send failed | from=${opts.senderEmail} to=${opts.to} | Resend error: ${errStr}`);
      return { ok: false, resendError: errStr };
    }
    console.log(`[Email] Sent OK | id=${data?.id} to=${opts.to}`);
    return { ok: true, emailId: data?.id };
  } catch (err) {
    const errStr = err instanceof Error ? err.message : String(err);
    console.error(`[Email] Unexpected error | from=${opts.senderEmail} to=${opts.to}: ${errStr}`);
    return { ok: false, resendError: errStr };
  }
}
