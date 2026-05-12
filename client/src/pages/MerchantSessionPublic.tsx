import React, { useEffect, useMemo, useState } from "react";
import { Link, useRoute } from "wouter";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import { Badge } from "@/components/ui/badge";
import { ShareMenu, SessionShareMenu } from "@/components/ShareMenu";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Calendar, Clock, Package, Users, Store } from "lucide-react";

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

function AuctionImageOverlay({ endTime, sellerName }: { endTime: Date | string; sellerName?: string | null }) {
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
  if (!txt && !sellerName) return null;
  return (
    <div className="absolute bottom-0 left-0 right-0 bg-black/30 backdrop-blur-sm px-1.5 py-1 flex flex-col gap-0.5">
      {sellerName && <div className="text-[10px] text-white/85 font-medium leading-none truncate">{sellerName}</div>}
      {txt && (
        urgent
          ? <div className="flex items-center gap-0.5 text-[10px] font-black leading-none animate-pulse bg-red-600 text-white px-1 py-0.5 rounded self-start">
              <Clock className="w-2.5 h-2.5 shrink-0" />{txt}
            </div>
          : <div className="flex items-center gap-0.5 text-[10px] font-bold leading-none text-white/90">
              <Clock className="w-2.5 h-2.5 shrink-0" />{txt}
            </div>
      )}
    </div>
  );
}

