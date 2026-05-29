import React, { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { Clock, ExternalLink, X, ChevronLeft, ChevronRight } from "lucide-react";

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
  soldItems: number;
  activeItems: number;
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
  const [idx, setIdx] = useState(initialIndex);
  const [scale, setScale] = useState(1);
  const [translateX, setTranslateX] = useState(0);
  const [translateY, setTranslateY] = useState(0);

  const touch1Ref = useRef<{ x: number; y: number } | null>(null);
  const pinchRef = useRef<{ dist: number; scale: number; tx: number; ty: number } | null>(null);
  const panBaseRef = useRef<{ tx: number; ty: number } | null>(null);

  function resetTransform() {
    setScale(1);
    setTranslateX(0);
    setTranslateY(0);
  }

  function goTo(newIdx: number) {
    setIdx(Math.max(0, Math.min(images.length - 1, newIdx)));
    resetTransform();
  }

  function handleTouchStart(e: React.TouchEvent) {
    if (e.touches.length === 1) {
      touch1Ref.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      panBaseRef.current = { tx: translateX, ty: translateY };
      pinchRef.current = null;
    } else if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[1].clientX - e.touches[0].clientX,
        e.touches[1].clientY - e.touches[0].clientY,
      );
      pinchRef.current = { dist, scale, tx: translateX, ty: translateY };
      touch1Ref.current = null;
    }
  }

  function handleTouchMove(e: React.TouchEvent) {
    e.preventDefault();
    if (e.touches.length === 2 && pinchRef.current) {
      const dist = Math.hypot(
        e.touches[1].clientX - e.touches[0].clientX,
        e.touches[1].clientY - e.touches[0].clientY,
      );
      const newScale = Math.max(1, Math.min(5, pinchRef.current.scale * (dist / pinchRef.current.dist)));
      setScale(newScale);
    } else if (e.touches.length === 1 && touch1Ref.current) {
      if (scale > 1 && panBaseRef.current) {
        const dx = e.touches[0].clientX - touch1Ref.current.x;
        const dy = e.touches[0].clientY - touch1Ref.current.y;
        setTranslateX(panBaseRef.current.tx + dx);
        setTranslateY(panBaseRef.current.ty + dy);
      }
    }
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (touch1Ref.current && scale <= 1) {
      const dx = e.changedTouches[0].clientX - touch1Ref.current.x;
      const dy = e.changedTouches[0].clientY - touch1Ref.current.y;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
        goTo(dx < 0 ? idx + 1 : idx - 1);
      }
    }
    touch1Ref.current = null;
    pinchRef.current = null;
  }

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  return (
    <div className="fixed inset-0 z-[9999] bg-black flex flex-col items-center justify-center">
      <button
        className="absolute top-4 right-4 z-20 text-white/80 hover:text-white w-9 h-9 flex items-center justify-center rounded-full bg-black/40"
        onClick={onClose}
      >
        <X className="w-5 h-5" />
      </button>

      <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white/70 text-sm font-medium z-20">
        {idx + 1} / {images.length}
      </div>

      {images.length > 1 && idx > 0 && (
        <button
          className="absolute left-3 top-1/2 -translate-y-1/2 z-20 text-white/70 hover:text-white w-9 h-9 flex items-center justify-center rounded-full bg-black/40"
          onClick={() => goTo(idx - 1)}
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      )}
      {images.length > 1 && idx < images.length - 1 && (
        <button
          className="absolute right-3 top-1/2 -translate-y-1/2 z-20 text-white/70 hover:text-white w-9 h-9 flex items-center justify-center rounded-full bg-black/40"
          onClick={() => goTo(idx + 1)}
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      )}

      <div
        className="w-full h-full flex items-center justify-center overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ touchAction: "none" }}
      >
        <img
          key={idx}
          src={images[idx]}
          alt=""
          className="max-w-full max-h-full object-contain select-none pointer-events-none"
          style={{
            transform: `scale(${scale}) translate(${translateX / scale}px, ${translateY / scale}px)`,
            transition: scale === 1 ? "transform 0.25s ease" : "none",
          }}
          draggable={false}
        />
      </div>

      {images.length > 1 && (
        <div className="absolute bottom-6 flex gap-1.5 z-20">
          {images.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className={`rounded-full transition-all ${
                i === idx ? "w-4 h-1.5 bg-white" : "w-1.5 h-1.5 bg-white/40"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function GroupAuctionLiveBanner({ round }: { round: LiveRound }) {
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  const endDate = round.endAt ? new Date(round.endAt) : null;
  const endStr = endDate
    ? `${endDate.getMonth() + 1}月${endDate.getDate()}日 ${String(endDate.getHours()).padStart(2, "0")}:${String(endDate.getMinutes()).padStart(2, "0")}`
    : null;

  const promoImgs = (round.promoImages ?? []).slice(0, 5);

  return (
    <>
      <Link href={`/group/${round.id}`}>
        <a
          className="block relative overflow-hidden rounded-2xl shadow-lg cursor-pointer active:scale-[0.985] transition-transform"
          style={{ background: "linear-gradient(135deg, #ea580c 0%, #f97316 40%, #fb923c 70%, #fbbf24 100%)" }}
        >
          {round.coverImage && (
            <img
              src={round.coverImage}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
              style={{ opacity: 0.22, filter: "blur(3px)", transform: "scale(1.05)" }}
            />
          )}

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

            <div className="flex items-center gap-4 text-white/90 text-[12px] font-semibold">
              <span>共 <strong className="text-white text-[13px]">{round.totalItems}</strong> 件</span>
              <span>成交 <strong className="text-white text-[13px]">{round.soldItems}</strong> 件</span>
              <span>進行中 <strong className="text-white text-[13px]">{round.activeItems}</strong> 件</span>
            </div>
          </div>
        </a>
      </Link>

      {promoImgs.length > 0 && (
        <div className="flex px-1 overflow-x-auto pb-0.5" style={{ scrollbarWidth: "none", gap: "5px", marginTop: "5px" }}>
          {promoImgs.map((url, i) => (
            <button
              key={i}
              type="button"
              className="shrink-0 rounded-full overflow-hidden border-[2px] border-amber-400 shadow-sm active:scale-95 transition-transform bg-amber-100"
              style={{ width: 30, height: 30 }}
              onClick={() => setLightboxIdx(i)}
            >
              <img src={url} alt="" className="w-full h-full object-cover" />
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
    </>
  );
}
