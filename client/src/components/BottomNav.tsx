import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Link, useLocation } from "wouter";
import { Home, Gavel, Store, User, MoreHorizontal, MessageCircle, Shield, LogOut, ShoppingBag, LayoutDashboard, BookOpen, TrendingUp, Mail, Sparkles } from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";
import { useToast } from "@/contexts/ToastContext";
import { trpc } from "@/lib/trpc";
import MessagesListDialog from "@/components/MessagesListDialog";

export default function BottomNav() {
  const { user, isAuthenticated, logout } = useAuth();
  const { data: isMerchantData } = trpc.merchants.isMerchant.useQuery(undefined, {
    enabled: isAuthenticated,
    staleTime: 0,
  });
  const { data: chatUnread } = trpc.chat.unreadTotal.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
  const unreadChatCount = (chatUnread as { total?: number } | undefined)?.total ?? 0;
  const isMerchantBuyerCheck = isMerchantData === true;
  const { data: pendingWonCount } = trpc.wonAuctions.myPendingActionCount.useQuery(undefined, {
    enabled: isAuthenticated && !isMerchantBuyerCheck,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
  const { data: acceptedOfferCount } = trpc.offers.myAcceptedCount.useQuery(undefined, {
    enabled: isAuthenticated && !isMerchantBuyerCheck,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
  const buyerActionCount = (Number(pendingWonCount ?? 0)) + (Number(acceptedOfferCount ?? 0));
  // 商戶後台 badge — 4 個 source 加埋一齊
  const isMerchantForBadge = isMerchantData === true;
  const { data: merchantProductOrderCounts } = trpc.productOrders.myMerchantStatusCounts.useQuery(undefined, {
    enabled: isAuthenticated && isMerchantForBadge,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
  const { data: merchantAuctionOrderPending } = trpc.auctionOrders.myPendingCount.useQuery(undefined, {
    enabled: isAuthenticated && isMerchantForBadge,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
  const { data: merchantOfferPending } = trpc.offers.pendingCount.useQuery(undefined, {
    enabled: isAuthenticated && isMerchantForBadge,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
  const merchantActionCount =
    Number((merchantProductOrderCounts as { pending?: number } | undefined)?.pending ?? 0) +
    Number(merchantAuctionOrderPending ?? 0) +
    Number(merchantOfferPending ?? 0) +
    (isMerchantForBadge ? unreadChatCount : 0);
  // 對話訊息只開放畀銀牌或以上 + admin（同 ChatButton 一致）
  const { data: _autoBidStatus } = trpc.loyalty.myAutoBidStatus.useQuery(undefined, { enabled: isAuthenticated });
  const _memberLevel = (_autoBidStatus?.level as string | undefined) ?? "bronze";
  const _isAdmin = user?.role === "admin";
  const canUseChat = _isAdmin || ["silver", "gold", "vip"].includes(_memberLevel);
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
  const [showMessages, setShowMessages] = useState(false);
  const [showContact, setShowContact] = useState(false);
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
                  onClick={() => setShowContact(true)}
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
                          {canUseChat && (
                            <button
                              type="button"
                              onClick={() => {
                                setShowMore(false);
                                setShowMessages(true);
                              }}
                              className="bottom-nav-more-item"
                              style={{ background: "none", border: "none", width: "100%", textAlign: "left" }}
                            >
                              <Mail className="w-4 h-4" />
                              <span>對話訊息</span>
                              {unreadChatCount > 0 && (
                                <span style={{ marginLeft: "auto", background: "#dc2626", color: "white", fontSize: "10px", fontWeight: 700, padding: "1px 6px", borderRadius: "9px", minWidth: "18px", textAlign: "center" }}>
                                  {unreadChatCount > 99 ? "99+" : unreadChatCount}
                                </span>
                              )}
                            </button>
                          )}
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
                            {!isMerchant && buyerActionCount > 0 && (
                              <span style={{ marginLeft: "auto", background: "#dc2626", color: "white", fontSize: "10px", fontWeight: 700, padding: "1px 6px", borderRadius: "9px", minWidth: "18px", textAlign: "center" }}>
                                {buyerActionCount > 99 ? "99+" : buyerActionCount}
                              </span>
                            )}
                          </Link>
                          <Link
                            href="/collection-square"
                            onClick={() => setShowMore(false)}
                            className="bottom-nav-more-item"
                          >
                            <Sparkles className="w-4 h-4" />
                            <span>藏品社區</span>
                          </Link>
                          {isMerchant && (
                            <Link
                              href="/merchant-dashboard"
                              onClick={() => setShowMore(false)}
                              className="bottom-nav-more-item"
                            >
                              <LayoutDashboard className="w-4 h-4" />
                              <span>商戶後台</span>
                              {merchantActionCount > 0 && (
                                <span style={{ marginLeft: "auto", background: "#dc2626", color: "white", fontSize: "10px", fontWeight: 700, padding: "1px 6px", borderRadius: "9px", minWidth: "18px", textAlign: "center" }}>
                                  {merchantActionCount > 99 ? "99+" : merchantActionCount}
                                </span>
                              )}
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
      <MessagesListDialog open={showMessages} onOpenChange={setShowMessages} />

      {/* 客服聯絡 Popup */}
      {showContact && (
        <div
          className="fixed inset-0 z-[200] flex items-end justify-center"
          onClick={() => setShowContact(false)}
        >
          <div className="absolute inset-0 bg-black/50" />
          <div
            className="relative w-full max-w-lg bg-background rounded-t-2xl px-6 pt-5 pb-10 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle bar */}
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-muted-foreground/30" />

            <h2 className="text-base font-bold mb-1">聯絡客服</h2>
            <p className="text-xs text-muted-foreground mb-5">關於任何網站問題，請以下方式聯繫 7×24h</p>

            <div className="space-y-4">
              <a
                href="https://wa.me/85297927793"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900/50 hover:opacity-80 transition-opacity"
              >
                <span className="text-2xl">💬</span>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">WhatsApp</p>
                  <p className="text-sm font-bold">+852 9792 7793</p>
                </div>
              </a>

              <div className="flex items-center gap-3 p-3 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900/50">
                <span className="text-2xl">🟢</span>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">微信 WeChat</p>
                  <p className="text-sm font-bold select-all">davis-yee</p>
                </div>
              </div>

              <a
                href="mailto:ywkyee@gmail.com"
                className="flex items-center gap-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 hover:opacity-80 transition-opacity"
              >
                <span className="text-2xl">✉️</span>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">電郵</p>
                  <p className="text-sm font-bold">ywkyee@gmail.com</p>
                </div>
              </a>
            </div>

            <button
              onClick={() => setShowContact(false)}
              className="mt-6 w-full py-2.5 rounded-xl bg-muted text-sm font-medium hover:bg-muted/80 transition-colors"
            >
              關閉
            </button>
          </div>
        </div>
      )}
    </>
  );
}
