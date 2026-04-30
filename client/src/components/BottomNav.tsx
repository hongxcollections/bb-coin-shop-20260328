import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Link, useLocation } from "wouter";
import { Home, Gavel, Store, User, MoreHorizontal, MessageCircle, Shield, LogOut, ShoppingBag, LayoutDashboard, BookOpen, TrendingUp } from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";
import { useToast } from "@/contexts/ToastContext";
import { trpc } from "@/lib/trpc";

export default function BottomNav() {
  const { user, isAuthenticated, logout } = useAuth();
  const { data: isMerchantData } = trpc.merchants.isMerchant.useQuery(undefined, {
    enabled: isAuthenticated,
    staleTime: 0,
  });
  const { data: _siteSettings, isSuccess: _settingsLoaded } = trpc.siteSettings.getAll.useQuery(undefined, { staleTime: 5 * 60 * 1000 });
  const _ss = (_siteSettings as Record<string, string> | undefined) ?? {};
  const loginWelcomeTitlePhone = _ss.loginWelcomeTitlePhone || "手機登入成功！";
  const loginWelcomeTitleEmail = _ss.loginWelcomeTitleEmail || "電郵登入成功！";
  const loginWelcomeTitleRegister = _ss.loginWelcomeTitleRegister || "手機號碼註冊成功！";
  const loginWelcomeDesc = _ss.loginWelcomeDesc || "歡迎繼續瀏覽網站！";

  const _u = user as { name?: string; phone?: string; email?: string } | null;
  const _resolvedName = _u?.name || _u?.phone || _u?.email || "會員";
  const fillUsername = (tpl: string) => tpl.replace(/\{username\}/g, _resolvedName);
  const isMerchant = isMerchantData === true;
  const [location] = useLocation();
  const [showMore, setShowMore] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const { showToast } = useToast();

  // Close "more" menu when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setShowMore(false);
      }
    }
    if (showMore) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showMore]);

  // Show welcome toast after phone registration (localStorage flag set by Login.tsx)
  useEffect(() => {
    if (!_settingsLoaded) return;
    const flag = localStorage.getItem("showWelcomeToast");
    if (flag === "phone") {
      localStorage.removeItem("showWelcomeToast");
      showToast({
        icon: "✅",
        title: fillUsername(loginWelcomeTitleRegister),
        desc: fillUsername(loginWelcomeDesc),
        durationMs: 4000,
      });
    }
  }, [showToast, loginWelcomeTitleRegister, loginWelcomeDesc, _settingsLoaded, _resolvedName]); // eslint-disable-line react-hooks/exhaustive-deps

  // Show login success toast — wait for siteSettings to load first so loginWelcomeDesc is up-to-date
  useEffect(() => {
    if (!_settingsLoaded) return;
    const method = localStorage.getItem("showLoginToast");
    if (method === "phone" || method === "email") {
      localStorage.removeItem("showLoginToast");
      showToast({
        icon: "✅",
        title: fillUsername(method === "phone" ? loginWelcomeTitlePhone : loginWelcomeTitleEmail),
        desc: fillUsername(loginWelcomeDesc),
        durationMs: 4000,
      });
    }
  }, [showToast, loginWelcomeTitlePhone, loginWelcomeTitleEmail, loginWelcomeDesc, _settingsLoaded, _resolvedName]); // eslint-disable-line react-hooks/exhaustive-deps

  const showComingSoon = useCallback((featureName: string) => {
    showToast({
      icon: "🚧",
      title: featureName + " 功能暫未開通",
      desc: "敬請期待，我們正在努力開發中！",
      durationMs: 2500,
    });
  }, [showToast]);

  const isActive = (path: string) => {
    if (path === "/") return location === "/" || location === "/auctions";
    if (path === "/merchants") return location === "/merchants" || location.startsWith("/merchants/") || location === "/merchant-products";
    return location === path || location.startsWith(path + "/");
  };

  // Hide on admin pages - MUST be after all hooks to avoid React Error #300
  if (location.startsWith("/admin")) return null;

  const navItems = [
    {
      label: "首頁",
      icon: Home,
      path: "/",
      type: "link" as const,
    },
    {
      label: "拍賣",
      icon: Gavel,
      path: "/auctions",
      type: "link" as const,
    },
    {
      label: "客服",
      icon: MessageCircle,
      path: null,
      type: "center" as const,
    },
    {
      label: "商戶",
      icon: Store,
      path: "/merchants",
      type: "link" as const,
    },
    {
      label: "更多",
      icon: MoreHorizontal,
      path: null,
      type: "more" as const,
    },
  ];

  return (
    <>
      {/* Fixed bottom navigation */}
      <nav className="bottom-nav-bar">
        <div className="bottom-nav-inner">
          {navItems.map((item) => {
            // Center button (客服) - elevated circular button, currently disabled
            if (item.type === "center") {
              return (
                <button
                  key={item.label}
                  onClick={() => showComingSoon("客服")}
                  className="bottom-nav-center-btn"
                  aria-label={item.label}
                >
                  <div className="bottom-nav-center-icon">
                    <span className="text-xl">💰</span>
                  </div>
                  <span className="bottom-nav-label">{item.label}</span>
                </button>
              );
            }

            // Disabled items (商店) - show coming soon message
            if (item.type === "disabled") {
              return (
                <button
                  key={item.label}
                  onClick={() => showComingSoon(item.label)}
                  className="bottom-nav-item"
                  style={{ background: "none", border: "none", padding: 0 }}
                >
                  <div className="bottom-nav-btn">
                    <item.icon className="bottom-nav-icon" />
                    <span className="bottom-nav-label">{item.label}</span>
                  </div>
                </button>
              );
            }

            // "More" button with popup menu
            if (item.type === "more") {
              return (
                <div key={item.label} className="bottom-nav-item" ref={moreRef}>
                  <button
                    onClick={() => setShowMore(!showMore)}
                    className={`bottom-nav-btn ${showMore ? "bottom-nav-active" : ""}`}
                    aria-label={item.label}
                  >
                    <item.icon className="bottom-nav-icon" />
                    <span className="bottom-nav-label">{item.label}</span>
                  </button>

                  {/* More menu popup */}
                  {showMore && (
                    <div className="bottom-nav-more-menu">
                      {isAuthenticated ? (
                        <>
                          <Link
                            href="/profile"
                            onClick={() => setShowMore(false)}
                            className="bottom-nav-more-item"
                          >
                            <User className="w-4 h-4" />
                            <span>個人資料</span>
                          </Link>
                          {user?.role === "admin" && (
                            <Link
                              href="/admin"
                              onClick={() => setShowMore(false)}
                              className="bottom-nav-more-item"
                            >
                              <Shield className="w-4 h-4" />
                              <span>管理後台</span>
                            </Link>
                          )}
                          <Link
                            href="/bid-history"
                            onClick={() => setShowMore(false)}
                            className="bottom-nav-more-item"
                          >
                            <TrendingUp className="w-4 h-4" />
                            <span>出價紀錄</span>
                          </Link>
                          {isMerchant && (
                            <Link
                              href="/merchant-dashboard"
                              onClick={() => setShowMore(false)}
                              className="bottom-nav-more-item"
                            >
                              <LayoutDashboard className="w-4 h-4" />
                              <span>商戶後台</span>
                            </Link>
                          )}
                          {!isMerchant && (
                            <Link
                              href="/merchant-apply"
                              onClick={() => setShowMore(false)}
                              className="bottom-nav-more-item"
                            >
                              <ShoppingBag className="w-4 h-4" />
                              <span>開通商戶</span>
                            </Link>
                          )}
                          <button
                            onClick={() => {
                              const name = user?.name ?? "你";
                              setShowMore(false);
                              showToast({ icon: "👋", title: `再見，${name}！`, desc: "歡迎下次再回來", durationMs: 3500 });
                              logout();
                            }}
                            className="bottom-nav-more-item"
                            style={{ background: "none", border: "none", cursor: "pointer", width: "100%", borderTop: "1px solid rgba(0,0,0,0.06)", marginTop: "2px", paddingTop: "6px" }}
                          >
                            <LogOut className="w-4 h-4" style={{ color: "#dc2626" }} />
                            <span>登出 <span style={{ fontSize: "11px", color: "#E07B00", fontWeight: 600 }}>({user?.name})</span></span>
                          </button>
                        </>
                      ) : (
                        <>
                          <a
                            href={`/login?from=${encodeURIComponent(window.location.pathname + window.location.search)}`}
                            className="bottom-nav-more-item"
                          >
                            <User className="w-4 h-4" />
                            <span>登入 / 註冊</span>
                          </a>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            }

            // Regular nav items
            const active = isActive(item.path!);

            return (
              <Link
                key={item.label}
                href={item.path!}
                className="bottom-nav-item"
              >
                <div className={`bottom-nav-btn ${active ? "bottom-nav-active" : ""}`}>
                  <item.icon className={`bottom-nav-icon ${active ? "bottom-nav-icon-active" : ""}`} />
                  <span className={`bottom-nav-label ${active ? "bottom-nav-label-active" : ""}`}>{item.label}</span>
                </div>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
