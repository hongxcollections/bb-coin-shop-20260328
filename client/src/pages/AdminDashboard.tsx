import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation, Link } from "wouter";
import AdminHeader from "@/components/AdminHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart2, TrendingUp, Users, Gavel, DollarSign, Activity, ChevronLeft, Trophy } from "lucide-react";

function StatCard({
  icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
}) {
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground mb-1">{label}</p>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color.replace("text-", "bg-").replace("-700", "-100").replace("-600", "-100")}`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function BidBarChart({ bidsPerDay }: { bidsPerDay: { day: unknown; count: unknown }[] }) {
  if (!bidsPerDay || bidsPerDay.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        <Activity className="w-8 h-8 mx-auto mb-2 opacity-30" />
        近 7 日無出價記錄
      </div>
    );
  }

  const maxCount = Math.max(...bidsPerDay.map((d) => Number(d.count)));

  return (
    <div className="space-y-2">
      {bidsPerDay.map((d, i) => {
        const count = Number(d.count);
        const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
        const dayStr = String(d.day ?? "").slice(5); // MM-DD
        return (
          <div key={i} className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground w-12 shrink-0">{dayStr}</span>
            <div className="flex-1 bg-amber-100 rounded-full h-5 overflow-hidden">
              <div
                className="h-full gold-gradient rounded-full transition-all duration-500"
                style={{ width: `${Math.max(pct, 2)}%` }}
              />
            </div>
            <span className="text-xs font-medium text-amber-700 w-8 text-right">{count}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function AdminDashboard() {
  const { user, isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();

  const { data: stats, isLoading } = trpc.users.getDashboardStats.useQuery(undefined, {
    enabled: isAuthenticated && user?.role === "admin",
    refetchInterval: 60000, // refresh every minute
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated || user?.role !== "admin") {
    navigate("/");
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 p-4 md:p-8">
      <AdminHeader />
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/admin">
            <button className="flex items-center text-sm text-amber-700 hover:text-amber-900 font-medium">
              <ChevronLeft className="w-4 h-4 mr-1" />
              返回後台
            </button>
          </Link>
          <div className="w-10 h-10 gold-gradient rounded-xl flex items-center justify-center">
            <BarChart2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-amber-900">數據統計儀表板</h1>
            <p className="text-sm text-muted-foreground">即時平台運營數據概覽</p>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-24 bg-white rounded-xl animate-pulse shadow-sm" />
            ))}
          </div>
        ) : !stats ? (
          <div className="text-center py-16 text-muted-foreground">
            <BarChart2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>無法載入統計數據</p>
          </div>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <StatCard
                icon={<Gavel className="w-5 h-5 text-amber-600" />}
                label="進行中拍賣"
                value={stats.activeCount}
                sub="目前活躍"
                color="text-amber-700"
              />
              <StatCard
                icon={<Trophy className="w-5 h-5 text-green-600" />}
                label="已結束拍賣"
                value={stats.endedCount}
                sub="歷史成交"
                color="text-green-700"
              />
              <StatCard
                icon={<Activity className="w-5 h-5 text-blue-600" />}
                label="總出價次數"
                value={stats.totalBids.toLocaleString()}
                sub={`近7日 +${stats.recentBids}`}
                color="text-blue-700"
              />
              <StatCard
                icon={<Users className="w-5 h-5 text-violet-600" />}
                label="註冊用戶"
                value={stats.totalUsers.toLocaleString()}
                sub="累計"
                color="text-violet-700"
              />
              <StatCard
                icon={<DollarSign className="w-5 h-5 text-amber-600" />}
                label="累計成交額"
                value={`HK$${stats.totalValue.toLocaleString()}`}
                sub="所有已結束拍賣"
                color="text-amber-700"
              />
              <StatCard
                icon={<TrendingUp className="w-5 h-5 text-rose-600" />}
                label="近7日成交額"
                value={`HK$${stats.recentValue.toLocaleString()}`}
                sub="最近一週"
                color="text-rose-700"
              />
              <StatCard
                icon={<Activity className="w-5 h-5 text-cyan-600" />}
                label="近7日出價"
                value={stats.recentBids}
                sub="出價次數"
                color="text-cyan-700"
              />
              <StatCard
                icon={<BarChart2 className="w-5 h-5 text-orange-600" />}
                label="平均每拍出價"
                value={
                  stats.endedCount > 0
                    ? (stats.totalBids / (stats.activeCount + stats.endedCount)).toFixed(1)
                    : "—"
                }
                sub="次/拍賣"
                color="text-orange-700"
              />
            </div>

            {/* Charts + Top Auctions */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Bids per day */}
              <Card className="border-amber-100">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Activity className="w-4 h-4 text-amber-600" />
                    近 7 日出價趨勢
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <BidBarChart bidsPerDay={stats.bidsPerDay as { day: unknown; count: unknown }[]} />
                </CardContent>
              </Card>

              {/* Top auctions */}
              <Card className="border-amber-100">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-amber-600" />
                    最熱門拍賣（出價最多）
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {(stats.topAuctions as { id: number; title: string; currentPrice: string | number; status: string; bidCount: unknown }[]).length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      <Trophy className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      暫無拍賣記錄
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {(stats.topAuctions as { id: number; title: string; currentPrice: string | number; status: string; bidCount: unknown }[]).map((a, i) => (
                        <div key={a.id} className="flex items-center gap-3">
                          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                            i === 0 ? "bg-amber-400 text-white" :
                            i === 1 ? "bg-gray-300 text-gray-700" :
                            i === 2 ? "bg-orange-300 text-white" :
                            "bg-gray-100 text-gray-500"
                          }`}>{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <Link href={`/auctions/${a.id}`}>
                              <span className="text-sm font-medium text-amber-800 hover:underline cursor-pointer truncate block">
                                {a.title}
                              </span>
                            </Link>
                            <span className="text-xs text-muted-foreground">
                              HK${Number(a.currentPrice).toLocaleString()}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <Badge
                              variant={a.status === "active" ? "default" : "secondary"}
                              className={`text-[0.6rem] px-1.5 py-0 ${a.status === "active" ? "bg-green-100 text-green-700 border-green-200" : "bg-gray-100 text-gray-500"}`}
                            >
                              {a.status === "active" ? "進行中" : "已結束"}
                            </Badge>
                            <span className="text-xs font-bold text-amber-700">{String(a.bidCount)} 口</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
