import { useState } from "react";
import { trpc } from "@/lib/trpc";
import Header from "@/components/Header";
import { Store, Search, MessageCircle, ChevronDown, ChevronUp, Package } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const CATEGORIES = ["全部", "古幣", "紀念幣", "外幣", "銀幣", "金幣", "其他"];

function ProductCard({ product }: { product: any }) {
  const images: string[] = (() => {
    try { return product.images ? JSON.parse(product.images) : []; } catch { return []; }
  })();
  const price = parseFloat(product.price ?? "0");
  const currency = product.currency ?? "HKD";

  const whatsappLink = product.whatsapp
    ? `https://wa.me/${product.whatsapp.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(`你好，我想查詢商品：${product.title}`)}`
    : null;

  return (
    <div className="bg-white rounded-xl border border-amber-100 shadow-sm overflow-hidden flex flex-col">
      {images.length > 0 ? (
        <div className="aspect-square w-full overflow-hidden bg-amber-50">
          <img src={images[0]} alt={product.title} className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className="aspect-square w-full bg-amber-50 flex items-center justify-center">
          <Package className="w-12 h-12 text-amber-200" />
        </div>
      )}
      <div className="p-3 flex flex-col gap-1 flex-1">
        <div className="flex items-start justify-between gap-1">
          <h3 className="text-sm font-semibold text-gray-800 leading-snug line-clamp-2 flex-1">{product.title}</h3>
          {product.category && (
            <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full shrink-0">{product.category}</span>
          )}
        </div>
        {product.description && (
          <p className="text-xs text-gray-500 line-clamp-2">{product.description}</p>
        )}
        <div className="mt-auto pt-2 flex items-center justify-between gap-2">
          <span className="font-bold text-amber-600 text-base">
            {currency} ${price.toLocaleString()}
          </span>
          {product.stock <= 0 ? (
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full">已售出</span>
          ) : whatsappLink ? (
            <a
              href={whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs bg-green-500 hover:bg-green-600 text-white px-2.5 py-1.5 rounded-full transition-colors"
            >
              <MessageCircle className="w-3 h-3" />
              WhatsApp
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function MerchantSection({ merchant, selectedCategory }: { merchant: any; selectedCategory: string }) {
  const [expanded, setExpanded] = useState(true);
  const { data: products = [], isLoading } = trpc.merchants.listProducts.useQuery({
    merchantId: merchant.userId,
    category: selectedCategory !== "全部" ? selectedCategory : undefined,
  });

  const visible = products.filter((p: any) => p.stock > 0 || p.status === "active");
  if (!isLoading && visible.length === 0) return null;

  return (
    <div className="mb-6">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-3 py-3 px-1 text-left"
      >
        {merchant.merchantIcon ? (
          <img src={merchant.merchantIcon} alt={merchant.merchantName} className="w-10 h-10 rounded-full object-cover border-2 border-amber-200" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
            <Store className="w-5 h-5 text-amber-500" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="font-bold text-gray-800 text-sm">{merchant.merchantName}</div>
          {merchant.selfIntro && <div className="text-xs text-gray-500 truncate">{merchant.selfIntro}</div>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
            {isLoading ? "…" : `${visible.length} 件`}
          </span>
          {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </button>

      {expanded && (
        isLoading ? (
          <div className="text-center py-6 text-2xl animate-spin">💰</div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {visible.map((p: any) => <ProductCard key={p.id} product={p} />)}
          </div>
        )
      )}
    </div>
  );
}

export default function Merchants() {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("全部");
  const { data: merchants = [], isLoading } = trpc.merchants.listApprovedMerchants.useQuery();

  const filtered = merchants.filter((m: any) =>
    !search || m.merchantName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container max-w-2xl px-4 pt-4 pb-28">
        <div className="flex items-center gap-2 mb-4">
          <Store className="w-5 h-5 text-amber-500" />
          <h1 className="text-lg font-bold text-gray-800">商戶市集</h1>
        </div>

        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="搜尋商戶名稱..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 bg-white border-amber-100"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-none">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                selectedCategory === cat
                  ? "bg-amber-500 text-white"
                  : "bg-white border border-amber-200 text-amber-700 hover:bg-amber-50"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="text-center py-16 text-4xl animate-spin">💰</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Store className="w-12 h-12 text-amber-200 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">暫無商戶</p>
          </div>
        ) : (
          filtered.map((m: any) => (
            <MerchantSection key={m.userId} merchant={m} selectedCategory={selectedCategory} />
          ))
        )}
      </div>
    </div>
  );
}
