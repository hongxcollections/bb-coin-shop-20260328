import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import ChatRoomDialog from "@/components/ChatRoomDialog";

interface ChatButtonProps {
  auctionId: number;
  merchantId: number;
  /** 已結拍時唯一可以繼續對話嘅得標者 */
  winnerId?: number | null;
  /** 拍賣已結束 → 唔可以開新對話 */
  auctionEnded?: boolean;
  /** Compact icon-only floating mode（用喺出價區角落，配 tilt 旋轉） */
  compact?: boolean;
  /** 用於檢查同自己嘅 auction 唔可以 chat */
  className?: string;
  /** 商品名稱 — 新對話時加入初始訊息 */
  auctionTitle?: string;
}

export default function ChatButton({ auctionId, merchantId, winnerId, auctionEnded, compact, className, auctionTitle }: ChatButtonProps) {
  const { user, isAuthenticated } = useAuth();
  const [opening, setOpening] = useState(false);
  const [openRoomId, setOpenRoomId] = useState<number | null>(null);
  const utils = trpc.useUtils();

  const { data: autoBidStatus } = trpc.loyalty.myAutoBidStatus.useQuery(undefined, { enabled: isAuthenticated });
  const memberLevel = (autoBidStatus?.level as string | undefined) ?? "bronze";
  const isMerchantSelf = isAuthenticated && user?.id === merchantId;
  const isAuctionWinner = isAuthenticated && !!winnerId && user?.id === winnerId;
  const isEndedParticipant = isMerchantSelf || isAuctionWinner;
  const isAdmin = user?.role === "admin";
  const isQualified = isAdmin || ["silver", "gold", "vip"].includes(memberLevel);

  const [initialMessage, setInitialMessage] = useState<string | undefined>(undefined);

  const openRoom = trpc.chat.openRoom.useMutation({
    onSuccess: ({ roomId, isNew }) => {
      if (isNew && !auctionEnded) {
        const origin = typeof window !== "undefined" ? window.location.origin : "https://hongxcollections.com";
        const titleLine = auctionTitle ? `【${auctionTitle}】\n` : "";
        setInitialMessage(`我想查詢呢件拍賣品：\n${titleLine}${origin}/auctions/${auctionId}`);
      } else {
        setInitialMessage(undefined);
      }
      setOpenRoomId(roomId);
      setOpening(false);
    },
    onError: (err) => {
      toast.error(err.message, { className: "bb-toast-err" });
      setOpening(false);
    },
  });

  const handleClick = () => {
    if (!isAuthenticated) {
      toast.info("請先登入會員先可以同商戶對話 🔐", { duration: 3500, className: "bb-toast-err" });
      return;
    }
    if (auctionEnded && !isEndedParticipant) {
      return;
    }
    if (isMerchantSelf && !auctionEnded) {
      toast.error("商戶自己的商品，唔可以同自己對話 🚫", { duration: 3500, className: "bb-toast-err" });
      return;
    }
    if (!auctionEnded && !isQualified) {
      toast.info("只有 🥈 銀牌 / 🥇 金牌 / 👑 VIP 會員可以同商戶對話，請先升級會員等級", { duration: 4000, className: "bb-toast-err" });
      return;
    }
    setOpening(true);
    openRoom.mutate({ auctionId });
  };

  // 已結拍頁面只向得標者及商戶展示私密對話入口，訪客及其他用戶完全不展示。
  if (auctionEnded && (!isAuthenticated || !isEndedParticipant)) {
    return null;
  }

  const titleText = auctionEnded
    ? isMerchantSelf ? "聯絡中標者" : "聯絡商戶"
    : isQualified
      ? "私訊商戶"
      : "需要銀牌或以上會員";

  // Compact: 圓角小膠囊，單行 icon + 「問商戶」短文字，可加 tilt 樣式
  const compactClass = "gap-1.5 px-3 py-1.5 h-auto rounded-full border-amber-300 bg-white text-amber-700 hover:bg-amber-50 shadow-md text-xs font-semibold";
  const compactLabel = auctionEnded
    ? (isMerchantSelf ? "💬 聯絡中標者" : "💬 聯絡商戶")
    : "問商戶";

  // Default: full-width 大按鈕（原本款式）
  const baseClass = "w-full gap-2 border-amber-300 text-amber-700 hover:bg-amber-50";
  const buttonLabel = auctionEnded
    ? (isMerchantSelf ? "💬 聯絡中標者" : "💬 聯絡商戶")
    : isQualified
      ? "💬 問商戶"
      : "💬 問商戶（銀牌+）";

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={handleClick}
        disabled={opening || openRoom.isPending}
        className={compact ? `${compactClass} ${className ?? ""}` : `${baseClass} ${className ?? ""}`}
        title={titleText}
      >
        <MessageCircle className="w-4 h-4" />
        {compact ? compactLabel : buttonLabel}
      </Button>
      {openRoomId !== null && (
        <ChatRoomDialog
          roomId={openRoomId}
          open={openRoomId !== null}
          initialMessage={initialMessage}
          onOpenChange={(o) => {
            if (!o) {
              setOpenRoomId(null);
              setInitialMessage(undefined);
              utils.chat.unreadTotal.invalidate();
              utils.chat.listMyRooms.invalidate();
            }
          }}
        />
      )}
    </>
  );
}
