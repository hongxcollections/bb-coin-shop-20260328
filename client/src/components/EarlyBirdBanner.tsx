import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Gift, Sparkles } from "lucide-react";

const LEVEL_LABEL: Record<string, string> = {
  silver: "🥈 銀牌",
  gold: "🥇 金牌",
  vip: "💎 VIP",
};

/**
 * 首頁早鳥名額 banner：
 * - 只對未登入用戶 或 無試用嘅用戶顯示
 * - 顯示今日剩餘名額 + 試用等級 + 試用日數
 */
export default function EarlyBirdBanner() {
  const { user, isAuthenticated } = useAuth();
  const { data } = trpc.loyalty.earlyBirdStatus.useQuery(undefined, {
    refetchInterval: 5 * 60 * 1000, // 每 5 分鐘更新
  });

  if (!data || !data.enabled) return null;
  if (data.remaining <= 0) return null;

  // 已登入用戶如果已經係 silver 以上，唔再推
  const userLevel = (user as { memberLevel?: string } | null)?.memberLevel;
  if (isAuthenticated && userLevel && userLevel !== "bronze") return null;

  const levelLabel = LEVEL_LABEL[data.trialLevel] || data.trialLevel;

  return (
    <div className="container py-3">
      <div className="relative overflow-hidden rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50 via-pink-50 to-amber-50 px-4 py-3 shadow-sm">
        <div className="absolute -right-6 -top-6 opacity-20">
          <Sparkles className="w-24 h-24 text-amber-400" />
        </div>
        <div className="relative flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-pink-400 to-amber-400 flex items-center justify-center">
              <Gift className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-sm font-bold text-amber-900">
                🎁 每日早鳥會員 · 今日仲剩 <span className="text-pink-600">{data.remaining}</span> / {data.total} 個名額！
              </div>
              <div className="text-xs text-amber-700 mt-0.5">
                新註冊即享 <span className="font-semibold">{levelLabel} {data.trialDays} 日試用</span>
                ，先到先得
              </div>
            </div>
          </div>
          {!isAuthenticated && (
            <a
              href={getLoginUrl()}
              className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-amber-500 to-pink-500 hover:from-amber-600 hover:to-pink-600 px-4 py-2 text-sm font-semibold text-white shadow-md transition-all"
            >
              立即登入領取
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
