import { useState, useEffect } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import Header from "@/components/Header";
import { Store, Package, X, ChevronLeft, ChevronRight, ShoppingCart, Loader2 } from "lucide-react";
import { buildWhatsAppUrl } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link, useLocation } from "wouter";
import { parseCategories } from "@/lib/categories";
type LayoutMode = "list" | "grid2" | "grid3" | "big";

function buildProductMsg(title: string, price?: number, id?: number) {
  const productUrl = id ? `${window.location.origin}/merchant-products/${id}` : "";
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

function ContactBtns({ whatsapp, messengerLink, title, price, id, size = "md" }: {
  whatsapp: string; messengerLink: string; title: string; price?: number; id?: number; size?: "md" | "sm";
}) {
  const msg = buildProductMsg(title, price, id);
  const waLink = whatsapp ? buildWhatsAppUrl(whatsapp, msg) : "";
  if (!waLink && !messengerLink) return null;
  const stop = (e: React.MouseEvent) => e.stopPropagation();
  const isSmall = size === "sm";
  const btn = isSmall ? "w-5 h-5" : "w-6 h-6";
  const icon = isSmall ? "w-2.5 h-2.5" : "w-3.5 h-3.5";
  return (
    <div className={`flex gap-1.5 shrink-0 ${isSmall ? "mt-auto justify-end" : ""}`} onClick={stop}>
      {waLink && (
        <a href={waLink} target="_blank" rel="noopener noreferrer"
          aria-label="WhatsApp 聯絡"
          className={`${btn} flex items-center justify-center bg-green-500 hover:bg-green-600 text-white rounded-full transition-colors shadow-sm`}>
          <WhatsAppIcon className={icon} />
        </a>
      )}
      {messengerLink && (
        <a href={messengerLink} target="_blank" rel="noopener noreferrer"
          aria-label="Messenger 聯絡"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); copyAndOpenMessenger(messengerLink, msg); }}
          className={`${btn} flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white rounded-full transition-colors shadow-sm`}>
          <MessengerIcon className={icon} />
        </a>
      )}
    </div>
  );
}

