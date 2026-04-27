import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { X, Megaphone } from "lucide-react";

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
          0%   { transform: translateY(0)  rotate(0deg);   opacity: 1; }
          100% { transform: translateY(-140%) rotate(-20deg); opacity: 0; }
        }
        /* 球體表面光暈浮動 */
        @keyframes adSphereShimmer {
          0%, 100% { opacity: 0.55; transform: scale(1) translate(0, 0); }
          50%       { opacity: 0.75; transform: scale(1.06) translate(2px, -2px); }
        }
        /* 底部陰影跟著球體脈動 */
        @keyframes adShadowPulse {
          0%, 100% { transform: translateX(-50%) scaleX(1);   opacity: 0.22; }
          50%       { transform: translateX(-50%) scaleX(0.88); opacity: 0.14; }
        }
        /* 標題文字金屬光掃過 */
        @keyframes adTitleShimmer {
          0%   { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        .ad-title-shimmer {
          background: linear-gradient(
            90deg,
            #fde68a 0%,
            #fff9e0 30%,
            #ffffff 45%,
            #fff9e0 60%,
            #fbbf24 80%,
            #fde68a 100%
          );
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: adTitleShimmer 3s linear infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .ad-sphere-inner   { animation: none !important; }
          .ad-sphere-shimmer { animation: none !important; }
          .ad-sphere-shadow  { animation: none !important; }
          .ad-title-shimmer  { animation: none !important; }
        }
      `}</style>

      {/* 外層：fixed 定位 + flex 置中 */}
      <div style={{
        position: "fixed",
        bottom: "calc(4.8rem + env(safe-area-inset-bottom, 0px))",
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        zIndex: 99995,
        pointerEvents: "none",
      }}>
        {/* 動畫層：鐘擺，transform-origin 頂部中央 */}
        <div
          className="ad-sphere-inner"
          style={{
            pointerEvents: "auto",
            transformOrigin: "top center",
            position: "relative",
            animation: visible
              ? "adBannerPendulum 3.8s ease-out both"
              : "adBannerFadeUp 0.4s ease-in both",
          }}
        >
          {/* ── 球體主體 ── */}
          <div style={{
            position: "relative",
            width: 190,
            height: 190,
            borderRadius: "50%",
            /* 模擬金色球體：光源在左上方，右下漸深 */
            background: `
              radial-gradient(
                circle at 36% 30%,
                #fff7c0 0%,
                #fde68a 18%,
                #f59e0b 42%,
                #d97706 65%,
                #92400e 88%,
                #78350f 100%
              )
            `,
            boxShadow: `
              0 24px 60px rgba(120, 60, 0, 0.55),
              0 8px 24px rgba(0, 0, 0, 0.35),
              inset 0 -12px 28px rgba(0, 0, 0, 0.30),
              inset 0 6px 18px rgba(255, 255, 220, 0.22)
            `,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px 18px 24px",
            overflow: "hidden",
            cursor: "default",
          }}>
            {/* 高光圓斑：模擬球體反射亮點 */}
            <div
              className="ad-sphere-shimmer"
              style={{
                position: "absolute",
                top: "13%",
                left: "18%",
                width: "46%",
                height: "32%",
                borderRadius: "50%",
                background: "radial-gradient(ellipse at 40% 40%, rgba(255,255,255,0.82) 0%, rgba(255,255,240,0.35) 55%, transparent 100%)",
                animation: "adSphereShimmer 3.5s ease-in-out infinite",
                pointerEvents: "none",
              }}
            />

            {/* 小高光：右上邊緣反射 */}
            <div style={{
              position: "absolute",
              top: "8%",
              right: "15%",
              width: "12%",
              height: "8%",
              borderRadius: "50%",
              background: "rgba(255,255,255,0.38)",
              pointerEvents: "none",
            }} />

            {/* 廣播圖示 */}
            <div style={{
              position: "relative",
              width: 34,
              height: 34,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.18)",
              border: "1px solid rgba(255,255,255,0.35)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 7,
              flexShrink: 0,
            }}>
              <Megaphone style={{ width: 16, height: 16, color: "#fff" }} />
            </div>

            {/* 文字區：無框，靠描邊+陰影從金球底色浮出 */}
            <div style={{
              position: "relative",
              textAlign: "center",
              maxWidth: 148,
            }}>
              {data.title && (
                <div
                  className="ad-title-shimmer"
                  style={{
                    fontWeight: 900,
                    fontSize: "13px",
                    lineHeight: 1.25,
                    letterSpacing: "0.07em",
                    marginBottom: data.body ? 6 : 0,
                    WebkitTextStroke: "0.6px rgba(60,20,0,0.7)",
                    filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.8)) drop-shadow(0 0 3px rgba(0,0,0,0.9))",
                  }}
                >
                  {data.title}
                </div>
              )}
              {data.title && data.body && (
                <div style={{
                  width: "65%",
                  height: 1,
                  margin: "0 auto 6px",
                  background: "linear-gradient(90deg, transparent, rgba(255,210,60,0.9), transparent)",
                }} />
              )}
              {data.body && (
                <div style={{
                  fontSize: "10.5px",
                  fontWeight: 700,
                  color: "#ffffff",
                  lineHeight: 1.5,
                  letterSpacing: "0.02em",
                  textShadow: [
                    "1px  1px 0 rgba(0,0,0,0.9)",
                    "-1px -1px 0 rgba(0,0,0,0.9)",
                    "1px -1px 0 rgba(0,0,0,0.9)",
                    "-1px  1px 0 rgba(0,0,0,0.9)",
                    "0 2px 8px rgba(0,0,0,0.95)",
                  ].join(", "),
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}>
                  {data.body}
                </div>
              )}
            </div>

            {/* 底部內陰影加深感 */}
            <div style={{
              position: "absolute",
              bottom: 0, left: 0, right: 0,
              height: "40%",
              borderRadius: "0 0 50% 50%",
              background: "linear-gradient(to top, rgba(0,0,0,0.20), transparent)",
              pointerEvents: "none",
            }} />
          </div>

          {/* 關閉按鈕：懸浮在球體右上方 */}
          <button
            onClick={handleDismiss}
            style={{
              position: "absolute",
              top: 6,
              right: 6,
              width: 24,
              height: 24,
              borderRadius: "50%",
              border: "1.5px solid rgba(255,255,255,0.6)",
              background: "rgba(120,53,15,0.75)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              backdropFilter: "blur(4px)",
              zIndex: 10,
            }}
            aria-label="關閉廣告"
          >
            <X style={{ width: 12, height: 12 }} />
          </button>

          {/* 球體落地陰影 */}
          <div
            className="ad-sphere-shadow"
            style={{
              position: "absolute",
              bottom: -10,
              left: "50%",
              transform: "translateX(-50%)",
              width: 130,
              height: 18,
              borderRadius: "50%",
              background: "rgba(120,53,15,0.28)",
              filter: "blur(8px)",
              animation: "adShadowPulse 3.5s ease-in-out infinite",
              pointerEvents: "none",
            }}
          />
        </div>
      </div>
    </>
  );
}
