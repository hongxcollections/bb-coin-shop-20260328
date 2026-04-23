import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trophy, Search, RefreshCw, ChevronLeft, Loader2, Phone } from "lucide-react";
import { toast } from "sonner";

function toWhatsAppUrl(phone: string, message: string): string {
  let digits = phone.replace(/\D/g, '');
  if (digits.length === 8) digits = '852' + digits;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

const PAYMENT_STATUS_CONFIG = {
  pending_payment: { label: "待付款", badgeClass: "border-yellow-300 bg-yellow-50 text-yellow-800" },
  paid: { label: "已付款", badgeClass: "border-blue-300 bg-blue-50 text-blue-800" },
  delivered: { label: "已交收", badgeClass: "border-green-300 bg-green-50 text-green-800" },
} as const;

type OrderStatus = keyof typeof PAYMENT_STATUS_CONFIG | null;

type MerchantOrder = {
  id: number;
  title: string;
  currentPrice: string;
  currency: string;
  endTime: Date | string;
  paymentStatus: string | null;
  winnerName: string | null;
  winnerOpenId: string | null;
  winnerPhone: string | null;
  winningAmount: string | null;
};

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <Badge variant="outline" className="border-gray-200 bg-gray-50 text-gray-500 text-xs">未設定</Badge>;
  const cfg = PAYMENT_STATUS_CONFIG[status as keyof typeof PAYMENT_STATUS_CONFIG];
  if (!cfg) return <Badge variant="outline" className="text-xs">{status}</Badge>;
  return <Badge variant="outline" className={`${cfg.badgeClass} text-xs`}>{cfg.label}</Badge>;
}

