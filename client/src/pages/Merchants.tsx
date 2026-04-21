import { useState } from "react";
import { trpc } from "@/lib/trpc";
import Header from "@/components/Header";
import { Store, MessageCircle, Package, X } from "lucide-react";
import { buildWhatsAppUrl } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "wouter";

const CATEGORIES = ["全部", "古幣", "紀念幣", "外幣", "銀幣", "金幣", "其他"];
type LayoutMode = "list" | "grid2" | "grid3" | "big";

function WhatsAppBtn({ whatsapp, title, price, id }: { whatsapp: string; title: string; price?: number; id?: number }) {
  const productUrl = id ? `${window.location.origin}/merchant-products/${id}` : "";
  const msg = `你好，我想查詢以下商品：\n商品：${title}${price !== undefined ? `\n價錢：HK$${price.toLocaleString()}` : ""}${productUrl ? `\n連結：${productUrl}` : ""}`;
  const link = buildWhatsAppUrl(whatsapp, msg);
  return (
    <a href={link} target="_blank" rel="noopener noreferrer"
      className="flex items-center gap-1 text-xs bg-green-500 hover:bg-green-600 text-white px-2.5 py-1.5 rounded-full transition-colors shrink-0">
      <MessageCircle className="w-3 h-3" />WhatsApp
    </a>
  );
}

function ProductCard({ p, layout, whatsapp, merchantId }: { p: any; layout: LayoutMode; whatsapp: string; merchantId: number }) {
  const imgs: string[] = (() => { try { return p.images ? JSON.parse(p.images) : []; } catch { return []; } })();
  const price = parseFloat(p.price ?? "0");
  const href = `/merchant-products/${p.id}`;

  if (layout === "list") return (
    <Link href={href}>
      <div className="bg-white rounded-xl border border-amber-100 shadow-sm p-3 flex gap-3 items-start cursor-pointer hover:border-amber-300 transition-colors">
        {imgs[0] ? <img src={imgs[0]} alt={p.title} className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
          : <div className="w-16 h-16 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0"><Package className="w-6 h-6 text-amber-200" /></div>}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gray-800 line-clamp-1">{p.title}</h3>
          {p.category && <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">{p.category}</span>}
          {p.description && <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">{p.description}</p>}
          <div className="flex items-center justify-between mt-1.5">
            <span className="font-bold text-amber-600 text-sm">{p.currency ?? "HKD"} ${price.toLocaleString()}</span>
            {p.stock > 0 && whatsapp ? <WhatsAppBtn whatsapp={whatsapp} title={p.title} price={price} id={p.id} /> : p.stock <= 0 ? <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">已售出</span> : null}
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
            {p.category && <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full shrink-0">{p.category}</span>}
          </div>
          {p.description && <p className="text-xs text-gray-500 line-clamp-3">{p.description}</p>}
          <div className="flex items-center justify-between pt-1">
            <span className="font-bold text-amber-600 text-base">{p.currency ?? "HKD"} ${price.toLocaleString()}</span>
            {p.stock > 0 && whatsapp ? <WhatsAppBtn whatsapp={whatsapp} title={p.title} price={price} id={p.id} /> : p.stock <= 0 ? <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full">已售出</span> : null}
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
        <div className="p-1.5 flex flex-col gap-0.5 flex-1">
          <h3 className="text-[10px] font-semibold text-gray-800 line-clamp-2 leading-tight">{p.title}</h3>
          <span className="text-[10px] font-bold text-amber-600">${price.toLocaleString()}</span>
          {p.stock > 0 ? <span className="mt-auto text-[9px] py-0.5 bg-amber-50 text-amber-600 rounded text-center">查詢</span>
            : <span className="mt-auto text-[9px] py-0.5 bg-gray-100 text-gray-400 rounded text-center">已售出</span>}
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
            {p.category && <span className="text-[10px] bg-amber-100 text-amber-700 px-1 py-0.5 rounded-full shrink-0">{p.category}</span>}
          </div>
          {p.description && <p className="text-[10px] text-gray-500 line-clamp-2">{p.description}</p>}
          <div className="mt-auto pt-1.5 flex items-center justify-between gap-1">
            <span className="font-bold text-amber-600 text-xs">{p.currency ?? "HKD"} ${price.toLocaleString()}</span>
            {p.stock > 0 && whatsapp ? <WhatsAppBtn whatsapp={whatsapp} title={p.title} price={price} id={p.id} /> : p.stock <= 0 ? <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">已售出</span> : null}
          </div>
        </div>
      </div>
    </Link>
  );
}

function ProductsGrid({ products, layout, whatsapp, merchantId }: { products: any[]; layout: LayoutMode; whatsapp: string; merchantId: number }) {
  if (layout === "list") return <div className="space-y-2">{products.map(p => <ProductCard key={p.id} p={p} layout={layout} whatsapp={whatsapp} merchantId={merchantId} />)}</div>;
  if (layout === "big") return <div className="space-y-4">{products.map(p => <ProductCard key={p.id} p={p} layout={layout} whatsapp={whatsapp} merchantId={merchantId} />)}</div>;
  if (layout === "grid3") return <div className="grid grid-cols-3 gap-2">{products.map(p => <ProductCard key={p.id} p={p} layout={layout} whatsapp={whatsapp} merchantId={merchantId} />)}</div>;
  return <div className="grid grid-cols-2 gap-3">{products.map(p => <ProductCard key={p.id} p={p} layout={layout} whatsapp={whatsapp} merchantId={merchantId} />)}</div>;
}

function MerchantSection({ merchant, selectedCategory }: { merchant: any; selectedCategory: string }) {
  const { data: products = [], isLoading } = trpc.merchants.listProducts.useQuery({
    merchantId: merchant.userId,
    category: selectedCategory !== "全部" ? selectedCategory : undefined,
  });

  const layout: LayoutMode = (merchant.listingLayout as LayoutMode) ?? "grid2";
  const visible = products.filter((p: any) => p.status === "active" && p.stock > 0);
  if (!isLoading && visible.length === 0) return null;

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
        <ProductsGrid products={visible} layout={layout} whatsapp={merchant.whatsapp ?? ""} merchantId={merchant.userId} />
      )}
    </div>
  );
}

export default function Merchants() {
  const [selectedMerchantId, setSelectedMerchantId] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("全部");
  const { data: merchants = [], isLoading } = trpc.merchants.listApprovedMerchants.useQuery();

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
            <MerchantSection key={m.userId} merchant={m} selectedCategory={selectedCategory} />
          ))
        )}
      </div>
    </div>
  );
}
