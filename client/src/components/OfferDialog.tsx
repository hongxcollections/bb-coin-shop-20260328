import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tag, Loader2, CheckCircle2, XCircle, Clock, ShoppingCart } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface OfferDialogProps {
  product: {
    id: number;
    title: string;
    price: string | number;
    currency: string;
    images?: string | null;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function getFirstImg(images: string | null | undefined): string | null {
  try {
    const arr = images ? JSON.parse(images) : [];
    return Array.isArray(arr) && arr.length > 0 ? arr[0] : null;
  } catch { return null; }
}

function fmtCountdown(target: Date | string | null): string {
  if (!target) return "";
  const t = typeof target === "string" ? new Date(target) : target;
  const ms = t.getTime() - Date.now();
  if (ms <= 0) return "已過期";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${h} 小時 ${m} 分鐘`;
}

export default function OfferDialog({ product, open, onOpenChange }: OfferDialogProps) {
  const utils = trpc.useUtils();
  const listPrice = Number(product.price);
  const minAllowed = listPrice * 0.5;
  const img = getFirstImg(product.images ?? null);

  const { data: existing, isLoading: existingLoading } = trpc.offers.myActiveForProduct.useQuery(
    { productId: product.id },
    { enabled: open, refetchOnWindowFocus: false },
  );

  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!open) { setAmount(""); setNote(""); setConfirming(false); }
  }, [open]);
  useEffect(() => { setConfirming(false); }, [amount, note]);

  const createOffer = trpc.offers.create.useMutation({
    onSuccess: () => {
      toast.success("排價已送出，等候商戶回覆");
      setConfirming(false);
      utils.offers.myActiveForProduct.invalidate({ productId: product.id });
      utils.offers.listMine.invalidate();
    },
    onError: (e) => { setConfirming(false); toast.error(e.message); },
  });

  const convertToOrder = trpc.offers.convertToOrder.useMutation({
    onSuccess: ({ orderId }) => {
      toast.success(`已落單（單號 #${orderId}），請等商戶確認`);
      utils.offers.myActiveForProduct.invalidate({ productId: product.id });
      utils.offers.listMine.invalidate();
      onOpenChange(false);
    },
    onError: (e) => toast.error(e.message),
  });

  function validate(): number | null {
    const v = parseFloat(amount);
    if (isNaN(v) || v <= 0) { toast.error("請輸入有效金額"); return null; }
    if (v >= listPrice) { toast.error("排價金額需要低於標價"); return null; }
    if (v < minAllowed) { toast.error(`排價最低 ${product.currency} $${minAllowed.toFixed(2)}`); return null; }
    return v;
  }
  function handleFirstClick() {
    if (validate() == null) return;
    setConfirming(true);
  }
  function handleConfirm() {
    const v = validate();
    if (v == null) return;
    createOffer.mutate({ productId: product.id, amount: v, buyerNote: note.trim() || undefined });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-orange-600">
            <Tag className="w-5 h-5" /> 向商戶排價
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-3 bg-amber-50 rounded-xl p-3">
          {img ? (
            <img src={img} alt={product.title} className="w-16 h-16 rounded-lg object-cover shrink-0" />
          ) : (
            <div className="w-16 h-16 rounded-lg bg-amber-100 shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-gray-800 line-clamp-2">{product.title}</p>
            <p className="text-amber-600 font-bold text-base mt-0.5">標價 {product.currency} ${listPrice.toLocaleString()}</p>
            <p className="text-[11px] text-gray-500 mt-0.5">最低排價 ${minAllowed.toFixed(2)}（標價嘅 50%）</p>
          </div>
        </div>

        {existingLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
        ) : existing ? (
          <div className="space-y-3">
            {existing.status === "pending" && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-1.5">
                <div className="flex items-center gap-2 text-amber-700 font-semibold text-sm">
                  <Clock className="w-4 h-4" /> 等候商戶回覆
                </div>
                <p className="text-sm text-gray-700">你嘅排價：<span className="font-bold text-amber-700">{existing.currency} ${Number(existing.amount).toLocaleString()}</span></p>
                {existing.buyerNote && <p className="text-xs text-gray-500">留言：{existing.buyerNote}</p>}
                <p className="text-[11px] text-gray-400">商戶 48 小時內未回覆會自動取消</p>
              </div>
            )}
            {existing.status === "accepted" && (
              <div className="rounded-xl border border-green-200 bg-green-50 p-3 space-y-2">
                <div className="flex items-center gap-2 text-green-700 font-semibold text-sm">
                  <CheckCircle2 className="w-4 h-4" /> 商戶已接受！
                </div>
                <p className="text-sm text-gray-700">成交價：<span className="font-bold text-green-700">{existing.currency} ${Number(existing.amount).toLocaleString()}</span></p>
                {existing.merchantResponse && <p className="text-xs text-gray-600">商戶留言：{existing.merchantResponse}</p>}
                <p className="text-[11px] text-orange-600">⏰ 剩餘時間：{fmtCountdown(existing.expiresAt)}（過期需重新排價）</p>
                <Button
                  className="w-full bg-amber-500 hover:bg-amber-600 text-white gap-2"
                  disabled={convertToOrder.isPending}
                  onClick={() => convertToOrder.mutate({ offerId: existing.id })}
                >
                  {convertToOrder.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingCart className="w-4 h-4" />}
                  立即落單 @ ${Number(existing.amount).toLocaleString()}
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs text-gray-500 font-medium">你想出價（{product.currency}）</label>
              <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2 focus-within:border-orange-400">
                <span className="text-xs text-gray-400 shrink-0">{product.currency} $</span>
                <Input
                  type="number"
                  min={minAllowed}
                  max={listPrice - 0.01}
                  step="0.01"
                  placeholder={(listPrice * 0.8).toFixed(0)}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="border-0 p-0 h-auto text-base font-medium focus-visible:ring-0"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-gray-500 font-medium">附加留言（選填）</label>
              <Textarea
                rows={3}
                maxLength={500}
                placeholder="例：可否包順豐？"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="text-sm resize-none"
              />
            </div>
            <div className="rounded-lg bg-gray-50 px-3 py-2 text-[11px] text-gray-500 leading-relaxed">
              <p>• 商戶可選擇接受或拒絕；接受後 24 小時內未落單會自動取消</p>
              <p>• 同一商品 24 小時內最多 3 次排價</p>
            </div>
            {confirming && (
              <div className="rounded-xl border-2 border-orange-300 bg-orange-50 p-3 text-sm text-gray-700 space-y-1">
                <p className="font-semibold text-orange-700 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> 請再次確認排價
                </p>
                <p>商品：<span className="font-medium">{product.title}</span></p>
                <p>排價金額：<span className="font-bold text-orange-700">{product.currency} ${Number(amount || 0).toLocaleString()}</span>（標價 ${listPrice.toLocaleString()}）</p>
                {note.trim() && <p className="text-xs text-gray-600">留言：{note.trim()}</p>}
                <p className="text-[11px] text-gray-500 pt-0.5">送出後唔可以修改，48 小時內未獲回覆會自動取消。</p>
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => { if (confirming) setConfirming(false); else onOpenChange(false); }}
                disabled={createOffer.isPending}
              >
                {confirming ? "返回修改" : "取消"}
              </Button>
              {confirming ? (
                <Button
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white gap-1.5"
                  disabled={createOffer.isPending}
                  onClick={handleConfirm}
                >
                  {createOffer.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  確認送出
                </Button>
              ) : (
                <Button
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white gap-1.5"
                  disabled={createOffer.isPending}
                  onClick={handleFirstClick}
                >
                  <Tag className="w-4 h-4" />
                  送出排價
                </Button>
              )}
            </div>
          </div>
        )}

        {existing && existing.status === "rejected" && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 mt-2 text-sm">
            <div className="flex items-center gap-2 text-rose-700 font-semibold">
              <XCircle className="w-4 h-4" /> 商戶已拒絕
            </div>
            {existing.merchantResponse && <p className="text-xs text-gray-600 mt-1">{existing.merchantResponse}</p>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
