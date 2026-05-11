import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, UserPlus, Crown, Store } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

interface Row {
  id: number;
  name: string | null;
  email: string | null;
  phone: string | null;
  role: string | null;
  memberLevel: string | null;
  createdAt: string | Date | null;
  merchantStatus: string | null;
  merchantName: string | null;
  planName: string | null;
  depositBalance: number | string | null;
}

const PAGE_SIZE = 10;
const DAYS = 3;

function formatDate(v: string | Date | null): string {
  if (!v) return "—";
  try {
    const d = typeof v === "string" ? new Date(v) : v;
    return d.toLocaleString("zh-HK", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return String(v);
  }
}

function tierBadge(level: string | null) {
  const map: Record<string, { label: string; cls: string }> = {
    bronze: { label: "銅", cls: "bg-amber-100 text-amber-800 border-amber-300" },
    silver: { label: "銀", cls: "bg-slate-100 text-slate-700 border-slate-300" },
    gold: { label: "金", cls: "bg-yellow-100 text-yellow-800 border-yellow-300" },
    vip: { label: "VIP", cls: "bg-purple-100 text-purple-800 border-purple-300" },
  };
  const m = map[String(level || "bronze").toLowerCase()] || map.bronze;
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${m.cls}`}><Crown className="w-3 h-3" />{m.label}</span>;
}

export default function AdminRecentSignupsModal({ open, onOpenChange }: Props) {
  const [page, setPage] = useState(1);
  const { data, isLoading } = trpc.users.adminListRecentRegistrations.useQuery(
    { days: DAYS, page, pageSize: PAGE_SIZE },
    { enabled: open, staleTime: 30_000 }
  );

  const rows = (data?.rows as Row[] | undefined) ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-emerald-600" />
            最近 {DAYS} 日新註冊會員
            <Badge variant="secondary" className="ml-2">{total} 人</Badge>
          </DialogTitle>
          <DialogDescription>
            每頁顯示 {PAGE_SIZE} 人，按註冊時間倒序排列；商戶 / 訂閱 / 保證金資訊一覽。
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">載入中…</div>
        ) : rows.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            最近 {DAYS} 日內未有新會員註冊。
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {rows.map((u) => (
                <div
                  key={u.id}
                  className="border border-amber-100 rounded-lg p-3 bg-amber-50/30 hover:bg-amber-50/60 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{u.name || "(未填名)"}</span>
                        <span className="text-xs text-muted-foreground">#{u.id}</span>
                        {tierBadge(u.memberLevel)}
                        {u.role === "admin" && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-red-100 text-red-700 border-red-300">Admin</span>
                        )}
                        {u.merchantStatus === "approved" && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-emerald-100 text-emerald-800 border-emerald-300">
                            <Store className="w-3 h-3" />商戶 {u.merchantName ? `· ${u.merchantName}` : ""}
                          </span>
                        )}
                        {u.merchantStatus === "pending" && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-orange-100 text-orange-700 border-orange-300">商戶申請中</span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 break-all">
                        {u.phone && <span className="mr-3">📱 {u.phone}</span>}
                        {u.email && <span>✉ {u.email}</span>}
                      </div>
                      {(u.planName || u.depositBalance != null) && (
                        <div className="text-xs text-amber-800 mt-1">
                          {u.planName && <span className="mr-3">📦 套餐：{u.planName}</span>}
                          {u.depositBalance != null && (
                            <span>💰 保證金：HK${Number(u.depositBalance).toLocaleString()}</span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(u.createdAt)}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-3 border-t border-amber-100 mt-3">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />上一頁
                </Button>
                <span className="text-xs text-muted-foreground">
                  第 {page} / {totalPages} 頁（共 {total} 人）
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  下一頁<ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