// ── 購買確認彈窗 ──
function BuyDialog({ product, onClose }: { product: any; onClose: () => void }) {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");
  const utils = trpc.useUtils();

  const price = parseFloat(product.price ?? "0");

  const createOrder = trpc.productOrders.create.useMutation({
    onSuccess: () => {
      toast.success("已成功落單！請等候商戶確認成交");
      utils.merchants.listProducts.invalidate();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  if (!user) {
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4" onClick={onClose}>
        <div className="bg-white rounded-2xl p-6 w-full max-w-sm text-center" onClick={e => e.stopPropagation()}>
          <ShoppingCart className="w-10 h-10 text-amber-400 mx-auto mb-3" />
          <p className="font-semibold text-gray-800 mb-1">請先登入</p>
          <p className="text-sm text-gray-500 mb-4">登入後才可落單購買</p>
          <button onClick={() => { onClose(); navigate("/login"); }}
            className="w-full bg-amber-500 hover:bg-amber-600 text-white font-semibold py-2.5 rounded-xl transition-colors">
            前往登入
          </button>
          <button onClick={onClose} className="w-full mt-2 text-sm text-gray-400 py-2">取消</button>
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
        </div>

        <div className="bg-amber-50 rounded-xl p-3 space-y-1">
          <p className="font-semibold text-gray-800 text-sm line-clamp-2">{product.title}</p>
          <p className="text-amber-600 font-bold">{product.currency ?? "HKD"} ${price.toLocaleString()}</p>
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
            <span className="text-sm text-gray-500 ml-auto">合計：<span className="text-amber-600 font-bold">${(price * qty).toLocaleString()}</span></span>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-gray-500 font-medium">備注（選填）</label>
          <textarea
            className="w-full border border-gray-200 rounded-xl p-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-300"
            rows={2} maxLength={200} placeholder="如有特別要求請在此說明…"
            value={note} onChange={e => setNote(e.target.value)}
          />
        </div>

        <p className="text-xs text-gray-400 bg-gray-50 rounded-lg p-2.5">
          落單後商戶會聯絡你確認成交，傭金於商戶確認後才自動扣除。
        </p>

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-500 text-sm font-medium hover:bg-gray-50">取消</button>
          <button
            disabled={createOrder.isPending}
            onClick={() => createOrder.mutate({ productId: product.id, quantity: qty, buyerNote: note || undefined })}
            className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold flex items-center justify-center gap-1.5 disabled:opacity-60"
          >
            {createOrder.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingCart className="w-4 h-4" />}
            確認落單
          </button>
        </div>
      </div>
    </div>
  );
}

function ProductCard({ p, layout, whatsapp, messengerLink, onBuy }: { p: any; layout: LayoutMode; whatsapp: string; messengerLink: string; onBuy: (p: any) => void }) {
  const imgs: string[] = (() => { try { return p.images ? JSON.parse(p.images) : []; } catch { return []; } })();
  const price = parseFloat(p.price ?? "0");
  const href = `/merchant-products/${p.id}`;
  // 有效 whatsapp：商戶 whatsapp（更新源頭）優先，否則 fallback 商品自身 whatsapp
  const _pWa = (p.whatsapp ?? "").toString();
  const _pWaDigits = _pWa.replace(/[^0-9]/g, "");
  const _mWa = (whatsapp ?? "").toString();
  const _mWaDigits = _mWa.replace(/[^0-9]/g, "");
  const effWa = _mWaDigits.length >= 7 ? _mWa : (_pWaDigits.length >= 7 ? _pWa : "");

  const buyBtn = (
    <button
      onClick={e => { e.preventDefault(); e.stopPropagation(); onBuy(p); }}
      className="flex items-center gap-1 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold px-2.5 py-1.5 rounded-full transition-colors shrink-0 shadow-sm"
    >
      <ShoppingCart className="w-3.5 h-3.5" />落單
    </button>
  );

  if (layout === "list") return (
    <Link href={href}>
      <div className="bg-white rounded-xl border border-amber-100 shadow-sm p-3 flex gap-3 items-start cursor-pointer hover:border-amber-300 transition-colors">
        {imgs[0] ? <img src={imgs[0]} alt={p.title} className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
          : <div className="w-16 h-16 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0"><Package className="w-6 h-6 text-amber-200" /></div>}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gray-800 line-clamp-1">{p.title}</h3>
          {p.category && <div className="flex flex-wrap gap-1">{(p.category.includes("|") ? p.category.split("|") : [p.category]).map((c: string) => <span key={c} className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">{c.trim()}</span>)}</div>}
          {p.description && <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">{p.description}</p>}
          <div className="flex items-center justify-between mt-1.5 gap-2">
            <span className="font-bold text-amber-600 text-sm">{p.currency ?? "HKD"} ${price.toLocaleString()}</span>
            <div className="flex items-center gap-1.5">
              {p.stock > 0 ? <>{buyBtn}<ContactBtns whatsapp={effWa} messengerLink={messengerLink} title={p.title} price={price} id={p.id} /></> : <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">已售出</span>}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );

  if (layout === "big") return (
    <Link href={href}>
      <div className="bg-white rounded-xl border border-amber-100 shadow-sm overflow-hidden cursor-pointer hover:border-amber-300 transition-colors">
        {imgs[0] ? <img src={imgs[0]} alt={p.title} className="w-full h-56 object-cover" />
          : <div className="w-full h-56 bg-amber-50 flex items-center justify-center"><Package className="w-10 h-10 text-amber-200" /></div>}
        {imgs.length > 1 && (
          <div className="flex gap-1.5 px-3 pt-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            {imgs.slice(1).map((u, i) => <img key={i} src={u} alt="" className="w-14 h-14 rounded-lg object-cover flex-shrink-0 border border-amber-100" />)}
          </div>
        )}
        <div className="p-3 space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-gray-800 line-clamp-2 text-sm flex-1">{p.title}</h3>
            {p.category && (p.category.includes("|") ? p.category.split("|") : [p.category]).slice(0,1).map((c: string) => <span key={c} className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full shrink-0">{c.trim()}</span>)}
          </div>
          {p.description && <p className="text-xs text-gray-500 line-clamp-3">{p.description}</p>}
          <div className="flex items-center justify-between pt-1 gap-2">
            <span className="font-bold text-amber-600 text-base">{p.currency ?? "HKD"} ${price.toLocaleString()}</span>
            <div className="flex items-center gap-1.5">
              {p.stock > 0 ? <>{buyBtn}<ContactBtns whatsapp={effWa} messengerLink={messengerLink} title={p.title} price={price} id={p.id} /></> : <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full">已售出</span>}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );

  if (layout === "grid3") return (
    <Link href={href}>
      <div className="bg-white rounded-xl border border-amber-100 shadow-sm overflow-hidden flex flex-col cursor-pointer hover:border-amber-300 transition-colors">
        {imgs[0] ? <img src={imgs[0]} alt={p.title} className="w-full aspect-square object-cover" />
          : <div className="w-full aspect-square bg-amber-50 flex items-center justify-center"><Package className="w-5 h-5 text-amber-200" /></div>}
        <div className="p-1.5 flex flex-col gap-1 flex-1">
          <h3 className="text-[10px] font-semibold text-gray-800 line-clamp-2 leading-tight">{p.title}</h3>
          <span className="text-[10px] font-bold text-amber-600">${price.toLocaleString()}</span>
          {p.stock > 0 ? (
            <div className="flex items-center gap-1 mt-auto">
              <button onClick={e => { e.preventDefault(); e.stopPropagation(); onBuy(p); }}
                className="flex-1 flex items-center justify-center gap-0.5 bg-amber-500 hover:bg-amber-600 text-white text-[9px] font-semibold py-1 rounded-full transition-colors">
                <ShoppingCart className="w-2.5 h-2.5" />落單
              </button>
              <ContactBtns whatsapp={effWa} messengerLink={messengerLink} title={p.title} price={price} id={p.id} size="sm" />
            </div>
          ) : (
            <span className="mt-auto text-[9px] py-0.5 bg-gray-100 text-gray-400 rounded text-center">已售出</span>
          )}
        </div>
      </div>
    </Link>
  );

  return (
    <Link href={href}>
      <div className="bg-white rounded-xl border border-amber-100 shadow-sm overflow-hidden flex flex-col cursor-pointer hover:border-amber-300 transition-colors">
        {imgs[0] ? <div className="aspect-square w-full overflow-hidden bg-amber-50"><img src={imgs[0]} alt={p.title} className="w-full h-full object-cover" /></div>
          : <div className="aspect-square w-full bg-amber-50 flex items-center justify-center"><Package className="w-10 h-10 text-amber-200" /></div>}
        <div className="p-2.5 flex flex-col gap-1 flex-1">
          <div className="flex items-start justify-between gap-1">
            <h3 className="text-xs font-semibold text-gray-800 leading-snug line-clamp-2 flex-1">{p.title}</h3>
            {p.category && (p.category.includes("|") ? p.category.split("|") : [p.category]).slice(0,1).map((c: string) => <span key={c} className="text-[10px] bg-amber-100 text-amber-700 px-1 py-0.5 rounded-full shrink-0">{c.trim()}</span>)}
          </div>
          {p.description && <p className="text-[10px] text-gray-500 line-clamp-2">{p.description}</p>}
          <div className="mt-auto pt-1.5 flex items-center justify-between gap-1">
            <span className="font-bold text-amber-600 text-xs">{p.currency ?? "HKD"} ${price.toLocaleString()}</span>
            <div className="flex items-center gap-1">
            {p.stock > 0 ? (
              <>
                <button onClick={e => { e.preventDefault(); e.stopPropagation(); onBuy(p); }}
                  className="flex items-center gap-0.5 bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-semibold px-2 py-1 rounded-full transition-colors shadow-sm">
                  <ShoppingCart className="w-2.5 h-2.5" />落單
                </button>
                <ContactBtns whatsapp={effWa} messengerLink={messengerLink} title={p.title} price={price} id={p.id} size="sm" />
              </>
            ) : <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">已售出</span>}
          </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

function ProductsGrid({ products, layout, whatsapp, messengerLink, onBuy }: { products: any[]; layout: LayoutMode; whatsapp: string; messengerLink: string; onBuy: (p: any) => void }) {
  if (layout === "list") return <div className="space-y-2">{products.map(p => <ProductCard key={p.id} p={p} layout={layout} whatsapp={whatsapp} messengerLink={messengerLink} onBuy={onBuy} />)}</div>;
  if (layout === "big") return <div className="space-y-4">{products.map(p => <ProductCard key={p.id} p={p} layout={layout} whatsapp={whatsapp} messengerLink={messengerLink} onBuy={onBuy} />)}</div>;
  if (layout === "grid3") return <div className="grid grid-cols-3 gap-2">{products.map(p => <ProductCard key={p.id} p={p} layout={layout} whatsapp={whatsapp} messengerLink={messengerLink} onBuy={onBuy} />)}</div>;
  return <div className="grid grid-cols-2 gap-3">{products.map(p => <ProductCard key={p.id} p={p} layout={layout} whatsapp={whatsapp} messengerLink={messengerLink} onBuy={onBuy} />)}</div>;
}

const PAGE_SIZE = 10;

function MerchantSection({ merchant, selectedCategory, onBuy }: { merchant: any; selectedCategory: string; onBuy: (p: any) => void }) {
  const { data: products = [], isLoading } = trpc.merchants.listProducts.useQuery({
    merchantId: merchant.userId,
    category: selectedCategory !== "全部" ? selectedCategory : undefined,
  });

  const layout: LayoutMode = (merchant.listingLayout as LayoutMode) ?? "grid2";
  const fbRaw = merchant.facebook ?? "";
  const messengerLink = fbRaw
    ? (fbRaw.startsWith("http") ? fbRaw : `https://m.me/${fbRaw}`)
    : "";
  const visible = products.filter((p: any) => p.status === "active" && p.stock > 0);
  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const [page, setPage] = useState(1);

  useEffect(() => { setPage(1); }, [selectedCategory, merchant.userId]);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [totalPages, page]);

  if (!isLoading && visible.length === 0) return null;

  const start = (page - 1) * PAGE_SIZE;
  const pageItems = visible.slice(start, start + PAGE_SIZE);

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3 px-1">
        {merchant.merchantIcon ? (
          <img src={merchant.merchantIcon} alt={merchant.merchantName} className="w-7 h-7 rounded-full object-cover border border-amber-200" />
        ) : (
          <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
            <Store className="w-3.5 h-3.5 text-amber-500" />
          </div>
        )}
        <span className="font-semibold text-sm text-gray-700">{merchant.merchantName}</span>
        {!isLoading && (
          <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full ml-auto">{visible.length} 件</span>
        )}
      </div>
      {isLoading ? (
        <div className="text-center py-6 text-2xl animate-spin">💰</div>
      ) : (
        <>
          <ProductsGrid products={pageItems} layout={layout} whatsapp={merchant.whatsapp ?? ""} messengerLink={messengerLink} onBuy={onBuy} />
          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-2 mt-3 px-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full border border-amber-200 bg-white text-amber-700 hover:bg-amber-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-3.5 h-3.5" />上一頁
              </button>
              <span className="text-xs text-gray-500">第 {page} / {totalPages} 頁</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full border border-amber-200 bg-white text-amber-700 hover:bg-amber-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                下一頁<ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function Merchants() {
  const [selectedMerchantId, setSelectedMerchantId] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("全部");
  const [buyingProduct, setBuyingProduct] = useState<any | null>(null);
  const { data: merchants = [], isLoading } = trpc.merchants.listApprovedMerchants.useQuery();
  const { data: siteSettings } = trpc.siteSettings.getAll.useQuery(undefined, { staleTime: 5 * 60 * 1000 });
  const CATEGORIES = ["全部", ...parseCategories(siteSettings as Record<string, string> | undefined)];

  const displayedMerchants = selectedMerchantId
    ? merchants.filter((m: any) => m.userId === selectedMerchantId)
    : merchants;

  const selectedMerchant = merchants.find((m: any) => m.userId === selectedMerchantId);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container max-w-2xl px-4 pt-4 pb-28">

        {/* 標題 */}
        <div className="flex items-center gap-2 mb-4">
          <Store className="w-5 h-5 text-amber-500" />
          <h1 className="text-lg font-bold text-gray-800">商戶市集</h1>
          {selectedMerchant && (
            <button
              onClick={() => setSelectedMerchantId(null)}
              className="ml-auto flex items-center gap-1 text-xs bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full hover:bg-amber-200 transition-colors"
            >
              <X className="w-3 h-3" />
              清除篩選
            </button>
          )}
        </div>

        {/* 商戶篩選列 */}
        {!isLoading && merchants.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-2 mb-3" style={{ scrollbarWidth: "none" }}>
            <button
              onClick={() => setSelectedMerchantId(null)}
              className={`shrink-0 flex flex-col items-center gap-1 px-2 pt-1.5 pb-1 rounded-xl transition-colors ${
                selectedMerchantId === null ? "bg-amber-500 shadow-sm" : "bg-white border border-amber-100 hover:bg-amber-50"
              }`}
            >
              <div className={`w-9 h-9 rounded-full flex items-center justify-center ${selectedMerchantId === null ? "bg-amber-400" : "bg-amber-100"}`}>
                <Store className={`w-4 h-4 ${selectedMerchantId === null ? "text-white" : "text-amber-500"}`} />
              </div>
              <span className={`text-xs font-medium whitespace-nowrap ${selectedMerchantId === null ? "text-white" : "text-gray-600"}`}>全部</span>
            </button>

            {(merchants as any[]).map((m) => {
              const active = selectedMerchantId === m.userId;
              return (
                <button
                  key={m.userId}
                  onClick={() => setSelectedMerchantId(active ? null : m.userId)}
                  className={`shrink-0 flex flex-col items-center gap-1 px-2 pt-1.5 pb-1 rounded-xl transition-colors ${
                    active ? "bg-amber-500 shadow-sm" : "bg-white border border-amber-100 hover:bg-amber-50"
                  }`}
                >
                  {m.merchantIcon ? (
                    <img src={m.merchantIcon} alt={m.merchantName} className={`w-9 h-9 rounded-full object-cover border-2 ${active ? "border-white/60" : "border-amber-200"}`} />
                  ) : (
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center ${active ? "bg-amber-400" : "bg-amber-100"}`}>
                      <Store className={`w-4 h-4 ${active ? "text-white" : "text-amber-500"}`} />
                    </div>
                  )}
                  <span className={`text-xs font-medium whitespace-nowrap max-w-[56px] truncate ${active ? "text-white" : "text-gray-600"}`}>
                    {m.merchantName}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* 類別篩選 */}
        <div className="mb-4">
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="bg-white border-amber-200 text-amber-800 h-9 text-sm">
              <SelectValue placeholder="選擇品種" />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map(cat => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 內容 */}
        {isLoading ? (
          <div className="text-center py-16 text-4xl animate-spin">💰</div>
        ) : displayedMerchants.length === 0 ? (
          <div className="text-center py-16">
            <Store className="w-12 h-12 text-amber-200 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">暫無商戶</p>
          </div>
        ) : (
          (displayedMerchants as any[]).map((m) => (
            <MerchantSection key={m.userId} merchant={m} selectedCategory={selectedCategory} onBuy={setBuyingProduct} />
          ))
        )}
      </div>

      {buyingProduct && <BuyDialog product={buyingProduct} onClose={() => setBuyingProduct(null)} />}
    </div>
  );
}
