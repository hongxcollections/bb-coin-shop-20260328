import { useState, useEffect } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import AdminHeader from "@/components/AdminHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Award, Gift, ChevronLeft, Save, AlertCircle, Sparkles, Clock, Medal, Crown, RefreshCw, Bot, EyeOff } from "lucide-react";

type Cfg = {
  earlyBirdEnabled: boolean;
  earlyBirdDailyQuota: number;
  earlyBirdTrialLevel: "silver" | "gold" | "vip";
  earlyBirdTrialDays: number;
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
  silverCanAnonymous: boolean;
  goldDefaultAnonymous: boolean;
};

export default function AdminLoyalty() {
  const { user, isAuthenticated } = useAuth();
  const { data, isLoading, refetch } = trpc.loyalty.adminGetConfig.useQuery(undefined, { enabled: !!user && user.role === "admin" });
  const updateMut = trpc.loyalty.adminUpdateConfig.useMutation({
    onSuccess: () => { refetch(); toast.success("設定已儲存"); },
    onError: (e) => toast.error(e.message || "儲存失敗"),
  });
  const maintMut = trpc.loyalty.adminRunMaintenance.useMutation({
    onSuccess: (r) => toast.success(`已跑維護：試用到期 ${r.trialExpired} 人 / 無活動降級 ${r.inactivityDowngraded} 人`),
    onError: (e) => toast.error(e.message || "執行失敗"),
  });

  const [cfg, setCfg] = useState<Cfg | null>(null);
  useEffect(() => { if (data) setCfg(data as Cfg); }, [data]);

  if (!isAuthenticated || user?.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">無訪問權限</h2>
          <p className="text-muted-foreground mb-4">此頁面僅限管理員訪問</p>
          <Link href="/"><Button variant="outline">返回首頁</Button></Link>
        </div>
      </div>
    );
  }

  if (isLoading || !cfg) {
    return (
      <div className="min-h-screen bg-background">
        <AdminHeader />
        <div className="max-w-3xl mx-auto px-4 py-8 text-center text-muted-foreground">載入設定中...</div>
      </div>
    );
  }

  function update<K extends keyof Cfg>(key: K, value: Cfg[K]) {
    setCfg(prev => prev ? { ...prev, [key]: value } : prev);
  }

  function saveSection(partial: Partial<Cfg>) {
    updateMut.mutate(partial);
  }

  const NumInput = ({ value, onChange, min = 0, max = 99999, step = 1 }: { value: number; onChange: (n: number) => void; min?: number; max?: number; step?: number }) => (
    <Input type="number" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="max-w-[160px]" />
  );

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader />
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-2">
          <Link href="/admin"><Button variant="ghost" size="sm" className="gap-1"><ChevronLeft className="w-4 h-4" />返回</Button></Link>
        </div>
        <div className="flex items-center gap-3 mb-6">
          <Award className="w-7 h-7 text-amber-600" />
          <div>
            <h1 className="text-2xl font-bold">會員活動等級設定</h1>
            <p className="text-muted-foreground text-sm">管理早鳥計劃、升降級門檻、以及各等級好處參數</p>
          </div>
        </div>

        <div className="space-y-6">
          {/* 早鳥計劃 */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Gift className="w-5 h-5 text-pink-500" />
                <CardTitle className="text-lg">每日早鳥試用計劃</CardTitle>
              </div>
              <CardDescription>每日首 N 名新註冊用戶 → 自動享有指定等級試用若干日（到期自動降回自然等級）</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Switch checked={cfg.earlyBirdEnabled} onCheckedChange={(v) => update("earlyBirdEnabled", v)} />
                <Label>{cfg.earlyBirdEnabled ? <span className="text-emerald-600 font-semibold">已啟用</span> : <span className="text-muted-foreground">已停用</span>}</Label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <Label className="mb-2 block">每日名額</Label>
                  <NumInput value={cfg.earlyBirdDailyQuota} onChange={(n) => update("earlyBirdDailyQuota", n)} min={0} max={9999} />
                </div>
                <div>
                  <Label className="mb-2 block">試用等級</Label>
                  <select
                    value={cfg.earlyBirdTrialLevel}
                    onChange={(e) => update("earlyBirdTrialLevel", e.target.value as "silver" | "gold" | "vip")}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="silver">🥈 銀牌</option>
                    <option value="gold">🥇 金牌</option>
                    <option value="vip">💎 VIP</option>
                  </select>
                </div>
                <div>
                  <Label className="mb-2 block">試用期（日）</Label>
                  <NumInput value={cfg.earlyBirdTrialDays} onChange={(n) => update("earlyBirdTrialDays", n)} min={1} max={365} />
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={() => saveSection({
                  earlyBirdEnabled: cfg.earlyBirdEnabled,
                  earlyBirdDailyQuota: cfg.earlyBirdDailyQuota,
                  earlyBirdTrialLevel: cfg.earlyBirdTrialLevel,
                  earlyBirdTrialDays: cfg.earlyBirdTrialDays,
                })} className="bg-amber-600 hover:bg-amber-700 text-white gap-2" disabled={updateMut.isPending}>
                  <Save className="w-4 h-4" />儲存早鳥設定
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 銀牌門檻 */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Medal className="w-5 h-5 text-slate-500" />
                <CardTitle className="text-lg">🥈 銀牌升級門檻</CardTitle>
              </div>
              <CardDescription>用戶達成以下任一條件即自動升銀牌</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <Label className="mb-2 block">累積出價次數 ≥</Label>
                  <NumInput value={cfg.silverBidCount} onChange={(n) => update("silverBidCount", n)} />
                </div>
                <div>
                  <Label className="mb-2 block">累積成交次數 ≥</Label>
                  <NumInput value={cfg.silverWinCount} onChange={(n) => update("silverWinCount", n)} />
                </div>
                <div>
                  <Label className="mb-2 block">近 90 日競投總額 (HKD) ≥</Label>
                  <NumInput value={cfg.silver90DaySpend} onChange={(n) => update("silver90DaySpend", n)} max={99999999} />
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={() => saveSection({ silverBidCount: cfg.silverBidCount, silverWinCount: cfg.silverWinCount, silver90DaySpend: cfg.silver90DaySpend })} className="bg-amber-600 hover:bg-amber-700 text-white gap-2" disabled={updateMut.isPending}>
                  <Save className="w-4 h-4" />儲存銀牌門檻
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 金牌門檻 */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Crown className="w-5 h-5 text-yellow-500" />
                <CardTitle className="text-lg">🥇 金牌升級門檻</CardTitle>
              </div>
              <CardDescription>用戶達成以下任一條件即自動升金牌</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="mb-2 block">累積成交次數 ≥</Label>
                  <NumInput value={cfg.goldWinCount} onChange={(n) => update("goldWinCount", n)} />
                </div>
                <div>
                  <Label className="mb-2 block">近 90 日競投總額 (HKD) ≥</Label>
                  <NumInput value={cfg.gold90DaySpend} onChange={(n) => update("gold90DaySpend", n)} max={99999999} />
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={() => saveSection({ goldWinCount: cfg.goldWinCount, gold90DaySpend: cfg.gold90DaySpend })} className="bg-amber-600 hover:bg-amber-700 text-white gap-2" disabled={updateMut.isPending}>
                  <Save className="w-4 h-4" />儲存金牌門檻
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 降級規則 */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-red-400" />
                <CardTitle className="text-lg">長期無活動降級</CardTitle>
              </div>
              <CardDescription>連續 N 日沒有出價 → 自動降回銅牌（設 0 則停用此規則）</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="mb-2 block">無活動日數</Label>
                <NumInput value={cfg.inactivityDaysForDowngrade} onChange={(n) => update("inactivityDaysForDowngrade", n)} min={0} max={3650} />
              </div>
              <div className="flex justify-end">
                <Button onClick={() => saveSection({ inactivityDaysForDowngrade: cfg.inactivityDaysForDowngrade })} className="bg-amber-600 hover:bg-amber-700 text-white gap-2" disabled={updateMut.isPending}>
                  <Save className="w-4 h-4" />儲存降級設定
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 好處參數：credit 回贈 + 提前預覽 */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-emerald-500" />
                <CardTitle className="text-lg">各等級好處參數</CardTitle>
              </div>
              <CardDescription>Credit 回贈率（0.01 = 1%）及拍賣提前預覽時數（Phase 1B 上線）</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <Label className="mb-2 block">🥈 銀牌 Credit 回贈率</Label>
                  <NumInput value={cfg.silverCashbackRate} onChange={(n) => update("silverCashbackRate", n)} min={0} max={1} step={0.005} />
                  <p className="text-xs text-muted-foreground mt-1">= {(cfg.silverCashbackRate * 100).toFixed(1)}%</p>
                </div>
                <div>
                  <Label className="mb-2 block">🥇 金牌 Credit 回贈率</Label>
                  <NumInput value={cfg.goldCashbackRate} onChange={(n) => update("goldCashbackRate", n)} min={0} max={1} step={0.005} />
                  <p className="text-xs text-muted-foreground mt-1">= {(cfg.goldCashbackRate * 100).toFixed(1)}%</p>
                </div>
                <div>
                  <Label className="mb-2 block">💎 VIP Credit 回贈率</Label>
                  <NumInput value={cfg.vipCashbackRate} onChange={(n) => update("vipCashbackRate", n)} min={0} max={1} step={0.005} />
                  <p className="text-xs text-muted-foreground mt-1">= {(cfg.vipCashbackRate * 100).toFixed(1)}%</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="mb-2 block">🥈 銀牌提前預覽（小時）</Label>
                  <NumInput value={cfg.silverPreviewHours} onChange={(n) => update("silverPreviewHours", n)} max={720} />
                </div>
                <div>
                  <Label className="mb-2 block">🥇 金牌提前預覽（小時）</Label>
                  <NumInput value={cfg.goldPreviewHours} onChange={(n) => update("goldPreviewHours", n)} max={720} />
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={() => saveSection({
                  silverCashbackRate: cfg.silverCashbackRate,
                  goldCashbackRate: cfg.goldCashbackRate,
                  vipCashbackRate: cfg.vipCashbackRate,
                  silverPreviewHours: cfg.silverPreviewHours,
                  goldPreviewHours: cfg.goldPreviewHours,
                })} className="bg-amber-600 hover:bg-amber-700 text-white gap-2" disabled={updateMut.isPending}>
                  <Save className="w-4 h-4" />儲存好處參數
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 代理出價限制 */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-indigo-500" />
                <CardTitle className="text-lg">代理出價（自動出價）等級限制</CardTitle>
              </div>
              <CardDescription>銅牌每月可用次數 + 銀牌單次上限金額；金牌 / VIP 完全無限制</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="mb-2 block">🥉 銅牌每月次數上限</Label>
                  <NumInput value={cfg.bronzeAutoBidQuota} onChange={(n) => update("bronzeAutoBidQuota", n)} min={0} max={9999} />
                  <p className="text-xs text-muted-foreground mt-1">設 0 = 銅牌完全唔可代理出價</p>
                </div>
                <div>
                  <Label className="mb-2 block">🥈 銀牌單次代理上限 (HKD)</Label>
                  <NumInput value={cfg.silverAutoBidMaxAmount} onChange={(n) => update("silverAutoBidMaxAmount", n)} min={0} max={99999999} />
                  <p className="text-xs text-muted-foreground mt-1">設 0 = 銀牌無上限</p>
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={() => saveSection({ bronzeAutoBidQuota: cfg.bronzeAutoBidQuota, silverAutoBidMaxAmount: cfg.silverAutoBidMaxAmount })} className="bg-amber-600 hover:bg-amber-700 text-white gap-2" disabled={updateMut.isPending}>
                  <Save className="w-4 h-4" />儲存代理出價限制
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 匿名出價限制 */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <EyeOff className="w-5 h-5 text-purple-500" />
                <CardTitle className="text-lg">匿名出價權限</CardTitle>
              </div>
              <CardDescription>銅牌完全唔可匿名；銀牌可由你決定；金牌 / VIP 永遠可以</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Switch checked={cfg.silverCanAnonymous} onCheckedChange={(v) => update("silverCanAnonymous", v)} />
                <Label>🥈 銀牌允許匿名出價：{cfg.silverCanAnonymous ? <span className="text-emerald-600 font-semibold">允許</span> : <span className="text-muted-foreground">禁止</span>}</Label>
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={cfg.goldDefaultAnonymous} onCheckedChange={(v) => update("goldDefaultAnonymous", v)} />
                <Label>🥇 金牌 / 💎 VIP 出價時匿名選項預設打開：{cfg.goldDefaultAnonymous ? <span className="text-emerald-600 font-semibold">預設打開</span> : <span className="text-muted-foreground">預設關閉</span>}</Label>
              </div>
              <div className="flex justify-end">
                <Button onClick={() => saveSection({ silverCanAnonymous: cfg.silverCanAnonymous, goldDefaultAnonymous: cfg.goldDefaultAnonymous })} className="bg-amber-600 hover:bg-amber-700 text-white gap-2" disabled={updateMut.isPending}>
                  <Save className="w-4 h-4" />儲存匿名權限
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 維護工具 */}
          <Card className="border-dashed">
            <CardHeader>
              <div className="flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-blue-500" />
                <CardTitle className="text-lg">維護工具</CardTitle>
              </div>
              <CardDescription>手動觸發「試用到期 + 長期無活動降級」掃描（每 6 小時自動跑一次）</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" onClick={() => maintMut.mutate()} disabled={maintMut.isPending} className="gap-2">
                <RefreshCw className="w-4 h-4" />
                {maintMut.isPending ? "執行中..." : "立即執行維護掃描"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
