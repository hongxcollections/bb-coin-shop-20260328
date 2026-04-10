import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Link, useLocation } from "wouter";
import { Home, Gavel, Heart, User, MoreHorizontal, MessageCircle, Settings, LogOut, Shield } from "lucide-react";
import { useState, useRef, useEffect } from "react";

export default function BottomNav() {
  const { user, isAuthenticated } = useAuth();
  const [location] = useLocation();
  const [showMore, setShowMore] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

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

  // Hide on admin pages
  if (location.startsWith("/admin")) return null;

  const isActive = (path: string) => {
    if (path === "/") return location === "/" || location === "/auctions";
    return location === path || location.startsWith(path + "/");
  };

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
      label: "收藏",
      icon: Heart,
      path: "/favorites",
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
            // Center button (客服) - elevated circular button
            if (item.type === "center") {
              return (
                <button
                  key={item.label}
                  onClick={() => {
                    // Open WhatsApp or other customer service channel
                    window.open("https://wa.me/85260120828", "_blank");
                  }}
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
                        </>
                      ) : (
                        <a
                          href={getLoginUrl()}
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
            
            // If not authenticated and trying to access favorites, redirect to login
            if (item.path === "/favorites" && !isAuthenticated) {
              return (
                <a
                  key={item.label}
                  href={getLoginUrl(item.path)}
                  className="bottom-nav-item"
                >
                  <div className="bottom-nav-btn">
                    <item.icon className="bottom-nav-icon" />
                    <span className="bottom-nav-label">{item.label}</span>
                  </div>
                </a>
              );
            }

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
