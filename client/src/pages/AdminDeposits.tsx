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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Wallet, Plus, Minus, RefreshCw, Settings, History, DollarSign, AlertCircle, CheckCircle2, XCircle, ChevronDown, ChevronUp, ImageIcon } from "lucide-react";

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
  const { user, isAuthenticated, loading } = useAuth();
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [actionType, setActionType] = useState<"topUp" | "deduct" | "refund" | "adjust" | "settings" | null>(null);
  const [actionAmount, setActionAmount] = useState("");
  const [actionDescription, setActionDescription] = useState("");
  const [actionAuctionId, setActionAuctionId] = useState("");
  const [settingsRequiredDeposit, setSettingsRequiredDeposit] = useState("");
  const [settingsWarningDeposit, setSettingsWarningDeposit] = useState("");
  const [settingsCommissionRate, setSettingsCommissionRate] = useState("");
  const [settingsIsActive, setSettingsIsActive] = useState(true);
  const [showTransactions, setShowTransactions] = useState(false);
  const [transactionUserId, setTransactionUserId] = useState<number | null>(null);
  const [addUserDialogOpen, setAddUserDialogOpen] = useState(false);
  const [newUserId, setNewUserId] = useState("");

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
      const updates: { requiredDeposit?: number; warningDeposit?: number; commissionRate?: number; isActive?: number } = {};
      if (settingsRequiredDeposit) updates.requiredDeposit = parseFloat(settingsRequiredDeposit);
      if (settingsWarningDeposit) updates.warningDeposit = parseFloat(settingsWarningDeposit);
      if (settingsCommissionRate) updates.commissionRate = parseFloat(settingsCommissionRate) / 100;
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

  const isPending = topUpMutation.isPending || deductMutation.isPending || refundMutation.isPending || adjustMutation.isPending || updateSettingsMutation.isPending;

  const displayTransactions = transactionUserId ? transactions : allTransactions;
  const isTxLoading = transactionUserId ? txLoading : allTxLoading;

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
              <Wallet className="w-4 h-4" /> 保證金管理
            </span>
          </div>
          <Badge className="bg-amber-600 text-white text-xs">管理員</Badge>
        </div>
      </nav>
      <div className="h-16" />

      <div className="container py-8 max-w-4xl">
        {/* Header with Add User button */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-amber-900 flex items-center gap-2">
              <Wallet className="w-5 h-5" /> 商戶保證金管理
            </h1>
            <p className="text-sm text-muted-foreground mt-1">管理商戶保證金餘額、佣金率及交易記錄</p>
          </div>
          <div className="flex gap-2">
            <Link href="/admin/refund-requests">
              <Button variant="outline" size="sm" className="border-orange-200 text-orange-600 hover:bg-orange-50">
                <AlertCircle className="w-4 h-4 mr-1" /> 退傭申請
              </Button>
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setShowTransactions(!showTransactions); setTransactionUserId(null); }}
              className="border-amber-200"
            >
              <History className="w-4 h-4 mr-1" />
              {showTransactions ? "隱藏交易記錄" : "所有交易記錄"}
            </Button>
            <Dialog open={addUserDialogOpen} onOpenChange={setAddUserDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gold-gradient text-white border-0">
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

        {/* Info Card */}
        <Card className="mb-6 border-blue-200 bg-blue-50">
          <CardContent className="py-4 px-5">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-semibold mb-1">保證金機制說明</p>
                <p className="text-blue-700">
                  商戶需繳納保證金才能上架商品。拍賣成交後，系統會根據佣金率從保證金中扣除佣金。
                  管理員可手動充值、扣除、退還或調整保證金餘額。
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── 商戶保證金充值申請 ── */}
        {(() => {
          const pending = (topUpRequests as TopUpRequestRow[] ?? []).filter((r: TopUpRequestRow) => r.status === 'pending');
          const reviewed = (topUpRequests as TopUpRequestRow[] ?? []).filter((r: TopUpRequestRow) => r.status !== 'pending');
          const fmtDate = (d: Date | string | null) => d ? new Date(d).toLocaleString("zh-HK", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";
          const bankLabel = (b: string | null) => b ? (PAYMENT_METHOD_LABELS[b] ?? b) : null;
          return (
            <Card className={`mb-6 ${pending.length > 0 ? "border-emerald-300" : "border-emerald-100"}`}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between text-base">
                  <span className="flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-emerald-600" />
                    商戶保證金充值申請
                    {pending.length > 0 && (
                      <span className="ml-1 inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold text-white" style={{ background: "#059669" }}>
                        {pending.length}
                      </span>
                    )}
                  </span>
                  <button type="button" onClick={() => setShowTopUpRequests(v => !v)} className="text-gray-400 hover:text-gray-600">
                    {showTopUpRequests ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                </CardTitle>
              </CardHeader>
              {showTopUpRequests && (
                <CardContent className="space-y-3">
                  {(topUpRequests ?? []).length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">暫無充值申請</p>
                  )}

                  {/* Pending */}
                  {pending.map((req: TopUpRequestRow) => (
                    <div key={req.id} className="rounded-xl p-3 space-y-2" style={{ background: "#F0FDF4", border: "1px solid #6EE7B7" }}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-0.5 min-w-0">
                          <p className="text-sm font-semibold text-gray-800">
                            {req.userName ?? `用戶 #${req.userId}`}
                            {req.userPhone && <span className="text-xs text-gray-400 ml-1.5">{req.userPhone}</span>}
                          </p>
                          <p className="text-lg font-bold text-emerald-700">HKD {parseFloat(String(req.amount)).toLocaleString()}</p>
                          {req.referenceNo && <p className="text-xs text-gray-500">參考號：<span className="font-mono font-semibold text-gray-700">{req.referenceNo}</span></p>}
                          {bankLabel(req.bank) && <p className="text-xs text-gray-500">付款方式：{bankLabel(req.bank)}</p>}
                          {req.note && <p className="text-xs text-gray-500">備注：{req.note}</p>}
                          <p className="text-xs text-gray-400">{fmtDate(req.createdAt)}</p>
                        </div>
                        <span className="text-xs font-medium border rounded-full px-2 py-0.5 bg-amber-50 text-amber-700 border-amber-200 flex-shrink-0">待審核</span>
                      </div>
                      {/* Receipt image */}
                      {req.receiptUrl && (
                        <div className="rounded-lg overflow-hidden border border-emerald-200 bg-gray-50">
                          <p className="text-xs font-medium text-gray-500 px-2 pt-2 pb-1 flex items-center gap-1">
                            <ImageIcon className="w-3 h-3" /> 付款收據
                          </p>
                          <a href={req.receiptUrl} target="_blank" rel="noopener noreferrer">
                            <img src={req.receiptUrl} alt="付款收據" className="w-full max-h-52 object-contain cursor-pointer hover:opacity-90 transition-opacity" />
                          </a>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <Input
                          placeholder="管理員備注（選填）"
                          value={reviewNotes[req.id] ?? ""}
                          onChange={e => setReviewNotes(n => ({ ...n, [req.id]: e.target.value }))}
                          className="h-8 text-xs flex-1"
                        />
                        <Button
                          size="sm"
                          onClick={() => reviewTopUpMutation.mutate({ id: req.id, status: 'approved', adminNote: reviewNotes[req.id] })}
                          disabled={reviewTopUpMutation.isPending}
                          className="h-8 px-3 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          <CheckCircle2 size={12} className="mr-1" /> 批准
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => reviewTopUpMutation.mutate({ id: req.id, status: 'rejected', adminNote: reviewNotes[req.id] })}
                          disabled={reviewTopUpMutation.isPending}
                          className="h-8 px-3 text-xs border-red-200 text-red-600 hover:bg-red-50"
                        >
                          <XCircle size={12} className="mr-1" /> 拒絕
                        </Button>
                      </div>
                    </div>
                  ))}

                  {/* Reviewed history */}
                  {reviewed.length > 0 && (
                    <details className="group">
                      <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600 list-none flex items-center gap-1 pt-1">
                        <ChevronDown size={12} className="group-open:rotate-180 transition-transform" />
                        過往記錄（{reviewed.length} 筆）
                      </summary>
                      <div className="mt-2 space-y-1.5">
                        {reviewed.map((req: TopUpRequestRow) => {
                          const s = req.status === 'approved'
                            ? { label: "已批准", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" }
                            : { label: "已拒絕", cls: "bg-red-50 text-red-600 border-red-200" };
                          return (
                            <div key={req.id} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-gray-700">{req.userName ?? `用戶 #${req.userId}`} — HKD {parseFloat(String(req.amount)).toLocaleString()}</p>
                                {req.referenceNo && <p className="text-xs text-gray-400">參考號：{req.referenceNo}</p>}
                                {bankLabel(req.bank) && <p className="text-xs text-gray-400">付款：{bankLabel(req.bank)}</p>}
                                <p className="text-xs text-gray-400">{fmtDate(req.createdAt)}</p>
                                {req.adminNote && <p className="text-xs text-gray-500 mt-0.5">備注：{req.adminNote}</p>}
                              </div>
                              <span className={`text-xs font-medium border rounded-full px-2 py-0.5 flex-shrink-0 ${s.cls}`}>{s.label}</span>
                            </div>
                          );
                        })}
                      </div>
                    </details>
                  )}
                </CardContent>
              )}
            </Card>
          );
        })()}

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
                                  <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs">餘額不足</Badge>
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
                            需維持水平：{formatCurrency(deposit.requiredDeposit)} | 佣金率：{(rate * 100).toFixed(2)}%
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
                    <Label>預警門檻 (HK$) <span className="text-xs text-amber-500 ml-1">低於此值顯示警告</span></Label>
                    <Input
                      type="number"
                      value={settingsWarningDeposit}
                      onChange={(e) => setSettingsWarningDeposit(e.target.value)}
                      placeholder="1000.00"
                      className="border-amber-200"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>佣金率 (%)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={settingsCommissionRate}
                      onChange={(e) => setSettingsCommissionRate(e.target.value)}
                      placeholder="5.00"
                      className="border-amber-200"
                    />
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
    </div>
  );
}
