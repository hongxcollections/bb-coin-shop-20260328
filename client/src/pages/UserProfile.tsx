import { useState } from "react";
import { useParams, Link, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, TrendingUp, Calendar, ArrowLeft, Sparkles, Heart, Bookmark, ImageIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { MemberBadge } from "@/components/MemberBadge";

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

        {/* Profile card — ultra compact row layout */}
        <Card className="border-amber-200 shadow-md mb-3">
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-3">
              {(() => {
                const rawPhoto = (profile as { photoUrl?: string | null }).photoUrl;
                const photo = rawPhoto && rawPhoto.trim() ? rawPhoto.trim() : null;
                return (
                  <div className="w-12 h-12 rounded-full flex-shrink-0 overflow-hidden flex items-center justify-center bg-gradient-to-br from-amber-400 to-amber-600 shadow">
                    {photo ? (
                      <img src={photo} alt={profile.name ?? ''} className="w-full h-full object-cover"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                    ) : (
                      <span className="text-xl font-bold text-white">{profile.name?.charAt(0)?.toUpperCase() ?? "?"}</span>
                    )}
                  </div>
                );
              })()}
              <div>
                <div className="flex items-center gap-1.5">
                  <h1 className="text-lg font-bold text-amber-900 leading-tight">{profile.name}</h1>
                  {(profile as any).memberLevel && (profile as any).memberLevel !== "bronze" && (
                    <MemberBadge level={(profile as any).memberLevel} variant="icon" size="sm" />
                  )}
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                  <Calendar className="w-3 h-3" />
                  <span>加入於 {joinedDate}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 藏品社區參與度 — inline row */}
        <Card className="border-sky-100 mb-3 overflow-hidden">
          <CardContent className="py-2.5 px-4">
            <div className="flex items-center gap-1 mb-2">
              <Sparkles className="w-3 h-3 text-sky-500" />
              <span className="text-xs font-semibold text-sky-800">藏品社區參與</span>
            </div>
            <div className="grid grid-cols-3 divide-x divide-sky-100">
              <div className="text-center pr-2">
                <div className="text-base font-bold text-sky-700">{communityStats?.postCount ?? 0}</div>
                <div className="text-[11px] text-muted-foreground flex items-center justify-center gap-0.5"><ImageIcon className="w-3 h-3" />分享</div>
              </div>
              <div className="text-center px-2">
                <div className="text-base font-bold text-rose-600">{communityStats?.totalLikes ?? 0}</div>
                <div className="text-[11px] text-muted-foreground flex items-center justify-center gap-0.5"><Heart className="w-3 h-3" />收到讚</div>
              </div>
              <div className="text-center pl-2">
                <div className="text-base font-bold text-amber-600">{communityStats?.totalSaves ?? 0}</div>
                <div className="text-[11px] text-muted-foreground flex items-center justify-center gap-0.5"><Bookmark className="w-3 h-3" />收藏</div>
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
              {posts.map((post: any) => {
                const thumb = post.coverImage && post.coverImage.trim() ? post.coverImage.trim() : null;
                const intentLabel = post.intent === "seek_value" ? "求估價" : post.intent === "for_sale" ? "想出讓" : null;
                return (
                  <Link key={post.id} href={`/collection-square/${post.id}?from=user:${userId}`}>
                    <div className="bg-white rounded-xl border border-amber-100 overflow-hidden hover:border-amber-300 transition-colors cursor-pointer">
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
                      <div className="px-2 py-1.5">
                        <p className="text-xs font-medium text-gray-800 line-clamp-2 leading-snug">{post.title}</p>
                        <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                          <span className="flex items-center gap-0.5"><Heart className="w-2.5 h-2.5" />{post.likeCount ?? 0}</span>
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

        {/* Auction Stats — inline compact */}
        <Card className="border-amber-100 mb-4">
          <CardContent className="py-2.5 px-4">
            <div className="grid grid-cols-2 divide-x divide-amber-100">
              <div className="text-center pr-3 flex items-center justify-center gap-2">
                <TrendingUp className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <div>
                  <div className="text-base font-bold text-amber-700">{profile.auctionsParticipated}</div>
                  <div className="text-[11px] text-muted-foreground">參與競標</div>
                </div>
              </div>
              <div className="text-center pl-3 flex items-center justify-center gap-2">
                <Trophy className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <div>
                  <div className="text-base font-bold text-amber-700">{profile.auctionsWon}</div>
                  <div className="text-[11px] text-muted-foreground">成功得標</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

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
