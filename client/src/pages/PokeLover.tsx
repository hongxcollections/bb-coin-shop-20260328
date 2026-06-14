import { useState, useRef, useCallback, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import Header from "@/components/Header";
import { toast } from "sonner";
import { Upload, Loader2, Search, Zap, ExternalLink, Share2, Copy, Check, X, MoreHorizontal, Star, AlertTriangle, RefreshCcw, BookmarkPlus, Bookmark, BookOpen, DollarSign, ChevronRight, Images } from "lucide-react";
import { SHARE_ORIGIN } from "@/lib/shareUrl";
import { useAuth } from "@/_core/hooks/useAuth";

type PokeResult = {
  cardName?: string;
  cardNameJa?: string;
  set?: string;
  setNumber?: string;
  rarity?: string;
  hp?: number | null;
  types?: string[];
  attacks?: Array<{ name: string; damage?: string | null; cost?: string[] }>;
  releaseYear?: string;
  language?: string;
  condition?: string;
  conditionNote?: string;
  marketPriceHKD?: number | null;
  psa9HKD?: number | null;
  psa10HKD?: number | null;
  gradeEstimate?: number | null;
  bgsEstimate?: number | null;
  cgcEstimate?: number | null;
  tagEstimate?: number | null;
  worthGrading?: boolean;
  authenticityWarning?: string | null;
  authenticityScore?: number | null;
  ebaySearchQuery?: string;
  funFact?: string;
  isNotPokemon?: boolean;
};

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  Fire:       { bg: "#FF4422", text: "#fff" },
  Water:      { bg: "#3399FF", text: "#fff" },
  Grass:      { bg: "#5DAA33", text: "#fff" },
  Lightning:  { bg: "#F8D030", text: "#333" },
  Psychic:    { bg: "#F85888", text: "#fff" },
  Fighting:   { bg: "#C03028", text: "#fff" },
  Darkness:   { bg: "#705848", text: "#fff" },
  Metal:      { bg: "#B8B8D0", text: "#333" },
  Dragon:     { bg: "#7038F8", text: "#fff" },
  Colorless:  { bg: "#A8A878", text: "#fff" },
  default:    { bg: "#888", text: "#fff" },
};

const RARITY_COLOR: Record<string, string> = {
  "Common": "#aaa",
  "Uncommon": "#4CAF50",
  "Rare": "#2196F3",
  "Holo Rare": "#9C27B0",
  "Ultra Rare": "#FF9800",
  "Secret Rare": "#f44336",
  "Promo": "#E91E63",
};

const PSA_FEE_HKD = 420;
const MENU_W = 176;
const MENU_H = 260;

type GradingOrg = "PSA" | "BGS" | "CGC" | "TAG";
const GRADING_FEES: Record<GradingOrg, Record<string, number>> = {
  PSA: { Regular: 420, Express: 800, Walkthrough: 3000 },
  BGS: { Regular: 560, Express: 1200 },
  CGC: { Regular: 420, Express: 750 },
  TAG: { Regular: 400 },
};
type HistoryItem = {
  id: string; cardName: string; cardNameJa?: string;
  gradeEstimate?: number | null; marketPriceHKD?: number | null;
  imageThumb?: string; savedAt: number; result: PokeResult;
};
function historyKey(userId?: number | null) {
  return `poke_history_v1_${userId ?? "guest"}`;
}
function loadHistory(userId?: number | null): HistoryItem[] {
  try { return JSON.parse(localStorage.getItem(historyKey(userId)) ?? "[]"); } catch { return []; }
}
function saveHistory(items: HistoryItem[], userId?: number | null) {
  try { localStorage.setItem(historyKey(userId), JSON.stringify(items.slice(0, 20))); } catch {}
}

// ─── Icons ────────────────────────────────────────────────────────────────────

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
    <path d="M141.537 88.988a66.667 66.667 0 0 0-2.518-1.143c-1.482-27.307-16.403-42.94-41.457-43.1h-.34c-14.986 0-27.449 6.396-35.12 18.036l13.779 9.452c5.73-8.695 14.724-10.548 21.348-10.548h.229c8.249.053 14.474 2.452 18.503 7.129 2.932 3.405 4.893 8.111 5.864 14.05-7.314-1.243-15.224-1.626-23.68-1.14-23.82 1.371-39.134 15.264-38.105 34.568.522 9.792 5.4 18.216 13.735 23.719 7.047 4.652 16.124 6.927 25.557 6.412 12.458-.683 22.231-5.436 29.049-14.127 5.178-6.6 8.453-15.153 9.899-25.93 5.937 3.583 10.337 8.298 12.767 13.966 4.132 9.635 4.373 25.468-8.546 38.376-11.319 11.308-24.925 16.2-45.488 16.351-22.809-.169-40.06-7.484-51.275-21.742C91.346 146.194 85 128.922 85 107.5c0-21.422 6.346-38.694 18.87-51.319 11.315-11.419 28.566-18.734 51.273-21.742"/>
    <path d="M96 64.748c1.617 0 3.212.088 4.783.26-.406-6.696-1.697-12.28-3.885-16.582-2.624-5.144-6.611-8.695-12.11-10.784-8.26-3.115-18.57-1.69-27.84 3.92l-7.087-12.376c12.29-7.04 26.512-9.6 39.568-6.984 12.21 2.45 21.824 9.346 27.805 19.787 5.074 8.93 7.578 20.554 7.455 34.546l-.051 1.04c-.162 5.017-.3 12.32-.156 19.972.082 4.287.303 8.46.67 12.312 1.05 11.024.086 19.72-2.888 27.286-3.367 8.586-9.003 15.037-17.23 19.716-8.69 4.94-18.83 7.278-29.96 6.972-13.02-.363-24.49-4.573-33.17-12.19C33.086 144.116 27.5 133.444 27.5 120.5c0-15.29 8.167-27.853 22.955-35.44 10.073-5.18 22.28-7.627 36.304-7.306-.14 2.828-.217 5.693-.217 8.594 0 2.6.064 5.16.184 7.668-11.14-.325-20.085 1.596-26.582 5.698-6.988 4.424-10.644 10.69-10.644 18.286 0 8.126 4.03 14.453 11.664 18.304 7.053 3.558 15.64 4.357 24.316 2.26 10.576-2.558 17.824-8.54 21.546-17.783 2.25-5.587 3.017-12.306 2.353-20.46a193.36 193.36 0 0 1-.437-10.007c-.084-5.018.043-10.186.178-14.99A55.06 55.06 0 0 0 96 64.748z"/>
  </svg>
);

// ─── Image Lightbox with pinch-to-zoom ────────────────────────────────────────

function ImageLightbox({ src, onClose }: { src: string; onClose: () => void }) {
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const lastDist = useRef<number | null>(null);
  const lastTouch = useRef<{ x: number; y: number } | null>(null);

  function getDist(touches: React.TouchList) {
    const [t1, t2] = [touches[0], touches[1]];
    return Math.sqrt((t1.clientX - t2.clientX) ** 2 + (t1.clientY - t2.clientY) ** 2);
  }

  function onTouchStart(e: React.TouchEvent) {
    if (e.touches.length === 2) {
      lastDist.current = getDist(e.touches);
    } else if (e.touches.length === 1) {
      lastTouch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  }

  function onTouchMove(e: React.TouchEvent) {
    e.preventDefault();
    if (e.touches.length === 2 && lastDist.current !== null) {
      const dist = getDist(e.touches);
      const ratio = dist / lastDist.current;
      setScale(s => Math.max(1, Math.min(6, s * ratio)));
      lastDist.current = dist;
    } else if (e.touches.length === 1 && lastTouch.current) {
      const dx = e.touches[0].clientX - lastTouch.current.x;
      const dy = e.touches[0].clientY - lastTouch.current.y;
      setPos(p => ({ x: p.x + dx, y: p.y + dy }));
      lastTouch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  }

  function onTouchEnd(e: React.TouchEvent) {
    if (e.touches.length < 2) lastDist.current = null;
    if (e.touches.length === 0) {
      lastTouch.current = null;
      if (scale <= 1.05) { setScale(1); setPos({ x: 0, y: 0 }); }
    }
  }

  function handleBgClick() {
    if (scale <= 1.05) onClose();
  }

  function resetZoom() {
    setScale(1);
    setPos({ x: 0, y: 0 });
  }

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.95)", touchAction: "none" }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onClick={handleBgClick}
    >
      <button
        type="button"
        className="absolute top-4 right-4 z-10 flex items-center justify-center w-9 h-9 rounded-full"
        style={{ background: "rgba(255,255,255,0.15)" }}
        onClick={(e) => { e.stopPropagation(); onClose(); }}
      >
        <X className="w-5 h-5 text-white" />
      </button>
      {scale > 1.05 && (
        <button
          type="button"
          className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 text-xs px-4 py-2 rounded-full"
          style={{ background: "rgba(255,255,255,0.15)", color: "#fff" }}
          onClick={(e) => { e.stopPropagation(); resetZoom(); }}
        >
          重設縮放
        </button>
      )}
      <img
        src={src}
        alt="Card"
        draggable={false}
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: "95vw",
          maxHeight: "88vh",
          objectFit: "contain",
          transform: `scale(${scale}) translate(${pos.x / scale}px, ${pos.y / scale}px)`,
          transformOrigin: "center center",
          userSelect: "none",
          borderRadius: 8,
          transition: scale === 1 ? "transform 0.2s" : "none",
        }}
      />
      <p className="absolute bottom-4 left-0 right-0 text-center text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
        {scale <= 1.05 ? "雙指放大 · 點擊關閉" : "單指拖移 · 雙指縮放"}
      </p>
    </div>
  );
}

