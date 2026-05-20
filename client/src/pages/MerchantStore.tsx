import { useParams, Link, useLocation } from "wouter";
import ChatRoomDialog from "@/components/ChatRoomDialog";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import Header from "@/components/Header";
import { Badge } from "@/components/ui/badge";
import { ShareMenu, ProductShareMenu } from "@/components/ShareMenu";
import { QuickBidPopover } from "@/components/QuickBidPopover";
import { AuctionCard } from "@/components/AuctionCard";
import { Store, MessageCircle, Package, Gavel, ChevronLeft, ChevronDown, Clock, Tag, Share2, QrCode, CalendarClock, ShoppingCart, CheckCircle2, Loader2, X } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { buildWhatsAppUrl, sanitizeUserText, parseCategories } from "@/lib/utils";
import { getCurrencySymbol } from "./AdminAuctions";
import AdSenseAd from "@/components/AdSenseAd";

type LayoutMode = "list" | "grid2" | "grid3" | "big";

function buildProductMsg(title: string, price?: number, id?: number) {
  const productUrl = id ? `https://share.hongxcollections.com/merchant-products/${id}` : "";
  return `你好，我想查詢以下商品：\n商品：${title}${price !== undefined ? `\n價錢：HK$${price.toLocaleString()}` : ""}${productUrl ? `\n連結：${productUrl}` : ""}`;
}

async function copyAndOpenMessenger(messengerLink: string, msg: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(msg);
    } else {
      const ta = document.createElement("textarea");
      ta.value = msg;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    toast.success("商品資訊已複製，請在 Messenger 對話內長按輸入欄貼上", { duration: 5000 });
  } catch {
    toast.error("複製失敗，請手動輸入");
  }
  window.open(messengerLink, "_blank", "noopener,noreferrer");
}

const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.15-.174.2-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
  </svg>
);

const MessengerIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M12 0C5.373 0 0 4.974 0 11.111c0 3.498 1.744 6.614 4.469 8.652V24l4.088-2.242c1.092.301 2.246.464 3.443.464 6.627 0 12-4.974 12-11.111S18.627 0 12 0zm1.191 14.963l-3.055-3.26-5.963 3.26L10.732 8l3.13 3.26L19.752 8l-6.561 6.963z"/>
  </svg>
);

function BuyDialog({ product, onClose }: { product: any; onClose: () => void }) {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [ordered, setOrdered] = useState(false);
  const [orderedQty, setOrderedQty] = useState(0);
  const utils = trpc.useUtils();
  const price = parseFloat(product?.price ?? "0");
  const currSymbol = getCurrencySymbol(product?.currency ?? "HKD");

  const createOrder = trpc.productOrders.create.useMutation({
    onSuccess: () => { utils.merchants.listProducts.invalidate(); setOrderedQty(qty); setOrdered(true); },
    onError: (e) => toast.error(e.message, { className: "bb-toast-err" }),
  });

  if (!user) return (
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

  if (product?.merchantId === user.id) return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 pb-20" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm text-center" onClick={e => e.stopPropagation()}>
        <span className="text-4xl mb-3 block">🚫</span>
        <p className="font-semibold text-gray-800 mb-1">不能購買自己的商品</p>
        <button onClick={onClose} className="w-full bg-gray-100 text-gray-600 font-semibold py-2.5 rounded-xl hover:bg-gray-200">關閉</button>
      </div>
    </div>
  );

  if (ordered) return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 pb-20" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm text-center" onClick={e => e.stopPropagation()}>
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-9 h-9 text-green-500" />
        </div>
        <h2 className="font-bold text-gray-800 text-lg mb-1">落單成功！</h2>
        <p className="text-sm text-gray-500 mb-2">已成功落單 <span className="font-semibold text-gray-700">{orderedQty} 件</span></p>
        <div className="bg-amber-50 rounded-xl px-4 py-2.5 mb-4 text-left">
          <p className="text-sm font-medium text-gray-800 line-clamp-2">{product?.title}</p>
          <p className="text-amber-600 font-bold text-sm mt-0.5">{currSymbol}{(price * orderedQty).toLocaleString()}</p>
        </div>
        <p className="text-sm text-gray-500 mb-6">請等候商戶確認成交，確認後我們會通知你。</p>
        <button onClick={onClose} className="w-full bg-amber-500 hover:bg-amber-600 text-white font-semibold py-2.5 rounded-xl transition-colors">完成</button>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 pb-20" onClick={onClose}>
      <div className="bg-white rounded-2xl p-5 w-full max-w-sm space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          <ShoppingCart className="w-5 h-5 text-amber-500 shrink-0" />
          <h2 className="font-bold text-gray-800 text-base">確認落單</h2>
          <button onClick={onClose} className="ml-auto p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"><X className="w-4 h-4" /></button>
        </div>
        <div className="bg-amber-50 rounded-xl p-3 space-y-1">
          <p className="font-semibold text-gray-800 text-sm line-clamp-2">{product?.title}</p>
          <p className="text-amber-600 font-bold">{currSymbol}{price.toLocaleString()}</p>
          <p className="text-xs text-gray-500">庫存：{product?.stock} 件</p>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-gray-500 font-medium">數量</label>
          <div className="flex items-center gap-3">
            <button onClick={() => setQty(q => Math.max(1, q - 1))} className="w-8 h-8 rounded-full border border-amber-200 text-amber-600 font-bold text-lg flex items-center justify-center hover:bg-amber-50">−</button>
            <span className="text-lg font-bold text-gray-800 w-8 text-center">{qty}</span>
            <button onClick={() => setQty(q => Math.min(product?.stock ?? 1, q + 1))} className="w-8 h-8 rounded-full border border-amber-200 text-amber-600 font-bold text-lg flex items-center justify-center hover:bg-amber-50">+</button>
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
              } catch {} finally { setSubmitting(false); }
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

