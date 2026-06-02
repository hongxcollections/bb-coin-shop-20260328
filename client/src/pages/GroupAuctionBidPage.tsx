import React, { useState, useEffect, useLayoutEffect, useRef, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { Clock, ChevronUp, ExternalLink, Trophy, AlertCircle } from "lucide-react";
import ImageLightbox from "@/components/ImageLightbox";
import Header from "@/components/Header";

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

const BID_COLOR_PRESETS = [
  { key: "gold",   bg: "#b45309" },
  { key: "red",    bg: "#b91c1c" },
  { key: "green",  bg: "#15803d" },
  { key: "blue",   bg: "#1d4ed8" },
  { key: "orange", bg: "#c2410c" },
  { key: "purple", bg: "#7c3aed" },
  { key: "pink",   bg: "#be185d" },
  { key: "teal",   bg: "#0f766e" },
] as const;

function getBidColorRuleMatch(rules: { id: string; keywords: string; color: string }[], itemData: Record<string, string>): { color: string; keywords: string[] } | null {
  if (!rules.length) return null;
  const allText = Object.values(itemData).join(" ").toLowerCase();
  for (const rule of rules) {
    const kws = rule.keywords.split(/[,，|｜\n]/).map(k => k.trim().toLowerCase()).filter(Boolean);
    if (kws.length > 0 && kws.some(kw => allText.includes(kw))) {
      const preset = BID_COLOR_PRESETS.find(p => p.key === rule.color);
      if (preset) return { color: preset.bg, keywords: kws };
    }
  }
  return null;
}

function highlightBidKw(text: string, kws: string[], color: string) {
  if (!kws.length || !text) return text;
  for (const kw of kws) {
    const idx = text.toLowerCase().indexOf(kw);
    if (idx >= 0) {
      return (
        <>
          {text.slice(0, idx)}
          <span style={{ background: color, color: "#fff", padding: "0 2px", borderRadius: "3px", fontWeight: 700 }}>
            {text.slice(idx, idx + kw.length)}
          </span>
          {text.slice(idx + kw.length)}
        </>
      );
    }
  }
  return text;
}

export default function GroupAuctionBidPage() {
  const params = useParams<{ roundId: string }>();
  const roundId = parseInt(params.roundId, 10);
  const [location, setLocation] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const [biddingItem, setBiddingItem] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const [capConfirm, setCapConfirm] = useState<{ itemId: number; amount: number; title: string; itemNumber: number; extraCols: string } | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // ── 推廣圖片 lightbox ──
  const [promoLbIdx, setPromoLbIdx] = useState<number | null>(null);
  const [filter, setFilter] = useState<"all" | "bid" | "nobid">("all");
  const [showDesc, setShowDesc] = useState(true);
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
  const [overflowingTitles, setOverflowingTitles] = useState<Set<number>>(new Set());
  const titleRefsMap = useRef<Map<number, HTMLParagraphElement | null>>(new Map());
  const [now, setNow] = useState(() => Date.now());
  const countdown = useCountdown(undefined);
  const headerRef = useRef<HTMLDivElement>(null);
  const [headerHeight, setHeaderHeight] = useState(200);
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
  const items = useMemo(() => data?.items ?? [], [data]);
  const roundImages = data?.images ?? [];
  const imageMap = new Map(roundImages.map((img: any) => [img.id as number, img.url as string]));
  const roundCountdown = useCountdown(round?.endAt as string | null | undefined);

  const promoImagesJson = (round as any)?.promoImagesJson ?? "[]";
  const promoUrls = useMemo(() => {
    try { return (JSON.parse(promoImagesJson) as string[]).slice(0, 10); } catch { return []; }
  }, [promoImagesJson]);

  const colorRules: { id: string; keywords: string; color: string }[] = useMemo(() => {
    try { return JSON.parse((round as any)?.colorRulesJson ?? "[]"); } catch { return []; }
  }, [(round as any)?.colorRulesJson]);

  const promoLayout = useMemo(() => {
    let urls: string[] = [];
    try { urls = JSON.parse(promoImagesJson); } catch {}

    if (urls.length === 0) {
      const imgMap = new Map(roundImages.map((img: any) => [img.id as number, img.url as string]));
      const allUrls: string[] = [];
      for (const item of items) {
        let ids: number[] = [];
        try { ids = JSON.parse((item as any).imageIdsJson ?? "[]"); } catch {}
        for (const id of ids) {
          const url = imgMap.get(id);
          if (url && !allUrls.includes(url)) allUrls.push(url);
        }
      }
      urls = allUrls.sort(() => Math.random() - 0.5).slice(0, 5);
    }

    if (urls.length === 0) return [];
    const shuffled = [...urls].sort(() => Math.random() - 0.5);
    return shuffled.map((url) => {
      const x = Math.random() * 90;
      const y = Math.random() * 80;
      const size = 70 + Math.random() * 60;
      const rot = (Math.random() - 0.5) * 30;
      const opacity = 0.10 + Math.random() * 0.08;
      return { url, x, y, size, rot, opacity };
    });
  }, [promoImagesJson, items, roundImages]);

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

  useLayoutEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setHeaderHeight(el.offsetHeight));
    ro.observe(el);
    setHeaderHeight(el.offsetHeight);
    return () => ro.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round?.id, promoUrls.length]);

  useLayoutEffect(() => {
    const overflowing = new Set<number>();
    titleRefsMap.current.forEach((el, id) => {
      if (el && el.scrollWidth > el.clientWidth) overflowing.add(id);
    });
    setOverflowingTitles(overflowing);
  }, [items]);

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
      <Header />
      {/* Fixed 標題欄 + 篩選列 */}
      <div ref={headerRef} className="fixed top-[67px] left-0 right-0 z-30">
        {/* 橙色 Banner */}
        <div className="text-white px-4 pt-[15px] pb-3 mx-2 rounded-2xl relative overflow-hidden" style={{ background: "linear-gradient(90deg, #ea580c 0%, #f97316 40%, #fb923c 70%, #fbbf24 100%)" }}>
          {/* 推廣圖片背景 */}
          {promoLayout.map((p, i) => (
            <img
              key={i}
              src={p.url}
              alt=""
              aria-hidden="true"
              className="absolute object-cover rounded-lg pointer-events-none select-none"
              style={{
                left: `${p.x}%`,
                top: `${p.y}%`,
                width: p.size,
                height: p.size,
                opacity: p.opacity,
                transform: `rotate(${p.rot}deg)`,
              }}
            />
          ))}
          <div className="relative z-10">
            {/* 商戶頭像 + 名稱 */}
            {(round as any).merchantName && (
              <div className="flex items-center gap-1.5 mb-2">
                {(round as any).merchantIcon ? (
                  <img
                    src={(round as any).merchantIcon}
                    alt=""
                    className="w-5 h-5 rounded-full object-cover border border-white/40 shrink-0"
                  />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-white/30 shrink-0" />
                )}
                <span className="text-white/90 text-[11px] font-semibold truncate max-w-[160px]">
                  {(round as any).merchantName}
                </span>
              </div>
            )}

            {/* Badge + 廣告頁 */}
            <div className="flex items-center justify-between mb-1.5">
              <span className="inline-flex items-center gap-1 bg-black/20 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full tracking-widest uppercase">
                🛒 {round.periodNumber ? `第 ${round.periodNumber} 期` : "團購拍賣"}
              </span>
              <a href={`/group/${roundId}/flyer`}
                className="text-white/75 text-[11px] font-medium flex items-center gap-1">
                廣告頁 <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            {/* 場次名稱 */}
            <h1 className="text-white font-extrabold text-[18px] leading-snug mb-2.5 drop-shadow-sm">
              {round.title}
            </h1>

            {/* 倒數 + 結拍時間 */}
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-black tracking-tight text-white ${isEnded ? "bg-gray-800/40" : "bg-black/25"}`}>
                <Clock className="w-3.5 h-3.5 shrink-0" />
                {isEnded ? "已結拍" : roundCountdown}
              </div>
              <span className="text-white/85 text-[11px] font-semibold">
                結拍：{fmtDate(round.endAt)}
              </span>
            </div>

            {/* 統計 + 總需付 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 text-white/90 text-[12px] font-semibold">
                <span>共 <strong className="text-white text-[13px]">{items.length}</strong> 件</span>
                <span>成交 <strong className="text-white text-[13px]">{items.filter(i => i.status === "sold").length}</strong> 件</span>
                <span>進行中 <strong className="text-white text-[13px]">{items.filter(i => i.status === "active").length}</strong> 件</span>
              </div>
              {user && myTotalAmount > 0 && (
                <div className="text-right leading-tight">
                  <p className="text-white/75 text-[10px]">總需付</p>
                  <p style={{ fontSize: "20px" }} className="text-white font-bold leading-none">{displayPrice(myTotalAmount)}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 推廣圖片列（圓形 30×30，banner 下方） */}
        {promoUrls.length > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 bg-white/90 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            {promoUrls.map((url, i) => (
              <button
                key={i}
                type="button"
                className="flex-shrink-0 overflow-hidden rounded-full"
                style={{ width: 30, height: 30 }}
                onClick={() => setPromoLbIdx(i)}
              >
                <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </button>
            ))}
          </div>
        )}

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
            {(round.description || round.antiSnipeMode !== 'none' || round.defaultBidIncrement > 0 || commRate > 0) && (
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
      <div style={{ height: headerHeight + 3 }} />

      {/* 尚未開拍提示 */}
      {!isStarted && round.startAt && (
        <div className="mx-[3px] mt-[20px] border border-sky-200 rounded-xl p-3 text-center relative overflow-hidden" style={{ background: "linear-gradient(180deg, #f0f9ff 0%, #bae6fd 100%)" }}>
          {/* 宣傳圖片背景（同頂部 banner 方式） */}
          {promoLayout.map((p, i) => (
            <img
              key={i}
              src={p.url}
              alt=""
              aria-hidden="true"
              className="absolute object-cover rounded-lg pointer-events-none select-none"
              style={{
                left: `${p.x}%`,
                top: `${p.y}%`,
                width: p.size,
                height: p.size,
                opacity: p.opacity,
                transform: `rotate(${p.rot}deg)`,
              }}
            />
          ))}
          {/* 由左至右緩慢閃亮效果 */}
          <div
            className="shimmer-slide absolute inset-0 pointer-events-none"
            style={{ background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.55) 50%, transparent 100%)" }}
          />
          <div className="relative z-10">
            <p className="text-sm font-bold text-sky-700">場次預展</p>
            <p className="text-xs text-sky-500 mt-1">開拍時間：{fmtDate(round.startAt as string)} 至 {fmtDate(round.endAt as string)}</p>
            <p className="text-xs text-sky-600 font-mono font-semibold mt-1">{startCdStr}</p>
          </div>
        </div>
      )}

      {/* 拍賣須知（可收起） */}
      {(round.description || round.antiSnipeMode !== 'none' || round.defaultBidIncrement > 0 || commRate > 0) && showDesc && (
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
          <p className={`text-xs text-amber-600${(round.description || round.antiSnipeMode !== 'none') ? ' mt-[3px]' : ''}`}>
            每口加幅：{displayPrice(round.defaultBidIncrement)}（或個別加幅設定可能不同）{commRate > 0 ? `　買家傭金：${(commRate * 100) % 1 === 0 ? (commRate * 100).toFixed(0) : (commRate * 100).toFixed(1)}%` : ''}
          </p>
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

          const colorMatch = item.status !== "sold" ? getBidColorRuleMatch(colorRules, data) : null;
          let cardClass = "rounded-2xl overflow-hidden border";
          let cardStyle: React.CSSProperties = {};
          if (item.status === "sold") {
            cardClass += " border-gray-200";
            cardStyle = { background: "#ebebeb", opacity: 0.78 };
          } else if (isMine) {
            cardClass += " border-amber-300";
            cardStyle = { background: "#fffbeb", boxShadow: "3px 4px 0 rgba(251,191,36,0.28), 4px 6px 14px rgba(245,158,11,0.10)" };
          } else {
            cardClass += " border-gray-100 shadow-sm";
            cardStyle = { background: "#ffffff" };
          }

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
              <div className="p-3">
                {/* 倒數行（< 5min）或 已結束+成交/流拍 行 */}
                {showItemTimer && !isItemEffectivelyEnded && (
                  <div className="flex justify-end mb-1.5">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold text-white${timerFlash ? " animate-red-flash" : ""}`}
                      style={{ background: "#dc2626" }}
                    >
                      ⏱ {timerStr}
                    </span>
                  </div>
                )}
                {isItemEffectivelyEnded && (
                  <div className="flex justify-end gap-1 mb-1.5">
                    {item.topBidderId !== null ? (
                      (item as any).buyNowPrice != null && Number((item as any).finalPrice) === (item as any).buyNowPrice ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-700">落鎚封頂价{displayPrice((item as any).buyNowPrice)}成交</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-100 text-green-700">落鎚成交</span>
                      )
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-500">流拍</span>
                    )}
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-200 text-gray-600">已結束</span>
                  </div>
                )}
                {/* Row 1: 順序號碼 + 商品名稱（全寬）+ 狀態 */}
                <div className="flex items-start gap-1.5">
                  <span className="text-xs text-gray-400 flex-shrink-0 mt-0.5">{idx + 1}</span>
                  <div className="flex-1 min-w-0">
                    {expandedItems.has(item.id) ? (
                      <p
                        className="text-sm font-semibold text-gray-900 leading-tight break-all cursor-pointer"
                        onClick={e => { e.stopPropagation(); setExpandedItems(s => { const n = new Set(s); n.delete(item.id); return n; }); }}
                      >{colorMatch ? highlightBidKw(title || "—", colorMatch.keywords, colorMatch.color) : (title || "—")}</p>
                    ) : (
                      <div className="flex items-baseline gap-1">
                        <p
                          ref={el => { titleRefsMap.current.set(item.id, el); }}
                          className="text-sm font-semibold text-gray-900 leading-tight overflow-hidden whitespace-nowrap flex-1 min-w-0"
                        >{colorMatch ? highlightBidKw(title || "—", colorMatch.keywords, colorMatch.color) : (title || "—")}</p>
                        {overflowingTitles.has(item.id) && (
                          <button
                            className="text-[10px] text-amber-500 flex-shrink-0 whitespace-nowrap leading-tight"
                            onClick={e => { e.stopPropagation(); setExpandedItems(s => new Set([...s, item.id])); }}
                          >...更多</button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* 商品號碼行：右對齊，17px，深色粗體搶眼 */}
                {displayCols.filter(c => c.role === "itemNumber").length > 0 && (
                  <div className="text-right mt-0.5">
                    <span className="text-[17px] font-bold text-gray-800">
                      {displayCols.filter(c => c.role === "itemNumber").map((c, ci) => {
                        const val = data[c.key];
                        if (!val) return null;
                        return <span key={c.key}>{ci > 0 ? " · " : ""}{colorMatch ? highlightBidKw(val, colorMatch.keywords, colorMatch.color) : val}</span>;
                      })}
                    </span>
                  </div>
                )}

                {/* 關聯圖片縮圖行 */}
                {(() => {
                  let ids: number[] = [];
                  try { ids = JSON.parse((item as any).imageIdsJson ?? "[]"); } catch {}
                  const urls = ids.map(id => imageMap.get(id)).filter(Boolean) as string[];
                  if (urls.length === 0) return null;
                  return (
                    <div className="flex gap-1 mt-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: "none" }}>
                      {urls.map((url, i) => (
                        <img
                          key={i}
                          src={url}
                          alt=""
                          className="flex-shrink-0 rounded-md object-cover cursor-pointer"
                          style={{ width: 25, height: 25 }}
                          onClick={e => { e.stopPropagation(); setLightboxUrl(url); }}
                        />
                      ))}
                    </div>
                  );
                })()}

                {/* Row 2: HK$ 從左齊 */}
                <div className="flex items-center gap-2 mt-1.5">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-amber-600">{displayPrice(item.currentPrice)}</span>
                    </div>
                    <div className="text-[10px] text-gray-400" style={{ marginTop: "5px" }}>起 {displayPrice(item.startPrice)} +{displayPrice(effectiveIncrement)}</div>
                    {item.topBidderName && (
                      <div className="flex items-center justify-between gap-1 text-xs mt-0.5">
                        <div className="flex items-center gap-1">
                          <Trophy className="w-3 h-3 text-amber-400" />
                          <span className={isMine ? "text-amber-600 font-medium" : "text-gray-800 font-medium"}>
                            {isMine ? "你領先" : item.topBidderName}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {isActive && (
                    <div className="flex gap-1.5 flex-shrink-0">
                      {(item as any).buyNowPrice != null && (
                        <button
                          onClick={() => {
                            if (!isAuthenticated) { toast.error("請先登入才可出價"); setLocation(`/login?from=${encodeURIComponent(location)}`); return; }
                            if (user && round && user.id === (round as any).merchantUserId) { toast.error("商戶不可為自己的場次出價"); return; }
                            const extraCols = columns
                              .filter(c => c.role !== "startPrice" && c.role !== "buyNowPrice" && c.role !== "bidIncrement")
                              .map(c => data[c.key]).filter(Boolean).join(" · ");
                            setCapConfirm({ itemId: item.id, amount: (item as any).buyNowPrice, title: title ?? "", itemNumber: idx + 1, extraCols });
                          }}
                          disabled={placeBidMut.isPending}
                          className="text-white text-xs font-bold px-2 py-2 rounded-xl"
                          style={{ background: "linear-gradient(135deg,#dc2626,#b91c1c)" }}
                        >
                          封頂<br />
                          <span className="text-[10px] font-normal">{displayPrice((item as any).buyNowPrice)}</span>
                        </button>
                      )}
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
                      ? `你現時領先 ${displayPrice(item.currentPrice)}，含 ${(commRate * 100).toFixed(1)}% 買家傭金 需付 ${displayPrice(Number(item.currentPrice) * (1 + commRate))}`
                      : `+1口 ${displayPrice(nextBid)}，含 ${(commRate * 100).toFixed(1)}% 買家傭金 需付 ${displayPrice(Number(nextBid) * (1 + commRate))}`
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

      {/* 封頂價確認 Dialog */}
      {capConfirm && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4" style={{ background: "rgba(0,0,0,0.55)" }} onClick={() => setCapConfirm(null)}>
          <div className="bg-white rounded-2xl p-5 w-full max-w-xs shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-gray-900 mb-3">確認以封頂價得標</h3>
            <div className="rounded-xl p-3 mb-3" style={{ background: "#fff7ed", border: "1px solid #fed7aa" }}>
              <p className="text-xs text-gray-600 mb-1">商品 {capConfirm.itemNumber}</p>
              <p className="text-sm font-semibold text-gray-900 leading-snug mb-2" style={{ wordBreak: "break-all" }}>
                {capConfirm.extraCols || capConfirm.title || "—"}
              </p>
              <p className="text-xs text-gray-500 mb-0.5">封頂成交價</p>
              <p className="text-xl font-black" style={{ color: "#dc2626" }}>{displayPrice(capConfirm.amount)}</p>
            </div>
            <p className="text-[11px] text-gray-400 mb-4">確認後商品即時得標，無法取消。</p>
            <div className="flex gap-2">
              <button
                onClick={() => setCapConfirm(null)}
                className="flex-1 py-2.5 text-sm text-gray-600 rounded-xl"
                style={{ background: "#f3f4f6" }}
              >取消</button>
              <button
                onClick={() => {
                  handleBid(capConfirm.itemId, capConfirm.amount, capConfirm.title, capConfirm.itemNumber);
                  setCapConfirm(null);
                }}
                disabled={placeBidMut.isPending}
                className="flex-1 py-2.5 text-sm text-white font-semibold rounded-xl"
                style={{ background: "linear-gradient(135deg,#dc2626,#b91c1c)" }}
              >確認得標</button>
            </div>
          </div>
        </div>
      )}

      {/* 推廣圖片 Lightbox */}
      {promoLbIdx !== null && promoUrls.length > 0 && (
        <ImageLightbox
          images={promoUrls}
          initialIndex={promoLbIdx}
          alt="場次推廣圖片"
          onClose={() => setPromoLbIdx(null)}
        />
      )}

      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-[9999] bg-black/85 flex items-center justify-center"
          onClick={() => setLightboxUrl(null)}
        >
          <img src={lightboxUrl} alt="" className="object-contain rounded-lg" style={{ maxHeight: "90vh", maxWidth: "95vw" }} />
          <button
            className="absolute top-4 right-4 text-white/70 hover:text-white"
            onClick={() => setLightboxUrl(null)}
          >
            <span style={{ fontSize: 28, lineHeight: 1 }}>✕</span>
          </button>
        </div>
      )}

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
