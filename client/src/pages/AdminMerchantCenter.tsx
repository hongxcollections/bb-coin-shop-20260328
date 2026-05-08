import { useState, useMemo } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useConfirm } from "@/components/ui/confirm-provider";
import AdminHeader from "@/components/AdminHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Sparkles, CheckCircle2, XCircle, AlertCircle, ChevronLeft,
  Building2, RefreshCw, ArrowRightLeft, Wallet, FileText, ExternalLink, Loader2,
} from "lucide-react";

function fmtHKD(v: string | number | null | undefined) {
  if (v == null) return "—";
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (isNaN(n)) return "—";
  return `HK$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function fmtDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString("zh-HK", {
    month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

function ReceiptThumb({ url }: { url: string | null | undefined }) {
  if (!url) return <span className="text-xs text-gray-400">未上載收據</span>;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs text-amber-700 hover:text-amber-900">
      <img src={url} alt="收據" className="w-12 h-12 rounded-lg border border-amber-200 object-cover" />
      <span className="underline flex items-center gap-0.5">查看 <ExternalLink className="w-3 h-3" /></span>
    </a>
  );
}

export default function AdminMerchantCenter() {
  const { user, isAuthenticated, loading } = useAuth();
  const confirmDialog = useConfirm();
  const utils = trpc.useUtils();
  const [tab, setTab] = useState<"onboarding" | "renewal" | "planChange" | "topup">("onboarding");

  const adminEnabled = isAuthenticated && user?.role === "admin";

  // ── Queries ──
  const { data: merchantApps, refetch: refetchApps, isLoading: appsLoading } = trpc.merchants.listAll.useQuery(
    undefined, { enabled: adminEnabled, refetchInterval: 30000 }
  );
  const { data: subscriptions, refetch: refetchSubs, isLoading: subsLoading } = trpc.subscriptions.adminListSubscriptions.useQuery(
    { status: "pending" }, { enabled: adminEnabled, refetchInterval: 30000 }
  );
  const { data: topUps, refetch: refetchTopUps, isLoading: topUpsLoading } = trpc.sellerDeposits.allTopUpRequests.useQuery(
    undefined, { enabled: adminEnabled, refetchInterval: 30000 }
  );

  // ── Mutations ──
  const approveOnboarding = trpc.merchants.approveOnboarding.useMutation({
    onSuccess: (r) => {
      toast.success(`已批核！訂閱 ${r.subscriptionApproved ? "✅" : "—"}　保證金 ${r.depositToppedUp ? `✅ HK$${r.depositAmount.toLocaleString()}` : "—"}`);
      refetchApps();
    },
    onError: (e) => toast.error(e.message || "批核失敗"),
  });

  const reviewMerchant = trpc.merchants.review.useMutation({
    onSuccess: () => { toast.success("已處理"); refetchApps(); },
    onError: (e) => toast.error(e.message || "處理失敗"),
  });

  const approveSub = trpc.subscriptions.adminApprove.useMutation({
    onSuccess: () => { toast.success("續期已批核 ✅"); refetchSubs(); utils.subscriptions.adminListSubscriptions.invalidate(); },
    onError: (e) => toast.error(e.message || "批核失敗"),
  });
  const rejectSub = trpc.subscriptions.adminReject.useMutation({
    onSuccess: () => { toast.success("已拒絕"); refetchSubs(); },
    onError: (e) => toast.error(e.message || "處理失敗"),
  });

  const reviewTopUp = trpc.sellerDeposits.reviewTopUpRequest.useMutation({
    onSuccess: (_d, vars) => {
      toast.success(`充值申請 #${vars.id} ${vars.status === "approved" ? "已批准" : "已拒絕"}`);
      refetchTopUps();
    },
    onError: (e) => toast.error(e.message),
  });

  // ── Derived ──
  const pendingApps = useMemo(
    () => (merchantApps ?? []).filter((a: { status: string }) => a.status === "pending"),
    [merchantApps]
  );
  const pendingRenewals = useMemo(
    () => (subscriptions ?? []).filter((s: { status: string; isRenewal?: number }) => s.status === "pending" && s.isRenewal === 1),
    [subscriptions]
  );
  const pendingTopUps = useMemo(
    () => (topUps ?? []).filter((r: { status: string }) => r.status === "pending"),
    [topUps]
  );

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-amber-500" /></div>;
  }
  if (!isAuthenticated || user?.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">無訪問權限</h2>
          <p className="text-muted-foreground mb-4">此頁面僅限管理員訪問</p>
          <Link href="/"><Button variant="outline">返回首頁</Button></Link>
        </div>
      </div>
    );
  }

  const counts = {
    onboarding: pendingApps.length,
    renewal: pendingRenewals.length,
    planChange: 0,
    topup: pendingTopUps.length,
  };

  return (
    <>
      <AdminHeader />
      <div className="container max-w-6xl py-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <Link href="/admin" className="inline-flex items-center gap-1 text-sm text-amber-700 hover:text-amber-900">
              <ChevronLeft className="w-4 h-4" /> 返回 Admin
            </Link>
            <h1 className="text-2xl font-bold mt-2 flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-amber-500" />
              商戶統一審批中心
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              新入駐 / 續期 / 轉 plan / 保證金充值，4 大流程一頁過。
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="px-2 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-200">入駐 {counts.onboarding}</span>
            <span className="px-2 py-1 rounded-full bg-blue-100 text-blue-800 border border-blue-200">續期 {counts.renewal}</span>
            <span className="px-2 py-1 rounded-full bg-purple-100 text-purple-800 border border-purple-200">轉 plan {counts.planChange}</span>
            <span className="px-2 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">充值 {counts.topup}</span>
          </div>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList className="w-full grid grid-cols-2 sm:grid-cols-4">
            <TabsTrigger value="onboarding" className="flex items-center gap-1.5">
              <Building2 className="w-4 h-4" /> 入駐 <Badge variant="secondary" className="ml-1">{counts.onboarding}</Badge>
            </TabsTrigger>
            <TabsTrigger value="renewal" className="flex items-center gap-1.5">
              <RefreshCw className="w-4 h-4" /> 續期 <Badge variant="secondary" className="ml-1">{counts.renewal}</Badge>
            </TabsTrigger>
            <TabsTrigger value="planChange" className="flex items-center gap-1.5">
              <ArrowRightLeft className="w-4 h-4" /> 轉 plan <Badge variant="secondary" className="ml-1">{counts.planChange}</Badge>
            </TabsTrigger>
            <TabsTrigger value="topup" className="flex items-center gap-1.5">
              <Wallet className="w-4 h-4" /> 充值 <Badge variant="secondary" className="ml-1">{counts.topup}</Badge>
            </TabsTrigger>
          </TabsList>

          {/* ── Tab 1: 入駐申請 ── */}
          <TabsContent value="onboarding" className="space-y-3">
            {appsLoading ? (
              <div className="text-center py-8 text-gray-400"><Loader2 className="w-5 h-5 animate-spin inline mr-2" />載入中…</div>
            ) : pendingApps.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">🎉 暫無待審入駐申請</div>
            ) : pendingApps.map((app: any) => {
              const fullOnboarding = !!(app.chosenPlanId && app.chosenDepositTierId && app.paymentProofUrl && app.paymentReference);
              return (
                <Card key={app.id} className="border-amber-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                      <Building2 className="w-4 h-4 text-amber-600" />
                      {app.merchantName}
                      <span className="text-xs text-gray-400 font-normal">— {app.applicantName ?? "未知"}</span>
                      <span className="text-xs text-gray-400 font-normal ml-auto">{fmtDate(app.createdAt)}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                      <span>📞 {app.whatsapp}</span>
                      {app.applicantPhone && <span>📱 {app.applicantPhone}</span>}
                      {app.applicantEmail && <span>📧 {app.applicantEmail}</span>}
                    </div>

                    {app.chosenPlanId ? (
                      <div className="rounded-xl border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50 px-3 py-2 text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-amber-900">💎 完整入駐套餐</span>
                          <span className="font-bold text-amber-700">{fmtHKD(app.totalAmount)}</span>
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-amber-800">
                          {app.chosenPlanName && <span>📅 {app.chosenPlanName}（{app.chosenPeriod === "yearly" ? "年費" : "月費"}）</span>}
                          {app.chosenTierName && <span>💰 {app.chosenTierName}（{fmtHKD(app.chosenTierAmount)}）</span>}
                        </div>
                        {app.paymentReference && <p className="text-amber-700">🔖 參考號：{app.paymentReference}</p>}
                        <div className="pt-1"><ReceiptThumb url={app.paymentProofUrl} /></div>
                      </div>
                    ) : (
                      <div className="text-xs text-gray-500 italic">舊式 plain 申請（無揀套餐）</div>
                    )}

                    <div className="flex flex-wrap gap-2">
                      {fullOnboarding && (
                        <Button
                          size="sm"
                          disabled={approveOnboarding.isPending}
                          onClick={async () => {
                            const ok = await confirmDialog({
                              title: "確認一鍵批核？",
                              description: `將會同時：\n• 開通訂閱（${app.chosenPlanName ?? ""} ${app.chosenPeriod === "yearly" ? "年費" : "月費"}）\n• 入帳保證金 ${fmtHKD(app.chosenTierAmount)}\n• 批核商戶身份`,
                              confirmText: "一鍵批核",
                            });
                            if (!ok) return;
                            approveOnboarding.mutate({ id: app.id });
                          }}
                          className="gold-gradient text-white font-semibold shadow"
                        >
                          <Sparkles className="w-3.5 h-3.5 mr-1" /> 一鍵批核 + 開通
                        </Button>
                      )}
                      <Button
                        size="sm" variant="outline"
                        disabled={reviewMerchant.isPending}
                        onClick={async () => {
                          const ok = await confirmDialog({ title: "只批商戶身份？", description: "唔會自動開通訂閱／入帳保證金，需要稍後手動處理。" });
                          if (!ok) return;
                          reviewMerchant.mutate({ id: app.id, status: "approved" });
                        }}
                        className="text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> {app.chosenPlanId ? "只批商戶" : "批准"}
                      </Button>
                      <Button
                        size="sm" variant="outline"
                        disabled={reviewMerchant.isPending}
                        onClick={async () => {
                          const ok = await confirmDialog({ title: "確認拒絕？", description: "拒絕後申請者需要重新提交。", tone: "danger" });
                          if (!ok) return;
                          reviewMerchant.mutate({ id: app.id, status: "rejected" });
                        }}
                        className="text-red-600 border-red-200 hover:bg-red-50"
                      >
                        <XCircle className="w-3.5 h-3.5 mr-1" /> 拒絕
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>

          {/* ── Tab 2: 續期 ── */}
          <TabsContent value="renewal" className="space-y-3">
            {subsLoading ? (
              <div className="text-center py-8 text-gray-400"><Loader2 className="w-5 h-5 animate-spin inline mr-2" />載入中…</div>
            ) : pendingRenewals.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">🎉 暫無待審續期申請</div>
            ) : pendingRenewals.map((sub: any) => (
              <Card key={sub.id} className="border-blue-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                    <RefreshCw className="w-4 h-4 text-blue-600" />
                    {sub.userName ?? `User #${sub.userId}`}
                    <Badge className="bg-blue-500 text-white border-0 text-xs">🔄 續期</Badge>
                    <span className="text-xs text-gray-400 font-normal ml-auto">{fmtDate(sub.createdAt)}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="rounded-xl bg-blue-50 border border-blue-200 px-3 py-2 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-blue-900">📅 {sub.planName ?? "—"}（{sub.billingCycle === "yearly" ? "年費" : "月費"}）</span>
                    </div>
                    <div className="text-blue-800 flex flex-wrap gap-x-3">
                      {sub.endDate && <span>原到期：{fmtDate(sub.endDate)}</span>}
                      {sub.paymentReference && <span>🔖 {sub.paymentReference}</span>}
                    </div>
                    <div className="pt-1"><ReceiptThumb url={sub.paymentProofUrl} /></div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      disabled={approveSub.isPending}
                      onClick={async () => {
                        const ok = await confirmDialog({
                          title: "確認批核續期？",
                          description: `將會延長 ${sub.billingCycle === "yearly" ? "365" : "30"} 日。`,
                          confirmText: "批核並延長",
                        });
                        if (!ok) return;
                        approveSub.mutate({ subscriptionId: sub.id });
                      }}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> 批核 + 延長 {sub.billingCycle === "yearly" ? "365" : "30"} 日
                    </Button>
                    <Button
                      size="sm" variant="outline"
                      disabled={rejectSub.isPending}
                      onClick={async () => {
                        const ok = await confirmDialog({ title: "確認拒絕續期？", tone: "danger" });
                        if (!ok) return;
                        rejectSub.mutate({ subscriptionId: sub.id });
                      }}
                      className="text-red-600 border-red-200 hover:bg-red-50"
                    >
                      <XCircle className="w-3.5 h-3.5 mr-1" /> 拒絕
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* ── Tab 3: 轉 plan ── */}
          <TabsContent value="planChange" className="space-y-3">
            <Card className="border-dashed border-purple-200 bg-purple-50/30">
              <CardContent className="py-12 text-center space-y-2">
                <ArrowRightLeft className="w-10 h-10 text-purple-300 mx-auto" />
                <p className="text-sm text-purple-900 font-medium">轉 plan 流程開發中（T5）</p>
                <p className="text-xs text-purple-700/70 max-w-md mx-auto">
                  屆時會自動算差價（升級補差、降級 credit 落下期），商戶上載差價收據後喺呢度一鍵批核。
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Tab 4: 增值保證金 ── */}
          <TabsContent value="topup" className="space-y-3">
            {topUpsLoading ? (
              <div className="text-center py-8 text-gray-400"><Loader2 className="w-5 h-5 animate-spin inline mr-2" />載入中…</div>
            ) : pendingTopUps.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">🎉 暫無待審充值申請</div>
            ) : pendingTopUps.map((r: any) => (
              <Card key={r.id} className="border-emerald-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                    <Wallet className="w-4 h-4 text-emerald-600" />
                    {r.merchantName ?? r.userName ?? `User #${r.userId}`}
                    <Badge className="bg-emerald-500 text-white border-0 text-xs">💰 {fmtHKD(r.amount)}</Badge>
                    <span className="text-xs text-gray-400 font-normal ml-auto">{fmtDate(r.createdAt)}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs space-y-1 text-emerald-900">
                    <div className="flex flex-wrap gap-x-3">
                      {r.bank && <span>🏦 {r.bank}</span>}
                      {r.referenceNo && <span>🔖 {r.referenceNo}</span>}
                      {r.userPhone && <span>📞 {r.userPhone}</span>}
                      {r.tierName && <span>💎 套餐：{r.tierName}</span>}
                    </div>
                    {r.note && <p className="text-emerald-800">📝 {r.note}</p>}
                    <div className="pt-1"><ReceiptThumb url={r.receiptUrl} /></div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      disabled={reviewTopUp.isPending}
                      onClick={async () => {
                        const ok = await confirmDialog({
                          title: "確認批准充值？",
                          description: `將會入帳 ${fmtHKD(r.amount)} 到商戶保證金${r.tierId ? "，並自動套用所選套餐傭金/門檻設定" : ""}。`,
                          confirmText: "批准",
                        });
                        if (!ok) return;
                        reviewTopUp.mutate({ id: r.id, status: "approved" });
                      }}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> 批准 + 入帳
                    </Button>
                    <Button
                      size="sm" variant="outline"
                      disabled={reviewTopUp.isPending}
                      onClick={async () => {
                        const ok = await confirmDialog({ title: "確認拒絕充值？", tone: "danger" });
                        if (!ok) return;
                        reviewTopUp.mutate({ id: r.id, status: "rejected" });
                      }}
                      className="text-red-600 border-red-200 hover:bg-red-50"
                    >
                      <XCircle className="w-3.5 h-3.5 mr-1" /> 拒絕
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>

        <Card className="bg-gray-50 border-gray-200">
          <CardContent className="py-3 text-xs text-gray-500 flex items-center gap-2 flex-wrap">
            <FileText className="w-3.5 h-3.5" />
            <span>呢個係統一審批中心；舊版獨立頁仍然可用：</span>
            <Link href="/admin/users" className="underline hover:text-amber-700">會員管理</Link>
            <span>·</span>
            <Link href="/admin/subscriptions" className="underline hover:text-amber-700">訂閱管理</Link>
            <span>·</span>
            <Link href="/admin/deposits" className="underline hover:text-amber-700">保證金管理</Link>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
