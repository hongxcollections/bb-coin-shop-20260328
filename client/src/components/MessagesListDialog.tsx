import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useChatWebSocket } from "@/hooks/useChatWebSocket";
import { MessageCircle, Image as ImageIcon, Megaphone, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import ChatRoomDialog from "@/components/ChatRoomDialog";

interface MessagesListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatTime(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) {
    return date.toLocaleTimeString("zh-HK", { hour: "2-digit", minute: "2-digit", hour12: false });
  }
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "昨日";
  return date.toLocaleDateString("zh-HK", { month: "2-digit", day: "2-digit" });
}

export default function MessagesListDialog({ open, onOpenChange }: MessagesListDialogProps) {
  const { isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const [openRoomId, setOpenRoomId] = useState<number | null>(null);

  const { data: rooms, isLoading: roomsLoading, refetch } = trpc.chat.listMyRooms.useQuery(undefined, {
    enabled: open && isAuthenticated,
    refetchOnWindowFocus: true,
  });

  // 進入即 invalidate unread badge
  useEffect(() => {
    if (open && isAuthenticated) utils.chat.unreadTotal.invalidate();
  }, [open, isAuthenticated, utils]);

  // WebSocket 即時刷新
  useChatWebSocket({
    enabled: open && isAuthenticated,
    onMessage: () => {
      refetch();
      utils.chat.unreadTotal.invalidate();
    },
    onUnreadRefresh: () => {
      refetch();
      utils.chat.unreadTotal.invalidate();
    },
  });

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="p-0 gap-0 w-[95vw] max-w-md sm:max-w-lg h-[80vh] sm:h-[600px] max-h-[80vh] flex flex-col overflow-hidden"
          showCloseButton={false}
        >
          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200 bg-white flex-shrink-0">
            <MessageCircle className="w-5 h-5 text-amber-600" />
            <h2 className="text-base font-bold flex-1">對話訊息</h2>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="p-2 -mr-1 text-gray-500 hover:text-amber-600 text-lg leading-none"
              aria-label="關閉"
            >
              ✕
            </button>
          </div>

          {/* List body */}
          <div className="flex-1 overflow-y-auto bg-gray-50 px-3 py-3">
            {!isAuthenticated ? (
              <div className="text-center py-12">
                <MessageCircle className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                <p className="text-gray-600 mb-3">請先登入</p>
                <a
                  href={`/login?from=${encodeURIComponent(window.location.pathname)}`}
                  className="inline-block px-6 py-2 gold-gradient text-white rounded-lg text-sm"
                >
                  登入
                </a>
              </div>
            ) : roomsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
              </div>
            ) : !rooms || rooms.length === 0 ? (
              <Card className="p-6 text-center">
                <MessageCircle className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                <p className="text-gray-600 mb-1 text-sm">仲未有任何對話</p>
                <p className="text-xs text-gray-400">去拍賣頁面撳「💬 問商戶」就可以開始對話</p>
              </Card>
            ) : (
              <div className="space-y-2">
                {rooms.map((r) => {
                  const isBroadcast = r.lastMessagePreview?.startsWith("[廣播]");
                  const isImage = r.lastMessagePreview === "[圖片]";
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setOpenRoomId(r.id)}
                      className="block w-full text-left"
                    >
                      <Card className="p-3 hover:bg-amber-50/50 transition-colors cursor-pointer">
                        <div className="flex gap-3">
                          {/* 拍賣縮圖 */}
                          <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100 border border-gray-200">
                            {r.auctionThumbUrl ? (
                              <img src={r.auctionThumbUrl} alt={r.auctionTitle} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-300 text-2xl">📦</div>
                            )}
                          </div>
                          {/* 內容 */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-medium truncate">{r.otherUserName ?? "用戶"}</div>
                                <div className="text-xs text-amber-600 truncate">{r.auctionTitle}</div>
                              </div>
                              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                <span className="text-xs text-gray-400">{formatTime(r.lastMessageAt)}</span>
                                {r.unreadCount > 0 && (
                                  <Badge className="bg-red-500 hover:bg-red-500 text-white text-[10px] h-5 min-w-[20px] px-1.5">
                                    {r.unreadCount > 99 ? "99+" : r.unreadCount}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <div className={`text-xs mt-1 truncate flex items-center gap-1 ${r.unreadCount > 0 ? "text-gray-700 font-medium" : "text-gray-500"}`}>
                              {isBroadcast && <Megaphone className="w-3 h-3 text-amber-500 flex-shrink-0" />}
                              {isImage && <ImageIcon className="w-3 h-3 flex-shrink-0" />}
                              <span className="truncate">
                                {r.myRole === "bidder" ? "" : "你："}
                                {r.lastMessagePreview ?? "（未有訊息）"}
                              </span>
                            </div>
                            {r.auctionEnded && (
                              <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                                <span className="inline-block text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">已結拍</span>
                                {r.auctionCurrentPrice !== null && r.auctionCurrentPrice !== undefined && (
                                  <span className="inline-block text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-medium">
                                    成交：{r.auctionCurrency === "USD" ? "US$" : r.auctionCurrency === "RMB" ? "¥" : "HK$"}
                                    {Number(r.auctionCurrentPrice).toLocaleString()}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </Card>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 子 Dialog: 點擊一個對話彈出 ChatRoomDialog */}
      {openRoomId !== null && (
        <ChatRoomDialog
          roomId={openRoomId}
          open={openRoomId !== null}
          onOpenChange={(o) => {
            if (!o) {
              setOpenRoomId(null);
              refetch();
              utils.chat.unreadTotal.invalidate();
            }
          }}
        />
      )}
    </>
  );
}
