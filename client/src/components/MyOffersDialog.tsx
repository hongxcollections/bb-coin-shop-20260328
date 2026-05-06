import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tag, Loader2, CheckCircle2, XCircle, Clock, ShoppingCart } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { toast } from "sonner";

interface MyOffersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STATUS_LABELS: Record<string, { label: string; cls: string; icon: any }> = {
  pending: { label: "待商戶回覆", cls: "bg-amber-100 text-amber-700", icon: Clock },
  accepted: { label: "已接受", cls: "bg-green-100 text-green-700", icon: CheckCircle2 },
  rejected: { label: "已被拒絕", cls: "bg-rose-100 text-rose-700", icon: XCircle },
  expired: { label: "已過期", cls: "bg-gray-100 text-gray-500", icon: Clock },
  purchased: { label: "已成交", cls: "bg-blue-100 text-blue-700", icon: ShoppingCart },
  converting: { label: "處理中", cls: "bg-amber-100 text-amber-700", icon: Loader2 },
};

function getFirstImg(images: string | null | undefined): string | null {
  try {
    const arr = images ? JSON.parse(images) : [];
    return Array.isArray(arr) && arr.length > 0 ? arr[0] : null;
  } catch { return null; }
}

export default function MyOffersDialog({ open, onOpenChange }: MyOffersDialogProps) {
  const utils = trpc.useUtils();
  const [tab, setTab] = useState<"pending" | "accepted" | "all">("all");

  const { data: offersAll, isLoading } = trpc.offers.listMine.useQuery(
    undefined,
    { enabled: open, refetchOnWindowFocus: false },
  ) as any;
  const offers = (() => {
    const all: any[] = Array.isArray(offersAll) ? offersAll : [];
    if (tab === "all") return all;
    if (tab === "pending") return all.filter((o) => o.status === "pending");
    if (tab === "accepted") return all.filter((o) => o.status === "accepted");
    return all;
  })();

  const convert = trpc.offers.convertToOrder.useMutation({
    onSuccess: ({ orderId }) => {
      toast.success(`已落單（單號 #${orderId}），請等商戶確認`);
      utils.offers.listMine.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const list: any[] = offers ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-orange-600">
            <Tag className="w-5 h-5" /> 我的排價
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
              {k === "pending" ? "待回覆" : k === "accepted" ? "已接受" : "全部"}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
        ) : list.length === 0 ? (
          <p className="text-center text-sm text-gray-500 py-8">暫無排價記錄</p>
        ) : (
          <div className="space-y-3">
            {list.map((o) => {
              const st = STATUS_LABELS[String(o.status)] ?? STATUS_LABELS.pending;
              const StIcon = st.icon;
              const img = getFirstImg(o.productImages);
              const listPrice = Number(o.productListPrice ?? 0);
              const offerAmount = Number(o.amount);
              const acceptedExpired = o.status === "accepted" && o.expiresAt && new Date(o.expiresAt).getTime() < Date.now();
              return (
                <div key={o.id} className="border border-gray-200 rounded-xl p-3 space-y-2">
                  <div className="flex gap-2">
                    {img ? (
                      <Link href={`/merchant-product/${o.productId}`}>
                        <img src={img} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0 cursor-pointer" />
                      </Link>
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-gray-100 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <Link href={`/merchant-product/${o.productId}`}>
                        <p className="text-sm font-semibold text-gray-800 line-clamp-1 hover:text-orange-600 cursor-pointer">{o.productTitle ?? `#${o.productId}`}</p>
                      </Link>
                      <p className="text-[11px] text-gray-500">商戶：{o.merchantName ?? `#${o.merchantId}`}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{new Date(o.createdAt).toLocaleString("zh-HK", { hour12: false })}</p>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${st.cls} flex items-center gap-1 self-start`}>
                      <StIcon className="w-3 h-3" />{st.label}
                    </span>
                  </div>

                  <div className="flex items-center justify-between bg-amber-50 rounded-lg px-3 py-2">
                    <div>
                      <p className="text-[11px] text-gray-500">你嘅排價</p>
                      <p className="text-base font-bold text-orange-600">{o.currency} ${offerAmount.toLocaleString()}</p>
                    </div>
                    {listPrice > 0 && (
                      <div className="text-right">
                        <p className="text-[11px] text-gray-500">標價 ${listPrice.toLocaleString()}</p>
                        <p className="text-[11px] text-rose-500 font-medium">↓ {((1 - offerAmount / listPrice) * 100).toFixed(1)}%</p>
                      </div>
                    )}
                  </div>

                  {o.buyerNote && (
                    <p className="text-xs text-gray-600 bg-gray-50 rounded-lg px-2 py-1.5">💬 你嘅留言：{o.buyerNote}</p>
                  )}
                  {o.merchantResponse && (o.status === "rejected" || o.status === "accepted") && (
                    <p className="text-xs text-gray-700 bg-gray-50 rounded-lg px-2 py-1.5">
                      <span className="font-medium">{o.status === "rejected" ? "❌ 商戶拒絕原因" : "✅ 商戶留言"}：</span>{o.merchantResponse}
                    </p>
                  )}

                  {o.status === "accepted" && !acceptedExpired && (
                    <div className="space-y-1.5">
                      <p className="text-[11px] text-orange-600">⏰ 須喺 {new Date(o.expiresAt).toLocaleString("zh-HK", { hour12: false })} 前落單</p>
                      <Button
                        size="sm"
                        className="w-full bg-amber-500 hover:bg-amber-600 text-white gap-1.5"
                        disabled={convert.isPending}
                        onClick={() => convert.mutate({ offerId: o.id })}
                      >
                        {convert.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShoppingCart className="w-3.5 h-3.5" />}
                        立即落單 @ ${offerAmount.toLocaleString()}
                      </Button>
                    </div>
                  )}
                  {o.status === "purchased" && o.orderId && (
                    <Link href={`/buyer-orders`}>
                      <Button size="sm" variant="outline" className="w-full">查看訂單 #{o.orderId}</Button>
                    </Link>
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
