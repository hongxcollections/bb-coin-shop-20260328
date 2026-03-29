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
      <h1>🪙 大BB錢幣店</h1>
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
}

export async function sendWonEmail(params: WonEmailParams): Promise<boolean> {
  const { to, senderName, senderEmail, userName, auctionTitle, finalPrice, currency, auctionUrl } = params;
  const body = `
    <h2>🎉 恭喜您成功得標！</h2>
    <p>親愛的 <strong>${userName}</strong>，</p>
    <p>恭喜您在以下拍賣中以最高出價成功得標：</p>
    <div class="highlight">
      <div class="label">得標拍賣品</div>
      <div style="font-size:16px;font-weight:600;color:#333;margin-top:4px;">${auctionTitle}</div>
    </div>
    <div class="highlight">
      <div class="label">成交價格</div>
      <div class="value">${currency} ${finalPrice.toLocaleString()}</div>
    </div>
    <p>請等候賣家聯絡您安排付款及交收事宜。如有查詢，請聯絡大BB錢幣店。</p>
    <a href="${auctionUrl}" class="btn">查看拍賣詳情 →</a>
  `;
  return sendEmail({ to, senderName, senderEmail, subject: `【恭喜得標】${auctionTitle}`, html: baseLayout("得標通知", body) });
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

// ─── Core send function ───────────────────────────────────────────────────────

async function sendEmail(opts: {
  to: string;
  senderName: string;
  senderEmail: string;
  subject: string;
  html: string;
}): Promise<boolean> {
  try {
    const resend = getResend();
    const { error } = await resend.emails.send({
      from: `${opts.senderName} <${opts.senderEmail}>`,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    });
    if (error) {
      console.error("[Email] Send failed:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[Email] Unexpected error:", err);
    return false;
  }
}
