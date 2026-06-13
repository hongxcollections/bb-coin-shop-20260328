import { useState, useRef, useCallback, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import Header from "@/components/Header";
import { toast } from "sonner";
import { Upload, Loader2, Search, ChevronLeft, Zap, ExternalLink, Share2, Copy, Check, X, MoreHorizontal } from "lucide-react";
import { SHARE_ORIGIN } from "@/lib/shareUrl";

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
  worthGrading?: boolean;
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

function PokeBallUpload({ onFile, disabled }: { onFile: (f: File) => void; disabled: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f && f.type.startsWith("image/")) onFile(f);
  }, [onFile]);

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
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
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
  const [imagePreview, setImagePreview] = useState<string>("");
  const [result, setResult] = useState<PokeResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [rawPriceInput, setRawPriceInput] = useState("");
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const analyzeMut = trpc.pokeLover.analyze.useMutation({
    onSuccess: (res) => {
      const data = res.data as PokeResult;
      if (data.isNotPokemon) {
        toast.error("呢張唔似係 Pokemon 卡，請重新上載", { className: "bb-toast-err" });
        setResult(null);
      } else {
        setResult(data);
        if (data.marketPriceHKD) setRawPriceInput(String(data.marketPriceHKD));
      }
      setIsAnalyzing(false);
    },
    onError: (err) => {
      toast.error(err.message || "分析失敗，請重試", { className: "bb-toast-err" });
      setIsAnalyzing(false);
    },
  });

  const handleFile = (file: File) => {
    setResult(null);
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
      canvas.toBlob((blob) => {
        if (!blob) { setIsAnalyzing(false); toast.error("圖片處理失敗，請重試", { className: "bb-toast-err" }); return; }
        const reader = new FileReader();
        reader.onload = (e) => {
          const dataUrl = e.target?.result as string;
          setImagePreview(dataUrl);
          analyzeMut.mutate({ imageBase64: dataUrl.split(",")[1], mimeType: "image/jpeg" });
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
        analyzeMut.mutate({ imageBase64: dataUrl.split(",")[1], mimeType: file.type || "image/jpeg" });
      };
      reader.readAsDataURL(file);
    };
    img.src = objectUrl;
  };

  const rawPrice = parseInt(rawPriceInput, 10) || 0;
  const psa9 = result?.psa9HKD ?? 0;
  const psa10 = result?.psa10HKD ?? 0;
  const profitPsa9 = psa9 - rawPrice - PSA_FEE_HKD;
  const profitPsa10 = psa10 - rawPrice - PSA_FEE_HKD;
  const rarityColor = result?.rarity ? (RARITY_COLOR[result.rarity] ?? "#9C27B0") : "#9C27B0";

  return (
    <div className="min-h-screen pb-20 home-bg" style={{ color: "#1c0a00" }}>
      <Header />

      {lightboxOpen && imagePreview && (
        <ImageLightbox src={imagePreview} onClose={() => setLightboxOpen(false)} />
      )}

      <div className="max-w-lg mx-auto px-4 pt-4">
        <button onClick={() => navigate("/")} className="flex items-center gap-1 text-xs mb-4" style={{ color: "rgba(28,10,0,0.45)" }}>
          <ChevronLeft className="w-4 h-4" /> 返回
        </button>

        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-full flex-shrink-0" style={{ background: "linear-gradient(to bottom, #CC0000 50%, #f5f5f5 50%)", border: "2px solid #333" }} />
          <div>
            <h1 className="text-2xl font-black tracking-tight leading-none" style={{ color: "#b45309", textShadow: "0 2px 8px rgba(180,83,9,0.25)" }}>
              PokeLover
            </h1>
            <p className="text-xs mt-0.5" style={{ color: "rgba(28,10,0,0.5)" }}>AI 智能 Pokemon 卡片鑑定 · 市場估價</p>
          </div>
        </div>

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
              <PokeBallUpload onFile={handleFile} disabled={isAnalyzing} />
            )}
          </div>
        </div>

        {imagePreview && !isAnalyzing && (
          <button onClick={() => { setImagePreview(""); setResult(null); setRawPriceInput(""); }} className="text-xs mb-4" style={{ color: "rgba(28,10,0,0.4)" }}>
            ↩ 重新上載
          </button>
        )}

        {result && !result.isNotPokemon && (
          <>
            {result.attacks && result.attacks.length > 0 && (
              <div className="rounded-xl p-4 mb-4" style={{ background: "rgba(255,255,255,0.65)", border: "1px solid rgba(180,83,9,0.15)" }}>
                <p className="text-xs font-bold mb-3" style={{ color: "rgba(28,10,0,0.5)" }}>技能</p>
                <div className="flex flex-col gap-2">
                  {result.attacks.map((atk, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex gap-0.5">
                          {(atk.cost ?? []).slice(0, 4).map((c, ci) => (
                            <div key={ci} style={{ width: 12, height: 12, borderRadius: "50%", background: TYPE_COLORS[c]?.bg ?? "#888", border: "1px solid rgba(0,0,0,0.3)" }} />
                          ))}
                        </div>
                        <span className="text-sm font-semibold" style={{ color: "#1c0a00" }}>{atk.name}</span>
                      </div>
                      {atk.damage && <span className="text-sm font-black" style={{ color: "#b45309" }}>{atk.damage}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-xl p-4 mb-4" style={{ background: "rgba(255,255,255,0.65)", border: "1px solid rgba(180,83,9,0.15)" }}>
              <p className="text-xs font-bold mb-3" style={{ color: "rgba(28,10,0,0.5)" }}>品相評估</p>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-base font-black" style={{ color: "#1c0a00" }}>{result.condition ?? "—"}</p>
                  {result.conditionNote && <p className="text-xs mt-0.5" style={{ color: "rgba(28,10,0,0.5)" }}>{result.conditionNote}</p>}
                </div>
                {result.gradeEstimate != null && (
                  <div className="flex flex-col items-end gap-1">
                    <p className="text-xs" style={{ color: "rgba(28,10,0,0.5)" }}>估計 PSA 等級</p>
                    <GradeBar grade={result.gradeEstimate} />
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-xl p-4 mb-4" style={{ background: "rgba(255,255,255,0.65)", border: "1px solid rgba(180,83,9,0.15)" }}>
              <p className="text-xs font-bold mb-3" style={{ color: "#b45309" }}>參考市場價格</p>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "裸卡 NM", value: result.marketPriceHKD },
                  { label: "PSA 9", value: result.psa9HKD },
                  { label: "PSA 10", value: result.psa10HKD },
                ].map(({ label, value }) => (
                  <div key={label} className="text-center">
                    <p className="text-[10px] mb-1" style={{ color: "rgba(28,10,0,0.5)" }}>{label}</p>
                    <p className="text-sm font-black" style={{ color: value ? "#b45309" : "rgba(28,10,0,0.3)" }}>
                      {value ? `$${value.toLocaleString("en-HK")}` : "N/A"}
                    </p>
                  </div>
                ))}
              </div>
              <p className="text-[10px] mt-2 text-center" style={{ color: "rgba(28,10,0,0.35)" }}>* AI 估算僅供參考，實際成交價以市場為準</p>
            </div>

            {(psa9 > 0 || psa10 > 0) && (
              <div className="rounded-xl p-4 mb-4" style={{ background: "rgba(255,255,255,0.65)", border: "1px solid rgba(180,83,9,0.15)" }}>
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="w-4 h-4" style={{ color: "#b45309" }} />
                  <p className="text-xs font-bold" style={{ color: "rgba(28,10,0,0.7)" }}>PSA 送評計算器</p>
                </div>
                <div className="mb-3">
                  <p className="text-xs mb-1" style={{ color: "rgba(28,10,0,0.5)" }}>你的買入價 (HKD)</p>
                  <input
                    type="number"
                    value={rawPriceInput}
                    onChange={e => setRawPriceInput(e.target.value)}
                    placeholder="輸入買入價"
                    className="w-full px-3 py-2 text-sm outline-none placeholder-amber-400"
                    style={{ background: "rgba(255,255,255,0.8)", border: "1px solid rgba(180,83,9,0.2)", borderRadius: "10px", color: "#1c0a00" }}
                  />
                </div>
                {rawPrice > 0 && (
                  <div className="flex flex-col gap-2">
                    {psa9 > 0 && (
                      <div className="flex items-center justify-between rounded-lg px-3 py-2" style={{ background: profitPsa9 > 0 ? "rgba(76,175,80,0.15)" : "rgba(244,67,54,0.15)" }}>
                        <div>
                          <p className="text-xs font-bold" style={{ color: "#1c0a00" }}>PSA 9 得標</p>
                          <p className="text-[10px]" style={{ color: "rgba(28,10,0,0.5)" }}>{fmtHKD(psa9)} − {fmtHKD(rawPrice)} − 送評費 ${PSA_FEE_HKD}</p>
                        </div>
                        <p className="text-sm font-black" style={{ color: profitPsa9 > 0 ? "#4CAF50" : "#f44336" }}>
                          {profitPsa9 > 0 ? "+" : ""}{fmtHKD(profitPsa9)}
                        </p>
                      </div>
                    )}
                    {psa10 > 0 && (
                      <div className="flex items-center justify-between rounded-lg px-3 py-2" style={{ background: profitPsa10 > 0 ? "rgba(76,175,80,0.15)" : "rgba(244,67,54,0.15)" }}>
                        <div>
                          <p className="text-xs font-bold" style={{ color: "#1c0a00" }}>PSA 10 得標</p>
                          <p className="text-[10px]" style={{ color: "rgba(28,10,0,0.5)" }}>{fmtHKD(psa10)} − {fmtHKD(rawPrice)} − 送評費 ${PSA_FEE_HKD}</p>
                        </div>
                        <p className="text-sm font-black" style={{ color: profitPsa10 > 0 ? "#4CAF50" : "#f44336" }}>
                          {profitPsa10 > 0 ? "+" : ""}{fmtHKD(profitPsa10)}
                        </p>
                      </div>
                    )}
                    {result.worthGrading !== undefined && (
                      <p className="text-xs text-center mt-1 font-semibold" style={{ color: result.worthGrading ? "#4CAF50" : "#FF9800" }}>
                        {result.worthGrading ? "AI 建議：值得送 PSA 評級" : "AI 建議：裸卡持有較划算"}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {result.funFact && (
              <div className="rounded-xl p-4 mb-4" style={{ background: "rgba(255,255,255,0.65)", border: "1px solid rgba(180,83,9,0.15)" }}>
                <p className="text-xs" style={{ color: "rgba(28,10,0,0.4)" }}>💡 冷知識</p>
                <p className="text-sm mt-1" style={{ color: "rgba(28,10,0,0.75)" }}>{result.funFact}</p>
              </div>
            )}

            <div className="flex gap-2 mb-4">
              <PokeShareMenu result={result} />
              {result.ebaySearchQuery && (
                <a
                  href={`https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(result.ebaySearchQuery)}&LH_Complete=1&LH_Sold=1`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm"
                  style={{ background: "linear-gradient(135deg, #E53238, #F5AF02)", color: "#fff" }}
                >
                  <Search className="w-4 h-4" />
                  eBay 成交紀錄
                  <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                </a>
              )}
            </div>
          </>
        )}

        {!imagePreview && (
          <div className="rounded-xl p-4 mt-2" style={{ background: "rgba(255,255,255,0.65)", border: "1px solid rgba(180,83,9,0.15)" }}>
            <p className="text-xs font-bold mb-2" style={{ color: "#b45309" }}>PokeLover 可以做到</p>
            {[
              "識別卡片名稱、系列、卡號、稀有度",
              "參考市場估價（裸卡 / PSA 9 / PSA 10）",
              "AI 品相評估及 PSA 等級預測",
              "PSA 送評回報計算器",
              "eBay 成交紀錄直連搜尋",
            ].map((t, i) => (
              <div key={i} className="flex items-start gap-2 mb-1.5">
                <span style={{ color: "#CC0000", flexShrink: 0 }}>●</span>
                <p className="text-xs" style={{ color: "rgba(28,10,0,0.6)" }}>{t}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
