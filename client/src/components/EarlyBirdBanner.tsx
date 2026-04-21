import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Gift, Sparkles, Flame } from "lucide-react";

const LEVEL_LABEL: Record<string, string> = {
  silver: "🥈 銀牌",
  gold: "🥇 金牌",
  vip: "💎 VIP",
};

export default function EarlyBirdBanner() {
  const { user, isAuthenticated } = useAuth();
  const { data } = trpc.loyalty.earlyBirdStatus.useQuery(undefined, {
    refetchInterval: 5 * 60 * 1000,
  });

  if (!data || !data.enabled) return null;
  if (data.remaining <= 0) return null;

  const userLevel = (user as { memberLevel?: string } | null)?.memberLevel;
  if (isAuthenticated && userLevel && userLevel !== "bronze") return null;

  const levelLabel = LEVEL_LABEL[data.trialLevel] || data.trialLevel;
  const isHot = data.remaining <= Math.max(3, Math.floor(data.total * 0.3));

  return (
    <div className="container py-3">
      <style>{`
        @keyframes eb-shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes eb-float {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-3px) rotate(-6deg); }
        }
        @keyframes eb-pulse-ring {
          0% { box-shadow: 0 0 0 0 rgba(244, 114, 182, 0.55); }
          70% { box-shadow: 0 0 0 12px rgba(244, 114, 182, 0); }
          100% { box-shadow: 0 0 0 0 rgba(244, 114, 182, 0); }
        }
        @keyframes eb-sparkle-spin {
          from { transform: rotate(0deg) scale(1); opacity: 0.18; }
          50% { transform: rotate(180deg) scale(1.1); opacity: 0.32; }
          to { transform: rotate(360deg) scale(1); opacity: 0.18; }
        }
        @keyframes eb-num-bounce {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.18); }
        }
        @keyframes eb-fire-flicker {
          0%, 100% { transform: scale(1) rotate(-5deg); opacity: 1; }
          50% { transform: scale(1.15) rotate(5deg); opacity: 0.85; }
        }
        @keyframes eb-btn-glow {
          0%, 100% { box-shadow: 0 4px 12px rgba(244, 114, 182, 0.35), 0 0 0 0 rgba(251, 191, 36, 0); }
          50% { box-shadow: 0 6px 20px rgba(244, 114, 182, 0.55), 0 0 0 6px rgba(251, 191, 36, 0.15); }
        }
        .eb-banner {
          background: linear-gradient(110deg, #fef3c7 0%, #fce7f3 35%, #fef3c7 50%, #fce7f3 65%, #fef3c7 100%);
          background-size: 200% 100%;
          animation: eb-shimmer 6s linear infinite;
        }
        .eb-icon-wrap { animation: eb-pulse-ring 2.2s ease-out infinite; }
        .eb-gift { animation: eb-float 2.6s ease-in-out infinite; transform-origin: center; }
        .eb-sparkle { animation: eb-sparkle-spin 8s linear infinite; }
        .eb-num { display: inline-block; animation: eb-num-bounce 1.6s ease-in-out infinite; }
        .eb-fire { animation: eb-fire-flicker 0.9s ease-in-out infinite; transform-origin: center; }
        .eb-btn { animation: eb-btn-glow 2s ease-in-out infinite; transition: transform 0.2s ease; }
        .eb-btn:hover { transform: scale(1.06); }
        .eb-btn:active { transform: scale(0.98); }
        @media (prefers-reduced-motion: reduce) {
          .eb-banner, .eb-icon-wrap, .eb-gift, .eb-sparkle, .eb-num, .eb-fire, .eb-btn {
            animation: none !important;
          }
        }
      `}</style>
      <div className="eb-banner relative overflow-hidden rounded-xl border border-amber-200 px-4 py-3 shadow-sm">
        <div className="eb-sparkle absolute -right-6 -top-6 pointer-events-none">
          <Sparkles className="w-24 h-24 text-amber-400" />
        </div>
        <div className="eb-sparkle absolute -left-4 -bottom-4 pointer-events-none" style={{ animationDuration: "11s", animationDirection: "reverse" }}>
          <Sparkles className="w-16 h-16 text-pink-400" />
        </div>
        <div className="relative flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="eb-icon-wrap shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-pink-400 to-amber-400 flex items-center justify-center">
              <Gift className="eb-gift w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-sm font-bold text-amber-900 flex items-center gap-1.5 flex-wrap">
                {isHot && <Flame className="eb-fire w-4 h-4 text-red-500" />}
                <span>🎁 每日早鳥會員 · 今日仲剩</span>
                <span className="eb-num text-pink-600 font-extrabold text-base">{data.remaining}</span>
                <span>/ {data.total} 個名額！</span>
              </div>
              <div className="text-xs text-amber-700 mt-0.5">
                新註冊即享 <span className="font-semibold">{levelLabel} {data.trialDays} 日試用</span>
                ，先到先得
              </div>
            </div>
          </div>
          {!isAuthenticated && (
            <a
              href="/login?mode=register&method=phone"
              className="eb-btn ml-auto shrink-0 inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-amber-500 to-pink-500 hover:from-amber-600 hover:to-pink-600 px-4 py-2 text-sm font-semibold text-white"
            >
              立即註冊領取 →
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
