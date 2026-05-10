import { useState } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Heart, MessageCircle, Eye, Plus, Search, Sparkles, Camera, Trophy, CheckCircle2, Store, Users } from "lucide-react";

function intentBadge(intent: string) {
  if (intent === "seek_value") return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-0 shadow-sm">求估價</Badge>;
  if (intent === "for_sale") return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-0 shadow-sm">想出讓</Badge>;
  return <Badge className="bg-white/90 text-sky-700 hover:bg-white border-0 shadow-sm backdrop-blur">展示</Badge>;
}

export default function CollectionSquare() {
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [sort, setSort] = useState<"latest" | "hot">("latest");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  // 方案 B：tab — community（純會員分享）/ merchant（商戶上架）
  const [tab, setTab] = useState<"community" | "merchant">("community");

  const { data, isLoading } = trpc.community.list.useQuery({
    intent: "all",
    sort,
    search: search || undefined,
    limit: 30,
    tab,
  });

  const { data: challengeToday } = trpc.dailyChallenge.today.useQuery(undefined, {
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });

  function goNew() {
    if (!isAuthenticated) {
      navigate(`/login?from=${encodeURIComponent("/collection-square/new")}`);
      return;
    }
    navigate("/collection-square/new");
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-white pb-24">
      <Header />

      {/* Sky Hero */}
      <div className="bg-gradient-to-br from-sky-400 via-sky-500 to-cyan-500 text-white">
        <div className="max-w-5xl mx-auto px-4 pt-8 pb-10 relative overflow-hidden">
          <div className="absolute -right-12 -top-12 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -left-8 bottom-0 w-32 h-32 bg-cyan-200/20 rounded-full blur-2xl pointer-events-none" />
          <div className="relative flex items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur px-2.5 py-1 rounded-full text-xs font-medium mb-3">
                <Sparkles className="w-3.5 h-3.5" /> 藏品社區
              </div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight">藏品社區</h1>
              <p className="text-sm md:text-base text-sky-50/95 mt-2 max-w-md">分享你嘅心愛收藏，識多啲同道中人</p>
            </div>
            <Button
              onClick={goNew}
              size="lg"
              className="bg-white text-sky-600 hover:bg-sky-50 shadow-lg font-semibold"
            >
              <Plus className="w-4 h-4 mr-1" /> 發布
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 -mt-5 relative">
        {/* 每日一幣挑戰 入口 banner */}
        <Link href="/daily-challenge">
          <a className="block mb-4">
            <div className="rounded-2xl shadow-lg border border-amber-200 overflow-hidden bg-gradient-to-r from-amber-500 via-orange-400 to-orange-300 hover:shadow-xl transition group cursor-pointer">
              <div className="flex items-center gap-3 p-3 md:p-4">
                {challengeToday?.hasChallenge && challengeToday.challenge?.imageUrl ? (
                  <img
                    src={challengeToday.challenge.imageUrl}
                    alt="今日挑戰"
                    className="w-16 h-16 md:w-20 md:h-20 rounded-xl object-cover bg-white/20 ring-2 ring-white/40 shrink-0"
                  />
                ) : (
                  <div className="w-16 h-16 md:w-20 md:h-20 rounded-xl bg-white/20 ring-2 ring-white/40 flex items-center justify-center shrink-0 text-3xl">
                    🪙
                  </div>
                )}
                <div className="flex-1 min-w-0 text-white">
                  <div className="flex items-center gap-1.5 text-[11px] md:text-xs font-medium opacity-95 whitespace-nowrap">
                    <Trophy className="w-3.5 h-3.5 shrink-0" />
                    <span>每日一藏品挑戰</span>
                    {challengeToday?.hkDate && <span className="opacity-80">· {challengeToday.hkDate}</span>}
                  </div>
                  <div className="font-bold text-base md:text-lg mt-0.5 truncate drop-shadow-sm">
                    {!challengeToday
                      ? "估中今日錢幣，攞分上榜"
                      : !challengeToday.hasChallenge
                      ? "今日尚未發佈挑戰，睇排行榜"
                      : challengeToday.myAnswer
                      ? (challengeToday.myAnswer.isCorrect === 1
                          ? `已答中！+${challengeToday.myAnswer.pointsAwarded} 分`
                          : "今日已作答，睇下答中名單")
                      : "今日題目已開放，估國家+年代+種類"}
                  </div>
                  <div className="text-[11px] md:text-xs text-white/90 mt-0.5 truncate">
                    {challengeToday?.hasChallenge
                      ? `已 ${challengeToday.stats.total} 人作答 · 正確 ${challengeToday.stats.correct} 人 · 1st+5 / 2nd+3 / 3rd+2`
                      : "前 3 名得 🥇🥈🥉 勳章 + 加分上榜"}
                  </div>
                </div>
                <div className="shrink-0 bg-white/25 backdrop-blur text-white text-xs md:text-sm font-semibold px-3 py-1.5 rounded-full group-hover:bg-white/35 transition flex items-center gap-1">
                  {challengeToday?.hasChallenge && challengeToday.myAnswer ? (
                    <><CheckCircle2 className="w-3.5 h-3.5" /> 查看</>
                  ) : (
                    <>立即挑戰 →</>
                  )}
                </div>
              </div>
            </div>
          </a>
        </Link>

        {/* Search + sort floating card */}
        <div className="bg-white rounded-2xl shadow-lg border border-sky-100 p-3 md:p-4 mb-5">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setSearch(searchInput.trim());
            }}
          >
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <Input
                placeholder="搜尋藏品、年代、品種..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="bg-gray-50 border-gray-200 pl-9 focus-visible:ring-sky-300"
              />
            </div>
            <Button type="submit" className="bg-sky-500 hover:bg-sky-600 text-white">搜尋</Button>
            {search && (
              <Button type="button" variant="ghost" onClick={() => { setSearchInput(""); setSearch(""); }}>清除</Button>
            )}
          </form>
          {/* 方案 B：tab bar — 會員分享 / 商戶上架 */}
          <div className="flex items-center gap-2 mt-3 border-b border-gray-100 pb-3">
            <button
              type="button"
              onClick={() => setTab("community")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                tab === "community"
                  ? "bg-sky-500 text-white border-sky-500 shadow-sm"
                  : "bg-white text-gray-600 border-gray-200 hover:border-sky-300"
              }`}
            >
              <Users className="w-3.5 h-3.5" />會員分享
            </button>
            <button
              type="button"
              onClick={() => setTab("merchant")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                tab === "merchant"
                  ? "bg-amber-500 text-white border-amber-500 shadow-sm"
                  : "bg-white text-gray-600 border-gray-200 hover:border-amber-300"
              }`}
            >
              <Store className="w-3.5 h-3.5" />商戶上架
            </button>
          </div>
          <div className="flex items-center gap-1.5 mt-3">
            <span className="text-xs text-gray-500 mr-1">排序</span>
            {(["latest", "hot"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSort(s)}
                className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium border transition ${
                  sort === s
                    ? "bg-sky-500 text-white border-sky-500 shadow-sm"
                    : "bg-white text-gray-600 border-gray-200 hover:border-sky-300"
                }`}
              >
                {s === "latest" ? "最新" : "最熱"}
              </button>
            ))}
          </div>
        </div>

        {isLoading && (
          <div className="flex justify-center py-16">
            <div className="w-10 h-10 border-4 border-sky-400 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!isLoading && (data?.items?.length ?? 0) === 0 && (
          <div className="bg-white rounded-2xl p-12 text-center border border-sky-100 shadow-sm">
            <div className="w-16 h-16 bg-sky-50 rounded-full flex items-center justify-center mx-auto mb-3">
              <Camera className="w-7 h-7 text-sky-400" />
            </div>
            <div className="text-gray-700 font-medium mb-1">仲未有人分享</div>
            <div className="text-sm text-gray-500 mb-4">做第一個分享心愛收藏嘅人啦！</div>
            <Button onClick={goNew} className="bg-sky-500 hover:bg-sky-600 text-white">
              <Plus className="w-4 h-4 mr-1" /> 發布我嘅收藏
            </Button>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
          {data?.items?.map((post: any) => (
            <Link
              key={post.id}
              href={`/collection-square/${post.id}`}
              className="group bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-xl hover:border-sky-200 hover:-translate-y-0.5 transition-all duration-200 block"
            >
              <div className="aspect-square bg-gradient-to-br from-sky-50 to-gray-100 relative overflow-hidden">
                {post.coverImage ? (
                  <img
                    src={post.coverImage}
                    alt={post.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-sky-200">
                    <Camera className="w-10 h-10" />
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
                <div className="absolute top-2 left-2">{intentBadge(post.intent)}</div>
                {post.imageCount > 1 && (
                  <div className="absolute top-2 right-2 bg-black/55 text-white text-[10px] px-1.5 py-0.5 rounded-md backdrop-blur">
                    +{post.imageCount}
                  </div>
                )}
                {post.isHidden ? (
                  <div className="absolute bottom-2 left-2 bg-red-600 text-white text-[10px] px-2 py-0.5 rounded-md">已隱藏</div>
                ) : null}
              </div>
              <div className="p-3">
                <div className="font-semibold text-sm text-gray-900 line-clamp-2 min-h-[2.5em] leading-snug group-hover:text-sky-700 transition">
                  {post.title}
                </div>
                <div className="flex items-center gap-1.5 mt-2.5 text-xs text-gray-500">
                  {post.authorPhoto ? (
                    <img src={post.authorPhoto} alt="" className="w-5 h-5 rounded-full object-cover ring-1 ring-gray-100" />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-sky-100 to-sky-200" />
                  )}
                  <span className="truncate flex-1 text-gray-600">{post.authorName ?? "匿名"}</span>
                </div>
                <div className="flex items-center gap-3 mt-2 pt-2 border-t border-gray-50 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <Heart className={`w-3.5 h-3.5 ${post.isLiked ? "fill-red-500 text-red-500" : ""}`} />
                    {post.likeCount}
                  </span>
                  <span className="flex items-center gap-1"><MessageCircle className="w-3.5 h-3.5" />{post.commentCount}</span>
                  <span className="flex items-center gap-1 ml-auto"><Eye className="w-3.5 h-3.5" />{post.viewCount}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
