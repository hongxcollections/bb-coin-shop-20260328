import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useChatWebSocket, type ChatWSMessage, type ChatReactionEvent } from "@/hooks/useChatWebSocket";
import { Send, Image as ImageIcon, Megaphone, Loader2, Lock, Search, X, SmilePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import ImageLightbox from "@/components/ImageLightbox";
import { toast } from "sonner";

type Message = {
  id: number;
  roomId: number;
  senderId: number;
  senderRole: "bidder" | "merchant" | "system";
  messageType: "text" | "image" | "broadcast";
  content: string | null;
  imageUrl: string | null;
  createdAt: Date | string;
};

type Reaction = { messageId: number; emoji: string; userId: number };

interface ChatRoomDialogProps {
  roomId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const EMOJI_OPTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏", "🔥", "👏"];

function formatTime(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleTimeString("zh-HK", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function formatDateLabel(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) return "今日";
  const y = new Date(now); y.setDate(y.getDate() - 1);
  if (date.toDateString() === y.toDateString()) return "昨日";
  return date.toLocaleDateString("zh-HK", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function highlight(text: string, query: string) {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx < 0) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-200 text-inherit rounded px-0.5">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

export default function ChatRoomDialog({ roomId, open, onOpenChange }: ChatRoomDialogProps) {
  const { user, isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const [text, setText] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [uploading, setUploading] = useState(false);
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);
  const [pickerForMessageId, setPickerForMessageId] = useState<number | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedMessageId, setHighlightedMessageId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const validRoom = !isNaN(roomId) && roomId > 0;
  const { data, isLoading: dataLoading } = trpc.chat.getRoom.useQuery(
    { roomId },
    { enabled: open && isAuthenticated && validRoom, refetchOnWindowFocus: false },
  );

  // 同步初始訊息 + reactions
  useEffect(() => {
    if (data?.messages) {
      setMessages(data.messages as Message[]);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "auto" }), 50);
    }
    if (data?.reactions) {
      setReactions(data.reactions as Reaction[]);
    }
  }, [data?.messages, data?.reactions]);

  // Dialog 關閉時清空本地 state
  useEffect(() => {
    if (!open) {
      setText("");
      setMessages([]);
      setReactions([]);
      setLightboxImg(null);
      setPickerForMessageId(null);
      setSearchOpen(false);
      setSearchQuery("");
      setHighlightedMessageId(null);
    }
  }, [open]);

  const markRead = trpc.chat.markRead.useMutation({
    onSuccess: () => {
      utils.chat.unreadTotal.invalidate();
      utils.chat.listMyRooms.invalidate();
    },
  });

  // WebSocket：即時收訊息 + reaction
  useChatWebSocket({
    enabled: open && isAuthenticated && validRoom,
    roomId,
    onMessage: (m: ChatWSMessage) => {
      if (m.roomId !== roomId) return;
      setMessages((prev) => {
        if (prev.some((x) => x.id === m.id)) return prev;
        return [...prev, m as Message];
      });
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 30);
      markRead.mutate({ roomId });
      utils.chat.unreadTotal.invalidate();
    },
    onReaction: (evt: ChatReactionEvent) => {
      if (evt.roomId !== roomId) return;
      setReactions((prev) => {
        // 移除呢條 message 嘅所有 reactions，再用最新 list
        const others = prev.filter((r) => r.messageId !== evt.messageId);
        const fresh: Reaction[] = evt.reactions.map((r) => ({
          messageId: evt.messageId,
          emoji: r.emoji,
          userId: r.userId,
        }));
        return [...others, ...fresh];
      });
    },
  });

  // 進入即標記已讀
  useEffect(() => {
    if (open && data && validRoom) {
      markRead.mutate({ roomId });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, data?.room.id]);

  const sendMessage = trpc.chat.sendMessage.useMutation({
    onSuccess: ({ message }) => {
      setText("");
      setMessages((prev) => {
        if (prev.some((x) => x.id === message.id)) return prev;
        return [...prev, message as Message];
      });
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 30);
      utils.chat.listMyRooms.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const toggleReaction = trpc.chat.toggleReaction.useMutation({
    onError: (err) => toast.error(err.message),
  });

  const handleToggleReaction = (messageId: number, emoji: string) => {
    setPickerForMessageId(null);
    // optimistic：更新本地，server 廣播會以 latest reactions 覆蓋
    setReactions((prev) => {
      const me = user?.id ?? -1;
      const existing = prev.find((r) => r.messageId === messageId && r.userId === me && r.emoji === emoji);
      if (existing) {
        return prev.filter((r) => r !== existing);
      }
      return [...prev, { messageId, userId: me, emoji }];
    });
    toggleReaction.mutate({ messageId, emoji });
  };

  const uploadImage = trpc.chat.uploadImage.useMutation();

  const handleSend = () => {
    const t = text.trim();
    if (!t) return;
    sendMessage.mutate({ roomId, content: t });
  };

  const handleFilePick = async (file: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("只可上傳圖片");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("圖片大小不可超過 5MB");
      return;
    }
    setUploading(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => {
          const result = r.result as string;
          resolve(result.split(",")[1] ?? "");
        };
        r.onerror = () => reject(new Error("讀取圖片失敗"));
        r.readAsDataURL(file);
      });
      const { url } = await uploadImage.mutateAsync({
        roomId,
        imageData: base64,
        fileName: file.name,
        mimeType: file.type,
      });
      await sendMessage.mutateAsync({ roomId, imageUrl: url });
    } catch (e) {
      toast.error((e as Error).message || "上傳失敗");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // 30 秒 tick 一次，令 auctionEnded 自動 flip
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => setNowTick(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [open]);

  const auctionEnded = !!data?.auction && (
    data.auction.status === "ended" ||
    (data.auction.endTime ? new Date(data.auction.endTime).getTime() < nowTick : false)
  );

  // 為快速查 reactions 而 group
  const reactionsByMsg = useMemo(() => {
    const map = new Map<number, Reaction[]>();
    for (const r of reactions) {
      const arr = map.get(r.messageId) ?? [];
      arr.push(r);
      map.set(r.messageId, arr);
    }
    return map;
  }, [reactions]);

  // group messages by date
  const grouped: Array<{ date: string; items: Message[] }> = [];
  let lastDate = "";
  for (const m of messages) {
    const d = formatDateLabel(m.createdAt);
    if (d !== lastDate) {
      grouped.push({ date: d, items: [] });
      lastDate = d;
    }
    grouped[grouped.length - 1].items.push(m);
  }

  // search results
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return messages.filter((m) => (m.content ?? "").toLowerCase().includes(q));
  }, [messages, searchQuery]);

  const jumpToMessage = (mid: number) => {
    const el = messageRefs.current.get(mid);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightedMessageId(mid);
      setTimeout(() => setHighlightedMessageId(null), 2000);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="p-0 gap-0 w-[95vw] max-w-md sm:max-w-lg h-[80vh] sm:h-[600px] max-h-[80vh] flex flex-col overflow-hidden"
        showCloseButton={false}
      >
        {/* 頂部 header */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200 bg-white flex-shrink-0">
          {data?.other?.photoUrl ? (
            <img src={data.other.photoUrl} alt="" className="w-9 h-9 rounded-full object-cover" />
          ) : (
            <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 text-sm font-medium">
              {(data?.other?.name ?? "?").slice(0, 1)}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold truncate">{data?.other?.name ?? "用戶"}</div>
            {data?.auction && (
              <Link
                href={`/auctions/${data.auction.id}`}
                onClick={() => onOpenChange(false)}
                className="text-xs text-amber-600 truncate block hover:underline"
              >
                {data.auction.title} {data.auction.status === "ended" && "(已結)"}
              </Link>
            )}
          </div>
          <button
            type="button"
            onClick={() => { setSearchOpen((v) => !v); if (searchOpen) setSearchQuery(""); }}
            className={`p-2 text-gray-500 hover:text-amber-600 ${searchOpen ? "text-amber-600" : ""}`}
            aria-label="搜尋對話"
            title="搜尋對話"
          >
            <Search className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="p-2 -mr-1 text-gray-500 hover:text-amber-600 text-lg leading-none"
            aria-label="關閉"
          >
            ✕
          </button>
        </div>

        {/* 搜尋欄 */}
        {searchOpen && (
          <div className="border-b border-gray-200 bg-white px-3 py-2 flex-shrink-0">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜尋對話內容..."
                className="pl-8 pr-8 h-9 text-sm"
                autoFocus
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            {searchQuery.trim() && (
              <div className="mt-2 max-h-40 overflow-y-auto rounded border border-gray-200 bg-gray-50">
                {searchResults.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-gray-500">無相符結果</div>
                ) : (
                  searchResults.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => jumpToMessage(m.id)}
                      className="w-full text-left px-3 py-1.5 text-xs hover:bg-amber-50 border-b border-gray-100 last:border-0"
                    >
                      <div className="text-gray-400 text-[10px]">{formatDateLabel(m.createdAt)} {formatTime(m.createdAt)}</div>
                      <div className="text-gray-700 truncate">{highlight(m.content ?? "", searchQuery.trim())}</div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {/* 訊息列表 */}
        <div className="flex-1 overflow-y-auto bg-gray-50 px-3 py-3">
          {dataLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
            </div>
          )}
          {!dataLoading && grouped.length === 0 && (
            <div className="text-center text-gray-400 text-sm py-12">
              對話一片空白，傳第一條訊息開始 👇
            </div>
          )}
          {!dataLoading && grouped.map((g, gi) => (
            <div key={gi} className="space-y-2 mb-4 last:mb-0">
              <div className="text-center">
                <span className="inline-block text-[11px] px-2 py-0.5 rounded-full bg-gray-200 text-gray-600">
                  {g.date}
                </span>
              </div>
              {g.items.map((m) => {
                const mine = m.senderId === user?.id;
                const isBroadcast = m.messageType === "broadcast";
                const isSystem = m.senderRole === "system";
                const msgReactions = reactionsByMsg.get(m.id) ?? [];
                // group by emoji
                const reactionGroups = new Map<string, { count: number; mine: boolean }>();
                for (const r of msgReactions) {
                  const cur = reactionGroups.get(r.emoji) ?? { count: 0, mine: false };
                  cur.count += 1;
                  if (r.userId === user?.id) cur.mine = true;
                  reactionGroups.set(r.emoji, cur);
                }
                const isHighlighted = highlightedMessageId === m.id;
                if (isSystem) {
                  return (
                    <div
                      key={m.id}
                      ref={(el) => { if (el) messageRefs.current.set(m.id, el); }}
                      className="flex justify-center"
                    >
                      <div className={`max-w-[85%] text-center text-xs text-gray-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 ${isHighlighted ? "ring-2 ring-amber-400" : ""}`}>
                        <span className="whitespace-pre-wrap">{m.content}</span>
                      </div>
                    </div>
                  );
                }
                return (
                  <div
                    key={m.id}
                    ref={(el) => { if (el) messageRefs.current.set(m.id, el); }}
                    className={`flex ${mine ? "justify-end" : "justify-start"} group`}
                  >
                    <div className={`max-w-[78%] ${mine ? "items-end" : "items-start"} flex flex-col`}>
                      {isBroadcast && (
                        <div className="flex items-center gap-1 mb-1 text-xs text-amber-600">
                          <Megaphone className="w-3 h-3" />
                          <span>商戶廣播</span>
                        </div>
                      )}
                      <div className="flex items-end gap-1 relative">
                        <button
                          type="button"
                          onClick={() => {
                            if (auctionEnded) return;
                            // 圖片訊息：點擊泡泡 = 睇大圖；emoji picker 用旁邊嘅 SmilePlus button 觸發
                            if (m.messageType === "image" && m.imageUrl) {
                              setLightboxImg(m.imageUrl);
                            } else {
                              setPickerForMessageId(pickerForMessageId === m.id ? null : m.id);
                            }
                          }}
                          className={`text-left rounded-2xl px-3 py-2 text-sm break-words shadow-sm transition-all ${
                            m.messageType === "image"
                              ? "p-1 bg-transparent shadow-none"
                              : isBroadcast
                                ? "bg-amber-100 text-amber-900 border border-amber-200"
                                : mine
                                  ? "bg-amber-500 text-white"
                                  : "bg-white text-gray-800 border border-gray-200"
                          } ${isHighlighted ? "ring-2 ring-amber-400" : ""} ${!auctionEnded ? "active:opacity-80" : ""}`}
                        >
                          {m.messageType === "image" && m.imageUrl ? (
                            <img src={m.imageUrl} alt="" className="max-w-[220px] max-h-[280px] object-contain rounded-xl block" />
                          ) : (
                            <span className="whitespace-pre-wrap">
                              {searchQuery.trim() ? highlight(m.content ?? "", searchQuery.trim()) : m.content}
                            </span>
                          )}
                        </button>
                        {!auctionEnded && (
                          <button
                            type="button"
                            onClick={() => setPickerForMessageId(pickerForMessageId === m.id ? null : m.id)}
                            className="p-1 text-gray-400 hover:text-amber-500 active:text-amber-600 flex-shrink-0"
                            aria-label="加表情"
                            title="加表情"
                          >
                            <SmilePlus className="w-4 h-4" />
                          </button>
                        )}
                        {pickerForMessageId === m.id && (
                          <div className={`absolute z-20 ${mine ? "right-0" : "left-0"} -top-10 bg-white border border-gray-200 rounded-full shadow-lg px-2 py-1 flex items-center gap-0.5`}>
                            {EMOJI_OPTIONS.map((emo) => (
                              <button
                                key={emo}
                                type="button"
                                onClick={() => handleToggleReaction(m.id, emo)}
                                className="text-lg hover:bg-amber-50 rounded-full w-7 h-7 flex items-center justify-center transition-colors"
                              >
                                {emo}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      {/* reactions cluster */}
                      {reactionGroups.size > 0 && (
                        <div className={`flex flex-wrap gap-1 mt-1 ${mine ? "justify-end" : "justify-start"}`}>
                          {Array.from(reactionGroups.entries()).map(([emo, info]) => (
                            <button
                              key={emo}
                              type="button"
                              onClick={() => !auctionEnded && handleToggleReaction(m.id, emo)}
                              disabled={auctionEnded}
                              className={`text-[11px] rounded-full px-1.5 py-0.5 border transition-colors ${
                                info.mine
                                  ? "bg-amber-100 border-amber-300 text-amber-800"
                                  : "bg-white border-gray-200 text-gray-700 hover:bg-amber-50"
                              }`}
                            >
                              <span className="mr-0.5">{emo}</span>
                              <span className="font-medium">{info.count}</span>
                            </button>
                          ))}
                        </div>
                      )}
                      <span className="text-[10px] text-gray-400 mt-0.5 px-1">{formatTime(m.createdAt)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* 底部輸入欄 */}
        {auctionEnded ? (
          <div className="border-t border-gray-200 bg-gray-100 px-4 py-3 flex-shrink-0">
            <div className="flex items-center gap-2 text-gray-600 text-sm justify-center">
              <Lock className="w-4 h-4 text-gray-500" />
              <span>拍賣已結束，呢個對話已封存，只可瀏覽歷史訊息</span>
            </div>
          </div>
        ) : (
          <div className="border-t border-gray-200 bg-white px-3 py-2 flex-shrink-0">
            <div className="flex items-end gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFilePick(f);
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="flex-shrink-0 h-10 w-10 border-amber-200 text-amber-600 hover:bg-amber-50"
                disabled={uploading || !data}
                onClick={() => fileInputRef.current?.click()}
                title="傳送圖片"
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
              </Button>
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="輸入訊息..."
                rows={1}
                className="resize-none min-h-[40px] max-h-[120px] text-sm"
                maxLength={2000}
                disabled={!data}
              />
              <Button
                type="button"
                size="icon"
                className="flex-shrink-0 h-10 w-10 gold-gradient text-white border-0"
                onClick={handleSend}
                disabled={sendMessage.isPending || !text.trim() || !data}
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {lightboxImg && (
          <ImageLightbox images={[lightboxImg]} onClose={() => setLightboxImg(null)} />
        )}
      </DialogContent>
    </Dialog>
  );
}
