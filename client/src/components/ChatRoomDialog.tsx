import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useChatWebSocket, type ChatWSMessage } from "@/hooks/useChatWebSocket";
import { Send, Image as ImageIcon, Megaphone, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent } from "@/components/ui/dialog";
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

interface ChatRoomDialogProps {
  roomId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

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

export default function ChatRoomDialog({ roomId, open, onOpenChange }: ChatRoomDialogProps) {
  const { user, isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const [text, setText] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [uploading, setUploading] = useState(false);
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const validRoom = !isNaN(roomId) && roomId > 0;
  const { data, isLoading: dataLoading } = trpc.chat.getRoom.useQuery(
    { roomId },
    { enabled: open && isAuthenticated && validRoom, refetchOnWindowFocus: false },
  );

  // 同步初始訊息
  useEffect(() => {
    if (data?.messages) {
      setMessages(data.messages as Message[]);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "auto" }), 50);
    }
  }, [data?.messages]);

  // Dialog 關閉時清空本地 state，避免下次開新 room 撞到舊 cache
  useEffect(() => {
    if (!open) {
      setText("");
      setMessages([]);
      setLightboxImg(null);
    }
  }, [open]);

  const markRead = trpc.chat.markRead.useMutation({
    onSuccess: () => {
      utils.chat.unreadTotal.invalidate();
      utils.chat.listMyRooms.invalidate();
    },
  });

  // WebSocket：即時收訊息（只喺 open 期間 subscribe）
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="p-0 gap-0 w-[95vw] max-w-md sm:max-w-lg h-[80vh] sm:h-[600px] max-h-[80vh] flex flex-col overflow-hidden"
        showCloseButton={false}
      >
        {/* 頂部 header（用戶 + 拍賣連結 + close） */}
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
            onClick={() => onOpenChange(false)}
            className="p-2 -mr-1 text-gray-500 hover:text-amber-600 text-lg leading-none"
            aria-label="關閉"
          >
            ✕
          </button>
        </div>

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
                return (
                  <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[78%] ${mine ? "items-end" : "items-start"} flex flex-col`}>
                      {isBroadcast && (
                        <div className="flex items-center gap-1 mb-1 text-xs text-amber-600">
                          <Megaphone className="w-3 h-3" />
                          <span>商戶廣播</span>
                        </div>
                      )}
                      <div className={`rounded-2xl px-3 py-2 text-sm break-words shadow-sm ${
                        m.messageType === "image"
                          ? "p-1 bg-transparent shadow-none"
                          : isBroadcast
                            ? "bg-amber-100 text-amber-900 border border-amber-200"
                            : mine
                              ? "bg-amber-500 text-white"
                              : "bg-white text-gray-800 border border-gray-200"
                      }`}>
                        {m.messageType === "image" && m.imageUrl ? (
                          <button
                            type="button"
                            onClick={() => setLightboxImg(m.imageUrl)}
                            className="block rounded-xl overflow-hidden hover:opacity-90 transition-opacity"
                          >
                            <img src={m.imageUrl} alt="" className="max-w-[220px] max-h-[280px] object-contain rounded-xl" />
                          </button>
                        ) : (
                          <span className="whitespace-pre-wrap">{m.content}</span>
                        )}
                      </div>
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

        {lightboxImg && (
          <ImageLightbox images={[lightboxImg]} onClose={() => setLightboxImg(null)} />
        )}
      </DialogContent>
    </Dialog>
  );
}
