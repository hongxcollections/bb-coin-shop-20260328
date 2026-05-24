import React, { useState, useEffect, useRef, useMemo } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Clock, Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, SlidersHorizontal, ChevronDown, Shield, TrendingUp, Award, Coins, Store, Users, LogIn, Gavel, Sparkles, LayoutGrid, List } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { getCurrencySymbol } from "./AdminAuctions";
import { parseCategories } from "@/lib/categories";
import { ShareMenu } from "@/components/ShareMenu";
import { QuickBidPopover } from "@/components/QuickBidPopover";
import { AuctionCard } from "@/components/AuctionCard";
import { AuctionCardFb } from "@/components/AuctionCardFb";
import Header from "@/components/Header";
import AdSenseAd from "@/components/AdSenseAd";

function AuctionImageOverlay({ endTime }: { endTime: Date | string }) {
  const [txt, setTxt] = useState("");
  const [urgent, setUrgent] = useState(false);
  useEffect(() => {
    function update() {
      const diff = new Date(endTime).getTime() - Date.now();
      if (diff <= 0) { setTxt(""); return; }
      const totalHours = diff / 3600000;
      if (totalHours > 12) {
        const days = Math.floor(diff / 86400000);
        const remH = Math.floor((diff % 86400000) / 3600000);
        setTxt(days >= 1 ? (remH > 0 ? `${days}天${remH}h後` : `${days}天後`) : `${Math.floor(totalHours)}h後`);
        setUrgent(false);
      } else {
        const h = Math.floor(totalHours);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        const pad = (n: number) => String(n).padStart(2, "0");
        setTxt(h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`);
        setUrgent(diff < 3600000);
      }
    }
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [endTime]);
  if (!txt) return null;
  return (
    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-1.5 py-1 pointer-events-none">
      {urgent
        ? <div className="flex items-center gap-0.5 text-[10px] font-black leading-none animate-pulse bg-red-600 text-white px-1 py-0.5 rounded self-start inline-flex">
            <Clock className="w-2.5 h-2.5 shrink-0" />{txt}
          </div>
        : <div className="flex items-center gap-0.5 text-[10px] font-bold leading-none text-white">
            <Clock className="w-2.5 h-2.5 shrink-0" />{txt}
          </div>
      }
    </div>
  );
}

const PAGE_SIZE = 20;

export default function Auctions() {
  const { user, isAuthenticated } = useAuth();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"active" | "myBids">("active");
  const [category, setCategory] = useState("all");
  const [merchantFilter, setMerchantFilter] = useState("all");
  const [categoryPanelOpen, setCategoryPanelOpen] = useState(false);
  const [page, setPage] = useState(() => {
    // Only restore page if we also have a saved scroll position (i.e. returning from detail)
    const hasScroll = sessionStorage.getItem("auctions-scroll");
    const savedPage = sessionStorage.getItem("auctions-page");
    return (hasScroll && savedPage) ? parseInt(savedPage, 10) : 0;
  });
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [viewMode, setViewMode] = useState<"default" | "fb" | null>(null);
  const [slimBarOpen, setSlimBarOpen] = useState(true);
  const [slimBarPage, setSlimBarPage] = useState(0);
  const scrollRestoredRef = useRef(false);

  const saveScrollPosition = () => {
    sessionStorage.setItem("auctions-scroll", String(window.scrollY));
    sessionStorage.setItem("auctions-page", String(page));
  };

  const { data: auctions, isLoading } = trpc.auctions.list.useQuery(
    { limit: 100, offset: 0 },
    {
      refetchInterval: 5000, // 每 5 秒自動輪詢，確保價格和最高出價者即時更新
      staleTime: 3000, // 3 秒內視為新鮮資料
    }
  );

  const { data: recentlyEnded } = trpc.auctions.listRecentEnded.useQuery(undefined, {
    refetchInterval: 30000,
    staleTime: 15000,
  });

  // 查詢當前用戶曾出價的拍賣 ID（常駐 fetch，用於 card 底色高亮）
  const { data: myBidsData } = trpc.auctions.myBids.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchInterval: 30000,
    staleTime: 15000,
  });
  const myBidAuctionIds = new Set((myBidsData ?? []).map((b: { auctionId: number | null }) => b.auctionId).filter((id: number | null): id is number => id !== null));

  // 從後台讀取即將結標提醒閾値（預設 30 分鐘）
  const { data: siteSettings } = trpc.siteSettings.getAll.useQuery(undefined, {
    staleTime: 5 * 60 * 1000, // 緩存 5 分鐘
  });
  const _ss = (siteSettings as Record<string, string> | undefined) ?? {};

  const CATEGORIES = [
    { value: "all", label: "全部", emoji: "🪙" },
    ...parseCategories(_ss).map(c => ({ value: c, label: c, emoji: "🏷️" })),
  ];

  const _endingSoonRaw = parseInt(_ss.endingSoonMinutes ?? '30', 10);
  const endingSoonMs = (isNaN(_endingSoonRaw) || _endingSoonRaw < 1 ? 30 : _endingSoonRaw) * 60 * 1000;
  const endingSoonText = _ss.endingSoonText || "⏰ 即將結束";

  // 計算每個分類的活躍拍賣數量
  const categoryCounts: Record<string, number> = (() => {
    const counts: Record<string, number> = { all: 0 };
    for (const a of auctions ?? []) {
      const isActive = a.status === 'active' && new Date(a.endTime).getTime() > Date.now();
      if (!isActive) continue;
      counts.all++;
      const cat = (a as { category?: string | null }).category;
      if (cat) counts[cat] = (counts[cat] ?? 0) + 1;
    }
    return counts;
  })();

  // Restore scroll position (and page) when returning from auction detail
  useEffect(() => {
    if (auctions && !scrollRestoredRef.current) {
      const savedScroll = sessionStorage.getItem("auctions-scroll");
      if (savedScroll) {
        scrollRestoredRef.current = true;
        // Page is already restored via useState initializer; just scroll after paint
        requestAnimationFrame(() => {
          window.scrollTo({ top: parseInt(savedScroll), behavior: "instant" });
          sessionStorage.removeItem("auctions-scroll");
          sessionStorage.removeItem("auctions-page");
        });
      } else {
        // Fresh visit — clear any stale page state
        scrollRestoredRef.current = true;
        sessionStorage.removeItem("auctions-page");
      }
    }
  }, [auctions]);

  // Unique merchant list from active auctions
  const merchants = Array.from(
    new Set(
      (auctions ?? [])
        .filter(a => a.status === "active" && new Date(a.endTime).getTime() > Date.now())
        .map(a => (a as { sellerName?: string | null }).sellerName)
        .filter((n): n is string => !!n)
    )
  ).sort();

  const filtered = (auctions ?? []).filter((a) => {
    const matchSearch = !search || a.title.toLowerCase().includes(search.toLowerCase());
    const isActive = a.status === "active" && new Date(a.endTime).getTime() > Date.now();
    const matchMerchant = merchantFilter === "all" || (a as { sellerName?: string | null }).sellerName === merchantFilter;
    const matchCategory = category === "all" || (a as { category?: string | null }).category === category;
    if (filter === "myBids") {
      return matchSearch && isActive && matchMerchant && matchCategory && myBidAuctionIds.has(a.id);
    }
    return matchSearch && isActive && matchMerchant && matchCategory;
  });

  // 排序：活躍拍賣在前，已結束拍賣在後
  const sorted = [...filtered].sort((a, b) => {
    const aEnded = new Date(a.endTime).getTime() <= Date.now() || a.status === 'ended';
    const bEnded = new Date(b.endTime).getTime() <= Date.now() || b.status === 'ended';
    if (aEnded !== bEnded) return aEnded ? 1 : -1;
    return 0;
  });

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paginated = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // 隨機決定 LIVE banner 插入於第幾行之後（3..8），data 變動或翻頁時重新隨機
  const bannerAfterRow = useMemo(
    () => Math.floor(Math.random() * 6) + 3,
    [page, auctions?.length],
  );

  // 找出所有活躍拍賣中出價最高的項目 ID
  const topBidAuctionId = (auctions ?? [])
    .filter(a => new Date(a.endTime).getTime() > Date.now())
    .reduce<{ id: number; price: number } | null>((top, a) => {
      const price = Number(a.currentPrice);
      return !top || price > top.price ? { id: a.id, price } : top;
    }, null)?.id ?? null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 via-yellow-50/40 to-white overflow-x-hidden">
      {/* Navigation */}
      <Header />

      {/* ── 拍賣 Hero（深重黃金漸變：頂部深 → 底部淺）── */}
      <div className="bg-gradient-to-b from-amber-500 via-amber-300 to-amber-100 pb-6">
        <div className="max-w-5xl mx-auto px-4 pt-6 pb-7 relative">
          <div className="absolute -right-12 -top-12 w-48 h-48 bg-amber-400/40 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -left-10 -bottom-4 w-32 h-32 bg-yellow-300/40 rounded-full blur-2xl pointer-events-none" />
          <div className="relative">
            <div className="inline-flex items-center gap-1.5 bg-white/80 backdrop-blur text-amber-800 px-2.5 py-1 rounded-full text-xs font-semibold mb-2 shadow-sm">
              <Gavel className="w-3.5 h-3.5" /> 即時競拍
            </div>
            <div className="flex items-baseline gap-3 flex-wrap">
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-amber-900">所有拍賣</h1>
              <span className="inline-flex items-center bg-white/85 backdrop-blur text-amber-800 px-2.5 py-0.5 rounded-full text-xs font-bold border border-amber-300/60 shadow-sm">
                共 {filtered.length} 件拍品
              </span>
            </div>
            <p className="text-xs md:text-sm text-amber-900/80 mt-1.5">精選錢幣 · 公開競投 · 安心交易</p>

            {/* ── 統計格搬入 hero：副題下方，負 margin 凸出 hero 底部分隔線 ── */}
            <div className="grid grid-cols-3 gap-2 mt-3 max-w-md relative z-10 -mb-10">
              {(() => {
                const activeCount = (auctions ?? []).filter(a => a.status === 'active' && new Date(a.endTime).getTime() > Date.now()).length;
                const endedCount = (auctions ?? []).filter(a => a.status === 'ended' || new Date(a.endTime).getTime() <= Date.now()).length;
                return [
                  { label: "活躍拍賣", value: activeCount, suffix: "件", icon: "🔨", color: "from-amber-400 to-orange-500" },
                  { label: "已成交", value: endedCount, suffix: "件", icon: "✅", color: "from-emerald-400 to-teal-500" },
                  { label: "錢幣品類", value: "100+", suffix: "", icon: "🪙", color: "from-purple-400 to-indigo-500" },
                ].map((s) => (
                  <div key={s.label} className="p-2.5 text-center relative overflow-hidden rounded-xl border border-amber-200 bg-white shadow-md">
                    <div className={`absolute inset-0 bg-gradient-to-br ${s.color} opacity-[0.07]`} />
                    <div className="relative">
                      <div className="text-base mb-0.5">{s.icon}</div>
                      <div className="text-base font-extrabold text-amber-800">{s.value}{s.suffix}</div>
                      <div className="text-[10px] font-medium text-muted-foreground tracking-wide">{s.label}</div>
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>
      </div>

      <div className="container pt-6 pb-3">
        {/* ── 未登入用戶引導橫幅 ── */}
        {!isAuthenticated && (
          <div className="mb-3">
            <div className="flex items-center gap-3 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl px-4 py-2.5 shadow-sm">
              <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                <LogIn className="w-4 h-4 text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-amber-900">登入即可出價競拍</div>
                <div className="text-[10px] text-amber-700">免費註冊・安全可信・即時競標</div>
              </div>
              <a href="/login" className="shrink-0 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold px-3 py-1.5 rounded-full transition-colors">
                立即登入
              </a>
            </div>
          </div>
        )}

        {/* Category Selector - Collapsible Panel with Counts */}
        <div className="mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setCategoryPanelOpen(o => !o)}
              className="border border-amber-200 bg-white text-amber-800 hover:bg-amber-50 flex items-center gap-1.5 rounded-full px-3 h-8 shadow-sm transition-all active:scale-95 text-xs"
            >
              <span className="text-sm leading-none">💰</span>
              <span className="font-semibold">
                {category === "all"
                  ? `全部商品分類 (${categoryCounts.all ?? 0})`
                  : `分類：${CATEGORIES.find(c => c.value === category)?.label} (${categoryCounts[category] ?? 0})`}
              </span>
              <ChevronDown className={`w-3.5 h-3.5 text-amber-400 transition-transform ${categoryPanelOpen ? "rotate-180" : ""}`} />
            </button>

            {/* Merchant filter + clear button grouped tightly */}
            <div className="flex items-center gap-1">
            {merchants.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className={`border-amber-200 hover:bg-amber-50 flex items-center gap-1.5 rounded-full px-3 h-8 shadow-sm transition-all active:scale-95 text-xs ${merchantFilter !== "all" ? "bg-amber-50 text-amber-900 font-bold" : "text-amber-800"}`}
                  >
                    <Store className="w-3.5 h-3.5 text-amber-500" />
                    <span className="font-semibold max-w-[7rem] truncate">
                      {merchantFilter === "all" ? "全部商戶" : merchantFilter}
                    </span>
                    <ChevronDown className="w-3.5 h-3.5 text-amber-400" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-52 bg-white border-amber-100 rounded-xl shadow-xl z-[100]">
                  <DropdownMenuLabel className="text-amber-900 font-bold px-3 py-2">選擇商戶</DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-amber-50" />
                  <DropdownMenuItem
                    onClick={() => { setMerchantFilter("all"); setPage(0); }}
                    className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${merchantFilter === "all" ? "bg-amber-50 text-amber-900 font-bold" : "text-amber-800 hover:bg-amber-50/50"}`}
                  >
                    <Store className="w-4 h-4 text-amber-400" />
                    <span className="text-sm">全部商戶</span>
                    {merchantFilter === "all" && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]" />}
                  </DropdownMenuItem>
                  {merchants.map((name) => (
                    <DropdownMenuItem
                      key={name}
                      onClick={() => { setMerchantFilter(name); setPage(0); }}
                      className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${merchantFilter === name ? "bg-amber-50 text-amber-900 font-bold" : "text-amber-800 hover:bg-amber-50/50"}`}
                    >
                      <Store className="w-4 h-4 text-amber-400" />
                      <span className="text-sm truncate">{name}</span>
                      {merchantFilter === name && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]" />}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {(category !== "all" || merchantFilter !== "all") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setCategory("all"); setMerchantFilter("all"); setPage(0); }}
                className="text-amber-500 hover:text-amber-700 hover:bg-amber-50 font-medium rounded-full px-2 h-7"
                style={{ fontSize: "0.5rem" }}
              >
                清除篩選
              </Button>
            )}
            </div>
          </div>

          {/* Expanded Category Panel - flex-wrap with counts */}
          {categoryPanelOpen && (
            <div className="mt-2 p-3 bg-white border border-amber-100 rounded-xl shadow-sm">
              <div className="flex flex-wrap gap-1.5">
                {CATEGORIES.map((c) => {
                  const count = categoryCounts[c.value] ?? 0;
                  const isSelected = category === c.value;
                  return (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => { setCategory(c.value); setPage(0); setCategoryPanelOpen(false); }}
                      className={`flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-all ${
                        isSelected
                          ? "bg-amber-500 text-white border-amber-500 shadow-sm"
                          : "bg-white text-amber-800 border-amber-200 hover:border-amber-400 hover:bg-amber-50"
                      }`}
                    >
                      <span>{c.emoji}</span>
                      <span>{c.label}</span>
                      <span className={`text-[10px] font-bold ${isSelected ? "text-white/90" : "text-amber-500"}`}>({count})</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Search & Filter */}
        <div className="flex flex-col sm:flex-row gap-2 mb-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="搜尋拍品名稱..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); setShowSuggestions(true); }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              className="pl-8 border-amber-200 focus-visible:ring-amber-400 h-9 text-sm rounded-xl"
            />
            {/* 搜尋自動補全建議 */}
            {showSuggestions && search.length >= 1 && (() => {
              const suggestions = (auctions ?? [])
                .filter(a => a.title.toLowerCase().includes(search.toLowerCase()))
                .slice(0, 6);
              return suggestions.length > 0 ? (
                <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-amber-200 rounded-xl shadow-lg overflow-hidden">
                  {suggestions.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className="w-full text-left px-4 py-2.5 hover:bg-amber-50 flex items-center gap-3 transition-colors"
                      onMouseDown={() => { setSearch(s.title); setShowSuggestions(false); setPage(0); }}
                    >
                      <Search className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span className="text-sm text-amber-900 truncate">{s.title}</span>
                      <span className="ml-auto text-xs text-amber-500 shrink-0">{getCurrencySymbol((s as { currency?: string }).currency ?? 'HKD')}{Number(s.currentPrice).toLocaleString()}</span>
                    </button>
                  ))}
                </div>
              ) : null;
            })()}
          </div>
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-muted-foreground" />
            {(["active", ...(isAuthenticated ? ["myBids" as const] : [])] as const).map((f) => (
              <Button
                key={f}
                size="sm"
                variant={filter === f ? "default" : "outline"}
                className={filter === f ? "gold-gradient text-white border-0" : "border-amber-200 text-amber-700 hover:bg-amber-50"}
                onClick={() => { setFilter(f as typeof filter); setPage(0); }}
              >
                {f === "active" ? "競拍中" : "我的出價"}
              </Button>
            ))}
            {_ss.fbViewEnabled === "true" && (
              <button
                onClick={() => {
                  setViewMode(prev => prev === "fb" ? null : "fb");
                }}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${viewMode === "fb" ? "bg-[#1877f2] text-white border-[#1877f2]" : "border-amber-200 text-amber-700 hover:bg-amber-50"}`}
                title={viewMode === "fb" ? "切換至預設視圖（按拍賣各自設定）" : "切換至全局 FB 視圖"}
              >
                {viewMode === "fb" ? <List className="w-3.5 h-3.5" /> : <LayoutGrid className="w-3.5 h-3.5" />}
                <span className="ml-0.5">{viewMode === "fb" ? "預設" : "FB"}</span>
              </button>
            )}
          </div>
        </div>

        {/* Auction List - Compact Left Image Right Content */}
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="h-20 bg-amber-50 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : paginated.length > 0 ? (
          <div className="flex flex-col gap-[2px]">
            {paginated.map((auction, rowIdx) => {
              const now = Date.now();
              const endMs = new Date(auction.endTime).getTime();
              const isEnded = endMs <= now;
              const isEndingSoon = !isEnded && (endMs - now) <= endingSoonMs;
              const a = auction as { highestBidderName?: string | null; highestBidderId?: number | null; sellerName?: string | null; sellerPhotoUrl?: string | null; bidCount?: number | null; startingPrice?: number | string | null; currency?: string; fbShareTemplate?: string | null };
              const curr = getCurrencySymbol(a.currency ?? 'HKD');
              const startPrice = a.startingPrice ? Number(a.startingPrice) : null;
              const curPrice = Number(auction.currentPrice);
              const totalDuration = auction.createdAt ? endMs - new Date(auction.createdAt).getTime() : null;
              const elapsed = auction.createdAt ? now - new Date(auction.createdAt).getTime() : null;
              const timeProgress = (totalDuration && elapsed && totalDuration > 0)
                ? Math.min(Math.max(elapsed / totalDuration, 0), 1)
                : null;

              const showBannerHere = rowIdx === bannerAfterRow - 1;
              const activeAuctions = (auctions ?? []).filter(x =>
                x.status === 'active' && new Date(x.endTime).getTime() > Date.now()
              );
              const bannerEl = showBannerHere && activeAuctions.length > 0 ? (
                <div key="live-banner" className="marquee-wrapper border border-amber-200 rounded-xl py-2 overflow-hidden" style={{ background: "linear-gradient(135deg, #fef3c7 0%, #fde68a 50%, #fef3c7 100%)" }}>
                  <div className="marquee-track flex" style={{ animationDuration: `${Math.max(10, activeAuctions.length * 5)}s` }}>
                    {[...activeAuctions, ...activeAuctions].map((au, idx) => (
                      <Link
                        key={`${au.id}-${idx}`}
                        href={`/auctions/${au.id}`}
                        className="flex items-center gap-3 px-4 py-1.5 mx-1.5 rounded-xl hover:bg-white/80 hover:shadow-sm transition-all shrink-0 cursor-pointer border border-transparent hover:border-amber-100"
                      >
                        <div className="w-10 h-10 rounded-lg overflow-hidden bg-amber-100 flex items-center justify-center shrink-0 shadow-inner">
                          {au.images && (au.images as Array<{ imageUrl: string }>).length > 0 ? (
                            <img src={(au.images as Array<{ imageUrl: string }>)[0].imageUrl} alt={au.title} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-xl">🪙</span>
                          )}
                        </div>
                        <div className="flex flex-col justify-center">
                          <span className="text-xs font-bold text-amber-900 max-w-[10rem] truncate">{au.title}</span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-amber-600 font-extrabold">
                              {getCurrencySymbol((au as { currency?: string }).currency ?? 'HKD')}{Number(au.currentPrice).toLocaleString()}
                            </span>
                            <div className="flex items-center gap-1 bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-100">
                              <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                              <span className="text-[9px] text-emerald-600 font-bold uppercase tracking-wider">Live</span>
                            </div>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null;

              return (
                <React.Fragment key={auction.id}>
                {(viewMode === "fb" || (viewMode === null && (auction as any).displayMode === "facebook")) ? (
                  <AuctionCardFb
                    auctionId={auction.id}
                    title={auction.title}
                    images={(auction.images as Array<{ imageUrl: string }> | undefined) ?? []}
                    endTime={auction.endTime}
                    createdAt={auction.createdAt}
                    currentPrice={curPrice}
                    currency={a.currency}
                    isEnded={isEnded}
                    bidCount={Number(a.bidCount ?? 0)}
                    highestBidderId={a.highestBidderId}
                    highestBidderName={a.highestBidderName}
                    currentUserId={user?.id}
                    sellerName={a.sellerName}
                    sellerPhotoUrl={a.sellerPhotoUrl ?? null}
                    createdBy={(auction as { createdBy?: number }).createdBy}
                    bidIncrement={Number(auction.bidIncrement ?? 30)}
                    shareTemplate={a.fbShareTemplate}
                    antiSnipeEnabled={(auction as { antiSnipeEnabled?: number }).antiSnipeEnabled}
                    antiSnipeMinutes={(auction as { antiSnipeMinutes?: number }).antiSnipeMinutes}
                    extendMinutes={(auction as { extendMinutes?: number }).extendMinutes}
                    onLinkClick={saveScrollPosition}
                  />
                ) : (
                  <AuctionCard
                    auctionId={auction.id}
                    title={auction.title}
                    imageUrl={(auction.images as Array<{ imageUrl: string }> | undefined)?.[0]?.imageUrl}
                    endTime={auction.endTime}
                    currentPrice={curPrice}
                    startingPrice={Number(auction.startingPrice ?? 0)}
                    currency={a.currency}
                    isEnded={isEnded}
                    isEndingSoon={isEndingSoon}
                    endingSoonText={endingSoonText}
                    currentUserId={user?.id}
                    highestBidderId={a.highestBidderId}
                    highestBidderName={a.highestBidderName}
                    bidCount={Number(a.bidCount ?? 0)}
                    sellerName={a.sellerName}
                    bidIncrement={Number(auction.bidIncrement ?? 30)}
                    shareTemplate={a.fbShareTemplate}
                    antiSnipeEnabled={(auction as { antiSnipeEnabled?: number }).antiSnipeEnabled}
                    antiSnipeMinutes={(auction as { antiSnipeMinutes?: number }).antiSnipeMinutes}
                    extendMinutes={(auction as { extendMinutes?: number }).extendMinutes}
                    createdBy={(auction as { createdBy?: number }).createdBy}
                    timeProgress={timeProgress}
                    hasMyBid={myBidAuctionIds.has(auction.id)}
                    onLinkClick={saveScrollPosition}
                  />
                )}
                {bannerEl}
                {(rowIdx + 1) % 8 === 0 && (
                  <AdSenseAd slot="7230103426" width={320} height={100} className="my-1 rounded-xl overflow-hidden mx-auto" />
                )}
                </React.Fragment>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-16 bg-amber-50/30 rounded-3xl border border-dashed border-amber-200">
            <div className="text-5xl mb-3">🔍</div>
            <h3 className="text-lg font-bold text-amber-900 mb-1">找不到相關拍品</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {search ? "請嘗試其他搜尋關鍵字" : (category !== "all" || merchantFilter !== "all") ? "此篩選條件下暫無拍賣" : "請稍後再來查看"}
            </p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center items-center">
              {(category !== "all" || merchantFilter !== "all") && (
                <button
                  onClick={() => { setCategory("all"); setMerchantFilter("all"); setPage(0); }}
                  className="inline-flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold px-4 py-2 rounded-full transition-colors"
                >
                  查看全部分類
                </button>
              )}
              <Link href="/merchants">
                <span className="inline-flex items-center gap-1.5 bg-white border border-amber-200 hover:border-amber-400 text-amber-800 text-xs font-semibold px-4 py-2 rounded-full transition-colors">
                  <Store className="w-3.5 h-3.5" />
                  前往商戶市集
                </span>
              </Link>
            </div>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-6">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage(p => p - 1)}
              className="border-amber-200"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm text-muted-foreground">
              第 {page + 1} / {totalPages} 頁
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages - 1}
              onClick={() => setPage(p => p + 1)}
              className="border-amber-200"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* Recently ended auction records — collapsible + paginated */}
        {(recentlyEnded ?? []).length > 0 && (() => {
          const allEnded = recentlyEnded as Array<{ id: number; title: string; endTime: string | Date; currency: string | null; sellerName: string | null; coverImage: string | null }>;
          const PAGE = 10;
          const totalPages = Math.ceil(allEnded.length / PAGE);
          const safePage = Math.min(slimBarPage, totalPages - 1);
          const pageItems = allEnded.slice(safePage * PAGE, safePage * PAGE + PAGE);
          return (
            <div className="mt-2 border border-gray-100 rounded overflow-hidden">
              {/* Header / toggle */}
              <button
                type="button"
                onClick={() => setSlimBarOpen(o => !o)}
                className="w-full flex items-center gap-1.5 px-2 h-[26px] bg-gray-100 hover:bg-gray-150 transition-colors border-b border-gray-200"
              >
                <Gavel className="w-3 h-3 text-gray-400 shrink-0" />
                <span className="text-[10px] font-semibold text-gray-500 flex-1 text-left">完結拍賣紀錄</span>
                <span className="text-[9px] text-gray-400">{allEnded.length} 件</span>
                <ChevronDown className={`w-3 h-3 text-gray-400 ml-1 transition-transform duration-150 ${slimBarOpen ? "rotate-180" : ""}`} />
              </button>
              {slimBarOpen && (
                <>
                  <div className="flex flex-col">
                    {pageItems.map(rec => {
                      const rawStr = rec.endTime instanceof Date ? rec.endTime.toISOString() : String(rec.endTime);
                      const dt = (rawStr.endsWith('Z') || rawStr.includes('+'))
                        ? new Date(rawStr)
                        : new Date(rawStr.replace(' ', 'T') + '+08:00');
                      const dowNames = ['日','一','二','三','四','五','六'];
                      const mo = dt.getMonth() + 1;
                      const dy = dt.getDate();
                      const dow = dowNames[dt.getDay()];
                      const hh = String(dt.getHours()).padStart(2, '0');
                      const mm = String(dt.getMinutes()).padStart(2, '0');
                      const endedAt = `星期${dow} ${mo}/${dy} ${hh}:${mm}`;
                      return (
                        <Link
                          key={rec.id}
                          href={`/auctions/${rec.id}`}
                          onClick={saveScrollPosition}
                          className="flex items-center gap-1.5 px-2 h-[30px] bg-gray-50 border-b border-gray-100 last:border-b-0 hover:bg-amber-50 transition-colors w-full"
                        >
                          <div className="w-[25px] h-[25px] rounded-sm overflow-hidden bg-gray-200 shrink-0 flex items-center justify-center">
                            {rec.coverImage
                              ? <img src={rec.coverImage} alt={rec.title} className="w-full h-full object-cover" />
                              : <span style={{ fontSize: '11px' }}>🪙</span>
                            }
                          </div>
                          <div className="flex-1 min-w-0 flex flex-col justify-center">
                            <p className="truncate leading-none text-gray-700 font-medium" style={{ fontSize: '10px' }}>{rec.title}</p>
                            <p className="truncate leading-none text-gray-400 mt-[2px]" style={{ fontSize: '6px' }}>
                              {rec.sellerName ?? "商戶"} · 已結束 · {endedAt}
                            </p>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-1 px-2 py-1 bg-gray-50 border-t border-gray-100">
                      <button
                        type="button"
                        onClick={() => setSlimBarPage(0)}
                        disabled={safePage === 0}
                        className="p-0.5 rounded disabled:opacity-30 hover:bg-gray-200 transition-colors"
                        aria-label="首頁"
                      ><ChevronsLeft className="w-3 h-3 text-gray-500" /></button>
                      <button
                        type="button"
                        onClick={() => setSlimBarPage(p => Math.max(0, p - 1))}
                        disabled={safePage === 0}
                        className="p-0.5 rounded disabled:opacity-30 hover:bg-gray-200 transition-colors"
                        aria-label="上一頁"
                      ><ChevronLeft className="w-3 h-3 text-gray-500" /></button>
                      <span className="text-[9px] text-gray-500 px-1">{safePage + 1} / {totalPages}</span>
                      <button
                        type="button"
                        onClick={() => setSlimBarPage(p => Math.min(totalPages - 1, p + 1))}
                        disabled={safePage === totalPages - 1}
                        className="p-0.5 rounded disabled:opacity-30 hover:bg-gray-200 transition-colors"
                        aria-label="下一頁"
                      ><ChevronRight className="w-3 h-3 text-gray-500" /></button>
                      <button
                        type="button"
                        onClick={() => setSlimBarPage(totalPages - 1)}
                        disabled={safePage === totalPages - 1}
                        className="p-0.5 rounded disabled:opacity-30 hover:bg-gray-200 transition-colors"
                        aria-label="尾頁"
                      ><ChevronsRight className="w-3 h-3 text-gray-500" /></button>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })()}
      </div>
      
      {/* ── Section 4: Brand Intro (Bottom) ── */}
      <section className="py-6 hero-bg border-t border-amber-100">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center">
            <div className="flex justify-center gap-3 md:gap-4 flex-wrap">
              {[
                { emoji: "🛡️", icon: Shield, title: "安全可信" },
                { emoji: "📈", icon: TrendingUp, title: "公開競價" },
                { emoji: "🏆", icon: Award, title: "品質保證" },
                { emoji: "🪙", icon: Coins, title: "多元品類" },
              ].map((f) => (
                <div key={f.title} className="flex flex-col items-center gap-0.5">
                  <span className="text-xl">{f.emoji}</span>
                  <span className="text-[10px] font-bold text-amber-900 text-center">{f.title}</span>
                </div>
              ))}
            </div>

            {!isAuthenticated && (
              <div className="bg-white/80 backdrop-blur rounded-3xl p-6 border border-amber-200 shadow-xl inline-block px-10 mt-6">
                <h3 className="text-lg font-bold mb-3 text-amber-900">準備好開始您的收藏之旅了嗎？</h3>
                <a href="/login">
                  <Button size="lg" className="gold-gradient text-white border-0 shadow-lg hover:opacity-90 px-12 h-12 rounded-full font-bold">
                    立即免費註冊
                  </Button>
                </a>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-amber-950 text-amber-100/60 py-4 pb-24 border-t border-amber-900/50">
        <div className="container flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
          <p>© 2026 hongxcollections.com · 專業錢幣拍賣平台</p>
          <div className="flex gap-4 font-bold">
            <Link href="/" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="hover:text-amber-400 transition-colors">首頁</Link>
            <Link href="/merchant-apply" className="hover:text-amber-400 transition-colors">商戶申請流程</Link>
            <Link href="/about" className="hover:text-amber-400 transition-colors">關於我們</Link>
            <Link href="/terms" className="hover:text-amber-400 transition-colors">服務條款</Link>
            <Link href="/privacy" className="hover:text-amber-400 transition-colors">隱私政策</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
