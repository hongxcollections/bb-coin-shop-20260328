import { useState, useRef } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, TrendingUp, LogOut, Mail, CheckCircle2, Bell, BellOff, EyeOff, Heart, Lock, Camera, Pencil, X, Check } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { PushVolumeSlider } from "@/components/PushVolumeSlider";
import { MemberBadge } from "@/components/MemberBadge";
import { MemberHeroBanner } from "@/components/MemberHeroBanner";
import Header from "@/components/Header";
import { LoyaltyProgressCard } from "@/components/LoyaltyProgressCard";


export default function Profile() {
  const { user, isAuthenticated, loading, logout } = useAuth();
  const { data: myBids } = trpc.auctions.myBids.useQuery(undefined, { enabled: isAuthenticated });
  const [emailInput, setEmailInput] = useState("");
  const [emailSaved, setEmailSaved] = useState(false);

  // 名稱更改
  const [nameEditing, setNameEditing] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [nameInitialised, setNameInitialised] = useState(false);

  // 頭像上傳
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();

  // Notification preferences
  const { data: notifPrefs } = trpc.users.getNotificationPrefs.useQuery(undefined, { enabled: isAuthenticated });
  const [notifyOutbid, setNotifyOutbid] = useState(true);
  const [notifyWon, setNotifyWon] = useState(true);
  const [notifyEndingSoon, setNotifyEndingSoon] = useState(true);
  const [prefsInitialised, setPrefsInitialised] = useState(false);
  // 預設匿名出價設定
  const { data: defaultAnonData } = trpc.users.getDefaultAnonymous.useQuery(undefined, { enabled: isAuthenticated });
  const [defaultAnonymous, setDefaultAnonymous] = useState(false);
  const [anonInitialised, setAnonInitialised] = useState(false);
  if (defaultAnonData !== undefined && !anonInitialised) {
    setDefaultAnonymous((defaultAnonData as { defaultAnonymous: number }).defaultAnonymous === 1);
    setAnonInitialised(true);
  }
  const setDefaultAnonMutation = trpc.users.setDefaultAnonymous.useMutation({
    onSuccess: () => toast.success('預設匿名設定已儲存'),
    onError: (err) => toast.error(`儲存失敗：${err.message}`),
  });
  const handleToggleDefaultAnon = (val: boolean) => {
    setDefaultAnonymous(val);
    setDefaultAnonMutation.mutate({ defaultAnonymous: val ? 1 : 0 });
  };

  if (notifPrefs && !prefsInitialised) {
    setNotifyOutbid(!!notifPrefs.notifyOutbid);
    setNotifyWon(!!notifPrefs.notifyWon);
    setNotifyEndingSoon(!!notifPrefs.notifyEndingSoon);
    setPrefsInitialised(true);
  }

  const updateNotifPrefs = trpc.users.updateNotificationPrefs.useMutation({
    onSuccess: () => {
      toast.success('通知偏好已儲存');
      utils.users.getNotificationPrefs.invalidate();
    },
    onError: (err) => toast.error(`儲存失敗：${err.message}`),
  });

  const allOn = notifyOutbid && notifyWon && notifyEndingSoon;

  const handleToggleAll = () => {
    const next = allOn ? 0 : 1;
    setNotifyOutbid(!!next);
    setNotifyWon(!!next);
    setNotifyEndingSoon(!!next);
    updateNotifPrefs.mutate({ notifyOutbid: next, notifyWon: next, notifyEndingSoon: next });
  };

  const handleToggleNotif = (key: 'outbid' | 'won' | 'endingSoon', value: boolean) => {
    const next = {
      notifyOutbid: key === 'outbid' ? (value ? 1 : 0) : (notifyOutbid ? 1 : 0),
      notifyWon: key === 'won' ? (value ? 1 : 0) : (notifyWon ? 1 : 0),
      notifyEndingSoon: key === 'endingSoon' ? (value ? 1 : 0) : (notifyEndingSoon ? 1 : 0),
    };
    if (key === 'outbid') setNotifyOutbid(value);
    if (key === 'won') setNotifyWon(value);
    if (key === 'endingSoon') setNotifyEndingSoon(value);
    updateNotifPrefs.mutate(next);
  };

  const updateEmail = trpc.users.updateEmail.useMutation({
    onSuccess: () => {
      setEmailSaved(true);
      toast.success("電郵地址已儲存！往後出價被超越或得標時將收到通知。");
      utils.auth.me.invalidate();
      setTimeout(() => setEmailSaved(false), 3000);
    },
    onError: (err) => {
      toast.error(`儲存失敗：${err.message}`);
    },
  });

  // 名稱更改 mutation
  const updateName = trpc.users.updateName.useMutation({
    onSuccess: () => {
      toast.success("顯示名稱已更新！");
      utils.auth.me.invalidate();
      setNameEditing(false);
    },
    onError: (err) => toast.error(`更新失敗：${err.message}`),
  });

  // 頭像上傳 mutation
  const uploadAvatar = trpc.users.uploadAvatar.useMutation({
    onSuccess: (data) => {
      toast.success("頭像已更新！");
      setAvatarPreview(data.photoUrl);
      utils.auth.me.invalidate();
      setAvatarUploading(false);
    },
    onError: (err) => {
      toast.error(`上傳失敗：${err.message}`);
      setAvatarUploading(false);
    },
  });

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      // Compress using canvas
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX = 512;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          if (width > height) { height = Math.round(height * MAX / width); width = MAX; }
          else { width = Math.round(width * MAX / height); height = MAX; }
        }
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
        const base64 = canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
        setAvatarUploading(true);
        uploadAvatar.mutate({ base64, mimeType: 'image/jpeg' });
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  // Initialise email input from user data (once)
  const [emailInitialised, setEmailInitialised] = useState(false);
  if (user?.email && !emailInitialised) {
    setEmailInput(user.email);
    setEmailInitialised(true);
  }

  // Initialise name input from user data (once)
  if (user?.name && !nameInitialised) {
    setNameInput(user.name);
    setNameInitialised(true);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-spin">💰</div>
          <p className="text-muted-foreground">載入中...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4">🔒</div>
          <p className="text-lg font-medium mb-4">請先登入查看個人資料</p>
          <a href="/login?from=/profile">
            <Button className="gold-gradient text-white border-0">立即登入</Button>
          </a>
        </div>
      </div>
    );
  }

  const bidGroups = (myBids ?? []) as Array<{ latestBid: number }>;
  const totalBidAmount = bidGroups.reduce((sum, g) => sum + g.latestBid, 0);
  const initials = (user?.name ?? "U").slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <Header />
      <div className="container pt-8 pb-28 max-w-3xl">
        {/* Profile Header */}
        <Card className="mb-6 border-amber-100 overflow-hidden">
          <MemberHeroBanner
            level={(user as { memberLevel?: string } | null)?.memberLevel}
            name={user?.name}
          />
          <CardContent className="pt-0 pb-6 px-6">
            {/* 隱藏 file input */}
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarFileChange}
            />
            <div className="-mt-10 flex items-end justify-between mb-4">
              {/* 頭像區域（可點擊上傳） */}
              <div className="relative group cursor-pointer" onClick={() => !avatarUploading && avatarInputRef.current?.click()}>
                <div className="w-20 h-20 rounded-2xl border-4 border-white shadow-lg overflow-hidden flex items-center justify-center bg-amber-100">
                  {(avatarPreview || (user as { photoUrl?: string | null } | null)?.photoUrl) ? (
                    <img
                      src={avatarPreview ?? (user as { photoUrl?: string | null } | null)?.photoUrl ?? ''}
                      alt="頭像"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full gold-gradient flex items-center justify-center text-white font-bold text-2xl">
                      {initials}
                    </div>
                  )}
                </div>
                {/* 相機圖示 hover 覆蓋 */}
                <div className={`absolute inset-0 rounded-2xl bg-black/40 flex items-center justify-center transition-opacity ${avatarUploading ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                  {avatarUploading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Camera className="w-6 h-6 text-white" />
                  )}
                </div>
              </div>
              <Badge className={user?.role === "admin" ? "bg-amber-600 text-white" : "bg-emerald-500 text-white"}>
                {user?.role === "admin" ? "🔑 管理員" : "👤 一般用戶"}
              </Badge>
            </div>
            {/* 名稱顯示／編輯 */}
            {nameEditing ? (
              <div className="flex items-center gap-2 mb-2">
                <Input
                  value={nameInput}
                  onChange={e => setNameInput(e.target.value)}
                  maxLength={50}
                  className="h-9 text-lg font-bold max-w-xs"
                  onKeyDown={e => {
                    if (e.key === 'Enter') updateName.mutate({ name: nameInput });
                    if (e.key === 'Escape') setNameEditing(false);
                  }}
                  autoFocus
                />
                <button
                  onClick={() => updateName.mutate({ name: nameInput })}
                  disabled={updateName.isPending || !nameInput.trim()}
                  className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 disabled:opacity-40"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  onClick={() => { setNameEditing(false); setNameInput(user?.name ?? ''); }}
                  className="p-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h1 className="text-2xl font-bold">{user?.name}</h1>
                <MemberBadge level={(user as { memberLevel?: string } | null)?.memberLevel} variant="badge" />
                <button
                  onClick={() => { setNameInput(user?.name ?? ''); setNameEditing(true); }}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                  title="更改名稱"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              </div>
            )}
            {user?.email && <p className="text-muted-foreground text-sm mt-1">{user.email}</p>}
            <div className="mt-3">
              <MemberBadge level={(user as { memberLevel?: string } | null)?.memberLevel} variant="full" />
            </div>
          </CardContent>
        </Card>

        {/* 會員活動等級進度 */}
        <LoyaltyProgressCard />

        {/* Anonymous Bid Default Setting */}
        {(() => {
          const memberLevel = (user as { memberLevel?: string } | null)?.memberLevel;
          const canUseAnon = memberLevel === 'silver' || memberLevel === 'gold' || memberLevel === 'vip';
          return (
            <Card className={`mb-6 ${canUseAnon ? 'border-slate-200' : 'border-slate-100 opacity-80'}`}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <EyeOff className="w-4 h-4 text-slate-500" />
                  匿名出價設定
                  {!canUseAnon && (
                    <span className="ml-auto flex items-center gap-1 text-xs font-normal text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                      <Lock className="w-3 h-3" />
                      🥈 銀牌或以上限定
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {canUseAnon ? (
                  <>
                    <p className="text-sm text-muted-foreground">
                      開啟後，每次出價預設為匿名模式。您仍可在出價時臨時切換。
                    </p>
                    <div className={`flex items-center justify-between rounded-lg px-4 py-3 border transition-all ${
                      defaultAnonymous ? 'bg-slate-50 border-slate-300' : 'bg-white border-slate-100'
                    }`}>
                      <div className="flex items-center gap-3">
                        <EyeOff className={`w-5 h-5 ${defaultAnonymous ? 'text-slate-500' : 'text-muted-foreground'}`} />
                        <div>
                          <p className="text-sm font-medium">預設匿名出價</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {defaultAnonymous ? '已開啟：出價時將顯示「🕵️ 匿名買家」' : '關閉：出價時顯示您的名字'}
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={defaultAnonymous}
                        onCheckedChange={handleToggleDefaultAnon}
                        disabled={setDefaultAnonMutation.isPending}
                        className="data-[state=checked]:bg-slate-500"
                      />
                    </div>
                    <div className="flex items-start gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600">
                      <EyeOff className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                      <span>匿名出價時，競標歷史將顯示「🕵️ 匿名買家」。管理員仍可查看真實身份。得標後商戶將以真實資料聯絡您。</span>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-3 py-4 text-center">
                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                      <Lock className="w-5 h-5 text-slate-400" />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      匿名出價功能僅限 <span className="font-semibold text-slate-600">🥈 銀牌或以上會員</span> 使用。
                    </p>
                    <p className="text-xs text-slate-400">
                      升級會籍後即可隱藏身份競投，保護您的出價策略。
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })()}

        {/* Email Notification Settings */}
        <Card className="mb-6 border-amber-100">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Mail className="w-4 h-4 text-amber-600" />
              電郵通知設定
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              填寫電郵地址後，可在下方選擇接收哪些通知。
            </p>
            <div className="space-y-2">
              <Label htmlFor="email-input" className="text-sm font-medium">電郵地址</Label>
              <div className="flex gap-2">
                <Input
                  id="email-input"
                  type="email"
                  placeholder="your@email.com"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  className="border-amber-200 focus-visible:ring-amber-400"
                />
                <Button
                  onClick={() => updateEmail.mutate({ email: emailInput })}
                  disabled={updateEmail.isPending || !emailInput.trim()}
                  className={emailSaved ? "bg-emerald-500 hover:bg-emerald-600 text-white" : "gold-gradient text-white border-0"}
                >
                  {emailSaved ? (
                    <><CheckCircle2 className="w-4 h-4 mr-1" />已儲存</>
                  ) : updateEmail.isPending ? "儲存中..." : "儲存"}
                </Button>
              </div>
            </div>
            {!user?.email && (
              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                <Mail className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                <span>尚未設定電郵，目前不會收到任何通知。請填寫電郵地址以啟用通知功能。</span>
              </div>
            )}

            {/* Notification toggles */}
            <div className="border-t border-amber-100 pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">通知類型</p>
                <button
                  type="button"
                  onClick={handleToggleAll}
                  disabled={updateNotifPrefs.isPending}
                  className={`text-xs font-medium px-2.5 py-1 rounded-full border transition-colors disabled:opacity-50 ${
                    allOn
                      ? 'border-red-200 text-red-600 hover:bg-red-50'
                      : 'border-amber-300 text-amber-700 hover:bg-amber-50'
                  }`}
                >
                  {allOn ? '全部關閉' : '全部開啟'}
                </button>
              </div>
              {([
                { key: 'outbid' as const, label: '出價被超越', desc: '有人出價超越你時通知', value: notifyOutbid },
                { key: 'won' as const, label: '成功得標', desc: '拍賣結束且你得標時通知', value: notifyWon },
                { key: 'endingSoon' as const, label: '拍賣即將結束', desc: '你有出價的拍賣快結束時通知', value: notifyEndingSoon },
              ]).map(({ key, label, desc, value }) => (
                <div key={key} className="flex items-center justify-between gap-4 py-2 px-3 rounded-lg bg-amber-50/60 border border-amber-100">
                  <div className="flex items-center gap-2">
                    {value ? <Bell className="w-4 h-4 text-amber-600" /> : <BellOff className="w-4 h-4 text-muted-foreground" />}
                    <div>
                      <p className="text-sm font-medium leading-none">{label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={value}
                    onClick={() => handleToggleNotif(key, !value)}
                    disabled={updateNotifPrefs.isPending}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 disabled:opacity-50 ${
                      value ? 'bg-amber-500' : 'bg-muted'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform ${
                        value ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>

            {/* 推播鈴聲音量 */}
            <div className="border-t border-amber-100 pt-4 mt-2">
              <PushVolumeSlider />
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: "競標次數", value: myBids?.length ?? 0, suffix: "次", icon: TrendingUp },
            { label: "競標總額", value: `HK$${totalBidAmount.toLocaleString()}`, suffix: "", icon: TrendingUp },
            { label: "帳號狀態", value: "正常", suffix: "", icon: User },
          ].map((stat) => (
            <Card key={stat.label} className="border-amber-100 text-center">
              <CardContent className="py-4 px-3">
                <div className="text-xl font-bold text-amber-700">{stat.value}{stat.suffix}</div>
                <div className="text-xs text-muted-foreground mt-1">{stat.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Links */}
        <div className="flex gap-3 mb-6">
          <Link href="/favorites" className="flex-1">
            <Card className="border-rose-100 hover:border-rose-300 transition-colors cursor-pointer">
              <CardContent className="py-3 px-4 flex items-center gap-3">
                <div className="w-8 h-8 bg-rose-100 rounded-lg flex items-center justify-center shrink-0">
                  <Heart className="w-4 h-4 text-rose-500" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-amber-900">我的收藏</div>
                  <div className="text-xs text-muted-foreground">查看收藏的拍品</div>
                </div>
              </CardContent>
            </Card>
          </Link>
          <Link href="/member-benefits" className="flex-1">
            <Card className="border-amber-100 hover:border-amber-300 transition-colors cursor-pointer">
              <CardContent className="py-3 px-4 flex items-center gap-3">
                <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center shrink-0">
                  <span className="text-base">🏆</span>
                </div>
                <div>
                  <div className="text-sm font-semibold text-amber-900">會員福利</div>
                  <div className="text-xs text-muted-foreground">查看會員等級權益</div>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>
        <Link href="/bid-history" className="block mb-6">
          <Card className="border-amber-100 hover:border-amber-300 transition-colors cursor-pointer">
            <CardContent className="py-3 px-4 flex items-center gap-3">
              <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center shrink-0">
                <TrendingUp className="w-4 h-4 text-amber-600" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-amber-900">出價紀錄</div>
                <div className="text-xs text-muted-foreground">查看出價記錄及得標紀錄</div>
              </div>
              <div className="text-xs text-amber-500">→</div>
            </CardContent>
          </Card>
        </Link>

      </div>
    </div>
  );
}