// ─── Share Image Dialog ───────────────────────────────────────────────────────

function ShareImageDialog({ imgUrl, cardName, onClose }: { imgUrl: string; cardName: string; onClose: () => void }) {
  const [scale, setScale] = useState(1);
  const lastDistRef = useRef<number | null>(null);
  const lastTapRef = useRef<number>(0);

  function getPinchDist(e: React.TouchEvent) {
    if (e.touches.length < 2) return null;
    const dx = e.touches[1].clientX - e.touches[0].clientX;
    const dy = e.touches[1].clientY - e.touches[0].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function onTouchStart(e: React.TouchEvent) {
    if (e.touches.length === 2) {
      lastDistRef.current = getPinchDist(e);
    } else if (e.touches.length === 1) {
      const now = Date.now();
      if (now - lastTapRef.current < 280) {
        setScale(s => s > 1.5 ? 1 : 2.5);
      }
      lastTapRef.current = now;
    }
  }

  function onTouchMove(e: React.TouchEvent) {
    e.preventDefault();
    if (e.touches.length === 2) {
      const dist = getPinchDist(e);
      if (dist && lastDistRef.current) {
        setScale(s => Math.max(1, Math.min(5, s * (dist / lastDistRef.current!))));
      }
      lastDistRef.current = dist;
    }
  }

  function onTouchEnd() {
    lastDistRef.current = null;
    setScale(s => (s < 1.05 ? 1 : s));
  }

  function handleSave() {
    const a = document.createElement("a");
    a.href = imgUrl;
    a.download = `${cardName || "pokemon"}-analysis.png`;
    a.click();
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.96)", display: "flex", flexDirection: "column", touchAction: "none" }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", padding: "12px 16px", flexShrink: 0 }}>
        {scale > 1.05 && (
          <button onClick={() => setScale(1)}
            style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", background: "rgba(255,255,255,0.1)", border: "none", borderRadius: 8, padding: "4px 10px", cursor: "pointer" }}>
            重設縮放
          </button>
        )}
        {scale <= 1.05 && <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>雙指放大 · 雙擊切換縮放</span>}
      </div>
      <div style={{ flex: 1, overflow: "auto", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "0 5px" }}>
        <img
          src={imgUrl}
          alt="分析結果"
          draggable={false}
          style={{ width: "100%", height: "auto", transform: `scale(${scale})`, transformOrigin: "top center", userSelect: "none", display: "block", transition: "transform 0.15s ease" }}
        />
      </div>
      <div style={{ display: "flex", gap: 12, padding: "16px", paddingBottom: "calc(16px + env(safe-area-inset-bottom, 0px))", flexShrink: 0 }}>
        <button onClick={handleSave}
          style={{ flex: 1, background: "linear-gradient(135deg, #FFDE00, #FF9800)", color: "#13131f", fontWeight: 700, border: "none", borderRadius: 14, padding: "14px 0", fontSize: 15, cursor: "pointer" }}>
          儲存圖片
        </button>
        <button onClick={onClose}
          style={{ flex: 1, background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)", fontWeight: 600, border: "1px solid rgba(255,255,255,0.15)", borderRadius: 14, padding: "14px 0", fontSize: 15, cursor: "pointer" }}>
          取消
        </button>
      </div>
    </div>
  );
}

// ─── Inline Share Menu for PokeLover ─────────────────────────────────────────

function PokeShareMenu({ result }: { result: PokeResult }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const pokeUrl = `${SHARE_ORIGIN}/pokemon`;

  const priceLine = [
    result.marketPriceHKD ? `裸卡 ~HK$${result.marketPriceHKD.toLocaleString("en-HK")}` : null,
    result.psa9HKD ? `PSA 9 ~HK$${result.psa9HKD.toLocaleString("en-HK")}` : null,
    result.psa10HKD ? `PSA 10 ~HK$${result.psa10HKD.toLocaleString("en-HK")}` : null,
  ].filter(Boolean).join(" | ");

  const shareText = [
    `🃏 ${result.cardName ?? "Pokemon 卡片"}${result.cardNameJa ? `（${result.cardNameJa}）` : ""}`,
    result.set ? `📦 ${result.set}${result.setNumber ? ` #${result.setNumber}` : ""}` : null,
    result.rarity ? `⭐ ${result.rarity}${result.hp ? ` | HP ${result.hp}` : ""}` : null,
    priceLine ? `💰 ${priceLine}` : null,
    `AI Pokemon 卡片鑑定 👇\n${pokeUrl}`,
  ].filter(Boolean).join("\n");

  const calcPos = useCallback(() => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let top = rect.bottom + 4;
    let left = rect.right - MENU_W;
    if (left + MENU_W > vw - 8) left = vw - MENU_W - 8;
    if (left < 8) left = 8;
    if (top + MENU_H > vh - 8) top = rect.top - MENU_H - 4;
    if (top < 8) top = 8;
    setMenuPos({ top, left });
  }, []);

  function handleOpen(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    if (open) { setOpen(false); return; }
    calcPos(); setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    function close() { setOpen(false); }
    document.addEventListener("mousedown", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  async function handleMoreShare() {
    setOpen(false);
    if (navigator.share) {
      try {
        await navigator.clipboard.writeText(shareText).catch(() => {});
        await navigator.share({ title: result.cardName ?? "Pokemon 卡片", text: shareText.replace("\n" + pokeUrl, "").trim(), url: pokeUrl });
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== "AbortError") {
          try { await navigator.clipboard.writeText(shareText); } catch {}
          toast.success("已複製分享文字", { className: "bb-toast-success", description: shareText, duration: 5000 });
        }
      }
    } else {
      try { await navigator.clipboard.writeText(shareText); } catch {}
      toast.success("已複製分享文字，可貼到任何平台", { className: "bb-toast-success", description: shareText, duration: 5000 });
    }
  }

  async function handleMessenger() {
    setOpen(false);
    const isMobile = /android|iphone|ipad|ipod/i.test(navigator.userAgent);
    try { await navigator.clipboard.writeText(shareText); } catch {}
    if (isMobile) {
      window.location.href = `fb-messenger://share?link=${encodeURIComponent(pokeUrl)}`;
      toast.success("已複製文案，Messenger 開啟後可貼上", { className: "bb-toast-success", duration: 5000 });
    } else {
      window.open("https://www.messenger.com/", "_blank", "noopener,noreferrer");
      toast.success("已複製連結，請喺 Messenger 對話框貼上", { className: "bb-toast-success", duration: 5000 });
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
    try { await navigator.clipboard.writeText(shareText); toast.success("已複製分享文字", { className: "bb-toast-success", description: shareText, duration: 5000 }); }
    catch { toast.error("複製失敗", { className: "bb-toast-err" }); }
    setOpen(false);
  }

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(pokeUrl);
      setCopied(true);
      toast.success("已複製連結", { className: "bb-toast-success", duration: 3000 });
      setTimeout(() => setCopied(false), 2000);
    } catch { toast.error("複製失敗", { className: "bb-toast-err" }); }
    setOpen(false);
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={handleOpen}
        className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full"
        style={{ background: "rgba(255,222,0,0.15)", color: "#FFDE00", border: "1px solid rgba(255,222,0,0.3)" }}
      >
        <Share2 className="w-3.5 h-3.5" /> 分享
      </button>
      {open && menuPos && (
        <div
          className="fixed z-[9999] bg-white rounded-xl shadow-xl border border-amber-100 py-1"
          style={{ top: menuPos.top, left: menuPos.left, width: MENU_W }}
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
            <Copy className="w-4 h-4 shrink-0" />複製分享文字
          </button>
          <button type="button" onClick={handleCopyLink} className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left text-muted-foreground hover:bg-amber-50/80 hover:text-amber-700 transition-colors">
            {copied ? <Check className="w-4 h-4 text-green-500 shrink-0" /> : <Copy className="w-4 h-4 shrink-0" />}
            {copied ? "已複製！" : "複製連結"}
          </button>
        </div>
      )}
    </>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: string }) {
  const c = TYPE_COLORS[type] ?? TYPE_COLORS.default;
  return (
    <span className="inline-block text-xs font-bold px-2.5 py-0.5 rounded-full" style={{ background: c.bg, color: c.text }}>
      {type}
    </span>
  );
}