function OrderRow({ order, onUpdate, merchantName }: { order: MerchantOrder; onUpdate: () => void; merchantName: string }) {
  const [updating, setUpdating] = useState(false);

  const updateStatus = trpc.merchants.updateOrderStatus.useMutation({
    onSuccess: () => { toast.success("付款狀態已更新！"); onUpdate(); },
    onError: (err) => toast.error(err.message),
    onSettled: () => setUpdating(false),
  });

  const handleUpdate = (status: "pending_payment" | "paid" | "delivered") => {
    setUpdating(true);
    updateStatus.mutate({ auctionId: order.id, status });
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
              結標：{new Date(order.endTime).toLocaleString("zh-HK", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
        </div>
      </div>

      {/* 得標者 */}
      <div className="sm:w-40 min-w-0">
        <p className="text-xs text-muted-foreground">得標者</p>
        <p className="text-sm font-medium truncate">{order.winnerName ?? "—"}</p>
        {order.winnerPhone && (
          <div className="flex items-center gap-1 mt-0.5 flex-wrap">
            <p className="text-xs text-muted-foreground flex items-center gap-0.5">
              <Phone className="w-3 h-3" />{order.winnerPhone}
            </p>
            <a
              href={toWhatsAppUrl(order.winnerPhone, `您好，我是 ${merchantName}，您在 hongxcollections 競投的「${order.title}」已成功得標，成交價為 ${order.currency}$${order.winningAmount ? Number(order.winningAmount).toLocaleString() : ''}，請問方便安排付款及交收嗎？謝謝！`)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button size="sm" variant="outline" className="h-5 px-1.5 text-[10px] border-green-400 text-green-700 hover:bg-green-50">
                💬 WhatsApp
              </Button>
            </a>
          </div>
        )}
      </div>

      {/* 得標金額 */}
      <div className="sm:w-28">
        <p className="text-xs text-muted-foreground">得標金額</p>
        <p className="text-sm font-bold text-amber-700">
          {order.currency}${order.winningAmount ? Number(order.winningAmount).toLocaleString() : "—"}
        </p>
      </div>

      {/* 狀態 */}
      <div className="sm:w-20">
        <StatusBadge status={order.paymentStatus} />
      </div>

      {/* 操作按鈕 */}
      <div className="flex gap-1.5 flex-wrap items-center">
        {currentStatus !== "pending_payment" && (
          <Button size="sm" variant="outline" className="text-xs h-7 px-2 border-yellow-300 text-yellow-800 hover:bg-yellow-50"
            onClick={() => handleUpdate("pending_payment")} disabled={updating}>
            ⏳ 待付款
          </Button>
        )}
        {currentStatus !== "paid" && (
          <Button size="sm" variant="outline" className="text-xs h-7 px-2 border-blue-300 text-blue-800 hover:bg-blue-50"
            onClick={() => handleUpdate("paid")} disabled={updating}>
            💳 已付款
          </Button>
        )}
        {currentStatus !== "delivered" && (
          <Button size="sm" variant="outline" className="text-xs h-7 px-2 border-green-300 text-green-800 hover:bg-green-50"
            onClick={() => handleUpdate("delivered")} disabled={updating}>
            {updating ? <Loader2 className="w-3 h-3 animate-spin" /> : "✅"} 已交收
          </Button>
        )}
      </div>
    </div>
  );
}

export default function MerchantOrders() {
  const { user, isAuthenticated } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: orders, isLoading, isError, error, refetch } = trpc.merchants.myOrders.useQuery();
  const { data: myApp } = trpc.merchants.myApplication.useQuery(undefined, { enabled: isAuthenticated });
  const merchantName = myApp?.merchantName ?? user?.name ?? "商戶";

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">請先登入</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="max-w-4xl mx-auto px-4 pt-16 text-center space-y-3">
          <p className="text-destructive font-medium">載入訂單時發生錯誤</p>
          <p className="text-sm text-muted-foreground">{(error as { message?: string })?.message ?? '未知錯誤'}</p>
          <button onClick={() => refetch()} className="text-sm underline">重試</button>
        </div>
      </div>
    );
  }

  const filtered = (orders ?? []).filter((o: MerchantOrder) => {
    const matchSearch = !search || o.title.toLowerCase().includes(search.toLowerCase()) || (o.winnerName ?? "").toLowerCase().includes(search.toLowerCase()) || (o.winnerPhone ?? "").includes(search);
    const matchStatus = statusFilter === "all" || o.paymentStatus === statusFilter || (statusFilter === "unset" && !o.paymentStatus);
    return matchSearch && matchStatus;
  });

  const stats = {
    total: (orders ?? []).length,
    unset: (orders ?? []).filter((o: MerchantOrder) => !o.paymentStatus).length,
    pending: (orders ?? []).filter((o: MerchantOrder) => o.paymentStatus === "pending_payment").length,
    paid: (orders ?? []).filter((o: MerchantOrder) => o.paymentStatus === "paid").length,
    delivered: (orders ?? []).filter((o: MerchantOrder) => o.paymentStatus === "delivered").length,
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      {/* 吸附在主頭部導航下方的麵包屑欄 */}
      <div className="border-b bg-card sticky top-16 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-2 text-sm flex-wrap">
          <Link href="/merchant-dashboard">
            <span className="text-muted-foreground hover:text-foreground cursor-pointer flex items-center gap-1">
              <ChevronLeft className="w-3.5 h-3.5" />商戶後台
            </span>
          </Link>
          <span className="text-muted-foreground">/</span>
          <span className="font-medium text-amber-600">訂單管理</span>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 pt-6 pb-28 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Trophy className="w-6 h-6 text-amber-500" />
              訂單管理
            </h1>
            <p className="text-sm text-muted-foreground mt-1">查看你的拍賣得標訂單及付款進度</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" />刷新
          </Button>
        </div>

        {/* 統計卡片 */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: "全部訂單", value: stats.total, color: "text-foreground" },
            { label: "未設定", value: stats.unset, color: "text-gray-500" },
            { label: "待付款", value: stats.pending, color: "text-yellow-700" },
            { label: "已付款", value: stats.paid, color: "text-blue-700" },
            { label: "已交收", value: stats.delivered, color: "text-green-700" },
          ].map((s) => (
            <Card key={s.label} className="text-center py-3">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </Card>
          ))}
        </div>

        {/* 搜尋篩選 */}
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="搜尋拍賣名稱、得標者或電話…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36"><SelectValue placeholder="篩選狀態" /></SelectTrigger>
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
                共 {filtered.length} 筆{filtered.length !== (orders ?? []).length && "（已篩選）"}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-muted rounded-lg animate-pulse" />)}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Trophy className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p className="font-medium">沒有符合條件的訂單</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map((o: MerchantOrder) => (
                  <OrderRow key={o.id} order={o} onUpdate={() => refetch()} merchantName={merchantName} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
