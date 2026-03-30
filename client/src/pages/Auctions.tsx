import { useState, useEffect } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Clock, Search, ChevronLeft, ChevronRight, SlidersHorizontal } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { getCurrencySymbol } from "./AdminAuctions";

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

const PAGE_SIZE = 12;

export default function Auctions() {
  const { user, isAuthenticated } = useAuth();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "ended">("all");
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
    { limit: 100, offset: 0, category: category === "all" ? undefined : category }
  );

  const filtered = (auctions ?? []).filter((a) => {
    const matchSearch = !search || a.title.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "all" || a.status === filter;
    return matchSearch && matchFilter;
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
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="nav-glass sticky top-0 z-50">
        <div className="container flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2 font-bold text-xl">
            <span className="text-2xl">💰</span>
            <span className="gold-gradient-text">大BB錢幣店</span>
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="/auctions">
              <Button variant="ghost" size="sm" className="text-amber-700 hover:text-amber-900 hover:bg-amber-50">所有拍賣</Button>
            </Link>
            {isAuthenticated ? (
              <>
                {user?.role === "admin" && (
                  <Link href="/admin">
                    <Button variant="ghost" size="sm" className="text-amber-700 hover:text-amber-900 hover:bg-amber-50">管理後台</Button>
                  </Link>
                )}
                <Link href="/profile">
                  <Button variant="outline" size="sm" className="border-amber-300 text-amber-800 hover:bg-amber-50">{user?.name ?? "個人資料"}</Button>
                </Link>
              </>
            ) : (
              <a href={getLoginUrl()}>
                <Button size="sm" className="gold-gradient text-white border-0 shadow-md hover:opacity-90">立即登入</Button>
              </a>
            )}
          </div>
        </div>
      </nav>

      <div className="container py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-1">所有拍賣</h1>
          <p className="text-muted-foreground">共 {filtered.length} 件拍品</p>
        </div>

        {/* Category tabs */}
        <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1 scrollbar-hide">
          {CATEGORIES.map((c) => (
            <button
              key={c.value}
              onClick={() => { setCategory(c.value); setPage(0); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                category === c.value
                  ? "gold-gradient text-white shadow-sm"
                  : "bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200"
              }`}
            >
              <span>{c.emoji}</span>
              <span>{c.label}</span>
            </button>
          ))}
        </div>

        {/* Search & Filter */}
        <div className="flex flex-col sm:flex-row gap-3 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="搜尋拍品名稱..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); setShowSuggestions(true); }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              className="pl-9 border-amber-200 focus-visible:ring-amber-400"
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
            {(["all", "active", "ended"] as const).map((f) => (
              <Button
                key={f}
                size="sm"
                variant={filter === f ? "default" : "outline"}
                className={filter === f ? "gold-gradient text-white border-0" : "border-amber-200 text-amber-700 hover:bg-amber-50"}
                onClick={() => { setFilter(f); setPage(0); }}
              >
                {f === "all" ? "全部" : f === "active" ? "競拍中" : "已結束"}
              </Button>
            ))}
          </div>
        </div>

        {/* ── Marquee Ticker ── */}
        {!isLoading && (auctions ?? []).length > 0 && (
          <div className="marquee-wrapper mb-6 border border-amber-100 rounded-xl bg-amber-50/60 py-2">
            <div className="marquee-track">
              {/* 複製一份以實現無縮循環 */}
              {[...(auctions ?? []), ...(auctions ?? [])].map((auction, idx) => (
                <Link
                  key={`${auction.id}-${idx}`}
                  href={`/auctions/${auction.id}`}
                  className="flex items-center gap-2 px-4 py-1 mx-1 rounded-lg hover:bg-amber-100 transition-colors shrink-0 cursor-pointer"
                >
                  <div className="w-9 h-9 rounded-md overflow-hidden bg-amber-100 flex items-center justify-center shrink-0">
                    {auction.images && (auction.images as Array<{ imageUrl: string }>).length > 0 ? (
                      <img
                        src={(auction.images as Array<{ imageUrl: string }>)[0].imageUrl}
                        alt={auction.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-lg">🪙</span>
                    )}
                  </div>
                  <div className="flex flex-col leading-tight">
                    <span className="text-xs font-medium text-amber-900 max-w-[8rem] truncate">{auction.title}</span>
                    <span className="text-xs text-amber-600 font-semibold">
                      {getCurrencySymbol((auction as { currency?: string }).currency ?? 'HKD')}{Number(auction.currentPrice).toLocaleString()}
                    </span>
                  </div>
                  <span className={`ml-1 w-1.5 h-1.5 rounded-full shrink-0 ${auction.status === 'active' ? 'bg-emerald-400' : 'bg-gray-300'}`} />
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Auction Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-64 bg-amber-50 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : paginated.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {paginated.map((auction) => (
              <Link key={auction.id} href={`/auctions/${auction.id}`}>
                <Card className="auction-card overflow-hidden border border-amber-100 hover:border-amber-300 cursor-pointer h-full">
                  <div className="h-44 coin-placeholder flex items-center justify-center relative overflow-hidden">
                    {auction.images && (auction.images as Array<{ imageUrl: string }>).length > 0 ? (
                      <img
                        src={(auction.images as Array<{ imageUrl: string }>)[0].imageUrl}
                        alt={auction.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-5xl">🪙</span>
                    )}
                    {/* 狀態 Badge */}
                    <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
                      {(() => {
                        const now = Date.now();
                        const endMs = new Date(auction.endTime).getTime();
                        const isEnded = endMs <= now;
                        const isEndingSoon = !isEnded && (endMs - now) <= 3600000;
                        return (
                          <>
                            {isEndingSoon && (
                              <Badge className="bg-orange-500 text-white text-[10px] px-1.5 py-0.5 animate-pulse">
                                ⏰ 即將結束
                              </Badge>
                            )}
                            <Badge className={!isEnded ? "bg-emerald-500 text-white" : "bg-gray-400 text-white"}>
                              {!isEnded ? "競拍中" : "已結束"}
                            </Badge>
                          </>
                        );
                      })()}
                    </div>
                    {/* 出價最高 Badge */}
                    {auction.id === topBidAuctionId && (
                      <div className="absolute top-2 left-2">
                        <Badge className="bg-amber-500 text-white text-[10px] px-1.5 py-0.5 shadow-md">
                          🔥 出價最高
                        </Badge>
                      </div>
                    )}
                  </div>
                  <CardContent className="p-4">
                    <h3 className="font-semibold text-sm mb-2 line-clamp-2">{auction.title}</h3>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          當前出價
                          {(auction as { highestBidderName?: string | null; highestBidderId?: number | null }).highestBidderName ? (
                            <span className="text-[9px] text-red-500 font-semibold">({(auction as { highestBidderName?: string | null }).highestBidderName})</span>
                          ) : !(auction as { highestBidderId?: number | null }).highestBidderId ? (
                            <span className="text-[9px] text-black font-normal">(未有出價)</span>
                          ) : null}
                        </div>
                        <div className="text-base font-bold text-amber-600 price-tag">
                          {getCurrencySymbol((auction as { currency?: string }).currency ?? 'HKD')}{Number(auction.currentPrice).toLocaleString()}
                          <span className="text-xs font-normal text-amber-500 ml-0.5">{(auction as { currency?: string }).currency ?? 'HKD'}</span>
                        </div>
                      </div>
                      {new Date(auction.endTime).getTime() > Date.now() && (
                        <CountdownTimer endTime={new Date(auction.endTime)} />
                      )}
                    </div>
                  </CardContent>
                </Card>
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
          <div className="flex items-center justify-center gap-3 mt-10">
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
    </div>
  );
}
