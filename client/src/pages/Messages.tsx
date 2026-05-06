import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useChatWebSocket } from "@/hooks/useChatWebSocket";
import { MessageCircle, Image as ImageIcon, Megaphone, Search, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import ChatRoomDialog from "@/components/ChatRoomDialog";
import { useEffect, useMemo, useState } from "react";

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
  const [openRoomId, setOpenRoomId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const { data: rooms, isLoading: roomsLoading, refetch } = trpc.chat.listMyRooms.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchOnWindowFocus: true,
  });

  // debounce search by 300ms
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  // 訊息全文搜尋（>=2 chars 觸發）
  const { data: msgSearch, isFetching: msgSearchLoading } = trpc.chat.searchMessages.useQuery(
    { query: debouncedSearch, limit: 30 },
    { enabled: isAuthenticated && debouncedSearch.length >= 2 },
  );

  // room list 本地 filter（房間名／拍賣標題／preview）
  const filteredRooms = useMemo(() => {
    if (!rooms) return [];
    const q = debouncedSearch.toLowerCase();
    if (!q) return rooms;
    return rooms.filter((r) => {
      const name = (r.otherUserName ?? "").toLowerCase();
      const title = (r.auctionTitle ?? "").toLowerCase();
      const prev = (r.lastMessagePreview ?? "").toLowerCase();
      return name.includes(q) || title.includes(q) || prev.includes(q);
    });
  }, [rooms, debouncedSearch]);

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
        <div className="flex items-center gap-2 mb-3">
          <MessageCircle className="w-5 h-5 text-amber-600" />
          <h1 className="text-lg font-bold">對話訊息</h1>
        </div>

        {/* 搜尋欄 */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜尋對話內容、人或拍賣..."
            className="pl-9 pr-9 h-10"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
              aria-label="清除"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* 訊息全文搜尋結果 */}
        {debouncedSearch.length >= 2 && (
          <Card className="mb-3 overflow-hidden">
            <div className="px-3 py-2 border-b bg-amber-50 text-xs font-medium text-amber-700">
              訊息搜尋結果 {msgSearchLoading ? "（載入中...）" : `（${msgSearch?.results.length ?? 0}）`}
            </div>
            {msgSearch?.results && msgSearch.results.length > 0 ? (
              <div className="max-h-72 overflow-y-auto divide-y">
                {msgSearch.results.map((r) => (
                  <button
                    key={r.messageId}
                    type="button"
                    onClick={() => setOpenRoomId(r.roomId)}
                    className="block w-full text-left px-3 py-2 hover:bg-amber-50/60 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-gray-700 truncate">{r.otherUserName ?? "用戶"}</span>
                      <span className="text-[10px] text-gray-400 flex-shrink-0">{formatTime(r.createdAt)}</span>
                    </div>
                    {r.auctionTitle && <div className="text-[11px] text-amber-600 truncate">{r.auctionTitle}</div>}
                    <div className="text-xs text-gray-600 truncate mt-0.5">{r.content ?? ""}</div>
                  </button>
                ))}
              </div>
            ) : !msgSearchLoading ? (
              <div className="px-3 py-3 text-xs text-gray-500 text-center">無相符訊息</div>
            ) : null}
          </Card>
        )}

        {roomsLoading ? (
          <div className="text-center py-8 text-gray-500">載入中...</div>
        ) : !rooms || rooms.length === 0 ? (
          <Card className="p-8 text-center">
            <MessageCircle className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-600 mb-1">仲未有任何對話</p>
            <p className="text-xs text-gray-400">去拍賣頁面撳「💬 問商戶」就可以開始對話</p>
          </Card>
        ) : filteredRooms.length === 0 ? (
          <Card className="p-6 text-center text-sm text-gray-500">
            無相符對話
          </Card>
        ) : (
          <div className="space-y-2">
            {filteredRooms.map((r) => {
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
                </button>
              );
            })}
          </div>
        )}
      </div>
      <BottomNav />
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
