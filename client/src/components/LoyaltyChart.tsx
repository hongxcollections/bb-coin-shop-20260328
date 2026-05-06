import { Medal, Crown, Clock, Sparkles, Bot, Gift, TrendingDown, Eye } from "lucide-react";

export type ChartKind =
  | "silver"
  | "gold"
  | "inactivity"
  | "cashback"
  | "preview"
  | "autobid"
  | "earlybird";

interface BarRow {
  label: string;
  value: number;
  display: string;
  color: string;
  emoji?: string;
}

interface LoyaltyConfigSubset {
  silverBidCount: number;
  silverWinCount: number;
  silver90DaySpend: number;
  goldWinCount: number;
  gold90DaySpend: number;
  inactivityDaysForDowngrade: number;
  silverCashbackRate: number;
  goldCashbackRate: number;
  vipCashbackRate: number;
  silverPreviewHours: number;
  goldPreviewHours: number;
  bronzeAutoBidQuota: number;
  silverAutoBidMaxAmount: number;
  earlyBirdEnabled: boolean;
  earlyBirdDailyQuota: number;
  earlyBirdTrialLevel: string;
  earlyBirdTrialDays: number;
}

function buildRows(kind: ChartKind, c: LoyaltyConfigSubset): { title: string; subtitle: string; icon: React.ReactNode; rows: BarRow[]; mode: "any" | "info" } {
  switch (kind) {
    case "silver":
      return {
        title: "🥈 銀牌升級門檻",
        subtitle: "達成以下任一條件即自動升銀牌",
        icon: <Medal className="w-5 h-5 text-slate-500" />,
        mode: "any",
        rows: [
          { label: "累積出價次數", value: c.silverBidCount, display: `${c.silverBidCount} 次`, color: "bg-slate-400" },
          { label: "累積成交次數", value: c.silverWinCount, display: `${c.silverWinCount} 次`, color: "bg-slate-500" },
          { label: "近 90 日競投總額", value: c.silver90DaySpend, display: `HK$${c.silver90DaySpend.toLocaleString()}`, color: "bg-slate-600" },
        ],
      };
    case "gold":
      return {
        title: "🥇 金牌升級門檻",
        subtitle: "達成以下任一條件即自動升金牌",
        icon: <Crown className="w-5 h-5 text-yellow-500" />,
        mode: "any",
        rows: [
          { label: "累積成交次數", value: c.goldWinCount, display: `${c.goldWinCount} 次`, color: "bg-yellow-400" },
          { label: "近 90 日競投總額", value: c.gold90DaySpend, display: `HK$${c.gold90DaySpend.toLocaleString()}`, color: "bg-yellow-500" },
        ],
      };
    case "inactivity":
      return {
        title: "降級規則",
        subtitle: "連續以下日數無出價 → 自動降回 🥉 銅牌",
        icon: <TrendingDown className="w-5 h-5 text-red-400" />,
        mode: "info",
        rows: c.inactivityDaysForDowngrade > 0
          ? [{ label: "無活動日數", value: c.inactivityDaysForDowngrade, display: `${c.inactivityDaysForDowngrade} 日`, color: "bg-red-400" }]
          : [{ label: "降級規則", value: 1, display: "已停用（不會因無活動降級）", color: "bg-emerald-400" }],
      };
    case "cashback":
      return {
        title: "Credit 回贈率",
        subtitle: "成交後按等級回贈 credit，即時可用喺下次競投",
        icon: <Sparkles className="w-5 h-5 text-emerald-500" />,
        mode: "info",
        rows: [
          { label: "🥈 銀牌", value: c.silverCashbackRate * 100, display: `${(c.silverCashbackRate * 100).toFixed(1)}%`, color: "bg-slate-400" },
          { label: "🥇 金牌", value: c.goldCashbackRate * 100, display: `${(c.goldCashbackRate * 100).toFixed(1)}%`, color: "bg-yellow-400" },
          { label: "💎 VIP", value: c.vipCashbackRate * 100, display: `${(c.vipCashbackRate * 100).toFixed(1)}%`, color: "bg-violet-500" },
        ],
      };
    case "preview":
      return {
        title: "拍賣提前預覽",
        subtitle: "未開始嘅拍賣，高等級會員可以提前睇到",
        icon: <Eye className="w-5 h-5 text-blue-500" />,
        mode: "info",
        rows: [
          { label: "🥈 銀牌", value: c.silverPreviewHours, display: `${c.silverPreviewHours} 小時前`, color: "bg-slate-400" },
          { label: "🥇 金牌 / 💎 VIP", value: c.goldPreviewHours, display: `${c.goldPreviewHours} 小時前`, color: "bg-yellow-400" },
        ],
      };
    case "autobid":
      return {
        title: "代理出價限制",
        subtitle: "金牌 / VIP 完全無限制",
        icon: <Bot className="w-5 h-5 text-indigo-500" />,
        mode: "info",
        rows: [
          { label: "🥉 銅牌每月次數", value: c.bronzeAutoBidQuota, display: c.bronzeAutoBidQuota > 0 ? `${c.bronzeAutoBidQuota} 次／月` : "唔可用", color: "bg-amber-700" },
          { label: "🥈 銀牌單次上限", value: c.silverAutoBidMaxAmount, display: c.silverAutoBidMaxAmount > 0 ? `HK$${c.silverAutoBidMaxAmount.toLocaleString()}` : "無上限", color: "bg-slate-500" },
        ],
      };
    case "earlybird":
      return {
        title: "🎁 新註冊早鳥試用",
        subtitle: c.earlyBirdEnabled ? "新註冊用戶可獲得限時試用高等級" : "目前已停用",
        icon: <Gift className="w-5 h-5 text-pink-500" />,
        mode: "info",
        rows: c.earlyBirdEnabled
          ? [
              { label: "每日名額", value: c.earlyBirdDailyQuota, display: `${c.earlyBirdDailyQuota} 名／日`, color: "bg-pink-400" },
              { label: "試用等級", value: 1, display: c.earlyBirdTrialLevel === "silver" ? "🥈 銀牌" : c.earlyBirdTrialLevel === "gold" ? "🥇 金牌" : "💎 VIP", color: "bg-pink-500" },
              { label: "試用期長度", value: c.earlyBirdTrialDays, display: `${c.earlyBirdTrialDays} 日`, color: "bg-pink-600" },
            ]
          : [{ label: "狀態", value: 1, display: "已停用", color: "bg-gray-400" }],
      };
  }
}

