import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import Header from "@/components/Header";
import { Store, ChevronRight, Gavel, Package, Search, X } from "lucide-react";
import { Link } from "wouter";

const CATEGORY_COLORS: Record<string, string> = {
  "香港硬幣": "bg-amber-100 text-amber-700",
  "中國硬幣": "bg-red-100 text-red-700",
  "外國硬幣": "bg-blue-100 text-blue-700",
  "紀念幣": "bg-purple-100 text-purple-700",
  "銀幣": "bg-gray-100 text-gray-600",
  "金幣": "bg-yellow-100 text-yellow-700",
  "紙幣": "bg-green-100 text-green-700",
  "古錢": "bg-orange-100 text-orange-700",
};

function getCategoryClass(cat: string) {
  return CATEGORY_COLORS[cat.trim()] ?? "bg-slate-100 text-slate-600";
}

export default function Merchants() {
  const { data: merchants = [], isLoading } = trpc.merchants.listApprovedMerchants.useQuery();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const allCategories = useMemo(() => {
    const set = new Set<string>();
    (merchants as any[]).forEach((m) => {
      if (m.categories) {
        (m.categories as string).split(",").forEach((c: string) => {
          const t = c.trim();
          if (t) set.add(t);
        });
      }
    });
    return Array.from(set).sort();
  }, [merchants]);

  const filtered = useMemo(() => {
    let list = merchants as any[];
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((m) =>
        m.merchantName?.toLowerCase().includes(q) ||
        m.selfIntro?.toLowerCase().includes(q) ||
        m.categories?.toLowerCase().includes(q)
      );
    }
    if (activeCategory) {
      list = list.filter((m) =>
        m.categories?.split(",").some((c: string) => c.trim() === activeCategory)
      );
    }
    return list;
  }, [merchants, search, activeCategory]);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* 頁首 */}
      <div className="sticky top-16 z-10 bg-background/95 backdrop-blur border-b border-amber-100">
        <div className="max-w-2xl mx-auto px-4 pt-3 pb-2 space-y-2">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-500 flex items-center justify-center shadow-sm">
                <Store className="w-4 h-4 text-white" />
              </div>
              <h1 className="text-lg font-bold text-gray-900">商戶市集</h1>
            </div>
            {!isLoading && (
              <span className="text-xs text-gray-400 font-medium">
                {(merchants as any[]).length} 間商戶
              </span>
            )}
            {/* 搜尋框 */}
            <div className="flex-1 relative ml-auto max-w-[180px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜尋商戶…"
                className="w-full pl-7 pr-7 py-1.5 text-xs rounded-xl border border-gray-200 bg-white focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-200 transition-all"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2">
                  <X className="w-3 h-3 text-gray-400" />
                </button>
              )}
            </div>
          </div>

          {/* 分類篩選 */}
          {allCategories.length > 0 && (
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
              <button
                onClick={() => setActiveCategory(null)}
                className={`shrink-0 text-[11px] font-semibold px-3 py-1 rounded-full border transition-all ${
                  !activeCategory
                    ? "bg-amber-500 text-white border-amber-500"
                    : "bg-white text-gray-500 border-gray-200 hover:border-amber-300"
                }`}
              >
                全部
              </button>
              {allCategories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
                  className={`shrink-0 text-[11px] font-semibold px-3 py-1 rounded-full border transition-all ${
                    activeCategory === cat
                      ? "bg-amber-500 text-white border-amber-500"
                      : "bg-white text-gray-500 border-gray-200 hover:border-amber-300"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-4 pb-28 space-y-[5px]">
        {isLoading ? (
          <div className="text-center py-20 text-4xl animate-spin">🏪</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <Store className="w-12 h-12 text-amber-200 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">{search || activeCategory ? "找不到符合的商戶" : "暫無商戶"}</p>
          </div>
        ) : (
          filtered.map((m: any, idx: number) => {
            const cats = m.categories
              ? (m.categories as string).split(",").map((c: string) => c.trim()).filter(Boolean)
              : [];
            const hasAuctions = (m.auctionCount ?? 0) > 0;
            const hasProducts = (m.productCount ?? 0) > 0;
            const isTop = idx < 3;

            return (
              <Link key={m.userId} href={`/merchants/${m.userId}`}>
                <div className={`group relative bg-white rounded-2xl border shadow-sm hover:shadow-md transition-all cursor-pointer overflow-hidden ${
                  isTop ? "border-amber-200" : "border-gray-100"
                }`}>
                  {/* 左側漸層色條 */}
                  <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                    hasAuctions
                      ? "bg-gradient-to-b from-purple-400 to-purple-600"
                      : hasProducts
                      ? "bg-gradient-to-b from-amber-400 to-amber-600"
                      : "bg-gradient-to-b from-gray-200 to-gray-300"
                  }`} />

                  <div className="flex items-start gap-3.5 pl-5 pr-4 py-4">
                    {/* 頭像 */}
                    <div className="relative shrink-0">
                      {m.merchantIcon ? (
                        <img
                          src={m.merchantIcon}
                          alt={m.merchantName}
                          className="w-14 h-14 rounded-2xl object-cover border-2 border-amber-100 shadow-sm"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-100 to-amber-200 flex items-center justify-center shadow-sm">
                          <Store className="w-6 h-6 text-amber-500" />
                        </div>
                      )}
                      {isTop && (
                        <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center shadow-sm">
                          <span className="text-[9px] font-black text-white">{idx + 1}</span>
                        </div>
                      )}
                    </div>

                    {/* 主內容 */}
                    <div className="flex-1 min-w-0 space-y-1.5">
                      {/* 名稱 + 箭頭 */}
                      <div className="flex items-start gap-2">
                        <h2 className="font-bold text-gray-900 text-sm leading-tight flex-1">{m.merchantName}</h2>
                        <ChevronRight className="w-4 h-4 text-amber-400 shrink-0 mt-0.5 group-hover:translate-x-0.5 transition-transform" />
                      </div>

                      {/* 分類標籤 */}
                      {cats.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {cats.slice(0, 3).map((cat: string) => (
                            <span key={cat} className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${getCategoryClass(cat)}`}>
                              {cat}
                            </span>
                          ))}
                          {cats.length > 3 && (
                            <span className="text-[10px] text-gray-400">+{cats.length - 3}</span>
                          )}
                        </div>
                      )}

                      {/* 簡介 */}
                      {m.selfIntro && (
                        <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{m.selfIntro}</p>
                      )}

                      {/* 活動數據 */}
                      <div className="flex items-center gap-3 pt-0.5">
                        <div className={`flex items-center gap-1 text-[11px] font-semibold ${
                          hasAuctions ? "text-purple-600" : "text-gray-300"
                        }`}>
                          <Gavel className="w-3 h-3" />
                          <span>{m.auctionCount ?? 0} 拍賣</span>
                        </div>
                        <div className={`flex items-center gap-1 text-[11px] font-semibold ${
                          hasProducts ? "text-amber-600" : "text-gray-300"
                        }`}>
                          <Package className="w-3 h-3" />
                          <span>{m.productCount ?? 0} 商品</span>
                        </div>
                        {!hasAuctions && !hasProducts && (
                          <span className="text-[11px] text-gray-300">暫無上架</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
