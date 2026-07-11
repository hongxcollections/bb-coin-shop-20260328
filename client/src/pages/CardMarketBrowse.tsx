import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import Header from "@/components/Header";
import { ChevronLeft, Loader2, Search, X, Upload, ShoppingBag, Share2, Copy, Check, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { SHARE_ORIGIN } from "@/lib/shareUrl";

const BROWSE_GAMES = [
  { id: "pokemon",  label: "Pokémon 寶可夢" },
  { id: "yugioh",   label: "遊戲王 Yu-Gi-Oh!" },
  { id: "mtg",      label: "MTG 萬智牌" },
  { id: "digimon",  label: "數碼暴龍 Digimon" },
  { id: "lorcana",  label: "Disney Lorcana" },
] as const;

type BrowsableGame = typeof BROWSE_GAMES[number]["id"];

interface SetResult {
  setId: string; name: string; series?: string;
  releaseDate?: string; total?: number; logoUrl?: string | null; symbolUrl?: string | null;
}
interface CardResult {
  cardApiId: string; cardName: string; cardNameJa?: string;
  setName?: string; setNumber?: string; rarity?: string; officialImageUrl?: string;
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
  if (r.includes("ace spec")) return "ACE";
  if (r.includes("promo")) return "PR";
  if (r.includes("uncommon")) return "U";
  if (r.includes("common")) return "C";
  if (r.includes("rare")) return "R";
  if (rarity.length <= 4) return rarity.toUpperCase();
  return null;
}

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

const GAME_LABELS: Record<string, string> = {
  pokemon: "Pokémon 寶可夢",
  yugioh: "遊戲王 Yu-Gi-Oh!",
  mtg: "MTG 萬智牌",
  digimon: "數碼暴龍 Digimon",
  lorcana: "Disney Lorcana",
};

const MENU_WIDTH = 176;
const MENU_HEIGHT = 260;

/* ── Card share dropdown — 照足 ProductShareMenu ─────────── */
function CardShareDropdown({ card, game, shareUrl }: { card: CardResult; game: string; shareUrl: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const gameLabel = GAME_LABELS[game] ?? "";
  const shareParts = [gameLabel, card.cardName, card.rarity, card.setNumber, card.setName].filter(Boolean);
  const shareText = shareParts.join(" · ") + `\n${shareUrl}`;

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
        await navigator.share({ title: card.cardName, text: shareText.replace("\n" + shareUrl, "").trim(), url: shareUrl });
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
        className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-800 border border-amber-200 hover:border-amber-400 rounded px-2 py-1 transition-colors bg-amber-50 hover:bg-amber-100"
      >
        <Share2 className="w-3 h-3" />
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

/* ── Pinch-zoom lightbox ─────────────────────────────────── */
function CardLightbox({ card, game, onClose, onSell, onWTB }: {
  card: CardResult;
  game: string;
  onClose: () => void;
  onSell: (card: CardResult) => void;
  onWTB: (card: CardResult) => void;
}) {
  const scale = useRef(1);
  const lastDist = useRef<number | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // Build share URL with card info as query params for OG meta injection
  const cardShareParams = new URLSearchParams();
  if (card.cardName) cardShareParams.set("cardName", card.cardName);
  if (card.setName) cardShareParams.set("setName", card.setName);
  if (card.setNumber) cardShareParams.set("setNumber", card.setNumber);
  if (card.rarity) cardShareParams.set("rarity", card.rarity);
  if (game) cardShareParams.set("game", game);
  if (card.officialImageUrl) cardShareParams.set("img", card.officialImageUrl);
  const browseUrl = `${SHARE_ORIGIN}/cardzx/market/browse?${cardShareParams.toString()}`;

  const getDistance = (touches: React.TouchList) =>
    Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) lastDist.current = getDistance(e.touches);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && lastDist.current !== null && imgRef.current) {
      const dist = getDistance(e.touches);
      scale.current = Math.min(Math.max(scale.current * (dist / lastDist.current), 0.8), 4);
      imgRef.current.style.transform = `scale(${scale.current})`;
      lastDist.current = dist;
    }
  };

  const onTouchEnd = () => { lastDist.current = null; };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex flex-col" style={{ background: "rgba(0,0,0,0.93)" }}>
      {/* Close */}
      <div className="flex justify-end p-4 flex-shrink-0">
        <button onClick={onClose} className="p-2 rounded-full" style={{ background: "rgba(255,255,255,0.15)" }}>
          <X className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* Card image — pinch zoom */}
      <div
        className="flex-1 flex items-center justify-center overflow-hidden"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={onClose}
      >
        {card.officialImageUrl ? (
          <img
            ref={imgRef}
            src={card.officialImageUrl}
            alt={card.cardName}
            onClick={e => e.stopPropagation()}
            className="rounded-2xl"
            style={{ maxWidth: "88vw", maxHeight: "60vh", objectFit: "contain", transformOrigin: "center center", touchAction: "none", transition: "transform 0.05s linear" }}
          />
        ) : (
          <div className="rounded-2xl flex items-center justify-center" style={{ width: 200, height: 280, background: "#1f2937" }}>
            <span style={{ fontSize: 48 }}>🃏</span>
          </div>
        )}
      </div>

      {/* Card name + set */}
      <div className="px-4 py-2 text-center flex-shrink-0">
        <p className="text-white font-black text-base leading-tight">{card.cardName}</p>
        {(card.setName || card.setNumber) && (
          <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.5)" }}>
            {[card.setName, card.setNumber].filter(Boolean).join(" · ")}
          </p>
        )}
      </div>

      {/* Bottom actions */}
      <div className="flex-shrink-0 px-4 pb-8 pt-3 flex gap-2">
        <button
          onClick={() => { onClose(); onSell(card); }}
          className="flex-1 py-3 rounded-2xl font-black text-sm flex items-center justify-center gap-1.5"
          style={{ background: "linear-gradient(90deg,#FFDE00,#FFB800)", color: "#111827" }}
        >
          <Upload className="w-4 h-4" />
          上架出售
        </button>

        <button
          onClick={() => { onClose(); onWTB(card); }}
          className="flex-1 py-3 rounded-2xl font-black text-sm flex items-center justify-center gap-1.5"
          style={{ background: "rgba(249,115,22,0.15)", color: "#F97316", border: "1px solid rgba(249,115,22,0.3)" }}
        >
          <ShoppingBag className="w-4 h-4" />
          求購 WTB
        </button>

        <CardShareDropdown card={card} game={game} shareUrl={browseUrl} />
      </div>
    </div>,
    document.body
  );
}

