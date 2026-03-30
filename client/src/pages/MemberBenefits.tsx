import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, X, ArrowLeft, Star, Zap, Shield, Crown } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { MemberHeroBanner } from "@/components/MemberHeroBanner";
import { type MemberLevel } from "@/components/MemberBadge";

// ── Benefit definitions ──────────────────────────────────────────────────────

const LEVELS: { key: MemberLevel; label: string; icon: string; color: string; border: string; bg: string; textColor: string }[] = [
  { key: "bronze", label: "銅牌會員", icon: "🥉", color: "from-amber-700 to-orange-500", border: "border-amber-300", bg: "bg-amber-50", textColor: "text-amber-800" },
  { key: "silver", label: "銀牌會員", icon: "🥈", color: "from-slate-500 to-gray-300", border: "border-slate-300", bg: "bg-slate-50", textColor: "text-slate-700" },
  { key: "gold",   label: "金牌會員", icon: "🥇", color: "from-yellow-500 to-amber-300", border: "border-yellow-300", bg: "bg-yellow-50", textColor: "text-yellow-800" },
  { key: "vip",    label: "VIP 會員", icon: "💎", color: "from-violet-700 to-fuchsia-500", border: "border-violet-300", bg: "bg-violet-50", textColor: "text-violet-800" },
];

interface BenefitRow {
  category: string;
  icon: React.ReactNode;
  benefit: string;
  bronze: boolean | string;
  silver: boolean | string;
  gold: boolean | string;
  vip: boolean | string;
}

const BENEFITS: BenefitRow[] = [
  { category: "競標", icon: <Zap className="w-4 h-4" />, benefit: "優先出價通知", bronze: false, silver: true, gold: true, vip: true },
  { category: "競標", icon: <Zap className="w-4 h-4" />, benefit: "反狙擊延時保護", bronze: "視商品設定", silver: "視商品設定", gold: "視商品設定", vip: "視商品設定" },
  { category: "競標", icon: <Zap className="w-4 h-4" />, benefit: "代理出價功能", bronze: true, silver: true, gold: true, vip: true },
  { category: "通知", icon: <Star className="w-4 h-4" />, benefit: "被超標即時通知", bronze: true, silver: true, gold: true, vip: true },
  { category: "通知", icon: <Star className="w-4 h-4" />, benefit: "拍賣即將結束提醒", bronze: true, silver: true, gold: true, vip: true },
  { category: "通知", icon: <Star className="w-4 h-4" />, benefit: "得標確認通知", bronze: true, silver: true, gold: true, vip: true },
  { category: "專屬", icon: <Crown className="w-4 h-4" />, benefit: "專屬橫幅與徽章", bronze: "銅牌款", silver: "銀牌款", gold: "金牌款", vip: "VIP 尊享款" },
  { category: "專屬", icon: <Crown className="w-4 h-4" />, benefit: "個人資料頁尊榮設計", bronze: false, silver: false, gold: true, vip: true },
  { category: "專屬", icon: <Crown className="w-4 h-4" />, benefit: "優先客服支援", bronze: false, silver: false, gold: false, vip: true },
  { category: "安全", icon: <Shield className="w-4 h-4" />, benefit: "帳號安全保障", bronze: true, silver: true, gold: true, vip: true },
  { category: "安全", icon: <Shield className="w-4 h-4" />, benefit: "交易記錄永久保存", bronze: true, silver: true, gold: true, vip: true },
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

// ── Helper ───────────────────────────────────────────────────────────────────

function Cell({ val }: { val: boolean | string }) {
  if (val === false) return <X className="w-4 h-4 text-gray-300 mx-auto" />;
  if (val === true) return <Check className="w-4 h-4 text-emerald-500 mx-auto" />;
  return <span className="text-xs text-center text-muted-foreground leading-tight">{val}</span>;
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
          <Button variant="ghost" size="sm" onClick={() => window.history.back()} className="text-amber-700 hover:text-amber-900 hover:bg-amber-50 gap-1">
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
          <p className="text-muted-foreground">了解各等級的專屬福利，提升您的競標體驗</p>
        </div>

        {/* Level cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {LEVELS.map((lv) => {
            const desc = LEVEL_DESCRIPTIONS[lv.key];
            const isMe = myLevel === lv.key;
            return (
              <Card key={lv.key} className={`relative overflow-hidden border-2 transition-shadow hover:shadow-lg ${isMe ? lv.border + " shadow-md" : "border-transparent"}`}>
                {isMe && (
                  <div className="absolute top-3 right-3">
                    <Badge className="bg-emerald-500 text-white text-xs">我的等級</Badge>
                  </div>
                )}
                {/* Mini banner */}
                <div className={`h-16 bg-gradient-to-r ${lv.color} flex items-center px-5 gap-3`}>
                  <span className="text-3xl">{lv.icon}</span>
                  <div>
                    <p className="text-white font-bold text-lg leading-tight">{lv.label}</p>
                  </div>
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
            <CardTitle className="text-base text-amber-900">完整權益對比</CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-amber-100">
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground w-48">功能 / 權益</th>
                  {LEVELS.map((lv) => (
                    <th key={lv.key} className={`px-3 py-3 text-center font-bold ${lv.textColor} ${myLevel === lv.key ? lv.bg : ""}`}>
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
                            <td colSpan={5} className="px-4 py-1.5 text-xs font-semibold text-amber-700 uppercase tracking-wide">
                              {row.icon} {row.category}
                            </td>
                          </tr>
                        )}
                        <tr key={row.benefit} className="border-b border-amber-50 hover:bg-amber-50/40 transition-colors">
                          <td className="px-4 py-2.5 text-sm">{row.benefit}</td>
                          {(["bronze", "silver", "gold", "vip"] as MemberLevel[]).map((lv) => (
                            <td key={lv} className={`px-3 py-2.5 text-center ${myLevel === lv ? LEVELS.find(l => l.key === lv)!.bg : ""}`}>
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
