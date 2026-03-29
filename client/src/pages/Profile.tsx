import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, TrendingUp, Clock, LogOut, Mail, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export default function Profile() {
  const { user, isAuthenticated, loading, logout } = useAuth();
  const { data: myBids, isLoading } = trpc.auctions.myBids.useQuery(undefined, { enabled: isAuthenticated });
  const [emailInput, setEmailInput] = useState("");
  const [emailSaved, setEmailSaved] = useState(false);

  const utils = trpc.useUtils();
  const updateEmail = trpc.users.updateEmail.useMutation({
    onSuccess: () => {
      setEmailSaved(true);
      toast.success("電郵地址已儲存！往後出價被超越或得標時將收到通知。");
      utils.auth.me.invalidate();
      setTimeout(() => setEmailSaved(false), 3000);
    },
    onError: (err) => {
      toast.error(`儲存失敗：${err.message}`);
    },
  });

  // Initialise email input from user data (once)
  const [emailInitialised, setEmailInitialised] = useState(false);
  if (user?.email && !emailInitialised) {
    setEmailInput(user.email);
    setEmailInitialised(true);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-spin">🪙</div>
          <p className="text-muted-foreground">載入中...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4">🔒</div>
          <p className="text-lg font-medium mb-4">請先登入查看個人資料</p>
          <a href={getLoginUrl()}>
            <Button className="gold-gradient text-white border-0">立即登入</Button>
          </a>
        </div>
      </div>
    );
  }

  const totalBidAmount = (myBids ?? []).reduce((sum: number, bid: { bidAmount: string | number }) => sum + Number(bid.bidAmount), 0);
  const initials = (user?.name ?? "U").slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="nav-glass sticky top-0 z-50">
        <div className="container flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2 font-bold text-xl">
            <span className="text-2xl">💰</span>
            <span className="gold-gradient-text">大BB錢幣店</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/auctions">
              <Button variant="ghost" size="sm" className="text-amber-700 hover:text-amber-900 hover:bg-amber-50">所有拍賣</Button>
            </Link>
            {user?.role === "admin" && (
              <Link href="/admin">
                <Button variant="ghost" size="sm" className="text-amber-700 hover:text-amber-900 hover:bg-amber-50">管理後台</Button>
              </Link>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={logout}
              className="border-red-200 text-red-600 hover:bg-red-50"
            >
              <LogOut className="w-3.5 h-3.5 mr-1" /> 登出
            </Button>
          </div>
        </div>
      </nav>

      <div className="container py-8 max-w-3xl">
        {/* Profile Header */}
        <Card className="mb-6 border-amber-100 overflow-hidden">
          <div className="h-24 gold-gradient" />
          <CardContent className="pt-0 pb-6 px-6">
            <div className="-mt-10 flex items-end justify-between mb-4">
              <div className="w-20 h-20 gold-gradient rounded-2xl flex items-center justify-center text-white font-bold text-2xl border-4 border-white shadow-lg">
                {initials}
              </div>
              <Badge className={user?.role === "admin" ? "bg-amber-600 text-white" : "bg-emerald-500 text-white"}>
                {user?.role === "admin" ? "🔑 管理員" : "👤 一般用戶"}
              </Badge>
            </div>
            <h1 className="text-2xl font-bold">{user?.name}</h1>
            {user?.email && <p className="text-muted-foreground text-sm mt-1">{user.email}</p>}
          </CardContent>
        </Card>

        {/* Email Notification Settings */}
        <Card className="mb-6 border-amber-100">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Mail className="w-4 h-4 text-amber-600" />
              電郵通知設定
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              填寫電郵地址後，系統將在以下情況自動發送通知：出價被他人超越、成功得標、拍賣即將結束。
            </p>
            <div className="space-y-2">
              <Label htmlFor="email-input" className="text-sm font-medium">電郵地址</Label>
              <div className="flex gap-2">
                <Input
                  id="email-input"
                  type="email"
                  placeholder="your@email.com"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  className="border-amber-200 focus-visible:ring-amber-400"
                />
                <Button
                  onClick={() => updateEmail.mutate({ email: emailInput })}
                  disabled={updateEmail.isPending || !emailInput.trim()}
                  className={emailSaved ? "bg-emerald-500 hover:bg-emerald-600 text-white" : "gold-gradient text-white border-0"}
                >
                  {emailSaved ? (
                    <><CheckCircle2 className="w-4 h-4 mr-1" />已儲存</>
                  ) : updateEmail.isPending ? "儲存中..." : "儲存"}
                </Button>
              </div>
            </div>
            {!user?.email && (
              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                <Mail className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                <span>尚未設定電郵，目前不會收到任何通知。請填寫電郵地址以啟用通知功能。</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: "競標次數", value: myBids?.length ?? 0, suffix: "次", icon: TrendingUp },
            { label: "競標總額", value: `HK$${totalBidAmount.toLocaleString()}`, suffix: "", icon: TrendingUp },
            { label: "帳號狀態", value: "正常", suffix: "", icon: User },
          ].map((stat) => (
            <Card key={stat.label} className="border-amber-100 text-center">
              <CardContent className="py-4 px-3">
                <div className="text-xl font-bold text-amber-700">{stat.value}{stat.suffix}</div>
                <div className="text-xs text-muted-foreground mt-1">{stat.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Bid History */}
        <Card className="border-amber-100">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="w-4 h-4 text-amber-600" />
              我的出價記錄
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-14 bg-amber-50 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : myBids && myBids.length > 0 ? (
              <div className="space-y-2">
                {myBids.map((bid: { id: number; auctionId: number; bidAmount: string | number; createdAt: Date }) => (
                  <Link key={bid.id} href={`/auctions/${bid.auctionId}`}>
                    <div className="flex items-center justify-between py-3 px-4 rounded-lg border border-amber-100 hover:border-amber-300 hover:bg-amber-50 transition-all cursor-pointer">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 coin-placeholder rounded-lg flex items-center justify-center text-sm">🪙</div>
                        <div>
                          <div className="text-sm font-medium">拍賣 #{bid.auctionId}</div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(bid.createdAt).toLocaleString("zh-HK")}
                          </div>
                        </div>
                      </div>
                      <div className="font-bold text-amber-700 price-tag">
                        HK${Number(bid.bidAmount).toLocaleString()}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 text-muted-foreground">
                <TrendingUp className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">尚未參與任何競標</p>
                <p className="text-sm mt-1">前往拍賣列表開始競拍</p>
                <Link href="/auctions">
                  <Button className="mt-4 gold-gradient text-white border-0">瀏覽拍賣</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
