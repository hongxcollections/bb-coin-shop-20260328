import { useEffect, useRef, useState, useCallback } from "react";

export type ChatWSMessage = {
  id: number;
  roomId: number;
  senderId: number;
  senderRole: "bidder" | "merchant" | "system";
  messageType: "text" | "image" | "broadcast";
  content: string | null;
  imageUrl: string | null;
  createdAt: string | Date;
};

type WSEvent =
  | { type: "connected"; userId: number }
  | { type: "subscribed"; roomId: number }
  | { type: "message"; message: ChatWSMessage }
  | { type: "unread:refresh" }
  | { type: "pong" }
  | { type: "error"; error: string };

interface UseChatWebSocketOptions {
  enabled?: boolean;
  roomId?: number | null;
  onMessage?: (msg: ChatWSMessage) => void;
  onUnreadRefresh?: () => void;
}

export function useChatWebSocket({
  enabled = true,
  roomId = null,
  onMessage,
  onUnreadRefresh,
}: UseChatWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const subscribedRoomRef = useRef<number | null>(null);
  const wantedRoomRef = useRef<number | null>(roomId);
  const onMessageRef = useRef(onMessage);
  const onUnreadRefreshRef = useRef(onUnreadRefresh);
  const [connected, setConnected] = useState(false);

  // 保持 callback ref 為最新
  useEffect(() => { onMessageRef.current = onMessage; }, [onMessage]);
  useEffect(() => { onUnreadRefreshRef.current = onUnreadRefresh; }, [onUnreadRefresh]);
  useEffect(() => { wantedRoomRef.current = roomId; }, [roomId]);

  const subscribe = useCallback((rid: number | null) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    if (rid && subscribedRoomRef.current !== rid) {
      ws.send(JSON.stringify({ type: "subscribe", roomId: rid }));
      subscribedRoomRef.current = rid;
    } else if (!rid && subscribedRoomRef.current !== null) {
      ws.send(JSON.stringify({ type: "unsubscribe" }));
      subscribedRoomRef.current = null;
    }
  }, []);

  // Subscribe / unsubscribe when roomId changes (separate effect to avoid reconnect)
  useEffect(() => {
    if (connected) subscribe(roomId);
  }, [roomId, connected, subscribe]);

  useEffect(() => {
    if (!enabled) return;

    let alive = true;

    const connect = () => {
      if (!alive) return;
      const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
      const url = `${proto}//${window.location.host}/ws/chat`;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!alive) { ws.close(); return; }
        setConnected(true);
        // 重新訂閱
        const rid = wantedRoomRef.current;
        subscribedRoomRef.current = null;
        if (rid) {
          ws.send(JSON.stringify({ type: "subscribe", roomId: rid }));
          subscribedRoomRef.current = rid;
        }
        // 心跳
        pingTimerRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "ping" }));
          }
        }, 30_000);
      };

      ws.onmessage = (ev) => {
        try {
          const evt: WSEvent = JSON.parse(ev.data);
          if (evt.type === "message") {
            onMessageRef.current?.(evt.message);
            // 收新訊息亦觸發 unread refresh (如果唔係自己 send)
            onUnreadRefreshRef.current?.();
          } else if (evt.type === "unread:refresh") {
            onUnreadRefreshRef.current?.();
          }
        } catch {
          /* ignore */
        }
      };

      ws.onclose = () => {
        setConnected(false);
        subscribedRoomRef.current = null;
        if (pingTimerRef.current) {
          clearInterval(pingTimerRef.current);
          pingTimerRef.current = null;
        }
        if (alive) {
          // 自動重連 (3s 延遲)
          reconnectTimerRef.current = setTimeout(connect, 3000);
        }
      };

      ws.onerror = () => {
        try { ws.close(); } catch { /* ignore */ }
      };
    };

    connect();

    return () => {
      alive = false;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (pingTimerRef.current) clearInterval(pingTimerRef.current);
      if (wsRef.current) {
        try { wsRef.current.close(); } catch { /* ignore */ }
      }
      wsRef.current = null;
      setConnected(false);
    };
  }, [enabled]);

  return { connected };
}
