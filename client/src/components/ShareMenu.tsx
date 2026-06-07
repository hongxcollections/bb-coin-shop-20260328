import { useState, useRef, useEffect, useCallback } from "react";
import { Share2, Copy, Check, X, MoreHorizontal, CornerUpRight } from "lucide-react";
import { toast } from "sonner";
import { SHARE_ORIGIN } from "@/lib/shareUrl";

interface SessionShareMenuProps {
  merchantUserId: number;
  slug: string;
  title: string;
  merchantName?: string | null;
  endTime?: string | Date | null;
  iconOnly?: boolean;
  /** 顯示風格：light = 透明背景白邊（hero overlay 用），default = 琥珀邊框 */
  variant?: "default" | "light";
}

export function SessionShareMenu({ merchantUserId, slug, title, merchantName, endTime, iconOnly, variant = "default" }: SessionShareMenuProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const sessionUrl = `${SHARE_ORIGIN}/s/${merchantUserId}/${slug}`;
  let endStr = "";
  if (endTime) {
    const d = new Date(endTime);
    if (!isNaN(d.getTime())) endStr = formatEndTimeDisplay(d);
  }
  const shareText = [
    `🎪 ${title}`,
    merchantName ? `${merchantName} 拍賣專場` : null,
    endStr ? `結束時間：${endStr}` : null,
    sessionUrl,
  ].filter(Boolean).join("\n");

  const calcPosition = useCallback(() => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let top = rect.bottom + 4;
    let left = rect.right - MENU_WIDTH;
    if (left + MENU_WIDTH > vw - 8) left = vw - MENU_WIDTH - 8;
    if (left < 8) left = 8;
    if (top + MENU_HEIGHT > vh - 8) top = rect.top - MENU_HEIGHT - 4;
    if (top < 8) top = 8;
    setMenuPos({ top, left });
  }, []);

  function handleOpen(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    if (open) { setOpen(false); return; }
    calcPosition(); setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    function handleClose() { setOpen(false); }
    document.addEventListener("mousedown", handleClose);
    window.addEventListener("scroll", handleClose, true);
    window.addEventListener("resize", handleClose);
    return () => {
      document.removeEventListener("mousedown", handleClose);
      window.removeEventListener("scroll", handleClose, true);
      window.removeEventListener("resize", handleClose);
    };
  }, [open]);

  async function handleMoreShare() {
    setOpen(false);
    if (navigator.share) {
      try {
        await navigator.clipboard.writeText(shareText).catch(() => {});
        await navigator.share({ title, text: shareText.replace("\n" + sessionUrl, "").trim(), url: sessionUrl });
        toast.success("已開啟系統分享選單", { description: shareText, duration: 5000 });
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== "AbortError") {
          try { await navigator.clipboard.writeText(shareText); } catch {}
          toast.success("已複製連結及廣告文字，可貼到任何平台分享", { description: shareText, duration: 6000 });
        }
      }
    } else {
      try { await navigator.clipboard.writeText(shareText); } catch {}
      toast.success("已複製連結及廣告文字，可貼到任何平台分享", { description: shareText, duration: 6000 });
    }
  }

  async function handleMessenger() {
    setOpen(false);
    const isMobile = /android|iphone|ipad|ipod/i.test(navigator.userAgent);
    if (isMobile) {
      try { await navigator.clipboard.writeText(shareText); } catch {}
      window.location.href = `fb-messenger://share?link=${encodeURIComponent(sessionUrl)}`;
      toast.success("已複製文案，Messenger 開啟後可貼上", { description: shareText, duration: 6000 });
    } else {
      try { await navigator.clipboard.writeText(shareText); } catch {}
      window.open("https://www.messenger.com/", "_blank", "noopener,noreferrer");
      toast.success("已複製連結，請喺 Messenger 對話框貼上", { description: shareText, duration: 6000 });
    }
  }

  function handleWhatsApp() {
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank", "noopener,noreferrer,width=600,height=500");
    setOpen(false);
  }

  function handleThreads() {
    window.open(`https://www.threads.net/intent/post?text=${encodeURIComponent(shareText)}`, "_blank", "noopener,noreferrer,width=600,height=600");
    setOpen(false);
  }

  async function handleCopyText() {
    try {
      await navigator.clipboard.writeText(shareText);
      toast.success("已複製廣告文字", { description: shareText, duration: 5000 });
    } catch { toast.error("複製失敗"); }
    setOpen(false);
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(sessionUrl);
      setCopied(true);
      toast.success("已複製連結", { description: sessionUrl, duration: 5000 });
      setTimeout(() => setCopied(false), 2000);
    } catch { toast.error("複製失敗"); }
    setOpen(false);
  }

  const lightCls = iconOnly
    ? "flex items-center justify-center w-9 h-9 text-amber-800 bg-white hover:bg-amber-50 rounded-full transition-colors shadow-sm"
    : "inline-flex items-center gap-1.5 bg-white text-amber-800 hover:bg-amber-50 text-xs font-bold px-3 py-1.5 rounded-full transition shadow-sm";
  const defaultCls = iconOnly
    ? "flex items-center justify-center w-7 h-7 text-amber-600 hover:text-amber-800 border border-amber-200 hover:border-amber-400 rounded-full transition-colors bg-amber-50 hover:bg-amber-100"
    : "flex items-center gap-1 text-xs text-amber-600 hover:text-amber-800 border border-amber-200 hover:border-amber-400 rounded px-2 py-1 transition-colors bg-amber-50 hover:bg-amber-100";

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={handleOpen}
        title="分享專場"
        className={variant === "light" ? lightCls : defaultCls}
      >
        <Share2 className={iconOnly ? "w-4 h-4" : "w-3.5 h-3.5"} />
        {!iconOnly && "分享專場"}
      </button>
      {open && menuPos && (
        <div
          className="fixed z-[9999] w-44 bg-white rounded-xl shadow-xl border border-amber-100 py-1"
          style={{ top: menuPos.top, left: menuPos.left }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-amber-50">
            <span className="text-[0.65rem] font-semibold text-amber-700 uppercase tracking-wide">分享至</span>
            <button type="button" onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground p-0.5">
              <X className="w-3 h-3" />
            </button>
          </div>
          <button type="button" onClick={handleMoreShare} className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left text-muted-foreground transition-colors hover:bg-amber-50/80 hover:text-amber-700">
            <MoreHorizontal className="w-4 h-4 shrink-0" />更多… ( FB,TG,微信.. )
          </button>
          <button type="button" onClick={handleMessenger} className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left text-muted-foreground transition-colors hover:bg-[#0084FF]/10 hover:text-[#0084FF]">
            <MessengerIcon />Facebook Messenger
          </button>
          <button type="button" onClick={handleWhatsApp} className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left text-muted-foreground transition-colors hover:bg-[#25D366]/10 hover:text-[#25D366]">
            <WhatsAppIcon />WhatsApp
          </button>
          <button type="button" onClick={handleThreads} className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left text-muted-foreground transition-colors hover:bg-black/10 hover:text-black">
            <ThreadsIcon />Threads
          </button>
          <div className="my-1 border-t border-amber-50" />
          <button type="button" onClick={handleCopyText} className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left text-muted-foreground hover:bg-amber-50/80 hover:text-amber-700 transition-colors">
            <Copy className="w-4 h-4 shrink-0" />複製廣告文字
          </button>
          <button type="button" onClick={handleCopy} className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left text-muted-foreground hover:bg-amber-50/80 hover:text-amber-700 transition-colors">
            {copied ? <Check className="w-4 h-4 text-green-500 shrink-0" /> : <Copy className="w-4 h-4 shrink-0" />}
            {copied ? "已複製！" : "複製連結"}
          </button>
        </div>
      )}
    </>
  );
}

interface ShareMenuProps {
  auctionId: number;
  title: string;
  latestBid: number;
  currency?: string | null;
  endTime?: string | Date | null;
  shareTemplate?: string | null;
  iconOnly?: boolean;
  fbCardStyle?: boolean;
  buttonClassName?: string;
}

const DEFAULT_SHARE_TEMPLATE = "{title}\n目前出價 {price}\n結標時間：{endTime}\n@所有人 歡迎登入網站齊來競拍！";

function buildShareText(
  template: string | null | undefined,
  vars: { title: string; price: string; endTime: string }
): string {
  const userTpl = template?.trim() || "";
  const hasPlaceholders = /\{title\}|\{price\}|\{endTime\}/.test(userTpl);
  // 若 template 無 placeholder（舊格式 / 純文字），唔用它，直接用預設格式確保拍賣資料永遠顯示
  const tpl = (userTpl && hasPlaceholders) ? userTpl : DEFAULT_SHARE_TEMPLATE;
  return tpl
    .replace(/\{title\}/g, vars.title)
    .replace(/\{price\}/g, vars.price)
    .replace(/\{endTime\}/g, vars.endTime);
}

function formatEndTimeDisplay(endTime: Date): string {
  const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
  const year = endTime.getFullYear();
  const month = endTime.getMonth() + 1;
  const day = endTime.getDate();
  const weekday = weekdays[endTime.getDay()];
  const hours = endTime.getHours();
  const minutes = endTime.getMinutes().toString().padStart(2, "0");

  let period: string;
  let displayHour: number;
  if (hours < 6) {
    period = "凌晨";
    displayHour = hours;
  } else if (hours < 12) {
    period = "上午";
    displayHour = hours;
  } else if (hours === 12) {
    period = "中午";
    displayHour = 12;
  } else if (hours < 18) {
    period = "下午";
    displayHour = hours - 12;
  } else {
    period = "晚上";
    displayHour = hours - 12;
  }

  return `${year}年${month}月${day}日 (${weekday}) ${period}${displayHour}:${minutes}`;
}

function getCurrSymbol(currency: string): string {
  const map: Record<string, string> = {
    HKD: "HK$", USD: "US$", CNY: "¥", EUR: "€", GBP: "£",
    JPY: "¥", TWD: "NT$", SGD: "S$", MYR: "RM", THB: "฿",
  };
  return map[currency] ?? currency + "$";
}

const MessengerIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current shrink-0" aria-hidden="true">
    <path d="M12 2C6.36 2 2 6.13 2 11.7c0 2.91 1.19 5.44 3.14 7.17.16.14.26.34.27.55l.05 1.78a.8.8 0 0 0 1.12.71l1.99-.88c.16-.07.34-.08.5-.04.91.25 1.88.39 2.93.39 5.64 0 10-4.13 10-9.7C22 6.13 17.64 2 12 2zm6 7.46-2.94 4.66a1.5 1.5 0 0 1-2.16.4l-2.34-1.75a.6.6 0 0 0-.72 0l-3.16 2.4c-.42.32-.97-.18-.69-.62l2.94-4.66a1.5 1.5 0 0 1 2.16-.4l2.34 1.75a.6.6 0 0 0 .72 0l3.16-2.4c.42-.32.97.18.69.62z"/>
  </svg>
);

const WhatsAppIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current shrink-0" aria-hidden="true">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

const ThreadsIcon = () => (
  <svg viewBox="0 0 192 192" className="w-4 h-4 fill-current shrink-0" aria-hidden="true">
    <path d="M141.537 88.988a66.667 66.667 0 0 0-2.518-1.143c-1.482-27.307-16.403-42.94-41.457-43.1h-.34c-14.986 0-27.449 6.396-35.12 18.036l13.779 9.452c5.73-8.695 14.724-10.548 21.348-10.548h.229c8.249.053 14.474 2.452 18.503 7.129 2.932 3.405 4.893 8.111 5.864 14.05-7.314-1.243-15.224-1.626-23.68-1.14-23.82 1.371-39.134 15.264-38.105 34.568.522 9.792 5.4 18.216 13.735 23.719 7.047 4.652 16.124 6.927 25.557 6.412 12.458-.683 22.231-5.436 29.049-14.127 5.178-6.6 8.453-15.153 9.899-25.93 5.937 3.583 10.337 8.298 12.767 13.966 4.132 9.635 4.373 25.468-8.546 38.376-11.319 11.308-24.925 16.2-45.488 16.351-22.809-.169-40.06-7.484-51.275-21.742C91.346 146.194 85 128.922 85 107.5c0-21.422 6.346-38.694 18.87-51.319 11.315-11.419 28.566-18.734 51.273-21.742"/><path d="M96 64.748c1.617 0 3.212.088 4.783.26-.406-6.696-1.697-12.28-3.885-16.582-2.624-5.144-6.611-8.695-12.11-10.784-8.26-3.115-18.57-1.69-27.84 3.92l-7.087-12.376c12.29-7.04 26.512-9.6 39.568-6.984 12.21 2.45 21.824 9.346 27.805 19.787 5.074 8.93 7.578 20.554 7.455 34.546l-.051 1.04c-.162 5.017-.3 12.32-.156 19.972.082 4.287.303 8.46.67 12.312 1.05 11.024.086 19.72-2.888 27.286-3.367 8.586-9.003 15.037-17.23 19.716-8.69 4.94-18.83 7.278-29.96 6.972-13.02-.363-24.49-4.573-33.17-12.19C33.086 144.116 27.5 133.444 27.5 120.5c0-15.29 8.167-27.853 22.955-35.44 10.073-5.18 22.28-7.627 36.304-7.306-.14 2.828-.217 5.693-.217 8.594 0 2.6.064 5.16.184 7.668-11.14-.325-20.085 1.596-26.582 5.698-6.988 4.424-10.644 10.69-10.644 18.286 0 8.126 4.03 14.453 11.664 18.304 7.053 3.558 15.64 4.357 24.316 2.26 10.576-2.558 17.824-8.54 21.546-17.783 2.25-5.587 3.017-12.306 2.353-20.46a193.36 193.36 0 0 1-.437-10.007c-.084-5.018.043-10.186.178-14.99A55.06 55.06 0 0 0 96 64.748z"/>
  </svg>
);

