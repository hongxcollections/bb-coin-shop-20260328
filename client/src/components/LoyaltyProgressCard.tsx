import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Award, Clock, CheckCircle2, Circle } from "lucide-react";

const LEVEL_DISPLAY: Record<string, { icon: string; label: string; color: string; bg: string }> = {
  bronze: { icon: "🥉", label: "銅牌會員", color: "text-amber-800", bg: "bg-amber-50 border-amber-200" },
  silver: { icon: "🥈", label: "銀牌會員", color: "text-slate-700", bg: "bg-slate-50 border-slate-300" },
  gold:   { icon: "🥇", label: "金牌會員", color: "text-yellow-800", bg: "bg-yellow-50 border-yellow-300" },
  vip:    { icon: "💎", label: "VIP 會員", color: "text-violet-700", bg: "bg-violet-50 border-violet-300" },
};

function daysUntil(date: Date | string | null | undefined): number {
  if (!date) return 0;
  const d = new Date(date);
  return Math.max(0, Math.ceil((d.getTime() - Date.now()) / (24 * 3600 * 1000)));
}

export function LoyaltyProgressCard() {
  const { data, isLoading } = trpc.loyalty.myStatus.useQuery();

  if (isLoading || !data) return null;

  const level = LEVEL_DISPLAY[data.currentLevel] ?? LEVEL_DISPLAY.bronze;
  const trialDays = data.trialExpiresAt ? daysUntil(data.trialExpiresAt as unknown as Date) : 0;

  return (
    <Card className={`mb-6 border-2 ${level.bg}`}>
      <CardHeader>
        <CardTitle className={`flex items-center gap-2 text-base ${level.color}`}>
          <Award className="w-4 h-4" />
          我嘅活動等級
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 當前等級 */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="text-3xl">{level.icon}</div>
          <div className="flex-1 min-w-0">
            <div className={`font-bold text-lg ${level.color}`}>{level.label}</div>
            {data.trialExpiresAt && (
              <div className="flex items-center gap-1.5 text-xs text-pink-700 mt-0.5">
                <Clock className="w-3.5 h-3.5" />
                🎁 早鳥試用中 · 仲剩 <span className="font-bold">{trialDays}</span> 日
              </div>
            )}
            {!data.trialExpiresAt && data.currentLevel !== "bronze" && (
              <div className="text-xs text-emerald-700 mt-0.5">✓ 永久等級（已達門檻）</div>
            )}
          </div>
        </div>

        {/* 統計 */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-white/80 rounded-lg p-2 border border-current/10">
            <div className="text-xs text-muted-foreground">累積出價</div>
            <div className="text-lg font-bold text-amber-700">{data.stats.totalBidCount}</div>
          </div>
          <div className="bg-white/80 rounded-lg p-2 border border-current/10">
            <div className="text-xs text-muted-foreground">累積成交</div>
            <div className="text-lg font-bold text-amber-700">{data.stats.totalWinCount}</div>
          </div>
          <div className="bg-white/80 rounded-lg p-2 border border-current/10">
            <div className="text-xs text-muted-foreground">近 90 日消費</div>
            <div className="text-lg font-bold text-amber-700">${data.stats.spend90Days.toLocaleString()}</div>
          </div>
        </div>

        {/* 下一級進度 */}
        {data.progress && data.nextLevel && (
          <div className="rounded-lg bg-white/90 border border-amber-200 p-3">
            <div className="text-sm font-semibold text-amber-900 mb-2">
              距離升 {LEVEL_DISPLAY[data.nextLevel]?.icon} {LEVEL_DISPLAY[data.nextLevel]?.label} 仲差：
            </div>
            <div className="space-y-1.5">
              {data.progress.conditions.map((c, i) => {
                const pct = c.target > 0 ? Math.min(100, Math.floor((c.current / c.target) * 100)) : 0;
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between text-xs mb-0.5">
                      <span className="flex items-center gap-1">
                        {c.done ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <Circle className="w-3.5 h-3.5 text-muted-foreground" />}
                        <span className={c.done ? "text-emerald-700 font-semibold" : ""}>{c.label}</span>
                      </span>
                      <span className="font-mono text-muted-foreground">
                        {c.current.toLocaleString()} / {c.target.toLocaleString()}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-amber-100 overflow-hidden">
                      <div
                        className={`h-full transition-all ${c.done ? "bg-emerald-500" : "bg-gradient-to-r from-amber-400 to-pink-400"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">達成任一條件即可升級，系統每次出價 / 成交後自動檢查</p>
          </div>
        )}

        {!data.progress && data.currentLevel === "gold" && (
          <div className="text-center text-sm text-yellow-800 py-2">🎉 你已經係金牌會員！VIP 等級由管理員授予高價值買家</div>
        )}
        {!data.progress && data.currentLevel === "vip" && (
          <div className="text-center text-sm text-violet-700 py-2">💎 你係 VIP 會員，尊貴禮遇！</div>
        )}
      </CardContent>
    </Card>
  );
}
