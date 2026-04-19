import { useState, useEffect } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Settings, Bell, Clock, ChevronLeft, Save, AlertCircle, MessageSquare } from "lucide-react";

export default function AdminSiteSettings() {
  const { user, isAuthenticated } = useAuth();
  // 讀取所有站點設定
  const { data: settings, isLoading, refetch } = trpc.siteSettings.getAll.useQuery();
  const setSetting = trpc.siteSettings.set.useMutation({
    onSuccess: () => {
      refetch();
      toast.success("設定已儲存，站點設定已成功更新");
    },
    onError: (err) => {
      toast.error(err.message || "儲存失敗");
    },
  });

  // 倒數提醒閾值（分鐘）
  const [endingSoonMinutes, setEndingSoonMinutes] = useState("30");
  // 未有出價提示訊息
  const [noBidMessage, setNoBidMessage] = useState("暫時未有出價 喜歡來一口的隨時就可以帶回家了 😁");

  useEffect(() => {
    if (settings) {
      const s = settings as Record<string, string>;
      if (s.endingSoonMinutes) setEndingSoonMinutes(s.endingSoonMinutes);
      if (s.noBidMessage) setNoBidMessage(s.noBidMessage);
    }
  }, [settings]);

  if (!isAuthenticated || user?.role !== 'admin') {
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

  const handleSaveEndingSoon = () => {
    const val = parseInt(endingSoonMinutes, 10);
    if (isNaN(val) || val < 1 || val > 1440) {
      toast.error("請輸入 1 至 1440 分鐘之間的數值");
      return;
    }
    setSetting.mutate({ key: 'endingSoonMinutes', value: String(val) });
  };

  const handleSaveNoBidMessage = () => {
    if (!noBidMessage.trim()) {
      toast.error("訊息不可為空");
      return;
    }
    setSetting.mutate({ key: 'noBidMessage', value: noBidMessage.trim() });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* 後台導航 */}
      <div className="bg-amber-900 text-white px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3 flex-wrap">
            <Link href="/admin/auctions">
              <Button variant="ghost" size="sm" className="text-amber-100 hover:text-white hover:bg-amber-800 gap-1">
                <ChevronLeft className="w-4 h-4" />拍賣管理
              </Button>
            </Link>
            <span className="text-amber-300">|</span>
            <Link href="/admin/dashboard">
              <Button variant="ghost" size="sm" className="text-amber-100 hover:text-white hover:bg-amber-800">📊 統計儀表板</Button>
            </Link>
            <Link href="/admin/users">
              <Button variant="ghost" size="sm" className="text-amber-100 hover:text-white hover:bg-amber-800">👥 用戶管理</Button>
            </Link>
            <Link href="/admin/anonymous-bids">
              <Button variant="ghost" size="sm" className="text-amber-100 hover:text-white hover:bg-amber-800">🕵️ 匿名出價</Button>
            </Link>
            <Link href="/admin/export-bids">
              <Button variant="ghost" size="sm" className="text-amber-100 hover:text-white hover:bg-amber-800">📥 匯出記錄</Button>
            </Link>
            <Link href="/admin/settings">
              <Button variant="ghost" size="sm" className="text-white bg-amber-700 hover:bg-amber-600">⚙️ 站點設定</Button>
            </Link>
          </div>
          <Badge variant="outline" className="text-amber-200 border-amber-500">
            管理員：{user?.name}
          </Badge>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-8">
          <Settings className="w-7 h-7 text-amber-600" />
          <div>
            <h1 className="text-2xl font-bold">站點設定</h1>
            <p className="text-muted-foreground text-sm">管理拍賣平台的全局設定</p>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">載入設定中...</div>
        ) : (
          <div className="space-y-6">
            {/* 倒數提醒設定 */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Bell className="w-5 h-5 text-orange-500" />
                  <CardTitle className="text-lg">拍賣倒數提醒</CardTitle>
                </div>
                <CardDescription>
                  當拍賣剩餘時間少於設定值時，拍賣列表卡片會顯示橙色閃爍「⏰ 即將結束」標記
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-end gap-4">
                  <div className="flex-1">
                    <Label htmlFor="endingSoonMinutes" className="flex items-center gap-2 mb-2">
                      <Clock className="w-4 h-4 text-orange-500" />
                      提醒閾值（分鐘）
                    </Label>
                    <Input
                      id="endingSoonMinutes"
                      type="number"
                      min={1}
                      max={1440}
                      value={endingSoonMinutes}
                      onChange={(e) => setEndingSoonMinutes(e.target.value)}
                      className="max-w-[180px]"
                      placeholder="30"
                    />
                    <p className="text-xs text-muted-foreground mt-1.5">
                      範圍：1 至 1440 分鐘（24 小時）。目前設定：
                      <span className="font-semibold text-orange-600">
                        {endingSoonMinutes} 分鐘
                      </span>
                      {parseInt(endingSoonMinutes) >= 60 && (
                        <span className="text-muted-foreground">
                          （即 {Math.floor(parseInt(endingSoonMinutes) / 60)} 小時
                          {parseInt(endingSoonMinutes) % 60 > 0 ? ` ${parseInt(endingSoonMinutes) % 60} 分鐘` : ''}）
                        </span>
                      )}
                    </p>
                  </div>
                  <Button
                    onClick={handleSaveEndingSoon}
                    disabled={setSetting.isPending}
                    className="bg-amber-600 hover:bg-amber-700 text-white gap-2 mb-6"
                  >
                    <Save className="w-4 h-4" />
                    {setSetting.isPending ? "儲存中..." : "儲存設定"}
                  </Button>
                </div>

                {/* 預覽效果 */}
                <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
                  <p className="text-sm font-medium text-orange-700 dark:text-orange-400 mb-2">效果預覽</p>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">拍賣卡片標記：</span>
                    <Badge className="bg-orange-500 text-white text-[10px] px-1.5 py-0.5 animate-pulse">
                      ⏰ 即將結束
                    </Badge>
                    <span className="text-xs text-muted-foreground">（橙色閃爍）</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    當拍賣距離結標時間少於 <strong>{endingSoonMinutes} 分鐘</strong>時，此標記會顯示在拍賣列表卡片右上角
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* 未有出價提示訊息 */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-amber-500" />
                  <CardTitle className="text-lg">未有出價提示訊息</CardTitle>
                </div>
                <CardDescription>
                  當拍賣商品暫時未有任何出價時，在商品頁顯示的提示訊息
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="noBidMessage" className="flex items-center gap-2 mb-2">
                    <MessageSquare className="w-4 h-4 text-amber-500" />
                    提示訊息內容
                  </Label>
                  <Textarea
                    id="noBidMessage"
                    value={noBidMessage}
                    onChange={(e) => setNoBidMessage(e.target.value)}
                    rows={3}
                    placeholder="暫時未有出價 喜歡來一口的隨時就可以帶回家了 😁"
                    className="resize-none"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div
                    className="text-sm px-4 py-2.5 rounded-xl border max-w-sm"
                    style={{
                      background: "var(--popup-bg)",
                      color: "var(--popup-text)",
                      borderColor: "var(--popup-border)",
                      boxShadow: "var(--popup-shadow)",
                    }}
                  >
                    {noBidMessage || "（空白）"}
                  </div>
                  <Button
                    onClick={handleSaveNoBidMessage}
                    disabled={setSetting.isPending}
                    className="bg-amber-600 hover:bg-amber-700 text-white gap-2"
                  >
                    <Save className="w-4 h-4" />
                    {setSetting.isPending ? "儲存中..." : "儲存設定"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* 目前所有設定值 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">目前所有設定值</CardTitle>
                <CardDescription>系統中所有已儲存的站點設定</CardDescription>
              </CardHeader>
              <CardContent>
                {settings && Object.keys(settings as Record<string, string>).length > 0 ? (
                  <div className="space-y-2">
                    {Object.entries(settings as Record<string, string>).map(([key, value]) => (
                      <div key={key} className="flex items-center justify-between py-2 border-b last:border-0">
                        <span className="text-sm font-mono text-muted-foreground">{key}</span>
                        <Badge variant="outline" className="font-mono">{value}</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">尚無設定值</p>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
