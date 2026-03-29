import { useParams, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, Trophy, TrendingUp, Calendar, ArrowLeft } from "lucide-react";

export default function UserProfile() {
  const params = useParams<{ userId: string }>();
  const userId = parseInt(params.userId ?? "0", 10);

  const { data: profile, isLoading, error } = trpc.users.publicProfile.useQuery(
    { userId },
    { enabled: !!userId && !isNaN(userId) }
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
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center mb-4 shadow-lg">
                <span className="text-3xl font-bold text-white">
                  {profile.name?.charAt(0)?.toUpperCase() ?? "?"}
                </span>
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
