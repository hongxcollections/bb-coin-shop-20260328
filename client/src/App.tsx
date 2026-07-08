import { Toaster } from "@/components/ui/sonner";
import { Chatbot } from "@/components/Chatbot";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ConfirmProvider } from "@/components/ui/confirm-provider";
import NotFound from "@/pages/NotFound";
import { Route, Switch, Link } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { ToastProvider } from "./contexts/ToastContext";
import BottomNav from "./components/BottomNav";
import { AutoPushSubscribe } from "./components/AutoPushSubscribe";
import { PushForegroundHandler } from "./components/PushForegroundHandler";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { ShoppingBag } from "lucide-react";
import Home from "./pages/Home";
import Auctions from "./pages/Auctions";
import AuctionDetail from "./pages/AuctionDetail";
import Profile from "./pages/Profile";
import BidHistory from "./pages/BidHistory";
import AdminAuctions from "./pages/AdminAuctions";
import AdminDrafts from "./pages/AdminDrafts";
import AdminArchive from "./pages/AdminArchive";
import UserProfile from "./pages/UserProfile";
import AdminNotifications from "./pages/AdminNotifications";
import AdminUsers from "./pages/AdminUsers";
import AdminSessions from "./pages/AdminSessions";
import AdminAnonymousBids from "./pages/AdminAnonymousBids";
import AdminDashboard from "./pages/AdminDashboard";
import AdminExportBids from "./pages/AdminExportBids";
import AdminSiteSettings from "./pages/AdminSiteSettings";
import AdminWonOrders from "./pages/AdminWonOrders";
import AdminProductOrders from "./pages/AdminProductOrders";
import AdminDeposits from "./pages/AdminDeposits";
import AdminSubscriptions from "./pages/AdminSubscriptions";
import AdminMerchantCenter from "./pages/AdminMerchantCenter";
import AdminLoyalty from "./pages/AdminLoyalty";
import AdminDailyChallenge from "./pages/AdminDailyChallenge";
import AdminCommunitySeeder from "./pages/AdminCommunitySeeder";
import DailyChallenge from "./pages/DailyChallenge";
import SubscriptionPlans from "./pages/SubscriptionPlans";
import Login from "./pages/Login";
import Favorites from "./pages/Favorites";
import CollectionSquare from "./pages/CollectionSquare";
import CollectionPostNew from "./pages/CollectionPostNew";
import CollectionPostDetail from "./pages/CollectionPostDetail";
import MemberBenefits from "./pages/MemberBenefits";
import WebhookSetup from "./pages/WebhookSetup";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import About from "./pages/About";
import MerchantJournal from "./pages/MerchantJournal";
import MerchantApply from "./pages/MerchantApply";
import MerchantDashboard from "./pages/MerchantDashboard";
import MerchantAuctions from "./pages/MerchantAuctions";
import MerchantOrders from "./pages/MerchantOrders";
import MerchantSettings from "./pages/MerchantSettings";
import MerchantRefundRequests from "./pages/MerchantRefundRequests";
import AdminRefundRequests from "./pages/AdminRefundRequests";
import AdminAuctionRecords from "./pages/AdminAuctionRecords";
import AdminBackup from "./pages/AdminBackup";
import AdminSystemTest from "./pages/AdminSystemTest";
import AdminFeaturedListings from "./pages/AdminFeaturedListings";
import AdminAds from "./pages/AdminAds";
import AdminPm001Scraper from "./pages/AdminPm001Scraper";
import AdBanner from "./components/AdBanner";
import AdminPendingNotice from "./components/AdminPendingNotice";
import AdminRecentSignupsAutoPopup from "./components/AdminRecentSignupsAutoPopup";
import AuctionSearch from "./pages/AuctionSearch";
import Merchants from "./pages/Merchants";
import MerchantProducts from "./pages/MerchantProducts";
import MerchantSessions from "./pages/MerchantSessions";
import MerchantSessionEdit from "./pages/MerchantSessionEdit";
import MerchantSessionPublic from "./pages/MerchantSessionPublic";
import MerchantSessionPrint from "./pages/MerchantSessionPrint";
import GroupAuctionList from "./pages/GroupAuctionList";
import GroupAuctionEdit from "./pages/GroupAuctionEdit";
import GroupAuctionBidPage from "./pages/GroupAuctionBidPage";
import GroupAuctionFlyer from "./pages/GroupAuctionFlyer";
import MerchantStore from "./pages/MerchantStore";
import MerchantProductDetail from "./pages/MerchantProductDetail";
import VirtualStore from "./pages/VirtualStore";
import CoinAnalysis from "./pages/CoinAnalysis";
import CardZzz from "./pages/PokeLover";
import PokeCollection from "./pages/PokeCollection";
import CardMarket from "./pages/CardMarket";
import CardMarketSell from "./pages/CardMarketSell";
import CardMarketMy from "./pages/CardMarketMy";
import Messages from "./pages/Messages";
import ChatRoom from "./pages/ChatRoom";
import MerchantGallery from "./pages/MerchantGallery";
import PublicGallery from "./pages/PublicGallery";

function MerchantPendingOrdersNotice() {
  const { user, isAuthenticated } = useAuth();
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

function Router() {
  return (
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
      <Route path={"/cardzx/market/sell"} component={CardMarketSell} />
      <Route path={"/cardzx/market/wtb"} component={CardMarketSell} />
      <Route path={"/cardzx/market/my"} component={CardMarketMy} />
      <Route path={"/messages"} component={Messages} />
      <Route path={"/messages/:roomId"} component={ChatRoom} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
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
