import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Send, ThumbsUp, ThumbsDown, X, Truck, User, EyeOff, Eye, Bot } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { getLoginUrl } from "@/const";
import { Switch } from "@/components/ui/switch";
import { useConfirm } from "@/components/ui/confirm-provider";

interface AuctionFbPanelProps {
  open: boolean;
  onClose: () => void;
  auctionId: number;
  auctionTitle: string;
  createdBy?: number;
  sellerName?: string | null;
  sellerPhotoUrl?: string | null;
  currency?: string | null;
  currentPrice: number;
  highestBidderName?: string | null;
  highestBidderId?: number | null;
  bidIncrement?: number;
  bidCount?: number;
  isEnded: boolean;
  antiSnipeEnabled?: number;
  antiSnipeMinutes?: number;
  extendMinutes?: number;
  endTime?: string | Date;
}

type PanelItem = {
  type: "bid" | "comment";
  id: number;
  userId: number;
  userName: string;
  realUserName: string | null;
  photoUrl: string | null;
  content: string;
  rawAmount: number | null;
  isAnonymous: boolean;
  isMyBid: boolean;
  replyToBidId: number | null;
  createdAt: string;
};

function timeAgo(d: string): string {
  /* Server sends UTC ISO (with Z). If somehow still raw MySQL "YYYY-MM-DD HH:MM:SS", append Z */
  const iso = d.includes("Z") || d.includes("+") ? d : d.replace(" ", "T") + "Z";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "剛才";
  if (m < 60) return `${m}分鐘`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}小時`;
  return `${Math.floor(h / 24)}天`;
}

function FloatingParticle({ dir, onDone }: { dir: "up" | "down"; onDone: () => void }) {
  return (
    <span
      className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 text-xl select-none z-20"
      style={{ animation: dir === "up" ? "fb-heart-float 0.8s ease-out forwards" : "fb-dislike-drop 0.8s ease-out forwards" }}
      onAnimationEnd={onDone}
    >
      {dir === "up" ? "❤️" : "👎"}
    </span>
  );
}

function Avatar({ name, photoUrl, size = "md", isParticipant = false, isWinnerAnon = false }: { name: string; photoUrl?: string | null; size?: "sm" | "md" | "lg"; isParticipant?: boolean; isWinnerAnon?: boolean }) {
  const sz = size === "sm" ? "w-7 h-7 text-xs" : size === "lg" ? "w-11 h-11 text-base" : "w-9 h-9 text-sm";
  const iconSz = size === "sm" ? "w-4 h-4" : size === "lg" ? "w-6 h-6" : "w-5 h-5";
  if (isWinnerAnon) {
    return (
      <div className={`${sz} rounded-full bg-amber-400 flex items-center justify-center text-white shrink-0`}>
        <User className={iconSz} />
      </div>
    );
  }
  if (isParticipant) {
    return (
      <div className={`${sz} rounded-full bg-gray-300 flex items-center justify-center text-gray-500 shrink-0`}>
        <User className={iconSz} />
      </div>
    );
  }
  return (
    <div className={`${sz} rounded-full bg-amber-500 flex items-center justify-center text-white font-bold shrink-0 overflow-hidden`}>
      {photoUrl
        ? <img src={photoUrl} alt={name} className="w-full h-full object-cover" />
        : name.charAt(0).toUpperCase()
      }
    </div>
  );
}

/* ── Mini countdown (live) ── */
function MiniCountdown({ endTime }: { endTime: Date }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const diff = endTime.getTime() - now.getTime();
  if (diff <= 0) return <span className="font-bold tabular-nums text-red-500">已結束</span>;
  const days = Math.floor(diff / 86400000);
  const hrs = Math.floor((diff % 86400000) / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  const secs = Math.floor((diff % 60000) / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  const urgent = diff < 180000;
  return (
    <span className={`font-bold tabular-nums ${urgent ? "bg-red-600 text-white rounded px-1 py-0.5 animate-pulse" : ""}`}>
      {days > 0 ? `${days}日 ` : ""}{pad(hrs)}:{pad(mins)}:{pad(secs)}
    </span>
  );
}

/* ── Sort picker bottom sheet (FB-style radio) ── */
const SORT_OPTIONS = [
  { value: "new" as const, label: "由新至舊", desc: "顯示所有回應，且最新的回應顯示在最上方。" },
  { value: "old" as const, label: "由舊至新", desc: "顯示所有回應，且最舊的回應顯示在最上方。" },
];

function SortSheet({ current, onSelect, onClose }: { current: "new" | "old"; onSelect: (v: "new" | "old") => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[80] flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative z-10 w-full bg-white rounded-t-2xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>
        {SORT_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            className="w-full flex items-center justify-between px-5 py-4 border-b border-gray-100 last:border-0 active:bg-gray-50"
            onClick={() => { onSelect(opt.value); onClose(); }}
          >
            <div className="text-left">
              <p className="text-[15px] font-semibold text-gray-900">{opt.label}</p>
              <p className="text-[12px] text-gray-500 mt-0.5">{opt.desc}</p>
            </div>
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ml-4 ${current === opt.value ? "border-[#1877f2]" : "border-gray-300"}`}>
              {current === opt.value && <div className="w-2.5 h-2.5 rounded-full bg-[#1877f2]" />}
            </div>
          </button>
        ))}
        <div className="h-6" />
      </div>
    </div>
  );
}