function ContactBtns({ product, merchantId, size = "md", price }: {
  product: any; merchantId: number; size?: "md" | "sm" | "xs"; price?: number;
}) {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const [opening, setOpening] = useState(false);
  const [openRoomId, setOpenRoomId] = useState<number | null>(null);
  const [initialMsg, setInitialMsg] = useState<string | undefined>(undefined);
  const [buyingProduct, setBuyingProduct] = useState<any | null>(null);
  const isPriceEnquiryRef = useRef(false);

  const effectivePrice = price ?? parseFloat(product?.price ?? "1");
  const isPriceEnquiry = effectivePrice === 0;

  const openRoom = trpc.chat.openRoomByMerchant.useMutation({
    onSuccess: ({ roomId, isNew }) => {
      if (isNew) {
        const origin = typeof window !== "undefined" ? window.location.origin : "";
        const idPart = product?.id ? `\n商品連結：${origin}/merchant-products/${product.id}` : "";
        if (isPriceEnquiryRef.current) {
          setInitialMsg(`你好，我想查詢以下商品格價：\n商品：${product?.title ?? ""}${idPart}`);
        } else {
          setInitialMsg(`你好，我想查詢以下商品：\n${product?.title ?? ""}${idPart}`);
        }
      } else {
        setInitialMsg(undefined);
      }
      setOpenRoomId(roomId);
      setOpening(false);
    },
    onError: (err) => { toast.error(err.message, { className: "bb-toast-err" }); setOpening(false); },
  });

  const handleChat = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (!user) {
      toast.info(isPriceEnquiry ? "請先登入後才可以查詢格價" : "請先登入後才可以使用站內訊息", { className: "bb-toast-info" });
      return;
    }
    isPriceEnquiryRef.current = isPriceEnquiry;
    setOpening(true);
    openRoom.mutate({ merchantId, productTitle: product?.title ?? "" });
  };

  const handleBuy = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    setBuyingProduct({ ...product, merchantId });
  };

  const isSmall = size === "sm" || size === "xs";
  const pillBase = isSmall
    ? "flex items-center gap-0.5 text-[9px] font-semibold px-1 py-0.5 rounded-full transition-colors shrink-0"
    : "flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full transition-colors shrink-0";
  const iconSz = isSmall ? "w-2.5 h-2.5" : "w-3.5 h-3.5";

  return (
    <>
      <div className={`flex flex-wrap gap-1 shrink-0 ${isSmall ? "mt-auto justify-end" : ""}`} onClick={e => e.stopPropagation()}>
        <button type="button" disabled={opening}
          onClick={handleChat}
          className={`${pillBase} text-amber-700 bg-amber-100 hover:bg-amber-200 font-bold disabled:opacity-60`}>
          <MessageCircle className={iconSz} />
          {!isSmall && (opening ? "..." : isPriceEnquiry ? "查詢格價" : "站內訊息")}
        </button>
        {!isPriceEnquiry && (
          <button type="button"
            onClick={handleBuy}
            className={`${pillBase} bg-amber-500 hover:bg-amber-600 text-white`}>
            <ShoppingCart className={iconSz} />
            {!isSmall && "落單"}
          </button>
        )}
      </div>
      {buyingProduct && <BuyDialog product={buyingProduct} onClose={() => setBuyingProduct(null)} />}
      {openRoomId !== null && (
        <ChatRoomDialog
          roomId={openRoomId}
          open={openRoomId !== null}
          initialMessage={initialMsg}
          onOpenChange={(o) => {
            if (!o) {
              setOpenRoomId(null);
              setInitialMsg(undefined);
              utils.chat.unreadTotal.invalidate();
              utils.chat.listMyRooms.invalidate();
            }
          }}
        />
      )}
    </>
  );
}

