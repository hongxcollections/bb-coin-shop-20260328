import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Gavel, CheckCircle2, XCircle, Clock, ImageIcon } from "lucide-react";

const STATUS_LABELS: Record<string, string> = { pending: "待確認", confirmed: "已確認", cancelled: "已取消" };
const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  confirmed: "bg-green-100 text-green-700",
  cancelled: "bg-gray-100 text-gray-500",
};

function ConfirmDialog({ row, type, onClose, onConfirm, isPending }: {
  row: any;
  type: "confirm" | "cancel";
  onClose: () => void;
  onConfirm: (finalPrice?: number, reason?: string) => void;
  isPending: boolean;
}) {
  const winningPrice = parseFloat(String(row.currentPrice ?? 0));
  const [finalPrice, setFinalPrice] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4 pb-24 sm:pb-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden my-auto">
        <div className={`px-5 py-4 text-white ${type === "confirm" ? "bg-green-500" : "bg-rose-500"}`}>
          <h2 className="font-bold text-base">{type === "confirm" ? "確認交收完成" : "取消拍賣訂單"}</h2>
          <p className="text-xs opacity-90 mt-0.5 line-clamp-2">{row.title}</p>
        </div>
        <div className="p-5 space-y-3">
          <div className="bg-gray-50 rounded-xl p-3 text-xs space-y-1">
            <div><span className="text-gray-400">買家：</span><span className="font-medium">{row.buyerName ?? "—"}</span></div>
            <div><span className="text-gray-400">得標價：</span><span className="font-bold text-amber-600">{row.currency} ${winningPrice.toLocaleString()}</span></div>
          </div>
          {type === "confirm" ? (
            <div>
              <label className="text-xs text-gray-600 block mb-1">實際成交價（可選，唔填即用得標價）</label>
              <input
                type="number" min="0" step="0.01"
                value={finalPrice}
                onChange={(e) => setFinalPrice(e.target.value)}
                placeholder={String(winningPrice)}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm"
              />
            </div>
          ) : (
            <div>
              <label className="text-xs text-gray-600 block mb-1">取消原因（可選）</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="例如：買家失聯 / 議價失敗"
                rows={2}
                maxLength={200}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm resize-none"
              />
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <button
              onClick={onClose}
              disabled={isPending}
              className="flex-1 py-2 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 disabled:opacity-60"
            >返回</button>
            <button
              onClick={() => {
                if (type === "confirm") {
                  const fp = finalPrice.trim() ? parseFloat(finalPrice) : undefined;
                  if (fp != null && (Number.isNaN(fp) || fp <= 0)) { toast.error("實際成交價不正確"); return; }
                  onConfirm(fp, undefined);
                } else {
                  onConfirm(undefined, reason.trim() || undefined);
                }
              }}
              disabled={isPending}
              className={`flex-1 py-2 rounded-xl text-white text-sm font-semibold disabled:opacity-60 ${type === "confirm" ? "bg-green-500 hover:bg-green-600" : "bg-rose-500 hover:bg-rose-600"}`}
            >{isPending ? "處理中…" : (type === "confirm" ? "確認交收" : "確定取消")}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function MerchantAuctionOrdersTab() {
  const utils = trpc.useUtils();
  const [statusFilter, setStatusFilter] = useState<"pending" | "confirmed" | "cancelled">("pending");
  const { data: orders = [], isLoading, error } = trpc.auctionOrders.myMerchant.useQuery({ status: statusFilter });
  const { data: counts = { pending: 0, confirmed: 0, cancelled: 0 } } = trpc.auctionOrders.myMerchantStatusCounts.useQuery(undefined, { staleTime: 15_000 }) as any;
  const [actionDialog, setActionDialog] = useState<{ row: any; type: "confirm" | "cancel" } | null>(null);

  const confirm = trpc.auctionOrders.confirm.useMutation({
    onSuccess: () => {
      toast.success("已確認交收");
      utils.auctionOrders.myMerchant.invalidate();
      utils.auctionOrders.myPendingCount.invalidate();
      utils.auctionOrders.myMerchantStatusCounts.invalidate();
      setActionDialog(null);
    },
    onError: (e) => toast.error(e.message),
  });
  const cancel = trpc.auctionOrders.cancel.useMutation({
    onSuccess: () => {
      toast.success("拍賣訂單已取消");
      utils.auctionOrders.myMerchant.invalidate();
      utils.auctionOrders.myPendingCount.invalidate();
      utils.auctionOrders.myMerchantStatusCounts.invalidate();
      setActionDialog(null);
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(["pending", "confirmed", "cancelled"] as const).map(s => {
          const label = s === "pending" ? "待確認" : s === "confirmed" ? "已確認" : "已取消";
          const c = (counts as any)[s] ?? 0;
          return (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1 ${statusFilter === s ? "bg-amber-500 text-white" : "bg-white border border-amber-200 text-amber-700 hover:bg-amber-50"}`}>
              {label}
              <span className={`min-w-[18px] h-4 px-1 rounded-full text-[10px] font-bold flex items-center justify-center ${statusFilter === s ? "bg-white/30 text-white" : "bg-amber-100 text-amber-700"}`}>{c}</span>
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="text-center py-10 text-2xl animate-spin">💰</div>
      ) : error ? (
        <div className="text-center py-16">
          <Gavel className="w-12 h-12 text-red-200 mx-auto mb-3" />
          <p className="text-red-400 text-sm">載入失敗：{error.message}</p>
        </div>
      ) : (orders as any[]).length === 0 ? (
        <div className="text-center py-16">
          <Gavel className="w-12 h-12 text-amber-200 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">暫無拍賣訂單</p>
        </div>
      ) : (
        <div className="space-y-3">
          {(orders as any[]).map((o) => {
            const winningPrice = parseFloat(String(o.currentPrice ?? 0));
            const finalPrice = o.finalPrice != null ? parseFloat(String(o.finalPrice)) : null;
            const d = new Date(o.endTime);
            const pendingDays = parseInt(String(o.pendingDays ?? 0), 10);
            const isOverdue = o.status === "pending" && pendingDays >= 7;
            return (
              <div key={o.auctionId} className={`bg-white rounded-2xl border p-4 space-y-2.5 ${o.status === "pending" ? "border-amber-200" : "border-gray-100"}`}>
                {isOverdue && (
                  <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-xs text-red-700 font-medium">
                    <Clock className="w-3.5 h-3.5" />
                    <span>拍賣訂單待確認已超過 {pendingDays} 天，請盡快處理</span>
                  </div>
                )}
                <div className="flex items-start gap-3">
                  {o.thumbUrl ? (
                    <img src={o.thumbUrl} alt={o.title} className="w-16 h-16 rounded-xl object-cover shrink-0 border border-gray-100" />
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-amber-50 flex items-center justify-center shrink-0 border border-amber-100">
                      <ImageIcon className="w-7 h-7 text-amber-200" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <Link href={`/auctions/${o.auctionId}`}>
                        <a className="font-semibold text-sm text-amber-700 hover:underline line-clamp-2 flex items-center gap-1.5">
                          <Gavel className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          {o.title}
                        </a>
                      </Link>
                      <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${STATUS_COLORS[o.status] ?? ""}`}>
                        {STATUS_LABELS[o.status] ?? o.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      結束於 {d.getFullYear()}/{String(d.getMonth()+1).padStart(2,"0")}/{String(d.getDate()).padStart(2,"0")} {String(d.getHours()).padStart(2,"0")}:{String(d.getMinutes()).padStart(2,"0")}
                    </p>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-xl p-2.5 grid grid-cols-2 gap-1.5 text-xs">
                  <div>
                    <span className="text-gray-400">得標價</span>
                    <span className={`ml-1 font-bold ${finalPrice != null ? "text-gray-400 line-through" : "text-amber-600"}`}>
                      {o.currency} ${winningPrice.toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400">買家</span>
                    <span className="ml-1 font-medium">{o.buyerName ?? "—"}</span>
                  </div>
                  {finalPrice != null && (
                    <div className="col-span-2 bg-green-50 rounded-lg px-2 py-1">
                      <span className="text-green-600">實際成交</span>
                      <span className="ml-1 font-bold text-green-700">{o.currency} ${finalPrice.toLocaleString()}</span>
                    </div>
                  )}
                  {o.buyerPhone && (
                    <div className="col-span-2 flex items-center gap-1">
                      <span className="text-gray-400">電話</span>
                      <span className="ml-1 font-medium">{o.buyerPhone}</span>
                      <a
                        href={`https://wa.me/${String(o.buyerPhone).replace(/[^0-9]/g, '')}`}
                        target="_blank" rel="noopener noreferrer"
                        className="ml-1"
                        title="WhatsApp 聯絡買家"
                      >
                        <svg viewBox="0 0 32 32" className="w-4 h-4" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <circle cx="16" cy="16" r="16" fill="#25D366"/>
                          <path d="M22.5 9.5A8.93 8.93 0 0 0 16 7C11.03 7 7 11.03 7 16c0 1.59.42 3.14 1.21 4.5L7 25l4.62-1.21A8.96 8.96 0 0 0 16 25c4.97 0 9-4.03 9-9 0-2.4-.94-4.66-2.5-6.5Z" fill="white"/>
                        </svg>
                      </a>
                    </div>
                  )}
                </div>

                {o.status === "pending" && (
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => setActionDialog({ row: o, type: "confirm" })}
                      disabled={confirm.isPending || cancel.isPending}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold py-2 rounded-xl transition-colors disabled:opacity-60"
                    >
                      <CheckCircle2 className="w-4 h-4" />確認交收
                    </button>
                    <button
                      onClick={() => setActionDialog({ row: o, type: "cancel" })}
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
                    確認於 {new Date(o.confirmedAt).toLocaleDateString("zh-HK")}
                  </p>
                )}
                {o.status === "cancelled" && (
                  <p className="text-xs text-gray-500">
                    已取消{o.cancelledAt ? `於 ${new Date(o.cancelledAt).toLocaleDateString("zh-HK")}` : ""}
                    {o.cancelReason ? ` · ${o.cancelReason}` : ""}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {actionDialog && (
        <ConfirmDialog
          row={actionDialog.row}
          type={actionDialog.type}
          onClose={() => setActionDialog(null)}
          onConfirm={(fp, reason) => {
            if (actionDialog.type === "confirm") confirm.mutate({ auctionId: actionDialog.row.auctionId, finalPrice: fp });
            else cancel.mutate({ auctionId: actionDialog.row.auctionId, reason });
          }}
          isPending={confirm.isPending || cancel.isPending}
        />
      )}
    </div>
  );
}
