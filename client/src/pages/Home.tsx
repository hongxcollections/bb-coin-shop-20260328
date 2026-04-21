import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";
import { Link } from "wouter";
import { useState, useEffect, useRef } from "react";
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
  Coins, 
  Search, 
  Filter, 
  ChevronDown,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/ThemeToggle";
import { getCurrencySymbol } from "./AdminAuctions";
import { ShareMenu } from "@/components/ShareMenu";
import Header from "@/components/Header";
import EarlyBirdBanner from "@/components/EarlyBirdBanner";

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

const PAGE_SIZE = 20;

const AUCTION_SECTION_TITLES = [
  "🪙 正在拍賣",
  "🔨 槌音未落",
  "🏛️ 競投廳開放中",
  "⚡ 搶標進行中",
  "🔥 熱烈競逐中",
  "⏳ 倒數·出價·勝負未分",
  "💎 珍品爭奪中",
  "🏆 群雄競投·珍藏等您",
  "✨ 現正競投",
  "🎯 即時出價戰",
];

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
  const [category, setCategory] = useState("all");
  const [page, setPage] = useState(0);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [auctionListOpen, setAuctionListOpen] = useState(false);
  // 隨機索引在 mount 時固定，避免重新 render 時跳字
  const [randomIdx] = useState(() => Math.floor(Math.random() * 10000));

  const { data: auctions, isLoading } = trpc.auctions.list.useQuery(
    { limit: 100, offset: 0, category: category === "all" ? undefined : category },
    {
      refetchInterval: 5000, // 每 5 秒自動輪詢，確保價格和最高出價者即時更新
      staleTime: 3000, // 3 秒內視為新鮮資料
    }
  );

  const { data: siteSettings } = trpc.siteSettings.getAll.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });
  const ss = (siteSettings as Record<string, string> | undefined) ?? {};

  // 首頁拍賣標題 — ss 定義後才計算，避免 TDZ 錯誤
  const resolvedTitle = (() => {
    let list = AUCTION_SECTION_TITLES;
    if (ss.auctionSectionTitles) {
      try {
        const parsed = JSON.parse(ss.auctionSectionTitles);
        if (Array.isArray(parsed) && parsed.length > 0) list = parsed;
      } catch {}
    }
    return list[randomIdx % list.length];
  })();

  const _endingSoonRaw = parseInt(ss.endingSoonMinutes ?? '30', 10);
  const endingSoonMs = (isNaN(_endingSoonRaw) || _endingSoonRaw < 1 ? 30 : _endingSoonRaw) * 60 * 1000;
  const endingSoonText = ss.endingSoonText || "⏰ 即將結束";

  // 首頁歡迎 popup — once per browser session
  const welcomeShownRef = useRef(false);
  const [showWelcome, setShowWelcome] = useState(false);
  useEffect(() => {
    if (welcomeShownRef.current) return;
    if (ss.homeWelcomeEnabled !== "true" || !ss.homeWelcomeMessage?.trim()) return;
    if (sessionStorage.getItem("homeWelcomeShown") === "1") return;
    welcomeShownRef.current = true;
    sessionStorage.setItem("homeWelcomeShown", "1");
    setShowWelcome(true);
    const t = setTimeout(() => setShowWelcome(false), 5000);
    return () => clearTimeout(t);
  }, [ss.homeWelcomeEnabled, ss.homeWelcomeMessage]);

  const activeCount = (auctions ?? []).filter(a => a.status === "active" && new Date(a.endTime).getTime() > Date.now()).length;

  const filtered = (auctions ?? []).filter((a) => {
    const isEnded = new Date(a.endTime).getTime() <= Date.now() || a.status === 'ended';
    const matchSearch = !search || a.title.toLowerCase().includes(search.toLowerCase());
    return matchSearch && !isEnded;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const stats = [
    { label: "活躍拍賣", value: activeCount, suffix: "件" },
    { label: "已成交", value: auctions?.filter(a => a.status === "ended" || new Date(a.endTime).getTime() <= Date.now()).length ?? 0, suffix: "件" },
    { label: "錢幣品類", value: "100+", suffix: "" },
  ];

  const features = [
    { emoji: "🛡️", icon: Shield, title: "安全可信" },
    { emoji: "📈", icon: TrendingUp, title: "公開競價" },
    { emoji: "🏆", icon: Award, title: "品質保證" },
    { emoji: "🪙", icon: Coins, title: "多元品類" },
  ];

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* 首頁歡迎 popup */}
      {showWelcome && (
        <div className="bottom-nav-toast" style={{ zIndex: 9999 }}>
          <div className="bottom-nav-toast-inner">
            <span className="bottom-nav-toast-icon">🪙</span>
            <div>
              <div className="bottom-nav-toast-title">{ss.homeWelcomeMessage}</div>
            </div>
            <button
              onClick={() => setShowWelcome(false)}
              className="ml-2 opacity-40 hover:opacity-80 transition-opacity flex-shrink-0 text-sm"
              style={{ color: "var(--popup-desc)" }}
              aria-label="關閉"
            >✕</button>
          </div>
        </div>
      )}
      {/* Navigation */}
      <Header />
      {/* 早鳥會員名額 banner */}
      <EarlyBirdBanner />
      {/* ── Section 1: Stats (Top) ── */}
      <section className="pt-3 pb-2 bg-amber-50/30">
        <div className="container">
          <div className="grid grid-cols-3 gap-2 max-w-md mx-auto">
            {stats.map((s) => (
              <div key={s.label} className="bg-white/80 backdrop-blur rounded-xl p-2 border border-amber-100 shadow-sm text-center">
                <div className="text-lg font-extrabold text-amber-700">{s.value}{s.suffix}</div>
                <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Section 2: Marquee Ticker ── */}
      <section className="py-2">
        <div className="container">
          {!isLoading && (auctions ?? []).filter(a => a.status === 'active' && new Date(a.endTime).getTime() > Date.now()).length > 0 && (
            <div className="marquee-wrapper border border-amber-100 rounded-2xl bg-white py-3 overflow-hidden shadow-sm">
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
                  ))}
              </div>
                );
              })()}
            </div>
          )}
        </div>
      </section>

      {/* ── Section 3: Auction List (Main Content) ── */}
      <section className="py-3 bg-white">
        <div className="container">
          {/* Header */}
          <div className="flex items-center gap-3 mb-3">
            <h1
              className="text-xl font-bold cursor-pointer select-none"
              style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.28))", marginBottom: 0 }}
              onClick={() => setAuctionListOpen(o => !o)}
            >
              {(() => {
                const spaceIdx = resolvedTitle.indexOf(' ');
                const icon = spaceIdx > -1 ? resolvedTitle.slice(0, spaceIdx) : '';
                const text = spaceIdx > -1 ? resolvedTitle.slice(spaceIdx + 1) : resolvedTitle;
                return (
                  <>
                    <span>{icon} </span>
                    <span style={{
                      background: "linear-gradient(135deg, #b45309 0%, #f59e0b 40%, #fcd34d 60%, #d97706 100%)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      backgroundClip: "text",
                    }}>{text}</span>
                  </>
                );
              })()}
            </h1>
            <button
              onClick={() => setAuctionListOpen(o => !o)}
              className={`flex items-center text-amber-500 transition-all border border-amber-200 rounded-full px-2 py-1 hover:bg-amber-50 focus:outline-none ${auctionListOpen ? "" : "bg-amber-50"}`}
              style={{ marginBottom: 0 }}
              aria-expanded={auctionListOpen}
            >
              <ChevronDown className={`w-2 h-2 transition-transform duration-300 ${auctionListOpen ? "rotate-180" : "rotate-0"}`} />
            </button>
          </div>

          {/* Collapsible Body */}
          <div
            style={{
              overflow: "hidden",
              maxHeight: auctionListOpen ? "9999px" : "0px",
              transition: auctionListOpen ? "max-height 0.4s ease" : "max-height 0.25s ease",
              opacity: auctionListOpen ? 1 : 0,
            }}
          >

          {/* Category Selector */}
          <div className="flex items-center gap-2 mb-3">
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

          {/* Search */}
          <div className="flex flex-col sm:flex-row gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="搜尋拍品名稱..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(0); setShowSuggestions(true); }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                className="pl-8 border-amber-200 focus-visible:ring-amber-400 rounded-xl h-9 text-sm"
              />
              {showSuggestions && search.length >= 1 && (() => {
                const suggestions = (auctions ?? [])
                  .filter(a => a.title.toLowerCase().includes(search.toLowerCase()) && a.status === 'active' && new Date(a.endTime).getTime() > Date.now())
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
          </div>

          {/* Compact List Layout - No Grid! */}
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
                    <div className="relative w-20 h-20 rounded-lg overflow-hidden bg-amber-100 flex items-center justify-center shrink-0 shadow-sm">
                      {auction.images && (auction.images as Array<{ imageUrl: string }>).length > 0 ? (
                        <img
                          src={(auction.images as Array<{ imageUrl: string }>)[0].imageUrl}
                          alt={auction.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-3xl">🪙</span>
                      )}
                      {(auction as { sellerName?: string | null }).sellerName && (
                        <div className="absolute bottom-[3px] left-[3px] bg-black/60 text-white text-[10px] font-medium leading-none px-2 py-1 rounded-full max-w-[calc(100%-6px)] truncate">
                          {(auction as { sellerName?: string | null }).sellerName}
                        </div>
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
                              const desc = (auction as { description?: string }).description;
                              return desc ? desc.substring(0, 60) : `分類：${category !== "all" ? CATEGORIES.find(c => c.value === category)?.label : "未分類"}`;
                            })()}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          {(() => {
                            const now = Date.now();
                            const endMs = new Date(auction.endTime).getTime();
                            const isEndingSoon = (endMs - now) <= endingSoonMs;
                            return (
                              <>
                                {isEndingSoon && (
                                  <Badge className="bg-orange-500 text-white text-[9px] px-1.5 py-0.5 animate-pulse">
                                    {endingSoonText}
                                  </Badge>
                                )}
                                <Badge className="bg-emerald-500 text-white text-[9px] px-1.5 py-0.5">
                                  競拍中
                                </Badge>
                              </>
                            );
                          })()}
                        </div>
                      </div>

                      {/* Price & Bidder & Timer */}
                      <div className="mt-1">
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
                        <div className="flex items-center justify-end gap-1.5 mt-0.5">
                          <CountdownTimer endTime={new Date(auction.endTime)} />
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
            <div className="text-center py-20 bg-amber-50/30 rounded-3xl border border-dashed border-amber-200">
              <div className="text-6xl mb-4">🪙</div>
              <h3 className="text-xl font-bold text-amber-900">暫無正在進行的拍賣</h3>
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

          </div>{/* end collapsible body */}
        </div>
      </section>

      {/* ── Section 4: Brand Intro (Bottom) ── */}
      <section className="py-6 hero-bg border-t border-amber-100">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center">
            <div className="flex justify-center gap-3 md:gap-4 flex-wrap">
              {features.map((f) => (
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
