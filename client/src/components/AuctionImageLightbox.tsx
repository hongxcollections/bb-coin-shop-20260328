import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { ChevronLeft, ThumbsUp, ThumbsDown, Share2, Send, X } from "lucide-react";
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
  isMyBid: boolean;
  replyToBidId: number | null;
  createdAt: string;
};

function timeAgo(d: string): string {
  const iso = d.includes("Z") || d.includes("+") ? d : d.replace(" ", "T") + "Z";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "剛才";
  if (m < 60) return `${m}分鐘`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}小時`;
  return `${Math.floor(h / 24)}天`;
}

function Avatar({ name, photoUrl, size = "md" }: { name: string; photoUrl?: string | null; size?: "sm" | "md" | "lg" }) {
  const sz = size === "sm" ? "w-7 h-7 text-xs" : size === "lg" ? "w-11 h-11 text-base" : "w-9 h-9 text-sm";
  return (
    <div className={`${sz} rounded-full bg-amber-500 flex items-center justify-center text-white font-bold shrink-0 overflow-hidden`}>
      {photoUrl
        ? <img src={photoUrl} alt={name} className="w-full h-full object-cover" />
        : name.charAt(0).toUpperCase()
      }
    </div>
  );
}

/* ── Sort picker bottom sheet ── */
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
    if (e.touches.length === 2) { lastDist.current = getDist(e.touches); lastScale.current = scale; dragStart.current = null; }
    else if (e.touches.length === 1 && scale > 1) { dragStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, ox: offsetX, oy: offsetY }; }
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    e.stopPropagation(); e.preventDefault();
    if (e.touches.length === 2) { setScale(Math.min(6, Math.max(1, lastScale.current * (getDist(e.touches) / lastDist.current)))); }
    else if (e.touches.length === 1 && dragStart.current && scale > 1) {
      setOffsetX(dragStart.current.ox + e.touches[0].clientX - dragStart.current.x);
      setOffsetY(dragStart.current.oy + e.touches[0].clientY - dragStart.current.y);
    }
  };
  const handleTap = () => {
    if (scale <= 1.05) { onClose(); } else { setScale(1); setOffsetX(0); setOffsetY(0); }
  };

  return (
    <div className="fixed inset-0 z-[90] bg-black flex items-center justify-center select-none" onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onClick={handleTap}>
      <button className="absolute top-4 right-4 z-10 p-2 bg-white/20 rounded-full" onClick={(e) => { e.stopPropagation(); onClose(); }}>
        <X className="w-6 h-6 text-white" />
      </button>
      <img src={src} alt="" draggable={false} className="max-w-full max-h-full object-contain touch-none"
        style={{ transform: `scale(${scale}) translate(${offsetX / scale}px, ${offsetY / scale}px)`, transition: scale === 1 ? "transform 0.2s ease" : "none" }}
        onClick={(e) => e.stopPropagation()} />
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
  const [showSortSheet, setShowSortSheet] = useState(false);
  const [bidInput, setBidInput] = useState("");
  const [merchantInput, setMerchantInput] = useState("");
  const [merchantSentSuccess, setMerchantSentSuccess] = useState(false);
  const [zoomSrc, setZoomSrc] = useState<string | null>(null);

  /* ── Swipe-right-to-close ── */
  const [dragX, setDragX] = useState(0);
  const dragXRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startY = useRef(0);

  const triggerClose = useCallback(() => {
    setDragX(window.innerWidth);
    dragXRef.current = window.innerWidth;
    setTimeout(() => { setDragX(0); dragXRef.current = 0; onClose(); }, 280);
  }, [onClose]);

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
      if (!isDragging.current && dx > 8 && Math.abs(dx) > Math.abs(dy) * 1.2) isDragging.current = true;
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
      if (dragXRef.current > 100) triggerClose();
      else { setDragX(0); dragXRef.current = 0; }
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
    { auctionId, sort, viewerUserId: user?.id },
    { enabled: open, refetchOnWindowFocus: false }
  );

  const broadcastMutation = trpc.auctionFbPanel.postMerchantBroadcast.useMutation({
    onSuccess: () => { setMerchantInput(""); setMerchantSentSuccess(true); utils.auctionFbPanel.getPanel.invalidate(); toast.success("廣播訊息已發送"); },
    onError: (err) => toast.error(err.message),
  });
  const placeBid = trpc.auctions.placeBid.useMutation({
    onSuccess: () => { setBidInput(""); utils.auctionFbPanel.getPanel.invalidate(); toast.success("出價成功！"); },
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

  /* ── Bottom input avatar: DB-fresh photoUrl ── */
  const myDbPhotoUrl = useMemo(() => {
    if (!user) return null;
    const mine = items.find(i => !i.isAnonymous && String(i.userId) === String(user.id));
    return mine?.photoUrl ?? null;
  }, [items, user]);
  const myAvatarUrl = isMerchant
    ? (sellerPhotoUrl ?? myDbPhotoUrl ?? user?.photoUrl ?? null)
    : (myDbPhotoUrl ?? user?.photoUrl ?? null);

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
  const handleQuickBid = (amount: number) => {
    if (!isAuthenticated) { toast.info("請先登入先可以出價"); return; }
    if (isEnded) { toast.error("此拍賣已結束"); return; }
    placeBid.mutate({ auctionId, bidAmount: amount, isAnonymous: 0 });
  };
  const handleShare = () => {
    const url = `${window.location.origin}/auctions/${auctionId}`;
    if (navigator.share) { navigator.share({ title: auctionTitle, url }).catch(() => {}); }
    else { navigator.clipboard.writeText(url).then(() => toast.success("連結已複製")); }
  };

  if (!open) return null;

  const containerStyle: React.CSSProperties = {
    transform: `translateX(${dragX}px)`,
    transition: (isDragging.current || dragX === 0) ? "none" : "transform 0.28s cubic-bezier(0.4,0,0.2,1)",
    willChange: "transform",
  };

  const sortLabel = sort === "new" ? "由新至舊" : "由舊至新";

  return (
    <>
      <div ref={containerRef} className="fixed inset-0 z-[70] bg-white flex flex-col" style={containerStyle}>
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 bg-white border-b border-gray-200 shrink-0">
          <button onClick={triggerClose} className="p-1.5 rounded-full hover:bg-gray-100 transition-colors">
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

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto bg-white">
          {/* Images */}
          {images.map((img, idx) => (
            <div key={idx} className="border-b border-gray-100">
              <img src={img.imageUrl} alt={`圖片 ${idx + 1}`}
                className="w-full object-contain max-h-[70vh] cursor-zoom-in bg-white"
                style={{ display: "block" }}
                onClick={() => setZoomSrc(img.imageUrl)} />
              <div className="flex items-center bg-white border-t border-gray-100">
                <button className="flex-1 flex items-center justify-center gap-2 py-3 text-gray-600 text-[15px] font-semibold hover:bg-gray-50 transition-colors" onClick={() => toast.info("讚好")}>
                  <ThumbsUp className="w-5 h-5" /> 讚好
                </button>
                <div className="w-px h-6 bg-gray-200" />
                <button className="flex-1 flex items-center justify-center gap-2 py-3 text-gray-600 text-[15px] font-semibold hover:bg-gray-50 transition-colors" onClick={handleShare}>
                  <Share2 className="w-5 h-5" /> 分享
                </button>
              </div>
            </div>
          ))}

          {/* Response panel */}
          <div className="bg-white">
            {/* Sub-header: sort LEFT | stats RIGHT */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <button
                className="flex items-center gap-1 text-[15px] font-bold text-gray-900"
                onClick={() => setShowSortSheet(true)}
              >
                {sortLabel}
                <svg className="w-4 h-4 text-gray-600" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-base">👍</span>
                  <span className="text-[13px] font-bold text-gray-900">{panelData?.totalBids ?? 0} 則回應</span>
                </div>
                <div className="text-[11px] text-amber-600 font-medium bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                  每口 {curr}{bidIncrement.toLocaleString()}
                </div>
              </div>
            </div>

            <div className="px-4 py-3 space-y-5 pb-6">
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
                    <div key={`c-${item.id}`} className="flex items-start gap-3">
                      <Avatar name={sellerDisplayName} photoUrl={sellerPhotoUrl ?? item.photoUrl} size="lg" />
                      <div className="flex-1 bg-blue-50 rounded-2xl px-3 py-2 border border-blue-100">
                        <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                          <span className="text-[14px] font-bold text-blue-800">{sellerDisplayName}</span>
                          <span className="text-[10px] bg-[#1877f2] text-white px-1.5 py-0.5 rounded font-semibold">管理員</span>
                          <span className="text-gray-400 text-[12px]">·</span>
                          <span className="text-[12px] text-blue-400">{timeAgo(item.createdAt)}</span>
                        </div>
                        <p className="text-[14px] text-blue-900">{item.content}</p>
                      </div>
                    </div>
                  );
                }

                /* isMyBid from server */
                return (
                  <div key={`b-${item.id}`}>
                    <div className="flex items-start gap-3">
                      <Avatar name={item.isAnonymous ? "匿" : item.userName} photoUrl={item.isAnonymous ? null : item.photoUrl} size="lg" />
                      <div className="flex-1 min-w-0">
                        {/* name · time */}
                        <div className="flex items-center gap-1 flex-wrap">
                          <span className="text-[14px] font-bold text-gray-900">{item.isAnonymous ? "匿名用戶" : item.userName}</span>
                          <span className="text-gray-400 text-[12px]">·</span>
                          <span className="text-[12px] text-gray-500">{timeAgo(item.createdAt)}</span>
                        </div>
                        {/* price + 出價有效 same line */}
                        <div className="flex items-baseline gap-2 mt-0.5">
                          <p className="text-[18px] font-bold text-gray-900 leading-tight">
                            {item.rawAmount != null ? `${curr}${Number(item.rawAmount).toLocaleString()}` : item.content}
                          </p>
                          {item.isMyBid && (
                            <span className="text-[10px] font-semibold text-green-600 whitespace-nowrap">出價有效 ✓</span>
                          )}
                        </div>
                        {/* action row: 回覆 left | 👍👎 right */}
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-[13px] font-bold text-gray-500">回覆</span>
                          <div className="flex items-center gap-4">
                            <ThumbsUp className="w-[18px] h-[18px] text-gray-400" />
                            <ThumbsDown className="w-[18px] h-[18px] text-gray-400" />
                          </div>
                        </div>
                      </div>
                    </div>
                    {(replyMap.get(item.id) ?? []).map(reply => (
                      <div key={reply.id} className="flex items-start gap-2 mt-2 pl-14">
                        <Avatar name={reply.userName} photoUrl={reply.photoUrl} size="sm" />
                        <div className="flex-1">
                          <div className="flex items-center gap-1 flex-wrap">
                            <span className="text-[13px] font-bold text-gray-900">{reply.userName}</span>
                            <span className="text-gray-400 text-[11px]">·</span>
                            <span className="text-[11px] text-gray-400">{timeAgo(reply.createdAt)}</span>
                          </div>
                          <p className="text-[13px] text-gray-800 mt-0.5">{reply.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Quick bid shortcuts — buyers only, active auction */}
        {!isMerchant && !isEnded && (
          <div className="border-t border-gray-100 px-3 pt-2 pb-1 bg-white shrink-0">
            <div className="flex gap-2">
              {[
                { hint: "最低", amt: currentPrice + bidIncrement },
                { hint: "+1口", amt: currentPrice + bidIncrement * 2 },
                { hint: "+2口", amt: currentPrice + bidIncrement * 3 },
              ].map(({ hint, amt }) => (
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

        {/* Bottom input */}
        <div className="border-t border-gray-200 px-3 py-2 flex items-center gap-2 bg-white shrink-0">
          <Avatar name={user?.name ?? "?"} photoUrl={myAvatarUrl} size="sm" />
          {isMerchant ? (
            <>
              {merchantSentSuccess && <span className="text-[11px] font-semibold text-green-600 whitespace-nowrap shrink-0">✓ 已發送</span>}
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

      {showSortSheet && (
        <SortSheet current={sort} onSelect={(v) => setSort(v)} onClose={() => setShowSortSheet(false)} />
      )}

      {zoomSrc && <ImageZoomViewer src={zoomSrc} onClose={() => setZoomSrc(null)} />}
    </>
  );
}
