import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { ToastProvider } from "./contexts/ToastContext";
import BottomNav from "./components/BottomNav";
import Home from "./pages/Home";
import Auctions from "./pages/Auctions";
import AuctionDetail from "./pages/AuctionDetail";
import Profile from "./pages/Profile";
import AdminAuctions from "./pages/AdminAuctions";
import AdminDrafts from "./pages/AdminDrafts";
import AdminArchive from "./pages/AdminArchive";
import UserProfile from "./pages/UserProfile";
import AdminNotifications from "./pages/AdminNotifications";
import AdminUsers from "./pages/AdminUsers";
import AdminAnonymousBids from "./pages/AdminAnonymousBids";
import AdminDashboard from "./pages/AdminDashboard";
import AdminExportBids from "./pages/AdminExportBids";
import AdminSiteSettings from "./pages/AdminSiteSettings";
import AdminWonOrders from "./pages/AdminWonOrders";
import AdminDeposits from "./pages/AdminDeposits";
import AdminSubscriptions from "./pages/AdminSubscriptions";
import SubscriptionPlans from "./pages/SubscriptionPlans";
import Login from "./pages/Login";
import Favorites from "./pages/Favorites";
import MemberBenefits from "./pages/MemberBenefits";
import WebhookSetup from "./pages/WebhookSetup";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import MerchantApply from "./pages/MerchantApply";

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/auctions"} component={Auctions} />
      <Route path={"/auctions/:id"} component={AuctionDetail} />
      <Route path={"/profile"} component={Profile} />
      <Route path={"/admin"} component={AdminAuctions} />
      <Route path={"/admin/drafts"} component={AdminDrafts} />
      <Route path={"/admin/archive"} component={AdminArchive} />
      <Route path={"/users/:userId"} component={UserProfile} />
      <Route path={"/admin/notifications"} component={AdminNotifications} />
      <Route path={"/admin/users"} component={AdminUsers} />
      <Route path={"/admin/anonymous-bids"} component={AdminAnonymousBids} />
      <Route path={"/admin/dashboard"} component={AdminDashboard} />
      <Route path={"/admin/export-bids"} component={AdminExportBids} />
      <Route path={"/favorites"} component={Favorites} />
      <Route path={"/member-benefits"} component={MemberBenefits} />
      <Route path={"/admin/webhook-setup"} component={WebhookSetup} />
      <Route path={"/admin/settings"} component={AdminSiteSettings} />
      <Route path={"/admin/won-orders"} component={AdminWonOrders} />
      <Route path={"/admin/deposits"} component={AdminDeposits} />
      <Route path={"/admin/subscriptions"} component={AdminSubscriptions} />
      <Route path={"/subscriptions"} component={SubscriptionPlans} />
      <Route path={"/login"} component={Login} />
      <Route path={"/privacy"} component={Privacy} />
      <Route path={"/terms"} component={Terms} />
      <Route path={"/merchant-apply"} component={MerchantApply} />
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
          <ToastProvider>
            <Toaster />
            <Router />
            <BottomNav />
          </ToastProvider>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
