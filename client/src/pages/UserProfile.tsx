import { useState } from "react";
import { useParams, Link, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, TrendingUp, Calendar, ArrowLeft, Sparkles, Heart, Bookmark, ImageIcon, ChevronLeft, ChevronRight } from "lucide-react";

const PAGE_SIZE = 10;

export default function UserProfile() {
  const params = useParams<{ userId: string }>();
  const userId = parseInt(params.userId ?? "0", 10);
  const search = useSearch();
  const fromCommunity = (() => {
    try {
      const sp = new URLSearchParams(search);
      if (sp.get("from") === "community") return true;
    } catch {}
    if (typeof document !== "undefined" && document.referrer.includes("/collection-square")) return true;
    return false;
  })();
  const backHref = fromCommunity ? "/collection-square" : "/auctions";
  const backLabel = fromCommunity ? "返回藏品社區" : "返回拍賣列表";

  // Cursor stack for prev/next pagination
  const [cursorStack, setCursorStack] = useState<(number | undefined)[]>([undefined]);
  const [pageIdx, setPageIdx] = useState(0);
  const currentCursor = cursorStack[pageIdx];

  const { data: profile, isLoading, error } = trpc.users.publicProfile.useQuery(
    { userId },
    { enabled: !!userId && !isNaN(userId) }
  );
  const { data: communityStats } = trpc.community.userStats.useQuery(
    { userId },
    { enabled: !!userId && !isNaN(userId), staleTime: 60_000 }
  );
  const { data: postsData } = trpc.community.list.useQuery(
    { intent: "all", sort: "latest", tab: "all", limit: PAGE_SIZE, authorId: userId, cursor: currentCursor },
    { enabled: !!userId && !isNaN(userId), staleTime: 30_000 }
  );

  const posts = postsData?.items ?? [];
  const nextCursor = postsData?.nextCursor ?? null;
  const hasPrev = pageIdx > 0;
  const hasNext = !!nextCursor;

  function goNext() {
    if (!nextCursor) return;
    setCursorStack(prev => {
      const next = [...prev];
      if (pageIdx + 1 >= next.length) next.push(nextCursor);
      return next;
    });
    setPageIdx(i => i + 1);
  }
  function goPrev() {
    if (pageIdx === 0) return;
    setPageIdx(i => i - 1);
  }

  if (isLoading) {
    return (
      <div className="min-h-screen hero-bg">
        <div className="container max-w-2xl py-8 pb-20">
          <div className="space-y-3">
            <div className="h-7 w-28 bg-amber-100 rounded animate-pulse" />
            <div className="h-36 bg-amber-50 rounded-2xl animate-pulse" />
            <div className="grid grid-cols-2 gap-3">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="h-20 bg-amber-50 rounded-xl animate-pulse" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen hero-bg flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-muted-foreground">找不到此用戶</p>
          <Link href="/collection-square">
            <span className="inline-flex items-center gap-1.5 text-sm text-amber-600 hover:text-amber-800 cursor-pointer">
              <ArrowLeft className="w-4 h-4" />
              返回藏品社區
            </span>
          </Link>
        </div>
      </div>
    );
  }

  const joinedDate = new Date(profile.createdAt).toLocaleDateString("zh-HK", {
    year: "numeric",
    month: "long",
  });

  return (
    <div className="min-h-screen hero-bg">
      <div className="container max-w-2xl py-6 pb-20">
        {/* Back link */}
        <Link href={backHref}>
          <span className="inline-flex items-center gap-1.5 text-sm text-amber-600 hover:text-amber-800 mb-4 cursor-pointer transition-colors">
            <ArrowLeft className="w-4 h-4" />
            {backLabel}
          </span>
        </Link>

        {/* Profile card — compact */}
        <Card className="border-amber-200 shadow-md mb-4">
          <CardContent className="pt-5 pb-4">
            <div className="flex flex-col items-center text-center">
              {(() => {
                const rawPhoto = (profile as { photoUrl?: string | null }).photoUrl;
                const photo = rawPhoto && rawPhoto.trim() ? rawPhoto.trim() : null;
                return (
                  <div className="w-16 h-16 rounded-full mb-3 shadow-lg overflow-hidden flex items-center justify-center bg-gradient-to-br from-amber-400 to-amber-600">
                    {photo ? (
                      <img
                        src={photo}
                        alt={profile.name ?? ''}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <span className="text-2xl font-bold text-white">
                        {profile.name?.charAt(0)?.toUpperCase() ?? "?"}
                      </span>
                    )}
                  </div>
                );
              })()}
              <h1 className="text-xl font-bold text-amber-900 mb-0.5">{profile.name}</h1>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Calendar className="w-3 h-3" />
                <span>加入於 {joinedDate}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 藏品社區參與度 — compact */}
        <Card className="border-sky-100 mb-4 overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-sky-50 to-cyan-50 border-b border-sky-100 py-2 px-4">
            <CardTitle className="flex items-center gap-2 text-sm text-sky-900">
              <Sparkles className="w-3.5 h-3.5 text-sky-500" />
              藏品社區參與
            </CardTitle>
          </CardHeader>
          <CardContent className="py-3">
            <div className="grid grid-cols-3 gap-2">
              <div className="text-center">
                <div className="w-8 h-8 mx-auto mb-1 rounded-full bg-sky-50 flex items-center justify-center">
                  <ImageIcon className="w-3.5 h-3.5 text-sky-500" />
                </div>
                <div className="text-lg font-bold text-sky-700">{communityStats?.postCount ?? 0}</div>
                <div className="text-xs text-muted-foreground">分享</div>
              </div>
              <div className="text-center">
                <div className="w-8 h-8 mx-auto mb-1 rounded-full bg-rose-50 flex items-center justify-center">
                  <Heart className="w-3.5 h-3.5 text-rose-500" />
                </div>
                <div className="text-lg font-bold text-rose-600">{communityStats?.totalLikes ?? 0}</div>
                <div className="text-xs text-muted-foreground">收到讚</div>
              </div>
              <div className="text-center">
                <div className="w-8 h-8 mx-auto mb-1 rounded-full bg-amber-50 flex items-center justify-center">
                  <Bookmark className="w-3.5 h-3.5 text-amber-500" />
                </div>
                <div className="text-lg font-bold text-amber-600">{communityStats?.totalSaves ?? 0}</div>
                <div className="text-xs text-muted-foreground">收到收藏</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 會員帖文 2-col grid */}
        {(posts.length > 0 || pageIdx > 0) && (
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-amber-800 mb-2 px-0.5">
              {profile.name} 嘅分享
            </h2>
            <div className="grid grid-cols-2 gap-2">
              {posts.map((post) => {
                const imgs: string[] = (() => {
                  try { return JSON.parse((post as any).images || "[]"); } catch { return []; }
                })();
                const thumb = imgs[0] ?? null;
                const intentLabel = post.intent === "seek_value" ? "求估價" : post.intent === "for_sale" ? "想出讓" : null;
                return (
                  <Link key={post.id} href={`/collection-square/${post.id}?from=user:${userId}`}>
                    <div className="bg-white rounded-xl border border-amber-100 overflow-hidden hover:border-amber-300 transition-colors cursor-pointer">
                      {/* Thumbnail */}
                      <div className="aspect-square bg-amber-50 relative overflow-hidden">
                        {thumb ? (
                          <img src={thumb} alt={post.title} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ImageIcon className="w-7 h-7 text-amber-200" />
                          </div>
                        )}
                        {intentLabel && (
                          <span className="absolute top-1 left-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-white/80 text-amber-700 border border-amber-200">
                            {intentLabel}
                          </span>
                        )}
                      </div>
                      {/* Title */}
                      <div className="px-2 py-1.5">
                        <p className="text-xs font-medium text-gray-800 line-clamp-2 leading-snug">{post.title}</p>
                        <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                          <span className="flex items-center gap-0.5"><Heart className="w-2.5 h-2.5" />{(post as any).likesCount ?? 0}</span>
                          <span className="flex items-center gap-0.5"><Bookmark className="w-2.5 h-2.5" />{(post as any).savesCount ?? 0}</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>

            {/* Prev / Next */}
            {(hasPrev || hasNext) && (
              <div className="flex items-center justify-between mt-3">
                <button
                  onClick={goPrev}
                  disabled={!hasPrev}
                  className="flex items-center gap-1 text-xs text-amber-700 disabled:opacity-30 hover:text-amber-900 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" /> 上頁
                </button>
                <span className="text-xs text-muted-foreground">第 {pageIdx + 1} 頁</span>
                <button
                  onClick={goNext}
                  disabled={!hasNext}
                  className="flex items-center gap-1 text-xs text-amber-700 disabled:opacity-30 hover:text-amber-900 transition-colors"
                >
                  下頁 <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Auction Stats — compact */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <Card className="border-amber-100 text-center">
            <CardContent className="pt-4 pb-3">
              <TrendingUp className="w-6 h-6 mx-auto mb-1.5 text-amber-500" />
              <div className="text-2xl font-bold text-amber-700 mb-0.5">
                {profile.auctionsParticipated}
              </div>
              <div className="text-xs text-muted-foreground">參與競標</div>
            </CardContent>
          </Card>
          <Card className="border-amber-100 text-center">
            <CardContent className="pt-4 pb-3">
              <Trophy className="w-6 h-6 mx-auto mb-1.5 text-amber-500" />
              <div className="text-2xl font-bold text-amber-700 mb-0.5">
                {profile.auctionsWon}
              </div>
              <div className="text-xs text-muted-foreground">成功得標</div>
            </CardContent>
          </Card>
        </div>

        {/* Win rate badge */}
        {profile.auctionsParticipated > 0 && (
          <div className="flex justify-center">
            <Badge
              variant="outline"
              className="border-amber-300 text-amber-700 bg-amber-50 px-4 py-1.5 text-sm"
            >
              得標率{" "}
              {Math.round((profile.auctionsWon / profile.auctionsParticipated) * 100)}%
            </Badge>
          </div>
        )}
      </div>
    </div>
  );
}
