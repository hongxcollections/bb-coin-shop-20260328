import { useParams, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, Trophy, TrendingUp, Calendar, ArrowLeft, Sparkles, Heart, Bookmark, ImageIcon } from "lucide-react";

export default function UserProfile() {
  const params = useParams<{ userId: string }>();
  const userId = parseInt(params.userId ?? "0", 10);

  const { data: profile, isLoading, error } = trpc.users.publicProfile.useQuery(
    { userId },
    { enabled: !!userId && !isNaN(userId) }
  );
  const { data: communityStats } = trpc.community.userStats.useQuery(
    { userId },
    { enabled: !!userId && !isNaN(userId), staleTime: 60_000 }
  );

  if (isLoading) {
    return (
      <div className="min-h-screen hero-bg">
        <div className="container max-w-2xl py-12">
          <div className="space-y-4">
            <div className="h-8 w-32 bg-amber-100 rounded animate-pulse" />
            <div className="h-48 bg-amber-50 rounded-2xl animate-pulse" />
            <div className="grid grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-24 bg-amber-50 rounded-xl animate-pulse" />
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
        <div className="text-center">
          <User className="w-16 h-16 mx-auto mb-4 text-amber-300" />
          <h2 className="text-xl font-bold text-amber-900 mb-2">找不到此用戶</h2>
          <p className="text-muted-foreground mb-6">該用戶可能不存在或已被移除</p>
          <Link href="/auctions">
            <span className="inline-flex items-center gap-2 text-amber-600 hover:text-amber-800 font-medium">
              <ArrowLeft className="w-4 h-4" />
              返回拍賣列表
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
      <div className="container max-w-2xl py-8">
        {/* Back link */}
        <Link href="/auctions">
          <span className="inline-flex items-center gap-1.5 text-sm text-amber-600 hover:text-amber-800 mb-6 cursor-pointer transition-colors">
            <ArrowLeft className="w-4 h-4" />
            返回拍賣列表
          </span>
        </Link>

        {/* Profile card */}
        <Card className="border-amber-200 shadow-md mb-6">
          <CardContent className="pt-8 pb-6">
            <div className="flex flex-col items-center text-center">
              {/* Avatar */}
              <div className="w-20 h-20 rounded-full mb-4 shadow-lg overflow-hidden flex items-center justify-center bg-gradient-to-br from-amber-400 to-amber-600">
                {(profile as { photoUrl?: string | null }).photoUrl ? (
                  <img
                    src={(profile as { photoUrl?: string | null }).photoUrl ?? ''}
                    alt={profile.name ?? ''}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-3xl font-bold text-white">
                    {profile.name?.charAt(0)?.toUpperCase() ?? "?"}
                  </span>
                )}
              </div>

              {/* Name */}
              <h1 className="text-2xl font-bold text-amber-900 mb-1">{profile.name}</h1>

              {/* Join date */}
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Calendar className="w-3.5 h-3.5" />
                <span>加入於 {joinedDate}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <Card className="border-amber-100 text-center">
            <CardContent className="pt-6 pb-5">
              <TrendingUp className="w-7 h-7 mx-auto mb-2 text-amber-500" />
              <div className="text-3xl font-bold text-amber-700 mb-1">
                {profile.auctionsParticipated}
              </div>
              <div className="text-sm text-muted-foreground">參與競標</div>
            </CardContent>
          </Card>

          <Card className="border-amber-100 text-center">
            <CardContent className="pt-6 pb-5">
              <Trophy className="w-7 h-7 mx-auto mb-2 text-amber-500" />
              <div className="text-3xl font-bold text-amber-700 mb-1">
                {profile.auctionsWon}
              </div>
              <div className="text-sm text-muted-foreground">成功得標</div>
            </CardContent>
          </Card>
        </div>

        {/* 藏品社區參與度 */}
        <Card className="border-sky-100 mb-6 overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-sky-50 to-cyan-50 border-b border-sky-100 py-3">
            <CardTitle className="flex items-center gap-2 text-sm text-sky-900">
              <Sparkles className="w-4 h-4 text-sky-500" />
              藏品社區參與
            </CardTitle>
          </CardHeader>
          <CardContent className="py-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center">
                <div className="w-9 h-9 mx-auto mb-1.5 rounded-full bg-sky-50 flex items-center justify-center">
                  <ImageIcon className="w-4 h-4 text-sky-500" />
                </div>
                <div className="text-xl font-bold text-sky-700">{communityStats?.postCount ?? 0}</div>
                <div className="text-xs text-muted-foreground mt-0.5">分享</div>
              </div>
              <div className="text-center">
                <div className="w-9 h-9 mx-auto mb-1.5 rounded-full bg-rose-50 flex items-center justify-center">
                  <Heart className="w-4 h-4 text-rose-500" />
                </div>
                <div className="text-xl font-bold text-rose-600">{communityStats?.totalLikes ?? 0}</div>
                <div className="text-xs text-muted-foreground mt-0.5">收到讚</div>
              </div>
              <div className="text-center">
                <div className="w-9 h-9 mx-auto mb-1.5 rounded-full bg-amber-50 flex items-center justify-center">
                  <Bookmark className="w-4 h-4 text-amber-500" />
                </div>
                <div className="text-xl font-bold text-amber-600">{communityStats?.totalSaves ?? 0}</div>
                <div className="text-xs text-muted-foreground mt-0.5">收到收藏</div>
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
