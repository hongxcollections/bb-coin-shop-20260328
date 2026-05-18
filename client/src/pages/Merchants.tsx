import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { sanitizeUserText, parseCategories } from "@/lib/utils";
import Header from "@/components/Header";
import ImageLightbox from "@/components/ImageLightbox";
import ChatRoomDialog from "@/components/ChatRoomDialog";
import { useAuth } from "@/_core/hooks/useAuth";
import { Store, ChevronRight, Gavel, Package, Search, X, CalendarClock, MessageCircle } from "lucide-react";
import { useLocation } from "wouter";

type Thumb = { url: string; type: string; id: number };

function buildWaNumber(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 8) return `852${digits}`;
  return digits;
}

const WhatsAppIcon = () => (
  <svg viewBox="0 0 24 24" className="w-3 h-3 fill-current shrink-0" aria-hidden="true">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

const CATEGORY_COLORS: Record<string, string> = {
  "香港硬幣": "bg-amber-50 text-amber-700 border-amber-200",
  "中國硬幣": "bg-red-50 text-red-700 border-red-200",
  "外國硬幣": "bg-blue-50 text-blue-700 border-blue-200",
  "紀念幣": "bg-purple-50 text-purple-700 border-purple-200",
  "銀幣": "bg-slate-50 text-slate-600 border-slate-200",
  "金幣": "bg-yellow-50 text-yellow-700 border-yellow-200",
  "紙幣": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "古錢": "bg-orange-50 text-orange-700 border-orange-200",
};

function getCategoryClass(cat: string) {
  return CATEGORY_COLORS[cat.trim()] ?? "bg-slate-50 text-slate-600 border-slate-200";
}

const RANK_BADGE: Record<number, string> = {
  0: "bg-gradient-to-br from-yellow-400 to-amber-600",
  1: "bg-gradient-to-br from-slate-300 to-slate-500",
  2: "bg-gradient-to-br from-amber-700 to-amber-900",
};

export default function Merchants() {
  const { data: merchants = [], isLoading } = trpc.merchants.listApprovedMerchants.useQuery();
  const { data: activeSessions = [] } = trpc.merchantSessions.listAllActivePublic.useQuery();
  const sessionsByMerchant = useMemo(() => {
    const map = new Map<number, Array<{ slug: string; title: string; endAt: string | Date; itemCount: number; coverImage?: string | null }>>();
    (activeSessions as any[]).forEach((s) => {
      const list = map.get(s.merchantUserId) ?? [];
      list.push({ slug: s.slug, title: s.title, endAt: s.endAt, itemCount: s.itemCount ?? 0, coverImage: s.coverImage });
      map.set(s.merchantUserId, list);
    });
    return map;
  }, [activeSessions]);
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [, navigate] = useLocation();
  const [showMerchantFlow, setShowMerchantFlow] = useState(false);
  const [chatRoomId, setChatRoomId] = useState<number | null>(null);
  const [chatOpeningFor, setChatOpeningFor] = useState<number | null>(null);
  const chatUtils = trpc.useUtils();
  const merchantChat = trpc.chat.openRoomByMerchant.useMutation({
    onSuccess: ({ roomId }) => { setChatRoomId(roomId); setChatOpeningFor(null); },
    onError: (err) => { toast.error(err.message, { className: "bb-toast-err" }); setChatOpeningFor(null); },
  });
  const handleMerchantChat = (e: React.MouseEvent, merchantUserId: number) => {
    e.stopPropagation();
    if (!user) { toast.info("請先登入後才可以使用站內訊息", { className: "bb-toast-info" }); return; }
    setChatOpeningFor(merchantUserId);
    merchantChat.mutate({ merchantId: merchantUserId, productTitle: "" });
  };

  const allCategories = useMemo(() => {
    const set = new Set<string>();
    (merchants as any[]).forEach((m) => {
      parseCategories(m.categories).forEach((c) => set.add(c));
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
        parseCategories(m.categories).includes(activeCategory)
      );
    }
    return list;
  }, [merchants, search, activeCategory]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50/30 via-background to-background">
      <Header />

      {/* 商戶申請流程 — 細小入口 */}
      <div className="container max-w-2xl mx-auto pt-2 pb-0 flex justify-end">
        <button
          onClick={() => setShowMerchantFlow(true)}
          className="inline-flex items-center gap-1.5 bg-gradient-to-br from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white text-xs font-semibold px-3 py-1.5 rounded-full shadow-sm shadow-amber-200 transition-all cursor-pointer select-none"
        >
          📋 商戶申請流程
        </button>
      </div>

      {showMerchantFlow && (
        <ImageLightbox
          images={["/merchant-apply-steps.png?v=3"]}
          alt="商戶申請流程"
          onClose={() => setShowMerchantFlow(false)}
        />
      )}

      {/* 頁首：標題 + 搜尋 + 分類 */}
      <div className="sticky top-16 z-10 bg-background/90 backdrop-blur-md border-b border-amber-100/60">
        <div className="container max-w-2xl mx-auto pt-3 pb-2.5 space-y-2.5">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-2 shrink-0">
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-sm shadow-amber-200">
                <Store className="w-4.5 h-4.5 text-white" />
              </div>
              <div className="leading-tight">
                <h1 className="text-base font-bold text-gray-900">商戶市集</h1>
                {!isLoading && (
                  <p className="text-[10px] text-gray-400 font-medium">{(merchants as any[]).length} 間認證商戶</p>
                )}
              </div>
            </div>

            <div className="flex-1 relative ml-auto">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜尋商戶名 / 簡介 / 分類…"
                className="w-full pl-7 pr-7 py-1.5 text-xs rounded-full border border-gray-200 bg-white focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-all"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  aria-label="清除搜尋"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 hover:bg-gray-100 rounded-full"
                >
                  <X className="w-3 h-3 text-gray-400" />
                </button>
              )}
            </div>
          </div>

          {allCategories.length > 0 && (
            <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide -mx-1 px-1">
              <button
                onClick={() => setActiveCategory(null)}
                className={`shrink-0 text-[11px] font-semibold px-3 py-1 rounded-full border transition-all ${
                  !activeCategory
                    ? "bg-gradient-to-br from-amber-500 to-amber-600 text-white border-amber-500 shadow-sm"
                    : "bg-white text-gray-500 border-gray-200 hover:border-amber-300 hover:text-amber-600"
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
                      ? "bg-gradient-to-br from-amber-500 to-amber-600 text-white border-amber-500 shadow-sm"
                      : "bg-white text-gray-500 border-gray-200 hover:border-amber-300 hover:text-amber-600"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 商戶列表 */}
      <div className="container max-w-2xl mx-auto pt-3 pb-28 flex flex-col gap-2.5">
        {isLoading ? (
          <div className="text-center py-20 text-4xl animate-spin">💰</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <Store className="w-12 h-12 text-amber-200 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">{search || activeCategory ? "找不到符合的商戶" : "暫無商戶"}</p>
          </div>
        ) : (
          filtered.map((m: any, idx: number) => {
            const cats = parseCategories(m.categories);
            const hasAuctions = (m.auctionCount ?? 0) > 0;
            const hasProducts = (m.productCount ?? 0) > 0;
            const isTop = idx < 3;
            const sessions = sessionsByMerchant.get(m.userId) ?? [];
            const thumbs = (m.auctionThumbnails as Thumb[]) ?? [];
            const totalListings = (m.auctionCount ?? 0) + (m.productCount ?? 0);

            return (
              <div
                key={m.userId}
                role="button"
                tabIndex={0}
                aria-label={`進入商戶 ${sanitizeUserText(m.merchantName)}`}
                className={`group relative bg-white rounded-2xl border shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer overflow-hidden focus:outline-none focus:ring-2 focus:ring-amber-300 ${
                  isTop ? "border-amber-200 ring-1 ring-amber-100" : "border-gray-100"
                }`}
                onClick={() => { navigate(`/merchants/${m.userId}`); window.scrollTo(0, 0); }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    navigate(`/merchants/${m.userId}`);
                    window.scrollTo(0, 0);
                  }
                }}
              >
                {/* 左側狀態色條（amber 強：有拍賣；amber 中：有商品；灰：無 listing） */}
                <div
                  aria-hidden="true"
                  className={`absolute left-0 top-0 bottom-0 w-1 ${
                    hasAuctions
                      ? "bg-gradient-to-b from-amber-500 to-amber-700"
                      : hasProducts
                      ? "bg-gradient-to-b from-amber-300 to-amber-500"
                      : "bg-gradient-to-b from-gray-200 to-gray-300"
                  }`}
                />
                {/* 頂部資料區 */}
                <div className="flex items-start gap-3 p-3.5 pl-4">
                  {/* 頭像 + 排名徽章 */}
                  <div className="relative shrink-0">
                    {m.merchantIcon ? (
                      <img
                        src={m.merchantIcon}
                        alt={m.merchantName}
                        className={`w-14 h-14 rounded-2xl object-cover shadow-sm ${
                          isTop ? "ring-2 ring-amber-300 ring-offset-1" : "border border-gray-100"
                        }`}
                      />
                    ) : (
                      <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-100 to-amber-200 flex items-center justify-center shadow-sm ${
                        isTop ? "ring-2 ring-amber-300 ring-offset-1" : ""
                      }`}>
                        <Store className="w-6 h-6 text-amber-500" />
                      </div>
                    )}
                    {isTop && (
                      <div className={`absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center shadow-md border-2 border-white ${RANK_BADGE[idx]}`}>
                        <span className="text-[9px] font-black text-white">{idx + 1}</span>
                      </div>
                    )}
                  </div>

                  {/* 主內容 */}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    {/* 名稱 + 箭頭 */}
                    <div className="flex items-start gap-2">
                      <h2 className="font-bold text-gray-900 text-[15px] leading-tight flex-1 truncate">{sanitizeUserText(m.merchantName)}</h2>
                      <ChevronRight className="w-4 h-4 text-amber-400 shrink-0 mt-0.5 group-hover:translate-x-0.5 transition-transform" />
                    </div>

                    {/* 分類 */}
                    {cats.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {cats.slice(0, 3).map((cat: string) => (
                          <span key={cat} className={`text-[10px] font-semibold px-1.5 py-px rounded border ${getCategoryClass(cat)}`}>
                            {cat}
                          </span>
                        ))}
                        {cats.length > 3 && (
                          <span className="text-[10px] text-gray-400 px-1">+{cats.length - 3}</span>
                        )}
                      </div>
                    )}

                    {/* 簡介 */}
                    {m.selfIntro && (
                      <p className="text-[11.5px] text-gray-500 line-clamp-2 leading-snug whitespace-pre-line">{sanitizeUserText(m.selfIntro)}</p>
                    )}

                    {/* 統計資料 + WhatsApp */}
                    <div className="flex items-center gap-2 pt-0.5 flex-wrap">
                      <div className="inline-flex items-center divide-x divide-gray-200 bg-gray-50 rounded-md text-[11px] font-semibold border border-gray-100">
                        <span className={`flex items-center gap-1 px-2 py-0.5 ${hasAuctions ? "text-amber-700" : "text-gray-300"}`}>
                          <Gavel className="w-3 h-3" />{m.auctionCount ?? 0}
                        </span>
                        <span className={`flex items-center gap-1 px-2 py-0.5 ${hasProducts ? "text-amber-700" : "text-gray-300"}`}>
                          <Package className="w-3 h-3" />{m.productCount ?? 0}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => handleMerchantChat(e, m.userId)}
                        disabled={chatOpeningFor === m.userId}
                        className="flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-100 hover:bg-amber-200 px-2 py-0.5 rounded-md transition-colors shrink-0 border border-amber-200 disabled:opacity-60"
                      >
                        <MessageCircle className="w-3 h-3" />
                        {chatOpeningFor === m.userId ? "..." : "站內訊息"}
                      </button>
                    </div>
                  </div>
                </div>

                {/* 進行中專場 */}
                {sessions.length > 0 && (
                  <div className="px-3 pb-3 -mt-1">
                    <div className="rounded-xl border border-amber-300 bg-gradient-to-br from-amber-50 via-white to-amber-50/60 shadow-sm overflow-hidden">
                      {/* 標題列 */}
                      <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-amber-500 to-amber-600">
                        <span className="relative flex h-2 w-2 shrink-0">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
                        </span>
                        <CalendarClock className="w-3 h-3 text-white/90 shrink-0" />
                        <span className="text-[11px] font-bold text-white tracking-wide">進行中專場</span>
                        {sessions.length > 1 && (
                          <span className="ml-auto text-[10px] font-bold bg-white/25 text-white px-1.5 py-px rounded-full">{sessions.length} 場</span>
                        )}
                      </div>
                      {/* 專場卡片 */}
                      <div className="divide-y divide-amber-100">
                        {sessions.map((s) => {
                          const endMs = new Date(s.endAt).getTime();
                          const diffMs = endMs - Date.now();
                          const diffH = Math.floor(diffMs / (1000 * 60 * 60));
                          const diffD = Math.floor(diffH / 24);
                          const diffM = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                          const isUrgent = diffMs > 0 && diffH < 3;
                          const remaining = diffMs <= 0 ? "即將結束"
                            : diffD >= 1 ? `還剩 ${diffD} 日`
                            : diffH >= 1 ? `還剩 ${diffH} 小時`
                            : `還剩 ${diffM} 分鐘`;
                          return (
                            <a
                              key={s.slug}
                              href={`/s/${m.userId}/${s.slug}`}
                              onClick={(e) => { e.stopPropagation(); window.scrollTo(0, 0); }}
                              className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-amber-50 transition-colors group/s"
                            >
                              {/* 封面縮圖 */}
                              {s.coverImage ? (
                                <img src={s.coverImage} alt="" className="w-11 h-11 rounded-lg object-cover border border-amber-200 shrink-0 shadow-sm" />
                              ) : (
                                <div className="w-11 h-11 rounded-lg bg-gradient-to-br from-amber-300 to-amber-500 flex items-center justify-center shrink-0 shadow-sm">
                                  <CalendarClock className="w-5 h-5 text-white" />
                                </div>
                              )}
                              {/* 文字資訊 */}
                              <div className="flex-1 min-w-0">
                                <p className="text-[13px] font-bold text-amber-900 truncate leading-tight">{sanitizeUserText(s.title)}</p>
                                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                  <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-px rounded-full ${
                                    isUrgent
                                      ? "bg-red-100 text-red-700 border border-red-200"
                                      : "bg-amber-100 text-amber-700 border border-amber-200"
                                  }`}>
                                    {isUrgent && <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shrink-0" />}
                                    {remaining}
                                  </span>
                                  <span className="text-[10px] text-gray-500 font-medium">{s.itemCount} 件商品</span>
                                </div>
                              </div>
                              <ChevronRight className="w-4 h-4 text-amber-500 shrink-0 group-hover/s:translate-x-0.5 transition-transform" />
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* 縮圖列 */}
                {thumbs.length > 0 && (
                  <div className="flex gap-1 px-3.5 pb-3.5">
                    {thumbs.map((t, i: number) => (
                      <a
                        key={i}
                        href={t.type === 'auction' ? `/auctions/${t.id}` : `/merchant-products/${t.id}`}
                        onClick={(e) => { e.stopPropagation(); window.scrollTo(0, 0); }}
                        className="relative flex-1 min-w-0 aspect-square rounded-lg overflow-hidden bg-amber-50 border border-amber-100 block hover:border-amber-300 transition-colors"
                        style={{ maxWidth: 64 }}
                      >
                        <img src={t.url} alt="" className="w-full h-full object-cover" loading="lazy" />
                        <span className={`absolute bottom-0 left-0 right-0 text-center text-[8px] font-bold leading-tight py-0.5 ${
                          t.type === 'auction' ? 'bg-amber-700/85 text-white' : 'bg-amber-500/85 text-white'
                        }`}>
                          {t.type === 'auction' ? '拍賣' : '出售'}
                        </span>
                      </a>
                    ))}
                    {(() => {
                      const remaining = totalListings - thumbs.length;
                      return remaining > 0 ? (
                        <div className="flex-1 min-w-0 aspect-square rounded-lg bg-gradient-to-br from-amber-50 to-amber-100 border border-amber-200 flex items-center justify-center" style={{ maxWidth: 64 }}>
                          <span className="text-[10px] font-bold text-amber-600">+{remaining}</span>
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
      {chatRoomId !== null && (
        <ChatRoomDialog
          roomId={chatRoomId}
          open={chatRoomId !== null}
          onOpenChange={(o) => {
            if (!o) { setChatRoomId(null); chatUtils.chat.unreadTotal.invalidate(); chatUtils.chat.listMyRooms.invalidate(); }
          }}
        />
      )}
    </div>
  );
}
