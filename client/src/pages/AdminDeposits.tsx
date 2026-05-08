import { useState } from "react";
import { useConfirm } from "@/components/ui/confirm-provider";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import AdminHeader from "@/components/AdminHeader";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Wallet, Plus, Minus, RefreshCw, Settings, History, DollarSign, AlertCircle, CheckCircle2, XCircle, ChevronDown, ChevronUp, ImageIcon, Layers, Pencil, Trash2 } from "lucide-react";
import { RefundRequestsDialog } from "@/components/admin/RefundRequestsDialog";

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  bank_transfer: "銀行轉帳",
  payme: "PayMe",
  fps: "轉數快 FPS",
  alipay_hk: "支付寶 HK",
  wechat_pay: "微信支付",
  cash: "現金",
  other: "其他",
};
import { toast } from "sonner";

type DepositRow = {
  id: number;
  userId: number;
  userName: string | null;
  userEmail: string | null;
  balance: string;
  requiredDeposit: string;
  warningDeposit: string;
  commissionRate: string;
  productCommissionRate?: string | null;
  isActive: number;
  createdAt: Date;
  updatedAt: Date;
};

type TransactionRow = {
  id: number;
  type: string;
  amount: string;
  balanceAfter: string;
  description: string | null;
  relatedAuctionId: number | null;
  createdAt: Date;
  userId?: number;
  userName?: string | null;
};

type TopUpRequestRow = {
  id: number;
  userId: number;
  userName: string | null;
  userPhone: string | null;
  amount: string | number;
  referenceNo: string | null;
  bank: string | null;
  note: string | null;
  receiptUrl: string | null;
  status: string;
  adminNote: string | null;
  createdAt: Date | string | null;
};

function formatCurrency(val: string | number) {
  return `HK$${parseFloat(val.toString()).toFixed(2)}`;
}

