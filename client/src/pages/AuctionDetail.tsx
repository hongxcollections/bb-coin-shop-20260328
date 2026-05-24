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
import { Clock, ChevronLeft, ChevronRight, User, TrendingUp, History, ArrowUpCircle, ChevronDown, Bot, X, EyeOff, AlertCircle, Heart, Share2, Play, Info, Truck, CreditCard } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { getCurrencySymbol } from "./AdminAuctions";
import Header from "@/components/Header";
import { MembershipBenefitsDialog, useMembershipBenefitsDialog } from "@/components/MembershipBenefitsDialog";
import { useSeoMeta } from "@/lib/useSeoMeta";
import { useConfirm } from "@/components/ui/confirm-provider";
import { ShareMenu } from "@/components/ShareMenu";
import ImageLightbox from "@/components/ImageLightbox";
import ChatButton from "@/components/ChatButton";
import { AuctionCardFb } from "@/components/AuctionCardFb";

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

function SessionAwareBack({ auctionId: _auctionId }: { auctionId: number; merchantUserId: number }) {
  // SPA navigation 唔會 update document.referrer，改用 sessionStorage：
  // MerchantSessionPublic onClick 時 set；呢度讀完保留（refresh 仍 valid，去其他 page 時清）
  const [from, setFrom] = useState<{ merchantUserId: number; slug: string; title: string; merchantName?: string } | null>(null);
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("bb_auction_from_session");
      if (raw) {
        setFrom(JSON.parse(raw));
        sessionStorage.removeItem("bb_auction_from_session"); // 一次性，避免之後從別處入嚟見到舊值
      }
    } catch {}
  }, []);
  if (from) {
    return (
      <div className="flex items-center gap-2 mb-6 text-sm text-muted-foreground">
        <Link
          href={`/s/${from.merchantUserId}/${from.slug}`}
          className="flex items-center gap-1 hover:text-amber-700 transition-colors"
          onClick={() => { try { sessionStorage.removeItem("bb_auction_from_session"); } catch {} }}
        >
          <ChevronLeft className="w-4 h-4" /> 返回 {from.merchantName ?? '商戶'} 專場 「{from.title}」
        </Link>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 mb-6 text-sm text-muted-foreground">
      <Link href="/auctions" className="flex items-center gap-1 hover:text-amber-700 transition-colors">
        <ChevronLeft className="w-4 h-4" /> 返回拍賣列表
      </Link>
    </div>
  );
}

function SessionBelongsBanner({ auctionId, merchantUserId }: { auctionId: number; merchantUserId: number }) {
  const { data } = trpc.merchantSessions.findSessionForAuction.useQuery(
    { auctionId }, { enabled: auctionId > 0, retry: false, staleTime: 60_000 }
  );
  if (!data) return null;
  return (
    <Link href={`/s/${merchantUserId}/${data.slug}`}>
      <a className="inline-flex items-center gap-1.5 text-xs bg-purple-50 text-purple-700 border border-purple-200 px-2.5 py-1 rounded-full mb-2 hover:bg-purple-100 transition">
        🎪 {data.merchantName ?? '商戶'} 專場「{data.title}」
      </a>
    </Link>
  );
}

