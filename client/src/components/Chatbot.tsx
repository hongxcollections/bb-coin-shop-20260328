import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

type Msg = { role: "user" | "assistant"; content: string };

const STORAGE_KEY = "bb_chatbot_history_v1";
const WELCOME: Msg = {
  role: "assistant",
  content: "你好！我係大BB錢幣店嘅客服助手 🪙\n網站使用上有咩問題隨時問我，例如點上架、點出價、商家申請、退款等等～",
};

export function Chatbot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return [WELCOME];
  });
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const ask = trpc.chatbot.ask.useMutation();

  useEffect(() => {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages)); } catch {}
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, open]);

  const send = async () => {
    const text = input.trim();
    if (!text || ask.isPending) return;
    setInput("");
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    try {
      const history = next.slice(-10).filter(m => m !== WELCOME).map(m => ({ role: m.role, content: m.content }));
      // exclude the just-added user message from history (it's sent as `message`)
      const histForApi = history.slice(0, -1);
      const res = await ask.mutateAsync({ message: text, history: histForApi });
      setMessages(prev => [...prev, { role: "assistant", content: res.reply }]);
    } catch (e: any) {
      const msg = e?.message ?? "回覆失敗，請稍後再試";
      setMessages(prev => [...prev, { role: "assistant", content: `❌ ${msg}` }]);
      toast.error(msg);
    }
  };

  const reset = () => {
    setMessages([WELCOME]);
    try { sessionStorage.removeItem(STORAGE_KEY); } catch {}
  };

  return (
    <>
      {/* 浮動按鈕 */}
      {!open && (
        <button
          aria-label="開啟客服助手"
          onClick={() => setOpen(true)}
          className="fixed bottom-20 right-4 z-50 w-14 h-14 rounded-full bg-amber-500 hover:bg-amber-600 text-white shadow-lg flex items-center justify-center transition-all hover:scale-105 sm:bottom-6"
        >
          <MessageCircle className="w-6 h-6" />
        </button>
      )}

      {/* 對話視窗 */}
      {open && (
        <div className="fixed bottom-20 right-4 z-50 w-[calc(100vw-2rem)] max-w-sm h-[70vh] max-h-[600px] bg-white border border-amber-200 rounded-2xl shadow-2xl flex flex-col overflow-hidden sm:bottom-6">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-white">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5" />
              <div>
                <p className="font-semibold text-sm">大BB客服助手</p>
                <p className="text-[10px] opacity-90">只回答網站使用問題</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={reset}
                className="text-[11px] px-2 py-1 rounded hover:bg-white/20"
                title="清除對話"
              >
                清除
              </button>
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded hover:bg-white/20"
                aria-label="關閉"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 bg-amber-50/30">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words ${
                    m.role === "user"
                      ? "bg-amber-500 text-white rounded-br-sm"
                      : "bg-white border border-amber-100 text-gray-800 rounded-bl-sm"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {ask.isPending && (
              <div className="flex justify-start">
                <div className="bg-white border border-amber-100 px-3 py-2 rounded-2xl rounded-bl-sm">
                  <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-amber-100 p-2 bg-white">
            <div className="flex gap-2 items-end">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder="輸入你嘅問題…"
                rows={1}
                maxLength={500}
                disabled={ask.isPending}
                className="flex-1 resize-none border border-amber-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-400 max-h-24"
              />
              <Button
                size="sm"
                onClick={send}
                disabled={!input.trim() || ask.isPending}
                className="bg-amber-500 hover:bg-amber-600 text-white h-9 w-9 p-0 rounded-full flex-shrink-0"
              >
                {ask.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
