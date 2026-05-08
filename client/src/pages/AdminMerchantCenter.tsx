import { useState, useMemo } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useConfirm } from "@/components/ui/confirm-provider";
import AdminHeader from "@/components/AdminHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Sparkles, CheckCircle2, XCircle, AlertCircle, ChevronLeft, Inbox,
  Building2, RefreshCw, ArrowRightLeft, Wallet, ExternalLink, Loader2, Image as ImageIcon,
} from "lucide-react";

// ── helpers ──
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
function relTime(d: Date | string | null | undefined) {
  if (!d) return "";
  const ms = Date.now() - new Date(d).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "剛剛";
  if (m < 60) return `${m} 分鐘前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 小時前`;
  const dd = Math.floor(h / 24);
  if (dd < 7) return `${dd} 日前`;
  return fmtDate(d);
}

// ── shared sub-components ──
function ReceiptBox({ url }: { url: string | null | undefined }) {
  if (!url) {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-400 italic px-3 py-2 rounded-lg border border-dashed border-gray-200 bg-gray-50">
        <ImageIcon className="w-3.5 h-3.5" />
        未上載收據
      </div>
    );
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="group flex items-center gap-3 p-2 rounded-xl border border-gray-200 bg-white hover:border-amber-300 hover:shadow-md transition-all"
    >
      <img
        src={url}
        alt="收據"
        className="w-14 h-14 rounded-lg object-cover border border-gray-100 group-hover:scale-105 transition-transform"
      />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-gray-700 flex items-center gap-1">
          🧾 付款收據
          <ExternalLink className="w-3 h-3 text-amber-500 opacity-0 group-hover:opacity-100 transition-opacity" />
        </p>
        <p className="text-[10px] text-gray-400 truncate">點擊放大查看</p>
      </div>
    </a>
  );
}

function EmptyState({ icon, title, desc }: { icon: React.ReactNode; title: string; desc?: string }) {
  return (
    <div className="text-center py-16 px-4">
      <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-gray-100 to-gray-50 mb-4 text-gray-300">
        {icon}
      </div>
      <p className="text-base font-semibold text-gray-700 mb-1">{title}</p>
      {desc && <p className="text-xs text-gray-400 max-w-xs mx-auto">{desc}</p>}
    </div>
  );
}

function LoadingBlock() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
      <Loader2 className="w-8 h-8 animate-spin mb-2" />
      <p className="text-xs">載入中…</p>
    </div>
  );
}

// ── KPI card (top of page) ──
function KpiCard({
  active, count, label, icon, accent, onClick,
}: {
  active: boolean;
  count: number;
  label: string;
  icon: React.ReactNode;
  accent: { text: string; bg: string; border: string; ring: string; dot: string };
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative overflow-hidden rounded-2xl border-2 p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-lg ${
        active ? `${accent.border} ${accent.bg} shadow-md ring-2 ${accent.ring}` : "border-gray-200 bg-white hover:border-gray-300"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${active ? "bg-white/70" : accent.bg} ${accent.text}`}>
          {icon}
        </div>
        {count > 0 && (
          <span className={`relative inline-flex items-center justify-center min-w-[32px] h-8 px-2 rounded-full text-sm font-bold text-white ${accent.dot} shadow`}>
            {count}
            <span className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ${accent.dot} animate-ping opacity-75`} />
          </span>
        )}
      </div>
      <p className={`text-sm font-bold ${active ? accent.text : "text-gray-700"}`}>{label}</p>
      <p className="text-xs text-gray-500 mt-0.5">
        {count === 0 ? "全部已處理" : `${count} 宗待審核`}
      </p>
    </button>
  );
}

