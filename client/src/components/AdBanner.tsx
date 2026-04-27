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
    setTimeout(() => setDismissed(true), 450);
    if (data) {
      const key = getDismissedKey(data.slot, data.targetType);
      sessionStorage.setItem(key, "1");
    }
  };

  if (!data || dismissed || !shown) return null;

  return (
    <>
      <style>{`
        @keyframes adBannerDrop {
          0%   { transform: translateY(-130%); opacity: 0; }
          40%  { transform: translateY(0);     opacity: 1; }
          55%  { transform: translateY(-28%);  opacity: 1; }
          68%  { transform: translateY(0);     opacity: 1; }
          78%  { transform: translateY(-13%);  opacity: 1; }
          88%  { transform: translateY(0);     opacity: 1; }
          94%  { transform: translateY(-5%);   opacity: 1; }
          100% { transform: translateY(0);     opacity: 1; }
        }
        @keyframes adBannerRise {
          0%   { transform: translateY(0);     opacity: 1; }
          100% { transform: translateY(-130%); opacity: 0; }
        }
      `}</style>

      {/*
        外層：fixed 定位 + flex 水平置中
        不用 transform: translateX(-50%) — 這樣 animation 才不會搶走置中效果
      */}
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
        {/* 內層：限寬 + 動畫（transform 只在這裡）*/}
        <div
          style={{
            width: "100%",
            maxWidth: 480,
            pointerEvents: "auto",
            animation: visible
              ? "adBannerDrop 1.1s linear both"
              : "adBannerRise 0.35s ease-in both",
          }}
        >
          <div
            style={{
              background: "linear-gradient(135deg, #fffbeb 0%, #fef3c7 60%, #fde68a 100%)",
              border: "1.5px solid #f59e0b",
              borderRadius: "16px",
              boxShadow: "0 8px 32px rgba(180,120,0,0.18), 0 2px 8px rgba(0,0,0,0.10)",
              padding: "14px 14px 14px 14px",
              display: "flex",
              alignItems: "flex-start",
              gap: "10px",
            }}
          >
            {/* Icon */}
            <div
              style={{
                flexShrink: 0,
                width: 34,
                height: 34,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #f59e0b, #d97706)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginTop: 1,
              }}
            >
              <Megaphone style={{ width: 16, height: 16, color: "#fff" }} />
            </div>

            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
              {data.title && (
                <div
                  style={{
                    fontWeight: 600,
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
                flexShrink: 0,
                padding: 5,
                borderRadius: "50%",
                border: "none",
                background: "rgba(180,120,0,0.12)",
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
