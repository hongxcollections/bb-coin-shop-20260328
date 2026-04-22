import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Gift, Sparkles, Flame, Lightbulb, Bell, Bot, Shield, Mail, Clock, CheckCircle2, BadgeCheck, Lock, X } from "lucide-react";

const LEVEL_LABEL: Record<string, string> = {
  silver: "🥈 銀牌",
  gold: "🥇 金牌",
  vip: "💎 VIP",
};

const SILVER_PERKS = [
  {
    icon: <Bell className="w-5 h-5 text-indigo-500" />,
    title: "瀏覽器即時推播通知",
    badge: "銀牌獨有",
    badgeColor: "bg-indigo-100 text-indigo-700",
    desc: "有人出價？毋須打開電郵 — 瀏覽器秒級彈出通知，讓你第一時間知悉，絕不錯失任何競標機會。",
  },
  {
    icon: <Bot className="w-5 h-5 text-emerald-500" />,
    title: "代理出價自動跟標",
    badge: "省時省力",
    badgeColor: "bg-emerald-100 text-emerald-700",
    desc: "設定你願意出的最高價，系統自動代你一口一口跟，每次只出剛好超越對手的最低金額，守住領先位置。",
  },
  {
    icon: <Shield className="w-5 h-5 text-orange-500" />,
    title: "防截標延時保護",
    badge: "反狙擊",
    badgeColor: "bg-orange-100 text-orange-700",
    desc: "拍賣尾聲若有人出價，系統自動延長倒計時，杜絕「最後一秒狙擊」，公平決出勝負。",
  },
  {
    icon: <Mail className="w-5 h-5 text-pink-500" />,
    title: "被超標即時電郵通知",
    badge: "全等級享有",
    badgeColor: "bg-gray-100 text-gray-600",
    desc: "對手超過你的出價時，即時收到電郵通知，讓你決定是否繼續競標，絕不被蒙在鼓裡。",
  },
  {
    icon: <Clock className="w-5 h-5 text-amber-500" />,
    title: "拍賣即將結束提醒",
    badge: "全等級享有",
    badgeColor: "bg-gray-100 text-gray-600",
    desc: "拍賣結束前自動發送提醒，確保你不會因一時忙碌而錯過最後出價時機。",
  },
  {
    icon: <CheckCircle2 className="w-5 h-5 text-teal-500" />,
    title: "得標確認通知",
    badge: "全等級享有",
    badgeColor: "bg-gray-100 text-gray-600",
    desc: "成功得標後即時收到恭賀通知，內含商品資訊、成交價及後續付款交收指引，一步到位。",
  },
  {
    icon: <BadgeCheck className="w-5 h-5 text-slate-500" />,
    title: "銀牌專屬橫幅與徽章",
    badge: "身份象徵",
    badgeColor: "bg-slate-100 text-slate-700",
    desc: "個人資料頁頂部展示銀牌漸層橫幅，名字旁顯示尊榮銀牌徽章，讓其他藏家一眼認出你的身份。",
  },
  {
    icon: <Lock className="w-5 h-5 text-blue-500" />,
    title: "交易記錄永久保存",
    badge: "全等級享有",
    badgeColor: "bg-gray-100 text-gray-600",
    desc: "所有出價及得標記錄永久儲存，隨時查閱，可作收藏品來源憑證或個人收藏檔案。",
  },
];

export default function EarlyBirdBanner() {
  const { isAuthenticated } = useAuth();
  const { data } = trpc.loyalty.earlyBirdStatus.useQuery(undefined, {
    refetchInterval: 5 * 60 * 1000,
  });
  const [open, setOpen] = useState(false);

  if (!data || !data.enabled) return null;
  if (data.remaining <= 0) return null;

  if (isAuthenticated) return null;

  const levelLabel = LEVEL_LABEL[data.trialLevel] || data.trialLevel;
  const isHot = data.remaining <= Math.max(3, Math.floor(data.total * 0.3));

  return (
    <>
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
          @keyframes eb-bulb-pulse {
            0%, 100% { box-shadow: 0 0 0 0 rgba(251, 191, 36, 0.5); }
            50% { box-shadow: 0 0 0 6px rgba(251, 191, 36, 0); }
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
          .eb-bulb { animation: eb-bulb-pulse 2s ease-in-out infinite; }
          @media (prefers-reduced-motion: reduce) {
            .eb-banner, .eb-icon-wrap, .eb-gift, .eb-sparkle, .eb-num, .eb-fire, .eb-btn, .eb-bulb {
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
                <div className="text-xs text-amber-700 mt-0.5 flex items-center gap-1.5 flex-wrap">
                  <span>新註冊即享 <span className="font-semibold">{levelLabel} {data.trialDays} 日試用</span>，先到先得</span>
                  <button
                    onClick={() => setOpen(true)}
                    className="eb-bulb inline-flex items-center gap-0.5 rounded-full bg-amber-100 hover:bg-amber-200 border border-amber-300 px-2 py-0.5 text-xs font-medium text-amber-800 transition-colors"
                    aria-label="了解銀牌會員有什麼特別"
                  >
                    <Lightbulb className="w-3 h-3 text-amber-500" />
                    銀牌有咩特別？
                  </button>
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

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.55)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div className="relative w-full max-w-md max-h-[85vh] overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 rounded-t-2xl bg-gradient-to-r from-amber-400 via-pink-400 to-amber-400 px-5 py-4">
              <button
                onClick={() => setOpen(false)}
                className="absolute right-3 top-3 rounded-full bg-white/20 hover:bg-white/40 p-1.5 transition-colors"
                aria-label="關閉"
              >
                <X className="w-4 h-4 text-white" />
              </button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/25 flex items-center justify-center text-2xl">🥈</div>
                <div>
                  <div className="text-base font-extrabold text-white leading-tight">銀牌會員有乜特別？</div>
                  <div className="text-xs text-white/80 mt-0.5">早鳥試用 {data.trialDays} 日，即刻體驗以下所有功能</div>
                </div>
              </div>
            </div>

            <div className="px-5 py-4 space-y-3">
              {SILVER_PERKS.map((perk, i) => (
                <div key={i} className="flex gap-3 rounded-xl border border-gray-100 bg-gray-50 p-3">
                  <div className="mt-0.5 shrink-0 w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center">
                    {perk.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-800">{perk.title}</span>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${perk.badgeColor}`}>{perk.badge}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{perk.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="sticky bottom-0 rounded-b-2xl bg-white border-t border-gray-100 px-5 py-4">
              <a
                href="/login?mode=register&method=phone"
                className="block w-full text-center rounded-xl bg-gradient-to-r from-amber-500 to-pink-500 hover:from-amber-600 hover:to-pink-600 py-3 text-sm font-bold text-white shadow-md transition-transform hover:scale-[1.02] active:scale-[0.98]"
              >
                🎁 立即免費領取 {levelLabel} {data.trialDays} 日試用 →
              </a>
              <p className="text-center text-[10px] text-gray-400 mt-2">今日仲剩 <span className="font-bold text-pink-500">{data.remaining}</span> 個名額，先到先得</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
