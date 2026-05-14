import { useState } from "react";
import { useParams, Link, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
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
        <div className="container max-w-2xl pb-20">
          <div className="h-36 bg-amber-100 animate-pulse" />
          <div className="px-4 space-y-3 mt-4">
            <div className="h-6 w-32 bg-amber-100 rounded animate-pulse" />
            <div className="grid grid-cols-3 gap-3">
              {[...Array(3)].map((_, i) => (
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

  const rawPhoto = (profile as { photoUrl?: string | null }).photoUrl;
  const photo = rawPhoto && rawPhoto.trim() ? rawPhoto.trim() : null;
  const memberLevel = (profile as any).memberLevel;
  const winRate = profile.auctionsParticipated > 0
    ? Math.round((profile.auctionsWon / profile.auctionsParticipated) * 100)
    : null;

  return (
    <div className="min-h-screen hero-bg pb-20">
      {/* Hero Banner */}
      <div className="relative bg-gradient-to-br from-amber-800 via-amber-700 to-amber-500 h-32 sm:h-40">
        <div className="absolute inset-0 opacity-20"
          style={{ backgroundImage: "radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)", backgroundSize: "40px 40px" }}
        />
        {/* Back link */}
        <div className="absolute top-3 left-4">
          <Link href={backHref}>
            <span className="inline-flex items-center gap-1 text-sm text-white/80 hover:text-white cursor-pointer transition-colors">
              <ArrowLeft className="w-4 h-4" />
              {backLabel}
            </span>
          </Link>
        </div>
      </div>

      <div className="container max-w-2xl px-4">
        {/* Avatar — overlaps banner */}
        <div className="flex items-end justify-between -mt-10 mb-3">
          <div className="w-20 h-20 rounded-full border-4 border-white shadow-lg overflow-hidden flex-shrink-0 bg-gradient-to-br from-amber-400 to-amber-600">
            {photo ? (
              <img src={photo} alt={profile.name ?? ''} className="w-full h-full object-cover"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-3xl font-bold text-white">{profile.name?.charAt(0)?.toUpperCase() ?? "?"}</span>
              </div>
            )}
          </div>
          {winRate !== null && (
            <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50 px-3 py-1 text-sm mb-1">
              得標率 {winRate}%
            </Badge>
          )}
        </div>

        {/* Name + Meta */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl font-bold text-amber-900">{profile.name}</h1>
            {memberLevel && memberLevel !== "bronze" && (
              <MemberBadge level={memberLevel} variant="icon" size="sm" />
            )}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar className="w-3.5 h-3.5" />
            <span>加入於 {joinedDate}</span>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {/* 拍賣數據 */}
          <div className="bg-white rounded-2xl border border-amber-100 shadow-sm p-3">
            <div className="text-[11px] font-semibold text-amber-700 mb-2 flex items-center gap-1">
              <Trophy className="w-3.5 h-3.5" /> 拍賣參與
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="text-center">
                <div className="text-lg font-bold text-amber-700">{profile.auctionsParticipated}</div>
                <div className="text-[10px] text-muted-foreground flex items-center justify-center gap-0.5">
                  <TrendingUp className="w-2.5 h-2.5" />參與
                </div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-amber-600">{profile.auctionsWon}</div>
                <div className="text-[10px] text-muted-foreground flex items-center justify-center gap-0.5">
                  <Trophy className="w-2.5 h-2.5" />得標
                </div>
              </div>
            </div>
          </div>

          {/* 社區數據 */}
          <div className="bg-white rounded-2xl border border-sky-100 shadow-sm p-3">
            <div className="text-[11px] font-semibold text-sky-700 mb-2 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" /> 社區參與
            </div>
            <div className="grid grid-cols-3 gap-1">
              <div className="text-center">
                <div className="text-base font-bold text-sky-700">{communityStats?.postCount ?? 0}</div>
                <div className="text-[10px] text-muted-foreground flex items-center justify-center gap-0.5">
                  <ImageIcon className="w-2.5 h-2.5" />分享
                </div>
              </div>
              <div className="text-center">
                <div className="text-base font-bold text-rose-500">{communityStats?.totalLikes ?? 0}</div>
                <div className="text-[10px] text-muted-foreground flex items-center justify-center gap-0.5">
                  <Heart className="w-2.5 h-2.5" />讚
                </div>
              </div>
              <div className="text-center">
                <div className="text-base font-bold text-amber-500">{communityStats?.totalSaves ?? 0}</div>
                <div className="text-[10px] text-muted-foreground flex items-center justify-center gap-0.5">
                  <Bookmark className="w-2.5 h-2.5" />藏
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Posts grid */}
        {(posts.length > 0 || pageIdx > 0) && (
          <div>
            <h2 className="text-sm font-semibold text-amber-800 mb-2.5">
              {profile.name} 嘅分享
            </h2>
            <div className="grid grid-cols-3 gap-1.5">
              {posts.map((post: any) => {
                const thumb = post.coverImage && post.coverImage.trim() ? post.coverImage.trim() : null;
                const intentLabel = post.intent === "seek_value" ? "求估" : post.intent === "for_sale" ? "出讓" : null;
                return (
                  <Link key={post.id} href={`/collection-square/${post.id}?from=user:${userId}`}>
                    <div className="relative aspect-square bg-amber-50 rounded-xl overflow-hidden border border-amber-100 hover:border-amber-300 transition-colors cursor-pointer group">
                      {thumb ? (
                        <img src={thumb} alt={post.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ImageIcon className="w-6 h-6 text-amber-200" />
                        </div>
                      )}
                      {/* Overlay on hover */}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-200 flex items-end">
                        <div className="w-full px-1.5 pb-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                          <p className="text-white text-[10px] font-medium line-clamp-2 leading-snug drop-shadow">{post.title}</p>
                        </div>
                      </div>
                      {intentLabel && (
                        <span className="absolute top-1 left-1 text-[9px] px-1 py-0.5 rounded-full font-semibold bg-white/90 text-amber-700 border border-amber-200">
                          {intentLabel}
                        </span>
                      )}
                      <div className="absolute bottom-1 right-1 flex items-center gap-0.5 bg-black/40 rounded-full px-1 py-0.5">
                        <Heart className="w-2.5 h-2.5 text-white" />
                        <span className="text-[9px] text-white font-medium">{post.likeCount ?? 0}</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>

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
      </div>
    </div>
  );
}
