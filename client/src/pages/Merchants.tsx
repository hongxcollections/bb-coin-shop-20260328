import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import Header from "@/components/Header";
import ImageLightbox from "@/components/ImageLightbox";
import { Store, ChevronRight, Gavel, Package, Search, X, MessageCircle } from "lucide-react";
import { Link, useLocation } from "wouter";

type Thumb = { url: string; type: string; id: number };

function buildWaNumber(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 8) return `852${digits}`;
  return digits;
}

const WhatsAppIcon = () => (
  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current shrink-0" aria-hidden="true">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

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
  const [, navigate] = useLocation();
  const [showMerchantFlow, setShowMerchantFlow] = useState(false);

  const allCategories = useMemo(() => {
    const set = new Set<string>();
    (merchants as any[]).forEach((m) => {
      if (m.categories) {
        (m.categories as string).split(",").forEach((c: string) => {
          const t = c.trim();
          if (t && /[\u4e00-\u9fa5a-zA-Z0-9]/.test(t)) set.add(t);
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

      {/* 商戶申請流程 — 獨立頂部列，跟足主頁頂部同款 sky-600 */}
      <div className="max-w-2xl mx-auto px-4 pt-2 pb-0 flex justify-end">
        <button
          onClick={() => setShowMerchantFlow(true)}
          className="inline-flex items-center gap-1.5 bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white text-xs font-semibold px-3 py-1.5 rounded-full shadow transition-colors cursor-pointer select-none"
        >
          📋 商戶申請流程
        </button>
      </div>

      {/* 商戶申請流程圖片燈箱 */}
      {showMerchantFlow && (
        <ImageLightbox
          images={["/merchant-apply-steps.png"]}
          alt="商戶申請流程"
          onClose={() => setShowMerchantFlow(false)}
        />
      )}

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

      <div className="max-w-2xl mx-auto px-4 pt-4 pb-28 flex flex-col" style={{ gap: "5px" }}>
        {isLoading ? (
          <div className="text-center py-20 text-4xl animate-spin">💰</div>
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
              <div
                key={m.userId}
                className={`group relative bg-white rounded-2xl border shadow-sm hover:shadow-md transition-all cursor-pointer overflow-hidden ${isTop ? "border-amber-200" : "border-gray-100"}`}
                onClick={() => { navigate(`/merchants/${m.userId}`); window.scrollTo(0, 0); }}
              >
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

                      {/* 活動數據 + WhatsApp */}
                      <div className="flex items-center gap-2 pt-0.5 flex-wrap">
                        <div className={`flex items-center gap-1 text-[11px] font-semibold ${
                          hasAuctions ? "text-purple-600" : "text-gray-300"
                        }`}>
                          <Gavel className="w-3 h-3 shrink-0" />
                          <span>{m.auctionCount ?? 0} 拍賣</span>
                        </div>
                        <div className={`flex items-center gap-1 text-[11px] font-semibold ${
                          hasProducts ? "text-amber-600" : "text-gray-300"
                        }`}>
                          <Package className="w-3 h-3 shrink-0" />
                          <span>{m.productCount ?? 0} 商品</span>
                        </div>
                        {m.whatsapp && (
                          <a
                            href={`https://wa.me/${buildWaNumber(m.whatsapp as string)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1 text-[11px] font-semibold text-[#25D366] bg-[#25D366]/10 hover:bg-[#25D366]/20 px-2 py-0.5 rounded-full transition-colors shrink-0"
                          >
                            <WhatsAppIcon />
                            聯絡
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 縮圖列（拍賣優先，不足補商品，最多5張，可點擊跳到商品頁） */}
                  {(m.auctionThumbnails as Thumb[])?.length > 0 && (
                    <div className="flex gap-1.5 px-3 pb-3">
                      {(m.auctionThumbnails as Thumb[]).map((t, i: number) => (
                        <a
                          key={i}
                          href={t.type === 'auction' ? `/auctions/${t.id}` : `/merchant-products/${t.id}`}
                          onClick={(e) => { e.stopPropagation(); window.scrollTo(0, 0); }}
                          className="relative flex-1 min-w-0 aspect-square rounded-lg overflow-hidden bg-amber-50 border border-amber-100 block"
                          style={{ maxWidth: 64 }}
                        >
                          <img src={t.url} alt="" className="w-full h-full object-cover" loading="lazy" />
                          <span className={`absolute bottom-0 left-0 right-0 text-center text-[8px] font-bold leading-tight py-0.5 ${t.type === 'auction' ? 'bg-purple-600/80 text-white' : 'bg-amber-500/80 text-white'}`}>
                            {t.type === 'auction' ? '拍賣' : '出售'}
                          </span>
                        </a>
                      ))}
                      {(() => {
                        const total = (m.auctionCount ?? 0) + (m.productCount ?? 0);
                        const shown = (m.auctionThumbnails as Thumb[]).length;
                        const remaining = total - shown;
                        return remaining > 0 ? (
                          <div className="flex-1 min-w-0 aspect-square rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center" style={{ maxWidth: 64 }}>
                            <span className="text-[10px] font-bold text-amber-400">+{remaining}</span>
                          </div>
                        ) : null;
                      })()}
                    </div>
                  )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
