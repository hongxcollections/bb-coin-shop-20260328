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
      requestAnimationFrame(() => setVisible(true));
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
          0%   { transform: translateY(-120%); opacity: 0; }
          55%  { transform: translateY(8px);    opacity: 1; }
          72%  { transform: translateY(-5px);   opacity: 1; }
          85%  { transform: translateY(3px);    opacity: 1; }
          93%  { transform: translateY(-2px);   opacity: 1; }
          100% { transform: translateY(0);      opacity: 1; }
        }
        @keyframes adBannerRise {
          0%   { transform: translateY(0);      opacity: 1; }
          100% { transform: translateY(-130%);  opacity: 0; }
        }
      `}</style>

      <div
        style={{
          position: "fixed",
          bottom: "calc(4.5rem + env(safe-area-inset-bottom, 0px))",
          left: "50%",
          transform: "translateX(-50%)",
          width: "min(480px, 94vw)",
          zIndex: 99990,
          animation: visible
            ? "adBannerDrop 0.75s cubic-bezier(0.22, 1, 0.36, 1) forwards"
            : "adBannerRise 0.4s ease-in forwards",
        }}
      >
        <div
          style={{
            background: "linear-gradient(135deg, #fffbeb 0%, #fef3c7 60%, #fde68a 100%)",
            border: "1.5px solid #f59e0b",
            borderRadius: "16px",
            boxShadow: "0 8px 32px rgba(180,120,0,0.18), 0 2px 8px rgba(0,0,0,0.08)",
            padding: "14px 16px 14px 14px",
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
                  lineHeight: 1.3,
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
              padding: 4,
              borderRadius: "50%",
              border: "none",
              background: "rgba(180,120,0,0.1)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#b45309",
              marginTop: -2,
              marginRight: -4,
            }}
            aria-label="關閉廣告"
          >
            <X style={{ width: 14, height: 14 }} />
          </button>
        </div>
      </div>
    </>
  );
}