const MENU_WIDTH = 176;
const MENU_HEIGHT = 260;

interface ProductShareMenuProps {
  productId: number;
  title: string;
  price: number;
  currency?: string | null;
  iconOnly?: boolean;
}

export function ProductShareMenu({ productId, title, price, currency, iconOnly }: ProductShareMenuProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const productUrl = `${SHARE_ORIGIN}/merchant-products/${productId}`;
  const currSymbol = getCurrSymbol(currency ?? "HKD");
  const priceLabel = price === 0 ? "查詢格價" : `${currSymbol}${price.toLocaleString()}`;
  const shareText = `${title}\n售價 ${priceLabel}\n@所有人 歡迎登入網站齊來選購！\n${productUrl}`;

  const calcPosition = useCallback(() => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let top = rect.bottom + 4;
    let left = rect.right - MENU_WIDTH;
    if (left + MENU_WIDTH > vw - 8) left = vw - MENU_WIDTH - 8;
    if (left < 8) left = 8;
    if (top + MENU_HEIGHT > vh - 8) top = rect.top - MENU_HEIGHT - 4;
    if (top < 8) top = 8;
    setMenuPos({ top, left });
  }, []);

  function handleOpen(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    if (open) { setOpen(false); return; }
    calcPosition(); setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    function handleClose() { setOpen(false); }
    document.addEventListener("mousedown", handleClose);
    window.addEventListener("scroll", handleClose, true);
    window.addEventListener("resize", handleClose);
    return () => {
      document.removeEventListener("mousedown", handleClose);
      window.removeEventListener("scroll", handleClose, true);
      window.removeEventListener("resize", handleClose);
    };
  }, [open]);

  async function handleMoreShare() {
    setOpen(false);
    if (navigator.share) {
      try {
        await navigator.clipboard.writeText(shareText).catch(() => {});
        await navigator.share({ title, text: shareText.replace("\n" + productUrl, "").trim(), url: productUrl });
        toast.success("已開啟系統分享選單，可選擇 Messenger / FB 群組 / WhatsApp 等", { description: shareText, duration: 5000 });
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== "AbortError") {
          try { await navigator.clipboard.writeText(shareText); } catch {}
          toast.success("已複製連結及廣告文字，可貼到任何平台分享", { description: shareText, duration: 6000 });
        }
      }
    } else {
      try { await navigator.clipboard.writeText(shareText); } catch {}
      toast.success("已複製連結及廣告文字，可貼到任何平台分享", { description: shareText, duration: 6000 });
    }
  }

  async function handleMessenger() {
    setOpen(false);
    const isMobile = /android|iphone|ipad|ipod/i.test(navigator.userAgent);
    if (isMobile) {
      try { await navigator.clipboard.writeText(shareText); } catch {}
      window.location.href = `fb-messenger://share?link=${encodeURIComponent(productUrl)}`;
      toast.success("已複製文案，Messenger 開啟後可貼上", { description: shareText, duration: 6000 });
    } else {
      try { await navigator.clipboard.writeText(shareText); } catch {}
      window.open("https://www.messenger.com/", "_blank", "noopener,noreferrer");
      toast.success("已複製連結，請喺 Messenger 對話框貼上", { description: shareText, duration: 6000 });
    }
  }

  function handleWhatsApp() {
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank", "noopener,noreferrer,width=600,height=500");
    setOpen(false);
  }

  function handleThreads() {
    window.open(`https://www.threads.net/intent/post?text=${encodeURIComponent(shareText)}`, "_blank", "noopener,noreferrer,width=600,height=600");
    setOpen(false);
  }

  async function handleCopyText() {
    try {
      await navigator.clipboard.writeText(shareText);
      toast.success("已複製廣告文字！", { description: shareText, duration: 5000 });
    } catch { toast.error("複製失敗"); }
    setOpen(false);
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(productUrl);
      setCopied(true);
      toast.success("已複製連結", { description: productUrl, duration: 5000 });
      setTimeout(() => setCopied(false), 2000);
    } catch { toast.error("複製失敗，請手動複製連結"); }
    setOpen(false);
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={handleOpen}
        title="分享"
        className={iconOnly
          ? "flex items-center justify-center w-6 h-6 text-amber-600 hover:text-amber-800 border border-amber-200 hover:border-amber-400 rounded-full transition-colors bg-amber-50 hover:bg-amber-100"
          : "flex items-center gap-1 text-xs text-amber-600 hover:text-amber-800 border border-amber-200 hover:border-amber-400 rounded px-2 py-1 transition-colors bg-amber-50 hover:bg-amber-100"
        }
      >
        <Share2 className="w-3 h-3" />
        {!iconOnly && "分享"}
      </button>

      {open && menuPos && (
        <div
          className="fixed z-[9999] w-44 bg-white rounded-xl shadow-xl border border-amber-100 py-1"
          style={{ top: menuPos.top, left: menuPos.left }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-amber-50">
            <span className="text-[0.65rem] font-semibold text-amber-700 uppercase tracking-wide">分享至</span>
            <button type="button" onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground p-0.5">
              <X className="w-3 h-3" />
            </button>
          </div>
          <button type="button" onClick={handleMoreShare} className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left text-muted-foreground transition-colors hover:bg-amber-50/80 hover:text-amber-700">
            <MoreHorizontal className="w-4 h-4 shrink-0" />更多… ( FB,TG,微信.. )
          </button>
          <button type="button" onClick={handleMessenger} className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left text-muted-foreground transition-colors hover:bg-[#0084FF]/10 hover:text-[#0084FF]">
            <MessengerIcon />Facebook Messenger
          </button>
          <button type="button" onClick={handleWhatsApp} className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left text-muted-foreground transition-colors hover:bg-[#25D366]/10 hover:text-[#25D366]">
            <WhatsAppIcon />WhatsApp
          </button>
          <button type="button" onClick={handleThreads} className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left text-muted-foreground transition-colors hover:bg-black/10 hover:text-black">
            <ThreadsIcon />Threads
          </button>
          <div className="my-1 border-t border-amber-50" />
          <button type="button" onClick={handleCopyText} className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left text-muted-foreground hover:bg-amber-50/80 hover:text-amber-700 transition-colors">
            <Copy className="w-4 h-4 shrink-0" />複製廣告文字
          </button>
          <button type="button" onClick={handleCopy} className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left text-muted-foreground hover:bg-amber-50/80 hover:text-amber-700 transition-colors">
            {copied ? <Check className="w-4 h-4 text-green-500 shrink-0" /> : <Copy className="w-4 h-4 shrink-0" />}
            {copied ? "已複製！" : "複製連結"}
          </button>
        </div>
      )}
    </>
  );
}

interface CollectionShareMenuProps {
  postId: number;
  title: string;
  iconOnly?: boolean;
}

export function CollectionShareMenu({ postId, title, iconOnly }: CollectionShareMenuProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const postUrl = `${SHARE_ORIGIN}/collection-square/${postId}`;
  const shareText = `${title}\n${postUrl}`;

  const calcPosition = useCallback(() => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let top = rect.bottom + 4;
    let left = rect.right - MENU_WIDTH;
    if (left + MENU_WIDTH > vw - 8) left = vw - MENU_WIDTH - 8;
    if (left < 8) left = 8;
    if (top + MENU_HEIGHT > vh - 8) top = rect.top - MENU_HEIGHT - 4;
    if (top < 8) top = 8;
    setMenuPos({ top, left });
  }, []);

  function handleOpen(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    if (open) { setOpen(false); return; }
    calcPosition(); setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    function handleClose() { setOpen(false); }
    document.addEventListener("mousedown", handleClose);
    window.addEventListener("scroll", handleClose, true);
    window.addEventListener("resize", handleClose);
    return () => {
      document.removeEventListener("mousedown", handleClose);
      window.removeEventListener("scroll", handleClose, true);
      window.removeEventListener("resize", handleClose);
    };
  }, [open]);

  async function handleMoreShare() {
    setOpen(false);
    if (navigator.share) {
      try {
        await navigator.clipboard.writeText(shareText).catch(() => {});
        await navigator.share({ title, text: shareText.replace("\n" + postUrl, "").trim(), url: postUrl });
        toast.success("已開啟系統分享選單", { description: shareText, duration: 5000 });
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== "AbortError") {
          try { await navigator.clipboard.writeText(shareText); } catch {}
          toast.success("已複製連結及內文", { description: shareText, duration: 6000 });
        }
      }
    } else {
      try { await navigator.clipboard.writeText(shareText); } catch {}
      toast.success("已複製連結及內文", { description: shareText, duration: 6000 });
    }
  }

  async function handleMessenger() {
    setOpen(false);
    const isMobile = /android|iphone|ipad|ipod/i.test(navigator.userAgent);
    if (isMobile) {
      try { await navigator.clipboard.writeText(shareText); } catch {}
      window.location.href = `fb-messenger://share?link=${encodeURIComponent(postUrl)}`;
      toast.success("已複製文案，Messenger 開啟後可貼上", { description: shareText, duration: 6000 });
    } else {
      try { await navigator.clipboard.writeText(shareText); } catch {}
      window.open("https://www.messenger.com/", "_blank", "noopener,noreferrer");
      toast.success("已複製連結，請喺 Messenger 對話框貼上", { description: shareText, duration: 6000 });
    }
  }

  function handleWhatsApp() {
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank", "noopener,noreferrer,width=600,height=500");
    setOpen(false);
  }

  function handleThreads() {
    window.open(`https://www.threads.net/intent/post?text=${encodeURIComponent(shareText)}`, "_blank", "noopener,noreferrer,width=600,height=600");
    setOpen(false);
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(postUrl);
      setCopied(true);
      toast.success("已複製連結", { description: postUrl, duration: 5000 });
      setTimeout(() => setCopied(false), 2000);
    } catch { toast.error("複製失敗，請手動複製連結"); }
    setOpen(false);
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={handleOpen}
        title="分享"
        className={iconOnly
          ? "flex items-center justify-center w-9 h-9 text-white bg-black/45 hover:bg-black/60 rounded-full backdrop-blur transition-colors shadow-lg"
          : "flex items-center gap-1 text-xs text-amber-600 hover:text-amber-800 border border-amber-200 hover:border-amber-400 rounded px-2 py-1 transition-colors bg-amber-50 hover:bg-amber-100"
        }
      >
        <Share2 className={iconOnly ? "w-4 h-4" : "w-3 h-3"} />
        {!iconOnly && "分享"}
      </button>

      {open && menuPos && (
        <div
          className="fixed z-[9999] w-44 bg-white rounded-xl shadow-xl border border-sky-100 py-1"
          style={{ top: menuPos.top, left: menuPos.left }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-sky-50">
            <span className="text-[0.65rem] font-semibold text-sky-700 uppercase tracking-wide">分享至</span>
            <button type="button" onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground p-0.5">
              <X className="w-3 h-3" />
            </button>
          </div>
          <button type="button" onClick={handleMoreShare} className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left text-muted-foreground transition-colors hover:bg-sky-50/80 hover:text-sky-700">
            <MoreHorizontal className="w-4 h-4 shrink-0" />更多… ( FB,TG,微信.. )
          </button>
          <button type="button" onClick={handleMessenger} className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left text-muted-foreground transition-colors hover:bg-[#0084FF]/10 hover:text-[#0084FF]">
            <MessengerIcon />Facebook Messenger
          </button>
          <button type="button" onClick={handleWhatsApp} className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left text-muted-foreground transition-colors hover:bg-[#25D366]/10 hover:text-[#25D366]">
            <WhatsAppIcon />WhatsApp
          </button>
          <button type="button" onClick={handleThreads} className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left text-muted-foreground transition-colors hover:bg-black/10 hover:text-black">
            <ThreadsIcon />Threads
          </button>
          <div className="my-1 border-t border-sky-50" />
          <button type="button" onClick={handleCopy} className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left text-muted-foreground hover:bg-sky-50/80 hover:text-sky-700 transition-colors">
            {copied ? <Check className="w-4 h-4 text-green-500 shrink-0" /> : <Copy className="w-4 h-4 shrink-0" />}
            {copied ? "已複製！" : "複製連結"}
          </button>
        </div>
      )}
    </>
  );
}

interface GroupAuctionShareMenuProps {
  roundId: number;
  title: string;
  endAt?: string | Date | null;
  iconOnly?: boolean;
}

export function GroupAuctionShareMenu({ roundId, title, endAt, iconOnly }: GroupAuctionShareMenuProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const roundUrl = `${SHARE_ORIGIN}/group/${roundId}`;
  let endStr = "";
  if (endAt) {
    const d = new Date(endAt);
    if (!isNaN(d.getTime())) {
      const DAYS = ["日", "一", "二", "三", "四", "五", "六"];
      endStr = `結拍：${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}號 星期${DAYS[d.getDay()]} ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
    }
  }
  const shareText = [title, endStr, "@所有人 歡迎登入網站齊來競拍！", roundUrl].filter(Boolean).join("\n");

  const calcPosition = useCallback(() => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let top = rect.bottom + 4;
    let left = rect.right - MENU_WIDTH;
    if (left + MENU_WIDTH > vw - 8) left = vw - MENU_WIDTH - 8;
    if (left < 8) left = 8;
    if (top + MENU_HEIGHT > vh - 8) top = rect.top - MENU_HEIGHT - 4;
    if (top < 8) top = 8;
    setMenuPos({ top, left });
  }, []);

  function handleOpen(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    if (open) { setOpen(false); return; }
    calcPosition(); setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    function handleClose() { setOpen(false); }
    document.addEventListener("mousedown", handleClose);
    window.addEventListener("scroll", handleClose, true);
    window.addEventListener("resize", handleClose);
    return () => {
      document.removeEventListener("mousedown", handleClose);
      window.removeEventListener("scroll", handleClose, true);
      window.removeEventListener("resize", handleClose);
    };
  }, [open]);

  async function handleMoreShare() {
    setOpen(false);
    if (navigator.share) {
      try {
        await navigator.clipboard.writeText(shareText).catch(() => {});
        await navigator.share({ title, text: shareText.replace("\n" + roundUrl, "").trim(), url: roundUrl });
        toast.success("已開啟系統分享選單", { description: shareText, duration: 5000 });
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== "AbortError") {
          try { await navigator.clipboard.writeText(shareText); } catch {}
          toast.success("已複製連結及內文", { description: shareText, duration: 6000 });
        }
      }
    } else {
      try { await navigator.clipboard.writeText(shareText); } catch {}
      toast.success("已複製連結及內文", { description: shareText, duration: 6000 });
    }
  }

  async function handleMessenger() {
    setOpen(false);
    const isMobile = /android|iphone|ipad|ipod/i.test(navigator.userAgent);
    if (isMobile) {
      try { await navigator.clipboard.writeText(shareText); } catch {}
      window.location.href = `fb-messenger://share?link=${encodeURIComponent(roundUrl)}`;
      toast.success("已複製文案，Messenger 開啟後可貼上", { description: shareText, duration: 6000 });
    } else {
      try { await navigator.clipboard.writeText(shareText); } catch {}
      window.open("https://www.messenger.com/", "_blank", "noopener,noreferrer");
      toast.success("已複製連結，請喺 Messenger 對話框貼上", { description: shareText, duration: 6000 });
    }
  }

  function handleWhatsApp() {
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank", "noopener,noreferrer,width=600,height=500");
    setOpen(false);
  }

  function handleThreads() {
    window.open(`https://www.threads.net/intent/post?text=${encodeURIComponent(shareText)}`, "_blank", "noopener,noreferrer,width=600,height=600");
    setOpen(false);
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(roundUrl);
      setCopied(true);
      toast.success("已複製連結", { description: roundUrl, duration: 5000 });
      setTimeout(() => setCopied(false), 2000);
    } catch { toast.error("複製失敗，請手動複製連結"); }
    setOpen(false);
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={handleOpen}
        title="分享"
        className={iconOnly
          ? "flex items-center justify-center w-9 h-9 text-white bg-black/45 hover:bg-black/60 rounded-full backdrop-blur transition-colors shadow-lg"
          : "flex items-center gap-1 text-xs text-amber-600 hover:text-amber-800 border border-amber-200 hover:border-amber-400 rounded px-2 py-1 transition-colors bg-amber-50 hover:bg-amber-100"
        }
      >
        <Share2 className={iconOnly ? "w-4 h-4" : "w-3 h-3"} />
        {!iconOnly && "分享"}
      </button>

      {open && menuPos && (
        <div
          className="fixed z-[9999] w-44 bg-white rounded-xl shadow-xl border border-sky-100 py-1"
          style={{ top: menuPos.top, left: menuPos.left }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-sky-50">
            <span className="text-[0.65rem] font-semibold text-sky-700 uppercase tracking-wide">分享至</span>
            <button type="button" onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground p-0.5">
              <X className="w-3 h-3" />
            </button>
          </div>
          <button type="button" onClick={handleMoreShare} className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left text-muted-foreground transition-colors hover:bg-sky-50/80 hover:text-sky-700">
            <MoreHorizontal className="w-4 h-4 shrink-0" />更多… ( FB,TG,微信.. )
          </button>
          <button type="button" onClick={handleMessenger} className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left text-muted-foreground transition-colors hover:bg-[#0084FF]/10 hover:text-[#0084FF]">
            <MessengerIcon />Facebook Messenger
          </button>
          <button type="button" onClick={handleWhatsApp} className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left text-muted-foreground transition-colors hover:bg-[#25D366]/10 hover:text-[#25D366]">
            <WhatsAppIcon />WhatsApp
          </button>
          <button type="button" onClick={handleThreads} className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left text-muted-foreground transition-colors hover:bg-black/10 hover:text-black">
            <ThreadsIcon />Threads
          </button>
          <div className="my-1 border-t border-sky-50" />
          <button type="button" onClick={handleCopy} className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left text-muted-foreground hover:bg-sky-50/80 hover:text-sky-700 transition-colors">
            {copied ? <Check className="w-4 h-4 text-green-500 shrink-0" /> : <Copy className="w-4 h-4 shrink-0" />}
            {copied ? "已複製！" : "複製連結"}
          </button>
        </div>
      )}
    </>
  );
}

export function ShareMenu({ auctionId, title, latestBid, currency, endTime, shareTemplate, iconOnly, fbCardStyle, buttonClassName }: ShareMenuProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const auctionUrl = `${SHARE_ORIGIN}/auctions/${auctionId}`;
  const curr = currency ?? "HKD";
  const currSymbol = getCurrSymbol(curr);

  let endTimeStr = "";
  if (endTime) {
    const d = new Date(endTime);
    if (!isNaN(d.getTime())) {
      endTimeStr = formatEndTimeDisplay(d);
    }
  }

  const shareText = buildShareText(shareTemplate, {
    title,
    price: `${currSymbol}${latestBid.toLocaleString()}`,
    endTime: endTimeStr || "—",
  });

  const calcPosition = useCallback(() => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let top = rect.bottom + 4;
    let left = rect.right - MENU_WIDTH;

    if (left + MENU_WIDTH > vw - 8) left = vw - MENU_WIDTH - 8;
    if (left < 8) left = 8;
    if (top + MENU_HEIGHT > vh - 8) top = rect.top - MENU_HEIGHT - 4;
    if (top < 8) top = 8;

    setMenuPos({ top, left });
  }, []);

  function handleOpen(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (open) { setOpen(false); return; }
    calcPosition();
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    function handleClose() { setOpen(false); }
    document.addEventListener("mousedown", handleClose);
    window.addEventListener("scroll", handleClose, true);
    window.addEventListener("resize", handleClose);
    return () => {
      document.removeEventListener("mousedown", handleClose);
      window.removeEventListener("scroll", handleClose, true);
      window.removeEventListener("resize", handleClose);
    };
  }, [open]);

  async function handleMoreShare() {
    setOpen(false);
    // 用系統原生 share sheet：手機可揀 Messenger / FB 群組 / WhatsApp / IG / Threads / 其他 app
    if (navigator.share) {
      try {
        await navigator.clipboard.writeText(shareText).catch(() => {});
        await navigator.share({ title, text: shareText, url: auctionUrl });
        toast.success("已開啟系統分享選單，可選擇 Messenger / FB 群組 / WhatsApp 等", { description: shareText, duration: 5000 });
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== "AbortError") {
          try { await navigator.clipboard.writeText(shareText + "\n" + auctionUrl); } catch {}
          toast.success("已複製連結及廣告文字，可貼到任何平台分享", { description: shareText, duration: 6000 });
        }
      }
    } else {
      // 桌面：直接 copy（桌面無 system share sheet）
      try { await navigator.clipboard.writeText(shareText + "\n" + auctionUrl); } catch {}
      toast.success("已複製連結及廣告文字，可貼到任何平台分享", { description: shareText, duration: 6000 });
    }
  }

  async function handleMessenger() {
    setOpen(false);
    const isMobile = /android|iphone|ipad|ipod/i.test(navigator.userAgent);
    if (isMobile) {
      try { await navigator.clipboard.writeText(shareText + "\n" + auctionUrl); } catch {}
      window.location.href = `fb-messenger://share?link=${encodeURIComponent(auctionUrl)}`;
      toast.success("已複製文案，Messenger 開啟後可貼上", { description: shareText, duration: 6000 });
    } else {
      try { await navigator.clipboard.writeText(shareText + "\n" + auctionUrl); } catch {}
      window.open("https://www.messenger.com/", "_blank", "noopener,noreferrer");
      toast.success("已複製連結，請喺 Messenger 對話框貼上", { description: shareText, duration: 6000 });
    }
  }

  function handleWhatsApp() {
    const url = `https://wa.me/?text=${encodeURIComponent(shareText + "\n" + auctionUrl)}`;
    window.open(url, "_blank", "noopener,noreferrer,width=600,height=500");
    setOpen(false);
  }

  function handleThreads() {
    const url = `https://www.threads.net/intent/post?text=${encodeURIComponent(shareText + "\n" + auctionUrl)}`;
    window.open(url, "_blank", "noopener,noreferrer,width=600,height=600");
    setOpen(false);
  }

  async function handleCopyText() {
    const fullText = shareText + "\n" + auctionUrl;
    try {
      await navigator.clipboard.writeText(fullText);
      toast.success("已複製廣告文字！", { description: fullText, duration: 5000 });
    } catch {
      toast.error("複製失敗");
    }
    setOpen(false);
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(auctionUrl);
      setCopied(true);
      toast.success("已複製連結", { description: auctionUrl, duration: 5000 });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("複製失敗，請手動複製連結");
    }
    setOpen(false);
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={handleOpen}
        title="分享"
        className={fbCardStyle
          ? (buttonClassName ?? "w-full flex items-center justify-center gap-1.5 py-2 text-gray-600 hover:bg-gray-100 transition-colors text-[13px] font-semibold")
          : iconOnly
            ? "flex items-center justify-center w-6 h-6 text-amber-600 hover:text-amber-800 border border-amber-200 hover:border-amber-400 rounded-full transition-colors bg-amber-50 hover:bg-amber-100"
            : "flex items-center gap-1 text-xs text-amber-600 hover:text-amber-800 border border-amber-200 hover:border-amber-400 rounded px-2 py-1 transition-colors bg-amber-50 hover:bg-amber-100"
        }
      >
        {fbCardStyle ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5" aria-hidden="true">
            <path d="M14 6L21 12L14 18V14C9 14 5 16 3 21C3 16 5 10 14 10V6Z"/>
          </svg>
        ) : (
          <Share2 className="w-3 h-3" />
        )}
        {!iconOnly && "分享"}
      </button>

      {open && menuPos && (
        <div
          className="fixed z-[9999] w-44 bg-white rounded-xl shadow-xl border border-amber-100 py-1"
          style={{ top: menuPos.top, left: menuPos.left }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-amber-50">
            <span className="text-[0.65rem] font-semibold text-amber-700 uppercase tracking-wide">分享至</span>
            <button type="button" onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground p-0.5">
              <X className="w-3 h-3" />
            </button>
          </div>

          <button
            type="button"
            onClick={handleMoreShare}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left text-muted-foreground transition-colors hover:bg-amber-50/80 hover:text-amber-700"
          >
            <MoreHorizontal className="w-4 h-4 shrink-0" />
            更多… ( FB,TG,微信.. )
          </button>

          <button
            type="button"
            onClick={handleMessenger}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left text-muted-foreground transition-colors hover:bg-[#0084FF]/10 hover:text-[#0084FF]"
          >
            <MessengerIcon />
            Facebook Messenger
          </button>

          <button
            type="button"
            onClick={handleWhatsApp}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left text-muted-foreground transition-colors hover:bg-[#25D366]/10 hover:text-[#25D366]"
          >
            <WhatsAppIcon />
            WhatsApp
          </button>

          <button
            type="button"
            onClick={handleThreads}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left text-muted-foreground transition-colors hover:bg-black/10 hover:text-black"
          >
            <ThreadsIcon />
            Threads
          </button>

          <div className="my-1 border-t border-amber-50" />

          <button
            type="button"
            onClick={handleCopyText}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left text-muted-foreground hover:bg-amber-50/80 hover:text-amber-700 transition-colors"
          >
            <Copy className="w-4 h-4 shrink-0" />
            複製廣告文字
          </button>

          <button
            type="button"
            onClick={handleCopy}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left text-muted-foreground hover:bg-amber-50/80 hover:text-amber-700 transition-colors"
          >
            {copied ? <Check className="w-4 h-4 text-green-500 shrink-0" /> : <Copy className="w-4 h-4 shrink-0" />}
            {copied ? "已複製！" : "複製連結"}
          </button>
        </div>
      )}
    </>
  );
}