function PokeBallUpload({ onFiles, disabled }: { onFiles: (files: File[]) => void; disabled: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f && f.type.startsWith("image/")) onFiles([f]);
  }, [onFiles]);

  return (
    <div
      className="flex flex-col items-center gap-4 cursor-pointer"
      onClick={() => !disabled && ref.current?.click()}
      onDrop={handleDrop}
      onDragOver={e => e.preventDefault()}
    >
      <div className="relative flex items-center justify-center select-none" style={{ width: 160, height: 160 }}>
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: "linear-gradient(to bottom, #CC0000 50%, #f5f5f5 50%)",
            border: "5px solid #222",
            boxShadow: "0 8px 32px rgba(204,0,0,0.4), 0 2px 8px rgba(0,0,0,0.5)",
          }}
        />
        <div
          className="absolute"
          style={{ top: "calc(50% - 3px)", left: 5, right: 5, height: 6, background: "#222", zIndex: 1 }}
        />
        <div
          className="absolute"
          style={{
            top: "calc(50% - 14px)", left: "calc(50% - 14px)",
            width: 28, height: 28, borderRadius: "50%",
            background: "#222", border: "5px solid #222", zIndex: 2,
          }}
        >
          <div style={{ position: "absolute", inset: 3, borderRadius: "50%", background: "linear-gradient(135deg, #fff 40%, #ddd 100%)" }} />
        </div>
        <div className="relative z-10 flex flex-col items-center" style={{ marginTop: 20 }}>
          <Upload className="w-6 h-6" style={{ color: "#333" }} />
        </div>
      </div>
      <p className="text-sm font-semibold" style={{ color: "#FFDE00" }}>點擊或拖放 Pokemon 卡片圖片</p>
      <p className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>支援 JPG / PNG / WEBP</p>
      <input ref={ref} type="file" accept="image/*" multiple className="hidden" onChange={e => { const files = Array.from(e.target.files ?? []).filter(f => f.type.startsWith("image/")); if (files.length) onFiles(files); e.target.value = ""; }} />
    </div>
  );
}

function SpinningBall() {
  return (
    <div className="flex flex-col items-center gap-4">
      <div
        className="animate-spin"
        style={{ width: 64, height: 64, borderRadius: "50%", background: "linear-gradient(to bottom, #CC0000 50%, #f5f5f5 50%)", border: "4px solid #222", boxShadow: "0 4px 20px rgba(204,0,0,0.4)" }}
      />
      <p className="text-sm font-semibold animate-pulse" style={{ color: "#FFDE00" }}>AI 正在識別卡片...</p>
    </div>
  );
}

function fmtHKD(n: number) { return `HKD $${n.toLocaleString("en-HK")}`; }
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const lines: string[] = [];
  let cur = "";
  // Tokenise: CJK chars individually; other chars grouped into words
  const tokens: string[] = [];
  let buf = "";
  const CJK = /[\u4e00-\u9fff\u3040-\u30ff\uff00-\uffef]/;
  for (const ch of text) {
    if (CJK.test(ch)) { if (buf) { tokens.push(buf); buf = ""; } tokens.push(ch); }
    else { buf += ch; }
  }
  if (buf) tokens.push(buf);
  for (const token of tokens) {
    const test = cur + token;
    if (ctx.measureText(test).width > maxW && cur.length > 0) { lines.push(cur); cur = token; }
    else { cur = test; }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [text];
}

