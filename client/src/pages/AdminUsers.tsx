import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import AdminHeader from "@/components/AdminHeader";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Users, Pencil, Trash2, Store, UserRound, ShieldAlert, ChevronDown, Gavel, Mail, KeyRound, CheckCircle2, Copy, Clock, XCircle, ChevronUp, UserPlus, Wrench, Loader2, PackagePlus, AlertTriangle, Wallet, Minus, Plus, Package } from "lucide-react";
import { toast } from "sonner";
import { MemberBadge, type MemberLevel } from "@/components/MemberBadge";

type UserRow = {
  id: number;
  name: string | null;
  email: string | null;
  phone: string | null;
  loginMethod: string | null;
  role: string | null;
  memberLevel: string | null;
  createdAt: Date | null;
  lastSignedIn: Date | null;
  depositId: number | null;
  depositBalance: string | null;
  requiredDeposit: string | null;
  commissionRate: string | null;
  depositIsActive: number | null;
  mustChangePassword: number | null;
  isBanned: number;
  wonCount: number;
  activeAuctionCount: number;
  activeProductCount: number;
  subscriptionEndDate: string | null;
  subscriptionQuota: number | null;
  merchantAppStatus: string | null;
};

/** 判斷某用戶是否真正商戶：以「已批准嘅商戶申請」為唯一準則，避免 sellerDeposits row 自動建立造成誤判 */
const isMerchantUser = (u: UserRow) => u.merchantAppStatus === "approved";

