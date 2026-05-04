import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Slider } from "@/components/ui/slider";
import { ChevronLeft, Settings, CalendarClock, Save, Loader2, Info, Tag, ShieldCheck, Store, Camera, X, Droplets, LayoutList } from "lucide-react";

const BID_INCREMENT_OPTIONS = [30, 50, 100, 200, 300, 500, 1000, 2000, 3000, 5000];

export default function MerchantSettings() {
  const { isAuthenticated } = useAuth();

  const { data: siteSettingsAll } = trpc.siteSettings.getAll.useQuery(undefined, { staleTime: 5 * 60 * 1000 });
  const fbBatchShareEnabled = (siteSettingsAll as Record<string, string> | undefined)?.fbBatchShareEnabled !== "false";
  const { data: settings, isLoading } = trpc.merchants.getSettings.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const { data: myApp, isLoading: loadingApp } = trpc.merchants.myApplication.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const utils = trpc.useUtils();
  const updateMutation = trpc.merchants.updateSettings.useMutation({
    onSuccess: () => {
      toast.success("設定已儲存！");
      utils.merchants.getSettings.invalidate();
    },
    onError: (err) => toast.error(err.message || "儲存失敗"),
  });
  const setPageSizes = trpc.merchants.setPageSizes.useMutation({
    onSuccess: () => { utils.merchants.getSettings.invalidate(); utils.merchants.listApprovedMerchants.invalidate(); toast.success("每頁顯示數量已儲存"); },
    onError: (err) => toast.error(err.message || "儲存失敗"),
  });

  // ── 商戶資料 ──
  const [profileMerchantName, setProfileMerchantName] = useState("");
  const [profileSelfIntro, setProfileSelfIntro] = useState("");
  const [profileWhatsapp, setProfileWhatsapp] = useState("");
  const [profileFacebook, setProfileFacebook] = useState("");
  const [profileIcon, setProfileIcon] = useState<string | null>(null);
  const [profileInitialized, setProfileInitialized] = useState(false);
  const [iconUploading, setIconUploading] = useState(false);
  const iconInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (myApp && !profileInitialized) {
      setProfileMerchantName(myApp.merchantName ?? "");
      setProfileSelfIntro(myApp.selfIntro ?? "");
      setProfileWhatsapp(myApp.whatsapp ?? "");
      setProfileFacebook((myApp as any).facebook ?? "");
      setProfileIcon(myApp.merchantIcon ?? null);
      setProfileInitialized(true);
    }
  }, [myApp, profileInitialized]);

  const uploadPhotoMutation = trpc.merchants.uploadPhoto.useMutation({
    onSuccess: ({ url }) => { setProfileIcon(url); setIconUploading(false); toast.success("圖片上傳成功"); },
    onError: (err) => { setIconUploading(false); toast.error(err.message || "圖片上傳失敗"); },
  });

  const updateProfileMutation = trpc.merchants.updateProfile.useMutation({
    onSuccess: () => {
      toast.success("商戶資料已更新！");
      utils.merchants.myApplication.invalidate();
    },
    onError: (err) => toast.error(err.message || "更新失敗"),
  });

  const handleIconChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIconUploading(true);
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      uploadPhotoMutation.mutate({ imageData: base64, fileName: file.name, mimeType: file.type });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleSaveProfile = () => {
    if (!profileMerchantName.trim()) { toast.error("請填寫商戶名稱"); return; }
    if (!profileWhatsapp.trim()) { toast.error("請填寫 WhatsApp"); return; }
    updateProfileMutation.mutate({
      merchantName: profileMerchantName.trim(),
      selfIntro: profileSelfIntro.trim(),
      whatsapp: profileWhatsapp.trim(),
      facebook: profileFacebook.trim() || null,
      merchantIcon: profileIcon,
    });
  };

  const [dayOffset, setDayOffset] = useState<string>("7");
  const [endTime, setEndTime] = useState<string>("23:00");
  const [startingPrice, setStartingPrice] = useState<string>("0");
  const [bidIncrement, setBidIncrement] = useState<string>("30");
  const [antiSnipeEnabled, setAntiSnipeEnabled] = useState(true);
  const [antiSnipeMinutes, setAntiSnipeMinutes] = useState<string>("3");
  const [extendMinutes, setExtendMinutes] = useState<string>("3");
  const [paymentInstructions, setPaymentInstructions] = useState<string>("");
  const [deliveryInfo, setDeliveryInfo] = useState<string>("");
  const [fbShareTemplate, setFbShareTemplate] = useState<string>("");
  const [fbShareTemplateProduct, setFbShareTemplateProduct] = useState<string>("");
  const [fbGroups, setFbGroups] = useState<Array<{ name: string; url: string }>>([]);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupUrl, setNewGroupUrl] = useState("");
  const [initialized, setInitialized] = useState(false);

  const updateFbGroupsMutation = trpc.merchants.updateFbGroups.useMutation({
    onSuccess: () => { toast.success("FB 群組清單已儲存！"); utils.merchants.getSettings.invalidate(); },
    onError: (err) => toast.error(err.message || "儲存失敗"),
  });

  const handleAddGroup = () => {
    const name = newGroupName.trim();
    const url = newGroupUrl.trim();
    if (!name) { toast.error("請填寫群組名稱"); return; }
    if (!/^https?:\/\/(www\.|m\.|web\.)?facebook\.com\//i.test(url)) {
      toast.error("請填寫有效嘅 Facebook 群組網址"); return;
    }
    if (fbGroups.length >= 50) { toast.error("最多只可加 50 個群組"); return; }
    const next = [...fbGroups, { name, url }];
    setFbGroups(next);
    setNewGroupName("");
    setNewGroupUrl("");
    updateFbGroupsMutation.mutate({ groups: next });
  };

  const handleRemoveGroup = (idx: number) => {
    const next = fbGroups.filter((_, i) => i !== idx);
    setFbGroups(next);
    updateFbGroupsMutation.mutate({ groups: next });
  };

  // ── 水印設定 ──
  const [wmEnabled, setWmEnabled] = useState(true);
  const [wmText, setWmText] = useState("");
  const [wmOpacity, setWmOpacity] = useState(45);
  const [wmShadow, setWmShadow] = useState(true);
  const [wmPosition, setWmPosition] = useState("center-diagonal");
  const [wmSize, setWmSize] = useState(12);
  const [wmInitialized, setWmInitialized] = useState(false);

  const { data: wmData, isLoading: wmLoading } = trpc.merchants.getWatermarkSettings.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const wmMutation = trpc.merchants.updateWatermarkSettings.useMutation({
    onSuccess: () => {
      toast.success("水印設定已儲存！");
      utils.merchants.getWatermarkSettings.invalidate();
    },
    onError: (err) => toast.error(err.message || "儲存失敗"),
  });

  useEffect(() => {
    if (wmData && !wmInitialized && (myApp !== undefined || !loadingApp)) {
      setWmEnabled(wmData.watermarkEnabled === 1);
      setWmText(wmData.watermarkText ?? myApp?.merchantName ?? "");
      setWmOpacity(wmData.watermarkOpacity);
      setWmShadow(wmData.watermarkShadow === 1);
      setWmPosition(wmData.watermarkPosition);
      setWmSize(wmData.watermarkSize ?? 12);
      setWmInitialized(true);
    }
  }, [wmData, wmInitialized, myApp, loadingApp]);

  const handleSaveWatermark = () => {
    wmMutation.mutate({
      watermarkEnabled: wmEnabled ? 1 : 0,
      watermarkText: wmText.trim() || null,
      watermarkOpacity: wmOpacity,
      watermarkShadow: wmShadow ? 1 : 0,
      watermarkPosition: wmPosition as any,
      watermarkSize: wmSize,
    });
  };

  useEffect(() => {
    if (settings && !initialized) {
      setDayOffset(String(settings.defaultEndDayOffset));
      setEndTime(settings.defaultEndTime);
      setStartingPrice(String(settings.defaultStartingPrice ?? 0));
      setBidIncrement(String(settings.defaultBidIncrement ?? 30));
      setAntiSnipeEnabled((settings.defaultAntiSnipeEnabled ?? 1) === 1);
      setAntiSnipeMinutes(String(settings.defaultAntiSnipeMinutes ?? 3));
      setExtendMinutes(String(settings.defaultExtendMinutes ?? 3));
      setPaymentInstructions(settings.paymentInstructions ?? "");
      setDeliveryInfo(settings.deliveryInfo ?? "");
      setFbShareTemplate(settings.fbShareTemplate ?? "");
      setFbShareTemplateProduct((settings as { fbShareTemplateProduct?: string | null }).fbShareTemplateProduct ?? "");
      try {
        const raw = (settings as { fbGroups?: string | null }).fbGroups;
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            setFbGroups(parsed.filter((g: any) => g && typeof g.name === "string" && typeof g.url === "string"));
          }
        }
      } catch {}
      setInitialized(true);
    }
  }, [settings, initialized]);

  // 預覽：根據今天日期計算示範結束時間
  const previewEndDate = (() => {
    const offset = parseInt(dayOffset, 10);
    if (isNaN(offset) || offset < 1) return null;
    const d = new Date();
    d.setDate(d.getDate() + offset);
    const [hh, mm] = endTime.split(":");
    d.setHours(parseInt(hh || "23", 10), parseInt(mm || "0", 10), 0, 0);
    return d;
  })();

  const previewLabel = previewEndDate
    ? previewEndDate.toLocaleString("zh-HK", {
        year: "numeric", month: "long", day: "numeric",
        weekday: "short", hour: "2-digit", minute: "2-digit",
      })
    : "—";

  const handleSave = () => {
    const offset = parseInt(dayOffset, 10);
    if (isNaN(offset) || offset < 1 || offset > 365) {
      toast.error("天數請填 1–365 之間的整數");
      return;
    }
    if (!/^\d{2}:\d{2}$/.test(endTime)) {
      toast.error("時間格式須為 HH:MM，例如 23:00");
      return;
    }
    const sp = parseFloat(startingPrice);
    if (isNaN(sp) || sp < 0) {
      toast.error("起拍價預值不能為負數");
      return;
    }
    const bi = parseInt(bidIncrement, 10);
    if (isNaN(bi) || bi < 1) {
      toast.error("加幅預值請填 1 或以上的整數");
      return;
    }
    const asm = parseInt(antiSnipeMinutes, 10);
    const exm = parseInt(extendMinutes, 10);
    if (isNaN(asm) || asm < 0 || asm > 60) { toast.error("反狙擊觸發時間請填 0–60 分鐘"); return; }
    if (isNaN(exm) || exm < 1 || exm > 60) { toast.error("延長時間請填 1–60 分鐘"); return; }
    updateMutation.mutate({ defaultEndDayOffset: offset, defaultEndTime: endTime, defaultStartingPrice: sp, defaultBidIncrement: bi, defaultAntiSnipeEnabled: antiSnipeEnabled ? 1 : 0, defaultAntiSnipeMinutes: asm, defaultExtendMinutes: exm, paymentInstructions: paymentInstructions.trim() || null, deliveryInfo: deliveryInfo.trim() || null, fbShareTemplate: fbShareTemplate.trim() || null, fbShareTemplateProduct: fbShareTemplateProduct.trim() || null });
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">請先登入</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      {/* 吸附在主頭部導航下方的麵包屑欄 */}
      <div className="border-b bg-card sticky top-16 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-2 text-sm flex-wrap">
          <Link href="/merchant-dashboard">
            <span className="text-muted-foreground hover:text-foreground cursor-pointer flex items-center gap-1">
              <ChevronLeft className="w-3.5 h-3.5" />商戶後台
            </span>
          </Link>
          <span className="text-muted-foreground">/</span>
          <span className="font-medium text-amber-600">商戶管理</span>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-8 pb-28 space-y-6">
        {/* 標題 */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
            <Settings className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold">商戶管理</h1>
            <p className="text-sm text-muted-foreground mt-0.5">設定商戶資料及拍賣預設參數</p>
          </div>
        </div>

        {/* 商戶資料卡片 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Store className="w-4 h-4 text-amber-500" />
              商戶資料
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {loadingApp ? (
              <div className="flex items-center gap-2 text-muted-foreground py-4">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">載入中…</span>
              </div>
            ) : (
              <>
                {/* 商戶圖標 */}
                <div className="space-y-2">
                  <Label>商戶圖標</Label>
                  <div className="flex items-center gap-4">
                    <div className="relative w-16 h-16 rounded-xl overflow-hidden border-2 border-amber-200 bg-amber-50 flex items-center justify-center flex-shrink-0">
                      {iconUploading ? (
                        <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
                      ) : profileIcon ? (
                        <>
                          <img src={profileIcon} alt="商戶圖標" className="w-full h-full object-cover" />
                          <button
                            onClick={() => setProfileIcon(null)}
                            className="absolute top-0.5 right-0.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center"
                          >
                            <X className="w-3 h-3 text-white" />
                          </button>
                        </>
                      ) : (
                        <Store className="w-7 h-7 text-amber-300" />
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <input
                        ref={iconInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={handleIconChange}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-1.5 border-amber-200 text-amber-700 hover:bg-amber-50"
                        onClick={() => iconInputRef.current?.click()}
                        disabled={iconUploading}
                      >
                        <Camera className="w-3.5 h-3.5" />
                        上傳圖片
                      </Button>
                      <p className="text-xs text-muted-foreground">支援 JPG / PNG / WebP，最大 8MB</p>
                    </div>
                  </div>
                </div>

                {/* 商戶名稱 */}
                <div className="space-y-2">
                  <Label htmlFor="profileMerchantName">商戶名稱 *</Label>
                  <Input
                    id="profileMerchantName"
                    value={profileMerchantName}
                    onChange={(e) => setProfileMerchantName(e.target.value)}
                    maxLength={100}
                    placeholder="請輸入商戶名稱"
                  />
                </div>

                {/* WhatsApp */}
                <div className="space-y-2">
                  <Label htmlFor="profileWhatsapp">WhatsApp 聯絡號碼 *</Label>
                  <Input
                    id="profileWhatsapp"
                    value={profileWhatsapp}
                    onChange={(e) => setProfileWhatsapp(e.target.value)}
                    maxLength={50}
                    placeholder="例：+852 9123 4567"
                  />
                </div>

                {/* Facebook Messenger */}
                <div className="space-y-2">
                  <Label htmlFor="profileFacebook">Facebook Messenger 連結（選填）</Label>
                  <Input
                    id="profileFacebook"
                    value={profileFacebook}
                    onChange={(e) => setProfileFacebook(e.target.value)}
                    maxLength={500}
                    placeholder="例：https://m.me/yourname（個人）或 https://m.me/yourpage（專頁）"
                  />
                  <p className="text-xs text-muted-foreground">個人帳號或專頁均可。填寫後，商品詳情頁會顯示 Messenger 聯絡按鈕</p>
                </div>

                {/* 商戶簡介 */}
                <div className="space-y-2">
                  <Label htmlFor="profileSelfIntro">商戶簡介</Label>
                  <Textarea
                    id="profileSelfIntro"
                    value={profileSelfIntro}
                    onChange={(e) => setProfileSelfIntro(e.target.value)}
                    maxLength={1000}
                    rows={4}
                    placeholder="介紹你的商戶、專業範疇及特色…"
                  />
                  <p className="text-xs text-muted-foreground text-right">{profileSelfIntro.length}/1000</p>
                </div>

                <div className="flex justify-end pt-1">
                  <Button
                    onClick={handleSaveProfile}
                    disabled={updateProfileMutation.isPending || iconUploading}
                    className="gold-gradient text-white border-0 gap-1.5"
                  >
                    {updateProfileMutation.isPending
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Save className="w-4 h-4" />}
                    儲存資料
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* 起拍價預值卡片 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Tag className="w-4 h-4 text-amber-500" />
              預設起拍價
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {isLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground py-4">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">載入中…</span>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="startingPrice">起拍價預設值</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground whitespace-nowrap">HK$</span>
                    <Input
                      id="startingPrice"
                      type="number"
                      min={0}
                      step="any"
                      placeholder="0"
                      value={startingPrice}
                      onChange={(e) => setStartingPrice(e.target.value)}
                      className="w-32"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    新增草稿時，起拍價欄位將自動帶入此金額，你仍可在新增時自由修改。
                  </p>
                </div>

                {/* 每口加幅 */}
                <div className="space-y-2">
                  <Label>預設每口加幅</Label>
                  <Select value={bidIncrement} onValueChange={setBidIncrement}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BID_INCREMENT_OPTIONS.map((v) => (
                        <SelectItem key={v} value={String(v)}>HK${v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    新增草稿時，每口加幅欄位將自動帶入此金額。
                  </p>
                </div>

                <div className="flex justify-end pt-1">
                  <Button
                    onClick={handleSave}
                    disabled={updateMutation.isPending}
                    className="gold-gradient text-white border-0 gap-1.5"
                  >
                    {updateMutation.isPending
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Save className="w-4 h-4" />}
                    儲存設定
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* 反狙擊延時預設值卡片 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-500" />
              預設反狙擊延時
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {isLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground py-4">
                <Loader2 className="w-4 h-4 animate-spin" /><span className="text-sm">載入中…</span>
              </div>
            ) : (
              <>
                {/* 開關 */}
                <div className="flex items-center justify-between">
                  <div>
                    <Label>預設啟用反狙擊延時</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">新增草稿時自動套用此設定</p>
                  </div>
                  <Switch
                    checked={antiSnipeEnabled}
                    onCheckedChange={setAntiSnipeEnabled}
                    className="data-[state=checked]:bg-amber-500"
                  />
                </div>
                {/* X / Y */}
                <div className={`flex gap-4 transition-opacity ${antiSnipeEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs text-amber-700">結束前 X 分鐘觸發（X）</Label>
                    <div className="flex items-center gap-1">
                      <Input
                        type="number" min={0} max={60}
                        value={antiSnipeMinutes}
                        onChange={(e) => setAntiSnipeMinutes(e.target.value)}
                        onBlur={(e) => { const v = parseInt(e.target.value); setAntiSnipeMinutes(String(isNaN(v) ? 0 : Math.max(0, Math.min(60, v)))); }}
                        className="h-8 w-20 text-center border-amber-200"
                      />
                      <span className="text-xs text-amber-600">分鐘</span>
                    </div>
                  </div>
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs text-amber-700">每次延長時間（Y）</Label>
                    <div className="flex items-center gap-1">
                      <Input
                        type="number" min={1} max={60}
                        value={extendMinutes}
                        onChange={(e) => setExtendMinutes(e.target.value)}
                        onBlur={(e) => { const v = parseInt(e.target.value); setExtendMinutes(String(isNaN(v) ? 1 : Math.max(1, Math.min(60, v)))); }}
                        className="h-8 w-20 text-center border-amber-200"
                      />
                      <span className="text-xs text-amber-600">分鐘</span>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-amber-500">
                  {antiSnipeEnabled
                    ? (parseInt(antiSnipeMinutes) === 0 ? '⚠️ X 設為 0 即不觸發延時' : `結束前 ${antiSnipeMinutes} 分鐘內有出價，自動延長 ${extendMinutes} 分鐘`)
                    : '預設停用，新增草稿時反狙擊延時為關閉'}
                </p>
                <div className="flex justify-end pt-1">
                  <Button onClick={handleSave} disabled={updateMutation.isPending} className="gold-gradient text-white border-0 gap-1.5">
                    {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    儲存設定
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Facebook 分享訊息模板卡片 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <svg className="w-4 h-4 text-blue-500" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/></svg>
              Facebook 分享訊息模板
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground py-4">
                <Loader2 className="w-4 h-4 animate-spin" /><span className="text-sm">載入中…</span>
              </div>
            ) : (
              <>
                <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-xs text-blue-700 leading-relaxed">
                  按「分享」時會自動複製此訊息供貼上 Facebook。留空則使用預設格式。
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fbShareTemplate">拍賣商品 — 分享訊息模板</Label>
                  <p className="text-xs text-muted-foreground">
                    可用佔位符：<code className="bg-white px-1 rounded">&#123;title&#125;</code>（商品名稱）、<code className="bg-white px-1 rounded">&#123;price&#125;</code>（目前出價）、<code className="bg-white px-1 rounded">&#123;endTime&#125;</code>（結標時間）
                  </p>
                  <Textarea
                    id="fbShareTemplate"
                    rows={5}
                    placeholder={"{title}\n目前出價 {price}\n結標時間：{endTime}\n快來競拍！\n\n（此為預設格式，可自由修改）"}
                    value={fbShareTemplate}
                    onChange={(e) => setFbShareTemplate(e.target.value)}
                    className="text-sm font-mono resize-none"
                  />
                  {fbShareTemplate.trim() && (
                    <div className="text-xs text-muted-foreground bg-blue-50 border border-blue-100 rounded p-2.5 whitespace-pre-wrap leading-relaxed">
                      <span className="font-semibold text-blue-700 block mb-1">預覽效果：</span>
                      {fbShareTemplate
                        .replace(/\{title\}/g, "〔商品名稱〕")
                        .replace(/\{price\}/g, "HK$180")
                        .replace(/\{endTime\}/g, "5月4日(一) 下午3:00")}
                    </div>
                  )}
                </div>
                <div className="space-y-2 pt-2 border-t border-blue-100">
                  <Label htmlFor="fbShareTemplateProduct">出售商品 — 分享訊息模板</Label>
                  <p className="text-xs text-muted-foreground">
                    可用佔位符：<code className="bg-white px-1 rounded">&#123;title&#125;</code>（商品名稱）、<code className="bg-white px-1 rounded">&#123;price&#125;</code>（出售價格）
                  </p>
                  <Textarea
                    id="fbShareTemplateProduct"
                    rows={5}
                    placeholder={"{title}\n出售價格：{price}\n歡迎查詢！\n\n（此為預設格式，可自由修改）"}
                    value={fbShareTemplateProduct}
                    onChange={(e) => setFbShareTemplateProduct(e.target.value)}
                    className="text-sm font-mono resize-none"
                  />
                  {fbShareTemplateProduct.trim() && (
                    <div className="text-xs text-muted-foreground bg-blue-50 border border-blue-100 rounded p-2.5 whitespace-pre-wrap leading-relaxed">
                      <span className="font-semibold text-blue-700 block mb-1">預覽效果：</span>
                      {fbShareTemplateProduct
                        .replace(/\{title\}/g, "〔商品名稱〕")
                        .replace(/\{price\}/g, "HK$180")}
                    </div>
                  )}
                </div>
                <div className="flex justify-end pt-1">
                  <Button onClick={handleSave} disabled={updateMutation.isPending} className="gold-gradient text-white border-0 gap-1.5">
                    {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    儲存設定
                  </Button>
                </div>

                {/* ── 預設 FB 群組清單（順序分享） — admin 可關閉 ── */}
                {fbBatchShareEnabled && (
                <div className="pt-4 border-t border-blue-100 space-y-2">
                  <div className="flex items-center gap-2">
                    <Label className="text-sm font-semibold">預設 Facebook 群組清單</Label>
                    <span className="text-[10px] text-muted-foreground">（最多 50 個）</span>
                  </div>
                  <div className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-700 leading-relaxed">
                    儲存常用 FB 群組，喺「拍賣管理 → 批量分享」可以一鍵順序分享到全部群組。<br />
                    <b>使用方法</b>：去 FB 群組頁面 → 複製網址（例：https://www.facebook.com/groups/123456）→ 貼落下面。
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Input
                      placeholder="群組名稱（例：香港錢幣交易區）"
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      className="text-sm sm:flex-1"
                      maxLength={80}
                    />
                    <Input
                      placeholder="https://www.facebook.com/groups/..."
                      value={newGroupUrl}
                      onChange={(e) => setNewGroupUrl(e.target.value)}
                      className="text-sm sm:flex-1"
                      maxLength={500}
                    />
                    <Button
                      onClick={handleAddGroup}
                      disabled={updateFbGroupsMutation.isPending}
                      className="bg-blue-600 hover:bg-blue-700 text-white border-0 gap-1.5 sm:w-auto"
                    >
                      {updateFbGroupsMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>+</span>}
                      新增
                    </Button>
                  </div>
                  {fbGroups.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2 text-center bg-gray-50 rounded">尚未加入任何群組</p>
                  ) : (
                    <div className="space-y-1.5 mt-2">
                      {fbGroups.map((g, idx) => (
                        <div key={idx} className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-md">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{g.name}</p>
                            <a href={g.url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-blue-600 hover:underline truncate block">{g.url}</a>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRemoveGroup(idx)}
                            disabled={updateFbGroupsMutation.isPending}
                            className="h-7 px-2 text-xs text-red-600 border-red-200 hover:bg-red-50"
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* 得標通知內容卡片 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Tag className="w-4 h-4 text-amber-500" />
              得標通知內容
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {isLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground py-4">
                <Loader2 className="w-4 h-4 animate-spin" /><span className="text-sm">載入中…</span>
              </div>
            ) : (
              <>
                <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-700 leading-relaxed">
                  以下內容會顯示在「得標通知」電郵內，發送給你的競投者。若留空，系統將使用管理員設定的預設文字。
                </div>
                <div className="space-y-2">
                  <Label htmlFor="paymentInstructions">得標通知 — 付款指引</Label>
                  <Textarea
                    id="paymentInstructions"
                    rows={5}
                    placeholder={"例如：\n接受 FPS 轉數快：請轉帳至 XXXXXXXX，並備注拍賣編號。\n八達通：請到店拍打付款。"}
                    value={paymentInstructions}
                    onChange={(e) => setPaymentInstructions(e.target.value)}
                    className="text-sm resize-none"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="deliveryInfo">得標通知 — 交收安排</Label>
                  <Textarea
                    id="deliveryInfo"
                    rows={4}
                    placeholder={"例如：\n1. 順豐到付（買家承擔運費）\n2. 歡迎來店自取（請提前聯絡預約）"}
                    value={deliveryInfo}
                    onChange={(e) => setDeliveryInfo(e.target.value)}
                    className="text-sm resize-none"
                  />
                </div>
                <div className="flex justify-end pt-1">
                  <Button onClick={handleSave} disabled={updateMutation.isPending} className="gold-gradient text-white border-0 gap-1.5">
                    {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    儲存設定
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* 拍賣結束時間設定卡片 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarClock className="w-4 h-4 text-amber-500" />
              預設拍賣結束時間
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {isLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground py-4">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">載入中…</span>
              </div>
            ) : (
              <>
                {/* 天數偏移 */}
                <div className="space-y-2">
                  <Label htmlFor="dayOffset">
                    發佈後加幾天結束
                    <span className="ml-1.5 text-xs text-muted-foreground">（1–365 天）</span>
                  </Label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground whitespace-nowrap">今日 +</span>
                    <Input
                      id="dayOffset"
                      type="number"
                      min={1}
                      max={365}
                      value={dayOffset}
                      onChange={(e) => setDayOffset(e.target.value)}
                      className="w-24"
                    />
                    <span className="text-sm text-muted-foreground">天</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    例如設 2，今日刊登的拍賣結束日期預設為後天
                  </p>
                </div>

                {/* 結束時間 */}
                <div className="space-y-2">
                  <Label htmlFor="endTime">每日結束時間（HH:MM）</Label>
                  <Input
                    id="endTime"
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-36"
                  />
                  <p className="text-xs text-muted-foreground">
                    例如設 23:00，拍賣將在指定日期的晚上 11 時結束
                  </p>
                </div>

                {/* 預覽 */}
                <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 space-y-1">
                  <div className="flex items-center gap-1.5 text-amber-700 text-xs font-medium">
                    <Info className="w-3.5 h-3.5" />
                    效果預覽（以今天計算）
                  </div>
                  <p className="text-sm font-semibold text-amber-900">
                    {previewLabel}
                  </p>
                  <p className="text-xs text-amber-600">
                    發佈草稿時，結束時間欄位將自動填入以上時間，你仍可在發佈前自由修改。
                  </p>
                </div>

                {/* 儲存按鈕 */}
                <div className="flex justify-end pt-1">
                  <Button
                    onClick={handleSave}
                    disabled={updateMutation.isPending}
                    className="gold-gradient text-white border-0 gap-1.5"
                  >
                    {updateMutation.isPending
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Save className="w-4 h-4" />}
                    儲存設定
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* 說明 */}
        <div className="text-xs text-muted-foreground space-y-1 px-1">
          <p>• 此設定只影響「你自己」的草稿發佈預設值，不影響其他商戶。</p>
          <p>• 每次打開發佈彈窗時，系統自動帶入你設定的天數及時間。</p>
          <p>• 你隨時可在發佈前修改具體結束時間。</p>
        </div>

        {/* 水印設定卡片 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Droplets className="w-4 h-4 text-amber-500" />
              水印設定
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {wmLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground py-4">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">載入中…</span>
              </div>
            ) : (
              <>
                {/* 開關 */}
                <div className="flex items-center justify-between">
                  <div>
                    <Label>啟用水印</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">上傳商品圖片時自動加上水印</p>
                  </div>
                  <Switch
                    checked={wmEnabled}
                    onCheckedChange={setWmEnabled}
                    className="data-[state=checked]:bg-amber-500"
                  />
                </div>

                <div className={`space-y-5 transition-opacity ${wmEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                  {/* 水印文字 */}
                  <div className="space-y-2">
                    <Label htmlFor="wmText">水印文字</Label>
                    <Input
                      id="wmText"
                      value={wmText}
                      onChange={(e) => setWmText(e.target.value)}
                      maxLength={100}
                      placeholder="輸入水印文字"
                    />
                    <p className="text-xs text-muted-foreground">預設為商戶名稱，可自行修改</p>
                  </div>

                  {/* 水印尺寸 */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>水印尺寸</Label>
                      <span className="text-sm font-medium text-amber-600">{wmSize}%</span>
                    </div>
                    <Slider
                      min={1}
                      max={100}
                      step={1}
                      value={[wmSize]}
                      onValueChange={([v]) => setWmSize(v)}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>1%（細小）</span>
                      <span>100%（全圖滿版）</span>
                    </div>
                  </div>

                  {/* 透明度 */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>透明度</Label>
                      <span className="text-sm font-medium text-amber-600">{wmOpacity}%</span>
                    </div>
                    <Slider
                      min={10}
                      max={90}
                      step={5}
                      value={[wmOpacity]}
                      onValueChange={([v]) => setWmOpacity(v)}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>10%（極淡）</span>
                      <span>90%（深色）</span>
                    </div>
                  </div>

                  {/* 陰影 */}
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>文字陰影</Label>
                      <p className="text-xs text-muted-foreground mt-0.5">讓水印在淺色圖片上更清晰</p>
                    </div>
                    <Switch
                      checked={wmShadow}
                      onCheckedChange={setWmShadow}
                      className="data-[state=checked]:bg-amber-500"
                    />
                  </div>

                  {/* 位置選擇 */}
                  <div className="space-y-3">
                    <Label>水印位置</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {([
                        { key: "center-horizontal", label: "置中打橫", svg: (
                          <svg viewBox="0 0 48 36" fill="none" className="w-full h-full">
                            <rect x="1" y="1" width="46" height="34" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                            <rect x="10" y="16" width="28" height="4" rx="1" fill="currentColor" opacity="0.7"/>
                          </svg>
                        )},
                        { key: "center-diagonal", label: "置中斜角", svg: (
                          <svg viewBox="0 0 48 36" fill="none" className="w-full h-full">
                            <rect x="1" y="1" width="46" height="34" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                            <rect x="8" y="15" width="32" height="4" rx="1" fill="currentColor" opacity="0.7" transform="rotate(-30 24 17)"/>
                          </svg>
                        )},
                        { key: "top-left", label: "左上角", svg: (
                          <svg viewBox="0 0 48 36" fill="none" className="w-full h-full">
                            <rect x="1" y="1" width="46" height="34" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                            <rect x="5" y="6" width="18" height="3" rx="1" fill="currentColor" opacity="0.7"/>
                          </svg>
                        )},
                        { key: "top-right", label: "右上角", svg: (
                          <svg viewBox="0 0 48 36" fill="none" className="w-full h-full">
                            <rect x="1" y="1" width="46" height="34" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                            <rect x="25" y="6" width="18" height="3" rx="1" fill="currentColor" opacity="0.7"/>
                          </svg>
                        )},
                        { key: "bottom-left", label: "左下角", svg: (
                          <svg viewBox="0 0 48 36" fill="none" className="w-full h-full">
                            <rect x="1" y="1" width="46" height="34" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                            <rect x="5" y="27" width="18" height="3" rx="1" fill="currentColor" opacity="0.7"/>
                          </svg>
                        )},
                        { key: "bottom-right", label: "右下角", svg: (
                          <svg viewBox="0 0 48 36" fill="none" className="w-full h-full">
                            <rect x="1" y="1" width="46" height="34" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                            <rect x="25" y="27" width="18" height="3" rx="1" fill="currentColor" opacity="0.7"/>
                          </svg>
                        )},
                      ] as { key: string; label: string; svg: React.ReactNode }[]).map(({ key, label, svg }) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setWmPosition(key)}
                          className={`flex flex-col items-center gap-1.5 p-2 rounded-lg border-2 transition-all ${
                            wmPosition === key
                              ? "border-amber-500 bg-amber-50 text-amber-700"
                              : "border-border bg-background text-muted-foreground hover:border-amber-300 hover:bg-amber-50/50"
                          }`}
                        >
                          <div className="w-12 h-9">{svg}</div>
                          <span className="text-xs font-medium leading-tight text-center">{label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <Button
                    onClick={handleSaveWatermark}
                    disabled={wmMutation.isPending}
                    className="gold-gradient text-white border-0 gap-1.5"
                  >
                    {wmMutation.isPending
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Save className="w-4 h-4" />}
                    儲存水印設定
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
        {/* 每頁顯示數量卡片 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <LayoutList className="w-4 h-4 text-amber-500" />
              每頁顯示數量
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground py-4">
                <Loader2 className="w-4 h-4 animate-spin" /><span className="text-sm">載入中…</span>
              </div>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">設定你商戶商店每頁顯示多少條拍賣及商品</p>
                {/* 拍賣每頁 */}
                <div className="space-y-2">
                  <Label className="text-purple-700">拍賣每頁</Label>
                  <div className="flex gap-2">
                    {[5, 10, 15, 20].map(n => {
                      const active = (settings as any)?.auctionsPerPage === n || (!(settings as any)?.auctionsPerPage && n === 10);
                      return (
                        <button
                          key={n}
                          onClick={() => setPageSizes.mutate({
                            auctionsPerPage: n,
                            productsPerPage: (settings as any)?.productsPerPage ?? 10,
                            showSoldProducts: (settings as any)?.showSoldProducts ?? 1,
                          })}
                          disabled={setPageSizes.isPending}
                          className={`flex-1 py-2.5 rounded-xl border-2 text-sm font-bold transition-all ${
                            active
                              ? "border-purple-500 bg-purple-50 text-purple-700"
                              : "border-gray-200 bg-white text-gray-400 hover:border-purple-200 hover:text-purple-500"
                          }`}
                        >
                          {n}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {/* 商品每頁 */}
                <div className="space-y-2">
                  <Label className="text-amber-700">商品每頁</Label>
                  <div className="flex gap-2">
                    {[5, 10, 15, 20].map(n => {
                      const active = (settings as any)?.productsPerPage === n || (!(settings as any)?.productsPerPage && n === 10);
                      return (
                        <button
                          key={n}
                          onClick={() => setPageSizes.mutate({
                            auctionsPerPage: (settings as any)?.auctionsPerPage ?? 10,
                            productsPerPage: n,
                            showSoldProducts: (settings as any)?.showSoldProducts ?? 1,
                          })}
                          disabled={setPageSizes.isPending}
                          className={`flex-1 py-2.5 rounded-xl border-2 text-sm font-bold transition-all ${
                            active
                              ? "border-amber-500 bg-amber-50 text-amber-700"
                              : "border-gray-200 bg-white text-gray-400 hover:border-amber-200 hover:text-amber-500"
                          }`}
                        >
                          {n}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {/* 展示已售出商品 */}
                <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                  <div>
                    <p className="text-sm font-medium text-gray-700">展示已售出商品</p>
                    <p className="text-xs text-muted-foreground">關閉後訪客不會看到已售商品列表</p>
                  </div>
                  <Switch
                    checked={(settings as any)?.showSoldProducts !== 0}
                    onCheckedChange={(checked) => setPageSizes.mutate({
                      auctionsPerPage: (settings as any)?.auctionsPerPage ?? 10,
                      productsPerPage: (settings as any)?.productsPerPage ?? 10,
                      showSoldProducts: checked ? 1 : 0,
                    })}
                    disabled={setPageSizes.isPending}
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
