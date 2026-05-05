import { useEffect, useRef, useState } from "react";
import { Link, useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useChatWebSocket, type ChatWSMessage } from "@/hooks/useChatWebSocket";
import { ChevronLeft, Send, Image as ImageIcon, Megaphone, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import Header from "@/components/Header";
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

export default function ChatRoom() {
  const params = useParams<{ roomId: string }>();
  const roomId = parseInt(params.roomId, 10);
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, loading: isLoading } = useAuth();
  const utils = trpc.useUtils();
  const [text, setText] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [uploading, setUploading] = useState(false);
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data, isLoading: dataLoading, refetch } = trpc.chat.getRoom.useQuery(
    { roomId },
    { enabled: isAuthenticated && !isNaN(roomId), refetchOnWindowFocus: false },
  );

  // 同步初始訊息
  useEffect(() => {
    if (data?.messages) {
      setMessages(data.messages as Message[]);
      // scroll 到底
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "auto" }), 50);
    }
  }, [data?.messages]);

  // WebSocket：即時收訊息
  useChatWebSocket({
    enabled: isAuthenticated && !isNaN(roomId),
    roomId,
    onMessage: (m: ChatWSMessage) => {
      if (m.roomId !== roomId) return;
      setMessages((prev) => {
        if (prev.some((x) => x.id === m.id)) return prev; // dedupe
        return [...prev, m as Message];
      });
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 30);
      // mark read 因為用戶正在睇
      markRead.mutate({ roomId });
      utils.chat.unreadTotal.invalidate();
    },
  });

  const markRead = trpc.chat.markRead.useMutation({
    onSuccess: () => {
      utils.chat.unreadTotal.invalidate();
      utils.chat.listMyRooms.invalidate();
    },
  });

  // 進入即標記已讀
  useEffect(() => {
    if (data && !isNaN(roomId)) {
      markRead.mutate({ roomId });
    }
  }, [data?.room.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const sendMessage = trpc.chat.sendMessage.useMutation({
    onSuccess: ({ message }) => {
      setText("");
      // 加上去 (WebSocket 都會收到，但 dedupe 會處理)
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

  if (isLoading || dataLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-amber-500" /></div>;
  }
  if (!isAuthenticated) {
    setLocation(`/login?from=${encodeURIComponent(`/messages/${roomId}`)}`);
    return null;
  }
  if (!data) {
    return (
      <>
        <Header />
        <div className="container max-w-2xl mx-auto px-4 py-8 text-center">
          <p className="text-gray-600">找唔到呢個對話</p>
          <Link href="/messages" className="text-amber-600 underline mt-2 inline-block">返回對話列表</Link>
        </div>
      </>
    );
  }

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
    <div className="flex flex-col h-screen bg-gray-50">
      {/* 頂部固定 */}
      <div className="fixed top-0 left-0 right-0 z-40 bg-white border-b border-gray-200 shadow-sm">
        <div className="container max-w-2xl mx-auto px-3 py-2 flex items-center gap-2">
          <Link href="/messages" className="p-1 -ml-1 text-gray-600 hover:text-amber-600">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          {data.other?.photoUrl ? (
            <img src={data.other.photoUrl} alt="" className="w-9 h-9 rounded-full object-cover" />
          ) : (
            <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
              {(data.other?.name ?? "?").slice(0, 1)}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold truncate">{data.other?.name ?? "用戶"}</div>
            <Link href={`/auctions/${data.auction?.id}`} className="text-xs text-amber-600 truncate block hover:underline">
              {data.auction?.title ?? "拍賣"} {data.auction?.status === "ended" && "(已結)"}
            </Link>
          </div>
        </div>
      </div>

      {/* 訊息列表 */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto pt-16 pb-32">
        <div className="container max-w-2xl mx-auto px-3 py-3 space-y-4">
          {grouped.length === 0 && (
            <div className="text-center text-gray-400 text-sm py-12">
              對話一片空白，傳第一條訊息開始 👇
            </div>
          )}
          {grouped.map((g, gi) => (
            <div key={gi} className="space-y-2">
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
                          ? "p-1 bg-transparent"
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
                            <img src={m.imageUrl} alt="" className="max-w-[240px] max-h-[320px] object-contain rounded-xl" />
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
      </div>

      {/* 底部輸入框 */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200">
        <div className="container max-w-2xl mx-auto px-3 py-2">
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
              disabled={uploading}
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
            />
            <Button
              type="button"
              size="icon"
              className="flex-shrink-0 h-10 w-10 gold-gradient text-white border-0"
              onClick={handleSend}
              disabled={sendMessage.isPending || !text.trim()}
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {lightboxImg && (
        <ImageLightbox images={[lightboxImg]} onClose={() => setLightboxImg(null)} />
      )}
    </div>
  );
}
