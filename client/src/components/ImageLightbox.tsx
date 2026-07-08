import { useRef, useEffect, useState } from "react";
import { LayoutGrid, LayoutList } from "lucide-react";

interface ImageLightboxProps {
  images: string[];
  initialIndex?: number;
  alt?: string;
  onClose: () => void;
  bottomInset?: number;
  caption?: { name: string; price: string };
}

export default function ImageLightbox({ images, initialIndex = 0, onClose, bottomInset = 0, caption }: ImageLightboxProps) {
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
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [onClose]);

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
    <div className="fixed z-[9999] flex flex-col" style={{ top: 0, left: 0, right: 0, bottom: bottomInset, background: 'rgba(0,0,0,0.97)' }}>
      <div className="flex-shrink-0">
        <div className="flex items-center justify-between px-3 pt-3 pb-1 gap-2">
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
        {caption && (
          <div className="px-4 pb-2 flex items-baseline gap-2 flex-wrap">
            <span className="text-white text-sm font-black leading-tight">{caption.name}</span>
            <span className="text-xs font-bold" style={{ color: '#fb923c' }}>{caption.price}</span>
          </div>
        )}
      </div>

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
