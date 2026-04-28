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
  Download, Upload, Package2, Plus, Trash2, Shuffle, Shield,
  ChevronUp, ChevronDown, FolderOpen
} from "lucide-react";
import { DEFAULT_CATEGORIES } from "@/lib/categories";

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

  // 商戶主頁聯絡訊息預設（WhatsApp / Messenger 共用，會自動加入商戶網址）
  const [merchantContactMessage, setMerchantContactMessage] = useState("你好，我想查詢你的商品");

  // 發佈點數不足錯誤信息模板
  const [publishQuotaErrorMsg, setPublishQuotaErrorMsg] = useState("發佈點數不足（剩餘 {remaining} 次，需要 {required} 次）");

  // 發佈保證金不足錯誤信息模板
  const [publishDepositErrorMsg, setPublishDepositErrorMsg] = useState("保證金維持水平不足（餘額 {balance}，需要 {required}）");

  // 首頁拍賣標題字句
  const DEFAULT_AUCTION_TITLES = [
    "🪙 正在拍賣", "🔨 槌音未落", "🏛️ 競投廳開放中", "⚡ 搶標進行中",
    "🔥 熱烈競逐中", "⏳ 倒數·出價·勝負未分", "💎 珍品爭奪中",
    "🏆 群雄競投·珍藏等您", "✨ 現正競投", "🎯 即時出價戰",
  ];
  const [auctionTitles, setAuctionTitles] = useState<string[]>(DEFAULT_AUCTION_TITLES);
  const [newTitleInput, setNewTitleInput] = useState("");

  // 商品分類
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [newCategoryInput, setNewCategoryInput] = useState("");

  // OTP 速率限制設定
  const [otpCooldownSecs, setOtpCooldownSecs] = useState("60");
  const [otpMaxPerHour, setOtpMaxPerHour] = useState("3");
  const [otpIpMaxPerWindow, setOtpIpMaxPerWindow] = useState("10");
  const [otpIpWindowMins, setOtpIpWindowMins] = useState("15");

  // 大額訂單保護設定
  const [largeOrderCancelThreshold, setLargeOrderCancelThreshold] = useState("5000");
  const [largeOrderPendingDays, setLargeOrderPendingDays] = useState("7");

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
    if (s.merchantContactMessage) setMerchantContactMessage(s.merchantContactMessage);
    if (s.publishQuotaErrorMsg) setPublishQuotaErrorMsg(s.publishQuotaErrorMsg);
    if (s.publishDepositErrorMsg) setPublishDepositErrorMsg(s.publishDepositErrorMsg);
    if (s.auctionSectionTitles) {
      try {
        const parsed = JSON.parse(s.auctionSectionTitles);
        if (Array.isArray(parsed) && parsed.length > 0) setAuctionTitles(parsed);
      } catch {}
    }
    if (s.otpCooldownSecs) setOtpCooldownSecs(s.otpCooldownSecs);
    if (s.otpMaxPerHour) setOtpMaxPerHour(s.otpMaxPerHour);
    if (s.otpIpMaxPerWindow) setOtpIpMaxPerWindow(s.otpIpMaxPerWindow);
    if (s.otpIpWindowMins) setOtpIpWindowMins(s.otpIpWindowMins);
    if (s.largeOrderCancelThreshold) setLargeOrderCancelThreshold(s.largeOrderCancelThreshold);
    if (s.largeOrderPendingDays) setLargeOrderPendingDays(s.largeOrderPendingDays);
    if (s.productCategories) {
      try {
        const parsed = JSON.parse(s.productCategories);
        if (Array.isArray(parsed) && parsed.length > 0) setCategories(parsed);
      } catch {}
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

            {/* 首頁拍賣標題字句管理 */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Shuffle className="w-5 h-5 text-purple-500" />
                  <CardTitle className="text-lg">首頁拍賣標題字句</CardTitle>
                </div>
                <CardDescription>首頁「正在拍賣」區塊的標題字句，系統每次隨機抽一個顯示。可自由增減。</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 現有字句清單 */}
                <div className="space-y-2">
                  {auctionTitles.map((title, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 bg-amber-50 border border-amber-100 rounded-lg">
                      <span className="flex-1 text-sm font-medium text-amber-900">{title}</span>
                      <button
                        onClick={() => {
                          const next = auctionTitles.filter((_, i) => i !== idx);
                          if (next.length === 0) { toast.error("至少保留一個字句"); return; }
                          setAuctionTitles(next);
                        }}
                        className="p-1 rounded hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors"
                        title="刪除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* 新增字句 */}
                <div className="flex gap-2">
                  <Input
                    value={newTitleInput}
                    onChange={(e) => setNewTitleInput(e.target.value)}
                    placeholder="例：🎉 全新拍品登場"
                    className="flex-1"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newTitleInput.trim()) {
                        setAuctionTitles(prev => [...prev, newTitleInput.trim()]);
                        setNewTitleInput("");
                      }
                    }}
                  />
                  <Button
                    variant="outline"
                    className="border-amber-300 text-amber-700 hover:bg-amber-50 gap-1"
                    onClick={() => {
                      if (!newTitleInput.trim()) { toast.error("請輸入字句"); return; }
                      setAuctionTitles(prev => [...prev, newTitleInput.trim()]);
                      setNewTitleInput("");
                    }}
                  >
                    <Plus className="w-4 h-4" />新增
                  </Button>
                </div>

                <div className="flex items-center justify-between flex-wrap gap-3 pt-1">
                  <p className="text-xs text-muted-foreground">共 {auctionTitles.length} 個字句，每次訪問隨機顯示其中一個</p>
                  <Button
                    onClick={() => save('auctionSectionTitles', JSON.stringify(auctionTitles), () => auctionTitles.length === 0 ? "至少保留一個字句" : null)}
                    disabled={setSetting.isPending}
                    className="bg-amber-600 hover:bg-amber-700 text-white gap-2"
                  >
                    <Save className="w-4 h-4" />
                    {setSetting.isPending ? "儲存中..." : "儲存字句清單"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* 商品分類管理 */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <FolderOpen className="w-5 h-5 text-amber-500" />
                  <CardTitle className="text-lg">拍賣／出售商品分類</CardTitle>
                </div>
                <CardDescription>管理全站所有商品分類，拍賣及出售商品均使用此設定。可新增、刪除、調整排序。</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 分類列表 */}
                <div className="space-y-1.5">
                  {categories.map((cat, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 bg-amber-50/60 border border-amber-100 rounded-lg">
                      <span className="flex-1 text-sm text-amber-900 font-medium">{cat}</span>
                      <button
                        disabled={idx === 0}
                        onClick={() => setCategories(prev => {
                          const arr = [...prev];
                          [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
                          return arr;
                        })}
                        className="p-1 rounded hover:bg-amber-100 disabled:opacity-30 transition-colors"
                        title="上移"
                      >
                        <ChevronUp className="w-3.5 h-3.5 text-amber-600" />
                      </button>
                      <button
                        disabled={idx === categories.length - 1}
                        onClick={() => setCategories(prev => {
                          const arr = [...prev];
                          [arr[idx + 1], arr[idx]] = [arr[idx], arr[idx + 1]];
                          return arr;
                        })}
                        className="p-1 rounded hover:bg-amber-100 disabled:opacity-30 transition-colors"
                        title="下移"
                      >
                        <ChevronDown className="w-3.5 h-3.5 text-amber-600" />
                      </button>
                      <button
                        onClick={() => setCategories(prev => prev.filter((_, i) => i !== idx))}
                        className="p-1 rounded hover:bg-red-100 transition-colors"
                        title="刪除"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-400" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* 新增分類 */}
                <div className="flex gap-2">
                  <Input
                    value={newCategoryInput}
                    onChange={(e) => setNewCategoryInput(e.target.value)}
                    placeholder="新增分類名稱，例：錯體鈔/幣"
                    className="flex-1"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newCategoryInput.trim()) {
                        if (categories.includes(newCategoryInput.trim())) { toast.error("分類已存在"); return; }
                        setCategories(prev => [...prev, newCategoryInput.trim()]);
                        setNewCategoryInput("");
                      }
                    }}
                  />
                  <Button
                    variant="outline"
                    className="border-amber-300 text-amber-700 hover:bg-amber-50 gap-1"
                    onClick={() => {
                      if (!newCategoryInput.trim()) { toast.error("請輸入分類名稱"); return; }
                      if (categories.includes(newCategoryInput.trim())) { toast.error("分類已存在"); return; }
                      setCategories(prev => [...prev, newCategoryInput.trim()]);
                      setNewCategoryInput("");
                    }}
                  >
                    <Plus className="w-4 h-4" />新增
                  </Button>
                </div>

                <div className="flex items-center justify-between flex-wrap gap-3 pt-1">
                  <div className="flex gap-2">
                    <p className="text-xs text-muted-foreground">共 {categories.length} 個分類</p>
                    <button
                      className="text-xs text-amber-600 underline hover:text-amber-800"
                      onClick={() => setCategories(DEFAULT_CATEGORIES)}
                    >還原預設</button>
                  </div>
                  <Button
                    onClick={() => save('productCategories', JSON.stringify(categories), () => categories.length === 0 ? "至少保留一個分類" : null)}
                    disabled={setSetting.isPending}
                    className="bg-amber-600 hover:bg-amber-700 text-white gap-2"
                  >
                    <Save className="w-4 h-4" />
                    {setSetting.isPending ? "儲存中..." : "儲存分類設定"}
                  </Button>
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

            {/* 商戶主頁聯絡訊息預設 */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-green-500" />
                  <CardTitle className="text-lg">商戶主頁聯絡訊息</CardTitle>
                </div>
                <CardDescription>
                  訪客在商戶主頁點 WhatsApp / Messenger 時，預先填入的訊息內容。系統會自動在訊息末尾加上商戶網址。
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="flex items-center gap-2 mb-2"><MessageSquare className="w-4 h-4 text-green-500" />訊息內容</Label>
                  <Textarea
                    value={merchantContactMessage}
                    onChange={(e) => setMerchantContactMessage(e.target.value)}
                    rows={2}
                    placeholder="你好，我想查詢你的商品"
                    className="resize-none"
                  />
                  <p className="text-xs text-gray-500 mt-1">實際發送格式：<span className="font-mono">{merchantContactMessage || "（空白）"} + 商戶網址</span></p>
                </div>
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-2.5 text-sm text-green-700 max-w-sm whitespace-pre-line">
                    {`${merchantContactMessage || "（空白）"}\nhttps://hongxcollections.com/merchants/123`}
                  </div>
                  <SaveBtn onClick={() => save('merchantContactMessage', merchantContactMessage, () => !merchantContactMessage.trim() ? "訊息不可為空" : null)} />
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

            {/* OTP 驗證碼安全限制 */}
            <Card className="border-orange-200">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-orange-500" />
                  <CardTitle className="text-lg">OTP 驗證碼安全限制</CardTitle>
                </div>
                <CardDescription>
                  控制手機驗證碼的發送頻率，防止濫用及 DoS 攻擊。設定儲存後即時生效，無需重啟。
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* 每次重發冷卻 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="flex items-center gap-2 mb-1.5">
                      <Clock className="w-4 h-4 text-orange-500" />
                      重發冷卻時間（秒）
                    </Label>
                    <Input
                      type="number" min={10} max={600}
                      value={otpCooldownSecs}
                      onChange={e => setOtpCooldownSecs(e.target.value)}
                      className="max-w-[160px]"
                      placeholder="60"
                    />
                    <p className="text-xs text-muted-foreground mt-1">同一號碼兩次發送之間的最短間隔，預設 60 秒</p>
                  </div>
                  <div>
                    <Label className="flex items-center gap-2 mb-1.5">
                      <Shield className="w-4 h-4 text-orange-500" />
                      每小時最多發送次數（每號碼）
                    </Label>
                    <Input
                      type="number" min={1} max={20}
                      value={otpMaxPerHour}
                      onChange={e => setOtpMaxPerHour(e.target.value)}
                      className="max-w-[160px]"
                      placeholder="3"
                    />
                    <p className="text-xs text-muted-foreground mt-1">同一號碼在滾動 1 小時視窗內的上限，預設 3 次</p>
                  </div>
                  <div>
                    <Label className="flex items-center gap-2 mb-1.5">
                      <Shield className="w-4 h-4 text-red-500" />
                      IP 最多發送次數（同一視窗）
                    </Label>
                    <Input
                      type="number" min={1} max={100}
                      value={otpIpMaxPerWindow}
                      onChange={e => setOtpIpMaxPerWindow(e.target.value)}
                      className="max-w-[160px]"
                      placeholder="10"
                    />
                    <p className="text-xs text-muted-foreground mt-1">同一 IP 在視窗期內的發送上限，預設 10 次</p>
                  </div>
                  <div>
                    <Label className="flex items-center gap-2 mb-1.5">
                      <Clock className="w-4 h-4 text-red-500" />
                      IP 限制視窗（分鐘）
                    </Label>
                    <Input
                      type="number" min={1} max={120}
                      value={otpIpWindowMins}
                      onChange={e => setOtpIpWindowMins(e.target.value)}
                      className="max-w-[160px]"
                      placeholder="15"
                    />
                    <p className="text-xs text-muted-foreground mt-1">IP 限制的滾動時間視窗，預設 15 分鐘</p>
                  </div>
                </div>

                {/* 目前設定摘要 */}
                <div className="rounded-xl bg-orange-50 border border-orange-100 px-4 py-3 text-sm space-y-1">
                  <p className="font-semibold text-orange-700 mb-1">📋 目前設定摘要</p>
                  <p className="text-orange-600">• 每次重發冷卻：<span className="font-semibold">{otpCooldownSecs} 秒</span></p>
                  <p className="text-orange-600">• 每號碼每小時上限：<span className="font-semibold">{otpMaxPerHour} 次</span></p>
                  <p className="text-orange-600">• 每 IP 在 {otpIpWindowMins} 分鐘內上限：<span className="font-semibold">{otpIpMaxPerWindow} 次</span></p>
                </div>

                <div className="flex justify-end">
                  <Button
                    onClick={() => {
                      const c = parseInt(otpCooldownSecs, 10);
                      const m = parseInt(otpMaxPerHour, 10);
                      const ip = parseInt(otpIpMaxPerWindow, 10);
                      const w = parseInt(otpIpWindowMins, 10);
                      if (isNaN(c) || c < 10 || c > 600) { toast.error("重發冷卻須介乎 10–600 秒"); return; }
                      if (isNaN(m) || m < 1 || m > 20) { toast.error("每小時上限須介乎 1–20 次"); return; }
                      if (isNaN(ip) || ip < 1 || ip > 100) { toast.error("IP 上限須介乎 1–100 次"); return; }
                      if (isNaN(w) || w < 1 || w > 120) { toast.error("IP 視窗須介乎 1–120 分鐘"); return; }
                      setSetting.mutate({ key: 'otpCooldownSecs', value: String(c) });
                      setSetting.mutate({ key: 'otpMaxPerHour', value: String(m) });
                      setSetting.mutate({ key: 'otpIpMaxPerWindow', value: String(ip) });
                      setSetting.mutate({ key: 'otpIpWindowMins', value: String(w) });
                    }}
                    disabled={setSetting.isPending}
                    className="bg-orange-600 hover:bg-orange-700 text-white gap-2"
                  >
                    <Save className="w-4 h-4" />
                    {setSetting.isPending ? "儲存中..." : "儲存 OTP 限制設定"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* 大額訂單保護設定 */}
            <Card className="border-orange-200">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="w-4 h-4 text-orange-600" />
                  大額訂單保護
                </CardTitle>
                <CardDescription>
                  當訂單總額達到門檻，商戶將無法自行取消訂單，須聯絡管理員處理。逾期天數超過設定值將顯示紅色警告。
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>取消保護門檻（HKD）</Label>
                    <Input
                      type="number"
                      min="0"
                      value={largeOrderCancelThreshold}
                      onChange={e => setLargeOrderCancelThreshold(e.target.value)}
                      placeholder="5000"
                    />
                    <p className="text-xs text-muted-foreground">訂單總額 ≥ 此金額時商戶不能自行取消</p>
                  </div>
                  <div className="space-y-2">
                    <Label>逾期警告天數</Label>
                    <Input
                      type="number"
                      min="1"
                      value={largeOrderPendingDays}
                      onChange={e => setLargeOrderPendingDays(e.target.value)}
                      placeholder="7"
                    />
                    <p className="text-xs text-muted-foreground">待確認超過此天數將顯示紅色警告</p>
                  </div>
                </div>
                <Button
                  onClick={() => {
                    const t = parseFloat(largeOrderCancelThreshold);
                    const d = parseInt(largeOrderPendingDays, 10);
                    if (isNaN(t) || t < 0) { toast.error("請輸入有效的門檻金額"); return; }
                    if (isNaN(d) || d < 1) { toast.error("請輸入有效的逾期天數"); return; }
                    setSetting.mutate({ key: 'largeOrderCancelThreshold', value: String(t) });
                    setSetting.mutate({ key: 'largeOrderPendingDays', value: String(d) });
                  }}
                  disabled={setSetting.isPending}
                  className="bg-orange-600 hover:bg-orange-700 text-white gap-2"
                >
                  <Save className="w-4 h-4" />
                  {setSetting.isPending ? "儲存中..." : "儲存大額訂單保護設定"}
                </Button>
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
