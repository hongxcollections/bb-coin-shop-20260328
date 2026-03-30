import { Link } from "wouter";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Check, X, ArrowLeft, Star, Zap, Shield, Crown, Info } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { MemberHeroBanner } from "@/components/MemberHeroBanner";
import { type MemberLevel } from "@/components/MemberBadge";

// ── Level config ──────────────────────────────────────────────────────────────

const LEVELS: {
  key: MemberLevel; label: string; icon: string; color: string;
  border: string; bg: string; textColor: string;
}[] = [
  { key: "bronze", label: "銅牌會員", icon: "🥉", color: "from-amber-700 to-orange-500", border: "border-amber-300", bg: "bg-amber-50", textColor: "text-amber-800" },
  { key: "silver", label: "銀牌會員", icon: "🥈", color: "from-slate-500 to-gray-300",   border: "border-slate-300", bg: "bg-slate-50",  textColor: "text-slate-700" },
  { key: "gold",   label: "金牌會員", icon: "🥇", color: "from-yellow-500 to-amber-300", border: "border-yellow-300", bg: "bg-yellow-50", textColor: "text-yellow-800" },
  { key: "vip",    label: "VIP 會員", icon: "💎", color: "from-violet-700 to-fuchsia-500", border: "border-violet-300", bg: "bg-violet-50", textColor: "text-violet-800" },
];

// ── Benefit rows with detailed tooltip descriptions ───────────────────────────

interface BenefitRow {
  category: string;
  icon: React.ReactNode;
  benefit: string;
  detail: string;           // tooltip content
  bronze: boolean | string;
  silver: boolean | string;
  gold:   boolean | string;
  vip:    boolean | string;
}

const BENEFITS: BenefitRow[] = [
  {
    category: "競標",
    icon: <Zap className="w-4 h-4" />,
    benefit: "優先出價通知",
    detail: "當您關注的拍賣有新出價時，銀牌或以上會員將比一般用戶更早收到電郵通知，讓您第一時間掌握競標動態，及時回應。",
    bronze: false, silver: true, gold: true, vip: true,
  },
  {
    category: "競標",
    icon: <Zap className="w-4 h-4" />,
    benefit: "反狙擊延時保護",
    detail: "當拍賣進入尾聲（結束前數分鐘）有人出價時，系統自動延長拍賣時間，防止「最後一秒狙擊」。具體觸發條件由管理員針對每件商品獨立設定，部分商品可能限定特定等級會員出價才觸發延時。",
    bronze: "視商品設定", silver: "視商品設定", gold: "視商品設定", vip: "視商品設定",
  },
  {
    category: "競標",
    icon: <Zap className="w-4 h-4" />,
    benefit: "代理出價功能",
    detail: "設定您願意支付的最高金額，系統將自動代您出價，每次只出剛好超過對手的最低金額，直至達到您的上限。您無需時刻守候，系統為您守住領先位置。",
    bronze: true, silver: true, gold: true, vip: true,
  },
  {
    category: "通知",
    icon: <Star className="w-4 h-4" />,
    benefit: "被超標即時通知",
    detail: "當其他出價者超過您的出價時，系統立即發送電郵通知，讓您即時知悉並決定是否繼續競標。通知包含商品名稱、當前最高出價及拍賣剩餘時間。",
    bronze: true, silver: true, gold: true, vip: true,
  },
  {
    category: "通知",
    icon: <Star className="w-4 h-4" />,
    benefit: "拍賣即將結束提醒",
    detail: "在您參與的拍賣進入倒計時（預設結束前 30 分鐘）時，系統自動發送提醒電郵，確保您不會錯過最後競標機會。提醒時間可由管理員統一設定。",
    bronze: true, silver: true, gold: true, vip: true,
  },
  {
    category: "通知",
    icon: <Star className="w-4 h-4" />,
    benefit: "得標確認通知",
    detail: "拍賣結束後，若您成功得標，系統立即發送恭賀電郵，內含商品資訊、最終成交價及後續付款/交收指引，方便您安排跟進。",
    bronze: true, silver: true, gold: true, vip: true,
  },
  {
    category: "專屬",
    icon: <Crown className="w-4 h-4" />,
    benefit: "專屬橫幅與徽章",
    detail: "根據您的會員等級，個人資料頁頂部橫幅將呈現專屬的漸層配色、等級稱號及裝飾動畫。同時，您的名稱旁將顯示對應等級的彩色徽章，讓其他用戶一眼識別您的身份。",
    bronze: "銅牌款", silver: "銀牌款", gold: "金牌款", vip: "VIP 尊享款",
  },
  {
    category: "專屬",
    icon: <Crown className="w-4 h-4" />,
    benefit: "個人資料頁尊榮設計",
    detail: "金牌及 VIP 會員的個人資料頁面將啟用進階視覺設計，包括更精緻的橫幅動畫效果、浮動粒子裝飾及專屬等級稱號，彰顯您在收藏界的崇高地位。",
    bronze: false, silver: false, gold: true, vip: true,
  },
  {
    category: "專屬",
    icon: <Crown className="w-4 h-4" />,
    benefit: "優先客服支援",
    detail: "VIP 會員在遇到任何問題（競標糾紛、帳號疑問、付款安排等）時，享有優先處理的客服通道，確保您的問題得到最快速的回應與解決。",
    bronze: false, silver: false, gold: false, vip: true,
  },
  {
    category: "安全",
    icon: <Shield className="w-4 h-4" />,
    benefit: "帳號安全保障",
    detail: "所有會員帳號均受到 Manus OAuth 安全認證保護，採用業界標準的加密技術，確保您的個人資料及競標記錄不被未授權人士存取。",
    bronze: true, silver: true, gold: true, vip: true,
  },
  {
    category: "安全",
    icon: <Shield className="w-4 h-4" />,
    benefit: "交易記錄永久保存",
    detail: "您的所有出價記錄、得標記錄及交易歷史均永久保存於系統中，隨時可在「我的出價記錄」頁面查閱，作為收藏品來源憑證或個人收藏檔案。",
    bronze: true, silver: true, gold: true, vip: true,
  },
];

