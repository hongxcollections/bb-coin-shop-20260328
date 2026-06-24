import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { getLoginUrl } from "@/const";
import { Link, useLocation } from "wouter";
import { useState, useEffect, useRef, useMemo } from "react";
import ImageLightbox from "@/components/ImageLightbox";
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
  
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Flame,
  Gavel,
  ShoppingCart,
  Store,
  Users,
  Loader2,
  X,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  UserPlus,
  MessageCircle,
  LayoutGrid,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/ThemeToggle";
import { getCurrencySymbol } from "./AdminAuctions";
import { parseCategories } from "@/lib/categories";
import { ShareMenu } from "@/components/ShareMenu";
import { QuickBidPopover } from "@/components/QuickBidPopover";
import Header from "@/components/Header";
import EarlyBirdBanner from "@/components/EarlyBirdBanner";
import { SilverValuationTool } from "@/components/SilverValuationTool";
import { AuctionCard } from "@/components/AuctionCard";
import { FeaturedProductSideCard, FeaturedBuyDialog } from "@/components/FeaturedProductSideCard";
import UserGallery from "@/components/UserGallery";

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

function HeroSlide({ auction }: { auction: any }) {
  const { isAuthenticated, user } = useAuth();
  const [, navigate] = useLocation();
  const [timeLeft, setTimeLeft] = useState({ h: 0, m: 0, s: 0, urgent: false, ended: false });
  useEffect(() => {
    function calc() {
      const diff = new Date(auction.endTime).getTime() - Date.now();
      if (diff <= 0) { setTimeLeft({ h: 0, m: 0, s: 0, urgent: false, ended: true }); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft({ h, m, s, urgent: diff < 3600000, ended: false });
    }
    calc();
    const id = setInterval(calc, 1000);
    return () => clearInterval(id);
  }, [auction.endTime]);

  const thumb = (auction.images as Array<{ imageUrl: string }>)?.[0]?.imageUrl ?? null;
  const currSymbol = getCurrencySymbol(auction.currency ?? "HKD");
  const hasBids = !!auction.highestBidderId;
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <Link href={`/auctions/${auction.id}`} className="block w-full h-full">
      <div className="relative w-full h-full rounded-2xl overflow-hidden cursor-pointer group">
        {thumb ? (
          <img
            src={thumb}
            alt={auction.title}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            style={{ objectPosition: "center" }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-amber-400 via-orange-400 to-yellow-300">
            <span className="text-8xl opacity-55">🪙</span>
          </div>
        )}
        <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.70) 0%, rgba(0,0,0,0.22) 28%, transparent 55%)" }} />
        <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-amber-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-md">
          <Flame className="w-3 h-3" />精選拍品
        </div>
        {auction.sellerName && (
          <div className="absolute top-3 right-3 bg-black/50 text-white text-[10px] px-2.5 py-1 rounded-full backdrop-blur-sm">
            {auction.sellerName}
          </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <h2 className="text-white font-bold text-base leading-snug line-clamp-2 drop-shadow mb-2">{auction.title}</h2>
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-white/60 text-[10px] mb-0.5">{hasBids ? "目前出價" : "起拍價"}</p>
              <p className="text-amber-300 font-extrabold text-xl leading-none drop-shadow">
                {currSymbol}{Number(auction.currentPrice).toLocaleString()}
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono font-bold backdrop-blur-sm ${timeLeft.urgent ? "bg-red-500/90 text-white animate-pulse" : "bg-black/50 text-white/90"}`}>
                <Clock className="w-3 h-3 shrink-0" />
                {timeLeft.ended ? "已結束" : `${timeLeft.h > 0 ? `${timeLeft.h}h ` : ""}${pad(timeLeft.m)}m ${pad(timeLeft.s)}s`}
              </div>
              <button type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!isAuthenticated) {
                    toast.info("請先登入先可以出價 🔐", { className: "bb-toast-info", duration: 3500 });
                    return;
                  }
                  if (user?.id === auction.createdBy) {
                    toast.error("商戶自己的商品，禁止出價 🚫", { className: "bb-toast-err", duration: 3500 });
                    return;
                  }
                  navigate(`/auctions/${auction.id}`);
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold text-white shadow-lg transition-transform group-hover:scale-105"
                style={{ background: "linear-gradient(135deg,#f59e0b 0%,#d97706 50%,#b45309 100%)" }}>
                <Gavel className="w-3.5 h-3.5" />立即出價
              </button>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

function HeroCarousel({ auctions }: { auctions: any[] }) {
  const [idx, setIdx] = useState(0);
  const total = auctions.length;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const goTo = (i: number) => setIdx((i + total) % total);

  const resetTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setIdx(p => (p + 1) % total), 4500);
  };

  useEffect(() => {
    if (total <= 1) return;
    resetTimer();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [total]);

  const prev = () => { goTo(idx - 1); resetTimer(); };
  const next = () => { goTo(idx + 1); resetTimer(); };

  return (
    <div className="relative w-full select-none" style={{ height: 260 }}>
      {/* 滑動軌道 */}
      <div className="absolute inset-0 overflow-hidden rounded-2xl shadow-lg">
        <div
          className="flex h-full"
          style={{
            width: `${total * 100}%`,
            transform: `translateX(-${(idx * 100) / total}%)`,
            transition: "transform 0.45s cubic-bezier(0.4,0,0.2,1)",
          }}
        >
          {auctions.map((a) => (
            <div key={a.id} style={{ width: `${100 / total}%`, height: "100%" }} className="shrink-0">
              <HeroSlide auction={a} />
            </div>
          ))}
        </div>
      </div>

      {/* 左右箭頭（>1 項時顯示） */}
      {total > 1 && (
        <>
          <button
            onClick={prev}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full flex items-center justify-center bg-black/45 text-white hover:bg-black/70 transition backdrop-blur-sm"
            aria-label="上一個"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={next}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full flex items-center justify-center bg-black/45 text-white hover:bg-black/70 transition backdrop-blur-sm"
            aria-label="下一個"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </>
      )}

      {/* 點狀指示器 */}
      {total > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex gap-1.5">
          {auctions.map((_, i) => (
            <button
              key={i}
              onClick={() => { goTo(i); resetTimer(); }}
              className={`rounded-full transition-all duration-300 ${i === idx ? "w-5 h-2 bg-amber-400" : "w-2 h-2 bg-white/50 hover:bg-white/80"}`}
              aria-label={`第${i + 1}件`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── 精選商品 Hero 輪播 ──
function ProductHeroSlide({ product, onBuy, currentUserId }: { product: any; onBuy: (p: any) => void; currentUserId?: number | null }) {
  const imgs = parseProductImages(product.images);
  const thumb = imgs[0] ?? null;
  const currSymbol = getCurrencySymbol(product.currency ?? "HKD");
  const price = parseFloat(product.price ?? "0");
  const isMerchantOwn = currentUserId != null && product.merchantId === currentUserId;

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden group">
      {thumb ? (
        <img src={thumb} alt={product.title}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          style={{ objectPosition: "center" }} />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-orange-400 via-amber-400 to-yellow-300">
          <span className="text-8xl opacity-55">🏪</span>
        </div>
      )}
      <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.70) 0%, rgba(0,0,0,0.22) 28%, transparent 55%)" }} />
      <Link href={`/merchant-products/${product.id}`}>
        <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-orange-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-md">
          <Store className="w-3 h-3" />精選商品
        </div>
      </Link>
      {product.merchantName && (
        <div className="absolute top-3 right-3 bg-black/50 text-white text-[10px] px-2.5 py-1 rounded-full backdrop-blur-sm">
          {product.merchantName}
        </div>
      )}
      <div className="absolute bottom-0 left-0 right-0 p-4">
        <Link href={`/merchant-products/${product.id}`}>
          <h2 className="text-white font-bold text-base leading-snug line-clamp-2 drop-shadow mb-1">{product.title}</h2>
        </Link>
        <p className="text-amber-300 font-bold text-lg leading-none mb-2 drop-shadow">
          {price === 0 ? "查詢格價" : `${currSymbol}${price.toLocaleString()}`}
        </p>
        <div className="flex items-end justify-end gap-2">
          {price === 0 ? (
            <Link
              href={`/merchant-products/${product.id}`}
              onClick={(e) => {
                if (isMerchantOwn) {
                  e.preventDefault();
                  toast.error("商戶自己的商品，禁止查詢 🚫", { className: "bb-toast-err", duration: 3500 });
                }
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold text-white shadow-lg transition-transform group-hover:scale-105"
              style={{ background: "linear-gradient(135deg,#f97316 0%,#ea580c 50%,#c2410c 100%)" }}
            >
              <MessageCircle className="w-3.5 h-3.5" />查詢價格
            </Link>
          ) : (
            <button
              onClick={() => onBuy(product)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold text-white shadow-lg transition-transform group-hover:scale-105"
              style={{ background: "linear-gradient(135deg,#f97316 0%,#ea580c 50%,#c2410c 100%)" }}
            >
              <ShoppingCart className="w-3.5 h-3.5" />立即落單
            </button>
          )}
          <Link
            href={`/merchant-products/${product.id}`}
            className="flex items-center gap-1 px-3 py-2 rounded-full text-sm font-bold text-white/90 bg-white/20 hover:bg-white/30 transition-colors backdrop-blur-sm"
          >
            詳細
          </Link>
        </div>
      </div>
    </div>
  );
}

function GalleryHeroSlide({ gallery }: { gallery: any }) {
  return (
    <Link href={`/gallery/${gallery.id}`} className="block w-full h-full">
      <div className="relative w-full h-full rounded-2xl overflow-hidden group">
        {gallery.thumbUrl ? (
          <img src={gallery.thumbUrl} alt={gallery.title}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            style={{ objectPosition: "center" }} />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-violet-400 via-purple-400 to-indigo-300">
            <span className="text-8xl opacity-55">🖼️</span>
          </div>
        )}
        <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.70) 0%, rgba(0,0,0,0.22) 28%, transparent 55%)" }} />
        <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-violet-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-md">
          🖼️ 圖片集
        </div>
        {gallery.merchantName && (
          <div className="absolute top-3 right-3 bg-black/50 text-white text-[10px] px-2.5 py-1 rounded-full backdrop-blur-sm">
            {gallery.merchantName}
          </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <h2 className="text-white font-bold text-base leading-snug line-clamp-2 drop-shadow mb-1">{gallery.title}</h2>
          <p className="text-purple-300 font-bold text-sm leading-none mb-2 drop-shadow">
            {gallery.activeItemCount ? `${gallery.activeItemCount} 件商品` : ""}
          </p>
          <div className="flex items-end justify-end gap-2">
            <span
              className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold text-white shadow-lg"
              style={{ background: "linear-gradient(135deg,#7c3aed 0%,#6d28d9 50%,#5b21b6 100%)" }}
            >
              查看圖片集 →
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

function ProductHeroCarousel({ products, onBuy }: { products: any[]; onBuy: (p: any) => void }) {
  const [idx, setIdx] = useState(0);
  const total = products.length;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const goTo = (i: number) => setIdx((i + total) % total);
  const resetTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setIdx(p => (p + 1) % total), 4500);
  };

  useEffect(() => {
    if (total <= 1) return;
    resetTimer();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [total]);

  const prev = () => { goTo(idx - 1); resetTimer(); };
  const next = () => { goTo(idx + 1); resetTimer(); };

  return (
    <div className="relative w-full select-none" style={{ height: 260 }}>
      <div className="absolute inset-0 overflow-hidden rounded-2xl shadow-lg">
        <div className="flex h-full"
          style={{
            width: `${total * 100}%`,
            transform: `translateX(-${(idx * 100) / total}%)`,
            transition: "transform 0.45s cubic-bezier(0.4,0,0.2,1)",
          }}>
          {products.map((p) => (
            <div key={p.id} style={{ width: `${100 / total}%`, height: "100%" }} className="shrink-0">
              <ProductHeroSlide product={p} onBuy={onBuy} />
            </div>
          ))}
        </div>
      </div>
      {total > 1 && (
        <>
          <button onClick={prev} className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full flex items-center justify-center bg-black/45 text-white hover:bg-black/70 transition backdrop-blur-sm" aria-label="上一個">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button onClick={next} className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full flex items-center justify-center bg-black/45 text-white hover:bg-black/70 transition backdrop-blur-sm" aria-label="下一個">
            <ChevronRight className="w-5 h-5" />
          </button>
        </>
      )}
      {total > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex gap-1.5">
          {products.map((_, i) => (
            <button key={i} onClick={() => { goTo(i); resetTimer(); }}
              className={`rounded-full transition-all duration-300 ${i === idx ? "w-5 h-2 bg-orange-400" : "w-2 h-2 bg-white/50 hover:bg-white/80"}`}
              aria-label={`第${i + 1}件`} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── 精選商品＋精選拍品 合併輪播（同位置淡入淡出切換）──
function CombinedHeroCarousel({
  products,
  auctions,
  galleries,
  onBuy,
  currentUserId,
  isAuthenticated,
}: {
  products: any[];
  auctions: any[];
  galleries: any[];
  onBuy: (p: any) => void;
  currentUserId?: number | null;
  isAuthenticated?: boolean;
}) {
  const { data: myMerchantApp } = trpc.merchants.myApplication.useQuery(undefined, {
    enabled: !!isAuthenticated,
    staleTime: 60_000,
  });
  const isApprovedMerchant = myMerchantApp?.status === "approved";

  const handleRegisterClick = (e: React.MouseEvent) => {
    if (isAuthenticated) { e.preventDefault(); toast.info("你已經係會員啦，無需重新註冊"); }
  };
  const handleMerchantClick = (e: React.MouseEvent) => {
    if (!isAuthenticated) { e.preventDefault(); toast.info("請先登入會員，再申請開通商戶"); return; }
    if (isApprovedMerchant) { e.preventDefault(); toast.info("你已經係商戶啦，去「商戶後台」管理你嘅商店"); return; }
    if (myMerchantApp?.status === "pending") { e.preventDefault(); toast.info("你嘅商戶申請正在審核中，請耐心等候"); }
  };

  // 三合一 shuffle — 每次 products/auctions/galleries 數據就緒後重新隨機
  const allItems = useMemo(() => {
    const tagged = [
      ...products.map(p => ({ ...p, _type: 'product' as const })),
      ...auctions.map(a => ({ ...a, _type: 'auction' as const })),
      ...galleries.map(g => ({ ...g, _type: 'gallery' as const })),
    ];
    for (let i = tagged.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [tagged[i], tagged[j]] = [tagged[j], tagged[i]];
    }
    return tagged;
  }, [products, auctions, galleries]);

  const [itemIdx, setItemIdx] = useState(0);
  const [visible, setVisible] = useState(true);
  const itemIdxRef = useRef(itemIdx);
  const allItemsRef = useRef(allItems);
  itemIdxRef.current = itemIdx;
  allItemsRef.current = allItems;

  useEffect(() => {
    if (allItems.length <= 1) return;
    const timer = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setItemIdx(i => (i + 1) % allItemsRef.current.length);
        setVisible(true);
      }, 550);
    }, 4500);
    return () => clearInterval(timer);
  }, [allItems.length]);

  if (allItems.length === 0) return null;
  const currentItem = allItems[Math.min(itemIdx, allItems.length - 1)];
  if (!currentItem) return null;

  const labelMap = { product: "🏪 精選出售商品", auction: "🔨 精選拍品", gallery: "🖼️ 商戶圖片集" };
  const gradientText = {
    background: "linear-gradient(135deg, #b45309 0%, #f59e0b 35%, #fde68a 55%, #f59e0b 70%, #d97706 100%)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text" as const,
  };

  return (
    <section className="pt-1 pb-1">
      <div className="container">
        <div className="flex items-end justify-between mb-1.5 pl-1 pr-1" style={{ paddingTop: 5, paddingBottom: 5 }}>
          <p className="text-xs font-semibold" style={{ filter: "drop-shadow(0 1px 3px rgba(251,191,36,0.7))", minHeight: 16 }}>
            <span style={gradientText}>{labelMap[currentItem._type]}</span>
          </p>
          <div className="flex items-end gap-3">
            <Link href="/login?tab=register" onClick={handleRegisterClick} className="flex flex-col items-center text-amber-700 hover:text-amber-900 active:scale-95 transition-all">
              <UserPlus size={20} strokeWidth={2.2} />
              <span className="text-[10px] font-semibold leading-none mt-0.5">會員註冊</span>
            </Link>
            <Link href="/merchant-apply" onClick={handleMerchantClick} className="flex flex-col items-center text-orange-700 hover:text-orange-900 active:scale-95 transition-all">
              <Store size={20} strokeWidth={2.2} />
              <span className="text-[10px] font-semibold leading-none mt-0.5">開通商戶</span>
            </Link>
          </div>
        </div>
        <div
          style={{
            opacity: visible ? 1 : 0,
            transition: "opacity 0.55s ease-in-out",
            height: 260,
            position: "relative",
            borderRadius: "1rem",
            overflow: "hidden",
            boxShadow: "0 6px 28px rgba(251,146,60,0.28), 0 2px 6px rgba(0,0,0,0.07)",
          }}
        >
          {currentItem._type === "product" && (
            <ProductHeroSlide product={currentItem} onBuy={onBuy} currentUserId={currentUserId} />
          )}
          {currentItem._type === "auction" && <HeroSlide auction={currentItem} />}
          {currentItem._type === "gallery" && <GalleryHeroSlide gallery={currentItem} />}
          {allItems.length > 1 && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex gap-1.5">
              {allItems.map((item, i) => (
                <span
                  key={i}
                  className={`rounded-full transition-all duration-300 ${
                    i === itemIdx
                      ? item._type === "gallery" ? "w-5 h-2 bg-violet-400"
                        : item._type === "auction" ? "w-5 h-2 bg-amber-400"
                        : "w-5 h-2 bg-orange-400"
                      : "w-2 h-2 bg-white/50"
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// (FeaturedProductSideCard, HomeBuyDialog, parseProductImages 已移至 @/components/FeaturedProductSideCard)
function _REMOVED_FeaturedProductSideCard({ products, onBuy, currentUserId }: { products: any[]; onBuy: (p: any) => void; currentUserId?: number | null }) {
  const [phase, setPhase] = useState<"hidden" | "visible" | "gone">("hidden");
  const [idx, setIdx] = useState(() => Math.floor(Math.random() * Math.max(products.length, 1)));
  const touchStartX = useRef<number | null>(null);
  const [animDir, setAnimDir] = useState<"left" | "right" | null>(null);

  const total = products.length;
  const product = products[idx] ?? products[0];

  const imgs = parseProductImages(product?.images);
  const thumb = imgs[0] ?? null;
  const price = parseFloat(product?.price ?? "0");
  const curr = getCurrencySymbol(product?.currency ?? "HKD");

  const CARD_W = 220;
  const CARD_H = 173;
  const STRIP  = 20;

  // 載入 1.2s 後自動滑出
  useEffect(() => {
    const t = setTimeout(() => setPhase("visible"), 1200);
    return () => clearTimeout(t);
  }, []);

  // 展開後停留 8s 自動縮回
  useEffect(() => {
    if (phase !== "visible") return;
    const t = setTimeout(() => setPhase("hidden"), 8000);
    return () => clearTimeout(t);
  }, [phase]);

  const goTo = (dir: "left" | "right") => {
    setAnimDir(dir);
    setTimeout(() => {
      setIdx(i => dir === "right" ? (i + 1) % total : (i - 1 + total) % total);
      setAnimDir(null);
    }, 200);
  };

  // 觸控滑動
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) < 30) return;
    if (total > 1) goTo(dx < 0 ? "right" : "left");
  };

  if (phase === "gone" || !product) return null;

  const slideX = phase === "visible"
    ? "translateX(0)"
    : `translateX(${CARD_W - STRIP}px)`;

  return (
    <div
      style={{
        position: "fixed",
        right: 0,
        bottom: 80,
        transform: slideX,
        transition: "transform 0.5s cubic-bezier(0.34,1.1,0.64,1)",
        zIndex: 45,
        width: CARD_W,
        cursor: "pointer",
      }}
      onClick={() => setPhase(p => p === "visible" ? "hidden" : "visible")}
    >
      {/* 縮回時條邊箭頭提示 */}
      {phase === "hidden" && (
        <div
          className="absolute left-0 top-1/2 -translate-y-1/2 z-20 flex items-center justify-center"
          style={{ width: STRIP, height: 44 }}
        >
          <ChevronLeft className="w-3.5 h-3.5 text-white drop-shadow" />
        </div>
      )}

      {/* 卡片本體 */}
      <div
        className="relative overflow-hidden"
        style={{
          height: CARD_H,
          borderRadius: "12px 0 0 12px",
          boxShadow: "-3px 4px 20px rgba(0,0,0,0.24)",
          opacity: animDir ? 0 : 1,
          transition: "opacity 0.18s ease",
        }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {thumb ? (
          <img
            src={thumb}
            alt={product.title}
            className="w-full h-full object-cover"
            style={{ objectPosition: "center" }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-orange-400 via-amber-400 to-yellow-300">
            <span className="text-5xl opacity-50">🏪</span>
          </div>
        )}
        <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.76) 0%, rgba(0,0,0,0.20) 30%, transparent 58%)" }} />

        {/* 卡內左上角：X 關閉按鈕 + 主打 badge */}
        <div className="absolute top-2 left-2 z-20 flex items-center gap-1.5">
          <button
            onClick={e => { e.stopPropagation(); setPhase("gone"); }}
            className="w-5 h-5 rounded-full bg-black/55 flex items-center justify-center backdrop-blur-sm hover:bg-black/75 transition"
          >
            <X className="w-2.5 h-2.5 text-white" />
          </button>
          <div className="flex items-center gap-0.5 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow bg-gradient-to-r from-yellow-500 to-orange-500">
            <span className="text-[8px]">🔥</span>付費主打
          </div>
        </div>

        {/* 商戶名 */}
        {product.merchantName && (
          <div className="absolute top-2 right-2 bg-black/50 text-white text-[8px] px-1.5 py-0.5 rounded-full backdrop-blur-sm max-w-[60px] truncate">
            {product.merchantName}
          </div>
        )}

        {/* 左右切換箭咀（展開時 + 多於一件時顯示） */}
        {phase === "visible" && total > 1 && (
          <>
            <button
              onClick={e => { e.stopPropagation(); goTo("left"); }}
              className="absolute left-1.5 top-1/2 -translate-y-1/2 z-30 w-6 h-6 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center hover:bg-black/70 transition"
              title="上一個"
            >
              <ChevronLeft className="w-3.5 h-3.5 text-white" />
            </button>
            <button
              onClick={e => { e.stopPropagation(); goTo("right"); }}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 z-30 w-6 h-6 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center hover:bg-black/70 transition"
              title="下一個"
            >
              <ChevronRight className="w-3.5 h-3.5 text-white" />
            </button>
            {/* 圓點指示器 */}
            <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-1 z-30">
              {products.map((_, i) => (
                <span
                  key={i}
                  className="rounded-full transition-all"
                  style={{
                    width: i === idx ? 10 : 5,
                    height: 5,
                    background: i === idx ? "#f97316" : "rgba(255,255,255,0.55)",
                  }}
                />
              ))}
            </div>
          </>
        )}

        {/* 底部資訊 */}
        <div className="absolute bottom-0 left-0 right-0 p-2.5">
          <h3 className="text-white font-bold text-[11px] leading-snug line-clamp-1 drop-shadow mb-0.5">
            {product.title}
          </h3>
          <p className="text-amber-300 font-bold text-[12px] leading-none mb-1 drop-shadow">
            {price === 0 ? "查詢格價" : `${curr}${price.toLocaleString()}`}
          </p>
          <div className="flex items-center justify-end gap-1">
            {price === 0 ? (
              <Link
                href={`/merchant-products/${product.id}`}
                onClick={e => {
                  e.stopPropagation();
                  if (currentUserId != null && product?.merchantId === currentUserId) {
                    e.preventDefault();
                    toast.error("商戶自己的商品，禁止查詢 🚫", { className: "bb-toast-err", duration: 3500 });
                  }
                }}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold text-white shadow"
                style={{ background: "linear-gradient(135deg,#f97316 0%,#ea580c 50%,#c2410c 100%)" }}
              >
                <MessageCircle className="w-2.5 h-2.5" />查詢
              </Link>
            ) : (
              <button
                onClick={e => { e.stopPropagation(); onBuy(product); }}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold text-white shadow"
                style={{ background: "linear-gradient(135deg,#f97316 0%,#ea580c 50%,#c2410c 100%)" }}
              >
                <ShoppingCart className="w-2.5 h-2.5" />落單
              </button>
            )}
            <Link
              href={`/merchant-products/${product.id}`}
              onClick={e => e.stopPropagation()}
              className="flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold text-white/90 bg-white/20 hover:bg-white/30 transition-colors"
            >
              詳細
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 首頁落單彈窗 ──
function HomeBuyDialog({ product, onClose }: { product: any; onClose: () => void }) {
  const { user, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [ordered, setOrdered] = useState(false);
  const [orderedQty, setOrderedQty] = useState(0);
  const utils = trpc.useUtils();
  const price = parseFloat(product.price ?? "0");
  const currSymbol = getCurrencySymbol(product.currency ?? "HKD");

  const createOrder = trpc.productOrders.create.useMutation({
    onSuccess: () => {
      utils.merchants.listProducts.invalidate();
      setOrderedQty(qty);
      setOrdered(true);
    },
    onError: (e) => toast.error(e.message),
  });

  if (!isAuthenticated) {
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 pb-20" onClick={onClose}>
        <div className="bg-white rounded-2xl p-6 w-full max-w-sm text-center" onClick={e => e.stopPropagation()}>
          <ShoppingCart className="w-10 h-10 text-amber-400 mx-auto mb-3" />
          <p className="font-semibold text-gray-800 mb-1">請先登入</p>
          <p className="text-sm text-gray-500 mb-4">登入後才可落單購買</p>
          <button onClick={() => { onClose(); navigate(`/login?from=${encodeURIComponent(window.location.pathname + window.location.search)}`); }}
            className="w-full bg-amber-500 hover:bg-amber-600 text-white font-semibold py-2.5 rounded-xl transition-colors">前往登入</button>
          <button onClick={onClose} className="w-full mt-2 text-sm text-gray-400 py-2">取消</button>
        </div>
      </div>
    );
  }

  if (product.merchantId === user?.id) {
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 pb-20" onClick={onClose}>
        <div className="bg-white rounded-2xl p-6 w-full max-w-sm text-center" onClick={e => e.stopPropagation()}>
          <span className="text-4xl mb-3 block">🚫</span>
          <p className="font-semibold text-gray-800 mb-1">不能購買自己的商品</p>
          <button onClick={onClose} className="w-full bg-gray-100 text-gray-600 font-semibold py-2.5 rounded-xl hover:bg-gray-200">關閉</button>
        </div>
      </div>
    );
  }

  if (ordered) {
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 pb-20" onClick={onClose}>
        <div className="bg-white rounded-2xl p-6 w-full max-w-sm text-center" onClick={e => e.stopPropagation()}>
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-9 h-9 text-green-500" />
          </div>
          <h2 className="font-bold text-gray-800 text-lg mb-1">落單成功！</h2>
          <p className="text-sm text-gray-500 mb-2">已成功落單 <span className="font-semibold text-gray-700">{orderedQty} 件</span></p>
          <div className="bg-amber-50 rounded-xl px-4 py-2.5 mb-4 text-left">
            <p className="text-sm font-medium text-gray-800 line-clamp-2">{product.title}</p>
            <p className="text-amber-600 font-bold text-sm mt-0.5">{currSymbol}{(price * orderedQty).toLocaleString()}</p>
          </div>
          <p className="text-sm text-gray-500 mb-6">請等候商戶確認成交，確認後我們會通知你。</p>
          <button onClick={onClose} className="w-full bg-amber-500 hover:bg-amber-600 text-white font-semibold py-2.5 rounded-xl transition-colors">完成</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 pb-20" onClick={onClose}>
      <div className="bg-white rounded-2xl p-5 w-full max-w-sm space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          <ShoppingCart className="w-5 h-5 text-amber-500 shrink-0" />
          <h2 className="font-bold text-gray-800 text-base">確認落單</h2>
          <button onClick={onClose} className="ml-auto p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors" aria-label="關閉">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="bg-amber-50 rounded-xl p-3 space-y-1">
          <p className="font-semibold text-gray-800 text-sm line-clamp-2">{product.title}</p>
          <p className="text-amber-600 font-bold">{currSymbol}{price.toLocaleString()}</p>
          <p className="text-xs text-gray-500">庫存：{product.stock} 件</p>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-gray-500 font-medium">數量</label>
          <div className="flex items-center gap-3">
            <button onClick={() => setQty(q => Math.max(1, q - 1))}
              className="w-8 h-8 rounded-full border border-amber-200 text-amber-600 font-bold text-lg flex items-center justify-center hover:bg-amber-50">−</button>
            <span className="text-lg font-bold text-gray-800 w-8 text-center">{qty}</span>
            <button onClick={() => setQty(q => Math.min(product.stock, q + 1))}
              className="w-8 h-8 rounded-full border border-amber-200 text-amber-600 font-bold text-lg flex items-center justify-center hover:bg-amber-50">+</button>
            <span className="text-sm text-gray-500 ml-auto">合計：<span className="text-amber-600 font-bold">{currSymbol}{(price * qty).toLocaleString()}</span></span>
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-gray-500 font-medium">備注（選填）</label>
          <textarea className="w-full border border-gray-200 rounded-xl p-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-300"
            rows={2} maxLength={200} placeholder="如有特別要求請在此說明…"
            value={note} onChange={e => setNote(e.target.value)} />
        </div>
        <p className="text-xs text-gray-400 bg-gray-50 rounded-lg p-2.5">落單後商戶會聯絡你確認成交。</p>
        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-500 text-sm font-medium hover:bg-gray-50">取消</button>
          <button disabled={submitting}
            onClick={async () => {
              setSubmitting(true);
              try {
                let buyerPushEndpoint: string | undefined;
                try {
                  const swReady = navigator.serviceWorker?.ready;
                  if (swReady) {
                    const timeout = new Promise<undefined>((res) => setTimeout(() => res(undefined), 1500));
                    const reg = await Promise.race([swReady, timeout]);
                    const sub = await reg?.pushManager?.getSubscription();
                    if (sub?.endpoint) buyerPushEndpoint = sub.endpoint;
                  }
                } catch {}
                await createOrder.mutateAsync({ productId: product.id, quantity: qty, buyerNote: note || undefined, buyerPushEndpoint });
              } catch {} finally {
                setSubmitting(false);
              }
            }}
            className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold flex items-center justify-center gap-1.5 disabled:opacity-60">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingCart className="w-4 h-4" />}
            {submitting ? "處理中…" : "確認落單"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** 解析商品圖片（images 可能是 JSON 陣列或純字串 URL） */
function parseProductImages(images: string | null | undefined): string[] {
  if (!images) return [];
  try {
    const parsed = JSON.parse(images);
    if (Array.isArray(parsed)) return parsed.filter(Boolean);
    return [String(parsed)].filter(Boolean);
  } catch {
    return [images].filter(Boolean);
  }
}

function RecentSalesFader() {
  const { data: items } = trpc.home.recentActivity.useQuery(
    { limit: 20 },
    { staleTime: 5 * 60 * 1000 }
  );
  const list = items ?? [];
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (list.length <= 1) return;
    const timer = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIndex(i => (i + 1) % list.length);
        setVisible(true);
      }, 500);
    }, 3500);
    return () => clearInterval(timer);
  }, [list.length]);

  if (list.length === 0) return null;

  const item = list[index];
  const thumb = (item as any).thumb ?? null;
  const currSymbol = getCurrencySymbol(item.currency ?? 'HKD');
  const isAuction = item.type === 'auction';

  return (
    <section className="py-2">
      <div className="container">
        <p className="text-xs font-semibold mb-1 pl-1" style={{ filter: "drop-shadow(0 1px 3px rgba(251,191,36,0.7))" }}>
          <span>🏆 </span>
          <span style={{
            background: "linear-gradient(135deg, #b45309 0%, #f59e0b 35%, #fde68a 55%, #f59e0b 70%, #d97706 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}>近期成交紀錄</span>
        </p>
        <div className="home-section-card overflow-hidden" style={{ background: "oklch(96% 0.04 145)" }}>
          <div
            className="flex items-center gap-4 px-5 py-4"
            style={{ opacity: visible ? 1 : 0, transition: 'opacity 0.5s ease' }}
          >
            {/* 縮圖 */}
            <div className="w-14 h-14 rounded-xl overflow-hidden bg-green-50 flex items-center justify-center shrink-0 shadow-inner border border-green-100">
              {thumb ? (
                <img src={thumb} alt={item.title} className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl">🪙</span>
              )}
            </div>
            {/* 資料 */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-amber-900 truncate">{item.title}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-base font-extrabold text-amber-600">
                  {currSymbol}{Number(item.price).toLocaleString()}
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  isAuction
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : 'bg-green-50 text-green-700 border-green-200'
                }`}>
                  {isAuction ? '🔨 競拍成交' : '🏪 商品售出'}
                </span>
              </div>
            </div>
            {/* 圓點指示器 */}
            <div className="flex flex-col gap-1 shrink-0">
              {list.map((_, i) => (
                <div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full transition-all duration-300"
                  style={{ background: i === index ? '#16a34a' : '#bbf7d0' }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function MerchantProductsStrip() {
  const { data: products } = trpc.merchants.listProducts.useQuery(undefined, { staleTime: 60_000 });
  const { data: galleries } = trpc.productGalleries.listHomeGalleries.useQuery(undefined, { staleTime: 60_000 });

  const mixed = useMemo(() => {
    const activeProducts = (products ?? [])
      .filter((p: any) => p.status === 'active' && (p.stock ?? 1) > 0)
      .map((p: any) => ({ ...p, _type: 'product' as const }));
    const galleryItems = (galleries ?? []).map((g: any) => ({ ...g, _type: 'gallery' as const }));
    const combined = [...activeProducts, ...galleryItems];
    // Fisher-Yates shuffle（每次 mount 隨機）
    for (let i = combined.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [combined[i], combined[j]] = [combined[j], combined[i]];
    }
    return combined;
  }, [products, galleries]);

  if (mixed.length === 0) return null;

  const duration = `${Math.max(10, mixed.length * 5)}s`;
  const doubled = [...mixed, ...mixed];

  return (
    <section className="py-2">
      <div className="container">
        <p className="text-xs font-semibold mb-1 pl-1" style={{ filter: "drop-shadow(0 1px 3px rgba(251,191,36,0.7))" }}>
          <span>🏪 </span>
          <span style={{
            background: "linear-gradient(135deg, #b45309 0%, #f59e0b 35%, #fde68a 55%, #f59e0b 70%, #d97706 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}>商戶出售商品</span>
        </p>
        <div className="marquee-wrapper rounded-2xl py-3 overflow-hidden home-section-card">
          <div className="marquee-track flex" style={{ animationDuration: duration }}>
            {doubled.map((item: any, idx: number) => {
              if (item._type === 'gallery') {
                return (
                  <Link
                    key={`g${item.id}-${idx}`}
                    href={`/gallery/${item.id}`}
                    className="flex items-center gap-3 px-5 py-2 mx-2 rounded-xl hover:bg-purple-50 transition-all shrink-0 cursor-pointer border border-transparent hover:border-purple-100"
                  >
                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-purple-50 flex items-center justify-center shrink-0 shadow-inner">
                      {item.thumbUrl ? (
                        <img src={item.thumbUrl} alt={item.title} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xl">🖼️</span>
                      )}
                    </div>
                    <div className="flex flex-col justify-center">
                      <span className="text-xs font-bold text-gray-800 max-w-[10rem] truncate">{item.title}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-gray-500 truncate max-w-[6rem]">{item.merchantName}</span>
                        <div className="flex items-center gap-1 bg-purple-50 px-1.5 py-0.5 rounded-full border border-purple-100">
                          <span className="text-[9px] text-purple-600 font-bold tracking-wider">🖼️ 圖片集</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              }
              const imgs = parseProductImages(item.images);
              const thumb = imgs[0] ?? null;
              const currSymbol = getCurrencySymbol(item.currency ?? 'HKD');
              return (
                <Link
                  key={`p${item.id}-${idx}`}
                  href={`/merchant-products/${item.id}`}
                  className="flex items-center gap-3 px-5 py-2 mx-2 rounded-xl hover:bg-amber-50 transition-all shrink-0 cursor-pointer border border-transparent hover:border-amber-100"
                >
                  <div className="w-10 h-10 rounded-lg overflow-hidden bg-amber-50 flex items-center justify-center shrink-0 shadow-inner">
                    {thumb ? (
                      <img src={thumb} alt={item.title} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xl">🪙</span>
                    )}
                  </div>
                  <div className="flex flex-col justify-center">
                    <span className="text-xs font-bold text-amber-900 max-w-[10rem] truncate">{item.title}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-amber-600 font-extrabold">
                        {currSymbol}{Number(item.price).toLocaleString()}
                      </span>
                      <div className="flex items-center gap-1 bg-orange-50 px-1.5 py-0.5 rounded-full border border-orange-100">
                        <span className="text-[9px] text-orange-600 font-bold uppercase tracking-wider">🏪 商品</span>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

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


function RotatingMerchantBadge() {
  const { data: merchants = [] } = trpc.merchants.listApprovedMerchants.useQuery(undefined, {
    staleTime: 5 * 60_000,
  });
  const list = (merchants as any[]).filter((m) => m?.merchantName);
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (list.length <= 1) return;
    const FADE_MS = 450;
    const HOLD_MS = 2400;
    let fadeTimer: ReturnType<typeof setTimeout>;
    const cycle = setInterval(() => {
      setVisible(false); // fade out
      fadeTimer = setTimeout(() => {
        setIdx((i) => (i + 1) % list.length);
        setVisible(true); // fade in 新商戶
      }, FADE_MS);
    }, HOLD_MS + FADE_MS);
    return () => {
      clearInterval(cycle);
      clearTimeout(fadeTimer);
    };
  }, [list.length]);

  if (list.length === 0) {
    return (
      <div className="inline-flex items-center gap-1.5 bg-white/70 backdrop-blur text-amber-800 px-2.5 py-1 rounded-full text-xs font-semibold mb-2 shadow-sm">
        <Store className="w-3.5 h-3.5" /> 大BB錢幣店
      </div>
    );
  }
  const m = list[idx % list.length];
  return (
    <div
      className={`inline-flex items-center gap-1.5 bg-white/80 backdrop-blur text-amber-800 pl-1 pr-2.5 py-1 rounded-full text-xs font-semibold mb-2 shadow-sm transition-opacity duration-[450ms] ease-in-out ${visible ? "opacity-100" : "opacity-0"}`}
      title={m.merchantName}
    >
      {m.merchantIcon ? (
        <img
          src={m.merchantIcon}
          alt={m.merchantName}
          className="w-5 h-5 rounded-full object-cover border border-amber-200 shrink-0"
        />
      ) : (
        <span className="w-5 h-5 rounded-full bg-amber-100 border border-amber-200 flex items-center justify-center shrink-0">
          <Store className="w-3 h-3 text-amber-600" />
        </span>
      )}
      <span className="max-w-[10rem] truncate">{m.merchantName}</span>
    </div>
  );
}

export default function Home() {
  const { user, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();

  // Auctions Logic
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [page, setPage] = useState(0);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [auctionListOpen, setAuctionListOpen] = useState(false);
  const [categoryPanelOpen, setCategoryPanelOpen] = useState(false);
  // 隨機索引在 mount 時固定，避免重新 render 時跳字
  const [randomIdx] = useState(() => Math.floor(Math.random() * 10000));
  // 商品落單彈窗
  const [buyingProduct, setBuyingProduct] = useState<any | null>(null);
  // 商戶申請流程彈窗
  const [showMerchantFlow, setShowMerchantFlow] = useState(false);
  // 微工具 dropdown + 銀工具 modal + user gallery
  const [toolsOpen, setToolsOpen] = useState(false);
  const [silverToolOpen, setSilverToolOpen] = useState(false);
  const [showUserGallery, setShowUserGallery] = useState(false);
  useEffect(() => {
    if (showUserGallery) {
      const scrollY = window.scrollY;
      document.body.style.overflow = "hidden";
      document.body.style.position = "fixed";
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = "100%";
    } else {
      const top = document.body.style.top;
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
      if (top) window.scrollTo(0, -parseInt(top, 10));
    }
    return () => {
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
    };
  }, [showUserGallery]);

  useEffect(() => {
    const handler = () => setShowUserGallery(false);
    window.addEventListener("bottom-nav-home", handler);
    return () => window.removeEventListener("bottom-nav-home", handler);
  }, []);

  // 落單按鈕：未登入直接跳登入頁，登入後返回商品詳情頁
  const handleBuy = async (product: any) => {
    if (!isAuthenticated) {
      navigate(`/login?from=${encodeURIComponent(`/merchant-products/${product.id}`)}`);
      return;
    }
    if (user && product.merchantId === user.id) {
      toast.error("商戶自己的商品，禁止落單 🚫", { className: "bb-toast-err", duration: 3500 });
      return;
    }
    try {
      const lock = await utils.merchants.myLockStatusForMerchant.fetch({ merchantId: product.merchantId });
      if (lock?.enabled && lock.locked && lock.lockedUntil) {
        const until = new Date(lock.lockedUntil).toLocaleString('zh-HK', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
        toast.error(`你已被「${lock.merchantName ?? '此商戶'}」暫停落單／出價／排價，至 ${until}`);
        return;
      }
    } catch {}
    setBuyingProduct(product);
  };

  const { data: auctions, isLoading } = trpc.auctions.list.useQuery(
    { limit: 100, offset: 0 },
    {
      refetchInterval: 5000, // 每 5 秒自動輪詢，確保價格和最高出價者即時更新
      staleTime: 3000, // 3 秒內視為新鮮資料
    }
  );

  // 計算每個分類的活躍拍賣數量（與「所有拍賣」頁一致）
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

  const { data: siteSettings } = trpc.siteSettings.getAll.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });
  // 微工具 access control：只限 approved 商戶 + admin
  const { data: myMerchantAppHome } = trpc.merchants.myApplication.useQuery(undefined, {
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
  });
  const canUseMicroTools = user?.role === 'admin' || myMerchantAppHome?.status === 'approved';
  const ss = (siteSettings as Record<string, string> | undefined) ?? {};

  const CATEGORIES = [
    { value: "all", label: "全部", emoji: "🪙" },
    ...parseCategories(ss).map(c => ({ value: c, label: c, emoji: "🏷️" })),
  ];

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

  // 出售商品（公開）
  const { data: allProducts } = trpc.merchants.listProducts.useQuery(undefined, { staleTime: 60_000 });
  const activeProducts = (allProducts ?? []).filter((p: any) => p.status === 'active' && (p.stock ?? 1) > 0);
  // 精選出售商品：隨機選三件（每次載入資料重新隨機，不固定最新）
  const heroProducts = useMemo(() => {
    if (activeProducts.length <= 3) return activeProducts;
    const shuffled = [...activeProducts].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 3);
  }, [allProducts]);
  // 精選圖片集：從 listHomeGalleries 隨機抽最多 2 個（與 MerchantProductsStrip 共用 cache）
  const { data: homeGalleries } = trpc.productGalleries.listHomeGalleries.useQuery(undefined, { staleTime: 60_000 });
  const heroGalleries = useMemo(() => {
    const all = homeGalleries ?? [];
    if (all.length <= 2) return all;
    const shuffled = [...all].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 2);
  }, [homeGalleries]);

  // 圖片集區：隨機 10 商戶各 1 個圖片集，用於 hero 輪播按鈕
  const { data: randomMerchantGalleries } = trpc.productGalleries.listRandomMerchantGalleries.useQuery(undefined, { staleTime: 5 * 60_000 });
  const galleriesForCarousel = randomMerchantGalleries ?? [];
  // 輪播 index：0 = hub「圖片集區」，1-N = 各商戶圖片集
  const [galleryCarouselIdx, setGalleryCarouselIdx] = useState(0);
  const [galleryDropdownOpen, setGalleryDropdownOpen] = useState(false);
  const galleryDropdownRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const total = galleriesForCarousel.length + 1;
    if (total <= 1) return;
    const timer = setInterval(() => {
      setGalleryCarouselIdx(prev => (prev + 1) % total);
    }, 3000);
    return () => clearInterval(timer);
  }, [galleriesForCarousel.length]);
  useEffect(() => {
    if (!galleryDropdownOpen) return;
    function handler(e: MouseEvent) {
      if (galleryDropdownRef.current && !galleryDropdownRef.current.contains(e.target as Node)) {
        setGalleryDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [galleryDropdownOpen]);

  // 付費主打商品：從 API 取得，輪播顯示（30 秒換一個）
  const { data: paidFeatured } = trpc.featuredListings.getActive.useQuery(undefined, { staleTime: 30_000, refetchInterval: 60_000 });
  // 付費主打：客戶端過期雙重篩選，格式化為卡片所需格式；導航邏輯移至卡片組件內部處理
  const featuredProducts = useMemo(() => {
    const now = new Date();
    return (paidFeatured ?? [])
      .filter((f: any) => !f.endAt || new Date(f.endAt) > now)
      .map((f: any) => ({
        id: f.productId,
        merchantId: f.merchantId,
        title: f.productTitle,
        merchantName: f.merchantName,
        price: f.price,
        currency: f.currency,
        images: f.images,
        whatsapp: f.whatsapp,
        stock: f.stock,
        _isPaid: true,
        _endAt: f.endAt,
      }));
  }, [paidFeatured]);

  const activeAuctions = (auctions ?? []).filter(a => a.status === "active" && new Date(a.endTime).getTime() > Date.now());
  const activeCount = activeAuctions.length;

  // 精選拍品：選最快結標的前三件
  const heroAuctions = [...activeAuctions]
    .sort((a, b) => new Date(a.endTime).getTime() - new Date(b.endTime).getTime())
    .slice(0, 3);

  const filtered = (auctions ?? []).filter((a) => {
    const isEnded = new Date(a.endTime).getTime() <= Date.now() || a.status === 'ended';
    const matchSearch = !search || a.title.toLowerCase().includes(search.toLowerCase());
    const matchCategory = category === "all" || (a as { category?: string | null }).category === category;
    return matchSearch && matchCategory && !isEnded;
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
    <div className="min-h-screen home-bg overflow-x-hidden">
      {/* 落單彈窗 */}
      {buyingProduct && <FeaturedBuyDialog product={buyingProduct} onClose={() => setBuyingProduct(null)} />}

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

      {/* ── 商品拍賣主頁 Hero（深橙垂直漸變：頂部深 → 底部淺，無底線）── */}
      <div className="bg-gradient-to-b from-orange-500 via-orange-300 to-orange-100">
        <div className="max-w-5xl mx-auto px-4 pt-6 pb-7 relative overflow-hidden">
          <div className="absolute -right-12 -top-12 w-48 h-48 bg-orange-400/40 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -left-10 bottom-0 w-32 h-32 bg-orange-300/50 rounded-full blur-2xl pointer-events-none" />
          <div className="relative flex items-center justify-between gap-4">
            <div className="min-w-0">
              <RotatingMerchantBadge />
              <h1 className="text-xl md:text-2xl font-extrabold tracking-tight text-amber-900">錢幣 · 競投 · 即時成交</h1>
              <p className="text-xs md:text-sm text-amber-800/80 mt-1.5">精選拍品 · 商家直銷 · 安心交易</p>
            </div>
            <div className="flex flex-col gap-2 shrink-0">
              {/* 藏品社區 — 移至原「即睇拍品」位置，沿用其底色樣式 */}
              <Link href="/collection-square">
                <span className="inline-flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold px-3.5 py-2 rounded-full shadow-md transition cursor-pointer select-none">
                  <Sparkles className="w-3.5 h-3.5" /> 藏品社區
                </span>
              </Link>
              {/* 圖片集區 — 輪播按鈕，沿用原「藏品社區」底色樣式 */}
              <div className="relative" ref={galleryDropdownRef}>
                <button
                  className="inline-flex items-center gap-1.5 bg-white text-amber-700 hover:bg-amber-50 text-xs font-bold px-3.5 py-2 rounded-full shadow-sm border border-amber-200 transition cursor-pointer select-none w-full justify-center"
                  onClick={() => {
                    if (galleryCarouselIdx === 0 || galleriesForCarousel.length === 0) {
                      setGalleryDropdownOpen(v => !v);
                    } else {
                      const g = galleriesForCarousel[galleryCarouselIdx - 1];
                      if (g) window.location.href = `/gallery/${g.id}`;
                    }
                  }}
                >
                  <LayoutGrid className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate max-w-[80px]">
                    {galleryCarouselIdx === 0 || galleriesForCarousel.length === 0
                      ? '圖片集區'
                      : (galleriesForCarousel[galleryCarouselIdx - 1]?.title ?? '圖片集區')}
                  </span>
                  <ChevronDown className="w-3 h-3 shrink-0 opacity-60" />
                </button>
                {galleryDropdownOpen && galleriesForCarousel.length > 0 && (
                  <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-amber-200 rounded-xl shadow-lg overflow-hidden"
                    style={{ minWidth: 180, maxHeight: 320, overflowY: 'auto' }}>
                    {galleriesForCarousel.map((g: any) => (
                      <a
                        key={g.id}
                        href={`/gallery/${g.id}`}
                        className="flex items-center gap-2 px-2 hover:bg-amber-50 transition"
                        style={{ height: 44 }}
                        onClick={() => setGalleryDropdownOpen(false)}
                      >
                        <div className="shrink-0 w-7 h-7 rounded overflow-hidden bg-amber-100">
                          {g.thumbUrl
                            ? <img src={g.thumbUrl} alt="" className="w-full h-full object-cover" />
                            : <div className="w-full h-full flex items-center justify-center text-amber-400"><LayoutGrid className="w-3.5 h-3.5" /></div>
                          }
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-amber-800 truncate" style={{ maxWidth: 120 }}>{g.title}</div>
                          <div className="text-[10px] text-amber-500 truncate">{g.merchantName}</div>
                        </div>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 銀工具 modal */}
      <SilverValuationTool open={silverToolOpen} onClose={() => setSilverToolOpen(false)} />

      {/* 商戶申請流程彈窗 */}
      {showMerchantFlow && (
        <ImageLightbox
          images={["/merchant-apply-steps.png?v=3"]}
          alt="商戶申請流程"
          onClose={() => setShowMerchantFlow(false)}
        />
      )}

      {/* ── Section 1: Stats (Top) — 3 個大金幣黐住（中間夾細金幣）+ 右上兩個 bar 由右向左伸延 ── */}
      <section className="pt-9 pb-3">
        <div className="container">
          <div className="relative max-w-md mx-auto">
            {/* 兩個 bar：absolute 喺右上，由右邊向左伸延 */}
            <div className="absolute -top-5 right-2 flex items-center gap-1.5 z-20">
              <button
                onClick={() => setShowMerchantFlow(true)}
                className="inline-flex items-center gap-1 bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white text-[11px] font-semibold px-2.5 py-1 shadow-md transition-colors cursor-pointer select-none whitespace-nowrap border border-sky-700/50"
                style={{ borderRadius: 6 }}
              >
                📋 商戶申請流程
              </button>
              {/* 微工具 dropdown — 一律顯示；點選工具項時才驗商戶/admin 權限 */}
              <div className="relative">
                <button
                  onClick={() => setToolsOpen(v => !v)}
                  className="inline-flex items-center gap-1 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white text-[11px] font-semibold px-2.5 py-1 shadow-md transition-colors cursor-pointer select-none whitespace-nowrap border border-amber-700/40"
                  style={{ borderRadius: 6 }}
                >
                  <Sparkles className="w-3 h-3" />
                  微工具
                  <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${toolsOpen ? "rotate-180" : ""}`} />
                </button>
                {toolsOpen && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setToolsOpen(false)} />
                    <div className="absolute top-full right-0 mt-1.5 z-40 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden min-w-[110px]">
                      <button
                        onClick={() => {
                          setToolsOpen(false);
                          if (!canUseMicroTools) { toast.error("此功能只限已批核商戶及管理員使用", { className: "bb-toast-err" }); return; }
                          navigate("/coin-analysis");
                        }}
                        className="flex items-center gap-2 w-full px-3.5 py-2.5 text-[11px] font-semibold text-amber-700 hover:bg-amber-50 whitespace-nowrap"
                      >
                        <Sparkles className="w-3 h-3" /> AI 鑑定
                      </button>
                      <div className="h-px bg-gray-100" />
                      <button
                        onClick={() => { setToolsOpen(false); navigate("/cardzzz"); }}
                        className="flex items-center gap-2 w-full px-3.5 py-2.5 text-[11px] font-semibold hover:bg-red-50 whitespace-nowrap"
                        style={{ color: "#CC0000" }}
                      >
                        <span style={{ fontSize: 11 }}>⬤</span> CardZzz
                      </button>
                      <div className="h-px bg-gray-100" />
                      <button
                        onClick={() => {
                          setToolsOpen(false);
                          if (!canUseMicroTools) { toast.error("此功能只限已批核商戶及管理員使用", { className: "bb-toast-err" }); return; }
                          setSilverToolOpen(true);
                        }}
                        className="flex items-center gap-2 w-full px-3.5 py-2.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                      >
                        🪙 銀工具
                      </button>
                      <div className="h-px bg-gray-100" />
                      <button
                        onClick={() => {
                          setToolsOpen(false);
                          if (!isAuthenticated) { toast.error("請先登入"); return; }
                          setShowUserGallery(v => !v);
                        }}
                        className="flex items-center gap-2 w-full px-3.5 py-2.5 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-50 whitespace-nowrap"
                      >
                        🖼️ 圖片集
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* 3 個大金幣黐住 */}
            <div className="flex items-center justify-center">
              {stats.map((s, idx) => (
                <div key={s.label} className="contents">
                  {/* 大金幣 */}
                  <div className="relative aspect-square w-[30%]">
                    {/* 外圈（深金邊） */}
                    <div
                      className="absolute inset-0 rounded-full"
                      style={{
                        background: "linear-gradient(135deg, #b45309 0%, #f59e0b 30%, #fde68a 50%, #f59e0b 70%, #92400e 100%)",
                        boxShadow: "0 6px 14px rgba(180, 83, 9, 0.35), inset 0 1px 2px rgba(255,255,255,0.5)",
                      }}
                    />
                    {/* 內圈（幣面） */}
                    <div
                      className="absolute inset-[4px] rounded-full flex flex-col items-center justify-center text-center px-1"
                      style={{
                        background: "radial-gradient(circle at 30% 30%, #fffbeb 0%, #fde68a 35%, #fbbf24 70%, #d97706 100%)",
                        boxShadow: "inset 0 2px 4px rgba(255,255,255,0.6), inset 0 -2px 4px rgba(146, 64, 14, 0.25)",
                      }}
                    >
                      <div className="text-2xl sm:text-3xl font-extrabold text-amber-900 leading-none drop-shadow-sm">
                        {s.value}<span className="text-base sm:text-lg">{s.suffix}</span>
                      </div>
                      <div className="text-[10px] sm:text-xs font-bold text-amber-800/90 mt-1.5 tracking-wide">
                        {s.label}
                      </div>
                    </div>
                  </div>
                  {/* 中間夾住嘅細金幣（兩大圓之間 overlap） */}
                  {idx < stats.length - 1 && (
                    <div
                      className="relative -mx-2.5 z-10 w-5 h-5 sm:w-6 sm:h-6 rounded-full shrink-0"
                      style={{
                        background: "linear-gradient(135deg, #92400e 0%, #f59e0b 35%, #fde68a 55%, #f59e0b 70%, #b45309 100%)",
                        boxShadow: "0 2px 5px rgba(146, 64, 14, 0.5), inset 0 1px 2px rgba(255,255,255,0.6), inset 0 -1px 2px rgba(146, 64, 14, 0.4)",
                      }}
                    >
                      <div
                        className="absolute inset-[2px] rounded-full"
                        style={{
                          background: "radial-gradient(circle at 30% 30%, #fffbeb 0%, #fbbf24 60%, #d97706 100%)",
                        }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 早鳥會員名額 banner */}
      <EarlyBirdBanner />

      {/* ── 圖片集（微工具）fixed panel between navbars ── */}
      {showUserGallery && isAuthenticated && (
        <div
          style={{
            position: "fixed",
            top: 64,
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 45,
            overflowY: "auto",
            background: "#F5F5F5",
          }}
        >
          <div style={{ paddingTop: "12px", paddingBottom: "calc(60px + env(safe-area-inset-bottom, 0px) + 12px)" }}>
            <UserGallery onClose={() => setShowUserGallery(false)} />
          </div>
        </div>
      )}

      {/* ── 主打出售商品：右側浮動滑入卡 ── */}
      {featuredProducts.length > 0 && (
        <FeaturedProductSideCard products={featuredProducts} onBuy={handleBuy} currentUserId={user?.id} />
      )}

      {/* ── 精選拍品＋出售商品＋圖片集 三合一輪播 ── */}
      {(heroProducts.length > 0 || heroAuctions.length > 0 || heroGalleries.length > 0) && (
        <CombinedHeroCarousel
          products={heroProducts}
          auctions={heroAuctions}
          galleries={heroGalleries}
          onBuy={handleBuy}
          currentUserId={user?.id}
          isAuthenticated={isAuthenticated}
        />
      )}

      {/* ── Section 1b: Merchant Products Marquee ── */}
      <MerchantProductsStrip />

      {/* ── Section 2: Marquee Ticker ── */}
      <section className="py-2">
        <div className="container">
          {!isLoading && (auctions ?? []).filter(a => a.status === 'active' && new Date(a.endTime).getTime() > Date.now()).length > 0 && (
            <>
            <p className="text-xs font-semibold mb-1 pl-1" style={{ filter: "drop-shadow(0 1px 3px rgba(251,191,36,0.7))" }}>
              <span>🔨 </span>
              <span style={{
                background: "linear-gradient(135deg, #b45309 0%, #f59e0b 35%, #fde68a 55%, #f59e0b 70%, #d97706 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}>商戶拍賣品</span>
            </p>
            <div className="marquee-wrapper rounded-2xl py-3 overflow-hidden home-section-card">
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
            </>
          )}
        </div>
      </section>

      {/* ── Section 3: Auction List (Main Content) ── */}
      <section className="py-3">
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

          {/* Category Selector - Collapsible Panel with Counts (與「所有拍賣」頁一致) */}
          <div className="mb-3">
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

              {category !== "all" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setCategory("all"); setPage(0); }}
                  className="text-amber-500 hover:text-amber-700 hover:bg-amber-50 font-medium rounded-full px-2 h-7"
                  style={{ fontSize: "0.5rem" }}
                >
                  清除篩選
                </Button>
              )}
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
            <div className="flex flex-col gap-[2px]">
              {paginated.map((auction) => {
                const nowMs = Date.now();
                const endMs = new Date(auction.endTime).getTime();
                const isEnded = endMs <= nowMs || (auction as { status?: string }).status === "ended";
                const isEndingSoon = !isEnded && (endMs - nowMs) <= endingSoonMs;
                const ah = auction as { highestBidderName?: string | null; highestBidderId?: number | null; sellerName?: string | null; bidCount?: number | null; currency?: string; startingPrice?: number | string | null; bidIncrement?: number; antiSnipeEnabled?: number; antiSnipeMinutes?: number; extendMinutes?: number; createdBy?: number };
                const imageUrl = (auction.images as Array<{ imageUrl: string }> | undefined)?.[0]?.imageUrl;
                const totalDuration = auction.createdAt ? endMs - new Date(auction.createdAt).getTime() : null;
                const elapsed = auction.createdAt ? nowMs - new Date(auction.createdAt).getTime() : null;
                const timeProgress = (totalDuration && elapsed && totalDuration > 0)
                  ? Math.min(Math.max(elapsed / totalDuration, 0), 1) : null;
                return (
                  <AuctionCard
                    key={auction.id}
                    auctionId={auction.id}
                    title={auction.title}
                    imageUrl={imageUrl}
                    endTime={auction.endTime}
                    currentPrice={Number(auction.currentPrice)}
                    startingPrice={Number(ah.startingPrice ?? 0)}
                    currency={ah.currency}
                    isEnded={isEnded}
                    isEndingSoon={isEndingSoon}
                    endingSoonText={endingSoonText}
                    currentUserId={user?.id}
                    highestBidderId={ah.highestBidderId}
                    highestBidderName={ah.highestBidderName}
                    bidCount={Number(ah.bidCount ?? 0)}
                    sellerName={ah.sellerName}
                    bidIncrement={Number(ah.bidIncrement ?? 30)}
                    antiSnipeEnabled={ah.antiSnipeEnabled}
                    antiSnipeMinutes={ah.antiSnipeMinutes}
                    extendMinutes={ah.extendMinutes}
                    createdBy={ah.createdBy}
                    timeProgress={timeProgress}
                  />
                );
              })}
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

      {/* ── Section 3b: Recent Sales Fader ── */}
      <RecentSalesFader />

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

      {/* SEO 內容區：對用戶隱藏（sr-only），但保留俾搜尋引擎與輔助技術讀取 */}
      <section className="sr-only" aria-hidden="false">
        <div>
          <h2>
            香港專業錢幣收藏與拍賣平台
          </h2>
          <div>
            <p>
              <strong className="text-amber-900">hongxcollections</strong>係香港具規模嘅
              <strong>錢幣拍賣</strong>同<strong>硬幣收藏</strong>平台，專營
              <strong>金幣</strong>、<strong>銀幣</strong>、<strong>銀圓</strong>、<strong>銅幣</strong>、
              <strong>紀念幣</strong>同<strong>紀念鈔</strong>嘅網上競投。無論你係收藏新手定資深玩家，
              都可以喺呢度搵到心水嘅<strong>香港舊錢幣</strong>、<strong>香港舊鈔</strong>、
              <strong>古董</strong>同<strong>古玩收藏</strong>品。
            </p>
            <p>
              我哋嘅拍賣品涵蓋全球各地：<strong>民國錢幣</strong>（<strong>孫中山</strong>、
              <strong>袁大頭</strong>、<strong>民國銀元</strong>）、<strong>中國龍銀元</strong>、
              <strong>日本龍銀</strong>、<strong>外國銀元</strong>、<strong>貿易銀元</strong>、
              <strong>龍銀</strong>、<strong>英國幣</strong>、<strong>英國銀幣</strong>
              （Great Britain Coin、United Kingdom Coin、Half Crown Coins）、
              <strong>歐洲銀幣</strong>、<strong>法國幣</strong>、<strong>外國錢鈔</strong>同
              <strong>外國幣</strong>，齊全嘅<strong>世界錢幣（World Coins）</strong>選擇。
            </p>
            <p>
              所有<strong>評級幣</strong>均經<strong>PCGS</strong>或<strong>NGC</strong>專業
              <strong>錢幣評級</strong>，買得放心。同時提供<strong>開箱記錄</strong>
              影片、<strong>金銀幣</strong>真偽鑑定及估價服務。
            </p>
            <p>
              <strong>高價收金幣、高價收銀幣</strong>：本店長期以市場最佳價格
              <strong>回收金銀</strong>、<strong>回收銀幣</strong>、舊金幣、舊銀幣，誠信交易，即場估價。
              歡迎商戶上架商品（Buy Coins、Sell Coins、Collect Coins、Old Coins，Money 收藏家樂園）。
            </p>
            <p className="text-[10px] text-amber-800/50">
              简体关键字：<span lang="zh-CN">银币、硬币、钱币收藏、金银币、法国币、外国币</span>。
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-amber-950 text-amber-100/60 py-4 pb-24 border-t border-amber-900/50">
        <div className="container flex flex-col gap-3 text-xs">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
            <p>© 2026 hongxcollections.com · 專業錢幣拍賣平台</p>
            <div className="flex gap-4 font-bold">
              <Link href="/" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="hover:text-amber-400 transition-colors">首頁</Link>
              <button onClick={() => setShowMerchantFlow(true)} className="hover:text-amber-400 transition-colors">商戶申請流程</button>
              <Link href="/about" className="hover:text-amber-400 transition-colors">關於我們</Link>
              <Link href="/terms" className="hover:text-amber-400 transition-colors">服務條款</Link>
              <Link href="/privacy" className="hover:text-amber-400 transition-colors">隱私政策</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
