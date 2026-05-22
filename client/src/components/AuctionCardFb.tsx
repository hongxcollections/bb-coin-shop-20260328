import { useState, useRef } from "react";
import { Globe, MoreHorizontal, ThumbsUp, MessageCircle, Share2 } from "lucide-react";
import { AuctionFbPanel } from "@/components/AuctionFbPanel";
import { AuctionImageLightbox } from "@/components/AuctionImageLightbox";
import { useAuth } from "@/_core/hooks/useAuth";

export interface AuctionCardFbProps {
  auctionId: number;
  title: string;
  images?: { imageUrl: string }[];
  endTime: string | Date;
  createdAt?: string | Date;
  currentPrice: number;
  startingPrice?: number;
  currency?: string | null;
  isEnded: boolean;
  bidCount?: number;
  highestBidderId?: number | null;
  highestBidderName?: string | null;
  currentUserId?: number | null;
  sellerName?: string | null;
  sellerPhotoUrl?: string | null;
  createdBy?: number;
  bidIncrement?: number;
  shareTemplate?: string | null;
  antiSnipeEnabled?: number;
  antiSnipeMinutes?: number;
  extendMinutes?: number;
  onLinkClick?: () => void;
}

function timeAgo(d: string | Date | undefined): string {
  if (!d) return "";
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "剛才";
  if (m < 60) return `${m}分鐘`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}小時`;
  return `${Math.floor(h / 24)}天`;
}

function FbPhotoGrid({ images, bidCount, onPhotoClick }: {
  images: { imageUrl: string }[];
  bidCount: number;
  onPhotoClick: () => void;
}) {
  const count = images.length;
  if (count === 0) return null;
  const extra = count > 5 ? count - 5 : 0;
  const imgCls = "w-full h-full object-cover";

  return (
    <div className="relative cursor-pointer" onClick={onPhotoClick}>
      {count === 1 && (
        <img src={images[0].imageUrl} alt="" className="w-full max-h-80 object-cover" />
      )}
      {count === 2 && (
        <div className="grid grid-cols-2 gap-px bg-white">
          {images.slice(0, 2).map((img, i) => (
            <div key={i} className="h-52 overflow-hidden">
              <img src={img.imageUrl} alt="" className={imgCls} />
            </div>
          ))}
        </div>
      )}
      {count === 3 && (
        <div className="flex flex-col gap-px bg-white">
          <div className="h-52 overflow-hidden">
            <img src={images[0].imageUrl} alt="" className={imgCls} />
          </div>
          <div className="grid grid-cols-2 gap-px">
            {images.slice(1, 3).map((img, i) => (
              <div key={i} className="h-36 overflow-hidden">
                <img src={img.imageUrl} alt="" className={imgCls} />
              </div>
            ))}
          </div>
        </div>
      )}
      {count === 4 && (
        <div className="grid grid-cols-2 gap-px bg-white">
          {images.slice(0, 4).map((img, i) => (
            <div key={i} className="h-44 overflow-hidden">
              <img src={img.imageUrl} alt="" className={imgCls} />
            </div>
          ))}
        </div>
      )}
      {count >= 5 && (
        <div className="flex flex-col gap-px bg-white">
          <div className="grid grid-cols-2 gap-px">
            {images.slice(0, 2).map((img, i) => (
              <div key={i} className="h-44 overflow-hidden">
                <img src={img.imageUrl} alt="" className={imgCls} />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-px">
            {images.slice(2, 5).map((img, i) => (
              <div key={i} className="h-32 overflow-hidden relative">
                <img src={img.imageUrl} alt="" className={imgCls} />
                {i === 2 && extra > 0 && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <span className="text-white font-bold text-2xl">+{extra}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {bidCount > 0 && (
        <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full select-none">
          {bidCount} 則回應
        </div>
      )}
    </div>
  );
}

function TruncatedText({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const LIMIT = 80;
  if (text.length <= LIMIT || expanded) {
    return (
      <p className="text-[18px] font-bold text-gray-900 leading-snug whitespace-pre-line">
        {text}
        {text.length > LIMIT && (
          <button
            className="text-gray-500 ml-1 text-xs font-medium"
            onClick={(e) => { e.stopPropagation(); setExpanded(false); }}
          > 收起</button>
        )}
      </p>
    );
  }
  return (
    <p className="text-[18px] font-bold text-gray-900 leading-snug">
      {text.slice(0, LIMIT)}
      <button
        className="text-gray-500 ml-1 text-xs font-medium"
        onClick={(e) => { e.stopPropagation(); setExpanded(true); }}
      >...更多</button>
    </p>
  );
}

export function AuctionCardFb(props: AuctionCardFbProps) {
  const {
    auctionId, title, images = [], endTime, createdAt, currentPrice, currency,
    isEnded, bidCount = 0, highestBidderName, currentUserId, highestBidderId,
    sellerName, sellerPhotoUrl, createdBy, bidIncrement = 30, shareTemplate,
    antiSnipeEnabled, antiSnipeMinutes, extendMinutes, onLinkClick,
  } = props;

  const { user } = useAuth();
  const [panelOpen, setPanelOpen] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [particles, setParticles] = useState<number[]>([]);
  const pidRef = useRef(0);
  const curr = currency === "HKD" || !currency ? "HK$" : currency;

  const initials = (sellerName ?? "商").charAt(0).toUpperCase();

  const triggerHeart = () => {
    const id = pidRef.current++;
    setParticles(p => [...p, id]);
  };

  const reactionLabel = (() => {
    if (bidCount === 0) return null;
    if (highestBidderId && currentUserId && highestBidderId === currentUserId) {
      return <span className="text-xs text-gray-500">👍 我本人 {bidCount > 1 ? `和 ${bidCount - 1} 人` : ""}</span>;
    }
    if (highestBidderName) {
      return <span className="text-xs text-gray-500">👍 {highestBidderName} {bidCount > 1 ? `和 ${bidCount - 1} 人` : ""}</span>;
    }
    return <span className="text-xs text-gray-500">👍 {bidCount} 則回應</span>;
  })();

  return (
    <div className="bg-white border-b border-gray-200 mb-0.5">
      {/* Header */}
      <div className="flex items-start justify-between px-3 pt-3 pb-1.5">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center text-white font-bold text-base shrink-0 overflow-hidden">
            {sellerPhotoUrl
              ? <img src={sellerPhotoUrl} alt={sellerName ?? "商戶"} className="w-full h-full object-cover" />
              : initials
            }
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-[15px] text-gray-900 leading-tight">{sellerName ?? "商戶"}</span>
              <span className="text-[10px] bg-[#1877f2] text-white px-1.5 py-0.5 rounded font-semibold tracking-wide">管理員</span>
            </div>
            <div className="flex items-center gap-1 text-[12px] text-gray-500 mt-0.5">
              <span>{timeAgo(createdAt)}</span>
              <span>·</span>
              <Globe className="w-3 h-3" />
            </div>
          </div>
        </div>
        <MoreHorizontal className="w-5 h-5 text-gray-500 mt-1 cursor-pointer" />
      </div>

      {/* Title + price row */}
      <div className="px-3 pb-2">
        <TruncatedText text={title} />
        {!isEnded && (
          <div className="flex items-center justify-end gap-3 mt-1.5">
            <span className="text-[13px] text-amber-600 font-semibold">
              目前：{curr}{currentPrice.toLocaleString()}
            </span>
            {highestBidderName && (
              <span className="text-[12px] text-gray-500 truncate max-w-[110px]">
                最高：{highestBidderName}
              </span>
            )}
          </div>
        )}
        {isEnded && (
          <p className="text-[12px] text-gray-400 mt-1 text-right">此拍賣已結束</p>
        )}
      </div>

      {/* Photo grid — tapping opens full lightbox */}
      {images.length > 0 ? (
        <FbPhotoGrid
          images={images}
          bidCount={bidCount}
          onPhotoClick={() => setLightboxOpen(true)}
        />
      ) : (
        <div
          className="mx-0 h-52 bg-amber-50 flex items-center justify-center text-5xl cursor-pointer border-y border-gray-100"
          onClick={() => { if (onLinkClick) onLinkClick(); window.location.href = `/auctions/${auctionId}`; }}
        >
          🪙
        </div>
      )}

      {/* Reaction + comment count bar */}
      {bidCount > 0 && (
        <div className="flex items-center justify-between px-3 py-1.5">
          {reactionLabel}
          <button
            className="text-xs text-gray-500 hover:underline"
            onClick={() => setPanelOpen(true)}
          >
            {bidCount} 則回應
          </button>
        </div>
      )}

      {/* Divider */}
      <div className="border-t border-gray-200 mx-0" />

      {/* 3 action buttons */}
      <div className="flex items-center">
        {/* 讚好 */}
        <div className="relative flex-1">
          {particles.map(id => (
            <span
              key={id}
              className="pointer-events-none absolute bottom-10 left-1/2 -translate-x-1/2 text-2xl select-none z-10"
              style={{ animation: "fb-heart-float 0.9s ease-out forwards" }}
              onAnimationEnd={() => setParticles(p => p.filter(x => x !== id))}
            >
              ❤️
            </span>
          ))}
          <button
            onClick={triggerHeart}
            className="w-full flex items-center justify-center gap-1.5 py-2 text-gray-600 hover:bg-gray-100 transition-colors text-[13px] font-semibold"
          >
            <ThumbsUp className="w-[18px] h-[18px]" /> 讚好
          </button>
        </div>

        {/* 回應 */}
        <div className="flex-1">
          <button
            onClick={() => setPanelOpen(true)}
            className="w-full flex items-center justify-center gap-1.5 py-2 text-gray-600 hover:bg-gray-100 transition-colors text-[13px] font-semibold"
          >
            <MessageCircle className="w-[18px] h-[18px]" /> 回應
          </button>
        </div>

        {/* 分享 */}
        <div className="flex-1">
          <button
            onClick={() => {
              const url = `${window.location.origin}/auctions/${auctionId}`;
              if (navigator.share) {
                navigator.share({ title, url }).catch(() => {});
              } else {
                navigator.clipboard.writeText(url).then(() => {
                  import("sonner").then(({ toast }) => toast.success("連結已複製"));
                });
              }
            }}
            className="w-full flex items-center justify-center gap-1.5 py-2 text-gray-600 hover:bg-gray-100 transition-colors text-[13px] font-semibold"
          >
            <Share2 className="w-[18px] h-[18px]" /> 分享
          </button>
        </div>
      </div>

      {/* Image lightbox — tapping photos opens this */}
      <AuctionImageLightbox
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        images={images}
        auctionId={auctionId}
        auctionTitle={title}
        sellerName={sellerName}
        sellerPhotoUrl={sellerPhotoUrl}
        createdBy={createdBy}
        currency={currency}
        currentPrice={currentPrice}
        bidIncrement={bidIncrement}
        isEnded={isEnded}
      />

      {/* FB Panel — opened via "回應" button */}
      <AuctionFbPanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        auctionId={auctionId}
        auctionTitle={title}
        createdBy={createdBy}
        currency={currency}
        currentPrice={currentPrice}
        bidIncrement={bidIncrement}
        isEnded={isEnded}
        antiSnipeEnabled={antiSnipeEnabled}
        antiSnipeMinutes={antiSnipeMinutes}
        extendMinutes={extendMinutes}
      />
    </div>
  );
}
