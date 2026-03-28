import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";
import { Link } from "wouter";
import { useState, useEffect } from "react";
import { Clock, Shield, TrendingUp, Award, ChevronRight, Coins } from "lucide-react";
import { getCurrencySymbol } from "./AdminAuctions";

function CountdownTimer({ endTime }: { endTime: Date }) {
  const [timeLeft, setTimeLeft] = useState("");
  const [status, setStatus] = useState<"active" | "ending" | "ended">("active");

  useEffect(() => {
    function update() {
      const now = new Date();
      const diff = new Date(endTime).getTime() - now.getTime();
      if (diff <= 0) {
        setTimeLeft("已結束");
        setStatus("ended");
        return;
      }
      const hours = Math.floor(diff / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      if (hours < 1) setStatus("ending");
      else setStatus("active");
      setTimeLeft(hours > 0 ? `${hours}h ${minutes}m ${seconds}s` : `${minutes}m ${seconds}s`);
    }
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [endTime]);

  const cls = status === "ended" ? "countdown-badge countdown-ended" : status === "ending" ? "countdown-badge countdown-ending" : "countdown-badge countdown-active";
  return <span className={cls}><Clock className="w-3 h-3" />{timeLeft}</span>;
}

export default function Home() {
  const { user, isAuthenticated } = useAuth();
  const { data: auctions, isLoading } = trpc.auctions.list.useQuery({ limit: 6, offset: 0 });

  const stats = [
    { label: "活躍拍賣", value: auctions?.filter(a => a.status === "active").length ?? 0, suffix: "件" },
    { label: "已成交", value: auctions?.filter(a => a.status === "ended").length ?? 0, suffix: "件" },
    { label: "錢幣品類", value: "100+", suffix: "" },
  ];

  const features = [
    { icon: Shield, title: "安全可信", desc: "每件拍品均經專業鑑定，確保真品保障" },
    { icon: TrendingUp, title: "公開競價", desc: "透明出價記錄，公平公正的競拍環境" },
    { icon: Award, title: "品質保證", desc: "嚴格篩選優質錢幣，提供完整收藏資訊" },
    { icon: Coins, title: "多元品類", desc: "古幣、紀念幣、外幣，滿足各類收藏需求" },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="nav-glass sticky top-0 z-50">
        <div className="container flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2 font-bold text-xl">
            <span className="text-2xl">💰</span>
            <span className="gold-gradient-text">大BB錢幣店</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/auctions">
              <Button variant="ghost" size="sm" className="text-amber-700 hover:text-amber-900 hover:bg-amber-50">
                所有拍賣
              </Button>
            </Link>
            {isAuthenticated ? (
              <>
                {user?.role === "admin" && (
                  <Link href="/admin">
                    <Button variant="ghost" size="sm" className="text-amber-700 hover:text-amber-900 hover:bg-amber-50">
                      管理後台
                    </Button>
                  </Link>
                )}
                <Link href="/profile">
                  <Button variant="outline" size="sm" className="border-amber-300 text-amber-800 hover:bg-amber-50">
                    {user?.name ?? "個人資料"}
                  </Button>
                </Link>
              </>
            ) : (
              <a href={getLoginUrl()}>
                <Button size="sm" className="gold-gradient text-white border-0 shadow-md hover:opacity-90">
                  立即登入
                </Button>
              </a>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero-bg py-20 md:py-28 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-10 right-10 w-64 h-64 bg-amber-200/30 rounded-full blur-3xl" />
          <div className="absolute bottom-10 left-10 w-48 h-48 bg-yellow-200/20 rounded-full blur-2xl" />
        </div>
        <div className="container relative z-10">
          <div className="max-w-3xl mx-auto text-center">
            <div className="text-7xl mb-6 animate-float inline-block">💰</div>
            <h1 className="text-4xl md:text-6xl font-extrabold mb-4 leading-tight">
              <span className="gold-gradient-text">大BB錢幣店</span>
            </h1>
            <p className="text-xl md:text-2xl text-amber-800/80 mb-4 font-medium">
              專業錢幣拍賣平台
            </p>
            <p className="text-base text-muted-foreground mb-8 max-w-xl mx-auto">
              匯聚古幣、紀念幣、外幣精品，為收藏愛好者提供安全、透明的競拍體驗
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center mb-12">
              <Link href="/auctions">
                <Button size="lg" className="gold-gradient text-white border-0 shadow-lg hover:opacity-90 text-base px-8">
                  瀏覽所有拍賣 <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
              {!isAuthenticated && (
                <a href={getLoginUrl()}>
                  <Button size="lg" variant="outline" className="border-amber-300 text-amber-800 hover:bg-amber-50 text-base px-8">
                    免費註冊
                  </Button>
                </a>
              )}
            </div>
            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 max-w-md mx-auto">
              {stats.map((s) => (
                <div key={s.label} className="bg-white/70 backdrop-blur rounded-xl p-3 border border-amber-100">
                  <div className="text-2xl font-bold text-amber-700">{s.value}{s.suffix}</div>
                  <div className="text-xs text-muted-foreground">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Latest Auctions */}
      <section className="py-16 bg-white">
        <div className="container">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold text-foreground">熱門拍賣</h2>
              <p className="text-muted-foreground mt-1">精選優質錢幣，限時競拍</p>
            </div>
            <Link href="/auctions">
              <Button variant="outline" className="border-amber-300 text-amber-700 hover:bg-amber-50">
                查看全部 <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-64 bg-amber-50 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : auctions && auctions.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {auctions.slice(0, 6).map((auction) => (
                <Link key={auction.id} href={`/auctions/${auction.id}`}>
                  <Card className="auction-card overflow-hidden border border-amber-100 hover:border-amber-300 cursor-pointer">
                    <div className="h-44 coin-placeholder flex items-center justify-center relative">
                      {auction.images && auction.images.length > 0 ? (
                        <img
                          src={(auction.images as Array<{ imageUrl: string }>)[0].imageUrl}
                          alt={auction.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-5xl">🪙</span>
                      )}
                      <div className="absolute top-2 right-2">
                        {(() => {
                          const isEnded = new Date(auction.endTime).getTime() <= Date.now();
                          return (
                            <Badge className={!isEnded ? "bg-emerald-500 text-white" : "bg-gray-400 text-white"}>
                              {!isEnded ? "競拍中" : "已結束"}
                            </Badge>
                          );
                        })()}
                      </div>
                    </div>
                    <CardContent className="p-4">
                      <h3 className="font-semibold text-sm mb-2 line-clamp-2 text-foreground">{auction.title}</h3>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-xs text-muted-foreground">當前出價</div>
                          <div className="text-lg font-bold text-amber-600 price-tag">
                            {getCurrencySymbol((auction as { currency?: string }).currency ?? 'HKD')}{Number(auction.currentPrice).toLocaleString()}
                            <span className="text-xs font-normal text-amber-500 ml-0.5">{(auction as { currency?: string }).currency ?? 'HKD'}</span>
                          </div>
                        </div>
                        {new Date(auction.endTime).getTime() > Date.now() && (
                          <CountdownTimer endTime={new Date(auction.endTime)} />
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 text-muted-foreground">
              <div className="text-5xl mb-4">🪙</div>
              <p className="text-lg font-medium">暫無拍賣商品</p>
              <p className="text-sm mt-1">請稍後再來查看</p>
            </div>
          )}
        </div>
      </section>

      {/* Features */}
      <section className="py-8 hero-bg">
        <div className="container">
          <div className="text-center mb-6">
            <h2 className="text-2xl md:text-3xl font-bold">為什麼選擇我們？</h2>
            <p className="text-muted-foreground mt-1 text-sm">專業、安全、透明的錢幣拍賣體驗</p>
          </div>
          <div className="grid grid-cols-2 gap-4 max-w-2xl mx-auto">
            {features.map((f) => (
              <Card key={f.title} className="flex items-start gap-3 p-4 border border-amber-100 hover:border-amber-300 hover:shadow-md transition-all">
                <div className="w-9 h-9 gold-gradient rounded-lg flex items-center justify-center shrink-0">
                  <f.icon className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-sm mb-0.5">{f.title}</h3>
                  <p className="text-xs text-muted-foreground leading-snug">{f.desc}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      {!isAuthenticated && (
        <section className="py-16 bg-white">
          <div className="container">
            <div className="max-w-2xl mx-auto text-center bg-gradient-to-br from-amber-50 to-yellow-50 rounded-2xl p-10 border border-amber-200">
              <div className="text-4xl mb-4">🏆</div>
              <h2 className="text-2xl font-bold mb-3">立即加入競拍</h2>
              <p className="text-muted-foreground mb-6">免費註冊，即可參與所有拍賣競標</p>
              <a href={getLoginUrl()}>
                <Button size="lg" className="gold-gradient text-white border-0 shadow-lg hover:opacity-90 px-10">
                  免費開始
                </Button>
              </a>
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="bg-amber-900 text-amber-100 py-8">
        <div className="container text-center">
          <div className="text-2xl mb-2">💰</div>
          <div className="font-bold text-lg mb-1">大BB錢幣店</div>
          <p className="text-amber-300 text-sm">© 2026 大BB錢幣店 · 專業錢幣拍賣平台</p>
        </div>
      </footer>
    </div>
  );
}
