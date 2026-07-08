import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation, useSearch } from "wouter";
import Header from "@/components/Header";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { Search, Plus, ShoppingBag, Eye, ChevronRight, Flame, Loader2, ClipboardList, X, LayoutGrid, LayoutList } from "lucide-react";

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
          <p className="text-base font-black" style={{ color: '#F97316', letterSpacing: '-0.3px' }}>HKD ${priceHKD.toLocaleString()}</p>
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
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>價格面議</p>
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
}

function WTBCard({ wtb, onContact, onImageClick }: { wtb: WTB; onContact?: () => void; onImageClick?: () => void }) {
  const gameStyle = GAME_BADGE_STYLE[wtb.game] ?? { background: "#f3f4f6", color: "#6b7280" };
  const gameLabel = GAMES.find(g => g.id === wtb.game)?.label ?? wtb.game;
  return (
    <div
      id={`wtb-${wtb.id}`}
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
      style={{ background: "#fff", border: "1px solid #f0f0f0", boxShadow: "0 1px 6px rgba(0,0,0,0.05)", borderLeft: "3px solid #F97316" }}
    >
      {wtb.officialImageUrl ? (
        <button type="button" onClick={onImageClick} className="flex-shrink-0 rounded-lg overflow-hidden" style={{ width: 36, height: 50, cursor: onImageClick ? 'pointer' : 'default' }}>
          <img src={wtb.officialImageUrl} alt="" className="w-full h-full object-cover" />
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
          {wtb.maxPriceHKD && <span className="text-[10px] font-bold" style={{ color: "#16a34a" }}>上限 ${wtb.maxPriceHKD.toLocaleString()}</span>}
          {wtb.minCondition && <span className="text-[10px]" style={{ color: "#9ca3af" }}>最低 {wtb.minCondition}</span>}
        </div>
      </div>
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        <span className="text-[10px]" style={{ color: "#9ca3af" }}>{wtb.buyerName ?? "用戶"}</span>
        {onContact && (
          <button
            onClick={onContact}
            className="text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{ background: "rgba(249,115,22,0.1)", color: "#F97316", border: "1px solid rgba(249,115,22,0.25)" }}
          >
            私訊
          </button>
        )}
      </div>
    </div>
  );
}

interface ListingDetailSheetProps {
  listing: Listing;
  onClose: () => void;
  onSelectListing?: (l: Listing) => void;
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
    if (!isAuthenticated) { navigate("/login"); return; }
    if (listing.userId === user?.id) { toast.info("不能聯絡自己"); return; }
    setContacting(true);
    try {
      const room = await openRoomMut.mutateAsync({ sellerId: listing.userId, listingId: listing.id });
      navigate(`/messages/${room.roomId}?from=${encodeURIComponent(window.location.pathname + window.location.search)}`);
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

        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
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
            <h3 className="text-xl font-black leading-tight" style={{ color: "#111827" }}>{listing.cardName}</h3>
            {listing.cardNameJa && <p className="text-sm mt-0.5" style={{ color: "#6b7280" }}>{listing.cardNameJa}</p>}
            {listing.setName && <p className="text-xs mt-1" style={{ color: "#9ca3af" }}>{listing.setName}{listing.setNumber ? ` #${listing.setNumber}` : ""}</p>}
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-2xl font-black" style={{ color: "#CC0000" }}>HKD ${listing.priceHKD.toLocaleString()}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-3">
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
          <p className="text-sm mb-3 leading-relaxed" style={{ color: "#374151" }}>{listing.description}</p>
        )}

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
  const contactWTBMut = trpc.cardTrading.openRoomWithWTBBuyer.useMutation();

  async function handleContactWTBBuyer(wtbId: number) {
    if (!isAuthenticated) { navigate("/login"); return; }
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
        @keyframes cardzzz-scan {
          0%   { transform: translateX(-160%); }
          100% { transform: translateX(160%); }
        }
        @keyframes cardzzz-flicker {
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

      {wtbLightbox && wtbLightbox.officialImageUrl && (
        <WTBImageLightbox
          imageUrl={wtbLightbox.officialImageUrl}
          cardName={wtbLightbox.cardName}
          maxPriceHKD={wtbLightbox.maxPriceHKD}
          onClose={() => setWtbLightbox(null)}
        />
      )}

      {/* ── CardZzz sub-header strip ── */}
      <div style={{ background: "linear-gradient(135deg,#0369a1 0%,#0284c7 60%,#0ea5e9 100%)", borderRadius: 8, marginTop: 3, marginLeft: 5, marginRight: 5 }} className="px-4 pt-3 pb-3 flex items-center justify-between">
        <div className="flex items-baseline gap-0.5">
          <span className="text-xl font-black text-white" style={{ letterSpacing: "-0.5px" }}>Card</span>
          <span className="text-xl font-black" style={{ color: "#FFDE00", letterSpacing: "-0.5px" }}>Zzz</span>
        </div>
        <div className="flex items-center gap-2">
          {isAuthenticated && (
            <button
              onClick={() => navigate("/cardzzz/market/my")}
              className="p-1.5 rounded-full"
              style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)" }}
            >
              <ClipboardList className="w-4 h-4" style={{ color: "rgba(255,255,255,0.55)" }} />
            </button>
          )}
          {isAuthenticated && (
            <button
              onClick={() => navigate("/cardzzz/market/sell")}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full font-black text-xs"
              style={{ background: "linear-gradient(90deg,#FFDE00,#FFB800)", color: "#111827" }}
            >
              <Plus className="w-3.5 h-3.5" />上架
            </button>
          )}
        </div>
      </div>

      {/* ── Hero card — dark, rounded ── */}
      <div className="mx-[5px] mt-[3px] mb-4 overflow-hidden relative" style={{ background: "linear-gradient(135deg,#0369a1 0%,#0284c7 60%,#0ea5e9 100%)", borderRadius: 12 }}>
        <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: "radial-gradient(ellipse at 80% 0%,rgba(255,255,255,0.12) 0%,transparent 55%)" }} />
        {/* scan shimmer overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "linear-gradient(105deg, transparent 35%, rgba(255,255,255,0.22) 50%, transparent 65%)",
            animation: "cardzzz-scan 2.8s ease-in-out infinite alternate, cardzzz-flicker 1.1s ease-in-out infinite",
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
              onClick={() => navigate("/cardzzz/market/sell")}
              className="text-sm font-black px-4 py-2 rounded-full"
              style={{ background: "rgba(255,255,255,0.12)", color: "#fff", border: "1px solid rgba(255,255,255,0.2)" }}
            >
              瀏覽全部系列
            </button>
            {isAuthenticated && (
              <button
                onClick={() => navigate("/cardzzz/market/my")}
                className="text-sm font-black px-4 py-2 rounded-full flex items-center gap-1.5"
                style={{ background: "rgba(255,255,255,0.12)", color: "#fff", border: "1px solid rgba(255,255,255,0.2)" }}
              >
                <ClipboardList className="w-3.5 h-3.5" />我的清單
              </button>
            )}
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
              {isAuthenticated && (
                <button onClick={() => navigate("/cardzzz/market/sell")}
                  className="text-sm px-4 py-2 rounded-full font-bold"
                  style={{ background: "rgba(255,222,0,0.15)", color: "#111827", border: "1px solid rgba(255,222,0,0.35)" }}>
                  立即上架
                </button>
              )}
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
                onClick={() => navigate("/cardzzz/market/wtb")}
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
                  onImageClick={w.officialImageUrl ? () => setWtbLightbox(w) : undefined}
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
            <button onClick={() => navigate("/cardzzz/market/wtb")}
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
            <p className="text-sm font-black text-white leading-snug">手邊有珍藏卡牌想要出售？</p>
            <p className="text-xs mt-1 mb-3" style={{ color: "rgba(255,255,255,0.5)" }}>
              不論是 Graded 評級卡、還是 RAW 裸卡，<br />在 CardZzz 均可快速上架，直面港台數萬名藏家
            </p>
            <button
              onClick={() => { if (isAuthenticated) navigate("/cardzzz/market/sell"); else navigate("/login"); }}
              className="px-5 py-2 rounded-full font-black text-xs"
              style={{ background: "linear-gradient(90deg,#FFDE00,#FFB800)", color: "#111827" }}
            >
              立即刊登商品
            </button>
          </div>
        </div>
      </div>

      {/* FAB */}
      {isAuthenticated && (
        <button
          onClick={() => navigate("/cardzzz/market/sell")}
          className="fixed z-40 rounded-full shadow-xl flex items-center gap-2 font-black text-sm"
          style={{ bottom: 76, right: 16, background: "linear-gradient(90deg,#FFDE00,#FFB800)", color: "#111827", padding: "12px 18px", boxShadow: "0 4px 20px rgba(255,184,0,0.5)" }}
        >
          <Plus className="w-4 h-4" />
          上架
        </button>
      )}
    </div>
  );
}
