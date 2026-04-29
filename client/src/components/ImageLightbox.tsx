import { useRef, useEffect, useCallback, useState } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

interface ImageLightboxProps {
  images: string[];
  initialIndex?: number;
  alt?: string;
  onClose: () => void;
}

export default function ImageLightbox({ images, initialIndex = 0, alt = "圖片", onClose }: ImageLightboxProps) {
  const [idx, setIdx] = useState(initialIndex);
  const src = images[idx];

  const imgWrapRef = useRef<HTMLDivElement>(null);
  const imgElRef = useRef<HTMLImageElement>(null);
  const naturalScale = useRef(1);
  const userScale = useRef(1);
  const minUserScale = 1;
  const maxUserScale = 10;
  const offsetX = useRef(0);
  const offsetY = useRef(0);
  const lastTouchDist = useRef<number | null>(null);
  const lastTapTime = useRef(0);
  const dragStart = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const isPinching = useRef(false);
  const swipeStartX = useRef<number | null>(null);

  const applyTransform = useCallback(() => {
    if (!imgWrapRef.current) return;
    const s = naturalScale.current * userScale.current;
    imgWrapRef.current.style.transform = `translate(${offsetX.current}px, ${offsetY.current}px) scale(${s})`;
  }, []);

  const clampOffset = useCallback(() => {
    const el = imgWrapRef.current;
    if (!el) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const iw = el.clientWidth * naturalScale.current * userScale.current;
    const ih = el.clientHeight * naturalScale.current * userScale.current;
    const maxOx = Math.max(0, (iw - vw) / 2);
    const maxOy = Math.max(0, (ih - vh) / 2);
    offsetX.current = Math.max(-maxOx, Math.min(maxOx, offsetX.current));
    offsetY.current = Math.max(-maxOy, Math.min(maxOy, offsetY.current));
  }, []);

  const resetZoom = useCallback(() => {
    userScale.current = 1;
    offsetX.current = 0;
    offsetY.current = 0;
    applyTransform();
  }, [applyTransform]);

  const onImgLoad = useCallback(() => {
    const img = imgElRef.current;
    if (!img) return;
    img.style.width = img.naturalWidth + "px";
    img.style.height = img.naturalHeight + "px";
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    naturalScale.current = Math.min(vw / img.naturalWidth, vh / img.naturalHeight);
    userScale.current = 1;
    offsetX.current = 0;
    offsetY.current = 0;
    applyTransform();
  }, [applyTransform]);

  const goTo = useCallback((next: number) => {
    setIdx(next);
    userScale.current = 1;
    offsetX.current = 0;
    offsetY.current = 0;
  }, []);

  useEffect(() => {
    const el = imgWrapRef.current;
    if (!el) return;

    const getTouchDist = (t: TouchList) =>
      Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const getTouchMid = (t: TouchList) => ({
      x: (t[0].clientX + t[1].clientX) / 2,
      y: (t[0].clientY + t[1].clientY) / 2,
    });

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        isPinching.current = true;
        lastTouchDist.current = getTouchDist(e.touches);
        dragStart.current = null;
        swipeStartX.current = null;
      } else if (e.touches.length === 1) {
        isPinching.current = false;
        const now = Date.now();
        if (now - lastTapTime.current < 280) {
          if (userScale.current > 1.05) {
            resetZoom();
          } else {
            userScale.current = 2.5;
            applyTransform();
          }
          lastTapTime.current = 0;
          return;
        }
        lastTapTime.current = now;
        dragStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, ox: offsetX.current, oy: offsetY.current };
        swipeStartX.current = userScale.current <= 1.05 ? e.touches[0].clientX : null;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      if (e.touches.length === 2 && lastTouchDist.current !== null) {
        const newDist = getTouchDist(e.touches);
        const ratio = newDist / lastTouchDist.current;
        const mid = getTouchMid(e.touches);
        const rect = el.getBoundingClientRect();
        const cx = mid.x - rect.left - rect.width / 2;
        const cy = mid.y - rect.top - rect.height / 2;
        const prevUser = userScale.current;
        userScale.current = Math.max(minUserScale, Math.min(maxUserScale, prevUser * ratio));
        const delta = userScale.current / prevUser;
        offsetX.current = cx + (offsetX.current - cx) * delta;
        offsetY.current = cy + (offsetY.current - cy) * delta;
        lastTouchDist.current = newDist;
        clampOffset();
        applyTransform();
      } else if (e.touches.length === 1 && dragStart.current && !isPinching.current) {
        offsetX.current = dragStart.current.ox + (e.touches[0].clientX - dragStart.current.x);
        offsetY.current = dragStart.current.oy + (e.touches[0].clientY - dragStart.current.y);
        clampOffset();
        applyTransform();
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        lastTouchDist.current = null;
        if (e.touches.length === 0) {
          isPinching.current = false;
          if (swipeStartX.current !== null && e.changedTouches.length > 0) {
            const diff = swipeStartX.current - e.changedTouches[0].clientX;
            if (Math.abs(diff) > 50 && images.length > 1) {
              setIdx(prev => {
                if (diff > 0) return Math.min(images.length - 1, prev + 1);
                return Math.max(0, prev - 1);
              });
              userScale.current = 1;
              offsetX.current = 0;
              offsetY.current = 0;
            }
            swipeStartX.current = null;
          }
        }
      }
    };

    el.addEventListener("touchstart", onTouchStart, { passive: false });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [applyTransform, clampOffset, resetZoom, images.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && images.length > 1) goTo(Math.max(0, idx - 1));
      if (e.key === "ArrowRight" && images.length > 1) goTo(Math.min(images.length - 1, idx + 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, images.length, idx, goTo]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center overflow-hidden"
      onClick={() => { if (userScale.current <= 1.05) onClose(); }}
    >
      <div
        ref={imgWrapRef}
        className="select-none"
        style={{ transformOrigin: "center center", willChange: "transform" }}
        onClick={e => e.stopPropagation()}
      >
        <img
          ref={imgElRef}
          key={src}
          src={src}
          alt={alt}
          onLoad={onImgLoad}
          className="block rounded-lg pointer-events-none"
          style={{ imageRendering: "high-quality", maxWidth: "none", maxHeight: "none" }}
          draggable={false}
        />
      </div>

      <button
        className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/20 flex items-center justify-center z-10"
        onClick={onClose}
      >
        <X className="w-5 h-5 text-white" />
      </button>

      {images.length > 1 && (
        <>
          <button
            className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/20 flex items-center justify-center z-10 disabled:opacity-20"
            onClick={e => { e.stopPropagation(); goTo(Math.max(0, idx - 1)); }}
            disabled={idx === 0}
          >
            <ChevronLeft className="w-5 h-5 text-white" />
          </button>
          <button
            className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/20 flex items-center justify-center z-10 disabled:opacity-20"
            onClick={e => { e.stopPropagation(); goTo(Math.min(images.length - 1, idx + 1)); }}
            disabled={idx === images.length - 1}
          >
            <ChevronRight className="w-5 h-5 text-white" />
          </button>
          <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white/60 text-xs font-semibold tabular-nums z-10">
            {idx + 1} / {images.length}
          </div>
        </>
      )}

      <p className="absolute bottom-5 left-0 right-0 text-center text-[11px] text-white/40 pointer-events-none">
        雙指縮放 · 拖拉移動 · 雙擊放大/重設
        {images.length > 1 ? " · 左右掃切換" : " · 點擊背景關閉"}
      </p>
    </div>
  );
}
