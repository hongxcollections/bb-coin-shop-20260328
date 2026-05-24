import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Users, Store, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ShareMenu } from "@/components/ShareMenu";
import { QuickBidPopover } from "@/components/QuickBidPopover";

function getCurrencySymbol(currency?: string | null): string {
  const map: Record<string, string> = {
    HKD: "HK$", USD: "US$", CNY: "¥", EUR: "€", GBP: "£",
    JPY: "¥", TWD: "NT$", SGD: "S$", MYR: "RM", THB: "฿",
  };
  return map[currency ?? "HKD"] ?? "HK$";
}

function AuctionImageOverlay({ endTime }: { endTime: Date | string }) {
  const [txt, setTxt] = useState("");
  const [urgent, setUrgent] = useState(false);
  useEffect(() => {
    function update() {
      const end = new Date(endTime).getTime();
      const diff = end - Date.now();
      if (diff <= 0) { setTxt("已結束"); setUrgent(false); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      if (h > 0) { setTxt(`${h}時${m}分`); setUrgent(false); }
      else if (m > 0) { setTxt(`${m}分${s}秒`); setUrgent(m < 10); }
      else { setTxt(`${s}秒`); setUrgent(true); }
    }
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [endTime]);

  if (!txt) return null;
  return (
    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-1.5 py-1 pointer-events-none">
      {urgent ? (
        <div className="flex items-center gap-0.5 text-[10px] font-black leading-none animate-pulse bg-red-600 text-white px-1 py-0.5 rounded self-start inline-flex">
          <Clock className="w-2.5 h-2.5 shrink-0" />{txt}
        </div>
      ) : (
        <div className="flex items-center gap-0.5 text-[10px] font-bold leading-none text-white">
          <Clock className="w-2.5 h-2.5 shrink-0" />{txt}
        </div>
      )}
    </div>
  );
}

export interface AuctionCardProps {
  auctionId: number;
  title: string;
  imageUrl?: string | null;
  endTime: string | Date;
  currentPrice: number;
  startingPrice?: number;
  currency?: string | null;

  isEnded: boolean;
  isEndingSoon?: boolean;
  endingSoonText?: string;

  currentUserId?: number | null;
  highestBidderId?: number | null;
  highestBidderName?: string | null;
  bidCount?: number;

  sessionMode?: boolean;
  isSessionFullyEnded?: boolean;
  isPrivileged?: boolean;

  sellerName?: string | null;

  bidIncrement?: number;
  shareTemplate?: string | null;
  antiSnipeEnabled?: number;
  antiSnipeMinutes?: number;
  extendMinutes?: number;
  createdBy?: number;

  timeProgress?: number | null;
  hasMyBid?: boolean;

  onLinkClick?: () => void;
}

export function AuctionCard({
  auctionId,
  title,
  imageUrl,
  endTime,
  currentPrice,
  startingPrice = 0,
  currency,
  isEnded,
  isEndingSoon = false,
  endingSoonText = "即將結束",
  currentUserId,
  highestBidderId,
  highestBidderName,
  bidCount,
  sessionMode = false,
  isSessionFullyEnded = false,
  isPrivileged = false,
  sellerName,
  bidIncrement = 30,
  shareTemplate,
  antiSnipeEnabled,
  antiSnipeMinutes,
  extendMinutes,
  createdBy,
  timeProgress,
  hasMyBid = false,
  onLinkClick,
}: AuctionCardProps) {
  const curr = getCurrencySymbol(currency);
  const priceLabel = sessionMode && isEnded ? "成交價" : "目前出價";

  function renderBidderTag() {
    if (highestBidderId && currentUserId && highestBidderId === currentUserId) {
      return (
        <span className="text-[9px] text-emerald-600 font-bold">
          {sessionMode && isEnded ? "(我得標了✓)" : "(我本人✓)"}
        </span>
      );
    }
    if (highestBidderName && sessionMode && isEnded && isSessionFullyEnded && !isPrivileged) {
      return <span className="text-[9px] text-gray-500">(得標者 ***)</span>;
    }
    if (highestBidderName) {
      return <span className="text-[9px] text-red-500 font-semibold">({highestBidderName})</span>;
    }
    if (!highestBidderId) {
      return (
        <span className="text-[9px] text-gray-400">
          {sessionMode && isEnded ? "(流拍)" : "(未有出價)"}
        </span>
      );
    }
    return null;
  }

  const cardBg = isEndingSoon
    ? (hasMyBid ? "border-orange-300 bg-orange-100/70 hover:border-orange-400" : "border-orange-200 bg-orange-50/40 hover:border-orange-300")
    : (hasMyBid ? "border-amber-200 bg-amber-100/50 hover:border-amber-300 hover:bg-amber-100/80" : "border-amber-100 hover:border-amber-300 hover:bg-amber-50/50");

  return (
    <Link href={`/auctions/${auctionId}`} onClick={onLinkClick}>
      <div className={`auction-list-item flex flex-col gap-2 p-3 rounded-xl cursor-pointer transition-all border ${cardBg}`}>
        {/* Row 1: 商品名稱 + badges 全寬 */}
        <div className="flex items-center gap-1.5 min-w-0">
          <h3 className="font-semibold text-[15px] line-clamp-1 text-amber-900 flex-1 min-w-0">{title}</h3>
          {isEndingSoon && (
            <Badge className="bg-orange-500 text-white text-[9px] px-1.5 py-0.5 animate-pulse shrink-0">
              {endingSoonText}
            </Badge>
          )}
          <Badge className={`text-[9px] px-1.5 py-0.5 shrink-0 ${!isEnded ? "bg-emerald-500 text-white" : "bg-gray-400 text-white"}`}>
            {!isEnded ? "競拍中" : "已結束"}
          </Badge>
        </div>

        {/* Row 2: 圖片 + 資料 */}
        <div className="flex gap-3">
          <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-amber-100 flex items-center justify-center shrink-0 shadow-sm">
            {imageUrl ? (
              <img src={imageUrl} alt={title} className="w-full h-full object-cover" />
            ) : (
              <span className="text-3xl">🪙</span>
            )}
            <AuctionImageOverlay endTime={endTime} />
          </div>

          <div className="flex-1 flex flex-col justify-between gap-1 min-w-0">
            {sellerName && (
              <div className="flex items-center gap-1">
                <Store className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                <span className="text-[10px] text-amber-600 truncate">{sellerName}</span>
              </div>
            )}

            {/* 出價資訊行 */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground shrink-0">{priceLabel}</span>
              {renderBidderTag()}
              {(bidCount ?? 0) > 0 && (
                <div className="flex items-center gap-0.5 text-[10px] text-amber-700 bg-amber-50 border border-amber-100 px-1.5 py-0.5 rounded-full">
                  <Users className="w-2.5 h-2.5" />
                  <span className="font-semibold">{bidCount}</span>
                </div>
              )}
            </div>

            {/* 價錢 + 分享 + 閃出價 */}
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold text-amber-600 flex-1">{curr}{currentPrice.toLocaleString()}</span>
              <div onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                <ShareMenu
                  auctionId={auctionId}
                  title={title}
                  latestBid={currentPrice}
                  currency={currency}
                  endTime={endTime}
                  shareTemplate={shareTemplate}
                  iconOnly
                />
              </div>
              <div onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                <QuickBidPopover
                  auctionId={auctionId}
                  title={title}
                  currentPrice={currentPrice}
                  startingPrice={startingPrice}
                  bidIncrement={bidIncrement}
                  currency={currency}
                  hasExistingBid={!!highestBidderId}
                  isEnded={isEnded}
                  createdBy={createdBy}
                  endTime={endTime}
                  antiSnipeEnabled={antiSnipeEnabled}
                  antiSnipeMinutes={antiSnipeMinutes}
                  extendMinutes={extendMinutes}
                />
              </div>
            </div>

            {/* 倒計時進度條 */}
            {timeProgress != null && !isEnded && (
              <div>
                <div className="h-1 rounded-full bg-amber-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${timeProgress > 0.8 ? "bg-red-400" : timeProgress > 0.5 ? "bg-orange-400" : "bg-amber-400"}`}
                    style={{ width: `${timeProgress * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