function ProductsList({ products, layout, whatsapp, messengerLink, merchantName, merchantId }: { products: any[]; layout: LayoutMode; whatsapp: string; messengerLink: string; merchantName: string; merchantId: number }) {
  const nameOverlay = merchantName ? (
    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-1.5 py-0.5 text-white text-[10px] font-medium leading-tight truncate pointer-events-none">
      {sanitizeUserText(merchantName)}
    </div>
  ) : null;
  if (products.length === 0) return <p className="text-center text-gray-400 text-sm py-6">暫無出售商品</p>;

  if (layout === "list") {
    return (
      <div className="flex flex-col gap-[5px]">
        {products.map((p: any) => {
          const imgs: string[] = (() => { try { return p.images ? JSON.parse(p.images) : []; } catch { return []; } })();
          const price = parseFloat(p.price ?? "0");
          const sym = getCurrencySymbol(p.currency ?? "HKD");
          const isSold = p.status === "sold" || p.stock <= 0;
          return (
            <Link key={p.id} href={`/merchant-products/${p.id}`}>
            <div className={`bg-white rounded-xl border shadow-sm p-3 flex gap-3 items-start cursor-pointer transition-colors ${isSold ? "border-gray-100 opacity-75 hover:border-gray-200" : "border-amber-100 hover:border-amber-300"}`}>
              <div className="relative shrink-0">
                {imgs[0] ? (
                  <img src={imgs[0]} alt={p.title} className="w-16 h-16 rounded-lg object-cover" />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-amber-50 flex items-center justify-center">
                    <Package className="w-6 h-6 text-amber-200" />
                  </div>
                )}
                {isSold && <div className="absolute inset-0 bg-gray-500/30 rounded-lg flex items-center justify-center"><span className="text-white text-[9px] font-bold bg-gray-600/80 px-1 py-0.5 rounded">已售出</span></div>}
                {nameOverlay}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className={`text-sm font-semibold line-clamp-1 ${isSold ? "text-gray-500" : "text-gray-800"}`}>{p.title}</h3>
                {p.category && <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">{p.category}</span>}
                <p className={`text-sm font-bold mt-0.5 ${isSold ? "text-gray-400" : "text-amber-600"}`}>{price === 0 ? "查詢格價" : `${sym}${price.toLocaleString()}`}</p>
                <div className="flex items-center justify-end gap-1 mt-1">
                  {!isSold ? <ContactBtns product={p} merchantId={merchantId} price={price} /> : <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">已售出</span>}
                  <div onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                    <ProductShareMenu productId={p.id} title={p.title} price={price} currency={p.currency} iconOnly />
                  </div>
                </div>
              </div>
            </div>
            </Link>
          );
        })}
      </div>
    );
  }

  if (layout === "big") {
    return (
      <div className="flex flex-col gap-[5px]">
        {products.map((p: any) => {
          const imgs: string[] = (() => { try { return p.images ? JSON.parse(p.images) : []; } catch { return []; } })();
          const price = parseFloat(p.price ?? "0");
          const sym = getCurrencySymbol(p.currency ?? "HKD");
          const isSold = p.status === "sold" || p.stock <= 0;
          return (
            <Link key={p.id} href={`/merchant-products/${p.id}`}>
            <div className={`bg-white rounded-xl border shadow-sm overflow-hidden cursor-pointer transition-colors ${isSold ? "border-gray-100 opacity-75 hover:border-gray-200" : "border-amber-100 hover:border-amber-300"}`}>
              <div className="relative">
                {imgs[0] ? (
                  <img src={imgs[0]} alt={p.title} className="w-full h-56 object-cover" />
                ) : (
                  <div className="w-full h-56 bg-amber-50 flex items-center justify-center">
                    <Package className="w-10 h-10 text-amber-200" />
                  </div>
                )}
                {isSold && <div className="absolute inset-0 bg-gray-500/30 flex items-center justify-center"><span className="text-white text-sm font-bold bg-gray-600/80 px-3 py-1 rounded-full">已售出</span></div>}
                {nameOverlay}
              </div>
              {imgs.length > 1 && (
                <div className="flex gap-1.5 px-3 pt-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
                  {imgs.slice(1).map((u, i) => (
                    <img key={i} src={u} alt="" className="w-14 h-14 rounded-lg object-cover flex-shrink-0 border border-amber-100" />
                  ))}
                </div>
              )}
              <div className="p-3 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <h3 className={`font-semibold line-clamp-2 text-[1.05rem] flex-1 ${isSold ? "text-gray-500" : "text-gray-800"}`}>{p.title}</h3>
                  {p.category && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full shrink-0">{p.category}</span>}
                </div>
                {p.description && <p className="text-xs text-gray-500 line-clamp-3">{p.description}</p>}
                <div className="flex items-center justify-between pt-1">
                  <span className={`text-[1.4rem] font-bold ${isSold ? "text-gray-400" : "text-amber-600"}`}>{price === 0 ? "查詢格價" : `${sym}${price.toLocaleString()}`}</span>
                  <div className="flex items-center gap-1">
                    {!isSold ? <ContactBtns product={p} merchantId={merchantId} price={price} /> : <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full">已售出</span>}
                    <div onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                      <ProductShareMenu productId={p.id} title={p.title} price={price} currency={p.currency} iconOnly />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            </Link>
          );
        })}
      </div>
    );
  }

  if (layout === "grid3") {
    return (
      <div className="grid grid-cols-3 gap-[5px]">
        {products.map((p: any) => {
          const imgs: string[] = (() => { try { return p.images ? JSON.parse(p.images) : []; } catch { return []; } })();
          const price = parseFloat(p.price ?? "0");
          const sym = getCurrencySymbol(p.currency ?? "HKD");
          const isSold = p.status === "sold" || p.stock <= 0;
          return (
            <Link key={p.id} href={`/merchant-products/${p.id}`}>
            <div className={`bg-white rounded-xl border shadow-sm overflow-hidden flex flex-col cursor-pointer transition-colors ${isSold ? "border-gray-100 opacity-75 hover:border-gray-200" : "border-amber-100 hover:border-amber-300"}`}>
              <div className="relative">
                {imgs[0] ? (
                  <img src={imgs[0]} alt={p.title} className="w-full aspect-square object-cover" />
                ) : (
                  <div className="w-full aspect-square bg-amber-50 flex items-center justify-center">
                    <Package className="w-5 h-5 text-amber-200" />
                  </div>
                )}
                {isSold && <div className="absolute inset-0 bg-gray-500/30 flex items-center justify-center"><span className="text-white text-[9px] font-bold bg-gray-600/80 px-1 py-0.5 rounded">已售出</span></div>}
                {nameOverlay}
              </div>
              <div className="p-1.5 flex flex-col gap-0.5 flex-1">
                <h3 className={`text-[10px] font-semibold line-clamp-2 leading-tight ${isSold ? "text-gray-500" : "text-gray-800"}`}>{p.title}</h3>
                <span className={`text-[10px] font-bold ${isSold ? "text-gray-400" : "text-amber-600"}`}>{price === 0 ? "查詢格價" : `${sym}${price.toLocaleString()}`}</span>
                <div className="flex items-center justify-between gap-0.5">
                  {!isSold ? (
                    <ContactBtns product={p} merchantId={merchantId} size="sm" price={price} />
                  ) : (
                    <span className="mt-auto text-[9px] py-0.5 bg-gray-100 text-gray-400 rounded text-center">已售出</span>
                  )}
                  <div onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                    <ProductShareMenu productId={p.id} title={p.title} price={price} currency={p.currency} iconOnly />
                  </div>
                </div>
              </div>
            </div>
            </Link>
          );
        })}
      </div>
    );
  }

  // grid2 (default)
  return (
    <div className="grid grid-cols-2 gap-[5px]">
      {products.map((p: any) => {
        const imgs: string[] = (() => { try { return p.images ? JSON.parse(p.images) : []; } catch { return []; } })();
        const price = parseFloat(p.price ?? "0");
        const sym = getCurrencySymbol(p.currency ?? "HKD");
        const isSold = p.status === "sold" || p.stock <= 0;
        return (
          <Link key={p.id} href={`/merchant-products/${p.id}`}>
          <div className={`bg-white rounded-xl border shadow-sm overflow-hidden flex flex-col cursor-pointer transition-colors ${isSold ? "border-gray-100 opacity-75 hover:border-gray-200" : "border-amber-100 hover:border-amber-300"}`}>
            {/* 商品名稱移到照片上方 */}
            <div className="px-2.5 pt-2 pb-1 flex items-start justify-between gap-1">
              <h3 className={`text-[0.9rem] font-semibold leading-snug line-clamp-2 flex-1 ${isSold ? "text-gray-500" : "text-gray-800"}`}>{p.title}</h3>
              {p.category && <span className="text-[8px] bg-amber-100 text-amber-700 px-1 py-0.5 rounded-full shrink-0">{p.category}</span>}
            </div>
            <div className="relative">
              {imgs[0] ? (
                <div className="aspect-square w-full overflow-hidden bg-amber-50">
                  <img src={imgs[0]} alt={p.title} className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="aspect-square w-full bg-amber-50 flex items-center justify-center">
                  <Package className="w-10 h-10 text-amber-200" />
                </div>
              )}
              {isSold && <div className="absolute inset-0 bg-gray-500/30 flex items-center justify-center"><span className="text-white text-xs font-bold bg-gray-600/80 px-2 py-0.5 rounded-full">已售出</span></div>}
              {nameOverlay}
            </div>
            <div className="p-2.5 flex flex-col gap-1 flex-1">
              <span className={`text-[1.225rem] font-bold ${isSold ? "text-gray-400" : "text-amber-600"}`}>{price === 0 ? "查詢格價" : `${sym}${price.toLocaleString()}`}</span>
              {p.description && <p className="text-[10px] text-gray-500 line-clamp-2">{p.description}</p>}
              <div className="mt-auto pt-1 flex items-center justify-end gap-1">
                {!isSold ? <ContactBtns product={p} merchantId={merchantId} size="sm" price={price} /> : <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">已售出</span>}
                <div onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                  <ProductShareMenu productId={p.id} title={p.title} price={price} currency={p.currency} iconOnly />
                </div>
              </div>
            </div>
          </div>
          </Link>
        );
      })}
    </div>
  );
}

const SOLD_PER_PAGE = 10;

function SoldProductsList({ products }: { products: any[] }) {
  const [page, setPage] = useState(0);
  const total = Math.ceil(products.length / SOLD_PER_PAGE);
  const items = products.slice(page * SOLD_PER_PAGE, (page + 1) * SOLD_PER_PAGE);
  if (products.length === 0) return null;
  return (
    <div>
      <div className="divide-y divide-gray-100">
        {items.map((p: any) => {
          const imgs: string[] = (() => { try { return p.images ? JSON.parse(p.images) : []; } catch { return []; } })();
          const price = parseFloat(p.price ?? "0");
          const sym = getCurrencySymbol(p.currency ?? "HKD");
          return (
            <Link key={p.id} href={`/merchant-products/${p.id}`}>
              <div className="flex items-center gap-2.5 py-2 px-1 hover:bg-gray-50/80 rounded-lg cursor-pointer transition-colors">
                {/* 縮圖 */}
                <div className="relative shrink-0 w-10 h-10 rounded-lg overflow-hidden bg-gray-100">
                  {imgs[0] ? (
                    <img src={imgs[0]} alt={p.title} className="w-full h-full object-cover opacity-60" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="w-4 h-4 text-gray-300" />
                    </div>
                  )}
                </div>
                {/* 名稱 + 價格 */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-500 line-clamp-1 leading-tight">{p.title}</p>
                  <p className="text-xs text-gray-400 line-through">{sym}{price.toLocaleString()}</p>
                </div>
                {/* 已售標籤 */}
                <span className="shrink-0 text-[10px] bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full font-medium">已售</span>
              </div>
            </Link>
          );
        })}
      </div>
      {total > 1 && (
        <div className="flex items-center justify-between pt-2 mt-1 border-t border-gray-100">
          <button
            onClick={(e) => { e.stopPropagation(); setPage(p => Math.max(0, p - 1)); }}
            disabled={page === 0}
            className="text-[11px] font-semibold text-gray-500 disabled:opacity-30 hover:text-gray-700 transition-colors px-2 py-1"
          >
            ‹ 上頁
          </button>
          <span className="text-[11px] text-gray-400">{page + 1} / {total}</span>
          <button
            onClick={(e) => { e.stopPropagation(); setPage(p => Math.min(total - 1, p + 1)); }}
            disabled={page >= total - 1}
            className="text-[11px] font-semibold text-gray-500 disabled:opacity-30 hover:text-gray-700 transition-colors px-2 py-1"
          >
            下頁 ›
          </button>
        </div>
      )}
    </div>
  );
}

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

export default function MerchantStore() {
  const { user } = useAuth();
  const params = useParams<{ userId: string }>();
  const userId = parseInt(params.userId ?? "0", 10);

  const { data: merchant, isLoading: loadingMerchant, error } = trpc.merchants.getPublicMerchant.useQuery(
    { userId },
    { enabled: userId > 0 }
  );

  const { data: products = [], isLoading: loadingProducts } = trpc.merchants.listProducts.useQuery(
    { merchantId: userId },
    { enabled: userId > 0 }
  );

  const { data: auctionItems = [], isLoading: loadingAuctions } = trpc.merchants.getMerchantAuctions.useQuery(
    { userId },
    { enabled: userId > 0 }
  );

  const { data: siteSettingsData } = trpc.siteSettings.getAll.useQuery();
  const merchantContactPreset = (siteSettingsData as Record<string, string> | undefined)?.merchantContactMessage ?? "你好，我想查詢你的商品";

  const fbRaw = (merchant as any)?.facebook ?? "";
  const messengerLink = fbRaw
    ? (fbRaw.startsWith("http") ? fbRaw : `https://m.me/${fbRaw}`)
    : "";

  const { data: allMerchants = [] } = trpc.merchants.listApprovedMerchants.useQuery();
  const { data: merchantSessions = [] } = trpc.merchantSessions.listPublicByMerchant.useQuery(
    { merchantUserId: userId },
    { enabled: userId > 0 }
  );
  const activeSessions = (merchantSessions as any[]).filter((s) => s.status === "published" && new Date(s.endAt).getTime() > Date.now());
  const endedSessions = (merchantSessions as any[]).filter((s) => s.status === "ended" || (s.status === "published" && new Date(s.endAt).getTime() <= Date.now()));
  const merchantInfo = (allMerchants as any[]).find((m: any) => m.userId === userId);
  const merchantLayout = merchantInfo?.listingLayout as LayoutMode ?? "grid2";
  const auctionsPerPage = merchantInfo?.auctionsPerPage ?? 10;
  const productsPerPage = merchantInfo?.productsPerPage ?? 10;

  const [auctionPage, setAuctionPage] = useState(0);
  const [productPage, setProductPage] = useState(0);
  const [soldOpen, setSoldOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [sessionTab, setSessionTab] = useState<"active" | "ended">("active");
  const [storeRoomId, setStoreRoomId] = useState<number | null>(null);
  const [storeOpening, setStoreOpening] = useState(false);
  const storeUtils = trpc.useUtils();
  const storeOpenRoom = trpc.chat.openRoomByMerchant.useMutation({
    onSuccess: ({ roomId }) => { setStoreRoomId(roomId); setStoreOpening(false); },
    onError: (err) => { toast.error(err.message, { className: "bb-toast-err" }); setStoreOpening(false); },
  });
  const handleStoreChat = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (!user) { toast.info("請先登入後才可以使用站內訊息", { className: "bb-toast-info" }); return; }
    if (user.id === userId) { toast.info("唔可以同自己開對話", { className: "bb-toast-info" }); return; }
    setStoreOpening(true);
    storeOpenRoom.mutate({ merchantId: userId, productTitle: "" });
  };

  const activeProducts = (products as any[]).filter((p: any) => p.status === "active" && p.stock > 0);
  const soldProducts = (products as any[]).filter((p: any) => p.status === "sold");

  const allAuctions = auctionItems as any[];
  const totalAuctionPages = Math.ceil(allAuctions.length / auctionsPerPage);
  const paginatedAuctions = allAuctions.slice(auctionPage * auctionsPerPage, (auctionPage + 1) * auctionsPerPage);

  const totalProductPages = Math.ceil(activeProducts.length / productsPerPage);
  const paginatedActiveProducts = activeProducts.slice(productPage * productsPerPage, (productPage + 1) * productsPerPage);
  const categories = parseCategories(merchant?.categories);

  if (!userId || error) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-gray-400">
          <Store className="w-10 h-10 opacity-30" />
          <p>找不到該商戶</p>
          <Link href="/merchants" className="text-amber-600 text-sm underline">返回商戶市集</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50/40 via-background to-background pb-24">
      <Header />

      <div className="container max-w-lg mx-auto pt-3 space-y-3">
        {/* 返回 + 分享 */}
        <div className="flex items-center justify-between">
          <Link href="/merchants" className="flex items-center gap-1 text-xs text-gray-500 hover:text-amber-600 transition-colors font-medium">
            <ChevronLeft className="w-3.5 h-3.5" />返回商戶市集
          </Link>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                const url = `https://share.hongxcollections.com/merchants/${userId}`;
                if (navigator.clipboard?.writeText) {
                  navigator.clipboard.writeText(url).then(() => toast.success("商店連結已複製！"));
                } else {
                  const ta = document.createElement("textarea");
                  ta.value = url; ta.style.position = "fixed"; ta.style.opacity = "0";
                  document.body.appendChild(ta); ta.select(); document.execCommand("copy");
                  document.body.removeChild(ta); toast.success("商店連結已複製！");
                }
              }}
              className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-3 py-1.5 rounded-full transition-colors"
            >
              <Share2 className="w-3.5 h-3.5" />分享此商店
            </button>
            <button
              onClick={() => setQrOpen(true)}
              aria-label="顯示商店 QR Code"
              className="flex items-center justify-center text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 w-7 h-7 rounded-full transition-colors"
            >
              <QrCode className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* QR Code Dialog */}
        <Dialog open={qrOpen} onOpenChange={setQrOpen}>
          <DialogContent className="max-w-xs">
            <DialogHeader>
              <DialogTitle className="text-center text-sm">{merchant?.merchantName ? `「${sanitizeUserText(merchant.merchantName)}」商店 QR Code` : "商店 QR Code"}</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col items-center gap-3 py-2">
              <div id="merchant-qr-svg-wrap" className="bg-white p-3 rounded-lg border border-gray-200">
                <QRCodeSVG value={`https://hongxcollections.com/merchants/${userId}`} size={200} level="M" />
              </div>
              <p className="text-[11px] text-gray-500 text-center break-all px-2">https://hongxcollections.com/merchants/{userId}</p>
              <p className="text-xs text-gray-600 text-center">用手機掃 QR Code 即可開店</p>
              <button
                type="button"
                onClick={() => {
                  const wrap = document.getElementById("merchant-qr-svg-wrap");
                  const svg = wrap?.querySelector("svg");
                  if (!svg) return;
                  const xml = new XMLSerializer().serializeToString(svg);
                  const svg64 = btoa(unescape(encodeURIComponent(xml)));
                  const dataUrl = `data:image/svg+xml;base64,${svg64}`;
                  const img = new Image();
                  img.onload = () => {
                    const scale = 3;
                    const size = 200 * scale;
                    const pad = 24 * scale;
                    const nameH = 22 * scale;
                    const poweredH = 8 * scale;
                    const gapAfterQR = 8 * scale;
                    const gapBetween = 3 * scale;
                    const canvas = document.createElement("canvas");
                    canvas.width = size + pad * 2;
                    canvas.height = pad + size + gapAfterQR + nameH + gapBetween + poweredH + pad;
                    const ctx = canvas.getContext("2d");
                    if (!ctx) return;
                    ctx.fillStyle = "#ffffff";
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(img, pad, pad, size, size);
                    const merchantName = merchant?.merchantName ? sanitizeUserText(merchant.merchantName) : "商戶";
                    const rightX = pad + size;
                    const nameY = pad + size + gapAfterQR + nameH / 2;
                    const poweredY = pad + size + gapAfterQR + nameH + gapBetween + poweredH / 2;
                    const makeGoldGradient = (y: number) => {
                      const g = ctx.createLinearGradient(0, y - 8 * scale, 0, y + 8 * scale);
                      g.addColorStop(0, "#f59e0b");
                      g.addColorStop(0.5, "#d97706");
                      g.addColorStop(1, "#92400e");
                      return g;
                    };
                    ctx.textAlign = "right";
                    ctx.textBaseline = "middle";
                    ctx.font = `bold ${18 * scale}px -apple-system, BlinkMacSystemFont, "PingFang TC", "Microsoft JhengHei", sans-serif`;
                    ctx.fillStyle = makeGoldGradient(nameY);
                    ctx.fillText(merchantName, rightX, nameY);
                    ctx.font = `${3 * scale}px -apple-system, BlinkMacSystemFont, sans-serif`;
                    ctx.fillStyle = makeGoldGradient(poweredY);
                    ctx.fillText("Powered by hongxcollections.com", rightX, poweredY);
                    canvas.toBlob((blob) => {
                      if (!blob) return;
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `merchant-${userId}-qr.png`;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      setTimeout(() => URL.revokeObjectURL(url), 1000);
                    }, "image/png");
                  };
                  img.src = dataUrl;
                }}
                className="w-full flex items-center justify-center gap-2 py-2 bg-gradient-to-br from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-lg text-sm font-semibold transition-all shadow-sm shadow-amber-200"
              >
                下載 QR 圖片
              </button>
            </div>
          </DialogContent>
        </Dialog>

        {/* 商戶資料卡 */}
        {loadingMerchant ? (
          <div className="bg-white rounded-2xl border border-amber-100 p-5 animate-pulse space-y-3">
            <div className="flex gap-3 items-center">
              <div className="w-14 h-14 rounded-full bg-amber-100" />
              <div className="space-y-2 flex-1">
                <div className="h-4 bg-amber-100 rounded w-1/2" />
                <div className="h-3 bg-amber-50 rounded w-3/4" />
              </div>
            </div>
          </div>
        ) : merchant ? (
          <div className="bg-white rounded-2xl border border-amber-100 shadow-sm overflow-hidden">
            {/* 金漸變 banner — 頭像用 absolute 定位 half-in half-out */}
            <div className="relative h-14 bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600">
              <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_30%_50%,white_0%,transparent_60%)]" />
              {/* 頭像：bottom-0 translate-y-1/2 → 上半喺 banner、下半喺白底 */}
              <div className="absolute bottom-0 left-4 translate-y-1/2 z-10">
                {merchant.merchantIcon ? (
                  <img src={merchant.merchantIcon} alt={merchant.merchantName} className="w-[72px] h-[72px] rounded-2xl object-cover border-[3px] border-white shadow-md ring-1 ring-amber-200" />
                ) : (
                  <div className="w-[72px] h-[72px] rounded-2xl bg-gradient-to-br from-amber-100 to-amber-200 flex items-center justify-center border-[3px] border-white shadow-md ring-1 ring-amber-200">
                    <Store className="w-8 h-8 text-amber-500" />
                  </div>
                )}
              </div>
            </div>

            <div className="px-4 pt-0 pb-4 space-y-3">
              {/* 名稱 row：左側 spacer 留位畀浮起嘅頭像（36px 下半 + 8px gap = pt-11），右側名稱同 stats */}
              <div className="flex items-end gap-3 pt-11">
                <div className="w-[72px] shrink-0" />
                <div className="flex-1 min-w-0 pb-0.5">
                  <h1 className="font-bold text-gray-900 text-base leading-tight truncate">{sanitizeUserText(merchant.merchantName)}</h1>
                  <div className="flex items-center gap-2 mt-0.5 text-[11px] font-semibold text-amber-700">
                    <span className="inline-flex items-center gap-0.5"><Gavel className="w-3 h-3" />{allAuctions.length}</span>
                    <span className="text-amber-200">|</span>
                    <span className="inline-flex items-center gap-0.5"><Package className="w-3 h-3" />{activeProducts.length}</span>
                    {activeSessions.length > 0 && (
                      <>
                        <span className="text-amber-200">|</span>
                        <span className="inline-flex items-center gap-0.5"><CalendarClock className="w-3 h-3" />{activeSessions.length} 專場</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {merchant.selfIntro && (
                <p className="text-xs text-gray-500 leading-relaxed whitespace-pre-line">{sanitizeUserText(merchant.selfIntro)}</p>
              )}

              {categories.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {categories.map((cat: string) => (
                    <span key={cat} className="flex items-center gap-0.5 text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full">
                      <Tag className="w-2.5 h-2.5" />{cat}
                    </span>
                  ))}
                </div>
              )}

              {/* 專場 tabs — 進行中 / 往屆（永遠顯示兩個 tab） */}
              {(activeSessions.length > 0 || endedSessions.length > 0) && (
                <div className="border-t border-dashed border-amber-200 pt-2.5">
                  {/* Tab bar */}
                  <div className="flex rounded-lg overflow-hidden border border-amber-200 mb-2">
                    <button
                      type="button"
                      onClick={() => setSessionTab("active")}
                      className={`flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px] font-bold transition-colors ${sessionTab === "active" ? "bg-amber-500 text-white" : "bg-white text-amber-600 hover:bg-amber-50"}`}
                    >
                      <CalendarClock className="w-2.5 h-2.5" />
                      進行中專場{activeSessions.length > 0 ? `（${activeSessions.length}）` : ""}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSessionTab("ended")}
                      className={`flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px] font-bold transition-colors border-l border-amber-200 ${sessionTab === "ended" ? "bg-gray-600 text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}
                    >
                      <Clock className="w-2.5 h-2.5" />
                      往屆專場{endedSessions.length > 0 ? `（${endedSessions.length}）` : ""}
                    </button>
                  </div>

                  {/* 進行中 tab */}
                  {sessionTab === "active" && (
                    <div className="space-y-1.5">
                      {activeSessions.length === 0 ? (
                        <p className="text-[11px] text-center text-gray-400 py-3">暫無進行中專場</p>
                      ) : activeSessions.map((s: any) => (
                        <Link key={s.id} href={`/s/${userId}/${s.slug}`}>
                          <a className="flex items-center gap-2 bg-gradient-to-r from-amber-50 to-amber-50/50 hover:from-amber-100 hover:to-amber-100/70 border border-amber-200 rounded-lg px-2.5 py-1.5 transition-all group">
                            {s.coverImage ? (
                              <img src={s.coverImage} alt="" className="w-6 h-6 rounded object-cover border border-amber-200 shrink-0" />
                            ) : (
                              <div className="w-6 h-6 rounded bg-amber-100 border border-amber-200 flex items-center justify-center shrink-0">
                                <CalendarClock className="w-3 h-3 text-amber-500" />
                              </div>
                            )}
                            <span className="text-xs font-semibold text-amber-800 truncate flex-1 min-w-0">{sanitizeUserText(s.title)}</span>
                            <span className="text-[10px] font-semibold text-amber-700 bg-white/70 px-1.5 py-px rounded border border-amber-200/60 shrink-0">{s.itemCount ?? 0} 件</span>
                            <ChevronLeft className="w-3 h-3 text-amber-500 shrink-0 rotate-180" />
                          </a>
                        </Link>
                      ))}
                    </div>
                  )}

                  {/* 往屆 tab */}
                  {sessionTab === "ended" && (
                    <div className="space-y-1.5">
                      {endedSessions.length === 0 ? (
                        <p className="text-[11px] text-center text-gray-400 py-3">暫無往屆專場紀錄</p>
                      ) : endedSessions.map((s: any) => (
                        <Link key={s.id} href={`/s/${userId}/${s.slug}`}>
                          <a className="flex items-center gap-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg px-2.5 py-1.5 transition-all group">
                            {s.coverImage ? (
                              <img src={s.coverImage} alt="" className="w-6 h-6 rounded object-cover border border-gray-200 shrink-0 grayscale opacity-70" />
                            ) : (
                              <div className="w-6 h-6 rounded bg-gray-100 border border-gray-200 flex items-center justify-center shrink-0">
                                <Clock className="w-3 h-3 text-gray-400" />
                              </div>
                            )}
                            <span className="text-xs font-medium text-gray-500 truncate flex-1 min-w-0">{sanitizeUserText(s.title)}</span>
                            <span className="text-[10px] text-gray-400 bg-white px-1.5 py-px rounded border border-gray-200 shrink-0">{s.itemCount ?? 0} 件</span>
                            <ChevronLeft className="w-3 h-3 text-gray-400 shrink-0 rotate-180" />
                          </a>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}
            {(() => {
              const merchantUrl = `https://share.hongxcollections.com/merchants/${userId}`;
              const contactMsg = `${merchantContactPreset}\n${merchantUrl}`;
              const waLink = merchant.whatsapp ? buildWhatsAppUrl(merchant.whatsapp, contactMsg) : "";
              const handleMessenger = async (e: React.MouseEvent<HTMLAnchorElement>) => {
                e.preventDefault();
                try {
                  if (navigator.clipboard?.writeText) {
                    await navigator.clipboard.writeText(contactMsg);
                  } else {
                    const ta = document.createElement("textarea");
                    ta.value = contactMsg;
                    ta.style.position = "fixed";
                    ta.style.opacity = "0";
                    document.body.appendChild(ta);
                    ta.select();
                    document.execCommand("copy");
                    document.body.removeChild(ta);
                  }
                  toast.success("商戶資訊已複製，請在 Messenger 對話內長按輸入欄貼上", { duration: 5000 });
                } catch {
                  toast.error("複製失敗，請手動輸入");
                }
                window.open(messengerLink, "_blank", "noopener,noreferrer");
              };
              const handleWa = (e: React.MouseEvent) => {
                e.preventDefault();
                if (!user) { toast.info("請先登入後才可以聯繫商戶", { className: "bb-toast-info" }); return; }
                window.open(waLink, "_blank", "noopener,noreferrer");
              };
              const handleMsn = (e: React.MouseEvent) => {
                e.preventDefault();
                if (!user) { toast.info("請先登入後才可以聯繫商戶", { className: "bb-toast-info" }); return; }
                handleMessenger(e as React.MouseEvent<HTMLAnchorElement>);
              };
              return (
                <div className="flex flex-col gap-2 pt-1">
                  <button type="button" onClick={handleStoreChat} disabled={storeOpening}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm">
                    <MessageCircle className="w-4 h-4" />{storeOpening ? "連線中..." : "站內訊息"}
                  </button>
                  {(waLink || messengerLink) && (
                    <div className={`flex gap-2 ${waLink && messengerLink ? "flex-row" : ""}`}>
                      {waLink && (
                        <button type="button" onClick={handleWa}
                          className={`flex items-center justify-center gap-2 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-xl text-xs font-semibold transition-colors ${messengerLink ? "flex-1" : "w-full"}`}>
                          <MessageCircle className="w-4 h-4" />WhatsApp
                        </button>
                      )}
                      {messengerLink && (
                        <button type="button" onClick={handleMsn}
                          className={`flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition-colors ${waLink ? "flex-1" : "w-full"}`}>
                          <MessageCircle className="w-4 h-4" />Messenger
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}
            </div>
          </div>
        ) : null}

        {/* ── 拍賣商品（優先展示） ── */}
        <div className="rounded-2xl bg-gradient-to-b from-amber-50/70 to-white border border-amber-200 shadow-sm overflow-hidden">
          {/* 區域標題列 */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-amber-200 bg-gradient-to-r from-amber-100/80 to-amber-50/40">
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500 to-amber-700 shadow-sm shadow-amber-200">
              <Gavel className="w-4 h-4 text-white" />
            </div>
            <h2 className="font-bold text-sm text-amber-900">拍賣商品</h2>
            {!loadingAuctions && (
              <span className="ml-auto text-xs font-semibold text-amber-700 bg-white/80 border border-amber-200 px-2.5 py-0.5 rounded-full">
                {(auctionItems as any[]).length} 件
              </span>
            )}
          </div>
          <div className="p-3">
            {loadingAuctions ? (
              <div className="text-center py-10 text-2xl animate-spin">💰</div>
            ) : allAuctions.length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-8">暫無拍賣商品</p>
            ) : (
              <div className="flex flex-col gap-[3px]">
                {paginatedAuctions.map((a: any) => {
                  const nowMs = Date.now();
                  const endMs = new Date(a.endTime).getTime();
                  const isEnded = endMs <= nowMs;
                  const currency = a.currency ?? "HKD";
                  const totalDuration = a.createdAt ? endMs - new Date(a.createdAt).getTime() : null;
                  const elapsed = a.createdAt ? nowMs - new Date(a.createdAt).getTime() : null;
                  const timeProgress = (totalDuration && elapsed && totalDuration > 0)
                    ? Math.min(Math.max(elapsed / totalDuration, 0), 1) : null;
                  return (
                    <AuctionCard
                      key={a.id}
                      auctionId={a.id}
                      title={a.title}
                      imageUrl={a.coverImage}
                      endTime={a.endTime}
                      currentPrice={Number(a.currentPrice ?? a.startingPrice ?? 0)}
                      startingPrice={Number(a.startingPrice ?? 0)}
                      currency={currency}
                      isEnded={isEnded}
                      currentUserId={user?.id}
                      highestBidderId={a.highestBidderId}
                      highestBidderName={a.highestBidderName}
                      bidCount={Number(a.bidCount ?? 0)}
                      sellerName={merchant?.merchantName ? sanitizeUserText(merchant.merchantName) : null}
                      bidIncrement={Number((a as { bidIncrement?: number }).bidIncrement ?? 30)}
                      antiSnipeEnabled={(a as { antiSnipeEnabled?: number }).antiSnipeEnabled}
                      antiSnipeMinutes={(a as { antiSnipeMinutes?: number }).antiSnipeMinutes}
                      extendMinutes={(a as { extendMinutes?: number }).extendMinutes}
                      createdBy={(a as { createdBy?: number }).createdBy}
                      timeProgress={timeProgress}
                    />
                  );
                })}
              </div>
            )}
          </div>
          {/* 拍賣分頁控制 */}
          {totalAuctionPages > 1 && (
            <div className="flex items-center justify-between px-4 py-2 border-t border-amber-200 bg-amber-50/60">
              <button
                onClick={() => setAuctionPage(p => Math.max(0, p - 1))}
                disabled={auctionPage === 0}
                className="flex items-center gap-1 text-xs font-semibold text-amber-700 disabled:opacity-30 hover:text-amber-900 transition-colors"
              >
                ‹ 上頁
              </button>
              <span className="text-xs text-amber-600">{auctionPage + 1} / {totalAuctionPages}</span>
              <button
                onClick={() => setAuctionPage(p => Math.min(totalAuctionPages - 1, p + 1))}
                disabled={auctionPage >= totalAuctionPages - 1}
                className="flex items-center gap-1 text-xs font-semibold text-amber-700 disabled:opacity-30 hover:text-amber-900 transition-colors"
              >
                下頁 ›
              </button>
            </div>
          )}
        </div>

        {/* ── 出售商品 ── */}
        <div className="rounded-2xl bg-gradient-to-b from-amber-50/40 to-white border border-amber-100 shadow-sm overflow-hidden">
          {/* 區域標題列 */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-amber-100 bg-gradient-to-r from-amber-50 to-amber-50/30">
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br from-amber-300 to-amber-500 shadow-sm shadow-amber-100">
              <Package className="w-4 h-4 text-white" />
            </div>
            <h2 className="font-bold text-sm text-amber-900">出售商品</h2>
            {!loadingProducts && (
              <span className="ml-auto text-xs font-semibold text-amber-700 bg-white/80 border border-amber-200 px-2.5 py-0.5 rounded-full">
                {activeProducts.length} 件
              </span>
            )}
          </div>
          <div className="p-3 space-y-3">
            {loadingProducts ? (
              <div className="text-center py-10 text-2xl animate-spin">💰</div>
            ) : (
              <>
                <AdSenseAd slot="9658476126" format="auto" className="rounded-xl overflow-hidden mb-2" />
                <ProductsList
                  products={paginatedActiveProducts}
                  layout={merchantLayout}
                  whatsapp={merchant?.whatsapp ?? ""}
                  messengerLink={messengerLink}
                  merchantName={merchant?.merchantName ?? ""}
                  merchantId={userId}
                />
                {soldProducts.length > 0 && (merchantInfo?.showSoldProducts ?? 1) !== 0 && (
                  <div className="mt-3">
                    {/* 收起/展開按鈕 */}
                    <button
                      onClick={() => setSoldOpen(o => !o)}
                      className="w-full flex items-center gap-2 py-2 px-3 rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex-1 h-px bg-gray-200" />
                      <span className="text-[11px] text-gray-400 whitespace-nowrap">已售出（{soldProducts.length}）</span>
                      <ChevronDown
                        className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${soldOpen ? "rotate-180" : ""}`}
                      />
                      <div className="flex-1 h-px bg-gray-200" />
                    </button>
                    {/* 抽屜內容 */}
                    {soldOpen && (
                      <div className="mt-2 border border-gray-100 rounded-xl bg-white px-2 py-1">
                        <SoldProductsList products={soldProducts} />
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
          {/* 商品分頁控制 */}
          {totalProductPages > 1 && (
            <div className="flex items-center justify-between px-4 py-2 border-t border-amber-100 bg-amber-50/60">
              <button
                onClick={() => setProductPage(p => Math.max(0, p - 1))}
                disabled={productPage === 0}
                className="flex items-center gap-1 text-xs font-semibold text-amber-700 disabled:opacity-30 hover:text-amber-900 transition-colors"
              >
                ‹ 上頁
              </button>
              <span className="text-xs text-amber-600">{productPage + 1} / {totalProductPages}</span>
              <button
                onClick={() => setProductPage(p => Math.min(totalProductPages - 1, p + 1))}
                disabled={productPage >= totalProductPages - 1}
                className="flex items-center gap-1 text-xs font-semibold text-amber-700 disabled:opacity-30 hover:text-amber-900 transition-colors"
              >
                下頁 ›
              </button>
            </div>
          )}
        </div>
      </div>
      {storeRoomId !== null && (
        <ChatRoomDialog
          roomId={storeRoomId}
          open={storeRoomId !== null}
          onOpenChange={(o) => {
            if (!o) { setStoreRoomId(null); storeUtils.chat.unreadTotal.invalidate(); storeUtils.chat.listMyRooms.invalidate(); }
          }}
        />
      )}
    </div>
  );
}
