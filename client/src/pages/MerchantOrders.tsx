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
      {/* 行1：拍賣名稱（截短） */}
      <div className="flex items-center gap-1.5 min-w-0">
        <Trophy className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
        <Link href={`/auctions/${order.id}`}>
          <span className="text-sm font-medium hover:text-amber-600 cursor-pointer truncate block max-w-[220px]">{order.title}</span>
        </Link>
      </div>

      {/* 行2：得標者 + 金額 + 日期 */}
      <div className="flex items-center gap-2 mt-1 pl-5 text-xs">
        <span className="text-foreground font-medium truncate max-w-[90px]">{order.winnerName ?? "—"}</span>
        <span className="text-amber-700 font-bold whitespace-nowrap">{order.currency}${amount}</span>
        <span className="text-muted-foreground whitespace-nowrap ml-auto">{dateStr} {timeStr}</span>
      </div>

      {/* 行3：電話 + WhatsApp */}
      {order.winnerPhone ? (
        <div className="flex items-center gap-1.5 mt-1 pl-5">
          <span className="text-xs text-muted-foreground whitespace-nowrap">{order.winnerPhone}</span>
          <a href={toWhatsAppUrl(order.winnerPhone, waMsg)} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="outline" className="h-5 px-1.5 text-[10px] border-green-400 text-green-700 hover:bg-green-50">
              💬 WhatsApp
            </Button>
          </a>
        </div>
      ) : (
        <div className="mt-1 pl-5 h-5" />
      )}

      {/* 行4：狀態切換（獨立一行） */}
      <div className="mt-1.5 pl-5">
        {updating ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
        ) : (
          <div className="inline-flex rounded overflow-hidden border border-border text-[10px]">
            {([
              { key: "pending_payment", label: "⏳ 待付款", activeClass: "bg-yellow-400 text-yellow-900 font-medium" },
              { key: "paid",            label: "💳 已付款", activeClass: "bg-blue-500 text-white font-medium" },
              { key: "delivered",       label: "✅ 已交收", activeClass: "bg-green-500 text-white font-medium" },
            ] as const).map(({ key, label, activeClass }, i) => (
              <button
                key={key}
                onClick={() => { if (cur !== key) handleUpdate(key); }}
                className={[
                  "px-2.5 py-1 whitespace-nowrap transition-colors",
                  i > 0 ? "border-l border-border" : "",
                  cur === key ? activeClass : "bg-muted/40 text-muted-foreground hover:bg-muted",
                ].join(" ")}
              >
                {label}
              </button>
            ))}
          </div>
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

  const allOrders = (orders ?? []) as MerchantOrder[];
  const wonOrders = useMemo(() => allOrders.filter(o => !!o.winnerName), [allOrders]);
  const flowPaiOrders = useMemo(() => allOrders.filter(o => !o.winnerName), [allOrders]);

  const uniqueWinners = useMemo(() => {
    const names = wonOrders.map(o => o.winnerName).filter((n): n is string => !!n);
    return [...new Set(names)].sort();
  }, [wonOrders]);

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const dateOptions = useMemo(() => [
    { value: "all", label: "全部日期" },
    ...Array.from({ length: 4 }, (_, i) => {
      const d = new Date(startOfDay);
      d.setDate(d.getDate() - i);
      const label = i === 0 ? "今日" : i === 1 ? "昨日" : i === 2 ? "前日"
        : `${d.getMonth() + 1}/${d.getDate()}`;
      return { value: d.toDateString(), label: `${label}（${d.getMonth() + 1}/${d.getDate()}）` };
    }),
    { value: "month", label: "本月" },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [startOfDay.toDateString()]);

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

  const filteredWon = wonOrders.filter((o) => {
    if (statusFilter !== "all" && o.paymentStatus !== statusFilter) return false;

    if (dateFilter !== "all" && dateFilter !== "month") {
      const end = new Date(o.endTime);
      const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
      if (endDay.toDateString() !== dateFilter) return false;
    }
    if (dateFilter === "month") {
      const end = new Date(o.endTime);
      if (end < startOfMonth) return false;
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
    total: wonOrders.length,
    pending: wonOrders.filter(o => o.paymentStatus === "pending_payment").length,
    paid: wonOrders.filter(o => o.paymentStatus === "paid").length,
    delivered: wonOrders.filter(o => o.paymentStatus === "delivered").length,
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
            <p className="text-xs text-muted-foreground mt-0.5">得標 {stats.total} 筆　流拍 {flowPaiOrders.length} 筆</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1.5 h-8 text-xs">
            <RefreshCw className="w-3.5 h-3.5" />刷新
          </Button>
        </div>

        {/* 統計卡片：只計得標訂單 */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "全部得標", value: stats.total,     color: "text-foreground",  key: "all" },
            { label: "待付款",   value: stats.pending,   color: "text-yellow-700",  key: "pending_payment" },
            { label: "已付款",   value: stats.paid,      color: "text-blue-700",    key: "paid" },
            { label: "已交收",   value: stats.delivered, color: "text-green-700",   key: "delivered" },
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
            <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="結標日期" /></SelectTrigger>
            <SelectContent>
              {dateOptions.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
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

        {/* 得標訂單列表 */}
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm flex items-center gap-1.5">
              🏆 得標訂單
              <span className="font-normal text-muted-foreground">
                {filteredWon.length !== wonOrders.length
                  ? `${filteredWon.length} / ${wonOrders.length} 筆`
                  : `共 ${filteredWon.length} 筆`}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            {isLoading ? (
              <div className="space-y-2">
                {[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-muted rounded-lg animate-pulse" />)}
              </div>
            ) : filteredWon.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Trophy className="w-8 h-8 mx-auto mb-2 opacity-20" />
                <p className="text-sm">沒有符合條件的得標訂單</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {filteredWon.map((o: MerchantOrder) => (
                  <OrderRow key={o.id} order={o} onUpdate={() => refetch()} merchantName={merchantName} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 流拍記錄（獨立分區） */}
        {flowPaiOrders.length > 0 && (
          <Card className="border-dashed border-muted-foreground/30">
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm flex items-center gap-1.5 text-muted-foreground">
                🔕 流拍記錄
                <span className="font-normal">共 {flowPaiOrders.length} 筆</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <div className="space-y-1.5">
                {flowPaiOrders.map((o: MerchantOrder) => (
                  <div key={o.id} className="px-3 py-2 rounded-lg border border-dashed bg-muted/20">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-xs text-muted-foreground flex-shrink-0">🔕</span>
                      <Link href={`/auctions/${o.id}`}>
                        <span className="text-sm text-muted-foreground hover:text-foreground cursor-pointer truncate block max-w-[200px]">{o.title}</span>
                      </Link>
                      <span className="ml-auto text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
                        起拍 {o.currency}${Number(o.currentPrice).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 pl-5">
                      結標：{new Date(o.endTime).toLocaleDateString("zh-HK", { month: "numeric", day: "numeric" })}　無人出價
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
