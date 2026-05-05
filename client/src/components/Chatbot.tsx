import { useState, useRef, useEffect, useCallback } from "react";
import { MessageCircle, X, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

type Msg = { role: "user" | "assistant"; content: string };
type Pos = { x: number; y: number };

const STORAGE_KEY = "bb_chatbot_history_v1";
const POS_KEY = "bb_chatbot_pos_v1";
const HIDDEN_KEY = "bb_chatbot_hidden_v1";
const WELCOME: Msg = {
  role: "assistant",
  content: "你好！我係 hongxcollections.com 網站嘅AI客服助手 🪙\n網站使用上有咩問題隨時問我，例如點上架、點出價、商家申請、退款等等～",
};

const BTN_SIZE = 56;
const PANEL_W = 360;
const PANEL_H = 600;

function clampPos(p: Pos, w: number, h: number): Pos {
  if (typeof window === "undefined") return p;
  const maxX = Math.max(0, window.innerWidth - w);
  const maxY = Math.max(0, window.innerHeight - h);
  return {
    x: Math.min(Math.max(0, p.x), maxX),
    y: Math.min(Math.max(0, p.y), maxY),
  };
}

function defaultPos(w: number, h: number): Pos {
  if (typeof window === "undefined") return { x: 16, y: 16 };
  return { x: window.innerWidth - w - 16, y: window.innerHeight - h - 80 };
}

export function Chatbot() {
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState<boolean>(() => {
    try { return sessionStorage.getItem(HIDDEN_KEY) === "1"; } catch { return false; }
  });
  const [pos, setPos] = useState<Pos>(() => {
    try {
      const raw = localStorage.getItem(POS_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return defaultPos(BTN_SIZE, BTN_SIZE);
  });
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
  const { data: siteSettings } = trpc.siteSettings.getAll.useQuery(undefined, { staleTime: 60_000 });
  const chatbotEnabled = ((siteSettings as Record<string, string> | undefined)?.chatbotEnabled ?? "true") !== "false";

  // drag state
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number; moved: boolean; w: number; h: number } | null>(null);

  useEffect(() => {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages)); } catch {}
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, open]);

  // keep widget in viewport on resize
  useEffect(() => {
    const onResize = () => {
      const w = open ? PANEL_W : BTN_SIZE;
      const h = open ? PANEL_H : BTN_SIZE;
      setPos(p => clampPos(p, w, h));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [open]);

  // persist position
  useEffect(() => {
    try { localStorage.setItem(POS_KEY, JSON.stringify(pos)); } catch {}
  }, [pos]);

  const startDrag = useCallback((clientX: number, clientY: number) => {
    const w = open ? PANEL_W : BTN_SIZE;
    const h = open ? PANEL_H : BTN_SIZE;
    dragRef.current = { startX: clientX, startY: clientY, origX: pos.x, origY: pos.y, moved: false, w, h };
  }, [open, pos.x, pos.y]);

  const onMove = useCallback((clientX: number, clientY: number) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = clientX - d.startX;
    const dy = clientY - d.startY;
    if (!d.moved && Math.hypot(dx, dy) < 4) return;
    d.moved = true;
    setPos(clampPos({ x: d.origX + dx, y: d.origY + dy }, d.w, d.h));
  }, []);

  const endDrag = useCallback(() => {
    const moved = dragRef.current?.moved ?? false;
    dragRef.current = null;
    return moved;
  }, []);

  // global listeners while dragging
  useEffect(() => {
    const mm = (e: MouseEvent) => onMove(e.clientX, e.clientY);
    const mu = () => { dragRef.current = null; };
    const tm = (e: TouchEvent) => { if (e.touches[0]) onMove(e.touches[0].clientX, e.touches[0].clientY); };
    const tu = () => { dragRef.current = null; };
    window.addEventListener("mousemove", mm);
    window.addEventListener("mouseup", mu);
    window.addEventListener("touchmove", tm, { passive: true });
    window.addEventListener("touchend", tu);
    return () => {
      window.removeEventListener("mousemove", mm);
      window.removeEventListener("mouseup", mu);
      window.removeEventListener("touchmove", tm);
      window.removeEventListener("touchend", tu);
    };
  }, [onMove]);

  const send = async () => {
    const text = input.trim();
    if (!text || ask.isPending) return;
    setInput("");
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    try {
      const history = next.slice(-10).filter(m => m !== WELCOME).map(m => ({ role: m.role, content: m.content }));
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

  const hideWidget = () => {
    setOpen(false);
    setHidden(true);
    try { sessionStorage.setItem(HIDDEN_KEY, "1"); } catch {}
    toast.info("AI客服已關閉，重新整理頁面可重新顯示");
  };

  if (hidden) return null;
  if (!chatbotEnabled) return null;

  return (
    <>
      {/* 浮動按鈕 (可拖曳) */}
      {!open && (
        <div
          className="fixed z-50 select-none"
          style={{ left: pos.x, top: pos.y, width: BTN_SIZE, height: BTN_SIZE, touchAction: "none" }}
        >
          <button
            aria-label="開啟AI客服助手"
            onMouseDown={(e) => { e.preventDefault(); startDrag(e.clientX, e.clientY); }}
            onMouseUp={(e) => { e.preventDefault(); const moved = endDrag(); if (!moved) setOpen(true); }}
            onTouchStart={(e) => { const t = e.touches[0]; if (t) startDrag(t.clientX, t.clientY); }}
            onTouchEnd={(e) => { const moved = endDrag(); if (!moved) { e.preventDefault(); setOpen(true); } }}
            className="w-full h-full rounded-full bg-amber-500 hover:bg-amber-600 text-white shadow-lg flex items-center justify-center transition-colors cursor-grab active:cursor-grabbing"
          >
            <MessageCircle className="w-6 h-6 pointer-events-none" />
          </button>
          <button
            aria-label="關閉AI客服"
            onClick={hideWidget}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-gray-700 hover:bg-gray-900 text-white flex items-center justify-center shadow"
            title="關閉AI客服"
          >
            <X className="w-3 h-3" />
          </button>
          {/* icon 下方細字標籤 */}
          <span
            aria-hidden="true"
            className="absolute left-1/2 -translate-x-1/2 top-full mt-0.5 text-[9px] leading-none font-medium text-amber-700 bg-white/85 rounded px-1 py-0.5 whitespace-nowrap pointer-events-none shadow-sm"
          >
            AI客服助手
          </span>
        </div>
      )}

      {/* 對話視窗 (可拖曳 header) */}
      {open && (() => {
        const w = Math.min(PANEL_W, typeof window !== "undefined" ? window.innerWidth - 16 : PANEL_W);
        const h = Math.min(PANEL_H, typeof window !== "undefined" ? window.innerHeight - 16 : PANEL_H);
        const clamped = clampPos(pos, w, h);
        return (
          <div
            className="fixed z-50 bg-white border border-amber-200 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
            style={{ left: clamped.x, top: clamped.y, width: w, height: h }}
          >
            {/* Header (drag handle) */}
            <div
              className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-white cursor-grab active:cursor-grabbing select-none"
              style={{ touchAction: "none" }}
              onMouseDown={(e) => { startDrag(e.clientX, e.clientY); }}
              onTouchStart={(e) => { const t = e.touches[0]; if (t) startDrag(t.clientX, t.clientY); }}
            >
              <div className="flex items-center gap-2 pointer-events-none">
                <MessageCircle className="w-5 h-5" />
                <div>
                  <p className="font-semibold text-sm">AI客服助手</p>
                  <p className="text-[10px] opacity-90">只回答網站使用問題 · 可拖曳移動</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onMouseDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                  onClick={reset}
                  className="text-[11px] px-2 py-1 rounded hover:bg-white/20"
                  title="清除對話"
                >
                  清除
                </button>
                <button
                  onMouseDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                  onClick={() => setOpen(false)}
                  className="p-1 rounded hover:bg-white/20"
                  aria-label="收起"
                  title="收起"
                >
                  <X className="w-4 h-4" />
                </button>
                <button
                  onMouseDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                  onClick={hideWidget}
                  className="text-[11px] px-2 py-1 rounded hover:bg-white/20"
                  title="完全關閉（重新整理頁面可恢復）"
                >
                  關閉
                </button>
              </div>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 bg-amber-50/30">
              {/* 推廣訊息 (每次打開都顯示) */}
              <div className="flex justify-start">
                <div className="max-w-[92%] px-3 py-2.5 rounded-2xl rounded-bl-sm text-[12.5px] leading-relaxed whitespace-pre-wrap break-words bg-gradient-to-br from-amber-50 to-amber-100 border border-amber-300 text-gray-800 shadow-sm">
                  <a
                    href="https://hongxcollections.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block mb-2 -mx-1 -mt-1"
                  >
                    <img
                      src="/chatbot-promo.png"
                      alt="HongX Collections 全港開放式錢幣拍賣平台"
                      className="w-full rounded-lg border border-amber-200"
                      loading="lazy"
                    />
                  </a>
                  <p className="font-semibold text-amber-800 mb-1">仲喺 Facebook 辛苦拍賣緊？轉用 HongX Collections 啦！🚀</p>
                  <p className="text-gray-700">
                    仲要每幾分鐘「擦貼」先知最新出價？仲要對住個鐘幫買家做倒數？拍賣 10 幾件貨就忙到氣都咳？
                    {"\n"}HongX Collections 幫你將拍賣全面自動化！
                    {"\n\n"}✅ <span className="font-medium">公開平台</span>：無論係收藏家想搵心頭好，定係商戶想出售藏品，人人都可以註冊！
                    {"\n"}✅ <span className="font-medium">商戶入駐超簡單</span>：唔洗繁瑣手續，揀好「月費 + 保證金」套餐，即刻可以喺網頁版上架開賣。
                    {"\n"}✅ <span className="font-medium">全自動系統</span>：
                    {"\n"}　• 自動更新出價，唔洗人手回覆「最高出價」
                    {"\n"}　• 系統自動倒數成交，唔洗再盯住手機
                    {"\n"}　• 一次過管理幾多件貨都係咁輕鬆！
                    {"\n\n"}而家就嚟開舖，體驗真正嘅專業拍賣：
                  </p>
                  <a
                    href="https://hongxcollections.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block mt-1 text-amber-700 underline font-medium break-all"
                  >
                    🔗 https://hongxcollections.com/
                  </a>
                  <p className="mt-2 text-[11px] text-amber-700/80">
                    #錢幣收藏 #拍賣平台 #HongXCollections #自動拍賣 #告別FB拍賣 #商戶入駐
                  </p>
                </div>
              </div>
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
        );
      })()}
    </>
  );
}
