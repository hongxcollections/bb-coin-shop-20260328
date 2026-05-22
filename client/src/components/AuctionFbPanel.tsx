import { useState, useRef, useEffect } from "react";
import { Send, ThumbsUp, ThumbsDown, X, ChevronDown } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { getLoginUrl } from "@/const";

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
  bidIncrement?: number;
  isEnded: boolean;
  antiSnipeEnabled?: number;
  antiSnipeMinutes?: number;
  extendMinutes?: number;
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

export function AuctionFbPanel({
  open, onClose, auctionId, createdBy, sellerName, sellerPhotoUrl,
  currency, currentPrice, bidIncrement = 30, isEnded,
}: AuctionFbPanelProps) {
  const { user, isAuthenticated } = useAuth();
  const isMerchant = !!user && user.id === createdBy;
  const curr = (!currency || currency === "HKD") ? "HK$" : currency;

  const [sort, setSort] = useState<"new" | "old">("new");
  const [bidInput, setBidInput] = useState("");
  const [merchantInput, setMerchantInput] = useState("");
  const [merchantSentSuccess, setMerchantSentSuccess] = useState(false);
  const [replyingToBidId, setReplyingToBidId] = useState<number | null>(null);
  const [replyText, setReplyText] = useState("");
  const [particles, setParticles] = useState<{ id: number; bidId: number; dir: "up" | "down" }[]>([]);
  const pidRef = useRef(0);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

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

  const likeBidMutation = trpc.auctionFbPanel.merchantLikeBid.useMutation({
    onSuccess: () => toast.success("已發送讚好通知"),
    onError: (err) => toast.error(err.message),
  });

  const replyBidMutation = trpc.auctionFbPanel.merchantReplyBid.useMutation({
    onSuccess: () => {
      setReplyingToBidId(null);
      setReplyText("");
      utils.auctionFbPanel.getPanel.invalidate();
      toast.success("回覆已發送");
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

  /* ── Swipe right or down to close ── */
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = e.touches[0].clientY - touchStartY.current;
    if (dx > 80 && Math.abs(dx) > Math.abs(dy)) { onClose(); return; }
    if (dy > 80) onClose();
  };

  /* ── Avatar for bottom input ── */
  const myAvatarUrl = isMerchant
    ? (sellerPhotoUrl ?? user?.photoUrl ?? null)
    : (user?.photoUrl ?? null);

  /* ── Seller display name for broadcast bubbles ── */
  const sellerDisplayName = sellerName ?? "商戶";

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        className="relative z-10 w-full max-h-[88vh] bg-white rounded-t-2xl flex flex-col shadow-2xl"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-2 pb-0.5 shrink-0">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-base">👍</span>
              <span className="text-sm font-bold text-gray-900">{panelData?.totalBids ?? 0} 則回應</span>
            </div>
            <div className="text-xs text-amber-600 font-medium bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
              每口 {curr}{bidIncrement.toLocaleString()}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              className="flex items-center gap-0.5 text-sm text-[#1877f2] font-semibold"
              onClick={() => setSort(s => s === "new" ? "old" : "new")}
            >
              {sort === "new" ? "由新至舊" : "由舊至新"} <ChevronDown className="w-4 h-4" />
            </button>
            <button onClick={onClose}><X className="w-5 h-5 text-gray-500" /></button>
          </div>
        </div>

        {/* Items list */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {isLoading && (
            <div className="flex justify-center py-10">
              <div className="w-7 h-7 border-2 border-gray-200 border-t-[#1877f2] rounded-full animate-spin" />
            </div>
          )}
          {!isLoading && topLevelItems.length === 0 && (
            <div className="text-center py-10 text-gray-400 text-sm">暫無出價記錄，搶先出價！</div>
          )}

          {topLevelItems.map((item) => {
            /* ── Merchant broadcast (top-level comment, no replyToBidId) ── */
            if (item.type === "comment") {
              return (
                <div key={`comment-${item.id}`} className="flex items-start gap-2.5">
                  {/* Use seller's photo (merchantIcon) for broadcast avatar */}
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

            /* ── Bid item ── */
            /* Fix: coerce both sides to Number to avoid string/int mismatch */
            const isMyBid = !item.isAnonymous && !!user && Number(item.userId) === Number(user.id);
            return (
              <div key={`bid-${item.id}`}>
                <div className="flex items-start gap-2.5">
                  <Avatar
                    name={item.isAnonymous ? "匿" : item.userName}
                    photoUrl={item.isAnonymous ? null : item.photoUrl}
                  />
                  <div className="flex-1 min-w-0">
                    {/* Bubble */}
                    <div className="bg-gray-100 rounded-2xl px-3 py-2 inline-block max-w-[80%]">
                      <p className="text-[13px] font-bold text-gray-900 leading-tight">
                        {item.isAnonymous ? "匿名用戶" : item.userName}
                      </p>
                      <p className="text-base font-semibold text-gray-800 mt-0.5">
                        {item.rawAmount != null
                          ? `${curr}${Number(item.rawAmount).toLocaleString()}`
                          : item.content}
                      </p>
                      {/* 出價有效 — shown for ALL of my own bids */}
                      {isMyBid && (
                        <div className="flex justify-end mt-1 mb-[3px]">
                          <span className="text-[10px] font-semibold text-green-600">出價有效 ✓</span>
                        </div>
                      )}
                    </div>

                    {/* Action row */}
                    <div className="flex items-center gap-3 mt-1 ml-1">
                      <span className="text-[11px] text-gray-400">{timeAgo(item.createdAt)}</span>
                      <button className="text-[12px] font-bold text-gray-500 hover:text-gray-700" onClick={() => handleReplyClick(item)}>回覆</button>
                      <div className="relative flex items-center">
                        {particles.filter(p => p.bidId === item.id && p.dir === "up").map(p => (
                          <FloatingParticle key={p.id} dir="up" onDone={() => setParticles(prev => prev.filter(x => x.id !== p.id))} />
                        ))}
                        <button onClick={() => handleLike(item)} className="text-gray-400 hover:text-[#1877f2] transition-colors">
                          <ThumbsUp className="w-[15px] h-[15px]" />
                        </button>
                      </div>
                      <div className="relative flex items-center">
                        {particles.filter(p => p.bidId === item.id && p.dir === "down").map(p => (
                          <FloatingParticle key={p.id} dir="down" onDone={() => setParticles(prev => prev.filter(x => x.id !== p.id))} />
                        ))}
                        <button onClick={() => handleDislike(item)} className="text-gray-400 hover:text-red-400 transition-colors">
                          <ThumbsDown className="w-[15px] h-[15px]" />
                        </button>
                      </div>
                    </div>

                    {/* Merchant reply input */}
                    {replyingToBidId === item.id && (
                      <div className="mt-2 flex items-center gap-2 ml-1">
                        <Avatar name={user?.name ?? "?"} photoUrl={myAvatarUrl} size="sm" />
                        <div className="flex-1 flex items-center gap-1.5 bg-gray-100 rounded-full px-3 py-1.5">
                          <input
                            className="flex-1 bg-transparent text-sm focus:outline-none placeholder-gray-400"
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
                      </div>
                    )}
                  </div>
                </div>

                {/* Nested merchant replies */}
                {(replyMap.get(item.id) ?? []).map(reply => (
                  <div key={reply.id} className="flex items-start gap-2 mt-1.5 pl-11">
                    {/* Reply avatar also uses merchantIcon (from COALESCE SQL) */}
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

        {/* Bottom input */}
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
    </div>
  );
}