/* ── Card thumb ─────────────────────────────────────────── */
function CardThumb({ card, onClick }: { card: CardResult; onClick: () => void }) {
  const rBadge = getRarityShort(card.rarity);
  return (
    <button
      onClick={onClick}
      className="flex flex-col rounded-xl overflow-hidden text-left transition-all"
      style={{ background: "#fff", border: "1px solid #e5e7eb", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
    >
      <div className="relative w-full" style={{ paddingBottom: "140%" }}>
        {card.officialImageUrl ? (
          <img src={card.officialImageUrl} alt={card.cardName} className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center" style={{ background: "#f8f9fa" }}>
            <span style={{ fontSize: 24 }}>🃏</span>
          </div>
        )}
        {rBadge && (
          <div className="absolute top-1 right-1">
            <span className="text-[8px] font-black px-1 py-px rounded" style={{ background: "rgba(0,0,0,0.75)", color: "#F97316" }}>{rBadge}</span>
          </div>
        )}
        {card.setNumber && (
          <div className="absolute bottom-1 left-1">
            <span className="text-[8px] px-1 py-px rounded" style={{ background: "rgba(0,0,0,0.55)", color: "rgba(255,255,255,0.85)" }}>{card.setNumber}</span>
          </div>
        )}
      </div>
      <div className="px-1.5 py-1.5">
        <p className="text-[10px] font-bold leading-tight line-clamp-2" style={{ color: "#111827" }}>{card.cardName}</p>
      </div>
    </button>
  );
}

/* ── Main page ───────────────────────────────────────────── */
export default function CardMarketBrowse() {
  const [, navigate] = useLocation();
  const [game, setGame] = useState<BrowsableGame | "">("");
  const [selectedSet, setSelectedSet] = useState<SetResult | null>(null);
  const [setCardPage, setSetCardPage] = useState(1);
  const [accCards, setAccCards] = useState<CardResult[]>([]);
  const prevSetRef = useRef<string | null>(null);
  const [lbCard, setLbCard] = useState<CardResult | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<CardResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [tab, setTab] = useState<"browse" | "search">("browse");
  const utils = trpc.useUtils();

  // Auto-open lightbox when landing via share URL (e.g. ?cardName=Luxio&game=pokemon&...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pCardName = params.get("cardName")?.trim() ?? "";
    const pGame = params.get("game")?.trim() as BrowsableGame | "" ?? "";
    if (!pCardName || !pGame) return;
    const validGames = BROWSE_GAMES.map(g => g.id) as readonly string[];
    if (!validGames.includes(pGame)) return;
    setGame(pGame as BrowsableGame);
    setLbCard({
      cardApiId: params.get("cardApiId") ?? `share-${pCardName}`,
      cardName: pCardName,
      setName: params.get("setName") ?? undefined,
      setNumber: params.get("setNumber") ?? undefined,
      rarity: params.get("rarity") ?? undefined,
      officialImageUrl: params.get("img") ?? undefined,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setsQuery = trpc.cardTrading.getSets.useQuery(
    { game: game as BrowsableGame },
    { enabled: !!game && tab === "browse" && !selectedSet, staleTime: 300000 }
  );

  const setCardsQuery = trpc.cardTrading.getSetCards.useQuery(
    { game: game as BrowsableGame, setId: selectedSet?.setId ?? "", page: setCardPage },
    { enabled: !!selectedSet && !!game, staleTime: 120000 }
  );

  useEffect(() => {
    if (!setCardsQuery.data || !selectedSet) return;
    const key = `${selectedSet.setId}-${setCardPage}`;
    if (prevSetRef.current === key) return;
    prevSetRef.current = key;
    const newCards = setCardsQuery.data.cards as CardResult[];
    if (setCardPage === 1) {
      setAccCards(newCards);
    } else {
      setAccCards(prev => {
        const ids = new Set(prev.map(c => c.cardApiId));
        return [...prev, ...newCards.filter(c => !ids.has(c.cardApiId))];
      });
    }
  }, [setCardsQuery.data, selectedSet, setCardPage]);

  function handleSelectGame(g: BrowsableGame) {
    setGame(g);
    setSelectedSet(null);
    setSetCardPage(1);
    setAccCards([]);
    prevSetRef.current = null;
    setSearchResults([]);
    setSearchQuery("");
    setTab("browse");
  }

  function handleSelectSet(s: SetResult) {
    setSelectedSet(s);
    setSetCardPage(1);
    setAccCards([]);
    prevSetRef.current = null;
  }

  function handleBackToSets() {
    setSelectedSet(null);
    setSetCardPage(1);
    setAccCards([]);
    prevSetRef.current = null;
  }

  async function handleSearch() {
    if (!searchQuery.trim() || !game) return;
    setIsSearching(true);
    try {
      const results = await utils.cardTrading.searchCards.fetch({ game: game as BrowsableGame, query: searchQuery.trim() });
      setSearchResults(results as CardResult[]);
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }

  function handleSell(card: CardResult) {
    const params = new URLSearchParams();
    if (card.cardName) params.set("cardName", card.cardName);
    if (card.setName) params.set("setName", card.setName);
    if (card.setNumber) params.set("setNumber", card.setNumber);
    if (game) params.set("game", game);
    navigate(`/cardzx/market/sell?${params.toString()}`);
  }

  function handleWTB(card: CardResult) {
    const params = new URLSearchParams();
    if (card.cardName) params.set("cardName", card.cardName);
    if (card.setName) params.set("setName", card.setName);
    if (card.setNumber) params.set("setNumber", card.setNumber);
    if (game) params.set("game", game);
    navigate(`/cardzx/market/wtb?${params.toString()}`);
  }

  return (
    <>
    <div className="min-h-screen pb-20" style={{ background: "#f8f9fa", color: "#111827" }}>
      <Header />
      <div
        style={{ background: "linear-gradient(135deg,#0ea5e9 0%,#38bdf8 60%,#7dd3fc 100%)", borderRadius: 8, marginTop: 3, marginLeft: 5, marginRight: 5 }}
        className="px-4 pt-3 pb-3 flex items-center justify-between"
      >
        <button className="flex items-baseline gap-0.5" onClick={() => navigate("/cardzx/market")}>
          <span className="text-xl font-black text-white" style={{ letterSpacing: "-0.5px" }}>Card</span>
          <span className="text-xl font-black" style={{ color: "#FFDE00", letterSpacing: "-0.5px" }}>Zx</span>
          <span className="text-sm font-bold text-white ml-2 opacity-70">圖鑑瀏覽</span>
        </button>
        <button
          onClick={() => navigate("/cardzx/market")}
          className="p-1.5 rounded-full"
          style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)" }}
        >
          <ChevronLeft className="w-4 h-4 text-white" />
        </button>
      </div>

      <div className="max-w-lg mx-auto px-[5px] pt-4">
        {/* Game chips */}
        <div className="flex flex-wrap gap-2 mb-4">
          {BROWSE_GAMES.map(g => (
            <button
              key={g.id}
              onClick={() => handleSelectGame(g.id)}
              className="flex-shrink-0 px-3.5 py-1.5 rounded-full text-sm font-bold transition-all"
              style={game === g.id
                ? { background: "linear-gradient(90deg,#FFDE00,#FFB800)", color: "#111827", border: "1px solid transparent" }
                : { background: "#fff", color: "#6b7280", border: "1px solid #e5e7eb" }}
            >
              {g.label}
            </button>
          ))}
        </div>

        {!game && (
          <div className="flex flex-col items-center py-16 gap-3">
            <span style={{ fontSize: 52 }}>🃏</span>
            <p className="text-sm font-bold" style={{ color: "#9ca3af" }}>選擇遊戲類別開始瀏覽</p>
          </div>
        )}

        {game && !selectedSet && (
          <>
            <div className="flex gap-1 mb-4 p-1 rounded-xl" style={{ background: "#fff", border: "1px solid #e5e7eb" }}>
              <button
                onClick={() => { setTab("browse"); setSearchResults([]); }}
                className="flex-1 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                style={tab === "browse" ? { background: "rgba(249,115,22,0.1)", color: "#F97316" } : { color: "#9ca3af" }}
              >
                按系列瀏覽
              </button>
              <button
                onClick={() => setTab("search")}
                className="flex-1 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                style={tab === "search" ? { background: "rgba(255,222,0,0.15)", color: "#111827" } : { color: "#9ca3af" }}
              >
                <Search className="w-3.5 h-3.5" />
                搜尋卡牌
              </button>
            </div>

            {tab === "browse" && (
              <>
                <p className="text-xs mb-3" style={{ color: "#9ca3af" }}>選擇系列，瀏覽高清卡牌圖鑑</p>
                {setsQuery.isLoading ? (
                  <div className="flex justify-center py-12"><Loader2 className="w-7 h-7 animate-spin" style={{ color: "#CC0000" }} /></div>
                ) : setsQuery.error ? (
                  <div className="text-center py-8 text-sm" style={{ color: "#9ca3af" }}>無法載入系列資料</div>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {(setsQuery.data as SetResult[] ?? []).map(s => (
                      <button
                        key={s.setId}
                        onClick={() => handleSelectSet(s)}
                        className="flex flex-col items-center p-2 rounded-xl text-center transition-all"
                        style={{ background: "#fff", border: "1px solid #e5e7eb", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
                      >
                        {s.logoUrl ? (
                          <img src={s.logoUrl} alt={s.name} className="object-contain mb-1.5" style={{ width: "100%", height: 36 }}
                            onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        ) : (
                          <div className="flex items-center justify-center mb-1.5 rounded-lg w-full" style={{ height: 36, background: "#f3f4f6" }}>
                            <span style={{ fontSize: 18 }}>🃏</span>
                          </div>
                        )}
                        <p className="text-[10px] font-bold leading-tight line-clamp-2 w-full" style={{ color: "#111827" }}>{s.name}</p>
                        {s.releaseDate && <span className="text-[9px] mt-0.5" style={{ color: "#d1d5db" }}>{s.releaseDate.substring(0, 7)}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}

            {tab === "search" && (
              <div>
                <div className="flex gap-2 mb-3">
                  <input
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleSearch()}
                    placeholder="輸入卡牌名稱搜尋..."
                    className="flex-1 px-3 py-2 text-sm"
                    style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", color: "#111827", outline: "none" }}
                  />
                  <button
                    onClick={handleSearch}
                    disabled={isSearching || !searchQuery.trim()}
                    className="px-3 py-2 rounded-xl font-bold text-sm flex items-center gap-1.5"
                    style={{ background: "rgba(249,115,22,0.1)", color: "#F97316", border: "1px solid rgba(249,115,22,0.25)" }}
                  >
                    {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  </button>
                </div>
                {searchResults.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {searchResults.map((r, i) => <CardThumb key={i} card={r} onClick={() => setLbCard(r)} />)}
                  </div>
                )}
                {searchResults.length === 0 && !isSearching && searchQuery && (
                  <div className="text-center py-8 text-xs" style={{ color: "#9ca3af" }}>找不到相關卡牌</div>
                )}
              </div>
            )}
          </>
        )}

        {game && selectedSet && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <button
                onClick={handleBackToSets}
                className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full"
                style={{ background: "#f3f4f6", color: "#6b7280", border: "1px solid #e5e7eb" }}
              >
                <ChevronLeft className="w-3 h-3" />
                返回
              </button>
              <p className="text-xs font-bold flex-1 min-w-0 line-clamp-1" style={{ color: "#CC0000" }}>{selectedSet.name}</p>
              {selectedSet.total && <span className="text-[10px] flex-shrink-0" style={{ color: "#9ca3af" }}>{selectedSet.total} 張</span>}
            </div>

            {setCardsQuery.isLoading && accCards.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <Loader2 className="w-7 h-7 animate-spin" style={{ color: "#CC0000" }} />
                <p className="text-xs" style={{ color: "#9ca3af" }}>載入卡牌圖鑑中...</p>
              </div>
            ) : (
              <div>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {accCards.map(card => <CardThumb key={card.cardApiId} card={card} onClick={() => setLbCard(card)} />)}
                </div>
                {(setCardsQuery.data as any)?.hasMore && (
                  <button
                    onClick={() => setSetCardPage(p => p + 1)}
                    disabled={setCardsQuery.isFetching}
                    className="w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2"
                    style={{ background: "rgba(249,115,22,0.1)", color: "#F97316", border: "1px solid rgba(249,115,22,0.25)" }}
                  >
                    {setCardsQuery.isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    載入更多卡牌
                  </button>
                )}
                {accCards.length === 0 && !setCardsQuery.isLoading && (
                  <div className="text-center py-8 text-xs" style={{ color: "#9ca3af" }}>此系列暫無卡牌資料</div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>

    {lbCard && (
      <CardLightbox
        card={lbCard}
        game={game}
        onClose={() => setLbCard(null)}
        onSell={handleSell}
        onWTB={handleWTB}
      />
    )}
    </>
  );
}
