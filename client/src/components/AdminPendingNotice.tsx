import { useState, useEffect, useMemo } from "react";
import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Bell, CreditCard, Wallet } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const PENDING_DIALOG_SESSION_KEY = "adminPendingDialogShown";

export default function AdminPendingNotice() {
  const { user, isAuthenticated } = useAuth();
  const isAdmin = isAuthenticated && user?.role === "admin";
  const [open, setOpen] = useState(false);

  const { data: pendingSubscriptions } = trpc.subscriptions.adminListSubscriptions.useQuery(
    { status: "pending" },
    { enabled: !!isAdmin, staleTime: 30 * 1000 }
  );

  const { data: allTopUpRequests } = trpc.sellerDeposits.allTopUpRequests.useQuery(
    undefined,
    { enabled: !!isAdmin, staleTime: 30 * 1000 }
  );

  const pendingTopUps = useMemo(
    () => (allTopUpRequests ?? []).filter((r: any) => r.status === "pending"),
    [allTopUpRequests]
  );

  const subCount = pendingSubscriptions?.length ?? 0;
  const topUpCount = pendingTopUps.length;
  const totalPending = subCount + topUpCount;

  useEffect(() => {
    if (!isAdmin) return;
    if (pendingSubscriptions === undefined || allTopUpRequests === undefined) return;
    if (totalPending === 0) return;
    try {
      if (sessionStorage.getItem(PENDING_DIALOG_SESSION_KEY) === "1") return;
      sessionStorage.setItem(PENDING_DIALOG_SESSION_KEY, "1");
      setOpen(true);
    } catch {
      setOpen(true);
    }
  }, [isAdmin, pendingSubscriptions, allTopUpRequests, totalPending]);

  // 登出後 reset
  useEffect(() => {
    if (!isAuthenticated) {
      try { sessionStorage.removeItem(PENDING_DIALOG_SESSION_KEY); } catch {}
    }
  }, [isAuthenticated]);

  if (!isAdmin) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md bg-white max-h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-3 shrink-0 border-b">
          <DialogTitle className="flex items-center gap-2 text-amber-700">
            <Bell className="w-5 h-5" />
            有 {totalPending} 項待處理事項
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 px-6 py-4 overflow-y-auto flex-1 min-h-0">
          <p className="text-sm text-gray-700">
            以下商戶申請仍未處理，請盡快前往對應頁面審批：
          </p>

          {subCount > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-violet-800">
                  <CreditCard className="w-4 h-4" />
                  <span className="text-sm font-bold">月費訂閱申請（{subCount} 筆）</span>
                </div>
                <Link href="/admin/subscriptions" onClick={() => setOpen(false)}>
                  <span className="text-xs text-violet-700 underline cursor-pointer">前往審批</span>
                </Link>
              </div>
              <div className="rounded-lg border border-violet-200 bg-violet-50 divide-y divide-violet-100">
                {(pendingSubscriptions ?? []).map((s: any) => {
                  const name = s.merchantName || s.userName || `用戶 #${s.userId}`;
                  return (
                    <div key={s.id} className="px-3 py-2 text-xs">
                      <div className="flex justify-between gap-2">
                        <span className="font-medium text-gray-800 truncate">{name}</span>
                        <span className="text-violet-700 shrink-0">{s.planName ?? "—"}</span>
                      </div>
                      {(s.merchantName && s.userName && s.merchantName !== s.userName) && (
                        <div className="text-gray-500 mt-0.5">會員：{s.userName}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {topUpCount > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-teal-800">
                  <Wallet className="w-4 h-4" />
                  <span className="text-sm font-bold">保證金充值申請（{topUpCount} 筆）</span>
                </div>
                <Link href="/admin/deposits" onClick={() => setOpen(false)}>
                  <span className="text-xs text-teal-700 underline cursor-pointer">前往審批</span>
                </Link>
              </div>
              <div className="rounded-lg border border-teal-200 bg-teal-50 divide-y divide-teal-100">
                {pendingTopUps.map((r: any) => {
                  const name = r.merchantName || r.userName || `用戶 #${r.userId}`;
                  const amt = Number(r.amount ?? 0);
                  return (
                    <div key={r.id} className="px-3 py-2 text-xs">
                      <div className="flex justify-between gap-2">
                        <span className="font-medium text-gray-800 truncate">{name}</span>
                        <span className="text-teal-700 shrink-0">HK${amt.toLocaleString()}</span>
                      </div>
                      {(r.merchantName && r.userName && r.merchantName !== r.userName) && (
                        <div className="text-gray-500 mt-0.5">會員：{r.userName}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 px-6 py-3 shrink-0 border-t bg-white">
          <Button variant="outline" onClick={() => setOpen(false)} className="bg-white">
            關閉
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