export function AuctionFbPanel({
  open, onClose, auctionId, createdBy, sellerName, sellerPhotoUrl,
  currency, currentPrice, highestBidderName, highestBidderId, bidIncrement = 30, bidCount = 0, isEnded,
  endTime, antiSnipeEnabled, antiSnipeMinutes, extendMinutes,
}: AuctionFbPanelProps) {
  const { user, isAuthenticated } = useAuth();
  const isMerchant = !!user && user.id === createdBy;
  const isAdmin = !!(user as any)?.role && (user as any).role === "admin";
  const isCurrentUserWinner = !!(highestBidderId && user?.id && user.id === highestBidderId);
  /* isPrivileged is finalised after items are known — see below */
  const curr = (!currency || currency === "HKD") ? "HK$" : currency;
  const sellerDisplayName = sellerName ?? "商戶";
  const confirm = useConfirm();

  const [sort, setSort] = useState<"new" | "old">("new");
  const [showSortSheet, setShowSortSheet] = useState(false);
  const [bidInput, setBidInput] = useState("");
  const [merchantInput, setMerchantInput] = useState("");
  const [merchantSentSuccess, setMerchantSentSuccess] = useState(false);
  const [replyingToBidId, setReplyingToBidId] = useState<number | null>(null);
  const [replyText, setReplyText] = useState("");
  const [particles, setParticles] = useState<{ id: number; bidId: number; dir: "up" | "down" }[]>([]);
  const pidRef = useRef(0);
  const [paymentInfoOpen, setPaymentInfoOpen] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [proxyBidOpen, setProxyBidOpen] = useState(false);
  const [proxyAmountStr, setProxyAmountStr] = useState("");
  const [proxyConfirmStep, setProxyConfirmStep] = useState(false);
  const [bidConfirm, setBidConfirm] = useState<{ amount: number } | null>(null);

  /* ── Drag-to-close (down + right) ── */
  const [dragY, setDragY] = useState(0);
  const [dragX, setDragX] = useState(0);
  const dragYRef = useRef(0);
  const dragXRef = useRef(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const dragDir = useRef<"y" | "x" | null>(null);
  const startY = useRef(0);
  const startX = useRef(0);

  const triggerClose = useCallback(() => {
    setDragY(window.innerHeight);
    dragYRef.current = window.innerHeight;
    setTimeout(() => { setDragY(0); dragYRef.current = 0; onClose(); }, 280);
  }, [onClose]);

  const triggerCloseRight = useCallback(() => {
    setDragX(window.innerWidth);
    dragXRef.current = window.innerWidth;
    setTimeout(() => { setDragX(0); dragXRef.current = 0; onClose(); }, 280);
  }, [onClose]);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel || !open) return;
    const onStart = (e: TouchEvent) => {
      startY.current = e.touches[0].clientY;
      startX.current = e.touches[0].clientX;
      isDragging.current = false;
    };
    const onMove = (e: TouchEvent) => {
      const dy = e.touches[0].clientY - startY.current;
      const dx = e.touches[0].clientX - startX.current;
      const atTop = !scrollRef.current || scrollRef.current.scrollTop <= 0;
      if (!isDragging.current) {
        if (dy > 8 && Math.abs(dy) > Math.abs(dx) && atTop) { isDragging.current = true; dragDir.current = "y"; }
        else if (dx > 8 && Math.abs(dx) > Math.abs(dy)) { isDragging.current = true; dragDir.current = "x"; }
      }
      if (isDragging.current) {
        e.preventDefault();
        if (dragDir.current === "y") {
          const clamped = Math.max(0, dy);
          dragYRef.current = clamped;
          setDragY(clamped);
        } else {
          const clamped = Math.max(0, dx);
          dragXRef.current = clamped;
          setDragX(clamped);
        }
      }
    };
    const onEnd = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      if (dragDir.current === "y") {
        if (dragYRef.current > 120) triggerClose();
        else { setDragY(0); dragYRef.current = 0; }
      } else {
        if (dragXRef.current > 100) triggerCloseRight();
        else { setDragX(0); dragXRef.current = 0; }
      }
      dragDir.current = null;
    };
    panel.addEventListener("touchstart", onStart, { passive: true });
    panel.addEventListener("touchmove", onMove, { passive: false });
    panel.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      panel.removeEventListener("touchstart", onStart);
      panel.removeEventListener("touchmove", onMove);
      panel.removeEventListener("touchend", onEnd);
    };
  }, [open, triggerClose, triggerCloseRight]);

  /* ── iOS body scroll lock ── */
  useEffect(() => {
    if (!open) return;
    const scrollY = window.scrollY;
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    document.body.style.overflow = "hidden";
    return () => {
      const savedY = Math.abs(parseInt(document.body.style.top || "0", 10));
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
      document.body.style.overflow = "";
      window.scrollTo(0, savedY);
    };
  }, [open]);

  const utils = trpc.useUtils();
  const { data: panelData, isLoading } = trpc.auctionFbPanel.getPanel.useQuery(
    { auctionId, sort, viewerUserId: user?.id, createdBy: createdBy ?? undefined },
    { enabled: open, refetchOnWindowFocus: false }
  );
  const { data: paymentInfo } = trpc.merchants.getPaymentInfo.useQuery(
    { merchantUserId: createdBy! },
    { enabled: !!createdBy && open }
  );
  const { data: myProxy, refetch: refetchProxy } = trpc.auctions.getMyProxyBid.useQuery(
    { auctionId },
    { enabled: isAuthenticated && open }
  );
  const { data: defaultAnonData } = trpc.users.getDefaultAnonymous.useQuery(undefined, {
    enabled: isAuthenticated && open,
  });
  const { data: autoBidStatus } = trpc.loyalty.myAutoBidStatus.useQuery(undefined, {
    enabled: isAuthenticated && open,
  });
  const canUseAnonymous = autoBidStatus?.canUseAnonymous ?? false;
  const canUseAutoBid = autoBidStatus?.canUseAutoBid ?? true;
  const memberLevel = autoBidStatus?.level ?? "bronze";
  const bronzeQuota = autoBidStatus?.bronzeQuota ?? { used: 0, total: 0, remaining: 0 };
  const silverMaxAmount = autoBidStatus?.silverMaxAmount ?? 0;

  useEffect(() => {
    if (defaultAnonData !== undefined) {
      setIsAnonymous((defaultAnonData as { defaultAnonymous: number }).defaultAnonymous === 1);
    }
  }, [defaultAnonData]);
  useEffect(() => {
    if (autoBidStatus && !canUseAnonymous && isAnonymous) {
      setIsAnonymous(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoBidStatus]);

  const broadcastMutation = trpc.auctionFbPanel.postMerchantBroadcast.useMutation({
    onSuccess: () => { setMerchantInput(""); setMerchantSentSuccess(true); utils.auctionFbPanel.getPanel.invalidate(); toast.success("廣播訊息已發送"); },
    onError: (err) => toast.error(err.message),
  });
  const likeBidMutation = trpc.auctionFbPanel.merchantLikeBid.useMutation({
    onSuccess: () => toast.success("已發送讚好通知"),
    onError: (err) => toast.error(err.message),
  });
  const replyBidMutation = trpc.auctionFbPanel.merchantReplyBid.useMutation({
    onSuccess: () => { setReplyingToBidId(null); setReplyText(""); utils.auctionFbPanel.getPanel.invalidate(); toast.success("回覆已發送"); },
    onError: (err) => toast.error(err.message),
  });
  const setProxyBidMutation = trpc.auctions.setProxyBid.useMutation({
    onSuccess: () => {
      toast.success("代理出價已設定！系統將在您被超越時自動出價。");
      setProxyAmountStr("");
      setProxyBidOpen(false);
      refetchProxy();
    },
    onError: (err) => toast.error(`設定失敗：${err.message}`),
  });
  const cancelProxyBidMutation = trpc.auctions.cancelProxyBid.useMutation({
    onSuccess: () => { toast.success("代理出價已取消"); refetchProxy(); },
    onError: (err) => toast.error(`取消失敗：${err.message}`),
  });

  const placeBid = trpc.auctions.placeBid.useMutation({
    onSuccess: () => {
      setBidInput("");
      setProxyAmountStr("");
      setProxyBidOpen(false);
      utils.auctionFbPanel.getPanel.invalidate();
      toast.success("出價成功！");
      setTimeout(() => {
        if (sort === "new") scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
        else scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
      }, 350);
    },
    onError: (err) => toast.error(`出價失敗：${err.message}`),
  });

  /* Chrome: ctx.user may be null for publicProcedure — supplement server isMyBid with client check */
  const items: PanelItem[] = (panelData?.items ?? []).map(item => ({
    ...item,
    realUserName: (item as any).realUserName ?? null,
    isMyBid: item.isMyBid || (
      item.type === "bid" &&
      user?.id != null &&
      String(item.userId) === String(user.id)
    ),
  }));
  /* Any user who placed a bid in this auction also sees real names/photos */
  const isParticipant = items.some((i) => i.isMyBid);
  const isPrivileged = isMerchant || isAdmin || isCurrentUserWinner || isParticipant;

  const topLevelItems = items.filter(
    i => i.type === "bid" || (i.type === "comment" && i.replyToBidId === null)
  );
  const maxBidAmount = Math.max(0, ...items.filter(i => i.type === "bid" && i.rawAmount != null).map(i => Number(i.rawAmount)));
  const replyMap = new Map<number, PanelItem[]>();
  for (const item of items) {
    if (item.type === "comment" && item.replyToBidId != null) {
      const arr = replyMap.get(item.replyToBidId) ?? [];
      arr.push(item);
      replyMap.set(item.replyToBidId, arr);
    }
  }

  /* ── Bottom input avatar: DB-fresh photoUrl ── */
  const myDbPhotoUrl = useMemo(() => {
    if (!user) return null;
    const mine = items.find(i => !i.isAnonymous && String(i.userId) === String(user.id));
    return mine?.photoUrl ?? null;
  }, [items, user]);
  const myAvatarUrl = isMerchant
    ? (sellerPhotoUrl ?? myDbPhotoUrl ?? user?.photoUrl ?? null)
    : (myDbPhotoUrl ?? user?.photoUrl ?? null);

  const triggerParticle = (bidId: number, dir: "up" | "down") => {
    const id = pidRef.current++;
    setParticles(p => [...p, { id, bidId, dir }]);
  };
  const handleLike = (item: PanelItem) => {
    triggerParticle(item.id, "up");
    if (isMerchant && item.type === "bid") likeBidMutation.mutate({ bidId: item.id });
  };
  const handleDislike = (item: PanelItem) => triggerParticle(item.id, "down");
  const handleReplyClick = (item: PanelItem) => {
    if (!isMerchant) { toast.info("溫馨提示：回覆功能不適用"); return; }
    setReplyingToBidId(prev => prev === item.id ? null : item.id);
    setReplyText("");
  };
  const handleReplySubmit = (bidId: number) => {
    if (!replyText.trim()) return;
    replyBidMutation.mutate({ bidId, content: replyText.trim() });
  };
  const handleBuyerBid = async () => {
    if (!isAuthenticated) { window.location.href = getLoginUrl(); return; }
    if (isEnded) { toast.error("此拍賣已結束"); return; }
    const amount = parseInt(bidInput, 10);
    if (!amount || amount <= 0) { toast.error("請輸入有效出價金額"); return; }
    const minBid = bidCount > 0 ? currentPrice + bidIncrement : (currentPrice === 0 ? bidIncrement : currentPrice);
    if (amount < minBid) { toast.error(`出價最低 ${curr}${minBid.toLocaleString()}`); return; }
    if (myProxy?.isActive) {
      const ok = await confirm({
        title: "你已設有代理出價",
        description: `你的代理出價上限為 ${curr}${Number(myProxy.maxAmount).toLocaleString()}，系統會自動為你出價。確定還要手動出價 ${curr}${amount.toLocaleString()}？`,
        confirmText: "確定手動出價",
        cancelText: "取消",
      });
      if (!ok) return;
    }
    setBidConfirm({ amount });
  };
  const handleSetProxy = () => {
    if (!isAuthenticated) { window.location.href = getLoginUrl(); return; }
    const amount = parseInt(proxyAmountStr, 10);
    if (!amount || amount <= 0) { toast.error("請輸入有效代理出價上限"); return; }
    const minBid = bidCount > 0 ? currentPrice + bidIncrement : (currentPrice === 0 ? bidIncrement : currentPrice);
    if (amount < minBid) { toast.error(`代理出價上限最低 ${curr}${minBid.toLocaleString()}`); return; }
    setProxyConfirmStep(true);
  };
  const handleProxyConfirm = () => {
    const amount = parseInt(proxyAmountStr, 10);
    setProxyBidMutation.mutate({ auctionId, maxAmount: amount });
  };
  const handleMerchantSend = () => {
    if (!merchantInput.trim()) return;
    broadcastMutation.mutate({ auctionId, content: merchantInput.trim() });
  };
  const handleQuickBid = async (amount: number) => {
    if (!isAuthenticated) { toast.info("請先登入先可以出價"); return; }
    if (isEnded) { toast.error("此拍賣已結束"); return; }
    if (isMerchant) { toast.warning("商戶不可對自己的拍賣出價"); return; }
    if (myProxy?.isActive) {
      const ok = await confirm({
        title: "你已設有代理出價",
        description: `你的代理出價上限為 ${curr}${Number(myProxy.maxAmount).toLocaleString()}，系統會自動為你出價。確定還要手動出價 ${curr}${amount.toLocaleString()}？`,
        confirmText: "確定手動出價",
        cancelText: "取消",
      });
      if (!ok) return;
    }
    setBidConfirm({ amount });
  };
  const confirmBid = () => {
    if (!bidConfirm) return;
    const amount = bidConfirm.amount;
    setBidConfirm(null);
    placeBid.mutate({ auctionId, bidAmount: amount, isAnonymous: isAnonymous ? 1 : 0 });
  };

  if (!open) return null;

  const panelStyle: React.CSSProperties = {
    transform: `translateY(${dragY}px) translateX(${dragX}px)`,
    transition: (isDragging.current || (dragY === 0 && dragX === 0)) ? "none" : "transform 0.28s cubic-bezier(0.4,0,0.2,1)",
    willChange: "transform",
  };

  const sortLabel = sort === "new" ? "由新至舊" : "由舊至新";

  return (
    <>
      <div className="fixed inset-0 z-[60] flex items-end" onClick={(e) => { if (e.target === e.currentTarget) triggerClose(); }}>
        <div className="absolute inset-0 bg-black/50" onClick={triggerClose} />
        <div ref={panelRef} className="relative z-10 w-full max-h-[88vh] bg-white rounded-t-2xl flex flex-col shadow-2xl" style={panelStyle}>

          {/* Drag handle */}
          <div className="flex justify-center pt-2 pb-0.5 shrink-0 touch-none select-none">
            <div className="w-10 h-1 bg-gray-300 rounded-full" />
          </div>

          {/* Header: sort LEFT | stats + X RIGHT */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 shrink-0">
            {/* LEFT: sort picker button */}
            <button
              className="flex items-center gap-1 text-[15px] font-bold text-gray-900"
              onClick={() => setShowSortSheet(true)}
            >
              {sortLabel}
              <svg className="w-4 h-4 text-gray-600" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>

            {/* RIGHT: stats + close */}
            <div className="flex items-center gap-2">
              <div className="flex flex-col items-end gap-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-base">👍</span>
                  <span className="text-[13px] font-bold text-gray-900">{panelData?.totalBids ?? 0} 則回應</span>
                  {createdBy && (
                    <button onClick={() => setPaymentInfoOpen(true)} className="flex items-center gap-0.5 text-gray-500 hover:text-amber-600 transition-colors shrink-0 ml-0.5">
                      <Truck className="w-3.5 h-3.5" />
                      <span className="text-[10px]">交收</span>
                    </button>
                  )}
                </div>
                {isEnded ? (
                  <span className="text-[11px] font-bold text-red-500 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">拍賣已結束</span>
                ) : (
                  <div className="flex items-center gap-1.5 flex-wrap justify-end">
                    <span className="text-[11px] font-semibold text-amber-600">目前：{curr}{currentPrice.toLocaleString()}</span>
                    {highestBidderName && (
                      <span className="text-[11px] text-gray-500 truncate max-w-[80px]">最高：{highestBidderName}</span>
                    )}
                  </div>
                )}
              </div>
              <button onClick={triggerClose}><X className="w-5 h-5 text-gray-500" /></button>
            </div>
          </div>

          {/* List */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-5">
            {isLoading && (
              <div className="flex justify-center py-10">
                <div className="w-7 h-7 border-2 border-gray-200 border-t-[#1877f2] rounded-full animate-spin" />
              </div>
            )}
            {!isLoading && topLevelItems.length === 0 && (
              <div className="text-center py-10 text-gray-400 text-sm">暫無出價記錄，搶先出價！</div>
            )}

            {topLevelItems.map((item) => {
              /* Merchant broadcast */
              if (item.type === "comment") {
                return (
                  <div key={`comment-${item.id}`} className="flex items-start gap-3">
                    <Avatar name={sellerDisplayName} photoUrl={sellerPhotoUrl ?? item.photoUrl} size="lg" />
                    <div className="flex-1 bg-blue-50 rounded-2xl px-3 py-2 border border-blue-100">
                      <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                        <span className="text-[14px] font-bold text-blue-800">{sellerDisplayName}</span>
                        <span className="text-[10px] bg-[#1877f2] text-white px-1.5 py-0.5 rounded font-semibold">商戶</span>
                        <span className="text-gray-400 text-[12px]">·</span>
                        <span className="text-[12px] text-blue-400">{timeAgo(item.createdAt)}</span>
                      </div>
                      <p className="text-[14px] text-blue-900">{item.content}</p>
                    </div>
                  </div>
                );
              }

              /* Bid item — isMyBid comes from server */
              const isLeading = Number(item.rawAmount) === maxBidAmount && maxBidAmount > 0;
              /* Ended auction: privileged (merchant/admin/winner) → real data; others → masked */
              const isOtherBidder = isEnded && !isPrivileged && !isLeading && !item.isAnonymous;
              const isWinnerAnon = isEnded && !isPrivileged && isLeading && !item.isAnonymous;
              const displayedName = item.isAnonymous
                ? item.realUserName
                  ? `匿名用戶(${item.realUserName})`
                  : "匿名用戶"
                : isWinnerAnon
                ? "得標用戶***"
                : isOtherBidder
                ? "參與用戶"
                : item.userName;
              return (
                <div key={`bid-${item.id}`} className={isLeading ? "border-l-[3px] border-red-500 pl-2 -ml-2" : ""}>
                  <div className="flex items-start gap-3">
                    <Avatar
                      name={item.isAnonymous ? "匿" : item.userName}
                      photoUrl={item.isAnonymous ? null : item.photoUrl}
                      size="lg"
                      isParticipant={isOtherBidder}
                      isWinnerAnon={isWinnerAnon}
                    />
                    <div className="flex-1 min-w-0">
                      {/* name · time */}
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="text-[14px] font-bold text-gray-900">
                          {displayedName}
                        </span>
                        <span className="text-gray-400 text-[12px]">·</span>
                        <span className="text-[12px] text-gray-500">{timeAgo(item.createdAt)}</span>
                      </div>
                      {/* Price + 出價有效 on same line */}
                      <div className="flex items-baseline gap-2 mt-0.5">
                        <p className="text-[18px] font-bold text-gray-900 leading-tight">
                          {item.rawAmount != null
                            ? `${curr}${Number(item.rawAmount).toLocaleString()}`
                            : item.content}
                        </p>
                        {isEnded ? (
                          isLeading && <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-300 rounded px-1 whitespace-nowrap">成功得標 🏆</span>
                        ) : (
                          <>
                            <span className="text-[10px] font-semibold text-green-600 whitespace-nowrap">出價有效 ✓</span>
                            {isLeading && <span className="text-[10px] font-bold text-red-500 border border-red-400 rounded px-1 whitespace-nowrap">領先</span>}
                          </>
                        )}
                      </div>
                      {/* Action row: 回覆 left | 👍👎 right */}
                      <div className="flex items-center justify-between mt-2">
                        <button className="text-[13px] font-bold text-gray-500 hover:text-gray-700" onClick={() => handleReplyClick(item)}>
                          回覆
                        </button>
                        <div className="flex items-center gap-4">
                          <div className="relative flex items-center">
                            {particles.filter(p => p.bidId === item.id && p.dir === "up").map(p => (
                              <FloatingParticle key={p.id} dir="up" onDone={() => setParticles(prev => prev.filter(x => x.id !== p.id))} />
                            ))}
                            <button onClick={() => handleLike(item)} className="text-gray-400 hover:text-[#1877f2] transition-colors">
                              <ThumbsUp className="w-[18px] h-[18px]" />
                            </button>
                          </div>
                          <div className="relative flex items-center">
                            {particles.filter(p => p.bidId === item.id && p.dir === "down").map(p => (
                              <FloatingParticle key={p.id} dir="down" onDone={() => setParticles(prev => prev.filter(x => x.id !== p.id))} />
                            ))}
                            <button onClick={() => handleDislike(item)} className="text-gray-400 hover:text-red-400 transition-colors">
                              <ThumbsDown className="w-[18px] h-[18px]" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Merchant reply input */}
                      {replyingToBidId === item.id && (
                        <div className="mt-2 flex items-center gap-2">
                          <Avatar name={user?.name ?? "?"} photoUrl={myAvatarUrl} size="sm" />
                          <input
                            className="flex-1 px-3 py-1.5 text-sm outline-none placeholder-gray-400"
                            style={{ background: "#fff", border: "1px solid #E5E5E5", borderRadius: "12px" }}
                            placeholder="輸入回覆..."
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleReplySubmit(item.id); } }}
                            autoFocus
                          />
                          <button onClick={() => handleReplySubmit(item.id)} disabled={!replyText.trim() || replyBidMutation.isPending} className="text-[#1877f2] disabled:opacity-40 shrink-0">
                            <Send className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Nested replies */}
                  {(replyMap.get(item.id) ?? []).map(reply => {
                    const isMerchantReply = Number(reply.userId) === Number(createdBy);
                    return (
                      <div key={reply.id} className={`flex items-start gap-2 mt-2 pl-14 ${isMerchantReply ? "pr-1" : ""}`}>
                        <Avatar
                          name={isMerchantReply ? sellerDisplayName : reply.userName}
                          photoUrl={isMerchantReply ? (sellerPhotoUrl ?? reply.photoUrl) : reply.photoUrl}
                          size="sm"
                        />
                        <div className={`flex-1 ${isMerchantReply ? "bg-blue-50 rounded-2xl px-3 py-2 border border-blue-100" : ""}`}>
                          <div className="flex items-center gap-1 flex-wrap">
                            <span className={`text-[13px] font-bold ${isMerchantReply ? "text-blue-800" : "text-gray-900"}`}>
                              {isMerchantReply ? sellerDisplayName : reply.userName}
                            </span>
                            {isMerchantReply && (
                              <span className="text-[10px] bg-[#1877f2] text-white px-1.5 py-0.5 rounded font-semibold">商戶</span>
                            )}
                            <span className="text-gray-400 text-[11px]">·</span>
                            <span className="text-[11px] text-gray-400">{timeAgo(reply.createdAt)}</span>
                          </div>
                          <p className={`text-[13px] mt-0.5 ${isMerchantReply ? "text-blue-900" : "text-gray-800"}`}>{reply.content}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Countdown + anti-snipe — visible to ALL (merchant included) */}
          {endTime && !isEnded && (
            <div className="border-t border-gray-100 px-3 pt-2 pb-1.5 bg-white shrink-0">
              <div className="flex flex-col items-end gap-0.5 text-[11px] text-gray-600">
                <div className="flex items-center gap-1">
                  <span>⏰</span>
                  <span>倒數</span>
                  <MiniCountdown endTime={new Date(endTime)} />
                </div>
                {(antiSnipeEnabled ?? 1) === 1 && (antiSnipeMinutes ?? 3) > 0 ? (
                  <div className="flex items-start gap-1 text-right leading-snug">
                    <span>🛡️</span>
                    <span>結束前 {antiSnipeMinutes ?? 3} 分鐘內有出價，自動延長 {extendMinutes ?? 1} 分鐘</span>
                  </div>
                ) : (antiSnipeEnabled ?? 1) === 0 ? (
                  <div className="flex items-start gap-1 text-right leading-snug text-gray-400">
                    <span>⏱️</span>
                    <span>出價沒有加時，到結束時間即停止出價</span>
                  </div>
                ) : null}
              </div>
            </div>
          )}

          {/* Quick bid shortcuts — all users, active auction */}
          {!isEnded && (
            <div className={`${!endTime ? "border-t border-gray-100 " : ""}px-3 pt-1 pb-1 bg-white shrink-0`}>
              <div className="flex gap-2">
                {(() => {
                  const minBid = bidCount > 0 ? currentPrice + bidIncrement : (currentPrice === 0 ? bidIncrement : currentPrice);
                  return [
                    { hint: "最低", amt: minBid },
                    { hint: "+1口", amt: minBid + bidIncrement },
                    { hint: "+2口", amt: minBid + bidIncrement * 2 },
                  ];
                })().map(({ hint, amt }) => (
                  <button
                    key={hint}
                    onClick={() => handleQuickBid(amt)}
                    disabled={placeBid.isPending}
                    className="flex-1 flex flex-col items-center py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 active:bg-amber-200 border border-amber-200 text-amber-800 disabled:opacity-50 transition-colors"
                  >
                    <span className="text-[9px] text-amber-600/80">{hint}</span>
                    <span className="text-xs font-bold">{curr}{amt.toLocaleString()}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 代理出價 + 匿名 compact row — buyer only, active auction */}
          {!isEnded && !isMerchant && isAuthenticated && (
            <div className="px-3 pb-1.5 flex items-center justify-end gap-2 bg-white shrink-0">
              {/* 代理出價 */}
              {myProxy?.isActive ? (
                <button
                  onClick={() => cancelProxyBidMutation.mutate({ auctionId })}
                  disabled={cancelProxyBidMutation.isPending}
                  className="flex items-center gap-1 px-3 py-1 rounded-full border border-blue-300 bg-blue-50 text-blue-700 text-[12px] font-medium transition-colors hover:bg-blue-100 disabled:opacity-50"
                >
                  <Bot className="w-3 h-3" />
                  代理中：{curr}{myProxy.maxAmount.toLocaleString()} ✕
                </button>
              ) : (
                <button
                  onClick={() => { setProxyAmountStr(""); setProxyConfirmStep(false); setProxyBidOpen(true); }}
                  className="flex items-center gap-1 px-3 py-1 rounded-full border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-600 text-[12px] font-medium transition-colors"
                >
                  <Bot className="w-3 h-3" />
                  代理出價
                </button>
              )}
              {/* 匿名 toggle */}
              <button
                onClick={() => {
                  if (!canUseAnonymous) {
                    toast.info(memberLevel === "bronze"
                      ? "匿名出價功能僅限銀牌或以上會員"
                      : "匿名出價暫時關閉");
                    return;
                  }
                  setIsAnonymous(v => !v);
                }}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-[12px] font-medium transition-colors ${
                  isAnonymous
                    ? "bg-slate-100 border-slate-300 text-slate-700"
                    : "bg-gray-50 border-gray-300 text-gray-500 hover:bg-gray-100"
                }`}
              >
                {isAnonymous ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                {isAnonymous ? "匿名中" : "匿名"}
                <Switch
                  checked={isAnonymous && canUseAnonymous}
                  className="pointer-events-none scale-75 data-[state=checked]:bg-slate-500"
                />
              </button>
            </div>
          )}

          {/* Bottom input */}
          <div className="border-t border-gray-200 px-3 py-2 flex items-center gap-2 bg-white shrink-0">
            <Avatar name={user?.name ?? "?"} photoUrl={myAvatarUrl} size="sm" />
            {isMerchant ? (
              <>
                {merchantSentSuccess && (
                  <span className="text-[11px] font-semibold text-green-600 whitespace-nowrap shrink-0">✓ 已發送</span>
                )}
                <input
                  className="flex-1 px-3 py-2 text-sm outline-none placeholder-gray-400"
                  style={{ background: "#fff", border: "1px solid #E5E5E5", borderRadius: "12px" }}
                  placeholder="撰寫廣播訊息給所有出價者..."
                  value={merchantInput}
                  onChange={(e) => { setMerchantInput(e.target.value); if (merchantSentSuccess) setMerchantSentSuccess(false); }}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleMerchantSend(); } }}
                />
                <button onClick={handleMerchantSend} disabled={!merchantInput.trim() || broadcastMutation.isPending} className="p-2 text-[#1877f2] disabled:opacity-40 shrink-0">
                  <Send className="w-5 h-5" />
                </button>
              </>
            ) : isEnded ? (
              <div className="flex-1 text-center text-[12px] text-gray-400">此拍賣已結束，可繼續瀏覽</div>
            ) : (
              <>
                <input
                  className="flex-1 px-3 py-2 text-sm outline-none placeholder-gray-400"
                  style={{ background: "#fff", border: "1px solid #E5E5E5", borderRadius: "12px" }}
                  placeholder={`出價 (最低 ${curr}${(bidCount > 0 ? currentPrice + bidIncrement : (currentPrice === 0 ? bidIncrement : currentPrice)).toLocaleString()})`}
                  value={bidInput}
                  onChange={(e) => { if (/^\d*$/.test(e.target.value)) setBidInput(e.target.value); }}
                  onKeyDown={(e) => { if (e.key === "Enter") handleBuyerBid(); }}
                  inputMode="numeric"
                  disabled={!isAuthenticated}
                />
                <button onClick={handleBuyerBid} disabled={!bidInput || placeBid.isPending} className="p-2 text-[#1877f2] disabled:opacity-40 shrink-0">
                  <Send className="w-5 h-5" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Proxy bid popup */}
      {proxyBidOpen && (
        <div className="fixed inset-0 z-[75] flex items-center justify-center px-6" onClick={() => { setProxyBidOpen(false); setProxyConfirmStep(false); }}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative z-10 w-full max-w-xs bg-white rounded-2xl shadow-2xl p-5" onClick={(e) => e.stopPropagation()}>
            {!proxyConfirmStep ? (
              /* ── Step 1: Input ── */
              <>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <Bot className="w-4 h-4 text-blue-500" />
                    <h3 className="font-bold text-gray-800 text-[15px]">代理出價</h3>
                  </div>
                  <button onClick={() => { setProxyBidOpen(false); setProxyConfirmStep(false); }} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100">
                    <X className="w-4 h-4 text-gray-500" />
                  </button>
                </div>
                <p className="text-[11px] text-gray-500 mb-1">設定出價上限，系統在您被超越時自動幫您出價。</p>
                {!canUseAutoBid && memberLevel === "bronze" && (
                  <p className="text-[11px] text-amber-600 mb-2">代理出價功能僅限 🥈 銀牌或以上會員</p>
                )}
                {memberLevel === "bronze" && bronzeQuota.total > 0 && canUseAutoBid && (
                  <p className="text-[11px] text-amber-600 mb-2">
                    本月代理出價剩 {bronzeQuota.remaining} / {bronzeQuota.total} 次
                  </p>
                )}
                {memberLevel === "silver" && silverMaxAmount > 0 && (
                  <p className="text-[11px] text-blue-500 mb-2">銀牌單次上限：{curr}{silverMaxAmount.toLocaleString()}</p>
                )}
                <div className="flex items-center gap-1 mb-4 mt-2">
                  <span className="text-sm text-gray-500 shrink-0">{curr}</span>
                  <input
                    className="flex-1 px-3 py-2.5 text-base font-bold outline-none placeholder-gray-400"
                    style={{ background: "#fff", border: "1px solid #E5E5E5", borderRadius: "12px" }}
                    inputMode="numeric"
                    placeholder={`最低 ${curr}${(bidCount > 0 ? currentPrice + bidIncrement : currentPrice).toLocaleString()}`}
                    value={proxyAmountStr}
                    onChange={(e) => { if (/^\d*$/.test(e.target.value)) setProxyAmountStr(e.target.value); }}
                    onKeyDown={(e) => { if (e.key === "Enter") handleSetProxy(); }}
                    autoFocus
                    disabled={!canUseAutoBid}
                  />
                </div>
                <button
                  onClick={handleSetProxy}
                  disabled={!proxyAmountStr || setProxyBidMutation.isPending || !canUseAutoBid}
                  className="w-full py-2.5 rounded-xl bg-blue-500 text-white font-bold text-sm disabled:opacity-40 active:bg-blue-600 transition-colors"
                >
                  下一步
                </button>
              </>
            ) : (
              /* ── Step 2: Confirmation ── */
              <>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-1.5">
                    <Bot className="w-4 h-4 text-blue-500" />
                    <h3 className="font-bold text-gray-800 text-[15px]">確認代理出價</h3>
                  </div>
                  <button onClick={() => { setProxyBidOpen(false); setProxyConfirmStep(false); }} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100">
                    <X className="w-4 h-4 text-gray-500" />
                  </button>
                </div>

                {/* Summary card */}
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-4 space-y-2.5">
                  <div className="flex justify-between items-center">
                    <span className="text-[12px] text-gray-500">代理出價上限</span>
                    <span className="text-base font-bold text-blue-600">{curr}{parseInt(proxyAmountStr, 10).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[12px] text-gray-500">現時出價</span>
                    <span className="text-[13px] font-semibold text-gray-700">{curr}{currentPrice.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[12px] text-gray-500">每次加價幅度</span>
                    <span className="text-[13px] font-semibold text-gray-700">{curr}{bidIncrement.toLocaleString()}</span>
                  </div>
                </div>

                <p className="text-[11px] text-gray-500 mb-4 leading-relaxed">
                  確認後，當有人出價超越您，系統將自動為您出價，每次加{curr}{bidIncrement.toLocaleString()}，直至達到上限{curr}{parseInt(proxyAmountStr, 10).toLocaleString()}為止。
                </p>

                <div className="flex gap-2">
                  <button
                    onClick={() => setProxyConfirmStep(false)}
                    className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm active:bg-gray-50 transition-colors"
                  >
                    返回修改
                  </button>
                  <button
                    onClick={handleProxyConfirm}
                    disabled={setProxyBidMutation.isPending}
                    className="flex-1 py-2.5 rounded-xl bg-blue-500 text-white font-bold text-sm disabled:opacity-40 active:bg-blue-600 transition-colors"
                  >
                    {setProxyBidMutation.isPending ? "設定中..." : "確認送出"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Payment info sheet */}
      {paymentInfoOpen && (
        <div className="fixed inset-0 z-[70] flex items-end" onClick={() => setPaymentInfoOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative z-10 w-full bg-white rounded-t-2xl shadow-2xl px-5 pt-5 pb-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-800 text-base">得標後交收 / 付款方式</h2>
              <button onClick={() => setPaymentInfoOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            {paymentInfo?.deliveryInfo ? (
              <div className="mb-4">
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1 mb-1">
                  <Truck className="w-3.5 h-3.5" />交收安排
                </p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{paymentInfo.deliveryInfo}</p>
              </div>
            ) : null}
            {paymentInfo?.paymentInstructions ? (
              <div>
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">付款指引</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{paymentInfo.paymentInstructions}</p>
              </div>
            ) : null}
            {!paymentInfo?.deliveryInfo && !paymentInfo?.paymentInstructions && (
              <p className="text-sm text-gray-400 text-center py-6">商戶未設定交收 / 付款資訊</p>
            )}
          </div>
        </div>
      )}

      {/* Sort picker sheet */}
      {showSortSheet && (
        <SortSheet
          current={sort}
          onSelect={(v) => setSort(v)}
          onClose={() => setShowSortSheet(false)}
        />
      )}

      {/* 出價確認底部 sheet */}
      {bidConfirm && (
        <div className="fixed inset-0 z-[9998]" style={{ background: "rgba(0,0,0,0.55)" }} onClick={() => setBidConfirm(null)} />
      )}
      {bidConfirm && (
        <div
          className="fixed z-[9999] bg-white rounded-2xl shadow-2xl"
          style={{ left: 5, right: 5, bottom: "calc(env(safe-area-inset-bottom, 0px) + 68px)", padding: "14px 16px 16px" }}
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-sm font-bold text-center mb-2" style={{ color: "#ea580c" }}>確認出價後 無法撤回</p>
          <p className="text-sm text-gray-800 mb-1" style={{ wordBreak: "break-all" }}>{auctionTitle || "—"}</p>
          {isAnonymous && (
            <p className="text-xs text-slate-500 mb-1">🕵️ 此次出價將以匿名方式登記</p>
          )}
          <div className="flex items-baseline gap-2 mb-4">
            <span className="text-xs text-gray-500">出價金額</span>
            <span className="text-2xl font-black" style={{ color: "#dc2626" }}>{curr}{bidConfirm.amount.toLocaleString()}</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={confirmBid}
              disabled={placeBid.isPending}
              className="flex-1 py-2.5 text-sm text-white font-semibold rounded-xl"
              style={{ background: "#dc2626" }}
            >
              {placeBid.isPending ? "出價中…" : "確認出價"}
            </button>
            <button
              onClick={() => setBidConfirm(null)}
              className="flex-1 py-2.5 text-sm font-semibold rounded-xl border border-gray-300 text-gray-700 bg-white"
            >
              取消
            </button>
          </div>
        </div>
      )}
    </>
  );
}
