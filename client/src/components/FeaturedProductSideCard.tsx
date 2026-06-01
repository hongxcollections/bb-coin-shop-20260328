import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { ChevronLeft, ChevronRight, ShoppingCart, MessageCircle, X, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getCurrencySymbol } from "@/pages/AdminAuctions";

export function parseProductImages(images: string | null | undefined): string[] {
  if (!images) return [];
  try {
    const parsed = JSON.parse(images);
    if (Array.isArray(parsed)) return parsed.filter(Boolean);
    return [String(parsed)].filter(Boolean);
  } catch {
    return [images].filter(Boolean);
  }
}

export function FeaturedBuyDialog({ product, onClose }: { product: any; onClose: () => void }) {
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

export function FeaturedProductSideCard({ products, onBuy, currentUserId }: { products: any[]; onBuy: (p: any) => void; currentUserId?: number | null }) {
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

  useEffect(() => {
    const t = setTimeout(() => setPhase("visible"), 1200);
    return () => clearTimeout(t);
  }, []);

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
      {phase === "hidden" && (
        <div
          className="absolute left-0 top-1/2 -translate-y-1/2 z-20 flex items-center justify-center"
          style={{ width: STRIP, height: 44 }}
        >
          <ChevronLeft className="w-3.5 h-3.5 text-white drop-shadow" />
        </div>
      )}

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

        {product.merchantName && (
          <div className="absolute top-2 right-2 bg-black/50 text-white text-[8px] px-1.5 py-0.5 rounded-full backdrop-blur-sm max-w-[60px] truncate">
            {product.merchantName}
          </div>
        )}

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
