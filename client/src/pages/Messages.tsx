import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useChatWebSocket } from "@/hooks/useChatWebSocket";
import { MessageCircle, Image as ImageIcon, Megaphone } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import { useEffect } from "react";

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

export default function Messages() {
  const { isAuthenticated, loading: isLoading } = useAuth();
  const utils = trpc.useUtils();
  const { data: rooms, isLoading: roomsLoading, refetch } = trpc.chat.listMyRooms.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchOnWindowFocus: true,
  });

  // WebSocket 即時刷新
  useChatWebSocket({
    enabled: isAuthenticated,
    onMessage: () => {
      refetch();
      utils.chat.unreadTotal.invalidate();
    },
    onUnreadRefresh: () => {
      refetch();
      utils.chat.unreadTotal.invalidate();
    },
  });

  // 進入頁面就 invalidate unread badge
  useEffect(() => {
    if (isAuthenticated) utils.chat.unreadTotal.invalidate();
  }, [isAuthenticated, utils]);

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">載入中...</div>;
  }

  if (!isAuthenticated) {
    return (
      <>
        <Header />
        <div className="container max-w-2xl mx-auto px-4 py-8 pb-24 text-center">
          <MessageCircle className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <h1 className="text-xl font-semibold mb-2">請先登入</h1>
          <p className="text-sm text-gray-600 mb-4">登入後即可查看你嘅對話訊息</p>
          <a href={`/login?from=${encodeURIComponent("/messages")}`} className="inline-block px-6 py-2 gold-gradient text-white rounded-lg">
            登入
          </a>
        </div>
        <BottomNav />
      </>
    );
  }

  return (
    <>
      <Header />
      <div className="container max-w-2xl mx-auto px-4 py-4 pb-24">
        <div className="flex items-center gap-2 mb-4">
          <MessageCircle className="w-5 h-5 text-amber-600" />
          <h1 className="text-lg font-bold">對話訊息</h1>
        </div>

        {roomsLoading ? (
          <div className="text-center py-8 text-gray-500">載入中...</div>
        ) : !rooms || rooms.length === 0 ? (
          <Card className="p-8 text-center">
            <MessageCircle className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-600 mb-1">仲未有任何對話</p>
            <p className="text-xs text-gray-400">去拍賣頁面撳「💬 問商戶」就可以開始對話</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {rooms.map((r) => {
              const isBroadcast = r.lastMessagePreview?.startsWith("[廣播]");
              const isImage = r.lastMessagePreview === "[圖片]";
              return (
                <Link key={r.id} href={`/messages/${r.id}`} className="block">
                  <Card className="p-3 hover:bg-amber-50/50 transition-colors cursor-pointer">
                    <div className="flex gap-3">
                      {/* 拍賣縮圖 */}
                      <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100 border border-gray-200">
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
                        {r.auctionStatus === "ended" && (
                          <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">已結拍</span>
                        )}
                      </div>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
      <BottomNav />
    </>
  );
}
