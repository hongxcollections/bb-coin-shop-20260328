import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft, Crown, Plus, Pencil, Trash2, CheckCircle2, XCircle, Clock,
  Users, CreditCard, Eye, Ban, DollarSign, Star, Shield, Zap,
} from "lucide-react";
import { toast } from "sonner";

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

type Subscription = {
  id: number;
  userId: number;
  userName: string | null;
  userEmail: string | null;
  planId: number;
  planName: string | null;
  memberLevel: string | null;
  billingCycle: string;
  status: string;
  startDate: Date | null;
  endDate: Date | null;
  paymentMethod: string | null;
  paymentReference: string | null;
  paymentProofUrl: string | null;
  adminNote: string | null;
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
    hour: "2-digit", minute: "2-digit",
  });
}

function levelBadge(level: string | null) {
  switch (level) {
    case "bronze": return { icon: "🥉", label: "銅牌", cls: "bg-amber-100 text-amber-700 border-amber-200" };
    case "silver": return { icon: "🥈", label: "銀牌", cls: "bg-slate-100 text-slate-700 border-slate-200" };
    case "gold": return { icon: "🥇", label: "金牌", cls: "bg-yellow-100 text-yellow-700 border-yellow-200" };
    case "vip": return { icon: "💎", label: "VIP", cls: "bg-violet-100 text-violet-700 border-violet-200" };
    default: return { icon: "👤", label: "未知", cls: "bg-gray-100 text-gray-700 border-gray-200" };
  }
}

