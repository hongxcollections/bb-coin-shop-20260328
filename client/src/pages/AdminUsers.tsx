import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";
import { toast } from "sonner";
import { MemberBadge, type MemberLevel } from "@/components/MemberBadge";

export default function AdminUsers() {
  const { user, isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();

  const { data: users, isLoading, refetch } = trpc.users.listAll.useQuery(undefined, {
    enabled: isAuthenticated && user?.role === "admin",
  });

  const setLevel = trpc.users.setMemberLevel.useMutation({
    onSuccess: () => {
      toast.success("會員等級已更新");
      refetch();
    },
    onError: (err) => toast.error(err.message),
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
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 gold-gradient rounded-xl flex items-center justify-center">
            <Users className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-amber-900">會員管理</h1>
            <p className="text-sm text-muted-foreground">設定各用戶的會員等級</p>
          </div>
        </div>

        <Card className="border-amber-100">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4 text-amber-600" />
              所有用戶（{users?.length ?? 0} 人）
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-12 bg-amber-50 rounded animate-pulse" />
                ))}
              </div>
            ) : !users || users.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-sm">尚無用戶</div>
            ) : (
              <div className="divide-y divide-amber-50">
                {users.map((u: { id: number; name: string | null; email: string | null; role: string | null; memberLevel: string | null; createdAt: Date | null }) => (
                  <div key={u.id} className="flex items-center justify-between px-4 py-3 hover:bg-amber-50/50 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 gold-gradient rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                        {(u.name ?? "U").slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm truncate">{u.name ?? "未知用戶"}</span>
                          <MemberBadge level={u.memberLevel} variant="badge" />
                          {u.role === "admin" && (
                            <Badge className="bg-amber-600 text-white text-[0.6rem] px-1.5 py-0">管理員</Badge>
                          )}
                        </div>
                        {u.email && (
                          <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex-shrink-0 ml-3">
                      <Select
                        value={u.memberLevel ?? "bronze"}
                        onValueChange={(val) =>
                          setLevel.mutate({ userId: u.id, memberLevel: val as MemberLevel })
                        }
                        disabled={setLevel.isPending}
                      >
                        <SelectTrigger className="w-36 h-8 text-xs border-amber-200">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="bronze">🥉 銅牌會員</SelectItem>
                          <SelectItem value="silver">🥈 銀牌會員</SelectItem>
                          <SelectItem value="gold">🥇 金牌會員</SelectItem>
                          <SelectItem value="vip">💎 VIP 會員</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