function GradeBar({ grade }: { grade: number }) {
  const colors = ["", "#f44336","#f44336","#FF9800","#FF9800","#FFC107","#FFC107","#8BC34A","#4CAF50","#2196F3","#9C27B0"];
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-0.5">
        {[1,2,3,4,5,6,7,8,9,10].map(i => (
          <div key={i} style={{ width: 14, height: 14, borderRadius: 3, background: i <= grade ? colors[i] : "rgba(255,255,255,0.1)", transition: "background 0.3s" }} />
        ))}
      </div>
      <span className="text-sm font-black" style={{ color: colors[grade] ?? "#fff" }}>{grade}/10</span>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PokeLover() {
  const [, navigate] = useLocation();
  const { isAuthenticated, user } = useAuth();
  const [imagePreview, setImagePreview] = useState<string>("");
  const [result, setResult] = useState<PokeResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [rawPriceInput, setRawPriceInput] = useState("");
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [pendingFileData, setPendingFileData] = useState<{ base64: string; mimeType: string } | null>(null);
  const [gradingOrg, setGradingOrg] = useState<GradingOrg>("PSA");
  const [gradingTier, setGradingTier] = useState<string>("Regular");
  const [currency, setCurrency] = useState<"HKD" | "USD" | "JPY">("HKD");
  const [fxRates, setFxRates] = useState<{ USD: number; JPY: number } | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [savedCardId, setSavedCardId] = useState<number | null>(null);
  const [savingCard, setSavingCard] = useState(false);
  const batchQueueRef = useRef<File[]>([]);
  const processFileRef = useRef<((file: File) => void) | null>(null);
  const historyThumbRef = useRef<string>("");
  const userIdRef = useRef<number | null | undefined>(undefined);
  const shareCardRef = useRef<HTMLDivElement>(null);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareImgUrl, setShareImgUrl] = useState("");
  const [shareGenerating, setShareGenerating] = useState(false);
  const [batchTotal, setBatchTotal] = useState(0);
  const [batchDone, setBatchDone] = useState(0);
  const [batchSummary, setBatchSummary] = useState<{ name: string; value: number | null }[]>([]);
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [historySelectMode, setHistorySelectMode] = useState(false);
  const [selectedHistoryIds, setSelectedHistoryIds] = useState<Set<string>>(new Set());

  // Load history from localStorage (per-user key)
  useEffect(() => { setHistory(loadHistory(user?.id)); }, [user?.id]);

  // Auto re-analyze: triggered from card collection "重新分析"
  // useEffect uses [] + processFileRef to avoid TDZ in production build
  useEffect(() => {
    const stored = localStorage.getItem("poke_reanalyze");
    if (!stored) return;
    try {
      const { imageThumb } = JSON.parse(stored) as { imageThumb?: string };
      if (!imageThumb) return;
      localStorage.removeItem("poke_reanalyze");
      fetch(imageThumb)
        .then(r => r.blob())
        .then(blob => {
          const file = new File([blob], "card.jpg", { type: blob.type || "image/jpeg" });
          processFileRef.current?.(file);
        })
        .catch(() => {});
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch FX rates for currency conversion
  useEffect(() => {
    fetch("https://open.er-api.com/v6/latest/HKD")
      .then(r => r.json())
      .then((d: any) => {
        if (d?.rates) setFxRates({ USD: d.rates.USD as number, JPY: d.rates.JPY as number });
      })
      .catch(() => setFxRates({ USD: 0.128, JPY: 19.7 })); // fallback hardcoded
  }, []);

  // Reset gradingTier when org changes
  useEffect(() => {
    const tiers = Object.keys(GRADING_FEES[gradingOrg]);
    if (!tiers.includes(gradingTier)) setGradingTier(tiers[0]);
  }, [gradingOrg]);

  useEffect(() => {
    if (!isAnalyzing) { setLoadingStep(0); return; }
    let i = 0;
    const t = setInterval(() => { i = (i + 1) % 3; setLoadingStep(i); }, 2200);
    return () => clearInterval(t);
  }, [isAnalyzing]);

  const saveCardMut = trpc.pokeLover.saveCard.useMutation({
    onSuccess: (data) => { setSavedCardId(data.id); toast.success(`「${result?.cardName ?? "卡片"}」已加入卡冊`, { className: "bb-toast-success" }); },
    onError: (err) => toast.error(err.message || "儲存失敗，請重試", { className: "bb-toast-err" }),
    onSettled: () => setSavingCard(false),
  });

  const siteSearchQuery = trpc.pokeLover.searchSiteAuctions.useQuery(
    { cardName: result?.cardName ?? "" },
    { enabled: false, staleTime: 60_000 }
  );

  const analyzeMut = trpc.pokeLover.analyze.useMutation({
    onSuccess: (res) => {
      const data = res.data as PokeResult;
      setAnalysisError(null);
      if (data.isNotPokemon) {
        toast.error("呢張唔似係 Pokemon 卡，請重新上載", { className: "bb-toast-err" });
        setResult(null);
      } else {
        setResult(data);
        setSavedCardId(null);
        if (data.marketPriceHKD) setRawPriceInput(String(data.marketPriceHKD));
        // historyThumbRef 已喺 processFile 同步生成，直接用，唔靠 state closure
        const thumb = historyThumbRef.current;
        const uid = userIdRef.current;
        const entry: HistoryItem = {
          id: Date.now().toString(),
          cardName: data.cardName ?? "未知卡片",
          cardNameJa: data.cardNameJa,
          gradeEstimate: data.gradeEstimate,
          marketPriceHKD: data.marketPriceHKD,
          imageThumb: thumb || undefined,
          savedAt: Date.now(),
          result: data,
        };
        const newHistory = [entry, ...loadHistory(uid).filter(h => h.cardName !== entry.cardName)].slice(0, 20);
        saveHistory(newHistory, uid);
        setHistory(newHistory);
        // A2 — batch: record result + process next
        if (batchQueueRef.current.length > 0) {
          setBatchSummary(prev => [...prev, { name: data.cardName ?? "未知", value: data.marketPriceHKD ?? null }]);
          setBatchDone(d => d + 1);
          const nextFile = batchQueueRef.current.shift()!;
          processFile(nextFile);
          return; // keep isAnalyzing true
        } else if (batchTotal > 1) {
          setBatchSummary(prev => [...prev, { name: data.cardName ?? "未知", value: data.marketPriceHKD ?? null }]);
          setBatchDone(d => d + 1);
        }
      }
      setIsAnalyzing(false);
    },
    onError: (err) => {
      const msg = err.message || "分析失敗，請重試";
      // A2 — batch: skip failed, continue queue
      if (batchQueueRef.current.length > 0) {
        setBatchDone(d => d + 1);
        const nextFile = batchQueueRef.current.shift()!;
        processFile(nextFile);
        return;
      }
      setAnalysisError(msg);
      setIsAnalyzing(false);
    },
  });

  const processFile = useCallback((file: File) => {
    setResult(null);
    setSavedCardId(null);
    setAnalysisError(null);
    setIsAnalyzing(true);
    const objectUrl = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const MAX = 800;
      const { naturalWidth: ow, naturalHeight: oh } = img;
      const scale = Math.min(1, MAX / Math.max(ow, oh));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(ow * scale);
      canvas.height = Math.round(oh * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      // 同步生成 history 縮圖（150px），存 ref 供 onSuccess 直接用，避免 stale closure
      try {
        const ts = Math.min(150 / Math.max(canvas.width, canvas.height), 1);
        const tc = document.createElement("canvas");
        tc.width = Math.round(canvas.width * ts); tc.height = Math.round(canvas.height * ts);
        tc.getContext("2d")!.drawImage(canvas, 0, 0, tc.width, tc.height);
        historyThumbRef.current = tc.toDataURL("image/jpeg", 0.65);
      } catch { historyThumbRef.current = ""; }
      canvas.toBlob((blob) => {
        if (!blob) { setIsAnalyzing(false); setAnalysisError("圖片處理失敗，請重試"); return; }
        const reader = new FileReader();
        reader.onload = (e) => {
          const dataUrl = e.target?.result as string;
          setImagePreview(dataUrl);
          const b64 = dataUrl.split(",")[1];
          setPendingFileData({ base64: b64, mimeType: "image/jpeg" });
          analyzeMut.mutate({ imageBase64: b64, mimeType: "image/jpeg" });
        };
        reader.readAsDataURL(blob);
      }, "image/jpeg", 0.78);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        setImagePreview(dataUrl);
        const b64 = dataUrl.split(",")[1];
        setPendingFileData({ base64: b64, mimeType: file.type || "image/jpeg" });
        analyzeMut.mutate({ imageBase64: b64, mimeType: file.type || "image/jpeg" });
      };
      reader.readAsDataURL(file);
    };
    img.src = objectUrl;
  }, [analyzeMut]);
  processFileRef.current = processFile;
  userIdRef.current = user?.id;

  const handleFile = useCallback((file: File) => {
    processFile(file);
  }, [processFile]);

  const handleMultipleFiles = useCallback((files: File[]) => {
    if (files.length === 1) {
      setIsBatchMode(false);
      setBatchTotal(0);
      setBatchDone(0);
      setBatchSummary([]);
      batchQueueRef.current = [];
      processFile(files[0]);
      return;
    }
    setIsBatchMode(true);
    setBatchTotal(files.length);
    setBatchDone(0);
    setBatchSummary([]);
    batchQueueRef.current = files.slice(1);
    processFile(files[0]);
  }, [processFile]);

  const handleRetry = useCallback(() => {
    if (!pendingFileData) return;
    setAnalysisError(null);
    setIsAnalyzing(true);
    analyzeMut.mutate({ imageBase64: pendingFileData.base64, mimeType: pendingFileData.mimeType });
  }, [pendingFileData, analyzeMut]);

  // Convert HKD to selected currency
  const fmtCurrency = useCallback((hkd: number): string => {
    if (currency === "USD" && fxRates) return `USD $${(hkd * fxRates.USD).toFixed(0)}`;
    if (currency === "JPY" && fxRates) return `JPY ¥${Math.round(hkd * fxRates.JPY).toLocaleString()}`;
    return `HKD $${hkd.toLocaleString("en-HK")}`;
  }, [currency, fxRates]);

  const handleSaveCard = useCallback(() => {
    if (!result || !isAuthenticated) return;
    setSavingCard(true);
    // 按比例壓縮：最長邊上限 600px，JPEG 0.75
    const makeThumbnail = (src: string): Promise<string> => new Promise((resolve) => {
      if (!src) { resolve(""); return; }
      const img = new window.Image();
      img.onload = () => {
        const MAX_LONG_EDGE = 600;
        const scale = Math.min(MAX_LONG_EDGE / Math.max(img.width, img.height), 1);
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL("image/jpeg", 0.75));
      };
      img.onerror = () => resolve("");
      img.src = src;
    });
    makeThumbnail(imagePreview).then((thumb) => {
      saveCardMut.mutate({
        cardName: result.cardName ?? undefined,
        cardNameJa: result.cardNameJa ?? undefined,
        imageThumb: thumb || undefined,
        gradeEstimate: result.gradeEstimate ?? undefined,
        bgsEstimate: result.bgsEstimate ?? undefined,
        cgcEstimate: result.cgcEstimate ?? undefined,
        tagEstimate: result.tagEstimate ?? undefined,
        condition: result.condition,
        marketPriceHKD: result.marketPriceHKD ?? undefined,
        psa9HKD: result.psa9HKD ?? undefined,
        psa10HKD: result.psa10HKD ?? undefined,
        cardSet: result.set,
        rarity: result.rarity,
      });
    });
  }, [result, isAuthenticated, imagePreview, saveCardMut]);

  const handleShareImage = useCallback(async () => {
    if (!result || !shareCardRef.current) return;
    setShareGenerating(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(shareCardRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: null,
        logging: false,
      });
      setShareImgUrl(canvas.toDataURL("image/png"));
      setShareDialogOpen(true);
    } catch (e) {
      console.error("[ShareImage] html2canvas error:", e);
      toast.error("生成分享圖失敗，請重試", { className: "bb-toast-err" });
    } finally {
      setShareGenerating(false);
    }
  }, [result]);

  const rawPrice = parseInt(rawPriceInput, 10) || 0;
  const psa9 = result?.psa9HKD ?? 0;
  const psa10 = result?.psa10HKD ?? 0;
  const selectedFee = GRADING_FEES[gradingOrg]?.[gradingTier] ?? PSA_FEE_HKD;
  const profitPsa9 = psa9 - rawPrice - selectedFee;
  const profitPsa10 = psa10 - rawPrice - selectedFee;
  const rarityColor = result?.rarity ? (RARITY_COLOR[result.rarity] ?? "#9C27B0") : "#9C27B0";

  return (
    <div className="min-h-screen pb-20" style={{ background: "linear-gradient(160deg, #0d0d1f 0%, #1a0505 40%, #0d0d1f 100%)", color: "#fff" }}>
      <Header />

      {lightboxOpen && imagePreview && (
        <ImageLightbox src={imagePreview} onClose={() => setLightboxOpen(false)} />
      )}

      <div className="max-w-lg mx-auto px-4 pt-4">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-full flex-shrink-0" style={{ background: "linear-gradient(to bottom, #CC0000 50%, #f5f5f5 50%)", border: "2px solid #333" }} />
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-black tracking-tight leading-none" style={{ color: "#FFDE00", textShadow: "0 2px 8px rgba(255,222,0,0.4)" }}>
              PokeLover
            </h1>
            <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>AI 智能 Pokemon 卡片鑑定 · 市場估價</p>
          </div>
          {isAuthenticated && (
            <button onClick={() => navigate("/pokemon/collection")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold" style={{ background: "rgba(255,222,0,0.12)", border: "1px solid rgba(255,222,0,0.25)", color: "#FFDE00" }}>
              <BookOpen className="w-3.5 h-3.5" />
              卡冊
            </button>
          )}
        </div>

        {/* A1 — 最近分析記錄（橫向捲動） */}
        {history.length > 0 && !imagePreview && !isAnalyzing && (
          <div className="mb-4 mt-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold" style={{ color: "rgba(255,255,255,0.35)" }}>最近記錄</p>
              {!historySelectMode ? (
                <button onClick={() => { setHistorySelectMode(true); setSelectedHistoryIds(new Set()); }}
                  className="text-[10px] px-2 py-0.5 rounded-full" style={{ color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.15)" }}>
                  管理
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button onClick={() => setSelectedHistoryIds(new Set(history.map(h => h.id)))}
                    className="text-[10px]" style={{ color: "rgba(255,222,0,0.7)" }}>全選</button>
                  <button
                    onClick={() => {
                      const kept = history.filter(h => !selectedHistoryIds.has(h.id));
                      saveHistory(kept, user?.id);
                      setHistory(kept);
                      setHistorySelectMode(false);
                      setSelectedHistoryIds(new Set());
                    }}
                    className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                    style={{ background: selectedHistoryIds.size > 0 ? "rgba(244,67,54,0.2)" : "rgba(255,255,255,0.06)", color: selectedHistoryIds.size > 0 ? "#f44336" : "rgba(255,255,255,0.3)", border: `1px solid ${selectedHistoryIds.size > 0 ? "rgba(244,67,54,0.4)" : "rgba(255,255,255,0.1)"}` }}>
                    {selectedHistoryIds.size > 0 ? `刪除 (${selectedHistoryIds.size})` : "刪除"}
                  </button>
                  <button onClick={() => { setHistorySelectMode(false); setSelectedHistoryIds(new Set()); }}
                    className="text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>取消</button>
                </div>
              )}
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
              {history.slice(0, 10).map(item => {
                const isSelected = selectedHistoryIds.has(item.id);
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      if (historySelectMode) {
                        setSelectedHistoryIds(prev => {
                          const next = new Set(prev);
                          isSelected ? next.delete(item.id) : next.add(item.id);
                          return next;
                        });
                      } else {
                        setResult(item.result);
                        setImagePreview(item.imageThumb ?? "");
                        setRawPriceInput(item.marketPriceHKD ? String(item.marketPriceHKD) : "");
                        setSavedCardId(null);
                        setAnalysisError(null);
                      }
                    }}
                    className="flex-shrink-0 flex flex-col items-center gap-1.5 rounded-xl p-2 relative"
                    style={{ background: isSelected ? "rgba(244,67,54,0.15)" : "rgba(255,255,255,0.05)", border: `1px solid ${isSelected ? "rgba(244,67,54,0.5)" : "rgba(255,255,255,0.08)"}`, width: 80 }}
                  >
                    {historySelectMode && (
                      <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full flex items-center justify-center"
                        style={{ background: isSelected ? "#f44336" : "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)" }}>
                        {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                      </div>
                    )}
                    {item.imageThumb ? (
                      <img src={item.imageThumb} alt="" className="rounded-lg object-cover" style={{ width: 52, height: 72 }} />
                    ) : (
                      <div className="rounded-lg flex items-center justify-center" style={{ width: 52, height: 72, background: "rgba(255,222,0,0.08)" }}>
                        <span style={{ fontSize: 24 }}>🃏</span>
                      </div>
                    )}
                    <p className="text-[9px] text-center leading-tight font-semibold line-clamp-2" style={{ color: "rgba(255,255,255,0.7)", width: "100%" }}>{item.cardName}</p>
                    {item.gradeEstimate != null && (
                      <span className="text-[9px] font-black px-1.5 rounded" style={{ background: "rgba(156,39,176,0.2)", color: "#CE93D8" }}>PSA {item.gradeEstimate}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="rounded-2xl p-px mt-5 mb-6" style={{ background: "linear-gradient(135deg, #CC0000, #FFDE00, #CC0000)" }}>
          <div className="rounded-2xl p-6 flex flex-col items-center" style={{ background: "#13131f" }}>
            {isAnalyzing ? (
              <SpinningBall />
            ) : imagePreview && result ? (
              <div className="flex gap-4 items-start w-full">
                <button
                  type="button"
                  onClick={() => setLightboxOpen(true)}
                  className="flex-shrink-0 relative group"
                  title="點擊放大"
                >
                  <img
                    src={imagePreview}
                    alt="Card"
                    className="rounded-xl object-cover"
                    style={{ width: 90, height: 126, border: "2px solid rgba(255,222,0,0.3)" }}
                  />
                  <div
                    className="absolute inset-0 rounded-xl flex items-end justify-center pb-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ background: "rgba(0,0,0,0.4)" }}
                  >
                    <span className="text-[9px] text-white font-semibold">點擊放大</span>
                  </div>
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-xl font-black leading-tight" style={{ color: "#FFDE00" }}>{result.cardName ?? "未知卡片"}</p>
                  {result.cardNameJa && <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>{result.cardNameJa}</p>}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {(result.types ?? []).map(t => <TypeBadge key={t} type={t} />)}
                    {result.rarity && (
                      <span className="text-xs font-bold px-2.5 py-0.5 rounded-full" style={{ background: rarityColor + "33", color: rarityColor, border: `1px solid ${rarityColor}66` }}>
                        {result.rarity}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-2">
                    {result.hp && <span className="text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>HP <span className="font-bold text-white">{result.hp}</span></span>}
                    {result.set && <span className="text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>{result.set}{result.setNumber ? ` #${result.setNumber}` : ""}</span>}
                    {result.releaseYear && <span className="text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>{result.releaseYear}</span>}
                    {result.language && <span className="text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>{result.language}</span>}
                  </div>
                </div>
              </div>
            ) : imagePreview ? (
              <SpinningBall />
            ) : (
              <PokeBallUpload onFiles={handleMultipleFiles} disabled={isAnalyzing} />
            )}
          </div>
        </div>

        {imagePreview && !isAnalyzing && (
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => { setImagePreview(""); setResult(null); setRawPriceInput(""); setAnalysisError(null); setPendingFileData(null); setSavedCardId(null); setIsBatchMode(false); setBatchTotal(0); setBatchDone(0); setBatchSummary([]); batchQueueRef.current = []; }}
              className="text-xs px-3 py-1 rounded-full font-medium"
              style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.15)" }}>
              ↩ 重新上載
            </button>
            <button
              onClick={() => { setImagePreview(""); setResult(null); setRawPriceInput(""); setAnalysisError(null); setPendingFileData(null); setSavedCardId(null); setIsBatchMode(false); setBatchTotal(0); setBatchDone(0); setBatchSummary([]); batchQueueRef.current = []; navigate("/pokemon"); }}
              className="text-xs px-3 py-1 rounded-full font-medium"
              style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.15)" }}>
              回主頁
            </button>
          </div>
        )}

        {/* A2 — 批量分析進度 */}
        {isBatchMode && (isAnalyzing || batchDone > 0) && (
          <div className="rounded-xl p-3 mb-4" style={{ background: "rgba(255,222,0,0.08)", border: "1px solid rgba(255,222,0,0.2)" }}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold" style={{ color: "rgba(255,222,0,0.8)" }}>
                批量分析 {isAnalyzing ? `${Math.min(batchDone + 1, batchTotal)}/${batchTotal}` : `完成 ${batchDone}/${batchTotal}`}
              </p>
              {!isAnalyzing && (
                <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>
                  合計估值 HKD${batchSummary.reduce((s, r) => s + (r.value ?? 0), 0).toLocaleString("en-HK")}
                </span>
              )}
            </div>
            <div className="w-full rounded-full overflow-hidden" style={{ height: 4, background: "rgba(255,255,255,0.1)" }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${Math.round((batchDone / Math.max(batchTotal, 1)) * 100)}%`, background: "linear-gradient(90deg, #CC0000, #FFDE00)" }} />
            </div>
            {!isAnalyzing && batchSummary.length > 0 && (
              <div className="mt-2 flex flex-col gap-1">
                {batchSummary.map((r, i) => (
                  <div key={i} className="flex items-center justify-between text-[10px]">
                    <span className="truncate" style={{ color: "rgba(255,255,255,0.6)", maxWidth: "70%" }}>{r.name}</span>
                    <span style={{ color: r.value ? "#FFDE00" : "rgba(255,255,255,0.3)" }}>{r.value ? `HKD$${r.value.toLocaleString()}` : "N/A"}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* A3 — 分析失敗重試 */}
        {analysisError && !isAnalyzing && (
          <div className="rounded-xl p-4 mb-4 flex items-start gap-3" style={{ background: "rgba(244,67,54,0.1)", border: "1px solid rgba(244,67,54,0.3)" }}>
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#f44336" }} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold" style={{ color: "#f44336" }}>分析失敗</p>
              <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>{analysisError}</p>
            </div>
            {pendingFileData && (
              <button
                onClick={handleRetry}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold flex-shrink-0"
                style={{ background: "rgba(255,222,0,0.15)", border: "1px solid rgba(255,222,0,0.3)", color: "#FFDE00" }}
              >
                <RefreshCcw className="w-3 h-3" />
                重試
              </button>
            )}
          </div>
        )}

        {isAnalyzing && (
          <div className="mt-4 flex flex-col gap-4">
            {/* 步驟進度 */}
            <div className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
              {[
                { icon: "📷", label: "分析卡片圖像" },
                { icon: "🔍", label: "識別名稱 / 系列 / 稀有度" },
                { icon: "💰", label: "查詢市場參考價格" },
              ].map((s, i) => {
                const done = i < loadingStep;
                const active = i === loadingStep;
                return (
                  <div key={i} className="flex items-center gap-3 py-2">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-sm"
                      style={{
                        background: done ? "rgba(76,175,80,0.2)" : active ? "rgba(255,222,0,0.15)" : "rgba(255,255,255,0.05)",
                        border: done ? "1px solid #4CAF50" : active ? "1px solid rgba(255,222,0,0.5)" : "1px solid rgba(255,255,255,0.1)",
                      }}
                    >
                      {done ? "✓" : active ? <Loader2 className="w-3 h-3 animate-spin" style={{ color: "#FFDE00" }} /> : <span style={{ color: "rgba(255,255,255,0.2)" }}>·</span>}
                    </div>
                    <span className="text-sm" style={{ color: done ? "#4CAF50" : active ? "#FFDE00" : "rgba(255,255,255,0.25)" }}>
                      {s.icon} {s.label}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* 四大評級機構對照 */}
            <div className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="flex items-center gap-2 mb-3">
                <Star className="w-3.5 h-3.5" style={{ color: "#FFDE00" }} />
                <p className="text-xs font-bold" style={{ color: "rgba(255,222,0,0.7)" }}>四大評級機構對照</p>
              </div>
              {/* 機構標題 */}
              <div className="grid grid-cols-5 gap-1 mb-2">
                {[
                  { name: "PSA",  color: "#9C27B0", note: "最普及" },
                  { name: "BGS",  color: "#2196F3", note: "最嚴格" },
                  { name: "CGC",  color: "#4CAF50", note: "新興" },
                  { name: "TAG",  color: "#FF9800", note: "新興" },
                ].map(({ name, color, note }) => (
                  <div key={name} className="col-span-1 flex flex-col items-center">
                    <span className="text-[10px] font-black" style={{ color }}>{name}</span>
                    <span className="text-[8px]" style={{ color: "rgba(255,255,255,0.3)" }}>{note}</span>
                  </div>
                ))}
                <div className="col-span-1" />
              </div>
              {/* 對照行 */}
              {[
                { psa: 10, bgs: "9.5", cgc: 10,   tag: 10, label: "完美無瑕", color: "#9C27B0" },
                { psa: 9,  bgs: "9",   cgc: "9.5", tag: 9,  label: "接近完美", color: "#2196F3" },
                { psa: 8,  bgs: "8.5", cgc: 9,     tag: 8,  label: "輕微瑕疵", color: "#4CAF50" },
                { psa: 7,  bgs: "8",   cgc: "8.5", tag: 7,  label: "輕微磨損", color: "#8BC34A" },
                { psa: 6,  bgs: "7.5", cgc: 8,     tag: 6,  label: "明顯磨損", color: "#FFC107" },
                { psa: 5,  bgs: "7",   cgc: "7.5", tag: 5,  label: "中度磨損", color: "#FF9800" },
              ].map((row) => (
                <div key={row.psa} className="grid grid-cols-5 gap-1 mb-1.5 items-center">
                  {[row.psa, row.bgs, row.cgc, row.tag].map((v, i) => (
                    <div key={i} className="flex items-center justify-center rounded py-1" style={{ background: `${row.color}18`, border: `1px solid ${row.color}33` }}>
                      <span className="text-[11px] font-black" style={{ color: row.color }}>{v}</span>
                    </div>
                  ))}
                  <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>{row.label}</span>
                </div>
              ))}
              <p className="text-[9px] mt-3" style={{ color: "rgba(255,255,255,0.2)" }}>* BGS 最嚴格，同張卡評分通常比 PSA 低 0.5–1 級　* 以上僅作參考，實際評分以各機構為準</p>
            </div>
          </div>
        )}

        {result && !result.isNotPokemon && (
          <>
            {result.attacks && result.attacks.length > 0 && (
              <div className="rounded-xl p-4 mb-4" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <p className="text-xs font-bold mb-3" style={{ color: "rgba(255,255,255,0.5)" }}>技能</p>
                <div className="flex flex-col gap-2">
                  {result.attacks.map((atk, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex gap-0.5">
                          {(atk.cost ?? []).slice(0, 4).map((c, ci) => (
                            <div key={ci} style={{ width: 12, height: 12, borderRadius: "50%", background: TYPE_COLORS[c]?.bg ?? "#888", border: "1px solid rgba(0,0,0,0.3)" }} />
                          ))}
                        </div>
                        <span className="text-sm font-semibold text-white">{atk.name}</span>
                      </div>
                      {atk.damage && <span className="text-sm font-black" style={{ color: "#FFDE00" }}>{atk.damage}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-xl p-4 mb-4" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <p className="text-xs font-bold mb-3" style={{ color: "rgba(255,255,255,0.5)" }}>品相評估</p>
              <p className="text-base font-black text-white">{result.condition ?? "—"}</p>
              {result.conditionNote && <p className="text-xs mt-0.5 mb-3" style={{ color: "rgba(255,255,255,0.5)" }}>{result.conditionNote}</p>}
              {(result.gradeEstimate != null || result.bgsEstimate != null || result.cgcEstimate != null || result.tagEstimate != null) && (
                <div className="mt-3">
                  <p className="text-[10px] font-bold mb-2" style={{ color: "rgba(255,255,255,0.35)" }}>估計評級</p>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { label: "PSA",  value: result.gradeEstimate, max: 10, color: "#9C27B0" },
                      { label: "BGS",  value: result.bgsEstimate,   max: 10, color: "#2196F3" },
                      { label: "CGC",  value: result.cgcEstimate,   max: 10, color: "#4CAF50" },
                      { label: "TAG",  value: result.tagEstimate,   max: 10, color: "#FF9800" },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="flex flex-col items-center rounded-lg py-2" style={{ background: value != null ? `${color}18` : "rgba(255,255,255,0.03)", border: `1px solid ${value != null ? color + "44" : "rgba(255,255,255,0.06)"}` }}>
                        <span className="text-[9px] font-bold mb-1" style={{ color: value != null ? color : "rgba(255,255,255,0.25)" }}>{label}</span>
                        <span className="text-base font-black leading-none" style={{ color: value != null ? color : "rgba(255,255,255,0.2)" }}>
                          {value != null ? value : "—"}
                        </span>
                        {value != null && <span className="text-[9px] mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>/10</span>}
                      </div>
                    ))}
                  </div>
                  {result.gradeEstimate != null && <GradeBar grade={result.gradeEstimate} />}
                </div>
              )}
            </div>

            {/* B2 — 真偽警告 */}
            {result.authenticityWarning && (
              <div className="rounded-xl p-4 mb-4 flex items-start gap-3" style={{ background: "rgba(244,67,54,0.08)", border: "1px solid rgba(244,67,54,0.35)" }}>
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#FF7043" }} />
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-xs font-bold" style={{ color: "#FF7043" }}>真偽提示</p>
                    {result.authenticityScore != null && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{
                        background: result.authenticityScore >= 80 ? "rgba(76,175,80,0.2)" : result.authenticityScore >= 60 ? "rgba(255,152,0,0.2)" : "rgba(244,67,54,0.2)",
                        color: result.authenticityScore >= 80 ? "#4CAF50" : result.authenticityScore >= 60 ? "#FF9800" : "#f44336",
                      }}>
                        正版可信度 {result.authenticityScore}%
                      </span>
                    )}
                  </div>
                  <p className="text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>{result.authenticityWarning}</p>
                  <p className="text-[10px] mt-1.5" style={{ color: "rgba(255,255,255,0.3)" }}>* AI 判斷僅供參考，建議向專業機構送評確認</p>
                </div>
              </div>
            )}

            <div className="rounded-xl p-4 mb-4" style={{ background: "rgba(255,222,0,0.07)", border: "1px solid rgba(255,222,0,0.2)" }}>
              <p className="text-xs font-bold mb-3" style={{ color: "rgba(255,222,0,0.7)" }}>參考市場價格</p>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "裸卡 NM", value: result.marketPriceHKD },
                  { label: "PSA 9", value: result.psa9HKD },
                  { label: "PSA 10", value: result.psa10HKD },
                ].map(({ label, value }) => (
                  <div key={label} className="text-center">
                    <p className="text-[10px] mb-1" style={{ color: "rgba(255,255,255,0.5)" }}>{label}</p>
                    <p className="text-sm font-black" style={{ color: value ? "#FFDE00" : "rgba(255,255,255,0.3)" }}>
                      {value ? `$${value.toLocaleString("en-HK")}` : "N/A"}
                    </p>
                  </div>
                ))}
              </div>
              <p className="text-[10px] mt-2 text-center" style={{ color: "rgba(255,255,255,0.3)" }}>* AI 估算僅供參考，實際成交價以市場為準</p>
            </div>

            {(psa9 > 0 || psa10 > 0) && (
              <div className="rounded-xl p-4 mb-4" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="w-4 h-4" style={{ color: "#FFDE00" }} />
                  <p className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.7)" }}>送評計算器</p>
                </div>

                {/* B1 — 評級機構選擇 */}
                <div className="mb-3">
                  <p className="text-[10px] mb-1.5" style={{ color: "rgba(255,255,255,0.4)" }}>評級機構</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {(["PSA", "BGS", "CGC", "TAG"] as GradingOrg[]).map(org => (
                      <button key={org} onClick={() => setGradingOrg(org)}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all"
                        style={{
                          background: gradingOrg === org ? "rgba(255,222,0,0.2)" : "rgba(255,255,255,0.05)",
                          border: `1px solid ${gradingOrg === org ? "rgba(255,222,0,0.5)" : "rgba(255,255,255,0.1)"}`,
                          color: gradingOrg === org ? "#FFDE00" : "rgba(255,255,255,0.4)",
                        }}>{org}</button>
                    ))}
                  </div>
                </div>

                {/* B1 — 服務 tier */}
                <div className="mb-3">
                  <p className="text-[10px] mb-1.5" style={{ color: "rgba(255,255,255,0.4)" }}>服務等級</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {Object.entries(GRADING_FEES[gradingOrg]).map(([tier, fee]) => (
                      <button key={tier} onClick={() => setGradingTier(tier)}
                        className="px-2.5 py-1 rounded-lg text-[11px] transition-all"
                        style={{
                          background: gradingTier === tier ? "rgba(255,222,0,0.15)" : "rgba(255,255,255,0.04)",
                          border: `1px solid ${gradingTier === tier ? "rgba(255,222,0,0.4)" : "rgba(255,255,255,0.08)"}`,
                          color: gradingTier === tier ? "#FFDE00" : "rgba(255,255,255,0.4)",
                        }}>{tier} <span style={{ color: "rgba(255,255,255,0.35)" }}>HKD${fee}</span></button>
                    ))}
                  </div>
                </div>

                {/* D2 — 幣種切換 */}
                <div className="mb-3">
                  <p className="text-[10px] mb-1.5" style={{ color: "rgba(255,255,255,0.4)" }}>顯示幣種</p>
                  <div className="flex gap-1.5">
                    {(["HKD", "USD", "JPY"] as const).map(cur => (
                      <button key={cur} onClick={() => setCurrency(cur)}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all"
                        style={{
                          background: currency === cur ? "rgba(100,180,255,0.2)" : "rgba(255,255,255,0.04)",
                          border: `1px solid ${currency === cur ? "rgba(100,180,255,0.5)" : "rgba(255,255,255,0.08)"}`,
                          color: currency === cur ? "#64B4FF" : "rgba(255,255,255,0.35)",
                        }}>{cur}</button>
                    ))}
                  </div>
                </div>

                <div className="mb-3">
                  <p className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.5)" }}>你的買入價 (HKD)</p>
                  <input
                    type="number"
                    value={rawPriceInput}
                    onChange={e => setRawPriceInput(e.target.value)}
                    placeholder="輸入買入價"
                    className="w-full px-3 py-2 text-sm outline-none text-white placeholder-gray-500"
                    style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "10px" }}
                  />
                </div>
                {rawPrice > 0 && (
                  <div className="flex flex-col gap-2">
                    {psa9 > 0 && (
                      <div className="flex items-center justify-between rounded-lg px-3 py-2" style={{ background: profitPsa9 > 0 ? "rgba(76,175,80,0.15)" : "rgba(244,67,54,0.15)" }}>
                        <div>
                          <p className="text-xs font-bold text-white">{gradingOrg} 9 得標</p>
                          <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.5)" }}>{fmtCurrency(psa9)} − {fmtCurrency(rawPrice)} − 送評 {fmtCurrency(selectedFee)}</p>
                        </div>
                        <p className="text-sm font-black" style={{ color: profitPsa9 > 0 ? "#4CAF50" : "#f44336" }}>
                          {profitPsa9 > 0 ? "+" : ""}{fmtCurrency(profitPsa9)}
                        </p>
                      </div>
                    )}
                    {psa10 > 0 && (
                      <div className="flex items-center justify-between rounded-lg px-3 py-2" style={{ background: profitPsa10 > 0 ? "rgba(76,175,80,0.15)" : "rgba(244,67,54,0.15)" }}>
                        <div>
                          <p className="text-xs font-bold text-white">{gradingOrg} 10 得標</p>
                          <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.5)" }}>{fmtCurrency(psa10)} − {fmtCurrency(rawPrice)} − 送評 {fmtCurrency(selectedFee)}</p>
                        </div>
                        <p className="text-sm font-black" style={{ color: profitPsa10 > 0 ? "#4CAF50" : "#f44336" }}>
                          {profitPsa10 > 0 ? "+" : ""}{fmtCurrency(profitPsa10)}
                        </p>
                      </div>
                    )}
                    {(() => {
                      const effectiveWorth = rawPrice > 0 ? (profitPsa9 > 0 || profitPsa10 > 0) : result.worthGrading;
                      if (effectiveWorth === undefined || effectiveWorth === null) return null;
                      return (
                        <p className="text-xs text-center mt-1 font-semibold" style={{ color: effectiveWorth ? "#4CAF50" : "#FF9800" }}>
                          {effectiveWorth ? `AI 建議：值得送 ${gradingOrg} 評級` : "AI 建議：裸卡持有較划算"}
                        </p>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}

            {result.funFact && (
              <div className="rounded-xl p-4 mb-4" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>💡 冷知識</p>
                <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.75)" }}>{result.funFact}</p>
              </div>
            )}

            <div className="flex gap-2 mb-3 flex-wrap">
              <PokeShareMenu result={result} />
              <button
                onClick={() => toast.info("本站搜尋功能開發中，敬請期待", { className: "bb-toast-info" })}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm"
                style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.35)", border: "1px solid rgba(255,255,255,0.1)", cursor: "not-allowed" }}
              >
                <Search className="w-4 h-4" />
                本站搜尋
              </button>
              {result.ebaySearchQuery && (
                <a
                  href={`https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(result.ebaySearchQuery)}&LH_Complete=1&LH_Sold=1`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm"
                  style={{ background: "linear-gradient(135deg, #E53238, #F5AF02)", color: "#fff" }}
                >
                  <Search className="w-4 h-4" />
                  eBay 成交
                  <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                </a>
              )}
            </div>

            {/* C1+C2 — 圖卡分享 + 存入卡冊 */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={handleShareImage}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm"
                style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.7)" }}
              >
                {shareGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Images className="w-4 h-4" />}
                {shareGenerating ? "生成中..." : "圖卡分享"}
              </button>
              {isAuthenticated ? (
                <button
                  onClick={handleSaveCard}
                  disabled={savingCard || savedCardId !== null}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm"
                  style={{
                    background: savedCardId !== null ? "rgba(76,175,80,0.15)" : "rgba(255,222,0,0.12)",
                    border: `1px solid ${savedCardId !== null ? "rgba(76,175,80,0.4)" : "rgba(255,222,0,0.3)"}`,
                    color: savedCardId !== null ? "#4CAF50" : "#FFDE00",
                    opacity: savingCard ? 0.6 : 1,
                  }}
                >
                  {savedCardId !== null ? <Bookmark className="w-4 h-4" fill="currentColor" /> : <BookmarkPlus className="w-4 h-4" />}
                  {savedCardId !== null ? "已入卡冊" : savingCard ? "儲存中..." : "存入卡冊"}
                </button>
              ) : (
                <button
                  onClick={() => navigate("/login")}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.4)" }}
                >
                  <BookmarkPlus className="w-4 h-4" />
                  登入存卡冊
                </button>
              )}
            </div>

            {result.ebaySearchQuery && (
              <div className="rounded-xl p-3 mb-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <p className="text-[10px] font-bold mb-2" style={{ color: "rgba(255,255,255,0.35)" }}>更多市場參考</p>
                <div className="grid grid-cols-3 gap-2">
                  <a
                    href={`https://auctions.yahoo.co.jp/search/search?p=${encodeURIComponent(result.cardNameJa ?? result.ebaySearchQuery)}&va=${encodeURIComponent(result.cardNameJa ?? result.ebaySearchQuery)}&exflg=1&b=1&n=50&s1=cbids&o1=d&aucminprice=1`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-col items-center gap-1 py-2 px-1 rounded-lg text-center"
                    style={{ background: "rgba(255,50,50,0.1)", border: "1px solid rgba(255,50,50,0.2)" }}
                  >
                    <span className="text-base">🇯🇵</span>
                    <span className="text-[10px] font-bold leading-tight" style={{ color: "#FF4444" }}>ヤフオク!</span>
                    <span className="text-[9px]" style={{ color: "rgba(255,255,255,0.4)" }}>日本成交</span>
                  </a>
                  <a
                    href={`https://jp.mercari.com/search?keyword=${encodeURIComponent(result.cardNameJa ?? result.ebaySearchQuery)}&status=sold_out`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-col items-center gap-1 py-2 px-1 rounded-lg text-center"
                    style={{ background: "rgba(255,0,86,0.1)", border: "1px solid rgba(255,0,86,0.2)" }}
                  >
                    <span className="text-base">🛍️</span>
                    <span className="text-[10px] font-bold leading-tight" style={{ color: "#FF0056" }}>Mercari JP</span>
                    <span className="text-[9px]" style={{ color: "rgba(255,255,255,0.4)" }}>日本二手</span>
                  </a>
                  <a
                    href={`https://www.pricecharting.com/search-products?q=${encodeURIComponent(result.ebaySearchQuery)}&type=pokemon`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-col items-center gap-1 py-2 px-1 rounded-lg text-center"
                    style={{ background: "rgba(100,180,255,0.1)", border: "1px solid rgba(100,180,255,0.2)" }}
                  >
                    <span className="text-base">📊</span>
                    <span className="text-[10px] font-bold leading-tight" style={{ color: "#64B4FF" }}>PriceCharting</span>
                    <span className="text-[9px]" style={{ color: "rgba(255,255,255,0.4)" }}>國際走勢</span>
                  </a>
                </div>
              </div>
            )}
          </>
        )}

        {!imagePreview && !analysisError && (
          <div className="rounded-xl p-4 mt-2" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <p className="text-xs font-bold mb-2" style={{ color: "rgba(255,222,0,0.6)" }}>PokeLover 可以做到</p>
            {[
              "識別卡片名稱、系列、卡號、稀有度",
              "參考市場估價（裸卡 / PSA 9 / PSA 10）",
              "AI 品相評估及 PSA / BGS / CGC / TAG 預測等級",
              "AI 真偽初步鑑別（正版可信度評分）",
              "送評計算器（PSA/BGS/CGC/TAG × Regular/Express）",
              "HKD / USD / JPY 三幣種即時換算",
              "eBay / ヤフオク! / Mercari / PriceCharting 市場直連",
              "分析結果圖卡一鍵下載分享",
              "我的卡冊：儲存 + 管理分析記錄",
              "多張批量分析（同時上傳多圖）",
            ].map((t, i) => (
              <div key={i} className="flex items-start gap-2 mb-1.5">
                <span style={{ color: "#CC0000", flexShrink: 0 }}>●</span>
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>{t}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Share image dialog */}
      {shareDialogOpen && shareImgUrl && (
        <ShareImageDialog
          imgUrl={shareImgUrl}
          cardName={result?.cardName ?? "pokemon"}
          onClose={() => setShareDialogOpen(false)}
        />
      )}

      {/* Off-screen share card — html2canvas will capture this */}
      {result && !result.isNotPokemon && (
        <div
          ref={shareCardRef}
          style={{
            position: "fixed",
            top: 0,
            left: "-9999px",
            width: 390,
            padding: 16,
            background: "linear-gradient(180deg, #0d0d1f 0%, #1a0505 40%, #0d0d1f 100%)",
          }}
        >
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <div style={{ width: 34, height: 34, borderRadius: "50%", background: "linear-gradient(to bottom, #CC0000 50%, #f5f5f5 50%)", border: "2px solid #333", flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 20, fontWeight: 900, color: "#FFDE00", lineHeight: 1 }}>PokeLover</div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>AI 智能 Pokemon 卡片鑑定 · 市場估價</div>
            </div>
          </div>

          {/* Card info box */}
          <div style={{ borderRadius: 16, padding: 1, background: "linear-gradient(135deg, #CC0000, #FFDE00, #CC0000)", marginBottom: 14 }}>
            <div style={{ borderRadius: 14, padding: 18, background: "#13131f", display: "flex", gap: 14, alignItems: "flex-start" }}>
              {imagePreview && (
                <img src={imagePreview} alt="" style={{ width: 88, height: 124, borderRadius: 10, objectFit: "cover", border: "2px solid rgba(255,222,0,0.3)", flexShrink: 0 }} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 19, fontWeight: 900, color: "#FFDE00", lineHeight: 1.2, wordBreak: "break-word" }}>{result.cardName ?? "未知卡片"}</div>
                {result.cardNameJa && <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginTop: 3 }}>{result.cardNameJa}</div>}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 8 }}>
                  {(result.types ?? []).map(t => {
                    const tc = TYPE_COLORS[t] ?? TYPE_COLORS.default;
                    return <span key={t} style={{ background: tc.bg, color: tc.text, fontWeight: 700, fontSize: 10, padding: "2px 8px", borderRadius: 999 }}>{t}</span>;
                  })}
                  {result.rarity && (
                    <span style={{ background: rarityColor + "33", color: rarityColor, border: `1px solid ${rarityColor}66`, fontWeight: 700, fontSize: 10, padding: "2px 8px", borderRadius: 999 }}>{result.rarity}</span>
                  )}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 10px", marginTop: 7 }}>
                  {result.hp && <span style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>HP <b style={{ color: "#fff" }}>{result.hp}</b></span>}
                  {result.set && <span style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>{result.set}{result.setNumber ? ` #${result.setNumber}` : ""}</span>}
                  {result.releaseYear && <span style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>{result.releaseYear}</span>}
                  {result.language && <span style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>{result.language}</span>}
                </div>
              </div>
            </div>
          </div>

          {/* Authenticity warning */}
          {result.authenticityWarning && (
            <div style={{ borderRadius: 12, padding: 14, marginBottom: 12, background: "rgba(244,67,54,0.08)", border: "1px solid rgba(244,67,54,0.35)", display: "flex", gap: 10, alignItems: "flex-start" }}>
              <span style={{ fontSize: 15, flexShrink: 0 }}>⚠️</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#FF7043" }}>真偽存疑</div>
                {result.authenticityScore != null && (
                  <div style={{ fontSize: 11, fontWeight: 700, marginTop: 2, color: result.authenticityScore >= 80 ? "#4CAF50" : result.authenticityScore >= 60 ? "#FF9800" : "#f44336" }}>
                    正版可信度 {result.authenticityScore}%
                  </div>
                )}
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", marginTop: 4 }}>{result.authenticityWarning}</div>
              </div>
            </div>
          )}

          {/* Condition + grades */}
          <div style={{ borderRadius: 12, padding: 14, marginBottom: 12, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.5)", marginBottom: 7 }}>品相評估</div>
            <div style={{ fontSize: 15, fontWeight: 900, color: "#fff" }}>{result.condition ?? "—"}</div>
            {result.conditionNote && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 3 }}>{result.conditionNote}</div>}
            {(result.gradeEstimate != null || result.bgsEstimate != null || result.cgcEstimate != null || result.tagEstimate != null) && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.35)", marginBottom: 7 }}>估計評級</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
                  {([
                    { label: "PSA", value: result.gradeEstimate, color: "#9C27B0" },
                    { label: "BGS", value: result.bgsEstimate, color: "#2196F3" },
                    { label: "CGC", value: result.cgcEstimate, color: "#4CAF50" },
                    { label: "TAG", value: result.tagEstimate, color: "#FF9800" },
                  ] as { label: string; value: number | null | undefined; color: string }[]).map(({ label, value, color }) => (
                    <div key={label} style={{ display: "flex", flexDirection: "column", alignItems: "center", borderRadius: 8, padding: "8px 0", background: value != null ? `${color}18` : "rgba(255,255,255,0.03)", border: `1px solid ${value != null ? color + "44" : "rgba(255,255,255,0.06)"}` }}>
                      <span style={{ fontSize: 9, fontWeight: 700, color: value != null ? color : "rgba(255,255,255,0.25)" }}>{label}</span>
                      <span style={{ fontSize: 17, fontWeight: 900, color: value != null ? color : "rgba(255,255,255,0.2)", lineHeight: 1.1 }}>{value != null ? value : "—"}</span>
                      {value != null && <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)" }}>/10</span>}
                    </div>
                  ))}
                </div>
                {result.gradeEstimate != null && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                    <div style={{ display: "flex", gap: 3 }}>
                      {[1,2,3,4,5,6,7,8,9,10].map(i => {
                        const cs = ["","#f44336","#f44336","#FF9800","#FF9800","#FFC107","#FFC107","#8BC34A","#4CAF50","#2196F3","#9C27B0"];
                        return <div key={i} style={{ width: 14, height: 14, borderRadius: 3, background: i <= result.gradeEstimate! ? cs[i] : "rgba(255,255,255,0.1)" }} />;
                      })}
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 900, color: ["","#f44336","#f44336","#FF9800","#FF9800","#FFC107","#FFC107","#8BC34A","#4CAF50","#2196F3","#9C27B0"][result.gradeEstimate] ?? "#fff" }}>{result.gradeEstimate}/10</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Market prices */}
          <div style={{ borderRadius: 12, padding: 14, marginBottom: 12, background: "rgba(255,222,0,0.07)", border: "1px solid rgba(255,222,0,0.2)" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,222,0,0.7)", marginBottom: 10 }}>參考市場價格</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              {([
                { label: "裸卡 NM", value: result.marketPriceHKD },
                { label: "PSA 9", value: result.psa9HKD },
                { label: "PSA 10", value: result.psa10HKD },
              ] as { label: string; value: number | null | undefined }[]).map(({ label, value }) => (
                <div key={label} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 14, fontWeight: 900, color: value ? "#FFDE00" : "rgba(255,255,255,0.3)" }}>
                    {value ? `$${value.toLocaleString("en-HK")}` : "N/A"}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 9, marginTop: 8, textAlign: "center", color: "rgba(255,255,255,0.25)" }}>* AI 估算僅供參考，實際成交價以市場為準</div>
          </div>

          {/* Attacks */}
          {result.attacks && result.attacks.length > 0 && (
            <div style={{ borderRadius: 12, padding: 14, marginBottom: 12, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.5)", marginBottom: 10 }}>技能</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {result.attacks.map((atk, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ display: "flex", gap: 2 }}>
                        {(atk.cost ?? []).slice(0, 4).map((c, ci) => (
                          <div key={ci} style={{ width: 12, height: 12, borderRadius: "50%", background: TYPE_COLORS[c]?.bg ?? "#888", border: "1px solid rgba(0,0,0,0.3)" }} />
                        ))}
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{atk.name}</span>
                    </div>
                    {atk.damage && <span style={{ fontSize: 13, fontWeight: 900, color: "#FFDE00" }}>{atk.damage}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Fun fact */}
          {result.funFact && (
            <div style={{ borderRadius: 12, padding: 14, marginBottom: 12, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>💡 冷知識</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", marginTop: 4 }}>{result.funFact}</div>
            </div>
          )}

          {/* Footer */}
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 10, marginTop: 4, textAlign: "center" }}>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>hongxcollections.com · PokeLover AI</div>
          </div>
        </div>
      )}
    </div>
  );
}
