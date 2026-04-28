import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import AdminHeader from "@/components/AdminHeader";
import { toast } from "sonner";
import {
  ShoppingBag, CheckCircle2, XCircle, Clock, AlertTriangle, Phone,
  ChevronLeft, User, Store,
} from "lucide-react";
import { Link } from "wouter";

const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: "待確認", confirmed: "已成交", cancelled: "已取消",
};
const ORDER_STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  confirmed: "bg-green-100 text-green-700",
  cancelled: "bg-gray-100 text-gray-500",
};

function CancelDialog({ order, onClose, onConfirm, isPending }: {
  order: any; onClose: () => void; onConfirm: (reason: string) => void; isPending: boolean;
}) {
  const [reason, setReason] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-4" onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-base">取消訂單（管理員）</h3>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm space-y-1">
          <p className="font-medium">{order.title}</p>
          <p className="text-xs text-gray-500">
            商戶：{order.merchantName ?? order.merchantDisplayName ?? `#${order.merchantId}`}
            ｜買家：{order.buyerDisplayName ?? `#${order.buyerId}`}
          </p>
          <p className="text-xs text-amber-700 font-bold">
            {order.currency} ${(parseFloat(String(order.price)) * parseInt(String(order.quantity))).toLocaleString()}
          </p>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-600">取消原因（選填）</label>
          <input
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
            placeholder="請輸入原因…"
            value={reason}
            onChange={e => setReason(e.target.value)}
          />
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 rounded-xl py-2 text-sm">返回</button>
          <button
            onClick={() => onConfirm(reason)}
            disabled={isPending}
            className="flex-1 bg-red-500 hover:bg-red-600 text-white rounded-xl py-2 text-sm font-semibold disabled:opacity-60"
          >
            {isPending ? "處理中…" : "確認取消"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmDialog({ order, onClose, onConfirm, isPending }: {
  order: any; onClose: () => void; onConfirm: (finalPrice?: number) => void; isPending: boolean;
}) {
  const listedPrice = parseFloat(String(order.price));
  const qty = parseInt(String(order.quantity));
  const [finalPriceInput, setFinalPriceInput] = useState("");
  const finalPrice = finalPriceInput ? parseFloat(finalPriceInput) : undefined;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-4" onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-base">代商戶確認成交</h3>
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm space-y-1">
          <p className="font-medium">{order.title}</p>
          <p className="text-xs text-gray-500">
            商戶：{order.merchantName ?? order.merchantDisplayName ?? `#${order.merchantId}`}
            ｜買家：{order.buyerDisplayName ?? `#${order.buyerId}`}
          </p>
          <p className="text-xs text-green-700 font-bold">
            標價 {order.currency} ${listedPrice.toLocaleString()} × {qty} = ${(listedPrice * qty).toLocaleString()}
          </p>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-600">
            實際成交單價（選填，留空用標價 ${listedPrice.toLocaleString()}）
          </label>
          <input
            type="number"
            min="0"
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-300"
            placeholder={`${listedPrice}`}
            value={finalPriceInput}
            onChange={e => setFinalPriceInput(e.target.value)}
          />
          {finalPrice && finalPrice > 0 && (
            <p className="text-xs text-green-600">
              合計：{order.currency} ${(finalPrice * qty).toLocaleString()}
              ｜傭金率：{(parseFloat(String(order.commissionRate)) * 100).toFixed(1)}%
              ｜傭金：${(finalPrice * qty * parseFloat(String(order.commissionRate))).toFixed(2)}
            </p>
          )}
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 rounded-xl py-2 text-sm">返回</button>
          <button
            onClick={() => onConfirm(finalPrice)}
            disabled={isPending}
            className="flex-1 bg-green-500 hover:bg-green-600 text-white rounded-xl py-2 text-sm font-semibold disabled:opacity-60"
          >
            {isPending ? "處理中…" : "確認成交"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminProductOrders() {
  const { user, isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const [statusFilter, setStatusFilter] = useState("pending");
  const [cancelDialog, setCancelDialog] = useState<any | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<any | null>(null);

  const { data: siteSettings = {} } = trpc.siteSettings.getAll.useQuery();
  const largeOrderThreshold = parseFloat((siteSettings as any).largeOrderCancelThreshold ?? "5000");
  const overdueDays = parseInt((siteSettings as any).largeOrderPendingDays ?? "7", 10);

  const { data: orders = [], isLoading, error } = trpc.productOrders.adminList.useQuery(
    { status: statusFilter },
    { enabled: isAuthenticated && user?.role === "admin" }
  );

  const cancelMut = trpc.productOrders.cancel.useMutation({
    onSuccess: () => { toast.success("訂單已取消"); utils.productOrders.adminList.invalidate(); setCancelDialog(null); },
    onError: e => toast.error(e.message),
  });
  const confirmMut = trpc.productOrders.adminConfirm.useMutation({
    onSuccess: () => { toast.success("已確認成交，傭金已扣除"); utils.productOrders.adminList.invalidate(); setConfirmDialog(null); },
    onError: e => toast.error(e.message),
  });

  if (!isAuthenticated || user?.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400">無訪問權限</p>
      </div>
    );
  }

  const orderList = orders as any[];
  const pendingCount = orderList.filter(o => o.status === "pending").length;
  const overdueCount = orderList.filter(o => o.status === "pending" && parseInt(String(o.pendingDays ?? 0), 10) >= overdueDays).length;
  const largeOrderCount = orderList.filter(o => o.status === "pending" && parseFloat(String(o.price)) * parseInt(String(o.quantity)) >= largeOrderThreshold).length;

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader />
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        <div className="flex items-center gap-3">
          <Link href="/admin">
            <button className="p-2 rounded-xl hover:bg-gray-100"><ChevronLeft className="w-5 h-5" /></button>
          </Link>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-amber-600" />
              商品訂單管理
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">管理員可取消任何訂單、代商戶確認成交</p>
          </div>
        </div>

        {statusFilter === "pending" && (pendingCount > 0 || overdueCount > 0 || largeOrderCount > 0) && (
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-center">
              <p className="text-2xl font-bold text-amber-600">{pendingCount}</p>
              <p className="text-xs text-amber-500">待確認</p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-2xl p-3 text-center">
              <p className="text-2xl font-bold text-red-500">{overdueCount}</p>
              <p className="text-xs text-red-400">已逾期 {overdueDays}+ 天</p>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-2xl p-3 text-center">
              <p className="text-2xl font-bold text-orange-600">{largeOrderCount}</p>
              <p className="text-xs text-orange-400">大額訂單</p>
            </div>
          </div>
        )}

        <div className="flex gap-2 flex-wrap">
          {["pending", "confirmed", "cancelled", "all"].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${statusFilter === s ? "bg-amber-500 text-white" : "bg-white border border-amber-200 text-amber-700 hover:bg-amber-50"}`}>
              {s === "pending" ? "待確認" : s === "confirmed" ? "已成交" : s === "cancelled" ? "已取消" : "全部"}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="text-center py-16 text-2xl animate-spin">💰</div>
        ) : error ? (
          <div className="text-center py-16 text-red-400 text-sm">載入失敗：{error.message}</div>
        ) : orderList.length === 0 ? (
          <div className="text-center py-16">
            <ShoppingBag className="w-12 h-12 text-amber-100 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">暫無訂單</p>
          </div>
        ) : (
          <div className="space-y-3">
            {orderList.map(o => {
              const price = parseFloat(String(o.price));
              const qty = parseInt(String(o.quantity));
              const orderTotal = price * qty;
              const commission = parseFloat(String(o.commissionAmount ?? 0));
              const finalPrice = o.finalPrice != null ? parseFloat(String(o.finalPrice)) : null;
              const d = new Date(o.createdAt);
              const pendingDays = parseInt(String(o.pendingDays ?? 0), 10);
              const isLargeOrder = orderTotal >= largeOrderThreshold;
              const isOverdue = o.status === "pending" && pendingDays >= overdueDays;

              return (
                <div key={o.id} className={`bg-white rounded-2xl border p-4 space-y-3 ${isLargeOrder && o.status === "pending" ? "border-orange-300 ring-1 ring-orange-200" : isOverdue ? "border-red-200" : "border-gray-100"}`}>
                  {isLargeOrder && o.status === "pending" && (
                    <div className="flex items-center gap-1.5 bg-orange-50 border border-orange-200 rounded-xl px-3 py-1.5 text-xs text-orange-700 font-medium">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      大額訂單（${orderTotal.toLocaleString()} ≥ 門檻 ${largeOrderThreshold.toLocaleString()}）— 商戶無法自行取消
                    </div>
                  )}
                  {isOverdue && (
                    <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-xl px-3 py-1.5 text-xs text-red-600 font-medium">
                      <Clock className="w-3.5 h-3.5" />
                      已逾期 {pendingDays} 天待確認
                    </div>
                  )}

                  <div className="flex items-start gap-3">
                    {(() => {
                      const imgs: string[] = (() => { try { return o.productImages ? JSON.parse(o.productImages) : []; } catch { return []; } })();
                      return imgs[0] ? (
                        <img src={imgs[0]} alt={o.title} className="w-14 h-14 rounded-xl object-cover shrink-0 border border-gray-100" />
                      ) : (
                        <div className="w-14 h-14 rounded-xl bg-amber-50 flex items-center justify-center shrink-0 border border-amber-100">
                          <ShoppingBag className="w-6 h-6 text-amber-200" />
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
                        訂單 #{o.id}｜{d.getFullYear()}/{String(d.getMonth()+1).padStart(2,"0")}/{String(d.getDate()).padStart(2,"0")} {String(d.getHours()).padStart(2,"0")}:{String(d.getMinutes()).padStart(2,"0")}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs bg-gray-50 rounded-xl p-2.5">
                    <div className="flex items-center gap-1">
                      <Store className="w-3.5 h-3.5 text-gray-400" />
                      <span className="text-gray-500">商戶：</span>
                      <span className="font-medium">{o.merchantName ?? o.merchantDisplayName ?? `#${o.merchantId}`}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-gray-400" />
                      <span className="text-gray-500">買家：</span>
                      <span className="font-medium">{o.buyerDisplayName ?? `#${o.buyerId}`}</span>
                    </div>
                    {o.merchantPhone && (
                      <div className="flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5 text-gray-400" />
                        <span className="text-gray-500">商戶電話：</span>
                        <a href={`https://wa.me/${o.merchantPhone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="font-medium text-green-600 underline">{o.merchantPhone}</a>
                      </div>
                    )}
                    {(o.buyerPhoneFromUser ?? o.buyerPhone) && (
                      <div className="flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5 text-gray-400" />
                        <span className="text-gray-500">買家電話：</span>
                        <a href={`https://wa.me/${(o.buyerPhoneFromUser ?? o.buyerPhone ?? '').replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="font-medium text-green-600 underline">{o.buyerPhoneFromUser ?? o.buyerPhone}</a>
                      </div>
                    )}
                    <div>
                      <span className="text-gray-500">金額：</span>
                      <span className={`font-bold ml-1 ${finalPrice != null ? "text-gray-400 line-through" : "text-amber-600"}`}>
                        {o.currency} ${price.toLocaleString()} × {qty} = ${orderTotal.toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">傭金率：</span>
                      <span className="font-medium ml-1">{(parseFloat(String(o.commissionRate)) * 100).toFixed(1)}%</span>
                    </div>
                    {finalPrice != null && (
                      <div className="col-span-2 bg-green-50 rounded-lg px-2 py-1">
                        <span className="text-green-600">實際成交：</span>
                        <span className="font-bold text-green-700 ml-1">{o.currency} ${finalPrice.toLocaleString()} × {qty} = ${(finalPrice * qty).toLocaleString()}</span>
                      </div>
                    )}
                    {o.status !== "pending" && commission > 0 && (
                      <div>
                        <span className="text-gray-500">傭金：</span>
                        <span className="font-medium text-red-500 ml-1">{o.currency} ${commission.toFixed(2)}</span>
                      </div>
                    )}
                  </div>

                  {o.buyerNote && (
                    <p className="text-xs text-gray-500 bg-amber-50 rounded-lg px-2.5 py-1.5">備注：{o.buyerNote}</p>
                  )}
                  {o.cancelReason && (
                    <p className="text-xs text-gray-400 bg-red-50 rounded-lg px-2.5 py-1.5">取消原因：{o.cancelReason}</p>
                  )}

                  {o.status === "pending" && (
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => setConfirmDialog(o)}
                        disabled={confirmMut.isPending || cancelMut.isPending}
                        className="flex-1 flex items-center justify-center gap-1.5 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold py-2 rounded-xl transition-colors disabled:opacity-60"
                      >
                        <CheckCircle2 className="w-4 h-4" />代商戶確認
                      </button>
                      <button
                        onClick={() => setCancelDialog(o)}
                        disabled={confirmMut.isPending || cancelMut.isPending}
                        className="flex-1 flex items-center justify-center gap-1.5 border border-red-200 text-red-500 text-sm font-medium py-2 rounded-xl hover:bg-red-50 transition-colors disabled:opacity-60"
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
      </div>

      {cancelDialog && (
        <CancelDialog
          order={cancelDialog}
          onClose={() => setCancelDialog(null)}
          onConfirm={reason => cancelMut.mutate({ orderId: cancelDialog.id, reason: reason || "管理員取消" })}
          isPending={cancelMut.isPending}
        />
      )}
      {confirmDialog && (
        <ConfirmDialog
          order={confirmDialog}
          onClose={() => setConfirmDialog(null)}
          onConfirm={finalPrice => confirmMut.mutate({ orderId: confirmDialog.id, finalPrice })}
          isPending={confirmMut.isPending}
        />
      )}
    </div>
  );
}
