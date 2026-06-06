import { useState, useMemo, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import Header from "@/components/Header";
import { useLocation } from "wouter";
import { Store, ChevronLeft, Sparkles } from "lucide-react";
import { parseCategories } from "@/lib/utils";

const CATEGORY_COLORS: Record<string, string> = {
  "香港硬幣": "#f59e0b",
  "中國硬幣": "#ef4444",
  "外國硬幣": "#3b82f6",
  "紀念幣": "#8b5cf6",
  "銀幣": "#94a3b8",
  "金幣": "#eab308",
  "紙幣": "#10b981",
  "古錢": "#f97316",
};

function getCategoryColor(cat: string): string {
  return CATEGORY_COLORS[cat.trim()] ?? "#94a3b8";
}

const SHELF_ROWS = 3;

function GlassCase({
  merchant,
  onClick,
  index,
}: {
  merchant: any;
  onClick: () => void;
  index: number;
}) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const cats = useMemo(() => parseCategories(merchant.categories ?? "").slice(0, 2), [merchant.categories]);
  const firstCat = cats[0] ?? "";
  const catColor = getCategoryColor(firstCat);
  const initials = (merchant.merchantName ?? "?").slice(0, 2);

  const scale = pressed ? 0.94 : hovered ? 1.06 : 1;
  const tz = pressed ? 2 : hovered ? 18 : 0;

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => setPressed(false)}
      style={{
        transform: `scale(${scale}) translateZ(${tz}px)`,
        transition: "transform 0.18s cubic-bezier(.34,1.56,.64,1)",
        willChange: "transform",
        animationDelay: `${index * 40}ms`,
      }}
      className="relative cursor-pointer select-none group animate-fadeIn"
    >
      {/* Glass case outer frame */}
      <div
        style={{
          background: "linear-gradient(145deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.04) 100%)",
          border: "1px solid rgba(255,255,255,0.18)",
          borderBottom: "2px solid rgba(255,255,255,0.08)",
          boxShadow: hovered
            ? `0 0 0 1.5px ${catColor}66, 0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.2)`
            : "0 4px 16px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.12)",
          borderRadius: "10px",
          overflow: "hidden",
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
          transition: "box-shadow 0.18s ease",
        }}
      >
        {/* Top shine strip */}
        <div style={{
          height: "3px",
          background: `linear-gradient(90deg, transparent, ${catColor}99, transparent)`,
          opacity: hovered ? 1 : 0.4,
          transition: "opacity 0.18s ease",
        }} />

        {/* Case content */}
        <div className="p-2.5 flex flex-col items-center gap-1.5">
          {/* Merchant icon */}
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 10,
              overflow: "hidden",
              border: `1.5px solid ${catColor}55`,
              boxShadow: `0 2px 8px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.06)`,
              flexShrink: 0,
              background: "rgba(0,0,0,0.3)",
            }}
          >
            {merchant.merchantIcon ? (
              <img
                src={merchant.merchantIcon}
                alt={merchant.merchantName}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                loading="lazy"
              />
            ) : (
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: `linear-gradient(135deg, ${catColor}44, ${catColor}22)`,
                  fontSize: 18,
                  fontWeight: 700,
                  color: catColor,
                  letterSpacing: "-0.02em",
                }}
              >
                {initials}
              </div>
            )}
          </div>

          {/* Name */}
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "rgba(255,255,255,0.92)",
              textAlign: "center",
              lineHeight: 1.3,
              maxWidth: "100%",
              overflow: "hidden",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
            }}
          >
            {merchant.merchantName}
          </div>

          {/* Category tags */}
          <div className="flex flex-wrap gap-1 justify-center">
            {cats.map((c: string) => (
              <span
                key={c}
                style={{
                  fontSize: 9,
                  fontWeight: 600,
                  color: getCategoryColor(c),
                  background: `${getCategoryColor(c)}22`,
                  border: `1px solid ${getCategoryColor(c)}44`,
                  borderRadius: 4,
                  padding: "1px 4px",
                  letterSpacing: "0.02em",
                  whiteSpace: "nowrap",
                }}
              >
                {c}
              </span>
            ))}
          </div>
        </div>

        {/* Bottom glass reflection */}
        <div style={{
          height: 2,
          background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)",
        }} />
      </div>

      {/* Cell number label (bottom right, like real store) */}
      <div
        style={{
          position: "absolute",
          bottom: -1,
          right: 4,
          fontSize: 8,
          color: "rgba(255,255,255,0.25)",
          fontFamily: "monospace",
          letterSpacing: "0.05em",
        }}
      >
        #{String(index + 1).padStart(2, "0")}
      </div>
    </div>
  );
}