export function LoyaltyChart({ kind, config }: { kind: ChartKind; config: LoyaltyConfigSubset }) {
  const { title, subtitle, icon, rows, mode } = buildRows(kind, config);
  const maxVal = Math.max(...rows.map((r) => r.value), 1);
  const orJoin = mode === "any" && rows.length > 1;

  return (
    <div className="bg-white rounded-lg border border-amber-100 p-4 sm:p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <h3 className="font-bold text-base sm:text-lg text-amber-900">{title}</h3>
      </div>
      <p className="text-xs sm:text-sm text-muted-foreground mb-4">{subtitle}</p>

      <div className="space-y-3">
        {rows.map((r, idx) => {
          const widthPct = Math.min(100, Math.max(8, (r.value / maxVal) * 100));
          return (
            <div key={r.label}>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="font-medium text-gray-700">{r.label}</span>
                <span className="font-bold text-amber-900">{r.display}</span>
              </div>
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full ${r.color} rounded-full transition-all`}
                  style={{ width: `${widthPct}%` }}
                />
              </div>
              {orJoin && idx < rows.length - 1 && (
                <div className="text-center text-[10px] text-amber-500 font-bold mt-1.5 mb-0.5">或</div>
              )}
            </div>
          );
        })}
      </div>

      {mode === "any" && (
        <p className="mt-4 text-xs text-emerald-700 bg-emerald-50 rounded px-3 py-2">
          ✅ 達成任何<strong>一條</strong>即可升級，系統每次出價／成交後自動檢查
        </p>
      )}
    </div>
  );
}
