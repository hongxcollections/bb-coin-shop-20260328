import { useState, useEffect } from "react";
import { useRoute, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Clock, ChevronLeft, User, TrendingUp, History, ArrowUpCircle, ChevronDown } from "lucide-react";
import { getCurrencySymbol } from "./AdminAuctions";

function CountdownTimer({ endTime }: { endTime: Date }) {
  const [timeLeft, setTimeLeft] = useState("");
  const [status, setStatus] = useState<"active" | "ending" | "ended">("active");

  useEffect(() => {
    function update() {
      const now = new Date();
      const diff = new Date(endTime).getTime() - now.getTime();
      if (diff <= 0) { setTimeLeft("拍賣已結束"); setStatus("ended"); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setStatus(h < 1 ? "ending" : "active");
      setTimeLeft(h > 0 ? `${h} 時 ${m} 分 ${s} 秒` : `${m} 分 ${s} 秒`);
    }
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [endTime]);

  const cls = status === "ended" ? "countdown-badge countdown-ended text-sm px-3 py-1.5" : status === "ending" ? "countdown-badge countdown-ending text-sm px-3 py-1.5" : "countdown-badge countdown-active text-sm px-3 py-1.5";
  return <span className={cls}><Clock className="w-4 h-4" />{timeLeft}</span>;
}

function formatDate(date: Date) {
  return new Date(date).toLocaleString("zh-HK", {
    year: "numeric", month: "long", day: "numeric",
    weekday: "short", hour: "2-digit", minute: "2-digit",
  });
}

export default function AuctionDetail() {
  const [, params] = useRoute("/auctions/:id");
  const auctionId = parseInt(params?.id ?? "0");
  const { user, isAuthenticated } = useAuth();
  const [bidAmount, setBidAmount] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [bidMessage, setBidMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);
  const [bidMsgExiting, setBidMsgExiting] = useState(false);

  const dismissBidMessage = () => {
    setBidMsgExiting(true);
    setTimeout(() => { setBidMessage(null); setBidMsgExiting(false); }, 400);
  };

  const { data: auction, isLoading, refetch } = trpc.auctions.detail.useQuery({ id: auctionId });
  const [selectedImage, setSelectedImage] = useState(0);

  const placeBid = trpc.auctions.placeBid.useMutation({
    onSuccess: () => {
      setBidMsgExiting(false);
      setBidMessage({ type: "success", text: "✅ 出價成功！您目前是最高出價者" });
      setBidAmount("");
      refetch();
      setTimeout(() => { setBidMsgExiting(true); setTimeout(() => { setBidMessage(null); setBidMsgExiting(false); }, 400); }, 5600);
    },
    onError: (err) => {
      setBidMsgExiting(false);
      setBidMessage({ type: "error", text: `❌ ${err.message || "出價失敗，請重試"}` });
      setTimeout(() => { setBidMsgExiting(true); setTimeout(() => { setBidMessage(null); setBidMsgExiting(false); }, 400); }, 5600);
    },
  });

  const handleBid = () => {
    const amount = parseFloat(bidAmount);
    if (isNaN(amount) || amount <= 0) {
      setBidMsgExiting(false);
      setBidMessage({ type: "error", text: "❌ 請輸入有效的出價金額" });
      setTimeout(() => { setBidMsgExiting(true); setTimeout(() => { setBidMessage(null); setBidMsgExiting(false); }, 400); }, 5600);
      return;
    }
    setBidMessage({ type: "info", text: "⏳ 出價處理中，請稍候..." });
    placeBid.mutate({ auctionId, bidAmount: amount });
  };

  // 使用 bidIncrement 計算最低出價金額
  const bidIncrement = auction?.bidIncrement ?? 30;
  const currency = (auction as { currency?: string })?.currency ?? 'HKD';
  const currencySymbol = getCurrencySymbol(currency);
  const currentPrice = auction ? Number(auction.currentPrice) : 0;
  const minBid = currentPrice + bidIncrement;

  // 快速出價按鈕：最低出價、最低+1口、最低+2口
  const quickBidOptions = auction ? [
    { label: `${currencySymbol}${minBid.toLocaleString()}`, value: minBid },
    { label: `${currencySymbol}${(minBid + bidIncrement).toLocaleString()}`, value: minBid + bidIncrement },
    { label: `${currencySymbol}${(minBid + bidIncrement * 2).toLocaleString()}`, value: minBid + bidIncrement * 2 },
  ] : [];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-spin">🪙</div>
          <p className="text-muted-foreground">載入中...</p>
        </div>
      </div>
    );
  }

  if (!auction) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4">😕</div>
          <p className="text-lg font-medium mb-4">找不到此拍賣</p>
          <Link href="/auctions"><Button className="gold-gradient text-white border-0">返回拍賣列表</Button></Link>
        </div>
      </div>
    );
  }

  const images = auction.images as Array<{ id: number; imageUrl: string }>;
  const bids = auction.bidHistory as Array<{ id: number; userId: number; bidAmount: string; createdAt: Date; username?: string | null }>;
  const isActive = auction.status === "active" && new Date() < new Date(auction.endTime);

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="nav-glass sticky top-0 z-50">
        <div className="container flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2 font-bold text-xl">
            <span className="text-2xl">💰</span>
            <span className="gold-gradient-text">大BB錢幣店</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/auctions">
              <Button variant="ghost" size="sm" className="text-amber-700 hover:text-amber-900 hover:bg-amber-50">所有拍賣</Button>
            </Link>
            {isAuthenticated ? (
              <>
                {user?.role === "admin" && (
                  <Link href="/admin">
                    <Button variant="ghost" size="sm" className="text-amber-700 hover:text-amber-900 hover:bg-amber-50">管理後台</Button>
                  </Link>
                )}
                <Link href="/profile">
                  <Button variant="outline" size="sm" className="border-amber-300 text-amber-800 hover:bg-amber-50">{user?.name ?? "個人資料"}</Button>
                </Link>
              </>
            ) : (
              <a href={getLoginUrl()}>
                <Button size="sm" className="gold-gradient text-white border-0 shadow-md hover:opacity-90">立即登入</Button>
              </a>
            )}
          </div>
        </div>
      </nav>

      <div className="container py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-6 text-sm text-muted-foreground">
          <Link href="/auctions" className="flex items-center gap-1 hover:text-amber-700 transition-colors">
            <ChevronLeft className="w-4 h-4" /> 返回拍賣列表
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left: Images */}
          <div>
            <div className="aspect-square rounded-2xl overflow-hidden bg-amber-50 border border-amber-100 mb-3">
              {images.length > 0 ? (
                <img
                  src={images[selectedImage]?.imageUrl}
                  alt={auction.title}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="w-full h-full coin-placeholder flex items-center justify-center">
                  <span className="text-8xl">🪙</span>
                </div>
              )}
            </div>
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
                {images.map((img, i) => (
                  <button
                    key={img.id}
                    onClick={() => setSelectedImage(i)}
                    className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${selectedImage === i ? "border-amber-500" : "border-transparent hover:border-amber-300"}`}
                  >
                    <img src={img.imageUrl} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right: Details */}
          <div className="flex flex-col gap-5">
            {/* Title & Status */}
            <div>
              <div className="flex items-start justify-between gap-3 mb-2">
                <h1 className="text-2xl font-bold leading-tight">{auction.title}</h1>
                <Badge className={isActive ? "bg-emerald-500 text-white shrink-0" : "bg-gray-400 text-white shrink-0"}>
                  {isActive ? "競拍中" : "已結束"}
                </Badge>
              </div>
              {auction.description && (
                <p className="text-muted-foreground text-sm leading-relaxed">{auction.description}</p>
              )}
            </div>

            {/* Price Card */}
            <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-50">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                      當前最高出價
                      {bids.length > 0 && (
                        <span className="text-[9px] text-red-500 font-semibold">({bids[0].username ?? `用戶 #${bids[0].userId}`})</span>
                      )}
                    </div>
                    <div className="text-3xl font-extrabold text-amber-600 price-tag">
                      {currencySymbol}{Number(auction.currentPrice).toLocaleString()}
                      <span className="text-base font-normal text-amber-500 ml-1">{currency}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      起拍價：{currencySymbol}{Number(auction.startingPrice).toLocaleString()}
                    </div>
                  </div>
                  <div className="text-right space-y-1 relative">
                    {/* Bid Message — floating pop-up above 出價次數 */}
                    {bidMessage && (
                      <div className={`absolute bottom-full right-0 mb-2 z-20 w-64 rounded-lg text-xs font-medium border shadow-lg overflow-hidden ${
                        bidMessage.type === "success"
                          ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                          : bidMessage.type === "info"
                          ? "bg-blue-50 border-blue-200 text-blue-700 bid-processing-card"
                          : "bg-red-50 border-red-200 text-red-700"
                      } ${bidMsgExiting ? "bid-msg-exit" : "bid-msg-enter"}`}>
                        <div className="px-3 py-2 flex items-center justify-between">
                          {bidMessage.type === "info" ? (
                            <span className="flex items-center gap-1.5">
                              <span className="bid-coin text-base" aria-hidden="true">🪙</span>
                              <span className="bid-shimmer-text">出價處理中</span>
                              <span className="flex items-center gap-0.5 ml-0.5">
                                <span className="bid-dot" />
                                <span className="bid-dot" />
                                <span className="bid-dot" />
                              </span>
                            </span>
                          ) : (
                            <span className="flex-1">{bidMessage.text}</span>
                          )}
                          <button
                            onClick={dismissBidMessage}
                            className="ml-2 opacity-50 hover:opacity-100 transition-opacity flex-shrink-0"
                            aria-label="關閉"
                          >✕</button>
                        </div>
                        {bidMessage.type !== "info" && !bidMsgExiting && (
                          <div
                            key={bidMessage.text}
                            className={`bid-progress-bar ${
                              bidMessage.type === "success"
                                ? "bg-emerald-400"
                                : "bg-red-400"
                            }`}
                          />
                        )}
                      </div>
                    )}
                    <div>
                      <div className="text-xs text-muted-foreground mb-0.5">出價次數</div>
                      <div className="flex items-center gap-1 text-amber-700 font-bold justify-end">
                        <TrendingUp className="w-4 h-4" />
                        {bids.length}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-0.5">每口加幅</div>
                      <div className="flex items-center gap-1 text-amber-700 font-bold justify-end">
                        <ArrowUpCircle className="w-4 h-4" />
                        {currencySymbol}{bidIncrement}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Countdown */}
                <div className="flex items-center gap-2 mb-4">
                  <CountdownTimer endTime={new Date(auction.endTime)} />
                  <span className="text-xs text-muted-foreground">
                    結束：{formatDate(new Date(auction.endTime))}
                  </span>
                </div>

                {/* Bid Input */}
                {isActive && (
                  isAuthenticated ? (
                    <div className="space-y-2">
                      {/* Quick bid buttons */}
                      <div className="flex gap-2">
                        {quickBidOptions.map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setBidAmount(String(opt.value))}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                              bidAmount === String(opt.value)
                                ? "bg-amber-500 text-white border-amber-500"
                                : "bg-white text-amber-700 border-amber-200 hover:border-amber-400 hover:bg-amber-50"
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                      {/* Manual input + bid button */}
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">{currencySymbol}</span>
                          <Input
                            type="number"
                            placeholder={`最低 ${minBid}`}
                            value={bidAmount}
                            onChange={(e) => setBidAmount(e.target.value)}
                            className="pl-10 border-amber-300 focus-visible:ring-amber-400"
                            min={minBid}
                          />
                        </div>
                        <Button
                          onClick={handleBid}
                          disabled={placeBid.isPending}
                          className="gold-gradient text-white border-0 shadow-md hover:opacity-90 px-6"
                        >
                          {placeBid.isPending ? "出價中..." : "立即出價"}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground text-center">
                        最低出價：{currencySymbol}{minBid.toLocaleString()}（現價 + 每口加幅 {currencySymbol}{bidIncrement}）
                      </p>
                    </div>
                  ) : (
                    <a href={getLoginUrl()}>
                      <Button className="w-full gold-gradient text-white border-0 shadow-md hover:opacity-90">
                        登入後出價
                      </Button>
                    </a>
                  )
                )}
              </CardContent>
            </Card>

            {/* Bid History — Collapsible Dropdown */}
            <div className="rounded-xl border border-amber-100 overflow-hidden bg-white shadow-sm">
              {/* Header trigger */}
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-amber-50 transition-colors group"
              >
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-amber-600" />
                  <span className="text-sm font-semibold text-amber-900">出價記錄</span>
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 text-amber-700 text-xs font-bold">{bids.length}</span>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-amber-500 transition-transform duration-300 ${showHistory ? "rotate-180" : "rotate-0"}`}
                />
              </button>

              {/* Collapsible content */}
              <div
                className="transition-all duration-300 ease-in-out overflow-hidden"
                style={{ maxHeight: showHistory ? "320px" : "0px", opacity: showHistory ? 1 : 0 }}
              >
                <div className="border-t border-amber-100 px-4 py-3">
                  {bids.length > 0 ? (
                    <div className="space-y-2 max-h-60 overflow-y-auto scrollbar-thin pr-1">
                      {bids.map((bid, i) => (
                        <div key={bid.id} className={`flex items-center justify-between py-2 px-3 rounded-lg text-sm ${i === 0 ? "bg-amber-50 border border-amber-200" : "bg-muted/30"}`}>
                          <div className="flex items-center gap-2">
                            <User className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="text-muted-foreground">{bid.username ?? `用戶 #${bid.userId}`}</span>
                            {i === 0 && <Badge className="bg-amber-500 text-white text-xs py-0">最高</Badge>}
                          </div>
                          <div className="font-bold text-amber-700 price-tag">
                            {currencySymbol}{Number(bid.bidAmount).toLocaleString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-muted-foreground text-sm">
                      <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      暫無出價記錄，成為第一位出價者！
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
