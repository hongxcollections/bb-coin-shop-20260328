import { useState, useEffect, useMemo } from "react";
import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { useToast } from "@/contexts/ToastContext";
import { trpc } from "@/lib/trpc";
import { LogOut, Menu, Bell, CreditCard, Wallet } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const PENDING_DIALOG_SESSION_KEY = "adminPendingDialogShown";

export default function AdminHeader() {
  const { user, logout } = useAuth();
  const { showToast } = useToast();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [pendingDialogOpen, setPendingDialogOpen] = useState(false);

  const isAdmin = user?.role === "admin";

  // 查詢待處理嘅訂閱申請（pending status）
  const { data: pendingSubscriptions } = trpc.subscriptions.adminListSubscriptions.useQuery(
    { status: "pending" },
    { enabled: isAdmin, staleTime: 30 * 1000 }
  );

  // 查詢待處理嘅保證金充值申請（pending status）
  const { data: allTopUpRequests } = trpc.sellerDeposits.allTopUpRequests.useQuery(
    undefined,
    { enabled: isAdmin, staleTime: 30 * 1000 }
  );

  const pendingTopUps = useMemo(
    () => (allTopUpRequests ?? []).filter((r: any) => r.status === "pending"),
    [allTopUpRequests]
  );

  const subCount = pendingSubscriptions?.length ?? 0;
  const topUpCount = pendingTopUps.length;
  const totalPending = subCount + topUpCount;

  // 管理員登入後，每個 session 只彈一次
  useEffect(() => {
    if (!isAdmin) return;
    if (pendingSubscriptions === undefined || allTopUpRequests === undefined) return;
    if (totalPending === 0) return;
    try {
      if (sessionStorage.getItem(PENDING_DIALOG_SESSION_KEY) === "1") return;
      sessionStorage.setItem(PENDING_DIALOG_SESSION_KEY, "1");
      setPendingDialogOpen(true);
    } catch {
      setPendingDialogOpen(true);
    }
  }, [isAdmin, pendingSubscriptions, allTopUpRequests, totalPending]);

  const handleLogout = () => {
    const name = user?.name ?? "你";
    setMobileMenuOpen(false);
    showToast({ icon: "👋", title: `再見，${name}！`, desc: "歡迎下次再回來", durationMs: 3500 });
    try { sessionStorage.removeItem(PENDING_DIALOG_SESSION_KEY); } catch {}
    logout();
  };

  const menuItems = [
    { href: "/auctions", label: "所有拍賣", bg: "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100" },
    { href: "/admin/drafts", label: "📘 草稿審核", bg: "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100" },
    { href: "/admin/archive", label: "📦 封存區", bg: "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100" },
    { href: "/admin/notifications", label: "🔔 通知設定", bg: "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100" },
    { href: "/admin/users", label: "👥 會員管理", bg: "bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100" },
    { href: "/admin/anonymous-bids", label: "🕵️ 匿名出價", bg: "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100" },
    { href: "/admin/dashboard", label: "📊 統計儀表板", bg: "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100" },
    { href: "/admin/export-bids", label: "📥 匯出記錄", bg: "bg-orange-50 text-orange-600 border-orange-200 hover:bg-orange-100" },
    { href: "/admin/settings", label: "⚙️ 站點設定", bg: "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100" },
    { href: "/admin/won-orders", label: "🏆 得標訂單", bg: "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100" },
    { href: "/admin/product-orders", label: "🛒 商品訂單", bg: "bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100" },
    { href: "/admin/deposits", label: "💰 保證金管理", bg: "bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100" },
    { href: "/admin/subscriptions", label: "👑 訂閱管理", bg: "bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100" },
    { href: "/admin/loyalty", label: "🎖️ 會員等級", bg: "bg-pink-50 text-pink-700 border-pink-200 hover:bg-pink-100" },
    { href: "/admin/auction-records", label: "🪙 成交紀錄庫", bg: "bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100" },
    { href: "/admin/featured-listings", label: "⭐ 付費主打管理", bg: "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100" },
    { href: "/admin/ads", label: "📢 廣告管理", bg: "bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100" },
    { href: "/admin/backup", label: "🗄️ 資料庫備份", bg: "bg-green-50 text-green-700 border-green-200 hover:bg-green-100" },
    { href: "/admin/system-test", label: "🛠️ 系統測試", bg: "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100" },
    { href: "/profile", label: "👤 " + (user?.name ?? "個人資料"), bg: "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100" },
  ];

  return (
    <>
      <nav className="nav-glass fixed top-0 left-0 right-0 z-50">
        <div className="container flex items-center justify-between h-16">
          {/* Logo — identical to homepage Header */}
          <Link href="/" className="flex items-center gap-1.5 shrink-0 no-underline">
            <span className="text-xl leading-none" style={{ marginTop: "-2px" }}>💰</span>
            <div className="flex flex-col items-end">
              <span className="gold-gradient-text font-bold text-lg leading-none tracking-tight">
                hongxcollections
              </span>
              <span
                className="block"
                style={{
                  fontSize: "6px",
                  color: "rgba(180, 130, 50, 0.5)",
                  lineHeight: 1,
                  letterSpacing: "0.02em",
                }}
              >
                Powered by 大BB錢幣店
              </span>
            </div>
          </Link>

          {/* Desktop nav pills */}
          <div className="hidden md:flex items-center gap-1 flex-wrap justify-end">
            {menuItems.map(({ href, label, bg }) => (
              <Link key={href} href={href}>
                <button className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${bg}`}>
                  {label}
                </button>
              </Link>
            ))}
            <button
              onClick={handleLogout}
              className="px-2.5 py-1 rounded-full text-xs font-medium border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 transition-colors flex items-center gap-1"
            >
              <LogOut className="w-3 h-3" /> 登出
            </button>
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 rounded-lg hover:bg-amber-50 transition-colors"
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label="開啟選單"
          >
            <Menu className="w-5 h-5 text-amber-700" />
          </button>
        </div>

        {/* Mobile pill dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-amber-100 bg-background/98 backdrop-blur px-4 py-4 shadow-lg">
            <div className="flex flex-wrap gap-2 mb-3">
              {menuItems.map(({ href, label, bg }) => (
                <Link key={href} href={href} onClick={() => setMobileMenuOpen(false)}>
                  <button className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${bg}`}>
                    {label}
                  </button>
                </Link>
              ))}
            </div>
            <div className="border-t border-amber-100 pt-3">
              <button
                onClick={handleLogout}
                className="px-3 py-1.5 rounded-full text-sm font-medium border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 transition-colors flex items-center gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5" /> 登出
              </button>
            </div>
          </div>
        )}
      </nav>
      {/* Spacer */}
      <div className="h-16" />

      {/* ── 管理員待處理事項提示 Dialog ── */}
      <Dialog open={pendingDialogOpen} onOpenChange={setPendingDialogOpen}>
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
                  <Link href="/admin/subscriptions" onClick={() => setPendingDialogOpen(false)}>
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
                  <Link href="/admin/deposits" onClick={() => setPendingDialogOpen(false)}>
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
            <Button
              variant="outline"
              onClick={() => setPendingDialogOpen(false)}
              className="bg-white"
            >
              關閉
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
