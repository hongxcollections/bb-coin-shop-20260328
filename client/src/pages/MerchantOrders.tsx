import { useMemo, useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trophy, Search, RefreshCw, ChevronLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";

function toWhatsAppUrl(phone: string, message: string): string {
  let digits = phone.replace(/\D/g, '');
  if (digits.length === 8) digits = '852' + digits;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

const STATUS_CFG = {
  pending_payment: { label: "待付款", badge: "border-yellow-300 bg-yellow-50 text-yellow-800" },
  paid:            { label: "已付款", badge: "border-blue-300 bg-blue-50 text-blue-800" },
  delivered:       { label: "已交收", badge: "border-green-300 bg-green-50 text-green-800" },
} as const;

type OrderStatus = keyof typeof STATUS_CFG | null;

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
  if (!status) return <Badge variant="outline" className="border-gray-200 bg-gray-50 text-gray-400 text-[10px] px-1.5 py-0">未設定</Badge>;
  const cfg = STATUS_CFG[status as keyof typeof STATUS_CFG];
  if (!cfg) return <Badge variant="outline" className="text-[10px] px-1.5 py-0">{status}</Badge>;
  return <Badge variant="outline" className={`${cfg.badge} text-[10px] px-1.5 py-0`}>{cfg.label}</Badge>;
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

  const cur = order.paymentStatus as OrderStatus;
  const endDate = new Date(order.endTime);
  const dateStr = endDate.toLocaleDateString("zh-HK", { month: "numeric", day: "numeric" });
  const timeStr = endDate.toLocaleTimeString("zh-HK", { hour: "2-digit", minute: "2-digit" });
  const amount = order.winningAmount ? Number(order.winningAmount).toLocaleString() : "—";
  const waMsg = `您好，我是 ${merchantName}，您在 hongxcollections 競投的「${order.title}」已成功得標，成交價為 ${order.currency}$${order.winningAmount ? Number(order.winningAmount).toLocaleString() : ''}，請問方便安排付款及交收嗎？謝謝！`;

  return (
    <div className="px-3 py-2.5 rounded-lg border bg-card hover:bg-accent/5 transition-colors">
      {/* 行一：拍賣名稱 + 日期 + 金額 + 狀態 */}
      <div className="flex items-center gap-2 min-w-0">
        <Trophy className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
        <Link href={`/auctions/${order.id}`}>
          <span className="text-sm font-medium hover:text-amber-600 truncate cursor-pointer flex-1 min-w-0 block">{order.title}</span>
        </Link>
        <span className="text-[10px] text-muted-foreground whitespace-nowrap flex-shrink-0">{dateStr} {timeStr}</span>
        <span className="text-sm font-bold text-amber-700 whitespace-nowrap flex-shrink-0">{order.currency}${amount}</span>
        <StatusBadge status={order.paymentStatus} />
      </div>

      {/* 行二：得標者 + 電話 + WhatsApp + 操作按鈕 */}
      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap pl-5">
        <span className="text-xs text-muted-foreground">
          {order.winnerName ?? "—"}
        </span>
        {order.winnerPhone && (
          <>
            <span className="text-xs text-muted-foreground">· {order.winnerPhone}</span>
            <a href={toWhatsAppUrl(order.winnerPhone, waMsg)} target="_blank" rel="noopener noreferrer">
              <Button size="sm" variant="outline" className="h-5 px-1.5 text-[10px] border-green-400 text-green-700 hover:bg-green-50">
                💬 WhatsApp
              </Button>
            </a>
          </>
        )}
        <div className="flex-1" />
        {updating ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
        ) : (
          <>
            {cur !== "pending_payment" && (
              <Button size="sm" variant="outline" className="h-5 px-1.5 text-[10px] border-yellow-300 text-yellow-800 hover:bg-yellow-50"
                onClick={() => handleUpdate("pending_payment")}>⏳ 待付款</Button>
            )}
            {cur !== "paid" && (
              <Button size="sm" variant="outline" className="h-5 px-1.5 text-[10px] border-blue-300 text-blue-800 hover:bg-blue-50"
                onClick={() => handleUpdate("paid")}>💳 已付款</Button>
            )}
            {cur !== "delivered" && (
              <Button size="sm" variant="outline" className="h-5 px-1.5 text-[10px] border-green-300 text-green-800 hover:bg-green-50"
                onClick={() => handleUpdate("delivered")}>✅ 已交收</Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function MerchantOrders() {
  const { user, isAuthenticated } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [winnerFilter, setWinnerFilter] = useState("all");

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

  const allOrders = (orders ?? []) as MerchantOrder[];

  const uniqueWinners = useMemo(() => {
    const names = allOrders.map(o => o.winnerName).filter((n): n is string => !!n);
    return [...new Set(names)].sort();
  }, [allOrders]);

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfDay);
  startOfWeek.setDate(startOfDay.getDate() - startOfDay.getDay());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const filtered = allOrders.filter((o) => {
    if (statusFilter !== "all") {
      if (statusFilter === "unset" && o.paymentStatus) return false;
      if (statusFilter !== "unset" && o.paymentStatus !== statusFilter) return false;
    }

    if (dateFilter !== "all") {
      const end = new Date(o.endTime);
      if (dateFilter === "today" && end < startOfDay) return false;
      if (dateFilter === "week" && end < startOfWeek) return false;
      if (dateFilter === "month" && end < startOfMonth) return false;
    }

    if (winnerFilter !== "all" && o.winnerName !== winnerFilter) return false;

    if (search) {
      const q = search.toLowerCase();
      const hit = o.title.toLowerCase().includes(q) ||
        (o.winnerName ?? "").toLowerCase().includes(q) ||
        (o.winnerPhone ?? "").includes(q);
      if (!hit) return false;
    }

    return true;
  });

  const stats = {
    total: allOrders.length,
    unset: allOrders.filter(o => !o.paymentStatus).length,
    pending: allOrders.filter(o => o.paymentStatus === "pending_payment").length,
    paid: allOrders.filter(o => o.paymentStatus === "paid").length,
    delivered: allOrders.filter(o => o.paymentStatus === "delivered").length,
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
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

      <div className="max-w-4xl mx-auto px-4 pt-5 pb-28 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500" />訂單管理
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">共 {stats.total} 筆訂單</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1.5 h-8 text-xs">
            <RefreshCw className="w-3.5 h-3.5" />刷新
          </Button>
        </div>

        {/* 統計卡片 */}
        <div className="grid grid-cols-5 gap-2">
          {[
            { label: "全部", value: stats.total, color: "text-foreground", key: "all" },
            { label: "未設定", value: stats.unset, color: "text-gray-500", key: "unset" },
            { label: "待付款", value: stats.pending, color: "text-yellow-700", key: "pending_payment" },
            { label: "已付款", value: stats.paid, color: "text-blue-700", key: "paid" },
            { label: "已交收", value: stats.delivered, color: "text-green-700", key: "delivered" },
          ].map((s) => (
            <button
              key={s.key}
              onClick={() => setStatusFilter(statusFilter === s.key ? "all" : s.key)}
              className={`rounded-lg border py-2 text-center transition-all ${statusFilter === s.key ? "ring-2 ring-amber-400 bg-amber-50 border-amber-300" : "bg-card hover:bg-accent/10"}`}
            >
              <p className={`text-xl font-bold leading-none ${s.color}`}>{s.value}</p>
              <p className="text-[10px] text-muted-foreground mt-1 leading-none">{s.label}</p>
            </button>
          ))}
        </div>

        {/* 篩選列 */}
        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-1 min-w-36">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="搜尋名稱 / 得標者 / 電話"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>

          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="w-28 h-8 text-xs"><SelectValue placeholder="結標日期" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部日期</SelectItem>
              <SelectItem value="today">今日</SelectItem>
              <SelectItem value="week">本週</SelectItem>
              <SelectItem value="month">本月</SelectItem>
            </SelectContent>
          </Select>

          <Select value={winnerFilter} onValueChange={setWinnerFilter}>
            <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="得標者" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部得標者</SelectItem>
              {uniqueWinners.map(name => (
                <SelectItem key={name} value={name}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 訂單列表 */}
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm flex items-center gap-1.5">
              訂單列表
              <span className="font-normal text-muted-foreground">
                {filtered.length !== allOrders.length
                  ? `${filtered.length} / ${allOrders.length} 筆`
                  : `共 ${filtered.length} 筆`}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            {isLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => <div key={i} className="h-14 bg-muted rounded-lg animate-pulse" />)}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <Trophy className="w-10 h-10 mx-auto mb-2 opacity-20" />
                <p className="text-sm">沒有符合條件的訂單</p>
              </div>
            ) : (
              <div className="space-y-1.5">
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
