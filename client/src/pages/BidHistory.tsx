import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, TrendingUp, Trophy, ChevronDown, ChevronUp, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { ShareMenu } from "@/components/ShareMenu";
import { MemberBadge } from "@/components/MemberBadge";
import Header from "@/components/Header";

const PAYMENT_STATUS_CONFIG = {
  pending_payment: { label: '待付款', color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: '⏳' },
  paid: { label: '已付款', color: 'bg-blue-100 text-blue-800 border-blue-200', icon: '💳' },
  delivered: { label: '已交收', color: 'bg-green-100 text-green-800 border-green-200', icon: '✅' },
} as const;

const ORDER_STATUS_CONFIG = {
  pending:   { label: '待確認', color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: '⏳' },
  confirmed: { label: '已確認', color: 'bg-green-100 text-green-800 border-green-200',  icon: '✅' },
  cancelled: { label: '已取消', color: 'bg-gray-100 text-gray-500 border-gray-200',     icon: '✕'  },
} as const;

type ProductOrderItem = {
  id: number;
  productId: number;
  merchantId: number;
  title: string;
  price: string;
  currency: string;
  quantity: number;
  status: 'pending' | 'confirmed' | 'cancelled';
  finalPrice?: string | null;
  buyerNote?: string | null;
  cancelReason?: string | null;
  createdAt: string;
  confirmedAt?: string | null;
  cancelledAt?: string | null;
  merchantName?: string | null;
};