function formatDate(date: Date | string) {
  return new Date(date).toLocaleString("zh-HK", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function typeLabel(type: string) {
  switch (type) {
    case "top_up": return { text: "充值", cls: "bg-green-100 text-green-700 border-green-200" };
    case "commission": return { text: "佣金扣除", cls: "bg-red-100 text-red-700 border-red-200" };
    case "refund": return { text: "退還", cls: "bg-blue-100 text-blue-700 border-blue-200" };
    case "adjustment": return { text: "調整", cls: "bg-amber-100 text-amber-700 border-amber-200" };
    default: return { text: type, cls: "bg-gray-100 text-gray-700 border-gray-200" };
  }
}

export default function AdminDeposits() {
  const confirmDialog = useConfirm();
  const { user, isAuthenticated, loading } = useAuth();
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [actionType, setActionType] = useState<"topUp" | "deduct" | "refund" | "adjust" | "settings" | null>(null);
  const [actionAmount, setActionAmount] = useState("");
  const [actionDescription, setActionDescription] = useState("");
  const [actionAuctionId, setActionAuctionId] = useState("");
  const [settingsRequiredDeposit, setSettingsRequiredDeposit] = useState("");
  const [settingsWarningDeposit, setSettingsWarningDeposit] = useState("");
  const [settingsCommissionRate, setSettingsCommissionRate] = useState("");
  const [settingsProductCommissionRate, setSettingsProductCommissionRate] = useState("");
  const [settingsIsActive, setSettingsIsActive] = useState(true);
  const [showTransactions, setShowTransactions] = useState(false);
  const [transactionUserId, setTransactionUserId] = useState<number | null>(null);
  const [addUserDialogOpen, setAddUserDialogOpen] = useState(false);
  const [newUserId, setNewUserId] = useState("");
  const [refundDialogOpen, setRefundDialogOpen] = useState(false);

  // pending refund count for hero button badge
  const { data: refundReqs } = trpc.merchants.adminGetRefundRequests.useQuery(undefined, {
    enabled: isAuthenticated && user?.role === "admin",
    refetchInterval: 60000,
  });
  const pendingRefundCount = refundReqs?.filter((r: { status: string }) => r.status === "pending").length ?? 0;

  const { data: deposits, isLoading: depositsLoading } = trpc.sellerDeposits.listAll.useQuery(
    undefined,
    { enabled: isAuthenticated && user?.role === "admin" }
  );

  const { data: transactions, isLoading: txLoading } = trpc.sellerDeposits.getTransactions.useQuery(
    { userId: transactionUserId ?? 0, limit: 100, offset: 0 },
    { enabled: !!transactionUserId && isAuthenticated && user?.role === "admin" }
  );

  const { data: allTransactions, isLoading: allTxLoading } = trpc.sellerDeposits.getAllTransactions.useQuery(
    { limit: 100, offset: 0 },
    { enabled: showTransactions && !transactionUserId && isAuthenticated && user?.role === "admin" }
  );

  const utils = trpc.useUtils();

  const [showTopUpRequests, setShowTopUpRequests] = useState(true);
  const [reviewNotes, setReviewNotes] = useState<Record<number, string>>({});

  // ── Tier preset state ──
  const [showTiers, setShowTiers] = useState(true);
  const [tierDialogOpen, setTierDialogOpen] = useState(false);
  const [editingTierId, setEditingTierId] = useState<number | null>(null);
  const [tierName, setTierName] = useState("");
  const [tierAmount, setTierAmount] = useState("");
  const [tierMaintenancePct, setTierMaintenancePct] = useState("80");
  const [tierWarningPct, setTierWarningPct] = useState("60");
  const [tierCommissionRate, setTierCommissionRate] = useState("5");
  const [tierProductCommissionRate, setTierProductCommissionRate] = useState("5");
  const [tierDescription, setTierDescription] = useState("");
  const [tierIsActive, setTierIsActive] = useState(true);
  const [tierSortOrder, setTierSortOrder] = useState("0");

  // ── Tier queries & mutations ──
  const { data: tiers, refetch: refetchTiers } = trpc.depositTiers.listAll.useQuery(
    undefined,
    { enabled: isAuthenticated && user?.role === "admin" }
  );

  const upsertTierMutation = trpc.depositTiers.upsert.useMutation({
    onSuccess: () => {
      toast.success(editingTierId ? "套餐已更新" : "套餐已新增");
      refetchTiers();
      setTierDialogOpen(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteTierMutation = trpc.depositTiers.delete.useMutation({
    onSuccess: () => { toast.success("套餐已刪除"); refetchTiers(); },
    onError: (err) => toast.error(err.message),
  });

  const openNewTier = () => {
    setEditingTierId(null);
    setTierName(""); setTierAmount(""); setTierMaintenancePct("80");
    setTierWarningPct("60"); setTierCommissionRate("5"); setTierProductCommissionRate("5");
    setTierDescription(""); setTierIsActive(true); setTierSortOrder("0");
    setTierDialogOpen(true);
  };

  const openEditTier = (t: { id: number; name: string; amount: string; maintenancePct: string; warningPct: string; commissionRate?: string | null; productCommissionRate?: string | null; description: string | null; isActive: number; sortOrder: number }) => {
    setEditingTierId(t.id);
    setTierName(t.name);
    setTierAmount(parseFloat(t.amount).toString());
    setTierMaintenancePct(parseFloat(t.maintenancePct).toString());
    setTierWarningPct(parseFloat(t.warningPct).toString());
    setTierCommissionRate(t.commissionRate ? (parseFloat(t.commissionRate) * 100).toString() : "5");
    setTierProductCommissionRate(t.productCommissionRate ? (parseFloat(t.productCommissionRate) * 100).toString() : "5");
    setTierDescription(t.description ?? "");
    setTierIsActive(t.isActive === 1);
    setTierSortOrder(t.sortOrder.toString());
    setTierDialogOpen(true);
  };

  const saveTier = () => {
    const amount = parseFloat(tierAmount);
    const maintenancePct = parseFloat(tierMaintenancePct);
    const warningPct = parseFloat(tierWarningPct);
    const commissionRatePct = parseFloat(tierCommissionRate);
    const productCommissionRatePct = parseFloat(tierProductCommissionRate);
    if (!tierName.trim()) { toast.error("請輸入套餐名稱"); return; }
    if (!amount || amount <= 0) { toast.error("請輸入有效金額"); return; }
    if (isNaN(maintenancePct) || maintenancePct < 0 || maintenancePct > 100) { toast.error("維持水平需在 0–100%"); return; }
    if (isNaN(warningPct) || warningPct < 0 || warningPct > 100) { toast.error("預警百分比需在 0–100%"); return; }
    if (isNaN(commissionRatePct) || commissionRatePct < 0 || commissionRatePct > 100) { toast.error("拍賣傭金率需在 0–100%"); return; }
    if (isNaN(productCommissionRatePct) || productCommissionRatePct < 0 || productCommissionRatePct > 100) { toast.error("貨品傭金率需在 0–100%"); return; }
    upsertTierMutation.mutate({
      id: editingTierId ?? undefined,
      name: tierName.trim(),
      amount,
      maintenancePct,
      warningPct,
      commissionRate: commissionRatePct / 100,
      productCommissionRate: productCommissionRatePct / 100,
      description: tierDescription.trim() || null,
      isActive: tierIsActive ? 1 : 0,
      sortOrder: parseInt(tierSortOrder) || 0,
    });
  };

  const { data: topUpRequests, refetch: refetchTopUpRequests } = trpc.sellerDeposits.allTopUpRequests.useQuery(
    undefined,
    { enabled: isAuthenticated && user?.role === "admin", refetchInterval: 30000 }
  );

  const reviewTopUpMutation = trpc.sellerDeposits.reviewTopUpRequest.useMutation({
    onSuccess: (_data, vars) => {
      const action = vars.status === 'approved' ? '已批准' : '已拒絕';
      toast.success(`充值申請 #${vars.id} ${action}`);
      refetchTopUpRequests();
      utils.sellerDeposits.listAll.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const topUpMutation = trpc.sellerDeposits.topUp.useMutation({
    onSuccess: (data) => {
      toast.success(`充值成功，新餘額：HK$${data.newBalance.toFixed(2)}`);
      utils.sellerDeposits.listAll.invalidate();
      resetAction();
    },
    onError: (err) => toast.error(`充值失敗：${err.message}`),
  });

  const deductMutation = trpc.sellerDeposits.deductCommission.useMutation({
    onSuccess: (data) => {
      toast.success(`扣除成功，新餘額：HK$${data.newBalance.toFixed(2)}`);
      utils.sellerDeposits.listAll.invalidate();
      resetAction();
    },
    onError: (err) => toast.error(`扣除失敗：${err.message}`),
  });

  const refundMutation = trpc.sellerDeposits.refundCommission.useMutation({
    onSuccess: (data) => {
      toast.success(`退還成功，新餘額：HK$${data.newBalance.toFixed(2)}`);
      utils.sellerDeposits.listAll.invalidate();
      resetAction();
    },
    onError: (err) => toast.error(`退還失敗：${err.message}`),
  });

  const adjustMutation = trpc.sellerDeposits.adjust.useMutation({
    onSuccess: (data) => {
      toast.success(`調整成功，新餘額：HK$${data.newBalance.toFixed(2)}`);
      utils.sellerDeposits.listAll.invalidate();
      resetAction();
    },
    onError: (err) => toast.error(`調整失敗：${err.message}`),
  });

  const updateSettingsMutation = trpc.sellerDeposits.updateSettings.useMutation({
    onSuccess: () => {
      toast.success("設定已更新");
      utils.sellerDeposits.listAll.invalidate();
      resetAction();
    },
    onError: (err) => toast.error(`更新失敗：${err.message}`),
  });

  const addUserMutation = trpc.sellerDeposits.getByUser.useQuery(
    { userId: parseInt(newUserId) || 0 },
    { enabled: false }
  );

  const resetAction = () => {
    setActionType(null);
    setSelectedUserId(null);
    setActionAmount("");
    setActionDescription("");
    setActionAuctionId("");
  };

  const handleAction = () => {
    if (!selectedUserId || !actionType) return;

    if (actionType === "topUp") {
      const amount = parseFloat(actionAmount);
      if (!amount || amount <= 0) { toast.error("請輸入有效金額"); return; }
      topUpMutation.mutate({ userId: selectedUserId, amount, description: actionDescription || undefined });
    } else if (actionType === "deduct") {
      const amount = parseFloat(actionAmount);
      const auctionId = parseInt(actionAuctionId);
      if (!amount || amount <= 0) { toast.error("請輸入有效金額"); return; }
      if (!auctionId) { toast.error("請輸入拍賣編號"); return; }
      deductMutation.mutate({ userId: selectedUserId, amount, auctionId, description: actionDescription || undefined });
    } else if (actionType === "refund") {
      const amount = parseFloat(actionAmount);
      const auctionId = parseInt(actionAuctionId);
      if (!amount || amount <= 0) { toast.error("請輸入有效金額"); return; }
      if (!auctionId) { toast.error("請輸入拍賣編號"); return; }
      refundMutation.mutate({ userId: selectedUserId, amount, auctionId, description: actionDescription || undefined });
    } else if (actionType === "adjust") {
      const amount = parseFloat(actionAmount);
      if (!amount) { toast.error("請輸入有效金額"); return; }
      if (!actionDescription.trim()) { toast.error("請填寫調整原因"); return; }
      adjustMutation.mutate({ userId: selectedUserId, amount, description: actionDescription });
    } else if (actionType === "settings") {
      const updates: { requiredDeposit?: number; warningDeposit?: number; commissionRate?: number; productCommissionRate?: number; isActive?: number } = {};
      if (settingsRequiredDeposit) updates.requiredDeposit = parseFloat(settingsRequiredDeposit);
      if (settingsWarningDeposit) updates.warningDeposit = parseFloat(settingsWarningDeposit);
      if (settingsCommissionRate) updates.commissionRate = parseFloat(settingsCommissionRate) / 100;
      if (settingsProductCommissionRate) updates.productCommissionRate = parseFloat(settingsProductCommissionRate) / 100;
      updates.isActive = settingsIsActive ? 1 : 0;
      updateSettingsMutation.mutate({ userId: selectedUserId, ...updates });
    }
  };

  const openSettings = (deposit: DepositRow) => {
    setSelectedUserId(deposit.userId);
    setActionType("settings");
    setSettingsRequiredDeposit(deposit.requiredDeposit.toString());
    setSettingsWarningDeposit(deposit.warningDeposit?.toString() ?? "");
    setSettingsCommissionRate((parseFloat(deposit.commissionRate.toString()) * 100).toFixed(2));
    setSettingsProductCommissionRate(deposit.productCommissionRate ? (parseFloat(deposit.productCommissionRate) * 100).toFixed(2) : (parseFloat(deposit.commissionRate.toString()) * 100).toFixed(2));
    setSettingsIsActive(deposit.isActive === 1);
  };

  const handleAddUser = async () => {
    const uid = parseInt(newUserId);
    if (!uid || uid <= 0) { toast.error("請輸入有效的用戶 ID"); return; }
    try {
      // Trigger a getByUser which auto-creates the deposit record
      await utils.sellerDeposits.getByUser.fetch({ userId: uid });
      toast.success(`已為用戶 #${uid} 建立保證金記錄`);
      utils.sellerDeposits.listAll.invalidate();
      setAddUserDialogOpen(false);
      setNewUserId("");
    } catch (err: any) {
      toast.error(`建立失敗：${err.message}`);
    }
  };

  if (loading || depositsLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-spin">💰</div>
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

  const isPending = topUpMutation.isPending || deductMutation.isPending || refundMutation.isPending || adjustMutation.isPending || updateSettingsMutation.isPending;

  const displayTransactions = transactionUserId ? transactions : allTransactions;
  const isTxLoading = transactionUserId ? txLoading : allTxLoading;

  // ── Quick stats for hero ──
  const totalMerchants = (deposits as DepositRow[] | undefined)?.length ?? 0;
  const totalBalance = (deposits as DepositRow[] | undefined)?.reduce((s, d) => s + parseFloat(d.balance || "0"), 0) ?? 0;
  const lowBalanceCount = (deposits as DepositRow[] | undefined)?.filter(d => {
    const bal = parseFloat(d.balance || "0");
    const warn = parseFloat(d.warningDeposit || "0");
    return warn > 0 && bal <= warn;
  }).length ?? 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50/30 via-white to-amber-50/30">
      <AdminHeader />

      <div className="container py-6 max-w-5xl space-y-6">
        {/* ── Hero ── */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-500 via-teal-500 to-emerald-600 p-6 sm:p-8 shadow-xl">
          <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-16 -left-8 w-56 h-56 rounded-full bg-yellow-300/20 blur-3xl" />
          <div className="absolute top-4 right-6 opacity-10">
            <Wallet className="w-32 h-32 text-white" />
          </div>

          <div className="relative flex items-start justify-between flex-wrap gap-4">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur text-white text-xs font-medium mb-3">
                <Wallet className="w-3.5 h-3.5" />
                Deposit Operations
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                商戶保證金管理
              </h1>
              <p className="text-sm text-white/90 mt-2 max-w-md">
                餘額管理 · 套餐設定 · 佣金率調整 · 完整交易歷史。
              </p>

              {/* hero KPIs */}
              <div className="flex flex-wrap gap-2 mt-4">
                <div className="bg-white/20 backdrop-blur rounded-lg px-3 py-1.5 border border-white/20">
                  <p className="text-[10px] text-white/80 uppercase tracking-wider">商戶數</p>
                  <p className="text-lg font-bold text-white leading-none mt-0.5">{totalMerchants}</p>
                </div>
                <div className="bg-white/20 backdrop-blur rounded-lg px-3 py-1.5 border border-white/20">
                  <p className="text-[10px] text-white/80 uppercase tracking-wider">總餘額</p>
                  <p className="text-lg font-bold text-white leading-none mt-0.5">HK${totalBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                </div>
                {lowBalanceCount > 0 && (
                  <div className="bg-red-500/30 backdrop-blur rounded-lg px-3 py-1.5 border border-red-300/40 animate-pulse">
                    <p className="text-[10px] text-white/90 uppercase tracking-wider">⚠️ 低餘額</p>
                    <p className="text-lg font-bold text-white leading-none mt-0.5">{lowBalanceCount}</p>
                  </div>
                )}
              </div>
            </div>

            {/* action buttons */}
            <div className="flex flex-wrap gap-2 self-start">
              <Link href="/admin/merchant-center">
                <Button size="sm" className="bg-white/20 backdrop-blur hover:bg-white/30 text-white border border-white/30">
                  ✨ 商戶中心
                </Button>
              </Link>
              <Button
                size="sm"
                onClick={() => setRefundDialogOpen(true)}
                className="relative bg-white text-orange-600 hover:bg-orange-50 border-0 shadow"
              >
                <AlertCircle className="w-4 h-4 mr-1" /> 退傭申請
                {pendingRefundCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center shadow ring-2 ring-white">
                    {pendingRefundCount}
                  </span>
                )}
              </Button>
              <Button
                size="sm"
                onClick={() => { setShowTransactions(!showTransactions); setTransactionUserId(null); }}
                className="bg-white/90 hover:bg-white text-gray-700 border-0 shadow"
              >
                <History className="w-4 h-4 mr-1" />
                {showTransactions ? "隱藏交易" : "所有交易"}
              </Button>
              <Dialog open={addUserDialogOpen} onOpenChange={setAddUserDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="bg-amber-400 hover:bg-amber-500 text-amber-950 font-bold border-0 shadow-lg">
                    <Plus className="w-4 h-4 mr-1" /> 新增商戶
                  </Button>
                </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>新增商戶保證金帳戶</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>用戶 ID</Label>
                    <Input
                      type="number"
                      value={newUserId}
                      onChange={(e) => setNewUserId(e.target.value)}
                      placeholder="輸入用戶 ID"
                      className="border-amber-200"
                    />
                    <p className="text-xs text-muted-foreground">可在「會員管理」頁面查看用戶 ID</p>
                  </div>
                  <Button onClick={handleAddUser} className="w-full gold-gradient text-white border-0">
                    建立帳戶
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
        </div>

        {/* Info hint (slim) */}
        <div className="rounded-xl border border-blue-100 bg-blue-50/40 px-4 py-2.5 text-xs text-blue-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-blue-500 flex-shrink-0" />
          <span>商戶需繳納保證金才可上架；成交後依佣金率自動扣除。Admin 可手動充值／扣除／退還／調整。</span>
        </div>

        {/* ── 保證金套餐設定 ── */}
        <Card className="mb-6 border-violet-200">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-violet-600" />
                保證金套餐設定
              </span>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" className="h-7 px-2 text-xs border-violet-200 text-violet-700 hover:bg-violet-50" onClick={openNewTier}>
                  <Plus className="w-3 h-3 mr-1" /> 新增套餐
                </Button>
                <button type="button" onClick={() => setShowTiers(v => !v)} className="text-gray-400 hover:text-gray-600">
                  {showTiers ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
              </div>
            </CardTitle>
            <CardDescription className="text-xs">設定不同保證金金額、維持水平及預警百分比，商戶充值時可選擇套餐</CardDescription>
          </CardHeader>
          {showTiers && (
            <CardContent>
              {(!tiers || tiers.length === 0) ? (
                <p className="text-sm text-muted-foreground text-center py-6">尚未設定任何套餐，點擊「新增套餐」開始</p>
              ) : (
                <div className="space-y-2">
                  {(tiers as { id: number; name: string; amount: string; maintenancePct: string; warningPct: string; commissionRate?: string | null; productCommissionRate?: string | null; description: string | null; isActive: number; sortOrder: number }[]).map(tier => {
                    const amt = parseFloat(tier.amount);
                    const mPct = parseFloat(tier.maintenancePct);
                    const wPct = parseFloat(tier.warningPct);
                    const commPct = tier.commissionRate ? parseFloat(tier.commissionRate) * 100 : 5;
                    const prodCommPct = tier.productCommissionRate ? parseFloat(tier.productCommissionRate) * 100 : commPct;
                    return (
                      <div key={tier.id} className={`flex items-center justify-between gap-3 rounded-xl px-4 py-3 border ${tier.isActive === 1 ? "bg-violet-50 border-violet-200" : "bg-gray-50 border-gray-200 opacity-60"}`}>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm text-violet-900">{tier.name}</span>
                            <span className="font-bold text-amber-700 text-sm">HK${amt.toLocaleString()}</span>
                            <span className="text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-full px-2 py-0.5">拍賣傭金 {commPct.toFixed(2)}%</span>
                            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">貨品傭金 {prodCommPct.toFixed(2)}%</span>
                            {tier.isActive !== 1 && <span className="text-xs text-gray-400 border rounded-full px-2 py-0.5 bg-white">停用</span>}
                          </div>
                          <div className="flex gap-3 mt-0.5 text-xs text-gray-500 flex-wrap">
                            <span>維持水平：<strong className="text-emerald-700">{mPct}%</strong>（≥ HK${(amt * mPct / 100).toLocaleString()}）</span>
                            <span>預警：<strong className="text-amber-600">{wPct}%</strong>（≤ HK${(amt * wPct / 100).toLocaleString()}）</span>
                          </div>
                          {tier.description && <p className="text-xs text-gray-400 mt-0.5">{tier.description}</p>}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-400 hover:text-violet-600" onClick={() => openEditTier(tier)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-400 hover:text-red-500"
                            onClick={async () => {
                              const ok = await confirmDialog({
                                title: "確定刪除套餐？",
                                description: `「${tier.name}」`,
                                confirmText: "刪除",
                                tone: "danger",
                              });
                              if (ok) deleteTierMutation.mutate({ id: tier.id });
                            }}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          )}
        </Card>

        {/* Tier Upsert Dialog */}
        <Dialog open={tierDialogOpen} onOpenChange={setTierDialogOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>{editingTierId ? "編輯套餐" : "新增套餐"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 pt-2">
              <div className="space-y-1">
                <Label className="text-xs">套餐名稱 *</Label>
                <Input value={tierName} onChange={e => setTierName(e.target.value)} placeholder="例如：基礎套餐" className="border-violet-200" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">保證金金額 (HKD) *</Label>
                <Input type="number" min="1" value={tierAmount} onChange={e => setTierAmount(e.target.value)} placeholder="例如：5000" className="border-violet-200" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">維持水平 % *</Label>
                  <Input type="number" min="0" max="100" value={tierMaintenancePct} onChange={e => setTierMaintenancePct(e.target.value)} placeholder="80" className="border-violet-200" />
                  <p className="text-xs text-gray-400">餘額低於此%即不能上架</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">預警 % *</Label>
                  <Input type="number" min="0" max="100" value={tierWarningPct} onChange={e => setTierWarningPct(e.target.value)} placeholder="60" className="border-violet-200" />
                  <p className="text-xs text-gray-400">餘額低於此%顯示警告</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">拍賣傭金率 (%) *</Label>
                  <Input type="number" min="0" max="100" step="0.01" value={tierCommissionRate} onChange={e => setTierCommissionRate(e.target.value)} placeholder="5" className="border-violet-200" />
                  <p className="text-xs text-gray-400">拍賣成交傭金</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">貨品傭金率 (%) *</Label>
                  <Input type="number" min="0" max="100" step="0.01" value={tierProductCommissionRate} onChange={e => setTierProductCommissionRate(e.target.value)} placeholder="5" className="border-emerald-200" />
                  <p className="text-xs text-gray-400">貨品訂單傭金</p>
                </div>
              </div>
              {tierAmount && tierMaintenancePct && tierWarningPct && (
                <div className="rounded-lg bg-violet-50 border border-violet-100 px-3 py-2 text-xs text-violet-700 space-y-0.5">
                  <p>維持水平門檻：HK${(parseFloat(tierAmount || "0") * parseFloat(tierMaintenancePct || "0") / 100).toLocaleString(undefined, { minimumFractionDigits: 0 })}</p>
                  <p>預警門檻：HK${(parseFloat(tierAmount || "0") * parseFloat(tierWarningPct || "0") / 100).toLocaleString(undefined, { minimumFractionDigits: 0 })}</p>
                  {tierCommissionRate && <p className="text-blue-700 font-medium">拍賣傭金率：{tierCommissionRate}%｜貨品傭金率：{tierProductCommissionRate}%</p>}
                </div>
              )}
              <div className="space-y-1">
                <Label className="text-xs">描述（選填）</Label>
                <Input value={tierDescription} onChange={e => setTierDescription(e.target.value)} placeholder="套餐說明" className="border-violet-200" />
              </div>
              <div className="flex items-center gap-3">
                <div className="space-y-1 flex-1">
                  <Label className="text-xs">排序</Label>
                  <Input type="number" value={tierSortOrder} onChange={e => setTierSortOrder(e.target.value)} className="border-violet-200" />
                </div>
                <div className="space-y-1 flex items-center gap-2 pt-5">
                  <Switch checked={tierIsActive} onCheckedChange={setTierIsActive} />
                  <Label className="text-xs">{tierIsActive ? "啟用" : "停用"}</Label>
                </div>
              </div>
              <Button onClick={saveTier} disabled={upsertTierMutation.isPending} className="w-full bg-violet-600 hover:bg-violet-700 text-white">
                {upsertTierMutation.isPending ? "儲存中…" : "儲存套餐"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* ── 充值申請 已遷移至商戶統一中心 ── */}
        <Card className="mb-6 border-amber-200 bg-amber-50/40">
          <CardContent className="py-3 flex items-center gap-3 flex-wrap">
            <Wallet className="w-5 h-5 text-amber-600" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-900">商戶保證金充值申請</p>
              <p className="text-xs text-amber-700">所有待審 / 已審核充值申請已遷移至「商戶統一審批中心」處理。</p>
            </div>
            <Link href="/admin/merchant-center?tab=topup">
              <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-white">前往商戶中心 →</Button>
            </Link>
          </CardContent>
        </Card>


        {/* Deposits List */}
        <Card className="mb-6 border-amber-100">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <DollarSign className="w-4 h-4 text-amber-600" />
              商戶保證金列表
            </CardTitle>
            <CardDescription>共 {deposits?.length ?? 0} 位商戶</CardDescription>
          </CardHeader>
          <CardContent>
            {!deposits || deposits.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">尚無商戶保證金記錄</p>
            ) : (
              <div className="space-y-3">
                {(deposits as DepositRow[]).map((deposit) => {
                  const balance = parseFloat(deposit.balance.toString());
                  const required = parseFloat(deposit.requiredDeposit.toString());
                  const rate = parseFloat(deposit.commissionRate.toString());
                  const sufficient = balance >= required;

                  return (
                    <div
                      key={deposit.id}
                      className={`p-4 rounded-lg border transition-colors ${
                        deposit.isActive ? (sufficient ? "border-green-200 bg-green-50/50" : "border-amber-200 bg-amber-50/50") : "border-red-200 bg-red-50/50"
                      }`}
                    >
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-3">
                          <div>
                            <div className="font-medium text-sm flex items-center gap-2">
                              {deposit.userName ?? `用戶 #${deposit.userId}`}
                              <Badge variant="outline" className="text-xs">
                                ID: {deposit.userId}
                              </Badge>
                              {deposit.isActive ? (
                                sufficient ? (
                                  <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">正常</Badge>
                                ) : (
                                  <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs">維持水平不足</Badge>
                                )
                              ) : (
                                <Badge className="bg-red-100 text-red-700 border-red-200 text-xs">已停用</Badge>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {deposit.userEmail ?? "無電郵"}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`text-lg font-bold ${sufficient ? "text-green-700" : "text-amber-700"}`}>
                            {formatCurrency(deposit.balance)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            需維持水平：{formatCurrency(deposit.requiredDeposit)} | 拍賣傭金：{(rate * 100).toFixed(2)}% | 貨品傭金：{deposit.productCommissionRate ? (parseFloat(deposit.productCommissionRate) * 100).toFixed(2) : (rate * 100).toFixed(2)}%
                          </div>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex gap-1.5 mt-3 flex-wrap">
                        <Button
                          variant="outline" size="sm"
                          className="text-green-600 border-green-200 hover:bg-green-50 text-xs h-7"
                          onClick={() => { setSelectedUserId(deposit.userId); setActionType("topUp"); }}
                        >
                          <Plus className="w-3 h-3 mr-0.5" /> 充值
                        </Button>
                        <Button
                          variant="outline" size="sm"
                          className="text-red-600 border-red-200 hover:bg-red-50 text-xs h-7"
                          onClick={() => { setSelectedUserId(deposit.userId); setActionType("deduct"); }}
                        >
                          <Minus className="w-3 h-3 mr-0.5" /> 扣佣金
                        </Button>
                        <Button
                          variant="outline" size="sm"
                          className="text-blue-600 border-blue-200 hover:bg-blue-50 text-xs h-7"
                          onClick={() => { setSelectedUserId(deposit.userId); setActionType("refund"); }}
                        >
                          <RefreshCw className="w-3 h-3 mr-0.5" /> 退還
                        </Button>
                        <Button
                          variant="outline" size="sm"
                          className="text-amber-600 border-amber-200 hover:bg-amber-50 text-xs h-7"
                          onClick={() => { setSelectedUserId(deposit.userId); setActionType("adjust"); }}
                        >
                          <DollarSign className="w-3 h-3 mr-0.5" /> 調整
                        </Button>
                        <Button
                          variant="outline" size="sm"
                          className="text-gray-600 border-gray-200 hover:bg-gray-50 text-xs h-7"
                          onClick={() => openSettings(deposit)}
                        >
                          <Settings className="w-3 h-3 mr-0.5" /> 設定
                        </Button>
                        <Button
                          variant="outline" size="sm"
                          className="text-purple-600 border-purple-200 hover:bg-purple-50 text-xs h-7"
                          onClick={() => { setTransactionUserId(deposit.userId); setShowTransactions(true); }}
                        >
                          <History className="w-3 h-3 mr-0.5" /> 記錄
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action Dialog */}
        <Dialog open={!!actionType && !!selectedUserId} onOpenChange={(open) => { if (!open) resetAction(); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {actionType === "topUp" && "充值保證金"}
                {actionType === "deduct" && "扣除佣金"}
                {actionType === "refund" && "退還佣金"}
                {actionType === "adjust" && "手動調整"}
                {actionType === "settings" && "保證金設定"}
                {selectedUserId && ` — 用戶 #${selectedUserId}`}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              {actionType === "settings" ? (
                <>
                  <div className="space-y-2">
                    <Label>最低保證金要求 (HK$)</Label>
                    <Input
                      type="number"
                      value={settingsRequiredDeposit}
                      onChange={(e) => setSettingsRequiredDeposit(e.target.value)}
                      placeholder="500.00"
                      className="border-amber-200"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>維持水平/預警門檻 (HK$) <span className="text-xs text-amber-500 ml-1">低於此值顯示警告</span></Label>
                    <Input
                      type="number"
                      value={settingsWarningDeposit}
                      onChange={(e) => setSettingsWarningDeposit(e.target.value)}
                      placeholder="1000.00"
                      className="border-amber-200"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-xs">拍賣傭金率 (%)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={settingsCommissionRate}
                        onChange={(e) => setSettingsCommissionRate(e.target.value)}
                        placeholder="5.00"
                        className="border-blue-200"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">貨品傭金率 (%)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={settingsProductCommissionRate}
                        onChange={(e) => setSettingsProductCommissionRate(e.target.value)}
                        placeholder="5.00"
                        className="border-emerald-200"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg border border-amber-200 bg-amber-50/50">
                    <div>
                      <Label className="text-sm font-medium">帳戶狀態</Label>
                      <p className="text-xs text-muted-foreground">停用後商戶無法上架商品</p>
                    </div>
                    <Switch
                      checked={settingsIsActive}
                      onCheckedChange={setSettingsIsActive}
                      className="data-[state=checked]:bg-green-500"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label>金額 (HK$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={actionAmount}
                      onChange={(e) => setActionAmount(e.target.value)}
                      placeholder={actionType === "adjust" ? "正數=增加，負數=扣除" : "0.00"}
                      className="border-amber-200"
                    />
                  </div>
                  {(actionType === "deduct" || actionType === "refund") && (
                    <div className="space-y-2">
                      <Label>相關拍賣編號</Label>
                      <Input
                        type="number"
                        value={actionAuctionId}
                        onChange={(e) => setActionAuctionId(e.target.value)}
                        placeholder="拍賣 ID"
                        className="border-amber-200"
                      />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>備註 {actionType === "adjust" && <span className="text-red-500">*</span>}</Label>
                    <Input
                      value={actionDescription}
                      onChange={(e) => setActionDescription(e.target.value)}
                      placeholder={actionType === "adjust" ? "必填：調整原因" : "選填"}
                      className="border-amber-200"
                    />
                  </div>
                </>
              )}
              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={resetAction} className="flex-1">取消</Button>
                <Button
                  onClick={handleAction}
                  disabled={isPending}
                  className="flex-1 gold-gradient text-white border-0"
                >
                  {isPending ? "處理中..." : "確認"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Transactions */}
        {showTransactions && (
          <Card className="border-purple-100">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <History className="w-4 h-4 text-purple-600" />
                  交易記錄
                  {transactionUserId && (
                    <Badge variant="outline" className="text-xs">用戶 #{transactionUserId}</Badge>
                  )}
                </CardTitle>
                <div className="flex gap-2">
                  {transactionUserId && (
                    <Button
                      variant="outline" size="sm"
                      onClick={() => setTransactionUserId(null)}
                      className="text-xs h-7"
                    >
                      查看全部
                    </Button>
                  )}
                  <Button
                    variant="outline" size="sm"
                    onClick={() => { setShowTransactions(false); setTransactionUserId(null); }}
                    className="text-xs h-7"
                  >
                    關閉
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isTxLoading ? (
                <p className="text-center text-muted-foreground py-4">載入中...</p>
              ) : !displayTransactions || displayTransactions.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">暫無交易記錄</p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {(displayTransactions as TransactionRow[]).map((tx) => {
                    const tl = typeLabel(tx.type);
                    const amount = parseFloat(tx.amount.toString());
                    return (
                      <div key={tx.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50/50 text-sm">
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className={`text-xs ${tl.cls}`}>{tl.text}</Badge>
                          <div>
                            <div className="font-medium text-xs">
                              {tx.description ?? tl.text}
                              {(tx as TransactionRow).userName && (
                                <span className="text-muted-foreground ml-1">({(tx as TransactionRow).userName})</span>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {formatDate(tx.createdAt)}
                              {tx.relatedAuctionId && ` | 拍賣 #${tx.relatedAuctionId}`}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`font-bold text-sm ${amount >= 0 ? "text-green-600" : "text-red-600"}`}>
                            {amount >= 0 ? "+" : ""}{formatCurrency(tx.amount)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            餘額：{formatCurrency(tx.balanceAfter)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <RefundRequestsDialog open={refundDialogOpen} onOpenChange={setRefundDialogOpen} />
    </div>
  );
}
