import { useEffect, useMemo, useState } from "react";
import { Link, useRoute } from "wouter";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import { trpc } from "@/lib/trpc";
import { Calendar, Clock, Package, Store } from "lucide-react";

function getCurrencySymbol(c?: string) {
  switch (c) {
    case "USD": return "US$"; case "CNY": return "¥"; case "GBP": return "£";
    case "EUR": return "€"; case "JPY": return "¥"; default: return "HK$";
  }
}

function useNow() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  return now;
}

function fmtCountdown(target: number, now: number): string {
  const diff = Math.max(0, Math.floor((target - now) / 1000));
  if (diff === 0) return "已結束";
  const d = Math.floor(diff / 86400);
  const h = Math.floor((diff % 86400) / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const s = diff % 60;
  if (d > 0) return `${d}日 ${h}小時 ${m}分`;
  if (h > 0) return `${h}小時 ${m}分 ${s}秒`;
  return `${m}分 ${s}秒`;
}

export default function MerchantSessionPublic() {
  const [, params] = useRoute<{ userId: string; slug: string }>("/s/:userId/:slug");
  const merchantUserId = params ? parseInt(params.userId, 10) : 0;
  const slug = params?.slug || "";
  const now = useNow();

  const { data, isLoading, error } = trpc.merchantSessions.getPublic.useQuery(
    { merchantUserId, slug },
    { enabled: merchantUserId > 0 && !!slug, retry: false }
  );

  const session = data?.session;
  const auctions = data?.auctions || [];

  const stats = useMemo(() => {
    const active = auctions.filter((a: any) => a.status === "active").length;
    const ended = auctions.filter((a: any) => a.status === "ended" || a.status === "sold").length;
    return { total: auctions.length, active, ended };
  }, [auctions]);

  if (isLoading) {
    return <div className="min-h-screen bg-amber-50/30"><Header /><div className="text-center py-12">載入中...</div><BottomNav /></div>;
  }
  if (error || !session) {
    return (
      <div className="min-h-screen bg-amber-50/30">
        <Header />
        <div className="container mx-auto max-w-3xl px-4 py-12 text-center pb-20">
          <div className="text-5xl mb-3">🤷</div>
          <h1 className="text-xl font-bold text-amber-900 mb-2">專場不存在或未發佈</h1>
          <Link href="/" className="text-amber-700 underline text-sm">返回首頁</Link>
        </div>
        <BottomNav />
      </div>
    );
  }

  const endAtMs = new Date(session.endAt).getTime();
  const isEnded = session.status === "ended" || endAtMs <= now;

  return (
    <div className="min-h-screen bg-amber-50/30">
      <Header />
      <div className="container mx-auto max-w-5xl px-4 py-6 pb-20">
        {/* Hero */}
        <div className="rounded-3xl overflow-hidden bg-gradient-to-br from-amber-600 to-amber-800 text-white shadow-lg mb-4">
          {session.coverImage && (
            <div className="w-full h-48 sm:h-56 overflow-hidden">
              <img src={session.coverImage} alt={session.title} className="w-full h-full object-cover" />
            </div>
          )}
          <div className="p-5 sm:p-6">
            <Link href={`/merchants/${merchantUserId}`}>
              <a className="inline-flex items-center gap-2 text-xs bg-white/20 hover:bg-white/30 px-2.5 py-1 rounded-full mb-3">
                <Store className="w-3 h-3" />
                {data?.merchantName || "商戶"}
              </a>
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold mb-2">{session.title}</h1>
            {session.description && <p className="text-sm sm:text-base text-amber-50/90 whitespace-pre-wrap mb-3">{session.description}</p>}
            <div className="flex flex-wrap gap-3 text-sm">
              <div className="inline-flex items-center gap-1.5 bg-white/15 px-3 py-1.5 rounded-full">
                <Calendar className="w-4 h-4" /> 結束：{new Date(session.endAt).toLocaleString("zh-HK", { hour12: false })}
              </div>
              <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-medium ${isEnded ? "bg-gray-700/50" : "bg-green-500/30"}`}>
                <Clock className="w-4 h-4" /> {isEnded ? "已結束" : `仲有 ${fmtCountdown(endAtMs, now)}`}
              </div>
              <div className="inline-flex items-center gap-1.5 bg-white/15 px-3 py-1.5 rounded-full">
                <Package className="w-4 h-4" /> {stats.total} 件商品
              </div>
            </div>
          </div>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-white border border-amber-100 rounded-xl p-3 text-center">
            <div className="text-xs text-gray-500">總商品</div>
            <div className="text-lg font-bold text-amber-900">{stats.total}</div>
          </div>
          <div className="bg-white border border-green-100 rounded-xl p-3 text-center">
            <div className="text-xs text-gray-500">進行中</div>
            <div className="text-lg font-bold text-green-700">{stats.active}</div>
          </div>
          <div className="bg-white border border-gray-100 rounded-xl p-3 text-center">
            <div className="text-xs text-gray-500">已結束</div>
            <div className="text-lg font-bold text-gray-600">{stats.ended}</div>
          </div>
        </div>

        {/* Items grid */}
        {auctions.length === 0 ? (
          <div className="bg-white border border-amber-100 rounded-2xl p-8 text-center text-gray-500">
            專場仲未加入商品
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {auctions.map((a: any) => (
              <Link key={a.id} href={`/auctions/${a.id}`}>
                <a className="block bg-white border border-amber-100 rounded-xl overflow-hidden hover:shadow-md hover:border-amber-300 transition">
                  <div className="aspect-square bg-amber-50 flex items-center justify-center overflow-hidden">
                    {a.coverImageUrl || a.imageUrl ? (
                      <img src={a.coverImageUrl || a.imageUrl} alt={a.title} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <span className="text-5xl">🪙</span>
                    )}
                  </div>
                  <div className="p-2">
                    <div className="text-xs font-medium text-amber-900 line-clamp-2 mb-1">{a.title}</div>
                    <div className="text-xs text-gray-500">目前出價</div>
                    <div className="text-sm font-bold text-amber-700">
                      {getCurrencySymbol(a.currency)} {Number(a.currentPrice).toLocaleString()}
                    </div>
                    <div className={`text-[10px] mt-1 inline-block px-1.5 py-0.5 rounded ${
                      a.status === "active" ? "bg-green-100 text-green-700"
                      : a.status === "ended" || a.status === "sold" ? "bg-gray-100 text-gray-600"
                      : "bg-amber-100 text-amber-700"
                    }`}>
                      {a.status === "active" ? "進行中" : a.status === "ended" || a.status === "sold" ? "已結束" : a.status}
                    </div>
                  </div>
                </a>
              </Link>
            ))}
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
