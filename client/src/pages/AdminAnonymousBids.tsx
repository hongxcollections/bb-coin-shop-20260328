import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EyeOff, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { MemberBadge, type MemberLevel } from "@/components/MemberBadge";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function AdminAnonymousBids() {
  const { user, isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const pageSize = 20;

  const { data, isLoading } = trpc.users.getAnonymousBids.useQuery(
    { page, pageSize },
    { enabled: isAuthenticated && user?.role === "admin" }
  );

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

  type AnonBid = {
    id: number;
    auctionId: number | null;
    auctionTitle: string | null;
    userId: number | null;
    username: string | null;
    userEmail: string | null;
    memberLevel: string | null;
    bidAmount: string | number;
    createdAt: Date | null;
    isAnonymous: number | null;
  };

  const allBids: AnonBid[] = (data?.bids ?? []) as AnonBid[];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / pageSize);

  // Client-side search filter
  const filtered = search.trim()
    ? allBids.filter((b: AnonBid) => {
        const q = search.toLowerCase();
        return (
          (b.username ?? "").toLowerCase().includes(q) ||
          (b.userEmail ?? "").toLowerCase().includes(q) ||
          (b.auctionTitle ?? "").toLowerCase().includes(q)
        );
      })
    : allBids;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/admin">
            <Button variant="ghost" size="sm" className="text-slate-600 hover:text-slate-900">
              <ChevronLeft className="w-4 h-4 mr-1" />
              返回後台
            </Button>
          </Link>
          <div className="w-10 h-10 bg-slate-600 rounded-xl flex items-center justify-center">
            <EyeOff className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">匿名出價管理</h1>
            <p className="text-sm text-muted-foreground">查看所有匿名出價的真實用戶資料（共 {total} 筆）</p>
          </div>
        </div>

        {/* Info banner */}
        <div className="flex items-start gap-2 p-4 bg-slate-100 border border-slate-200 rounded-xl mb-6 text-sm text-slate-700">
          <EyeOff className="w-4 h-4 mt-0.5 shrink-0 text-slate-500" />
          <span>
            此頁面僅供管理員查看。匿名出價在公開競標歷史中顯示為「🕵️ 匿名買家」，但管理員可在此查看真實身份，以便在得標後聯絡買家。
          </span>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="搜尋用戶名稱、電郵或拍賣名稱..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 border-slate-200"
          />
        </div>

        {/* Table */}
        <Card className="border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <EyeOff className="w-4 h-4 text-slate-500" />
              匿名出價記錄
              {search && (
                <Badge variant="secondary" className="ml-2 text-xs">
                  篩選中：{filtered.length} 筆
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-12 bg-slate-100 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <EyeOff className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">{search ? "找不到符合的記錄" : "目前沒有匿名出價記錄"}</p>
              </div>
            ) : (
              <>
                {/* Desktop table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground">出價者（真實）</th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground">電郵</th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground">拍賣</th>
                        <th className="text-right py-2 px-3 text-xs font-semibold text-muted-foreground">出價金額</th>
                        <th className="text-right py-2 px-3 text-xs font-semibold text-muted-foreground">出價時間</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {filtered.map((b) => (
                        <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-slate-800">{b.username ?? "(未知)"}</span>
                              <MemberBadge level={b.memberLevel as MemberLevel} variant="icon" />
                              <Badge variant="outline" className="text-[0.6rem] px-1.5 py-0 border-slate-300 text-slate-500">
                                🕵️ 匿名
                              </Badge>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-slate-600 text-xs">{b.userEmail ?? "—"}</td>
                          <td className="py-3 px-3">
                            <Link href={`/auctions/${b.auctionId}`}>
                              <span className="text-amber-700 hover:text-amber-900 hover:underline cursor-pointer text-xs">
                                {b.auctionTitle ?? `拍賣 #${b.auctionId}`}
                              </span>
                            </Link>
                          </td>
                          <td className="py-3 px-3 text-right font-bold text-amber-700">
                            HK${Number(b.bidAmount).toLocaleString()}
                          </td>
                          <td className="py-3 px-3 text-right text-xs text-muted-foreground">
                            {b.createdAt ? new Date(b.createdAt).toLocaleString("zh-HK") : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile cards */}
                <div className="md:hidden space-y-3">
                  {filtered.map((b) => (
                    <div key={b.id} className="border border-slate-200 rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm text-slate-800">{b.username ?? "(未知)"}</span>
                          <MemberBadge level={b.memberLevel as MemberLevel} variant="icon" />
                          <Badge variant="outline" className="text-[0.6rem] px-1.5 py-0 border-slate-300 text-slate-500">
                            🕵️ 匿名
                          </Badge>
                        </div>
                        <span className="font-bold text-amber-700 text-sm">HK${Number(b.bidAmount).toLocaleString()}</span>
                      </div>
                      {b.userEmail && (
                        <p className="text-xs text-slate-500">{b.userEmail}</p>
                      )}
                      <div className="flex items-center justify-between">
                        <Link href={`/auctions/${b.auctionId}`}>
                          <span className="text-xs text-amber-700 hover:underline cursor-pointer">
                            {b.auctionTitle ?? `拍賣 #${b.auctionId}`}
                          </span>
                        </Link>
                        <span className="text-[0.65rem] text-muted-foreground">
                          {b.createdAt ? new Date(b.createdAt).toLocaleString("zh-HK") : "—"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination (only when not searching) */}
                {!search && totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
                    <span className="text-xs text-muted-foreground">
                      第 {page} / {totalPages} 頁，共 {total} 筆
                    </span>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page <= 1}
                        className="border-slate-200"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page >= totalPages}
                        className="border-slate-200"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
