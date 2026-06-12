import React, { useState, useEffect, useLayoutEffect, useRef, useMemo } from "react";
import { sify, tify } from "chinese-conv";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { Clock, ChevronUp, ChevronDown, ExternalLink, Trophy, AlertCircle } from "lucide-react";
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

function expandChineseBid(kw: string): string[] {
  const s = sify(kw);
  const t = tify(kw);
  return [...new Set([kw, s, t])].filter(Boolean);
}

function getBidColorRuleMatch(rules: { id: string; keywords: string; color: string; style?: string; weight?: string }[], itemData: Record<string, string>): { color: string; keywords: string[]; style: "bg" | "text"; weight: "bold" | "normal" } | null {
  if (!rules.length) return null;
  const allTextRaw = Object.values(itemData).join(" ").toLowerCase();
  const allTextS = sify(allTextRaw);
  for (const rule of rules) {
    const rawKws = rule.keywords.split(/[,，|｜\n]/).map(k => k.trim().toLowerCase()).filter(Boolean);
    if (rawKws.length === 0) continue;
    const matched = rawKws.some(kw => allTextRaw.includes(kw) || allTextS.includes(sify(kw)));
    if (matched) {
      const preset = BID_COLOR_PRESETS.find(p => p.key === rule.color);
      if (preset) return {
        color: preset.bg,
        keywords: [...new Set(rawKws.flatMap(expandChineseBid))],
        style: rule.style === "text" ? "text" : "bg",
        weight: rule.weight === "normal" ? "normal" : "bold",
      };
    }
  }
  return null;
}

function highlightBidKw(text: string, kws: string[], color: string, style: "bg" | "text" = "bg", weight: "bold" | "normal" = "bold") {
  if (!kws.length || !text) return text;
  const lower = text.toLowerCase();
  const matches: { start: number; end: number }[] = [];
  for (const kw of kws) {
    if (!kw) continue;
    let from = 0;
    while (from < lower.length) {
      const idx = lower.indexOf(kw, from);
      if (idx < 0) break;
      matches.push({ start: idx, end: idx + kw.length });
      from = idx + kw.length;
    }
  }
  if (!matches.length) return text;
  matches.sort((a, b) => a.start - b.start);
  const merged: { start: number; end: number }[] = [];
  for (const m of matches) {
    const last = merged[merged.length - 1];
    if (last && m.start < last.end) { last.end = Math.max(last.end, m.end); }
    else merged.push({ ...m });
  }
  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  const spanStyle = style === "bg"
    ? { background: color, color: "#fff", padding: "0 2px", borderRadius: "3px", fontWeight: weight === "bold" ? 700 : 400 }
    : { color, fontWeight: weight === "bold" ? 700 : 400 };
  for (const { start, end } of merged) {
    if (cursor < start) nodes.push(text.slice(cursor, start));
    nodes.push(<span key={start} style={spanStyle}>{text.slice(start, end)}</span>);
    cursor = end;
  }
  if (cursor < text.length) nodes.push(text.slice(cursor));
  return <>{nodes}</>;
}

