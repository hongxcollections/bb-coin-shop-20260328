import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import Header from "@/components/Header";
import {
  ChevronLeft, Store, Wallet, Gavel, Clock, CheckCircle2, XCircle,
  AlertCircle, TrendingUp, ArrowUpRight, ArrowDownLeft, ShoppingBag, Settings,
  RotateCcw, Layers,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

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

  const { data: myApp, isLoading: loadingApp } = trpc.merchants.myApplication.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const { data: deposit, isLoading: loadingDeposit } = trpc.sellerDeposits.myDeposit.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const { data: auctions, isLoading: loadingAuctions } = trpc.merchants.myAuctions.useQuery(undefined, {
    enabled: isAuthenticated && myApp?.status === "approved",
  });
  const { data: txData } = trpc.merchants.myTransactions.useQuery(
    { limit: 10, offset: 0 },
    { enabled: isAuthenticated && myApp?.status === "approved" }
  );
  const { data: quotaInfo } = trpc.merchants.getQuotaInfo.useQuery(undefined, {
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
                <p className="text-xs text-gray-400">最低要求 {HKD(required)}</p>
              </>
            )}
          </div>
        </div>

        {/* Quota card (only shown if subscription has a quota) */}
        {quotaInfo && !quotaInfo.unlimited && (
          <div className={`rounded-2xl bg-white border p-4 flex items-center justify-between ${quotaInfo.remainingQuota <= 0 ? "border-red-200" : quotaInfo.remainingQuota <= 5 ? "border-amber-200" : "border-blue-100"}`}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${quotaInfo.remainingQuota <= 0 ? "bg-red-50" : quotaInfo.remainingQuota <= 5 ? "bg-amber-50" : "bg-blue-50"}`}>
                <Layers className={`w-5 h-5 ${quotaInfo.remainingQuota <= 0 ? "text-red-500" : quotaInfo.remainingQuota <= 5 ? "text-amber-500" : "text-blue-500"}`} />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">本期發佈次數</p>
                <p className="text-xs text-gray-400 mt-0.5">{quotaInfo.planName}</p>
              </div>
            </div>
            <div className="text-right">
              <p className={`text-2xl font-bold ${quotaInfo.remainingQuota <= 0 ? "text-red-600" : quotaInfo.remainingQuota <= 5 ? "text-amber-600" : "text-blue-600"}`}>
                {quotaInfo.remainingQuota}
              </p>
              <p className="text-xs text-gray-400">/ {quotaInfo.maxListings} 次</p>
            </div>
          </div>
        )}

        {/* Warning banners */}
        {!depositOk && deposit && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 flex items-start gap-2 text-sm text-red-600">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>保證金不足，請聯絡管理員補交以恢復刊登資格。</span>
          </div>
        )}
        {belowWarning && deposit && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 flex items-start gap-2 text-sm text-amber-700">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>保證金餘額低於預警門檻（{HKD(warningThreshold)}），建議盡快補交以避免帳戶受限。</span>
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
        </div>

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

        {/* ── 近期拍賣 ── */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-amber-600" />
              <h2 className="font-semibold text-amber-900 text-sm">我的拍賣</h2>
            </div>
            <Link href="/merchant-auctions">
              <span className="text-xs text-amber-600 hover:underline cursor-pointer">全部管理 →</span>
            </Link>
          </div>

          {loadingAuctions ? (
            <div className="text-sm text-gray-400 text-center py-6">載入中…</div>
          ) : !auctions || auctions.length === 0 ? (
            <div className="rounded-2xl bg-amber-50 border border-amber-100 p-6 text-center text-sm text-amber-600">
              暫無拍賣記錄
            </div>
          ) : (
            <div className="space-y-2">
              {auctions.slice(0, 5).map((a) => (
                <Link key={a.id} href={`/auction/${a.id}`}>
                  <div className="rounded-2xl bg-white border border-amber-100 px-4 py-3 hover:border-amber-300 transition-colors cursor-pointer">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-800 text-sm truncate">{a.title}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {a.status === "active"
                            ? `截止：${fmtDate(a.endTime)}`
                            : `結束：${fmtDate(a.endTime)}`}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <StatusBadge status={a.status} />
                        <p className="text-sm font-bold text-amber-700">{HKD(a.currentPrice)}</p>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
              {auctions.length > 5 && (
                <Link href="/merchant-auctions">
                  <p className="text-xs text-center text-amber-600 hover:underline cursor-pointer py-1">
                    查看全部 {auctions.length} 個拍賣 →
                  </p>
                </Link>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
