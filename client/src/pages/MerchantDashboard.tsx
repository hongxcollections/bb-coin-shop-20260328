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
  LayoutList, LayoutGrid, Grid3X3, Maximize2, Link2, Copy, Tag, QrCode, BookOpen, Receipt, Images,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { sanitizeUserText } from "@/lib/utils";
import MerchantOffersDialog from "@/components/MerchantOffersDialog";
import { GroupAuctionCommissionModal } from "@/components/GroupAuctionCommissionModal";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction } from "@/components/ui/alert-dialog";
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
  relatedGroupAuctionRoundId?: number | null;
  createdAt?: Date | string | null;
  auctionTitle?: string | null;
  auctionCurrentPrice?: string | number | null;
  auctionWinnerName?: string | null;
  groupAuctionRoundTitle?: string | null;
};

const TX_LABEL: Record<string, string> = {
  top_up: "充值",
  commission: "傭金扣除",
  refund: "退傭",
  adjustment: "人工調整",
};

function TxRow({ tx, showBalance, onGroupCommission }: {
  tx: TxType;
  showBalance?: boolean;
  onGroupCommission?: (roundId: number, roundTitle: string | null) => void;
}) {
  const amt = parseFloat(String(tx.amount));
  const isIn = amt > 0;
  const bal = tx.balanceAfter != null ? parseFloat(String(tx.balanceAfter)) : null;
  const hasAuction = !!tx.relatedAuctionId && !!tx.auctionTitle;
  const hasGroupRound = !!tx.relatedGroupAuctionRoundId;
  const winPrice = tx.auctionCurrentPrice != null ? parseFloat(String(tx.auctionCurrentPrice)) : null;

  // Detect gallery order description format: 圖片集訂單｜galleryTitle｜itemName｜currency $price
  const isGalleryOrder = typeof tx.description === 'string' && tx.description.startsWith('圖片集訂單｜');
  const galleryParts = isGalleryOrder ? tx.description!.split('｜') : [];
  // galleryParts: [0]="圖片集訂單", [1]=galleryTitle, [2]=itemName, [3]="HKD $xxx"

  const inner = (
    <div className={`flex items-start gap-3 py-2.5 border-b last:border-0 ${hasAuction ? "cursor-pointer hover:bg-amber-50/60 rounded-lg px-1 -mx-1 transition-colors" : ""}`}>
      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${isIn ? "bg-emerald-50" : "bg-red-50"}`}>
        {isIn ? <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600" /> : <ArrowUpRight className="w-3.5 h-3.5 text-red-500" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-gray-800 truncate">
          {isGalleryOrder ? TX_LABEL[tx.type] ?? '傭金扣除' : (tx.description ?? TX_LABEL[tx.type] ?? tx.type)}
        </p>
        {isGalleryOrder && (
          <div className="mt-0.5 space-y-0.5">
            {galleryParts[1] && <p className="text-xs text-purple-700 font-medium truncate">🖼 {galleryParts[1]}</p>}
            {galleryParts[2] && <p className="text-xs text-gray-700 truncate">📦 {galleryParts[2]}</p>}
            {galleryParts[3] && <p className="text-xs text-gray-500">{galleryParts[3]}</p>}
          </div>
        )}
        {hasAuction && (
          <div className="mt-0.5 space-y-0.5">
            <p className="text-xs text-amber-700 font-medium truncate">📦 {tx.auctionTitle}</p>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              {tx.auctionWinnerName && <span className="text-gray-700 font-medium">🏆 {tx.auctionWinnerName}</span>}
              {winPrice != null && <span className="text-gray-700 font-medium">{HKD(winPrice)}</span>}
            </div>
          </div>
        )}
        {hasGroupRound && onGroupCommission && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onGroupCommission(tx.relatedGroupAuctionRoundId!, tx.groupAuctionRoundTitle ?? null);
            }}
            className="mt-1 inline-flex items-center gap-1 text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-lg"
          >
            <Receipt className="w-3 h-3" />
            平台傭金明細
          </button>
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
  const totalIn  = transactions.filter(t => t.type === 'top_up').reduce((s, t) => s + parseFloat(String(t.amount)), 0);
  const totalOut = transactions.filter(t => t.type === 'commission').reduce((s, t) => s + parseFloat(String(t.amount)), 0);
  const net = transactions.reduce((s, t) => s + parseFloat(String(t.amount)), 0);

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

  // Group auction commission modal state
  const [groupCommTarget, setGroupCommTarget] = useState<{ roundId: number; roundTitle: string | null } | null>(null);

  // Top-up request form state
  const [showTopUpForm, setShowTopUpForm] = useState(false);
  const [showTxList, setShowTxList] = useState(false);
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
  const [showOffersDialog, setShowOffersDialog] = useState(false);

  // ── 續期一鍵延長 state ──
  const [renewDialogOpen, setRenewDialogOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [renewPaymentMethod, setRenewPaymentMethod] = useState("");
  const [renewPaymentRef, setRenewPaymentRef] = useState("");
  const [renewProofUrl, setRenewProofUrl] = useState("");
  const [renewProofUploading, setRenewProofUploading] = useState(false);

  // ── 轉保證金套餐 state ──
  const [tierChangeOpen, setTierChangeOpen] = useState(false);
  const [tierChangeTargetId, setTierChangeTargetId] = useState<number | null>(null);
  const [tierChangePaymentMethod, setTierChangePaymentMethod] = useState("");
  const [tierChangeRef, setTierChangeRef] = useState("");
  const [tierChangeNote, setTierChangeNote] = useState("");
  const [tierChangeReceiptUrl, setTierChangeReceiptUrl] = useState("");
  const [tierChangeReceiptUploading, setTierChangeReceiptUploading] = useState(false);

  const { data: pendingOffersCount } = trpc.offers.pendingCount.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchInterval: 60_000,
  });
  const { data: myGalleries } = trpc.productGalleries.myGalleries.useQuery(undefined, {
    enabled: isAuthenticated,
    staleTime: 60_000,
  });
  const galleryCount = (myGalleries as any[] | undefined)?.length ?? 0;

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

  const { data: myTierChangeRequests, refetch: refetchMyTierChanges } = trpc.depositTiers.myChangeRequests.useQuery(undefined, { enabled: isAuthenticated });
  const hasPendingTierChange = (myTierChangeRequests ?? []).some((r: { status: string }) => r.status === "pending");

  const tierSwitchPreview = trpc.depositTiers.previewSwitch.useQuery(
    { toTierId: tierChangeTargetId ?? 0 },
    { enabled: tierChangeOpen && !!tierChangeTargetId, refetchOnWindowFocus: false }
  );

  const requestTierChangeMut = trpc.depositTiers.requestChange.useMutation({
    onSuccess: (r) => {
      toast.success(r.message);
      setTierChangeOpen(false);
      setTierChangeTargetId(null); setTierChangePaymentMethod(""); setTierChangeRef(""); setTierChangeNote(""); setTierChangeReceiptUrl("");
      refetchMyTierChanges();
    },
    onError: (e) => toast.error(e.message),
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

  const uploadTierChangeReceipt = trpc.subscriptions.uploadPaymentProof.useMutation({
    onSuccess: ({ url }) => { setTierChangeReceiptUrl(url); setTierChangeReceiptUploading(false); toast.success("收據已上傳"); },
    onError: (err) => { setTierChangeReceiptUploading(false); toast.error("上傳失敗：" + err.message); },
  });
  function handleTierChangeReceiptFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setTierChangeReceiptUploading(true);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = (ev.target?.result as string).split(",")[1];
      uploadTierChangeReceipt.mutate({ base64, filename: file.name });
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

  const { data: availablePlans } = trpc.subscriptions.getPlans.useQuery(undefined, {
    enabled: isAuthenticated && myApp?.status === "approved",
  });

  const { data: mySubHistory, refetch: refetchSubHistory } = trpc.subscriptions.myHistory.useQuery(undefined, {
    enabled: isAuthenticated && myApp?.status === "approved",
  });

  const renewMutation = trpc.subscriptions.renew.useMutation({
    onSuccess: () => {
      refetchSubHistory();
      utils.subscriptions.mySubscription.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const renewProofUploadMutation = trpc.subscriptions.uploadPaymentProof.useMutation({
    onSuccess: ({ url }) => { setRenewProofUrl(url); setRenewProofUploading(false); toast.success("收據已上傳"); },
    onError: (e) => { setRenewProofUploading(false); toast.error("上傳失敗：" + e.message); },
  });

  function handleRenewProofFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("檔案大小不能超過 5MB"); return; }
    setRenewProofUploading(true);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = (ev.target?.result as string).split(",")[1];
      renewProofUploadMutation.mutate({ base64, filename: file.name });
    };
    reader.readAsDataURL(file);
  }

  // 是否已有 pending 續期申請
  const hasPendingRenewal = (mySubHistory as Array<{ status: string; isRenewal?: number }> | undefined)
    ?.some(s => s.status === "pending" && s.isRenewal === 1) ?? false;

  // 是否已有任何 pending 申請（首次訂閱 or 續期）
  type _SubHistRow = { id: number; planName: string | null; billingCycle: string | null; status: string; isRenewal?: number | null; paymentMethod?: string | null; paymentReference?: string | null; createdAt?: Date | string | null };
  const hasPendingApplication = (mySubHistory as _SubHistRow[] | undefined)?.some(s => s.status === "pending") ?? false;
  const pendingSubRecord = (mySubHistory as _SubHistRow[] | undefined)?.find(s => s.status === "pending") ?? null;

  // Carry-over 模式下：續期批核後新 row 即時變成 active sub。
  // 偵測「現任 active sub 本身係一張最近批核嘅續期 row」→ 顯示綠色「續期已成功」確認。
  const RENEW_CONFIRM_DAYS = 7;
  const recentRenewal = (mySubHistory as Array<{ id: number; status: string; isRenewal?: number; createdAt: Date | string | null }> | undefined)
    ?.find(s =>
      s.status === "active" &&
      s.isRenewal === 1 &&
      mySubscription &&
      s.id === mySubscription.id &&
      s.createdAt &&
      (Date.now() - new Date(s.createdAt).getTime()) / 86400000 <= RENEW_CONFIRM_DAYS
    );

  // 距到期日嘅日數（用於決定是否顯示「續期」按鈕）
  const daysUntilExpiry = mySubscription?.endDate
    ? Math.ceil((new Date(mySubscription.endDate).getTime() - Date.now()) / 86400000)
    : null;
  const canRenew = mySubscription && daysUntilExpiry !== null && daysUntilExpiry <= 14;
  // 過期 banner：active sub 用 mySubscription；訂閱已過期時從 history 取最近 expired row
  type _BannerSub = { status: string; endDate: Date | string | null; planName: string | null; billingCycle: string | null; planId?: number | null };
  const recentExpiredSub = !mySubscription
    ? (mySubHistory as _BannerSub[] | undefined)?.find(s => s.status === 'expired') ?? null
    : null;
  const bannerSub: _BannerSub | null = (mySubscription as _BannerSub | null | undefined) ?? recentExpiredSub;
  const bannerDays = bannerSub?.endDate
    ? Math.ceil((new Date(bannerSub.endDate).getTime() - Date.now()) / 86400000)
    : null;
  const showExpiryWarning = !hasPendingApplication && !!bannerSub && bannerDays !== null && (bannerSub.status === 'expired' || bannerDays <= 7);

  const handleSubmitRenew = () => {
    if (!renewPaymentMethod) { toast.error("請選擇付款方式"); return; }
    renewMutation.mutate({
      paymentMethod: renewPaymentMethod,
      paymentReference: renewPaymentRef || undefined,
      paymentProofUrl: renewProofUrl || undefined,
    });
  };

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
        <div className="container max-w-lg mx-auto pt-6 pb-24 text-center space-y-3">
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
      <div className="container max-w-lg mx-auto pt-4 pb-28 space-y-4">

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
              <button
                onClick={() => setQrOpen(true)}
                aria-label="顯示商店 QR Code"
                className="flex items-center justify-center text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 w-6 h-6 rounded-full transition-colors ml-auto"
              >
                <QrCode className="w-3 h-3" />
              </button>
            </div>
            <p className="text-xs text-gray-400">分享此連結給客戶，讓他們直接進入你的商店瀏覽商品及拍賣。</p>
            <div className="flex items-center gap-2 bg-blue-50 rounded-xl px-3 py-2 border border-blue-100">
              <span className="text-xs text-blue-700 flex-1 truncate font-mono">
                hongxcollections.com/merchants/{myApp.userId}
              </span>
              <button
                onClick={() => {
                  const url = `https://share.hongxcollections.com/merchants/${myApp.userId}`;
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
          <div className={`rounded-2xl bg-white border overflow-hidden ${
            quotaInfo.unlimited ? "border-blue-100" :
            quotaInfo.remainingQuota <= 0 ? "border-red-300" :
            quotaInfo.remainingQuota <= 5 ? "border-amber-200" : "border-blue-100"
          }`}>
            <div className="p-4 flex items-center justify-between">
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
            {!quotaInfo.unlimited && quotaInfo.remainingQuota <= 0 && !hasPendingApplication && (
              <Link href="/subscriptions">
                <div className="animate-pulse bg-red-50 border-t border-red-200 px-4 py-2.5 flex items-center justify-center gap-1.5 cursor-pointer hover:bg-red-100 transition-colors">
                  <span className="text-xs font-semibold text-red-600">發佈次數已用盡 — 點此續訂月費</span>
                </div>
              </Link>
            )}
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
          <Link href="/merchant/sessions">
            <div className="rounded-2xl bg-white border border-purple-100 p-4 flex items-center gap-3 hover:border-purple-300 hover:bg-purple-50/50 transition-colors cursor-pointer">
              <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center flex-shrink-0">
                <Gavel className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="font-semibold text-sm text-purple-900">拍賣專場</p>
                <p className="text-xs text-gray-400 mt-0.5">建立小型拍賣會 · 公開 URL</p>
              </div>
            </div>
          </Link>
          <Link href="/merchant/group-auctions">
            <div className="rounded-2xl bg-white border border-orange-100 p-4 flex items-center gap-3 hover:border-orange-300 hover:bg-orange-50/50 transition-colors cursor-pointer">
              <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center flex-shrink-0">
                <Layers className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <p className="font-semibold text-sm text-orange-900">團購拍賣</p>
                <p className="text-xs text-gray-400 mt-0.5">CSV 批量開拍 · 實時出價</p>
              </div>
            </div>
          </Link>
          <Link href="/merchant/journal">
            <div className="rounded-2xl bg-white border border-amber-100 p-4 flex items-center gap-3 hover:border-amber-300 hover:bg-amber-50/50 transition-colors cursor-pointer">
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
                <BookOpen className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="font-semibold text-sm text-amber-900">商戶日誌</p>
                <p className="text-xs text-gray-400 mt-0.5">記事 · 交收 · 送評</p>
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
          <Link href="/merchant/galleries">
            <div className="rounded-2xl bg-white border border-sky-100 p-4 flex items-center gap-3 hover:border-sky-300 hover:bg-sky-50/50 transition-colors cursor-pointer">
              <div className="w-10 h-10 rounded-xl bg-sky-50 flex items-center justify-center flex-shrink-0">
                <Images className="w-5 h-5 text-sky-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-sky-900">圖片集商品</p>
                <p className="text-xs text-gray-400 mt-0.5">批量上圖 · 一圖一品</p>
              </div>
              {galleryCount > 0 && (
                <span className="text-xs font-bold text-sky-600 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-full flex-shrink-0">
                  {galleryCount} 個
                </span>
              )}
            </div>
          </Link>
          <button
            onClick={() => setShowOffersDialog(true)}
            className="text-left rounded-2xl bg-white border border-orange-100 p-4 flex items-center gap-3 hover:border-orange-300 hover:bg-orange-50/50 transition-colors cursor-pointer relative"
          >
            <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center flex-shrink-0">
              <Tag className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <p className="font-semibold text-sm text-gray-800">排價管理</p>
              <p className="text-xs text-gray-400 mt-0.5">買家議價 · 接受/拒絕</p>
            </div>
            {pendingOffersCount && pendingOffersCount > 0 ? (
              <span className="absolute top-2 right-2 min-w-[20px] h-5 px-1.5 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
                {pendingOffersCount}
              </span>
            ) : null}
          </button>
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

        {/* ── 最近批核嘅續期：顯示綠色「續期已成功」確認（carry-over 總限額 + 新到期日） ── */}
        {recentRenewal && mySubscription && (
          <div className="rounded-xl border bg-green-50 border-green-200 text-green-700 px-4 py-3 flex items-start gap-3 text-sm">
            <CheckCircle2 className="w-5 h-5 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold">續期已成功</p>
              <p className="text-xs mt-0.5">
                上期未用嘅限額已自動延續落本期。
                {quotaInfo && !quotaInfo.unlimited && (
                  <> 本期可用：<span className="font-semibold">{quotaInfo.remainingQuota} / {quotaInfo.maxListings} 次</span>。</>
                )}
                {quotaInfo?.unlimited && <> 計劃為無限制發佈。</>}
                {' '}新到期日：<span className="font-semibold">{fmtDate(mySubscription.endDate ?? null)}</span>
              </p>
            </div>
          </div>
        )}

        {/* ── 訂閱申請審核中 banner ── */}
        {hasPendingApplication && pendingSubRecord && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 flex items-start gap-3 text-sm">
            <Clock className="w-5 h-5 mt-0.5 flex-shrink-0 text-blue-500" />
            <div className="flex-1 min-w-0 space-y-1">
              <p className="font-semibold text-blue-800">
                {pendingSubRecord.isRenewal ? "續期申請審核中" : "訂閱申請審核中"}
              </p>
              <p className="text-xs text-blue-700">
                計劃：{pendingSubRecord.planName ?? "—"}｜{pendingSubRecord.billingCycle === "yearly" ? "年繳" : "月繳"}
              </p>
              {pendingSubRecord.paymentMethod && (
                <p className="text-xs text-blue-700">
                  付款方式：{pendingSubRecord.paymentMethod}
                  {pendingSubRecord.paymentReference ? `｜參考編號：${pendingSubRecord.paymentReference}` : ""}
                </p>
              )}
              {pendingSubRecord.createdAt && (
                <p className="text-xs text-blue-500">
                  提交時間：{new Date(pendingSubRecord.createdAt).toLocaleString("zh-HK", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                </p>
              )}
              <p className="text-xs text-blue-600 font-medium">管理員確認收款後即時生效，請耐心等候。</p>
            </div>
          </div>
        )}

        {/* ── 訂閱即將到期 / 已過期 banner ── */}
        {showExpiryWarning && (
          <div className={`rounded-xl border px-4 py-3 flex items-start gap-3 text-sm animate-pulse ${
            (bannerDays ?? 0) <= 0
              ? "bg-red-50 border-red-300 text-red-700"
              : (bannerDays ?? 0) <= 3
              ? "bg-red-50 border-red-200 text-red-700"
              : "bg-amber-50 border-amber-200 text-amber-700"
          }`}>
            <Clock className="w-5 h-5 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold">
                {(bannerDays ?? 0) <= 0 ? "訂閱已過期！請盡快續期" : `訂閱即將到期：仲有 ${bannerDays} 日`}
              </p>
              <p className="text-xs mt-0.5">
                計劃：{bannerSub?.planName ?? "—"} ({bannerSub?.billingCycle === "yearly" ? "年繳" : "月繳"}) | 到期：{fmtDate((bannerSub?.endDate as Date | null | undefined) ?? null)}
              </p>
              {hasPendingRenewal && (
                <p className="text-xs mt-1 inline-flex items-center gap-1 text-blue-600">
                  <Clock className="w-3 h-3" /> 續期申請已提交，待管理員確認收款
                </p>
              )}
            </div>
            <Button
              size="sm"
              disabled={hasPendingRenewal || renewMutation.isSuccess || renewMutation.isPending}
              onClick={() => setRenewDialogOpen(true)}
              className="bg-amber-600 hover:bg-amber-700 text-white border-0 flex-shrink-0"
            >
              {(hasPendingRenewal || renewMutation.isSuccess) ? "續期審核中" : "一鍵續期"}
            </Button>
          </div>
        )}

        {/* ── 保證金警告提示 ── */}
        {!depositOk && deposit && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 flex items-start gap-2 text-sm text-red-600">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>
              保證金餘額（{HKD(balance)}）已低於<strong>維持水平</strong>（{HKD(required)}），
              發佈商品 / 拍賣將會受限。{depositWarningMessage}
            </span>
          </div>
        )}
        {belowWarning && deposit && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 flex items-start gap-2 text-sm text-amber-700">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>
              保證金餘額（{HKD(balance)}）已低於<strong>預警門檻</strong>（{HKD(warningThreshold)}），
              建議盡快補交以免跌穿維持水平（{HKD(required)}）。
            </span>
          </div>
        )}

        {/* ── 現有保證金套餐資料 ── */}
        {deposit && (() => {
          const currentTier = deposit.currentTierId
            ? (activeTiers as { id: number; name: string; amount: string; maintenancePct: string; warningPct: string; commissionRate?: string | null; productCommissionRate?: string | null }[] | undefined)?.find(t => t.id === deposit.currentTierId)
            : null;
          const balance = deposit.balance ?? 0;
          const required = deposit.requiredDeposit ?? 0;
          const warning = deposit.warningDeposit ?? 0;
          const tierAmt = currentTier ? parseFloat(currentTier.amount) : required;
          const auctionPct = (deposit.commissionRate ?? 0) * 100;
          const productPct = (deposit.productCommissionRate ?? deposit.commissionRate ?? 0) * 100;
          const isLow = required > 0 && balance < required;
          const isWarn = !isLow && warning > 0 && balance < warning;
          const ringTone = isLow ? "border-red-300 bg-gradient-to-br from-red-50 to-white" : isWarn ? "border-amber-300 bg-gradient-to-br from-amber-50 to-white" : "border-emerald-200 bg-gradient-to-br from-emerald-50 to-white";
          const balanceTone = isLow ? "text-red-700" : isWarn ? "text-amber-700" : "text-emerald-700";
          const pctOfTier = tierAmt > 0 ? Math.min(100, Math.max(0, (balance / tierAmt) * 100)) : 0;
          return (
            <Card className={`rounded-2xl border-2 ${ringTone}`}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Wallet className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <h2 className="font-semibold text-gray-900 text-sm">現有保證金套餐</h2>
                    {currentTier ? (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-600 text-white">{currentTier.name}</span>
                    ) : (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-200 text-gray-600">未指定套餐</span>
                    )}
                  </div>
                  {currentTier && <span className="text-xs text-gray-500">套餐金額 <strong className="text-gray-800">HK${tierAmt.toLocaleString()}</strong></span>}
                </div>

                {/* ── 餘額進度條 ── */}
                <div className="space-y-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs text-gray-500">目前餘額</span>
                    <span className={`text-2xl font-bold ${balanceTone}`}>HK${balance.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                  </div>
                  {tierAmt > 0 && (
                    <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
                      <div
                        className={`h-full transition-all ${isLow ? "bg-red-500" : isWarn ? "bg-amber-500" : "bg-emerald-500"}`}
                        style={{ width: `${pctOfTier}%` }}
                      />
                    </div>
                  )}
                </div>

                {/* ── 維持／預警／傭金 ── */}
                <div className="grid grid-cols-2 gap-2">
                  {required > 0 && (
                    <div className="rounded-lg bg-white border border-emerald-100 px-2.5 py-1.5">
                      <div className="text-[10px] text-gray-500">維持水平</div>
                      <div className="text-xs font-semibold text-emerald-700">≥ HK${required.toLocaleString()}</div>
                    </div>
                  )}
                  {warning > 0 && (
                    <div className="rounded-lg bg-white border border-amber-100 px-2.5 py-1.5">
                      <div className="text-[10px] text-gray-500">預警水平</div>
                      <div className="text-xs font-semibold text-amber-700">≤ HK${warning.toLocaleString()}</div>
                    </div>
                  )}
                  <div className="rounded-lg bg-white border border-blue-100 px-2.5 py-1.5">
                    <div className="text-[10px] text-gray-500">拍賣傭金</div>
                    <div className="text-xs font-semibold text-blue-700">{auctionPct.toFixed(2)}%</div>
                  </div>
                  <div className="rounded-lg bg-white border border-purple-100 px-2.5 py-1.5">
                    <div className="text-[10px] text-gray-500">商品傭金</div>
                    <div className="text-xs font-semibold text-purple-700">{productPct.toFixed(2)}%</div>
                  </div>
                </div>

                {isLow && (
                  <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5">
                    ⚠️ 餘額已低於維持水平，發佈商品將會受限。請盡快充值。
                  </div>
                )}
                {isWarn && (
                  <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                    ⚠️ 餘額已低於預警水平，建議盡快充值以免影響上架。
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })()}

        {/* ── 保證金充值申請 (moved above transactions) ── */}
        <Card className="rounded-2xl border-amber-100">
          <CardContent className="p-4 space-y-3">
            {/* ── Header row ── */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PlusCircle className="w-4 h-4 text-amber-600" />
                <h2 className="font-semibold text-amber-900 text-sm">保證金充值申請</h2>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={hasPendingTierChange || !(activeTiers && (activeTiers as unknown[]).length > 1)}
                  onClick={() => { setTierChangeOpen(true); setTierChangeTargetId(null); }}
                  className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full transition-colors bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  title={hasPendingTierChange ? "已有待審核轉套餐申請" : "轉到其他保證金套餐"}
                >
                  🔄 {hasPendingTierChange ? "轉套餐審核中" : "轉套餐"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowTopUpForm(v => !v)}
                  className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full transition-colors bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200"
                >
                  <ChevronDown size={11} style={{ transform: showTopUpForm ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }} />
                  {showTopUpForm ? "收起" : "提交申請"}
                </button>
              </div>
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
                      {(activeTiers as { id: number; name: string; amount: string; maintenancePct: string; warningPct: string; commissionRate?: string | null; productCommissionRate?: string | null; description: string | null }[]).map(tier => {
                        const amt = parseFloat(tier.amount);
                        const mPct = parseFloat(tier.maintenancePct);
                        const wPct = parseFloat(tier.warningPct);
                        const auctionPct = tier.commissionRate ? parseFloat(tier.commissionRate) * 100 : null;
                        const productPct = tier.productCommissionRate ? parseFloat(tier.productCommissionRate) * 100 : null;
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
                                </div>
                                <div className="flex items-center gap-1.5 flex-wrap mt-1">
                                  {auctionPct !== null && (
                                    <span className="text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-full px-2 py-0.5">拍賣傭金 {auctionPct.toFixed(2)}%</span>
                                  )}
                                  {productPct !== null && (
                                    <span className="text-xs font-semibold text-purple-700 bg-purple-50 border border-purple-200 rounded-full px-2 py-0.5">商品傭金 {productPct.toFixed(2)}%</span>
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
              <div className="flex items-center gap-1.5">
                {showTxList && transactions.length > 0 && (
                  <button
                    onClick={() => printTxReport(transactions, txFromDate, txToDate, myApp?.merchantName ?? "商戶")}
                    className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-800 border border-amber-200 rounded-lg px-2.5 py-1 transition-colors"
                  >
                    <Printer className="w-3 h-3" />列印 / PDF
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowTxList(v => !v)}
                  className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full transition-colors bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200"
                >
                  <ChevronDown size={11} style={{ transform: showTxList ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }} />
                  {showTxList ? "收起" : "展開"}
                </button>
              </div>
            </div>

            {showTxList && (<>

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
              const totalIn  = transactions.filter(t => t.type === 'top_up').reduce((s, t) => s + parseFloat(String(t.amount)), 0);
              const totalOut = transactions.filter(t => t.type === 'commission').reduce((s, t) => s + parseFloat(String(t.amount)), 0);
              const net = transactions.reduce((s, t) => s + parseFloat(String(t.amount)), 0);
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
                        <TxRow key={start + i} tx={tx} showBalance onGroupCommission={(roundId, roundTitle) => setGroupCommTarget({ roundId, roundTitle })} />
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

            </>)}

          </CardContent>
        </Card>

      </div>
      <MerchantOffersDialog open={showOffersDialog} onOpenChange={setShowOffersDialog} />

      {/* ── 續期一鍵延長 dialog ── */}
      <Dialog open={renewDialogOpen} onOpenChange={(open) => {
        setRenewDialogOpen(open);
        if (!open) {
          renewMutation.reset();
          setRenewPaymentMethod(""); setRenewPaymentRef(""); setRenewProofUrl("");
        }
      }}>
        <DialogContent className="max-w-md">
          {renewMutation.isSuccess ? (
            /* ── 提交成功確認頁 ── */
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-green-700">
                  <CheckCircle2 className="w-5 h-5 flex-shrink-0" /> 續期申請已提交
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <div className="rounded-lg bg-green-50 border border-green-200 p-3 space-y-1.5">
                  <div className="flex justify-between"><span className="text-gray-500">計劃</span><span className="font-medium">{bannerSub?.planName ?? "—"}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">週期</span><span className="font-medium">{bannerSub?.billingCycle === "yearly" ? "年繳" : "月繳"}</span></div>
                  {(() => {
                    const plan = (availablePlans as Array<{ id: number; maxListings: number }> | undefined)?.find(
                      p => p.id === (bannerSub?.planId ?? mySubscription?.planId)
                    );
                    if (!plan) return null;
                    return (
                      <div className="flex justify-between">
                        <span className="text-gray-500">每期發佈限制</span>
                        <span className="font-medium">{plan.maxListings === 0 ? "無限制" : `${plan.maxListings} 次`}</span>
                      </div>
                    );
                  })()}
                  {renewPaymentMethod && (
                    <div className="flex justify-between"><span className="text-gray-500">付款方式</span><span className="font-medium">{DEPOSIT_PAYMENT_METHODS.find(m => m.value === renewPaymentMethod)?.label ?? renewPaymentMethod}</span></div>
                  )}
                  {renewPaymentRef && (
                    <div className="flex justify-between"><span className="text-gray-500">付款參考</span><span className="font-medium">{renewPaymentRef}</span></div>
                  )}
                  {renewProofUrl && (
                    <div className="flex justify-between"><span className="text-gray-500">付款憑證</span><span className="font-medium text-green-600">已上傳</span></div>
                  )}
                </div>
                <p className="text-xs text-gray-500">管理員確認收款後將自動延長訂閱，請耐心等候通知。</p>
              </div>
              <DialogFooter>
                <Button className="w-full bg-green-600 hover:bg-green-700" onClick={() => {
                  setRenewDialogOpen(false);
                  renewMutation.reset();
                  setRenewPaymentMethod(""); setRenewPaymentRef(""); setRenewProofUrl("");
                }}>
                  明白，關閉
                </Button>
              </DialogFooter>
            </>
          ) : (
            /* ── 填寫付款資料 ── */
            <>
              <DialogHeader>
                <DialogTitle>提交續期申請</DialogTitle>
                <p className="text-xs text-muted-foreground pt-1">確認以下訂閱資料，填寫付款後提交，管理員批核後即時生效。</p>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <div className="rounded-lg bg-purple-50 border border-purple-100 p-3 space-y-1">
                  <div className="flex justify-between"><span className="text-gray-500">計劃</span><span className="font-medium">{bannerSub?.planName ?? "—"}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">週期</span><span className="font-medium">{bannerSub?.billingCycle === "yearly" ? "年繳" : "月繳"}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">上次到期</span><span className="font-medium">{fmtDate((bannerSub?.endDate as Date | null | undefined) ?? null)}</span></div>
                  {(() => {
                    const plan = (availablePlans as Array<{ id: number; monthlyPrice: string | number; yearlyPrice: string | number; maxListings: number }> | undefined)?.find(
                      p => p.id === (bannerSub?.planId ?? mySubscription?.planId)
                    );
                    if (!plan) return null;
                    const isYearly = bannerSub?.billingCycle === "yearly";
                    const price = Number(isYearly ? plan.yearlyPrice : plan.monthlyPrice);
                    return (
                      <>
                        <div className="flex justify-between">
                          <span className="text-gray-500">每期發佈限制</span>
                          <span className="font-medium">{plan.maxListings === 0 ? "無限制" : `${plan.maxListings} 次`}</span>
                        </div>
                        <div className="flex justify-between items-baseline pt-1.5 mt-1.5 border-t border-purple-200">
                          <span className="text-gray-500">應付金額</span>
                          <span className="font-bold text-base text-purple-700">
                            HKD${price.toLocaleString()}
                            <span className="text-[10px] text-gray-500 font-normal ml-1">/{isYearly ? "年" : "月"}</span>
                          </span>
                        </div>
                      </>
                    );
                  })()}
                </div>
                <p className="text-xs text-amber-600">⚠️ 管理員批核後，新訂閱將從現有到期日接續延長，限額會在現有結餘耗盡後自動啟用。</p>

                <div>
                  <Label className="text-xs">付款方式 <span className="text-red-500">*</span></Label>
                  <Select value={renewPaymentMethod} onValueChange={setRenewPaymentMethod}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="揀付款方式" /></SelectTrigger>
                    <SelectContent>
                      {DEPOSIT_PAYMENT_METHODS.map(m => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs">付款參考編號（選填）</Label>
                  <Input value={renewPaymentRef} onChange={e => setRenewPaymentRef(e.target.value)} placeholder="e.g. FPS / PayMe ref" className="h-9 text-sm" />
                </div>

                <div>
                  <Label className="text-xs">付款憑證（選填，最多 5MB）</Label>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={handleRenewProofFile}
                    className="block w-full text-xs file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
                    disabled={renewProofUploading}
                  />
                  {renewProofUploading && <p className="text-xs text-blue-500 mt-1">上傳中...</p>}
                  {renewProofUrl && !renewProofUploading && (
                    <p className="text-xs text-green-600 mt-1 inline-flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> 已上傳</p>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setRenewDialogOpen(false)} disabled={renewMutation.isPending}>取消</Button>
                <Button onClick={handleSubmitRenew} disabled={renewMutation.isPending || renewProofUploading} className="bg-amber-600 hover:bg-amber-700">
                  {renewMutation.isPending ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> 提交中</> : "提交續期申請"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── 轉保證金套餐 dialog ── */}
      <Dialog open={tierChangeOpen} onOpenChange={(o) => { setTierChangeOpen(o); if (!o) setTierChangeTargetId(null); }}>
        <DialogContent className="max-w-[calc(100%-10px)] sm:max-w-md max-h-[90vh] overflow-y-auto px-[6px]">
          <DialogHeader className="px-[20px]">
            <DialogTitle>轉保證金套餐</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm px-[20px]">
            <p className="text-xs text-gray-500">揀新套餐。如目前餘額已夠新套餐金額，會即時切換；否則須上載差價收據，等管理員批核。</p>

            {/* ── 套餐列表 ── */}
            <div className="space-y-2">
              {(activeTiers as { id: number; name: string; amount: string; maintenancePct: string; warningPct: string; commissionRate?: string | null; productCommissionRate?: string | null; description: string | null }[] | undefined)?.filter(t => t.id !== deposit?.currentTierId).map(tier => {
                const amt = parseFloat(tier.amount);
                const auctionPct = tier.commissionRate ? parseFloat(tier.commissionRate) * 100 : null;
                const productPct = tier.productCommissionRate ? parseFloat(tier.productCommissionRate) * 100 : null;
                const isSelected = tierChangeTargetId === tier.id;
                return (
                  <button
                    key={tier.id}
                    type="button"
                    onClick={() => setTierChangeTargetId(tier.id)}
                    className={`w-full text-left rounded-xl border px-3 py-2.5 transition-all ${isSelected ? "border-purple-500 bg-purple-50 ring-1 ring-purple-400" : "border-gray-200 bg-white hover:border-purple-300"}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-gray-900">{tier.name}</span>
                          <span className="text-sm font-bold text-purple-700">HK${amt.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap mt-1">
                          {auctionPct !== null && (
                            <span className="text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-full px-2 py-0.5">拍賣傭金 {auctionPct.toFixed(2)}%</span>
                          )}
                          {productPct !== null && (
                            <span className="text-xs font-semibold text-purple-700 bg-purple-50 border border-purple-200 rounded-full px-2 py-0.5">商品傭金 {productPct.toFixed(2)}%</span>
                          )}
                        </div>
                        {tier.description && <p className="text-xs text-gray-400 mt-0.5">{tier.description}</p>}
                      </div>
                      {isSelected && <div className="w-4 h-4 rounded-full bg-purple-500 flex-shrink-0 flex items-center justify-center"><div className="w-2 h-2 rounded-full bg-white" /></div>}
                    </div>
                  </button>
                );
              })}
              {(!activeTiers || (activeTiers as unknown[]).filter((t) => (t as { id: number }).id !== deposit?.currentTierId).length === 0) && (
                <p className="text-xs text-gray-400 text-center py-4">沒有可轉換嘅套餐</p>
              )}
            </div>

            {/* ── 差價預覽 ── */}
            {tierChangeTargetId && tierSwitchPreview.data?.ok && (
              <div className={`rounded-lg border px-3 py-2.5 space-y-1.5 ${tierSwitchPreview.data.diffAmount > 0 ? "bg-amber-50 border-amber-200" : "bg-green-50 border-green-200"}`}>
                <div className="flex justify-between text-xs"><span className="text-gray-600">目前餘額</span><span className="font-medium">HK${tierSwitchPreview.data.currentBalance.toLocaleString()}</span></div>
                <div className="flex justify-between text-xs"><span className="text-gray-600">新套餐金額</span><span className="font-medium">HK${tierSwitchPreview.data.toTier?.amount.toLocaleString()}</span></div>
                <div className="border-t border-gray-200 pt-1.5 flex justify-between text-sm">
                  <span className="font-semibold">須補差價</span>
                  <span className={`font-bold ${tierSwitchPreview.data.diffAmount > 0 ? "text-amber-700" : "text-green-700"}`}>
                    {tierSwitchPreview.data.diffAmount > 0 ? `HK$${tierSwitchPreview.data.diffAmount.toLocaleString()}` : "毋須補差（即時生效）"}
                  </span>
                </div>
                {tierSwitchPreview.data.diffAmount <= 0 && (
                  <p className="text-[11px] text-green-700">✅ 餘額已足夠 — 提交後即刻切換套餐，傭金率即時更新。保證金餘額不變。</p>
                )}
              </div>
            )}

            {/* ── 須補差價：付款資料 ── */}
            {tierChangeTargetId && tierSwitchPreview.data?.ok && tierSwitchPreview.data.diffAmount > 0 && (
              <>
                {depositPaymentInfo && (
                  <div className="p-2.5 rounded-lg bg-blue-50 border border-blue-200">
                    <p className="text-[11px] font-semibold text-blue-800 mb-1">付款資訊</p>
                    <div className="text-[11px] text-blue-700 whitespace-pre-line leading-relaxed">{depositPaymentInfo}</div>
                  </div>
                )}
                <div>
                  <Label className="text-xs">付款方式 <span className="text-red-500">*</span></Label>
                  <Select value={tierChangePaymentMethod} onValueChange={setTierChangePaymentMethod}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="揀付款方式" /></SelectTrigger>
                    <SelectContent>
                      {DEPOSIT_PAYMENT_METHODS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">付款參考號 <span className="text-red-500">*</span></Label>
                  <Input value={tierChangeRef} onChange={e => setTierChangeRef(e.target.value)} placeholder="e.g. FPS / PayMe ref" className="h-9 text-sm" />
                </div>
                <div>
                  <Label className="text-xs">付款收據 <span className="text-red-500">*</span></Label>
                  {tierChangeReceiptUrl ? (
                    <div className="relative rounded-lg overflow-hidden border border-purple-200">
                      <img src={tierChangeReceiptUrl} alt="收據" className="w-full max-h-32 object-contain bg-gray-50" />
                      <button type="button" onClick={() => setTierChangeReceiptUrl("")} className="absolute top-1 right-1 bg-white rounded-full p-0.5 shadow border border-gray-200 hover:bg-red-50">
                        <X className="w-3.5 h-3.5 text-gray-500" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center gap-1.5 border-2 border-dashed border-purple-200 rounded-lg p-3 cursor-pointer hover:bg-purple-50 transition-colors bg-white">
                      {tierChangeReceiptUploading ? <Loader2 className="w-4 h-4 animate-spin text-purple-500" /> : <><Upload className="w-4 h-4 text-purple-400" /><span className="text-xs text-purple-700">點擊上傳收據</span></>}
                      <input type="file" accept="image/*" className="hidden" onChange={handleTierChangeReceiptFile} disabled={tierChangeReceiptUploading} />
                    </label>
                  )}
                </div>
                <div>
                  <Label className="text-xs">備注（選填）</Label>
                  <Textarea value={tierChangeNote} onChange={e => setTierChangeNote(e.target.value)} placeholder="補充說明" rows={2} className="text-sm resize-none" />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTierChangeOpen(false)} disabled={requestTierChangeMut.isPending}>取消</Button>
            <Button
              onClick={() => {
                if (!tierChangeTargetId) return toast.error("請揀新套餐");
                const needPay = (tierSwitchPreview.data?.diffAmount ?? 0) > 0;
                if (needPay) {
                  if (!tierChangePaymentMethod) return toast.error("請揀付款方式");
                  if (!tierChangeRef.trim()) return toast.error("請填寫付款參考號");
                  if (!tierChangeReceiptUrl) return toast.error("請上載付款收據");
                }
                requestTierChangeMut.mutate({
                  toTierId: tierChangeTargetId,
                  paymentMethod: needPay ? tierChangePaymentMethod : undefined,
                  paymentReference: needPay ? tierChangeRef.trim() : undefined,
                  receiptUrl: needPay ? tierChangeReceiptUrl : undefined,
                  note: tierChangeNote.trim() || undefined,
                });
              }}
              disabled={requestTierChangeMut.isPending || !tierChangeTargetId || tierChangeReceiptUploading}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {requestTierChangeMut.isPending
                ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> 提交中</>
                : ((tierSwitchPreview.data?.diffAmount ?? 0) > 0 ? "提交差價申請" : "即時切換")
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 商店 QR Code Dialog — 同 MerchantStore 完全一致 */}
      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-center text-sm">{myApp?.merchantName ? `「${sanitizeUserText(myApp.merchantName)}」商店 QR Code` : "商店 QR Code"}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-3 py-2">
            <div id="dash-qr-svg-wrap" className="bg-white p-3 rounded-lg border border-gray-200">
              <QRCodeSVG value={`https://hongxcollections.com/merchants/${myApp?.userId}`} size={200} level="M" fgColor="#92400e" />
            </div>
            <p className="text-[11px] text-gray-500 text-center break-all px-2">https://hongxcollections.com/merchants/{myApp?.userId}</p>
            <p className="text-xs text-gray-600 text-center">用手機掃 QR Code 即可開店</p>
            <button
              type="button"
              onClick={() => {
                const wrap = document.getElementById("dash-qr-svg-wrap");
                const svg = wrap?.querySelector("svg");
                if (!svg) return;
                const xml = new XMLSerializer().serializeToString(svg);
                const svg64 = btoa(unescape(encodeURIComponent(xml)));
                const dataUrl = `data:image/svg+xml;base64,${svg64}`;
                const img = new Image();
                img.onload = () => {
                  const scale = 3;
                  const size = 200 * scale;
                  const pad = 24 * scale;
                  const nameH = 22 * scale;
                  const poweredH = 8 * scale;
                  const gapAfterQR = 8 * scale;
                  const gapBetween = 3 * scale;
                  const canvas = document.createElement("canvas");
                  canvas.width = size + pad * 2;
                  canvas.height = pad + size + gapAfterQR + nameH + gapBetween + poweredH + pad;
                  const ctx = canvas.getContext("2d");
                  if (!ctx) return;
                  ctx.fillStyle = "#ffffff";
                  ctx.fillRect(0, 0, canvas.width, canvas.height);
                  ctx.drawImage(img, pad, pad, size, size);
                  const merchantName = myApp?.merchantName ? sanitizeUserText(myApp.merchantName) : "商戶";
                  const rightX = pad + size;
                  const nameY = pad + size + gapAfterQR + nameH / 2;
                  const poweredY = pad + size + gapAfterQR + nameH + gapBetween + poweredH / 2;
                  const makeGoldGradient = (y: number) => {
                    const g = ctx.createLinearGradient(0, y - 8 * scale, 0, y + 8 * scale);
                    g.addColorStop(0, "#f59e0b");
                    g.addColorStop(0.5, "#d97706");
                    g.addColorStop(1, "#92400e");
                    return g;
                  };
                  ctx.textAlign = "right";
                  ctx.textBaseline = "middle";
                  ctx.font = `bold ${18 * scale}px -apple-system, BlinkMacSystemFont, "PingFang TC", "Microsoft JhengHei", sans-serif`;
                  ctx.fillStyle = makeGoldGradient(nameY);
                  ctx.fillText(merchantName, rightX, nameY);
                  ctx.font = `${3 * scale}px -apple-system, BlinkMacSystemFont, sans-serif`;
                  ctx.fillStyle = makeGoldGradient(poweredY);
                  ctx.fillText("Powered by hongxcollections.com", rightX, poweredY);
                  canvas.toBlob((blob) => {
                    if (!blob) return;
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `merchant-${myApp?.userId}-qr.png`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    setTimeout(() => URL.revokeObjectURL(url), 1000);
                  }, "image/png");
                };
                img.src = dataUrl;
              }}
              className="w-full flex items-center justify-center gap-2 py-2 bg-gradient-to-br from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-lg text-sm font-semibold transition-all shadow-sm shadow-amber-200"
            >
              下載 QR 圖片
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 平台傭金明細 modal（場次存在） */}
      {groupCommTarget && groupCommTarget.roundTitle !== null && (
        <GroupAuctionCommissionModal
          open
          onClose={() => setGroupCommTarget(null)}
          roundId={groupCommTarget.roundId}
          roundTitle={groupCommTarget.roundTitle}
          type="platform"
        />
      )}

      {/* 場次已拆除 dialog */}
      <AlertDialog
        open={!!groupCommTarget && groupCommTarget.roundTitle === null}
        onOpenChange={(open) => { if (!open) setGroupCommTarget(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>場次資料已不存在</AlertDialogTitle>
            <AlertDialogDescription>
              此團購拍賣場次已被商戶拆除，場次明細已無法查看。平台傭金紀錄仍保留在此保證金交易紀錄中。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setGroupCommTarget(null)}>明白</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