const ACCENTS = {
  amber: { text: "text-amber-700", bg: "bg-amber-50", border: "border-amber-300", ring: "ring-amber-200", dot: "bg-amber-500" },
  blue: { text: "text-blue-700", bg: "bg-blue-50", border: "border-blue-300", ring: "ring-blue-200", dot: "bg-blue-500" },
  purple: { text: "text-purple-700", bg: "bg-purple-50", border: "border-purple-300", ring: "ring-purple-200", dot: "bg-purple-500" },
  emerald: { text: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-300", ring: "ring-emerald-200", dot: "bg-emerald-500" },
};

// ── Reusable section header for each card ──
function CardHero({
  accent, icon, title, subtitle, amount, badges, time,
}: {
  accent: keyof typeof ACCENTS;
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  amount?: string;
  badges?: React.ReactNode;
  time?: string;
}) {
  const a = ACCENTS[accent];
  return (
    <div className="flex items-start gap-3">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${a.bg} ${a.text} flex-shrink-0`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="min-w-0">
            <h3 className="font-bold text-base text-gray-900 truncate">{title}</h3>
            {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
          </div>
          {amount && (
            <div className={`text-right flex-shrink-0`}>
              <p className={`text-xl font-bold ${a.text} leading-none`}>{amount}</p>
              {time && <p className="text-[10px] text-gray-400 mt-1">{time}</p>}
            </div>
          )}
          {!amount && time && <p className="text-[10px] text-gray-400">{time}</p>}
        </div>
        {badges && <div className="flex flex-wrap gap-1.5 mt-2">{badges}</div>}
      </div>
    </div>
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
  const { data: tierChanges, refetch: refetchTierChanges, isLoading: tierChangesLoading } = trpc.depositTiers.listChangeRequests.useQuery(
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
  const reviewTierChange = trpc.depositTiers.reviewChangeRequest.useMutation({
    onSuccess: (_d, vars) => {
      toast.success(`轉套餐申請 #${vars.id} ${vars.status === "approved" ? "已批准 ✅" : "已拒絕"}`);
      refetchTierChanges();
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
  const pendingTierChanges = useMemo(
    () => (tierChanges ?? []).filter((r: { status: string }) => r.status === "pending"),
    [tierChanges]
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
    planChange: pendingTierChanges.length,
    topup: pendingTopUps.length,
  };
  const totalPending = counts.onboarding + counts.renewal + counts.planChange + counts.topup;

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50/40 via-white to-orange-50/30">
      <AdminHeader />

      <div className="container max-w-6xl py-6 space-y-6">
        {/* ── Hero ── */}
        <div>
          <Link href="/admin" className="inline-flex items-center gap-1 text-sm text-amber-700 hover:text-amber-900 mb-3">
            <ChevronLeft className="w-4 h-4" /> 返回 Admin
          </Link>

          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-500 via-orange-500 to-amber-600 p-6 sm:p-8 shadow-xl">
            {/* decorative blobs */}
            <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute -bottom-16 -left-8 w-56 h-56 rounded-full bg-yellow-300/20 blur-3xl" />
            <div className="absolute top-4 right-6 opacity-10">
              <Sparkles className="w-32 h-32 text-white" />
            </div>

            <div className="relative flex items-start justify-between flex-wrap gap-4">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur text-white text-xs font-medium mb-3">
                  <Sparkles className="w-3.5 h-3.5" />
                  Merchant Approval Hub
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                  商戶統一審批中心
                </h1>
                <p className="text-sm text-white/90 mt-2 max-w-md">
                  新入駐 · 續期 · 轉 plan · 保證金充值 — 4 大商戶流程一頁過理。
                </p>
              </div>

              <div className="bg-white/20 backdrop-blur-md rounded-2xl px-5 py-3 border border-white/30 shadow-lg">
                <p className="text-xs text-white/80 uppercase tracking-wider font-medium">Total Pending</p>
                <p className="text-4xl font-bold text-white leading-none mt-1">{totalPending}</p>
                <p className="text-[10px] text-white/70 mt-1">
                  {totalPending === 0 ? "🎉 全部處理完" : "宗待審核項目"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── KPI / Tab switcher cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard
            active={tab === "onboarding"}
            count={counts.onboarding}
            label="新入駐申請"
            icon={<Building2 className="w-5 h-5" />}
            accent={ACCENTS.amber}
            onClick={() => setTab("onboarding")}
          />
          <KpiCard
            active={tab === "renewal"}
            count={counts.renewal}
            label="訂閱續期"
            icon={<RefreshCw className="w-5 h-5" />}
            accent={ACCENTS.blue}
            onClick={() => setTab("renewal")}
          />
          <KpiCard
            active={tab === "planChange"}
            count={counts.planChange}
            label="轉 Plan"
            icon={<ArrowRightLeft className="w-5 h-5" />}
            accent={ACCENTS.purple}
            onClick={() => setTab("planChange")}
          />
          <KpiCard
            active={tab === "topup"}
            count={counts.topup}
            label="保證金充值"
            icon={<Wallet className="w-5 h-5" />}
            accent={ACCENTS.emerald}
            onClick={() => setTab("topup")}
          />
        </div>

        {/* ── Tabs (hidden visually; KPI cards drive selection but TabsContent handles rendering) ── */}
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList className="sr-only">
            <TabsTrigger value="onboarding">入駐</TabsTrigger>
            <TabsTrigger value="renewal">續期</TabsTrigger>
            <TabsTrigger value="planChange">轉 plan</TabsTrigger>
            <TabsTrigger value="topup">充值</TabsTrigger>
          </TabsList>

          {/* ── Tab 1: 入駐申請 ── */}
          <TabsContent value="onboarding" className="space-y-3 mt-0">
            {appsLoading ? <LoadingBlock /> : pendingApps.length === 0 ? (
              <Card className="border-dashed border-2 border-amber-200 bg-white/70">
                <EmptyState
                  icon={<Inbox className="w-10 h-10" />}
                  title="暫無待審入駐申請"
                  desc="所有新商戶申請都已處理完畢，做得好！"
                />
              </Card>
            ) : pendingApps.map((app: any) => {
              const fullOnboarding = !!(app.chosenPlanId && app.chosenDepositTierId && app.paymentProofUrl && app.paymentReference);
              return (
                <Card key={app.id} className="overflow-hidden border-l-4 border-l-amber-500 border-amber-100 hover:shadow-lg transition-shadow">
                  <CardContent className="p-5 space-y-4">
                    <CardHero
                      accent="amber"
                      icon={<Building2 className="w-5 h-5" />}
                      title={app.merchantName}
                      subtitle={`申請人：${app.applicantName ?? "未知"}`}
                      amount={app.totalAmount ? fmtHKD(app.totalAmount) : undefined}
                      time={relTime(app.createdAt)}
                      badges={
                        <>
                          {fullOnboarding && (
                            <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 text-[10px]">
                              <Sparkles className="w-2.5 h-2.5 mr-0.5" /> 完整套餐
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-[10px] text-gray-500">📞 {app.whatsapp}</Badge>
                          {app.applicantPhone && <Badge variant="outline" className="text-[10px] text-gray-500">📱 {app.applicantPhone}</Badge>}
                          {app.applicantEmail && <Badge variant="outline" className="text-[10px] text-gray-500">📧 {app.applicantEmail}</Badge>}
                        </>
                      }
                    />

                    {app.chosenPlanId ? (
                      <div className="rounded-2xl border-2 border-amber-200 bg-gradient-to-br from-amber-50 via-orange-50/60 to-amber-50 p-4 space-y-3">
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          {app.chosenPlanName && (
                            <div className="bg-white/70 rounded-lg px-3 py-2">
                              <p className="text-[10px] text-amber-600 uppercase tracking-wider font-medium">📅 訂閱計劃</p>
                              <p className="text-sm font-bold text-amber-900 mt-0.5">{app.chosenPlanName}</p>
                              <p className="text-[10px] text-amber-700">{app.chosenPeriod === "yearly" ? "年費" : "月費"}</p>
                            </div>
                          )}
                          {app.chosenTierName && (
                            <div className="bg-white/70 rounded-lg px-3 py-2">
                              <p className="text-[10px] text-amber-600 uppercase tracking-wider font-medium">💰 保證金套餐</p>
                              <p className="text-sm font-bold text-amber-900 mt-0.5">{app.chosenTierName}</p>
                              <p className="text-[10px] text-amber-700">{fmtHKD(app.chosenTierAmount)}</p>
                            </div>
                          )}
                        </div>
                        {app.paymentReference && (
                          <p className="text-xs text-amber-800 flex items-center gap-1.5">
                            <span className="font-medium">🔖 參考號：</span>
                            <code className="bg-white/80 px-2 py-0.5 rounded text-amber-900 font-mono">{app.paymentReference}</code>
                          </p>
                        )}
                        <ReceiptBox url={app.paymentProofUrl} />
                      </div>
                    ) : (
                      <div className="rounded-xl bg-gray-50 border border-gray-200 px-3 py-2 text-xs text-gray-500 italic flex items-center gap-2">
                        <AlertCircle className="w-3.5 h-3.5" /> 舊式 plain 申請（未揀套餐／保證金）
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2 pt-1">
                      {fullOnboarding && (
                        <Button
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
                          className="gold-gradient text-white font-bold shadow-md hover:shadow-lg transition-all"
                        >
                          <Sparkles className="w-4 h-4 mr-1.5" /> 一鍵批核 + 開通
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        disabled={reviewMerchant.isPending}
                        onClick={async () => {
                          const ok = await confirmDialog({ title: "只批商戶身份？", description: "唔會自動開通訂閱／入帳保證金，需要稍後手動處理。" });
                          if (!ok) return;
                          reviewMerchant.mutate({ id: app.id, status: "approved" });
                        }}
                        className="text-emerald-700 border-emerald-300 hover:bg-emerald-50 hover:border-emerald-400"
                      >
                        <CheckCircle2 className="w-4 h-4 mr-1.5" /> {app.chosenPlanId ? "只批商戶" : "批准"}
                      </Button>
                      <Button
                        variant="outline"
                        disabled={reviewMerchant.isPending}
                        onClick={async () => {
                          const ok = await confirmDialog({ title: "確認拒絕？", description: "拒絕後申請者需要重新提交。", tone: "danger" });
                          if (!ok) return;
                          reviewMerchant.mutate({ id: app.id, status: "rejected" });
                        }}
                        className="text-red-600 border-red-200 hover:bg-red-50 ml-auto"
                      >
                        <XCircle className="w-4 h-4 mr-1.5" /> 拒絕
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>

          {/* ── Tab 2: 續期 ── */}
          <TabsContent value="renewal" className="space-y-3 mt-0">
            {subsLoading ? <LoadingBlock /> : pendingRenewals.length === 0 ? (
              <Card className="border-dashed border-2 border-blue-200 bg-white/70">
                <EmptyState
                  icon={<RefreshCw className="w-10 h-10" />}
                  title="暫無待審續期申請"
                  desc="商戶提交續期後會自動出現喺呢度。"
                />
              </Card>
            ) : pendingRenewals.map((sub: any) => (
              <Card key={sub.id} className="overflow-hidden border-l-4 border-l-blue-500 border-blue-100 hover:shadow-lg transition-shadow">
                <CardContent className="p-5 space-y-4">
                  <CardHero
                    accent="blue"
                    icon={<RefreshCw className="w-5 h-5" />}
                    title={sub.userName ?? `User #${sub.userId}`}
                    subtitle={sub.userEmail ?? undefined}
                    time={relTime(sub.createdAt)}
                    badges={
                      <Badge className="bg-blue-500 text-white border-0 text-[10px]">🔄 續期申請</Badge>
                    }
                  />

                  <div className="rounded-2xl border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50/60 p-4 space-y-3">
                    <div className="bg-white/70 rounded-lg px-3 py-2">
                      <p className="text-[10px] text-blue-600 uppercase tracking-wider font-medium">📅 續期計劃</p>
                      <p className="text-sm font-bold text-blue-900 mt-0.5">{sub.planName ?? "—"}</p>
                      <p className="text-[10px] text-blue-700">
                        {sub.billingCycle === "yearly" ? "年費 (延 365 日)" : "月費 (延 30 日)"}
                        {sub.endDate && <span className="ml-2 text-blue-600">· 原到期 {fmtDate(sub.endDate)}</span>}
                      </p>
                    </div>
                    {sub.paymentReference && (
                      <p className="text-xs text-blue-800 flex items-center gap-1.5">
                        <span className="font-medium">🔖 參考號：</span>
                        <code className="bg-white/80 px-2 py-0.5 rounded text-blue-900 font-mono">{sub.paymentReference}</code>
                      </p>
                    )}
                    <ReceiptBox url={sub.paymentProofUrl} />
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button
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
                      className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold shadow-md hover:shadow-lg transition-all"
                    >
                      <CheckCircle2 className="w-4 h-4 mr-1.5" /> 批核 + 延長 {sub.billingCycle === "yearly" ? "365" : "30"} 日
                    </Button>
                    <Button
                      variant="outline"
                      disabled={rejectSub.isPending}
                      onClick={async () => {
                        const ok = await confirmDialog({ title: "確認拒絕續期？", tone: "danger" });
                        if (!ok) return;
                        rejectSub.mutate({ subscriptionId: sub.id });
                      }}
                      className="text-red-600 border-red-200 hover:bg-red-50 ml-auto"
                    >
                      <XCircle className="w-4 h-4 mr-1.5" /> 拒絕
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* ── Tab 3: 轉保證金套餐 ── */}
          <TabsContent value="planChange" className="space-y-3 mt-0">
            {tierChangesLoading ? <LoadingBlock /> : pendingTierChanges.length === 0 ? (
              <Card className="border-dashed border-2 border-purple-200 bg-white/70">
                <EmptyState
                  icon={<ArrowRightLeft className="w-10 h-10" />}
                  title="暫無待審轉套餐申請"
                  desc="商戶申請轉保證金套餐後會喺呢度顯示。差價收據已自動上傳。"
                />
              </Card>
            ) : pendingTierChanges.map((r: any) => (
              <Card key={r.id} className="overflow-hidden border-l-4 border-l-purple-500 border-purple-100 hover:shadow-lg transition-shadow">
                <CardContent className="p-5 space-y-4">
                  <CardHero
                    accent="purple"
                    icon={<ArrowRightLeft className="w-5 h-5" />}
                    title={r.merchantName ?? r.userName ?? `User #${r.userId}`}
                    subtitle={r.userPhone ? `📞 ${r.userPhone}` : undefined}
                    amount={fmtHKD(r.diffAmount)}
                    time={relTime(r.createdAt)}
                    badges={
                      <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0 text-[10px]">
                        🔄 轉套餐 · 須補差價
                      </Badge>
                    }
                  />

                  <div className="rounded-2xl border-2 border-purple-200 bg-gradient-to-br from-purple-50 via-pink-50/60 to-purple-50 p-4 space-y-3">
                    <div className="flex items-center justify-center gap-3 py-2">
                      <div className="text-center min-w-0 flex-1">
                        <p className="text-[10px] text-purple-600 uppercase tracking-wider font-medium">原套餐</p>
                        <p className="text-sm font-bold text-purple-900 mt-0.5 truncate">{r.fromTierName ?? "（無）"}</p>
                      </div>
                      <ArrowRightLeft className="w-5 h-5 text-purple-400 flex-shrink-0" />
                      <div className="text-center min-w-0 flex-1">
                        <p className="text-[10px] text-purple-600 uppercase tracking-wider font-medium">轉至</p>
                        <p className="text-sm font-bold text-purple-900 mt-0.5 truncate">{r.toTierName ?? `Tier #${r.toTierId}`}</p>
                      </div>
                    </div>
                    {r.paymentReference && (
                      <p className="text-xs text-purple-800 flex items-center gap-1.5">
                        <span className="font-medium">🔖 參考號：</span>
                        <code className="bg-white/80 px-2 py-0.5 rounded text-purple-900 font-mono">{r.paymentReference}</code>
                        {r.paymentMethod && <span className="text-[10px] text-purple-500">· {r.paymentMethod}</span>}
                      </p>
                    )}
                    {r.note && (
                      <p className="text-xs text-purple-700 bg-white/50 rounded-lg px-3 py-2 italic">📝 {r.note}</p>
                    )}
                    <ReceiptBox url={r.receiptUrl} />
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button
                      disabled={reviewTierChange.isPending}
                      onClick={async () => {
                        const ok = await confirmDialog({
                          title: "確認批核轉套餐？",
                          description: `將會：\n• 入帳差價 ${fmtHKD(r.diffAmount)}\n• 切換至「${r.toTierName}」套餐\n• 即時更新傭金率／維持門檻`,
                          confirmText: "批核並切換",
                        });
                        if (!ok) return;
                        reviewTierChange.mutate({ id: r.id, status: "approved" });
                      }}
                      className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold shadow-md hover:shadow-lg transition-all"
                    >
                      <CheckCircle2 className="w-4 h-4 mr-1.5" /> 批核 + 切換套餐
                    </Button>
                    <Button
                      variant="outline"
                      disabled={reviewTierChange.isPending}
                      onClick={async () => {
                        const ok = await confirmDialog({ title: "確認拒絕？", description: "拒絕後商戶可重新提交申請。", tone: "danger" });
                        if (!ok) return;
                        reviewTierChange.mutate({ id: r.id, status: "rejected" });
                      }}
                      className="text-red-600 border-red-200 hover:bg-red-50 ml-auto"
                    >
                      <XCircle className="w-4 h-4 mr-1.5" /> 拒絕
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* ── Tab 4: 增值保證金 ── */}
          <TabsContent value="topup" className="space-y-3 mt-0">
            {topUpsLoading ? <LoadingBlock /> : pendingTopUps.length === 0 ? (
              <Card className="border-dashed border-2 border-emerald-200 bg-white/70">
                <EmptyState
                  icon={<Wallet className="w-10 h-10" />}
                  title="暫無待審充值申請"
                  desc="商戶充值申請會即時出現喺呢度。"
                />
              </Card>
            ) : pendingTopUps.map((r: any) => (
              <Card key={r.id} className="overflow-hidden border-l-4 border-l-emerald-500 border-emerald-100 hover:shadow-lg transition-shadow">
                <CardContent className="p-5 space-y-4">
                  <CardHero
                    accent="emerald"
                    icon={<Wallet className="w-5 h-5" />}
                    title={r.merchantName ?? r.userName ?? `User #${r.userId}`}
                    subtitle={r.userPhone ? `📞 ${r.userPhone}` : undefined}
                    amount={fmtHKD(r.amount)}
                    time={relTime(r.createdAt)}
                    badges={
                      <>
                        {r.tierName && (
                          <Badge className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white border-0 text-[10px]">
                            💎 {r.tierName}
                          </Badge>
                        )}
                        {r.bank && <Badge variant="outline" className="text-[10px] text-gray-500">🏦 {r.bank}</Badge>}
                      </>
                    }
                  />

                  <div className="rounded-2xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50/60 p-4 space-y-3">
                    {r.referenceNo && (
                      <p className="text-xs text-emerald-800 flex items-center gap-1.5">
                        <span className="font-medium">🔖 參考號：</span>
                        <code className="bg-white/80 px-2 py-0.5 rounded text-emerald-900 font-mono">{r.referenceNo}</code>
                      </p>
                    )}
                    {r.note && (
                      <div className="bg-white/70 rounded-lg px-3 py-2 text-xs text-emerald-900">
                        <p className="text-[10px] text-emerald-600 uppercase tracking-wider font-medium mb-0.5">📝 商戶備注</p>
                        {r.note}
                      </div>
                    )}
                    <ReceiptBox url={r.receiptUrl} />
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button
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
                      className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold shadow-md hover:shadow-lg transition-all"
                    >
                      <CheckCircle2 className="w-4 h-4 mr-1.5" /> 批准 + 入帳
                    </Button>
                    <Button
                      variant="outline"
                      disabled={reviewTopUp.isPending}
                      onClick={async () => {
                        const ok = await confirmDialog({ title: "確認拒絕充值？", tone: "danger" });
                        if (!ok) return;
                        reviewTopUp.mutate({ id: r.id, status: "rejected" });
                      }}
                      className="text-red-600 border-red-200 hover:bg-red-50 ml-auto"
                    >
                      <XCircle className="w-4 h-4 mr-1.5" /> 拒絕
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>

        {/* ── Footer hint ── */}
        <Card className="bg-gradient-to-r from-gray-50 to-slate-50 border-gray-200">
          <CardContent className="py-3 px-4 text-xs text-gray-500 flex items-center gap-2 flex-wrap">
            <span className="text-gray-400">💡 進階操作（餘額調整 · 計劃管理 · 套餐設定）請去：</span>
            <Link href="/admin/users" className="font-medium text-amber-700 hover:text-amber-900 hover:underline">會員管理</Link>
            <span className="text-gray-300">·</span>
            <Link href="/admin/subscriptions" className="font-medium text-amber-700 hover:text-amber-900 hover:underline">訂閱管理</Link>
            <span className="text-gray-300">·</span>
            <Link href="/admin/deposits" className="font-medium text-amber-700 hover:text-amber-900 hover:underline">保證金管理</Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