export default function AuctionDetail() {
  const [, params] = useRoute("/auctions/:id");
  const auctionId = parseInt(params?.id ?? "0");
  const { user, isAuthenticated } = useAuth();

  // 進入商品頁時自動 scroll 到頂部（包括由其他商品卡跳過嚟）
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }
  }, [auctionId]);
  const [bidAmount, setBidAmount] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [proxyMode, setProxyMode] = useState(false);
  const [proxyAmount, setProxyAmount] = useState("");
  const [historyTab, setHistoryTab] = useState<"bids" | "proxy">("bids");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [showBidConfirm, setShowBidConfirm] = useState(false);
  const [pendingBidAmount, setPendingBidAmount] = useState(0);
  const confirm = useConfirm();
  const [showProxyConfirm, setShowProxyConfirm] = useState(false);
  const [pendingProxyAmount, setPendingProxyAmount] = useState(0);
  const memberBenefits = useMembershipBenefitsDialog();
  const [isFavorited, setIsFavorited] = useState(false);
  const [paymentInfoOpen, setPaymentInfoOpen] = useState(false);
  // 追蹤上一次已知的最高出價，用於偵測其他用戶的新出價
  const prevPriceRef = useRef<number | null>(null);
  const touchStartXRef = useRef<number>(0);
  const touchStartYRef = useRef<number>(0);
  const touchOpenedLightboxRef = useRef(false);
  const [priceUpdated, setPriceUpdated] = useState(false);

  // 取得用戶預設匿名設定
  const { data: defaultAnonData } = trpc.users.getDefaultAnonymous.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  // 取得用戶代理出價配額 + 匿名出價權限（會員等級限制）
  const { data: autoBidStatus } = trpc.loyalty.myAutoBidStatus.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const memberLevel = autoBidStatus?.level ?? 'bronze';
  const canUseAnonymous = autoBidStatus?.canUseAnonymous ?? false;
  const canUseAutoBid = autoBidStatus?.canUseAutoBid ?? true;
  const bronzeQuota = autoBidStatus?.bronzeQuota ?? { used: 0, total: 0, remaining: 0 };
  const silverMaxAmount = autoBidStatus?.silverMaxAmount ?? 0;
  // 銅牌不可匿名 → 強制 false（避免 stale state 偷偷送出 isAnonymous=1）
  useEffect(() => {
    if (autoBidStatus && !canUseAnonymous && isAnonymous) {
      setIsAnonymous(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoBidStatus]);
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

  const { data: auction, isLoading, refetch } = trpc.auctions.detail.useQuery(
    { id: auctionId },
    {
      // 每 3 秒自動輪詢，確保多用戶同時競標時頁面即時同步
      refetchInterval: 3000,
      // 切換回此標籤頁時立即重新取得最新數據
      refetchOnWindowFocus: true,
    }
  );

  const { data: paymentInfo } = trpc.merchants.getPaymentInfo.useQuery(
    { merchantUserId: (auction as any)?.createdBy ?? 0 },
    { enabled: !!(auction as any)?.createdBy, staleTime: 300_000 }
  );

  // SEO meta — 必須在頂層無條件呼叫（hooks 規則），auction 為 undefined 時傳空值
  const _seoFirstImage = (auction?.images as Array<{ imageUrl: string }> | undefined)?.[0]?.imageUrl;
  const _seoDesc = auction
    ? (auction.description
        ? String(auction.description).slice(0, 120) + (String(auction.description).length > 120 ? "…" : "")
        : `起拍價 ${getCurrencySymbol((auction as { currency?: string })?.currency ?? "HKD")}${Number(auction.startingPrice).toLocaleString()}，立即前往 hongxcollections 競投！`)
    : undefined;
  useSeoMeta({
    title: auction?.title,
    description: _seoDesc,
    ogImage: _seoFirstImage,
    ogUrl: `${window.location.origin}/auctions/${auctionId}`,
    ogType: "article",
  });

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
  const [lightboxOpen, setLightboxOpen] = useState(false);
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
    const vUrl = (auction as { videoUrl?: string | null })?.videoUrl ?? "";
    const total = (vUrl ? 1 : 0) + imgList.length;
    if (total <= 1) return;
    const timer = setInterval(() => {
      if (isSlidingRef.current || isFadingRef.current) return;
      // 影片播放中不自動切換
      if (vUrl && selectedImageRef.current === 0) return;
      isFadingRef.current = true;
      setFadeVisible(false);
      setTimeout(() => {
        setSelectedImage(prev => {
          let next = (prev + 1) % total;
          // 自動輪播跳過影片格
          if (vUrl && next === 0) next = total > 1 ? 1 : 0;
          return next;
        });
        setFadeVisible(true);
        setTimeout(() => { isFadingRef.current = false; }, 420);
      }, 380);
    }, 4000);
    return () => clearInterval(timer);
  }, [auction?.images, (auction as { videoUrl?: string | null })?.videoUrl]);
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

  const { data: siteSettings } = trpc.siteSettings.getAll.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });
  const _ss = (siteSettings as Record<string, string> | undefined) ?? {};
  const noBidMessage = _ss.noBidMessage ?? "暫時未有出價 喜歡來一口的隨時就可以帶回家了 😁";
  const noBidEnabled = _ss.noBidEnabled !== "false"; // 預設開啟
  const bidSuccessMessage = _ss.bidSuccessMessage ?? "✅ 出價成功！您目前是最高出價者";
  const bidSuccessExtendedMessage = _ss.bidSuccessExtendedMessage ?? "✅ 出價成功！🛡️ 拍賣已延長 {minutes} 分鐘";
  const notLoggedInBidText = _ss.notLoggedInBidText ?? "登入後出價";

  const handleProxyBid = () => {
    if (auction && user && (auction as { createdBy?: number }).createdBy === user.id) {
      toast.error("商戶自己的商品，禁止出價 🚫", { className: "bb-toast-err", duration: 4000 });
      return;
    }
    const amount = parseFloat(proxyAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("請輸入有效的代理出價上限", { className: "bb-toast-err", duration: 4000 });
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
      const auctionTitle = (auction as { title?: string })?.title ?? '';
      const extNote = data.extended ? ` · 已延長 ${data.extendMinutes ?? 3} 分鐘` : '';
      toast.success(`商品名稱 - ${auctionTitle}`, {
        description: `確認出價 - ${currencySymbol}${pendingBidAmount.toLocaleString()}${extNote}`,
        className: "bb-toast-success",
        duration: 5000,
      });
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
    },
    onError: (err) => {
      // 出價失敗時自動刷新最新出價，避免用戶再次使用舊數據出價
      refetch();
      const errMsg = err.message || "出價失敗，請重試";
      // 判斷錯誤類型並顯示易懂提示
      const isStalePrice = errMsg.includes('出價金額必須') || errMsg.includes('必須至少為');
      const isRateLimit = errMsg.includes('請求過於頻繁') || errMsg.includes('rate') || errMsg.includes('Rate') || errMsg.includes('TOO_MANY');
      const text = isStalePrice
        ? '已有新出價！頁面已更新最新出價，請重新確認金額'
        : isRateLimit
        ? '請求過於頻繁，請稍候幾秒再試'
        : errMsg;
      toast.error(text, { className: "bb-toast-err", duration: 6000 });
    },
  });

  const handleBid = async () => {
    if (auction && user && (auction as { createdBy?: number }).createdBy === user.id) {
      toast.error("商戶自己的商品，禁止出價 🚫", { className: "bb-toast-err", duration: 4000 });
      return;
    }
    const amount = parseFloat(bidAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("請輸入有效的出價金額", { className: "bb-toast-err", duration: 5000 });
      return;
    }
    if (amount < minBid) {
      toast.error(`最低出價 ${currencySymbol}${minBid.toLocaleString()}`, {
        description: hasExistingBid ? `現價 + 每口加幅 ${currencySymbol}${bidIncrement}` : '起拍價',
        className: "bb-toast-err",
        duration: 5000,
      });
      return;
    }
    // 即時檢查是否被該賣家停權
    const sellerId = (auction as { createdBy?: number } | null)?.createdBy;
    if (sellerId && user && sellerId !== user.id) {
      try {
        const lock = await utils.merchants.myLockStatusForMerchant.fetch({ merchantId: sellerId });
        // 商戶關閉「買家失約封鎖」總開關 → 跳過任何凍結提示
        if (lock?.enabled && lock.locked && lock.lockedUntil) {
          const until = new Date(lock.lockedUntil).toLocaleString('zh-HK', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
          toast.error(`你已被「${lock.merchantName ?? '此賣家'}」暫停出價`, {
            description: `凍結至 ${until}`,
            className: "bb-toast-err",
            duration: 6000,
          });
          return;
        }
      } catch {}
    }
    // 如有 active 代理出價，先提示用戶
    if (myProxy?.isActive) {
      const ok = await confirm({
        title: "你已設有代理出價",
        description: `你的代理出價上限為 ${currencySymbol}${Number(myProxy.maxAmount).toLocaleString()}，系統會自動為你出價。確定還要手動出價 ${currencySymbol}${amount.toLocaleString()}？`,
        confirmText: "確定手動出價",
        cancelText: "取消",
      });
      if (!ok) return;
    }
    // 顯示確認彈窗
    setPendingBidAmount(amount);
    setShowBidConfirm(true);
  };

  const confirmBid = () => {
    setShowBidConfirm(false);
    toast.loading("出價處理中…", { id: "bid-loading", className: "bb-toast-success", duration: 30000 });
    placeBid.mutate(
      { auctionId, bidAmount: pendingBidAmount, isAnonymous: isAnonymous ? 1 : 0 },
      {
        onSettled: () => toast.dismiss("bid-loading"),
      }
    );
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
          <div className="text-4xl mb-4 animate-spin">💰</div>
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
  const auctionVideoUrl = (auction as { videoUrl?: string | null })?.videoUrl ?? "";
  const hasVideo = !!auctionVideoUrl;
  type MediaItem = { kind: 'video' | 'image'; url: string; key: string };
  const mediaList: MediaItem[] = [
    ...(hasVideo ? [{ kind: 'video' as const, url: auctionVideoUrl, key: 'video' }] : []),
    ...images.map(img => ({ kind: 'image' as const, url: img.imageUrl, key: `img-${img.id}` })),
  ];
  const totalMedia = mediaList.length;
  const currentMedia = mediaList[selectedImage];
  const isVideoSelected = currentMedia?.kind === 'video';
  const lightboxIndex = hasVideo ? Math.max(0, selectedImage - 1) : selectedImage;
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
  // 商戶擁有者或管理員可睇完整真實紀錄
  const isPrivileged = user?.role === "admin" || user?.id === (auction as { createdBy?: number }).createdBy;

  /* ── Facebook 模式：整頁用 AuctionCardFb 渲染 ── */
  if ((auction as any).displayMode === "facebook") {
    const fbImages = images.map((img: { id: number; imageUrl: string }) => ({ imageUrl: img.imageUrl }));
    const topBid = bids.length > 0 ? bids[0] : null;
    const fbHighestBidderName = topBid
      ? (topBid.isAnonymous === 1 ? "🕵️ 匿名買家" : (topBid.username ?? null))
      : null;
    return (
      <div className="min-h-screen bg-gray-100 pb-20">
        <Header />
        <div className="max-w-xl mx-auto pt-4 px-0">
          <AuctionCardFb
            auctionId={auctionId}
            title={auction.title}
            images={fbImages}
            endTime={auction.endTime}
            createdAt={(auction as any).createdAt}
            currentPrice={Number(auction.currentPrice)}
            currency={(auction as any).currency}
            isEnded={!isActive}
            bidCount={bids.length}
            highestBidderId={auction.highestBidderId ?? undefined}
            highestBidderName={fbHighestBidderName}
            currentUserId={user?.id}
            sellerName={(auction as any).sellerName ?? null}
            sellerPhotoUrl={(auction as any).sellerPhotoUrl ?? null}
            createdBy={(auction as any).createdBy}
            bidIncrement={Number((auction as any).bidIncrement ?? 30)}
            shareTemplate={(auction as any).fbShareTemplate ?? null}
            antiSnipeEnabled={(auction as any).antiSnipeEnabled}
            antiSnipeMinutes={(auction as any).antiSnipeMinutes}
            extendMinutes={(auction as any).extendMinutes}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 via-yellow-50/40 to-white overflow-x-hidden">
      {/* No-bid floating popup — fixed top-center, only when active with zero bids 且商戶開咗開關 */}
      {isActive && bids.length === 0 && noBidEnabled && (
        <div className="bottom-nav-toast" style={{ zIndex: 9999 }}>
          <div className="bottom-nav-toast-inner">
            <span className="bottom-nav-toast-icon">🪙</span>
            <div>
              <div className="bottom-nav-toast-title">{noBidMessage}</div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <Header />
      <div className="container pt-8 pb-40">
        {/* Breadcrumb */}
        <SessionAwareBack auctionId={auctionId} merchantUserId={auction.createdBy} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left: Images */}
          <div>
            <div
              className={`aspect-square rounded-2xl overflow-hidden bg-amber-50 border border-amber-100 mb-3 relative select-none ${isVideoSelected ? '' : 'cursor-zoom-in'}`}
              onTouchStart={(e) => {
                if (isVideoSelected) return;
                touchStartXRef.current = e.touches[0].clientX;
                touchStartYRef.current = e.touches[0].clientY;
                touchOpenedLightboxRef.current = false;
              }}
              onTouchEnd={(e) => {
                if (isVideoSelected) return;
                const dx = touchStartXRef.current - e.changedTouches[0].clientX;
                const dy = touchStartYRef.current - e.changedTouches[0].clientY;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (Math.abs(dx) >= 40 && totalMedia > 1) {
                  // 水平滑動：切換
                  if (dx > 0) goToImage((selectedImage + 1) % totalMedia, 'left');
                  else goToImage((selectedImage - 1 + totalMedia) % totalMedia, 'right');
                } else if (dist < 10 && images.length > 0) {
                  // 輕按：開燈箱
                  touchOpenedLightboxRef.current = true;
                  setLightboxOpen(true);
                }
              }}
              onClick={() => {
                if (isVideoSelected) return;
                if (!touchOpenedLightboxRef.current && images.length > 0) setLightboxOpen(true);
                touchOpenedLightboxRef.current = false;
              }}
            >
              {totalMedia > 0 ? (
                <>
                  {isVideoSelected ? (
                    <video
                      key={`vid-${currentMedia.url}`}
                      src={currentMedia.url}
                      controls
                      playsInline
                      preload="metadata"
                      className="absolute inset-0 w-full h-full bg-black object-contain"
                    />
                  ) : (
                    <>
                      {/* 移出的舊圖片 */}
                      {outgoingImage !== null && mediaList[outgoingImage]?.kind === 'image' && (
                        <img
                          key={`out-${outgoingImage}`}
                          src={mediaList[outgoingImage]?.url}
                          alt=""
                          draggable={false}
                          className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                          style={{
                            animation: `${slideDir === 'left' ? 'img-slide-out-left' : 'img-slide-out-right'} 0.38s ease-in-out forwards`,
                            WebkitTouchCallout: 'none',
                          }}
                        />
                      )}
                      {/* 移入的新圖片 / 靜止圖片 */}
                      <img
                        key={`in-${selectedImage}-${slideDir}`}
                        src={currentMedia?.url}
                        alt={auction.title}
                        draggable={false}
                        className="w-full h-full object-contain pointer-events-none"
                        style={outgoingImage !== null && mediaList[outgoingImage]?.kind === 'image' ? {
                          animation: `${slideDir === 'left' ? 'img-slide-in-from-right' : 'img-slide-in-from-left'} 0.38s ease-in-out forwards`,
                          WebkitTouchCallout: 'none',
                        } : {
                          opacity: fadeVisible ? 1 : 0,
                          transition: 'opacity 0.38s ease-in-out',
                          WebkitTouchCallout: 'none',
                        }}
                      />
                    </>
                  )}
                  {/* 左右箭咀 */}
                  {totalMedia > 1 && (
                    <>
                      <button
                        onTouchEnd={(e) => e.stopPropagation()}
                        onClick={(e) => { e.stopPropagation(); goToImage((selectedImage - 1 + totalMedia) % totalMedia, 'right'); }}
                        className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 bg-black/30 hover:bg-black/50 rounded-full flex items-center justify-center backdrop-blur-sm transition-colors z-10"
                      >
                        <ChevronLeft className="w-5 h-5 text-white" />
                      </button>
                      <button
                        onTouchEnd={(e) => e.stopPropagation()}
                        onClick={(e) => { e.stopPropagation(); goToImage((selectedImage + 1) % totalMedia, 'left'); }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 bg-black/30 hover:bg-black/50 rounded-full flex items-center justify-center backdrop-blur-sm transition-colors z-10"
                      >
                        <ChevronRight className="w-5 h-5 text-white" />
                      </button>
                    </>
                  )}
                  {/* 底部漸層遮罩（影片播放時隱藏，避免擋控制條） */}
                  {!isVideoSelected && (
                    <div
                      className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none"
                      style={{ background: "linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.28) 55%, transparent 100%)" }}
                    />
                  )}
                  {/* 左下：商戶名稱 */}
                  {!isVideoSelected && auction.sellerName && (
                    <div className="absolute bottom-2.5 left-3 flex items-center gap-1.5 pointer-events-none">
                      <User className="w-3 h-3 text-white/80" />
                      <span className="text-white text-xs font-medium drop-shadow">{auction.sellerName}</span>
                    </div>
                  )}
                  {/* 底部中央：計數 */}
                  {!isVideoSelected && totalMedia > 1 && (
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 pointer-events-none">
                      <span className="text-white/90 text-xs font-semibold tabular-nums drop-shadow">
                        {selectedImage + 1}/{totalMedia}
                      </span>
                    </div>
                  )}
                  {/* 右下：分享按鈕（用統一 ShareMenu） */}
                  {!isVideoSelected && (
                    <div
                      className="absolute bottom-2 right-2 z-10"
                      onClick={(e) => e.stopPropagation()}
                      onTouchEnd={(e) => e.stopPropagation()}
                    >
                      <ShareMenu
                        auctionId={auctionId}
                        title={auction.title}
                        latestBid={Number(auction.currentPrice)}
                        currency={(auction as { currency?: string })?.currency}
                        endTime={auction.endTime}
                      />
                    </div>
                  )}
                </>
              ) : (
                <div className="w-full h-full coin-placeholder flex items-center justify-center">
                  <span className="text-8xl">🪙</span>
                </div>
              )}
            </div>

            {/* 縮圖列 */}
            {totalMedia > 1 && (
              <div className="flex gap-1.5 px-0.5 pt-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
                {mediaList.map((m, i) => (
                  <button
                    key={m.key}
                    onClick={() => goToImage(i, i > selectedImage ? 'left' : 'right')}
                    className={`relative flex-shrink-0 w-14 h-14 rounded-xl overflow-hidden border-2 transition-all ${i === selectedImage ? "border-amber-400 scale-105 shadow-md" : "border-transparent opacity-70 hover:opacity-100"}`}
                  >
                    {m.kind === 'video' ? (
                      <>
                        <video src={m.url} preload="metadata" muted playsInline className="w-full h-full object-cover bg-black pointer-events-none" />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/35 pointer-events-none">
                          <Play className="w-5 h-5 text-white drop-shadow" fill="currentColor" />
                        </div>
                      </>
                    ) : (
                      <img src={m.url} alt="" className="w-full h-full object-cover" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right: Details */}
          <div className="flex flex-col gap-5">
            {/* Title & Status */}
            <div>
              <SessionBelongsBanner auctionId={auctionId} merchantUserId={auction.createdBy} />
              <h1 className="text-2xl font-bold leading-tight mb-3">{auction.title}</h1>
              <div className="flex items-center justify-end gap-2 mb-2">
                <Badge className={isActive ? "bg-emerald-500 text-white" : "bg-gray-400 text-white"}>
                  {isActive ? "競拍中" : "已結束"}
                </Badge>
                <button
                  onClick={() => {
                    if (!isAuthenticated) { window.location.href = getLoginUrl(); return; }
                    toggleFavoriteMutation.mutate({ auctionId });
                  }}
                  className={`w-8 h-8 flex items-center justify-center rounded-full transition-all ${
                    isFavorited ? "bg-rose-100 hover:bg-rose-200" : "bg-gray-100 hover:bg-rose-50"
                  }`}
                  title={isFavorited ? "取消收藏" : "加入收藏"}
                >
                  <Heart className={`w-4 h-4 transition-all ${isFavorited ? "text-rose-500 fill-rose-500" : "text-gray-400"}`} />
                </button>
              </div>
              {auction.description && (
                <p className="text-muted-foreground text-sm leading-relaxed">{auction.description}</p>
              )}
            </div>

            {/* Price Card */}
            <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-50">
              <CardContent className="p-5">
                {/* 第一行：出價 label + 大價（左）｜ 交收/付款 icon+文字（右，底部對齊大價） */}
                <div className="flex items-end justify-between mb-1">
                  <div>
                    <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1.5 flex-wrap">
                      {!isActive && bids.length === 0 ? (
                        <span className="text-gray-400 font-medium">流拍－未有出價</span>
                      ) : !isActive && bids.length > 0 ? (
                        <>
                          成交價
                          {(() => {
                            const isWinner = bids[0].userId === user?.id;
                            const canSee = isPrivileged || isWinner;
                            const name = canSee ? displayName(bids[0], user?.id) : "***";
                            return (
                              <span className={`font-semibold ${isWinner ? "text-emerald-600" : canSee ? "text-red-500" : "text-gray-500"}`} style={{ fontSize: "15px" }}>
                                (得標者 {name}{isWinner ? " ✓" : ""})
                              </span>
                            );
                          })()}
                        </>
                      ) : (
                        <>
                          當前最高出價
                          {bids.length === 0 && (
                            <span className="text-[9px] text-black font-normal">(未有出價)</span>
                          )}
                          {bids.length > 0 && bids[0].userId === user?.id && bids[0].isAnonymous !== 1 ? (
                            <span className="text-emerald-600 font-bold" style={{ fontSize: "15px" }}>(我本人✓)</span>
                          ) : bids.length > 0 && (
                            <span className="text-red-500 font-semibold" style={{ fontSize: "15px" }}>({displayName(bids[0], user?.id)})</span>
                          )}
                        </>
                      )}
                    </div>
                    <div className="text-3xl font-extrabold text-amber-600 price-tag">
                      {currencySymbol}{Number(auction.currentPrice).toLocaleString()}
                    </div>
                  </div>
                  <button
                    onClick={() => setPaymentInfoOpen(true)}
                    className="flex items-center gap-1 text-amber-600 hover:text-amber-700 transition-colors mb-0.5"
                    title="得標後交收 / 付款方式"
                  >
                    <Info className="w-3.5 h-3.5" />
                    <span className="text-xs font-medium">交收/付款</span>
                  </button>
                </div>

                {/* 第二行（同一行）：起拍價（左）｜ 每口加幅 + 出價次數（右） */}
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-muted-foreground">
                    起拍價：{currencySymbol}{Number(auction.startingPrice).toLocaleString()}
                  </span>
                  <div className="flex items-center gap-3 text-xs text-amber-700 font-semibold">
                    <span className="flex items-center gap-0.5">
                      <ArrowUpCircle className="w-3.5 h-3.5" />每口 {currencySymbol}{bidIncrement}
                    </span>
                    <span className="flex items-center gap-0.5">
                      <TrendingUp className="w-3.5 h-3.5" />次數 {bids.length}
                    </span>
                  </div>
                </div>

                {/* Countdown + 問商戶 icon */}
                <div className="flex items-center mb-2" style={{ gap: "20px" }}>
                  <div className="inline-flex flex-col" style={{ gap: "3px" }}>
                    <CountdownTimer endTime={new Date(auction.endTime)} />
                    <span className="text-[0.68rem] text-muted-foreground leading-tight self-end">
                      結束：{formatDate(new Date(auction.endTime))}
                    </span>
                  </div>
                  <div className="-rotate-[18deg] origin-center transition-transform hover:-rotate-[8deg] hover:scale-105">
                    <ChatButton
                      auctionId={auctionId}
                      merchantId={auction.createdBy}
                      auctionEnded={!isActive}
                      auctionTitle={auction.title}
                      compact
                    />
                  </div>
                </div>

                {/* 反狙擊延時提示 */}
                {(() => {
                  const a = auction as typeof auction & {
                    antiSnipeEnabled?: number | null;
                    antiSnipeMinutes?: number | null;
                    extendMinutes?: number | null;
                  };
                  const enabled = (a.antiSnipeEnabled ?? 1) === 1 && (a.antiSnipeMinutes ?? 3) > 0;
                  if (enabled) {
                    return (
                      <div className="mb-4 flex items-start gap-2 px-3 py-2 rounded-md bg-amber-50 border border-amber-200">
                        <span className="text-base leading-none mt-0.5">🛡️</span>
                        <div className="text-xs leading-snug">
                          <div className="font-semibold text-amber-700">反狙擊延時已啟用</div>
                          <div className="text-amber-700/90 mt-0.5">
                            結束前 {a.antiSnipeMinutes ?? 3} 分鐘內有出價，自動延長 {a.extendMinutes ?? 3} 分鐘
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div className="mb-4 flex items-start gap-2 px-3 py-2 rounded-md bg-gray-100 border border-gray-300">
                      <span className="text-base leading-none mt-0.5">⏱️</span>
                      <div className="text-xs leading-snug">
                        <div className="font-semibold text-gray-700">出價沒有加時</div>
                        <div className="text-gray-600 mt-0.5">
                          到結束時間即停止出價，無延時保護
                        </div>
                      </div>
                    </div>
                  );
                })()}

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

                {/* Bid Input — 商戶自己嘅商品都展示，按下時先 check */}
                {isActive && (
                  isAuthenticated ? (
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
                              checked={isAnonymous && canUseAnonymous}
                              onCheckedChange={(v) => {
                                if (!canUseAnonymous) {
                                  toast.info(memberLevel === 'bronze'
                                    ? '匿名出價功能僅限 🥈 銀牌或以上會員，立即升級即可隱藏身份競投'
                                    : '匿名出價暫時關閉');
                                  return;
                                }
                                setIsAnonymous(v);
                              }}
                              disabled={!canUseAnonymous}
                              className="data-[state=checked]:bg-slate-500"
                            />
                          </div>
                          {!canUseAnonymous && memberLevel === 'bronze' && (
                            <p className="text-[11px] text-amber-600 text-center -mt-1">
                              💡 匿名出價需 🥈 銀牌或以上會員，<button type="button" className="underline font-medium" onClick={() => memberBenefits.openDialog('silver')}>了解升級條件</button>
                            </p>
                          )}
                        </>
                      ) : (
                        <>
                          {/* 等級限制提示：銅牌配額 / 銀牌單次上限 */}
                          {memberLevel === 'bronze' && bronzeQuota.total > 0 && (
                            <div className={`text-xs text-center px-3 py-2 rounded-lg border ${
                              bronzeQuota.remaining > 0
                                ? 'bg-amber-50 border-amber-200 text-amber-700'
                                : 'bg-red-50 border-red-200 text-red-700'
                            }`}>
                              {bronzeQuota.remaining > 0 ? (
                                <>🥉 銅牌會員本月代理出價剩 <strong>{bronzeQuota.remaining} / {bronzeQuota.total}</strong> 次・<button type="button" className="underline font-medium" onClick={() => memberBenefits.openDialog('silver')}>升銀牌解鎖無限</button></>
                              ) : (
                                <>🥉 本月代理出價配額已用完（{bronzeQuota.total} / {bronzeQuota.total}）・<button type="button" className="underline font-medium" onClick={() => memberBenefits.openDialog('silver')}>升 🥈 銀牌即可解鎖無限次</button></>
                              )}
                            </div>
                          )}
                          {memberLevel === 'bronze' && bronzeQuota.total <= 0 && (
                            <div className="text-xs text-center px-3 py-2 rounded-lg border bg-red-50 border-red-200 text-red-700">
                              代理出價功能僅限 🥈 銀牌或以上會員・<button type="button" className="underline font-medium" onClick={() => memberBenefits.openDialog('silver')}>了解升級條件</button>
                            </div>
                          )}
                          {memberLevel === 'silver' && silverMaxAmount > 0 && (
                            <div className="text-xs text-center px-3 py-2 rounded-lg border bg-blue-50 border-blue-200 text-blue-700">
                              🥈 銀牌會員代理出價單次上限 <strong>{currencySymbol}{silverMaxAmount.toLocaleString()}</strong>・<button type="button" className="underline font-medium" onClick={() => memberBenefits.openDialog('gold')}>升金牌解除上限</button>
                            </div>
                          )}

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
                                disabled={setProxyBidMutation.isPending || !canUseAutoBid}
                                className="bg-blue-500 hover:bg-blue-600 text-white border-0 shadow-md px-4"
                              >
                                {setProxyBidMutation.isPending ? "設定中..." : !canUseAutoBid ? "配額已用完" : "設定代理"}
                              </Button>
                            </div>
                            <p className="text-xs text-blue-500 text-center">
                              代理上限至少 {currencySymbol}{minBid.toLocaleString()}・每口加幅 {currencySymbol}{bidIncrement}
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    <a href={`/login?from=${encodeURIComponent(window.location.pathname + window.location.search)}`}>
                      <Button className="w-full gold-gradient text-white border-0 shadow-md hover:opacity-90">
                        {notLoggedInBidText}
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
                        {bids.map((bid, i) => {
                          // 已結束：得標者（i===0）只有本人/商戶/admin 見真名，其餘見「得標者 ***」；其他出價者一律「出價者」
                          const isWinnerRow = i === 0 && !isActive;
                          const isCurrentUserWinner = bid.userId === user?.id;
                          const canSeeWinner = isPrivileged || isCurrentUserWinner;
                          const shownName = !isActive && i > 0
                            ? "出價者"
                            : isWinnerRow && !canSeeWinner
                              ? "得標者 ***"
                              : displayName(bid, user?.id);
                          return (
                            <div key={bid.id} className={`flex items-center justify-between py-2 px-3 rounded-lg text-sm ${i === 0 ? "bg-amber-50 border border-amber-200" : "bg-muted/30"}`}>
                              <div className="flex items-center gap-2">
                                <User className="w-3.5 h-3.5 text-muted-foreground" />
                                <span className="text-muted-foreground">{shownName}</span>
                                {i === 0 && <Badge className="bg-amber-500 text-white text-xs py-0">最高</Badge>}
                              </div>
                              <div className="font-bold text-amber-700 price-tag">
                                {currencySymbol}{Number(bid.bidAmount).toLocaleString()}
                              </div>
                            </div>
                          );
                        })}
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
                              <span className="font-medium text-foreground">{(isActive || isPrivileged) ? log.proxyUserName : "出價者"}</span>
                              <span>的代理自動出價</span>
                              <span className="font-bold text-blue-600">{currencySymbol}{log.proxyAmount.toLocaleString()}</span>
                            </div>
                            <div className="text-muted-foreground mt-0.5">
                              觸發者：{(isActive || isPrivileged) ? log.triggerUserName : "出價者"}（{currencySymbol}{log.triggerAmount.toLocaleString()}）
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
            <p className="text-sm font-semibold text-amber-800 pt-1 truncate">{(auction as { title?: string })?.title ?? ''}</p>
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
            <p className="text-xs font-semibold text-rose-600 text-center">⚠️ 嚴重警告：惡意亂出價一經商戶或系統核實，將永久停用帳號。</p>
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
            <p className="text-sm font-semibold text-blue-800 pt-1 truncate">{(auction as { title?: string })?.title ?? ''}</p>
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

      <MembershipBenefitsDialog
        open={memberBenefits.open}
        onOpenChange={memberBenefits.setOpen}
        highlightLevel={memberBenefits.highlightLevel}
      />

      {lightboxOpen && images.length > 0 && (
        <ImageLightbox
          images={images.map(img => img.imageUrl)}
          initialIndex={lightboxIndex}
          alt={auction.title}
          onClose={() => setLightboxOpen(false)}
        />
      )}

      {/* 交收/付款方式 底部彈窗 */}
      {paymentInfoOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 pb-20"
          onClick={() => setPaymentInfoOpen(false)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-sm shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
              <h2 className="font-bold text-gray-800 text-base">得標後交收 / 付款方式</h2>
              <button onClick={() => setPaymentInfoOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-4">
              {(paymentInfo as any)?.deliveryInfo ? (
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 mb-2">
                    <Truck className="w-3.5 h-3.5" />交收安排
                  </div>
                  <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed bg-gray-50 rounded-xl px-3 py-2.5">
                    {(paymentInfo as any).deliveryInfo}
                  </p>
                </div>
              ) : null}
              {(paymentInfo as any)?.paymentInstructions ? (
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 mb-2">
                    <CreditCard className="w-3.5 h-3.5" />付款方式
                  </div>
                  <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed bg-gray-50 rounded-xl px-3 py-2.5">
                    {(paymentInfo as any).paymentInstructions}
                  </p>
                </div>
              ) : null}
              {!(paymentInfo as any)?.deliveryInfo && !(paymentInfo as any)?.paymentInstructions && (
                <p className="text-sm text-gray-400 text-center py-6">商戶未設定交收 / 付款資訊</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