function ProductOrderCard({ order, onCancel }: { order: ProductOrderItem; onCancel: () => void }) {
  const utils = trpc.useUtils();
  const cancel = trpc.productOrders.cancel.useMutation({
    onSuccess: () => { utils.productOrders.myBuyerOrders.invalidate(); toast.success('訂單已取消'); },
    onError: (e) => toast.error(e.message),
  });
  const deleteOrder = trpc.productOrders.deleteBuyerOrder.useMutation({
    onSuccess: () => { utils.productOrders.myBuyerOrders.invalidate(); toast.success('訂單紀錄已永久刪除'); },
    onError: (e) => toast.error(e.message),
  });

  const statusCfg = ORDER_STATUS_CONFIG[order.status] ?? { label: order.status, color: 'bg-gray-100 text-gray-500 border-gray-200', icon: '?' };
  const unitPrice = parseFloat(order.price);
  const finalPrice = order.finalPrice ? parseFloat(order.finalPrice) : null;
  const displayPrice = finalPrice ?? unitPrice * order.quantity;

  return (
    <div className="rounded-lg border border-amber-100 bg-amber-50/40 overflow-hidden">
      <div className="p-3 flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
          <ShoppingBag className="w-4 h-4 text-amber-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{order.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {order.merchantName ?? `商戶 #${order.merchantId}`}
            {order.quantity > 1 && <span className="ml-1.5">× {order.quantity}</span>}
            <span className="mx-1.5">·</span>
            {new Date(order.createdAt).toLocaleDateString('zh-HK', { year: 'numeric', month: 'short', day: 'numeric' })}
          </p>
          {order.buyerNote && (
            <p className="text-xs text-muted-foreground mt-1 italic">備註：{order.buyerNote}</p>
          )}
          {order.cancelReason && (
            <p className="text-xs text-red-500 mt-1">取消原因：{order.cancelReason}</p>
          )}
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-sm font-bold text-amber-700">{order.currency}${displayPrice.toLocaleString()}</p>
        </div>
      </div>
      <div className="px-3 pb-3 flex items-center gap-2 flex-wrap">
        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${statusCfg.color}`}>
          {statusCfg.icon} {statusCfg.label}
        </span>
        {order.status === 'pending' && (
          <button
            onClick={() => { if (confirm('確定取消此訂單？')) { cancel.mutate({ orderId: order.id }); onCancel(); } }}
            disabled={cancel.isPending}
            className="text-xs px-2 py-0.5 rounded-full border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50"
          >
            {cancel.isPending ? '取消中...' : '✕ 取消訂單'}
          </button>
        )}
        {(order.status === 'confirmed' || order.status === 'cancelled') && (
          <button
            onClick={() => {
              if (confirm('確定永久刪除此訂單紀錄？此操作不可還原。')) {
                deleteOrder.mutate({ orderId: order.id });
              }
            }}
            disabled={deleteOrder.isPending}
            className="text-xs px-2 py-0.5 rounded-full border border-gray-300 bg-gray-50 text-gray-500 hover:bg-red-50 hover:border-red-300 hover:text-red-600 transition-colors disabled:opacity-50 ml-auto"
          >
            {deleteOrder.isPending ? '刪除中...' : '🗑 刪除紀錄'}
          </button>
        )}
      </div>
    </div>
  );
}

type WonAuctionItemType = { id: number; title: string; currency: string; winningAmount: string; endTime: number; category?: string | null; bidCount: number; paymentStatus?: string | null; sellerName?: string | null; sellerWhatsapp?: string | null };

function toWhatsAppUrl(phone: string, message: string): string {
  let digits = phone.replace(/\D/g, '');
  if (digits.length === 8) digits = '852' + digits;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

function WonAuctionItem({ item }: { item: WonAuctionItemType }) {
  const utils = trpc.useUtils();
  const updateStatus = trpc.wonAuctions.updatePaymentStatus.useMutation({
    onSuccess: () => {
      utils.wonAuctions.myWon.invalidate();
      toast.success('付款狀態已更新！');
    },
    onError: (err) => toast.error(err.message),
  });

  const statusKey = (item.paymentStatus ?? null) as keyof typeof PAYMENT_STATUS_CONFIG | null;
  const statusConfig = statusKey ? PAYMENT_STATUS_CONFIG[statusKey] : null;

  return (
    <div className="rounded-lg border border-amber-100 bg-amber-50/50 overflow-hidden">
      <Link href={`/auctions/${item.id}`}>
        <div className="flex items-center gap-3 p-3 hover:bg-amber-100/60 transition-colors cursor-pointer">
          <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
            <Trophy className="w-4 h-4 text-amber-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
            <p className="text-xs text-muted-foreground">
              結標：{new Date(item.endTime).toLocaleDateString('zh-HK', { year: 'numeric', month: 'short', day: 'numeric' })}
              {item.category && <span className="ml-2 text-amber-600">#{item.category}</span>}
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-sm font-bold text-amber-700">{item.currency}${Number(item.winningAmount).toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">{item.bidCount} 口競標</p>
          </div>
        </div>
      </Link>
      <div className="px-3 pb-3 flex items-center gap-2 flex-wrap">
        {statusConfig ? (
          <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${statusConfig.color}`}>
            {statusConfig.icon} {statusConfig.label}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border border-gray-200 bg-gray-100 text-gray-500">
            未設定狀態
          </span>
        )}
        {(!statusKey || statusKey === 'pending_payment') && (
          <button
            onClick={() => updateStatus.mutate({ auctionId: item.id, status: 'paid' })}
            disabled={updateStatus.isPending}
            className="text-xs px-2 py-0.5 rounded-full border border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors disabled:opacity-50"
          >
            {updateStatus.isPending ? '更新中...' : '✓ 標記已付款'}
          </button>
        )}
        {item.sellerWhatsapp && (
          <a
            href={toWhatsAppUrl(item.sellerWhatsapp, `您好，我在大BB錢幣店以 ${item.currency}$${Number(item.winningAmount).toLocaleString()} 得標「${item.title}」，想查詢付款及交收安排，謝謝！`)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border border-green-300 bg-green-50 text-green-700 hover:bg-green-100 transition-colors"
          >
            💬 聯絡商戶
          </a>
        )}
      </div>
    </div>
  );
}

