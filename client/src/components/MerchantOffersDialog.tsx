import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tag, Loader2, CheckCircle2, XCircle, Clock, ShoppingBag, Trash2 } from "lucide-react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface MerchantOffersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MEMBER_LABELS: Record<string, string> = {
  bronze: "🥉 銅",
  silver: "🥈 銀",
  gold: "🥇 金",
  vip: "👑 VIP",
};

const STATUS_LABELS: Record<string, { label: string; cls: string; icon: any }> = {
  pending: { label: "待處理", cls: "bg-amber-100 text-amber-700", icon: Clock },
  accepted: { label: "已接受", cls: "bg-green-100 text-green-700", icon: CheckCircle2 },
  rejected: { label: "已拒絕", cls: "bg-rose-100 text-rose-700", icon: XCircle },
  expired: { label: "已過期", cls: "bg-gray-100 text-gray-500", icon: Clock },
  purchased: { label: "已成交", cls: "bg-blue-100 text-blue-700", icon: ShoppingBag },
};

function getFirstImg(images: string | null | undefined): string | null {
  try {
    const arr = images ? JSON.parse(images) : [];
    return Array.isArray(arr) && arr.length > 0 ? arr[0] : null;
  } catch { return null; }
}

export default function MerchantOffersDialog({ open, onOpenChange }: MerchantOffersDialogProps) {
  const utils = trpc.useUtils();
  const [tab, setTab] = useState<"pending" | "accepted" | "all">("pending");
  const [respondingId, setRespondingId] = useState<number | null>(null);
  const [responseText, setResponseText] = useState("");
  const [pendingAction, setPendingAction] = useState<"accept" | "reject">("accept");

  const { data: offers, isLoading } = trpc.offers.listForMerchant.useQuery(
    { status: tab },
    { enabled: open, refetchOnWindowFocus: false },
  );

  const respond = trpc.offers.respond.useMutation({
    onSuccess: () => {
      toast.success(pendingAction === "accept" ? "已接受排價" : "已拒絕排價");
      utils.offers.listForMerchant.invalidate();
      utils.offers.pendingCount.invalidate();
      setRespondingId(null);
      setResponseText("");
    },
    onError: (e) => toast.error(e.message),
  });

  const hideMerchant = trpc.offers.hideForMerchant.useMutation({
    onSuccess: () => {
      toast.success("已清除紀錄");
      utils.offers.listForMerchant.invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const list = (offers ?? []) as any[];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-orange-600">
            <Tag className="w-5 h-5" /> 收到嘅排價
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-1.5 border-b pb-2">
          {(["pending", "accepted", "all"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border ${
                tab === k ? "bg-orange-500 text-white border-orange-500" : "bg-white text-gray-600 border-gray-200"
              }`}
            >
              {k === "pending" ? "待處理" : k === "accepted" ? "已接受" : "全部"}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
        ) : list.length === 0 ? (
          <p className="text-center text-sm text-gray-500 py-8">暫無排價</p>
        ) : (
          <div className="space-y-3">
            {list.map((o) => {
              const st = STATUS_LABELS[String(o.status)] ?? STATUS_LABELS.pending;
              const StIcon = st.icon;
              const img = getFirstImg(o.productImages);
              const listPrice = Number(o.productListPrice ?? 0);
              const offerAmount = Number(o.amount);
              const discount = listPrice > 0 ? ((1 - offerAmount / listPrice) * 100).toFixed(1) : "—";
              const isResponding = respondingId === o.id;
              return (
                <div key={o.id} className="border border-gray-200 rounded-xl p-3 space-y-2">
                  <div className="flex gap-2">
                    {img ? (
                      <img src={img} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-gray-100 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 line-clamp-1">{o.productTitle ?? `#${o.productId}`}</p>
                      <p className="text-[11px] text-gray-500">
                        買家：{o.buyerName ?? `#${o.buyerId}`} {MEMBER_LABELS[String(o.buyerMemberLevel ?? "bronze")] ?? ""}
                      </p>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${st.cls} flex items-center gap-1 self-start`}>
                      <StIcon className="w-3 h-3" />{st.label}
                    </span>
                  </div>

                  <div className="flex items-center justify-between bg-amber-50 rounded-lg px-3 py-2">
                    <div>
                      <p className="text-[11px] text-gray-500">排價金額</p>
                      <p className="text-base font-bold text-orange-600">{o.currency} ${offerAmount.toLocaleString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] text-gray-500">標價 ${listPrice.toLocaleString()}</p>
                      <p className="text-[11px] text-rose-500 font-medium">↓ {discount}%</p>
                    </div>
                  </div>

                  {o.buyerNote && (
                    <p className="text-xs text-gray-600 bg-gray-50 rounded-lg px-2 py-1.5">💬 {o.buyerNote}</p>
                  )}

                  {o.status === "pending" && !isResponding && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 border-rose-200 text-rose-600 hover:bg-rose-50"
                        onClick={() => { setRespondingId(o.id); setPendingAction("reject"); setResponseText(""); }}
                      >
                        <XCircle className="w-3.5 h-3.5 mr-1" />拒絕
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1 bg-green-500 hover:bg-green-600 text-white"
                        onClick={() => { setRespondingId(o.id); setPendingAction("accept"); setResponseText(""); }}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" />接受
                      </Button>
                    </div>
                  )}

                  {isResponding && (
                    <div className="space-y-2 border-t border-dashed border-gray-200 pt-2">
                      <p className="text-xs font-medium text-gray-700">
                        {pendingAction === "accept" ? "接受排價（24 小時內買家落單有效）" : "拒絕排價"}
                      </p>
                      <Textarea
                        rows={2}
                        maxLength={500}
                        placeholder={pendingAction === "accept" ? "（選填）給買家嘅留言" : "（選填）拒絕原因"}
                        value={responseText}
                        onChange={(e) => setResponseText(e.target.value)}
                        className="text-sm resize-none"
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() => { setRespondingId(null); setResponseText(""); }}
                          disabled={respond.isPending}
                        >
                          取消
                        </Button>
                        <Button
                          size="sm"
                          className={`flex-1 text-white ${pendingAction === "accept" ? "bg-green-500 hover:bg-green-600" : "bg-rose-500 hover:bg-rose-600"}`}
                          disabled={respond.isPending}
                          onClick={() => respond.mutate({ offerId: o.id, action: pendingAction, responseText: responseText.trim() || undefined })}
                        >
                          {respond.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "確認"}
                        </Button>
                      </div>
                    </div>
                  )}

                  {o.status === "accepted" && o.expiresAt && (
                    <p className="text-[11px] text-gray-500">買家需於 {new Date(o.expiresAt).toLocaleString("zh-HK", { hour12: false })} 前落單</p>
                  )}
                  {o.merchantResponse && o.status !== "pending" && (
                    <p className="text-[11px] text-gray-500">你嘅回覆：{o.merchantResponse}</p>
                  )}
                  {o.status === "purchased" && o.orderId && (
                    <Link href={`/merchant-products?tab=orders`}>
                      <Button size="sm" variant="outline" className="w-full gap-1.5">
                        <ShoppingBag className="w-3.5 h-3.5" />查看訂單 #{o.orderId}
                      </Button>
                    </Link>
                  )}
                  {(o.status === "rejected" || o.status === "cancelled" || o.status === "expired") && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full text-gray-500 border-gray-200 hover:bg-gray-50 gap-1.5"
                      disabled={hideMerchant.isPending}
                      onClick={() => hideMerchant.mutate({ offerId: o.id })}
                    >
                      {hideMerchant.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      清除紀錄
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
