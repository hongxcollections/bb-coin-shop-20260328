import { useState } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Heart, Clock, ChevronLeft, Gavel } from "lucide-react";
import { getCurrencySymbol } from "./AdminAuctions";

function CountdownBadge({ endTime, status }: { endTime: Date; status: string }) {
  const now = new Date();
  const diff = new Date(endTime).getTime() - now.getTime();
  if (status === "ended" || diff <= 0) {
    return <Badge variant="secondary" className="text-xs bg-gray-100 text-gray-500">已結束</Badge>;
  }
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const isEnding = h < 1;
  return (
    <Badge variant="secondary" className={`text-xs flex items-center gap-1 ${isEnding ? "bg-red-100 text-red-600" : "bg-green-100 text-green-700"}`}>
      <Clock className="w-3 h-3" />
      {h > 0 ? `${h}h ${m}m` : `${m}m`}
    </Badge>
  );
}

export default function Favorites() {
  const { user, isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();
  const toggleFavorite = trpc.favorites.toggle.useMutation({
    onSuccess: () => utils.favorites.list.invalidate(),
  });
  const utils = trpc.useUtils();
  const { data: favorites, isLoading } = trpc.favorites.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <Heart className="w-12 h-12 text-amber-300" />
        <p className="text-muted-foreground">請先登入以查看收藏清單</p>
        <a href={getLoginUrl()}><Button className="gold-gradient text-white border-0">立即登入</Button></a>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="nav-glass sticky top-0 z-50">
        <div className="container flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2 font-bold text-xl">
            <span className="text-2xl">💰</span>
            <span className="gold-gradient-text">大BB錢幣店</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/auctions">
              <Button variant="ghost" size="sm" className="text-amber-700 hover:text-amber-900 hover:bg-amber-50">所有拍賣</Button>
            </Link>
            <Link href="/profile">
              <Button variant="outline" size="sm" className="border-amber-300 text-amber-800 hover:bg-amber-50">{user?.name ?? "個人資料"}</Button>
            </Link>
          </div>
        </div>
      </nav>

      <div className="container py-8 max-w-3xl">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate("/profile")} className="flex items-center text-sm text-amber-700 hover:text-amber-900 font-medium">
            <ChevronLeft className="w-4 h-4 mr-1" />
            返回個人資料
          </button>
          <div className="w-10 h-10 bg-rose-100 rounded-xl flex items-center justify-center">
            <Heart className="w-5 h-5 text-rose-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-amber-900">我的收藏</h1>
            <p className="text-sm text-muted-foreground">追蹤您感興趣的拍品</p>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-20 bg-amber-50 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : !favorites || favorites.length === 0 ? (
          <div className="text-center py-16">
            <Heart className="w-12 h-12 mx-auto mb-3 text-amber-200" />
            <p className="text-muted-foreground mb-4">尚未收藏任何拍品</p>
            <Link href="/auctions">
              <Button className="gold-gradient text-white border-0">瀏覽拍賣</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {(favorites as Array<{ id: number; title: string; currentPrice: string | number; endTime: Date; status: string; currency: string | null; category: string | null; favoritedAt: Date }>).map((item) => {
              const sym = getCurrencySymbol(item.currency ?? "HKD");
              return (
                <Card key={item.id} className="border-amber-100 hover:border-amber-300 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <Link href={`/auctions/${item.id}`}>
                          <span className="font-semibold text-amber-900 hover:underline cursor-pointer line-clamp-1">{item.title}</span>
                        </Link>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-sm font-bold text-amber-700">{sym}{Number(item.currentPrice).toLocaleString()}</span>
                          {item.category && (
                            <Badge variant="outline" className="text-xs border-amber-200 text-amber-600 px-1.5 py-0">{item.category}</Badge>
                          )}
                          <CountdownBadge endTime={new Date(item.endTime)} status={item.status} />
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Link href={`/auctions/${item.id}`}>
                          <Button size="sm" variant="outline" className="border-amber-200 text-amber-700 hover:bg-amber-50 gap-1">
                            <Gavel className="w-3.5 h-3.5" />
                            出價
                          </Button>
                        </Link>
                        <button
                          onClick={() => toggleFavorite.mutate({ auctionId: item.id })}
                          className="w-8 h-8 flex items-center justify-center rounded-full bg-rose-50 hover:bg-rose-100 transition-colors"
                          title="移除收藏"
                        >
                          <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />
                        </button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
