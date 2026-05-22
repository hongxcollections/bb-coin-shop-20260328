import { useEffect, useRef, useState, useCallback } from "react";
import { ChevronLeft, ThumbsUp, Share2, Send, ChevronDown, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { getLoginUrl } from "@/const";

interface Props {
  open: boolean;
  onClose: () => void;
  images: { imageUrl: string }[];
  auctionId: number;
  auctionTitle: string;
  sellerName?: string | null;
  sellerPhotoUrl?: string | null;
  createdBy?: number;
  currency?: string | null;
  currentPrice: number;
  bidIncrement?: number;
  isEnded: boolean;
}

type PanelItem = {
  type: "bid" | "comment";
  id: number;
  userId: number;
  userName: string;
  photoUrl: string | null;
  content: string;
  rawAmount: number | null;
  isAnonymous: boolean;
  replyToBidId: number | null;
  createdAt: string;
};

function timeAgo(d: string): string {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "剛才";
  if (m < 60) return `${m}分鐘`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}小時`;
  return `${Math.floor(h / 24)}天`;
}

function Avatar({ name, photoUrl, size = "md" }: { name: string; photoUrl?: string | null; size?: "sm" | "md" }) {
  const sz = size === "sm" ? "w-7 h-7 text-xs" : "w-9 h-9 text-sm";
  return (
    <div className={`${sz} rounded-full bg-amber-500 flex items-center justify-center text-white font-bold shrink-0 overflow-hidden`}>
      {photoUrl
        ? <img src={photoUrl} alt={name} className="w-full h-full object-cover" />
        : name.charAt(0).toUpperCase()
      }
    </div>
  );
}

/* ── Pinch-to-zoom overlay ── */
function ImageZoomViewer({ src, onClose }: { src: string; onClose: () => void }) {
  const [scale, setScale] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const lastDist = useRef(0);
  const lastScale = useRef(1);
  const dragStart = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  const getDist = (t: React.TouchList) => {
    const dx = t[0].clientX - t[1].clientX;
    const dy = t[0].clientY - t[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    if (e.touches.length === 2) {
      lastDist.current = getDist(e.touches);
      lastScale.current = scale;
      dragStart.current = null;
    } else if (e.touches.length === 1 && scale > 1) {
      dragStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, ox: offsetX, oy: offsetY };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (e.touches.length === 2) {
      const dist = getDist(e.touches);
      setScale(Math.min(6, Math.max(1, lastScale.current * (dist / lastDist.current))));
    } else if (e.touches.length === 1 && dragStart.current && scale > 1) {
      setOffsetX(dragStart.current.ox + e.touches[0].clientX - dragStart.current.x);
      setOffsetY(dragStart.current.oy + e.touches[0].clientY - dragStart.current.y);
    }
  };

  const handleTap = () => {
    if (scale <= 1.05) {
      onClose();
    } else {
      setScale(1);
      setOffsetX(0);
      setOffsetY(0);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[80] bg-black flex items-center justify-center select-none"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onClick={handleTap}
    >
      <button
        className="absolute top-4 right-4 z-10 p-2 bg-white/20 rounded-full"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
      >
        <X className="w-6 h-6 text-white" />
      </button>
      <img
        src={src}
        alt=""
        draggable={false}
        className="max-w-full max-h-full object-contain touch-none"
        style={{
          transform: `scale(${scale}) translate(${offsetX / scale}px, ${offsetY / scale}px)`,
          transition: scale === 1 ? "transform 0.2s ease" : "none",
        }}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

export function AuctionImageLightbox({
  open, onClose, images, auctionId, auctionTitle,
  sellerName, sellerPhotoUrl, createdBy,
  currency, currentPrice, bidIncrement = 30, isEnded,
}: Props) {
  const { user, isAuthenticated } = useAuth();
  const isMerchant = !!user && user.id === createdBy;
  const curr = (!currency || currency === "HKD") ? "HK$" : currency;
  const sellerDisplayName = sellerName ?? "商戶";

  const [sort, setSort] = useState<"new" | "old">("new");
  const [bidInput, setBidInput] = useState("");
  const [merchantInput, setMerchantInput] = useState("");
  const [merchantSentSuccess, setMerchantSentSuccess] = useState(false);
  const [zoomSrc, setZoomSrc] = useState<string | null>(null);

  /* ── Swipe-right drag animation state ── */
  const [dragX, setDragX] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const dragXRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startY = useRef(0);

  const triggerClose = useCallback(() => {
    setIsAnimating(true);
    setDragX(window.innerWidth);
    dragXRef.current = window.innerWidth;
    setTimeout(() => {
      setDragX(0);
      dragXRef.current = 0;
      setIsAnimating(false);
      onClose();
    }, 280);
  }, [onClose]);

  /* ── Non-passive touch handlers for swipe-right with animation ── */
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !open) return;

    const onStart = (e: TouchEvent) => {
      if (zoomSrc) return;
      startX.current = e.touches[0].clientX;
      startY.current = e.touches[0].clientY;
      isDragging.current = false;
    };

    const onMove = (e: TouchEvent) => {
      if (zoomSrc) return;
      const dx = e.touches[0].clientX - startX.current;
      const dy = e.touches[0].clientY - startY.current;

      /* Activate rightward drag (not vertical scroll) */
      if (!isDragging.current && dx > 8 && Math.abs(dx) > Math.abs(dy) * 1.2) {
        isDragging.current = true;
      }

      if (isDragging.current) {
        e.preventDefault();
        const clamped = Math.max(0, dx);
        dragXRef.current = clamped;
        setDragX(clamped);
      }
    };

    const onEnd = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      if (dragXRef.current > 100) {
        triggerClose();
      } else {
        setDragX(0);
        dragXRef.current = 0;
      }
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
    };
  }, [open, zoomSrc, triggerClose]);

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
    { auctionId, sort },
    { enabled: open, refetchOnWindowFocus: false }
  );

  const broadcastMutation = trpc.auctionFbPanel.postMerchantBroadcast.useMutation({
    onSuccess: () => {
      setMerchantInput("");
      setMerchantSentSuccess(true);
      utils.auctionFbPanel.getPanel.invalidate();
      toast.success("廣播訊息已發送");
    },
    onError: (err) => toast.error(err.message),
  });

  const placeBid = trpc.auctions.placeBid.useMutation({
    onSuccess: () => {
      setBidInput("");
      utils.auctionFbPanel.getPanel.invalidate();
      toast.success("出價成功！");
    },
    onError: (err) => toast.error(`出價失敗：${err.message}`),
  });

  const items: PanelItem[] = panelData?.items ?? [];
  const topLevelItems = items.filter(
    i => i.type === "bid" || (i.type === "comment" && i.replyToBidId === null)
  );
  const replyMap = new Map<number, PanelItem[]>();
  for (const item of items) {
    if (item.type === "comment" && item.replyToBidId != null) {
      const arr = replyMap.get(item.replyToBidId) ?? [];
      arr.push(item);
      replyMap.set(item.replyToBidId, arr);
    }
  }

  const handleBuyerBid = () => {
    if (!isAuthenticated) { window.location.href = getLoginUrl(); return; }
    if (isEnded) { toast.error("此拍賣已結束"); return; }
    const amount = parseInt(bidInput, 10);
    if (!amount || amount <= 0) { toast.error("請輸入有效出價金額"); return; }
    if (amount <= currentPrice) { toast.error(`出價必須高於 ${curr}${currentPrice.toLocaleString()}`); return; }
    placeBid.mutate({ auctionId, bidAmount: amount, isAnonymous: 0 });
  };

  const handleMerchantSend = () => {
    if (!merchantInput.trim()) return;
    broadcastMutation.mutate({ auctionId, content: merchantInput.trim() });
  };

  const handleShare = () => {
    const url = `${window.location.origin}/auctions/${auctionId}`;
    if (navigator.share) {
      navigator.share({ title: auctionTitle, url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url).then(() => toast.success("連結已複製"));
    }
  };

  const myAvatarUrl = isMerchant
    ? (sellerPhotoUrl ?? user?.photoUrl ?? null)
    : (user?.photoUrl ?? null);

  if (!open) return null;

  /* Lightbox slides right with finger; springs back or exits right on release */
  const containerStyle: React.CSSProperties = {
    transform: `translateX(${dragX}px)`,
    transition: (isDragging.current || dragX === 0) ? "none" : "transform 0.28s cubic-bezier(0.4,0,0.2,1)",
    willChange: "transform",
  };

  return (
    <>
      <div
        ref={containerRef}
        className="fixed inset-0 z-[70] bg-white flex flex-col"
        style={containerStyle}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 bg-white border-b border-gray-200 shrink-0">
          <button
            onClick={triggerClose}
            className="p-1.5 rounded-full hover:bg-gray-100 transition-colors"
          >
            <ChevronLeft className="w-6 h-6 text-gray-700" />
          </button>
          <div className="flex-1 mx-2 text-center">
            <p className="text-[15px] font-bold leading-tight truncate text-gray-900">{sellerDisplayName}的帖子</p>
          </div>
          <div className="w-9 h-9 rounded-full overflow-hidden bg-amber-500 flex items-center justify-center shrink-0">
            {sellerPhotoUrl
              ? <img src={sellerPhotoUrl} alt={sellerDisplayName} className="w-full h-full object-cover" />
              : <span className="text-white font-bold text-base">{sellerDisplayName.charAt(0).toUpperCase()}</span>
            }
          </div>
        </div>

        {/* Scrollable content on white */}
        <div className="flex-1 overflow-y-auto bg-white">
          {images.map((img, idx) => (
            <div key={idx} className="border-b border-gray-100">
              <div className="bg-white">
                <img
                  src={img.imageUrl}
                  alt={`圖片 ${idx + 1}`}
                  className="w-full object-contain max-h-[70vh] cursor-zoom-in"
                  style={{ display: "block" }}
                  onClick={() => setZoomSrc(img.imageUrl)}
                />
              </div>
              <div className="flex items-center bg-white border-t border-gray-100">
                <button
                  className="flex-1 flex items-center justify-center gap-2 py-3 text-gray-600 text-[15px] font-semibold hover:bg-gray-50 transition-colors"
                  onClick={() => toast.info("讚好")}
                >
                  <ThumbsUp className="w-5 h-5" /> 讚好
                </button>
                <div className="w-px h-6 bg-gray-200" />
                <button
                  className="flex-1 flex items-center justify-center gap-2 py-3 text-gray-600 text-[15px] font-semibold hover:bg-gray-50 transition-colors"
                  onClick={handleShare}
                >
                  <Share2 className="w-5 h-5" /> 分享
                </button>
              </div>
            </div>
          ))}

          {/* Response panel */}
          <div className="bg-white">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-base">👍</span>
                  <span className="text-sm font-bold text-gray-900">{panelData?.totalBids ?? 0} 則回應</span>
                </div>
                <div className="text-xs text-amber-600 font-medium bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                  每口 {curr}{bidIncrement.toLocaleString()}
                </div>
              </div>
              <button
                className="flex items-center gap-0.5 text-sm text-[#1877f2] font-semibold"
                onClick={() => setSort(s => s === "new" ? "old" : "new")}
              >
                {sort === "new" ? "由新至舊" : "由舊至新"} <ChevronDown className="w-4 h-4" />
              </button>
            </div>

            <div className="px-4 py-3 space-y-4 pb-6">
              {isLoading && (
                <div className="flex justify-center py-8">
                  <div className="w-7 h-7 border-2 border-gray-200 border-t-[#1877f2] rounded-full animate-spin" />
                </div>
              )}
              {!isLoading && topLevelItems.length === 0 && (
                <div className="text-center py-8 text-gray-400 text-sm">暫無出價記錄，搶先出價！</div>
              )}

              {topLevelItems.map((item) => {
                if (item.type === "comment") {
                  return (
                    <div key={`c-${item.id}`} className="flex items-start gap-2.5">
                      <Avatar name={sellerDisplayName} photoUrl={sellerPhotoUrl ?? item.photoUrl} />
                      <div className="flex-1 bg-blue-50 rounded-2xl px-3 py-2 border border-blue-100">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-[13px] font-bold text-blue-800">{sellerDisplayName}</span>
                          <span className="text-[10px] bg-[#1877f2] text-white px-1.5 py-0.5 rounded font-semibold">管理員</span>
                          <span className="text-[10px] text-blue-400">{timeAgo(item.createdAt)}</span>
                        </div>
                        <p className="text-[13px] text-blue-900">{item.content}</p>
                      </div>
                    </div>
                  );
                }

                /* String comparison to avoid Chrome int/string mismatch */
                const isMyBid = !item.isAnonymous && !!user && String(item.userId) === String(user.id);
                return (
                  <div key={`b-${item.id}`}>
                    <div className="flex items-start gap-2.5">
                      <Avatar name={item.isAnonymous ? "匿" : item.userName} photoUrl={item.isAnonymous ? null : item.photoUrl} />
                      <div className="flex-1 min-w-0">
                        <div className="bg-gray-100 rounded-2xl px-3 py-2 inline-block max-w-[85%]">
                          <p className="text-[13px] font-bold text-gray-900 leading-tight">
                            {item.isAnonymous ? "匿名用戶" : item.userName}
                          </p>
                          <p className="text-base font-semibold text-gray-800 mt-0.5">
                            {item.rawAmount != null ? `${curr}${Number(item.rawAmount).toLocaleString()}` : item.content}
                          </p>
                          {isMyBid && (
                            <div className="flex justify-end mt-1 mb-[3px]">
                              <span className="text-[10px] font-semibold text-green-600">出價有效 ✓</span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 ml-1">
                          <span className="text-[11px] text-gray-400">{timeAgo(item.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                    {(replyMap.get(item.id) ?? []).map(reply => (
                      <div key={reply.id} className="flex items-start gap-2 mt-1.5 pl-11">
                        <Avatar name={reply.userName} photoUrl={reply.photoUrl} size="sm" />
                        <div className="flex-1 bg-gray-100 rounded-2xl px-3 py-1.5">
                          <p className="text-[12px] font-bold text-gray-900">{reply.userName}</p>
                          <p className="text-[13px] text-gray-800 mt-0.5">{reply.content}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">{timeAgo(reply.createdAt)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Fixed bottom input */}
        <div className="border-t border-gray-200 px-3 py-2 flex items-center gap-2 bg-white shrink-0">
          <Avatar name={user?.name ?? "?"} photoUrl={myAvatarUrl} size="sm" />
          {isMerchant ? (
            <>
              {merchantSentSuccess && (
                <span className="text-[11px] font-semibold text-green-600 whitespace-nowrap shrink-0">✓ 已發送</span>
              )}
              <div className="flex-1 flex items-center bg-gray-100 rounded-full px-3 py-2 gap-2">
                <input
                  className="flex-1 bg-transparent text-sm focus:outline-none placeholder-gray-400"
                  placeholder="撰寫廣播訊息給所有出價者..."
                  value={merchantInput}
                  onChange={(e) => { setMerchantInput(e.target.value); if (merchantSentSuccess) setMerchantSentSuccess(false); }}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleMerchantSend(); } }}
                />
              </div>
              <button onClick={handleMerchantSend} disabled={!merchantInput.trim() || broadcastMutation.isPending} className="p-2 text-[#1877f2] disabled:opacity-40 shrink-0">
                <Send className="w-5 h-5" />
              </button>
            </>
          ) : (
            <>
              <div className="flex-1 flex items-center bg-gray-100 rounded-full px-3 py-2">
                <input
                  className="flex-1 bg-transparent text-sm focus:outline-none placeholder-gray-400"
                  placeholder={isEnded ? "拍賣已結束" : `出價 (最低 ${curr}${(currentPrice + bidIncrement).toLocaleString()})`}
                  value={bidInput}
                  onChange={(e) => { if (/^\d*$/.test(e.target.value)) setBidInput(e.target.value); }}
                  onKeyDown={(e) => { if (e.key === "Enter") handleBuyerBid(); }}
                  inputMode="numeric"
                  disabled={isEnded || !isAuthenticated}
                />
              </div>
              <button onClick={handleBuyerBid} disabled={!bidInput || placeBid.isPending || isEnded} className="p-2 text-[#1877f2] disabled:opacity-40 shrink-0">
                <Send className="w-5 h-5" />
              </button>
            </>
          )}
        </div>
      </div>

      {zoomSrc && <ImageZoomViewer src={zoomSrc} onClose={() => setZoomSrc(null)} />}
    </>
  );
}
