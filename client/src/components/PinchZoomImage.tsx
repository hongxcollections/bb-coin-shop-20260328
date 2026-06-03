import { useRef, useState, useEffect } from "react";
import { X } from "lucide-react";

interface Props {
  src: string;
  alt?: string;
  className?: string;
  style?: React.CSSProperties;
  fullscreenOnClick?: boolean;
}

function FullscreenLightbox({ src, alt, onClose }: { src: string; alt?: string; onClose: () => void }) {
  const imgRef = useRef<HTMLImageElement>(null);
  const stateRef = useRef({
    scale: 1,
    tx: 0,
    ty: 0,
    lastDist: null as number | null,
    lastMidX: 0,
    lastMidY: 0,
    lastSingleX: 0,
    lastSingleY: 0,
    isPanning: false,
  });
  const [transform, setTransform] = useState({ scale: 1, tx: 0, ty: 0 });

  function applyTransform() {
    const s = stateRef.current;
    setTransform({ scale: s.scale, tx: s.tx, ty: s.ty });
  }

  function resetTransform() {
    const s = stateRef.current;
    s.scale = 1; s.tx = 0; s.ty = 0;
    applyTransform();
  }

  useEffect(() => {
    const el = imgRef.current;
    if (!el) return;

    function getDist(t: TouchList) {
      const dx = t[0].clientX - t[1].clientX;
      const dy = t[0].clientY - t[1].clientY;
      return Math.sqrt(dx * dx + dy * dy);
    }

    function getMid(t: TouchList) {
      return {
        x: (t[0].clientX + t[1].clientX) / 2,
        y: (t[0].clientY + t[1].clientY) / 2,
      };
    }

    function onStart(e: TouchEvent) {
      const s = stateRef.current;
      if (e.touches.length === 2) {
        s.lastDist = getDist(e.touches);
        const mid = getMid(e.touches);
        s.lastMidX = mid.x;
        s.lastMidY = mid.y;
        s.isPanning = false;
      } else if (e.touches.length === 1) {
        s.lastSingleX = e.touches[0].clientX;
        s.lastSingleY = e.touches[0].clientY;
        s.isPanning = true;
      }
    }

    function onMove(e: TouchEvent) {
      e.preventDefault();
      const s = stateRef.current;

      if (e.touches.length === 2 && s.lastDist !== null) {
        const dist = getDist(e.touches);
        const mid = getMid(e.touches);
        const ratio = dist / s.lastDist;
        const newScale = Math.min(8, Math.max(1, s.scale * ratio));

        // translate so pinch midpoint stays fixed
        s.tx = mid.x - (mid.x - s.tx) * (newScale / s.scale) + (mid.x - s.lastMidX);
        s.ty = mid.y - (mid.y - s.ty) * (newScale / s.scale) + (mid.y - s.lastMidY);
        s.scale = newScale;
        s.lastDist = dist;
        s.lastMidX = mid.x;
        s.lastMidY = mid.y;
        applyTransform();
      } else if (e.touches.length === 1 && s.isPanning) {
        const dx = e.touches[0].clientX - s.lastSingleX;
        const dy = e.touches[0].clientY - s.lastSingleY;
        s.tx += dx;
        s.ty += dy;
        s.lastSingleX = e.touches[0].clientX;
        s.lastSingleY = e.touches[0].clientY;
        applyTransform();
      }
    }

    function onEnd(e: TouchEvent) {
      const s = stateRef.current;
      if (e.touches.length < 2) {
        s.lastDist = null;
      }
      if (e.touches.length === 0) {
        s.isPanning = false;
        if (s.scale <= 1) {
          s.scale = 1; s.tx = 0; s.ty = 0;
          applyTransform();
        }
      }
    }

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
    };
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        background: "rgba(0,0,0,0.96)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
      onClick={onClose}
    >
      <button
        onClick={onClose}
        style={{
          position: "absolute",
          top: 16,
          right: 16,
          color: "rgba(255,255,255,0.7)",
          background: "rgba(255,255,255,0.12)",
          border: "none",
          borderRadius: "50%",
          width: 36,
          height: 36,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          zIndex: 1,
          flexShrink: 0,
        }}
      >
        <X style={{ width: 18, height: 18 }} />
      </button>

      <img
        ref={imgRef}
        src={src}
        alt={alt}
        style={{
          maxWidth: "100vw",
          maxHeight: "100vh",
          objectFit: "contain",
          display: "block",
          transform: `translate(${transform.tx}px, ${transform.ty}px) scale(${transform.scale})`,
          transformOrigin: "center center",
          userSelect: "none",
          WebkitUserSelect: "none",
          touchAction: "none",
          cursor: transform.scale > 1 ? "grab" : "default",
          willChange: "transform",
        }}
        onDoubleClick={resetTransform}
        onClick={e => e.stopPropagation()}
      />

      <p style={{
        position: "absolute",
        bottom: 24,
        left: 0,
        right: 0,
        textAlign: "center",
        color: "rgba(255,255,255,0.4)",
        fontSize: 11,
        pointerEvents: "none",
      }}>
        雙指縮放 · 單指拖動 · 雙擊重設 · 點擊背景關閉
      </p>
    </div>
  );
}

export function PinchZoomImage({ src, alt, className, style, fullscreenOnClick }: Props) {
  const [lightbox, setLightbox] = useState(false);

  return (
    <>
      <img
        src={src}
        alt={alt}
        className={className}
        style={{
          ...style,
          cursor: fullscreenOnClick ? "zoom-in" : "default",
          userSelect: "none",
          WebkitUserSelect: "none",
        }}
        onClick={fullscreenOnClick ? () => setLightbox(true) : undefined}
      />
      {lightbox && <FullscreenLightbox src={src} alt={alt} onClose={() => setLightbox(false)} />}
    </>
  );
}
