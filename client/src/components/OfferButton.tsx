import { useState } from "react";
import { Tag } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import OfferDialog from "./OfferDialog";

interface OfferButtonProps {
  product: {
    id: number;
    merchantId: number;
    title: string;
    price: string | number;
    currency: string;
    images?: string | null;
    allowOffers?: number | null;
  };
  className?: string;
}

export default function OfferButton({ product, className }: OfferButtonProps) {
  const { user, isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const utils = trpc.useUtils();
  const lvl = (user as any)?.memberLevel ?? "bronze";
  const role = (user as any)?.role ?? "user";
  const isOwn = user != null && product.merchantId === user.id;
  const allowed = Number(product.allowOffers ?? 1) === 1;

  if (isOwn || !allowed) return null;

  async function handleClick() {
    if (!isAuthenticated) {
      toast.error("請先登入");
      return;
    }
    if (!["silver", "gold", "vip"].includes(lvl) && role !== "admin") {
      toast.error("銀牌或以上會員先可以排價");
      return;
    }
    try {
      const lock = await utils.merchants.myLockStatusForMerchant.fetch({ merchantId: product.merchantId });
      if (lock?.enabled && lock.locked && lock.lockedUntil) {
        const until = new Date(lock.lockedUntil).toLocaleString('zh-HK', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
        toast.error(`你已被「${lock.merchantName ?? '此商戶'}」暫停落單／出價／排價，至 ${until}`);
        return;
      }
    } catch {}
    setOpen(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        title="向商戶排價"
        className={
          className ??
          "inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-orange-500 text-white text-[11px] font-bold shadow-md -rotate-[15deg] origin-bottom-right transition-transform hover:-rotate-[5deg] hover:scale-105 active:scale-95"
        }
      >
        <Tag className="w-3 h-3" />
        排價
      </button>
      {open && (
        <OfferDialog
          product={product}
          open={open}
          onOpenChange={setOpen}
        />
      )}
    </>
  );
}
