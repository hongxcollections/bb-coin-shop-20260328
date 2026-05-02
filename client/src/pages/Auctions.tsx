import { useState, useEffect, useRef } from "react";
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
import { Clock, Search, ChevronLeft, ChevronRight, SlidersHorizontal, ChevronDown, Shield, TrendingUp, Award, Coins, Store, Users, LogIn } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { getCurrencySymbol } from "./AdminAuctions";
import { parseCategories } from "@/lib/categories";
import { ShareMenu } from "@/components/ShareMenu";
import Header from "@/components/Header";

function AuctionImageOverlay({ endTime, sellerName }: { endTime: Date | string; sellerName?: string | null }) {
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
  if (!txt && !sellerName) return null;
  return (
    <div className="absolute bottom-0 left-0 right-0 bg-black/30 backdrop-blur-sm px-1.5 py-1 flex flex-col gap-0.5">
      {sellerName && <div className="text-[10px] text-white/85 font-medium leading-none truncate">{sellerName}</div>}
      {txt && (
        urgent
          ? <div className="flex items-center gap-0.5 text-[10px] font-black leading-none animate-pulse bg-red-600 text-white px-1 py-0.5 rounded self-start">
              <Clock className="w-2.5 h-2.5 shrink-0" />{txt}
            </div>
          : <div className="flex items-center gap-0.5 text-[10px] font-bold leading-none text-white/90">
              <Clock className="w-2.5 h-2.5 shrink-0" />{txt}
            </div>
      )}
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
  const [page, setPage] = useState(() => {
    // Only restore page if we also have a saved scroll position (i.e. returning from detail)
    const hasScroll = sessionStorage.getItem("auctions-scroll");
    const savedPage = sessionStorage.getItem("auctions-page");
    return (hasScroll && savedPage) ? parseInt(savedPage, 10) : 0;
  });
  const [showSuggestions, setShowSuggestions] = useState(false);
  const scrollRestoredRef = useRef(false);

  const saveScrollPosition = () => {
    sessionStorage.setItem("auctions-scroll", String(window.scrollY));
    sessionStorage.setItem("auctions-page", String(page));
  };

  const { data: auctions, isLoading } = trpc.auctions.list.useQuery(
    { limit: 100, offset: 0, category: category === "all" ? undefined : category },
    {
      refetchInterval: 5000, // 每 5 秒自動輪詢，確保價格和最高出價者即時更新
      staleTime: 3000, // 3 秒內視為新鮮資料
    }
  );

  // 查詢當前用戶曾出價的拍賣 ID
  const { data: myBidsData } = trpc.auctions.myBids.useQuery(undefined, {
    enabled: isAuthenticated && filter === "myBids",
    refetchInterval: 5000,
    staleTime: 3000,
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
    if (filter === "myBids") {
      return matchSearch && isActive && matchMerchant && myBidAuctionIds.has(a.id);
    }
    return matchSearch && isActive && matchMerchant;
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

  // 找出所有活躍拍賣中出價最高的項目 ID
  const topBidAuctionId = (auctions ?? [])
    .filter(a => new Date(a.endTime).getTime() > Date.now())
    .reduce<{ id: number; price: number } | null>((top, a) => {
      const price = Number(a.currentPrice);
      return !top || price > top.price ? { id: a.id, price } : top;
    }, null)?.id ?? null;

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Navigation */}
      <Header />
      <div className="container py-3">
        {/* Header with gold gradient bar */}
        <div className="mb-2 flex items-center gap-2">
          <div className="h-7 w-1 rounded-full bg-gradient-to-b from-amber-400 to-orange-500 shrink-0" />
          <div className="flex items-center gap-2 bg-blue-600 text-white px-3 py-1.5 rounded-lg">
            <h1 className="text-xl font-bold">所有拍賣</h1>
            <p className="text-sm opacity-90">(共 {filtered.length} 件拍品)</p>
          </div>
        </div>

        {/* ── 統計格 (icons + 漸層) ── */}
        <div className="grid grid-cols-3 gap-2 mb-3 max-w-md">
          {(() => {
            const activeCount = (auctions ?? []).filter(a => a.status === 'active' && new Date(a.endTime).getTime() > Date.now()).length;
            const endedCount = (auctions ?? []).filter(a => a.status === 'ended' || new Date(a.endTime).getTime() <= Date.now()).length;
            return [
              { label: "活躍拍賣", value: activeCount, suffix: "件", icon: "🔨", color: "from-amber-400 to-orange-500" },
              { label: "已成交", value: endedCount, suffix: "件", icon: "✅", color: "from-emerald-400 to-teal-500" },
              { label: "錢幣品類", value: "100+", suffix: "", icon: "🪙", color: "from-purple-400 to-indigo-500" },
            ].map((s) => (
              <div key={s.label} className="p-2.5 text-center relative overflow-hidden rounded-xl border border-amber-100 bg-white">
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

        {/* ── 分類快捷 pill 按鈕 ── */}
        {CATEGORIES.length > 1 && (
          <div className="mb-2">
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide px-0.5">
              {CATEGORIES.map((c) => (
                <button
                  key={c.value}
                  onClick={() => { setCategory(c.value); setPage(0); }}
                  className={`shrink-0 flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-all ${
                    category === c.value
                      ? "bg-amber-500 text-white border-amber-500 shadow-sm"
                      : "bg-white/80 text-amber-800 border-amber-200 hover:border-amber-400 hover:bg-amber-50"
                  }`}
                >
                  <span>{c.emoji}</span>
                  <span>{c.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

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

        {/* Category Selector - Using Dropdown Menu to save space */}
        <div className="flex items-center gap-2 mb-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="outline" 
                className="border-amber-200 text-amber-800 hover:bg-amber-50 flex items-center gap-1.5 rounded-full px-3 h-8 shadow-sm transition-all active:scale-95 text-xs"
              >
                <span className="text-sm leading-none">💰</span>
                <span className="font-semibold">
                  {category === "all" ? "全部商品分類" : `分類：${CATEGORIES.find(c => c.value === category)?.label}`}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-amber-400" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 bg-white border-amber-100 rounded-xl shadow-xl z-[100]">
              <DropdownMenuLabel className="text-amber-900 font-bold px-3 py-2">選擇商品分類</DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-amber-50" />
              {CATEGORIES.map((c) => (
                <DropdownMenuItem
                  key={c.value}
                  onClick={() => { setCategory(c.value); setPage(0); }}
                  className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${
                    category === c.value ? "bg-amber-50 text-amber-900 font-bold" : "text-amber-800 hover:bg-amber-50/50"
                  }`}
                >
                  <span className="text-xl">{c.emoji}</span>
                  <span className="text-sm">{c.label}</span>
                  {category === c.value && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          
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
          </div>
        </div>

        {/* ── Marquee Ticker ── Strictly show only active auctions with future end time */}
        {!isLoading && (auctions ?? []).filter(a => a.status === 'active' && new Date(a.endTime).getTime() > Date.now()).length > 0 && (
          <div className="marquee-wrapper mb-4 border border-amber-200 rounded-xl py-2 overflow-hidden" style={{ background: "linear-gradient(135deg, #fef3c7 0%, #fde68a 50%, #fef3c7 100%)" }}>
            {(() => {
              const activeAuctions = (auctions ?? []).filter(a =>
                a.status === 'active' && new Date(a.endTime).getTime() > Date.now()
              );
              const duration = `${Math.max(10, activeAuctions.length * 5)}s`;
              return (
            <div className="marquee-track flex" style={{ animationDuration: duration }}>
              {[...activeAuctions, ...activeAuctions].map((auction, idx) => (
                  <Link
                    key={`${auction.id}-${idx}`}
                    href={`/auctions/${auction.id}`}
                    className="flex items-center gap-3 px-4 py-1.5 mx-1.5 rounded-xl hover:bg-white/80 hover:shadow-sm transition-all shrink-0 cursor-pointer border border-transparent hover:border-amber-100"
                  >
                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-amber-100 flex items-center justify-center shrink-0 shadow-inner">
                      {auction.images && (auction.images as Array<{ imageUrl: string }>).length > 0 ? (
                        <img
                          src={(auction.images as Array<{ imageUrl: string }>)[0].imageUrl}
                          alt={auction.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-xl">🪙</span>
                      )}
                    </div>
                    <div className="flex flex-col justify-center">
                      <span className="text-xs font-bold text-amber-900 max-w-[10rem] truncate">{auction.title}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-amber-600 font-extrabold">
                          {getCurrencySymbol((auction as { currency?: string }).currency ?? 'HKD')}{Number(auction.currentPrice).toLocaleString()}
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
              );
            })()}
          </div>
        )}

        {/* Auction List - Compact Left Image Right Content */}
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="h-20 bg-amber-50 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : paginated.length > 0 ? (
          <div className="space-y-3">
            {paginated.map((auction) => {
              const now = Date.now();
              const endMs = new Date(auction.endTime).getTime();
              const isEnded = endMs <= now;
              const isEndingSoon = !isEnded && (endMs - now) <= endingSoonMs;
              const a = auction as { highestBidderName?: string | null; highestBidderId?: number | null; sellerName?: string | null; bidCount?: number | null; startingPrice?: number | string | null; currency?: string; fbShareTemplate?: string | null };
              const curr = getCurrencySymbol(a.currency ?? 'HKD');
              const startPrice = a.startingPrice ? Number(a.startingPrice) : null;
              const curPrice = Number(auction.currentPrice);
              const totalDuration = auction.createdAt ? endMs - new Date(auction.createdAt).getTime() : null;
              const elapsed = auction.createdAt ? now - new Date(auction.createdAt).getTime() : null;
              const timeProgress = (totalDuration && elapsed && totalDuration > 0)
                ? Math.min(Math.max(elapsed / totalDuration, 0), 1)
                : null;

              return (
                <Link key={auction.id} href={`/auctions/${auction.id}`} onClick={saveScrollPosition}>
                  <div className={`auction-list-item flex gap-3 p-3 rounded-xl cursor-pointer transition-all border ${isEndingSoon ? "border-orange-200 bg-orange-50/40 hover:border-orange-300" : "border-amber-100 hover:border-amber-300 hover:bg-amber-50/50"}`}>
                    {/* Left: Image */}
                    <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-amber-100 flex items-center justify-center shrink-0 shadow-sm">
                      {auction.images && (auction.images as Array<{ imageUrl: string }>).length > 0 ? (
                        <img
                          src={(auction.images as Array<{ imageUrl: string }>)[0].imageUrl}
                          alt={auction.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-3xl">🪙</span>
                      )}
                      <AuctionImageOverlay
                        endTime={auction.endTime}
                        sellerName={a.sellerName}
                      />
                    </div>

                    {/* Right: Content */}
                    <div className="flex-1 flex flex-col justify-between min-w-0">
                      {/* Title & Badges */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-sm line-clamp-1 text-amber-900">{auction.title}</h3>
                          {/* 商戶名標籤 */}
                          {a.sellerName && (
                            <div className="flex items-center gap-1 mt-0.5">
                              <Store className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                              <span className="text-[10px] text-amber-600 truncate">{a.sellerName}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          {isEndingSoon && (
                            <Badge className="bg-orange-500 text-white text-[9px] px-1.5 py-0.5 animate-pulse">
                              {endingSoonText}
                            </Badge>
                          )}
                          <Badge className={`text-[9px] px-1.5 py-0.5 ${!isEnded ? "bg-emerald-500 text-white" : "bg-gray-400 text-white"}`}>
                            {!isEnded ? "競拍中" : "已結束"}
                          </Badge>
                        </div>
                      </div>

                      {/* Price row */}
                      <div className="mt-1 flex items-end justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-muted-foreground">目前出價</span>
                            {(() => {
                              if (a.highestBidderId && user?.id && a.highestBidderId === user.id) {
                                return <span className="text-[9px] text-emerald-600 font-bold">(我本人✓)</span>;
                              } else if (a.highestBidderName) {
                                return <span className="text-[9px] text-red-500 font-semibold">({a.highestBidderName})</span>;
                              } else if (!a.highestBidderId) {
                                return <span className="text-[9px] text-gray-400">(未有出價)</span>;
                              }
                              return null;
                            })()}
                          </div>
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-sm font-bold text-amber-600">{curr}{curPrice.toLocaleString()}</span>
                            {/* 起拍價對比 */}
                            {startPrice && startPrice !== curPrice && (
                              <span className="text-[10px] text-gray-400 line-through">起{curr}{startPrice.toLocaleString()}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {/* 出價人數 */}
                          {(a.bidCount ?? 0) > 0 && (
                            <div className="flex items-center gap-0.5 text-[10px] text-amber-700 bg-amber-50 border border-amber-100 px-1.5 py-0.5 rounded-full">
                              <Users className="w-2.5 h-2.5" />
                              <span className="font-semibold">{a.bidCount}</span>
                            </div>
                          )}
                          <div onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                            <ShareMenu
                              auctionId={auction.id}
                              title={auction.title}
                              latestBid={curPrice}
                              currency={a.currency}
                              endTime={auction.endTime}
                              shareTemplate={a.fbShareTemplate}
                            />
                          </div>
                        </div>
                      </div>

                      {/* 倒計時進度條 */}
                      {timeProgress !== null && !isEnded && (
                        <div className="mt-1.5">
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
                </Link>
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
            <Link href="/" className="hover:text-amber-400 transition-colors">首頁</Link>
            <a href="#" className="hover:text-amber-400 transition-colors">服務條款</a>
            <a href="#" className="hover:text-amber-400 transition-colors">隱私政策</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
