import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import AdminHeader from "@/components/AdminHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trophy, Search, RefreshCw, ChevronLeft, Mail, Loader2 } from "lucide-react";
import { toast } from "sonner";

const PAYMENT_STATUS_CONFIG = {
  pending_payment: { label: '待付款', variant: 'outline' as const, badgeClass: 'border-yellow-300 bg-yellow-50 text-yellow-800' },
  paid: { label: '已付款', variant: 'outline' as const, badgeClass: 'border-blue-300 bg-blue-50 text-blue-800' },
  delivered: { label: '已交收', variant: 'outline' as const, badgeClass: 'border-green-300 bg-green-50 text-green-800' },
} as const;

type OrderStatus = keyof typeof PAYMENT_STATUS_CONFIG | null;

type WonOrder = {
  id: number;
  title: string;
  currentPrice: string;
  currency: string;
  endTime: Date;
  paymentStatus: string | null;
  winnerName: string | null;
  winnerOpenId: string | null;
  winningAmount: string | null;
};

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <Badge variant="outline" className="border-gray-200 bg-gray-50 text-gray-500 text-xs">未設定</Badge>;
  const config = PAYMENT_STATUS_CONFIG[status as keyof typeof PAYMENT_STATUS_CONFIG];
  if (!config) return <Badge variant="outline" className="text-xs">{status}</Badge>;
  return <Badge variant="outline" className={`${config.badgeClass} text-xs`}>{config.label}</Badge>;
}

function OrderRow({ order, onUpdate }: { order: WonOrder; onUpdate: () => void }) {
  const [updating, setUpdating] = useState(false);
  const [resending, setResending] = useState(false);

  const updateStatus = trpc.wonAuctions.updatePaymentStatus.useMutation({
    onSuccess: () => {
      toast.success('付款狀態已更新！');
      onUpdate();
    },
    onError: (err) => toast.error(err.message),
    onSettled: () => setUpdating(false),
  });

  const resendEmail = trpc.wonAuctions.resendEmail.useMutation({
    onSuccess: (data) => {
      toast.success(`得標通知已重發至 ${data.sentTo}`);
    },
    onError: (err) => toast.error(err.message),
    onSettled: () => setResending(false),
  });

  const handleUpdate = (status: 'pending_payment' | 'paid' | 'delivered') => {
    setUpdating(true);
    updateStatus.mutate({ auctionId: order.id, status });
  };

  const handleResendEmail = () => {
    setResending(true);
    resendEmail.mutate({ auctionId: order.id, origin: window.location.origin });
  };

  const currentStatus = order.paymentStatus as OrderStatus;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors">
      {/* 拍賣資訊 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2">
          <Trophy className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
          <div className="min-w-0">
            <Link href={`/auctions/${order.id}`}>
              <p className="text-sm font-medium hover:text-amber-600 truncate cursor-pointer">{order.title}</p>
            </Link>
            <p className="text-xs text-muted-foreground mt-0.5">
              結標：{new Date(order.endTime).toLocaleString('zh-HK', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>
      </div>

      {/* 得標者 */}
      <div className="sm:w-36 min-w-0">
        <p className="text-xs text-muted-foreground">得標者</p>
        <p className="text-sm font-medium truncate">{order.winnerName ?? '—'}</p>
      </div>

      {/* 得標金額 */}
      <div className="sm:w-28 text-right sm:text-left">
        <p className="text-xs text-muted-foreground">得標金額</p>
        <p className="text-sm font-bold text-amber-700">
          {order.currency}${order.winningAmount ? Number(order.winningAmount).toLocaleString() : '—'}
        </p>
      </div>

      {/* 狀態 */}
      <div className="sm:w-24">
        <StatusBadge status={order.paymentStatus} />
      </div>

      {/* 操作按鈕 */}
      <div className="flex gap-1.5 flex-wrap items-center">
        {currentStatus !== 'pending_payment' && (
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-7 px-2 border-yellow-300 text-yellow-800 hover:bg-yellow-50"
            onClick={() => handleUpdate('pending_payment')}
            disabled={updating || resending}
          >
            ⏳ 待付款
          </Button>
        )}
        {currentStatus !== 'paid' && (
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-7 px-2 border-blue-300 text-blue-800 hover:bg-blue-50"
            onClick={() => handleUpdate('paid')}
            disabled={updating || resending}
          >
            💳 已付款
          </Button>
        )}
        {currentStatus !== 'delivered' && (
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-7 px-2 border-green-300 text-green-800 hover:bg-green-50"
            onClick={() => handleUpdate('delivered')}
            disabled={updating || resending}
          >
            ✅ 已交收
          </Button>
        )}
        {/* 重發 Email 按鈕 */}
        <Button
          size="sm"
          variant="outline"
          className="text-xs h-7 px-2 border-violet-300 text-violet-700 hover:bg-violet-50 gap-1"
          onClick={handleResendEmail}
          disabled={updating || resending}
          title="重發得標通知 Email 給買家"
        >
          {resending ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Mail className="w-3 h-3" />
          )}
          {resending ? '發送中…' : '重發 Email'}
        </Button>
      </div>
    </div>
  );
}

