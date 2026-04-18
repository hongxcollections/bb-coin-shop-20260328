import { useState, useEffect, useRef } from "react";
import { useRoute, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Clock, ChevronLeft, User, TrendingUp, History, ArrowUpCircle, ChevronDown, Bot, X, EyeOff, AlertCircle, Heart, Share2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { getCurrencySymbol } from "./AdminAuctions";
import Header from "@/components/Header";

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
  const [proxyMode, setProxyMode] = useState(false);
  const [proxyAmount, setProxyAmount] = useState("");
  const [historyTab, setHistoryTab] = useState<"bids" | "proxy">("bids");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [showBidConfirm, setShowBidConfirm] = useState(false);
  const [pendingBidAmount, setPendingBidAmount] = useState(0);
  const [showProxyConfirm, setShowProxyConfirm] = useState(false);
  const [pendingProxyAmount, setPendingProxyAmount] = useState(0);
  const [isFavorited, setIsFavorited] = useState(false);
  // 追蹤上一次已知的最高出價，用於偵測其他用戶的新出價
  const prevPriceRef = useRef<number | null>(null);
  const touchStartXRef = useRef<number>(0);
  const [priceUpdated, setPriceUpdated] = useState(false);

  // 取得用戶預設匿名設定
  const { data: defaultAnonData } = trpc.users.getDefaultAnonymous.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  // 當 defaultAnonData 載入後同步初始值
  useEffect(() => {
    if (defaultAnonData !== undefined) {
      setIsAnonymous((defaultAnonData as { defaultAnonymous: number }).defaultAnonymous === 1);
    }
  }, [defaultAnonData]);

  // 收藏功能
  const { data: favoriteIds } = trpc.favorites.ids.useQuery(undefined, { enabled: isAuthenticated });
  useEffect(() => {
    if (favoriteIds) setIsFavorited((favoriteIds as number[]).includes(auctionId));
  }, [favoriteIds, auctionId]);
  const toggleFavoriteMutation = trpc.favorites.toggle.useMutation({
    onMutate: () => setIsFavorited((prev) => !prev),
    onSuccess: (data) => setIsFavorited((data as { isFavorited: boolean }).isFavorited),
    onError: () => setIsFavorited((prev) => !prev),
  });

  const dismissBidMessage = () => {
    setBidMsgExiting(true);
    setTimeout(() => { setBidMessage(null); setBidMsgExiting(false); }, 400);
  };

  const { data: auction, isLoading, refetch } = trpc.auctions.detail.useQuery(
    { id: auctionId },
    {
      // 每 10 秒自動輪詢，確保多用戶同時競標時頁面即時同步（避免請求過於頻繁觸發平台限流）
      refetchInterval: 10000,
      // 切換回此標籤頁時立即重新取得最新數據
      refetchOnWindowFocus: true,
    }
  );

  // 偵測其他用戶出價導致的價格變動，主動提示 B 用戶
  useEffect(() => {
    if (!auction) return;
    const latestPrice = Number(auction.currentPrice);
    if (prevPriceRef.current !== null && prevPriceRef.current !== latestPrice) {
      // 價格已被其他人更新，若用戶正在填寫出價金額則顯示提示
      if (bidAmount || proxyAmount) {
        setPriceUpdated(true);
      }
    }
    prevPriceRef.current = latestPrice;
  }, [auction?.currentPrice]);
  const [selectedImage, setSelectedImage] = useState(0);
  // ── 手動滑動：滑入滑出動畫 ──────────────────────────────────────
  const [outgoingImage, setOutgoingImage] = useState<number | null>(null);
  const [slideDir, setSlideDir] = useState<'left' | 'right'>('left');
  const selectedImageRef = useRef(0);
  const isSlidingRef = useRef(false);
  selectedImageRef.current = selectedImage;
  isSlidingRef.current = outgoingImage !== null;

  function goToImage(nextIdx: number, dir: 'left' | 'right') {
    if (nextIdx === selectedImageRef.current || isSlidingRef.current || isFadingRef.current) return;
    setOutgoingImage(selectedImageRef.current);
    setSlideDir(dir);
    setSelectedImage(nextIdx);
    setTimeout(() => setOutgoingImage(null), 400);
  }

  // ── 自動輪播：淡入淡出 ───────────────────────────────────────────
  const [fadeVisible, setFadeVisible] = useState(true);
  const isFadingRef = useRef(false);

  useEffect(() => {
    const imgList = (auction?.images ?? []) as Array<{ id: number; imageUrl: string }>;
    if (imgList.length <= 1) return;
    const timer = setInterval(() => {
      if (isSlidingRef.current || isFadingRef.current) return;
      isFadingRef.current = true;
      setFadeVisible(false);
      setTimeout(() => {
        setSelectedImage(prev => (prev + 1) % imgList.length);
        setFadeVisible(true);
        setTimeout(() => { isFadingRef.current = false; }, 420);
      }, 380);
    }, 4000);
    return () => clearInterval(timer);
  }, [auction?.images]);
  const utils = trpc.useUtils();
  const [editingPrice, setEditingPrice] = useState(false);
  const [newStartingPrice, setNewStartingPrice] = useState("");

  const updateStartingPriceMutation = trpc.auctions.updateStartingPrice.useMutation({
    onSuccess: () => {
      toast.success("起拍價已更新！");
      setEditingPrice(false);
      setNewStartingPrice("");
      refetch();
    },
    onError: (err) => {
      toast.error(`修改失敗：${err.message}`);
    },
  });

  const relistMutation = trpc.auctions.relist.useMutation({
    onSuccess: (data) => {
      toast.success("已成功建立重新拍賣草稿！請前往管理後台設定結束時間並發佈。");
      utils.auctions.drafts.invalidate();
    },
    onError: (err) => {
      toast.error(`重新拍賣失敗：${err.message}`);
    },
  });

  const { data: proxyLogs } = trpc.auctions.getProxyBidLogs.useQuery(
    { auctionId },
    { enabled: auctionId > 0, refetchInterval: 8000 }
  );

  const { data: myProxy, refetch: refetchProxy } = trpc.auctions.getMyProxyBid.useQuery(
    { auctionId },
    { enabled: isAuthenticated && auctionId > 0 }
  );

  const setProxyBidMutation = trpc.auctions.setProxyBid.useMutation({
    onSuccess: () => {
      toast.success("代理出價已設定！系統將在您被超越時自動出價。");
      setProxyAmount("");
      refetchProxy();
      refetch();
    },
    onError: (err) => {
      toast.error(`設定失敗：${err.message}`);
    },
  });

  const cancelProxyBidMutation = trpc.auctions.cancelProxyBid.useMutation({
    onSuccess: () => {
      toast.success("代理出價已取消");
      refetchProxy();
    },
    onError: (err) => {
      toast.error(`取消失敗：${err.message}`);
    },
  });

  const handleProxyBid = () => {
    const amount = parseFloat(proxyAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("請輸入有效的代理出價上限");
      return;
    }
    // 顯示確認彈窗
    setPendingProxyAmount(amount);
    setShowProxyConfirm(true);
  };

  const confirmProxyBid = () => {
    setShowProxyConfirm(false);
    setProxyBidMutation.mutate({ auctionId, maxAmount: pendingProxyAmount });
  };

  const placeBid = trpc.auctions.placeBid.useMutation({
    onSuccess: (data) => {
      setBidMsgExiting(false);
      if (data.extended) {
        setBidMessage({ type: "success", text: `✅ 出價成功！🛡️ 拍賣已延長 ${data.extendMinutes ?? 3} 分鐘` });
      } else {
        setBidMessage({ type: "success", text: "✅ 出價成功！您目前是最高出價者" });
      }
      setBidAmount("");
      setPriceUpdated(false);
      // 出價成功後立即刷新所有相關 query，確保自己的頁面也即時更新
      refetch();
      utils.auctions.detail.invalidate({ id: auctionId });
      // 列表頁面也一並刷新，確保首頁和拍賣頁的價格及最高出價者即時更新
      utils.auctions.list.invalidate();
      // 代理出價相關 query 也一並刷新
      utils.auctions.getProxyBidLogs.invalidate({ auctionId });
      utils.auctions.getMyProxyBid.invalidate({ auctionId });
      setTimeout(() => { setBidMsgExiting(true); setTimeout(() => { setBidMessage(null); setBidMsgExiting(false); }, 400); }, 5600);
    },
    onError: (err) => {
      setBidMsgExiting(false);
      // 出價失敗時自動刷新最新出價，避免用戶再次使用舊數據出價
      refetch();
      const errMsg = err.message || "出價失敗，請重試";
      // 判斷錯誤類型並顯示易懂提示
      const isStalePrice = errMsg.includes('出價金額必須') || errMsg.includes('必須至少為');
      const isRateLimit = errMsg.includes('請求過於頻繁') || errMsg.includes('rate') || errMsg.includes('Rate') || errMsg.includes('TOO_MANY');
      if (isStalePrice) {
        setBidMessage({ type: "error", text: `❌ 已有新出價！頁面已更新最新出價，請重新確認金額` });
      } else if (isRateLimit) {
        setBidMessage({ type: "error", text: `⏳ 請求過於頻繁，請稍候幾秒再試` });
      } else {
        setBidMessage({ type: "error", text: `❌ ${errMsg}` });
      }
      setTimeout(() => { setBidMsgExiting(true); setTimeout(() => { setBidMessage(null); setBidMsgExiting(false); }, 400); }, 6600);
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
    if (amount < minBid) {
      setBidMsgExiting(false);
      setBidMessage({ type: "error", text: `❌ 最低出價 ${currencySymbol}${minBid.toLocaleString()}（${hasExistingBid ? `現價 + 每口加幅 ${currencySymbol}${bidIncrement}` : `起拍價`}）` });
      setTimeout(() => { setBidMsgExiting(true); setTimeout(() => { setBidMessage(null); setBidMsgExiting(false); }, 400); }, 5600);
      return;
    }
    // 顯示確認彈窗
    setPendingBidAmount(amount);
    setShowBidConfirm(true);
  };

  const confirmBid = () => {
    setShowBidConfirm(false);
    setBidMessage({ type: "info", text: "⏳ 出價處理中，請稍候..." });
    placeBid.mutate({ auctionId, bidAmount: pendingBidAmount, isAnonymous: isAnonymous ? 1 : 0 });
  };

  // 使用 bidIncrement 計算最低出價金額
  const bidIncrement = auction?.bidIncrement ?? 30;
  const currency = (auction as { currency?: string })?.currency ?? 'HKD';
  const currencySymbol = getCurrencySymbol(currency);
  const currentPrice = auction ? Number(auction.currentPrice) : 0;
  const startingPrice = auction ? Number(auction.startingPrice) : 0;
  // 無出價記錄時，最低出價 = 起拍價（零起拍則為一口加幅）；有出價時 = 現價 + 每口加幅
  const hasExistingBid = !!(auction as { highestBidderId?: number | null })?.highestBidderId;
  const minBid = hasExistingBid ? currentPrice + bidIncrement : (startingPrice === 0 ? bidIncrement : startingPrice);

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
  const bids = auction.bidHistory as Array<{ id: number; userId: number; bidAmount: string; createdAt: Date; username?: string | null; isAnonymous?: number | null; memberLevel?: string | null }>;
  // 輔助函數：根據 isAnonymous 欄位決定顯示名稱
  // 若是自己的匿名出價，顯示「🕵️ 匿名出價 - 你自己」，讓用戶知道自己是最高出價者
  const displayName = (bid: { userId: number; username?: string | null; isAnonymous?: number | null }, currentUserId?: number | null) => {
    if (bid.isAnonymous === 1) {
      return currentUserId && bid.userId === currentUserId
        ? '🕵️ 匿名出價 - 你自己'
        : '🕵️ 匿名買家';
    }
    return bid.username ?? `用戶 #${bid.userId}`;
  };
  const isActive = auction.status === "active" && new Date() < new Date(auction.endTime);

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Navigation */}
      <Header />
      <div className="container pt-8 pb-24">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-6 text-sm text-muted-foreground">
          <Link href="/auctions" className="flex items-center gap-1 hover:text-amber-700 transition-colors">
            <ChevronLeft className="w-4 h-4" /> 返回拍賣列表
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left: Images */}
          <div>
            <div
              className="aspect-square rounded-2xl overflow-hidden bg-amber-50 border border-amber-100 mb-3 relative select-none"
              onTouchStart={(e) => { touchStartXRef.current = e.touches[0].clientX; }}
              onTouchEnd={(e) => {
                const diff = touchStartXRef.current - e.changedTouches[0].clientX;
                if (Math.abs(diff) < 40 || images.length <= 1) return;
                const total = images.length;
                if (diff > 0) {
                  goToImage((selectedImage + 1) % total, 'left');
                } else {
                  goToImage((selectedImage - 1 + total) % total, 'right');
                }
              }}
            >
              {images.length > 0 ? (
                <>
                  {/* 移出的舊圖片 */}
                  {outgoingImage !== null && (
                    <img
                      key={`out-${outgoingImage}`}
                      src={images[outgoingImage]?.imageUrl}
                      alt=""
                      className="absolute inset-0 w-full h-full object-contain"
                      style={{
                        animation: `${slideDir === 'left' ? 'img-slide-out-left' : 'img-slide-out-right'} 0.38s ease-in-out forwards`,
                      }}
                    />
                  )}
                  {/* 移入的新圖片 / 靜止圖片 */}
                  <img
                    key={`in-${selectedImage}-${slideDir}`}
                    src={images[selectedImage]?.imageUrl}
                    alt={auction.title}
                    className="w-full h-full object-contain"
                    style={outgoingImage !== null ? {
                      // 手動滑動：滑入效果
                      animation: `${slideDir === 'left' ? 'img-slide-in-from-right' : 'img-slide-in-from-left'} 0.38s ease-in-out forwards`,
                    } : {
                      // 自動輪播：淡入淡出
                      opacity: fadeVisible ? 1 : 0,
                      transition: 'opacity 0.38s ease-in-out',
                    }}
                  />
                  {/* 底部漸層遮罩 */}
                  <div
                    className="absolute bottom-0 left-0 right-0 h-16 pointer-events-none"
                    style={{ background: "linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 100%)" }}
                  />
                  {/* 左下：商戶名稱 */}
                  {auction.sellerName && (
                    <div className="absolute bottom-2.5 left-3 flex items-center gap-1.5 pointer-events-none">
                      <User className="w-3 h-3 text-white/80" />
                      <span className="text-white text-xs font-medium drop-shadow">{auction.sellerName}</span>
                    </div>
                  )}
                  {/* 右下：圖片計數 + 分享 */}
                  <div className="absolute bottom-2 right-2 flex items-center gap-1.5">
                    {images.length > 1 && (
                      <span className="text-white/90 text-xs font-semibold tabular-nums drop-shadow pointer-events-none">
                        {selectedImage + 1}/{images.length}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={async () => {
                        const url = window.location.href;
                        const title = auction.title;
                        if (navigator.share) {
                          try {
                            await navigator.share({ title, url });
                          } catch {
                            // user cancelled — do nothing
                          }
                        } else {
                          await navigator.clipboard.writeText(url);
                          toast.success("連結已複製");
                        }
                      }}
                      className="flex items-center justify-center w-7 h-7 rounded-full bg-black/35 hover:bg-black/55 transition-colors backdrop-blur-sm"
                      title="分享"
                    >
                      <Share2 className="w-3.5 h-3.5 text-white" />
                    </button>
                  </div>
                </>
              ) : (
                <div className="w-full h-full coin-placeholder flex items-center justify-center">
                  <span className="text-8xl">🪙</span>
                </div>
              )}
            </div>
          </div>

          {/* Right: Details */}
          <div className="flex flex-col gap-5">
            {/* Title & Status */}
            <div>
              <div className="flex items-start justify-between gap-3 mb-2">
                <h1 className="text-2xl font-bold leading-tight">{auction.title}</h1>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge className={isActive ? "bg-emerald-500 text-white" : "bg-gray-400 text-white"}>
                    {isActive ? "競拍中" : "已結束"}
                  </Badge>
                  {isAuthenticated && (
                    <button
                      onClick={() => toggleFavoriteMutation.mutate({ auctionId })}
                      className={`w-8 h-8 flex items-center justify-center rounded-full transition-all ${
                        isFavorited ? "bg-rose-100 hover:bg-rose-200" : "bg-gray-100 hover:bg-rose-50"
                      }`}
                      title={isFavorited ? "取消收藏" : "加入收藏"}
                    >
                      <Heart className={`w-4 h-4 transition-all ${isFavorited ? "text-rose-500 fill-rose-500" : "text-gray-400"}`} />
                    </button>
                  )}
                </div>
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
                       {bids.length > 0 ? (
                         <span className="text-[9px] text-red-500 font-semibold">({displayName(bids[0], user?.id)})</span>
                       ) : (
                         <span className="text-[9px] text-black font-normal">(未有出價)</span>
                       )}
                    </div>
                    <div className="text-3xl font-extrabold text-amber-600 price-tag">
                      {currencySymbol}{Number(auction.currentPrice).toLocaleString()}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      起拍價：{currencySymbol}{Number(auction.startingPrice).toLocaleString()}
                    </div>
                  </div>
                  <div className="text-right space-y-1 relative">
                    {/* Bid Message — floating pop-up above 出價次數, uses --popup-* theme */}
                    {bidMessage && (
                      <div
                        className={`absolute bottom-full right-0 mb-2 z-20 w-64 text-xs font-medium border overflow-hidden ${
                          bidMessage.type === "info" ? "bid-processing-card" : ""
                        } ${bidMsgExiting ? "bid-msg-exit" : "bid-msg-enter"}`}
                        style={{
                          background: "var(--popup-bg)",
                          color: "var(--popup-text)",
                          borderColor: bidMessage.type === "success"
                            ? "rgba(52,211,153,0.45)"
                            : bidMessage.type === "error"
                            ? "rgba(248,113,113,0.45)"
                            : "var(--popup-border)",
                          boxShadow: "var(--popup-shadow)",
                          borderRadius: "var(--popup-radius)",
                          borderWidth: "1px",
                          borderStyle: "solid",
                        }}
                      >
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
                            <span className="flex-1" style={{ color: "var(--popup-text)" }}>{bidMessage.text}</span>
                          )}
                          <button
                            onClick={dismissBidMessage}
                            className="ml-2 opacity-40 hover:opacity-80 transition-opacity flex-shrink-0"
                            style={{ color: "var(--popup-desc)" }}
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
                <div className="inline-flex flex-col mb-4" style={{ gap: "3px" }}>
                  <CountdownTimer endTime={new Date(auction.endTime)} />
                  <span className="text-[0.68rem] text-muted-foreground leading-tight self-end">
                    結束：{formatDate(new Date(auction.endTime))}
                  </span>
                </div>

                {/* Ended Notice */}
                {!isActive && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-gray-100 border border-gray-200">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-400 text-white text-xs font-semibold shrink-0">
                        ✕ 已結束
                      </span>
                      <span className="text-xs text-gray-500">此拍賣已結束，不再接受出價</span>
                    </div>
                    {user?.role === "admin" && (
                      <Button
                        onClick={() => relistMutation.mutate({ id: auctionId })}
                        disabled={relistMutation.isPending}
                        className="w-full bg-amber-500 hover:bg-amber-600 text-white border-0 shadow-md"
                      >
                        {relistMutation.isPending ? "建立草稿中..." : "🔄 重新拍賣"}
                      </Button>
                    )}
                  </div>
                )}

                {/* Edit Starting Price (admin only, no bids, active) */}
                {isActive && user?.role === "admin" && bids.length === 0 && (
                  <div className="border border-amber-200 rounded-lg p-3 bg-amber-50">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-amber-700">⚙️ 修改起拍價</span>
                      {!editingPrice && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-[10px] px-2 border-amber-400 text-amber-700 hover:bg-amber-100"
                          onClick={() => { setEditingPrice(true); setNewStartingPrice(String(Number(auction.startingPrice))); }}
                        >
                          修改
                        </Button>
                      )}
                    </div>
                    {editingPrice ? (
                      <div className="flex gap-2 items-center">
                        <Input
                          type="number"
                          min={0}
                          value={newStartingPrice}
                          onChange={e => setNewStartingPrice(e.target.value)}
                          className="h-8 text-sm"
                          placeholder="輸入新起拍價"
                        />
                        <Button
                          size="sm"
                          className="h-8 bg-amber-500 hover:bg-amber-600 text-white border-0 shrink-0"
                          disabled={updateStartingPriceMutation.isPending || !newStartingPrice}
                          onClick={() => updateStartingPriceMutation.mutate({ id: auctionId, startingPrice: Number(newStartingPrice) })}
                        >
                          {updateStartingPriceMutation.isPending ? "儲存..." : "確認"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 shrink-0"
                          onClick={() => { setEditingPrice(false); setNewStartingPrice(""); }}
                        >
                          取消
                        </Button>
                      </div>
                    ) : (
                      <p className="text-xs text-amber-600">目前起拍價：{currencySymbol}{Number(auction.startingPrice).toLocaleString()}（未有出價時可修改）</p>
                    )}
                  </div>
                )}

                {/* Bid Input */}
                {isActive && (
                  isAuthenticated ? (
                    auction.createdBy === user?.id ? (
                      <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-amber-50 border border-amber-200">
                        <span className="text-amber-600 text-lg">🚫</span>
                        <span className="text-sm text-amber-700 font-medium">商戶自己的商品, 禁止出價</span>
                      </div>
                    ) : (
                    <div className="space-y-3">
                      {/* Active proxy bid banner */}
                      {myProxy?.isActive && (
                        <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                          <div className="flex items-center gap-2 text-blue-700">
                            <Bot className="w-4 h-4" />
                            <span className="text-xs font-medium">代理中：上限 {currencySymbol}{myProxy.maxAmount.toLocaleString()}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => cancelProxyBidMutation.mutate({ auctionId })}
                            disabled={cancelProxyBidMutation.isPending}
                            className="text-blue-400 hover:text-blue-600 transition-colors"
                            title="取消代理出價"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}

                      {/* Mode toggle */}
                      <div className="flex rounded-lg border border-amber-200 overflow-hidden text-xs font-medium">
                        <button
                          type="button"
                          onClick={() => setProxyMode(false)}
                          className={`flex-1 py-1.5 transition-colors ${
                            !proxyMode ? "bg-amber-500 text-white" : "bg-white text-amber-700 hover:bg-amber-50"
                          }`}
                        >
                          一般出價
                        </button>
                        <button
                          type="button"
                          onClick={() => setProxyMode(true)}
                          className={`flex-1 py-1.5 flex items-center justify-center gap-1 transition-colors ${
                            proxyMode ? "bg-blue-500 text-white" : "bg-white text-blue-600 hover:bg-blue-50"
                          }`}
                        >
                          <Bot className="w-3 h-3" />
                          代理出價
                        </button>
                      </div>

                      {/* 價格已被其他用戶更新的提示橫幅 */}
                      {priceUpdated && (
                        <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-orange-50 border border-orange-300 text-orange-700 text-xs font-medium animate-pulse">
                          <div className="flex items-center gap-1.5">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>⚡ 有新出價！最新現價已更新，請重新確認出價金額</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => { setPriceUpdated(false); setBidAmount(""); setProxyAmount(""); }}
                            className="shrink-0 opacity-60 hover:opacity-100"
                          >✕</button>
                        </div>
                      )}

                      {!proxyMode ? (
                        <>
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
                            最低出價：{currencySymbol}{minBid.toLocaleString()}
                            {hasExistingBid
                              ? `（現價 + 每口加幅 ${currencySymbol}${bidIncrement}）`
                              : `（起拍價，首口免加幅）`}
                          </p>
                          {/* 匿名出價開關 */}
                          <div className={`flex items-center justify-between rounded-lg px-3 py-2 border transition-all ${
                            isAnonymous
                              ? 'bg-slate-50 border-slate-300'
                              : 'bg-white border-amber-100'
                          }`}>
                            <div className="flex items-center gap-2">
                              <EyeOff className={`w-4 h-4 ${isAnonymous ? 'text-slate-500' : 'text-amber-400'}`} />
                              <Label htmlFor="anonymous-bid" className="text-xs font-medium cursor-pointer select-none">
                                {isAnonymous ? (
                                  <span className="text-slate-600">匿名出價（其他人看不到您的名字）</span>
                                ) : (
                                  <span className="text-muted-foreground">匿名出價</span>
                                )}
                              </Label>
                            </div>
                            <Switch
                              id="anonymous-bid"
                              checked={isAnonymous}
                              onCheckedChange={setIsAnonymous}
                              className="data-[state=checked]:bg-slate-500"
                            />
                          </div>
                        </>
                      ) : (
                        <>
                          {/* Proxy bid input */}
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
                            <p className="text-xs text-blue-700 font-medium flex items-center gap-1">
                              <Bot className="w-3.5 h-3.5" />
                              設定您願意支付的最高金額，系統將在您被超越時自動以最小加幅代為出價。
                            </p>
                            <div className="flex gap-2">
                              <div className="relative flex-1">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-blue-400">{currencySymbol}</span>
                                <Input
                                  type="number"
                                  placeholder={`最高上限（至少 ${minBid}）`}
                                  value={proxyAmount}
                                  onChange={(e) => setProxyAmount(e.target.value)}
                                  className="pl-10 border-blue-300 focus-visible:ring-blue-400"
                                  min={minBid}
                                />
                              </div>
                              <Button
                                onClick={handleProxyBid}
                                disabled={setProxyBidMutation.isPending}
                                className="bg-blue-500 hover:bg-blue-600 text-white border-0 shadow-md px-4"
                              >
                                {setProxyBidMutation.isPending ? "設定中..." : "設定代理"}
                              </Button>
                            </div>
                            <p className="text-xs text-blue-500 text-center">
                              代理上限至少 {currencySymbol}{minBid.toLocaleString()}・每口加幅 {currencySymbol}{bidIncrement}
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                    )
                  ) : (
                    <a href="/login">
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
                  {(proxyLogs?.length ?? 0) > 0 && (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-600 text-xs font-medium">
                      <Bot className="w-3 h-3" />{proxyLogs?.length ?? 0}
                    </span>
                  )}
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-amber-500 transition-transform duration-300 ${showHistory ? "rotate-180" : "rotate-0"}`}
                />
              </button>

              {/* Collapsible content */}
              <div
                className="transition-all duration-300 ease-in-out overflow-hidden"
                style={{ maxHeight: showHistory ? "400px" : "0px", opacity: showHistory ? 1 : 0 }}
              >
                {/* Tab bar */}
                <div className="border-t border-amber-100 flex">
                  <button
                    onClick={() => setHistoryTab("bids")}
                    className={`flex-1 py-2 text-xs font-medium transition-colors ${
                      historyTab === "bids"
                        ? "bg-amber-50 text-amber-700 border-b-2 border-amber-400"
                        : "text-muted-foreground hover:bg-muted/30"
                    }`}
                  >
                    出價記錄（{bids.length}）
                  </button>
                  <button
                    onClick={() => setHistoryTab("proxy")}
                    className={`flex-1 py-2 text-xs font-medium flex items-center justify-center gap-1 transition-colors ${
                      historyTab === "proxy"
                        ? "bg-blue-50 text-blue-600 border-b-2 border-blue-400"
                        : "text-muted-foreground hover:bg-muted/30"
                    }`}
                  >
                    <Bot className="w-3 h-3" />
                    代理紀錄（{proxyLogs?.length ?? 0}）
                  </button>
                </div>

                <div className="px-4 py-3">
                  {historyTab === "bids" ? (
                    bids.length > 0 ? (
                      <div className="space-y-2 max-h-60 overflow-y-auto scrollbar-thin pr-1">
                        {bids.map((bid, i) => (
                          <div key={bid.id} className={`flex items-center justify-between py-2 px-3 rounded-lg text-sm ${i === 0 ? "bg-amber-50 border border-amber-200" : "bg-muted/30"}`}>
                            <div className="flex items-center gap-2">
                              <User className="w-3.5 h-3.5 text-muted-foreground" />
                              <span className="text-muted-foreground">{displayName(bid, user?.id)}</span>
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
                    )
                  ) : (
                    (proxyLogs?.length ?? 0) > 0 ? (
                      <div className="space-y-2 max-h-60 overflow-y-auto scrollbar-thin pr-1">
                        {(proxyLogs ?? []).map((log: { id: number; round: number; triggerUserId: number; triggerUserName: string; triggerAmount: number; proxyUserId: number; proxyUserName: string; proxyAmount: number; createdAt: Date | string }) => (
                          <div key={log.id} className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-xs">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-blue-500 font-medium">第 {log.round} 輪</span>
                              <span className="text-muted-foreground">{new Date(log.createdAt).toLocaleString("zh-HK", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
                            </div>
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <span className="font-medium text-foreground">{log.proxyUserName}</span>
                              <span>的代理自動出價</span>
                              <span className="font-bold text-blue-600">{currencySymbol}{log.proxyAmount.toLocaleString()}</span>
                            </div>
                            <div className="text-muted-foreground mt-0.5">
                              觸發者：{log.triggerUserName}（{currencySymbol}{log.triggerAmount.toLocaleString()}）
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-6 text-muted-foreground text-sm">
                        <Bot className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        暫無代理出價紀錄
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 出價確認彈窗 */}
      <Dialog open={showBidConfirm} onOpenChange={setShowBidConfirm}>
        <DialogContent className="sm:max-w-md" onKeyDown={(e) => { if (e.key === 'Enter') confirmBid(); }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-500" />
              確認出價
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">商品</span>
                <span className="text-sm font-medium truncate max-w-[200px]">{(auction as { title?: string })?.title ?? '未命名'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">出價金額</span>
                <span className="text-xl font-bold text-amber-700">{currencySymbol}{pendingBidAmount.toLocaleString()}</span>
              </div>
              {isAnonymous && (
                <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-100 rounded-lg px-3 py-2">
                  <EyeOff className="w-3.5 h-3.5" />
                  <span>此次出價將以匿名方式登記</span>
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground text-center">出價後不可撤销，請確認金額正確。</p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowBidConfirm(false)} className="flex-1">取消</Button>
            <Button
              onClick={confirmBid}
              disabled={placeBid.isPending}
              className="flex-1 gold-gradient text-white border-0"
            >
              {placeBid.isPending ? '出價中...' : `確認出價 ${currencySymbol}${pendingBidAmount.toLocaleString()}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 代理出價確認彈窗 */}
      <Dialog open={showProxyConfirm} onOpenChange={setShowProxyConfirm}>
        <DialogContent className="sm:max-w-md" onKeyDown={(e) => { if (e.key === 'Enter') confirmProxyBid(); }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-blue-500" />
              確認代理出價
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">商品</span>
                <span className="text-sm font-medium truncate max-w-[200px]">{(auction as { title?: string })?.title ?? '未命名'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">代理上限</span>
                <span className="text-xl font-bold text-blue-700">{currencySymbol}{pendingProxyAmount.toLocaleString()}</span>
              </div>
            </div>
            <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-700">
              <Bot className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>系統將在您被超越時自動以最小加幅代為出價，直至達到上限金額為止。</span>
            </div>
            <p className="text-xs text-muted-foreground text-center">設定後可隨時取消代理出價。</p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowProxyConfirm(false)} className="flex-1">取消</Button>
            <Button
              onClick={confirmProxyBid}
              disabled={setProxyBidMutation.isPending}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white border-0"
            >
              {setProxyBidMutation.isPending ? '設定中...' : `確認設定上限 ${currencySymbol}${pendingProxyAmount.toLocaleString()}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
