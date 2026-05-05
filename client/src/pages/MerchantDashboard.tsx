import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import Header from "@/components/Header";
import { useState } from "react";
import {
  ChevronLeft, Store, Wallet, Gavel, Clock, CheckCircle2, XCircle,
  AlertCircle, ArrowUpRight, ArrowDownLeft, ShoppingBag, Settings,
  RotateCcw, Layers, CreditCard, PlusCircle, Send, ChevronDown, Loader2,
  Upload, X, ImageIcon, Printer, Search, HelpCircle, Package,
  LayoutList, LayoutGrid, Grid3X3, Maximize2, Link2, Copy,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const DEPOSIT_PAYMENT_METHODS = [
  { value: "bank_transfer", label: "銀行轉帳" },
  { value: "payme", label: "PayMe" },
  { value: "fps", label: "轉數快 FPS" },
  { value: "alipay_hk", label: "支付寶 HK" },
  { value: "wechat_pay", label: "微信支付" },
  { value: "cash", label: "現金" },
  { value: "other", label: "其他" },
];

function topUpStatusBadge(status: string) {
  switch (status) {
    case "pending": return { label: "待審核", cls: "bg-amber-100 text-amber-700 border-amber-200", icon: <Clock className="w-3 h-3" /> };
    case "approved": return { label: "已批准", cls: "bg-green-100 text-green-700 border-green-200", icon: <CheckCircle2 className="w-3 h-3" /> };
    case "rejected": return { label: "已拒絕", cls: "bg-red-100 text-red-600 border-red-200", icon: <XCircle className="w-3 h-3" /> };
    default: return { label: status, cls: "bg-gray-100 text-gray-700 border-gray-200", icon: null };
  }
}

const HKD = (v: string | number) =>
  `HK$${parseFloat(String(v)).toLocaleString("zh-HK", { minimumFractionDigits: 0 })}`;

function StatusBadge({ status }: { status: string }) {
  if (status === "active") return (
    <span className="inline-flex items-center gap-1 text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-2 py-0.5">
      <Clock className="w-3 h-3" /> 進行中
    </span>
  );
  if (status === "ended") return (
    <span className="inline-flex items-center gap-1 text-xs font-medium bg-gray-100 text-gray-500 border border-gray-200 rounded-full px-2 py-0.5">
      <CheckCircle2 className="w-3 h-3" /> 已結束
    </span>
  );
  if (status === "cancelled") return (
    <span className="inline-flex items-center gap-1 text-xs font-medium bg-red-50 text-red-500 border border-red-200 rounded-full px-2 py-0.5">
      <XCircle className="w-3 h-3" /> 已取消
    </span>
  );
  if (status === "draft") return (
    <span className="inline-flex items-center gap-1 text-xs font-medium bg-amber-50 text-amber-600 border border-amber-200 rounded-full px-2 py-0.5">
      草稿
    </span>
  );
  return <span className="text-xs text-gray-400">{status}</span>;
}

type TxType = {
  id?: number;
  type: string;
  amount: string | number;
  balanceAfter?: string | number | null;
  description?: string | null;
  relatedAuctionId?: number | null;
  createdAt?: Date | string | null;
  auctionTitle?: string | null;
  auctionCurrentPrice?: string | number | null;
  auctionWinnerName?: string | null;
};

const TX_LABEL: Record<string, string> = {
  top_up: "充值",
  commission: "傭金扣除",
  refund: "退傭",
  adjustment: "人工調整",
};

function TxRow({ tx, showBalance }: { tx: TxType; showBalance?: boolean }) {
  const amt = parseFloat(String(tx.amount));
  const isIn = amt > 0;
  const bal = tx.balanceAfter != null ? parseFloat(String(tx.balanceAfter)) : null;
  const hasAuction = !!tx.relatedAuctionId && !!tx.auctionTitle;
  const winPrice = tx.auctionCurrentPrice != null ? parseFloat(String(tx.auctionCurrentPrice)) : null;

  const inner = (
    <div className={`flex items-start gap-3 py-2.5 border-b last:border-0 ${hasAuction ? "cursor-pointer hover:bg-amber-50/60 rounded-lg px-1 -mx-1 transition-colors" : ""}`}>
      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${isIn ? "bg-emerald-50" : "bg-red-50"}`}>
        {isIn ? <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600" /> : <ArrowUpRight className="w-3.5 h-3.5 text-red-500" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-gray-800 truncate">{tx.description ?? TX_LABEL[tx.type] ?? tx.type}</p>
        {hasAuction && (
          <div className="mt-0.5 space-y-0.5">
            <p className="text-xs text-amber-700 font-medium truncate">📦 {tx.auctionTitle}</p>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              {tx.auctionWinnerName && <span className="text-gray-700 font-medium">🏆 {tx.auctionWinnerName}</span>}
              {winPrice != null && <span className="text-gray-700 font-medium">{HKD(winPrice)}</span>}
            </div>
          </div>
        )}
        {tx.createdAt && (
          <p className="text-xs text-gray-400 mt-0.5">
            {new Date(tx.createdAt).toLocaleString("zh-HK", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
          </p>
        )}
      </div>
      <div className="text-right flex-shrink-0">
        <p className={`text-xs font-bold ${isIn ? "text-emerald-600" : "text-red-500"}`}>
          {isIn ? "+" : ""}{HKD(amt)}
        </p>
        {showBalance && bal != null && (
          <p className="text-xs text-gray-400">餘：{HKD(bal)}</p>
        )}
      </div>
    </div>
  );

  return hasAuction ? (
    <Link href={`/auctions/${tx.relatedAuctionId}`}>{inner}</Link>
  ) : inner;
}

function printTxReport(
  transactions: TxType[],
  fromDate: string | undefined,
  toDate: string | undefined,
  merchantName: string,
) {
  const totalIn = transactions.filter(t => parseFloat(String(t.amount)) > 0).reduce((s, t) => s + parseFloat(String(t.amount)), 0);
  const totalOut = transactions.filter(t => parseFloat(String(t.amount)) < 0).reduce((s, t) => s + parseFloat(String(t.amount)), 0);
  const net = totalIn + totalOut;

  const byType: Record<string, number> = {};
  transactions.forEach(t => {
    const key = TX_LABEL[t.type] ?? t.type;
    byType[key] = (byType[key] ?? 0) + parseFloat(String(t.amount));
  });

  const rows = transactions.map(tx => {
    const amt = parseFloat(String(tx.amount));
    const bal = tx.balanceAfter != null ? parseFloat(String(tx.balanceAfter)) : null;
    const date = tx.createdAt ? new Date(tx.createdAt).toLocaleString("zh-HK", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";
    const winPrice = tx.auctionCurrentPrice != null ? parseFloat(String(tx.auctionCurrentPrice)) : null;
    return `<tr>
      <td>${date}</td>
      <td>${TX_LABEL[tx.type] ?? tx.type}</td>
      <td>${tx.description ?? "—"}</td>
      <td>${tx.auctionTitle ?? "—"}</td>
      <td>${tx.auctionWinnerName ?? "—"}</td>
      <td style="text-align:right">${winPrice != null ? "HK$" + winPrice.toLocaleString() : "—"}</td>
      <td style="text-align:right;color:${amt >= 0 ? "#059669" : "#dc2626"};font-weight:600">${amt >= 0 ? "+" : ""}HK$${Math.abs(amt).toLocaleString()}</td>
      <td style="text-align:right">${bal != null ? "HK$" + bal.toLocaleString() : "—"}</td>
    </tr>`;
  }).join("");

  const summaryRows = Object.entries(byType).map(([k, v]) =>
    `<tr><td>${k}</td><td style="text-align:right;color:${v >= 0 ? "#059669" : "#dc2626"};font-weight:600">${v >= 0 ? "+" : ""}HK$${Math.abs(v).toLocaleString()}</td></tr>`
  ).join("");

  const period = fromDate || toDate
    ? `${fromDate ?? "—"} 至 ${toDate ?? "—"}`
    : "全部記錄";

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
  <style>
    *{box-sizing:border-box}
    body{font-family:"Helvetica Neue",Arial,"PingFang TC","Microsoft JhengHei",sans-serif;margin:0;padding:20px;color:#1f2937;background:#fff}
    h1{font-size:18px;margin:0 0 4px}
    .sub{font-size:12px;color:#6b7280;margin-bottom:20px}
    .summary-box{display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap}
    .summary-card{border:1px solid #e5e7eb;border-radius:10px;padding:10px 16px;flex:1;min-width:140px}
    .summary-card .label{font-size:11px;color:#6b7280}
    .summary-card .value{font-size:18px;font-weight:700;margin-top:4px}
    table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:20px}
    th,td{border:1px solid #e5e7eb;padding:6px 8px;text-align:left}
    th{background:#fef3c7;font-weight:600}
    tr:nth-child(even){background:#fafafa}
    h2{font-size:14px;font-weight:700;margin-bottom:8px;color:#92400e}
    .green{color:#059669}.red{color:#dc2626}
    table{page-break-inside:auto}
    tr{page-break-inside:avoid}
  </style></head><body>
  <h1>保證金傭金報表 &mdash; ${merchantName}</h1>
  <div class="sub">期間：${period} &nbsp;／&nbsp; 共 ${transactions.length} 筆記錄 &nbsp;／&nbsp; 生成日期：${new Date().toLocaleString("zh-HK")}</div>
  <div class="summary-box">
    <div class="summary-card"><div class="label">總充值</div><div class="value green">+HK$${totalIn.toLocaleString()}</div></div>
    <div class="summary-card"><div class="label">總傭金扣除</div><div class="value red">-HK$${Math.abs(totalOut).toLocaleString()}</div></div>
    <div class="summary-card"><div class="label">期間淨變動</div><div class="value ${net >= 0 ? "green" : "red"}">${net >= 0 ? "+" : ""}HK$${net.toLocaleString()}</div></div>
  </div>
  <h2>按類型匯總</h2>
  <table style="width:auto;min-width:300px">
    <tr><th>類型</th><th style="text-align:right">金額</th></tr>
    ${summaryRows}
  </table>
  <h2>逐筆記錄</h2>
  <table>
    <tr><th>日期時間</th><th>類型</th><th>描述</th><th>商品名稱</th><th>中標會員</th><th style="text-align:right">中標金額</th><th style="text-align:right">金額</th><th style="text-align:right">結餘後</th></tr>
    ${rows}
  </table>
  </body></html>`;

  // 開新視窗顯示完整報表（手機 Chrome / Safari / Mi Browser 的「分享 → 儲存 PDF」
  // 都會以新視窗 viewport 為準，因此必須放在獨立視窗，否則只會截到當前 dashboard 畫面）
  const fullHtml = html.replace(
    "</body>",
    `<div style="margin-top:24px;text-align:center" class="no-print">
      <button onclick="window.print()" style="padding:10px 24px;font-size:14px;background:#f59e0b;color:#fff;border:none;border-radius:8px;cursor:pointer">列印 / 儲存 PDF</button>
    </div>
    <style>@media print{.no-print{display:none !important}}</style>
    <script>setTimeout(function(){try{window.print()}catch(e){}},400)</script>
    </body>`
  );

  const win = window.open("", "_blank");
  if (!win) {
    alert("無法開啟新視窗，請允許彈出視窗後再試");
    return;
  }
  win.document.open();
  win.document.write(fullHtml);
  win.document.close();
}

export default function MerchantDashboard() {
  const { isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();

  // Top-up request form state
  const [showTopUpForm, setShowTopUpForm] = useState(false);
  const [showTopUpHistory, setShowTopUpHistory] = useState(false);
  const [txPage, setTxPage] = useState(1);
  const TX_PAGE_SIZE = 10;

  // Transaction filter state
  const [txFromInput, setTxFromInput] = useState("");
  const [txToInput, setTxToInput] = useState("");
  const [txFromDate, setTxFromDate] = useState<string | undefined>(undefined);
  const [txToDate, setTxToDate] = useState<string | undefined>(undefined);
  const [topUpAmount, setTopUpAmount] = useState("");
  const [topUpPaymentMethod, setTopUpPaymentMethod] = useState("");
  const [topUpRef, setTopUpRef] = useState("");
  const [topUpNote, setTopUpNote] = useState("");
  const [topUpReceiptUrl, setTopUpReceiptUrl] = useState("");
  const [topUpReceiptUploading, setTopUpReceiptUploading] = useState(false);
  const [selectedTierId, setSelectedTierId] = useState<number | null>(null);
  const [showTierInfo, setShowTierInfo] = useState(false);
  const [showMerchantLayout, setShowMerchantLayout] = useState(false);

  const { data: myApp, isLoading: loadingApp } = trpc.merchants.myApplication.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const { data: deposit, isLoading: loadingDeposit } = trpc.sellerDeposits.myDeposit.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const { data: activeTiers } = trpc.depositTiers.listActive.useQuery(undefined, { enabled: isAuthenticated });
  const { data: myTopUpRequests, refetch: refetchTopUpRequests } = trpc.sellerDeposits.myTopUpRequests.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const submitTopUp = trpc.sellerDeposits.submitTopUpRequest.useMutation({
    onSuccess: () => {
      toast.success("充值申請已提交，管理員確認後將更新餘額");
      setShowTopUpForm(false);
      setTopUpAmount(""); setTopUpPaymentMethod(""); setTopUpRef(""); setTopUpNote(""); setTopUpReceiptUrl(""); setSelectedTierId(null);
      refetchTopUpRequests();
    },
    onError: (err) => toast.error(err.message),
  });

  const { data: siteSettings } = trpc.siteSettings.getAll.useQuery();
  const ss = (siteSettings as Record<string, string> | undefined) ?? {};
  const depositPaymentInfo = ss["subscription_payment_methods"] ?? "";
  const depositWarningMessage = ss["depositWarningMessage"] ?? "保證金水平維持不足，可以自行申請保證金充值或者聯絡管理員補交, 以免影響商戶一切正常運作。";

  const uploadReceiptMutation = trpc.subscriptions.uploadPaymentProof.useMutation({
    onSuccess: ({ url }) => { setTopUpReceiptUrl(url); setTopUpReceiptUploading(false); toast.success("收據已上傳"); },
    onError: (err) => { setTopUpReceiptUploading(false); toast.error("上傳失敗：" + err.message); },
  });

  function handleReceiptFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setTopUpReceiptUploading(true);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = (ev.target?.result as string).split(",")[1];
      uploadReceiptMutation.mutate({ base64, filename: file.name });
    };
    reader.readAsDataURL(file);
  }

  const { data: auctions } = trpc.merchants.myAuctions.useQuery(undefined, {
    enabled: isAuthenticated && myApp?.status === "approved",
  });
  const { data: txData, isFetching: txFetching } = trpc.merchants.myTransactions.useQuery(
    { limit: 500, offset: 0, fromDate: txFromDate, toDate: txToDate },
    { enabled: isAuthenticated && myApp?.status === "approved" }
  );
  const { data: quotaInfo } = trpc.merchants.getQuotaInfo.useQuery(undefined, {
    enabled: isAuthenticated && myApp?.status === "approved",
  });
  const { data: merchantSettings } = trpc.merchants.getSettings.useQuery(undefined, {
    enabled: isAuthenticated && myApp?.status === "approved",
  });
  const setListingLayout = trpc.merchants.setListingLayout.useMutation({
    onSuccess: () => { utils.merchants.getSettings.invalidate(); toast.success("市集版面已更新"); },
    onError: (e) => toast.error(e.message),
  });

  const { data: mySubscription } = trpc.subscriptions.mySubscription.useQuery(undefined, {
    enabled: isAuthenticated && myApp?.status === "approved",
  });

  const fmtDate = (d: Date | string | null) => d
    ? new Date(d).toLocaleString("zh-HK", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
    : "—";

  if (loading || loadingApp) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-4xl animate-spin">💰</div>
    </div>
  );

  if (!isAuthenticated) {
    navigate(`/login?from=${encodeURIComponent(window.location.pathname + window.location.search)}`);
    return null;
  }

  if (myApp?.status !== "approved") {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="max-w-lg mx-auto px-4 pt-6 pb-24 text-center space-y-3">
          <AlertCircle className="w-10 h-10 text-amber-400 mx-auto" />
          <p className="font-semibold text-gray-700">你尚未成為商戶會員</p>
          <Link href="/merchant-apply" className="text-sm text-amber-600 underline">前往申請開通商戶</Link>
        </div>
      </div>
    );
  }

  const activeCount = auctions?.filter(a => a.status === "active").length ?? 0;
  const totalCount = auctions?.length ?? 0;
  const balance = deposit ? parseFloat(String(deposit.balance)) : 0;
  const required = deposit ? parseFloat(String(deposit.requiredDeposit)) : 500;
  const warningThreshold = deposit ? parseFloat(String((deposit as { warningDeposit?: string | number }).warningDeposit ?? "1000")) : 1000;
  const depositOk = balance >= required;
  const belowWarning = depositOk && balance < warningThreshold;
  const transactions = (txData ?? []) as TxType[];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="max-w-lg mx-auto px-4 pt-4 pb-28 space-y-4">

        {/* Back + title */}
        <div className="flex items-center gap-2">
          <Link href="/" className="p-1.5 rounded-xl hover:bg-amber-50 transition-colors">
            <ChevronLeft className="w-5 h-5 text-amber-700" />
          </Link>
          <h1 className="text-xl font-bold text-amber-900">商戶後台</h1>
        </div>

        {/* Merchant identity card */}
        <div className="rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 p-4 flex items-center gap-3">
          {myApp.merchantIcon ? (
            <img src={myApp.merchantIcon} alt="" className="w-14 h-14 rounded-xl object-cover border border-amber-200 flex-shrink-0" />
          ) : (
            <div className="w-14 h-14 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center flex-shrink-0">
              <Store className="w-7 h-7 text-amber-400" />
            </div>
          )}
          <div className="min-w-0">
            <p className="font-bold text-amber-900 truncate">{myApp.merchantName}</p>
            {myApp.contactName && <p className="text-sm text-amber-700">{myApp.contactName}</p>}
            <p className="text-xs text-amber-500 mt-0.5">📱 {myApp.whatsapp}</p>
          </div>
        </div>

        {/* 我的商店連結 */}
        {myApp?.userId && (
          <div className="rounded-2xl bg-white border border-blue-100 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Link2 className="w-4 h-4 text-blue-500" />
              <span className="text-sm font-semibold text-gray-700">我的商店連結</span>
            </div>
            <p className="text-xs text-gray-400">分享此連結給客戶，讓他們直接進入你的商店瀏覽商品及拍賣。</p>
            <div className="flex items-center gap-2 bg-blue-50 rounded-xl px-3 py-2 border border-blue-100">
              <span className="text-xs text-blue-700 flex-1 truncate font-mono">
                hongxcollections.com/merchants/{myApp.userId}
              </span>
              <button
                onClick={() => {
                  const url = `https://hongxcollections.com/merchants/${myApp.userId}`;
                  if (navigator.clipboard?.writeText) {
                    navigator.clipboard.writeText(url).then(() => toast.success("商店連結已複製！"));
                  } else {
                    const ta = document.createElement("textarea");
                    ta.value = url; ta.style.position = "fixed"; ta.style.opacity = "0";
                    document.body.appendChild(ta); ta.select(); document.execCommand("copy");
                    document.body.removeChild(ta); toast.success("商店連結已複製！");
                  }
                }}
                className="flex items-center gap-1 text-xs font-semibold text-blue-600 bg-white hover:bg-blue-100 border border-blue-200 px-2.5 py-1 rounded-lg transition-colors shrink-0"
              >
                <Copy className="w-3 h-3" />複製
              </button>
            </div>
          </div>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white border border-amber-100 p-4 space-y-1">
            <div className="flex items-center gap-1.5 text-amber-600">
              <Gavel className="w-4 h-4" />
              <span className="text-xs font-medium">進行中拍賣</span>
            </div>
            <p className="text-2xl font-bold text-amber-900">{activeCount}</p>
            <p className="text-xs text-gray-400">共 {totalCount} 個</p>
          </div>
          <div className={`rounded-2xl bg-white border p-4 space-y-1 ${depositOk ? (belowWarning ? "border-amber-200" : "border-emerald-100") : "border-red-100"}`}>
            <div className={`flex items-center gap-1.5 ${depositOk ? (belowWarning ? "text-amber-500" : "text-emerald-600") : "text-red-500"}`}>
              <Wallet className="w-4 h-4" />
              <span className="text-xs font-medium">保證金餘額</span>
            </div>
            {loadingDeposit ? (
              <p className="text-sm text-gray-400">載入中…</p>
            ) : (
              <>
                <p className={`text-2xl font-bold ${depositOk ? (belowWarning ? "text-amber-600" : "text-emerald-700") : "text-red-600"}`}>{HKD(balance)}</p>
                <p className="text-xs text-gray-400">需維持水平 {HKD(required)}</p>
              </>
            )}
          </div>
        </div>

        {/* Quota card */}
        {quotaInfo && (
          <div className={`rounded-2xl bg-white border p-4 flex items-center justify-between ${
            quotaInfo.unlimited ? "border-blue-100" :
            quotaInfo.remainingQuota <= 0 ? "border-red-200" :
            quotaInfo.remainingQuota <= 5 ? "border-amber-200" : "border-blue-100"
          }`}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                quotaInfo.unlimited ? "bg-blue-50" :
                quotaInfo.remainingQuota <= 0 ? "bg-red-50" :
                quotaInfo.remainingQuota <= 5 ? "bg-amber-50" : "bg-blue-50"
              }`}>
                <Layers className={`w-5 h-5 ${
                  quotaInfo.unlimited ? "text-blue-500" :
                  quotaInfo.remainingQuota <= 0 ? "text-red-500" :
                  quotaInfo.remainingQuota <= 5 ? "text-amber-500" : "text-blue-500"
                }`} />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">本期發佈次數</p>
                <p className="text-xs text-gray-400 mt-0.5">{quotaInfo.planName}</p>
                {quotaInfo.endDate && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    有效至 {new Date(quotaInfo.endDate).toLocaleDateString("zh-HK", { year: "numeric", month: "2-digit", day: "2-digit" })}
                  </p>
                )}
              </div>
            </div>
            <div className="text-right">
              {quotaInfo.unlimited ? (
                <p className="text-sm font-semibold text-blue-600">無限制</p>
              ) : (
                <>
                  <p className={`text-2xl font-bold ${quotaInfo.remainingQuota <= 0 ? "text-red-600" : quotaInfo.remainingQuota <= 5 ? "text-amber-600" : "text-blue-600"}`}>
                    {quotaInfo.remainingQuota}
                  </p>
                  <p className="text-xs text-gray-400">/ {quotaInfo.maxListings} 次</p>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── 快速功能入口 ── */}
        <div className="grid grid-cols-2 gap-3">
          <Link href="/merchant-auctions">
            <div className="rounded-2xl bg-white border border-amber-100 p-4 flex items-center gap-3 hover:border-amber-300 hover:bg-amber-50/50 transition-colors cursor-pointer">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                <Gavel className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="font-semibold text-sm text-amber-900">拍賣管理</p>
                <p className="text-xs text-gray-400 mt-0.5">刊登 · 草稿 · 封存</p>
              </div>
            </div>
          </Link>
          <Link href="/merchant-products">
            <div className="rounded-2xl bg-white border border-green-100 p-4 flex items-center gap-3 hover:border-green-300 hover:bg-green-50/50 transition-colors cursor-pointer">
              <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center flex-shrink-0">
                <Package className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="font-semibold text-sm text-green-900">商品管理</p>
                <p className="text-xs text-gray-400 mt-0.5">上架 · 定價 · 管理</p>
              </div>
            </div>
          </Link>
          <Link href="/merchant-orders">
            <div className="rounded-2xl bg-white border border-amber-100 p-4 flex items-center gap-3 hover:border-amber-300 hover:bg-amber-50/50 transition-colors cursor-pointer">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                <ShoppingBag className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="font-semibold text-sm text-gray-800">訂單管理</p>
                <p className="text-xs text-gray-400 mt-0.5">追蹤付款 · 交收</p>
              </div>
            </div>
          </Link>
          <Link href="/merchant-refund-requests">
            <div className="rounded-2xl bg-white border border-gray-100 p-4 flex items-center gap-3 hover:border-amber-300 hover:bg-amber-50/50 transition-colors cursor-pointer">
              <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center flex-shrink-0">
                <RotateCcw className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <p className="font-semibold text-sm text-gray-800">退傭申請</p>
                <p className="text-xs text-gray-400 mt-0.5">查看 · 新申請</p>
              </div>
            </div>
          </Link>
          <div className="col-span-2 rounded-2xl bg-white border border-gray-100 overflow-hidden">
            {/* 商戶管理 header row */}
            <div className="flex items-center gap-3 p-4">
              <Link href="/merchant-settings" className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-75 transition-opacity">
                <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <Settings className="w-5 h-5 text-gray-500" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-gray-800">商戶管理</p>
                  <p className="text-xs text-gray-400 mt-0.5">預設拍賣結束日期 · 時間設定</p>
                </div>
              </Link>
              <button
                onClick={() => setShowMerchantLayout(v => !v)}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0 py-1 px-2 rounded-lg hover:bg-gray-50"
              >
                <Store className="w-3.5 h-3.5" />
                <span>市集版面</span>
                <ChevronDown size={12} style={{ transform: showMerchantLayout ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }} />
              </button>
            </div>
            {/* 市集版面 accordion */}
            {showMerchantLayout && (() => {
              const currentLayout = (merchantSettings as any)?.listingLayout ?? "grid2";
              const layouts = [
                { mode: "list", icon: <LayoutList className="w-4 h-4" />, label: "列表", desc: "橫排詳細" },
                { mode: "big", icon: <Maximize2 className="w-4 h-4" />, label: "大圖", desc: "全寬圖片" },
                { mode: "grid2", icon: <LayoutGrid className="w-4 h-4" />, label: "兩欄", desc: "兩列網格" },
                { mode: "grid3", icon: <Grid3X3 className="w-4 h-4" />, label: "三欄", desc: "三列方格" },
              ] as const;
              return (
                <div className="border-t border-gray-100 px-4 pb-4 pt-3 bg-gray-50/60 space-y-2">
                  <p className="text-[11px] text-gray-400">顧客瀏覽你商品的版面</p>
                  <div className="grid grid-cols-4 gap-2">
                    {layouts.map(({ mode, icon, label, desc }) => {
                      const active = currentLayout === mode;
                      return (
                        <button
                          key={mode}
                          onClick={() => setListingLayout.mutate({ layout: mode })}
                          disabled={setListingLayout.isPending}
                          className={`flex flex-col items-center gap-1.5 py-3 px-1 rounded-xl border-2 transition-all ${
                            active
                              ? "border-green-500 bg-green-50 text-green-700"
                              : "border-gray-200 bg-white text-gray-500 hover:border-green-200 hover:bg-green-50/50"
                          }`}
                        >
                          {icon}
                          <span className="text-xs font-semibold">{label}</span>
                          <span className="text-[10px] text-gray-400 leading-tight text-center">{desc}</span>
                          {active && <span className="text-[9px] text-green-600 font-medium">✓ 使用中</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>

          <Link href="/subscriptions">
            <div className="rounded-2xl bg-white border border-purple-100 p-4 flex items-center gap-3 hover:border-purple-300 hover:bg-purple-50/50 transition-colors cursor-pointer">
              <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center flex-shrink-0">
                <CreditCard className="w-5 h-5 text-purple-500" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-sm text-gray-800 truncate">訂閱計劃</p>
                <p className="text-xs text-gray-400 mt-0.5 truncate">
                  {mySubscription?.planName
                    ? `${mySubscription.planName}`
                    : "選擇月費計劃"}
                </p>
                {mySubscription && (
                  <p className={`text-xs font-semibold mt-0.5 ${
                    quotaInfo?.unlimited ? "text-green-600"
                    : quotaInfo && quotaInfo.remainingQuota <= 0 ? "text-red-600"
                    : quotaInfo && quotaInfo.remainingQuota <= 5 ? "text-amber-600"
                    : "text-blue-600"
                  }`}>
                    {quotaInfo?.unlimited
                      ? "無限制"
                      : quotaInfo
                        ? `${quotaInfo.remainingQuota} / ${quotaInfo.maxListings} 次`
                        : ""}
                  </p>
                )}
              </div>
            </div>
          </Link>
        </div>

        {/* ── 保證金警告提示 ── */}
        {!depositOk && deposit && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 flex items-start gap-2 text-sm text-red-600">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{depositWarningMessage}</span>
          </div>
        )}
        {belowWarning && deposit && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 flex items-start gap-2 text-sm text-amber-700">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>保證金餘額低於維持水平/預警門檻（{HKD(warningThreshold)}），建議盡快補交以避免帳戶受限。</span>
          </div>
        )}

        {/* ── 保證金充值申請 (moved above transactions) ── */}
        <Card className="rounded-2xl border-amber-100">
          <CardContent className="p-4 space-y-3">
            {/* ── Header row ── */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PlusCircle className="w-4 h-4 text-amber-600" />
                <h2 className="font-semibold text-amber-900 text-sm">保證金充值申請</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowTopUpForm(v => !v)}
                className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full transition-colors bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200"
              >
                <ChevronDown size={11} style={{ transform: showTopUpForm ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }} />
                {showTopUpForm ? "收起" : "提交申請"}
              </button>
            </div>

            {/* ── 提交表單 ── */}
            {showTopUpForm && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 space-y-4">
                {depositPaymentInfo && (
                  <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                    <p className="text-xs font-semibold text-blue-800 mb-1 flex items-center gap-1">
                      <CreditCard className="w-3 h-3" /> 付款資訊
                    </p>
                    <div className="text-xs text-blue-700 whitespace-pre-line leading-relaxed">{depositPaymentInfo}</div>
                  </div>
                )}

                {/* ── 套餐選擇 ── */}
                {activeTiers && activeTiers.length > 0 ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <Label className="text-xs font-medium text-amber-900">請選擇套餐 *</Label>
                      <button
                        type="button"
                        onClick={() => setShowTierInfo(v => !v)}
                        className="text-amber-400 hover:text-amber-600 transition-colors flex-shrink-0"
                        aria-label="套餐說明"
                      >
                        <HelpCircle size={14} />
                      </button>
                    </div>
                    {showTierInfo && (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900 space-y-1.5 leading-relaxed">
                        <div className="flex gap-2">
                          <span className="text-amber-500 font-bold flex-shrink-0">1.</span>
                          <span>如保證金水平低於<strong>維持水平</strong>，發佈商品將會受到限制。</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-amber-500 font-bold flex-shrink-0">2.</span>
                          <span>如保證金餘額低於<strong>預警水平</strong>，商戶後台會顯示預警訊息，提醒商戶考慮自行充值或聯繫管理員處理。</span>
                        </div>
                      </div>
                    )}
                    <div className="grid grid-cols-1 gap-2">
                      {(activeTiers as { id: number; name: string; amount: string; maintenancePct: string; warningPct: string; commissionRate?: string | null; description: string | null }[]).map(tier => {
                        const amt = parseFloat(tier.amount);
                        const mPct = parseFloat(tier.maintenancePct);
                        const wPct = parseFloat(tier.warningPct);
                        const commPct = tier.commissionRate ? parseFloat(tier.commissionRate) * 100 : null;
                        const isSelected = selectedTierId === tier.id;
                        return (
                          <button
                            key={tier.id}
                            type="button"
                            onClick={() => {
                              setSelectedTierId(tier.id);
                              setTopUpAmount(amt.toString());
                            }}
                            className={`w-full text-left rounded-xl border px-3 py-2.5 transition-all ${isSelected ? "border-amber-500 bg-amber-100 ring-1 ring-amber-400" : "border-amber-200 bg-white hover:border-amber-400 hover:bg-amber-50"}`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm font-semibold text-amber-900">{tier.name}</span>
                                  <span className="text-sm font-bold text-amber-700">HK${amt.toLocaleString()}</span>
                                  {commPct !== null && (
                                    <span className="text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-full px-2 py-0.5">傭金 {commPct.toFixed(2)}%</span>
                                  )}
                                </div>
                                <div className="mt-0.5 text-xs text-gray-500 space-y-0.5">
                                  <div>維持水平 <strong className="text-emerald-700">{mPct}%</strong>（≥ HK${(amt * mPct / 100).toLocaleString()}）</div>
                                  <div>預警 <strong className="text-amber-600">{wPct}%</strong>（≤ HK${(amt * wPct / 100).toLocaleString()}）</div>
                                </div>
                                {tier.description && <p className="text-xs text-gray-400 mt-0.5">{tier.description}</p>}
                              </div>
                              {isSelected && <div className="w-4 h-4 rounded-full bg-amber-500 flex-shrink-0 flex items-center justify-center"><div className="w-2 h-2 rounded-full bg-white" /></div>}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-amber-900">充值金額 (HKD) *</Label>
                    <Input type="number" min="1" step="1" value={topUpAmount} onChange={e => setTopUpAmount(e.target.value)} placeholder="例如：500" className="border-amber-200 focus-visible:ring-amber-400 bg-white" />
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-amber-900">付款方式 *</Label>
                  <Select value={topUpPaymentMethod} onValueChange={setTopUpPaymentMethod}>
                    <SelectTrigger className="border-amber-200 bg-white"><SelectValue placeholder="選擇付款方式" /></SelectTrigger>
                    <SelectContent>{DEPOSIT_PAYMENT_METHODS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-amber-900">轉帳參考號（選填）</Label>
                  <Input value={topUpRef} onChange={e => setTopUpRef(e.target.value)} placeholder="例如：TXN123456" className="border-amber-200 focus-visible:ring-amber-400 bg-white" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-amber-900">付款收據截圖（選填）</Label>
                  {topUpReceiptUrl ? (
                    <div className="relative rounded-lg overflow-hidden border border-amber-200">
                      <img src={topUpReceiptUrl} alt="收據" className="w-full max-h-40 object-contain bg-gray-50" />
                      <button type="button" onClick={() => setTopUpReceiptUrl("")} className="absolute top-1 right-1 bg-white rounded-full p-0.5 shadow border border-gray-200 hover:bg-red-50">
                        <X className="w-3.5 h-3.5 text-gray-500" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-amber-200 rounded-lg p-4 cursor-pointer hover:bg-amber-50 transition-colors bg-white">
                      {topUpReceiptUploading ? <Loader2 className="w-5 h-5 animate-spin text-amber-500" /> : <><Upload className="w-5 h-5 text-amber-400" /><span className="text-xs text-amber-700">點擊上傳收據</span></>}
                      <input type="file" accept="image/*" className="hidden" onChange={handleReceiptFile} disabled={topUpReceiptUploading} />
                    </label>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-amber-900">備注（選填）</Label>
                  <Textarea value={topUpNote} onChange={e => setTopUpNote(e.target.value)} placeholder="如有其他說明" rows={2} className="border-amber-200 focus-visible:ring-amber-400 bg-white resize-none" />
                </div>
                <button
                  type="button"
                  disabled={submitTopUp.isPending || !topUpAmount || !topUpPaymentMethod || (activeTiers && activeTiers.length > 0 && !selectedTierId)}
                  onClick={() => {
                    if (activeTiers && (activeTiers as { id: number }[]).length > 0 && !selectedTierId) return toast.error("請選擇套餐");
                    const amount = parseFloat(topUpAmount);
                    if (isNaN(amount) || amount <= 0) return toast.error("請輸入有效金額");
                    if (!topUpPaymentMethod) return toast.error("請選擇付款方式");
                    const selectedTierName = selectedTierId ? (activeTiers as { id: number; name: string }[] | undefined)?.find(t => t.id === selectedTierId)?.name : null;
                    const noteWithTier = [selectedTierName ? `套餐：${selectedTierName}` : null, topUpNote || null].filter(Boolean).join("｜") || undefined;
                    submitTopUp.mutate({ tierId: selectedTierId ?? undefined, amount, referenceNo: topUpRef || undefined, bank: topUpPaymentMethod, note: noteWithTier, receiptUrl: topUpReceiptUrl || undefined });
                  }}
                  className="w-full flex items-center justify-center gap-2 h-10 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-opacity"
                  style={{ background: "linear-gradient(135deg, #d97706, #b45309)" }}
                >
                  {submitTopUp.isPending ? <><Loader2 size={14} className="animate-spin" />提交中…</> : <><Send size={14} />確認提交充值申請</>}
                </button>
              </div>
            )}

            {/* ── 過往充值記錄 ── */}
            {(myTopUpRequests?.length ?? 0) > 0 && (
              <div>
                <button type="button" onClick={() => setShowTopUpHistory(v => !v)} className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-800 font-medium transition-colors">
                  <ChevronDown size={13} style={{ transform: showTopUpHistory ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }} />
                  過往充值記錄（{myTopUpRequests?.length} 筆）
                </button>
                {showTopUpHistory && (
                  <div className="mt-2 space-y-2">
                    {myTopUpRequests?.map((r: { id: number; amount: string | number; referenceNo: string; bank: string | null; status: string; adminNote: string | null }) => {
                      const sb = topUpStatusBadge(r.status);
                      const pmLabel = DEPOSIT_PAYMENT_METHODS.find(m => m.value === r.bank)?.label ?? r.bank;
                      return (
                        <div key={r.id} className="rounded-xl border border-amber-100 bg-white px-3 py-2.5 flex items-start justify-between gap-2">
                          <div className="min-w-0 space-y-0.5">
                            <p className="text-sm font-bold text-amber-900">HKD {parseFloat(String(r.amount)).toLocaleString()}</p>
                            {pmLabel && <p className="text-xs text-gray-500">付款：{pmLabel}</p>}
                            {r.referenceNo && <p className="text-xs text-gray-400">參考號：{r.referenceNo}</p>}
                            {r.adminNote && <p className="text-xs text-gray-500 bg-gray-50 rounded px-2 py-0.5 mt-1">管理員：{r.adminNote}</p>}
                          </div>
                          <span className={`text-xs font-medium border rounded-full px-2 py-0.5 flex items-center gap-1 flex-shrink-0 ${sb.cls}`}>{sb.icon}{sb.label}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── 保證金交易記錄 ── */}
        <Card className="rounded-2xl border-amber-100">
          <CardContent className="p-4 space-y-3">

            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-amber-600" />
                <h2 className="font-semibold text-amber-900 text-sm">保證金交易記錄</h2>
              </div>
              {transactions.length > 0 && (
                <button
                  onClick={() => printTxReport(transactions, txFromDate, txToDate, myApp?.merchantName ?? "商戶")}
                  className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-800 border border-amber-200 rounded-lg px-2.5 py-1 transition-colors"
                >
                  <Printer className="w-3 h-3" />列印 / PDF
                </button>
              )}
            </div>

            {/* Date range filter */}
            <div className="flex items-end gap-2 flex-wrap">
              <div className="flex-1 min-w-[120px]">
                <p className="text-xs text-gray-400 mb-1">由</p>
                <Input
                  type="date"
                  value={txFromInput}
                  onChange={e => setTxFromInput(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div className="flex-1 min-w-[120px]">
                <p className="text-xs text-gray-400 mb-1">至</p>
                <Input
                  type="date"
                  value={txToInput}
                  onChange={e => setTxToInput(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <button
                onClick={() => { setTxFromDate(txFromInput || undefined); setTxToDate(txToInput || undefined); setTxPage(1); }}
                className="h-8 px-3 rounded-lg text-xs font-medium bg-amber-500 text-white hover:bg-amber-600 flex items-center gap-1 transition-colors flex-shrink-0"
              >
                <Search className="w-3 h-3" />查詢
              </button>
              {(txFromDate || txToDate) && (
                <button
                  onClick={() => { setTxFromInput(""); setTxToInput(""); setTxFromDate(undefined); setTxToDate(undefined); setTxPage(1); }}
                  className="h-8 px-2.5 rounded-lg text-xs text-gray-500 hover:text-gray-700 border border-gray-200 flex items-center gap-1 transition-colors flex-shrink-0"
                >
                  <X className="w-3 h-3" />清除
                </button>
              )}
            </div>

            {/* Summary stats */}
            {transactions.length > 0 && (() => {
              const totalIn  = transactions.filter(t => parseFloat(String(t.amount)) > 0).reduce((s, t) => s + parseFloat(String(t.amount)), 0);
              const totalOut = transactions.filter(t => parseFloat(String(t.amount)) < 0).reduce((s, t) => s + parseFloat(String(t.amount)), 0);
              const net = totalIn + totalOut;
              return (
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2 text-center">
                    <p className="text-xs text-gray-400">總充值</p>
                    <p className="text-sm font-bold text-emerald-600 mt-0.5">+{HKD(totalIn)}</p>
                  </div>
                  <div className="rounded-xl bg-red-50 border border-red-100 px-3 py-2 text-center">
                    <p className="text-xs text-gray-400">總傭金</p>
                    <p className="text-sm font-bold text-red-500 mt-0.5">{HKD(totalOut)}</p>
                  </div>
                  <div className={`rounded-xl border px-3 py-2 text-center ${net >= 0 ? "bg-emerald-50 border-emerald-100" : "bg-red-50 border-red-100"}`}>
                    <p className="text-xs text-gray-400">淨變動</p>
                    <p className={`text-sm font-bold mt-0.5 ${net >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                      {net >= 0 ? "+" : ""}{HKD(net)}
                    </p>
                  </div>
                </div>
              );
            })()}

            {/* Record count / loading */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">
                {txFetching ? "載入中…" : `共 ${transactions.length} 筆記錄`}
                {(txFromDate || txToDate) && !txFetching && (
                  <span className="ml-1 text-amber-600">（已篩選）</span>
                )}
              </span>
            </div>

            {/* Transaction list */}
            {txFetching ? (
              <div className="flex items-center justify-center py-6 gap-2 text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin" /><span className="text-sm">載入中…</span>
              </div>
            ) : transactions.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">
                {txFromDate || txToDate ? "此日期範圍內無記錄" : "暫無交易記錄"}
              </p>
            ) : (
              <div>
                {(() => {
                  const totalPages = Math.max(1, Math.ceil(transactions.length / TX_PAGE_SIZE));
                  const safePage = Math.min(Math.max(1, txPage), totalPages);
                  const start = (safePage - 1) * TX_PAGE_SIZE;
                  const pageRows = transactions.slice(start, start + TX_PAGE_SIZE);
                  return (
                    <>
                      {pageRows.map((tx, i) => (
                        <TxRow key={start + i} tx={tx} showBalance />
                      ))}
                      {transactions.length > TX_PAGE_SIZE && (
                        <div className="flex items-center justify-between mt-3 gap-2">
                          <button
                            type="button"
                            onClick={() => setTxPage(p => Math.max(1, p - 1))}
                            disabled={safePage <= 1}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          >
                            ‹ 上一頁
                          </button>
                          <span className="text-xs text-gray-500">
                            第 <span className="font-semibold text-amber-700">{safePage}</span> / {totalPages} 頁
                            <span className="ml-1 text-gray-400">（共 {transactions.length} 筆）</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => setTxPage(p => Math.min(totalPages, p + 1))}
                            disabled={safePage >= totalPages}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          >
                            下一頁 ›
                          </button>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            )}

          </CardContent>
        </Card>

      </div>
    </div>
  );
}