const LEVEL_DESCRIPTIONS: Record<MemberLevel, { title: string; desc: string; perks: string[] }> = {
  bronze: {
    title: "銅牌收藏家",
    desc: "踏上錢幣收藏之旅的起點。享有基本競標功能、即時通知及完整交易記錄，讓您安心參與每一場拍賣。",
    perks: ["完整競標功能", "三種即時通知", "代理出價保護", "銅牌專屬徽章"],
  },
  silver: {
    title: "銀牌藏家",
    desc: "進階收藏家的首選。在銅牌基礎上，額外享有優先出價通知，讓您在激烈競標中搶得先機。",
    perks: ["銅牌全部權益", "優先出價通知", "銀牌專屬橫幅", "銀牌尊榮徽章"],
  },
  gold: {
    title: "金牌資深藏家",
    desc: "資深藏家的象徵。除享有銀牌全部權益外，更獲得個人資料頁尊榮設計，彰顯您的收藏品味與地位。",
    perks: ["銀牌全部權益", "個人頁尊榮設計", "金牌專屬橫幅", "金牌尊榮徽章"],
  },
  vip: {
    title: "💎 VIP 頂級藏家",
    desc: "臻品收藏家的最高榮耀。享有平台所有功能與尊榮待遇，包括優先客服支援，讓每一次競標體驗都無與倫比。",
    perks: ["金牌全部權益", "優先客服支援", "VIP 尊享橫幅", "💎 VIP 頂級徽章"],
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function Cell({ val }: { val: boolean | string }) {
  if (val === false) return <X className="w-4 h-4 text-gray-300 mx-auto" />;
  if (val === true)  return <Check className="w-4 h-4 text-emerald-500 mx-auto" />;
  return <span className="text-xs text-center text-muted-foreground leading-tight">{val}</span>;
}

// Mobile-friendly popover using state (for touch devices)
function BenefitLabel({ benefit, detail }: { benefit: string; detail: string }) {
  const [open, setOpen] = useState(false);

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild>
          <button
            className="flex items-center gap-1.5 text-left group"
            onClick={() => setOpen(v => !v)}
            type="button"
          >
            <span className="text-sm">{benefit}</span>
            <Info className="w-3.5 h-3.5 text-amber-400 group-hover:text-amber-600 flex-shrink-0 transition-colors" />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="right"
          align="start"
          className="max-w-xs text-xs leading-relaxed bg-amber-900 text-amber-50 border-amber-700 shadow-xl p-3"
        >
          <p className="font-semibold mb-1 text-amber-200">{benefit}</p>
          <p>{detail}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function MemberBenefits() {
  const { user } = useAuth();
  const myLevel = (user as { memberLevel?: string } | null)?.memberLevel as MemberLevel | undefined;

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50">
      {/* Nav */}
      <nav className="nav-glass sticky top-0 z-50">
        <div className="container flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2 font-bold text-xl">
            <span className="text-2xl">💰</span>
            <span className="gold-gradient-text">大BB錢幣店</span>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.history.back()}
            className="text-amber-700 hover:text-amber-900 hover:bg-amber-50 gap-1"
          >
            <ArrowLeft className="w-4 h-4" /> 返回
          </Button>
        </div>
      </nav>

      <div className="container max-w-4xl py-8 space-y-8">

        {/* My level banner */}
        {myLevel && (
          <Card className="overflow-hidden border-0 shadow-lg">
            <MemberHeroBanner level={myLevel} name={user?.name} />
            <CardContent className="py-4 px-6 bg-white">
              <div className="flex items-center gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">您目前的等級</p>
                  <p className="font-bold text-amber-900">{LEVEL_DESCRIPTIONS[myLevel].title}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Page title */}
        <div className="text-center">
          <h1 className="text-3xl font-extrabold text-amber-900 mb-2">會員等級權益</h1>
          <p className="text-muted-foreground">
            了解各等級的專屬福利，提升您的競標體驗
            <span className="ml-2 inline-flex items-center gap-1 text-xs text-amber-500">
              <Info className="w-3 h-3" /> 點擊各項權益旁的圖示查看詳細說明
            </span>
          </p>
        </div>

        {/* Level cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {LEVELS.map((lv) => {
            const desc = LEVEL_DESCRIPTIONS[lv.key];
            const isMe = myLevel === lv.key;
            return (
              <Card
                key={lv.key}
                className={`relative overflow-hidden border-2 transition-shadow hover:shadow-lg ${
                  isMe ? lv.border + " shadow-md" : "border-transparent"
                }`}
              >
                {isMe && (
                  <div className="absolute top-3 right-3 z-10">
                    <Badge className="bg-emerald-500 text-white text-xs">我的等級</Badge>
                  </div>
                )}
                <div className={`h-16 bg-gradient-to-r ${lv.color} flex items-center px-5 gap-3`}>
                  <span className="text-3xl">{lv.icon}</span>
                  <p className="text-white font-bold text-lg leading-tight">{lv.label}</p>
                </div>
                <CardContent className="pt-4 pb-5 px-5">
                  <p className="text-sm text-muted-foreground mb-3 leading-relaxed">{desc.desc}</p>
                  <ul className="space-y-1.5">
                    {desc.perks.map((p) => (
                      <li key={p} className="flex items-center gap-2 text-sm">
                        <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Comparison table */}
        <Card className="border-amber-100 overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-100">
            <CardTitle className="text-base text-amber-900 flex items-center gap-2">
              完整權益對比
              <span className="text-xs font-normal text-muted-foreground flex items-center gap-1">
                <Info className="w-3 h-3 text-amber-400" /> 點擊 ⓘ 圖示查看詳細說明
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-amber-100">
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground w-52">功能 / 權益</th>
                  {LEVELS.map((lv) => (
                    <th
                      key={lv.key}
                      className={`px-3 py-3 text-center font-bold ${lv.textColor} ${
                        myLevel === lv.key ? lv.bg : ""
                      }`}
                    >
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="text-lg">{lv.icon}</span>
                        <span className="text-xs">{lv.label.replace("會員", "")}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(() => {
                  let lastCat = "";
                  return BENEFITS.map((row, i) => {
                    const showCat = row.category !== lastCat;
                    lastCat = row.category;
                    return (
                      <>
                        {showCat && (
                          <tr key={`cat-${i}`} className="bg-amber-50/60">
                            <td
                              colSpan={5}
                              className="px-4 py-1.5 text-xs font-semibold text-amber-700 uppercase tracking-wide"
                            >
                              {row.icon} {row.category}
                            </td>
                          </tr>
                        )}
                        <tr
                          key={row.benefit}
                          className="border-b border-amber-50 hover:bg-amber-50/40 transition-colors"
                        >
                          <td className="px-4 py-2.5">
                            <BenefitLabel benefit={row.benefit} detail={row.detail} />
                          </td>
                          {(["bronze", "silver", "gold", "vip"] as MemberLevel[]).map((lv) => (
                            <td
                              key={lv}
                              className={`px-3 py-2.5 text-center ${
                                myLevel === lv ? LEVELS.find(l => l.key === lv)!.bg : ""
                              }`}
                            >
                              <Cell val={row[lv]} />
                            </td>
                          ))}
                        </tr>
                      </>
                    );
                  });
                })()}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Footer note */}
        <p className="text-center text-xs text-muted-foreground pb-4">
          會員等級由管理員根據您的參與度及交易記錄設定。如有疑問，請聯絡客服。
        </p>
      </div>
    </div>
  );
}
