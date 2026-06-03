import { useRef, useState, useEffect } from "react";
import { X } from "lucide-react";

interface Props {
  src: string;
  alt?: string;
  className?: string;
  style?: React.CSSProperties;
  fullscreenOnClick?: boolean;
}

function usePinchZoom(ref: React.RefObject<HTMLElement | null>) {
  const [scale, setScale] = useState(1);
  const stateRef = useRef({ scale: 1, lastDist: null as number | null });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    function getDist(t: TouchList) {
      const dx = t[0].clientX - t[1].clientX;
      const dy = t[0].clientY - t[1].clientY;
      return Math.sqrt(dx * dx + dy * dy);
    }

    function onStart(e: TouchEvent) {
      if (e.touches.length === 2) {
        stateRef.current.lastDist = getDist(e.touches);
      }
    }

    function onMove(e: TouchEvent) {
      if (e.touches.length === 2 && stateRef.current.lastDist !== null) {
        e.preventDefault();
        const d = getDist(e.touches);
        const next = Math.min(6, Math.max(1, stateRef.current.scale * (d / stateRef.current.lastDist)));
        stateRef.current.scale = next;
        stateRef.current.lastDist = d;
        setScale(next);
      }
    }

    function onEnd(e: TouchEvent) {
      if (e.touches.length < 2) {
        stateRef.current.lastDist = null;
        if (stateRef.current.scale < 1) {
          stateRef.current.scale = 1;
          setScale(1);
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
  }, [ref]);

  function reset() {
    stateRef.current.scale = 1;
    stateRef.current.lastDist = null;
    setScale(1);
  }

  return { scale, reset };
}

function FullscreenLightbox({ src, alt, onClose }: { src: string; alt?: string; onClose: () => void }) {
  const imgRef = useRef<HTMLImageElement>(null);
  const { scale, reset } = usePinchZoom(imgRef);

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
        }}
      >
        <X style={{ width: 18, height: 18 }} />
      </button>
      <div style={{ overflow: "hidden", touchAction: "pan-x pan-y", maxWidth: "100vw", maxHeight: "100vh" }} onClick={e => e.stopPropagation()}>
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          style={{
            maxWidth: "100vw",
            maxHeight: "100vh",
            objectFit: "contain",
            display: "block",
            transform: `scale(${scale})`,
            transformOrigin: "center center",
            userSelect: "none",
            WebkitUserSelect: "none",
            cursor: scale > 1 ? "zoom-out" : "default",
          }}
          onDoubleClick={reset}
        />
      </div>
      <p style={{ position: "absolute", bottom: 24, left: 0, right: 0, textAlign: "center", color: "rgba(255,255,255,0.4)", fontSize: 11, pointerEvents: "none" }}>
        雙指縮放 · 雙擊重設 · 點擊背景關閉
      </p>
    </div>
  );
}

export function PinchZoomImage({ src, alt, className, style, fullscreenOnClick }: Props) {
  const [lightbox, setLightbox] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { scale, reset } = usePinchZoom(containerRef);

  return (
    <>
      <div ref={containerRef} style={{ overflow: "hidden", touchAction: "pan-x pan-y" }}>
        <img
          src={src}
          alt={alt}
          className={className}
          style={{
            ...style,
            transform: `scale(${scale})`,
            transformOrigin: "center center",
            userSelect: "none",
            WebkitUserSelect: "none",
            cursor: fullscreenOnClick ? "zoom-in" : (scale > 1 ? "zoom-out" : "default"),
          }}
          onDoubleClick={fullscreenOnClick ? undefined : reset}
          onClick={fullscreenOnClick ? () => setLightbox(true) : undefined}
        />
      </div>
      {lightbox && <FullscreenLightbox src={src} alt={alt} onClose={() => setLightbox(false)} />}
    </>
  );
}
