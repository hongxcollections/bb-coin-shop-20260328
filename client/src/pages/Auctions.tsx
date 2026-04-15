import { useState, useEffect } from "react";
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
import { Clock, Search, ChevronLeft, ChevronRight, SlidersHorizontal, ChevronDown, Filter, Shield, TrendingUp, Award, Coins } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { getCurrencySymbol } from "./AdminAuctions";
import { ShareMenu } from "@/components/ShareMenu";
import Header from "@/components/Header";

function CountdownTimer({ endTime }: { endTime: Date }) {
  const [timeLeft, setTimeLeft] = useState("");
  const [status, setStatus] = useState<"active" | "ending" | "ended">("active");

  useEffect(() => {
    function update() {
      const now = new Date();
      const diff = new Date(endTime).getTime() - now.getTime();
      if (diff <= 0) { setTimeLeft("已結束"); setStatus("ended"); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setStatus(h < 1 ? "ending" : "active");
      setTimeLeft(h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`);
    }
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [endTime]);

  const cls = status === "ended" ? "countdown-badge countdown-ended" : status === "ending" ? "countdown-badge countdown-ending" : "countdown-badge countdown-active";
  return <span className={cls}><Clock className="w-3 h-3" />{timeLeft}</span>;
}

const PAGE_SIZE = 20;

export default function Auctions() {
  const { user, isAuthenticated } = useAuth();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"active" | "myBids">("active");
  const [category, setCategory] = useState("all");
  const [page, setPage] = useState(0);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const CATEGORIES = [
    { value: "all", label: "全部", emoji: "🪙" },
    { value: "古幣", label: "古幣", emoji: "🏺" },
    { value: "紀念幣", label: "紀念幣", emoji: "🏅" },
    { value: "外幣", label: "外幣", emoji: "🌍" },
    { value: "銀幣", label: "銀幣", emoji: "⚪" },
    { value: "金幣", label: "金幣", emoji: "🟡" },
    { value: "其他", label: "其他", emoji: "✨" },
  ];

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
  const _endingSoonRaw = parseInt((siteSettings as Record<string, string> | undefined)?.endingSoonMinutes ?? '30', 10);
  const endingSoonMs = (isNaN(_endingSoonRaw) || _endingSoonRaw < 1 ? 30 : _endingSoonRaw) * 60 * 1000;

  const filtered = (auctions ?? []).filter((a) => {
    const matchSearch = !search || a.title.toLowerCase().includes(search.toLowerCase());
    const isActive = a.status === "active" && new Date(a.endTime).getTime() > Date.now();
    if (filter === "myBids") {
      return matchSearch && isActive && myBidAuctionIds.has(a.id);
    }
    // filter === "active"
    return matchSearch && isActive;
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
        {/* Header */}
        <div className="mb-2 flex items-baseline gap-2">
          <h1 className="text-xl font-bold">所有拍賣</h1>
          <p className="text-sm text-muted-foreground">(共 {filtered.length} 件拍品)</p>
        </div>

        {/* Category Selector - Using Dropdown Menu to save space */}
        <div className="flex items-center gap-2 mb-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="outline" 
                className="border-amber-200 text-amber-800 hover:bg-amber-50 flex items-center gap-1.5 rounded-full px-3 h-8 shadow-sm transition-all active:scale-95 text-xs"
              >
                <Filter className="w-3.5 h-3.5 text-amber-500" />
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
          
          {category !== "all" && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => { setCategory("all"); setPage(0); }}
              className="text-amber-600 hover:text-amber-800 hover:bg-amber-50 text-xs font-medium rounded-full"
            >
              清除篩選
            </Button>
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
                {f === "active" ? "競拍中" : "我曾出價"}
              </Button>
            ))}
          </div>
        </div>

        {/* ── Marquee Ticker ── Strictly show only active auctions with future end time */}
        {!isLoading && (auctions ?? []).filter(a => a.status === 'active' && new Date(a.endTime).getTime() > Date.now()).length > 0 && (
          <div className="marquee-wrapper mb-4 border border-amber-100 rounded-xl bg-amber-50/60 py-2 overflow-hidden">
            <div className="marquee-track flex">
              {(() => {
                const activeAuctions = (auctions ?? []).filter(a => 
                  a.status === 'active' && new Date(a.endTime).getTime() > Date.now()
                );
                // Duplicate items for seamless infinite scroll
                return [...activeAuctions, ...activeAuctions].map((auction, idx) => (
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
                ));
              })()}
            </div>
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
          <div className="space-y-4">
            {paginated.map((auction) => (
              <Link key={auction.id} href={`/auctions/${auction.id}`}>
                <div className="auction-list-item flex gap-3 p-3 border border-amber-100 rounded-lg hover:border-amber-300 hover:bg-amber-50/50 cursor-pointer transition-all">
                  {/* Left: Image */}
                  <div className="w-20 h-20 rounded-lg overflow-hidden bg-amber-100 flex items-center justify-center shrink-0 shadow-sm">
                    {auction.images && (auction.images as Array<{ imageUrl: string }>).length > 0 ? (
                      <img
                        src={(auction.images as Array<{ imageUrl: string }>)[0].imageUrl}
                        alt={auction.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-3xl">🪙</span>
                    )}
                  </div>

                  {/* Right: Content */}
                  <div className="flex-1 flex flex-col justify-between min-w-0">
                    {/* Title & Status */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm line-clamp-1 text-amber-900">{auction.title}</h3>
                        <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                          {(() => {
                            // Extract description from description field or show category
                            const desc = (auction as { description?: string }).description;
                            return desc ? desc.substring(0, 60) : `分類：${category !== "all" ? CATEGORIES.find(c => c.value === category)?.label : "未分類"}`;
                          })()}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        {(() => {
                          const now = Date.now();
                          const endMs = new Date(auction.endTime).getTime();
                          const isEnded = endMs <= now;
                          const isEndingSoon = !isEnded && (endMs - now) <= endingSoonMs;
                          return (
                            <>
                              {isEndingSoon && (
                                <Badge className="bg-orange-500 text-white text-[9px] px-1.5 py-0.5 animate-pulse">
                                  ⏰ 即將結束
                                </Badge>
                              )}
                              <Badge className={`text-[9px] px-1.5 py-0.5 ${!isEnded ? "bg-emerald-500 text-white" : "bg-gray-400 text-white"}`}>
                                {!isEnded ? "競拍中" : "已結束"}
                              </Badge>
                            </>
                          );
                        })()}
                      </div>
                    </div>

                    {/* Price & Bidder & Timer */}
                    <div className="flex items-center justify-between gap-2 mt-1">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          目前出價
                          {(auction as { highestBidderName?: string | null; highestBidderId?: number | null }).highestBidderName ? (
                            <span className="text-[9px] text-red-500 font-semibold">({(auction as { highestBidderName?: string | null }).highestBidderName})</span>
                          ) : !(auction as { highestBidderId?: number | null }).highestBidderId ? (
                            <span className="text-[9px] text-gray-500 font-normal">(未有出價)</span>
                          ) : null}
                        </div>
                        <div className="text-sm font-bold text-amber-600">
                          {getCurrencySymbol((auction as { currency?: string }).currency ?? 'HKD')}{Number(auction.currentPrice).toLocaleString()}
                        </div>
                      </div>
                      <div className="shrink-0 flex items-center gap-1.5">
                        {new Date(auction.endTime).getTime() > Date.now() && (
                          <CountdownTimer endTime={new Date(auction.endTime)} />
                        )}
                        <div onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                          <ShareMenu
                            auctionId={auction.id}
                            title={auction.title}
                            latestBid={Number(auction.currentPrice)}
                            currency={(auction as { currency?: string }).currency}
                            endTime={auction.endTime}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-24 text-muted-foreground">
            <div className="text-5xl mb-4">🔍</div>
            <p className="text-lg font-medium">找不到相關拍品</p>
            <p className="text-sm mt-1">請嘗試其他搜尋關鍵字</p>
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
          <p>© 2026 大BB錢幣店 · 專業錢幣拍賣平台 · 誠信鑑定</p>
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