function ShelfRow({ children, rowIndex }: { children: React.ReactNode; rowIndex: number }) {
  return (
    <div style={{ position: "relative" }}>
      {/* Shelf board */}
      <div
        style={{
          height: 8,
          background: "linear-gradient(180deg, #4a3728 0%, #2d1f14 60%, #1a110a 100%)",
          borderTop: "1px solid rgba(255,220,100,0.2)",
          borderBottom: "1px solid rgba(0,0,0,0.6)",
          boxShadow: "0 3px 8px rgba(0,0,0,0.5)",
          marginBottom: 0,
        }}
      />
      {/* Shelf content */}
      <div
        style={{
          background: "linear-gradient(180deg, rgba(30,18,8,0.6) 0%, rgba(20,12,4,0.4) 100%)",
          paddingTop: 12,
          paddingBottom: 14,
          paddingLeft: 8,
          paddingRight: 8,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 8,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export default function VirtualStore() {
  const { data: merchants = [], isLoading } = trpc.merchants.listApprovedMerchants.useQuery();
  const [, navigate] = useLocation();
  const [tiltX, setTiltX] = useState(0);
  const [tiltY, setTiltY] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOrientation = (e: DeviceOrientationEvent) => {
      const beta = e.beta ?? 0;
      const gamma = e.gamma ?? 0;
      setTiltX(Math.max(-6, Math.min(6, (beta - 30) * 0.15)));
      setTiltY(Math.max(-4, Math.min(4, gamma * 0.1)));
    };
    window.addEventListener("deviceorientation", handleOrientation, { passive: true });
    return () => window.removeEventListener("deviceorientation", handleOrientation);
  }, []);

  const rows: any[][] = useMemo(() => {
    const result: any[][] = [];
    const perRow = 3;
    for (let i = 0; i < merchants.length; i += perRow) {
      result.push(merchants.slice(i, i + perRow));
    }
    return result;
  }, [merchants]);

  return (
    <div
      className="min-h-screen pb-20"
      style={{
        background: "linear-gradient(180deg, #0d0705 0%, #1a0e06 40%, #0d0705 100%)",
        overflowX: "hidden",
      }}
    >
      <Header />

      {/* Store header */}
      <div
        style={{
          background: "linear-gradient(180deg, rgba(0,0,0,0.8) 0%, transparent 100%)",
          padding: "16px 16px 12px",
        }}
      >
        <div className="container max-w-2xl mx-auto">
          <button
            onClick={() => navigate("/merchants")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              color: "rgba(255,255,255,0.5)",
              fontSize: 12,
              marginBottom: 10,
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
            }}
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            返回商戶列表
          </button>

          <div className="flex items-center gap-3">
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: "linear-gradient(135deg, #d97706, #92400e)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 0 16px rgba(217,119,6,0.4)",
                flexShrink: 0,
              }}
            >
              <Store className="w-5 h-5 text-white" />
            </div>
            <div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: "rgba(255,255,255,0.95)",
                  letterSpacing: "-0.02em",
                }}
              >
                虛擬格仔鋪
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,200,80,0.7)", marginTop: 1 }}>
                {isLoading ? "載入中..." : `共 ${merchants.length} 個格主  |  點擊格仔進入商戶主頁`}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3D store floor */}
      <div
        className="container max-w-2xl mx-auto"
        style={{ padding: "0 0 16px" }}
      >
        {/* Ceiling light strip */}
        <div
          style={{
            height: 3,
            background: "linear-gradient(90deg, transparent 5%, rgba(255,240,180,0.4) 30%, rgba(255,255,220,0.7) 50%, rgba(255,240,180,0.4) 70%, transparent 95%)",
            marginBottom: 0,
            borderRadius: "0 0 4px 4px",
            boxShadow: "0 0 20px rgba(255,240,150,0.3)",
          }}
        />

        {/* Perspective wrapper */}
        <div
          ref={containerRef}
          style={{
            perspective: "900px",
            perspectiveOrigin: "50% 0%",
          }}
        >
          <div
            style={{
              transform: `rotateX(${8 + tiltX}deg) rotateY(${tiltY}deg)`,
              transformOrigin: "50% 0%",
              transformStyle: "preserve-3d",
              transition: "transform 0.3s ease-out",
            }}
          >
            {isLoading ? (
              <div style={{ padding: 40, textAlign: "center" }}>
                <div
                  style={{
                    display: "inline-block",
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    border: "2px solid rgba(217,119,6,0.3)",
                    borderTopColor: "#d97706",
                    animation: "spin 0.8s linear infinite",
                  }}
                />
              </div>
            ) : merchants.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: "rgba(255,255,255,0.4)", fontSize: 14 }}>
                暫時未有商戶進駐
              </div>
            ) : (
              rows.map((row, rowIndex) => (
                <ShelfRow key={rowIndex} rowIndex={rowIndex}>
                  {row.map((m: any, colIndex: number) => (
                    <GlassCase
                      key={m.userId}
                      merchant={m}
                      index={rowIndex * 3 + colIndex}
                      onClick={() => navigate(`/merchants/${m.userId}`)}
                    />
                  ))}
                  {/* Fill empty cells in last row */}
                  {row.length < 3 &&
                    Array.from({ length: 3 - row.length }).map((_, i) => (
                      <div key={`empty-${i}`} style={{ opacity: 0.15 }}>
                        <div
                          style={{
                            border: "1px dashed rgba(255,255,255,0.12)",
                            borderRadius: 10,
                            height: 120,
                            background: "rgba(255,255,255,0.02)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>空置</span>
                        </div>
                      </div>
                    ))}
                </ShelfRow>
              ))
            )}

            {/* Floor */}
            <div
              style={{
                height: 16,
                background: "linear-gradient(180deg, #2d1f14 0%, #1a110a 100%)",
                borderTop: "2px solid rgba(255,220,100,0.15)",
              }}
            />
          </div>
        </div>

        {/* Ambient floor glow */}
        <div
          style={{
            height: 40,
            background: "linear-gradient(180deg, rgba(180,120,40,0.06) 0%, transparent 100%)",
            marginTop: -8,
          }}
        />

        {/* Footer note */}
        <div
          style={{
            textAlign: "center",
            fontSize: 11,
            color: "rgba(255,255,255,0.2)",
            padding: "8px 16px 0",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
          }}
        >
          <Sparkles className="w-3 h-3" />
          手機傾斜可感受立體效果
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fadeIn { animation: fadeIn 0.4s ease both; }
      `}</style>
    </div>
  );
}
