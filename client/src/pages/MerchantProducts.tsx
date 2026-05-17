import { useState, useRef, useCallback } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  ChevronLeft, Plus, Package, Pencil, Trash2, Eye, EyeOff,
  ImageIcon, X, Loader2, LayoutList, LayoutGrid, Grid3X3, Maximize2,
  ShoppingBag, CheckCircle2, XCircle, Clock, Flame, RotateCcw, Tag,
  Facebook, Copy, Check, CreditCard, Sparkles, Mic, Share2,
} from "lucide-react";
import { parseCategories } from "@/lib/categories";

type LayoutMode = "list" | "grid2" | "grid3" | "big";
const STATUS_LABELS: Record<string, string> = { active: "上架中", sold: "已售出", hidden: "已下架" };
const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  sold: "bg-gray-100 text-gray-500",
  hidden: "bg-yellow-100 text-yellow-700",
};

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const compressImage = (file: File, maxPx = 1280, quality = 0.78): Promise<File> =>
  new Promise((resolve) => {
    if (!file.type.startsWith('image/')) { resolve(file); return; }
    const img = new Image();
    const objUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objUrl);
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height, 1));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(file); return; }
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob((blob) => {
        if (!blob) { resolve(file); return; }
        resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }));
      }, 'image/jpeg', quality);
    };
    img.onerror = () => resolve(file);
    img.src = objUrl;
  });

interface ProductForm {
  title: string;
  description: string;
  price: string;
  currency: string;
  categories: string[];
  stock: string;
  images: string[];
  videoUrl: string;
  allowOffers: boolean;
}

const EMPTY_FORM: ProductForm = {
  title: "", description: "", price: "", currency: "HKD", categories: [], stock: "1", images: [], videoUrl: "", allowOffers: true,
};

const MAX_VIDEO_SIZE = 30 * 1024 * 1024;
const VIDEO_MIME_ALLOW = ['video/mp4', 'video/webm', 'video/quicktime'];

async function generateCollage(previewUrls: string[]): Promise<Blob | null> {
  const n = Math.min(previewUrls.length, 6);
  if (n < 2) return null;
  const S = 1080, GAP = 6;
  const canvas = document.createElement('canvas');
  canvas.width = S; canvas.height = S;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, S, S);

  const loadImg = (url: string): Promise<HTMLImageElement> =>
    new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = () => rej(new Error(`load: ${url}`));
      img.src = url;
    });

  const cover = (img: HTMLImageElement, x: number, y: number, w: number, h: number) => {
    const scale = Math.max(w / img.width, h / img.height);
    const sw = w / scale, sh = h / scale;
    const sx = (img.width - sw) / 2, sy = (img.height - sh) / 2;
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
    ctx.restore();
  };

  const imgs = await Promise.all(previewUrls.slice(0, n).map(loadImg));

  if (n === 2) {
    const w = Math.floor((S - GAP) / 2);
    cover(imgs[0], 0, 0, w, S);
    cover(imgs[1], w + GAP, 0, S - w - GAP, S);
  } else if (n === 3) {
    const lw = Math.round(S * 0.55), rw = S - lw - GAP;
    const rh = Math.floor((S - GAP) / 2);
    cover(imgs[0], 0, 0, lw, S);
    cover(imgs[1], lw + GAP, 0, rw, rh);
    cover(imgs[2], lw + GAP, rh + GAP, rw, S - rh - GAP);
  } else if (n === 4) {
    const half = Math.floor((S - GAP) / 2);
    cover(imgs[0], 0, 0, half, half);
    cover(imgs[1], half + GAP, 0, S - half - GAP, half);
    cover(imgs[2], 0, half + GAP, half, S - half - GAP);
    cover(imgs[3], half + GAP, half + GAP, S - half - GAP, S - half - GAP);
  } else {
    const topH = Math.round(S * 0.5), botH = S - topH - GAP;
    const tw = Math.floor((S - GAP) / 2);
    cover(imgs[0], 0, 0, tw, topH);
    cover(imgs[1], tw + GAP, 0, S - tw - GAP, topH);
    const botN = Math.min(n - 2, 3);
    const bw = Math.floor((S - GAP * (botN - 1)) / botN);
    for (let i = 0; i < botN; i++) {
      const bx = i * (bw + GAP);
      cover(imgs[i + 2], bx, topH + GAP, i === botN - 1 ? S - bx : bw, botH);
    }
    if (previewUrls.length > 6) {
      const lastX = (botN - 1) * (bw + GAP);
      ctx.fillStyle = 'rgba(0,0,0,0.48)';
      ctx.fillRect(lastX, topH + GAP, S - lastX, botH);
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${Math.round(botH * 0.38)}px sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(`+${previewUrls.length - 5}`, lastX + (S - lastX) / 2, topH + GAP + botH / 2);
    }
  }

  return new Promise<Blob>((res, rej) =>
    canvas.toBlob(b => b ? res(b) : rej(new Error('toBlob failed')), 'image/jpeg', 0.92)
  );
}

const CURRENCY_OPTIONS = [
  { value: "HKD", label: "🇭🇰 港幣 HKD" },
  { value: "USD", label: "🇺🇸 美元 USD" },
  { value: "CNY", label: "🇨🇳 人民幣 CNY" },
  { value: "GBP", label: "🇬🇧 英鎊 GBP" },
  { value: "EUR", label: "🇪🇺 歐元 EUR" },
  { value: "JPY", label: "🇯🇵 日圓 JPY" },
];

const ORDER_STATUS_LABELS: Record<string, string> = { pending: "待確認", confirmed: "已成交", cancelled: "已取消" };
const ORDER_STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  confirmed: "bg-green-100 text-green-700",
  cancelled: "bg-gray-100 text-gray-500",
};

