import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Link, useLocation } from "wouter";
import { Home, Gavel, Store, User, MoreHorizontal, MessageCircle, Settings, Shield, LogOut, ShoppingBag } from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";

export default function BottomNav() {
  const { user, isAuthenticated, logout } = useAuth();
  const [location] = useLocation();
  const [showMore, setShowMore] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<"default" | "welcome">("default");
  const moreRef = useRef<HTMLDivElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Show welcome toast after phone registration
  useEffect(() => {
    const flag = localStorage.getItem("showWelcomeToast");
    if (flag === "phone") {
      localStorage.removeItem("showWelcomeToast");
      if (toastTimer.current) clearTimeout(toastTimer.current);
      setToastType("welcome");
      setToastMessage("手機號碼註冊成功！");
      toastTimer.current = setTimeout(() => setToastMessage(null), 4000);
    }
  }, []);

  const showComingSoon = useCallback((featureName: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastType("default");
    setToastMessage(featureName + " 功能暫未開通");
    toastTimer.current = setTimeout(() => setToastMessage(null), 2500);
  }, []);

  const isActive = (path: string) => {
    if (path === "/") return location === "/" || location === "/auctions";
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
      label: "商店",
      icon: Store,
      path: null,
      type: "disabled" as const,
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
      {/* Custom toast notification */}
      {toastMessage && (
        <div className="bottom-nav-toast">
          <div className="bottom-nav-toast-inner">
            <span className="bottom-nav-toast-icon">
              {toastType === "welcome" ? "✅" : "🚧"}
            </span>
            <div>
              <div className="bottom-nav-toast-title">{toastMessage}</div>
              <div className="bottom-nav-toast-desc">
                {toastType === "welcome"
                  ? "歡迎繼續瀏覽網站！"
                  : "敬請期待，我們正在努力開發中！"}
              </div>
            </div>
          </div>
        </div>
      )}

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
                            href="/member-benefits"
                            onClick={() => setShowMore(false)}
                            className="bottom-nav-more-item"
                          >
                            <Settings className="w-4 h-4" />
                            <span>會員福利</span>
                          </Link>
                          <button
                            onClick={() => { setShowMore(false); showComingSoon("開通商戶"); }}
                            className="bottom-nav-more-item"
                            style={{ background: "none", border: "none", cursor: "pointer", width: "100%" }}
                          >
                            <ShoppingBag className="w-4 h-4" />
                            <span>開通商戶</span>
                          </button>
                          <button
                            onClick={() => { setShowMore(false); logout(); }}
                            className="bottom-nav-more-item"
                            style={{ background: "none", border: "none", cursor: "pointer", width: "100%", borderTop: "1px solid rgba(0,0,0,0.06)", marginTop: "2px", paddingTop: "6px" }}
                          >
                            <LogOut className="w-4 h-4" style={{ color: "#dc2626" }} />
                            <span>登出 <span style={{ fontSize: "10px", color: "#999" }}>({user?.name})</span></span>
                          </button>
                        </>
                      ) : (
                        <a
                          href="/login"
                          className="bottom-nav-more-item"
                        >
                          <User className="w-4 h-4" />
                          <span>登入 / 註冊</span>
                        </a>
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