export default function MerchantSessionPublic() {
  const [, params] = useRoute<{ userId: string; slug: string }>("/s/:userId/:slug");
  const merchantUserId = params ? parseInt(params.userId, 10) : 0;
  const slug = params?.slug || "";
  const now = useNow();
  const { user } = useAuth();

  const { data, isLoading, error } = trpc.merchantSessions.getPublic.useQuery(
    { merchantUserId, slug },
    {
      enabled: merchantUserId > 0 && !!slug,
      retry: false,
      // 每 15 秒 refetch，價錢／最高出價者實時更新
      refetchInterval: 8000,
      refetchOnWindowFocus: true,
    }
  );

  const session = data?.session;
  const auctions = data?.auctions || [];
  const merchantName = data?.merchantName || "商戶";
  const merchantIcon = data?.merchantIcon || null;

  const stats = useMemo(() => {
    const nowMs = Date.now();
    const active = auctions.filter((a: any) => a.status === "active" && new Date(a.endTime).getTime() > nowMs).length;
    const ended = auctions.filter((a: any) => a.status === "ended" || a.status === "sold" || new Date(a.endTime).getTime() <= nowMs).length;
    const myLeading = user?.id ? auctions.filter((a: any) => a.highestBidderId === user.id && new Date(a.endTime).getTime() > nowMs).length : 0;
    return { total: auctions.length, active, ended, myLeading };
  }, [auctions, user?.id]);

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
  // 僅以時間到為準顯示「已結束」，商戶手動「結束（封盤）」唔影響倒數顯示
  const isEnded = endAtMs <= now;
  const endingSoonMs = 60 * 60 * 1000; // 1h

  return (
    <div className="min-h-screen bg-amber-50/30">
      <Header />
      <div className="container mx-auto max-w-3xl px-4 py-4 pb-20">
        {/* Hero */}
        <div className="rounded-3xl overflow-hidden bg-gradient-to-br from-amber-600 to-amber-800 text-white shadow-lg mb-4">
          {session.coverImage && (
            <div className="w-full h-44 sm:h-56 overflow-hidden">
              <img src={session.coverImage} alt={session.title} className="w-full h-full object-cover" />
            </div>
          )}
          <div className="p-5 sm:p-6">
            {/* 商戶 avatar + 名 */}
            <Link href={`/merchants/${merchantUserId}`}>
              <a className="inline-flex items-center gap-2 bg-white/15 hover:bg-white/25 pl-1 pr-3 py-1 rounded-full mb-3 transition">
                <div className="w-7 h-7 rounded-full overflow-hidden bg-white/30 border border-white/50 flex items-center justify-center shrink-0">
                  {merchantIcon ? (
                    <img src={merchantIcon} alt={merchantName} className="w-full h-full object-cover" />
                  ) : (
                    <Store className="w-3.5 h-3.5 text-white" />
                  )}
                </div>
                <span className="text-xs font-medium truncate max-w-[12rem]">{merchantName}</span>
              </a>
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold mb-2">{session.title}</h1>
            {session.description && <p className="text-sm sm:text-base text-amber-50/90 whitespace-pre-wrap mb-3">{session.description}</p>}
            <div className="flex flex-wrap gap-2 text-sm mb-3">
              <div className="inline-flex items-center gap-1.5 bg-white/15 px-3 py-1.5 rounded-full">
                <Calendar className="w-4 h-4" /> 結束：{new Date(session.endAt).toLocaleString("zh-HK", { hour12: false })}
              </div>
              <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-medium ${isEnded ? "bg-gray-700/50" : "bg-green-500/30"}`}>
                <Clock className="w-4 h-4" /> {isEnded ? "已結束" : `仲有 ${fmtCountdown(endAtMs, now)}`}
              </div>
              <div className="inline-flex items-center gap-1.5 bg-white/15 px-3 py-1.5 rounded-full">
                <Package className="w-4 h-4" /> {stats.total} 件
              </div>
            </div>
            {/* Share action */}
            <SessionShareMenu
              merchantUserId={merchantUserId}
              slug={slug}
              title={session.title}
              merchantName={merchantName}
              endTime={session.endAt}
              variant="light"
            />
          </div>
        </div>

        {/* Stats bar */}
        <div className={`grid ${user?.id ? "grid-cols-4" : "grid-cols-3"} gap-2 mb-4`}>
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
          {user?.id && (
            <div className="bg-white border border-emerald-100 rounded-xl p-3 text-center">
              <div className="text-xs text-gray-500">你領先</div>
              <div className="text-lg font-bold text-emerald-700">{stats.myLeading}</div>
            </div>
          )}
        </div>

        {/* Items list — same auction-list-item style as /auctions */}
        {auctions.length === 0 ? (
          <div className="bg-white border border-amber-100 rounded-2xl p-8 text-center text-gray-500">
            專場仲未加入商品
          </div>
        ) : (
          <div className="space-y-3">
            {auctions.map((auction: any) => {
              const nowMs = Date.now();
              const endMs = new Date(auction.endTime).getTime();
              const isItemEnded = endMs <= nowMs;
              const isEndingSoon = !isItemEnded && (endMs - nowMs) <= endingSoonMs;
              const a = auction as { highestBidderName?: string | null; highestBidderId?: number | null; sellerName?: string | null; bidCount?: number | null; startingPrice?: number | string | null; currency?: string; fbShareTemplate?: string | null };
              const curr = getCurrencySymbol(a.currency ?? "HKD");
              const startPrice = a.startingPrice ? Number(a.startingPrice) : null;
              const curPrice = Number(auction.currentPrice);
              const totalDuration = auction.createdAt ? endMs - new Date(auction.createdAt).getTime() : null;
              const elapsed = auction.createdAt ? nowMs - new Date(auction.createdAt).getTime() : null;
              const timeProgress = (totalDuration && elapsed && totalDuration > 0)
                ? Math.min(Math.max(elapsed / totalDuration, 0), 1)
                : null;

              return (
                <Link
                  key={auction.id}
                  href={`/auctions/${auction.id}`}
                  onClick={() => {
                    try {
                      sessionStorage.setItem("bb_auction_from_session", JSON.stringify({
                        merchantUserId, slug, title: session.title, merchantName,
                      }));
                    } catch {}
                  }}
                >
                  <div className={`auction-list-item flex gap-3 p-3 rounded-xl cursor-pointer transition-all border bg-white ${isEndingSoon ? "border-orange-200 bg-orange-50/40 hover:border-orange-300" : "border-amber-100 hover:border-amber-300 hover:bg-amber-50/50"}`}>
                    <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-amber-100 flex items-center justify-center shrink-0 shadow-sm">
                      {auction.images && (auction.images as Array<{ imageUrl: string }>).length > 0 ? (
                        <img
                          src={(auction.images as Array<{ imageUrl: string }>)[0].imageUrl}
                          alt={auction.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-3xl">🪙</span>
                      )}
                      <AuctionImageOverlay endTime={auction.endTime} sellerName={a.sellerName} />
                    </div>

                    <div className="flex-1 flex flex-col justify-between min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-sm line-clamp-1 text-amber-900">{auction.title}</h3>
                          {a.sellerName && (
                            <div className="flex items-center gap-1 mt-0.5">
                              <Store className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                              <span className="text-[10px] text-amber-600 truncate">{a.sellerName}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          {isEndingSoon && (
                            <Badge className="bg-orange-500 text-white text-[9px] px-1.5 py-0.5 animate-pulse">
                              即將結束
                            </Badge>
                          )}
                          <Badge className={`text-[9px] px-1.5 py-0.5 ${!isItemEnded ? "bg-emerald-500 text-white" : "bg-gray-400 text-white"}`}>
                            {!isItemEnded ? "競拍中" : "已結束"}
                          </Badge>
                        </div>
                      </div>

                      <div className="mt-1 flex items-end justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-muted-foreground">目前出價</span>
                            {(() => {
                              if (a.highestBidderId && user?.id && a.highestBidderId === user.id) {
                                return <span className="text-[9px] text-emerald-600 font-bold">(我本人✓)</span>;
                              } else if (a.highestBidderName) {
                                return <span className="text-[9px] text-red-500 font-semibold">({a.highestBidderName})</span>;
                              } else if (!a.highestBidderId) {
                                return <span className="text-[9px] text-gray-400">(未有出價)</span>;
                              }
                              return null;
                            })()}
                          </div>
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-sm font-bold text-amber-600">{curr}{curPrice.toLocaleString()}</span>
                            {startPrice && startPrice !== curPrice && (
                              <span className="text-[10px] text-gray-400 line-through">起{curr}{startPrice.toLocaleString()}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {(a.bidCount ?? 0) > 0 && (
                            <div className="flex items-center gap-0.5 text-[10px] text-amber-700 bg-amber-50 border border-amber-100 px-1.5 py-0.5 rounded-full">
                              <Users className="w-2.5 h-2.5" />
                              <span className="font-semibold">{a.bidCount}</span>
                            </div>
                          )}
                          <div onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                            <ShareMenu
                              auctionId={auction.id}
                              title={auction.title}
                              latestBid={curPrice}
                              currency={a.currency}
                              endTime={auction.endTime}
                              shareTemplate={a.fbShareTemplate}
                            />
                          </div>
                        </div>
                      </div>

                      {timeProgress !== null && !isItemEnded && (
                        <div className="mt-1.5">
                          <div className="h-1 rounded-full bg-amber-100 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${timeProgress > 0.8 ? "bg-red-400" : timeProgress > 0.5 ? "bg-orange-400" : "bg-amber-400"}`}
                              style={{ width: `${timeProgress * 100}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