function OrderActionDialog({ order, type, onClose, onConfirm, isPending }: {
  order: any; type: "confirm" | "cancel"; onClose: () => void; onConfirm: (finalPrice?: number, markAsFailure?: boolean) => void; isPending: boolean;
}) {
  const listedPrice = parseFloat(String(order.price));
  const qty = parseInt(String(order.quantity));
  const commissionRate = parseFloat(String(order.commissionRate));
  const imgs: string[] = (() => { try { return order.productImages ? JSON.parse(order.productImages) : []; } catch { return []; } })();
  const isConfirm = type === "confirm";

  const [finalPriceInput, setFinalPriceInput] = useState("");
  const [markAsFailure, setMarkAsFailure] = useState(false);
  const { data: failureStats } = trpc.merchants.getBuyerFailureStats.useQuery(
    { buyerId: Number(order.buyerId) },
    { enabled: !isConfirm && !!order.buyerId, staleTime: 10_000 }
  );
  const finalPrice = finalPriceInput !== "" ? parseFloat(finalPriceInput) : null;
  const actualUnitPrice = (finalPrice != null && finalPrice > 0) ? finalPrice : listedPrice;
  const commissionAmount = actualUnitPrice * qty * commissionRate;
  const priceChanged = finalPrice != null && finalPrice > 0 && finalPrice !== listedPrice;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 pb-20" onClick={onClose}>
      <div className="bg-white rounded-2xl p-5 w-full max-w-sm space-y-4" onClick={e => e.stopPropagation()}>
        <h2 className="font-bold text-gray-800 text-base flex items-center gap-2">
          {isConfirm
            ? <><CheckCircle2 className="w-5 h-5 text-green-500" />確認成交</>
            : <><XCircle className="w-5 h-5 text-red-400" />取消訂單</>}
        </h2>

        <div className="flex gap-3 bg-gray-50 rounded-xl p-3">
          {imgs[0]
            ? <img src={imgs[0]} alt={order.title} className="w-14 h-14 rounded-lg object-cover shrink-0 border border-gray-100" />
            : <div className="w-14 h-14 rounded-lg bg-amber-50 flex items-center justify-center shrink-0"><ShoppingBag className="w-6 h-6 text-amber-200" /></div>}
          <div className="flex-1 min-w-0 space-y-0.5">
            <p className="font-semibold text-sm text-gray-800 line-clamp-2">{order.title}</p>
            <p className="text-amber-600 font-bold text-sm">{order.currency} ${listedPrice.toLocaleString()} × {qty}</p>
            <p className="text-xs text-gray-500">買家：{order.buyerDisplayName ?? "—"}　{order.buyerPhoneFromUser ?? order.buyerPhone ?? ""}</p>
          </div>
        </div>

        {isConfirm && (
          <div className="space-y-2">
            <div>
              <label className="text-xs text-gray-500 font-medium mb-1 block">實際成交單價（選填，若與原價不同請填寫）</label>
              <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2 focus-within:border-amber-400 transition-colors">
                <span className="text-xs text-gray-400 shrink-0">{order.currency}</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder={listedPrice.toString()}
                  value={finalPriceInput}
                  onChange={e => setFinalPriceInput(e.target.value)}
                  className="flex-1 text-sm font-medium text-gray-800 outline-none bg-transparent"
                />
              </div>
              {priceChanged && (
                <p className="text-xs text-amber-600 mt-1">
                  原價 ${listedPrice.toLocaleString()} → 成交 ${actualUnitPrice.toLocaleString()}
                </p>
              )}
            </div>
            <div className="bg-red-50 rounded-xl px-3 py-2 text-xs text-red-600">
              確認後自動扣除傭金：<span className="font-bold">{order.currency} ${commissionAmount.toFixed(2)}</span>
              {priceChanged && <span className="text-gray-400 ml-1">（按實際成交價計算）</span>}
            </div>
          </div>
        )}
        {!isConfirm && (
          <>
            <p className="text-sm text-gray-500">確定取消此訂單？取消後不會扣除傭金。</p>
            {failureStats?.enabled && (
            <label className="flex items-start gap-2 bg-red-50 rounded-xl px-3 py-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={markAsFailure}
                onChange={(e) => setMarkAsFailure(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-red-500 shrink-0"
              />
              <div className="flex-1 space-y-1.5">
                <p className="text-xs font-semibold text-red-600">標記買家失約</p>
                {failureStats ? (
                  <div className="text-[11px] text-gray-600 leading-relaxed bg-white/70 rounded-lg px-2 py-1.5 border border-red-100 space-y-0.5">
                    <p>
                      你嘅設定：失約 <span className="font-bold text-red-600">{failureStats.threshold}</span> 次後凍結
                      <span className="font-bold text-red-600"> {failureStats.lockDays}</span> 日
                    </p>
                    <p>
                      呢位買家過去 30 日失約：
                      <span className="font-bold text-red-600">{failureStats.failureCount}</span> 次
                      {markAsFailure && (
                        <span className="text-gray-500">
                          {" "}→ 標記後 <span className="font-bold text-red-600">{failureStats.failureCount + 1}</span> 次
                        </span>
                      )}
                    </p>
                    {markAsFailure && (failureStats.failureCount + 1) >= failureStats.threshold && (
                      <p className="text-red-600 font-semibold">
                        ⚠️ 標記後將立即凍結該買家 {failureStats.lockDays} 日
                      </p>
                    )}
                    {failureStats.locked && failureStats.lockedUntil && (
                      <p className="text-amber-600">
                        ℹ️ 目前已被凍結至 {new Date(failureStats.lockedUntil).toLocaleString('zh-HK', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-[11px] text-gray-500 leading-relaxed">
                    失約累積到設定門檻後，將自動暫停該買家對你嘅落單／出價／排價（凍結日數可在「商戶設定」調整）。
                  </p>
                )}
              </div>
            </label>
            )}
          </>
        )}

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-500 text-sm font-medium hover:bg-gray-50">返回</button>
          <button
            onClick={() => onConfirm(
              isConfirm && finalPrice != null && finalPrice > 0 ? finalPrice : undefined,
              !isConfirm ? markAsFailure : undefined,
            )}
            disabled={isPending}
            className={`flex-1 py-2.5 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-1.5 disabled:opacity-60 ${isConfirm ? "bg-green-500 hover:bg-green-600" : "bg-red-400 hover:bg-red-500"}`}
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : isConfirm ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
            {isConfirm ? "確認成交" : "確定取消"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function MerchantOrdersTab() {
  const utils = trpc.useUtils();
  const [statusFilter, setStatusFilter] = useState<"pending" | "confirmed" | "cancelled" | "hidden">("pending");
  const isHiddenView = statusFilter === "hidden";
  const { data: visibleOrders = [], isLoading: visibleLoading, error: visibleError } = trpc.productOrders.myMerchantOrders.useQuery(
    { status: statusFilter },
    { enabled: !isHiddenView },
  );
  const { data: hiddenOrders = [], isLoading: hiddenLoading, error: hiddenError } = trpc.productOrders.myMerchantHiddenOrders.useQuery(
    undefined,
    { enabled: isHiddenView },
  ) as any;
  const orders: any[] = isHiddenView ? hiddenOrders : visibleOrders;
  const isLoading = isHiddenView ? hiddenLoading : visibleLoading;
  const ordersError = isHiddenView ? hiddenError : visibleError;
  const { data: counts = { pending: 0, confirmed: 0, cancelled: 0 } } = trpc.productOrders.myMerchantStatusCounts.useQuery(undefined, { staleTime: 15_000 }) as any;
  const { data: hiddenCount = 0 } = trpc.productOrders.myMerchantHiddenCount.useQuery(undefined, { staleTime: 15_000 }) as any;
  const restore = trpc.productOrders.restoreMerchantOrder.useMutation({
    onSuccess: () => {
      toast.success("已還原到正常清單");
      utils.productOrders.myMerchantHiddenOrders.invalidate();
      utils.productOrders.myMerchantHiddenCount.invalidate();
      utils.productOrders.myMerchantOrders.invalidate();
      utils.productOrders.myMerchantStatusCounts.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const { data: siteSettings = {} } = trpc.siteSettings.getAll.useQuery();
  const largeOrderThreshold = parseFloat((siteSettings as any).largeOrderCancelThreshold ?? "5000");
  const overdueDays = parseInt((siteSettings as any).largeOrderPendingDays ?? "7", 10);
  const [actionDialog, setActionDialog] = useState<{ order: any; type: "confirm" | "cancel" } | null>(null);

  const confirm = trpc.productOrders.confirm.useMutation({
    onSuccess: () => { toast.success("已確認成交，傭金已從保證金扣除"); utils.productOrders.myMerchantOrders.invalidate(); utils.productOrders.myMerchantStatusCounts.invalidate(); setActionDialog(null); },
    onError: (e) => toast.error(e.message),
  });
  const cancel = trpc.productOrders.cancel.useMutation({
    onSuccess: () => { toast.success("訂單已取消"); utils.productOrders.myMerchantOrders.invalidate(); utils.productOrders.myMerchantStatusCounts.invalidate(); setActionDialog(null); },
    onError: (e) => toast.error(e.message),
  });
  const respondCancelReq = trpc.productOrders.respondCancelRequest.useMutation({
    onSuccess: (_d, vars) => { toast.success(vars.action === 'approve' ? '已批准取消，訂單已關閉' : '已拒絕取消申請'); utils.productOrders.myMerchantOrders.invalidate(); utils.productOrders.myMerchantStatusCounts.invalidate(); setRejectDialog(null); setRejectReason(""); setActionDialog(null); },
    onError: (e) => toast.error(e.message),
  });
  const deleteOrder = trpc.productOrders.deleteMerchantOrder.useMutation({
    onSuccess: () => { toast.success('已從你嘅清單隱藏'); utils.productOrders.myMerchantOrders.invalidate(); utils.productOrders.myMerchantStatusCounts.invalidate(); setDeleteConfirm(null); },
    onError: (e) => { toast.error(e.message); setDeleteConfirm(null); },
  });
  const [deleteConfirm, setDeleteConfirm] = useState<{ orderId: number; title: string; markedAsBuyerFailure?: number } | null>(null);
  const [rejectDialog, setRejectDialog] = useState<{ orderId: number; title: string } | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {(["pending", "confirmed", "cancelled", "hidden"] as const).map(s => {
          const label = s === "pending" ? "待確認" : s === "confirmed" ? "已成交" : s === "cancelled" ? "已取消" : "已隱藏";
          const c = s === "hidden" ? Number(hiddenCount ?? 0) : ((counts as any)[s] ?? 0);
          const isActive = statusFilter === s;
          const activeBg = s === "hidden" ? "bg-gray-500" : "bg-amber-500";
          const inactiveBg = s === "hidden"
            ? "bg-white border border-gray-200 text-gray-500 hover:bg-gray-50"
            : "bg-white border border-amber-200 text-amber-700 hover:bg-amber-50";
          const badgeBg = s === "hidden" ? "bg-gray-100 text-gray-600" : "bg-amber-100 text-amber-700";
          return (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1 ${isActive ? `${activeBg} text-white` : inactiveBg}`}>
              {label}
              <span className={`min-w-[18px] h-4 px-1 rounded-full text-[10px] font-bold flex items-center justify-center ${isActive ? "bg-white/30 text-white" : badgeBg}`}>{c}</span>
            </button>
          );
        })}
      </div>

      {isHiddenView && (
        <p className="text-[11px] text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 leading-relaxed">
          ℹ️ 呢度顯示你已從正常清單隱藏嘅紀錄。買家側顯示不受影響，按「復原」可以將紀錄放返正常清單。
        </p>
      )}

      {isLoading ? (
        <div className="text-center py-10 text-2xl animate-spin">💰</div>
      ) : ordersError ? (
        <div className="text-center py-16">
          <ShoppingBag className="w-12 h-12 text-red-200 mx-auto mb-3" />
          <p className="text-red-400 text-sm">載入失敗：{ordersError.message}</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16">
          <ShoppingBag className="w-12 h-12 text-amber-200 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">暫無訂單</p>
        </div>
      ) : (
        <div className="space-y-3">
          {(orders as any[]).map((o) => {
            const price = parseFloat(String(o.price));
            const commission = parseFloat(String(o.commissionAmount));
            const finalPrice = o.finalPrice != null ? parseFloat(String(o.finalPrice)) : null;
            const d = new Date(o.createdAt);
            const orderTotal = price * parseInt(String(o.quantity));
            const isLargeOrder = orderTotal >= largeOrderThreshold;
            const pendingDays = parseInt(String(o.pendingDays ?? 0), 10);
            const isOverdue = o.status === "pending" && pendingDays >= overdueDays;
            return (
              <div key={o.id} className={`bg-white rounded-2xl border p-4 space-y-2.5 ${isLargeOrder && o.status === "pending" ? "border-orange-300 ring-1 ring-orange-200" : "border-gray-100"}`}>
                {isLargeOrder && o.status === "pending" && (
                  <div className="flex items-center gap-1.5 bg-orange-50 border border-orange-200 rounded-xl px-3 py-2 text-xs text-orange-700 font-medium">
                    <span>🔒</span>
                    <span>大額訂單（HKD ${orderTotal.toLocaleString()} ≥ ${largeOrderThreshold.toLocaleString()}）— 如需取消請聯絡管理員</span>
                  </div>
                )}
                {isOverdue && (
                  <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-xs text-red-700 font-medium">
                    <Clock className="w-3.5 h-3.5" />
                    <span>訂單待確認已超過 {pendingDays} 天，請盡快處理</span>
                  </div>
                )}
                <div className="flex items-start gap-3">
                  {(() => {
                    const imgs: string[] = (() => { try { return o.productImages ? JSON.parse(o.productImages) : []; } catch { return []; } })();
                    return imgs[0] ? (
                      <img src={imgs[0]} alt={o.title} className="w-16 h-16 rounded-xl object-cover shrink-0 border border-gray-100" />
                    ) : (
                      <div className="w-16 h-16 rounded-xl bg-amber-50 flex items-center justify-center shrink-0 border border-amber-100">
                        <ShoppingBag className="w-7 h-7 text-amber-200" />
                      </div>
                    );
                  })()}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <Link href={`/merchant-products/${o.productId}`}>
                        <a className="font-semibold text-sm text-amber-700 hover:underline line-clamp-2">{o.title}</a>
                      </Link>
                      <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${ORDER_STATUS_COLORS[o.status] ?? ""}`}>
                        {ORDER_STATUS_LABELS[o.status] ?? o.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {d.getFullYear()}/{String(d.getMonth()+1).padStart(2,"0")}/{String(d.getDate()).padStart(2,"0")} {String(d.getHours()).padStart(2,"0")}:{String(d.getMinutes()).padStart(2,"0")}
                    </p>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-xl p-2.5 grid grid-cols-2 gap-1.5 text-xs">
                  <div>
                    <span className="text-gray-400">標價</span>
                    <span className={`ml-1 font-bold ${finalPrice != null ? "text-gray-400 line-through" : "text-amber-600"}`}>
                      {o.currency} ${price.toLocaleString()} × {o.quantity}
                    </span>
                  </div>
                  <div><span className="text-gray-400">傭金</span><span className="ml-1 font-medium text-red-500">{o.currency} ${commission.toFixed(2)}</span></div>
                  {finalPrice != null && (
                    <div className="col-span-2 bg-green-50 rounded-lg px-2 py-1">
                      <span className="text-green-600">實際成交</span>
                      <span className="ml-1 font-bold text-green-700">{o.currency} ${finalPrice.toLocaleString()} × {o.quantity}</span>
                      <span className="ml-1 text-green-500">（合計 ${(finalPrice * parseInt(String(o.quantity))).toLocaleString()}）</span>
                    </div>
                  )}
                  <div><span className="text-gray-400">買家</span><span className="ml-1 font-medium">{o.buyerDisplayName ?? "—"}</span></div>
                  <div className="flex items-center gap-1">
                    <span className="text-gray-400">電話</span>
                    <span className="ml-1 font-medium">{o.buyerPhoneFromUser ?? o.buyerPhone ?? "—"}</span>
                    {(o.buyerPhoneFromUser ?? o.buyerPhone) && (
                      <a
                        href={`https://wa.me/${(o.buyerPhoneFromUser ?? o.buyerPhone ?? '').replace(/[^0-9]/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-1 flex-shrink-0"
                        title="WhatsApp 聯絡買家"
                      >
                        <svg viewBox="0 0 32 32" className="w-4 h-4" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <circle cx="16" cy="16" r="16" fill="#25D366"/>
                          <path d="M22.5 9.5A8.93 8.93 0 0 0 16 7C11.03 7 7 11.03 7 16c0 1.59.42 3.14 1.21 4.5L7 25l4.62-1.21A8.96 8.96 0 0 0 16 25c4.97 0 9-4.03 9-9 0-2.4-.94-4.66-2.5-6.5Zm-6.5 13.83c-1.35 0-2.67-.36-3.83-1.04l-.27-.16-2.74.72.73-2.68-.18-.28A7.44 7.44 0 0 1 8.56 16c0-4.1 3.34-7.44 7.44-7.44 1.99 0 3.85.77 5.25 2.17A7.38 7.38 0 0 1 23.44 16c0 4.1-3.34 7.33-7.44 7.33Zm4.08-5.5c-.22-.11-1.32-.65-1.53-.73-.2-.07-.35-.11-.5.11-.15.22-.58.73-.71.88-.13.15-.26.17-.48.06-.22-.11-.94-.35-1.79-1.1-.66-.59-1.1-1.32-1.23-1.54-.13-.22-.01-.34.1-.45.1-.1.22-.26.33-.39.11-.13.15-.22.22-.37.07-.15.04-.28-.02-.39-.06-.11-.5-1.2-.68-1.64-.18-.43-.36-.37-.5-.38h-.43c-.15 0-.39.06-.6.28-.2.22-.78.76-.78 1.86 0 1.1.8 2.16.91 2.31.11.15 1.58 2.41 3.83 3.38.54.23.95.37 1.28.47.54.17 1.03.15 1.42.09.43-.07 1.32-.54 1.51-1.06.19-.52.19-.97.13-1.06-.06-.09-.2-.15-.43-.26Z" fill="white"/>
                        </svg>
                      </a>
                    )}
                  </div>
                </div>

                {o.buyerNote && (
                  <p className="text-xs text-gray-500 bg-amber-50 rounded-lg px-2.5 py-1.5">備注：{o.buyerNote}</p>
                )}

                {!isHiddenView && o.status === "pending" && o.cancelRequestStatus === "pending" && (
                  <div className="rounded-xl border border-orange-300 bg-orange-50 px-3 py-2.5 space-y-2">
                    <p className="text-xs font-bold text-orange-700">⚠️ 買家申請取消此訂單</p>
                    {o.cancelRequestReason && (
                      <p className="text-xs text-orange-600">原因：{o.cancelRequestReason}</p>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={() => setRejectDialog({ orderId: o.id, title: o.title })}
                        disabled={respondCancelReq.isPending}
                        className="flex-1 text-xs py-1.5 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-60"
                      >拒絕申請</button>
                      <button
                        onClick={() => setActionDialog({ order: o, type: "cancel" })}
                        disabled={respondCancelReq.isPending}
                        className="flex-1 text-xs py-1.5 rounded-lg bg-orange-500 text-white font-semibold hover:bg-orange-600 disabled:opacity-60"
                      >批准取消</button>
                    </div>
                  </div>
                )}
                {!isHiddenView && o.status === "pending" && o.cancelRequestStatus === "rejected" && (
                  <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500">
                    你已拒絕買家嘅取消申請{o.cancelRequestRejectReason ? `（${o.cancelRequestRejectReason}）` : ''}
                  </div>
                )}

                {!isHiddenView && o.status === "pending" && (
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => setActionDialog({ order: o, type: "confirm" })}
                      disabled={confirm.isPending || cancel.isPending}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold py-2 rounded-xl transition-colors disabled:opacity-60"
                    >
                      <CheckCircle2 className="w-4 h-4" />確認成交
                    </button>
                    {isLargeOrder ? (
                      <div className="flex-1 flex items-center justify-center gap-1.5 border border-orange-200 text-orange-400 text-xs font-medium py-2 rounded-xl bg-orange-50 cursor-not-allowed" title="大額訂單需聯絡管理員取消">
                        <span>🔒</span>需管理員取消
                      </div>
                    ) : (
                      <button
                        onClick={() => setActionDialog({ order: o, type: "cancel" })}
                        disabled={confirm.isPending || cancel.isPending}
                        className="flex-1 flex items-center justify-center gap-1.5 border border-gray-200 text-gray-500 text-sm font-medium py-2 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-60"
                      >
                        <XCircle className="w-4 h-4" />取消訂單
                      </button>
                    )}
                  </div>
                )}
                {!isHiddenView && o.status === "confirmed" && (
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <p className="text-xs text-green-600 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {o.confirmedAt ? `成交於 ${new Date(o.confirmedAt).toLocaleDateString("zh-HK")}` : '已成交'}
                    </p>
                    <button
                      onClick={() => setDeleteConfirm({ orderId: o.id, title: o.title, markedAsBuyerFailure: Number(o.markedAsBuyerFailure) })}
                      className="text-[11px] text-gray-400 hover:text-amber-600 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-amber-50"
                      title="只會從你嘅清單隱藏，紀錄永遠保留"
                    >
                      <Trash2 className="w-3 h-3" />隱藏紀錄
                    </button>
                  </div>
                )}
                {!isHiddenView && o.status === "cancelled" && (
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <div className="text-xs text-gray-400 flex items-center gap-1.5">
                      <XCircle className="w-3.5 h-3.5" />
                      <span>已取消{o.cancelledAt ? ` · ${new Date(o.cancelledAt).toLocaleDateString("zh-HK")}` : ''}</span>
                      {Number(o.markedAsBuyerFailure) === 1 && (
                        <span className="ml-1 px-1.5 py-0.5 rounded-full bg-red-50 text-red-600 text-[10px] font-semibold">已記失約</span>
                      )}
                    </div>
                    <button
                      onClick={() => setDeleteConfirm({ orderId: o.id, title: o.title, markedAsBuyerFailure: Number(o.markedAsBuyerFailure) })}
                      className="text-[11px] text-gray-400 hover:text-amber-600 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-amber-50"
                      title="只會從你嘅清單隱藏，紀錄永遠保留"
                    >
                      <Trash2 className="w-3 h-3" />隱藏紀錄
                    </button>
                  </div>
                )}
                {isHiddenView && (
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-gray-100 mt-1">
                    <div className="text-[11px] text-gray-400 flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">已隱藏</span>
                      <span>原狀態：{o.status === "pending" ? "待確認" : o.status === "confirmed" ? "已成交" : "已取消"}</span>
                      {Number(o.markedAsBuyerFailure) === 1 && (
                        <span className="ml-1 px-1.5 py-0.5 rounded-full bg-red-50 text-red-600 text-[10px] font-semibold">已記失約</span>
                      )}
                    </div>
                    <button
                      onClick={() => restore.mutate({ orderId: o.id })}
                      disabled={restore.isPending}
                      className="text-[11px] text-amber-600 hover:text-amber-700 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-amber-50 disabled:opacity-50"
                    >
                      <RotateCcw className="w-3 h-3" />復原到正常清單
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {actionDialog && (
        <OrderActionDialog
          order={actionDialog.order}
          type={actionDialog.type}
          onClose={() => setActionDialog(null)}
          onConfirm={(finalPrice, markAsFailure) => {
            if (actionDialog.type === "confirm") {
              confirm.mutate({ orderId: actionDialog.order.id, finalPrice });
            } else if (actionDialog.order.cancelRequestStatus === "pending") {
              respondCancelReq.mutate({ orderId: actionDialog.order.id, action: 'approve', markAsFailure });
            } else {
              cancel.mutate({ orderId: actionDialog.order.id, reason: markAsFailure ? "商戶取消（買家失約）" : "商戶取消", markAsFailure });
            }
          }}
          isPending={confirm.isPending || cancel.isPending || respondCancelReq.isPending}
        />
      )}

      {deleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4 pb-20"
          onClick={() => setDeleteConfirm(null)}
        >
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm space-y-3" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-bold text-gray-800 text-base flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-amber-600" />從清單隱藏紀錄
            </h2>
            <p className="text-xs text-gray-500">商品：{deleteConfirm.title}</p>
            <p className="text-xs text-gray-600 bg-amber-50 rounded-lg px-3 py-2 border border-amber-100 leading-relaxed">
              ℹ️ 此操作只會將紀錄從你嘅清單隱藏，<span className="font-semibold">交易紀錄、傭金、失約計數一律完整保留</span>。買家側顯示不受影響。
            </p>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-500 text-sm font-medium hover:bg-gray-50"
              >返回</button>
              <button
                onClick={() => deleteOrder.mutate({ orderId: deleteConfirm.orderId })}
                disabled={deleteOrder.isPending}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold disabled:opacity-60"
              >{deleteOrder.isPending ? '隱藏中…' : '確認隱藏'}</button>
            </div>
          </div>
        </div>
      )}

      {rejectDialog && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4 pb-20"
          onClick={() => { setRejectDialog(null); setRejectReason(""); }}
        >
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm space-y-3" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-bold text-gray-800 text-base">拒絕買家取消申請</h2>
            <p className="text-xs text-gray-500">商品：{rejectDialog.title}</p>
            <p className="text-xs text-gray-500 leading-relaxed bg-amber-50 rounded-lg px-3 py-2 border border-amber-100">
              ℹ️ 拒絕後訂單會繼續維持「待確認」，買家會收到通知並見到你嘅回覆。
            </p>
            <textarea
              rows={3}
              maxLength={300}
              placeholder="（選填）回覆買家原因，例：已備貨、已寄出…"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-orange-400 resize-none"
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setRejectDialog(null); setRejectReason(""); }}
                disabled={respondCancelReq.isPending}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-500 text-sm font-medium hover:bg-gray-50"
              >返回</button>
              <button
                onClick={() => respondCancelReq.mutate({ orderId: rejectDialog.orderId, action: 'reject', rejectReason: rejectReason.trim() || undefined })}
                disabled={respondCancelReq.isPending}
                className="flex-1 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-sm font-semibold disabled:opacity-60"
              >
                {respondCancelReq.isPending ? '處理中…' : '確認拒絕'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── 主打申請 Dialog ──────────────────────────────────────────────────────────
const TIER_DESCS: Record<string, string> = {
  day1: "適合限時急售",
  day3: "適合週末旺季",
  day7: "最大曝光率",
};

function FeaturedApplyDialog({
  product,
  depositBalance,
  onClose,
  onSuccess,
}: {
  product: { id: number; title: string; price: number; currency: string };
  depositBalance: number;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [tier, setTier] = useState<"day1" | "day3" | "day7">("day1");
  const [result, setResult] = useState<{ queued: boolean; queuePosition?: number } | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  const { data: slotStatus } = trpc.featuredListings.slotStatus.useQuery(undefined, { staleTime: 10_000 });
  const { data: pricingData } = trpc.featuredListings.pricing.useQuery(undefined, { staleTime: 60_000 });

  const isFull = slotStatus ? slotStatus.active >= slotStatus.maxSlots : false;
  const slotsLeft = slotStatus ? Math.max(0, slotStatus.maxSlots - slotStatus.active) : null;

  const TIER_OPTIONS = pricingData?.tiers?.map((t: any) => ({
    tier: t.tier,
    label: t.label,
    price: t.price,
    hours: t.hours,
    desc: TIER_DESCS[t.tier] ?? "",
  })) ?? [
    { tier: "day1", label: "24 小時主打", price: 30, hours: 24, desc: "適合限時急售" },
    { tier: "day3", label: "3 天主打", price: 70, hours: 72, desc: "適合週末旺季" },
    { tier: "day7", label: "7 天主打", price: 120, hours: 168, desc: "最大曝光率" },
  ];

  const apply = trpc.featuredListings.submit.useMutation({
    onSuccess: (data) => {
      onSuccess();
      if (data.queued) {
        setResult({ queued: true, queuePosition: data.queuePosition });
      } else {
        setShowSuccess(true);
      }
    },
    onError: (e) => toast.error(e.message),
  });
  const selected = TIER_OPTIONS.find(o => o.tier === tier) ?? TIER_OPTIONS[0];
  const canAfford = depositBalance >= (selected?.price ?? 0);

  const productPriceStr = `${product.currency ?? 'HKD'} $${product.price.toFixed(2)}`;

  // ── 立即生效成功畫面 ──
  if (showSuccess) {
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 pb-20">
        <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden">
          <div className="relative bg-gradient-to-r from-orange-500 to-red-500 px-5 py-4 text-white">
            <button onClick={onClose} className="absolute right-3 top-3 text-white/80 hover:text-white"><X className="w-5 h-5" /></button>
            <div className="text-3xl mb-1">🔥</div>
            <h2 className="font-bold text-base">已成功申請主打！</h2>
          </div>
          <div className="p-5 space-y-3">
            <div className="bg-gray-50 rounded-xl p-3 space-y-1">
              <p className="text-sm font-semibold text-gray-800 line-clamp-2">{product.title}</p>
              <p className="text-xs text-gray-500">售價：<span className="font-semibold text-gray-700">{productPriceStr}</span></p>
            </div>
            <div className="bg-orange-50 rounded-xl px-3 py-2 text-xs text-orange-700 font-medium">
              ✅ 即時生效，主打刊登費已從保證金扣除
            </div>
            <button onClick={onClose} className="w-full py-2.5 rounded-xl bg-orange-500 text-white font-semibold text-sm hover:bg-orange-600 transition">
              明白了
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── 排隊成功確認畫面 ──
  if (result?.queued) {
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 pb-20">
        <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden">
          <div className="relative bg-gradient-to-r from-amber-400 to-orange-400 px-5 py-4 text-white">
            <button onClick={onClose} className="absolute right-3 top-3 text-white/80 hover:text-white"><X className="w-5 h-5" /></button>
            <div className="text-3xl mb-1">⏳</div>
            <h2 className="font-bold text-base">已加入排隊！</h2>
          </div>
          <div className="p-5 space-y-3">
            <div className="bg-gray-50 rounded-xl p-3 space-y-1">
              <p className="text-sm font-semibold text-gray-800 line-clamp-2">{product.title}</p>
              <p className="text-xs text-gray-500">售價：<span className="font-semibold text-gray-700">{productPriceStr}</span></p>
            </div>
            <div className="bg-amber-50 rounded-xl p-3 space-y-1">
              <p className="text-amber-700 font-semibold text-sm">目前排隊位置：第 {result.queuePosition} 位</p>
              <p className="text-xs text-gray-500">主打位額滿（{slotStatus?.maxSlots} 個），費用已預先扣除，當有位置空出時系統將自動升級啟動。如取消排隊，費用將<strong>退回保證金</strong>。</p>
            </div>
            <button onClick={onClose} className="w-full py-2.5 rounded-xl bg-amber-500 text-white font-semibold text-sm hover:bg-amber-600 transition">
              明白了
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── 主申請畫面 ──
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 pb-20" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="relative bg-gradient-to-r from-yellow-500 to-orange-500 px-5 py-4">
          <button onClick={onClose} className="absolute right-3 top-3 text-white/80 hover:text-white"><X className="w-5 h-5" /></button>
          <div className="flex items-center gap-2 text-white">
            <Flame className="w-5 h-5" />
            <h2 className="font-bold text-base">申請主打刊登</h2>
          </div>
          <p className="text-yellow-100 text-xs mt-0.5 line-clamp-1">{product.title}</p>
          <p className="text-yellow-200 text-xs font-semibold">{productPriceStr}</p>
        </div>
        <div className="p-4 space-y-3">
          {/* 主打位狀態列 */}
          {slotStatus && (
            <div className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs ${isFull ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700'}`}>
              <span>{isFull ? `⚠️ 主打位已額滿（${slotStatus.active}/${slotStatus.maxSlots}），申請後加入排隊` : `✅ 尚有 ${slotsLeft} 個空位，立即生效`}</span>
              {!isFull && <span className="font-semibold">{slotStatus.active}/{slotStatus.maxSlots} 位</span>}
            </div>
          )}
          {isFull && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 text-xs text-orange-700 space-y-0.5">
              <p className="font-semibold">💳 申請排隊時立即扣費</p>
              <p>費用會即時從保證金扣除。輪到你時自動升為進行中，無需額外付費。</p>
              <p className="text-orange-500">如取消排隊，已扣費用將<strong>全額退回</strong>保證金。</p>
            </div>
          )}
          {slotStatus && slotStatus.queued > 0 && (
            <p className="text-xs text-gray-400 -mt-1">目前排隊等候：{slotStatus.queued} 個</p>
          )}
          <p className="text-xs text-gray-500">費用立即從保證金扣除。目前餘額：<span className="font-semibold text-gray-700">HK${depositBalance.toFixed(2)}</span></p>
          <div className="space-y-2">
            {TIER_OPTIONS.map(o => (
              <button
                key={o.tier}
                onClick={() => setTier(o.tier as any)}
                className={`w-full flex items-center justify-between p-3 rounded-xl border-2 transition-all text-left ${tier === o.tier ? 'border-orange-400 bg-orange-50' : 'border-gray-100 hover:border-orange-200'}`}
              >
                <div>
                  <div className={`text-sm font-semibold ${tier === o.tier ? 'text-orange-600' : 'text-gray-700'}`}>{o.label}</div>
                  <div className="text-xs text-gray-400">{o.desc}</div>
                </div>
                <div className={`text-base font-bold ${tier === o.tier ? 'text-orange-500' : 'text-gray-500'}`}>HK${o.price}</div>
              </button>
            ))}
          </div>
          {!canAfford && (
            <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">保證金不足，請先充值</p>
          )}
          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 transition">取消</button>
            <button
              disabled={!canAfford || apply.isPending}
              onClick={() => apply.mutate({ productId: product.id, tier })}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition disabled:opacity-50 flex items-center justify-center gap-1.5"
              style={{ background: canAfford ? "linear-gradient(135deg,#f59e0b,#ea580c)" : undefined, backgroundColor: canAfford ? undefined : "#d1d5db" }}
            >
              {apply.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Flame className="w-4 h-4" />}
              {isFull ? '💳 立即扣費排隊' : '確認申請'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MerchantProducts() {
  const { isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const fileRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<"products" | "orders">(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("tab") === "orders" ? "orders" : "products";
  });

  const { data: siteSettings } = trpc.siteSettings.getAll.useQuery(undefined, { staleTime: 5 * 60 * 1000 });
  const CATEGORIES = parseCategories(siteSettings as Record<string, string> | undefined);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [noSubDialogOpen, setNoSubDialogOpen] = useState(false);
  const [form, setForm] = useState<ProductForm>(EMPTY_FORM);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generatingCollage, setGeneratingCollage] = useState(false);
  const pendingCollageRef = useRef<string | null>(null);
  const newImagePreviewUrlsRef = useRef<Map<string, string>>(new Map());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; title: string; img?: string; price?: number; currency?: string } | null>(null);
  const [layout, setLayout] = useState<LayoutMode>(() => {
    return (localStorage.getItem("mp_layout") as LayoutMode) ?? "list";
  });
  const [productTab, setProductTab] = useState<"active" | "hidden" | "sold">("active");
  const [productBatchShareOpen, setProductBatchShareOpen] = useState(false);
  const [productCopiedIds, setProductCopiedIds] = useState<Set<number>>(new Set());
  const [productSelectedShareIds, setProductSelectedShareIds] = useState<Set<number>>(new Set());
  const [aiCopyMap, setAiCopyMap] = useState<Record<number, string>>({});
  const [aiCopyLoadingId, setAiCopyLoadingId] = useState<number | null>(null);
  const [aiScriptDialog, setAiScriptDialog] = useState<{ id: number; title: string; text: string } | null>(null);
  const [aiScriptLoadingId, setAiScriptLoadingId] = useState<number | null>(null);
  const aiShareCopyMut = trpc.aiAssist.generateShareCopy.useMutation();
  const aiVideoScriptMut = trpc.aiAssist.generateVideoScript.useMutation();
  const { data: _aiSiteSettings } = trpc.siteSettings.getAll.useQuery(undefined, { staleTime: 60_000 });
  const _aiSet = (_aiSiteSettings as Record<string, string> | undefined) ?? {};
  const aiShareCopyEnabled = _aiSet.aiShareCopyEnabled !== "false";
  const aiVideoScriptEnabled = _aiSet.aiVideoScriptEnabled !== "false";
  const [productCopiedAll, setProductCopiedAll] = useState(false);

  const { data: products = [], isLoading } = trpc.merchants.myProducts.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const displayProducts = (products as any[]).filter((p: any) => p.status === productTab);
  const activeProducts = (products as any[]).filter((p: any) => p.status === "active");

  const { data: quotaInfo, isLoading: quotaLoading } = trpc.merchants.getQuotaInfo.useQuery(undefined, {
    enabled: isAuthenticated,
    staleTime: 0,
    refetchOnMount: true,
  });
  const { data: depositCheck } = trpc.sellerDeposits.canList.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  function changeLayout(m: LayoutMode) {
    setLayout(m);
    localStorage.setItem("mp_layout", m);
  }

  const addProduct = trpc.merchants.addProduct.useMutation({
    onSuccess: () => {
      utils.merchants.myProducts.invalidate();
      utils.merchants.getQuotaInfo.invalidate();
      toast.success("商品已上架");
      resetForm();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateProduct = trpc.merchants.updateProduct.useMutation({
    onSuccess: () => { utils.merchants.myProducts.invalidate(); utils.merchants.myProducts.refetch(); toast.success("商品已更新"); resetForm(); },
    onError: (e) => toast.error(e.message),
  });

  const updateStatus = trpc.merchants.updateProduct.useMutation({
    onSuccess: () => { utils.merchants.myProducts.invalidate(); utils.merchants.myProducts.refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const deleteProduct = trpc.merchants.deleteProduct.useMutation({
    onSuccess: () => { utils.merchants.myProducts.invalidate(); toast.success("商品已刪除"); },
    onError: (e) => toast.error(e.message),
  });

  const uploadImage = trpc.merchants.uploadProductImage.useMutation();
  const signUpload = trpc.merchants.signImageUpload.useMutation();
  const uploadVideo = trpc.merchants.uploadVideo.useMutation();
  const { data: videoQuotaInfo } = trpc.merchants.getMyVideoQuota.useQuery();
  const { data: merchantSettings } = trpc.merchants.getSettings.useQuery();
  const videoFileRef = useRef<HTMLInputElement>(null);
  const [uploadingVideo, setUploadingVideo] = useState(false);

  // 主打刊登
  const [featuredDialog, setFeaturedDialog] = useState<{ id: number; title: string; price: number; currency: string } | null>(null);
  const [cancelQueueTarget, setCancelQueueTarget] = useState<{ id: number; productTitle: string } | null>(null);
  const { data: myDeposit } = trpc.sellerDeposits.myDeposit.useQuery(undefined, { enabled: isAuthenticated });
  const { data: myFeatured = [] } = trpc.featuredListings.myListings.useQuery(undefined, { enabled: isAuthenticated, staleTime: 30_000, refetchInterval: 60_000 });
  const _now = new Date();
  const activeFeaturedIds = new Set(
    (myFeatured as any[]).filter((f: any) => f.status === 'active' && (!f.endAt || new Date(f.endAt) > _now)).map((f: any) => f.productId)
  );
  const queuedFeaturedMap = new Map<number, { id: number; queuePosition: number }>(
    (myFeatured as any[])
      .filter((f: any) => f.status === 'queued')
      .map((f: any) => [f.productId, { id: f.id, queuePosition: f.queuePosition ?? 1 }])
  );

  const cancelFeatured = trpc.featuredListings.cancelMine.useMutation({
    onSuccess: (data) => {
      utils.featuredListings.myListings.invalidate();
      utils.sellerDeposits.myDeposit.invalidate();
      if (data?.wasQueued) {
        toast.success("已取消排隊，不收任何費用");
      } else if (data?.refundAmount && data.refundAmount > 0) {
        toast.success(`已取消主打，HK$${data.refundAmount.toFixed(2)} 已退回保證金`);
      } else {
        toast.success("已取消主打");
      }
    },
    onError: (e) => toast.error(e.message),
  });

  function resetForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    pendingCollageRef.current = null;
    newImagePreviewUrlsRef.current.clear();
  }

  function startEdit(p: any) {
    const imgs: string[] = (() => { try { return p.images ? JSON.parse(p.images) : []; } catch { return []; } })();
    setForm({
      title: p.title ?? "",
      description: p.description ?? "",
      price: parseFloat(p.price ?? "0").toString(),
      currency: p.currency ?? "HKD",
      categories: (() => {
        if (!p.category) return [];
        // 新格式：用 | 分隔（避免分類名稱本身含逗號如「人民幣 1,2,3版」）
        if (p.category.includes("|")) return p.category.split("|").map((s: string) => s.trim()).filter(Boolean);
        // 舊格式：整個字串視作單一分類（向後兼容）
        return p.category.trim() ? [p.category.trim()] : [];
      })(),
      stock: String(p.stock ?? 1),
      allowOffers: Number((p as any).allowOffers ?? 1) === 1,
      images: imgs,
      videoUrl: p.videoUrl ?? "",
    });
    setEditingId(p.id);
    setShowForm(true);
    setTimeout(() => document.getElementById("product-form")?.scrollIntoView({ behavior: "smooth" }), 100);
  }

  const handleImageUpload = useCallback(async (files: File[]) => {
    const MAX = 10;
    const currentCount = form.images.length;
    const slots = MAX - currentCount;
    if (slots <= 0) return;
    const toUpload = files.filter(f => f.type.startsWith("image/")).slice(0, slots);
    if (toUpload.length === 0) return;

    const oversized = toUpload.filter(f => f.size > MAX_FILE_SIZE);
    if (oversized.length > 0) toast.info(`${oversized.length} 張圖片超過 5MB，將自動壓縮後上載`);

    setUploading(true);
    try {
      const results = await Promise.all(
        toUpload.map(async (file) => {
          // 永遠壓縮（1280px / q=0.78），減少上載 payload
          const processed = await compressImage(file);
          // 記錄 blob URL 供 collage 生成用
          const blobUrl = URL.createObjectURL(processed);
          // 嘗試 presigned 直傳 S3；冇水印商戶會用 direct mode 跳過 server proxy
          try {
            const signed = await signUpload.mutateAsync({
              kind: 'product',
              mimeType: processed.type || 'image/jpeg',
              fileName: processed.name,
            });
            if (signed.mode === 'direct') {
              const putRes = await fetch(signed.uploadUrl, {
                method: 'PUT',
                headers: { 'Content-Type': processed.type || 'image/jpeg' },
                body: processed,
              });
              if (!putRes.ok) throw new Error(`S3 直傳失敗 ${putRes.status}`);
              newImagePreviewUrlsRef.current.set(signed.finalUrl, blobUrl);
              return signed.finalUrl;
            }
          } catch (e) {
            console.warn('[upload] presigned direct upload failed, fallback to server', e);
          }
          // Fallback：水印商戶或 presigned 失敗 → 走舊 base64 pipeline
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve((reader.result as string).split(",")[1]);
            reader.onerror = () => reject(new Error("讀取圖片失敗"));
            reader.readAsDataURL(processed);
          });
          const { url } = await uploadImage.mutateAsync({ imageData: base64, fileName: processed.name, mimeType: processed.type || "image/jpeg" });
          newImagePreviewUrlsRef.current.set(url, blobUrl);
          return url;
        })
      );
      setForm(f => ({ ...f, images: [...f.images, ...results].slice(0, MAX) }));
      if (results.length > 1) toast.success(`已上傳 ${results.length} 張圖片`);
    } catch (err: any) {
      toast.error(err.message ?? "上傳失敗");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }, [form.images.length, uploadImage, signUpload]);

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) handleImageUpload(files);
  }

  async function handleVideoFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (videoFileRef.current) videoFileRef.current.value = "";
    if (!file) return;
    if (!VIDEO_MIME_ALLOW.includes(file.type)) {
      toast.error("只支援 MP4、WebM、MOV 格式");
      return;
    }
    if (file.size > MAX_VIDEO_SIZE) {
      toast.error("影片不可超過 30MB");
      return;
    }
    setUploadingVideo(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = () => reject(new Error("讀取影片失敗"));
        reader.readAsDataURL(file);
      });
      const { url } = await uploadVideo.mutateAsync({ videoData: base64, fileName: file.name, mimeType: file.type });
      setForm(f => ({ ...f, videoUrl: url }));
      toast.success("影片已上傳");
    } catch (err: any) {
      toast.error(err.message ?? "影片上傳失敗");
    } finally {
      setUploadingVideo(false);
    }
  }

  async function handleSubmit() {
    if (!form.title.trim()) return toast.error("請輸入商品名稱");
    const price = parseFloat(form.price);
    if (isNaN(price) || price <= 0) return toast.error("請輸入有效售價");
    const stock = parseInt(form.stock);
    if (isNaN(stock) || stock < 0) return toast.error("請輸入有效庫存量");
    if (form.images.length === 0) return toast.error("請最少上傳一幅商品圖片");
    if (form.categories.length === 0) return toast.error("請至少選擇一個商品分類");

    // 自動生成商品封面 collage（設定開啟 + 有 2+ 張新上傳圖片）
    const newPreviewUrls = form.images
      .filter(url => newImagePreviewUrlsRef.current.has(url))
      .map(url => newImagePreviewUrlsRef.current.get(url)!);
    if (Number((merchantSettings as any)?.autoGenerateProductCover ?? 0) === 1 && newPreviewUrls.length >= 2) {
      try {
        setGeneratingCollage(true);
        const blob = await generateCollage(newPreviewUrls);
        if (blob) {
          const collageFile = new File([blob], 'collage.jpg', { type: 'image/jpeg' });
          let collageUrl = '';
          // 先試 presigned 直傳 S3
          try {
            const signed = await signUpload.mutateAsync({ kind: 'product', mimeType: 'image/jpeg', fileName: 'collage.jpg' });
            if (signed.mode === 'direct') {
              const putRes = await fetch(signed.uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'image/jpeg' }, body: collageFile });
              if (!putRes.ok) throw new Error(`S3 直傳失敗 ${putRes.status}`);
              collageUrl = signed.finalUrl;
            }
          } catch {
            // presigned 失敗，繼續用 base64 fallback
          }
          // 唔論 presigned mode 係咪 direct，只要 collageUrl 未設定就用 base64
          if (!collageUrl) {
            const base64 = await new Promise<string>((res, rej) => {
              const r = new FileReader();
              r.onload = () => res((r.result as string).split(',')[1]);
              r.onerror = rej;
              r.readAsDataURL(collageFile);
            });
            const { url } = await uploadImage.mutateAsync({ imageData: base64, fileName: 'collage.jpg', mimeType: 'image/jpeg' });
            collageUrl = url;
          }
          if (collageUrl) pendingCollageRef.current = collageUrl;
        }
      } catch (e) {
        console.warn('[collage] generation failed, skipping', e);
      } finally {
        setGeneratingCollage(false);
      }
    }

    // 編輯時直接提交，新增時才顯示確認彈窗
    if (editingId) { doSubmit(); } else { setConfirmOpen(true); }
  }

  async function doSubmit() {
    const collageUrl = pendingCollageRef.current;
    pendingCollageRef.current = null;
    const finalImages = collageUrl ? [collageUrl, ...form.images] : form.images;
    const price = parseFloat(form.price);
    const stock = parseInt(form.stock);
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      price,
      currency: form.currency,
      category: form.categories.length > 0 ? form.categories.join("|") : undefined,
      images: finalImages.length > 0 ? JSON.stringify(finalImages) : undefined,
      videoUrl: form.videoUrl ? form.videoUrl : null,
      stock,
      allowOffers: form.allowOffers ? 1 : 0,
    };
    setSaving(true);
    try {
      if (editingId) {
        await updateProduct.mutateAsync({ id: editingId, ...payload });
      } else {
        await addProduct.mutateAsync(payload);
      }
    } finally {
      setSaving(false);
      setConfirmOpen(false);
    }
  }

  async function toggleStatus(p: any) {
    const next = p.status === "active" ? "hidden" : "active";
    await updateStatus.mutateAsync({ id: p.id, status: next });
    toast.success(next === "hidden" ? "商品已下架" : "商品已重新上架");
  }

  async function markSold(p: any) {
    await updateStatus.mutateAsync({ id: p.id, status: "sold", stock: 0 });
    toast.success("已標記為已售出");
  }

  async function reList(p: any) {
    await updateStatus.mutateAsync({ id: p.id, status: "active" });
    toast.success("已重新上架");
  }

  async function hideFromSold(p: any) {
    await updateStatus.mutateAsync({ id: p.id, status: "hidden" });
    toast.success("商品已下架");
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-6 text-center">
        <Package className="w-12 h-12 text-amber-400" />
        <h1 className="text-xl font-bold">請先登入</h1>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container max-w-lg mx-auto pt-4 pb-28 space-y-4">
        <div className="flex items-center gap-3">
          <Link href="/merchant-dashboard">
            <button className="p-2 rounded-xl hover:bg-amber-50 transition-colors">
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
          </Link>
          <Package className="w-5 h-5 text-green-600" />
          <h1 className="text-lg font-bold text-gray-800 flex-1">商品管理</h1>
          {activeTab === "products" && (
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white gap-1"
              onClick={() => {
                if (!quotaLoading && !quotaInfo) {
                  setNoSubDialogOpen(true);
                  return;
                }
                setEditingId(null); setForm(EMPTY_FORM); setShowForm(true);
                setTimeout(() => document.getElementById("product-form")?.scrollIntoView({ behavior: "smooth" }), 100);
              }}
            >
              <Plus className="w-4 h-4" />
              上架商品
            </Button>
          )}
        </div>

        {/* Tab 切換 */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          <button onClick={() => setActiveTab("products")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === "products" ? "bg-white text-green-700 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
            <Package className="w-4 h-4" />我的商品
          </button>
          <button onClick={() => setActiveTab("orders")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === "orders" ? "bg-white text-amber-700 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
            <ShoppingBag className="w-4 h-4" />訂單管理
          </button>
        </div>

        {activeTab === "orders" && <MerchantOrdersTab />}

        {activeTab === "products" && <>
        {/* 商品表單 */}
        {showForm && (
          <div id="product-form" className="rounded-2xl bg-green-50 border border-green-200 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-gray-800">{editingId ? "編輯商品" : "新增商品"}</h2>
              <button onClick={resetForm} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4" /></button>
            </div>

            {/* ── 圖片上載（最頂）── */}
            <div className="space-y-2">
              <label className="text-xs text-gray-500 font-medium flex items-center gap-1">
                商品圖片（最少 1 張，最多 10 張）<span className="text-red-500">*</span>
                {uploading && <span className="text-green-600 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" />上傳中…</span>}
              </label>

              {/* 拖放 / 點擊上傳區 */}
              {form.images.length < 10 && (
                <div
                  onClick={() => !uploading && fileRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${uploading ? "border-green-300 bg-green-50 cursor-wait" : "border-gray-300 hover:border-green-400 hover:bg-green-50"}`}
                >
                  {uploading ? (
                    <Loader2 className="w-6 h-6 mx-auto mb-1 text-green-500 animate-spin" />
                  ) : (
                    <ImageIcon className="w-6 h-6 mx-auto mb-1 text-gray-400" />
                  )}
                  <p className="text-xs text-gray-500">
                    {uploading ? "上傳中，請稍候…" : "點擊選擇圖片（可同時選多張）"}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">還可加 {10 - form.images.length} 張</p>
                </div>
              )}
              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileInputChange} />

              {/* 已上傳圖片縮圖 */}
              {form.images.length > 0 && (
                <div className="grid grid-cols-5 gap-2">
                  {form.images.map((url, i) => (
                    <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-gray-200">
                      <img src={url} alt="" className="w-full h-full object-cover" />
                      <button
                        onClick={() => setForm(f => ({ ...f, images: f.images.filter((_, j) => j !== i) }))}
                        className="absolute top-0.5 right-0.5 bg-red-500 text-white rounded-full p-0.5"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                      {i === 0 && (
                        <span className="absolute bottom-0 left-0 right-0 text-center text-white text-[9px] bg-black/50 py-0.5">封面</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── 商品影片（選填，最多 1 條，≤30MB） ── */}
            <div className="space-y-2">
              <label className="text-xs text-gray-500 font-medium">商品影片（選填，MP4/WebM/MOV，≤30MB）</label>
              {videoQuotaInfo && (
                <p className="text-xs text-muted-foreground">
                  本月剩餘 <span className="font-semibold text-amber-700">{videoQuotaInfo.remaining}</span> / {videoQuotaInfo.quota} 條 · 每條最長 <span className="font-semibold text-amber-700">{videoQuotaInfo.maxSeconds}</span> 秒
                </p>
              )}
              {form.videoUrl ? (
                <div className="relative">
                  <video src={form.videoUrl} controls playsInline className="w-full max-h-64 rounded-lg border border-amber-100 bg-black" />
                  <button type="button" onClick={() => setForm(f => ({ ...f, videoUrl: "" }))}
                    className="absolute top-1 right-1 bg-black/60 hover:bg-black/80 rounded-full p-1">
                    <X className="w-3.5 h-3.5 text-white" />
                  </button>
                </div>
              ) : (
                <div onClick={() => !uploadingVideo && videoFileRef.current?.click()}
                  className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${uploadingVideo ? "opacity-60 cursor-wait" : "border-muted-foreground/30 hover:border-amber-400"}`}>
                  {uploadingVideo ? (
                    <p className="text-sm text-muted-foreground">影片上傳中…</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">點擊上傳商品影片</p>
                  )}
                </div>
              )}
              <input ref={videoFileRef} type="file" accept="video/mp4,video/webm,video/quicktime" className="hidden" onChange={handleVideoFileChange} />
            </div>

            {/* ── 商品資料 ── */}
            <div className="space-y-2">
              <label className="text-xs text-gray-500 font-medium">商品名稱 *</label>
              <Input placeholder="例：1981年香港一元硬幣" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </div>

            <div className="space-y-2">
              <label className="text-xs text-gray-500 font-medium">商品描述</label>
              <Textarea placeholder="品相、年份、特點等..." rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <label className="text-xs text-gray-500 font-medium">售價 *</label>
                <Input type="number" placeholder="0" min="1" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-gray-500 font-medium">貨幣</label>
                <Select value={form.currency} onValueChange={v => setForm(f => ({ ...f, currency: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCY_OPTIONS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <label className="text-xs text-gray-500 font-medium">商品分類</label>
                <span className="text-xs text-red-500">（至少選一個）</span>
                {form.categories.length > 0 && (
                  <span className="ml-auto text-xs text-green-600 font-medium">已選 {form.categories.length} 個</span>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {CATEGORIES.map((cat) => {
                  const selected = form.categories.includes(cat);
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setForm(f => ({
                        ...f,
                        categories: selected
                          ? f.categories.filter(c => c !== cat)
                          : [...f.categories, cat],
                      }))}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                        selected
                          ? "bg-green-500 text-white border-green-500"
                          : "bg-white text-green-700 border-green-300 hover:bg-green-50"
                      }`}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs text-gray-500 font-medium">庫存數量</label>
              <Input type="number" placeholder="1" min="0" value={form.stock} onChange={e => setForm(f => ({ ...f, stock: e.target.value }))} />
            </div>

            <div className="flex items-center justify-between rounded-xl border border-orange-100 bg-orange-50/50 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-700">允許買家排價</p>
                <p className="text-[11px] text-gray-500 mt-0.5">關咗就唔會喺商品頁顯示「排價」按鈕</p>
              </div>
              <input
                type="checkbox"
                className="w-5 h-5 accent-orange-500 cursor-pointer shrink-0"
                checked={form.allowOffers}
                onChange={e => setForm(f => ({ ...f, allowOffers: e.target.checked }))}
              />
            </div>

            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={resetForm} disabled={saving || uploading}>取消</Button>
              <Button className="flex-1 bg-green-600 hover:bg-green-700 text-white" onClick={handleSubmit} disabled={saving || uploading || generatingCollage}>
                {(saving || generatingCollage) ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {generatingCollage ? "生成封面中..." : saving ? "儲存中..." : (editingId ? "儲存修改" : "確認上架")}
              </Button>
            </div>
          </div>
        )}

        {/* 狀態篩選 Tabs */}
        {!isLoading && (products as any[]).length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: "none" }}>
            {([
              { key: "active", label: "已上架", count: (products as any[]).filter((p: any) => p.status === "active").length },
              { key: "hidden", label: "已下架", count: (products as any[]).filter((p: any) => p.status === "hidden").length },
              { key: "sold", label: "已售出", count: (products as any[]).filter((p: any) => p.status === "sold").length },
            ] as const).map(({ key, label, count }) => (
              <button
                key={key}
                onClick={() => setProductTab(key)}
                className={`shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                  productTab === key
                    ? "bg-green-600 text-white border-green-600"
                    : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                {label}
                <span className={`text-[10px] px-1 py-0.5 rounded-full font-bold ${
                  productTab === key ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"
                }`}>{count}</span>
              </button>
            ))}
          </div>
        )}

        {/* 已上架批量分享按鈕 */}
        {!isLoading && productTab === "active" && activeProducts.length > 0 && (
          <div className="flex items-center gap-2 px-1 py-0.5">
            <Button
              size="sm"
              className="h-7 px-2.5 text-xs gap-1.5 bg-[#1877F2] hover:bg-[#1560c8] text-white border-0"
              onClick={() => {
                setProductSelectedShareIds(new Set(activeProducts.map((p: any) => p.id)));
                setProductBatchShareOpen(true);
              }}
            >
              <Facebook className="w-3 h-3" />
              批量分享（{activeProducts.length}）
            </Button>
          </div>
        )}

        {/* 版面切換列 */}
        {!isLoading && displayProducts.length > 0 && (
          <div className="flex items-center justify-between bg-white border border-gray-100 rounded-xl px-3 py-2">
            <span className="text-xs text-gray-400">共 {displayProducts.length} 件商品</span>
            <div className="flex items-center gap-1">
              {([
                { mode: "list" as LayoutMode, icon: <LayoutList className="w-4 h-4" />, label: "列表" },
                { mode: "big" as LayoutMode, icon: <Maximize2 className="w-4 h-4" />, label: "大圖" },
                { mode: "grid2" as LayoutMode, icon: <LayoutGrid className="w-4 h-4" />, label: "兩欄" },
                { mode: "grid3" as LayoutMode, icon: <Grid3X3 className="w-4 h-4" />, label: "三欄" },
              ]).map(({ mode, icon, label }) => (
                <button
                  key={mode}
                  title={label}
                  onClick={() => changeLayout(mode)}
                  className={`p-1.5 rounded-lg transition-colors ${layout === mode ? "bg-green-100 text-green-700" : "text-gray-400 hover:bg-gray-100"}`}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 商品列表 */}
        {isLoading ? (
          <div className="text-center py-12 text-4xl animate-spin">💰</div>
        ) : (products as any[]).length === 0 ? (
          <div className="text-center py-16">
            <Package className="w-12 h-12 text-green-200 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">尚未上架任何商品</p>
            <p className="text-gray-300 text-xs mt-1">點擊「上架商品」開始添加</p>
          </div>
        ) : displayProducts.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">此類別暫無商品</p>
          </div>
        ) : layout === "list" ? (
          /* ── 列表版面：重新設計卡片 ── */
          <div className="space-y-3">
            {(displayProducts as any[]).map((p) => {
              const imgs: string[] = (() => { try { return p.images ? JSON.parse(p.images) : []; } catch { return []; } })();
              const price = parseFloat(p.price ?? "0");
              const isActive = p.status === "active";
              const isHidden = p.status === "hidden";
              const isSold = p.status === "sold";
              const isFeatured = activeFeaturedIds.has(p.id);
              const queued = queuedFeaturedMap.get(p.id);
              const accentColor = isActive ? "bg-green-500" : isSold ? "bg-gray-400" : "bg-yellow-400";
              const categories: string[] = p.category ? (p.category.includes("|") ? p.category.split("|") : [p.category]).map((c: string) => c.trim()) : [];
              return (
                <div key={p.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex">
                  {/* 狀態色條 */}
                  <div className={`w-1 shrink-0 ${accentColor}`} />

                  <div className="flex flex-1 gap-3 p-3 min-w-0">
                    {/* 商品圖片 */}
                    <div className="shrink-0">
                      {imgs[0] ? (
                        <img src={imgs[0]} alt={p.title} className="w-[72px] h-[72px] rounded-xl object-cover border border-gray-100" />
                      ) : (
                        <div className="w-[72px] h-[72px] rounded-xl bg-gray-50 flex items-center justify-center border border-gray-100">
                          <Package className="w-7 h-7 text-gray-300" />
                        </div>
                      )}
                    </div>

                    {/* 商品資訊 */}
                    <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                      {/* 標題列 */}
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-sm font-bold text-gray-800 line-clamp-2 leading-snug flex-1">{p.title}</h3>
                        <span className={`shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[p.status] ?? ""}`}>
                          {STATUS_LABELS[p.status] ?? p.status}
                        </span>
                      </div>

                      {/* 分類 + 價格列 */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {categories.slice(0, 2).map(c => (
                          <span key={c} className="text-[11px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full font-medium">{c}</span>
                        ))}
                        <span className="font-extrabold text-green-600 text-base leading-none">{p.currency} ${price.toLocaleString()}</span>
                        <span className="text-[11px] text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">庫存 {p.stock}</span>
                      </div>

                      {/* 主打狀態列 */}
                      {isActive && isFeatured && (
                        <div className="flex items-center gap-1 text-[11px] text-orange-500 font-semibold">
                          <Flame className="w-3 h-3" />主打刊登中
                        </div>
                      )}
                      {isActive && queued && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[11px] text-amber-600 font-semibold bg-amber-50 px-2 py-0.5 rounded-full">⏳ 申請主打排隊第 {queued.queuePosition} 位</span>
                          <button onClick={() => setCancelQueueTarget({ id: queued.id, productTitle: p.title })} className="flex items-center gap-0.5 text-[10px] font-semibold px-2 py-0.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors">
                            <X className="w-2.5 h-2.5" />取消排隊
                          </button>
                        </div>
                      )}

                      {/* 操作按鈕列 */}
                      <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                        {/* 編輯 */}
                        <button onClick={() => startEdit(p)} className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors font-medium">
                          <Pencil className="w-3 h-3" />編輯
                        </button>
                        {/* 狀態操作 */}
                        {isActive && (
                          <button onClick={() => toggleStatus(p)} disabled={updateStatus.isPending} className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 font-medium">
                            <EyeOff className="w-3 h-3" />下架
                          </button>
                        )}
                        {isActive && (
                          <button onClick={() => markSold(p)} disabled={updateStatus.isPending} className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-gray-700 text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 font-medium">
                            <Tag className="w-3 h-3" />已售出
                          </button>
                        )}
                        {isHidden && (
                          <button onClick={() => toggleStatus(p)} disabled={updateStatus.isPending} className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 font-medium">
                            <Eye className="w-3 h-3" />上架
                          </button>
                        )}
                        {isSold && (
                          <>
                            <button onClick={() => reList(p)} disabled={updateStatus.isPending} className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 font-medium">
                              <RotateCcw className="w-3 h-3" />重售
                            </button>
                            <button onClick={() => hideFromSold(p)} disabled={updateStatus.isPending} className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 font-medium">
                              <EyeOff className="w-3 h-3" />下架
                            </button>
                          </>
                        )}
                        {/* 申請主打 */}
                        {isActive && !isFeatured && !queued && (
                          <button onClick={() => setFeaturedDialog({ id: p.id, title: p.title, price: parseFloat(p.price ?? '0'), currency: p.currency ?? 'HKD' })} className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-gradient-to-r from-amber-400 to-orange-500 text-white rounded-lg hover:from-amber-500 hover:to-orange-600 transition-colors font-medium shadow-sm">
                            <Flame className="w-3 h-3" />申請主打
                          </button>
                        )}
                        {/* 分享去藏品社區 */}
                        {isActive && (
                          <a href={`/collection-square/new?productId=${p.id}`} title="分享呢件商品去藏品社區" className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-sky-50 text-sky-600 rounded-lg hover:bg-sky-100 transition-colors font-medium">
                            <Sparkles className="w-3 h-3" />分享去藏品社區
                          </a>
                        )}
                        {/* 刪除 */}
                        <button onClick={() => setDeleteTarget({ id: p.id, title: p.title, img: imgs[0], price: parseFloat(p.price ?? "0"), currency: p.currency ?? "HKD" })} className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition-colors font-medium ml-auto">
                          <Trash2 className="w-3 h-3" />刪除
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : layout === "big" ? (
          /* ── 大圖版面：全寬圖片＋資料在下 ── */
          <div className="space-y-4">
            {(displayProducts as any[]).map((p) => {
              const imgs: string[] = (() => { try { return p.images ? JSON.parse(p.images) : []; } catch { return []; } })();
              const price = parseFloat(p.price ?? "0");
              return (
                <div key={p.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                  {imgs[0] ? (
                    <img src={imgs[0]} alt={p.title} className="w-full h-52 object-cover" />
                  ) : (
                    <div className="w-full h-52 bg-gray-50 flex items-center justify-center">
                      <Package className="w-10 h-10 text-gray-200" />
                    </div>
                  )}
                  {imgs.length > 1 && (
                    <div className="flex gap-1 px-3 pt-2 overflow-x-auto">
                      {imgs.slice(1).map((u, i) => (
                        <img key={i} src={u} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0 border border-gray-100" />
                      ))}
                    </div>
                  )}
                  <div className="p-3 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-gray-800 line-clamp-2 text-sm">{p.title}</h3>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full shrink-0 ${STATUS_COLORS[p.status] ?? ""}`}>
                        {STATUS_LABELS[p.status] ?? p.status}
                      </span>
                    </div>
                    {p.description && <p className="text-xs text-gray-500 line-clamp-2">{p.description}</p>}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-amber-600">{p.currency} ${price.toLocaleString()}</span>
                        {p.category && (p.category.includes("|") ? p.category.split("|") : [p.category]).map((c: string) => <span key={c} className="text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">{c.trim()}</span>)}
                      </div>
                      <span className="text-xs text-gray-400">庫存 {p.stock}</span>
                    </div>
                    <div className="flex items-center gap-2 pt-1 flex-wrap">
                      <button onClick={() => startEdit(p)} className="flex items-center gap-1 text-xs px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors flex-1 justify-center">
                        <Pencil className="w-3 h-3" />編輯
                      </button>
                      {p.status === "active" && (
                        <button onClick={() => toggleStatus(p)} disabled={updateStatus.isPending} className="flex items-center gap-1 text-xs px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors flex-1 justify-center disabled:opacity-50">
                          <EyeOff className="w-3 h-3" />下架
                        </button>
                      )}
                      {p.status === "active" && (
                        <button onClick={() => markSold(p)} disabled={updateStatus.isPending} className="flex items-center gap-1 text-xs px-3 py-1.5 bg-gray-700 text-white rounded-lg hover:bg-gray-800 transition-colors flex-1 justify-center disabled:opacity-50">
                          <Tag className="w-3 h-3" />已售出
                        </button>
                      )}
                      {p.status === "hidden" && (
                        <button onClick={() => toggleStatus(p)} disabled={updateStatus.isPending} className="flex items-center gap-1 text-xs px-3 py-1.5 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors flex-1 justify-center disabled:opacity-50">
                          <Eye className="w-3 h-3" />上架
                        </button>
                      )}
                      {p.status === "sold" && (
                        <>
                          <button onClick={() => reList(p)} disabled={updateStatus.isPending} className="flex items-center gap-1 text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex-1 justify-center disabled:opacity-50">
                            <RotateCcw className="w-3 h-3" />重售
                          </button>
                          <button onClick={() => hideFromSold(p)} disabled={updateStatus.isPending} className="flex items-center gap-1 text-xs px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors flex-1 justify-center disabled:opacity-50">
                            下架
                          </button>
                        </>
                      )}
                      {p.status === "active" && (() => {
                        if (activeFeaturedIds.has(p.id)) return <span className="flex items-center gap-1 text-xs px-2 py-1.5 bg-orange-50 text-orange-500 rounded-lg font-medium"><Flame className="w-3 h-3" />主打中</span>;
                        const queued = queuedFeaturedMap.get(p.id);
                        if (queued) return <span className="flex items-center gap-1 flex-wrap"><span className="px-2 py-1 bg-amber-50 text-amber-600 rounded-full text-xs font-semibold">⏳ 申請主打排隊第{queued.queuePosition}位</span><button onClick={() => setCancelQueueTarget({ id: queued.id, productTitle: p.title })} className="flex items-center gap-0.5 px-2 py-1 bg-red-500 text-white text-xs font-semibold rounded-full hover:bg-red-600 transition-colors"><X className="w-2.5 h-2.5" />取消排隊</button></span>;
                        return <button onClick={() => setFeaturedDialog({ id: p.id, title: p.title, price: parseFloat(p.price ?? '0'), currency: p.currency ?? 'HKD' })} className="flex items-center gap-1 text-xs px-2 py-1.5 text-orange-500 border border-orange-200 rounded-lg hover:bg-orange-50 transition-colors font-medium"><Flame className="w-3 h-3" />申請主打</button>;
                      })()}
                      <button onClick={() => setDeleteTarget({ id: p.id, title: p.title, img: imgs[0], price: parseFloat(p.price ?? "0"), currency: p.currency ?? "HKD" })} className="flex items-center gap-1 text-xs px-3 py-1.5 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition-colors">
                        <Trash2 className="w-3 h-3" />刪除
                      </button>
                      {p.status === "active" && (
                        <a
                          href={`/collection-square/new?productId=${p.id}`}
                          className="flex items-center gap-1 text-xs px-3 py-1.5 bg-sky-50 text-sky-600 rounded-lg hover:bg-sky-100 transition-colors flex-1 justify-center"
                          title="分享呢件商品去藏品社區"
                        >
                          <Sparkles className="w-3 h-3" />分享去藏品社區
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : layout === "grid2" ? (
          /* ── 兩欄版面 ── */
          <div className="grid grid-cols-2 gap-3">
            {(displayProducts as any[]).map((p) => {
              const imgs: string[] = (() => { try { return p.images ? JSON.parse(p.images) : []; } catch { return []; } })();
              const price = parseFloat(p.price ?? "0");
              return (
                <div key={p.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden flex flex-col">
                  {imgs[0] ? (
                    <img src={imgs[0]} alt={p.title} className="w-full aspect-square object-cover" />
                  ) : (
                    <div className="w-full aspect-square bg-gray-50 flex items-center justify-center">
                      <Package className="w-8 h-8 text-gray-200" />
                    </div>
                  )}
                  <div className="p-2 flex flex-col gap-1 flex-1">
                    <div className="flex items-start justify-between gap-1">
                      <h3 className="text-xs font-semibold text-gray-800 line-clamp-2 flex-1">{p.title}</h3>
                      <span className={`text-[10px] px-1 py-0.5 rounded-full shrink-0 leading-tight ${STATUS_COLORS[p.status] ?? ""}`}>
                        {STATUS_LABELS[p.status] ?? p.status}
                      </span>
                    </div>
                    <span className="font-bold text-amber-600 text-xs">{p.currency} ${price.toLocaleString()}</span>
                    <span className="text-[10px] text-gray-400">庫存 {p.stock}</span>
                    <div className="flex gap-1 mt-auto pt-1 flex-wrap">
                      <button onClick={() => startEdit(p)} className="flex-1 text-[10px] py-1 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-center">
                        編輯
                      </button>
                      {p.status === "active" && (
                        <button onClick={() => toggleStatus(p)} disabled={updateStatus.isPending} className="flex-1 text-[10px] py-1 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors text-center disabled:opacity-50">
                          下架
                        </button>
                      )}
                      {p.status === "active" && (
                        <button onClick={() => markSold(p)} disabled={updateStatus.isPending} className="flex-1 text-[10px] py-1 bg-gray-700 text-white rounded-lg hover:bg-gray-800 transition-colors text-center disabled:opacity-50">
                          已售出
                        </button>
                      )}
                      {p.status === "hidden" && (
                        <button onClick={() => toggleStatus(p)} disabled={updateStatus.isPending} className="flex-1 text-[10px] py-1 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors text-center disabled:opacity-50">
                          上架
                        </button>
                      )}
                      {p.status === "sold" && (
                        <>
                          <button onClick={() => reList(p)} disabled={updateStatus.isPending} className="flex-1 text-[10px] py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-center disabled:opacity-50">
                            重售
                          </button>
                          <button onClick={() => hideFromSold(p)} disabled={updateStatus.isPending} className="flex-1 text-[10px] py-1 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors text-center disabled:opacity-50">
                            下架
                          </button>
                        </>
                      )}
                      {p.status === "active" && (() => {
                        if (activeFeaturedIds.has(p.id)) return <span className="text-[10px] px-1.5 py-1 bg-orange-50 text-orange-500 rounded-lg"><Flame className="w-3 h-3" /></span>;
                        const queued = queuedFeaturedMap.get(p.id);
                        if (queued) return <span className="flex items-center gap-0.5 text-[10px]"><span className="px-1.5 py-1 bg-amber-50 text-amber-600 rounded-lg font-semibold">⏳排隊第{queued.queuePosition}位</span><button onClick={() => setCancelQueueTarget({ id: queued.id, productTitle: p.title })} className="flex items-center gap-0.5 px-1.5 py-1 bg-red-500 text-white font-semibold rounded-lg hover:bg-red-600 transition-colors" title="取消排隊"><X className="w-2.5 h-2.5" />取消</button></span>;
                        return <button onClick={() => setFeaturedDialog({ id: p.id, title: p.title, price: parseFloat(p.price ?? '0'), currency: p.currency ?? 'HKD' })} className="text-[10px] px-1.5 py-1 text-orange-500 border border-orange-200 rounded-lg hover:bg-orange-50 transition-colors"><Flame className="w-3 h-3" /></button>;
                      })()}
                      <button onClick={() => setDeleteTarget({ id: p.id, title: p.title, img: imgs[0], price: parseFloat(p.price ?? "0"), currency: p.currency ?? "HKD" })} className="text-[10px] px-1.5 py-1 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition-colors">
                        <Trash2 className="w-3 h-3" />
                      </button>
                      {p.status === "active" && (
                        <a href={`/collection-square/new?productId=${p.id}`} title="分享去藏品社區" className="text-[10px] px-1.5 py-1 bg-sky-50 text-sky-600 rounded-lg hover:bg-sky-100 transition-colors">
                          <Sparkles className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* ── 三欄版面（精簡方格）── */
          <div className="grid grid-cols-3 gap-2">
            {(displayProducts as any[]).map((p) => {
              const imgs: string[] = (() => { try { return p.images ? JSON.parse(p.images) : []; } catch { return []; } })();
              const price = parseFloat(p.price ?? "0");
              return (
                <div key={p.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden flex flex-col">
                  <div className="relative">
                    {imgs[0] ? (
                      <img src={imgs[0]} alt={p.title} className="w-full aspect-square object-cover" />
                    ) : (
                      <div className="w-full aspect-square bg-gray-50 flex items-center justify-center">
                        <Package className="w-5 h-5 text-gray-200" />
                      </div>
                    )}
                    <span className={`absolute top-1 right-1 text-[9px] px-1 py-0.5 rounded-full leading-tight ${STATUS_COLORS[p.status] ?? ""}`}>
                      {STATUS_LABELS[p.status] ?? p.status}
                    </span>
                  </div>
                  <div className="p-1.5 flex flex-col gap-0.5 flex-1">
                    <h3 className="text-[10px] font-semibold text-gray-800 line-clamp-2 leading-tight">{p.title}</h3>
                    <span className="text-[10px] font-bold text-amber-600">${price.toLocaleString()}</span>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      <button onClick={() => startEdit(p)} className="flex-1 text-[9px] py-0.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors text-center">
                        編輯
                      </button>
                      {p.status === "active" && (
                        <button onClick={() => toggleStatus(p)} disabled={updateStatus.isPending} className="flex-1 text-[9px] py-0.5 bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors text-center disabled:opacity-50">
                          下架
                        </button>
                      )}
                      {p.status === "active" && (
                        <button onClick={() => markSold(p)} disabled={updateStatus.isPending} className="flex-1 text-[9px] py-0.5 bg-gray-700 text-white rounded hover:bg-gray-800 transition-colors text-center disabled:opacity-50">
                          售出
                        </button>
                      )}
                      {p.status === "hidden" && (
                        <button onClick={() => toggleStatus(p)} disabled={updateStatus.isPending} className="flex-1 text-[9px] py-0.5 bg-green-50 text-green-600 rounded hover:bg-green-100 transition-colors text-center disabled:opacity-50">
                          上架
                        </button>
                      )}
                      {p.status === "sold" && (
                        <>
                          <button onClick={() => reList(p)} disabled={updateStatus.isPending} className="flex-1 text-[9px] py-0.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-center disabled:opacity-50">
                            重售
                          </button>
                          <button onClick={() => hideFromSold(p)} disabled={updateStatus.isPending} className="flex-1 text-[9px] py-0.5 bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors text-center disabled:opacity-50">
                            下架
                          </button>
                        </>
                      )}
                      {p.status === "active" && (() => {
                        if (activeFeaturedIds.has(p.id)) return <span className="text-[9px] px-1 py-0.5 bg-orange-50 text-orange-500 rounded"><Flame className="w-2.5 h-2.5" /></span>;
                        const queued = queuedFeaturedMap.get(p.id);
                        if (queued) return <span className="flex items-center gap-0.5 text-[9px]"><span className="px-1 py-0.5 bg-amber-50 text-amber-600 rounded font-semibold">⏳排隊第{queued.queuePosition}位</span><button onClick={() => setCancelQueueTarget({ id: queued.id, productTitle: p.title })} className="flex items-center px-1 py-0.5 bg-red-500 text-white font-semibold rounded hover:bg-red-600 transition-colors" title="取消排隊"><X className="w-2 h-2" /></button></span>;
                        return <button onClick={() => setFeaturedDialog({ id: p.id, title: p.title, price: parseFloat(p.price ?? '0'), currency: p.currency ?? 'HKD' })} className="text-[9px] px-1 py-0.5 text-orange-500 border border-orange-200 rounded hover:bg-orange-50 transition-colors"><Flame className="w-2.5 h-2.5" /></button>;
                      })()}
                      <button onClick={() => setDeleteTarget({ id: p.id, title: p.title, img: imgs[0], price: parseFloat(p.price ?? "0"), currency: p.currency ?? "HKD" })} className="text-[9px] px-1 py-0.5 bg-red-50 text-red-500 rounded hover:bg-red-100 transition-colors">
                        <Trash2 className="w-2.5 h-2.5" />
                      </button>
                      {p.status === "active" && (
                        <a href={`/collection-square/new?productId=${p.id}`} title="分享去藏品社區" className="text-[9px] px-1 py-0.5 bg-sky-50 text-sky-600 rounded hover:bg-sky-100 transition-colors">
                          <Sparkles className="w-2.5 h-2.5" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        </>}
      </div>

      {/* 刪除確認彈窗 */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 pb-24" onClick={() => setDeleteTarget(null)}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h3 className="font-bold text-gray-800">確認刪除商品</h3>
                <p className="text-xs text-gray-400 mt-0.5">刪除後不可復原</p>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
              {deleteTarget.img ? (
                <img src={deleteTarget.img} alt="" className="w-14 h-14 rounded-lg object-cover shrink-0 border border-gray-100" />
              ) : (
                <div className="w-14 h-14 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                  <Package className="w-6 h-6 text-gray-300" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-700 line-clamp-2">{deleteTarget.title}</p>
                {deleteTarget.price !== undefined && (
                  <p className="text-sm font-bold text-amber-600 mt-1">{deleteTarget.currency} ${deleteTarget.price.toLocaleString()}</p>
                )}
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-500 text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
              <button
                disabled={deleteProduct.isPending}
                onClick={() => { deleteProduct.mutate({ id: deleteTarget.id }); setDeleteTarget(null); }}
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold disabled:opacity-60 transition-colors flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />確認刪除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 確認上架彈窗 */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5 text-green-600" />
              確認上架商品
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-gray-700 pt-1">
                <div className="bg-gray-50 rounded-xl p-3 space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-gray-500">商品名稱</span>
                    <span className="font-medium text-right max-w-[60%]">{form.title}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">售價</span>
                    <span className="font-bold text-amber-600">{form.currency} ${parseFloat(form.price || "0").toLocaleString()}</span>
                  </div>
                  {form.categories.length > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">類別</span>
                      <span>{form.categories.join("、")}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-500">庫存</span>
                    <span>{form.stock} 件</span>
                  </div>
                  {form.images.length > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">圖片</span>
                      <span>{form.images.length} 張</span>
                    </div>
                  )}
                </div>
                {/* 公佈額度狀態 */}
                {(() => {
                  const remaining = quotaInfo ? Math.max(0, Number(quotaInfo.remainingQuota)) : null;
                  const noSubscription = !quotaLoading && !quotaInfo;
                  const quotaOk = !!quotaInfo && (quotaInfo.unlimited || (remaining !== null && remaining >= 1));
                  const isError = !depositCheck?.canList || !quotaOk;
                  let quotaLabel = "";
                  if (quotaLoading) {
                    quotaLabel = "查詢額度中…";
                  } else if (noSubscription) {
                    quotaLabel = "您的月費計劃已過期或尚未訂閱，請先續訂後才可上架商品";
                  } else if (quotaInfo!.unlimited) {
                    quotaLabel = "公佈額度正常（無限制）";
                  } else if (quotaOk) {
                    quotaLabel = `公佈額度正常（剩餘 ${remaining} 次）`;
                  } else {
                    quotaLabel = `公佈額度不足（剩餘 ${remaining} 次），請先購買月費計劃`;
                  }
                  return (
                    <div className={`rounded-lg p-2.5 flex items-start gap-2 ${isError ? "bg-red-50 border border-red-200" : "bg-green-50 border border-green-200"}`}>
                      <span className="text-base leading-none mt-0.5">
                        {quotaLoading ? "⏳" : isError ? "⚠️" : "✅"}
                      </span>
                      <div className="text-xs space-y-0.5">
                        {!depositCheck?.canList ? (
                          <p className="text-red-700 font-medium">{depositCheck?.reason ?? "保證金不足，無法上架"}</p>
                        ) : (
                          <p className={isError ? "text-red-700 font-medium" : "text-green-700"}>{quotaLabel}</p>
                        )}
                      </div>
                    </div>
                  );
                })()}
                <p className="text-xs text-gray-400">確認後商品將立即公開顯示於商戶市集，並扣減 1 次公佈額度。</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); doSubmit(); }}
              disabled={saving || quotaLoading || !depositCheck?.canList || !quotaInfo || (!quotaInfo.unlimited && Number(quotaInfo.remainingQuota) < 1)}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />上架中…</> : "確認上架"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── 未訂閱提示 Dialog ── */}
      <Dialog open={noSubDialogOpen} onOpenChange={setNoSubDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <CreditCard className="w-5 h-5" />
              需要訂閱月費計劃
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-1">
            <p className="text-sm text-foreground leading-relaxed">
              上架商品需要有效的月費訂閱計劃。請先訂閱合適的計劃，審批通過後即可開始上架。
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 space-y-1">
              <p className="font-medium">如何訂閱？</p>
              <p>1. 前往「訂閱計劃」頁面選擇計劃</p>
              <p>2. 上傳付款憑證提交申請</p>
              <p>3. 等待管理員審批（通常 1 個工作天）</p>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setNoSubDialogOpen(false)}>關閉</Button>
              <Link href="/subscriptions">
                <Button className="bg-amber-500 hover:bg-amber-600 text-white border-0 gap-1.5" onClick={() => setNoSubDialogOpen(false)}>
                  <CreditCard className="w-4 h-4" />
                  前往訂閱
                </Button>
              </Link>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 主打申請 Dialog */}
      {featuredDialog && (
        <FeaturedApplyDialog
          product={featuredDialog}
          depositBalance={myDeposit?.balance ?? 0}
          onClose={() => setFeaturedDialog(null)}
          onSuccess={() => {
            utils.featuredListings.myListings.invalidate();
          }}
        />
      )}

      {/* 取消排隊確認 Dialog */}
      {cancelQueueTarget && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 pb-20">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden">
            <div className="relative bg-gradient-to-r from-red-400 to-rose-500 px-5 py-4 text-white">
              <button onClick={() => setCancelQueueTarget(null)} className="absolute right-3 top-3 text-white/80 hover:text-white">
                <X className="w-5 h-5" />
              </button>
              <div className="text-2xl mb-1">❌</div>
              <h2 className="font-bold text-base">取消排隊</h2>
            </div>
            <div className="p-5 space-y-3">
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-sm font-semibold text-gray-800 line-clamp-2">{cancelQueueTarget.productTitle}</p>
              </div>
              <div className="bg-amber-50 rounded-xl px-3 py-2 text-xs text-amber-700">
                取消排隊後，已預扣的費用將<strong>退回保證金</strong>。
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setCancelQueueTarget(null)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 transition"
                >
                  保留排隊
                </button>
                <button
                  disabled={cancelFeatured.isPending}
                  onClick={() => {
                    cancelFeatured.mutate({ id: cancelQueueTarget.id });
                    setCancelQueueTarget(null);
                  }}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-red-500 hover:bg-red-600 transition disabled:opacity-50 flex items-center justify-center gap-1"
                >
                  確認取消
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 批量分享 Facebook Dialog ── */}
      <Dialog open={productBatchShareOpen} onOpenChange={(v) => { if (!v) { setProductBatchShareOpen(false); setProductCopiedIds(new Set()); setProductCopiedAll(false); setProductSelectedShareIds(new Set()); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden">
          {/* Gradient header */}
          <div className="bg-gradient-to-br from-orange-500 via-amber-500 to-yellow-500 px-5 py-4 text-white">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2.5 text-white text-lg drop-shadow">
                <div className="w-9 h-9 rounded-full bg-white/25 backdrop-blur flex items-center justify-center shadow-inner">
                  <Share2 className="w-5 h-5" />
                </div>
                批量分享商品
              </DialogTitle>
            </DialogHeader>
            <p className="text-xs text-white/90 mt-2 leading-relaxed pl-1">
              ✨ 剔選想分享嘅商品，可以一鍵複製全部、或者每件單獨彈系統分享 sheet
            </p>
          </div>

          {/* Body */}
          <div className="flex-1 flex flex-col overflow-hidden p-4 gap-3 bg-gradient-to-b from-amber-50/40 to-white">
            {/* Selection toolbar */}
            <div className="flex items-center justify-between gap-2 rounded-xl bg-white border border-amber-200 px-3 py-2 shadow-sm">
              <span className="text-sm text-amber-900">
                已選 <b className="text-orange-600 text-base mx-0.5">{productSelectedShareIds.size}</b>
                <span className="text-gray-400">/</span> {activeProducts.length} 件
              </span>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setProductSelectedShareIds(new Set(activeProducts.map((p: any) => p.id)))}
                  className="text-[11px] px-2.5 py-1 rounded-full border border-amber-300 text-amber-700 hover:bg-amber-50 font-medium"
                >
                  全選
                </button>
                <button
                  type="button"
                  onClick={() => setProductSelectedShareIds(new Set())}
                  className="text-[11px] px-2.5 py-1 rounded-full border border-gray-300 text-gray-600 hover:bg-gray-50 font-medium"
                >
                  全部取消
                </button>
              </div>
            </div>

            <Button
              size="sm"
              disabled={productSelectedShareIds.size === 0}
              className={`h-10 text-sm gap-2 shadow-md transition-all ${
                productCopiedAll
                  ? "bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-500 hover:to-emerald-500 text-white"
                  : "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
              }`}
              onClick={async () => {
                const picked = activeProducts.filter((p: any) => productSelectedShareIds.has(p.id));
                if (picked.length === 0) { toast.error("請先剔選最少 1 件商品"); return; }
                const allText = picked.map((p: any) => {
                  const price = parseFloat(p.price ?? "0");
                  const currency = p.currency ?? "HKD";
                  const productUrl = `${window.location.origin}/merchant-products/${p.id}`;
                  return `${p.title}\n出售價格：${currency} $${price.toLocaleString()}\n${productUrl}`;
                }).join("\n\n---\n\n");
                await navigator.clipboard.writeText(allText);
                setProductCopiedAll(true);
                const preview = allText.length > 180 ? allText.slice(0, 180) + "…" : allText;
                toast.success(`已複製 ${picked.length} 件商品文字！貼入 Facebook 群組即可`, { description: preview, duration: 5000 });
                setTimeout(() => setProductCopiedAll(false), 3000);
              }}
            >
              {productCopiedAll ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {productCopiedAll ? "已複製全部！" : `一鍵複製揀咗嘅（${productSelectedShareIds.size}）件商品文字`}
            </Button>
          <div className="overflow-y-auto flex-1 space-y-2.5 pr-1 -mr-1">
            {activeProducts.map((p: any) => {
              const imgs: string[] = (() => { try { return p.images ? JSON.parse(p.images) : []; } catch { return []; } })();
              const price = parseFloat(p.price ?? "0");
              const currency = p.currency ?? "HKD";
              const productUrl = `${window.location.origin}/merchant-products/${p.id}`;
              const sym = currency === "USD" ? "US$" : currency === "CNY" ? "¥" : "HK$";
              const fbTpl = (merchantSettings as { fbShareTemplateProduct?: string | null } | undefined)?.fbShareTemplateProduct;
              const tpl = fbTpl?.trim() || "{title}\n出售價格：{price}";
              const tplText = tpl
                .replace(/\{title\}/g, p.title)
                .replace(/\{price\}/g, `${sym}${price.toLocaleString()}`);
              const aiText = aiCopyMap[p.id];
              const shareText = aiText || tplText;
              const isCopied = productCopiedIds.has(p.id);
              const aiCopyLoading = aiCopyLoadingId === p.id;
              const aiScriptLoading = aiScriptLoadingId === p.id;
              const isShareSelected = productSelectedShareIds.has(p.id);
              return (
                <div
                  key={p.id}
                  className={`rounded-xl border-2 overflow-hidden transition-all ${
                    isShareSelected
                      ? "border-amber-300 bg-white shadow-sm"
                      : "border-gray-200 bg-gray-50/60 opacity-60"
                  }`}
                >
                  <div className="flex items-center gap-3 p-3">
                    <input
                      type="checkbox"
                      checked={isShareSelected}
                      onChange={() => {
                        setProductSelectedShareIds((prev) => {
                          const n = new Set(prev);
                          if (n.has(p.id)) n.delete(p.id); else n.add(p.id);
                          return n;
                        });
                      }}
                      className="w-5 h-5 accent-orange-500 cursor-pointer flex-shrink-0"
                      title={isShareSelected ? "取消選擇" : "剔選分享"}
                    />
                    <div className="w-14 h-14 rounded-lg overflow-hidden bg-amber-100 flex-shrink-0 ring-1 ring-amber-200">
                      {imgs[0]
                        ? <img src={imgs[0]} alt="" className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center"><ImageIcon className="w-5 h-5 text-amber-300" /></div>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate text-amber-900">{p.title}</p>
                      <p className="text-xs text-orange-600 font-medium mt-0.5">{sym}{price.toLocaleString()}</p>
                    </div>
                  </div>
                  {aiText && (
                    <div className="px-2.5 pb-1.5">
                      <div className="text-[10px] text-purple-600 mb-0.5 flex items-center gap-1">
                        <Sparkles className="w-2.5 h-2.5" /> AI 文案（已套用）
                      </div>
                      <div className="text-[11px] bg-purple-50 border border-purple-200 rounded p-1.5 whitespace-pre-wrap max-h-24 overflow-y-auto">{aiText}</div>
                    </div>
                  )}
                  {(aiShareCopyEnabled || aiVideoScriptEnabled) && (
                    <div className="flex gap-1.5 px-2.5 pb-1.5">
                      {aiShareCopyEnabled && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={aiCopyLoading}
                          className="flex-1 h-6 text-[10px] gap-1 border-purple-300 text-purple-700 hover:bg-purple-50"
                          onClick={async () => {
                            setAiCopyLoadingId(p.id);
                            try {
                              const res = await aiShareCopyMut.mutateAsync({ kind: "product", id: p.id });
                              setAiCopyMap(prev => ({ ...prev, [p.id]: res.text }));
                              toast.success("✨ AI 文案已生成！");
                            } catch (e: any) {
                              toast.error(e?.message ?? "AI 文案生成失敗");
                            } finally {
                              setAiCopyLoadingId(null);
                            }
                          }}
                        >
                          {aiCopyLoading ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Sparkles className="w-2.5 h-2.5" />}
                          {aiText ? "重新生成" : "AI 文案"}
                        </Button>
                      )}
                      {aiVideoScriptEnabled && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={aiScriptLoading}
                          className="flex-1 h-6 text-[10px] gap-1 border-pink-300 text-pink-700 hover:bg-pink-50"
                          onClick={async () => {
                            setAiScriptLoadingId(p.id);
                            try {
                              const res = await aiVideoScriptMut.mutateAsync({ kind: "product", id: p.id, durationSec: 45 });
                              setAiScriptDialog({ id: p.id, title: p.title, text: res.text });
                            } catch (e: any) {
                              toast.error(e?.message ?? "AI 旁白生成失敗");
                            } finally {
                              setAiScriptLoadingId(null);
                            }
                          }}
                        >
                          {aiScriptLoading ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Mic className="w-2.5 h-2.5" />}
                          AI 旁白稿
                        </Button>
                      )}
                    </div>
                  )}
                  <div className="flex gap-1.5 px-2.5 pb-2.5">
                    <Button
                      size="sm"
                      className="flex-1 h-7 text-xs gap-1 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white border-0"
                      onClick={async () => {
                        if (navigator.share) {
                          try {
                            await navigator.share({ title: p.title, text: shareText, url: productUrl });
                          } catch (err: unknown) {
                            if (err instanceof Error && err.name !== "AbortError") {
                              try { await navigator.clipboard.writeText(`${shareText}\n${productUrl}`); } catch {}
                              toast.error("系統分享失敗，已複製文字＋連結");
                            }
                          }
                        } else {
                          try { await navigator.clipboard.writeText(`${shareText}\n${productUrl}`); } catch {}
                          toast.info("此瀏覽器不支援系統分享，已複製文字＋連結");
                        }
                      }}
                      title="叫出手機系統分享 sheet（FB／FB 群組／WhatsApp／Telegram／Messenger…任選）"
                    >
                      <Share2 className="w-3 h-3" />
                      系統分享
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className={`flex-1 h-7 text-xs gap-1 ${isCopied ? "border-green-400 text-green-600 bg-green-50" : "border-amber-300 text-amber-700 hover:bg-amber-50"}`}
                      onClick={async () => {
                        const fullText = `${shareText}\n${productUrl}`;
                        await navigator.clipboard.writeText(fullText);
                        setProductCopiedIds(prev => new Set([...prev, p.id]));
                        const preview = fullText.length > 180 ? fullText.slice(0, 180) + "…" : fullText;
                        toast.success("已複製！貼入群組帖子即可", { description: preview, duration: 5000 });
                        setTimeout(() => setProductCopiedIds(prev => { const n = new Set(prev); n.delete(p.id); return n; }), 3000);
                      }}
                    >
                      {isCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      {isCopied ? "已複製！" : "複製文字"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* AI 旁白稿 Dialog */}
      <Dialog open={!!aiScriptDialog} onOpenChange={(v) => { if (!v) setAiScriptDialog(null); }}>
        <DialogContent className="max-w-md max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-pink-700">
              <Mic className="w-5 h-5" /> AI 旁白稿
            </DialogTitle>
          </DialogHeader>
          {aiScriptDialog && (
            <>
              <p className="text-xs text-muted-foreground -mt-1">{aiScriptDialog.title}</p>
              <Textarea
                value={aiScriptDialog.text}
                onChange={(e) => setAiScriptDialog(prev => prev ? { ...prev, text: e.target.value } : null)}
                rows={14}
                className="text-sm font-mono"
              />
              <div className="flex gap-2">
                <Button
                  className="flex-1 bg-pink-600 hover:bg-pink-700 text-white"
                  onClick={async () => {
                    if (!aiScriptDialog) return;
                    await navigator.clipboard.writeText(aiScriptDialog.text);
                    toast.success("旁白稿已複製！");
                  }}
                >
                  <Copy className="w-4 h-4 mr-1" /> 複製旁白稿
                </Button>
                <Button variant="outline" onClick={() => setAiScriptDialog(null)}>關閉</Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
