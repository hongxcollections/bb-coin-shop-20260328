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
import { toast } from "sonner";
import {
  ChevronLeft, Plus, Package, Pencil, Trash2, Eye, EyeOff,
  ImageIcon, X, Loader2, LayoutList, LayoutGrid, Grid3X3, Maximize2,
  ShoppingBag, CheckCircle2, XCircle, Clock, Flame, RotateCcw, Tag,
} from "lucide-react";
import { parseCategories } from "@/lib/categories";

type LayoutMode = "list" | "grid2" | "grid3" | "big";
const STATUS_LABELS: Record<string, string> = { active: "上架中", sold: "已售出", hidden: "已下架" };
const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  sold: "bg-gray-100 text-gray-500",
  hidden: "bg-yellow-100 text-yellow-700",
};

interface ProductForm {
  title: string;
  description: string;
  price: string;
  currency: string;
  categories: string[];
  stock: string;
  images: string[];
}

const EMPTY_FORM: ProductForm = {
  title: "", description: "", price: "", currency: "HKD", categories: [], stock: "1", images: [],
};

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
  order: any; type: "confirm" | "cancel"; onClose: () => void; onConfirm: (finalPrice?: number) => void; isPending: boolean;
}) {
  const listedPrice = parseFloat(String(order.price));
  const qty = parseInt(String(order.quantity));
  const commissionRate = parseFloat(String(order.commissionRate));
  const imgs: string[] = (() => { try { return order.productImages ? JSON.parse(order.productImages) : []; } catch { return []; } })();
  const isConfirm = type === "confirm";

  const [finalPriceInput, setFinalPriceInput] = useState("");
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
          <p className="text-sm text-gray-500">確定取消此訂單？取消後不會扣除傭金。</p>
        )}

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-500 text-sm font-medium hover:bg-gray-50">返回</button>
          <button
            onClick={() => onConfirm(isConfirm && finalPrice != null && finalPrice > 0 ? finalPrice : undefined)}
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

