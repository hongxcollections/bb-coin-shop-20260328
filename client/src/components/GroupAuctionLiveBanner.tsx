import React, { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { Clock, ExternalLink, LayoutGrid, LayoutList } from "lucide-react";

export interface LiveRound {
  id: number;
  title: string;
  periodNumber: string | null;
  endAt: string | null;
  coverImage: string | null;
  promoImages: string[];
  merchantUserId: number;
  merchantName: string | null;
  merchantAvatar: string | null;
  totalItems: number;
  biddedItems: number;
  uniqueBidders: number;
}

function Countdown({ endAt }: { endAt: string | null }) {
  const [txt, setTxt] = useState("");
  useEffect(() => {
    if (!endAt) { setTxt(""); return; }
    function update() {
      const diff = new Date(endAt!).getTime() - Date.now();
      if (diff <= 0) { setTxt("已結拍"); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      const pad = (n: number) => String(n).padStart(2, "0");
      if (h >= 24) {
        const d = Math.floor(h / 24);
        const rh = h % 24;
        setTxt(rh > 0 ? `${d}天 ${rh}h ${pad(m)}m ${pad(s)}s` : `${d}天 ${pad(m)}m ${pad(s)}s`);
      } else {
        setTxt(`${pad(h)}h ${pad(m)}m ${pad(s)}s`);
      }
    }
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [endAt]);
  return <>{txt}</>;
}

function ImageLightbox({
  images,
  initialIndex,
  onClose,
}: {
  images: string[];
  initialIndex: number;
  onClose: () => void;
}) {
  const [lbImgIdx, setLbImgIdx] = useState(initialIndex);
  const [lbZoom, setLbZoom] = useState(1);
  const [lbPanX, setLbPanX] = useState(0);
  const [lbPanY, setLbPanY] = useState(0);
  const [lbMode, setLbMode] = useState<'h' | 'v'>('v');
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
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // scroll H strip to initial index
  useEffect(() => {
    setTimeout(() => {
      if (lbScrollRef.current) lbScrollRef.current.scrollLeft = initialIndex * lbScrollRef.current.clientWidth;
    }, 20);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // native touchstart passive:false — vertical pinch
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
        pinchStartDist.current = Math.sqrt(dx*dx+dy*dy); pinchStartZoom.current = lbZoomRef.current;
      } else if (e.touches.length === 1) {
        const now = Date.now();
        if (now - lastTapTime.current < 280 && lbZoomRef.current > 1) { setLbZoom(1); lbZoomRef.current=1; setLbPanX(0); setLbPanY(0); }
        lastTapTime.current = now;
        if (lbZoomRef.current > 1) { panStartTouch.current={x:e.touches[0].clientX,y:e.touches[0].clientY}; panStartOffset.current={x:lbPanX,y:lbPanY}; }
      }
    }
    el.addEventListener('touchstart', onTS, { passive: false });
    return () => el.removeEventListener('touchstart', onTS);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lbMode, lbPanX, lbPanY]);

  // native touchstart passive:false — horizontal pinch
  useEffect(() => {
    const el = lbScrollRef.current;
    if (!el) return;
    function onTS(e: TouchEvent) {
      if (e.touches.length === 2) {
        e.preventDefault();
        const dx = e.touches[0].clientX - e.touches[1].clientX, dy = e.touches[0].clientY - e.touches[1].clientY;
        pinchStartDist.current = Math.sqrt(dx*dx+dy*dy); pinchStartZoom.current = lbZoomRef.current;
      } else if (e.touches.length === 1) {
        const now = Date.now();
        if (now - lastTapTime.current < 280) { setLbZoom(1); lbZoomRef.current=1; setLbPanX(0); setLbPanY(0); }
        lastTapTime.current = now;
        panStartTouch.current={x:e.touches[0].clientX,y:e.touches[0].clientY}; panStartOffset.current={x:lbPanX,y:lbPanY};
      }
    }
    el.addEventListener('touchstart', onTS, { passive: false });
    return () => el.removeEventListener('touchstart', onTS);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lbPanX, lbPanY]);

  function pinchDist(t: React.TouchList) {
    const dx = t[0].clientX-t[1].clientX, dy = t[0].clientY-t[1].clientY;
    return Math.sqrt(dx*dx+dy*dy);
  }
  function onVMove(e: React.TouchEvent) {
    if (e.touches.length === 2) {
      e.preventDefault();
      const z = Math.min(6, Math.max(1, pinchStartZoom.current * (pinchDist(e.touches) / pinchStartDist.current)));
      setLbZoom(z); lbZoomRef.current = z;
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
    } else if (e.touches.length === 1 && lbZoomRef.current > 1) {
      e.preventDefault();
      setLbPanX(panStartOffset.current.x + e.touches[0].clientX - panStartTouch.current.x);
      setLbPanY(panStartOffset.current.y + e.touches[0].clientY - panStartTouch.current.y);
    }
  }

  const loopImgs = images.length > 1 ? [...images, images[0]] : images;
  const dotIdx = lbImgIdx % images.length;

  function resetLb() { setLbZoom(1); lbZoomRef.current=1; setLbPanX(0); setLbPanY(0); setLbVZoomIdx(-1); lbVZoomIdxRef.current=-1; }

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col" style={{ background: 'rgba(0,0,0,0.97)' }}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-3 pt-3 pb-2 flex-shrink-0 gap-2">
        <p className="text-white/50 text-xs flex-1">{lbImgIdx + 1} / {images.length}</p>
        {images.length > 1 && (
          <div className="flex rounded-lg overflow-hidden flex-shrink-0" style={{ border: '1px solid rgba(255,255,255,0.2)' }}>
            <button
              onClick={() => { setLbMode('h'); resetLb(); }}
              style={{ padding: '5px 8px', background: lbMode==='h' ? 'rgba(255,255,255,0.25)' : 'transparent', color: '#fff', display: 'flex', alignItems: 'center' }}
            ><LayoutGrid className="w-3.5 h-3.5" /></button>
            <button
              onClick={() => { setLbMode('v'); resetLb(); }}
              style={{ padding: '5px 8px', background: lbMode==='v' ? 'rgba(255,255,255,0.25)' : 'transparent', color: '#fff', display: 'flex', alignItems: 'center' }}
            ><LayoutList className="w-3.5 h-3.5" /></button>
          </div>
        )}
        <button
          className="px-3 py-1.5 rounded-full text-xs font-medium flex-shrink-0"
          style={{ background: 'rgba(255,255,255,0.15)', color: '#fff' }}
          onClick={onClose}
        >關閉</button>
      </div>

      {/* Image area */}
      <div className="flex-1 relative overflow-hidden">
        {lbMode === 'v' ? (
          <div
            ref={lbVScrollRef}
            className="h-full"
            style={{ overflowY: lbZoom > 1 ? 'hidden' : 'auto', overflowX: 'hidden', scrollbarWidth: 'none' } as React.CSSProperties}
            onTouchMove={onVMove}
          >
            {images.map((url, i) => (
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
                if (images.length > 1 && i === images.length) {
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
            {images.length > 1 && (
              <div className="absolute flex gap-1.5 pointer-events-none" style={{ bottom: 6, left: 0, right: 0, justifyContent: 'center' }}>
                {images.map((_, i) => (
                  <div key={i} style={{ width: i===dotIdx ? 14 : 6, height: 6, borderRadius: 3, background: i===dotIdx ? '#fff' : 'rgba(255,255,255,0.35)', transition: 'width 0.2s' }} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Bottom bar */}
      <div className="flex items-center px-4 pt-2 pb-3 flex-shrink-0">
        {lbZoom > 1 ? (
          <button className="text-white/60 text-xs px-3 py-1.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.1)' }}
            onClick={resetLb}>重設縮放</button>
        ) : (
          <p className="text-[11px] text-white/30">{images.length > 1 ? '左右滑動切換' : '兩指放大'}</p>
        )}
      </div>
    </div>
  );
}

export function GroupAuctionLiveBanner({ round }: { round: LiveRound }) {
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  const endDate = round.endAt ? new Date(round.endAt) : null;
  const endStr = endDate
    ? `${endDate.getMonth() + 1}月${endDate.getDate()}日 ${String(endDate.getHours()).padStart(2, "0")}:${String(endDate.getMinutes()).padStart(2, "0")}`
    : null;

  const promoImgs = (round.promoImages ?? []).slice(0, 8);

  // 同 GroupAuctionBidPage 一樣：隨機排列推廣圖作 banner 背景裝飾
  const promoLayout = React.useMemo(() => {
    if (promoImgs.length === 0) return [];
    const shuffled = [...promoImgs].sort(() => Math.random() - 0.5);
    return shuffled.map((url) => ({
      url,
      x:       Math.random() * 90,
      y:       Math.random() * 80,
      size:    70 + Math.random() * 60,
      rot:     (Math.random() - 0.5) * 30,
      opacity: 0.10 + Math.random() * 0.08,
    }));
  }, [round.id]);

  return (
    // 用 flex-col + rowGap 精確控制 banner 同下方圖片間距
    <div style={{ display: "flex", flexDirection: "column", rowGap: "5px" }}>
      <Link href={`/group/${round.id}`}>
        <a
          className="block relative overflow-hidden rounded-2xl shadow-lg cursor-pointer active:scale-[0.985] transition-transform"
          style={{ background: "linear-gradient(135deg, #ea580c 0%, #f97316 40%, #fb923c 70%, #fbbf24 100%)" }}
        >
          {/* 推廣圖片背景（同 GroupAuctionBidPage 同款散落效果） */}
          {promoLayout.map((p, i) => (
            <img
              key={i}
              src={p.url}
              alt=""
              aria-hidden="true"
              className="absolute object-cover rounded-lg pointer-events-none select-none"
              style={{
                left:    `${p.x}%`,
                top:     `${p.y}%`,
                width:   p.size,
                height:  p.size,
                opacity: p.opacity,
                transform: `rotate(${p.rot}deg)`,
              }}
            />
          ))}

          <div className="relative z-10 px-4 pt-3.5 pb-3.5">
            {/* 商戶頭像 + 名稱 */}
            {round.merchantName && (
              <div className="flex items-center gap-1.5 mb-2">
                {round.merchantAvatar ? (
                  <img
                    src={round.merchantAvatar}
                    alt=""
                    className="w-5 h-5 rounded-full object-cover border border-white/40 shrink-0"
                  />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-white/30 shrink-0" />
                )}
                <span className="text-white/90 text-[11px] font-semibold truncate max-w-[160px]">
                  {round.merchantName}
                </span>
              </div>
            )}

            <div className="flex items-center justify-between mb-1.5">
              <span className="inline-flex items-center gap-1 bg-black/20 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full tracking-widest uppercase">
                🛒 團購拍賣
              </span>
              <span className="text-white/75 text-[11px] font-medium flex items-center gap-1">
                廣告頁 <ExternalLink className="w-3 h-3" />
              </span>
            </div>

            <h3 className="text-white font-extrabold text-[18px] leading-snug mb-2.5 drop-shadow-sm">
              {round.title}
            </h3>

            <div className="flex items-center gap-2 flex-wrap mb-2">
              <div className="inline-flex items-center gap-1.5 bg-black/25 text-white px-2.5 py-1 rounded-full text-sm font-black tracking-tight">
                <Clock className="w-3.5 h-3.5 shrink-0" />
                <Countdown endAt={round.endAt} />
              </div>
              {endStr && (
                <span className="text-white/85 text-[11px] font-semibold">
                  結拍：{endStr}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-white/15 rounded-full px-2.5 py-0.5">
                <span className="text-white/80 text-[11px] font-semibold">全部</span>
                <span className="text-white text-[13px] font-black">{round.totalItems}</span>
              </div>
              <div className="flex items-center gap-1 bg-amber-400/25 rounded-full px-2.5 py-0.5">
                <span className="text-amber-200 text-[11px] font-semibold">已出價</span>
                <span className="text-white text-[13px] font-black">{round.biddedItems}</span>
              </div>
              <div className="flex items-center gap-1 bg-white/15 rounded-full px-2.5 py-0.5">
                <span className="text-white/80 text-[11px] font-semibold">用戶</span>
                <span className="text-white text-[13px] font-black">{round.uniqueBidders}</span>
              </div>
            </div>
          </div>
        </a>
      </Link>

      {/* 圓圈圖片列：rowGap 已由外層 flex-col 控制為 5px，圖片之間亦 5px */}
      {promoImgs.length > 0 && (
        <div style={{ display: "flex", flexDirection: "row", gap: "5px", overflowX: "auto", scrollbarWidth: "none", paddingLeft: 4, justifyContent: "flex-end" }}>
          {promoImgs.map((url, i) => (
            <button
              key={i}
              type="button"
              className="shrink-0 rounded-full overflow-hidden border-[2px] border-amber-400 shadow-sm active:scale-95 transition-transform bg-amber-100"
              style={{ width: 30, height: 30, flexShrink: 0 }}
              onClick={() => setLightboxIdx(i)}
            >
              <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </button>
          ))}
        </div>
      )}

      {lightboxIdx !== null && (
        <ImageLightbox
          images={promoImgs}
          initialIndex={lightboxIdx}
          onClose={() => setLightboxIdx(null)}
        />
      )}
    </div>
  );
}