export default function AdminWonOrders() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data: orders, isLoading, refetch } = trpc.wonAuctions.allOrders.useQuery();

  if (!user || user.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">您沒有權限查看此頁面</p>
      </div>
    );
  }

  const filtered = (orders ?? []).filter((o: WonOrder) => {
    const matchSearch = !search || o.title.toLowerCase().includes(search.toLowerCase()) || (o.winnerName ?? '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || o.paymentStatus === statusFilter || (statusFilter === 'unset' && !o.paymentStatus);
    return matchSearch && matchStatus;
  });

  // 統計
  const stats = {
    total: (orders ?? []).length,
    unset: (orders ?? []).filter((o: WonOrder) => !o.paymentStatus).length,
    pending: (orders ?? []).filter((o: WonOrder) => o.paymentStatus === 'pending_payment').length,
    paid: (orders ?? []).filter((o: WonOrder) => o.paymentStatus === 'paid').length,
    delivered: (orders ?? []).filter((o: WonOrder) => o.paymentStatus === 'delivered').length,
  };

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader />

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* 標題 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Trophy className="w-6 h-6 text-amber-500" />
              得標訂單管理
            </h1>
            <p className="text-sm text-muted-foreground mt-1">追蹤所有得標訂單的付款及交收進度</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" />
            刷新
          </Button>
        </div>

        {/* 統計卡片 */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: '全部訂單', value: stats.total, color: 'text-foreground' },
            { label: '未設定', value: stats.unset, color: 'text-gray-500' },
            { label: '待付款', value: stats.pending, color: 'text-yellow-700' },
            { label: '已付款', value: stats.paid, color: 'text-blue-700' },
            { label: '已交收', value: stats.delivered, color: 'text-green-700' },
          ].map((s) => (
            <Card key={s.label} className="text-center py-3">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </Card>
          ))}
        </div>

        {/* 搜尋和篩選 */}
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="搜尋拍賣名稱或得標者..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="篩選狀態" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部狀態</SelectItem>
              <SelectItem value="unset">未設定</SelectItem>
              <SelectItem value="pending_payment">待付款</SelectItem>
              <SelectItem value="paid">已付款</SelectItem>
              <SelectItem value="delivered">已交收</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* 訂單列表 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              訂單列表
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                共 {filtered.length} 筆{filtered.length !== (orders ?? []).length && `（已篩選）`}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-20 bg-muted rounded-lg animate-pulse" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Trophy className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p className="font-medium">沒有符合條件的訂單</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map((order: WonOrder) => (
                  <OrderRow key={order.id} order={order} onUpdate={() => refetch()} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
