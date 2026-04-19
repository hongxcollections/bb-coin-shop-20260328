import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft, Crown, Check, Star, Zap, Shield, Upload, CreditCard,
  Clock, CheckCircle2, XCircle, AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import Header from "@/components/Header";

// ── Types ──────────────────────────────────────────────────────────────────

type Plan = {
  id: number;
  name: string;
  memberLevel: string;
  monthlyPrice: string;
  yearlyPrice: string;
  maxListings: number;
  commissionDiscount: string;
  description: string | null;
  benefits: string | null;
  sortOrder: number;
  isActive: number;
};

type SubscriptionHistory = {
  id: number;
  planId: number;
  planName: string | null;
  memberLevel: string | null;
  billingCycle: string;
  status: string;
  startDate: Date | null;
  endDate: Date | null;
  paymentMethod: string | null;
  paymentReference: string | null;
  createdAt: Date;
};

// ── Helpers ────────────────────────────────────────────────────────────────

function formatCurrency(val: string | number) {
  return `HK$${parseFloat(val.toString()).toFixed(2)}`;
}

function formatDate(date: Date | string | null) {
  if (!date) return "—";
  return new Date(date).toLocaleString("zh-HK", {
    year: "numeric", month: "short", day: "numeric",
  });
}

function levelConfig(level: string) {
  switch (level) {
    case "bronze": return { icon: "🥉", label: "銅牌", gradient: "from-amber-700 to-orange-500", border: "border-amber-300", bg: "bg-amber-50" };
    case "silver": return { icon: "🥈", label: "銀牌", gradient: "from-slate-500 to-gray-300", border: "border-slate-300", bg: "bg-slate-50" };
    case "gold": return { icon: "🥇", label: "金牌", gradient: "from-yellow-500 to-amber-300", border: "border-yellow-300", bg: "bg-yellow-50" };
    case "vip": return { icon: "💎", label: "VIP", gradient: "from-violet-700 to-fuchsia-500", border: "border-violet-300", bg: "bg-violet-50" };
    default: return { icon: "👤", label: "未知", gradient: "from-gray-500 to-gray-300", border: "border-gray-300", bg: "bg-gray-50" };
  }
}

function statusBadge(status: string) {
  switch (status) {
    case "pending": return { label: "待審核", cls: "bg-amber-100 text-amber-700 border-amber-200", icon: <Clock className="w-3 h-3" /> };
    case "active": return { label: "生效中", cls: "bg-green-100 text-green-700 border-green-200", icon: <CheckCircle2 className="w-3 h-3" /> };
    case "expired": return { label: "已過期", cls: "bg-gray-100 text-gray-600 border-gray-200", icon: <XCircle className="w-3 h-3" /> };
    case "cancelled": return { label: "已取消", cls: "bg-red-100 text-red-700 border-red-200", icon: <XCircle className="w-3 h-3" /> };
    case "rejected": return { label: "已拒絕", cls: "bg-red-100 text-red-600 border-red-200", icon: <XCircle className="w-3 h-3" /> };
    default: return { label: status, cls: "bg-gray-100 text-gray-700 border-gray-200", icon: null };
  }
}

const PAYMENT_METHODS = [
  { value: "bank_transfer", label: "銀行轉帳" },
  { value: "payme", label: "PayMe" },
  { value: "fps", label: "轉數快 FPS" },
  { value: "alipay_hk", label: "支付寶 HK" },
  { value: "wechat_pay", label: "微信支付" },
  { value: "cash", label: "現金" },
  { value: "other", label: "其他" },
];

// ── Component ──────────────────────────────────────────────────────────────

