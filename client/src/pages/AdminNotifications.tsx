import { useState, useEffect } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Mail, Bell, Settings, ArrowLeft, CheckCircle2, AlertCircle, Send } from "lucide-react";
import { toast } from "sonner";

export default function AdminNotifications() {
  const { user, isAuthenticated, loading } = useAuth();

  const { data: settings, isLoading: settingsLoading } = trpc.notificationSettings.get.useQuery(
    undefined,
    { enabled: isAuthenticated && user?.role === "admin" }
  );

  const [senderName, setSenderName] = useState("");
  const [senderEmail, setSenderEmail] = useState("");
  const [enableOutbid, setEnableOutbid] = useState(true);
  const [enableWon, setEnableWon] = useState(true);
  const [enableEndingSoon, setEnableEndingSoon] = useState(true);
  const [endingSoonMinutes, setEndingSoonMinutes] = useState(60);
  const [initialised, setInitialised] = useState(false);

  useEffect(() => {
    if (settings && !initialised) {
      setSenderName(settings.senderName);
      setSenderEmail(settings.senderEmail);
      setEnableOutbid(settings.enableOutbid === 1);
      setEnableWon(settings.enableWon === 1);
      setEnableEndingSoon(settings.enableEndingSoon === 1);
      setEndingSoonMinutes(settings.endingSoonMinutes);
      setInitialised(true);
    }
  }, [settings, initialised]);

  const utils = trpc.useUtils();
  const updateSettings = trpc.notificationSettings.update.useMutation({
    onSuccess: () => {
      toast.success("通知設定已儲存");
      utils.notificationSettings.get.invalidate();
    },
    onError: (err) => toast.error(`儲存失敗：${err.message}`),
  });

  const handleSave = () => {
    updateSettings.mutate({
      senderName,
      senderEmail,
      enableOutbid: enableOutbid ? 1 : 0,
      enableWon: enableWon ? 1 : 0,
      enableEndingSoon: enableEndingSoon ? 1 : 0,
      endingSoonMinutes,
    });
  };

  if (loading || settingsLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-spin">🪙</div>
          <p className="text-muted-foreground">載入中...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || user?.role !== "admin") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4">🔒</div>
          <p className="text-lg font-medium mb-2">需要管理員權限</p>
          <Link href="/"><Button variant="outline">返回首頁</Button></Link>
        </div>
      </div>
    );
  }

  const notificationTypes = [
    {
      key: "outbid",
      label: "出價被超越通知",
      description: "當用戶出價被他人超越時，自動發送電郵提醒",
      icon: "📣",
      enabled: enableOutbid,
      setEnabled: setEnableOutbid,
    },
    {
      key: "won",
      label: "得標通知",
      description: "拍賣結束時，自動通知最高出價者已成功得標",
      icon: "🏆",
      enabled: enableWon,
      setEnabled: setEnableWon,
    },
    {
      key: "endingSoon",
      label: "拍賣即將結束通知",
      description: "拍賣在設定時間前，通知所有參與競投的用戶",
      icon: "⏰",
      enabled: enableEndingSoon,
      setEnabled: setEnableEndingSoon,
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="nav-glass sticky top-0 z-50">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <Link href="/admin">
              <Button variant="ghost" size="sm" className="text-amber-700 hover:text-amber-900 hover:bg-amber-50">
                <ArrowLeft className="w-4 h-4 mr-1" /> 後台
              </Button>
            </Link>
            <span className="text-muted-foreground">/</span>
            <span className="font-semibold text-amber-800 flex items-center gap-1.5">
              <Bell className="w-4 h-4" /> 電郵通知設定
            </span>
          </div>
          <Badge className="bg-amber-600 text-white text-xs">管理員</Badge>
        </div>
      </nav>

      <div className="container py-8 max-w-2xl">
        {/* Resend API Key Notice */}
        <Card className="mb-6 border-blue-200 bg-blue-50">
          <CardContent className="py-4 px-5">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-semibold mb-1">需要設定 Resend API Key</p>
                <p className="text-blue-700">
                  電郵通知功能需要 <a href="https://resend.com" target="_blank" rel="noopener noreferrer" className="underline font-medium">Resend</a> 帳號。
                  免費方案每月可發送 3,000 封郵件。請在「設定 → Secrets」中加入 <code className="bg-blue-100 px-1 rounded">RESEND_API_KEY</code>。
                </p>
                <p className="text-blue-700 mt-1">
                  ⚠️ 免費方案只能發送至已驗證的電郵地址。如需發送至任意地址，請在 Resend 後台驗證您的自訂域名。
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sender Settings */}
        <Card className="mb-6 border-amber-100">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Settings className="w-4 h-4 text-amber-600" />
              發件人設定
            </CardTitle>
            <CardDescription>郵件顯示的寄件人名稱及電郵地址</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sender-name">寄件人名稱</Label>
              <Input
                id="sender-name"
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                placeholder="大BB錢幣店"
                className="border-amber-200 focus-visible:ring-amber-400"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sender-email">寄件人電郵</Label>
              <Input
                id="sender-email"
                type="email"
                value={senderEmail}
                onChange={(e) => setSenderEmail(e.target.value)}
                placeholder="ywkyee@gmail.com"
                className="border-amber-200 focus-visible:ring-amber-400"
              />
              <p className="text-xs text-muted-foreground">
                此電郵需在 Resend 後台完成驗證，否則郵件可能無法送達。
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Notification Types */}
        <Card className="mb-6 border-amber-100">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Mail className="w-4 h-4 text-amber-600" />
              通知類型
            </CardTitle>
            <CardDescription>選擇哪些事件需要自動發送電郵通知</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {notificationTypes.map((type) => (
              <div
                key={type.key}
                className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
                  type.enabled ? "border-amber-200 bg-amber-50" : "border-gray-200 bg-gray-50"
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-xl mt-0.5">{type.icon}</span>
                  <div>
                    <div className="font-medium text-sm flex items-center gap-2">
                      {type.label}
                      <Badge
                        variant="outline"
                        className={type.enabled ? "border-emerald-300 text-emerald-700 bg-emerald-50" : "border-gray-300 text-gray-500"}
                      >
                        {type.enabled ? "啟用" : "停用"}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">{type.description}</div>
                    {type.key === "endingSoon" && type.enabled && (
                      <div className="flex items-center gap-2 mt-2">
                        <Label className="text-xs text-amber-700 whitespace-nowrap">提前通知（分鐘）：</Label>
                        <Input
                          type="number"
                          min={5}
                          max={1440}
                          value={endingSoonMinutes}
                          onChange={(e) => setEndingSoonMinutes(Number(e.target.value))}
                          className="w-20 h-7 text-xs border-amber-300"
                        />
                      </div>
                    )}
                  </div>
                </div>
                <Switch
                  checked={type.enabled}
                  onCheckedChange={type.setEnabled}
                  className="data-[state=checked]:bg-amber-500"
                />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end gap-3">
          <Link href="/admin">
            <Button variant="outline" className="border-amber-200">取消</Button>
          </Link>
          <Button
            onClick={handleSave}
            disabled={updateSettings.isPending}
            className="gold-gradient text-white border-0 min-w-[120px]"
          >
            {updateSettings.isPending ? (
              "儲存中..."
            ) : updateSettings.isSuccess ? (
              <><CheckCircle2 className="w-4 h-4 mr-1" />已儲存</>
            ) : (
              <><Send className="w-4 h-4 mr-1" />儲存設定</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
