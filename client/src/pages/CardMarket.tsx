import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { trpc } from "@/lib/trpc";
import { useLocation, useSearch } from "wouter";
import Header from "@/components/Header";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { Search, Plus, ShoppingBag, Eye, ChevronRight, Flame, Loader2, ClipboardList, X, LayoutGrid, LayoutList, ChevronDown, Share2, Copy, Check, MoreHorizontal, QrCode, MessageSquare, Pencil, Trash2, Send, ImagePlus, ThumbsUp, CornerDownRight } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SHARE_ORIGIN } from "@/lib/shareUrl";

const GAMES = [
  { id: "", label: "全部" },
  { id: "pokemon", label: "Pokémon" },
  { id: "yugioh", label: "遊戲王" },
  { id: "mtg", label: "MTG" },
  { id: "onepiece", label: "航海王" },
  { id: "dragonball", label: "龍珠" },
  { id: "digimon", label: "數碼暴龍" },
  { id: "other", label: "其他" },
] as const;

const CONDITION_LABELS: Record<string, { label: string; full: string; color: string }> = {
  NM:  { label: "NM", full: "NM — 近全新", color: "#16a34a" },
  LP:  { label: "LP", full: "LP — 輕微磨損", color: "#65a30d" },
  MP:  { label: "MP", full: "MP — 中度磨損", color: "#d97706" },
  HP:  { label: "HP", full: "HP — 嚴重磨損", color: "#ea580c" },
  DMG: { label: "DMG", full: "DMG — 損壞", color: "#dc2626" },
};

const RARITY_BADGE_STYLE: Record<string, { background: string; color: string }> = {
  SAR: { background: "linear-gradient(135deg,#7c3aed,#a855f7)", color: "#fff" },
  IR:  { background: "linear-gradient(135deg,#be123c,#fb7185)", color: "#fff" },
  HR:  { background: "linear-gradient(135deg,#d97706,#fbbf24)", color: "#fff" },
  RR:  { background: "linear-gradient(135deg,#1d4ed8,#60a5fa)", color: "#fff" },
  UR:  { background: "linear-gradient(135deg,#dc2626,#f87171)", color: "#fff" },
  SR:  { background: "linear-gradient(135deg,#475569,#94a3b8)", color: "#fff" },
  FA:  { background: "linear-gradient(135deg,#0369a1,#38bdf8)", color: "#fff" },
  GR:  { background: "linear-gradient(135deg,#b45309,#fbbf24)", color: "#fff" },
  StR: { background: "linear-gradient(135deg,#7c3aed,#c084fc)", color: "#fff" },
};

const GAME_BADGE_STYLE: Record<string, { background: string; color: string }> = {
  pokemon:    { background: "#fee2e2", color: "#b91c1c" },
  yugioh:     { background: "#ede9fe", color: "#6d28d9" },
  mtg:        { background: "#d1fae5", color: "#065f46" },
  onepiece:   { background: "#ffedd5", color: "#c2410c" },
  dragonball: { background: "#fef3c7", color: "#b45309" },
  digimon:    { background: "#dbeafe", color: "#1d4ed8" },
  other:      { background: "#f3f4f6", color: "#6b7280" },
};

const MessengerIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" style={{ fill: "#0084FF" }} aria-hidden="true">
    <path d="M12 2C6.36 2 2 6.13 2 11.7c0 2.91 1.19 5.44 3.14 7.17.16.14.26.34.27.55l.05 1.78a.8.8 0 0 0 1.12.71l1.99-.88c.16-.07.34-.08.5-.04.91.25 1.88.39 2.93.39 5.64 0 10-4.13 10-9.7C22 6.13 17.64 2 12 2zm6 7.46-2.94 4.66a1.5 1.5 0 0 1-2.16.4l-2.34-1.75a.6.6 0 0 0-.72 0l-3.16 2.4c-.42.32-.97-.18-.69-.62l2.94-4.66a1.5 1.5 0 0 1 2.16-.4l2.34 1.75a.6.6 0 0 0 .72 0l3.16-2.4c.42-.32.97.18.69.62z"/>
  </svg>
);
const WhatsAppIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" style={{ fill: "#25D366" }} aria-hidden="true">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);
const ThreadsIcon = () => (
  <svg viewBox="0 0 192 192" className="w-4 h-4 shrink-0" style={{ fill: "#000" }} aria-hidden="true">
    <path d="M141.537 88.988a66.667 66.667 0 0 0-2.518-1.143c-1.482-27.307-16.403-42.94-41.457-43.1h-.34c-14.986 0-27.449 6.396-35.12 18.036l13.779 9.452c5.73-8.695 14.724-10.548 21.348-10.548h.229c8.249.053 14.474 2.452 18.503 7.129 2.932 3.405 4.893 8.111 5.864 14.05-7.314-1.243-15.224-1.626-23.68-1.14-23.82 1.371-39.134 15.264-38.105 34.568.522 9.792 5.4 18.216 13.735 23.719 7.047 4.652 16.124 6.927 25.557 6.412 12.458-.683 22.231-5.436 29.049-14.127 5.178-6.6 8.453-15.153 9.899-25.93 5.937 3.583 10.337 8.298 12.767 13.966 4.132 9.635 4.373 25.468-8.546 38.376-11.319 11.308-24.925 16.2-45.488 16.351-22.809-.169-40.06-7.484-51.275-21.742C91.346 146.194 85 128.922 85 107.5c0-21.422 6.346-38.694 18.87-51.319 11.315-11.419 28.566-18.734 51.273-21.742"/><path d="M96 64.748c1.617 0 3.212.088 4.783.26-.406-6.696-1.697-12.28-3.885-16.582-2.624-5.144-6.611-8.695-12.11-10.784-8.26-3.115-18.57-1.69-27.84 3.92l-7.087-12.376c12.29-7.04 26.512-9.6 39.568-6.984 12.21 2.45 21.824 9.346 27.805 19.787 5.074 8.93 7.578 20.554 7.455 34.546l-.051 1.04c-.162 5.017-.3 12.32-.156 19.972.082 4.287.303 8.46.67 12.312 1.05 11.024.086 19.72-2.888 27.286-3.367 8.586-9.003 15.037-17.23 19.716-8.69 4.94-18.83 7.278-29.96 6.972-13.02-.363-24.49-4.573-33.17-12.19C33.086 144.116 27.5 133.444 27.5 120.5c0-15.29 8.167-27.853 22.955-35.44 10.073-5.18 22.28-7.627 36.304-7.306-.14 2.828-.217 5.693-.217 8.594 0 2.6.064 5.16.184 7.668-11.14-.325-20.085 1.596-26.582 5.698-6.988 4.424-10.644 10.69-10.644 18.286 0 8.126 4.03 14.453 11.664 18.304 7.053 3.558 15.64 4.357 24.316 2.26 10.576-2.558 17.824-8.54 21.546-17.783 2.25-5.587 3.017-12.306 2.353-20.46a193.36 193.36 0 0 1-.437-10.007c-.084-5.018.043-10.186.178-14.99A55.06 55.06 0 0 0 96 64.748z"/>
  </svg>
);

const LISTING_MENU_WIDTH = 176;
const LISTING_MENU_HEIGHT = 228;

interface ListingForShare {
  id: number; game: string; cardName: string;
  rarity?: string | null; setName?: string | null; setNumber?: string | null;
  priceHKD: number;
}

function ListingShareDropdown({ listing }: { listing: ListingForShare }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const gameLabel = GAMES.find(g => g.id === listing.game)?.label ?? listing.game;
  const shareUrl = `${SHARE_ORIGIN}/cardzx/market?listing=${listing.id}`;
  const shareParts = [gameLabel, listing.cardName, listing.rarity, listing.setName].filter(Boolean);
  const shareText = shareParts.join(" · ") + `\nHKD $${listing.priceHKD.toLocaleString()}\n${shareUrl}`;

  const calcPosition = useCallback(() => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let top = rect.bottom + 4;
    let left = rect.right - LISTING_MENU_WIDTH;
    if (left + LISTING_MENU_WIDTH > vw - 8) left = vw - LISTING_MENU_WIDTH - 8;
    if (left < 8) left = 8;
    if (top + LISTING_MENU_HEIGHT > vh - 8) top = rect.top - LISTING_MENU_HEIGHT - 4;
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
        await navigator.share({ title: listing.cardName, text: shareText.replace("\n" + shareUrl, "").trim(), url: shareUrl });
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
      window.location.href = `fb-messenger://share?link=${encodeURIComponent(shareUrl)}`;
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
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success("已複製連結", { description: shareUrl, duration: 5000 });
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
        className="flex items-center justify-center rounded-lg"
        style={{ width: 28, height: 28, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
      >
        <Share2 className="w-3.5 h-3.5" style={{ color: "#fff" }} />
      </button>

      {open && menuPos && createPortal(
        <div
          className="fixed z-[9999] w-44 bg-white rounded-xl shadow-xl border border-amber-100 py-1"
          style={{ top: menuPos.top, left: menuPos.left }}
          onMouseDown={e => e.stopPropagation()}
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
        </div>,
        document.body
      )}
    </>
  );
}

function timeAgo(dateStr: string | Date) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}分前`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}小時前`;
  return `${Math.floor(hrs / 24)}日前`;
}

function getRarityShort(rarity: string | null | undefined): string | null {
  if (!rarity) return null;
  const r = rarity.toLowerCase();
  if (r.includes("special illustration")) return "SAR";
  if (r.includes("illustration rare")) return "IR";
  if (r.includes("amazing rare")) return "AR";
  if (r.includes("hyper rare")) return "HR";
  if (r.includes("double rare")) return "RR";
  if (r.includes("ultra rare")) return "UR";
  if (r.includes("secret rare")) return "SR";
  if (r.includes("rainbow rare")) return "RR";
  if (r.includes("gold rare")) return "GR";
  if (r.includes("starlight")) return "StR";
  if (r.includes("super rare")) return "SR";
  if (r.includes("full art")) return "FA";
  if (r.includes("promo")) return "PR";
  if (r.includes("ace spec")) return "ACE";
  if (r.includes("trainer gallery")) return "TG";
  if (r.includes("shiny rare")) return "SIR";
  if (r.includes("uncommon")) return "U";
  if (r.includes("common")) return "C";
  if (r.includes("rare")) return "R";
  if (rarity.length <= 4) return rarity.toUpperCase();
  return rarity.substring(0, 3).toUpperCase();
}

interface Listing {
  id: number; userId: number; game: string;
  cardApiId: string | null; cardName: string; cardNameJa: string | null;
  setName: string | null; setNumber: string | null; rarity: string | null;
  officialImageUrl: string | null;
  condition: string; isGraded: boolean; gradingOrg: string | null; gradeScore: string | null;
  priceHKD: number; photoUrls: string[]; description: string | null;
  deliveryMethod: string | null;
  status: string; views: number; createdAt: string; sellerName: string | null;
}

