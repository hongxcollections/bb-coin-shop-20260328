import { trpc } from "@/lib/trpc";
import Header from "@/components/Header";
import { Store, ChevronRight } from "lucide-react";
import { Link } from "wouter";

export default function Merchants() {
  const { data: merchants = [], isLoading } = trpc.merchants.listApprovedMerchants.useQuery();

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container max-w-2xl px-4 pt-4 pb-28">

        {/* 標題 */}
        <div className="flex items-center gap-3 mb-5">
          <div className="flex items-center gap-2 bg-blue-600 text-white px-3 py-1.5 rounded-lg">
            <Store className="w-5 h-5 text-white" />
            <h1 className="text-lg font-bold">商戶市集</h1>
          </div>
          <p className="text-sm text-gray-400">選擇商戶查看其商品及拍賣</p>
        </div>

        {isLoading ? (
          <div className="text-center py-16 text-4xl animate-spin">💰</div>
        ) : (merchants as any[]).length === 0 ? (
          <div className="text-center py-16">
            <Store className="w-12 h-12 text-amber-200 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">暫無商戶</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {(merchants as any[]).map((m) => (
              <Link key={m.userId} href={`/merchants/${m.userId}`}>
                <div className="bg-white rounded-2xl border border-amber-100 shadow-sm p-4 flex flex-col gap-3 hover:border-amber-300 hover:shadow-md transition-all cursor-pointer min-h-[140px]">
                  {/* 頭像 + 名稱 */}
                  <div className="flex items-center gap-3">
                    {m.merchantIcon ? (
                      <img
                        src={m.merchantIcon}
                        alt={m.merchantName}
                        className="w-11 h-11 rounded-full object-cover border-2 border-amber-200 shrink-0"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                        <Store className="w-5 h-5 text-amber-500" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-800 text-sm leading-tight line-clamp-2">{m.merchantName}</p>
                      {m.categories && (
                        <p className="text-[10px] text-amber-600 truncate mt-0.5">
                          {(m.categories as string).split(",").slice(0, 2).map((c: string) => c.trim()).join(" · ")}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* 簡介 */}
                  {m.selfIntro && (
                    <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed flex-1">{m.selfIntro}</p>
                  )}

                  {/* 進入商店按鈕 */}
                  <div className="flex items-center justify-end mt-auto">
                    <span className="flex items-center gap-0.5 text-xs font-semibold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                      進入商店<ChevronRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