function statusBadge(status: string) {
  switch (status) {
    case "pending": return { label: "待審核", cls: "bg-amber-100 text-amber-700 border-amber-200" };
    case "active": return { label: "生效中", cls: "bg-green-100 text-green-700 border-green-200" };
    case "expired": return { label: "已過期", cls: "bg-gray-100 text-gray-600 border-gray-200" };
    case "cancelled": return { label: "已取消", cls: "bg-red-100 text-red-700 border-red-200" };
    case "rejected": return { label: "已拒絕", cls: "bg-red-100 text-red-600 border-red-200" };
    default: return { label: status, cls: "bg-gray-100 text-gray-700 border-gray-200" };
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

export default function AdminSubscriptions() {
  const { user, isAuthenticated, loading } = useAuth();
  const [activeTab, setActiveTab] = useState("subscriptions");

  // Plan form state
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [planForm, setPlanForm] = useState({
    name: "", memberLevel: "silver" as string, monthlyPrice: "", yearlyPrice: "",
    maxListings: "0", commissionDiscount: "0", description: "", benefits: "", sortOrder: "0",
  });

  // Subscription action state
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionSub, setActionSub] = useState<Subscription | null>(null);
  const [actionType, setActionType] = useState<"approve" | "reject" | "cancel" | "view" | null>(null);
  const [adminNote, setAdminNote] = useState("");

  // Payment methods state
  const [paymentMethodsText, setPaymentMethodsText] = useState("");

  // ── Queries ──
  const { data: plans, isLoading: plansLoading } = trpc.subscriptions.adminListPlans.useQuery(
    undefined,
    { enabled: isAuthenticated && user?.role === "admin" }
  );

  const { data: subscriptions, isLoading: subsLoading } = trpc.subscriptions.adminListSubscriptions.useQuery(
    undefined,
    { enabled: isAuthenticated && user?.role === "admin" }
  );

  const { data: stats } = trpc.subscriptions.adminStats.useQuery(
    undefined,
    { enabled: isAuthenticated && user?.role === "admin" }
  );

  const { data: paymentMethodsSetting } = trpc.siteSettings.getAll.useQuery(
    undefined,
    { enabled: isAuthenticated && user?.role === "admin" }
  );

  const utils = trpc.useUtils();

  // ── Mutations ──
  const createPlanMutation = trpc.subscriptions.adminCreatePlan.useMutation({
    onSuccess: () => { toast.success("計劃已建立"); utils.subscriptions.adminListPlans.invalidate(); closePlanDialog(); },
    onError: (err) => toast.error(`建立失敗：${err.message}`),
  });

  const updatePlanMutation = trpc.subscriptions.adminUpdatePlan.useMutation({
    onSuccess: () => { toast.success("計劃已更新"); utils.subscriptions.adminListPlans.invalidate(); closePlanDialog(); },
    onError: (err) => toast.error(`更新失敗：${err.message}`),
  });

  const deletePlanMutation = trpc.subscriptions.adminDeletePlan.useMutation({
    onSuccess: () => { toast.success("計劃已刪除"); utils.subscriptions.adminListPlans.invalidate(); },
    onError: (err) => toast.error(`刪除失敗：${err.message}`),
  });

  const approveMutation = trpc.subscriptions.adminApprove.useMutation({
    onSuccess: (data) => {
      toast.success(`已批准，會員等級升為 ${data.memberLevel}`);
      utils.subscriptions.adminListSubscriptions.invalidate();
      utils.subscriptions.adminStats.invalidate();
      closeActionDialog();
    },
    onError: (err) => toast.error(`批准失敗：${err.message}`),
  });

  const rejectMutation = trpc.subscriptions.adminReject.useMutation({
    onSuccess: () => {
      toast.success("已拒絕");
      utils.subscriptions.adminListSubscriptions.invalidate();
      utils.subscriptions.adminStats.invalidate();
      closeActionDialog();
    },
    onError: (err) => toast.error(`拒絕失敗：${err.message}`),
  });

  const cancelMutation = trpc.subscriptions.adminCancel.useMutation({
    onSuccess: () => {
      toast.success("已取消，會員等級已降為銅牌");
      utils.subscriptions.adminListSubscriptions.invalidate();
      utils.subscriptions.adminStats.invalidate();
      closeActionDialog();
    },
    onError: (err) => toast.error(`取消失敗：${err.message}`),
  });

  const updateSettingsMutation = trpc.siteSettings.set.useMutation({
    onSuccess: () => { toast.success("付款方式已儲存"); utils.siteSettings.getAll.invalidate(); },
    onError: (err) => toast.error(`儲存失敗：${err.message}`),
  });

  // ── Plan Dialog Helpers ──
  const openCreatePlan = () => {
    setEditingPlan(null);
    setPlanForm({ name: "", memberLevel: "silver", monthlyPrice: "", yearlyPrice: "", maxListings: "0", commissionDiscount: "0", description: "", benefits: "", sortOrder: "0" });
    setPlanDialogOpen(true);
  };

  const openEditPlan = (plan: Plan) => {
    setEditingPlan(plan);
    setPlanForm({
      name: plan.name,
      memberLevel: plan.memberLevel,
      monthlyPrice: parseFloat(plan.monthlyPrice.toString()).toString(),
      yearlyPrice: parseFloat(plan.yearlyPrice.toString()).toString(),
      maxListings: plan.maxListings.toString(),
      commissionDiscount: (parseFloat(plan.commissionDiscount.toString()) * 100).toFixed(2),
      description: plan.description ?? "",
      benefits: plan.benefits ?? "",
      sortOrder: plan.sortOrder.toString(),
    });
    setPlanDialogOpen(true);
  };

  const closePlanDialog = () => {
    setPlanDialogOpen(false);
    setEditingPlan(null);
  };

  const handleSavePlan = () => {
    const data = {
      name: planForm.name,
      memberLevel: planForm.memberLevel as 'bronze' | 'silver' | 'gold' | 'vip',
      monthlyPrice: parseFloat(planForm.monthlyPrice) || 0,
      yearlyPrice: parseFloat(planForm.yearlyPrice) || 0,
      maxListings: parseInt(planForm.maxListings) || 0,
      commissionDiscount: (parseFloat(planForm.commissionDiscount) || 0) / 100,
      description: planForm.description || undefined,
      benefits: planForm.benefits || undefined,
      sortOrder: parseInt(planForm.sortOrder) || 0,
    };
    if (!data.name) { toast.error("請輸入計劃名稱"); return; }
    if (editingPlan) {
      updatePlanMutation.mutate({ planId: editingPlan.id, ...data });
    } else {
      createPlanMutation.mutate(data);
    }
  };

  // ── Action Dialog Helpers ──
  const openAction = (sub: Subscription, type: "approve" | "reject" | "cancel" | "view") => {
    setActionSub(sub);
    setActionType(type);
    setAdminNote("");
    setActionDialogOpen(true);
  };

  const closeActionDialog = () => {
    setActionDialogOpen(false);
    setActionSub(null);
    setActionType(null);
    setAdminNote("");
  };

  const handleAction = () => {
    if (!actionSub || !actionType) return;
    if (actionType === "approve") {
      approveMutation.mutate({ subscriptionId: actionSub.id, adminNote: adminNote || undefined });
    } else if (actionType === "reject") {
      rejectMutation.mutate({ subscriptionId: actionSub.id, adminNote: adminNote || undefined });
    } else if (actionType === "cancel") {
      cancelMutation.mutate({ subscriptionId: actionSub.id, adminNote: adminNote || undefined });
    }
  };

  // ── Payment methods from siteSettings ──
  const currentPaymentMethods = paymentMethodsSetting
    ? (paymentMethodsSetting as Record<string, string>)["subscription_payment_methods"] ?? ""
    : "";

  const handleSavePaymentMethods = () => {
    updateSettingsMutation.mutate({ key: "subscription_payment_methods", value: paymentMethodsText || currentPaymentMethods });
  };

  // ── Loading / Auth ──
  if (loading || plansLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-spin">👑</div>
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

  const isPending = createPlanMutation.isPending || updatePlanMutation.isPending || approveMutation.isPending || rejectMutation.isPending || cancelMutation.isPending;
  const pendingSubs = (subscriptions as Subscription[] | undefined)?.filter(s => s.status === "pending") ?? [];

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="nav-glass fixed top-0 left-0 right-0 z-50">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <Link href="/admin">
              <Button variant="ghost" size="sm" className="text-amber-700 hover:text-amber-900 hover:bg-amber-50">
                <ArrowLeft className="w-4 h-4 mr-1" /> 後台
              </Button>
            </Link>
            <span className="text-muted-foreground">/</span>
            <span className="font-semibold text-amber-800 flex items-center gap-1.5">
              <Crown className="w-4 h-4" /> 訂閱管理
            </span>
          </div>
          <div className="flex items-center gap-2">
            {pendingSubs.length > 0 && (
              <Badge className="bg-red-500 text-white animate-pulse">{pendingSubs.length} 待審核</Badge>
            )}
            <Badge className="bg-amber-600 text-white text-xs">管理員</Badge>
          </div>
        </div>
      </nav>
      <div className="h-16" />

      <div className="container py-8 max-w-5xl">
        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[
              { label: "總訂閱", value: stats.total, icon: <Users className="w-4 h-4" />, cls: "text-blue-600 bg-blue-50 border-blue-200" },
              { label: "待審核", value: stats.pending, icon: <Clock className="w-4 h-4" />, cls: "text-amber-600 bg-amber-50 border-amber-200" },
              { label: "生效中", value: stats.active, icon: <CheckCircle2 className="w-4 h-4" />, cls: "text-green-600 bg-green-50 border-green-200" },
              { label: "已過期", value: stats.expired, icon: <XCircle className="w-4 h-4" />, cls: "text-gray-600 bg-gray-50 border-gray-200" },
            ].map(({ label, value, icon, cls }) => (
              <Card key={label} className={`border ${cls}`}>
                <CardContent className="py-3 px-4 flex items-center gap-3">
                  {icon}
                  <div>
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="text-xl font-bold">{value}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="subscriptions" className="gap-1">
              <CreditCard className="w-3.5 h-3.5" /> 訂閱審核
              {pendingSubs.length > 0 && (
                <Badge className="bg-red-500 text-white text-xs ml-1 h-4 min-w-4 px-1">{pendingSubs.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="plans" className="gap-1">
              <Star className="w-3.5 h-3.5" /> 計劃管理
            </TabsTrigger>
            <TabsTrigger value="payment" className="gap-1">
              <DollarSign className="w-3.5 h-3.5" /> 付款方式
            </TabsTrigger>
          </TabsList>

          {/* ── Tab: Subscriptions ── */}
          <TabsContent value="subscriptions">
            <Card className="border-amber-100">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <CreditCard className="w-4 h-4 text-amber-600" />
                  訂閱申請列表
                </CardTitle>
                <CardDescription>審核用戶的訂閱申請，確認收款後批准升級</CardDescription>
              </CardHeader>
              <CardContent>
                {subsLoading ? (
                  <p className="text-center text-muted-foreground py-8">載入中...</p>
                ) : !subscriptions || subscriptions.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">尚無訂閱申請</p>
                ) : (
                  <div className="space-y-3">
                    {(subscriptions as Subscription[]).map((sub) => {
                      const sb = statusBadge(sub.status);
                      const lb = levelBadge(sub.memberLevel);
                      return (
                        <div
                          key={sub.id}
                          className={`p-4 rounded-lg border transition-colors ${
                            sub.status === "pending" ? "border-amber-200 bg-amber-50/50" :
                            sub.status === "active" ? "border-green-200 bg-green-50/30" :
                            "border-gray-200 bg-gray-50/30"
                          }`}
                        >
                          <div className="flex items-start justify-between flex-wrap gap-2">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-sm">{sub.userName ?? `用戶 #${sub.userId}`}</span>
                                <Badge variant="outline" className="text-xs">ID: {sub.userId}</Badge>
                                <Badge variant="outline" className={`text-xs ${sb.cls}`}>{sb.label}</Badge>
                                <Badge variant="outline" className={`text-xs ${lb.cls}`}>{lb.icon} {lb.label}</Badge>
                              </div>
                              <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                                <p>計劃：{sub.planName ?? "未知"} | 週期：{sub.billingCycle === "yearly" ? "年繳" : "月繳"}</p>
                                <p>付款方式：{PAYMENT_METHODS.find(m => m.value === sub.paymentMethod)?.label ?? sub.paymentMethod ?? "未指定"}</p>
                                {sub.paymentReference && <p>付款參考：{sub.paymentReference}</p>}
                                <p>申請時間：{formatDate(sub.createdAt)}</p>
                                {sub.startDate && <p>生效：{formatDate(sub.startDate)} ~ {formatDate(sub.endDate)}</p>}
                                {sub.adminNote && <p className="text-amber-700">備註：{sub.adminNote}</p>}
                              </div>
                            </div>
                            <div className="flex gap-1.5 flex-wrap">
                              {sub.paymentProofUrl && (
                                <Button
                                  variant="outline" size="sm"
                                  className="text-blue-600 border-blue-200 hover:bg-blue-50 text-xs h-7"
                                  onClick={() => openAction(sub, "view")}
                                >
                                  <Eye className="w-3 h-3 mr-0.5" /> 查看憑證
                                </Button>
                              )}
                              {sub.status === "pending" && (
                                <>
                                  <Button
                                    variant="outline" size="sm"
                                    className="text-green-600 border-green-200 hover:bg-green-50 text-xs h-7"
                                    onClick={() => openAction(sub, "approve")}
                                  >
                                    <CheckCircle2 className="w-3 h-3 mr-0.5" /> 批准
                                  </Button>
                                  <Button
                                    variant="outline" size="sm"
                                    className="text-red-600 border-red-200 hover:bg-red-50 text-xs h-7"
                                    onClick={() => openAction(sub, "reject")}
                                  >
                                    <XCircle className="w-3 h-3 mr-0.5" /> 拒絕
                                  </Button>
                                </>
                              )}
                              {sub.status === "active" && (
                                <Button
                                  variant="outline" size="sm"
                                  className="text-red-600 border-red-200 hover:bg-red-50 text-xs h-7"
                                  onClick={() => openAction(sub, "cancel")}
                                >
                                  <Ban className="w-3 h-3 mr-0.5" /> 取消
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Tab: Plans ── */}
          <TabsContent value="plans">
            <Card className="border-amber-100">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Star className="w-4 h-4 text-amber-600" />
                      訂閱計劃管理
                    </CardTitle>
                    <CardDescription>建立和編輯訂閱計劃，設定價格、等級和權益</CardDescription>
                  </div>
                  <Button size="sm" className="gold-gradient text-white border-0" onClick={openCreatePlan}>
                    <Plus className="w-4 h-4 mr-1" /> 新增計劃
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {!plans || plans.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground mb-3">尚未建立任何訂閱計劃</p>
                    <Button onClick={openCreatePlan} className="gold-gradient text-white border-0">
                      <Plus className="w-4 h-4 mr-1" /> 建立第一個計劃
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(plans as Plan[]).map((plan) => {
                      const lb = levelBadge(plan.memberLevel);
                      return (
                        <div
                          key={plan.id}
                          className={`p-4 rounded-lg border transition-colors ${
                            plan.isActive ? "border-amber-200 bg-amber-50/30" : "border-gray-200 bg-gray-50/50 opacity-60"
                          }`}
                        >
                          <div className="flex items-start justify-between flex-wrap gap-2">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-sm">{plan.name}</span>
                                <Badge variant="outline" className={`text-xs ${lb.cls}`}>{lb.icon} {lb.label}</Badge>
                                {!plan.isActive && <Badge variant="outline" className="text-xs bg-gray-100 text-gray-500">已停用</Badge>}
                              </div>
                              <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                                <p>月費：{formatCurrency(plan.monthlyPrice)} | 年費：{formatCurrency(plan.yearlyPrice)}</p>
                                <p>
                                  發佈限制：{plan.maxListings === 0 ? "無限制" : `${plan.maxListings} 件`} |
                                  佣金折扣：{(parseFloat(plan.commissionDiscount.toString()) * 100).toFixed(2)}%
                                </p>
                                {plan.description && <p>{plan.description}</p>}
                              </div>
                            </div>
                            <div className="flex gap-1.5">
                              <Button
                                variant="outline" size="sm"
                                className="text-amber-600 border-amber-200 hover:bg-amber-50 text-xs h-7"
                                onClick={() => openEditPlan(plan)}
                              >
                                <Pencil className="w-3 h-3 mr-0.5" /> 編輯
                              </Button>
                              <Button
                                variant="outline" size="sm"
                                className="text-red-600 border-red-200 hover:bg-red-50 text-xs h-7"
                                onClick={() => {
                                  if (confirm(`確定刪除計劃「${plan.name}」？`)) {
                                    deletePlanMutation.mutate({ planId: plan.id });
                                  }
                                }}
                              >
                                <Trash2 className="w-3 h-3 mr-0.5" /> 刪除
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Tab: Payment Methods ── */}
          <TabsContent value="payment">
            <Card className="border-amber-100">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <DollarSign className="w-4 h-4 text-amber-600" />
                  付款方式設定
                </CardTitle>
                <CardDescription>設定顯示給用戶的付款方式資訊（銀行帳號、PayMe 連結等）</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>付款方式說明</Label>
                    <Textarea
                      value={paymentMethodsText || currentPaymentMethods}
                      onChange={(e) => setPaymentMethodsText(e.target.value)}
                      placeholder={"銀行轉帳：\n恒生銀行 024-xxx-xxxxxx-xxx\n戶名：大BB錢幣店\n\nPayMe：\nhttps://payme.hsbc/xxx\n\n轉數快 FPS：\nFPS ID: xxxxxxxx"}
                      rows={10}
                      className="border-amber-200 focus-visible:ring-amber-400 text-sm font-mono resize-y"
                    />
                    <p className="text-xs text-muted-foreground">
                      此內容會顯示在用戶的訂閱頁面中。支援換行，每行會獨立顯示。
                    </p>
                  </div>
                  <Button
                    onClick={handleSavePaymentMethods}
                    disabled={updateSettingsMutation.isPending}
                    className="gold-gradient text-white border-0"
                  >
                    {updateSettingsMutation.isPending ? "儲存中..." : "儲存付款方式"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Plan Create/Edit Dialog ── */}
      <Dialog open={planDialogOpen} onOpenChange={(open) => { if (!open) closePlanDialog(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPlan ? "編輯訂閱計劃" : "新增訂閱計劃"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>計劃名稱 *</Label>
              <Input
                value={planForm.name}
                onChange={(e) => setPlanForm(f => ({ ...f, name: e.target.value }))}
                placeholder="例：銀牌月費計劃"
                className="border-amber-200"
              />
            </div>
            <div className="space-y-2">
              <Label>對應會員等級</Label>
              <Select value={planForm.memberLevel} onValueChange={(v) => setPlanForm(f => ({ ...f, memberLevel: v }))}>
                <SelectTrigger className="border-amber-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bronze">🥉 銅牌</SelectItem>
                  <SelectItem value="silver">🥈 銀牌</SelectItem>
                  <SelectItem value="gold">🥇 金牌</SelectItem>
                  <SelectItem value="vip">💎 VIP</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>月費 (HK$)</Label>
                <Input
                  type="number" step="0.01"
                  value={planForm.monthlyPrice}
                  onChange={(e) => setPlanForm(f => ({ ...f, monthlyPrice: e.target.value }))}
                  placeholder="0.00"
                  className="border-amber-200"
                />
              </div>
              <div className="space-y-2">
                <Label>年費 (HK$)</Label>
                <Input
                  type="number" step="0.01"
                  value={planForm.yearlyPrice}
                  onChange={(e) => setPlanForm(f => ({ ...f, yearlyPrice: e.target.value }))}
                  placeholder="0.00"
                  className="border-amber-200"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>發佈數量限制</Label>
                <Input
                  type="number"
                  value={planForm.maxListings}
                  onChange={(e) => setPlanForm(f => ({ ...f, maxListings: e.target.value }))}
                  placeholder="0 = 無限制"
                  className="border-amber-200"
                />
                <p className="text-xs text-muted-foreground">0 = 無限制</p>
              </div>
              <div className="space-y-2">
                <Label>佣金折扣 (%)</Label>
                <Input
                  type="number" step="0.01"
                  value={planForm.commissionDiscount}
                  onChange={(e) => setPlanForm(f => ({ ...f, commissionDiscount: e.target.value }))}
                  placeholder="0.00"
                  className="border-amber-200"
                />
                <p className="text-xs text-muted-foreground">例：1.00 = 佣金減 1%</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label>計劃描述</Label>
              <Textarea
                value={planForm.description}
                onChange={(e) => setPlanForm(f => ({ ...f, description: e.target.value }))}
                placeholder="簡短描述此計劃的特色..."
                rows={2}
                className="border-amber-200"
              />
            </div>
            <div className="space-y-2">
              <Label>權益列表 (JSON)</Label>
              <Textarea
                value={planForm.benefits}
                onChange={(e) => setPlanForm(f => ({ ...f, benefits: e.target.value }))}
                placeholder={'["優先出價通知", "銀牌專屬徽章", "反狙擊延時保護"]'}
                rows={3}
                className="border-amber-200 font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">JSON 陣列格式，每項為一個權益文字</p>
            </div>
            <div className="space-y-2">
              <Label>排序順序</Label>
              <Input
                type="number"
                value={planForm.sortOrder}
                onChange={(e) => setPlanForm(f => ({ ...f, sortOrder: e.target.value }))}
                placeholder="0"
                className="border-amber-200"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={closePlanDialog} className="flex-1">取消</Button>
              <Button
                onClick={handleSavePlan}
                disabled={isPending}
                className="flex-1 gold-gradient text-white border-0"
              >
                {isPending ? "處理中..." : editingPlan ? "更新計劃" : "建立計劃"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Subscription Action Dialog ── */}
      <Dialog open={actionDialogOpen} onOpenChange={(open) => { if (!open) closeActionDialog(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === "approve" && "批准訂閱"}
              {actionType === "reject" && "拒絕訂閱"}
              {actionType === "cancel" && "取消訂閱"}
              {actionType === "view" && "付款憑證"}
            </DialogTitle>
          </DialogHeader>
          {actionSub && (
            <div className="space-y-4 pt-2">
              {actionType === "view" && actionSub.paymentProofUrl && (
                <div className="rounded-lg overflow-hidden border border-amber-200">
                  <img
                    src={actionSub.paymentProofUrl}
                    alt="付款憑證"
                    className="w-full max-h-96 object-contain bg-gray-50"
                  />
                </div>
              )}
              <div className="text-sm space-y-1">
                <p><strong>用戶：</strong>{actionSub.userName ?? `#${actionSub.userId}`}</p>
                <p><strong>計劃：</strong>{actionSub.planName}</p>
                <p><strong>週期：</strong>{actionSub.billingCycle === "yearly" ? "年繳" : "月繳"}</p>
                <p><strong>付款方式：</strong>{PAYMENT_METHODS.find(m => m.value === actionSub.paymentMethod)?.label ?? actionSub.paymentMethod ?? "未指定"}</p>
                {actionSub.paymentReference && <p><strong>付款參考：</strong>{actionSub.paymentReference}</p>}
              </div>
              {actionType !== "view" && (
                <>
                  <div className="space-y-2">
                    <Label>管理員備註</Label>
                    <Textarea
                      value={adminNote}
                      onChange={(e) => setAdminNote(e.target.value)}
                      placeholder="選填備註..."
                      rows={2}
                      className="border-amber-200"
                    />
                  </div>
                  {actionType === "approve" && (
                    <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-800">
                      批准後，用戶的會員等級將自動升級為 <strong>{levelBadge(actionSub.memberLevel).icon} {levelBadge(actionSub.memberLevel).label}</strong>
                    </div>
                  )}
                  {actionType === "cancel" && (
                    <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800">
                      取消後，用戶的會員等級將降回 <strong>🥉 銅牌</strong>
                    </div>
                  )}
                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" onClick={closeActionDialog} className="flex-1">取消</Button>
                    <Button
                      onClick={handleAction}
                      disabled={isPending}
                      className={`flex-1 text-white border-0 ${
                        actionType === "approve" ? "bg-green-600 hover:bg-green-700" :
                        "bg-red-600 hover:bg-red-700"
                      }`}
                    >
                      {isPending ? "處理中..." :
                        actionType === "approve" ? "確認批准" :
                        actionType === "reject" ? "確認拒絕" :
                        "確認取消"
                      }
                    </Button>
                  </div>
                </>
              )}
              {actionType === "view" && (
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" onClick={closeActionDialog} className="flex-1">關閉</Button>
                  {actionSub.status === "pending" && (
                    <>
                      <Button
                        onClick={() => { setActionType("approve"); }}
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white border-0"
                      >
                        <CheckCircle2 className="w-4 h-4 mr-1" /> 批准
                      </Button>
                      <Button
                        onClick={() => { setActionType("reject"); }}
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white border-0"
                      >
                        <XCircle className="w-4 h-4 mr-1" /> 拒絕
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
