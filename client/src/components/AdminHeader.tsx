import { useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { useToast } from "@/contexts/ToastContext";
import { LogOut, Menu } from "lucide-react";

export default function AdminHeader() {
  const { user, logout } = useAuth();
  const { showToast } = useToast();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    const name = user?.name ?? "你";
    setMobileMenuOpen(false);
    showToast({ icon: "👋", title: `再見，${name}！`, desc: "歡迎下次再回來", durationMs: 3500 });
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
    { href: "/admin/deposits", label: "💰 保證金管理", bg: "bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100" },
    { href: "/admin/subscriptions", label: "👑 訂閱管理", bg: "bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100" },
    { href: "/admin/loyalty", label: "🎖️ 會員等級", bg: "bg-pink-50 text-pink-700 border-pink-200 hover:bg-pink-100" },
    { href: "/admin/auction-records", label: "🪙 成交紀錄庫", bg: "bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100" },
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
    </>
  );
}
