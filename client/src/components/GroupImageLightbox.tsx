import { useState, useEffect, useRef } from "react";
import { LayoutGrid, LayoutList } from "lucide-react";

interface Props {
  images: string[];
  initialIndex?: number;
  title?: string;
  onClose: () => void;
}

export default function GroupImageLightbox({ images, initialIndex = 0, title, onClose }: Props) {
  const [imgIdx, setImgIdx] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [mode, setMode] = useState<'h' | 'v'>('v');
  const [vZoomIdx, setVZoomIdx] = useState(-1);
  const zoomRef = useRef(1);
  const vZoomIdxRef = useRef(-1);
  const pinchStartDist = useRef(0);
  const pinchStartZoom = useRef(1);
  const panStartTouch = useRef({ x: 0, y: 0 });
  const panStartOffset = useRef({ x: 0, y: 0 });
  const lastTapTime = useRef(0);
  const hScrollRef = useRef<HTMLDivElement>(null);
  const vScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { zoomRef.current = zoom; }, [zoom]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    setTimeout(() => {
      if (hScrollRef.current) hScrollRef.current.scrollLeft = initialIndex * hScrollRef.current.clientWidth;
    }, 20);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resetZoom() {
    setZoom(1); zoomRef.current = 1;
    setPanX(0); setPanY(0);
    setVZoomIdx(-1); vZoomIdxRef.current = -1;
  }

  useEffect(() => {
    const el = vScrollRef.current;
    if (!el || mode !== 'v') return;
    function onTS(e: TouchEvent) {
      if (e.touches.length === 2) {
        e.preventDefault();
        const my = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        const imgs = el!.querySelectorAll('img');
        let found = 0;
        imgs.forEach((img, i) => { const r = img.getBoundingClientRect(); if (my >= r.top && my <= r.bottom) found = i; });
        vZoomIdxRef.current = found; setVZoomIdx(found);
        const dx = e.touches[0].clientX - e.touches[1].clientX, dy = e.touches[0].clientY - e.touches[1].clientY;
        pinchStartDist.current = Math.sqrt(dx*dx+dy*dy); pinchStartZoom.current = zoomRef.current;
      } else if (e.touches.length === 1) {
        const now = Date.now();
        if (now - lastTapTime.current < 280 && zoomRef.current > 1) { setZoom(1); zoomRef.current=1; setPanX(0); setPanY(0); }
        lastTapTime.current = now;
        if (zoomRef.current > 1) { panStartTouch.current={x:e.touches[0].clientX,y:e.touches[0].clientY}; panStartOffset.current={x:panX,y:panY}; }
      }
    }
    el.addEventListener('touchstart', onTS, { passive: false });
    return () => el.removeEventListener('touchstart', onTS);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, panX, panY]);

  useEffect(() => {
    const el = hScrollRef.current;
    if (!el) return;
    function onTS(e: TouchEvent) {
      if (e.touches.length === 2) {
        e.preventDefault();
        const dx = e.touches[0].clientX - e.touches[1].clientX, dy = e.touches[0].clientY - e.touches[1].clientY;
        pinchStartDist.current = Math.sqrt(dx*dx+dy*dy); pinchStartZoom.current = zoomRef.current;
      } else if (e.touches.length === 1) {
        const now = Date.now();
        if (now - lastTapTime.current < 280) { setZoom(1); zoomRef.current=1; setPanX(0); setPanY(0); }
        lastTapTime.current = now;
        panStartTouch.current={x:e.touches[0].clientX,y:e.touches[0].clientY}; panStartOffset.current={x:panX,y:panY};
      }
    }
    el.addEventListener('touchstart', onTS, { passive: false });
    return () => el.removeEventListener('touchstart', onTS);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panX, panY]);

  function pinchDist(t: React.TouchList) {
    const dx = t[0].clientX-t[1].clientX, dy = t[0].clientY-t[1].clientY;
    return Math.sqrt(dx*dx+dy*dy);
  }
  function onVMove(e: React.TouchEvent) {
    if (e.touches.length === 2) {
      e.preventDefault();
      const z = Math.min(6, Math.max(1, pinchStartZoom.current * (pinchDist(e.touches) / pinchStartDist.current)));
      setZoom(z); zoomRef.current = z;
    } else if (e.touches.length === 1 && zoomRef.current > 1) {
      e.preventDefault();
      setPanX(panStartOffset.current.x + e.touches[0].clientX - panStartTouch.current.x);
      setPanY(panStartOffset.current.y + e.touches[0].clientY - panStartTouch.current.y);
    }
  }
  function onHMove(e: React.TouchEvent) {
    if (e.touches.length === 2) {
      e.preventDefault();
      const z = Math.min(6, Math.max(1, pinchStartZoom.current * (pinchDist(e.touches) / pinchStartDist.current)));
      setZoom(z); zoomRef.current = z;
    } else if (e.touches.length === 1 && zoomRef.current > 1) {
      e.preventDefault();
      setPanX(panStartOffset.current.x + e.touches[0].clientX - panStartTouch.current.x);
      setPanY(panStartOffset.current.y + e.touches[0].clientY - panStartTouch.current.y);
    }
  }

  const loopImgs = images.length > 1 ? [...images, images[0]] : images;
  const dotIdx = imgIdx % images.length;

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col" style={{ background: 'rgba(0,0,0,0.97)' }}>
      {/* Top bar */}
      <div className="flex items-start justify-between px-3 pt-3 pb-2 flex-shrink-0 gap-2">
        <div className="flex-1 min-w-0">
          {title && <p className="text-sm font-semibold text-white leading-snug line-clamp-2">{title}</p>}
          {!title && <p className="text-white/50 text-xs">{imgIdx + 1} / {images.length}</p>}
          {title && images.length > 0 && <p className="text-white/40 text-[11px] mt-0.5">{imgIdx + 1} / {images.length}</p>}
        </div>
        {images.length > 1 && (
          <div className="flex rounded-lg overflow-hidden flex-shrink-0" style={{ border: '1px solid rgba(255,255,255,0.2)', alignSelf: 'flex-start', marginTop: 2 }}>
            <button
              onClick={() => { setMode('h'); resetZoom(); }}
              style={{ padding: '5px 8px', background: mode==='h' ? 'rgba(255,255,255,0.25)' : 'transparent', color: '#fff', display: 'flex', alignItems: 'center' }}
            ><LayoutGrid className="w-3.5 h-3.5" /></button>
            <button
              onClick={() => { setMode('v'); resetZoom(); }}
              style={{ padding: '5px 8px', background: mode==='v' ? 'rgba(255,255,255,0.25)' : 'transparent', color: '#fff', display: 'flex', alignItems: 'center' }}
            ><LayoutList className="w-3.5 h-3.5" /></button>
          </div>
        )}
        <button
          className="px-3 py-1.5 rounded-full text-xs font-medium flex-shrink-0"
          style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', alignSelf: 'flex-start', marginTop: 2 }}
          onClick={onClose}
        >關閉</button>
      </div>

      {/* Image area */}
      <div className="flex-1 relative overflow-hidden">
        {mode === 'v' ? (
          <div
            ref={vScrollRef}
            className="h-full"
            style={{ overflowY: zoom > 1 ? 'hidden' : 'auto', overflowX: 'hidden', scrollbarWidth: 'none' } as React.CSSProperties}
            onTouchMove={onVMove}
          >
            {images.map((url, i) => (
              <div key={i} className="flex items-center justify-center" style={{ padding: '3px', minHeight: '30vh' }}>
                <img
                  src={url}
                  className="select-none"
                  style={{
                    width: '100%', objectFit: 'contain', borderRadius: 14, display: 'block', pointerEvents: 'none',
                    transform: vZoomIdx === i ? `translate(${panX}px,${panY}px) scale(${zoom})` : 'none',
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
              ref={hScrollRef}
              className="flex h-full"
              style={{
                overflowX: zoom > 1 ? 'hidden' : 'auto', overflowY: 'hidden',
                scrollSnapType: 'x mandatory', scrollBehavior: 'auto', scrollbarWidth: 'none',
                WebkitOverflowScrolling: 'touch' as React.CSSProperties['WebkitOverflowScrolling'],
              } as React.CSSProperties}
              onScroll={() => {
                if (!hScrollRef.current || zoomRef.current > 1) return;
                const w = hScrollRef.current.clientWidth;
                const rem = hScrollRef.current.scrollLeft % w;
                if (rem > 2 && rem < w - 2) return;
                const i = Math.round(hScrollRef.current.scrollLeft / w);
                if (images.length > 1 && i === images.length) {
                  hScrollRef.current.scrollLeft = 0; setImgIdx(0); resetZoom(); return;
                }
                if (i !== imgIdx) { setImgIdx(i); resetZoom(); }
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
                      transform: i === imgIdx ? `translate(${panX}px,${panY}px) scale(${zoom})` : 'none',
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
        {zoom > 1 ? (
          <button className="text-white/60 text-xs px-3 py-1.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.1)' }}
            onClick={resetZoom}>重設縮放</button>
        ) : (
          <p className="text-[11px] text-white/30">{images.length > 1 ? '左右滑動切換 / 上下滑覽全部' : '兩指放大'}</p>
        )}
      </div>
    </div>
  );
}
