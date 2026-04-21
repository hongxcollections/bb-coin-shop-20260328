import { useEffect, useMemo, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Sparkles, Gift, Clock } from "lucide-react";
import { toast } from "sonner";

const SLICE_COUNT = 8;
const SIZE = 280;
const RADIUS = SIZE / 2;
const CENTER = SIZE / 2;

function polar(angleDeg: number, r: number) {
  const a = (angleDeg - 90) * (Math.PI / 180);
  return { x: CENTER + r * Math.cos(a), y: CENTER + r * Math.sin(a) };
}

function arcPath(startAngle: number, endAngle: number) {
  const s = polar(startAngle, RADIUS);
  const e = polar(endAngle, RADIUS);
  const large = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${CENTER} ${CENTER} L ${s.x} ${s.y} A ${RADIUS} ${RADIUS} 0 ${large} 1 ${e.x} ${e.y} Z`;
}

export function LuckyWheel() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const { data: prizes } = trpc.spin.prizes.useQuery();
  const { data: status } = trpc.spin.status.useQuery(undefined, {
    enabled: !!user,
    refetchInterval: 60_000,
  });

  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [resultPrize, setResultPrize] = useState<{ label: string; emoji: string } | null>(null);
  const [countdown, setCountdown] = useState<string>("");
  const animRef = useRef<number | null>(null);

  const sliceAngle = 360 / SLICE_COUNT;

  // 倒數重置時間
  useEffect(() => {
    if (!status?.nextResetAt) return;
    const tick = () => {
      const ms = new Date(status.nextResetAt!).getTime() - Date.now();
      if (ms <= 0) {
        setCountdown("已可重抽");
        utils.spin.status.invalidate();
        return;
      }
      const h = Math.floor(ms / 3600_000);
      const m = Math.floor((ms % 3600_000) / 60_000);
      const s = Math.floor((ms % 60_000) / 1000);
      setCountdown(`${h}時 ${m.toString().padStart(2, "0")}分 ${s.toString().padStart(2, "0")}秒`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [status?.nextResetAt, utils]);

  // 已經抽過：將指針轉到該獎品位置（無動畫）
  useEffect(() => {
    if (status?.spunToday && status.prizeIndex != null && !spinning) {
      const targetCenter = status.prizeIndex * sliceAngle + sliceAngle / 2;
      setRotation(360 - targetCenter);
    }
  }, [status?.spunToday, status?.prizeIndex, sliceAngle, spinning]);

  const spinMutation = trpc.spin.spin.useMutation({
    onSuccess: (data) => {
      const targetCenter = data.prizeIndex * sliceAngle + sliceAngle / 2;
      // 轉 5 圈再對準獎品中心，指針喺 12 點，所以最終 rotation = 360*5 - targetCenter
      const final = 360 * 5 + (360 - targetCenter);
      setRotation(final);
      // 等動畫結束後彈結果
      if (animRef.current) clearTimeout(animRef.current);
      animRef.current = window.setTimeout(() => {
        setResultPrize({ label: data.prize.label, emoji: data.prize.emoji });
        setSpinning(false);
        utils.spin.status.invalidate();
        utils.spin.history.invalidate();
        if (data.prize.id.startsWith("nothing")) {
          toast(`${data.prize.emoji} ${data.prize.label}`, {
            description: "明天再嚟啦！",
            className: "bb-toast-success",
            duration: 6000,
          });
        } else {
          toast(`🎉 恭喜中獎！`, {
            description: `${data.prize.emoji} ${data.prize.label}`,
            className: "bb-toast-success",
            duration: 8000,
          });
        }
      }, 4200);
    },
    onError: (err) => {
      setSpinning(false);
      toast.error(err.message ?? "抽獎失敗，請稍後再試");
    },
  });

  const handleSpin = () => {
    if (!user) {
      // 未登入 → 直接 redirect 去 OAuth login
      window.location.href = getLoginUrl();
      return;
    }
    if (status?.spunToday) {
      toast(`今日已抽過 ${status.prize?.emoji ?? "🎁"} ${status.prize?.label ?? ""}`, {
        description: `下次重抽：${countdown}`,
        className: "bb-toast-success",
        duration: 5000,
      });
      return;
    }
    setSpinning(true);
    setResultPrize(null);
    spinMutation.mutate();
  };

  const slices = useMemo(() => {
    if (!prizes) return [];
    return prizes.slice(0, SLICE_COUNT).map((p, i) => {
      const start = i * sliceAngle - 90;
      const end = (i + 1) * sliceAngle - 90;
      const labelAngle = start + sliceAngle / 2;
      const labelPos = polar(labelAngle + 90, RADIUS * 0.62);
      return { p, start: start + 90, end: end + 90, labelAngle, labelPos };
    });
  }, [prizes, sliceAngle]);

  const buttonLabel = !user
    ? "登入即玩"
    : spinning
    ? "抽緊獎…"
    : status?.spunToday
    ? "明日再嚟"
    : "免費抽獎";

  const disabled = spinning || (!!user && !!status?.spunToday);

  return (
    <section className="py-4">
      <div className="container max-w-md mx-auto">
        <div
          className="rounded-3xl p-5 shadow-xl border-2 border-amber-200 relative overflow-hidden"
          style={{
            background: "linear-gradient(135deg, #fff7e6 0%, #fef3c7 50%, #fed7aa 100%)",
          }}
        >
          {/* 標題 */}
          <div className="flex items-center justify-center gap-2 mb-1">
            <Sparkles className="w-5 h-5 text-amber-600" />
            <h2 className="text-xl font-extrabold text-amber-800 tracking-wider">
              每日免費抽獎
            </h2>
            <Sparkles className="w-5 h-5 text-amber-600" />
          </div>
          <p className="text-center text-xs text-amber-700/80 mb-4">
            {!user
              ? "登入即可參加，每日 1 次免費機會"
              : status?.spunToday
              ? `今日已抽，重置：${countdown}`
              : "今日仲未抽！轉一轉贏好禮 🎁"}
          </p>

          {/* 轉盤 */}
          <div className="relative mx-auto" style={{ width: SIZE, height: SIZE }}>
            {/* 外環光暈 */}
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background: "radial-gradient(circle, rgba(252,211,77,0.6) 0%, transparent 70%)",
                filter: "blur(20px)",
              }}
            />
            {/* 指針 (固定在頂部) */}
            <div
              className="absolute left-1/2 -translate-x-1/2 z-20"
              style={{ top: -12 }}
            >
              <svg width="36" height="46" viewBox="0 0 36 46">
                <defs>
                  <linearGradient id="pointer-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#fbbf24" />
                    <stop offset="1" stopColor="#b45309" />
                  </linearGradient>
                </defs>
                <path d="M18 46 L4 14 Q18 0 32 14 Z" fill="url(#pointer-grad)" stroke="#78350f" strokeWidth="2" />
                <circle cx="18" cy="14" r="3" fill="#fef3c7" />
              </svg>
            </div>

            {/* SVG 轉盤本身 */}
            <svg
              width={SIZE}
              height={SIZE}
              viewBox={`0 0 ${SIZE} ${SIZE}`}
              className="relative z-10 drop-shadow-2xl"
              style={{
                transform: `rotate(${rotation}deg)`,
                transition: spinning
                  ? "transform 4s cubic-bezier(0.17, 0.67, 0.21, 0.99)"
                  : "none",
              }}
            >
              {/* 外環 */}
              <circle cx={CENTER} cy={CENTER} r={RADIUS - 1} fill="none" stroke="#b45309" strokeWidth="3" />
              {/* 扇形 */}
              {slices.map(({ p, start, end, labelAngle, labelPos }, i) => (
                <g key={p.id}>
                  <path d={arcPath(start, end)} fill={p.color} stroke="#fff" strokeWidth="2" />
                  <g transform={`rotate(${labelAngle + 90} ${labelPos.x} ${labelPos.y})`}>
                    <text
                      x={labelPos.x}
                      y={labelPos.y - 6}
                      textAnchor="middle"
                      fontSize="22"
                    >
                      {p.emoji}
                    </text>
                    <text
                      x={labelPos.x}
                      y={labelPos.y + 14}
                      textAnchor="middle"
                      fontSize="10"
                      fontWeight="700"
                      fill={p.textColor}
                    >
                      {p.label}
                    </text>
                  </g>
                </g>
              ))}
              {/* 中心圓 */}
              <circle cx={CENTER} cy={CENTER} r="32" fill="#78350f" stroke="#fef3c7" strokeWidth="3" />
            </svg>

            {/* 中央按鈕（覆蓋喺中心圓上） */}
            <button
              onClick={handleSpin}
              disabled={disabled}
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-30 w-16 h-16 rounded-full text-white font-extrabold text-xs shadow-lg transition-all disabled:opacity-70 active:scale-95"
              style={{
                background: disabled
                  ? "linear-gradient(135deg, #6b7280 0%, #374151 100%)"
                  : "linear-gradient(135deg, #f59e0b 0%, #b45309 100%)",
                border: "3px solid #fef3c7",
              }}
            >
              {buttonLabel.split("").length > 4 ? (
                <span className="leading-tight block">{buttonLabel}</span>
              ) : (
                buttonLabel
              )}
            </button>
          </div>

          {/* 結果 / 倒數 */}
          {resultPrize && (
            <div className="mt-4 text-center bg-white/70 backdrop-blur rounded-xl p-3 border border-amber-200">
              <div className="text-3xl mb-1">{resultPrize.emoji}</div>
              <div className="font-bold text-amber-800">{resultPrize.label}</div>
              {!resultPrize.label.includes("接再") && !resultPrize.label.includes("明日") && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  獎品已記錄，將由客服處理發放
                </p>
              )}
            </div>
          )}
          {user && status?.spunToday && !resultPrize && (
            <div className="mt-4 flex items-center justify-center gap-2 text-xs text-amber-700/90 bg-white/60 rounded-full py-2 px-4">
              <Clock className="w-3.5 h-3.5" />
              <span>下次抽獎：{countdown}</span>
            </div>
          )}

          {/* 未登入 CTA */}
          {!user && (
            <div className="mt-4 text-center">
              <div className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-800 bg-white/80 px-3 py-1.5 rounded-full border border-amber-200">
                <Gift className="w-3.5 h-3.5" />
                <span>新會員額外有禮，立即登入！</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