export default function SubscriptionPlans() {
  const { user, isAuthenticated, loading } = useAuth();
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [subscribeDialogOpen, setSubscribeDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentProofUrl, setPaymentProofUrl] = useState("");
  const [uploading, setUploading] = useState(false);

  // ── Queries ──
  const { data: plans, isLoading: plansLoading } = trpc.subscriptions.getPlans.useQuery();

  const { data: mySubscription } = trpc.subscriptions.mySubscription.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );

  const { data: myHistory } = trpc.subscriptions.myHistory.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );

  const { data: siteSettings } = trpc.siteSettings.getAll.useQuery();

  const utils = trpc.useUtils();

  // ── Mutations ──
  const subscribeMutation = trpc.subscriptions.subscribe.useMutation({
    onSuccess: () => {
      toast.success("訂閱申請已提交！管理員確認收款後將為您升級。");
      utils.subscriptions.mySubscription.invalidate();
      utils.subscriptions.myHistory.invalidate();
      closeSubscribeDialog();
    },
    onError: (err) => toast.error(`提交失敗：${err.message}`),
  });

  const uploadProofMutation = trpc.subscriptions.uploadPaymentProof.useMutation({
    onSuccess: (data) => {
      setPaymentProofUrl(data.url);
      setUploading(false);
      toast.success("付款憑證已上傳");
    },
    onError: (err) => {
      setUploading(false);
      toast.error(`上傳失敗：${err.message}`);
    },
  });

  // ── Handlers ──
  const openSubscribe = (plan: Plan) => {
    setSelectedPlan(plan);
    setPaymentMethod("");
    setPaymentReference("");
    setPaymentProofUrl("");
    setSubscribeDialogOpen(true);
  };

  const closeSubscribeDialog = () => {
    setSubscribeDialogOpen(false);
    setSelectedPlan(null);
  };

  const handleUploadProof = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("檔案大小不能超過 5MB"); return; }
    setUploading(true);
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      uploadProofMutation.mutate({ base64, filename: file.name });
    };
    reader.readAsDataURL(file);
  };

  const handleSubmitSubscription = () => {
    if (!selectedPlan) return;
    if (!paymentMethod) { toast.error("請選擇付款方式"); return; }
    subscribeMutation.mutate({
      planId: selectedPlan.id,
      billingCycle,
      paymentMethod,
      paymentReference: paymentReference || undefined,
      paymentProofUrl: paymentProofUrl || undefined,
    });
  };

  // ── Payment methods info from site settings ──
  const paymentMethodsInfo = siteSettings
    ? (siteSettings as Record<string, string>)["subscription_payment_methods"] ?? ""
    : "";

  // ── Loading ──
  if (loading || plansLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-bounce">👑</div>
          <p className="text-muted-foreground">載入訂閱計劃...</p>
        </div>
      </div>
    );
  }

  const myLevel = (user as { memberLevel?: string } | null)?.memberLevel ?? "bronze";

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50">
      <Header />
      {/* 吸附在主頭部導航下方的麵包屑欄 */}
      <div className="border-b bg-card sticky top-16 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-2 text-sm">
          <Link href="/merchant-dashboard">
            <span className="text-muted-foreground hover:text-foreground cursor-pointer flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" />商戶後台
            </span>
          </Link>
          <span className="text-muted-foreground">/</span>
          <span className="font-medium text-amber-600 flex items-center gap-1">
            <Crown className="w-3.5 h-3.5" />訂閱計劃
          </span>
        </div>
      </div>

      <div className="container max-w-4xl py-8 space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-extrabold text-amber-900 mb-2 flex items-center justify-center gap-2">
            <Crown className="w-8 h-8 text-amber-600" /> 訂閱計劃
          </h1>
          <p className="text-muted-foreground">
            升級您的會員等級，享受更多專屬權益
          </p>
        </div>

        {/* Current subscription status */}
        {isAuthenticated && mySubscription && (
          <Card className="border-green-200 bg-green-50/50">
            <CardContent className="py-4 px-5">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-green-800 text-sm">
                    您目前的訂閱：{mySubscription.planName} ({levelConfig(mySubscription.memberLevel ?? "bronze").icon} {levelConfig(mySubscription.memberLevel ?? "bronze").label})
                  </p>
                  <p className="text-xs text-green-700">
                    {mySubscription.billingCycle === "yearly" ? "年繳" : "月繳"} |
                    有效期至：{formatDate(mySubscription.endDate)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pending subscription notice */}
        {isAuthenticated && myHistory && (myHistory as SubscriptionHistory[]).some(s => s.status === "pending") && (
          <Card className="border-amber-200 bg-amber-50/50">
            <CardContent className="py-4 px-5">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-amber-600 flex-shrink-0 animate-pulse" />
                <div>
                  <p className="font-semibold text-amber-800 text-sm">您有待審核的訂閱申請</p>
                  <p className="text-xs text-amber-700">管理員確認收款後將為您升級會員等級，請耐心等候。</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Billing cycle toggle */}
        <div className="flex justify-center">
          <div className="inline-flex items-center gap-1 p-1 rounded-full bg-white border border-amber-200 shadow-sm">
            <button
              onClick={() => setBillingCycle("monthly")}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                billingCycle === "monthly"
                  ? "bg-amber-600 text-white shadow-md"
                  : "text-amber-700 hover:bg-amber-50"
              }`}
            >
              月繳
            </button>
            <button
              onClick={() => setBillingCycle("yearly")}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                billingCycle === "yearly"
                  ? "bg-amber-600 text-white shadow-md"
                  : "text-amber-700 hover:bg-amber-50"
              }`}
            >
              年繳
              <Badge className="ml-1.5 bg-green-500 text-white text-[10px] px-1.5">省更多</Badge>
            </button>
          </div>
        </div>

        {/* Plans grid */}
        {!plans || plans.length === 0 ? (
          <Card className="border-amber-100">
            <CardContent className="py-12 text-center">
              <Crown className="w-12 h-12 text-amber-300 mx-auto mb-3" />
              <p className="text-muted-foreground">暫無可用的訂閱計劃</p>
              <p className="text-xs text-muted-foreground mt-1">管理員尚未設定訂閱計劃，請稍後再來。</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {(plans as Plan[]).map((plan) => {
              const lc = levelConfig(plan.memberLevel);
              const price = billingCycle === "yearly"
                ? parseFloat(plan.yearlyPrice.toString())
                : parseFloat(plan.monthlyPrice.toString());
              const monthlyEquiv = billingCycle === "yearly" ? price / 12 : price;
              const isCurrentLevel = myLevel === plan.memberLevel;
              let benefits: string[] = [];
              try { benefits = plan.benefits ? JSON.parse(plan.benefits) : []; } catch { benefits = []; }

              return (
                <Card
                  key={plan.id}
                  className={`relative overflow-hidden border-2 transition-all hover:shadow-lg ${
                    isCurrentLevel ? `${lc.border} shadow-md` : "border-transparent hover:border-amber-200"
                  }`}
                >
                  {isCurrentLevel && (
                    <div className="absolute top-3 right-3 z-10">
                      <Badge className="bg-emerald-500 text-white text-xs">目前等級</Badge>
                    </div>
                  )}
                  {/* Level header */}
                  <div className={`h-20 bg-gradient-to-r ${lc.gradient} flex items-center px-5 gap-3`}>
                    <span className="text-4xl">{lc.icon}</span>
                    <div>
                      <p className="text-white font-bold text-lg">{plan.name}</p>
                      <p className="text-white/80 text-xs">{lc.label}會員</p>
                    </div>
                  </div>
                  <CardContent className="pt-5 pb-6 px-5">
                    {/* Price */}
                    <div className="text-center mb-4">
                      <div className="text-3xl font-extrabold text-amber-900">
                        {formatCurrency(price)}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        /{billingCycle === "yearly" ? "年" : "月"}
                        {billingCycle === "yearly" && (
                          <span className="text-green-600 ml-1">
                            (約 {formatCurrency(monthlyEquiv.toFixed(2))}/月)
                          </span>
                        )}
                      </p>
                    </div>

                    {/* Description */}
                    {plan.description && (
                      <p className="text-sm text-muted-foreground text-center mb-4 leading-relaxed">
                        {plan.description}
                      </p>
                    )}

                    {/* Features */}
                    {plan.maxListings > 0 && (
                      <div className="text-xs text-center text-amber-700 mb-2">
                        發佈限制：{plan.maxListings} 件
                      </div>
                    )}
                    {parseFloat(plan.commissionDiscount.toString()) > 0 && (
                      <div className="text-xs text-center text-green-700 mb-2">
                        佣金折扣：減 {(parseFloat(plan.commissionDiscount.toString()) * 100).toFixed(2)}%
                      </div>
                    )}

                    {/* Benefits list */}
                    {benefits.length > 0 && (
                      <ul className="space-y-1.5 mb-5">
                        {benefits.map((b, i) => (
                          <li key={i} className="flex items-center gap-2 text-sm">
                            <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                            <span>{b}</span>
                          </li>
                        ))}
                      </ul>
                    )}

                    {/* Subscribe button */}
                    {isAuthenticated ? (
                      <Button
                        onClick={() => openSubscribe(plan)}
                        disabled={isCurrentLevel}
                        className={`w-full ${
                          isCurrentLevel
                            ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                            : "gold-gradient text-white border-0 hover:shadow-md"
                        }`}
                      >
                        {isCurrentLevel ? "目前等級" : "立即訂閱"}
                      </Button>
                    ) : (
                      <Link href="/login">
                        <Button className="w-full gold-gradient text-white border-0">
                          登入後訂閱
                        </Button>
                      </Link>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Payment methods info */}
        {paymentMethodsInfo && (
          <Card className="border-blue-200 bg-blue-50/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base text-blue-800">
                <CreditCard className="w-4 h-4" /> 付款方式
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-blue-800 whitespace-pre-line leading-relaxed">
                {paymentMethodsInfo}
              </div>
            </CardContent>
          </Card>
        )}

        {/* My subscription history */}
        {isAuthenticated && myHistory && (myHistory as SubscriptionHistory[]).length > 0 && (
          <Card className="border-amber-100">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="w-4 h-4 text-amber-600" /> 我的訂閱記錄
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {(myHistory as SubscriptionHistory[]).map((sub) => {
                  const sb = statusBadge(sub.status);
                  const lc = levelConfig(sub.memberLevel ?? "bronze");
                  return (
                    <div key={sub.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50/50 text-sm">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className={`text-xs ${sb.cls}`}>
                          {sb.icon} {sb.label}
                        </Badge>
                        <div>
                          <div className="font-medium text-xs">
                            {sub.planName ?? "未知計劃"} ({lc.icon} {lc.label})
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {sub.billingCycle === "yearly" ? "年繳" : "月繳"} |
                            申請：{formatDate(sub.createdAt)}
                            {sub.startDate && ` | 生效：${formatDate(sub.startDate)} ~ ${formatDate(sub.endDate)}`}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Link to member benefits */}
        <div className="text-center">
          <Link href="/member-benefits">
            <Button variant="outline" className="border-amber-200 text-amber-700 hover:bg-amber-50">
              <Star className="w-4 h-4 mr-1" /> 查看完整會員權益對比
            </Button>
          </Link>
        </div>
      </div>

      {/* ── Subscribe Dialog ── */}
      <Dialog open={subscribeDialogOpen} onOpenChange={(open) => { if (!open) closeSubscribeDialog(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-amber-600" />
              訂閱 {selectedPlan?.name}
            </DialogTitle>
          </DialogHeader>
          {selectedPlan && (
            <div className="space-y-4 pt-2">
              {/* Plan summary */}
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-sm text-amber-900">{selectedPlan.name}</p>
                    <p className="text-xs text-amber-700">
                      {levelConfig(selectedPlan.memberLevel).icon} {levelConfig(selectedPlan.memberLevel).label}會員 |
                      {billingCycle === "yearly" ? " 年繳" : " 月繳"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-amber-900">
                      {formatCurrency(
                        billingCycle === "yearly"
                          ? selectedPlan.yearlyPrice
                          : selectedPlan.monthlyPrice
                      )}
                    </p>
                    <p className="text-xs text-amber-700">/{billingCycle === "yearly" ? "年" : "月"}</p>
                  </div>
                </div>
              </div>

              {/* Payment methods info */}
              {paymentMethodsInfo && (
                <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                  <p className="text-xs font-semibold text-blue-800 mb-1 flex items-center gap-1">
                    <CreditCard className="w-3 h-3" /> 付款資訊
                  </p>
                  <div className="text-xs text-blue-700 whitespace-pre-line leading-relaxed">
                    {paymentMethodsInfo}
                  </div>
                </div>
              )}

              {/* Payment method selection */}
              <div className="space-y-2">
                <Label>付款方式 *</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger className="border-amber-200">
                    <SelectValue placeholder="選擇付款方式" />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map(m => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Payment reference */}
              <div className="space-y-2">
                <Label>付款參考編號</Label>
                <Input
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  placeholder="例：轉帳交易編號、FPS 參考編號"
                  className="border-amber-200"
                />
              </div>

              {/* Payment proof upload */}
              <div className="space-y-2">
                <Label>付款憑證截圖</Label>
                {paymentProofUrl ? (
                  <div className="relative rounded-lg overflow-hidden border border-amber-200">
                    <img src={paymentProofUrl} alt="付款憑證" className="w-full max-h-48 object-contain bg-gray-50" />
                    <Button
                      variant="outline"
                      size="sm"
                      className="absolute top-2 right-2 text-xs h-6 bg-white/90"
                      onClick={() => setPaymentProofUrl("")}
                    >
                      重新上傳
                    </Button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center gap-2 p-4 rounded-lg border-2 border-dashed border-amber-200 bg-amber-50/30 cursor-pointer hover:bg-amber-50 transition-colors">
                    <Upload className={`w-6 h-6 ${uploading ? "animate-bounce text-amber-500" : "text-amber-400"}`} />
                    <span className="text-xs text-muted-foreground">
                      {uploading ? "上傳中..." : "點擊上傳付款截圖（最大 5MB）"}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleUploadProof}
                      disabled={uploading}
                    />
                  </label>
                )}
              </div>

              {/* Info note */}
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
                <AlertCircle className="w-3.5 h-3.5 inline mr-1" />
                提交後，管理員將確認您的付款並為您升級會員等級。通常在 1-2 個工作天內完成審核。
              </div>

              {/* Submit */}
              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={closeSubscribeDialog} className="flex-1">取消</Button>
                <Button
                  onClick={handleSubmitSubscription}
                  disabled={subscribeMutation.isPending}
                  className="flex-1 gold-gradient text-white border-0"
                >
                  {subscribeMutation.isPending ? "提交中..." : "提交訂閱申請"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
