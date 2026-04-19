import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import Header from "@/components/Header";
import { useState } from "react";
import {
  ChevronLeft, Store, Wallet, Gavel, Clock, CheckCircle2, XCircle,
  AlertCircle, ArrowUpRight, ArrowDownLeft, ShoppingBag, Settings,
  RotateCcw, Layers, CreditCard, PlusCircle, Send, ChevronDown, Loader2,
  Upload, X, ImageIcon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const DEPOSIT_PAYMENT_METHODS = [
  { value: "bank_transfer", label: "銀行轉帳" },
  { value: "payme", label: "PayMe" },
  { value: "fps", label: "轉數快 FPS" },
  { value: "alipay_hk", label: "支付寶 HK" },
  { value: "wechat_pay", label: "微信支付" },
  { value: "cash", label: "現金" },
  { value: "other", label: "其他" },
];

function topUpStatusBadge(status: string) {
  switch (status) {
    case "pending": return { label: "待審核", cls: "bg-amber-100 text-amber-700 border-amber-200", icon: <Clock className="w-3 h-3" /> };
    case "approved": return { label: "已批准", cls: "bg-green-100 text-green-700 border-green-200", icon: <CheckCircle2 className="w-3 h-3" /> };
    case "rejected": return { label: "已拒絕", cls: "bg-red-100 text-red-600 border-red-200", icon: <XCircle className="w-3 h-3" /> };
    default: return { label: status, cls: "bg-gray-100 text-gray-700 border-gray-200", icon: null };
  }
}

const HKD = (v: string | number) =>
  `HK$${parseFloat(String(v)).toLocaleString("zh-HK", { minimumFractionDigits: 0 })}`;

function StatusBadge({ status }: { status: string }) {
  if (status === "active") return (
    <span className="inline-flex items-center gap-1 text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-2 py-0.5">
      <Clock className="w-3 h-3" /> 進行中
    </span>
  );
  if (status === "ended") return (
    <span className="inline-flex items-center gap-1 text-xs font-medium bg-gray-100 text-gray-500 border border-gray-200 rounded-full px-2 py-0.5">
      <CheckCircle2 className="w-3 h-3" /> 已結束
    </span>
  );
  if (status === "cancelled") return (
    <span className="inline-flex items-center gap-1 text-xs font-medium bg-red-50 text-red-500 border border-red-200 rounded-full px-2 py-0.5">
      <XCircle className="w-3 h-3" /> 已取消
    </span>
  );
  if (status === "draft") return (
    <span className="inline-flex items-center gap-1 text-xs font-medium bg-amber-50 text-amber-600 border border-amber-200 rounded-full px-2 py-0.5">
      草稿
    </span>
  );
  return <span className="text-xs text-gray-400">{status}</span>;
}

type TxType = { type: string; amount: string | number; description?: string | null; createdAt?: Date | string | null };

function TxRow({ tx }: { tx: TxType }) {
  const amt = parseFloat(String(tx.amount));
  const isIn = amt > 0;
  return (
    <div className="flex items-center gap-3 py-2.5 border-b last:border-0">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isIn ? "bg-emerald-50" : "bg-red-50"}`}>
        {isIn ? <ArrowDownLeft className="w-4 h-4 text-emerald-600" /> : <ArrowUpRight className="w-4 h-4 text-red-500" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 truncate">{tx.description ?? tx.type}</p>
        {tx.createdAt && (
          <p className="text-xs text-gray-400 mt-0.5">
            {new Date(tx.createdAt).toLocaleString("zh-HK", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
          </p>
        )}
      </div>
      <p className={`text-sm font-bold flex-shrink-0 ${isIn ? "text-emerald-600" : "text-red-500"}`}>
        {isIn ? "+" : ""}{HKD(amt)}
      </p>
    </div>
  );
}

export default function MerchantDashboard() {
  const { isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();

  // Top-up request form state
  const [showTopUpForm, setShowTopUpForm] = useState(false);
  const [showTopUpHistory, setShowTopUpHistory] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState("");
  const [topUpPaymentMethod, setTopUpPaymentMethod] = useState("");
  const [topUpRef, setTopUpRef] = useState("");
  const [topUpNote, setTopUpNote] = useState("");
  const [topUpReceiptUrl, setTopUpReceiptUrl] = useState("");
  const [topUpReceiptUploading, setTopUpReceiptUploading] = useState(false);

  const { data: myApp, isLoading: loadingApp } = trpc.merchants.myApplication.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const { data: deposit, isLoading: loadingDeposit } = trpc.sellerDeposits.myDeposit.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const { data: myTopUpRequests, refetch: refetchTopUpRequests } = trpc.sellerDeposits.myTopUpRequests.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const submitTopUp = trpc.sellerDeposits.submitTopUpRequest.useMutation({
    onSuccess: () => {
      toast.success("充值申請已提交，管理員確認後將更新餘額");
      setShowTopUpForm(false);
      setTopUpAmount(""); setTopUpPaymentMethod(""); setTopUpRef(""); setTopUpNote(""); setTopUpReceiptUrl("");
      refetchTopUpRequests();
    },
    onError: (err) => toast.error(err.message),
  });

  const { data: siteSettings } = trpc.siteSettings.getAll.useQuery();
  const ss = (siteSettings as Record<string, string> | undefined) ?? {};
  const depositPaymentInfo = ss["subscription_payment_methods"] ?? "";
  const depositWarningMessage = ss["depositWarningMessage"] ?? "保證金水平維持不足，可以自行申請保證金充值或者聯絡管理員補交, 以免影響商戶一切正常運作。";

  const uploadReceiptMutation = trpc.subscriptions.uploadPaymentProof.useMutation({
    onSuccess: ({ url }) => { setTopUpReceiptUrl(url); setTopUpReceiptUploading(false); toast.success("收據已上傳"); },
    onError: (err) => { setTopUpReceiptUploading(false); toast.error("上傳失敗：" + err.message); },
  });

  function handleReceiptFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setTopUpReceiptUploading(true);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = (ev.target?.result as string).split(",")[1];
      uploadReceiptMutation.mutate({ base64, filename: file.name });
    };
    reader.readAsDataURL(file);
  }

  const { data: auctions } = trpc.merchants.myAuctions.useQuery(undefined, {
    enabled: isAuthenticated && myApp?.status === "approved",
  });
  const { data: txData } = trpc.merchants.myTransactions.useQuery(
    { limit: 10, offset: 0 },
    { enabled: isAuthenticated && myApp?.status === "approved" }
  );
  const { data: quotaInfo } = trpc.merchants.getQuotaInfo.useQuery(undefined, {
    enabled: isAuthenticated && myApp?.status === "approved",
  });
  const { data: mySubscription } = trpc.subscriptions.mySubscription.useQuery(undefined, {
    enabled: isAuthenticated && myApp?.status === "approved",
  });

  const fmtDate = (d: Date | string | null) => d
    ? new Date(d).toLocaleString("zh-HK", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
    : "—";

  if (loading || loadingApp) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-4xl animate-spin">🪙</div>
    </div>
  );

  if (!isAuthenticated) {
    navigate("/login");
    return null;
  }

  if (myApp?.status !== "approved") {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="max-w-lg mx-auto px-4 pt-6 pb-24 text-center space-y-3">
          <AlertCircle className="w-10 h-10 text-amber-400 mx-auto" />
          <p className="font-semibold text-gray-700">你尚未成為商戶會員</p>
          <Link href="/merchant-apply" className="text-sm text-amber-600 underline">前往申請開通商戶</Link>
        </div>
      </div>
    );
  }

  const activeCount = auctions?.filter(a => a.status === "active").length ?? 0;
  const totalCount = auctions?.length ?? 0;
  const balance = deposit ? parseFloat(String(deposit.balance)) : 0;
  const required = deposit ? parseFloat(String(deposit.requiredDeposit)) : 500;
  const warningThreshold = deposit ? parseFloat(String((deposit as { warningDeposit?: string | number }).warningDeposit ?? "1000")) : 1000;
  const depositOk = balance >= required;
  const belowWarning = depositOk && balance < warningThreshold;
  const transactions = (txData ?? []) as TxType[];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="max-w-lg mx-auto px-4 pt-4 pb-28 space-y-4">

        {/* Back + title */}
        <div className="flex items-center gap-2">
          <Link href="/" className="p-1.5 rounded-xl hover:bg-amber-50 transition-colors">
            <ChevronLeft className="w-5 h-5 text-amber-700" />
          </Link>
          <h1 className="text-xl font-bold text-amber-900">商戶後台</h1>
        </div>

        {/* Merchant identity card */}
        <div className="rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 p-4 flex items-center gap-3">
          {myApp.merchantIcon ? (
            <img src={myApp.merchantIcon} alt="" className="w-14 h-14 rounded-xl object-cover border border-amber-200 flex-shrink-0" />
          ) : (
            <div className="w-14 h-14 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center flex-shrink-0">
              <Store className="w-7 h-7 text-amber-400" />
            </div>
          )}
          <div className="min-w-0">
            <p className="font-bold text-amber-900 truncate">{myApp.merchantName}</p>
            {myApp.contactName && <p className="text-sm text-amber-700">{myApp.contactName}</p>}
            <p className="text-xs text-amber-500 mt-0.5">📱 {myApp.whatsapp}</p>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white border border-amber-100 p-4 space-y-1">
            <div className="flex items-center gap-1.5 text-amber-600">
              <Gavel className="w-4 h-4" />
              <span className="text-xs font-medium">進行中拍賣</span>
            </div>
            <p className="text-2xl font-bold text-amber-900">{activeCount}</p>
            <p className="text-xs text-gray-400">共 {totalCount} 個</p>
          </div>
          <div className={`rounded-2xl bg-white border p-4 space-y-1 ${depositOk ? (belowWarning ? "border-amber-200" : "border-emerald-100") : "border-red-100"}`}>
            <div className={`flex items-center gap-1.5 ${depositOk ? (belowWarning ? "text-amber-500" : "text-emerald-600") : "text-red-500"}`}>
              <Wallet className="w-4 h-4" />
              <span className="text-xs font-medium">保證金餘額</span>
            </div>
            {loadingDeposit ? (
              <p className="text-sm text-gray-400">載入中…</p>
            ) : (
              <>
                <p className={`text-2xl font-bold ${depositOk ? (belowWarning ? "text-amber-600" : "text-emerald-700") : "text-red-600"}`}>{HKD(balance)}</p>
                <p className="text-xs text-gray-400">需維持水平 {HKD(required)}</p>
              </>
            )}
          </div>
        </div>

        {/* Quota card */}
        {quotaInfo && (
          <div className={`rounded-2xl bg-white border p-4 flex items-center justify-between ${
            quotaInfo.unlimited ? "border-blue-100" :
            quotaInfo.remainingQuota <= 0 ? "border-red-200" :
            quotaInfo.remainingQuota <= 5 ? "border-amber-200" : "border-blue-100"
          }`}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                quotaInfo.unlimited ? "bg-blue-50" :
                quotaInfo.remainingQuota <= 0 ? "bg-red-50" :
                quotaInfo.remainingQuota <= 5 ? "bg-amber-50" : "bg-blue-50"
              }`}>
                <Layers className={`w-5 h-5 ${
                  quotaInfo.unlimited ? "text-blue-500" :
                  quotaInfo.remainingQuota <= 0 ? "text-red-500" :
                  quotaInfo.remainingQuota <= 5 ? "text-amber-500" : "text-blue-500"
                }`} />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">本期發佈次數</p>
                <p className="text-xs text-gray-400 mt-0.5">{quotaInfo.planName}</p>
                {quotaInfo.endDate && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    有效至 {new Date(quotaInfo.endDate).toLocaleDateString("zh-HK", { year: "numeric", month: "2-digit", day: "2-digit" })}
                  </p>
                )}
              </div>
            </div>
            <div className="text-right">
              {quotaInfo.unlimited ? (
                <p className="text-sm font-semibold text-blue-600">無限制</p>
              ) : (
                <>
                  <p className={`text-2xl font-bold ${quotaInfo.remainingQuota <= 0 ? "text-red-600" : quotaInfo.remainingQuota <= 5 ? "text-amber-600" : "text-blue-600"}`}>
                    {quotaInfo.remainingQuota}
                  </p>
                  <p className="text-xs text-gray-400">/ {quotaInfo.maxListings} 次</p>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── 快速功能入口 ── */}
        <div className="grid grid-cols-2 gap-3">
          <Link href="/merchant-auctions">
            <div className="rounded-2xl bg-white border border-amber-100 p-4 flex items-center gap-3 hover:border-amber-300 hover:bg-amber-50/50 transition-colors cursor-pointer">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                <Gavel className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="font-semibold text-sm text-amber-900">拍賣管理</p>
                <p className="text-xs text-gray-400 mt-0.5">刊登 · 草稿 · 封存</p>
              </div>
            </div>
          </Link>
          <Link href="/merchant-orders">
            <div className="rounded-2xl bg-white border border-amber-100 p-4 flex items-center gap-3 hover:border-amber-300 hover:bg-amber-50/50 transition-colors cursor-pointer">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                <ShoppingBag className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="font-semibold text-sm text-gray-800">訂單管理</p>
                <p className="text-xs text-gray-400 mt-0.5">追蹤付款 · 交收</p>
              </div>
            </div>
          </Link>
          <Link href="/merchant-refund-requests">
            <div className="rounded-2xl bg-white border border-gray-100 p-4 flex items-center gap-3 hover:border-amber-300 hover:bg-amber-50/50 transition-colors cursor-pointer">
              <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center flex-shrink-0">
                <RotateCcw className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <p className="font-semibold text-sm text-gray-800">退傭申請</p>
                <p className="text-xs text-gray-400 mt-0.5">查看 · 新申請</p>
              </div>
            </div>
          </Link>
          <Link href="/merchant-settings">
            <div className="rounded-2xl bg-white border border-gray-100 p-4 flex items-center gap-3 hover:border-amber-300 hover:bg-amber-50/50 transition-colors cursor-pointer">
              <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                <Settings className="w-5 h-5 text-gray-500" />
              </div>
              <div>
                <p className="font-semibold text-sm text-gray-800">商戶管理</p>
                <p className="text-xs text-gray-400 mt-0.5">預設拍賣結束日期 · 時間設定</p>
              </div>
            </div>
          </Link>
          <Link href="/subscriptions">
            <div className="rounded-2xl bg-white border border-purple-100 p-4 flex items-center gap-3 hover:border-purple-300 hover:bg-purple-50/50 transition-colors cursor-pointer">
              <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center flex-shrink-0">
                <CreditCard className="w-5 h-5 text-purple-500" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-sm text-gray-800 truncate">訂閱計劃</p>
                <p className="text-xs text-gray-400 mt-0.5 truncate">
                  {mySubscription?.planName
                    ? `${mySubscription.planName}`
                    : "選擇月費計劃"}
                </p>
                {mySubscription && (
                  <p className={`text-xs font-semibold mt-0.5 ${
                    quotaInfo?.unlimited ? "text-green-600"
                    : quotaInfo && quotaInfo.remainingQuota <= 0 ? "text-red-600"
                    : quotaInfo && quotaInfo.remainingQuota <= 5 ? "text-amber-600"
                    : "text-blue-600"
                  }`}>
                    {quotaInfo?.unlimited
                      ? "無限制"
                      : quotaInfo
                        ? `${quotaInfo.remainingQuota} / ${quotaInfo.maxListings} 次`
                        : ""}
                  </p>
                )}
              </div>
            </div>
          </Link>
        </div>

        {/* ── 保證金警告提示 ── */}
        {!depositOk && deposit && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 flex items-start gap-2 text-sm text-red-600">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{depositWarningMessage}</span>
          </div>
        )}
        {belowWarning && deposit && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 flex items-start gap-2 text-sm text-amber-700">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>保證金餘額低於維持水平/預警門檻（{HKD(warningThreshold)}），建議盡快補交以避免帳戶受限。</span>
          </div>
        )}

        {/* ── 保證金充值申請 (moved above transactions) ── */}
        <Card className="rounded-2xl border-amber-100">
          <CardContent className="p-4 space-y-3">
            {/* ── Header row ── */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PlusCircle className="w-4 h-4 text-amber-600" />
                <h2 className="font-semibold text-amber-900 text-sm">保證金充值申請</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowTopUpForm(v => !v)}
                className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full transition-colors bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200"
              >
                <ChevronDown size={11} style={{ transform: showTopUpForm ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }} />
                {showTopUpForm ? "收起" : "提交申請"}
              </button>
            </div>

            {/* ── 提交表單 ── */}
            {showTopUpForm && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 space-y-4">
                {depositPaymentInfo && (
                  <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                    <p className="text-xs font-semibold text-blue-800 mb-1 flex items-center gap-1">
                      <CreditCard className="w-3 h-3" /> 付款資訊
                    </p>
                    <div className="text-xs text-blue-700 whitespace-pre-line leading-relaxed">{depositPaymentInfo}</div>
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-amber-900">充值金額 (HKD) *</Label>
                  <Input type="number" min="1" step="1" value={topUpAmount} onChange={e => setTopUpAmount(e.target.value)} placeholder="例如：500" className="border-amber-200 focus-visible:ring-amber-400 bg-white" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-amber-900">付款方式 *</Label>
                  <Select value={topUpPaymentMethod} onValueChange={setTopUpPaymentMethod}>
                    <SelectTrigger className="border-amber-200 bg-white"><SelectValue placeholder="選擇付款方式" /></SelectTrigger>
                    <SelectContent>{DEPOSIT_PAYMENT_METHODS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-amber-900">轉帳參考號（選填）</Label>
                  <Input value={topUpRef} onChange={e => setTopUpRef(e.target.value)} placeholder="例如：TXN123456" className="border-amber-200 focus-visible:ring-amber-400 bg-white" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-amber-900">付款收據截圖（選填）</Label>
                  {topUpReceiptUrl ? (
                    <div className="relative rounded-lg overflow-hidden border border-amber-200">
                      <img src={topUpReceiptUrl} alt="收據" className="w-full max-h-40 object-contain bg-gray-50" />
                      <button type="button" onClick={() => setTopUpReceiptUrl("")} className="absolute top-1 right-1 bg-white rounded-full p-0.5 shadow border border-gray-200 hover:bg-red-50">
                        <X className="w-3.5 h-3.5 text-gray-500" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-amber-200 rounded-lg p-4 cursor-pointer hover:bg-amber-50 transition-colors bg-white">
                      {topUpReceiptUploading ? <Loader2 className="w-5 h-5 animate-spin text-amber-500" /> : <><Upload className="w-5 h-5 text-amber-400" /><span className="text-xs text-amber-700">點擊上傳收據</span></>}
                      <input type="file" accept="image/*" className="hidden" onChange={handleReceiptFile} disabled={topUpReceiptUploading} />
                    </label>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-amber-900">備注（選填）</Label>
                  <Textarea value={topUpNote} onChange={e => setTopUpNote(e.target.value)} placeholder="如有其他說明" rows={2} className="border-amber-200 focus-visible:ring-amber-400 bg-white resize-none" />
                </div>
                <button
                  type="button"
                  disabled={submitTopUp.isPending || !topUpAmount || !topUpPaymentMethod}
                  onClick={() => {
                    const amount = parseFloat(topUpAmount);
                    if (isNaN(amount) || amount <= 0) return toast.error("請輸入有效金額");
                    if (!topUpPaymentMethod) return toast.error("請選擇付款方式");
                    submitTopUp.mutate({ amount, referenceNo: topUpRef || undefined, bank: topUpPaymentMethod, note: topUpNote || undefined, receiptUrl: topUpReceiptUrl || undefined });
                  }}
                  className="w-full flex items-center justify-center gap-2 h-10 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-opacity"
                  style={{ background: "linear-gradient(135deg, #d97706, #b45309)" }}
                >
                  {submitTopUp.isPending ? <><Loader2 size={14} className="animate-spin" />提交中…</> : <><Send size={14} />確認提交充值申請</>}
                </button>
              </div>
            )}

            {/* ── 過往充值記錄 ── */}
            {(myTopUpRequests?.length ?? 0) > 0 && (
              <div>
                <button type="button" onClick={() => setShowTopUpHistory(v => !v)} className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-800 font-medium transition-colors">
                  <ChevronDown size={13} style={{ transform: showTopUpHistory ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }} />
                  過往充值記錄（{myTopUpRequests?.length} 筆）
                </button>
                {showTopUpHistory && (
                  <div className="mt-2 space-y-2">
                    {myTopUpRequests?.map((r: { id: number; amount: string | number; referenceNo: string; bank: string | null; status: string; adminNote: string | null }) => {
                      const sb = topUpStatusBadge(r.status);
                      const pmLabel = DEPOSIT_PAYMENT_METHODS.find(m => m.value === r.bank)?.label ?? r.bank;
                      return (
                        <div key={r.id} className="rounded-xl border border-amber-100 bg-white px-3 py-2.5 flex items-start justify-between gap-2">
                          <div className="min-w-0 space-y-0.5">
                            <p className="text-sm font-bold text-amber-900">HKD {parseFloat(String(r.amount)).toLocaleString()}</p>
                            {pmLabel && <p className="text-xs text-gray-500">付款：{pmLabel}</p>}
                            {r.referenceNo && <p className="text-xs text-gray-400">參考號：{r.referenceNo}</p>}
                            {r.adminNote && <p className="text-xs text-gray-500 bg-gray-50 rounded px-2 py-0.5 mt-1">管理員：{r.adminNote}</p>}
                          </div>
                          <span className={`text-xs font-medium border rounded-full px-2 py-0.5 flex items-center gap-1 flex-shrink-0 ${sb.cls}`}>{sb.icon}{sb.label}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── 保證金交易記錄 ── */}
        <Card className="rounded-2xl border-amber-100">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-amber-600" />
                <h2 className="font-semibold text-amber-900 text-sm">保證金交易記錄</h2>
              </div>
              <span className="text-xs text-gray-400">最近 10 筆</span>
            </div>
            {transactions.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">暫無交易記錄</p>
            ) : (
              <div>
                {transactions.map((tx, i) => <TxRow key={i} tx={tx} />)}
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