export default function GroupAuctionBidPage() {
  const params = useParams<{ roundId: string }>();
  const roundId = parseInt(params.roundId, 10);
  const [location, setLocation] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const [biddingItem, setBiddingItem] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const [bidConfirm, setBidConfirm] = useState<{ itemId: number; amount: number; title: string; lotNumber: string; isBuyNow?: boolean } | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // ── 推廣圖片 lightbox ──
  const [promoLbIdx, setPromoLbIdx] = useState<number | null>(null);
  const [filter, setFilter] = useState<"all" | "bid" | "nobid">("all");
  const [showDesc, setShowDesc] = useState(true);
  const [bannerOpen, setBannerOpen] = useState(true);
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

  // 場主專用：出價紀錄
  const isOwner = !!(user && round && user.id === (round as any).merchantUserId);
  const { data: merchantBidsData } = trpc.groupAuctions.getMerchantBids.useQuery(
    { roundId },
    { enabled: isOwner && !isNaN(roundId), refetchInterval: 5000 }
  );
  const bidsByItem = useMemo(() => {
    const map = new Map<number, { id: number; amount: number; bidderName: string; isProxy: boolean }[]>();
    if (!merchantBidsData) return map;
    for (const b of merchantBidsData) {
      if (!map.has(b.itemId)) map.set(b.itemId, []);
      map.get(b.itemId)!.push(b);
    }
    return map;
  }, [merchantBidsData]);

  const promoImagesJson = (round as any)?.promoImagesJson ?? "[]";
  const promoUrls = useMemo(() => {
    try { const arr: any[] = JSON.parse(promoImagesJson); return arr.map((x: any) => typeof x === "string" ? x : x?.url ?? "").filter(Boolean).slice(0, 10); } catch { return []; }
  }, [promoImagesJson]);

  const colorRules: { id: string; keywords: string; color: string }[] = useMemo(() => {
    try { return JSON.parse((round as any)?.colorRulesJson ?? "[]"); } catch { return []; }
  }, [(round as any)?.colorRulesJson]);

  // 穩定 fingerprint：只在圖片 URL 內容真正改變時才重算，避免每次 refetch 洗牌
  const promoLayoutKey = useMemo(() => {
    let urls: string[] = [];
    try { const arr: any[] = JSON.parse(promoImagesJson); urls = arr.map((x: any) => typeof x === "string" ? x : x?.url ?? "").filter(Boolean); } catch {}
    if (urls.length > 0) return urls.join("|");
    const imgMap = new Map((roundImages as any[]).map((img: any) => [img.id as number, img.url as string]));
    const allUrls: string[] = [];
    for (const item of items as any[]) {
      let ids: number[] = [];
      try { ids = JSON.parse((item as any).imageIdsJson ?? "[]"); } catch {}
      for (const id of ids) { const url = imgMap.get(id); if (url && !allUrls.includes(url)) allUrls.push(url); }
    }
    return allUrls.slice(0, 5).join("|");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [promoImagesJson,
    // stable string fingerprints，唔用 array reference
    (roundImages as any[]).map((i: any) => i.url).join(","),
    (items as any[]).map((i: any) => (i as any).imageIdsJson ?? "").join(","),
  ]);

  const promoLayout = useMemo(() => {
    if (!promoLayoutKey) return [];
    let urls: string[] = [];
    try { const arr: any[] = JSON.parse(promoImagesJson); urls = arr.map((x: any) => typeof x === "string" ? x : x?.url ?? "").filter(Boolean); } catch {}
    if (urls.length === 0) {
      const imgMap = new Map((roundImages as any[]).map((img: any) => [img.id as number, img.url as string]));
      const allUrls: string[] = [];
      for (const item of items as any[]) {
        let ids: number[] = [];
        try { ids = JSON.parse((item as any).imageIdsJson ?? "[]"); } catch {}
        for (const id of ids) { const url = imgMap.get(id); if (url && !allUrls.includes(url)) allUrls.push(url); }
      }
      urls = allUrls.slice(0, 5).sort(() => Math.random() - 0.5);
    }
    if (urls.length === 0) return [];
    const shuffled = [...urls].sort(() => Math.random() - 0.5);
    return shuffled.map((url) => ({
      url,
      x:       Math.random() * 90,
      y:       Math.random() * 80,
      size:    70 + Math.random() * 60,
      rot:     (Math.random() - 0.5) * 30,
      opacity: 0.10 + Math.random() * 0.08,
    }));
  // 只依賴 stable key，唔依賴 array references
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [promoLayoutKey]);

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
        {/* 橙色 Banner（可收起） */}
        {bannerOpen && (
          <>
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
          </>
        )}

        {/* 篩選列 + 須知 + 伸縮箭咀 */}
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
          <div className="flex gap-1 flex-shrink-0 ml-1 items-center">
            {bannerOpen && (round.description || round.antiSnipeMode !== 'none' || round.defaultBidIncrement > 0 || commRate > 0) && (
              <button
                onClick={() => setShowDesc(v => !v)}
                className="text-[11px] px-1.5 py-0.5 font-medium border border-amber-200 bg-amber-50 text-amber-700"
                style={{ borderRadius: "5px" }}
              >須知{showDesc ? "▲" : "▼"}</button>
            )}
            <button
              onClick={() => setBannerOpen(v => !v)}
              className="flex items-center justify-center w-6 h-6 rounded-full border border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100 transition-colors"
              title={bannerOpen ? "收起資訊" : "展開資訊"}
            >
              {bannerOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
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
      {bannerOpen && (round.description || round.antiSnipeMode !== 'none' || round.defaultBidIncrement > 0 || commRate > 0) && showDesc && (
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
          const lotNumber = columns.filter(c => c.role === "itemNumber").map(c => data[c.key]).filter(Boolean).join(" · ");
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
                      >{colorMatch ? highlightBidKw(title || "—", colorMatch.keywords, colorMatch.color, colorMatch.style, colorMatch.weight) : (title || "—")}</p>
                    ) : (
                      <div className="flex items-baseline gap-1">
                        <p
                          ref={el => { titleRefsMap.current.set(item.id, el); }}
                          className="text-sm font-semibold text-gray-900 leading-tight overflow-hidden whitespace-nowrap flex-1 min-w-0"
                        >{colorMatch ? highlightBidKw(title || "—", colorMatch.keywords, colorMatch.color, colorMatch.style, colorMatch.weight) : (title || "—")}</p>
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
                        return <span key={c.key}>{ci > 0 ? " · " : ""}{colorMatch ? highlightBidKw(val, colorMatch.keywords, colorMatch.color, colorMatch.style, colorMatch.weight) : val}</span>;
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
                        <div className="flex items-center gap-1 flex-wrap">
                          <Trophy className="w-3 h-3 text-amber-400 flex-shrink-0" />
                          <span className={isMine ? "text-amber-600 font-medium" : "text-gray-800 font-medium"}>
                            {isMine ? "你領先" : item.topBidderName}
                          </span>
                          {(item as any).topBidIsProxy && (
                            <span
                              style={{
                                background: "#1e3a8a",
                                color: "#fff",
                                fontSize: "10px",
                                borderRadius: "6px",
                                padding: "0px 5px",
                                lineHeight: "16px",
                                fontWeight: 600,
                                letterSpacing: "0.02em",
                                whiteSpace: "nowrap",
                              }}
                            >
                              代
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {isActive && (
                    <div className="flex gap-1 flex-shrink-0">
                      <div className="flex flex-col gap-1">
                        {(item as any).buyNowPrice != null && (
                          <button
                            onClick={() => setBidConfirm({ itemId: item.id, amount: (item as any).buyNowPrice, title: title ?? "", lotNumber, isBuyNow: true })}
                            disabled={placeBidMut.isPending}
                            className="flex items-center gap-2 text-white rounded-md px-3 py-1.5"
                            style={{ background: "linear-gradient(135deg,#dc2626,#b91c1c)" }}
                          >
                            <span className="text-xs font-bold">封頂</span>
                            <span className="text-sm font-black">{displayPrice((item as any).buyNowPrice)}</span>
                          </button>
                        )}
                        <button
                          onClick={() => setBidConfirm({ itemId: item.id, amount: nextBid + effectiveIncrement, title: title ?? "", lotNumber })}
                          disabled={placeBidMut.isPending}
                          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white rounded-md px-3 py-1.5"
                        >
                          <span className="text-xs font-bold">+2口</span>
                          <span className="text-sm font-black">{displayPrice(nextBid + effectiveIncrement)}</span>
                        </button>
                        <button
                          onClick={() => setBidConfirm({ itemId: item.id, amount: nextBid, title: title ?? "", lotNumber })}
                          disabled={placeBidMut.isPending}
                          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white rounded-md px-3 py-1.5"
                        >
                          <span className="text-xs font-bold">+1口</span>
                          <span className="text-sm font-black">{displayPrice(nextBid)}</span>
                        </button>
                      </div>
                      <button
                        onClick={() => setBiddingItem(isExpanded ? null : item.id)}
                        className="flex flex-col items-center justify-center bg-gray-100 hover:bg-gray-200 text-gray-500 rounded-md self-stretch px-1"
                        style={{ fontSize: 10, fontWeight: 600, minWidth: "1.4rem", gap: 1 }}
                      >
                        {"自訂价錢".split("").map((c, i) => <span key={i}>{c}</span>)}
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

                {/* 場主專用：出價紀錄 */}
                {isOwner && (() => {
                  const itemBids = bidsByItem.get(item.id) ?? [];
                  if (itemBids.length === 0) return null;
                  const ranks = ["🥇","🥈","🥉","4","5"];
                  const fmtBidTime = (d: Date | string | null) => {
                    if (!d) return "";
                    const dt = new Date(d);
                    const days = ["日","一","二","三","四","五","六"];
                    const mm = String(dt.getMonth() + 1).padStart(2, "0");
                    const dd = String(dt.getDate()).padStart(2, "0");
                    const hh = String(dt.getHours()).padStart(2, "0");
                    const mi = String(dt.getMinutes()).padStart(2, "0");
                    return `${mm}/${dd}(${days[dt.getDay()]}) ${hh}:${mi}`;
                  };
                  return (
                    <div className="mt-2 rounded-xl overflow-hidden" style={{ background: "linear-gradient(135deg,#fffbf2,#fff8ee)", border: "1px solid #fde68a" }}>
                      <div className="flex items-center justify-between px-2.5 py-1.5" style={{ background: "linear-gradient(90deg,#f59e0b,#ea580c)", borderRadius: "10px 10px 0 0" }}>
                        <span className="text-[10px] font-bold text-white tracking-wide">出價紀錄</span>
                        <span className="text-[10px] font-semibold text-amber-100">{itemBids.length} 口</span>
                      </div>
                      <div className="flex flex-col divide-y divide-amber-100">
                        {itemBids.slice(0, 5).map((b, idx) => (
                          <div key={b.id} className="flex items-center gap-1.5 px-2.5 py-[5px]">
                            <span className="text-[11px] shrink-0 w-4 text-center">{ranks[idx]}</span>
                            <div className="flex-1 min-w-0 flex items-center gap-1 overflow-hidden">
                              <span className={`text-[11px] shrink-0 max-w-[60px] truncate ${idx === 0 ? "font-semibold text-amber-800" : "text-gray-600"}`}>
                                {b.bidderName}
                              </span>
                              {b.isProxy && <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-1 rounded shrink-0">代</span>}
                              <span className="text-[9px] text-gray-400 tabular-nums shrink-0">{fmtBidTime(b.createdAt)}</span>
                            </div>
                            <span className={`text-[11px] tabular-nums shrink-0 font-bold ${idx === 0 ? "text-amber-600" : "text-gray-500"}`}>
                              {displayPrice(b.amount)}
                            </span>
                          </div>
                        ))}
                        {itemBids.length > 5 && (
                          <div className="px-2.5 py-1 text-center">
                            <span className="text-[10px] text-amber-600">還有 {itemBids.length - 5} 口</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
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
                        setBidConfirm({ itemId: item.id, amount: amt, title: title ?? "", lotNumber });
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

      {/* 出價確認 Dialog（+1口 / +2口 / 自訂 / 封頂） */}
      {bidConfirm && (
        <>
          <div className="fixed inset-0 z-[9998]" style={{ background: "rgba(0,0,0,0.55)" }} onClick={() => setBidConfirm(null)} />
          <div
            className="fixed z-[9999] bg-white rounded-2xl shadow-2xl"
            style={{ left: 5, right: 5, bottom: "calc(env(safe-area-inset-bottom, 0px) + 68px)", padding: "14px 16px 16px" }}
            onClick={e => e.stopPropagation()}
          >
            <p className="text-sm font-bold text-center mb-2" style={{ color: bidConfirm.isBuyNow ? "#dc2626" : "#ea580c" }}>
              {bidConfirm.isBuyNow ? "確認封頂得標 無法撤回" : "確認出價後 無法撤回"}
            </p>
            <p className="text-sm text-gray-800 mb-1" style={{ wordBreak: "break-all" }}>
              {bidConfirm.title || "—"}{bidConfirm.lotNumber ? ` · ${bidConfirm.lotNumber}` : ""}
            </p>
            <div className="flex items-baseline gap-2 mb-4">
              <span className="text-xs text-gray-500">{bidConfirm.isBuyNow ? "封頂成交價" : "出價金額"}</span>
              <span className="text-2xl font-black" style={{ color: "#dc2626" }}>{displayPrice(bidConfirm.amount)}</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  handleBid(bidConfirm.itemId, bidConfirm.amount, bidConfirm.title);
                  setBidConfirm(null);
                }}
                disabled={placeBidMut.isPending}
                className="flex-1 py-2.5 text-sm text-white font-semibold rounded-xl"
                style={{ background: "linear-gradient(135deg,#dc2626,#b91c1c)" }}
              >{bidConfirm.isBuyNow ? "確認得標" : "確認"}</button>
              <button
                onClick={() => setBidConfirm(null)}
                className="flex-1 py-2.5 text-sm text-gray-600 rounded-xl"
                style={{ background: "#f3f4f6" }}
              >取消</button>
            </div>
          </div>
        </>
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