function CardPhotoLightbox({ photos, initialIndex, cardName, priceHKD, onClose }: {
  photos: string[]; initialIndex: number; cardName: string; priceHKD: number; onClose: () => void;
}) {
  const [lbImgIdx, setLbImgIdx] = useState(initialIndex);
  const [lbZoom, setLbZoom] = useState(1);
  const [lbPanX, setLbPanX] = useState(0);
  const [lbPanY, setLbPanY] = useState(0);
  const [lbMode, setLbMode] = useState<'v' | 'h'>('v');
  const [lbVZoomIdx, setLbVZoomIdx] = useState(-1);
  const lbZoomRef = useRef(1);
  const lbVZoomIdxRef = useRef(-1);
  const pinchStartDist = useRef(0);
  const pinchStartZoom = useRef(1);
  const panStartTouch = useRef({ x: 0, y: 0 });
  const panStartOffset = useRef({ x: 0, y: 0 });
  const lastTapTime = useRef(0);
  const lbScrollRef = useRef<HTMLDivElement>(null);
  const lbVScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { lbZoomRef.current = lbZoom; }, [lbZoom]);

  useEffect(() => {
    setTimeout(() => {
      if (lbScrollRef.current) lbScrollRef.current.scrollLeft = initialIndex * lbScrollRef.current.clientWidth;
    }, 20);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = lbVScrollRef.current;
    if (!el || lbMode !== 'v') return;
    function onTS(e: TouchEvent) {
      if (e.touches.length === 2) {
        e.preventDefault();
        const my = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        const imgs = el!.querySelectorAll('img');
        let found = 0;
        imgs.forEach((img, i) => { const r = img.getBoundingClientRect(); if (my >= r.top && my <= r.bottom) found = i; });
        lbVZoomIdxRef.current = found; setLbVZoomIdx(found);
        const dx = e.touches[0].clientX - e.touches[1].clientX, dy = e.touches[0].clientY - e.touches[1].clientY;
        pinchStartDist.current = Math.sqrt(dx * dx + dy * dy); pinchStartZoom.current = lbZoomRef.current;
      } else if (e.touches.length === 1) {
        const now = Date.now();
        if (now - lastTapTime.current < 280 && lbZoomRef.current > 1) { setLbZoom(1); lbZoomRef.current = 1; setLbPanX(0); setLbPanY(0); }
        lastTapTime.current = now;
        if (lbZoomRef.current > 1) { panStartTouch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; panStartOffset.current = { x: lbPanX, y: lbPanY }; }
      }
    }
    el.addEventListener('touchstart', onTS, { passive: false });
    return () => el.removeEventListener('touchstart', onTS);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lbMode, lbPanX, lbPanY]);

  useEffect(() => {
    const el = lbScrollRef.current;
    if (!el) return;
    function onTS(e: TouchEvent) {
      if (e.touches.length === 2) {
        e.preventDefault();
        const dx = e.touches[0].clientX - e.touches[1].clientX, dy = e.touches[0].clientY - e.touches[1].clientY;
        pinchStartDist.current = Math.sqrt(dx * dx + dy * dy); pinchStartZoom.current = lbZoomRef.current;
      } else if (e.touches.length === 1) {
        const now = Date.now();
        if (now - lastTapTime.current < 280) { setLbZoom(1); lbZoomRef.current = 1; setLbPanX(0); setLbPanY(0); }
        lastTapTime.current = now;
        panStartTouch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; panStartOffset.current = { x: lbPanX, y: lbPanY };
      }
    }
    el.addEventListener('touchstart', onTS, { passive: false });
    return () => el.removeEventListener('touchstart', onTS);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lbPanX, lbPanY]);

  function pinchDist(t: React.TouchList) {
    const dx = t[0].clientX - t[1].clientX, dy = t[0].clientY - t[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }
  function onVMove(e: React.TouchEvent) {
    if (e.touches.length === 2) {
      e.preventDefault();
      const z = Math.min(6, Math.max(1, pinchStartZoom.current * (pinchDist(e.touches) / pinchStartDist.current)));
      setLbZoom(z); lbZoomRef.current = z;
      setLbPanX(0); setLbPanY(0);
    } else if (e.touches.length === 1 && lbZoomRef.current > 1) {
      e.preventDefault();
      setLbPanX(panStartOffset.current.x + e.touches[0].clientX - panStartTouch.current.x);
      setLbPanY(panStartOffset.current.y + e.touches[0].clientY - panStartTouch.current.y);
    }
  }
  function onHMove(e: React.TouchEvent) {
    if (e.touches.length === 2) {
      e.preventDefault();
      const z = Math.min(6, Math.max(1, pinchStartZoom.current * (pinchDist(e.touches) / pinchStartDist.current)));
      setLbZoom(z); lbZoomRef.current = z;
      setLbPanX(0); setLbPanY(0);
    } else if (e.touches.length === 1 && lbZoomRef.current > 1) {
      e.preventDefault();
      setLbPanX(panStartOffset.current.x + e.touches[0].clientX - panStartTouch.current.x);
      setLbPanY(panStartOffset.current.y + e.touches[0].clientY - panStartTouch.current.y);
    }
  }

  const loopImgs = photos.length > 1 ? [...photos, photos[0]] : photos;
  const dotIdx = lbImgIdx % photos.length;
  function resetLb() { setLbZoom(1); lbZoomRef.current = 1; setLbPanX(0); setLbPanY(0); setLbVZoomIdx(-1); lbVZoomIdxRef.current = -1; }

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[99999] flex flex-col" style={{ background: 'rgba(0,0,0,0.97)' }}>
      <div className="flex items-start justify-between px-3 pt-3 pb-2 flex-shrink-0 gap-2">
        <div style={{ flex: 1, minWidth: 0 }}>
          <p className="text-sm font-bold leading-snug truncate" style={{ color: '#fff', marginBottom: 2 }}>{cardName}</p>
          {priceHKD > 0
            ? <p className="text-base font-black" style={{ color: '#F97316', letterSpacing: '-0.3px' }}>HKD ${priceHKD.toLocaleString()}</p>
            : <p className="text-sm font-bold" style={{ color: 'rgba(255,255,255,0.45)' }}>HKD 價格面議</p>
          }
        </div>
        {photos.length > 1 && (
          <div className="flex rounded-lg overflow-hidden flex-shrink-0" style={{ border: '1px solid rgba(255,255,255,0.2)', alignSelf: 'center' }}>
            <button
              onClick={() => { setLbMode('h'); resetLb(); }}
              style={{ padding: '6px 10px', background: lbMode === 'h' ? 'rgba(255,255,255,0.25)' : 'transparent', color: '#fff', display: 'flex', alignItems: 'center' }}
              title="橫向瀏覽"
            ><LayoutGrid className="w-4 h-4" /></button>
            <button
              onClick={() => { setLbMode('v'); resetLb(); }}
              style={{ padding: '6px 10px', background: lbMode === 'v' ? 'rgba(255,255,255,0.25)' : 'transparent', color: '#fff', display: 'flex', alignItems: 'center' }}
              title="直立式瀏覽"
            ><LayoutList className="w-4 h-4" /></button>
          </div>
        )}
        <button
          className="px-3 py-1.5 rounded-full text-xs font-medium flex-shrink-0"
          style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', alignSelf: 'center' }}
          onClick={onClose}
        >關閉</button>
      </div>

      <div className="flex-1 relative overflow-hidden">
        {lbMode === 'v' ? (
          <div
            ref={lbVScrollRef}
            className="h-full"
            style={{ overflowY: lbZoom > 1 ? 'hidden' : 'auto', overflowX: 'hidden', scrollbarWidth: 'none' } as React.CSSProperties}
            onTouchMove={onVMove}
          >
            {photos.map((url, i) => (
              <div key={i} className="flex items-center justify-center" style={{ padding: '3px', minHeight: '30vh' }}>
                <img
                  src={url}
                  className="select-none"
                  style={{
                    width: '100%', objectFit: 'contain', borderRadius: 14, display: 'block', pointerEvents: 'none',
                    transform: lbVZoomIdx === i ? `translate(${lbPanX}px,${lbPanY}px) scale(${lbZoom})` : 'none',
                    transformOrigin: 'center center',
                  }}
                  alt="" draggable={false} loading="lazy"
                />
              </div>
            ))}
            <div style={{ height: 12 }} />
          </div>
        ) : (
          <>
            <div
              ref={lbScrollRef}
              className="flex h-full"
              style={{
                overflowX: lbZoom > 1 ? 'hidden' : 'auto', overflowY: 'hidden',
                scrollSnapType: 'x mandatory', scrollBehavior: 'auto', scrollbarWidth: 'none',
                WebkitOverflowScrolling: 'touch' as React.CSSProperties['WebkitOverflowScrolling'],
              } as React.CSSProperties}
              onScroll={() => {
                if (!lbScrollRef.current || lbZoomRef.current > 1) return;
                const w = lbScrollRef.current.clientWidth;
                const rem = lbScrollRef.current.scrollLeft % w;
                if (rem > 2 && rem < w - 2) return;
                const i = Math.round(lbScrollRef.current.scrollLeft / w);
                if (photos.length > 1 && i === photos.length) {
                  lbScrollRef.current.scrollLeft = 0; setLbImgIdx(0); resetLb(); return;
                }
                if (i !== lbImgIdx) { setLbImgIdx(i); resetLb(); }
              }}
              onTouchMove={onHMove}
            >
              {loopImgs.map((url, i) => (
                <div key={i} className="flex-shrink-0 h-full flex items-center justify-center" style={{ width: '100%', scrollSnapAlign: 'start', padding: '0 3px' }}>
                  <img
                    src={url}
                    className="select-none"
                    style={{
                      maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 14, display: 'block', pointerEvents: 'none',
                      transform: i === lbImgIdx ? `translate(${lbPanX}px,${lbPanY}px) scale(${lbZoom})` : 'none',
                      transformOrigin: 'center center',
                    }}
                    alt="" draggable={false}
                  />
                </div>
              ))}
            </div>
            {photos.length > 1 && (
              <div className="absolute flex gap-1.5 pointer-events-none" style={{ bottom: 6, left: 0, right: 0, justifyContent: 'center' }}>
                {photos.map((_, i) => (
                  <div key={i} style={{ width: i === dotIdx ? 14 : 6, height: 6, borderRadius: 3, background: i === dotIdx ? '#fff' : 'rgba(255,255,255,0.35)', transition: 'width 0.2s' }} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex items-center px-4 pt-2 pb-3 flex-shrink-0">
        {lbZoom > 1 ? (
          <button className="text-white/60 text-xs px-3 py-1.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.1)' }}
            onClick={resetLb}>重設縮放</button>
        ) : (
          <p className="text-[11px] text-white/30">{photos.length > 1 ? (lbMode === 'v' ? '上下捲動 · 雙指縮放' : '左右滑動切換') : '雙指放大'}</p>
        )}
      </div>
    </div>
  );
}

function WTBImageLightbox({ imageUrl, cardName, maxPriceHKD, onClose }: {
  imageUrl: string; cardName: string; maxPriceHKD?: number | null; onClose: () => void;
}) {
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [mode, setMode] = useState<'v' | 'h'>('v');
  const zoomRef = useRef(1);
  const pinchStartDist = useRef(0);
  const pinchStartZoom = useRef(1);
  const panStartTouch = useRef({ x: 0, y: 0 });
  const panStartOffset = useRef({ x: 0, y: 0 });
  const lastTapTime = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [onClose]);

  function resetZoom() { setZoom(1); zoomRef.current = 1; setPanX(0); setPanY(0); }

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    function onTS(e: TouchEvent) {
      if (e.touches.length === 2) {
        e.preventDefault();
        const dx = e.touches[0].clientX - e.touches[1].clientX, dy = e.touches[0].clientY - e.touches[1].clientY;
        pinchStartDist.current = Math.sqrt(dx * dx + dy * dy);
        pinchStartZoom.current = zoomRef.current;
      } else if (e.touches.length === 1) {
        const now = Date.now();
        if (now - lastTapTime.current < 280 && zoomRef.current > 1) resetZoom();
        lastTapTime.current = now;
        panStartTouch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        panStartOffset.current = { x: panX, y: panY };
      }
    }
    el.addEventListener('touchstart', onTS, { passive: false });
    return () => el.removeEventListener('touchstart', onTS);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panX, panY]);

  function onMove(e: React.TouchEvent) {
    if (e.touches.length === 2) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX, dy = e.touches[0].clientY - e.touches[1].clientY;
      const d = Math.sqrt(dx * dx + dy * dy);
      const z = Math.min(6, Math.max(1, pinchStartZoom.current * (d / pinchStartDist.current)));
      setZoom(z); zoomRef.current = z; setPanX(0); setPanY(0);
    } else if (e.touches.length === 1 && zoomRef.current > 1) {
      e.preventDefault();
      setPanX(panStartOffset.current.x + e.touches[0].clientX - panStartTouch.current.x);
      setPanY(panStartOffset.current.y + e.touches[0].clientY - panStartTouch.current.y);
    }
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-[99999] flex flex-col" style={{ bottom: 60, background: 'rgba(0,0,0,0.96)' }}>
      <div className="flex items-start justify-between px-3 pt-3 pb-2 flex-shrink-0 gap-2">
        <div style={{ flex: 1, minWidth: 0 }}>
          <p className="text-sm font-bold leading-snug line-clamp-2" style={{ color: '#fff', marginBottom: 2 }}>{cardName}</p>
          {maxPriceHKD ? (
            <p className="text-base font-black" style={{ color: '#22c55e' }}>求購上限 HKD ${maxPriceHKD.toLocaleString()}</p>
          ) : (
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>HKD 價格面議</p>
          )}
        </div>
        <div className="flex rounded-lg overflow-hidden flex-shrink-0" style={{ border: '1px solid rgba(255,255,255,0.2)', alignSelf: 'center' }}>
          <button
            onClick={() => { setMode('h'); resetZoom(); }}
            style={{ padding: '6px 10px', background: mode === 'h' ? 'rgba(255,255,255,0.25)' : 'transparent', color: '#fff', display: 'flex', alignItems: 'center' }}
            title="橫向"
          ><LayoutGrid className="w-4 h-4" /></button>
          <button
            onClick={() => { setMode('v'); resetZoom(); }}
            style={{ padding: '6px 10px', background: mode === 'v' ? 'rgba(255,255,255,0.25)' : 'transparent', color: '#fff', display: 'flex', alignItems: 'center' }}
            title="直立"
          ><LayoutList className="w-4 h-4" /></button>
        </div>
        <button
          className="px-3 py-1.5 rounded-full text-xs font-medium flex-shrink-0"
          style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', alignSelf: 'center' }}
          onClick={onClose}
        >關閉</button>
      </div>
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden"
        style={{ display: 'flex', alignItems: mode === 'h' ? 'center' : 'flex-start', justifyContent: 'center', overflowY: mode === 'v' ? 'auto' : 'hidden' }}
        onTouchMove={onMove}
      >
        <img
          src={imageUrl}
          className="select-none"
          style={{
            maxWidth: '100%',
            ...(mode === 'h' ? { maxHeight: '100%', objectFit: 'contain' } : { width: '100%', objectFit: 'contain' }),
            borderRadius: 14, display: 'block', pointerEvents: 'none',
            transform: `translate(${panX}px,${panY}px) scale(${zoom})`,
            transformOrigin: 'center center',
          }}
          alt="" draggable={false}
        />
      </div>
      <div className="flex items-center px-4 pt-2 pb-3 flex-shrink-0">
        {zoom > 1 ? (
          <button className="text-white/60 text-xs px-3 py-1.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.1)' }} onClick={resetZoom}>重設縮放</button>
        ) : (
          <p className="text-[11px] text-white/30">雙指放大 · 雙擊重設 · {mode === 'v' ? '直立式' : '橫向式'}</p>
        )}
      </div>
    </div>
  );
}

function HotCard({ listing, onClick }: { listing: Listing; onClick: () => void }) {
  const img = listing.photoUrls[0] ?? listing.officialImageUrl;
  const rarityBadge = getRarityShort(listing.rarity);
  const rarityStyle = rarityBadge ? (RARITY_BADGE_STYLE[rarityBadge] ?? { background: "#F97316", color: "#fff" }) : null;
  const gameStyle = GAME_BADGE_STYLE[listing.game] ?? { background: "#f3f4f6", color: "#6b7280" };
  const gameLabel = GAMES.find(g => g.id === listing.game)?.label ?? listing.game;
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-shrink-0 flex flex-col rounded-2xl overflow-hidden text-left"
      style={{ width: 128, background: "#fff", boxShadow: "0 4px 16px rgba(0,0,0,0.10)" }}
    >
      <div className="relative flex items-center justify-center" style={{ height: 172, background: img ? "#f8f9fa" : "#1a1a2e" }}>
        {img ? (
          <img src={img} alt={listing.cardName} className="w-full h-full object-cover" />
        ) : (
          <span style={{ fontSize: 44, filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.5))" }}>🃏</span>
        )}
        <div className="absolute top-1.5 left-1.5">
          <span className="text-[8px] font-bold px-1.5 py-0.5 rounded" style={gameStyle}>{gameLabel}</span>
        </div>
        {rarityStyle && rarityBadge && (
          <div className="absolute top-1.5 right-1.5">
            <span className="text-[8px] font-black px-1 py-0.5 rounded" style={rarityStyle}>{rarityBadge}</span>
          </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 px-2 pb-2 pt-8" style={{ background: "linear-gradient(transparent,rgba(0,0,0,0.82))" }}>
          <p className="text-[10px] font-black text-white leading-tight line-clamp-2">{listing.cardName}</p>
          {listing.setName && <p className="text-[9px] mt-0.5 line-clamp-1" style={{ color: "rgba(255,255,255,0.45)" }}>{listing.setName}</p>}
          <p className="text-xs font-black mt-0.5" style={{ color: "#FFDE00" }}>HKD ${listing.priceHKD.toLocaleString()}</p>
        </div>
        <div className="absolute bottom-1.5 right-1.5" onClick={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()} onTouchEnd={e => e.stopPropagation()}>
          <ListingShareDropdown listing={listing} />
        </div>
      </div>
    </button>
  );
}

function ListingCard({ listing, onClick }: { listing: Listing; onClick: () => void }) {
  const cond = CONDITION_LABELS[listing.condition] ?? { label: listing.condition, full: listing.condition, color: "#7c3aed" };
  const img = listing.photoUrls[0] ?? listing.officialImageUrl;
  const rarityBadge = getRarityShort(listing.rarity);
  const rarityStyle = rarityBadge ? (RARITY_BADGE_STYLE[rarityBadge] ?? { background: "#F97316", color: "#fff" }) : null;
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col rounded-2xl overflow-hidden text-left"
      style={{ background: "#fff", border: "1px solid #f0f0f0", boxShadow: "0 2px 14px rgba(0,0,0,0.07)" }}
    >
      <div className="relative w-full" style={{ paddingBottom: "130%" }}>
        {img ? (
          <img src={img} alt={listing.cardName} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center" style={{ background: "#1a1a2e" }}>
            <span style={{ fontSize: 36 }}>🃏</span>
          </div>
        )}
        <div className="absolute top-1.5 left-1.5">
          <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md" style={{ background: cond.color, color: "#fff" }}>
            {listing.isGraded && listing.gradeScore ? `${listing.gradingOrg} ${listing.gradeScore}` : cond.label}
          </span>
        </div>
        {rarityStyle && rarityBadge && (
          <div className="absolute top-1.5 right-1.5">
            <span className="text-[9px] font-black px-1 py-0.5 rounded" style={rarityStyle}>{rarityBadge}</span>
          </div>
        )}
        <div className="absolute bottom-1.5 right-1.5" onClick={e => e.stopPropagation()}>
          <ListingShareDropdown listing={listing} />
        </div>
      </div>
      <div className="p-2">
        <p className="text-xs font-black leading-tight line-clamp-2 mb-1" style={{ color: "#111827" }}>{listing.cardName}</p>
        {listing.setName && <p className="text-[10px] line-clamp-1 mb-1" style={{ color: "#9ca3af" }}>{listing.setName}{listing.setNumber ? ` #${listing.setNumber}` : ""}</p>}
        <p className="text-sm font-black" style={{ color: "#CC0000" }}>HKD ${listing.priceHKD.toLocaleString()}</p>
        <div className="flex items-center justify-between mt-1">
          <span className="text-[10px]" style={{ color: "#9ca3af" }}>{listing.sellerName ?? "賣家"}</span>
          <span className="text-[10px]" style={{ color: "#d1d5db" }}>{timeAgo(listing.createdAt)}</span>
        </div>
      </div>
    </button>
  );
}

interface WTB {
  id: number; userId: number; game: string; cardName: string;
  cardNameJa: string | null; setName: string | null; setNumber: string | null;
  officialImageUrl: string | null; maxPriceHKD: number | null;
  minCondition: string | null; notes: string | null; createdAt: string; buyerName: string | null;
  photoUrls: string[];
}

const WTB_SHARE_MENU_WIDTH = 176;
const WTB_SHARE_MENU_HEIGHT = 228;

function WTBShareDropdown({ wtb }: { wtb: WTB }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const gameLabel = GAMES.find(g => g.id === wtb.game)?.label ?? wtb.game;
  const shareUrl = `${SHARE_ORIGIN}/cardzx/market?wtb=${wtb.id}`;
  const pricePart = (wtb.maxPriceHKD && wtb.maxPriceHKD > 0) ? `上限 HKD $${wtb.maxPriceHKD.toLocaleString()}` : "HKD 價格面議";
  const shareParts = [`[求購] ${gameLabel} · ${wtb.cardName}`, wtb.setName, pricePart].filter(Boolean);
  const shareText = shareParts.join("\n") + `\n${shareUrl}`;

  const calcPosition = useCallback(() => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let top = rect.bottom + 4;
    let left = rect.right - WTB_SHARE_MENU_WIDTH;
    if (left + WTB_SHARE_MENU_WIDTH > vw - 8) left = vw - WTB_SHARE_MENU_WIDTH - 8;
    if (left < 8) left = 8;
    if (top + WTB_SHARE_MENU_HEIGHT > vh - 8) top = rect.top - WTB_SHARE_MENU_HEIGHT - 4;
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
        await navigator.share({ title: wtb.cardName, text: shareText.replace("\n" + shareUrl, "").trim(), url: shareUrl });
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
      window.location.href = `fb-messenger://share?link=${encodeURIComponent(shareUrl)}`;
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
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success("已複製連結", { description: shareUrl, duration: 5000 });
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
        className="text-[10px] font-bold px-2 py-0.5"
        style={{ background: "rgba(249,115,22,0.1)", color: "#F97316", border: "1px solid rgba(249,115,22,0.25)", borderRadius: 5 }}
      >
        分享
      </button>

      {open && menuPos && createPortal(
        <div
          className="fixed z-[9999] w-44 bg-white rounded-xl shadow-xl border border-amber-100 py-1"
          style={{ top: menuPos.top, left: menuPos.left }}
          onMouseDown={e => e.stopPropagation()}
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
        </div>,
        document.body
      )}
    </>
  );
}

function WTBCard({ wtb, onContact, onImageClick }: { wtb: WTB; onContact?: () => void; onImageClick?: () => void }) {
  const gameStyle = GAME_BADGE_STYLE[wtb.game] ?? { background: "#f3f4f6", color: "#6b7280" };
  const gameLabel = GAMES.find(g => g.id === wtb.game)?.label ?? wtb.game;
  const thumbImg = wtb.officialImageUrl ?? wtb.photoUrls?.[0] ?? null;
  return (
    <div
      id={`wtb-${wtb.id}`}
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
      style={{ background: "#fff", border: "1px solid #f0f0f0", boxShadow: "0 1px 6px rgba(0,0,0,0.05)", borderLeft: "3px solid #F97316" }}
    >
      {thumbImg ? (
        <button type="button" onClick={onImageClick} className="flex-shrink-0 rounded-lg overflow-hidden" style={{ width: 36, height: 50, cursor: onImageClick ? 'pointer' : 'default' }}>
          <img src={thumbImg} alt="" className="w-full h-full object-cover" />
        </button>
      ) : (
        <div className="rounded-lg flex-shrink-0 flex items-center justify-center" style={{ width: 36, height: 50, background: "#f3f4f6" }}>
          <span style={{ fontSize: 18 }}>🃏</span>
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-black leading-tight line-clamp-1" style={{ color: "#111827" }}>{wtb.cardName}</p>
        {wtb.setName && <p className="text-[10px] line-clamp-1" style={{ color: "#9ca3af" }}>{wtb.setName}</p>}
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={gameStyle}>{gameLabel}</span>
          <span className="text-[10px] font-bold" style={{ color: (wtb.maxPriceHKD && wtb.maxPriceHKD > 0) ? "#16a34a" : "#9ca3af" }}>
            {(wtb.maxPriceHKD && wtb.maxPriceHKD > 0) ? `上限 $${wtb.maxPriceHKD.toLocaleString()}` : "HKD 價格面議"}
          </span>
          {wtb.minCondition && <span className="text-[10px]" style={{ color: "#9ca3af" }}>最低 {wtb.minCondition}</span>}
        </div>
      </div>
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        <span className="text-[10px]" style={{ color: "#9ca3af" }}>{wtb.buyerName ?? "用戶"}</span>
        <div className="flex items-center gap-1">
          {onContact && (
            <button
              onClick={onContact}
              className="text-[10px] font-bold px-2 py-0.5"
              style={{ background: "rgba(249,115,22,0.1)", color: "#F97316", border: "1px solid rgba(249,115,22,0.25)", borderRadius: 5 }}
            >
              私訊
            </button>
          )}
          <WTBShareDropdown wtb={wtb} />
        </div>
      </div>
    </div>
  );
}

interface ListingDetailSheetProps {
  listing: Listing;
  onClose: () => void;
  onSelectListing?: (l: Listing) => void;
}

function timeAgoComment(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "剛剛";
  if (diff < 3600) return `${Math.floor(diff / 60)} 分鐘前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小時前`;
  return `${Math.floor(diff / 86400)} 日前`;
}

type CComment = {
  id: number; listingId: number; userId: number; parentId: number | null;
  userName: string | null; userPhoto: string | null; content: string | null;
  imageUrls: string[]; likeCount: number; userLiked: boolean;
  createdAt: string; updatedAt: string;
};

function CommentAvatar({ photo, name }: { photo: string | null; name: string | null }) {
  return (
    <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black overflow-hidden" style={{ background: "rgba(255,222,0,0.18)", color: "#111827" }}>
      {photo ? <img src={photo} alt="" className="w-full h-full object-cover" /> : (name ?? "?").charAt(0).toUpperCase()}
    </div>
  );
}

function CommentInputBar({
  placeholder, value, onChange, imgs, onImgsChange,
  uploading, onImgPick, onSubmit, submitting, onCancel,
}: {
  placeholder: string; value: string; onChange: (v: string) => void;
  imgs: string[]; onImgsChange: (imgs: string[]) => void;
  uploading: boolean; onImgPick: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: () => void; submitting: boolean; onCancel?: () => void;
}) {
  return (
    <div>
      {imgs.length > 0 && (
        <div className="flex gap-1.5 flex-wrap mb-2">
          {imgs.map((url, i) => (
            <div key={i} className="relative">
              <img src={url} alt="" className="rounded object-cover" style={{ width: 52, height: 52 }} />
              <button onClick={() => onImgsChange(imgs.filter((_, j) => j !== i))} className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center" style={{ background: "#ef4444" }}>
                <X className="w-2.5 h-2.5 text-white" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-end gap-1.5">
        <textarea
          className="flex-1 text-sm px-2.5 py-1.5 resize-none outline-none"
          style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, minHeight: 36, maxHeight: 100, color: "#111827" }}
          placeholder={placeholder}
          value={value}
          onChange={e => onChange(e.target.value)}
          maxLength={2000}
          rows={1}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSubmit(); } }}
        />
        <label className="flex-shrink-0 cursor-pointer p-1.5 rounded-full" style={{ background: "#f3f4f6" }}>
          {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: "#9ca3af" }} /> : <ImagePlus className="w-3.5 h-3.5" style={{ color: "#6b7280" }} />}
          <input type="file" accept="image/*" multiple className="hidden" onChange={onImgPick} disabled={uploading || imgs.length >= 4} />
        </label>
        <button onClick={onSubmit} disabled={submitting || (!value.trim() && imgs.length === 0)} className="flex-shrink-0 p-1.5 rounded-full" style={{ background: "#0ea5e9" }}>
          {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin text-white" /> : <Send className="w-3.5 h-3.5 text-white" />}
        </button>
        {onCancel && <button onClick={onCancel} className="flex-shrink-0 text-[11px] px-2 py-1 rounded" style={{ background: "#f3f4f6", color: "#6b7280" }}>取消</button>}
      </div>
    </div>
  );
}

function ListingCommentSection({ listingId }: { listingId: number }) {
  const { isAuthenticated, user } = useAuth();
  const [, navigate] = useLocation();
  const [open, setOpen] = useState(false);
  // Main input
  const [text, setText] = useState("");
  const [pendingImgs, setPendingImgs] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  // Edit
  const [editId, setEditId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [editImgs, setEditImgs] = useState<string[]>([]);
  const [editUploading, setEditUploading] = useState(false);
  // Reply
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replyImgs, setReplyImgs] = useState<string[]>([]);
  const [replyUploading, setReplyUploading] = useState(false);
  // Like animation
  const [flyingLikes, setFlyingLikes] = useState<{ id: string; commentId: number }[]>([]);
  // Image lightbox
  const [imgLb, setImgLb] = useState<string | null>(null);

  const utils = trpc.useUtils();
  const { data: comments = [], isLoading } = trpc.cardTrading.getListingComments.useQuery(
    { listingId, currentUserId: user?.id },
    { enabled: open, staleTime: 30000 }
  );
  const addMut = trpc.cardTrading.addListingComment.useMutation({
    onSuccess: () => { utils.cardTrading.getListingComments.invalidate({ listingId }); setText(""); setPendingImgs([]); },
    onError: (e) => toast.error(e.message),
  });
  const editMut = trpc.cardTrading.editListingComment.useMutation({
    onSuccess: () => { utils.cardTrading.getListingComments.invalidate({ listingId }); setEditId(null); },
    onError: (e) => toast.error(e.message),
  });
  const delMut = trpc.cardTrading.deleteListingComment.useMutation({
    onSuccess: () => utils.cardTrading.getListingComments.invalidate({ listingId }),
    onError: (e) => toast.error(e.message),
  });
  const likeMut = trpc.cardTrading.toggleCommentLike.useMutation({
    onSuccess: () => utils.cardTrading.getListingComments.invalidate({ listingId }),
    onError: (e) => toast.error(e.message),
  });
  const signMut = trpc.cardTrading.signCommentImageUpload.useMutation();

  async function doUpload(file: File, onDone: (url: string) => void, setLoad: (v: boolean) => void) {
    setLoad(true);
    try {
      const { uploadUrl, finalUrl } = await signMut.mutateAsync({ mimeType: file.type });
      await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      onDone(finalUrl);
    } catch { toast.error("圖片上載失敗"); }
    setLoad(false);
  }

  async function makeImgPick(
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    setLoad: React.Dispatch<React.SetStateAction<boolean>>
  ) {
    return async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      e.target.value = "";
      for (const f of files.slice(0, 4)) {
        await doUpload(f, (url) => setter(p => [...p, url].slice(0, 4)), setLoad);
      }
    };
  }

  function handleLike(commentId: number) {
    if (!isAuthenticated) { navigate(`/login?from=${encodeURIComponent(window.location.pathname + window.location.search)}`); return; }
    const flyId = `${commentId}-${Date.now()}`;
    setFlyingLikes(p => [...p, { id: flyId, commentId }]);
    setTimeout(() => setFlyingLikes(p => p.filter(f => f.id !== flyId)), 900);
    likeMut.mutate({ commentId });
  }

  function handleSubmit() {
    if (!isAuthenticated) { navigate(`/login?from=${encodeURIComponent(window.location.pathname + window.location.search)}`); return; }
    if (!text.trim() && pendingImgs.length === 0) { toast.error("請輸入留言內容"); return; }
    addMut.mutate({ listingId, content: text.trim() || undefined, imageUrls: pendingImgs });
  }

  function handleReplySubmit() {
    if (!replyText.trim() && replyImgs.length === 0) { toast.error("請輸入回覆內容"); return; }
    addMut.mutate({ listingId, content: replyText.trim() || undefined, imageUrls: replyImgs, parentId: replyingTo ?? undefined }, {
      onSuccess: () => { setReplyingTo(null); setReplyText(""); setReplyImgs([]); },
    });
  }

  function startEdit(c: CComment) { setEditId(c.id); setEditText(c.content ?? ""); setEditImgs(c.imageUrls); setReplyingTo(null); }

  function handleEditSave() {
    if (!editText.trim() && editImgs.length === 0) { toast.error("留言不能為空"); return; }
    editMut.mutate({ commentId: editId!, content: editText.trim() || undefined, imageUrls: editImgs });
  }

  const topLevel = (comments as CComment[]).filter(c => !c.parentId);
  const getReplies = (id: number) => (comments as CComment[]).filter(c => c.parentId === id);
  const count = comments.length;

  function renderComment(c: CComment, isReply = false) {
    const flies = flyingLikes.filter(f => f.commentId === c.id);
    return (
      <div key={c.id}>
        <div className={`flex gap-2 ${isReply ? "pl-8 px-3 py-2" : "px-3 py-2.5"}`}>
          <CommentAvatar photo={c.userPhoto} name={c.userName} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-bold" style={{ color: "#111827" }}>{c.userName ?? "用戶"}</span>
              <span className="text-[10px]" style={{ color: "#9ca3af" }}>{timeAgoComment(c.createdAt)}</span>
              {c.updatedAt !== c.createdAt && <span className="text-[10px]" style={{ color: "#c4b5fd" }}>（已編輯）</span>}
            </div>
            {editId === c.id ? (
              <div className="mt-1">
                <textarea
                  className="w-full text-sm px-2 py-1.5 resize-none outline-none"
                  style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, minHeight: 60, color: "#111827" }}
                  value={editText} onChange={e => setEditText(e.target.value)} maxLength={2000}
                />
                {editImgs.length > 0 && (
                  <div className="flex gap-1.5 flex-wrap mt-1">
                    {editImgs.map((url, i) => (
                      <div key={i} className="relative">
                        <img src={url} alt="" className="rounded object-cover cursor-pointer" style={{ width: 52, height: 52 }} onClick={() => setImgLb(url)} />
                        <button onClick={() => setEditImgs(p => p.filter((_, j) => j !== i))} className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center" style={{ background: "#ef4444" }}><X className="w-2.5 h-2.5 text-white" /></button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2 mt-1.5">
                  <label className="cursor-pointer flex items-center gap-1 text-[11px] px-2 py-0.5 rounded" style={{ background: "#f3f4f6", color: "#6b7280" }}>
                    {editUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <ImagePlus className="w-3 h-3" />}加圖片
                    <input type="file" accept="image/*" multiple className="hidden" onChange={async (e) => { const files = Array.from(e.target.files ?? []); e.target.value = ""; for (const f of files.slice(0,4)) await doUpload(f, url => setEditImgs(p=>[...p,url].slice(0,4)), setEditUploading); }} disabled={editUploading} />
                  </label>
                  <button onClick={handleEditSave} disabled={editMut.isPending} className="text-[11px] px-3 py-0.5 rounded font-bold" style={{ background: "#0ea5e9", color: "#fff" }}>{editMut.isPending ? "儲存中…" : "儲存"}</button>
                  <button onClick={() => setEditId(null)} className="text-[11px] px-2 py-0.5 rounded" style={{ background: "#f3f4f6", color: "#6b7280" }}>取消</button>
                </div>
              </div>
            ) : (
              <>
                {c.content && <p className="text-sm mt-0.5 leading-relaxed whitespace-pre-wrap" style={{ color: "#374151" }}>{c.content}</p>}
                {c.imageUrls.length > 0 && (
                  <div className="flex gap-1.5 flex-wrap mt-1.5">
                    {c.imageUrls.map((url, i) => <img key={i} src={url} alt="" className="rounded-lg object-cover cursor-pointer" style={{ width: 80, height: 80 }} onClick={() => setImgLb(url)} />)}
                  </div>
                )}
                {/* Action bar: like + reply + edit/delete */}
                <div className="flex items-center gap-3 mt-1.5">
                  {/* Like button */}
                  <div className="relative" style={{ display: "inline-flex" }}>
                    {flies.map(f => (
                      <span key={f.id} className="like-fly" style={{ bottom: 0, left: 2 }}>
                        <ThumbsUp className="w-3.5 h-3.5" style={{ color: "#3b82f6" }} />
                      </span>
                    ))}
                    <button
                      onClick={() => handleLike(c.id)}
                      className="flex items-center gap-1 text-[11px] font-semibold"
                      style={{ color: c.userLiked ? "#3b82f6" : "#9ca3af" }}
                    >
                      <ThumbsUp className="w-3.5 h-3.5" style={{ fill: c.userLiked ? "#3b82f6" : "none" }} />
                      {c.likeCount > 0 && <span>{c.likeCount}</span>}
                    </button>
                  </div>
                  {/* Reply (top-level only) */}
                  {!isReply && (
                    <button
                      onClick={() => { if (!isAuthenticated) { navigate(`/login?from=${encodeURIComponent(window.location.pathname + window.location.search)}`); return; } setReplyingTo(replyingTo === c.id ? null : c.id); setReplyText(""); setReplyImgs([]); setEditId(null); }}
                      className="flex items-center gap-1 text-[11px] font-semibold"
                      style={{ color: replyingTo === c.id ? "#0ea5e9" : "#9ca3af" }}
                    >
                      <CornerDownRight className="w-3 h-3" />回覆
                    </button>
                  )}
                  {/* Own: edit + delete */}
                  {isAuthenticated && user?.id === c.userId && (
                    <>
                      <button onClick={() => startEdit(c)} className="flex items-center gap-1 text-[11px]" style={{ color: "#9ca3af" }}><Pencil className="w-3 h-3" />編輯</button>
                      <button onClick={() => delMut.mutate({ commentId: c.id })} disabled={delMut.isPending} className="flex items-center gap-1 text-[11px]" style={{ color: "#ef4444" }}><Trash2 className="w-3 h-3" />拆除</button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
        {/* Reply input */}
        {replyingTo === c.id && (
          <div className="pl-11 pr-3 pb-2.5">
            <CommentInputBar
              placeholder={`回覆 ${c.userName ?? "用戶"}…`}
              value={replyText} onChange={setReplyText}
              imgs={replyImgs} onImgsChange={setReplyImgs}
              uploading={replyUploading}
              onImgPick={async (e) => { const files = Array.from(e.target.files ?? []); e.target.value = ""; for (const f of files.slice(0,4)) await doUpload(f, url => setReplyImgs(p=>[...p,url].slice(0,4)), setReplyUploading); }}
              onSubmit={handleReplySubmit} submitting={addMut.isPending}
              onCancel={() => setReplyingTo(null)}
            />
          </div>
        )}
        {/* Nested replies */}
        {getReplies(c.id).length > 0 && (
          <div style={{ borderTop: "1px solid #f3f4f6" }}>
            {getReplies(c.id).map(r => renderComment(r, true))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mb-3">
      <div className="flex justify-end">
      <button
        onClick={() => setOpen(v => !v)}
        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl"
        style={{ background: open ? "#f0f9ff" : "#f8f9fa", border: `1px solid ${open ? "#bae6fd" : "#e5e7eb"}` }}
      >
        <MessageSquare className="w-4 h-4" style={{ color: "#0ea5e9" }} />
        <span className="text-sm font-bold" style={{ color: "#111827" }}>用戶留言{count > 0 ? `（${count}）` : ""}</span>
        <ChevronDown className="w-4 h-4" style={{ color: "#9ca3af", transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }} />
      </button>
      </div>

      {open && (
        <div className="mt-2 rounded-xl overflow-hidden" style={{ border: "1px solid #e5e7eb" }}>
          {isLoading ? (
            <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin" style={{ color: "#9ca3af" }} /></div>
          ) : topLevel.length === 0 ? (
            <p className="text-xs text-center py-4" style={{ color: "#9ca3af" }}>暫時未有留言，成為第一個留言者！</p>
          ) : (
            <div className="divide-y" style={{ borderColor: "#f3f4f6" }}>
              {topLevel.map(c => renderComment(c))}
            </div>
          )}

          <div className="px-3 py-2.5" style={{ background: "#f8f9fa", borderTop: "1px solid #e5e7eb" }}>
            {!isAuthenticated ? (
              <button onClick={() => navigate(`/login?from=${encodeURIComponent(window.location.pathname + window.location.search)}`)} className="w-full text-center text-xs py-2 rounded-lg font-semibold" style={{ background: "rgba(14,165,233,0.1)", color: "#0ea5e9", border: "1px solid rgba(14,165,233,0.25)" }}>登入後留言</button>
            ) : (
              <CommentInputBar
                placeholder="寫下你的留言…"
                value={text} onChange={setText}
                imgs={pendingImgs} onImgsChange={setPendingImgs}
                uploading={uploading}
                onImgPick={async (e) => { const files = Array.from(e.target.files ?? []); e.target.value = ""; for (const f of files.slice(0,4)) await doUpload(f, url => setPendingImgs(p=>[...p,url].slice(0,4)), setUploading); }}
                onSubmit={handleSubmit} submitting={addMut.isPending}
              />
            )}
          </div>
        </div>
      )}

      {imgLb && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center" style={{ background: "rgba(0,0,0,0.92)" }} onClick={() => setImgLb(null)}>
          <img src={imgLb} alt="" className="max-w-full max-h-full object-contain" style={{ maxHeight: "90vh" }} />
        </div>,
        document.body
      )}
    </div>
  );
}

function ListingDetailSheet({ listing, onClose, onSelectListing }: ListingDetailSheetProps) {
  const { isAuthenticated, user } = useAuth();
  const [, navigate] = useLocation();
  const [photoIdx, setPhotoIdx] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [soldLb, setSoldLb] = useState<{ photos: string[]; cardName: string; priceHKD: number } | null>(null);
  const [contacting, setContacting] = useState(false);
  const touchStartXRef = useRef(0);
  const photos = listing.photoUrls.length ? listing.photoUrls : (listing.officialImageUrl ? [listing.officialImageUrl] : []);
  const cond = CONDITION_LABELS[listing.condition] ?? { label: listing.condition, full: listing.condition, color: "#7c3aed" };
  const rarityBadge = getRarityShort(listing.rarity);
  const openRoomMut = trpc.cardTrading.openRoomWithSeller.useMutation();
  const { data: sellerStats } = trpc.cardTrading.getSellerCardStats.useQuery({ userId: listing.userId }, { staleTime: 60000 });
  const { data: sellerActiveRaw = [] } = trpc.cardTrading.getSellerListings.useQuery({ userId: listing.userId, status: "active", limit: 12 }, { staleTime: 60000 });
  const { data: sellerSoldRaw = [] } = trpc.cardTrading.getSellerListings.useQuery({ userId: listing.userId, status: "sold", limit: 12 }, { staleTime: 60000 });
  const sellerActive = (sellerActiveRaw as Listing[]).filter(l => l.id !== listing.id);
  const sellerSold = sellerSoldRaw as Listing[];

  async function handleContact() {
    if (!isAuthenticated) { navigate(`/login?from=${encodeURIComponent(window.location.pathname + window.location.search)}`); return; }
    if (listing.userId === user?.id) { toast.info("不能聯絡自己"); return; }
    setContacting(true);
    try {
      const room = await openRoomMut.mutateAsync({ sellerId: listing.userId, listingId: listing.id });
      navigate(`/messages/${room.roomId}?from=${encodeURIComponent(window.location.pathname + `?listing=${listing.id}`)}`);
    } catch {
      toast.error("開啟對話失敗，請稍後再試");
    } finally {
      setContacting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[210] flex flex-col" style={{ background: "#fff" }}>
      <div className="flex items-center justify-between px-4 pt-3 pb-3 flex-shrink-0">
        <h2 className="text-base font-black" style={{ color: "#111827" }}>卡牌詳情</h2>
        <button onClick={onClose} className="text-xs px-3 py-1 rounded-full" style={{ background: "#f3f4f6", color: "#6b7280", border: "1px solid #e5e7eb" }}>關閉</button>
      </div>

      <div className="overflow-y-auto flex-1 px-4 pb-24">
        {photos.length > 0 && (
          <div className="mb-4">
            <div
              className="w-full rounded-2xl overflow-hidden relative"
              style={{ background: "#f8f9fa", cursor: "zoom-in" }}
              onTouchStart={e => { touchStartXRef.current = e.touches[0].clientX; }}
              onTouchEnd={e => {
                const delta = e.changedTouches[0].clientX - touchStartXRef.current;
                if (Math.abs(delta) > 45) {
                  if (delta < 0) setPhotoIdx(i => Math.min(i + 1, photos.length - 1));
                  else setPhotoIdx(i => Math.max(i - 1, 0));
                } else {
                  setLightboxOpen(true);
                }
              }}
              onClick={() => setLightboxOpen(true)}
            >
              <img
                src={photos[photoIdx]}
                alt=""
                className="w-full object-contain"
                style={{ maxHeight: 280, display: "block" }}
                draggable={false}
              />
              {photos.length > 1 && (
                <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
                  {photos.map((_, i) => (
                    <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: i === photoIdx ? "#CC0000" : "rgba(0,0,0,0.25)", transition: "background 0.2s" }} />
                  ))}
                </div>
              )}
              <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded text-[9px]" style={{ background: "rgba(0,0,0,0.45)", color: "#fff" }}>
                點擊放大
              </div>
              <div className="absolute bottom-2 right-2" onClick={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()} onTouchEnd={e => e.stopPropagation()}>
                <ListingShareDropdown listing={listing} />
              </div>
            </div>
            {photos.length > 1 && (
              <div className="flex gap-1.5 mt-2">
                {photos.map((p, i) => (
                  <button key={i} onClick={() => setPhotoIdx(i)} className="flex-shrink-0">
                    <img src={p} alt="" className="rounded-lg object-cover" style={{ width: 40, height: 40, border: i === photoIdx ? "2px solid #CC0000" : "2px solid #e5e7eb" }} />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="mb-3 p-3 rounded-xl" style={{ background: "#f8f9fa", border: "1px solid #e5e7eb" }}>
          {/* 第1行：卡牌種類（左）｜拍咗邊 + 出售價錢（右） */}
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              {listing.game && (
                <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(255,222,0,0.15)", color: "#111827", border: "1px solid rgba(255,222,0,0.35)" }}>
                  {GAMES.find(g => g.id === listing.game)?.label ?? listing.game}
                </span>
              )}
              {rarityBadge && (
                <span className="inline-block text-[10px] font-black px-1.5 py-0.5 rounded" style={RARITY_BADGE_STYLE[rarityBadge] ?? { background: "#F97316", color: "#fff" }}>
                  {rarityBadge}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <p className="text-xl font-black" style={{ color: "#CC0000" }}>HKD ${listing.priceHKD.toLocaleString()}</p>
            </div>
          </div>
          {/* 第2行：卡牌名稱 */}
          <h3 className="text-xl font-black leading-tight" style={{ color: "#111827" }}>{listing.cardName}</h3>
          {listing.cardNameJa && <p className="text-sm mt-0.5" style={{ color: "#6b7280" }}>{listing.cardNameJa}</p>}
          {listing.setName && <p className="text-xs mt-1" style={{ color: "#9ca3af" }}>{listing.setName}{listing.setNumber ? ` #${listing.setNumber}` : ""}</p>}
          <div className="flex flex-wrap gap-2 mt-2">
            <span className="text-xs font-bold px-2.5 py-1 rounded-lg" style={{ background: cond.color, color: "#fff" }}>
              {listing.isGraded && listing.gradeScore ? `${listing.gradingOrg} ${listing.gradeScore}` : cond.full}
            </span>
            {listing.deliveryMethod && (
              <span className="text-xs font-bold px-2.5 py-1 rounded-lg" style={{ background: "rgba(14,165,233,0.08)", color: "#0284c7", border: "1px solid rgba(14,165,233,0.2)" }}>
                {listing.deliveryMethod}
              </span>
            )}
          </div>
          {listing.description && (
            <p className="text-sm mt-2 leading-relaxed" style={{ color: "#374151" }}>{listing.description}</p>
          )}
        </div>

        <ListingCommentSection listingId={listing.id} />

        <div className="flex items-center gap-2 mb-4 p-3 rounded-xl" style={{ background: "#f8f9fa", border: "1px solid #e5e7eb" }}>
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0" style={{ background: "rgba(255,222,0,0.18)", color: "#111827" }}>
            {(listing.sellerName ?? "S").charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold" style={{ color: "#111827" }}>{listing.sellerName ?? "賣家"}</p>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {sellerStats !== undefined && (
                <>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "rgba(22,163,74,0.12)", color: "#16a34a" }}>
                    上架 {sellerStats.active}
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "rgba(99,102,241,0.1)", color: "#6366f1" }}>
                    已售 {sellerStats.sold}
                  </span>
                </>
              )}
              <div className="flex items-center gap-1">
                <Eye className="w-3 h-3" style={{ color: "#9ca3af" }} />
                <span className="text-[10px]" style={{ color: "#9ca3af" }}>{listing.views} 次瀏覽</span>
                <span className="text-[10px] ml-1" style={{ color: "#d1d5db" }}>{timeAgo(listing.createdAt)}</span>
              </div>
            </div>
          </div>
        </div>

        {sellerActive.length > 0 && (
          <div className="mb-3">
            <div style={{ borderRadius: 14, border: "1px solid #e5e7eb", overflow: "hidden", background: "#f9fafb" }}>
              <div className="px-3 py-1.5" style={{ background: "#111827", borderRadius: "14px 14px 0 0" }}>
                <span className="text-[10px] font-black" style={{ color: "#fff" }}>賣家上架中（{sellerActive.length}）</span>
              </div>
              <div className="flex gap-2 p-3 overflow-x-auto" style={{ scrollbarWidth: "none" } as React.CSSProperties}>
                {sellerActive.map(l => {
                  const thumb = l.photoUrls?.[0] ?? l.officialImageUrl;
                  return (
                    <button key={l.id} onClick={() => onSelectListing?.(l)}
                      className="flex-shrink-0 rounded-xl overflow-hidden relative"
                      style={{ width: 70, height: 95, background: "#e5e7eb" }}
                    >
                      {thumb
                        ? <img src={thumb} alt="" className="absolute inset-0 w-full h-full object-cover" />
                        : <div className="absolute inset-0 flex items-center justify-center" style={{ fontSize: 18 }}>🃏</div>}
                      <div className="absolute bottom-0 left-0 right-0 px-1 py-0.5" style={{ background: "linear-gradient(transparent,rgba(0,0,0,0.75))" }}>
                        <p className="text-[8px] font-black leading-tight line-clamp-1" style={{ color: "#FFDE00" }}>${l.priceHKD.toLocaleString()}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {sellerSold.length > 0 && (
          <div className="mb-3">
            <div style={{ borderRadius: 14, border: "1px solid #e5e7eb", overflow: "hidden", background: "#f9fafb" }}>
              <div className="px-3 py-1.5" style={{ background: "#6b7280", borderRadius: "14px 14px 0 0" }}>
                <span className="text-[10px] font-black" style={{ color: "#fff" }}>賣家已售出（{sellerSold.length}）</span>
              </div>
              <div className="flex gap-2 p-3 overflow-x-auto" style={{ scrollbarWidth: "none" } as React.CSSProperties}>
                {sellerSold.map(l => {
                  const soldPhotos = l.photoUrls?.length ? l.photoUrls : (l.officialImageUrl ? [l.officialImageUrl] : []);
                  const thumb = soldPhotos[0];
                  return (
                    <button key={l.id}
                      onClick={() => { if (soldPhotos.length) setSoldLb({ photos: soldPhotos, cardName: l.cardName, priceHKD: l.priceHKD }); }}
                      className="flex-shrink-0 rounded-xl overflow-hidden relative"
                      style={{ width: 70, height: 95, background: "#e5e7eb" }}
                    >
                      {thumb
                        ? <img src={thumb} alt="" className="absolute inset-0 w-full h-full object-cover" style={{ filter: "grayscale(20%)" }} />
                        : <div className="absolute inset-0 flex items-center justify-center" style={{ fontSize: 18 }}>🃏</div>}
                      <div className="absolute top-0.5 left-0.5">
                        <span className="text-[7px] font-black px-1 py-0.5 rounded" style={{ background: "rgba(22,163,74,0.9)", color: "#fff" }}>已售</span>
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 px-1 py-0.5" style={{ background: "linear-gradient(transparent,rgba(0,0,0,0.75))" }}>
                        <p className="text-[8px] font-black leading-tight line-clamp-1" style={{ color: "#fff" }}>${l.priceHKD.toLocaleString()}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {lightboxOpen && <CardPhotoLightbox photos={photos} initialIndex={photoIdx} cardName={listing.cardName} priceHKD={listing.priceHKD} onClose={() => setLightboxOpen(false)} />}
      {soldLb && <CardPhotoLightbox photos={soldLb.photos} initialIndex={0} cardName={soldLb.cardName} priceHKD={soldLb.priceHKD} onClose={() => setSoldLb(null)} />}

      <div className="flex-shrink-0 px-4 pt-3" style={{ background: "#fff", borderTop: "1px solid #f3f4f6", paddingBottom: 24 }}>
        <button
          onClick={handleContact}
          disabled={contacting}
          className="w-full py-3 rounded-2xl font-black text-sm flex items-center justify-center gap-2"
          style={{ background: "linear-gradient(90deg, #FFDE00, #FFB800)", color: "#111827" }}
        >
          {contacting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          私訊賣家洽購
        </button>
      </div>
    </div>
  );
}

export default function CardMarket() {
  const [, navigate] = useLocation();
  const searchStr = useSearch();
  const { isAuthenticated, user } = useAuth();
  const [game, setGame] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [showWTB, setShowWTB] = useState(false);
  const [wtbLightbox, setWtbLightbox] = useState<WTB | null>(null);
  const [riskOpen, setRiskOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const contactWTBMut = trpc.cardTrading.openRoomWithWTBBuyer.useMutation();

  async function handleContactWTBBuyer(wtbId: number) {
    if (!isAuthenticated) { navigate(`/login?from=${encodeURIComponent(window.location.pathname + window.location.search + '#wtb-' + wtbId)}`); return; }
    try {
      const { roomId } = await contactWTBMut.mutateAsync({ wtbId });
      navigate(`/messages/${roomId}?from=${encodeURIComponent(window.location.pathname + window.location.search + '#wtb-' + wtbId)}`);
    } catch (err: any) {
      toast.error(err?.message ?? "聯絡失敗");
    }
  }

  const { data: allListings = [], isLoading } = trpc.cardTrading.getListings.useQuery({
    game: game || undefined,
    cardName: search || undefined,
    limit: 50,
    offset: 0,
  }, { staleTime: 30000 });

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash) return;
    const el = document.getElementById(hash.slice(1));
    if (el) setTimeout(() => el.scrollIntoView({ block: "center", behavior: "smooth" }), 200);
  }, []);

  useEffect(() => {
    if (!searchStr || allListings.length === 0 || selectedListing) return;
    const params = new URLSearchParams(searchStr);
    const listingId = params.get("listing");
    if (!listingId) return;
    const found = (allListings as Listing[]).find(l => String(l.id) === listingId);
    if (found) setSelectedListing(found);
  }, [searchStr, allListings]);

  const { data: marketStats } = trpc.cardTrading.getMarketStats.useQuery(undefined, { staleTime: 60000 });

  const { data: wtbs = [] } = trpc.cardTrading.getWTBs.useQuery({
    game: game || undefined,
    isActive: true,
    limit: 20,
    offset: 0,
  }, { staleTime: 60000 });

  const listings = allListings as Listing[];
  const hotListings = [...listings].sort((a, b) => b.views - a.views).slice(0, 10);
  const recentListings = listings;
  const wtbList = wtbs as WTB[];

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearch(searchInput.trim());
  }

  const GAME_TAB_ACTIVE: Record<string, React.CSSProperties> = {
    "":           { background: "linear-gradient(90deg,#FFDE00,#FFB800)", color: "#111827" },
    pokemon:      { background: "#fee2e2", color: "#b91c1c", border: "1.5px solid #fca5a5" },
    yugioh:       { background: "#ede9fe", color: "#6d28d9", border: "1.5px solid #c4b5fd" },
    mtg:          { background: "#d1fae5", color: "#065f46", border: "1.5px solid #6ee7b7" },
    onepiece:     { background: "#ffedd5", color: "#c2410c", border: "1.5px solid #fdba74" },
    dragonball:   { background: "#fef3c7", color: "#b45309", border: "1.5px solid #fde68a" },
    digimon:      { background: "#dbeafe", color: "#1d4ed8", border: "1.5px solid #93c5fd" },
    other:        { background: "#f3f4f6", color: "#374151", border: "1.5px solid #d1d5db" },
  };

  return (
    <div className="min-h-screen pb-20" style={{ background: "#f4f5f7", color: "#111827" }}>
      <style>{`
        @keyframes cardzx-scan {
          0%   { transform: translateX(-160%); }
          100% { transform: translateX(160%); }
        }
        @keyframes cardzx-flicker {
          0%,100% { opacity: 0.75; }
          30%     { opacity: 1; }
          65%     { opacity: 0.55; }
          80%     { opacity: 0.9; }
        }
      `}</style>
      <Header />

      {selectedListing && (
        <ListingDetailSheet key={selectedListing.id} listing={selectedListing} onClose={() => setSelectedListing(null)} onSelectListing={setSelectedListing} />
      )}

      {wtbLightbox && (() => {
        const allPhotos = [
          ...(wtbLightbox.officialImageUrl ? [wtbLightbox.officialImageUrl] : []),
          ...(wtbLightbox.photoUrls ?? []),
        ];
        return allPhotos.length > 0 ? (
          <CardPhotoLightbox
            photos={allPhotos}
            initialIndex={0}
            cardName={wtbLightbox.cardName}
            priceHKD={wtbLightbox.maxPriceHKD ?? 0}
            onClose={() => setWtbLightbox(null)}
          />
        ) : null;
      })()}

      {/* ── CardZzz sub-header strip ── */}
      <div style={{ background: "linear-gradient(135deg,#0ea5e9 0%,#38bdf8 60%,#7dd3fc 100%)", borderRadius: 8, marginTop: 3, marginLeft: 5, marginRight: 5 }} className="px-4 pt-3 pb-3 flex items-center justify-between">
        <button className="flex items-baseline gap-0.5" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
          <span className="text-xl font-black text-white" style={{ letterSpacing: "-0.5px" }}>Card</span>
          <span className="text-xl font-black" style={{ color: "#FFDE00", letterSpacing: "-0.5px" }}>Zx</span>
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={() => isAuthenticated ? navigate("/cardzx/market/my") : navigate(`/login?from=${encodeURIComponent("/cardzx/market/my")}`)}
            className="p-1.5 rounded-full"
            style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            <ClipboardList className="w-4 h-4" style={{ color: "rgba(255,255,255,0.55)" }} />
          </button>
          <button
            onClick={() => isAuthenticated ? navigate("/cardzx/market/sell") : navigate(`/login?from=${encodeURIComponent("/cardzx/market/sell")}`)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full font-black text-xs"
            style={{ background: "linear-gradient(90deg,#FFDE00,#FFB800)", color: "#111827" }}
          >
            <Plus className="w-3.5 h-3.5" />上架
          </button>
        </div>
      </div>

      {/* ── Hero card — dark, rounded ── */}
      <div className="mx-[5px] mt-[3px] mb-0 overflow-hidden relative" style={{ background: "linear-gradient(135deg,#0ea5e9 0%,#38bdf8 60%,#7dd3fc 100%)", borderRadius: 12 }}>
        <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: "radial-gradient(ellipse at 80% 0%,rgba(255,255,255,0.12) 0%,transparent 55%)" }} />
        {/* scan shimmer overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "linear-gradient(105deg, transparent 35%, rgba(255,255,255,0.22) 50%, transparent 65%)",
            animation: "cardzx-scan 2.8s ease-in-out infinite alternate, cardzx-flicker 1.1s ease-in-out infinite",
            zIndex: 5,
          }}
        />
        <div className="relative z-10 px-4 pt-4 pb-4">
          <div
            className="inline-block mb-2.5 text-[10px] font-black px-2.5 py-1 rounded-full"
            style={{ background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)", letterSpacing: "0.08em" }}
          >
            PREMIUM TRADING HUB
          </div>
          <h2 className="text-lg font-black leading-snug mb-1.5" style={{ color: "#fff" }}>
            免費、極簡、方便快捷<br />全系列圖鑑卡牌交易空間
          </h2>
          <p className="text-xs mb-4" style={{ color: "rgba(255,255,255,0.5)" }}>
            內建完整高清卡牌圖鑑，透明成交，一鍵查價、光速成交
          </p>

          {/* CTA buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate("/cardzx/market/browse")}
              className="text-sm font-black px-4 py-2 rounded-full"
              style={{ background: "rgba(255,255,255,0.12)", color: "#fff", border: "1px solid rgba(255,255,255,0.2)" }}
            >
              瀏覽全部系列
            </button>
            <button
              onClick={() => isAuthenticated ? navigate("/cardzx/market/my") : navigate(`/login?from=${encodeURIComponent("/cardzx/market/my")}`)}
              className="text-sm font-black px-4 py-2 rounded-full flex items-center gap-1.5"
              style={{ background: "rgba(255,255,255,0.12)", color: "#fff", border: "1px solid rgba(255,255,255,0.2)" }}
            >
              <ClipboardList className="w-3.5 h-3.5" />我的清單
            </button>
          </div>
        </div>
      </div>

      {/* ── Market stats badges (below Hero, right-aligned) ── */}
      <div className="flex justify-end px-[5px]" style={{ marginTop: 5, marginBottom: 4, gap: 3 }}>
        {[
          { label: "出售", v: marketStats?.activeListing ?? "—" },
          { label: "成交", v: marketStats?.soldListing ?? "—" },
          { label: "WTB",  v: marketStats?.activeWTB ?? "—" },
        ].map(s => (
          <div key={s.label} className="flex items-center gap-1 px-2.5 py-1" style={{ background: "linear-gradient(90deg,#FFDE00,#FFB800)", borderRadius: 5 }}>
            <span className="text-[11px] font-black" style={{ color: "#fff" }}>{s.label}</span>
            <span className="text-[11px] font-black" style={{ color: "#fff" }}>{s.v}</span>
          </div>
        ))}
      </div>

      {/* ── Content area ── */}
      <div className="px-[5px]">

        {/* Hot listings */}
        {hotListings.length > 0 && !search && (
          <div className="mb-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5">
                <div className="w-1 h-4 rounded-full" style={{ background: "#F97316" }} />
                <span className="text-sm font-black" style={{ color: "#111827" }}>熱門卡牌</span>
                <Flame className="w-3.5 h-3.5" style={{ color: "#F97316" }} />
              </div>
            </div>
            <div className="flex gap-2.5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" } as React.CSSProperties}>
              {hotListings.map(l => (
                <HotCard key={l.id} listing={l} onClick={() => setSelectedListing(l)} />
              ))}
            </div>
          </div>
        )}

        {/* Search */}
        <form onSubmit={handleSearch} className="relative mb-2.5">
          <input
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="搜尋卡牌名稱、系列..."
            className="w-full pl-9 pr-4 py-2.5 text-sm"
            style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", color: "#111827", outline: "none" }}
          />
          <button type="submit" className="absolute left-3 top-1/2 -translate-y-1/2">
            <Search className="w-4 h-4" style={{ color: "#9ca3af" }} />
          </button>
          {search && (
            <button type="button" onClick={() => { setSearch(""); setSearchInput(""); }} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="w-4 h-4" style={{ color: "#9ca3af" }} />
            </button>
          )}
        </form>

        {/* Game tabs */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 mb-4" style={{ scrollbarWidth: "none" }}>
          {GAMES.map(g => (
            <button
              key={g.id}
              onClick={() => setGame(g.id)}
              className="flex-shrink-0 text-xs px-3 py-1.5 rounded-full font-semibold"
              style={game === g.id
                ? (GAME_TAB_ACTIVE[g.id] ?? GAME_TAB_ACTIVE[""])
                : { background: "#fff", color: "#6b7280", border: "1px solid #e5e7eb" }
              }
            >
              {g.label}
            </button>
          ))}
        </div>

        {/* Recent listings */}
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-4 rounded-full" style={{ background: "#FFDE00" }} />
            <span className="text-sm font-black" style={{ color: "#111827" }}>最新上架</span>
            {recentListings.length > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: "#f3f4f6", color: "#6b7280" }}>{recentListings.length}</span>
            )}
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor: "#e5e7eb", borderTopColor: "#F97316" }} />
            </div>
          ) : recentListings.length === 0 ? (
            <div className="flex flex-col items-center py-12 gap-3">
              <span style={{ fontSize: 48 }}>🃏</span>
              <p className="text-sm" style={{ color: "#9ca3af" }}>暫時未有上架記錄</p>
              <button
                onClick={() => isAuthenticated ? navigate("/cardzx/market/sell") : navigate(`/login?from=${encodeURIComponent("/cardzx/market/sell")}`)}
                className="text-sm px-4 py-2 rounded-full font-bold"
                style={{ background: "rgba(255,222,0,0.15)", color: "#111827", border: "1px solid rgba(255,222,0,0.35)" }}>
                立即上架
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5">
              {recentListings.map(l => (
                <ListingCard key={l.id} listing={l} onClick={() => setSelectedListing(l)} />
              ))}
            </div>
          )}
        </div>

        {/* WTB section */}
        {wtbList.length > 0 && (
          <div className="mb-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5">
                <div className="w-1 h-4 rounded-full" style={{ background: "#7c3aed" }} />
                <ShoppingBag className="w-3.5 h-3.5" style={{ color: "#7c3aed" }} />
                <span className="text-sm font-black" style={{ color: "#111827" }}>求購清單</span>
                <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: "#ede9fe", color: "#6d28d9" }}>{wtbList.length}</span>
              </div>
              <button
                onClick={() => navigate("/cardzx/market/wtb")}
                className="text-xs font-bold"
                style={{ color: "#F97316" }}
              >
                登記求購 →
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {wtbList.slice(0, showWTB ? wtbList.length : 3).map(w => (
                <WTBCard
                  key={w.id}
                  wtb={w}
                  onContact={user?.id !== w.userId ? () => handleContactWTBBuyer(w.id) : undefined}
                  onImageClick={(w.officialImageUrl || w.photoUrls?.length > 0) ? () => setWtbLightbox(w) : undefined}
                />
              ))}
              {wtbList.length > 3 && (
                <button
                  onClick={() => setShowWTB(p => !p)}
                  className="text-xs text-center py-2 font-bold"
                  style={{ color: "#F97316" }}
                >
                  {showWTB ? "收起" : `查看全部 ${wtbList.length} 筆求購 →`}
                </button>
              )}
            </div>
          </div>
        )}

        {/* WTB promo / empty */}
        {wtbList.length === 0 && (
          <div className="mb-5 p-4 rounded-2xl flex items-center justify-between" style={{ background: "#fff", border: "1px solid #f0f0f0" }}>
            <div>
              <p className="text-sm font-bold" style={{ color: "#F97316" }}>想求購特定卡？</p>
              <p className="text-xs mt-0.5" style={{ color: "#9ca3af" }}>登記 WTB，有人上架即通知你</p>
            </div>
            <button onClick={() => navigate("/cardzx/market/wtb")}
              className="text-xs px-3 py-1.5 rounded-full font-bold flex-shrink-0"
              style={{ background: "rgba(249,115,22,0.1)", color: "#F97316", border: "1px solid rgba(249,115,22,0.25)" }}>
              登記
            </button>
          </div>
        )}

        {/* Sell CTA */}
        <div className="mb-6 p-4 rounded-2xl overflow-hidden relative" style={{ background: "linear-gradient(135deg,#111827 0%,#1e293b 100%)" }}>
          <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: "radial-gradient(ellipse at 100% 0%,rgba(255,222,0,0.1) 0%,transparent 55%)" }} />
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <p className="text-sm font-black text-white leading-snug flex-1">手邊有珍藏卡牌想要出售？</p>
              <button
                onClick={() => setRiskOpen(v => !v)}
                className="flex items-center gap-1 px-2.5 py-1 flex-shrink-0"
                style={{ background: "#38bdf8", borderRadius: 5 }}
              >
                <span className="text-[11px] font-black text-white whitespace-nowrap">⚠ 風險提示</span>
                <ChevronDown className="w-3 h-3 text-white" style={{ transform: riskOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }} />
              </button>
            </div>
            {riskOpen && (
              <div className="mb-3">
                <img
                  src="/cardzx-risk-notice-v2.png"
                  alt="交易風險提示"
                  className="w-full rounded-xl"
                  style={{ display: "block" }}
                />
              </div>
            )}
            <p className="text-xs mb-3" style={{ color: "rgba(255,255,255,0.5)" }}>
              不論是 Graded 評級卡、還是 RAW 裸卡，<br />在 CardZx 均可快速上架，直面港台數萬名藏家
            </p>
            <button
              onClick={() => isAuthenticated ? navigate("/cardzx/market/sell") : navigate(`/login?from=${encodeURIComponent("/cardzx/market/sell")}`)}
              className="px-5 py-2 rounded-full font-black text-xs"
              style={{ background: "linear-gradient(90deg,#FFDE00,#FFB800)", color: "#111827" }}
            >
              立即刊登商品
            </button>
          </div>
        </div>
        <div className="flex items-center" style={{ gap: 5, marginTop: -15 }}>
          <button
            onClick={() => setQrOpen(true)}
            className="flex items-center px-2 py-0.5 font-black"
            style={{ background: "#38bdf8", borderRadius: 5, fontSize: 11 }}
          >
            <span style={{ color: "#fff" }}>Card</span><span style={{ color: "#FFDE00" }}>Zx</span>
          </button>
          <button
            onClick={() => setQrOpen(true)}
            className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold"
            style={{ background: "rgba(56,189,248,0.12)", color: "#0ea5e9", border: "1px solid rgba(56,189,248,0.3)", borderRadius: 5 }}
          >
            <QrCode className="w-3 h-3" />
            QR code二維碼
          </button>
        </div>
      </div>

      {/* FAB */}
      <button
        onClick={() => isAuthenticated ? navigate("/cardzx/market/sell") : navigate(`/login?from=${encodeURIComponent("/cardzx/market/sell")}`)}
        className="fixed z-40 rounded-full shadow-xl flex items-center gap-2 font-black text-sm"
        style={{ bottom: 76, right: 16, background: "linear-gradient(90deg,#FFDE00,#FFB800)", color: "#111827", padding: "12px 18px", boxShadow: "0 4px 20px rgba(255,184,0,0.5)" }}
      >
        <Plus className="w-4 h-4" />
        上架
      </button>

      {/* CardZx QR Code Dialog */}
      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-center text-sm">CardZx 卡牌交易市場</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-3 py-2">
            <div id="cardzx-qr-svg-wrap" className="bg-white p-3 rounded-lg border border-gray-200">
              <QRCodeSVG value="https://hongxcollections.com/cardzx/market" size={200} level="M" fgColor="#38bdf8" />
            </div>
            <p className="text-[11px] text-gray-500 text-center break-all px-2">hongxcollections.com/cardzx/market</p>
            <p className="text-xs text-gray-600 text-center">掃描 QR Code 即可進入 CardZx 卡牌交易市場</p>
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText("https://hongxcollections.com/cardzx/market");
                  toast.success("已複製連結", { description: "https://hongxcollections.com/cardzx/market", duration: 4000 });
                } catch { toast.error("複製失敗"); }
              }}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all"
              style={{ background: "rgba(56,189,248,0.1)", color: "#0ea5e9", border: "1px solid rgba(56,189,248,0.3)" }}
            >
              <Copy className="w-4 h-4" />
              複製連結
            </button>
            <button
              type="button"
              onClick={() => {
                const wrap = document.getElementById("cardzx-qr-svg-wrap");
                const svg = wrap?.querySelector("svg");
                if (!svg) return;
                const xml = new XMLSerializer().serializeToString(svg);
                const svg64 = btoa(unescape(encodeURIComponent(xml)));
                const dataUrl = `data:image/svg+xml;base64,${svg64}`;
                const img = new Image();
                img.onload = () => {
                  const scale = 3;
                  const size = 200 * scale;
                  const pad = 24 * scale;
                  const nameH = 22 * scale;
                  const poweredH = 8 * scale;
                  const gapAfterQR = 8 * scale;
                  const gapBetween = 3 * scale;
                  const canvas = document.createElement("canvas");
                  canvas.width = size + pad * 2;
                  canvas.height = pad + size + gapAfterQR + nameH + gapBetween + poweredH + pad;
                  const ctx = canvas.getContext("2d");
                  if (!ctx) return;
                  ctx.fillStyle = "#ffffff";
                  ctx.fillRect(0, 0, canvas.width, canvas.height);
                  ctx.drawImage(img, pad, pad, size, size);
                  const rightX = pad + size;
                  const nameY = pad + size + gapAfterQR + nameH / 2;
                  const poweredY = pad + size + gapAfterQR + nameH + gapBetween + poweredH / 2;
                  ctx.textAlign = "left";
                  ctx.textBaseline = "middle";
                  ctx.font = `bold ${18 * scale}px -apple-system, BlinkMacSystemFont, "PingFang TC", sans-serif`;
                  const cardW = ctx.measureText("Card").width;
                  const zxW = ctx.measureText("Zx").width;
                  const nameStartX = rightX - cardW - zxW;
                  ctx.fillStyle = "#38bdf8";
                  ctx.fillText("Card", nameStartX, nameY);
                  ctx.fillStyle = "#FFDE00";
                  ctx.fillText("Zx", nameStartX + cardW, nameY);
                  ctx.textAlign = "right";
                  ctx.font = `${3 * scale}px -apple-system, BlinkMacSystemFont, sans-serif`;
                  ctx.fillStyle = "#94a3b8";
                  ctx.fillText("Powered by hongxcollections.com", rightX, poweredY);
                  canvas.toBlob((blob) => {
                    if (!blob) return;
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = "cardzx-market-qr.png";
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    setTimeout(() => URL.revokeObjectURL(url), 1000);
                  }, "image/png");
                };
                img.src = dataUrl;
              }}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all"
              style={{ background: "linear-gradient(135deg,#38bdf8,#0ea5e9)", color: "#fff" }}
            >
              <QrCode className="w-4 h-4" />
              下載 QR 圖片
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
