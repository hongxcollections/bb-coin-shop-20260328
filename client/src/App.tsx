import { Toaster } from "@/components/ui/sonner";
import { Chatbot } from "@/components/Chatbot";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ConfirmProvider } from "@/components/ui/confirm-provider";
import { Route, Switch, Link } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { ToastProvider } from "./contexts/ToastContext";
import BottomNav from "./components/BottomNav";
import { AutoPushSubscribe } from "./components/AutoPushSubscribe";
import { PushForegroundHandler } from "./components/PushForegroundHandler";
import { trpc } from "@/lib/trpc";
import { lazy, Suspense, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { ShoppingBag } from "lucide-react";
import AdBanner from "./components/AdBanner";
import AdminPendingNotice from "./components/AdminPendingNotice";
import AdminRecentSignupsAutoPopup from "./components/AdminRecentSignupsAutoPopup";

// Route-level lazy imports — Vite will create separate chunks for each page
const Home = lazy(() => import("./pages/Home"));
const Auctions = lazy(() => import("./pages/Auctions"));
const AuctionDetail = lazy(() => import("./pages/AuctionDetail"));
const Profile = lazy(() => import("./pages/Profile"));
const BidHistory = lazy(() => import("./pages/BidHistory"));
const AdminAuctions = lazy(() => import("./pages/AdminAuctions"));
const AdminDrafts = lazy(() => import("./pages/AdminDrafts"));
const AdminArchive = lazy(() => import("./pages/AdminArchive"));
const UserProfile = lazy(() => import("./pages/UserProfile"));
const AdminNotifications = lazy(() => import("./pages/AdminNotifications"));
const AdminUsers = lazy(() => import("./pages/AdminUsers"));
const AdminSessions = lazy(() => import("./pages/AdminSessions"));
const AdminAnonymousBids = lazy(() => import("./pages/AdminAnonymousBids"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const AdminExportBids = lazy(() => import("./pages/AdminExportBids"));
const AdminSiteSettings = lazy(() => import("./pages/AdminSiteSettings"));
const AdminWonOrders = lazy(() => import("./pages/AdminWonOrders"));
const AdminProductOrders = lazy(() => import("./pages/AdminProductOrders"));
const AdminDeposits = lazy(() => import("./pages/AdminDeposits"));
const AdminSubscriptions = lazy(() => import("./pages/AdminSubscriptions"));
const AdminMerchantCenter = lazy(() => import("./pages/AdminMerchantCenter"));
const AdminLoyalty = lazy(() => import("./pages/AdminLoyalty"));
const AdminDailyChallenge = lazy(() => import("./pages/AdminDailyChallenge"));
const AdminCommunitySeeder = lazy(() => import("./pages/AdminCommunitySeeder"));
const AdminRefundRequests = lazy(() => import("./pages/AdminRefundRequests"));
const AdminAuctionRecords = lazy(() => import("./pages/AdminAuctionRecords"));
const AdminBackup = lazy(() => import("./pages/AdminBackup"));
const AdminSystemTest = lazy(() => import("./pages/AdminSystemTest"));
const AdminFeaturedListings = lazy(() => import("./pages/AdminFeaturedListings"));
const AdminAds = lazy(() => import("./pages/AdminAds"));
const AdminPm001Scraper = lazy(() => import("./pages/AdminPm001Scraper"));
const DailyChallenge = lazy(() => import("./pages/DailyChallenge"));
const SubscriptionPlans = lazy(() => import("./pages/SubscriptionPlans"));
const Login = lazy(() => import("./pages/Login"));
const Favorites = lazy(() => import("./pages/Favorites"));
const CollectionSquare = lazy(() => import("./pages/CollectionSquare"));
const CollectionPostNew = lazy(() => import("./pages/CollectionPostNew"));
const CollectionPostDetail = lazy(() => import("./pages/CollectionPostDetail"));
const MemberBenefits = lazy(() => import("./pages/MemberBenefits"));
const WebhookSetup = lazy(() => import("./pages/WebhookSetup"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));
const About = lazy(() => import("./pages/About"));
const MerchantJournal = lazy(() => import("./pages/MerchantJournal"));
const MerchantApply = lazy(() => import("./pages/MerchantApply"));
const MerchantDashboard = lazy(() => import("./pages/MerchantDashboard"));
const MerchantAuctions = lazy(() => import("./pages/MerchantAuctions"));
const MerchantOrders = lazy(() => import("./pages/MerchantOrders"));
const MerchantSettings = lazy(() => import("./pages/MerchantSettings"));
const MerchantRefundRequests = lazy(() => import("./pages/MerchantRefundRequests"));
const MerchantProducts = lazy(() => import("./pages/MerchantProducts"));
const MerchantSessions = lazy(() => import("./pages/MerchantSessions"));
const MerchantSessionEdit = lazy(() => import("./pages/MerchantSessionEdit"));
const MerchantSessionPublic = lazy(() => import("./pages/MerchantSessionPublic"));
const MerchantSessionPrint = lazy(() => import("./pages/MerchantSessionPrint"));
const MerchantStore = lazy(() => import("./pages/MerchantStore"));
const MerchantProductDetail = lazy(() => import("./pages/MerchantProductDetail"));
const MerchantGallery = lazy(() => import("./pages/MerchantGallery"));
const GroupAuctionList = lazy(() => import("./pages/GroupAuctionList"));
const GroupAuctionEdit = lazy(() => import("./pages/GroupAuctionEdit"));
const GroupAuctionBidPage = lazy(() => import("./pages/GroupAuctionBidPage"));
const GroupAuctionFlyer = lazy(() => import("./pages/GroupAuctionFlyer"));
const AuctionSearch = lazy(() => import("./pages/AuctionSearch"));
const Merchants = lazy(() => import("./pages/Merchants"));
const VirtualStore = lazy(() => import("./pages/VirtualStore"));
const CoinAnalysis = lazy(() => import("./pages/CoinAnalysis"));
const CardZzz = lazy(() => import("./pages/PokeLover"));
const PokeCollection = lazy(() => import("./pages/PokeCollection"));
const CardMarket = lazy(() => import("./pages/CardMarket"));
const CardMarketBrowse = lazy(() => import("./pages/CardMarketBrowse"));
const CardMarketSell = lazy(() => import("./pages/CardMarketSell"));
const CardMarketMy = lazy(() => import("./pages/CardMarketMy"));
const Messages = lazy(() => import("./pages/Messages"));
const ChatRoom = lazy(() => import("./pages/ChatRoom"));
const PublicGallery = lazy(() => import("./pages/PublicGallery"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Guides = lazy(() => import("./pages/Guides"));
const GuideDetail = lazy(() => import("./pages/GuideDetail"));
const AdminArticles = lazy(() => import("./pages/AdminArticles"));

function MerchantPendingOrdersNotice() {
  const { isAuthenticated } = useAuth();
  const { data: isMerchantData } = trpc.merchants.isMerchant.useQuery(undefined, {
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
  });
  const isMerchant = isMerchantData === true;

  const { data: orders = [] } = trpc.productOrders.myMerchantOrders.useQuery(
    { status: "pending" },
    { enabled: isMerchant, refetchInterval: 60_000, staleTime: 30_000 }
  );
  const pendingCount = (orders as any[]).length;

  // 每次進入網站都顯示；只在本次頁面存活期間按 X 才關閉
  const [dismissed, setDismissed] = useState(false);

  const visible = isMerchant && pendingCount > 0 && !dismissed;

  if (!visible) return null;

  return (
    <div
      className="bottom-nav-toast"
      style={{
        zIndex: 99997,
        top: "auto",
        bottom: "calc(4.5rem + env(safe-area-inset-bottom, 0px))",
      }}
    >
      <div className="bottom-nav-toast-inner" style={{ maxWidth: "min(420px, 92vw)" }}>
        <ShoppingBag className="bottom-nav-toast-icon" style={{ width: 18, height: 18, flexShrink: 0 }} />
        <div className="flex-1 min-w-0">
          <div className="bottom-nav-toast-title">
            你有 <span style={{ color: "var(--popup-text)", fontWeight: 700 }}>{pendingCount} 張</span> 待確認貨品訂單
          </div>
          <Link
            href="/merchant-products"
            className="text-xs underline underline-offset-2 mt-0.5 block"
            style={{ color: "var(--popup-desc)" }}
            onClick={() => setDismissed(true)}
          >
            前往訂單管理確認成交 →
          </Link>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="ml-2 opacity-40 hover:opacity-80 transition-opacity flex-shrink-0 text-sm"
          style={{ color: "var(--popup-desc)" }}
          aria-label="關閉"
        >✕</button>
      </div>
    </div>
  );
}

function AnnouncementBanner() {
  const { data: settings } = trpc.siteSettings.getAll.useQuery(undefined, { staleTime: 60 * 1000 });
  const s = (settings as Record<string, string> | undefined) ?? {};
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem("announcementDismissed") === s.announcementText);

  if (s.announcementEnabled !== "true" || !s.announcementText?.trim()) return null;
  if (dismissed) return null;

  return (
    <div className="bottom-nav-toast" style={{ zIndex: 99998 }}>
      <div className="bottom-nav-toast-inner" style={{ maxWidth: "min(400px, 90vw)" }}>
        <span className="bottom-nav-toast-icon">📢</span>
        <div className="flex-1">
          <div className="bottom-nav-toast-title">{s.announcementText}</div>
        </div>
        <button
          onClick={() => {
            sessionStorage.setItem("announcementDismissed", s.announcementText);
            setDismissed(true);
          }}
          className="ml-2 opacity-40 hover:opacity-80 transition-opacity flex-shrink-0 text-sm"
          style={{ color: "var(--popup-desc)" }}
          aria-label="關閉"
        >✕</button>
      </div>
    </div>
  );
}

// Simple spinner shown while a lazy page chunk is loading
function PageLoader() {
  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
      <div style={{ width: 32, height: 32, borderRadius: "50%", border: "3px solid #e5e7eb", borderTopColor: "#6366f1", animation: "spin 0.7s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function Router() {
  return (
    <Suspense fallback={<PageLoader />}>
    <Switch>
        <Route path={"/"} component={Home} />
        <Route path={"/auctions"} component={Auctions} />
        <Route path={"/auctions/:id"} component={AuctionDetail} />
        <Route path={"/profile"} component={Profile} />
        <Route path={"/bid-history"} component={BidHistory} />
        <Route path={"/admin"} component={AdminAuctions} />
        <Route path={"/admin/drafts"} component={AdminDrafts} />
        <Route path={"/admin/archive"} component={AdminArchive} />
        <Route path={"/users/:userId"} component={UserProfile} />
        <Route path={"/admin/notifications"} component={AdminNotifications} />
        <Route path={"/admin/users"} component={AdminUsers} />
        <Route path={"/admin/sessions"} component={AdminSessions} />
        <Route path={"/admin/anonymous-bids"} component={AdminAnonymousBids} />
        <Route path={"/admin/dashboard"} component={AdminDashboard} />
        <Route path={"/admin/export-bids"} component={AdminExportBids} />
        <Route path={"/favorites"} component={Favorites} />
        <Route path={"/collection-square"} component={CollectionSquare} />
        <Route path={"/collection-square/new"} component={CollectionPostNew} />
        <Route path={"/collection-square/:id"} component={CollectionPostDetail} />
        <Route path={"/member-benefits"} component={MemberBenefits} />
        <Route path={"/admin/webhook-setup"} component={WebhookSetup} />
        <Route path={"/admin/settings"} component={AdminSiteSettings} />
        <Route path={"/admin/won-orders"} component={AdminWonOrders} />
        <Route path={"/admin/product-orders"} component={AdminProductOrders} />
        <Route path={"/admin/deposits"} component={AdminDeposits} />
        <Route path={"/admin/subscriptions"} component={AdminSubscriptions} />
        <Route path={"/admin/merchant-center"} component={AdminMerchantCenter} />
        <Route path={"/admin/loyalty"} component={AdminLoyalty} />
        <Route path={"/admin/daily-challenge"} component={AdminDailyChallenge} />
        <Route path={"/admin/community-seeder"} component={AdminCommunitySeeder} />
        <Route path={"/daily-challenge"} component={DailyChallenge} />
        <Route path={"/subscriptions"} component={SubscriptionPlans} />
        <Route path={"/login"} component={Login} />
        <Route path={"/privacy"} component={Privacy} />
        <Route path={"/terms"} component={Terms} />
        <Route path={"/about"} component={About} />
        <Route path={"/merchant/journal"} component={MerchantJournal} />
        <Route path={"/merchant-apply"} component={MerchantApply} />
        <Route path={"/merchant-dashboard"} component={MerchantDashboard} />
        <Route path={"/merchant-auctions"} component={MerchantAuctions} />
        <Route path={"/merchant-orders"} component={MerchantOrders} />
        <Route path={"/merchant-settings"} component={MerchantSettings} />
        <Route path={"/merchant-refund-requests"} component={MerchantRefundRequests} />
        <Route path={"/admin/refund-requests"} component={AdminRefundRequests} />
        <Route path={"/admin/auction-records"} component={AdminAuctionRecords} />
        <Route path={"/admin/backup"} component={AdminBackup} />
        <Route path={"/admin/system-test"} component={AdminSystemTest} />
        <Route path={"/admin/featured-listings"} component={AdminFeaturedListings} />
        <Route path={"/admin/ads"} component={AdminAds} />
        <Route path={"/admin/pm001-scraper"} component={AdminPm001Scraper} />
        <Route path={"/admin/articles"} component={AdminArticles} />
        <Route path={"/guides"} component={Guides} />
        <Route path={"/guides/:slug"} component={GuideDetail} />
        <Route path={"/records"} component={AuctionSearch} />
        <Route path={"/virtual-store"} component={VirtualStore} />
        <Route path={"/merchants"} component={Merchants} />
        <Route path={"/merchants/:userId"} component={MerchantStore} />
        <Route path={"/merchant-products/:id"} component={MerchantProductDetail} />
        <Route path={"/merchant-products"} component={MerchantProducts} />
        <Route path={"/merchant/sessions"} component={MerchantSessions} />
        <Route path={"/merchant/sessions/:id/print/report"} component={MerchantSessionPrint} />
        <Route path={"/merchant/sessions/:id/print/invoice/:winnerId"} component={MerchantSessionPrint} />
        <Route path={"/merchant/sessions/:id"} component={MerchantSessionEdit} />
        <Route path={"/s/:userId/:slug"} component={MerchantSessionPublic} />
        <Route path={"/merchant/group-auctions/new"} component={GroupAuctionEdit} />
        <Route path={"/merchant/group-auctions/:id"} component={GroupAuctionEdit} />
        <Route path={"/merchant/group-auctions"} component={GroupAuctionList} />
        <Route path={"/group/:roundId/flyer"} component={GroupAuctionFlyer} />
        <Route path={"/group/:roundId/bid"} component={GroupAuctionBidPage} />
        <Route path={"/group/:roundId"} component={GroupAuctionBidPage} />
        <Route path={"/merchant/galleries"} component={MerchantGallery} />
        <Route path={"/gallery/:id"} component={PublicGallery} />
        <Route path={"/coin-analysis"} component={CoinAnalysis} />
        <Route path={"/cardzx"} component={CardZzz} />
        <Route path={"/cardzx/collection"} component={PokeCollection} />
        <Route path={"/cardzx/market"} component={CardMarket} />
        <Route path={"/cardzx/market/browse"} component={CardMarketBrowse} />
        <Route path={"/cardzx/market/sell"} component={CardMarketSell} />
        <Route path={"/cardzx/market/wtb"} component={CardMarketSell} />
        <Route path={"/cardzx/market/my"} component={CardMarketMy} />
        <Route path={"/messages"} component={Messages} />
        <Route path={"/messages/:roomId"} component={ChatRoom} />
        <Route path={"/404"} component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light" switchable={true}>
        <TooltipProvider>
          <ConfirmProvider>
          <ToastProvider>
            <Toaster
              position="top-center"
              duration={4000}
              toastOptions={{
                classNames: {
                  error: 'bb-toast-err',
                  success: 'bb-toast-success',
                  info: 'bb-toast-info',
                  warning: 'bb-toast-info',
                  default: 'bb-toast-info',
                },
              }}
            />
            <AnnouncementBanner />
            <AdBanner />
            <MerchantPendingOrdersNotice />
            <AdminPendingNotice />
            <AdminRecentSignupsAutoPopup />
            <AutoPushSubscribe />
            <PushForegroundHandler />
            <Router />
            <BottomNav />
            <Chatbot />
          </ToastProvider>
          </ConfirmProvider>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
