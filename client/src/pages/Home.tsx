import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";
import { Link } from "wouter";
import { useState, useEffect } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { 
  Clock, 
  Shield, 
  TrendingUp, 
  Award, 
  ChevronRight, 
  Coins, 
  Search, 
  SlidersHorizontal, 
  Filter, 
  ChevronDown,
  ChevronLeft
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/ThemeToggle";
import { getCurrencySymbol } from "./AdminAuctions";

// Version: 2026-04-06-V4-Detail-Optimized
console.log("MANUS_VERSION_CHECK_V4");

function CountdownTimer({ endTime }: { endTime: Date }) {
  const [timeLeft, setTimeLeft] = useState("");
  const [status, setStatus] = useState<"active" | "ending" | "ended">("active");

  useEffect(() => {
    function update() {
      const now = new Date();
      const diff = new Date(endTime).getTime() - now.getTime();
      if (diff <= 0) {
        setTimeLeft("已結束");
        setStatus("ended");
        return;
      }
      const hours = Math.floor(diff / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      if (hours < 1) setStatus("ending");
      else setStatus("active");
      setTimeLeft(hours > 0 ? `${hours}h ${minutes}m ${seconds}s` : `${minutes}m ${seconds}s`);
    }
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [endTime]);

  const cls = status === "ended" ? "countdown-badge countdown-ended" : status === "ending" ? "countdown-badge countdown-ending" : "countdown-badge countdown-active";
  return <span className={cls}><Clock className="w-3 h-3" />{timeLeft}</span>;
}

const PAGE_SIZE = 12;

const CATEGORIES = [
  { value: "all", label: "全部", emoji: "🪙" },
  { value: "古幣", label: "古幣", emoji: "🏺" },
  { value: "紀念幣", label: "紀念幣", emoji: "🏅" },
  { value: "外幣", label: "外幣", emoji: "🌍" },
  { value: "銀幣", label: "銀幣", emoji: "⚪" },
  { value: "金幣", label: "金幣", emoji: "🟡" },
  { value: "其他", label: "其他", emoji: "✨" },
];

export default function Home() {
  const { user, isAuthenticated } = useAuth();
  
  // Auctions Logic
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "ended">("all");
  const [category, setCategory] = useState("all");
  const [page, setPage] = useState(0);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const { data: auctions, isLoading } = trpc.auctions.list.useQuery(
    { limit: 100, offset: 0, category: category === "all" ? undefined : category }
  );

  const activeCount = (auctions ?? []).filter(a => a.status === "active" && new Date(a.endTime).getTime() > Date.now()).length;

  const filtered = (auctions ?? []).filter((a) => {
    const matchSearch = !search || a.title.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "all" || a.status === filter;
    return matchSearch && matchFilter;
  });

  const sorted = [...filtered].sort((a, b) => {
    const aEnded = new Date(a.endTime).getTime() <= Date.now() || a.status === 'ended';
    const bEnded = new Date(b.endTime).getTime() <= Date.now() || b.status === 'ended';
    if (aEnded !== bEnded) return aEnded ? 1 : -1;
    return 0;
  });

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paginated = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const stats = [
    { label: "活躍拍賣", value: activeCount, suffix: "件" },
    { label: "已成交", value: auctions?.filter(a => a.status === "ended" || new Date(a.endTime).getTime() <= Date.now()).length ?? 0, suffix: "件" },
    { label: "錢幣品類", value: "100+", suffix: "" },
  ];

  const features = [
    { emoji: "🛡️", icon: Shield, title: "安全可信", desc: "每件拍品均經專業鑑定，確保真品保障" },
    { emoji: "📈", icon: TrendingUp, title: "公開競價", desc: "透明出價記錄，公平公正的競拍環境" },
    { emoji: "🏆", icon: Award, title: "品質保證", desc: "嚴格篩選優質錢幣，提供完整收藏資訊" },
    { emoji: "🪙", icon: Coins, title: "多元品類", desc: "古幣、紀念幣、外幣，滿足各類收藏需求" },
  ];

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
            {isAuthenticated ? (
              <>
                {user?.role === "admin" && (
                  <Link href="/admin">
                    <Button variant="ghost" size="sm" className="text-amber-700 hover:text-amber-900 hover:bg-amber-50">
                      管理後台
                    </Button>
                  </Link>
                )}
                <Link href="/profile">
                  <Button variant="outline" size="sm" className="border-amber-300 text-amber-800 hover:bg-amber-50">
                    {user?.name ?? "個人資料"}
                  </Button>
                </Link>
              </>
            ) : (
              <a href={getLoginUrl()}>
                <Button size="sm" className="gold-gradient text-white border-0 shadow-md hover:opacity-90">
                  立即登入
                </Button>
              </a>
            )}
          </div>
        </div>
      </nav>

      {/* ── Section 1: Stats (Top) ── */}
      <section className="pt-8 pb-4 bg-amber-50/30">
        <div className="container">
          <div className="grid grid-cols-3 gap-4 max-w-xl mx-auto">
            {stats.map((s) => (
              <div key={s.label} className="bg-white/80 backdrop-blur rounded-2xl p-4 border border-amber-100 shadow-sm text-center">
                <div className="text-2xl md:text-3xl font-extrabold text-amber-700">{s.value}{s.suffix}</div>
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Section 2: Marquee Ticker ── */}
      <section className="py-4">
        <div className="container">
          {!isLoading && (auctions ?? []).filter(a => a.status === 'active' && new Date(a.endTime).getTime() > Date.now()).length > 0 && (
            <div className="marquee-wrapper border border-amber-100 rounded-2xl bg-white py-3 overflow-hidden shadow-sm">
              <div className="marquee-track flex" style={{ animationDuration: '15s' }}>
                {(() => {
                  const activeAuctions = (auctions ?? []).filter(a => 
                    a.status === 'active' && new Date(a.endTime).getTime() > Date.now()
                  );
                  return [...activeAuctions, ...activeAuctions].map((auction, idx) => (
                    <Link
                      key={`${auction.id}-${idx}`}
                      href={`/auctions/${auction.id}`}
                      className="flex items-center gap-3 px-5 py-2 mx-2 rounded-xl hover:bg-amber-50 transition-all shrink-0 cursor-pointer border border-transparent hover:border-amber-100"
                    >
                      <div className="w-10 h-10 rounded-lg overflow-hidden bg-amber-50 flex items-center justify-center shrink-0 shadow-inner">
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
        </div>
      </section>

      {/* ── Section 3: Auction Grid (Main Content) ── */}
      <section className="py-8 bg-white">
        <div className="container">
          <div className="mb-8 flex items-baseline gap-3">
            <h1 className="text-3xl font-bold">正在拍賣</h1>
            <p className="text-muted-foreground">(共 {activeCount} 件拍品)</p>
          </div>

          {/* Category Selector */}
          <div className="flex items-center gap-3 mb-6">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="outline" 
                  className="border-amber-200 text-amber-800 hover:bg-amber-50 flex items-center gap-2 rounded-full px-5 h-10 shadow-sm transition-all active:scale-95"
                >
                  <Filter className="w-4 h-4 text-amber-500" />
                  <span className="font-semibold">
                    {category === "all" ? "全部商品分類" : `分類：${CATEGORIES.find(c => c.value === category)?.label}`}
                  </span>
                  <ChevronDown className="w-4 h-4 text-amber-400" />
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
          <div className="flex flex-col sm:flex-row gap-3 mb-8">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="搜尋拍品名稱..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(0); setShowSuggestions(true); }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                className="pl-9 border-amber-200 focus-visible:ring-amber-400 rounded-xl h-11"
              />
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
              <SlidersHorizontal className="w-4 h-4 text-muted-foreground mr-1" />
              {(["all", "active", "ended"] as const).map((f) => (
                <Button
                  key={f}
                  size="sm"
                  variant={filter === f ? "default" : "outline"}
                  className={filter === f ? "gold-gradient text-white border-0 px-4 rounded-full" : "border-amber-200 text-amber-700 hover:bg-amber-50 rounded-full px-4"}
                  onClick={() => { setFilter(f); setPage(0); }}
                >
                  {f === "all" ? "全部" : f === "active" ? "競拍中" : "已結束"}
                </Button>
              ))}
            </div>
          </div>

          {/* Grid */}
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
                  <Card className="auction-card overflow-hidden border border-amber-100 hover:border-amber-300 cursor-pointer h-full flex flex-col">
                    <div className="h-48 coin-placeholder flex items-center justify-center relative shrink-0">
                      {auction.images && (auction.images as Array<{ imageUrl: string }>).length > 0 ? (
                        <img
                          src={(auction.images as Array<{ imageUrl: string }>)[0].imageUrl}
                          alt={auction.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-5xl">🪙</span>
                      )}
                      <div className="absolute top-3 right-3">
                        {(() => {
                          const isEnded = new Date(auction.endTime).getTime() <= Date.now() || auction.status === 'ended';
                          return (
                            <Badge className={!isEnded ? "bg-emerald-500 text-white shadow-sm" : "bg-gray-400 text-white shadow-sm"}>
                              {!isEnded ? "競拍中" : "已結束"}
                            </Badge>
                          );
                        })()}
                      </div>
                    </div>
                    <CardContent className="p-4 flex-1 flex flex-col">
                      <h3 className="font-bold text-sm mb-3 line-clamp-2 text-foreground h-10">{auction.title}</h3>
                      <div className="mt-auto pt-2 border-t border-amber-50">
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">當前出價</div>
                          {new Date(auction.endTime).getTime() > Date.now() && auction.status === 'active' && (
                            <CountdownTimer endTime={new Date(auction.endTime)} />
                          )}
                        </div>
                        <div className="flex items-end justify-between">
                          <div className="text-xl font-black text-amber-600 price-tag">
                            {getCurrencySymbol((auction as { currency?: string }).currency ?? 'HKD')}{Number(auction.currentPrice).toLocaleString()}
                          </div>
                          <Button size="sm" className="h-8 px-3 rounded-lg gold-gradient border-0 text-[10px] font-bold uppercase tracking-widest text-white shadow-md">
                            立即競投
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-20 bg-amber-50/30 rounded-3xl border border-dashed border-amber-200">
              <div className="text-6xl mb-4">🪙</div>
              <h3 className="text-xl font-bold text-amber-900">暫無拍賣商品</h3>
              <p className="text-muted-foreground mt-2">請調整篩選條件或稍後再來查看</p>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 mt-12">
              <Button
                variant="outline"
                size="icon"
                disabled={page === 0}
                onClick={() => setPage(p => p - 1)}
                className="border-amber-200 text-amber-700 hover:bg-amber-50 rounded-full"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm font-bold text-amber-900 mx-4">
                第 {page + 1} 頁 / 共 {totalPages} 頁
              </span>
              <Button
                variant="outline"
                size="icon"
                disabled={page === totalPages - 1}
                onClick={() => setPage(p => p + 1)}
                className="border-amber-200 text-amber-700 hover:bg-amber-50 rounded-full"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* ── Section 4: Brand Intro (Bottom) ── */}
      <section className="py-20 hero-bg border-t border-amber-100">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center">
            <div className="text-7xl mb-8 animate-float inline-block drop-shadow-lg">💰</div>
            <h1 className="text-4xl md:text-5xl font-black mb-4 leading-tight">
              <span className="gold-gradient-text">大BB錢幣店</span>
            </h1>
            <p className="text-xl md:text-2xl text-amber-800/80 mb-6 font-bold">
              專業錢幣拍賣平台
            </p>
            <p className="text-base md:text-lg text-muted-foreground mb-12 max-w-xl mx-auto leading-relaxed">
              匯聚古幣、紀念幣、外幣精品，為收藏愛好者提供安全、透明的競拍體驗。我們堅持專業鑑定，誠信至上。
            </p>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
              {features.map((f) => (
                <div key={f.title} className="bg-white/60 backdrop-blur-sm p-4 rounded-2xl border border-amber-100 shadow-sm hover:shadow-md transition-all">
                  <div className="text-3xl mb-2">{f.emoji}</div>
                  <h3 className="font-bold text-xs text-amber-900 mb-1">{f.title}</h3>
                  <p className="text-[10px] text-muted-foreground leading-tight">{f.desc}</p>
                </div>
              ))}
            </div>

            {!isAuthenticated && (
              <div className="bg-white/80 backdrop-blur rounded-3xl p-8 border border-amber-200 shadow-xl inline-block px-12">
                <h3 className="text-xl font-bold mb-4 text-amber-900">準備好開始您的收藏之旅了嗎？</h3>
                <a href={getLoginUrl()}>
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
      <footer className="bg-amber-950 text-amber-100/60 py-12 border-t border-amber-900/50">
        <div className="container text-center">
          <div className="text-3xl mb-4 grayscale opacity-50">💰</div>
          <div className="font-bold text-xl mb-2 text-amber-100">大BB錢幣店</div>
          <p className="text-sm mb-6">© 2026 大BB錢幣店 · 專業錢幣拍賣平台 · 誠信鑑定</p>
          <div className="flex justify-center gap-6 text-xs uppercase tracking-widest font-bold">
            <Link href="/" className="hover:text-amber-400 transition-colors">所有拍賣</Link>
            <a href="#" className="hover:text-amber-400 transition-colors">服務條款</a>
            <a href="#" className="hover:text-amber-400 transition-colors">隱私政策</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
