import { useMemo, useState } from "react";
import { Zap, X } from "lucide-react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getCurrencySymbol } from "@/pages/AdminAuctions";

interface QuickBidPopoverProps {
  auctionId: number;
  title: string;
  currentPrice: number;
  startingPrice: number;
  bidIncrement: number;
  currency?: string;
  hasExistingBid: boolean;
  isEnded: boolean;
  createdBy?: number;
}

export function QuickBidPopover({
  auctionId,
  title,
  currentPrice,
  startingPrice,
  bidIncrement,
  currency,
  hasExistingBid,
  isEnded,
  createdBy,
}: QuickBidPopoverProps) {
  const { user, isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const [customAmount, setCustomAmount] = useState("");

  const symbol = getCurrencySymbol(currency ?? "HKD");
  const minBid = hasExistingBid
    ? currentPrice + bidIncrement
    : startingPrice === 0
      ? bidIncrement
      : startingPrice;

  const quickOptions = useMemo(
    () => [
      { label: `${symbol}${minBid.toLocaleString()}`, value: minBid, hint: "最低" },
      { label: `${symbol}${(minBid + bidIncrement).toLocaleString()}`, value: minBid + bidIncrement, hint: "+1口" },
      { label: `${symbol}${(minBid + bidIncrement * 2).toLocaleString()}`, value: minBid + bidIncrement * 2, hint: "+2口" },
    ],
    [symbol, minBid, bidIncrement]
  );

  const placeBid = trpc.auctions.placeBid.useMutation({
    onSuccess: (data) => {
      const text = data?.extended
        ? `出價成功！結束時間延長 ${data.extendMinutes ?? 3} 分鐘`
        : "出價成功！";
      toast.success(text, { className: "bb-toast-success", duration: 4000 });
      setOpen(false);
      setCustomAmount("");
      utils.auctions.list.invalidate();
      utils.auctions.detail.invalidate({ id: auctionId });
    },
    onError: (err) => {
      const msg = err.message || "出價失敗";
      const isStale = msg.includes("出價金額必須") || msg.includes("必須至少為");
      const isRate = /rate|TOO_MANY|請求過於頻繁/i.test(msg);
      const text = isStale
        ? "已有新出價！請重新開出價框確認最新金額"
        : isRate
          ? "請求過於頻繁，請稍候幾秒再試"
          : msg;
      toast.error(text, { className: "bb-toast-err", duration: 5000 });
      // 同步價格
      utils.auctions.list.invalidate();
      utils.auctions.detail.invalidate({ id: auctionId });
    },
  });

  // 自己嘅拍賣 / 已結束 → 唔顯示
  if (createdBy && user?.id === createdBy) return null;
  if (isEnded) return null;

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isAuthenticated) {
      toast.info("請先登入會員先可以出價 🔐", { duration: 3500, className: "bb-toast-err" });
      return;
    }
    setOpen((v) => !v);
  };

  const submit = (amount: number) => {
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("請輸入有效金額", { className: "bb-toast-err" });
      return;
    }
    if (amount < minBid) {
      toast.error(`最低出價 ${symbol}${minBid.toLocaleString()}`, {
        description: hasExistingBid ? `現價 + 每口加幅 ${symbol}${bidIncrement}` : "起拍價",
        className: "bb-toast-err",
        duration: 4500,
      });
      return;
    }
    toast.loading("出價處理中…", { id: `qb-${auctionId}`, className: "bb-toast-success", duration: 30000 });
    placeBid.mutate(
      { auctionId, bidAmount: amount, isAnonymous: 0 },
      { onSettled: () => toast.dismiss(`qb-${auctionId}`) }
    );
  };

  const handleCustom = () => {
    const n = parseFloat(customAmount);
    submit(n);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={handleClick}
          title="閃出價"
          aria-label="閃出價"
          className="-rotate-[15deg] origin-center transition-transform hover:rotate-0 hover:scale-110 inline-flex items-center justify-center w-7 h-7 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-md hover:shadow-lg ring-1 ring-amber-300/50"
        >
          <Zap className="w-3.5 h-3.5" fill="white" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={6}
        className="w-64 p-3 bb-quickbid-popover"
        style={{
          background: "var(--popup-bg)",
          borderColor: "var(--popup-border)",
          boxShadow: "var(--popup-shadow)",
          borderRadius: "var(--popup-radius)",
          color: "var(--popup-text)",
        }}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="space-y-2.5">
          <div className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-500" fill="currentColor" />
            <span className="text-xs font-bold" style={{ color: "var(--popup-text)" }}>閃出價</span>
            <span className="text-[10px] ml-auto truncate max-w-[100px]" style={{ color: "var(--popup-text)" }} title={title}>{title}</span>
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(false); }}
              aria-label="關閉"
              title="關閉"
              className="ml-1 inline-flex items-center justify-center w-5 h-5 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="text-[11px]" style={{ color: "var(--popup-text)" }}>
            現價 <span className="font-semibold">{symbol}{currentPrice.toLocaleString()}</span>
            <span className="mx-1">·</span>
            每口 <span className="font-semibold">{symbol}{bidIncrement}</span>
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            {quickOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                disabled={placeBid.isPending}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); submit(opt.value); }}
                className="flex flex-col items-center justify-center py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 active:bg-amber-200 border border-amber-200 text-amber-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <span className="text-[9px] text-amber-600/80">{opt.hint}</span>
                <span className="text-xs font-bold">{opt.label}</span>
              </button>
            ))}
          </div>

          <div className="flex gap-1.5 pt-0.5">
            <input
              type="number"
              inputMode="decimal"
              min={minBid}
              step={bidIncrement}
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleCustom(); } }}
              placeholder={`自訂 ≥ ${symbol}${minBid.toLocaleString()}`}
              className="flex-1 min-w-0 px-2.5 py-1.5 text-xs rounded-lg border border-gray-200 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-300"
              disabled={placeBid.isPending}
            />
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleCustom(); }}
              disabled={placeBid.isPending || !customAmount.trim()}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
            >
              出價
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
