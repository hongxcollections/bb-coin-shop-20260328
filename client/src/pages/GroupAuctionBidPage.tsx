import React, { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { Clock, ChevronUp, ExternalLink, Trophy, AlertCircle } from "lucide-react";

type ColumnDef = { key: string; label: string; role: string; showOnBidPage?: boolean };

function fmtDate(d: string | Date | null) {
  if (!d) return "—";
  const dt = new Date(d);
  return `${dt.getMonth() + 1}月${dt.getDate()}日 ${dt.getHours().toString().padStart(2, "0")}:${dt.getMinutes().toString().padStart(2, "0")}`;
}

function useCountdown(endAt: string | null | undefined) {
  const [text, setText] = useState("");
  useEffect(() => {
    if (!endAt) { setText("—"); return; }
    const tick = () => {
      const diff = new Date(endAt).getTime() - Date.now();
      if (diff <= 0) { setText("已截止"); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      if (h > 0) setText(`${h}h ${m}m ${s}s`);
      else if (m > 0) setText(`${m}m ${s}s`);
      else setText(`${s}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endAt]);
  return text;
}


const CURR_SYMS: Record<string, string> = { HKD: "HK$", CNY: "¥", USD: "US$", JPY: "JP¥", GBP: "£", EUR: "€" };

export default function GroupAuctionBidPage() {
  const params = useParams<{ roundId: string }>();
  const roundId = parseInt(params.roundId, 10);
  const [location, setLocation] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const [biddingItem, setBiddingItem] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const [filter, setFilter] = useState<"all" | "bid" | "nobid">("all");
  const [showDesc, setShowDesc] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const countdown = useCountdown(undefined);
  const headerRef = useRef<HTMLDivElement>(null);
  const [headerHeight, setHeaderHeight] = useState(160);
  const pendingBidRef = useRef<{ title: string; itemNumber: number } | null>(null);

  const { data, isLoading, refetch, error } = trpc.groupAuctions.getRound.useQuery(
    { roundId },
    { refetchInterval: 3000, refetchOnMount: true, refetchOnWindowFocus: true, enabled: !isNaN(roundId) }
  );

  const placeBidMut = trpc.groupAuctions.placeBid.useMutation({
    onSuccess: (r) => {
      const info = pendingBidRef.current;
      const label = info ? `${info.itemNumber}. ${info.title}\n` : "";
      if (r.isBuyNow) {
        toast.success(`${label}直購成功！${displayPrice(r.finalAmount)}`);
      } else {
        toast.success(`${label}出價 ${displayPrice(r.finalAmount)} 成功`);
      }
      pendingBidRef.current = null;
      setBiddingItem(null);
      setCustomAmount("");
      refetch();
    },
    onError: (e) => toast.error(e.message || "出價失敗"),
  });

  const round = data?.round;
  const items = data?.items ?? [];
  const roundCountdown = useCountdown(round?.endAt as string | null | undefined);

  const columns: ColumnDef[] = (() => {
    try { return JSON.parse(round?.columnsJson ?? "[]"); } catch { return []; }
  })();
  const displayCols = columns.filter(c => c.showOnBidPage !== false && c.role !== "startPrice" && c.role !== "buyNowPrice" && c.role !== "bidIncrement");
  const titleCol = columns.find(c => c.role === "itemTitle");
  function getItemData(item: any): Record<string, string> {
    try { return JSON.parse(item.dataJson); } catch { return {}; }
  }

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setHeaderHeight(el.offsetHeight));
    ro.observe(el);
    setHeaderHeight(el.offsetHeight);
    return () => ro.disconnect();
  }, []);

  function handleBid(itemId: number, amount: number, itemTitle?: string, itemNumber?: number) {
    if (!isAuthenticated) {
      toast.error("請先登入才可出價");
      setLocation(`/login?from=${encodeURIComponent(location)}`);
      return;
    }
    // 商戶不可為自己的場次出價
    if (user && round && user.id === (round as any).merchantUserId) {
      toast.error("商戶不可為自己的場次出價");
      return;
    }
    pendingBidRef.current = { title: itemTitle ?? "", itemNumber: itemNumber ?? 0 };
    placeBidMut.mutate({ itemId, amount });
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400 text-sm">載入中...</p>
      </div>
    );
  }

  if (error || !round) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center">
          <AlertCircle className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">場次不存在或未發布</p>
        </div>
      </div>
    );
  }

  const isEnded = round.status === "ended";
  const isStarted = !round.startAt || new Date(round.startAt as string).getTime() <= now;
  const startSecsLeft = !isStarted && round.startAt
    ? Math.max(0, Math.floor((new Date(round.startAt as string).getTime() - now) / 1000))
    : 0;
  const startCdStr = (() => {
    if (isStarted || !round.startAt) return "";
    const h = Math.floor(startSecsLeft / 3600);
    const m = Math.floor((startSecsLeft % 3600) / 60);
    const s = startSecsLeft % 60;
    const hh = h.toString().padStart(2, "0");
    const mm = m.toString().padStart(2, "0");
    const ss = s.toString().padStart(2, "0");
    return `距離開拍時間 ${hh}:${mm}:${ss}`;
  })();
  const currency = (((round as any).displayCurrencies ?? "CNY").split(",")[0].trim()) || "CNY";
  const currSym = CURR_SYMS[currency] ?? "HK$";
  function displayPrice(amt: number | null | undefined): string {
    if (amt == null) return "—";
    return `${currSym}${Math.round(Number(amt)).toLocaleString()}`;
  }
  const commRate = parseFloat(String(round.buyerCommissionRate));
  const myTotalAmount = user
    ? items.filter(i => Number(i.topBidderId) === Number(user.id))
        .reduce((sum, i) => sum + Number(i.currentPrice) * (1 + commRate), 0)
    : 0;

  return (
    <div className="min-h-screen bg-gray-50 pb-6">
      {/* Fixed 標題欄 + 篩選列 */}
      <div ref={headerRef} className="fixed top-0 left-0 right-0 z-30">
        {/* 橙色 Banner */}
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-4 pt-[15px] pb-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs opacity-80">{round.periodNumber ? `第 ${round.periodNumber} 期` : "團購拍賣"}</p>
              <h1 className="text-lg font-bold leading-tight">{round.title}</h1>
            </div>
            <a href={`/group/${roundId}/flyer`} target="_blank"
              className="flex items-center gap-1 text-xs bg-white/20 hover:bg-white/30 px-2 py-1 rounded-lg flex-shrink-0">
              <ExternalLink className="w-3 h-3" /> 廣告頁
            </a>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <div className={`flex items-center gap-1.5 text-sm font-bold px-3 py-1 rounded-full ${isEnded ? "bg-gray-800/40" : "bg-white/20"}`}>
              <Clock className="w-3.5 h-3.5" />
              {isEnded ? "已結拍" : roundCountdown}
            </div>
            <span className="text-xs opacity-70">結拍：{fmtDate(round.endAt)}</span>
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <div className="flex gap-3 text-xs opacity-80">
              <span>共 {items.length} 件</span>
              <span>成交 {items.filter(i => i.status === "sold").length} 件</span>
              <span>進行中 {items.filter(i => i.status === "active").length} 件</span>
            </div>
            {user && myTotalAmount > 0 && (
              <div className="text-right leading-tight">
                <p className="text-[10px] opacity-75">總需付</p>
                <p style={{ fontSize: "20px" }} className="font-bold leading-none">{displayPrice(myTotalAmount)}</p>
              </div>
            )}
          </div>
        </div>
        {/* 篩選列 + 貨幣 + 須知 */}
        <div className="bg-white border-b border-gray-100 shadow-sm px-2 py-2 flex items-center gap-1.5">
          <div className="flex gap-1.5 overflow-x-auto flex-1 min-w-0">
            <button onClick={() => setFilter("all")} className={`flex-shrink-0 text-xs px-2.5 py-1 rounded-full border transition-colors ${filter === "all" ? "bg-amber-500 text-white border-amber-500" : "bg-white text-gray-500 border-gray-200"}`}>
              全部 {items.length}件
            </button>
            <button onClick={() => setFilter("bid")} className={`flex-shrink-0 text-xs px-2.5 py-1 rounded-full border transition-colors ${filter === "bid" ? "bg-amber-500 text-white border-amber-500" : "bg-white text-gray-500 border-gray-200"}`}>
              已出價 {items.filter(i => i.topBidderId !== null).length}件
            </button>
            <button onClick={() => setFilter("nobid")} className={`flex-shrink-0 text-xs px-2.5 py-1 rounded-full border transition-colors ${filter === "nobid" ? "bg-amber-500 text-white border-amber-500" : "bg-white text-gray-500 border-gray-200"}`}>
              未出價 {items.filter(i => i.topBidderId === null).length}件
            </button>
          </div>
          <div className="flex gap-1 flex-shrink-0 ml-1">
            {(round.description || round.antiSnipeMode !== 'none') && (
              <button
                onClick={() => setShowDesc(v => !v)}
                className="text-[11px] px-1.5 py-0.5 font-medium border border-amber-200 bg-amber-50 text-amber-700"
                style={{ borderRadius: "5px" }}
              >須知{showDesc ? "▲" : "▼"}</button>
            )}
          </div>
        </div>
      </div>

      {/* Fixed header 佔位 spacer */}
      <div style={{ height: headerHeight }} />

      {/* 尚未開拍提示 */}
      {!isStarted && round.startAt && (
        <div className="mx-[3px] mt-[20px] bg-sky-50 border border-sky-200 rounded-xl p-3 text-center">
          <p className="text-sm font-bold text-sky-700">場次預展</p>
          <p className="text-xs text-sky-500 mt-1">開拍時間：{fmtDate(round.startAt as string)} 至 {fmtDate(round.endAt as string)}</p>
          <p className="text-xs text-sky-600 font-mono font-semibold mt-1">{startCdStr}</p>
        </div>
      )}

      {/* 拍賣須知（可收起） */}
      {(round.description || round.antiSnipeMode !== 'none') && showDesc && (
        <div className="mx-[3px] mt-[20px] bg-amber-50 border border-amber-100 rounded-xl p-3">
          {round.description && (
            <p className="text-xs text-amber-700 whitespace-pre-line">{round.description}</p>
          )}
          {round.antiSnipeMode !== 'none' && (
            <p className={`text-xs text-amber-600 font-medium${round.description ? ' mt-[3px]' : ''}`}>
              {round.antiSnipeMode === 'per_item'
                ? `單件延時：出價時間距結束少於 ${round.antiSnipeMinutes} 分鐘，商品自動延長 ${round.antiSnipeExtendMinutes} 分鐘`
                : `全場延時：出價時間距結束少於 ${round.antiSnipeMinutes} 分鐘，全場自動延長 ${round.antiSnipeExtendMinutes} 分鐘`
              }
            </p>
          )}
        </div>
      )}

      {/* 商品列表 */}
      <div className="px-[3px] mt-[40px] space-y-2 pb-20">
        {items.filter(item => {
          if (filter === "bid") return item.topBidderId !== null;
          if (filter === "nobid") return item.topBidderId === null;
          return true;
        }).map((item, idx) => {
          const data = getItemData(item);
          const title = titleCol ? data[titleCol.key] : `商品 ${idx + 1}`;
          const isMine = user && Number(item.topBidderId) === Number(user.id);
          const isActive = item.status === "active" && !isEnded && isStarted;
          const effectiveIncrement = item.bidIncrement > 0 ? item.bidIncrement : round.defaultBidIncrement;
          // startPrice=0 時，第一口 = effectiveIncrement（避免出價 0）
          const nextBid = item.topBidderId
            ? (item.currentPrice as number) + effectiveIncrement
            : (item.startPrice > 0 ? item.startPrice : effectiveIncrement);
          const isExpanded = biddingItem === item.id;
          const nextBidInCurr = nextBid;
          // per_item 倒數：用 item.endAt（anti-snipe 延長後）或 round.endAt 作兜底
          const effectiveItemEndAt = (item.endAt ?? round.endAt) as string | null;
          const itemEndMs = effectiveItemEndAt ? new Date(effectiveItemEndAt).getTime() : null;
          const rawItemSecsLeft = (itemEndMs !== null && isActive)
            ? Math.max(0, Math.floor((itemEndMs - now) / 1000))
            : null;
          // badge 只在 ≤5 分鐘才出現
          const showItemTimer = round.antiSnipeMode === "per_item" && rawItemSecsLeft !== null && rawItemSecsLeft <= 300;
          const itemSecsLeft = rawItemSecsLeft ?? 0;
          const timerMins = Math.floor(itemSecsLeft / 60);
          const timerSecs = itemSecsLeft % 60;
          const timerStr = `${timerMins}:${String(timerSecs).padStart(2, "0")}`;
          const timerRed = showItemTimer; // ≤5min 已是 amber/red
          const timerFlash = showItemTimer && itemSecsLeft <= 180; // ≤3min 閃紅
          const roundEndMs = round.endAt ? new Date(round.endAt as string).getTime() : null;
          const showRoundTimer = round.antiSnipeMode === "whole_round" && roundEndMs !== null && isActive;
          const roundSecsLeft = showRoundTimer ? Math.max(0, Math.floor((roundEndMs! - now) / 1000)) : 0;
          const roundTimerStr = `${Math.floor(roundSecsLeft / 60)}:${String(roundSecsLeft % 60).padStart(2, "0")}`;
          const roundTimerRed = showRoundTimer && roundSecsLeft <= 300;
          const roundTimerFlash = showRoundTimer && roundSecsLeft <= 180;
          // 商品是否已結束（時間到 or 狀態非 active，用於顯示「已結束」badge）
          const isItemEffectivelyEnded = isStarted && (
            item.status !== "active" || isEnded ||
            (round.antiSnipeMode === "per_item" && itemEndMs !== null && now >= itemEndMs)
          );

          let cardClass = "rounded-2xl overflow-hidden border";
          let cardStyle: React.CSSProperties = {};
          if (item.status === "sold") { cardClass += " bg-white border-green-100 shadow-sm"; }
          else if (isMine) {
            cardClass += " bg-amber-50 border-amber-300";
            cardStyle = { boxShadow: "3px 4px 0 rgba(251,191,36,0.28), 4px 6px 14px rgba(245,158,11,0.10)" };
          } else { cardClass += " bg-white border-gray-100 shadow-sm"; }

          return (
            <div key={item.id} className="relative">
              {showRoundTimer && (
                <div
                  className={`absolute right-3 z-10 flex items-center gap-1 px-2 py-[2px] text-[11px] font-mono font-semibold rounded-full border bg-white${roundTimerFlash ? " animate-red-flash" : ""}`}
                  style={{ top: "-9px", color: roundTimerRed ? "#dc2626" : "#f59e0b", borderColor: roundTimerRed ? "#fca5a5" : "#fde68a" }}
                >
                  ⏱ {roundTimerStr}
                </div>
              )}
              <div className={`relative ${cardClass}`} style={cardStyle}>
              {isMine && isActive && (
                <div className="absolute inset-0 rounded-2xl animate-amber-shimmer pointer-events-none" />
              )}
              {isItemEffectivelyEnded && (
                <div className="absolute top-1 right-2 z-10 flex items-center px-1.5 py-[1px] text-[10px] font-semibold rounded-full bg-gray-100 text-gray-500">
                  已結束
                </div>
              )}
              {showItemTimer && !isItemEffectivelyEnded && (
                <div
                  className={`absolute top-1 right-2 z-10 flex items-center gap-0.5 px-1.5 py-[1px] text-[10px] font-mono font-semibold rounded-full bg-white/90${timerFlash ? " animate-red-flash" : ""}`}
                  style={{ color: timerRed ? "#dc2626" : "#f59e0b" }}
                >
                  ⏱ {timerStr}
                </div>
              )}
              <div className="p-3">
                {/* Row 1: 順序號碼 + 商品名稱 + 商品號碼 + 狀態 同一行 */}
                <div className="flex items-start gap-1.5">
                  <span className="text-xs text-gray-400 flex-shrink-0 mt-0.5">{idx + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 leading-tight line-clamp-1">{title || "—"}</p>
                    {title && title.length > 10 && (
                      <p className="text-[12px] font-medium text-gray-600 leading-tight break-all mt-0.5">{title}</p>
                    )}
                  </div>
                  {displayCols.filter(c => c.role === "customText").length > 0 && (
                    <span className="text-xs text-gray-400 flex-shrink-0">
                      {displayCols.filter(c => c.role === "customText").map(c => data[c.key]).filter(Boolean).join(" · ")}
                    </span>
                  )}
                  {item.status === "sold" && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full flex-shrink-0">成交</span>
                  )}
                  {item.status === "unsold" && (
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full flex-shrink-0">流拍</span>
                  )}
                </div>

                {/* Row 2: HK$ 從左齊（同順序號碼左邊拍齊） */}
                <div className="flex items-center gap-2 mt-1.5">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-amber-600">{displayPrice(item.currentPrice)}</span>
                      <span className="text-[8px] text-gray-400">起 {displayPrice(item.startPrice)}</span>
                    </div>
                    {item.topBidderName && (
                      <div className="flex items-center gap-1 text-xs mt-0.5">
                        <Trophy className="w-3 h-3 text-amber-400" />
                        <span className={isMine ? "text-amber-600 font-medium" : "text-gray-500"}>
                          {isMine ? "你領先" : item.topBidderName}
                        </span>
                      </div>
                    )}
                  </div>

                  {isActive && (
                    <div className="flex gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => handleBid(item.id, nextBid + effectiveIncrement, title, idx + 1)}
                        disabled={placeBidMut.isPending}
                        className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold px-3 py-2 rounded-xl"
                      >
                        +2口<br />
                        <span className="text-[10px] font-normal">{displayPrice(nextBid + effectiveIncrement)}</span>
                      </button>
                      <button
                        onClick={() => handleBid(item.id, nextBid, title, idx + 1)}
                        disabled={placeBidMut.isPending}
                        className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold px-3 py-2 rounded-xl"
                      >
                        +1口<br />
                        <span className="text-[10px] font-normal">{displayPrice(nextBid)}</span>
                      </button>
                      <button
                        onClick={() => setBiddingItem(isExpanded ? null : item.id)}
                        className="bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs px-2 py-2 rounded-xl"
                      >
                        <ChevronUp className={`w-4 h-4 transition-transform ${isExpanded ? "" : "rotate-180"}`} />
                      </button>
                    </div>
                  )}
                </div>

                {/* 傭金提示 */}
                {isActive && commRate > 0 && (
                  <p className="text-[10px] text-gray-400 mt-1">
                    {isMine
                      ? `你現時領先 ${displayPrice(item.currentPrice)}，含 ${(commRate * 100).toFixed(1)}% 傭金 需付 ${displayPrice(Number(item.currentPrice) * (1 + commRate))}`
                      : `+1口 ${displayPrice(nextBid)}，含 ${(commRate * 100).toFixed(1)}% 傭金 需付 ${displayPrice(Number(nextBid) * (1 + commRate))}`
                    }
                  </p>
                )}
              </div>

              {/* 自訂出價展開 */}
              {isExpanded && isActive && (
                <div className="border-t border-gray-50 px-3 pb-3 pt-2">
                  <p className="text-xs text-gray-500 mb-2">自訂出價（最少 {currSym}{nextBidInCurr}）</p>
                  <div className="flex gap-2">
                    <input
                      className="flex-1 px-3 py-2 text-sm outline-none"
                      style={{ background: "#fff", border: "1px solid #E5E5E5", borderRadius: "12px" }}
                      placeholder={`最少 ${nextBidInCurr}`}
                      value={customAmount}
                      onChange={e => setCustomAmount(e.target.value)}
                    />
                    <button
                      onClick={() => {
                        const amt = parseInt(customAmount, 10);
                        if (!amt || amt < nextBidInCurr) { toast.error(`最少 ${currSym}${nextBidInCurr}`); return; }
                        handleBid(item.id, amt, title, idx + 1);
                      }}
                      disabled={placeBidMut.isPending}
                      className="bg-amber-500 hover:bg-amber-600 text-white text-sm px-4 py-2 rounded-xl font-medium"
                    >
                      出價
                    </button>
                  </div>
                </div>
              )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 底部 */}
      {!isAuthenticated && !isEnded && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-3">
          <button
            onClick={() => setLocation(`/login?from=${encodeURIComponent(location)}`)}
            className="w-full bg-amber-500 hover:bg-amber-600 text-white font-semibold py-3 rounded-2xl"
          >
            登入 / 註冊 以出價
          </button>
        </div>
      )}
    </div>
  );
}
