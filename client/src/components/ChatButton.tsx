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
  /** 拍賣已結束 → 唔可以開新對話 */
  auctionEnded?: boolean;
  /** 用於檢查同自己嘅 auction 唔可以 chat */
  className?: string;
}

export default function ChatButton({ auctionId, merchantId, auctionEnded, className }: ChatButtonProps) {
  const { user, isAuthenticated } = useAuth();
  const [opening, setOpening] = useState(false);
  const [openRoomId, setOpenRoomId] = useState<number | null>(null);
  const utils = trpc.useUtils();

  const { data: autoBidStatus } = trpc.loyalty.myAutoBidStatus.useQuery(undefined, { enabled: isAuthenticated });
  const memberLevel = (autoBidStatus?.level as string | undefined) ?? "bronze";
  const isMerchantSelf = isAuthenticated && user?.id === merchantId;
  const isAdmin = user?.role === "admin";
  const isQualified = isAdmin || ["silver", "gold", "vip"].includes(memberLevel);

  const openRoom = trpc.chat.openRoom.useMutation({
    onSuccess: ({ roomId }) => {
      setOpenRoomId(roomId);
      setOpening(false);
    },
    onError: (err) => {
      toast.error(err.message);
      setOpening(false);
    },
  });

  if (isMerchantSelf) {
    return null;
  }

  const handleClick = () => {
    if (!isAuthenticated) {
      window.location.href = `/login?from=${encodeURIComponent(window.location.pathname)}`;
      return;
    }
    if (auctionEnded) {
      toast.error("拍賣已結束，唔可以再開新對話", { duration: 3000 });
      return;
    }
    if (!isQualified) {
      toast.error("只有銀牌或以上會員可以同商戶對話。請先升級會員等級 🥈", { duration: 4000 });
      return;
    }
    setOpening(true);
    openRoom.mutate({ auctionId });
  };

  const baseClass = "w-full gap-2 border-amber-300 text-amber-700 hover:bg-amber-50";
  const buttonLabel = auctionEnded
    ? "🔒 拍賣已結，無法新增對話"
    : isQualified
      ? "💬 問商戶"
      : "💬 問商戶（銀牌+）";
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={handleClick}
        disabled={opening || openRoom.isPending || auctionEnded}
        className={`${baseClass} ${className ?? ""}`}
        title={auctionEnded ? "拍賣已結束" : isQualified ? "私訊商戶" : "需要銀牌或以上會員"}
      >
        <MessageCircle className="w-4 h-4" />
        {buttonLabel}
      </Button>
      {openRoomId !== null && (
        <ChatRoomDialog
          roomId={openRoomId}
          open={openRoomId !== null}
          onOpenChange={(o) => {
            if (!o) {
              setOpenRoomId(null);
              utils.chat.unreadTotal.invalidate();
              utils.chat.listMyRooms.invalidate();
            }
          }}
        />
      )}
    </>
  );
}