/** Expandable list of won auctions for a user — fetches on demand */
function WonAuctionsList({ userId }: { userId: number }) {
  const { data, isLoading } = trpc.users.getWonAuctions.useQuery({ userId });
  const fmt = (d: Date | null | string) => d ? new Date(d).toLocaleDateString("zh-HK", { year: "2-digit", month: "2-digit", day: "2-digit" }) : "—";
  const payLabel: Record<string, string> = { pending_payment: "待付款", paid: "已付款", delivered: "已交收" };

  if (isLoading) return <div className="text-xs text-gray-400 py-1 pl-1">載入中…</div>;
  if (!data || data.length === 0) return <div className="text-xs text-gray-400 py-1 pl-1">暫無中標記錄</div>;

  return (
    <div className="mt-2 space-y-1.5">
      {data.map((a) => (
        <div key={a.id} className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs" style={{ background: "#FFF8EC", border: "1px solid #F5E6C8" }}>
          <Gavel size={11} className="flex-shrink-0" style={{ color: "#C8860A" }} />
          <span className="flex-1 font-medium truncate" style={{ color: "#333" }}>{a.title}</span>
          <span className="flex-shrink-0 font-semibold" style={{ color: "#C8860A" }}>
            {a.currency} {parseFloat(a.currentPrice).toLocaleString()}
          </span>
          <span className="flex-shrink-0 text-gray-400">{fmt(a.endTime)}</span>
          {a.paymentStatus && (
            <span className="flex-shrink-0 px-1.5 py-0.5 rounded-full text-[0.6rem] font-semibold"
              style={{
                background: a.paymentStatus === "paid" ? "#D1FAE5" : a.paymentStatus === "delivered" ? "#DBEAFE" : "#FEF3C7",
                color: a.paymentStatus === "paid" ? "#065F46" : a.paymentStatus === "delivered" ? "#1E40AF" : "#92400E",
              }}>
              {payLabel[a.paymentStatus] ?? a.paymentStatus}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

/** Expandable list of seller orders for a merchant — fetches on demand */
type MerchantOrderRow = {
  id: number;
  title: string;
  currentPrice: string;
  currency: string;
  endTime: Date | string | null;
  paymentStatus: string | null;
  winnerName: string | null;
  winningAmount: string | null;
};

function MerchantOrdersList({ merchantUserId }: { merchantUserId: number }) {
  const { data, isLoading } = trpc.users.getMerchantOrders.useQuery({ merchantUserId });
  const fmt = (d: Date | null | string) => d ? new Date(d).toLocaleDateString("zh-HK", { year: "2-digit", month: "2-digit", day: "2-digit" }) : "—";
  const payLabel: Record<string, string> = { pending_payment: "待付款", paid: "已付款", delivered: "已交收" };

  if (isLoading) return <div className="text-xs text-gray-400 py-1 pl-1">載入中…</div>;
  if (!data || data.length === 0) return <div className="text-xs text-gray-400 py-1 pl-1">暫無已售訂單</div>;

  return (
    <div className="mt-2 space-y-1.5">
      {(data as MerchantOrderRow[]).map((a) => (
        <div key={a.id} className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs" style={{ background: "#F0FDF4", border: "1px solid #BBF7D0" }}>
          <Store size={11} className="flex-shrink-0" style={{ color: "#16A34A" }} />
          <span className="flex-1 font-medium truncate" style={{ color: "#333" }}>{a.title}</span>
          <span className="flex-shrink-0 font-semibold" style={{ color: "#16A34A" }}>
            {a.currency} {a.winningAmount ? parseFloat(a.winningAmount).toLocaleString() : parseFloat(a.currentPrice).toLocaleString()}
          </span>
          <span className="flex-shrink-0 text-gray-400">{fmt(a.endTime)}</span>
          {a.winnerName && (
            <span className="flex-shrink-0 text-gray-500 truncate max-w-[60px]">{a.winnerName}</span>
          )}
          <span className="flex-shrink-0 px-1.5 py-0.5 rounded-full text-[0.6rem] font-semibold"
            style={{
              background: a.paymentStatus === "paid" ? "#D1FAE5" : a.paymentStatus === "delivered" ? "#DBEAFE" : "#FEF3C7",
              color: a.paymentStatus === "paid" ? "#065F46" : a.paymentStatus === "delivered" ? "#1E40AF" : "#92400E",
            }}>
            {a.paymentStatus ? (payLabel[a.paymentStatus] ?? a.paymentStatus) : "待付款"}
          </span>
        </div>
      ))}
    </div>
  );
}

/** 會員/商戶全面統計總結面板 — 按需載入 */
function UserStatsPanel({ userId, isMerchant }: { userId: number; isMerchant: boolean }) {
  const { data, isLoading } = trpc.users.adminUserStats.useQuery({ userId });

  if (isLoading) return (
    <div className="flex items-center gap-2 text-xs text-gray-400 py-2 pl-1">
      <Loader2 size={12} className="animate-spin" />載入統計中…
    </div>
  );
  if (!data) return <div className="text-xs text-gray-400 py-1 pl-1">無法載入統計</div>;

  const fmtAmt = (n: number) => `HK$${n.toLocaleString("zh-HK", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  const fmtDate = (d: string | null | undefined) => d ? new Date(d).toLocaleDateString("zh-HK", { year: "numeric", month: "2-digit", day: "2-digit" }) : "—";

  const StatBox = ({ label, value, sub, color = "#6B7280" }: { label: string; value: string | number; sub?: string; color?: string }) => (
    <div className="rounded-lg px-3 py-2 flex flex-col gap-0.5" style={{ background: "#F9FAFB", border: "1px solid #E5E7EB" }}>
      <span className="text-[0.6rem] text-gray-400 leading-tight">{label}</span>
      <span className="font-bold text-sm leading-tight" style={{ color }}>{value}</span>
      {sub && <span className="text-[0.6rem] text-gray-400 leading-tight">{sub}</span>}
    </div>
  );

  return (
    <div className="mt-2 space-y-3">
      {/* 買家活動 */}
      <div>
        <p className="text-[0.65rem] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">📥 買家活動</p>
        <div className="grid grid-cols-3 gap-1.5">
          <StatBox label="參與拍賣" value={data.auctionsBidOn} color="#2563EB" />
          <StatBox label="成功得標" value={data.auctionsWon} color="#D97706" />
          <StatBox label="得標總金額" value={fmtAmt(data.auctionsWonTotal)} color="#D97706" />
        </div>
      </div>

      {/* 商戶 — 拍賣 */}
      {isMerchant && (
        <div>
          <p className="text-[0.65rem] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">🔨 商戶拍賣</p>
          <div className="grid grid-cols-3 gap-1.5">
            <StatBox label="拍賣總上架" value={data.auctionsTotal} color="#1D4ED8" />
            <StatBox label="進行中" value={data.auctionsActive} color="#059669" />
            <StatBox label="已結束" value={data.auctionsEnded} color="#6B7280" sub={`草稿 ${data.auctionsDraft}`} />
          </div>
          <div className="grid grid-cols-2 gap-1.5 mt-1.5">
            <StatBox label="拍賣成交金額" value={fmtAmt(data.auctionRevenue)} color="#B45309" />
            <StatBox label="佣金交易記錄" value={`${data.commissionTxCount} 筆`} color="#6B7280" />
          </div>
        </div>
      )}

      {/* 商戶 — 商品 */}
      {isMerchant && (
        <div>
          <p className="text-[0.65rem] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">📦 商戶商品</p>
          <div className="grid grid-cols-3 gap-1.5">
            <StatBox label="商品總上架" value={data.productsTotal} color="#1D4ED8" />
            <StatBox label="進行中" value={data.productsActive} color="#059669" />
            <StatBox label="已售出" value={data.productsSold} color="#D97706" />
          </div>
          {data.productRevenue > 0 && (
            <div className="mt-1.5">
              <StatBox label="商品成交金額" value={fmtAmt(data.productRevenue)} color="#B45309" />
            </div>
          )}
        </div>
      )}

      {/* 商戶 — 保證金 & 訂閱 */}
      {isMerchant && (
        <div>
          <p className="text-[0.65rem] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">💰 保證金 & 訂閱</p>
          <div className="grid grid-cols-2 gap-1.5">
            {data.deposit ? (
              <>
                <StatBox
                  label="保證金餘額"
                  value={fmtAmt(data.deposit.balance)}
                  color={data.deposit.balance < data.deposit.requiredDeposit ? "#DC2626" : "#059669"}
                  sub={`門檻 ${fmtAmt(data.deposit.requiredDeposit)}`}
                />
                <StatBox
                  label="佣金率"
                  value={`${(data.deposit.commissionRate * 100).toFixed(1)}%`}
                  color="#6B7280"
                  sub={data.deposit.isActive ? "商戶活躍" : "商戶停權"}
                />
              </>
            ) : (
              <StatBox label="保證金" value="未設置" color="#9CA3AF" />
            )}
          </div>
          {data.subscription ? (
            <div className="mt-1.5 rounded-lg px-3 py-2" style={{ background: "#F0FDF4", border: "1px solid #BBF7D0" }}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-700">✅ {data.subscription.planName}</span>
                <span className="text-[0.6rem] text-gray-500">到期：{fmtDate(data.subscription.endDate)}</span>
              </div>
              <span className="text-[0.6rem] text-gray-400">HK${data.subscription.monthlyPrice.toLocaleString()} / {data.subscription.billingCycle === 'yearly' ? '年' : '月'}</span>
            </div>
          ) : (
            <div className="mt-1.5 rounded-lg px-3 py-1.5" style={{ background: "#FFF7ED", border: "1px solid #FED7AA" }}>
              <span className="text-xs text-orange-600">無有效月費訂閱</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** 管理員為商戶生成測試草稿商品 */
function GenerateListingsPanel({ userId, userName }: { userId: number; userName: string }) {
  const [open, setOpen] = useState(false);
  const [countStr, setCountStr] = useState("5");
  const [lastResult, setLastResult] = useState<number | null>(null);

  const parsedCount = Math.max(1, Math.min(50, parseInt(countStr) || 1));
  const isValid = /^\d+$/.test(countStr) && parsedCount >= 1 && parsedCount <= 50;

  const generateMutation = trpc.auctions.adminGenerateTestListings.useMutation({
    onSuccess: (data) => {
      setLastResult(data.created);
      toast.success(`已為 ${userName} 生成 ${data.created} 個測試草稿`);
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="mt-1.5">
      <button
        type="button"
        onClick={() => { setOpen(!open); setLastResult(null); }}
        className="flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium transition-colors whitespace-nowrap"
        style={{ background: open ? "#EDE9FE" : "#F5F5F5", color: open ? "#6D28D9" : "#666" }}
      >
        <Wrench size={10} />
        生成測試草稿
        <ChevronDown size={11} style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.15s" }} />
      </button>

      {open && (
        <div className="mt-1.5 rounded-xl p-3 space-y-2.5" style={{ background: "#F5F3FF", border: "1px solid #C4B5FD" }}>
          {/* Header */}
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: "#7C3AED" }}>
              <PackagePlus size={11} className="text-white" />
            </div>
            <span className="text-xs font-semibold" style={{ color: "#5B21B6" }}>生成測試草稿</span>
            <span className="text-xs text-gray-400 ml-auto">標題帶【測試】前綴</span>
          </div>

          {/* Count row */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 flex-shrink-0">生成數量</span>
            <input
              type="number"
              min={1}
              max={50}
              value={countStr}
              onChange={(e) => { setCountStr(e.target.value); setLastResult(null); }}
              onBlur={() => setCountStr(String(parsedCount))}
              className="w-14 h-8 rounded-lg border text-center text-sm font-semibold focus:outline-none focus:ring-2"
              style={{
                borderColor: isValid ? "#A78BFA" : "#FCA5A5",
                color: "#5B21B6",
                background: "#fff",
                boxShadow: "inset 0 1px 3px rgba(0,0,0,0.06)",
              }}
            />
            <span className="text-xs text-gray-400">件（1–50）</span>
          </div>

          {/* Generate button */}
          <button
            type="button"
            disabled={generateMutation.isPending || !isValid}
            onClick={() => generateMutation.mutate({ merchantUserId: userId, count: parsedCount })}
            className="w-full flex items-center justify-center gap-1.5 h-8 rounded-lg text-xs font-semibold text-white transition-opacity disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, #7C3AED, #6D28D9)" }}
          >
            {generateMutation.isPending
              ? <><Loader2 size={12} className="animate-spin" />生成中…</>
              : <><span>⚡</span>立即生成 {isValid ? parsedCount : ""} 個草稿</>}
          </button>

          {/* Result */}
          {lastResult !== null && (
            <div className="flex items-center gap-1.5 rounded-lg px-2.5 py-2" style={{ background: "#D1FAE5", border: "1px solid #6EE7B7" }}>
              <CheckCircle2 size={13} style={{ color: "#059669", flexShrink: 0 }} />
              <span className="text-xs font-medium" style={{ color: "#065F46" }}>
                成功建立 {lastResult} 個草稿，可在商戶拍賣管理查看
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** 管理員為商戶自動生成固定價格出售商品 */
function GenerateProductsPanel({ userId, userName }: { userId: number; userName: string }) {
  const [open, setOpen] = useState(false);
  const [countStr, setCountStr] = useState("5");
  const [lastResult, setLastResult] = useState<number | null>(null);

  const parsedCount = Math.max(1, Math.min(50, parseInt(countStr) || 1));
  const isValid = /^\d+$/.test(countStr) && parsedCount >= 1 && parsedCount <= 50;

  const generateMutation = trpc.merchants.adminGenerateProducts.useMutation({
    onSuccess: (data) => {
      setLastResult(data.created);
      toast.success(`已為 ${userName} 生成 ${data.created} 個出售商品`);
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="mt-1.5">
      <button
        type="button"
        onClick={() => { setOpen(!open); setLastResult(null); }}
        className="flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium transition-colors whitespace-nowrap"
        style={{ background: open ? "#DCFCE7" : "#F5F5F5", color: open ? "#15803D" : "#666" }}
      >
        <Package size={10} />
        生成出售商品
        <ChevronDown size={11} style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.15s" }} />
      </button>

      {open && (
        <div className="mt-1.5 rounded-xl p-3 space-y-2.5" style={{ background: "#F0FDF4", border: "1px solid #86EFAC" }}>
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: "#16A34A" }}>
              <Package size={11} className="text-white" />
            </div>
            <span className="text-xs font-semibold" style={{ color: "#15803D" }}>自動生成出售商品</span>
            <span className="text-xs text-gray-400 ml-auto">標題帶【測試】前綴</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 flex-shrink-0">生成數量</span>
            <input
              type="number"
              min={1}
              max={50}
              value={countStr}
              onChange={(e) => { setCountStr(e.target.value); setLastResult(null); }}
              onBlur={() => setCountStr(String(parsedCount))}
              className="w-14 h-8 rounded-lg border text-center text-sm font-semibold focus:outline-none focus:ring-2"
              style={{
                borderColor: isValid ? "#86EFAC" : "#FCA5A5",
                color: "#15803D",
                background: "#fff",
                boxShadow: "inset 0 1px 3px rgba(0,0,0,0.06)",
              }}
            />
            <span className="text-xs text-gray-400">件（1–50）</span>
          </div>

          <button
            type="button"
            disabled={generateMutation.isPending || !isValid}
            onClick={() => generateMutation.mutate({ merchantUserId: userId, count: parsedCount })}
            className="w-full flex items-center justify-center gap-1.5 h-8 rounded-lg text-xs font-semibold text-white transition-opacity disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, #16A34A, #15803D)" }}
          >
            {generateMutation.isPending
              ? <><Loader2 size={12} className="animate-spin" />生成中…</>
              : <><span>🛍️</span>立即生成 {isValid ? parsedCount : ""} 個商品</>}
          </button>

          {lastResult !== null && (
            <div className="flex items-center gap-1.5 rounded-lg px-2.5 py-2" style={{ background: "#D1FAE5", border: "1px solid #6EE7B7" }}>
              <CheckCircle2 size={13} style={{ color: "#059669", flexShrink: 0 }} />
              <span className="text-xs font-medium" style={{ color: "#065F46" }}>
                成功建立 {lastResult} 個商品，可在商戶市集查看
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** 管理員為商戶生成拍賣結果（從該商戶出售商品隨機抽取，中標者為隨機生成名字） */
function GenerateWonAuctionPanel({ userId, userName }: { userId: number; userName: string }) {
  const [open, setOpen] = useState(false);
  const [countStr, setCountStr] = useState("1");
  const count = Math.min(30, Math.max(1, parseInt(countStr, 10) || 1));
  const [results, setResults] = useState<{ auctionId: number; winningPrice: number; title: string; winnerName: string }[]>([]);

  const genMutation = trpc.auctions.adminGenerateAuctionResult.useMutation({
    onSuccess: (data) => {
      setResults(data.items);
      toast.success(`已生成 ${data.count} 個拍賣結果`);
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="mt-1.5">
      <button
        type="button"
        onClick={() => { setOpen(!open); setResults([]); }}
        className="flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium transition-colors whitespace-nowrap"
        style={{ background: open ? "#FEF3C7" : "#F5F5F5", color: open ? "#92400E" : "#666" }}
      >
        <Gavel size={10} />
        生成拍賣結果
        <ChevronDown size={11} style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.15s" }} />
      </button>

      {open && (
        <div className="mt-1.5 rounded-xl p-3 space-y-2.5" style={{ background: "#FFFBEB", border: "1px solid #FCD34D" }}>
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: "#D97706" }}>
              <Gavel size={11} className="text-white" />
            </div>
            <span className="text-xs font-semibold" style={{ color: "#92400E" }}>生成拍賣結果</span>
            <span className="text-xs text-gray-400 ml-auto">商戶：{userName}</span>
          </div>
          <p className="text-xs text-amber-700">
            隨機抽取 <strong>{userName}</strong> 的出售商品，中標價與商品售價相同，中標會員為系統隨機生成名字。
          </p>

          {/* Count input */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-amber-800 flex-shrink-0">生成數目：</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCountStr(String(Math.max(1, count - 1)))}
                disabled={count <= 1}
                className="w-6 h-6 rounded flex items-center justify-center text-sm font-bold transition-colors disabled:opacity-30"
                style={{ background: "#FDE68A", color: "#92400E" }}
              >−</button>
              <input
                type="number"
                min={1}
                max={30}
                value={countStr}
                onChange={(e) => setCountStr(e.target.value)}
                onBlur={() => setCountStr(String(count))}
                className="w-12 h-6 rounded border text-center text-xs font-semibold focus:outline-none"
                style={{ borderColor: "#FCD34D", color: "#92400E" }}
              />
              <button
                type="button"
                onClick={() => setCountStr(String(Math.min(30, count + 1)))}
                disabled={count >= 30}
                className="w-6 h-6 rounded flex items-center justify-center text-sm font-bold transition-colors disabled:opacity-30"
                style={{ background: "#FDE68A", color: "#92400E" }}
              >+</button>
            </div>
            <span className="text-xs text-gray-400">（最多 30 個）</span>
          </div>

          <button
            type="button"
            disabled={genMutation.isPending}
            onClick={() => { setResults([]); genMutation.mutate({ merchantUserId: userId, count }); }}
            className="w-full flex items-center justify-center gap-1.5 h-8 rounded-lg text-xs font-semibold text-white transition-opacity disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, #D97706, #B45309)" }}
          >
            {genMutation.isPending
              ? <><Loader2 size={12} className="animate-spin" />生成中…</>
              : <><span>🏆</span>立即生成 {count} 個拍賣結果</>}
          </button>

          {results.length > 0 && (
            <div className="rounded-lg overflow-hidden" style={{ border: "1px solid #6EE7B7" }}>
              <div className="flex items-center gap-1.5 px-2.5 py-1.5" style={{ background: "#D1FAE5" }}>
                <CheckCircle2 size={13} style={{ color: "#059669" }} />
                <span className="text-xs font-semibold" style={{ color: "#065F46" }}>已生成 {results.length} 個結標記錄</span>
              </div>
              <div className="max-h-36 overflow-y-auto divide-y" style={{ divideColor: "#A7F3D0" }}>
                {results.map((r) => (
                  <div key={r.auctionId} className="px-2.5 py-1.5 text-xs" style={{ background: "#ECFDF5", color: "#065F46" }}>
                    <span className="font-medium">#{r.auctionId}</span> {r.title.replace("【測試結標】", "")}
                    {" "}— HKD ${r.winningPrice.toLocaleString()} · {r.winnerName}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** 管理員帳號：一鍵清除自己名下的拍賣紀錄 / 出售商品 */
function AdminSelfClearPanel({ userName }: { userName: string }) {
  const [openAuctions, setOpenAuctions] = useState(false);
  const [openProducts, setOpenProducts] = useState(false);
  const [confirmedAuctions, setConfirmedAuctions] = useState(false);
  const [confirmedProducts, setConfirmedProducts] = useState(false);
  const utils = trpc.useUtils();

  const clearAuctionsMutation = trpc.users.adminClearOwnAuctions.useMutation({
    onSuccess: (data) => {
      const n = data.deletedAuctions ?? 0;
      if (n === 0) {
        toast("未找到可清除的拍賣紀錄", { icon: "ℹ️" });
      } else {
        toast.success(`已清除 ${n} 個拍賣紀錄，頁面將重新載入…`);
      }
      setOpenAuctions(false); setConfirmedAuctions(false);
      setTimeout(() => window.location.reload(), 1200);
    },
    onError: (err) => {
      toast.error(`清除失敗：${err.message}`);
      setConfirmedAuctions(false);
    },
  });

  const clearProductsMutation = trpc.users.adminClearOwnProducts.useMutation({
    onSuccess: (data) => {
      toast.success(`已清除 ${data.deleted} 件出售商品，頁面將重新載入…`);
      setOpenProducts(false); setConfirmedProducts(false);
      setTimeout(() => window.location.reload(), 1200);
    },
    onError: (err) => {
      toast.error(`清除失敗：${err.message}`);
      setConfirmedProducts(false);
    },
  });

  return (
    <div className="mt-2 space-y-1.5">
      {/* ── 清除拍賣紀錄 ── */}
      <div>
        <button
          type="button"
          onClick={() => { setOpenAuctions(!openAuctions); setConfirmedAuctions(false); }}
          className="flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium transition-colors whitespace-nowrap"
          style={{ background: openAuctions ? "#FEE2E2" : "#F5F5F5", color: openAuctions ? "#991B1B" : "#666" }}
        >
          <Trash2 size={10} />
          一鍵清除所有拍賣紀錄
          <ChevronDown size={11} style={{ transform: openAuctions ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.15s" }} />
        </button>
        {openAuctions && (
          <div className="mt-1.5 rounded-xl p-3 space-y-2" style={{ background: "#FFF5F5", border: "1px solid #FCA5A5" }}>
            <p className="text-xs text-red-700">清除 <strong>{userName}</strong> 名下所有拍賣、出價紀錄及相關圖片（不可復原）</p>
            {!confirmedAuctions ? (
              <button
                type="button"
                onClick={() => setConfirmedAuctions(true)}
                className="w-full h-7 rounded-lg text-xs font-semibold text-white"
                style={{ background: "#DC2626" }}
              >確認清除</button>
            ) : (
              <button
                type="button"
                disabled={clearAuctionsMutation.isPending}
                onClick={() => clearAuctionsMutation.mutate()}
                className="w-full h-7 rounded-lg text-xs font-semibold text-white flex items-center justify-center gap-1 disabled:opacity-50"
                style={{ background: "#991B1B" }}
              >
                {clearAuctionsMutation.isPending ? <><Loader2 size={12} className="animate-spin" />清除中…</> : "⚠️ 確認！永久刪除全部拍賣"}
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── 清除出售商品 ── */}
      <div>
        <button
          type="button"
          onClick={() => { setOpenProducts(!openProducts); setConfirmedProducts(false); }}
          className="flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium transition-colors whitespace-nowrap"
          style={{ background: openProducts ? "#FEE2E2" : "#F5F5F5", color: openProducts ? "#991B1B" : "#666" }}
        >
          <Package size={10} />
          一鍵清除所有出售商品
          <ChevronDown size={11} style={{ transform: openProducts ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.15s" }} />
        </button>
        {openProducts && (
          <div className="mt-1.5 rounded-xl p-3 space-y-2" style={{ background: "#FFF5F5", border: "1px solid #FCA5A5" }}>
            <p className="text-xs text-red-700">清除 <strong>{userName}</strong> 名下所有出售商品紀錄（不可復原）</p>
            {!confirmedProducts ? (
              <button
                type="button"
                onClick={() => setConfirmedProducts(true)}
                className="w-full h-7 rounded-lg text-xs font-semibold text-white"
                style={{ background: "#DC2626" }}
              >確認清除</button>
            ) : (
              <button
                type="button"
                disabled={clearProductsMutation.isPending}
                onClick={() => clearProductsMutation.mutate()}
                className="w-full h-7 rounded-lg text-xs font-semibold text-white flex items-center justify-center gap-1 disabled:opacity-50"
                style={{ background: "#991B1B" }}
              >
                {clearProductsMutation.isPending ? <><Loader2 size={12} className="animate-spin" />清除中…</> : "⚠️ 確認！永久刪除全部商品"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** 管理員直接修改商戶保證金（充值 / 調整） */
function DepositModifyPanel({ userId, currentBalance, onDone }: { userId: number; currentBalance: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"topup" | "adjust">("topup");
  const [amount, setAmount] = useState("");
  const [desc, setDesc] = useState("");

  const topUpMutation = trpc.sellerDeposits.topUp.useMutation({
    onSuccess: (data) => {
      toast.success(`充值成功，新餘額：HK$${data.newBalance.toFixed(2)}`);
      setAmount(""); setDesc(""); onDone();
    },
    onError: (err) => toast.error(err.message),
  });

  const adjustMutation = trpc.sellerDeposits.adjust.useMutation({
    onSuccess: () => {
      toast.success("調整成功");
      setAmount(""); setDesc(""); onDone();
    },
    onError: (err) => toast.error(err.message),
  });

  const isPending = topUpMutation.isPending || adjustMutation.isPending;
  const balance = parseFloat(currentBalance || "0");
  const isTopUp = tab === "topup";

  function handleSubmit() {
    const n = parseFloat(amount);
    if (isNaN(n) || n === 0) return toast.error("請輸入有效金額");
    if (!desc.trim()) return toast.error("請填寫說明");
    if (isTopUp) {
      if (n <= 0) return toast.error("充值金額必須大於 0");
      topUpMutation.mutate({ userId, amount: n, description: desc });
    } else {
      adjustMutation.mutate({ userId, amount: n, description: desc });
    }
  }

  return (
    <div className="mt-1.5">
      <button
        type="button"
        onClick={() => { setOpen(!open); setAmount(""); setDesc(""); }}
        className="flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium transition-colors whitespace-nowrap"
        style={{ background: open ? "#DBEAFE" : "#F5F5F5", color: open ? "#1E40AF" : "#666" }}
      >
        <Wallet size={10} />
        修改保證金
        <ChevronDown size={11} style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.15s" }} />
      </button>

      {open && (
        <div className="mt-1.5 rounded-xl p-3 space-y-2.5" style={{ background: "#EFF6FF", border: "1px solid #BFDBFE" }}>
          {/* Header + balance */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: "#2563EB" }}>
                <Wallet size={11} className="text-white" />
              </div>
              <span className="text-xs font-semibold text-blue-900">修改商戶保證金</span>
            </div>
            <span className="text-xs text-blue-600 font-medium">現有：HK${balance.toLocaleString()}</span>
          </div>

          {/* Tab switcher */}
          <div className="flex rounded-lg overflow-hidden border border-blue-200 text-xs font-medium">
            <button
              type="button"
              onClick={() => { setTab("topup"); setAmount(""); }}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 transition-colors"
              style={{ background: isTopUp ? "#2563EB" : "#EFF6FF", color: isTopUp ? "#fff" : "#3B82F6" }}
            >
              <Plus size={11} /> 充值
            </button>
            <button
              type="button"
              onClick={() => { setTab("adjust"); setAmount(""); }}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 transition-colors"
              style={{ background: !isTopUp ? "#2563EB" : "#EFF6FF", color: !isTopUp ? "#fff" : "#3B82F6" }}
            >
              <Minus size={11} /> 調整
            </button>
          </div>

          <div className="space-y-2">
            <div>
              <label className="text-xs font-medium text-blue-800 block mb-1">
                {isTopUp ? "充值金額 (HKD)" : "調整金額（正數增加 / 負數扣減）"}
              </label>
              <input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder={isTopUp ? "例如：500" : "例如：-200 或 300"}
                step={isTopUp ? "1" : "any"}
                min={isTopUp ? "1" : undefined}
                className="w-full h-8 rounded-lg border border-blue-200 px-2.5 text-xs focus:outline-none focus:border-blue-400"
              />
              {!isTopUp && amount && !isNaN(parseFloat(amount)) && (
                <p className="text-xs mt-0.5" style={{ color: parseFloat(amount) >= 0 ? "#059669" : "#DC2626" }}>
                  調整後餘額：HK${(balance + parseFloat(amount)).toLocaleString("zh-HK", { minimumFractionDigits: 0 })}
                </p>
              )}
              {isTopUp && amount && !isNaN(parseFloat(amount)) && parseFloat(amount) > 0 && (
                <p className="text-xs mt-0.5 text-emerald-600">
                  充值後餘額：HK${(balance + parseFloat(amount)).toLocaleString("zh-HK", { minimumFractionDigits: 0 })}
                </p>
              )}
            </div>
            <div>
              <label className="text-xs font-medium text-blue-800 block mb-1">說明 *</label>
              <input
                type="text"
                value={desc}
                onChange={e => setDesc(e.target.value)}
                placeholder={isTopUp ? "例如：商戶補交保證金" : "例如：手動修正餘額"}
                className="w-full h-8 rounded-lg border border-blue-200 px-2.5 text-xs focus:outline-none focus:border-blue-400"
              />
            </div>
          </div>

          <button
            type="button"
            disabled={isPending || !amount || !desc}
            onClick={handleSubmit}
            className="w-full flex items-center justify-center gap-1.5 h-8 rounded-lg text-xs font-semibold text-white transition-opacity disabled:opacity-40"
            style={{ background: "linear-gradient(135deg, #2563EB, #1D4ED8)" }}
          >
            {isPending
              ? <><Loader2 size={12} className="animate-spin" />處理中…</>
              : isTopUp
              ? <><Plus size={12} />確認充值</>
              : <><Wallet size={12} />確認調整</>}
          </button>
        </div>
      )}
    </div>
  );
}

/** 管理員清除商戶所有出售商品 */
function ClearProductsPanel({ userId, userName }: { userId: number; userName: string }) {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [result, setResult] = useState<{ deleted: number } | null>(null);
  const utils = trpc.useUtils();

  const clearMutation = trpc.merchants.adminClearMerchantProducts.useMutation({
    onSuccess: (data) => {
      setResult(data);
      setConfirmText("");
      toast.success(`已清除 ${userName} 的 ${data.deleted} 件出售商品`);
      utils.merchants.listProducts.invalidate();
      utils.merchants.listApprovedMerchants.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const isConfirmed = confirmText.trim() === userName.trim();

  return (
    <div className="mt-1.5">
      <button
        type="button"
        onClick={() => { setOpen(!open); setConfirmText(""); setResult(null); }}
        className="flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium transition-colors whitespace-nowrap"
        style={{ background: open ? "#FEF3C7" : "#F5F5F5", color: open ? "#92400E" : "#666" }}
      >
        <Package size={10} />
        清除所有出售商品
        <ChevronDown size={11} style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.15s" }} />
      </button>

      {open && (
        <div className="mt-1.5 rounded-xl p-3 space-y-2.5" style={{ background: "#FFFBEB", border: "1px solid #FCD34D" }}>
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: "#D97706" }}>
              <Package size={11} className="text-white" />
            </div>
            <span className="text-xs font-semibold" style={{ color: "#92400E" }}>清除商戶所有出售商品</span>
            <span className="text-xs text-gray-400 ml-auto">不可復原</span>
          </div>

          <div className="rounded-lg p-2.5 text-xs space-y-1" style={{ background: "#FEF3C7", border: "1px solid #FDE68A" }}>
            <p className="font-semibold" style={{ color: "#92400E" }}>以下數據將永久刪除：</p>
            <ul className="list-disc list-inside space-y-0.5 text-amber-800">
              <li>此商戶在商戶市集上架的<strong>所有出售商品</strong></li>
              <li>包括上架中、已下架及已售出的商品</li>
            </ul>
            <p className="text-amber-700 mt-1">拍賣相關數據不受影響。用戶帳號本身將保留。</p>
          </div>

          <div className="space-y-1">
            <p className="text-xs text-gray-600">輸入用戶名稱 <strong>「{userName}」</strong> 以確認：</p>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={userName}
              className="w-full h-8 rounded-lg border px-2 text-xs focus:outline-none focus:ring-2"
              style={{ borderColor: isConfirmed ? "#D97706" : "#D1D5DB" }}
            />
          </div>

          <button
            type="button"
            disabled={!isConfirmed || clearMutation.isPending}
            onClick={() => clearMutation.mutate({ merchantUserId: userId })}
            className="w-full flex items-center justify-center gap-1.5 h-8 rounded-lg text-xs font-semibold text-white transition-opacity disabled:opacity-40"
            style={{ background: "linear-gradient(135deg, #D97706, #B45309)" }}
          >
            {clearMutation.isPending
              ? <><Loader2 size={12} className="animate-spin" />清除中…</>
              : <><Trash2 size={12} />確認清除所有出售商品</>}
          </button>

          {result && (
            <div className="rounded-lg p-2 text-xs text-center font-medium" style={{ background: "#D1FAE5", color: "#065F46" }}>
              ✅ 已成功清除 {result.deleted} 件出售商品
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** 管理員清空商戶所有拍賣相關數據（保留帳號本身） */
function PurgeMerchantDataPanel({ userId, userName, onDone }: { userId: number; userName: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [result, setResult] = useState<{ deletedAuctions: number; deletedBids: number; deletedImages: number; deletedExternalBids: number } | null>(null);

  const purgeMutation = trpc.users.adminPurgeMerchantData.useMutation({
    onSuccess: (data) => {
      setResult(data);
      setConfirmText("");
      toast.success(`已清空 ${userName} 的拍賣數據`);
      onDone();
    },
    onError: (err) => toast.error(err.message),
  });

  const isConfirmed = confirmText.trim() === userName.trim();

  return (
    <div className="mt-1.5">
      <button
        type="button"
        onClick={() => { setOpen(!open); setConfirmText(""); setResult(null); }}
        className="flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium transition-colors whitespace-nowrap"
        style={{ background: open ? "#FEE2E2" : "#F5F5F5", color: open ? "#991B1B" : "#666" }}
      >
        <AlertTriangle size={10} />
        清空拍賣數據
        <ChevronDown size={11} style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.15s" }} />
      </button>

      {open && (
        <div className="mt-1.5 rounded-xl p-3 space-y-2.5" style={{ background: "#FFF5F5", border: "1px solid #FCA5A5" }}>
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: "#DC2626" }}>
              <AlertTriangle size={11} className="text-white" />
            </div>
            <span className="text-xs font-semibold" style={{ color: "#991B1B" }}>清空商戶拍賣數據</span>
            <span className="text-xs text-gray-400 ml-auto">⚠️ 不可復原</span>
          </div>

          <div className="rounded-lg p-2.5 text-xs space-y-1" style={{ background: "#FEE2E2", border: "1px solid #FECACA" }}>
            <p className="font-semibold" style={{ color: "#991B1B" }}>以下數據將永久刪除：</p>
            <ul className="list-disc list-inside space-y-0.5 text-red-700">
              <li>此商戶創建的<strong>所有拍賣</strong>（包括草稿、進行中、已結標）</li>
              <li>這些拍賣的所有<strong>出價記錄、代理出價、圖片</strong></li>
              <li>相關的<strong>保證金交易、退款申請、收藏記錄</strong></li>
              <li>此用戶在其他拍賣的所有<strong>出價記錄</strong></li>
            </ul>
            <p className="text-red-600 mt-1">用戶帳號本身將保留。</p>
          </div>

          <div className="space-y-1">
            <p className="text-xs text-gray-600">輸入用戶名稱 <strong>「{userName}」</strong> 以確認：</p>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={userName}
              className="w-full h-8 rounded-lg border px-2 text-xs focus:outline-none focus:ring-2"
              style={{
                borderColor: isConfirmed ? "#EF4444" : "#D1D5DB",
                focusRingColor: "#EF4444",
              }}
            />
          </div>

          <button
            type="button"
            disabled={!isConfirmed || purgeMutation.isPending}
            onClick={() => purgeMutation.mutate({ merchantUserId: userId })}
            className="w-full flex items-center justify-center gap-1.5 h-8 rounded-lg text-xs font-semibold text-white transition-opacity disabled:opacity-40"
            style={{ background: "linear-gradient(135deg, #DC2626, #B91C1C)" }}
          >
            {purgeMutation.isPending
              ? <><Loader2 size={12} className="animate-spin" />清空中…</>
              : <><Trash2 size={12} />確認清空所有拍賣數據</>}
          </button>

          {result && (
            <div className="rounded-lg px-2.5 py-2 space-y-0.5" style={{ background: "#D1FAE5", border: "1px solid #6EE7B7" }}>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 size={13} style={{ color: "#059669" }} />
                <span className="text-xs font-semibold" style={{ color: "#065F46" }}>清空完成</span>
              </div>
              <p className="text-xs" style={{ color: "#065F46" }}>
                已刪除：{result.deletedAuctions} 個拍賣、{result.deletedBids} 條出價、{result.deletedImages} 張圖片、{result.deletedExternalBids} 條外部出價
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

type EditState = {
  userId: number;
  name: string;
  email: string;
  phone: string;
  memberLevel: MemberLevel;
  isMerchant: boolean;
  requiredDeposit: string;
  commissionRate: string;
  depositIsActive: number;
  isBanned: number;
  subscriptionEndDate: string; // YYYY-MM-DD（空字串 = 用戶冇訂閱記錄）
  hasSubscription: boolean;
};

export default function AdminUsers() {
  const { user, isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();

  const [editState, setEditState] = useState<EditState | null>(null);
  const [pwDialog, setPwDialog] = useState<{ userId: number; name: string } | null>(null);
  const [adminPwInput, setAdminPwInput] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);
  const [expandedCardId, setExpandedCardId] = useState<number | null>(null);
  const [expandedUserId, setExpandedUserId] = useState<number | null>(null);
  const [expandedMerchantOrdersId, setExpandedMerchantOrdersId] = useState<number | null>(null);
  const [expandedStatsId, setExpandedStatsId] = useState<number | null>(null);
  const [newUserOpen, setNewUserOpen] = useState(false);
  const [newUserForm, setNewUserForm] = useState({
    name: "", phone: "", email: "", password: "",
    memberLevel: "bronze" as MemberLevel, role: "user" as "user" | "admin",
    isMerchant: false, merchantName: "",
  });

  const { data: users, isLoading, refetch } = trpc.users.listAllExtended.useQuery(undefined, {
    enabled: isAuthenticated && user?.role === "admin",
  });

  const adminUpdate = trpc.users.adminUpdate.useMutation({
    onSuccess: () => {
      toast.success("用戶資料已更新");
      setEditState(null);
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const adminUpdateDeposit = trpc.users.adminUpdateDeposit.useMutation({
    onSuccess: () => {
      toast.success("保證金設定已更新");
    },
    onError: (err) => toast.error(err.message),
  });

  const adminUpdateSubEndDate = trpc.users.adminUpdateSubscriptionEndDate.useMutation({
    onSuccess: (res) => {
      toast.success(res.status === 'expired' ? "已更新到期日（已標記為過期）" : "已更新訂閱到期日");
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const adminSetPassword = trpc.users.adminSetPassword.useMutation({
    onSuccess: () => {
      toast.success("密碼已更新，會員下次登入時須強制更改");
      setPwDialog(null);
      setAdminPwInput("");
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  // ─── Email reset requests ──────────────────────────────────────────────────
  const { data: resetRequests, refetch: refetchResets } = trpc.users.getEmailResetRequests.useQuery(undefined, {
    enabled: isAuthenticated && user?.role === "admin",
    refetchInterval: 30000,
  });
  const dismissReset = trpc.users.dismissEmailResetRequest.useMutation({
    onSuccess: () => refetchResets(),
  });
  // ──────────────────────────────────────────────────────────────────────────

  // ─── Merchant applications ─────────────────────────────────────────────────
  const [merchantReviewId, setMerchantReviewId] = useState<number | null>(null);
  const [merchantNote, setMerchantNote] = useState("");
  const [expandedMerchantId, setExpandedMerchantId] = useState<number | null>(null);

  const { data: merchantApps, refetch: refetchMerchantApps } = trpc.merchants.listAll.useQuery(undefined, {
    enabled: isAuthenticated && user?.role === "admin",
    refetchInterval: 60000,
  });
  const reviewMerchant = trpc.merchants.review.useMutation({
    onSuccess: () => {
      toast.success("審批已完成");
      setMerchantReviewId(null);
      setMerchantNote("");
      refetchMerchantApps();
      refetch(); // refresh user list
    },
    onError: (e) => toast.error(e.message),
  });
  const pendingMerchantApps = merchantApps?.filter(a => a.status === "pending") ?? [];
  // ──────────────────────────────────────────────────────────────────────────

  const adminDelete = trpc.users.adminDelete.useMutation({
    onSuccess: () => {
      toast.success("用戶及所有相關資料已刪除");
      setDeleteTarget(null);
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const [revokeTarget, setRevokeTarget] = useState<{ id: number; name: string } | null>(null);
  const adminRevokeMerchant = trpc.users.adminRevokeMerchant.useMutation({
    onSuccess: () => {
      toast.success("已撤銷商戶資格，該商戶已從市集移除");
      setRevokeTarget(null);
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const [cleanOrphanOpen, setCleanOrphanOpen] = useState(false);
  const adminCleanOrphan = trpc.users.adminCleanOrphanData.useMutation({
    onSuccess: (res) => {
      const parts = [
        res.deletedMerchantApplications ? `商戶申請 ${res.deletedMerchantApplications}` : "",
        res.deletedMerchantProducts ? `商品 ${res.deletedMerchantProducts}` : "",
        res.deletedAuctions ? `拍賣 ${res.deletedAuctions}` : "",
        res.deletedSellerDeposits ? `保證金帳戶 ${res.deletedSellerDeposits}` : "",
        res.deletedUserSubscriptions ? `訂閱 ${res.deletedUserSubscriptions}` : "",
        res.deletedDepositTopUpRequests ? `充值申請 ${res.deletedDepositTopUpRequests}` : "",
        res.deletedMerchantSettings ? `版面設定 ${res.deletedMerchantSettings}` : "",
      ].filter(Boolean);
      toast.success(parts.length > 0 ? `已清除孤兒資料：${parts.join("、")}` : "資料庫無孤兒資料，無需清理");
      setCleanOrphanOpen(false);
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const adminCreateUser = trpc.users.adminCreateUser.useMutation({
    onSuccess: () => {
      toast.success("會員已建立");
      setNewUserOpen(false);
      setNewUserForm({ name: "", phone: "", email: "", password: "", memberLevel: "bronze", role: "user", isMerchant: false, merchantName: "" });
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated || user?.role !== "admin") {
    navigate("/");
    return null;
  }

  const allUsers: UserRow[] = (users ?? []) as UserRow[];
  const buyers = allUsers.filter((u) => !isMerchantUser(u) && u.role !== "admin");
  const merchants = allUsers.filter((u) => isMerchantUser(u));
  const admins = allUsers.filter((u) => u.role === "admin");

  function openEdit(u: UserRow) {
    setEditState({
      userId: u.id,
      name: u.name ?? "",
      email: u.email ?? "",
      phone: u.phone ?? "",
      memberLevel: (u.memberLevel ?? "bronze") as MemberLevel,
      isMerchant: isMerchantUser(u),
      requiredDeposit: u.requiredDeposit ?? "500.00",
      commissionRate: u.commissionRate ? (parseFloat(u.commissionRate) * 100).toFixed(1) : "5.0",
      depositIsActive: u.depositIsActive ?? 1,
      isBanned: u.isBanned ?? 0,
      subscriptionEndDate: u.subscriptionEndDate
        ? new Date(u.subscriptionEndDate).toISOString().slice(0, 10)
        : "",
      hasSubscription: !!u.subscriptionEndDate,
    });
  }

  function handleSaveEdit() {
    if (!editState) return;
    adminUpdate.mutate({
      userId: editState.userId,
      name: editState.name || undefined,
      email: editState.email || undefined,
      phone: editState.phone || undefined,
      memberLevel: editState.memberLevel,
      isBanned: editState.isBanned,
    });
    if (editState.isMerchant) {
      adminUpdateDeposit.mutate({
        userId: editState.userId,
        requiredDeposit: parseFloat(editState.requiredDeposit),
        commissionRate: parseFloat(editState.commissionRate) / 100,
        isActive: editState.depositIsActive,
      });
      // 只有當用戶有訂閱記錄、且管理員填咗有效日期，先更新到期日
      if (editState.hasSubscription && editState.subscriptionEndDate) {
        adminUpdateSubEndDate.mutate({
          userId: editState.userId,
          endDate: editState.subscriptionEndDate,
        });
      }
    }
  }

  function formatDate(d: Date | null) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("zh-HK", { year: "numeric", month: "2-digit", day: "2-digit" });
  }

  function renderUserList(list: UserRow[], emptyText: string) {
    if (isLoading) {
      return (
        <div className="p-6 space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-14 bg-amber-50 rounded animate-pulse" />
          ))}
        </div>
      );
    }
    if (list.length === 0) {
      return <div className="p-8 text-center text-muted-foreground text-sm">{emptyText}</div>;
    }
    return (
      <div className="divide-y divide-amber-50">
        {list.map((u) => {
          const isOpen = expandedCardId === u.id;
          return (
          <div key={u.id} className="border-b border-amber-50 last:border-0">
            {/* ── 標題列：點擊展開 / 收起 ── */}
            <button
              type="button"
              className="w-full px-4 py-3 flex items-center gap-3 hover:bg-amber-50/50 transition-colors text-left"
              onClick={() => setExpandedCardId(isOpen ? null : u.id)}
            >
              <div className="w-10 h-10 gold-gradient rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                {isMerchantUser(u)
                  ? <Store className="w-4 h-4" />
                  : u.role === "admin"
                  ? <ShieldAlert className="w-4 h-4" />
                  : <UserRound className="w-4 h-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-medium text-sm">{u.name ?? "未知用戶"}</span>
                  <MemberBadge level={u.memberLevel} variant="badge" size="sm" />
                  {u.role === "admin" && (
                    <Badge className="bg-amber-600 text-white text-[0.6rem] px-1.5 py-0">管理員</Badge>
                  )}
                  {isMerchantUser(u) && (
                    <Badge className={`text-[0.6rem] px-1.5 py-0 ${u.depositIsActive ? "bg-emerald-600 text-white" : "bg-gray-400 text-white"}`}>
                      {u.depositIsActive ? "商戶活躍" : "商戶停權"}
                    </Badge>
                  )}
                  {u.mustChangePassword === 1 && (
                    <Badge className="text-[0.6rem] px-1.5 py-0 bg-orange-500 text-white">🔑 須更改密碼</Badge>
                  )}
                  {u.isBanned === 1 && (
                    <Badge className="text-[0.6rem] px-1.5 py-0 bg-red-600 text-white">🚫 停權</Badge>
                  )}
                </div>
                {!isOpen && (
                  <div className="text-xs text-gray-400 mt-0.5 space-y-0.5">
                    {u.phone && <div className="truncate">📱 {u.phone}</div>}
                    {isMerchantUser(u) && (
                      <div className="text-amber-600 whitespace-nowrap overflow-x-auto">
                        💰 HK${parseFloat(u.depositBalance ?? "0").toFixed(0)} ／ 門檻 HK${parseFloat(u.requiredDeposit ?? "500").toFixed(0)} ／ 佣金 {(parseFloat(u.commissionRate ?? "0.05") * 100).toFixed(1)}%
                        {u.subscriptionEndDate && (
                          <span className="ml-2 text-gray-400">｜ 訂閱到 {new Date(u.subscriptionEndDate).toLocaleDateString("zh-HK", { year: "numeric", month: "2-digit", day: "2-digit" })}</span>
                        )}
                        {u.subscriptionQuota != null && (
                          <span className="ml-1 text-gray-400">｜ 點數 {u.subscriptionQuota}</span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <ChevronDown
                size={16}
                className="flex-shrink-0 text-gray-400 transition-transform duration-200"
                style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}
              />
            </button>

            {/* ── 展開內容 ── */}
            {isOpen && (
              <div className="px-4 pb-4 space-y-1 border-t border-amber-50">
                <div className="text-xs text-muted-foreground space-y-0.5 pt-2">
                  {u.email && (
                    <div className="flex items-center gap-1 min-w-0">
                      <span className="flex-shrink-0">📧</span>
                      <span className="truncate">{u.email}</span>
                    </div>
                  )}
                  {u.phone && (
                    <div className="whitespace-nowrap">📱 {u.phone}</div>
                  )}
                  {isMerchantUser(u) && (
                    <div className="text-amber-700 whitespace-nowrap">
                      💰 HK${parseFloat(u.depositBalance ?? "0").toFixed(0)} ／ 門檻 HK${parseFloat(u.requiredDeposit ?? "500").toFixed(0)} ／ 佣金 {(parseFloat(u.commissionRate ?? "0.05") * 100).toFixed(1)}%
                    </div>
                  )}
                  <div className="text-gray-400 whitespace-nowrap">登入方式：{u.loginMethod ?? "—"}</div>
                  <div className="text-gray-400 whitespace-nowrap">加入：{formatDate(u.createdAt)}</div>

                  {/* Won auctions toggle */}
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setExpandedUserId(expandedUserId === u.id ? null : u.id)}
                      className="flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium transition-colors"
                      style={{
                        background: expandedUserId === u.id ? "#FFF3E0" : "#F5F5F5",
                        color: expandedUserId === u.id ? "#C8860A" : "#666",
                      }}
                    >
                      <Gavel size={10} />
                      中標 {Number(u.wonCount)} 件
                      <ChevronDown
                        size={11}
                        style={{ transform: expandedUserId === u.id ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.15s" }}
                      />
                    </button>
                    {Number(u.activeAuctionCount) > 0 && (
                      <span className="flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium bg-blue-50 text-blue-700">
                        🔨 拍賣中 {Number(u.activeAuctionCount)}
                      </span>
                    )}
                    {Number(u.activeProductCount) > 0 && (
                      <span className="flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium bg-emerald-50 text-emerald-700">
                        📦 商品 {Number(u.activeProductCount)}
                      </span>
                    )}
                  </div>

                  {/* Won auctions expandable list */}
                  {expandedUserId === u.id && <WonAuctionsList userId={u.id} />}

                  {/* Merchant sold orders toggle — only for merchants */}
                  {isMerchantUser(u) && (
                    <>
                      <button
                        type="button"
                        onClick={() => setExpandedMerchantOrdersId(expandedMerchantOrdersId === u.id ? null : u.id)}
                        className="flex items-center gap-1 mt-1 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium transition-colors"
                        style={{
                          background: expandedMerchantOrdersId === u.id ? "#F0FDF4" : "#F5F5F5",
                          color: expandedMerchantOrdersId === u.id ? "#16A34A" : "#666",
                        }}
                      >
                        <Store size={10} />
                        商戶訂單
                        <ChevronDown
                          size={11}
                          style={{ transform: expandedMerchantOrdersId === u.id ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.15s" }}
                        />
                      </button>
                      {expandedMerchantOrdersId === u.id && <MerchantOrdersList merchantUserId={u.id} />}
                    </>
                  )}

                  {/* 統計總結 toggle */}
                  <button
                    type="button"
                    onClick={() => setExpandedStatsId(expandedStatsId === u.id ? null : u.id)}
                    className="flex items-center gap-1 mt-1 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium transition-colors"
                    style={{
                      background: expandedStatsId === u.id ? "#EFF6FF" : "#F5F5F5",
                      color: expandedStatsId === u.id ? "#1D4ED8" : "#666",
                    }}
                  >
                    <Package size={10} />
                    統計總結
                    <ChevronDown
                      size={11}
                      style={{ transform: expandedStatsId === u.id ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.15s" }}
                    />
                  </button>
                  {expandedStatsId === u.id && <UserStatsPanel userId={u.id} isMerchant={isMerchantUser(u)} />}

                  {/* Action buttons */}
                  {u.role !== "admin" && (
                    <div className="flex gap-1.5 mt-2 flex-wrap">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 px-2.5 border-amber-200 text-amber-700 hover:bg-amber-50"
                        onClick={() => openEdit(u)}
                      >
                        <Pencil className="w-3.5 h-3.5 mr-1" />
                        修改
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 px-2.5 border-blue-200 text-blue-700 hover:bg-blue-50"
                        onClick={() => { setPwDialog({ userId: u.id, name: u.name ?? "此用戶" }); setAdminPwInput(""); }}
                      >
                        <KeyRound className="w-3.5 h-3.5 mr-1" />
                        修改密碼
                      </Button>
                      {isMerchantUser(u) && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 px-2.5 border-orange-200 text-orange-600 hover:bg-orange-50"
                          onClick={() => setRevokeTarget({ id: u.id, name: u.name ?? "此商戶" })}
                        >
                          <Store className="w-3.5 h-3.5 mr-1" />
                          撤銷商戶
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 px-2.5 border-red-200 text-red-600 hover:bg-red-50"
                        onClick={() => setDeleteTarget({ id: u.id, name: u.name ?? "此用戶" })}
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1" />
                        拆除
                      </Button>
                    </div>
                  )}
                </div>

                {/* Merchant-only panels */}
                {isMerchantUser(u) && <DepositModifyPanel userId={u.id} currentBalance={u.depositBalance ?? "0"} onDone={refetch} />}
                {isMerchantUser(u) && <GenerateListingsPanel userId={u.id} userName={u.name ?? `用戶 #${u.id}`} />}
                {isMerchantUser(u) && <GenerateProductsPanel userId={u.id} userName={u.name ?? `用戶 #${u.id}`} />}
                {isMerchantUser(u) && <GenerateWonAuctionPanel userId={u.id} userName={u.name ?? `用戶 #${u.id}`} />}
                {isMerchantUser(u) && <ClearProductsPanel userId={u.id} userName={u.name ?? `用戶 #${u.id}`} />}
                {isMerchantUser(u) && <PurgeMerchantDataPanel userId={u.id} userName={u.name ?? `用戶 #${u.id}`} onDone={refetch} />}
                {u.role === "admin" && <AdminSelfClearPanel userName={u.name ?? `管理員 #${u.id}`} />}
              </div>
            )}
          </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 p-4 md:p-8 pb-24">
      <AdminHeader />
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-start gap-3 mb-6">
          <div className="w-10 h-10 gold-gradient rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
            <Users className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-amber-900">會員管理</h1>
            <p className="text-sm text-muted-foreground">
              共 {allUsers.length} 人 ｜ 買家 {buyers.length} ｜ 商戶 {merchants.length}
            </p>
            <div className="flex gap-2 mt-2 flex-wrap">
              <Button size="sm" variant="outline" className="border-red-200 text-red-600 hover:bg-red-50 gap-1.5" onClick={() => setCleanOrphanOpen(true)}>
                <Wrench className="w-4 h-4" />清理孤兒資料
              </Button>
              <Button size="sm" className="gold-gradient text-white border-0 gap-1.5" onClick={() => setNewUserOpen(true)}>
                <UserPlus className="w-4 h-4" />新增會員
              </Button>
            </div>
          </div>
        </div>

        {/* ── Email Reset Requests Panel ── */}
        {resetRequests && resetRequests.length > 0 && (
          <div className="mb-5 rounded-2xl border-2 border-amber-400 overflow-hidden shadow-md">
            <div className="flex items-center gap-2 px-4 py-2.5" style={{ background: "#FEF3C7" }}>
              <Mail className="w-4 h-4 text-amber-700" />
              <span className="font-bold text-sm text-amber-900">
                密碼重設申請 ({resetRequests.length})
              </span>
              <span className="ml-auto text-xs text-amber-600">請聯絡會員並告知臨時密碼</span>
            </div>
            <div className="divide-y divide-amber-100">
              {resetRequests.map(req => (
                <div key={req.id} className="px-4 py-3 bg-white flex flex-col gap-2">
                  <div className="flex items-start gap-2 justify-between">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-sm font-medium text-gray-800">
                        <UserRound className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        <span>{req.userName ?? "未知用戶"}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <Mail className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{req.email}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1">
                          <KeyRound className="w-3.5 h-3.5 text-amber-600" />
                          <span className="font-mono font-bold text-sm text-amber-800 tracking-wider">
                            {req.tempPassword}
                          </span>
                          <button
                            type="button"
                            className="ml-1 text-amber-500 hover:text-amber-700"
                            onClick={() => {
                              navigator.clipboard.writeText(req.tempPassword);
                              toast.success("臨時密碼已複製");
                            }}
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <span className="text-xs text-gray-400">
                          {new Date(req.createdAt).toLocaleString("zh-HK", {
                            month: "2-digit", day: "2-digit",
                            hour: "2-digit", minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => dismissReset.mutate({ id: req.id })}
                      className="flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1.5 hover:bg-emerald-100 transition-colors flex-shrink-0 mt-0.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      已處理
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Merchant Application Review Panel ── */}
        {pendingMerchantApps.length > 0 && (
          <div className="mb-5 rounded-2xl border-2 border-amber-400 overflow-hidden shadow-md">
            <div className="flex items-center gap-2 px-4 py-2.5" style={{ background: "#FEF3C7" }}>
              <Store className="w-4 h-4 text-amber-700" />
              <span className="font-bold text-sm text-amber-900">
                商戶申請審核 ({pendingMerchantApps.length})
              </span>
            </div>
            <div className="divide-y divide-amber-100">
              {pendingMerchantApps.map(app => {
                const expanded = expandedMerchantId === app.id;
                const reviewing = merchantReviewId === app.id || merchantReviewId === -app.id;
                return (
                  <div key={app.id} className="px-4 py-3 bg-white">
                    {/* Header row */}
                    <div className="flex items-center gap-2 justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <Store className="w-4 h-4 text-amber-500 flex-shrink-0" />
                        <span className="font-semibold text-sm text-gray-800 truncate">{app.merchantName}</span>
                        <span className="text-xs text-gray-400">— {app.applicantName ?? "未知"}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setExpandedMerchantId(expanded ? null : app.id)}
                        className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-800"
                      >
                        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        {expanded ? "收起" : "詳細"}
                      </button>
                    </div>

                    {/* Compact info */}
                    <div className="mt-1 flex flex-wrap gap-2 text-xs text-gray-500">
                      {app.contactName && <span>👤 {app.contactName}</span>}
                      <span>📞 {app.whatsapp}</span>
                      <span className="text-gray-400">
                        {new Date(app.createdAt!).toLocaleString("zh-HK", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>

                    {/* Expanded details */}
                    {expanded && (
                      <div className="mt-3 space-y-3">
                        {/* Merchant icon */}
                        {app.merchantIcon && (
                          <div className="flex items-center gap-3">
                            <img
                              src={app.merchantIcon}
                              alt="商戶圖示"
                              className="w-14 h-14 rounded-xl object-cover border border-amber-100"
                            />
                            <span className="text-xs text-gray-400">商戶圖示</span>
                          </div>
                        )}
                        <div className="rounded-xl bg-amber-50 border border-amber-100 px-3 py-2">
                          <p className="text-xs font-medium text-gray-500 mb-1">自我介紹</p>
                          <p className="text-sm text-gray-700">{app.selfIntro}</p>
                        </div>
                        <div className="text-xs text-gray-500 space-y-0.5">
                          {app.applicantEmail && <p>📧 {app.applicantEmail}</p>}
                          {app.applicantPhone && <p>📱 {app.applicantPhone}</p>}
                        </div>
                      </div>
                    )}

                    {/* Review actions */}
                    {!reviewing ? (
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => { setMerchantReviewId(app.id); setMerchantNote(""); }}
                          className="flex items-center gap-1 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg px-3 py-1.5 hover:bg-emerald-100 transition-colors"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> 批准
                        </button>
                        <button
                          onClick={() => { setMerchantReviewId(-app.id); setMerchantNote(""); }}
                          className="flex items-center gap-1 text-xs bg-red-50 text-red-600 border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-100 transition-colors"
                        >
                          <XCircle className="w-3.5 h-3.5" /> 拒絕
                        </button>
                      </div>
                    ) : (
                      <div className="mt-3 space-y-2">
                        <p className="text-xs font-medium text-gray-600">
                          {merchantReviewId > 0 ? "✅ 批准" : "❌ 拒絕"} — 備注（可選）
                        </p>
                        <input
                          className="w-full text-sm rounded-lg border border-amber-200 px-3 py-1.5 focus:outline-none focus:border-amber-400"
                          placeholder={merchantReviewId > 0 ? "例如：歡迎加入，保證金 HKD 500" : "例如：資料不足，請補充"}
                          value={merchantNote}
                          onChange={e => setMerchantNote(e.target.value)}
                        />
                        <div className="flex gap-2">
                          <button
                            disabled={reviewMerchant.isPending}
                            onClick={() => reviewMerchant.mutate({
                              id: Math.abs(merchantReviewId!),
                              status: merchantReviewId! > 0 ? "approved" : "rejected",
                              adminNote: merchantNote || undefined,
                            })}
                            className="text-xs bg-amber-500 text-white rounded-lg px-3 py-1.5 hover:bg-amber-600 transition-colors disabled:opacity-50"
                          >
                            確認提交
                          </button>
                          <button
                            onClick={() => { setMerchantReviewId(null); setMerchantNote(""); }}
                            className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1.5"
                          >
                            取消
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tabs */}
        <Tabs defaultValue="all">
          <TabsList className="mb-4 bg-amber-100/60">
            <TabsTrigger value="all" className="data-[state=active]:bg-white">
              全部 <span className="ml-1.5 text-xs text-muted-foreground">({allUsers.length})</span>
            </TabsTrigger>
            <TabsTrigger value="buyers" className="data-[state=active]:bg-white">
              <UserRound className="w-3.5 h-3.5 mr-1" />
              買家 <span className="ml-1.5 text-xs text-muted-foreground">({buyers.length})</span>
            </TabsTrigger>
            <TabsTrigger value="merchants" className="data-[state=active]:bg-white">
              <Store className="w-3.5 h-3.5 mr-1" />
              商戶 <span className="ml-1.5 text-xs text-muted-foreground">({merchants.length})</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all">
            <Card className="border-amber-100">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="w-4 h-4 text-amber-600" />
                  所有用戶
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {renderUserList(allUsers, "尚無用戶")}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="buyers">
            <Card className="border-amber-100">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <UserRound className="w-4 h-4 text-amber-600" />
                  買家列表
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {renderUserList(buyers, "暫無買家")}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="merchants">
            <Card className="border-amber-100">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Store className="w-4 h-4 text-amber-600" />
                  商戶列表
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {renderUserList(merchants, "暫無商戶")}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* 修改密碼 Dialog */}
      <Dialog open={!!pwDialog} onOpenChange={(open) => { if (!open) { setPwDialog(null); setAdminPwInput(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-blue-600" />
              修改會員密碼
            </DialogTitle>
          </DialogHeader>
          {pwDialog && (
            <div className="space-y-4 py-1">
              <p className="text-sm text-muted-foreground">
                正在為 <span className="font-semibold text-foreground">{pwDialog.name}</span> 設定新密碼。
              </p>
              <div className="rounded-lg px-3 py-2.5 text-xs space-y-1" style={{ background: "#FFF7ED", border: "1px solid #FED7AA" }}>
                <p className="font-semibold text-orange-700">⚠️ 注意</p>
                <p className="text-orange-600">設定後，該會員下次登入時將被強制要求更改密碼，方可繼續使用。</p>
              </div>
              <div className="space-y-1.5">
                <Label>新密碼（至少 6 個字符）</Label>
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={adminPwInput}
                  onChange={(e) => setAdminPwInput(e.target.value)}
                  placeholder="輸入新密碼"
                  className="border-blue-200"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setPwDialog(null); setAdminPwInput(""); }}>取消</Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white"
              disabled={adminPwInput.length < 6 || adminSetPassword.isPending}
              onClick={() => {
                if (!pwDialog) return;
                if (adminPwInput.length < 6) { toast.error("密碼至少需要6個字符"); return; }
                adminSetPassword.mutate({ userId: pwDialog.userId, newPassword: adminPwInput });
              }}
            >
              {adminSetPassword.isPending ? "設定中…" : "確認設定"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editState} onOpenChange={(open) => !open && setEditState(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>修改用戶資料</DialogTitle>
          </DialogHeader>
          {editState && (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>姓名</Label>
                <Input
                  value={editState.name}
                  onChange={(e) => setEditState({ ...editState, name: e.target.value })}
                  placeholder="用戶姓名"
                />
              </div>
              <div className="space-y-1.5">
                <Label>電郵</Label>
                <Input
                  type="email"
                  value={editState.email}
                  onChange={(e) => setEditState({ ...editState, email: e.target.value })}
                  placeholder="email@example.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label>電話</Label>
                <Input
                  value={editState.phone}
                  onChange={(e) => setEditState({ ...editState, phone: e.target.value })}
                  placeholder="+852 XXXX XXXX"
                />
              </div>
              <div className="space-y-1.5">
                <Label>會員等級</Label>
                <Select
                  value={editState.memberLevel}
                  onValueChange={(val) => setEditState({ ...editState, memberLevel: val as MemberLevel })}
                >
                  <SelectTrigger className="border-amber-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bronze">🥉 銅牌會員</SelectItem>
                    <SelectItem value="silver">🥈 銀牌會員</SelectItem>
                    <SelectItem value="gold">🥇 金牌會員</SelectItem>
                    <SelectItem value="vip">💎 VIP 會員</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* 帳號狀態（所有會員） */}
              <div className="border border-red-100 rounded-lg p-3 space-y-2 bg-red-50/40">
                <p className="text-xs font-semibold text-red-800 uppercase tracking-wide">帳號狀態</p>
                <Select
                  value={String(editState.isBanned)}
                  onValueChange={(val) => setEditState({ ...editState, isBanned: parseInt(val) })}
                >
                  <SelectTrigger className="border-red-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">✅ 正常（可使用一切功能）</SelectItem>
                    <SelectItem value="1">🚫 停權（禁止出價、上拍、出售）</SelectItem>
                  </SelectContent>
                </Select>
                {editState.isBanned === 1 && (
                  <p className="text-xs text-red-600">停權後，此會員將無法出價、刊登拍賣或上架商品。</p>
                )}
              </div>

              {editState.isMerchant && (
                <div className="border border-amber-100 rounded-lg p-3 space-y-3 bg-amber-50/50">
                  <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide">商戶設定</p>
                  <div className="space-y-1.5">
                    <Label>佣金率 (%)</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={editState.commissionRate}
                      onChange={(e) => setEditState({ ...editState, commissionRate: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>商戶上架狀態</Label>
                    <Select
                      value={String(editState.depositIsActive)}
                      onValueChange={(val) => setEditState({ ...editState, depositIsActive: parseInt(val) })}
                    >
                      <SelectTrigger className="border-amber-200">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">✅ 活躍（可上架）</SelectItem>
                        <SelectItem value="0">🚫 停權（不可上架）</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* 訂閱費到期日 */}
                  <div className="space-y-1.5 border-t border-amber-200 pt-3">
                    <Label>訂閱費到期日</Label>
                    {editState.hasSubscription ? (
                      <>
                        <Input
                          type="date"
                          value={editState.subscriptionEndDate}
                          onChange={(e) => setEditState({ ...editState, subscriptionEndDate: e.target.value })}
                          className="border-amber-200"
                        />
                        <p className="text-xs text-amber-700">
                          修改後若日期已過，系統會自動將訂閱標記為「已過期」，商戶將無法繼續發佈拍賣。
                        </p>
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground">此商戶尚未有任何訂閱記錄，無法設定到期日。</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditState(null)}>取消</Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700 text-white"
              onClick={handleSaveEdit}
              disabled={adminUpdate.isPending || adminUpdateDeposit.isPending || adminUpdateSubEndDate.isPending}
            >
              {adminUpdate.isPending ? "儲存中…" : "儲存變更"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke Merchant Confirmation */}
      <AlertDialog open={!!revokeTarget} onOpenChange={(open) => !open && setRevokeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-orange-600">確認撤銷商戶資格？</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                您即將撤銷 <strong>{revokeTarget?.name}</strong> 的商戶資格。
              </p>
              <ul className="text-sm list-disc list-inside space-y-1 text-muted-foreground">
                <li>商戶申請狀態改為「已拒絕」，從商戶市集消失</li>
                <li>所有出售商品（商戶市集）將被刪除</li>
                <li>用戶帳號、保證金帳戶、拍賣記錄等均保留</li>
              </ul>
              <p className="font-semibold text-orange-600">此操作不可逆。如需重新開通，須重新申請審批。</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-orange-600 hover:bg-orange-700 text-white"
              onClick={() => revokeTarget && adminRevokeMerchant.mutate({ userId: revokeTarget.id })}
              disabled={adminRevokeMerchant.isPending}
            >
              {adminRevokeMerchant.isPending ? "撤銷中…" : "確認撤銷商戶資格"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Clean Orphan Data Confirmation */}
      <AlertDialog open={cleanOrphanOpen} onOpenChange={(open) => !open && setCleanOrphanOpen(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600">確認清理孤兒資料？</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>此操作會掃描資料庫，永久刪除所有「用戶已被拆除但相關記錄仍存在」的孤兒資料，包括：</p>
              <ul className="text-sm list-disc list-inside space-y-1 text-muted-foreground">
                <li>已拆除商戶的申請記錄（從商戶市集移除）</li>
                <li>已拆除商戶的出售商品</li>
                <li>已拆除商戶的拍賣及所有子記錄</li>
                <li>孤兒保證金帳戶、訂閱、通知設定等</li>
              </ul>
              <p className="text-sm text-muted-foreground">現有用戶的資料不受影響。</p>
              <p className="font-semibold text-red-600">此操作不可逆，請確認後執行。</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => adminCleanOrphan.mutate()}
              disabled={adminCleanOrphan.isPending}
            >
              {adminCleanOrphan.isPending ? "清理中…" : "確認清理"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600">確認拆除用戶？</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                您即將永久刪除用戶 <strong>{deleteTarget?.name}</strong> 及其所有相關資料，包括：
              </p>
              <ul className="text-sm list-disc list-inside space-y-1 text-muted-foreground">
                <li>商戶申請記錄（從商戶市集移除）</li>
                <li>所有出售商品（商戶市集）</li>
                <li>所有拍賣及相關出價、競拍記錄、圖片</li>
                <li>所有出價記錄（作為買家）</li>
                <li>代理出價設定</li>
                <li>收藏清單</li>
                <li>訂閱記錄</li>
                <li>保證金帳戶、充值申請及交易記錄</li>
                <li>通知設定、商戶版面設定</li>
              </ul>
              <p className="font-semibold text-red-600">此操作不可逆，請謹慎確認。</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => deleteTarget && adminDelete.mutate({ userId: deleteTarget.id })}
              disabled={adminDelete.isPending}
            >
              {adminDelete.isPending ? "刪除中…" : "確認永久刪除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 新增會員 Dialog */}
      <Dialog open={newUserOpen} onOpenChange={setNewUserOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-amber-600" />新增會員
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>會員稱呼 *</Label>
              <Input placeholder="例：王大明" value={newUserForm.name} onChange={(e) => setNewUserForm(f => ({ ...f, name: e.target.value }))} className="border-amber-200" />
            </div>
            <div className="space-y-1.5">
              <Label>登入手機</Label>
              <Input placeholder="例：91234567" value={newUserForm.phone} onChange={(e) => setNewUserForm(f => ({ ...f, phone: e.target.value }))} className="border-amber-200" />
            </div>
            <div className="space-y-1.5">
              <Label>登入電郵</Label>
              <Input type="email" placeholder="例：test@example.com" value={newUserForm.email} onChange={(e) => setNewUserForm(f => ({ ...f, email: e.target.value }))} className="border-amber-200" />
              <p className="text-xs text-muted-foreground">手機或電郵至少填一項</p>
            </div>
            <div className="space-y-1.5">
              <Label>密碼 *</Label>
              <Input type="password" autoComplete="new-password" placeholder="初始密碼" value={newUserForm.password} onChange={(e) => setNewUserForm(f => ({ ...f, password: e.target.value }))} className="border-amber-200" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>會員等級</Label>
                <Select value={newUserForm.memberLevel} onValueChange={(v) => setNewUserForm(f => ({ ...f, memberLevel: v as MemberLevel }))}>
                  <SelectTrigger className="border-amber-200"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bronze">銅牌</SelectItem>
                    <SelectItem value="silver">銀牌</SelectItem>
                    <SelectItem value="gold">金牌</SelectItem>
                    <SelectItem value="vip">VIP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>角色</Label>
                <Select value={newUserForm.role} onValueChange={(v) => setNewUserForm(f => ({ ...f, role: v as "user" | "admin" }))}>
                  <SelectTrigger className="border-amber-200"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">普通會員</SelectItem>
                    <SelectItem value="admin">管理員</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-amber-800">開通商戶資格</Label>
                <button
                  type="button"
                  onClick={() => setNewUserForm(f => ({ ...f, isMerchant: !f.isMerchant }))}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${newUserForm.isMerchant ? 'bg-amber-500' : 'bg-gray-300'}`}
                >
                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${newUserForm.isMerchant ? 'translate-x-4' : 'translate-x-1'}`} />
                </button>
              </div>
              {newUserForm.isMerchant && (
                <div className="space-y-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-amber-700">商戶名稱</Label>
                    <Input placeholder="例：大明古幣店" value={newUserForm.merchantName} onChange={(e) => setNewUserForm(f => ({ ...f, merchantName: e.target.value }))} className="border-amber-200 h-8 text-sm" />
                  </div>
                  <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 space-y-0.5">
                    <p className="text-xs font-medium text-amber-800">系統將自動設定：</p>
                    <p className="text-[11px] text-amber-700">• 隨機選擇保證金套餐（設定所需保證金及傭金率，初始餘額 = 套餐金額 ×2）</p>
                    <p className="text-[11px] text-amber-700">• 隨機選擇月費訂閱計劃（即時啟動，有效期 1 個月）</p>
                    <p className="text-[11px] text-amber-700">• 商戶狀態設為已開通</p>
                  </div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewUserOpen(false)}>取消</Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5"
              disabled={adminCreateUser.isPending}
              onClick={() => {
                if (!newUserForm.name.trim()) return toast.error("請填寫會員稱呼");
                if (!newUserForm.password.trim()) return toast.error("請填寫密碼");
                if (!newUserForm.phone.trim() && !newUserForm.email.trim()) return toast.error("請填寫手機或電郵");
                adminCreateUser.mutate({
                  name: newUserForm.name.trim(),
                  phone: newUserForm.phone.trim() || undefined,
                  email: newUserForm.email.trim() || undefined,
                  password: newUserForm.password,
                  memberLevel: newUserForm.memberLevel,
                  role: newUserForm.role,
                  isMerchant: newUserForm.isMerchant,
                  merchantName: newUserForm.merchantName.trim() || undefined,
                });
              }}
            >
              {adminCreateUser.isPending ? "建立中…" : "建立帳號"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
