import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Auctions from "./pages/Auctions";
import AuctionDetail from "./pages/AuctionDetail";
import Profile from "./pages/Profile";
import AdminAuctions from "./pages/AdminAuctions";
import AdminDrafts from "./pages/AdminDrafts";
import AdminArchive from "./pages/AdminArchive";
import AdminNotifications from "./pages/AdminNotifications";
import WebhookSetup from "./pages/WebhookSetup";

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
      <Route path={"/admin/notifications"} component={AdminNotifications} />
      <Route path={"/admin/webhook-setup"} component={WebhookSetup} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
