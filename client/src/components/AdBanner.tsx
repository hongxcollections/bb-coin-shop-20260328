import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { X, Megaphone, Sparkles } from "lucide-react";

const DISMISS_KEY = "adBanner_dismissed_v1";
const SHOW_DELAY_MS = 1800;

function getDismissedKey(slot: number, targetType: string) {
  const today = new Date().toISOString().slice(0, 10);
  return `${DISMISS_KEY}_${targetType}_${slot}_${today}`;
}

export default function AdBanner() {
  const { data, isLoading } = trpc.ads.getBanner.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const [visible, setVisible] = useState(false);
  const [shown, setShown] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isLoading || !data) return;
    const key = getDismissedKey(data.slot, data.targetType);
    if (sessionStorage.getItem(key)) return;
    timerRef.current = setTimeout(() => {
      setShown(true);
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
    }, SHOW_DELAY_MS);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [isLoading, data]);

  const handleDismiss = () => {
    setVisible(false);
    setTimeout(() => setDismissed(true), 500);
    if (data) {
      const key = getDismissedKey(data.slot, data.targetType);
      sessionStorage.setItem(key, "1");
    }
  };

  if (!data || dismissed || !shown) return null;

  return (
    <>
      <style>{`
        /* 鐘擺落下：從頂部左右慢擺落底，擺幅遞減停住 */
        @keyframes adBannerPendulum {
          0%   { transform: translateY(-135%) rotate(-26deg); opacity: 0; }
          18%  { transform: translateY(-90%)  rotate(20deg);  opacity: 1; }
          34%  { transform: translateY(-52%)  rotate(-14deg); opacity: 1; }
          48%  { transform: translateY(-18%)  rotate(9deg);   opacity: 1; }
          59%  { transform: translateY(0)     rotate(-5deg);  opacity: 1; }
          68%  { transform: translateY(0)     rotate(3deg);   opacity: 1; }
          76%  { transform: translateY(0)     rotate(-1.8deg);opacity: 1; }
          84%  { transform: translateY(0)     rotate(0.9deg); opacity: 1; }
          91%  { transform: translateY(0)     rotate(-0.3deg);opacity: 1; }
          100% { transform: translateY(0)     rotate(0deg);   opacity: 1; }
        }
        @keyframes adBannerFadeUp {
          0%   { transform: translateY(0)     rotate(0deg);   opacity: 1; }
          100% { transform: translateY(-140%) rotate(-20deg); opacity: 0; }
        }
        /* 星星持續旋轉 */
        @keyframes adSparkle {
          from { transform: rotate(0deg) scale(1);   opacity: 0.22; }
          50%  { transform: rotate(180deg) scale(1.12); opacity: 0.38; }
          to   { transform: rotate(360deg) scale(1);  opacity: 0.22; }
        }
        @media (prefers-reduced-motion: reduce) {
          .ad-banner-inner { animation: none !important; }
          .ad-sparkle      { animation: none !important; }
        }
      `}</style>

      {/* 外層：fixed 定位 + flex 置中（不用 transform，避免衝突動畫） */}
      <div
        style={{
          position: "fixed",
          bottom: "calc(4.5rem + env(safe-area-inset-bottom, 0px))",
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          padding: "0 12px",
          zIndex: 99995,
          pointerEvents: "none",
        }}
      >
        {/* 內層：鐘擺動畫在這裡，transform-origin 設頂部中央模擬懸吊感 */}
        <div
          className="ad-banner-inner"
          style={{
            width: "100%",
            maxWidth: 480,
            pointerEvents: "auto",
            transformOrigin: "top center",
            animation: visible
              ? "adBannerPendulum 3.8s ease-out both"
              : "adBannerFadeUp 0.4s ease-in both",
          }}
        >
          {/* 卡片 */}
          <div
            style={{
              position: "relative",
              overflow: "hidden",
              background: "linear-gradient(110deg, #fef3c7 0%, #fce7f3 40%, #fef3c7 55%, #fce7f3 70%, #fef3c7 100%)",
              border: "1.5px solid #f59e0b",
              borderRadius: "16px",
              boxShadow: "0 8px 28px rgba(180,100,0,0.16), 0 2px 8px rgba(0,0,0,0.08)",
              padding: "14px 14px 14px 14px",
              display: "flex",
              alignItems: "flex-start",
              gap: "10px",
            }}
          >
            {/* 裝飾星星（右上） */}
            <div
              className="ad-sparkle"
              style={{
                position: "absolute",
                top: -10,
                right: -10,
                pointerEvents: "none",
                animation: "adSparkle 9s linear infinite",
              }}
            >
              <Sparkles style={{ width: 56, height: 56, color: "#f59e0b" }} />
            </div>

            {/* 裝飾星星（左下，反向） */}
            <div
              className="ad-sparkle"
              style={{
                position: "absolute",
                bottom: -8,
                left: -8,
                pointerEvents: "none",
                animation: "adSparkle 12s linear infinite reverse",
              }}
            >
              <Sparkles style={{ width: 38, height: 38, color: "#ec4899" }} />
            </div>

            {/* Icon */}
            <div
              style={{
                position: "relative",
                flexShrink: 0,
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #f59e0b, #ec4899)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginTop: 1,
                boxShadow: "0 2px 8px rgba(245,158,11,0.35)",
              }}
            >
              <Megaphone style={{ width: 17, height: 17, color: "#fff" }} />
            </div>

            {/* Content */}
            <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
              {data.title && (
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: "13px",
                    color: "#92400e",
                    lineHeight: 1.35,
                    marginBottom: data.body ? 4 : 0,
                  }}
                >
                  {data.title}
                </div>
              )}
              {data.body && (
                <div
                  style={{
                    fontSize: "12.5px",
                    color: "#a16207",
                    lineHeight: 1.5,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {data.body}
                </div>
              )}
            </div>

            {/* Close button */}
            <button
              onClick={handleDismiss}
              style={{
                position: "relative",
                flexShrink: 0,
                padding: 5,
                borderRadius: "50%",
                border: "none",
                background: "rgba(180,100,0,0.12)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#b45309",
                marginTop: -3,
                marginRight: -2,
              }}
              aria-label="關閉廣告"
            >
              <X style={{ width: 14, height: 14 }} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