function MerchantOrdersTab() {
  const utils = trpc.useUtils();
  const [statusFilter, setStatusFilter] = useState("pending");
  const { data: orders = [], isLoading, error: ordersError } = trpc.productOrders.myMerchantOrders.useQuery({ status: statusFilter });
  const [actionDialog, setActionDialog] = useState<{ order: any; type: "confirm" | "cancel" } | null>(null);

  const confirm = trpc.productOrders.confirm.useMutation({
    onSuccess: () => { toast.success("已確認成交，傭金已從保證金扣除"); utils.productOrders.myMerchantOrders.invalidate(); setActionDialog(null); },
    onError: (e) => toast.error(e.message),
  });
  const cancel = trpc.productOrders.cancel.useMutation({
    onSuccess: () => { toast.success("訂單已取消"); utils.productOrders.myMerchantOrders.invalidate(); setActionDialog(null); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {["pending", "confirmed", "cancelled", "all"].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${statusFilter === s ? "bg-amber-500 text-white" : "bg-white border border-amber-200 text-amber-700 hover:bg-amber-50"}`}>
            {s === "pending" ? "待確認" : s === "confirmed" ? "已成交" : s === "cancelled" ? "已取消" : "全部"}
          </button>
        ))}
      </div>

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
            return (
              <div key={o.id} className="bg-white rounded-2xl border border-gray-100 p-4 space-y-2.5">
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
                      <p className="font-semibold text-sm text-gray-800 line-clamp-2">{o.title}</p>
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

                {o.status === "pending" && (
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => setActionDialog({ order: o, type: "confirm" })}
                      disabled={confirm.isPending || cancel.isPending}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold py-2 rounded-xl transition-colors disabled:opacity-60"
                    >
                      <CheckCircle2 className="w-4 h-4" />確認成交
                    </button>
                    <button
                      onClick={() => setActionDialog({ order: o, type: "cancel" })}
                      disabled={confirm.isPending || cancel.isPending}
                      className="flex-1 flex items-center justify-center gap-1.5 border border-gray-200 text-gray-500 text-sm font-medium py-2 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-60"
                    >
                      <XCircle className="w-4 h-4" />取消訂單
                    </button>
                  </div>
                )}
                {o.status === "confirmed" && o.confirmedAt && (
                  <p className="text-xs text-green-600 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    成交於 {new Date(o.confirmedAt).toLocaleDateString("zh-HK")}
                  </p>
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
          onConfirm={(finalPrice) => {
            if (actionDialog.type === "confirm") confirm.mutate({ orderId: actionDialog.order.id, finalPrice });
            else cancel.mutate({ orderId: actionDialog.order.id, reason: "商戶取消" });
          }}
          isPending={confirm.isPending || cancel.isPending}
        />
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
              <p className="text-xs text-gray-500">主打位額滿（{slotStatus?.maxSlots} 個），當有位置空出時系統將自動升級啟動並扣費。排隊期間<strong>不收費</strong>，可隨時免費取消。</p>
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
              <span>{isFull ? '⚠️ 主打位已額滿，申請後免費排隊，輪到時才扣費' : `✅ 尚有 ${slotsLeft} 個空位，立即生效`}</span>
              <span className="font-semibold">{slotStatus.active}/{slotStatus.maxSlots} 位</span>
            </div>
          )}
          {slotStatus && slotStatus.queued > 0 && (
            <p className="text-xs text-gray-400 -mt-1">目前排隊等候：{slotStatus.queued} 個</p>
          )}
          <p className="text-xs text-gray-500">{isFull ? '排隊期間不扣費，輪到時才從保證金扣除。' : '費用立即從保證金扣除。'}目前餘額：<span className="font-semibold text-gray-700">HK${depositBalance.toFixed(2)}</span></p>
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
              {isFull ? '排隊申請' : '確認申請'}
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
  const [form, setForm] = useState<ProductForm>(EMPTY_FORM);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; title: string; img?: string; price?: number; currency?: string } | null>(null);
  const [layout, setLayout] = useState<LayoutMode>(() => {
    return (localStorage.getItem("mp_layout") as LayoutMode) ?? "list";
  });
  const [productTab, setProductTab] = useState<"all" | "active" | "hidden" | "sold">("all");

  const { data: products = [], isLoading } = trpc.merchants.myProducts.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const displayProducts = productTab === "all"
    ? (products as any[])
    : (products as any[]).filter((p: any) => p.status === productTab);

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

  // 主打刊登
  const [featuredDialog, setFeaturedDialog] = useState<{ id: number; title: string; price: number; currency: string } | null>(null);
  const [cancelQueueTarget, setCancelQueueTarget] = useState<{ id: number; productTitle: string } | null>(null);
  const { data: myDeposit } = trpc.sellerDeposits.myDeposit.useQuery(undefined, { enabled: isAuthenticated });
  const { data: myFeatured = [] } = trpc.featuredListings.myListings.useQuery(undefined, { enabled: isAuthenticated, staleTime: 30_000 });
  const activeFeaturedIds = new Set(
    (myFeatured as any[]).filter((f: any) => f.status === 'active').map((f: any) => f.productId)
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
      images: imgs,
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

    setUploading(true);
    try {
      const results = await Promise.all(
        toUpload.map(async (file) => {
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve((reader.result as string).split(",")[1]);
            reader.onerror = () => reject(new Error("讀取圖片失敗"));
            reader.readAsDataURL(file);
          });
          const { url } = await uploadImage.mutateAsync({ imageData: base64, fileName: file.name, mimeType: file.type || "image/jpeg" });
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
  }, [form.images.length, uploadImage]);

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) handleImageUpload(files);
  }

  function handleSubmit() {
    if (!form.title.trim()) return toast.error("請輸入商品名稱");
    const price = parseFloat(form.price);
    if (isNaN(price) || price <= 0) return toast.error("請輸入有效售價");
    const stock = parseInt(form.stock);
    if (isNaN(stock) || stock < 0) return toast.error("請輸入有效庫存量");
    if (form.images.length === 0) return toast.error("請最少上傳一幅商品圖片");
    if (form.categories.length === 0) return toast.error("請至少選擇一個商品分類");
    // 編輯時直接提交，新增時才顯示確認彈窗
    if (editingId) { doSubmit(); } else { setConfirmOpen(true); }
  }

  async function doSubmit() {
    const price = parseFloat(form.price);
    const stock = parseInt(form.stock);
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      price,
      currency: form.currency,
      category: form.categories.length > 0 ? form.categories.join("|") : undefined,
      images: form.images.length > 0 ? JSON.stringify(form.images) : undefined,
      stock,
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
    await updateStatus.mutateAsync({ id: p.id, status: "sold" });
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
      <div className="max-w-lg mx-auto px-4 pt-4 pb-28 space-y-4">
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
              onClick={() => { setEditingId(null); setForm(EMPTY_FORM); setShowForm(true); setTimeout(() => document.getElementById("product-form")?.scrollIntoView({ behavior: "smooth" }), 100); }}
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

            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={resetForm} disabled={saving || uploading}>取消</Button>
              <Button className="flex-1 bg-green-600 hover:bg-green-700 text-white" onClick={handleSubmit} disabled={saving || uploading}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : (editingId ? "儲存修改" : "確認上架")}
              </Button>
            </div>
          </div>
        )}

        {/* 狀態篩選 Tabs */}
        {!isLoading && (products as any[]).length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: "none" }}>
            {([
              { key: "all", label: "全部", count: (products as any[]).length },
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
                        <div className="flex items-center gap-1">
                          <span className="text-[11px] text-amber-600 font-medium">⏳ 排隊第 {queued.queuePosition} 位</span>
                          <button onClick={() => setCancelQueueTarget({ id: queued.id, productTitle: p.title })} className="text-red-400 hover:text-red-600 transition-colors p-0.5" title="取消排隊（免費）"><X className="w-3 h-3" /></button>
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
                        if (queued) return <span className="flex items-center gap-1 text-xs"><span className="px-2 py-1 bg-amber-50 text-amber-600 rounded-lg font-medium">⏳ 第{queued.queuePosition}位</span><button onClick={() => setCancelQueueTarget({ id: queued.id, productTitle: p.title })} className="px-1 text-red-400 hover:text-red-600" title="取消排隊（免費）"><X className="w-3 h-3" /></button></span>;
                        return <button onClick={() => setFeaturedDialog({ id: p.id, title: p.title, price: parseFloat(p.price ?? '0'), currency: p.currency ?? 'HKD' })} className="flex items-center gap-1 text-xs px-2 py-1.5 text-orange-500 border border-orange-200 rounded-lg hover:bg-orange-50 transition-colors font-medium"><Flame className="w-3 h-3" />申請主打</button>;
                      })()}
                      <button onClick={() => setDeleteTarget({ id: p.id, title: p.title, img: imgs[0], price: parseFloat(p.price ?? "0"), currency: p.currency ?? "HKD" })} className="flex items-center gap-1 text-xs px-3 py-1.5 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition-colors">
                        <Trash2 className="w-3 h-3" />刪除
                      </button>
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
                        if (queued) return <span className="flex items-center gap-0.5 text-[10px]"><span className="px-1.5 py-1 bg-amber-50 text-amber-600 rounded-lg">⏳{queued.queuePosition}</span><button onClick={() => setCancelQueueTarget({ id: queued.id, productTitle: p.title })} className="text-red-400 hover:text-red-600" title="取消排隊（免費）"><X className="w-2.5 h-2.5" /></button></span>;
                        return <button onClick={() => setFeaturedDialog({ id: p.id, title: p.title, price: parseFloat(p.price ?? '0'), currency: p.currency ?? 'HKD' })} className="text-[10px] px-1.5 py-1 text-orange-500 border border-orange-200 rounded-lg hover:bg-orange-50 transition-colors"><Flame className="w-3 h-3" /></button>;
                      })()}
                      <button onClick={() => setDeleteTarget({ id: p.id, title: p.title, img: imgs[0], price: parseFloat(p.price ?? "0"), currency: p.currency ?? "HKD" })} className="text-[10px] px-1.5 py-1 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition-colors">
                        <Trash2 className="w-3 h-3" />
                      </button>
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
                        if (queued) return <span className="flex items-center gap-0.5 text-[9px]"><span className="px-1 py-0.5 bg-amber-50 text-amber-600 rounded">⏳{queued.queuePosition}</span><button onClick={() => setCancelQueueTarget({ id: queued.id, productTitle: p.title })} className="text-red-400 hover:text-red-600" title="取消排隊（免費）"><X className="w-2 h-2" /></button></span>;
                        return <button onClick={() => setFeaturedDialog({ id: p.id, title: p.title, price: parseFloat(p.price ?? '0'), currency: p.currency ?? 'HKD' })} className="text-[9px] px-1 py-0.5 text-orange-500 border border-orange-200 rounded hover:bg-orange-50 transition-colors"><Flame className="w-2.5 h-2.5" /></button>;
                      })()}
                      <button onClick={() => setDeleteTarget({ id: p.id, title: p.title, img: imgs[0], price: parseFloat(p.price ?? "0"), currency: p.currency ?? "HKD" })} className="text-[9px] px-1 py-0.5 bg-red-50 text-red-500 rounded hover:bg-red-100 transition-colors">
                        <Trash2 className="w-2.5 h-2.5" />
                      </button>
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
                  const quotaOk = !quotaInfo || quotaInfo.unlimited || (remaining !== null && remaining >= 1);
                  const isError = !depositCheck?.canList || !quotaOk;
                  let quotaLabel = "";
                  if (quotaLoading) {
                    quotaLabel = "查詢額度中…";
                  } else if (!quotaInfo || quotaInfo.unlimited) {
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
              disabled={saving || !depositCheck?.canList || (!!quotaInfo && !quotaInfo.unlimited && Number(quotaInfo.remainingQuota) < 1)}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />上架中…</> : "確認上架"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
                排隊期間<strong>不收費</strong>，取消後免費退出，不會扣除任何保證金。
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
    </div>
  );
}
