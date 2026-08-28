import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { BookOpen, ChevronRight, Tag, ShieldCheck } from "lucide-react";
import { useSeoMeta } from "@/lib/useSeoMeta";

const CATEGORY_COLORS: Record<string, string> = {
  入門: "bg-green-100 text-green-700",
  評級: "bg-blue-100 text-blue-700",
  拍賣: "bg-amber-100 text-amber-700",
  保養: "bg-purple-100 text-purple-700",
  知識: "bg-rose-100 text-rose-700",
};

export default function Guides() {
  const { data: articles = [], isLoading } = trpc.articles.list.useQuery();
  useSeoMeta({
    title: "香港錢幣收藏知識庫",
    description: "由香港錢幣研究編輯部整理的原創收藏指南，涵蓋錢幣辨偽、PCGS 與 NGC 評級、保存防潮、香港硬幣及拍賣出價實務。",
    ogUrl: "/guides",
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-3xl mx-auto pt-12 pb-24 px-4">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <BookOpen className="w-6 h-6 text-amber-500" />
            <h1 className="text-2xl font-bold">錢幣知識庫</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            由站方審閱的原創文章：收藏入門、評級、保存與拍賣實用指南
          </p>
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs text-amber-800">
            <ShieldCheck className="h-3.5 w-3.5" />
            每篇文章均按公開資料與收藏實務整理
          </div>
          <div className="mt-5 space-y-3 rounded-2xl border border-amber-100 bg-white p-4 text-sm leading-relaxed text-gray-700">
            <p>
              錢幣收藏不只是比較價格。年份、版別、材質、鑄造工藝、保存狀態與來源紀錄，都會影響一枚錢幣的研究價值及市場表現。本知識庫以香港收藏者常見的實際問題為起點，提供可逐步核對的整理方法。
            </p>
            <p>
              初次收藏可由購買清單和香港流通硬幣開始；準備競投前，應先理解成交紀錄、費用與代理出價；處理高價或存疑錢幣時，則應閱讀辨偽、評級及防潮保存指南。文章只作收藏教育參考，不取代實物鑑定或專業意見。
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-16 text-2xl animate-spin">💰</div>
        ) : articles.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>暫無文章</p>
          </div>
        ) : (
          <div className="space-y-3">
            {(articles as any[]).map((a) => (
              <Link
                key={a.id}
                href={`/guides/${a.slug}`}
                className="block bg-white border border-amber-100 rounded-2xl p-4 hover:border-amber-300 hover:shadow-sm transition-all group"
              >
                <div className="flex items-start justify-between gap-3">
                  {a.imageUrl && (
                    <img
                      src={a.imageUrl}
                      alt=""
                      className="h-20 w-28 shrink-0 rounded-xl border border-amber-100 bg-amber-50 object-cover"
                      loading="lazy"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      {a.category && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${CATEGORY_COLORS[a.category] ?? "bg-gray-100 text-gray-600"}`}>
                          <Tag className="w-3 h-3" />{a.category}
                        </span>
                      )}
                      {a.publishedAt && (
                        <span className="text-xs text-muted-foreground">
                          更新於 {new Date(a.updatedAt ?? a.publishedAt).toLocaleDateString("zh-HK")}
                        </span>
                      )}
                    </div>
                    <h2 className="font-semibold text-base text-gray-900 group-hover:text-amber-700 transition-colors line-clamp-2">
                      {a.title}
                    </h2>
                    {a.excerpt && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{a.excerpt}</p>
                    )}
                  </div>
                  <ChevronRight className="w-5 h-5 text-amber-400 shrink-0 mt-1 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            ))}
          </div>
        )}

        <section className="mt-10 rounded-2xl bg-amber-50/70 p-5" aria-labelledby="editorial-standard">
          <h2 id="editorial-standard" className="mb-3 text-lg font-semibold text-gray-900">我們如何整理收藏資料</h2>
          <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-gray-700">
            <li>把規格、品相、來源與成交背景分開說明，避免用單一價格概括所有同名錢幣。</li>
            <li>優先提供不會損害藏品的檢查及保存方法；有真偽疑問時，建議停止交易並尋求實物鑑定。</li>
            <li>文章會按公開資料與收藏實務更新，並在頁面標示最近更新日期及延伸閱讀。</li>
          </ul>
        </section>

        <div className="mt-8 pt-6 border-t border-border text-xs text-muted-foreground flex gap-4">
          <Link href="/about" className="hover:text-amber-600 transition-colors underline">關於我們</Link>
          <Link href="/" className="hover:text-amber-600 transition-colors underline">返回首頁</Link>
        </div>
      </div>
    </div>
  );
}
