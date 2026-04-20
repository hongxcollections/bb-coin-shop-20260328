import { useState, useEffect } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import AdminHeader from "@/components/AdminHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Settings, Bell, Clock, ChevronLeft, Save, AlertCircle,
  MessageSquare, Megaphone, Home, CheckCircle, Tag, LogIn, Sparkles,
  Download, Upload, Package2
} from "lucide-react";

export default function AdminSiteSettings() {
  const { user, isAuthenticated } = useAuth();
  const { data: settings, isLoading, refetch } = trpc.siteSettings.getAll.useQuery();
  const setSetting = trpc.siteSettings.set.useMutation({
    onSuccess: () => { refetch(); toast.success("設定已儲存"); },
    onError: (err) => { toast.error(err.message || "儲存失敗"); },
  });

  const s = (settings as Record<string, string> | undefined) ?? {};

  // 全站公告
  const [announcementEnabled, setAnnouncementEnabled] = useState(false);
  const [announcementText, setAnnouncementText] = useState("");

  // 首頁歡迎訊息
  const [homeWelcomeEnabled, setHomeWelcomeEnabled] = useState(false);
  const [homeWelcomeMessage, setHomeWelcomeMessage] = useState("歡迎蒞臨 大BB錢幣店 🪙 每週更新精選藏品");

  // 倒數提醒閾值
  const [endingSoonMinutes, setEndingSoonMinutes] = useState("30");

  // 即將結束標籤文字
  const [endingSoonText, setEndingSoonText] = useState("⏰ 即將結束");

  // 未有出價提示
  const [noBidMessage, setNoBidMessage] = useState("暫時未有出價 喜歡來一口的隨時就可以帶回家了 😁");

  // 出價成功訊息
  const [bidSuccessMessage, setBidSuccessMessage] = useState("✅ 出價成功！您目前是最高出價者");
  const [bidSuccessExtendedMessage, setBidSuccessExtendedMessage] = useState("✅ 出價成功！🛡️ 拍賣已延長 {minutes} 分鐘");

  // 未登入出價按鈕
  const [notLoggedInBidText, setNotLoggedInBidText] = useState("登入後出價");

  // 登入歡迎訊息
  const [loginWelcomeDesc, setLoginWelcomeDesc] = useState("歡迎繼續瀏覽網站！");

  // 保證金警告信息
  const [depositWarningMessage, setDepositWarningMessage] = useState("保證金水平維持不足，可以自行申請保證金充值或者聯絡管理員補交, 以免影響商戶一切正常運作。");

  // 發佈點數不足錯誤信息模板
  const [publishQuotaErrorMsg, setPublishQuotaErrorMsg] = useState("發佈點數不足（剩餘 {remaining} 次，需要 {required} 次）");

  // 發佈保證金不足錯誤信息模板
  const [publishDepositErrorMsg, setPublishDepositErrorMsg] = useState("保證金維持水平不足（餘額 {balance}，需要 {required}）");

  // 套餐資料同步
  const [importLoading, setImportLoading] = useState(false);
  const exportPackagesMut = trpc.users.adminExportPackages.useMutation();
  const importPackagesMut = trpc.users.adminImportPackages.useMutation({
    onSuccess: (r) => toast.success(`匯入成功！保證金套餐 ${r.tiersImported} 個，月費套餐 ${r.plansImported} 個`),
    onError: (e) => toast.error(e.message || "匯入失敗"),
  });

  async function handleExportPackages() {
    try {
      const data = await exportPackagesMut.mutateAsync();
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `bb-packages-${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("套餐設定已下載");
    } catch (e: any) {
      toast.error(e?.message || "匯出失敗");
    }
  }

  async function handleImportPackages(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setImportLoading(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data.depositTiers || !data.subscriptionPlans) {
        toast.error("JSON 格式錯誤，請使用正確的匯出檔案"); setImportLoading(false); return;
      }
      await importPackagesMut.mutateAsync({ depositTiers: data.depositTiers, subscriptionPlans: data.subscriptionPlans });
    } catch {
      toast.error("檔案解析失敗，請確認 JSON 格式正確");
    } finally { setImportLoading(false); }
  }

  useEffect(() => {
    if (!settings) return;
    if (s.announcementEnabled) setAnnouncementEnabled(s.announcementEnabled === "true");
    if (s.announcementText) setAnnouncementText(s.announcementText);
    if (s.homeWelcomeEnabled) setHomeWelcomeEnabled(s.homeWelcomeEnabled === "true");
    if (s.homeWelcomeMessage) setHomeWelcomeMessage(s.homeWelcomeMessage);
    if (s.endingSoonMinutes) setEndingSoonMinutes(s.endingSoonMinutes);
    if (s.endingSoonText) setEndingSoonText(s.endingSoonText);
    if (s.noBidMessage) setNoBidMessage(s.noBidMessage);
    if (s.bidSuccessMessage) setBidSuccessMessage(s.bidSuccessMessage);
    if (s.bidSuccessExtendedMessage) setBidSuccessExtendedMessage(s.bidSuccessExtendedMessage);
    if (s.notLoggedInBidText) setNotLoggedInBidText(s.notLoggedInBidText);
    if (s.loginWelcomeDesc) setLoginWelcomeDesc(s.loginWelcomeDesc);
    if (s.depositWarningMessage) setDepositWarningMessage(s.depositWarningMessage);
    if (s.publishQuotaErrorMsg) setPublishQuotaErrorMsg(s.publishQuotaErrorMsg);
    if (s.publishDepositErrorMsg) setPublishDepositErrorMsg(s.publishDepositErrorMsg);
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

  const save = (key: string, value: string, validate?: () => string | null) => {
    if (validate) {
      const err = validate();
      if (err) { toast.error(err); return; }
    }
    setSetting.mutate({ key, value });
  };

  const SaveBtn = ({ onClick }: { onClick: () => void }) => (
    <Button onClick={onClick} disabled={setSetting.isPending} className="bg-amber-600 hover:bg-amber-700 text-white gap-2">
      <Save className="w-4 h-4" />
      {setSetting.isPending ? "儲存中..." : "儲存"}
    </Button>
  );

  const popupPreview = (text: string) => (
    <div className="text-sm px-4 py-2.5 rounded-xl border max-w-xs" style={{
      background: "var(--popup-bg)", color: "var(--popup-text)",
      borderColor: "var(--popup-border)", boxShadow: "var(--popup-shadow)",
    }}>
      🪙 {text || "（空白）"}
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader />

      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-8">
          <Settings className="w-7 h-7 text-amber-600" />
          <div>
            <h1 className="text-2xl font-bold">站點設定</h1>
            <p className="text-muted-foreground text-sm">管理拍賣平台的全局彈出訊息與標籤文字</p>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">載入設定中...</div>
        ) : (
          <div className="space-y-6">

            {/* 全站公告橫幅 */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Megaphone className="w-5 h-5 text-red-500" />
                  <CardTitle className="text-lg">全站公告橫幅</CardTitle>
                </div>
                <CardDescription>開啟後在所有頁面頂部顯示公告訊息（適合系統維護、假期通知等）</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Switch
                    checked={announcementEnabled}
                    onCheckedChange={(v) => {
                      setAnnouncementEnabled(v);
                      setSetting.mutate({ key: 'announcementEnabled', value: v ? "true" : "false" });
                    }}
                  />
                  <Label className="cursor-pointer">
                    {announcementEnabled ? <span className="text-emerald-600 font-semibold">已開啟</span> : <span className="text-muted-foreground">已關閉</span>}
                  </Label>
                </div>
                <div>
                  <Label className="flex items-center gap-2 mb-2"><Megaphone className="w-4 h-4 text-red-500" />公告內容</Label>
                  <Textarea
                    value={announcementText}
                    onChange={(e) => setAnnouncementText(e.target.value)}
                    rows={2}
                    placeholder="例如：🔧 系統將於今晚 23:00 進行維護，期間暫停出價服務"
                    className="resize-none"
                  />
                </div>
                <div className="flex items-center justify-between flex-wrap gap-3">
                  {popupPreview(announcementText || "公告訊息預覽")}
                  <SaveBtn onClick={() => save('announcementText', announcementText, () => !announcementText.trim() ? "公告內容不可為空" : null)} />
                </div>
              </CardContent>
            </Card>

            {/* 首頁歡迎訊息 */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Home className="w-5 h-5 text-blue-500" />
                  <CardTitle className="text-lg">首頁歡迎訊息</CardTitle>
                </div>
                <CardDescription>訪客進入首頁時在頂部彈出一次的歡迎訊息（每次瀏覽器 session 只顯示一次）</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Switch
                    checked={homeWelcomeEnabled}
                    onCheckedChange={(v) => {
                      setHomeWelcomeEnabled(v);
                      setSetting.mutate({ key: 'homeWelcomeEnabled', value: v ? "true" : "false" });
                    }}
                  />
                  <Label className="cursor-pointer">
                    {homeWelcomeEnabled ? <span className="text-emerald-600 font-semibold">已開啟</span> : <span className="text-muted-foreground">已關閉</span>}
                  </Label>
                </div>
                <div>
                  <Label className="flex items-center gap-2 mb-2"><Home className="w-4 h-4 text-blue-500" />歡迎訊息內容</Label>
                  <Textarea
                    value={homeWelcomeMessage}
                    onChange={(e) => setHomeWelcomeMessage(e.target.value)}
                    rows={2}
                    placeholder="歡迎蒞臨 大BB錢幣店 🪙 每週更新精選藏品"
                    className="resize-none"
                  />
                </div>
                <div className="flex items-center justify-between flex-wrap gap-3">
                  {popupPreview(homeWelcomeMessage)}
                  <SaveBtn onClick={() => save('homeWelcomeMessage', homeWelcomeMessage, () => !homeWelcomeMessage.trim() ? "訊息不可為空" : null)} />
                </div>
              </CardContent>
            </Card>

            {/* 拍賣倒數提醒 */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Bell className="w-5 h-5 text-orange-500" />
                  <CardTitle className="text-lg">拍賣倒數提醒閾值</CardTitle>
                </div>
                <CardDescription>當拍賣剩餘時間少於設定值時，列表卡片顯示「即將結束」標記</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-end gap-4">
                  <div className="flex-1">
                    <Label htmlFor="endingSoonMinutes" className="flex items-center gap-2 mb-2">
                      <Clock className="w-4 h-4 text-orange-500" />提醒閾值（分鐘）
                    </Label>
                    <Input
                      id="endingSoonMinutes"
                      type="number" min={1} max={1440}
                      value={endingSoonMinutes}
                      onChange={(e) => setEndingSoonMinutes(e.target.value)}
                      className="max-w-[180px]" placeholder="30"
                    />
                    <p className="text-xs text-muted-foreground mt-1.5">
                      目前設定：<span className="font-semibold text-orange-600">{endingSoonMinutes} 分鐘</span>
                      {parseInt(endingSoonMinutes) >= 60 && (
                        <span>（即 {Math.floor(parseInt(endingSoonMinutes)/60)} 小時{parseInt(endingSoonMinutes)%60>0?` ${parseInt(endingSoonMinutes)%60} 分鐘`:''}）</span>
                      )}
                    </p>
                  </div>
                  <div className="mb-6">
                    <SaveBtn onClick={() => save('endingSoonMinutes', endingSoonMinutes, () => {
                      const v = parseInt(endingSoonMinutes, 10);
                      return (isNaN(v) || v < 1 || v > 1440) ? "請輸入 1 至 1440 分鐘之間的數值" : null;
                    })} />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 即將結束標籤文字 */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Tag className="w-5 h-5 text-orange-500" />
                  <CardTitle className="text-lg">即將結束標籤文字</CardTitle>
                </div>
                <CardDescription>拍賣列表卡片右上角的「即將結束」閃爍標籤顯示文字</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="flex items-center gap-2 mb-2"><Tag className="w-4 h-4 text-orange-500" />標籤文字</Label>
                  <Input
                    value={endingSoonText}
                    onChange={(e) => setEndingSoonText(e.target.value)}
                    placeholder="⏰ 即將結束"
                    className="max-w-xs"
                  />
                </div>
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">預覽：</span>
                    <Badge className="bg-orange-500 text-white text-[10px] px-1.5 py-0.5 animate-pulse">
                      {endingSoonText || "⏰ 即將結束"}
                    </Badge>
                  </div>
                  <SaveBtn onClick={() => save('endingSoonText', endingSoonText, () => !endingSoonText.trim() ? "標籤文字不可為空" : null)} />
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
                <CardDescription>商品頁活躍拍賣暫未有出價時，頁面頂部顯示的浮動提示</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="flex items-center gap-2 mb-2"><MessageSquare className="w-4 h-4 text-amber-500" />提示訊息內容</Label>
                  <Textarea
                    value={noBidMessage}
                    onChange={(e) => setNoBidMessage(e.target.value)}
                    rows={3}
                    placeholder="暫時未有出價 喜歡來一口的隨時就可以帶回家了 😁"
                    className="resize-none"
                  />
                </div>
                <div className="flex items-center justify-between flex-wrap gap-3">
                  {popupPreview(noBidMessage)}
                  <SaveBtn onClick={() => save('noBidMessage', noBidMessage, () => !noBidMessage.trim() ? "訊息不可為空" : null)} />
                </div>
              </CardContent>
            </Card>

            {/* 出價成功訊息 */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-emerald-500" />
                  <CardTitle className="text-lg">出價成功訊息</CardTitle>
                </div>
                <CardDescription>用戶出價成功後在商品頁出現的彈出訊息</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="flex items-center gap-2 mb-2"><CheckCircle className="w-4 h-4 text-emerald-500" />一般出價成功</Label>
                  <Input
                    value={bidSuccessMessage}
                    onChange={(e) => setBidSuccessMessage(e.target.value)}
                    placeholder="✅ 出價成功！您目前是最高出價者"
                  />
                </div>
                <div>
                  <Label className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-4 h-4 text-blue-500" />拍賣延長時（用 <code className="bg-muted px-1 rounded text-xs">&#123;minutes&#125;</code> 代表延長分鐘數）
                  </Label>
                  <Input
                    value={bidSuccessExtendedMessage}
                    onChange={(e) => setBidSuccessExtendedMessage(e.target.value)}
                    placeholder="✅ 出價成功！🛡️ 拍賣已延長 {minutes} 分鐘"
                  />
                </div>
                <div className="flex justify-end">
                  <SaveBtn onClick={() => {
                    if (!bidSuccessMessage.trim()) { toast.error("一般出價成功訊息不可為空"); return; }
                    if (!bidSuccessExtendedMessage.trim()) { toast.error("延長訊息不可為空"); return; }
                    setSetting.mutate({ key: 'bidSuccessMessage', value: bidSuccessMessage.trim() });
                    setSetting.mutate({ key: 'bidSuccessExtendedMessage', value: bidSuccessExtendedMessage.trim() });
                  }} />
                </div>
              </CardContent>
            </Card>

            {/* 未登入出價按鈕文字 */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <LogIn className="w-5 h-5 text-indigo-500" />
                  <CardTitle className="text-lg">未登入出價按鈕文字</CardTitle>
                </div>
                <CardDescription>訪客瀏覽商品頁時，出價區域顯示的登入引導按鈕文字</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="flex items-center gap-2 mb-2"><LogIn className="w-4 h-4 text-indigo-500" />按鈕文字</Label>
                  <Input
                    value={notLoggedInBidText}
                    onChange={(e) => setNotLoggedInBidText(e.target.value)}
                    placeholder="登入後出價"
                    className="max-w-xs"
                  />
                </div>
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="px-4 py-2 rounded-lg bg-amber-500 text-white text-sm font-medium inline-flex">
                    {notLoggedInBidText || "登入後出價"}
                  </div>
                  <SaveBtn onClick={() => save('notLoggedInBidText', notLoggedInBidText, () => !notLoggedInBidText.trim() ? "按鈕文字不可為空" : null)} />
                </div>
              </CardContent>
            </Card>

            {/* 登入歡迎訊息 */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-purple-500" />
                  <CardTitle className="text-lg">登入歡迎訊息</CardTitle>
                </div>
                <CardDescription>用戶登入成功後，底部彈出 toast 訊息的說明文字</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="flex items-center gap-2 mb-2"><Sparkles className="w-4 h-4 text-purple-500" />說明文字（副標題）</Label>
                  <Input
                    value={loginWelcomeDesc}
                    onChange={(e) => setLoginWelcomeDesc(e.target.value)}
                    placeholder="歡迎繼續瀏覽網站！"
                    className="max-w-sm"
                  />
                  <p className="text-xs text-muted-foreground mt-1.5">標題「手機登入成功！」或「電郵登入成功！」由系統自動生成</p>
                </div>
                <div className="flex items-center justify-between flex-wrap gap-3">
                  {popupPreview(loginWelcomeDesc)}
                  <SaveBtn onClick={() => save('loginWelcomeDesc', loginWelcomeDesc, () => !loginWelcomeDesc.trim() ? "說明文字不可為空" : null)} />
                </div>
              </CardContent>
            </Card>

            {/* 保證金警告信息 */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-500" />
                  <CardTitle className="text-lg">保證金警告信息</CardTitle>
                </div>
                <CardDescription>當商戶保證金餘額低於門檻時，商戶後台顯示的紅色警告提示文字</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="flex items-center gap-2 mb-2"><AlertCircle className="w-4 h-4 text-red-500" />警告信息內容</Label>
                  <Textarea
                    value={depositWarningMessage}
                    onChange={(e) => setDepositWarningMessage(e.target.value)}
                    rows={3}
                    placeholder="保證金水平維持不足，可以自行申請保證金充值或者聯絡管理員補交, 以免影響商戶一切正常運作。"
                    className="resize-none"
                  />
                </div>
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-2.5 flex items-start gap-2 text-sm text-red-600 max-w-sm">
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>{depositWarningMessage || "（空白）"}</span>
                  </div>
                  <SaveBtn onClick={() => save('depositWarningMessage', depositWarningMessage, () => !depositWarningMessage.trim() ? "警告信息不可為空" : null)} />
                </div>
              </CardContent>
            </Card>

            {/* 發佈點數不足錯誤信息 */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-blue-500" />
                  <CardTitle className="text-lg">發佈點數不足錯誤信息（條件一）</CardTitle>
                </div>
                <CardDescription>
                  商戶發佈拍賣時，若發佈點數不足所顯示的「條件一」錯誤信息。
                  用 <code className="bg-muted px-1 rounded text-xs">&#123;remaining&#125;</code> 代表剩餘點數，
                  <code className="bg-muted px-1 rounded text-xs">&#123;required&#125;</code> 代表需要點數。
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="flex items-center gap-2 mb-2"><AlertCircle className="w-4 h-4 text-blue-500" />錯誤信息模板</Label>
                  <Input
                    value={publishQuotaErrorMsg}
                    onChange={(e) => setPublishQuotaErrorMsg(e.target.value)}
                    placeholder="發佈點數不足（剩餘 {remaining} 次，需要 {required} 次）"
                  />
                </div>
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-sm text-blue-800 max-w-sm">
                    <span className="font-semibold">條件一：</span>
                    {publishQuotaErrorMsg
                      .replace('{remaining}', '0')
                      .replace('{required}', '3') || "（空白）"}
                  </div>
                  <SaveBtn onClick={() => save('publishQuotaErrorMsg', publishQuotaErrorMsg, () => !publishQuotaErrorMsg.trim() ? "錯誤信息不可為空" : null)} />
                </div>
              </CardContent>
            </Card>

            {/* 發佈保證金不足錯誤信息 */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-amber-500" />
                  <CardTitle className="text-lg">發佈保證金不足錯誤信息</CardTitle>
                </div>
                <CardDescription>
                  商戶發佈拍賣時，若保證金未達維持水平所顯示的「條件二」錯誤信息。
                  用 <code className="bg-muted px-1 rounded text-xs">&#123;balance&#125;</code> 代表餘額，
                  <code className="bg-muted px-1 rounded text-xs">&#123;required&#125;</code> 代表需維持水平。
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="flex items-center gap-2 mb-2"><AlertCircle className="w-4 h-4 text-amber-500" />錯誤信息模板</Label>
                  <Input
                    value={publishDepositErrorMsg}
                    onChange={(e) => setPublishDepositErrorMsg(e.target.value)}
                    placeholder="保證金維持水平不足（餘額 {balance}，需要 {required}）"
                  />
                </div>
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800 max-w-sm">
                    <span className="font-semibold">條件二：</span>
                    {publishDepositErrorMsg
                      .replace('{balance}', '$499.00')
                      .replace('{required}', '$500.00') || "（空白）"}
                  </div>
                  <SaveBtn onClick={() => save('publishDepositErrorMsg', publishDepositErrorMsg, () => !publishDepositErrorMsg.trim() ? "錯誤信息不可為空" : null)} />
                </div>
              </CardContent>
            </Card>

            {/* 套餐資料同步 */}
            <Card className="border-blue-200">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Package2 className="w-4 h-4 text-blue-600" />
                  套餐資料同步（UAT → Production）
                </CardTitle>
                <CardDescription>
                  將「保證金套餐」及「月費套餐」設定從 UAT 匯出，再在 Production 匯入。<br />
                  <span className="text-red-500 font-medium">⚠️ 匯入會覆蓋目標環境的全部套餐設定</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  className="border-blue-200 text-blue-700 hover:bg-blue-50"
                  onClick={handleExportPackages}
                  disabled={exportPackagesMut.isPending}
                >
                  <Download className="w-4 h-4 mr-2" />
                  {exportPackagesMut.isPending ? "匯出中…" : "匯出套餐設定 JSON"}
                </Button>
                <label>
                  <Button
                    asChild
                    variant="outline"
                    className="border-green-200 text-green-700 hover:bg-green-50 cursor-pointer"
                    disabled={importLoading || importPackagesMut.isPending}
                  >
                    <span>
                      <Upload className="w-4 h-4 mr-2" />
                      {importLoading || importPackagesMut.isPending ? "匯入中…" : "匯入套餐設定 JSON"}
                    </span>
                  </Button>
                  <input
                    type="file"
                    accept=".json,application/json"
                    className="hidden"
                    onChange={handleImportPackages}
                    disabled={importLoading || importPackagesMut.isPending}
                  />
                </label>
              </CardContent>
            </Card>

            {/* 所有設定值 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">目前所有設定值</CardTitle>
                <CardDescription>系統中所有已儲存的站點設定</CardDescription>
              </CardHeader>
              <CardContent>
                {settings && Object.keys(settings as Record<string, string>).length > 0 ? (
                  <div className="space-y-2">
                    {Object.entries(settings as Record<string, string>).map(([key, value]) => (
                      <div key={key} className="flex items-center justify-between py-2 border-b last:border-0 gap-2">
                        <span className="text-sm font-mono text-muted-foreground shrink-0">{key}</span>
                        <Badge variant="outline" className="font-mono truncate max-w-[200px]" title={value}>{value}</Badge>
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