function BidHistoryPanel({ auctionId }: { auctionId: number }) {
  const { data: history, isLoading } = trpc.auctions.auctionBidHistory.useQuery({ auctionId });

  if (isLoading) {
    return (
      <div className="px-4 py-3 bg-amber-50/60 border-t border-amber-100 space-y-2">
        {[...Array(3)].map((_, i) => <div key={i} className="h-6 bg-amber-100 rounded animate-pulse" />)}
      </div>
    );
  }

  if (!history || history.length === 0) {
    return (
      <div className="px-4 py-3 bg-amber-50/60 border-t border-amber-100 text-xs text-muted-foreground text-center">
        尚無出價記錄
      </div>
    );
  }

  return (
    <div className="bg-amber-50/60 border-t border-amber-100">
      <div className="px-4 py-2 flex items-center justify-between">
        <span className="text-xs font-medium text-amber-800">完整競標過程（共 {history.length} 口）</span>
        <span className="text-xs text-muted-foreground">最新在上</span>
      </div>
      <div className="divide-y divide-amber-100">
        {history.map((h: { id: number; userId: number | null; username: string; bidAmount: number; createdAt: Date }, idx: number) => (
          <div key={h.id} className={`flex items-center justify-between px-4 py-2 ${idx === 0 ? 'bg-amber-100/60' : 'bg-white/60'}`}>
            <div className="flex items-center gap-2">
              {idx === 0 && <span className="text-[0.6rem] bg-amber-500 text-white px-1.5 py-0.5 rounded font-bold">最高</span>}
              {h.userId ? (
                <Link href={`/users/${h.userId}`}>
                  <span className="text-xs font-medium text-amber-700 hover:text-amber-900 hover:underline cursor-pointer">{h.username}</span>
                </Link>
              ) : (
                <span className="text-xs font-medium">{h.username}</span>
              )}
              <MemberBadge level={(h as { memberLevel?: string }).memberLevel} variant="icon" />
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-amber-700">HK${h.bidAmount.toLocaleString()}</span>
              <span className="text-[0.6rem] text-muted-foreground">{new Date(h.createdAt).toLocaleString('zh-HK')}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function BidHistory() {
  const { isAuthenticated, loading } = useAuth();
  const { data: myBids, isLoading } = trpc.auctions.myBids.useQuery(undefined, { enabled: isAuthenticated });
  const { data: wonAuctions, isLoading: wonLoading } = trpc.wonAuctions.myWon.useQuery(undefined, { enabled: isAuthenticated });
  const { data: myOrders, isLoading: ordersLoading } = trpc.productOrders.myBuyerOrders.useQuery(undefined, { enabled: isAuthenticated });
  const [expandedBidId, setExpandedBidId] = useState<number | null>(null);
  const [bidFilter, setBidFilter] = useState<'all' | 'active' | 'won'>('all');
  const [activeTab, setActiveTab] = useState<'bids' | 'won' | 'orders'>('bids');
  const [orderStatusFilter, setOrderStatusFilter] = useState<'pending' | 'confirmed' | 'cancelled'>('pending');
  const [orderPage, setOrderPage] = useState(1);
  const ORDER_PAGE_SIZE = 10;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4">🔒</div>
          <p className="text-lg font-medium mb-4">請先登入查看出價紀錄</p>
          <a href={getLoginUrl('/bid-history')}>
            <Button className="gold-gradient text-white border-0">立即登入</Button>
          </a>
        </div>
      </div>
    );
  }

  type BidGroup = {
    auctionId: number;
    auctionTitle: string | null;
    auctionStatus: string | null;
    auctionEndTime: number | null;
    auctionCurrency: string | null;
    latestBid: number;
    latestBidAt: Date | null;
    totalBids: number;
    isWinner: boolean;
    bids: Array<{ id: number; bidAmount: number; createdAt: Date | null }>;
  };
  const bidGroups: BidGroup[] = (myBids ?? []) as BidGroup[];

  const activeCount = bidGroups.filter(g => g.auctionStatus === 'active' && (g.auctionEndTime === null || g.auctionEndTime > Date.now())).length;
  const wonCount = bidGroups.filter(g => g.isWinner).length;

  const filteredGroups = bidGroups.filter(g => {
    if (bidFilter === 'active') return g.auctionStatus === 'active' && (g.auctionEndTime === null || g.auctionEndTime > Date.now());
    if (bidFilter === 'won') return g.isWinner;
    return true;
  });

  const tabs = [
    { key: 'bids' as const, label: '出價記錄', icon: <Clock className="w-3.5 h-3.5" />, count: (myBids ?? []).length },
    { key: 'won'  as const, label: '得標記錄', icon: <Trophy className="w-3.5 h-3.5" />, count: (wonAuctions ?? []).length },
    { key: 'orders' as const, label: '我的訂單', icon: <ShoppingBag className="w-3.5 h-3.5" />, count: (myOrders ?? []).length },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container pt-6 pb-28 max-w-3xl">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-amber-600" />
          <h1 className="text-xl font-bold text-amber-900">出價紀錄</h1>
        </div>

        {/* 分類 Tab */}
        <div className="flex gap-2 mb-5 border-b border-amber-100 pb-1">
          {tabs.map(tab => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-t transition-colors border-b-2 -mb-px ${
                activeTab === tab.key
                  ? 'border-amber-500 text-amber-700 bg-amber-50'
                  : 'border-transparent text-muted-foreground hover:text-amber-600 hover:bg-amber-50/50'
              }`}
            >
              {tab.icon}
              {tab.label}
              {tab.count > 0 && (
                <span className={`text-[0.6rem] px-1.5 py-0.5 rounded-full font-bold ${
                  activeTab === tab.key ? 'bg-amber-500 text-white' : 'bg-amber-100 text-amber-600'
                }`}>{tab.count}</span>
              )}
            </button>
          ))}
        </div>

        {/* 出價記錄 Tab */}
        {activeTab === 'bids' && (
          <Card className="border-amber-100">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="w-4 h-4 text-amber-600" />
                我的出價記錄
                {bidGroups.length > 0 && (
                  <span className="ml-auto text-xs font-normal text-muted-foreground">{filteredGroups.length} / {bidGroups.length} 件</span>
                )}
              </CardTitle>
              {bidGroups.length > 0 && (
                <div className="flex gap-1.5 mt-2">
                  {([
                    { key: 'all', label: '全部', count: bidGroups.length },
                    { key: 'active', label: '進行中', count: activeCount },
                    { key: 'won', label: '已得標', count: wonCount },
                  ] as const).map(tab => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setBidFilter(tab.key)}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                        bidFilter === tab.key
                          ? tab.key === 'won'
                            ? 'bg-amber-500 text-white'
                            : tab.key === 'active'
                            ? 'bg-green-500 text-white'
                            : 'bg-amber-700 text-white'
                          : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
                      }`}
                    >
                      {tab.key === 'won' && '🏆 '}{tab.label}
                      <span className={`text-[0.6rem] px-1 py-0.5 rounded-full font-bold ${
                        bidFilter === tab.key ? 'bg-white/30 text-white' : 'bg-amber-100 text-amber-600'
                      }`}>{tab.count}</span>
                    </button>
                  ))}
                </div>
              )}
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-14 bg-amber-50 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : bidGroups.length > 0 ? (
                <div className="space-y-2">
                  {filteredGroups.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <p className="text-sm">{bidFilter === 'active' ? '目前沒有進行中的競標' : '尚未得標任何商品'}</p>
                    </div>
                  )}
                  {filteredGroups.map((group) => {
                    const rawTitle = group.auctionTitle ?? '';
                    const isExpanded = expandedBidId === group.auctionId;
                    const statusLabel = group.auctionStatus === 'active' ? '進行中' : group.auctionStatus === 'ended' ? '已結束' : group.auctionStatus === 'draft' ? '草稿' : '';
                    const statusColor = group.auctionStatus === 'active' ? 'bg-green-100 text-green-700' : group.auctionStatus === 'ended' ? 'bg-gray-100 text-gray-500' : 'bg-amber-100 text-amber-600';
                    return (
                      <div key={group.auctionId} className="rounded-lg border overflow-hidden relative" style={{ borderColor: group.isWinner ? '#f59e0b' : undefined }}>
                        {group.isWinner && (
                          <span className="absolute top-0 right-0 z-10 text-[0.6rem] font-bold px-2 py-0.5 rounded-bl-lg rounded-tr-lg" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#fff', letterSpacing: '0.05em' }}>🏆 得標</span>
                        )}
                        <div className={`flex flex-col py-3 px-3 gap-2 transition-colors ${group.isWinner ? 'bg-amber-50 hover:bg-amber-100/70' : 'bg-white hover:bg-amber-50/50'}`}>
                          <Link href={`/auctions/${group.auctionId}`} className="flex items-center gap-2 min-w-0">
                            <div className="w-8 h-8 coin-placeholder rounded-lg flex items-center justify-center text-sm shrink-0">🪙</div>
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-semibold leading-snug truncate">拍賣 {rawTitle || '(未命名)'}</div>
                              <div className="flex items-center flex-wrap gap-1 mt-0.5">
                                {statusLabel && (
                                  <span className={`text-[0.6rem] px-1.5 py-0.5 rounded font-medium ${statusColor}`}>{statusLabel}</span>
                                )}
                                <span className="text-[0.6rem] text-muted-foreground">{group.totalBids} 口出價</span>
                                {group.latestBidAt && (
                                  <span className="text-[0.6rem] text-muted-foreground">· {new Date(group.latestBidAt).toLocaleString('zh-HK')}</span>
                                )}
                              </div>
                            </div>
                          </Link>
                          <div className="flex items-center justify-between">
                            <div className="font-bold text-amber-700 price-tag text-base">
                              HK${group.latestBid.toLocaleString()}
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <ShareMenu
                                auctionId={group.auctionId}
                                title={group.auctionTitle ?? ''}
                                latestBid={group.latestBid}
                                currency={group.auctionCurrency}
                                endTime={group.auctionEndTime}
                              />
                              <button
                                type="button"
                                onClick={() => setExpandedBidId(isExpanded ? null : group.auctionId)}
                                className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-800 border border-amber-200 hover:border-amber-400 rounded px-2 py-1 transition-colors bg-amber-50 hover:bg-amber-100"
                              >
                                {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                詳情
                              </button>
                            </div>
                          </div>
                        </div>
                        {isExpanded && (
                          <div>
                            <div className="bg-amber-50/60 border-t border-amber-100">
                              <div className="px-4 py-2 flex items-center justify-between">
                                <span className="text-xs font-medium text-amber-800">我的出價（共 {group.totalBids} 口）</span>
                                <span className="text-xs text-muted-foreground">最新在上</span>
                              </div>
                              <div className="divide-y divide-amber-100">
                                {group.bids.map((b, idx) => (
                                  <div key={b.id} className={`flex items-center justify-between px-4 py-2 ${idx === 0 ? 'bg-amber-100/60' : 'bg-white/60'}`}>
                                    <div className="flex items-center gap-2">
                                      {idx === 0 && <span className="text-[0.6rem] bg-amber-500 text-white px-1.5 py-0.5 rounded font-bold">最高</span>}
                                      <span className="text-xs text-muted-foreground">第 {group.totalBids - idx} 口</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <span className="text-xs font-bold text-amber-700">HK${b.bidAmount.toLocaleString()}</span>
                                      <span className="text-[0.6rem] text-muted-foreground">{b.createdAt ? new Date(b.createdAt).toLocaleString('zh-HK') : ''}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div className="border-t border-amber-200">
                              <div className="px-4 pt-2 pb-1">
                                <span className="text-xs font-semibold text-amber-900">📊 完整競標過程</span>
                              </div>
                              <BidHistoryPanel auctionId={group.auctionId} />
                            </div>
                            <div className="px-4 pb-2 pt-1 bg-amber-50/60">
                              <button type="button" onClick={() => setExpandedBidId(null)} className="text-[0.65rem] text-amber-600 hover:underline">收起</button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-10 text-muted-foreground">
                  <TrendingUp className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">尚未參與任何競標</p>
                  <p className="text-sm mt-1">前往拍賣列表開始競拍</p>
                  <Link href="/auctions">
                    <Button className="mt-4 gold-gradient text-white border-0">瀏覽拍賣</Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* 得標記錄 Tab */}
        {activeTab === 'won' && (
          <Card className="border-amber-100">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Trophy className="w-4 h-4 text-amber-500" />
                我的得標記錄
                {wonAuctions && wonAuctions.length > 0 && (
                  <span className="ml-auto text-xs font-normal text-muted-foreground">{wonAuctions.length} 件</span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {wonLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-16 bg-amber-50 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : !wonAuctions || wonAuctions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Trophy className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">尚未得標任何拍賣</p>
                  <p className="text-sm mt-1">繼續競標，期待您的第一件得標！</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {(wonAuctions as WonAuctionItemType[]).map((item) => (
                    <WonAuctionItem key={item.id} item={item} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* 我的訂單 Tab */}
        {activeTab === 'orders' && (() => {
          const allOrders = (myOrders ?? []) as ProductOrderItem[];
          const pendingCount   = allOrders.filter(o => o.status === 'pending').length;
          const confirmedCount = allOrders.filter(o => o.status === 'confirmed').length;
          const cancelledCount = allOrders.filter(o => o.status === 'cancelled').length;
          const statusOrders = allOrders.filter(o => o.status === orderStatusFilter);
          const totalPages = Math.max(1, Math.ceil(statusOrders.length / ORDER_PAGE_SIZE));
          const safePage = Math.min(orderPage, totalPages);
          const filteredOrders = statusOrders.slice((safePage - 1) * ORDER_PAGE_SIZE, safePage * ORDER_PAGE_SIZE);
          const orderStatusTabs = [
            { key: 'pending'   as const, label: '待確認', count: pendingCount,   color: 'bg-yellow-500' },
            { key: 'confirmed' as const, label: '已確認', count: confirmedCount, color: 'bg-green-500'  },
            { key: 'cancelled' as const, label: '已取消', count: cancelledCount, color: 'bg-gray-400'   },
          ];
          return (
            <Card className="border-amber-100">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShoppingBag className="w-4 h-4 text-amber-600" />
                  我的訂單
                  {allOrders.length > 0 && (
                    <span className="ml-auto text-xs font-normal text-muted-foreground">{allOrders.length} 件</span>
                  )}
                </CardTitle>
                {allOrders.length > 0 && (
                  <div className="flex gap-1.5 mt-2">
                    {orderStatusTabs.map(t => (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => { setOrderStatusFilter(t.key); setOrderPage(1); }}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                          orderStatusFilter === t.key
                            ? `${t.color} text-white`
                            : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
                        }`}
                      >
                        {t.label}
                        <span className={`text-[0.6rem] px-1 py-0.5 rounded-full font-bold ${
                          orderStatusFilter === t.key ? 'bg-white/30 text-white' : 'bg-amber-100 text-amber-600'
                        }`}>{t.count}</span>
                      </button>
                    ))}
                  </div>
                )}
              </CardHeader>
              <CardContent>
                {ordersLoading ? (
                  <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="h-16 bg-amber-50 rounded-lg animate-pulse" />
                    ))}
                  </div>
                ) : allOrders.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <ShoppingBag className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">尚未購買任何商品</p>
                    <p className="text-sm mt-1">前往商戶商店選購</p>
                    <Link href="/merchants">
                      <Button className="mt-4 gold-gradient text-white border-0">瀏覽商戶</Button>
                    </Link>
                  </div>
                ) : filteredOrders.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <ShoppingBag className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">沒有{orderStatusTabs.find(t => t.key === orderStatusFilter)?.label}的訂單</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredOrders.map((order) => (
                      <ProductOrderCard key={order.id} order={order} onCancel={() => {}} />
                    ))}
                    {totalPages > 1 && (
                      <div className="flex items-center justify-between pt-2 border-t border-amber-100">
                        <button
                          type="button"
                          disabled={safePage <= 1}
                          onClick={() => setOrderPage(p => Math.max(1, p - 1))}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          ‹ 上頁
                        </button>
                        <span className="text-xs text-muted-foreground">
                          第 {safePage} / {totalPages} 頁（共 {statusOrders.length} 筆）
                        </span>
                        <button
                          type="button"
                          disabled={safePage >= totalPages}
                          onClick={() => setOrderPage(p => Math.min(totalPages, p + 1))}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          下頁 ›
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })()}
      </div>
    </div>
  );
}
