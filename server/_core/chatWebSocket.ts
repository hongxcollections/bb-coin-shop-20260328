import { WebSocketServer, WebSocket } from "ws";
import type { Server as HttpServer, IncomingMessage } from "http";
import { parse as parseUrl } from "url";
import { sdk } from "./sdk";
import { getChatRoomById, listChatMessages } from "../db";
import { sendPushToUser, type PushPayload } from "../push";
import type { AuctionChatMessage } from "../../drizzle/schema";

type ClientInfo = {
  userId: number;
  roomId: number | null;
  ws: WebSocket;
};

const clients = new Set<ClientInfo>();

const offlineDebounce = new Map<number, { count: number; preview: string; senderName: string; roomId: number; timer: NodeJS.Timeout }>();
const OFFLINE_DEBOUNCE_MS = 30_000;

function isUserOnlineForRoom(userId: number, roomId: number): boolean {
  for (const c of clients) {
    if (c.userId === userId && c.roomId === roomId && c.ws.readyState === WebSocket.OPEN) return true;
  }
  return false;
}

function isUserAnywhereOnline(userId: number): boolean {
  for (const c of clients) {
    if (c.userId === userId && c.ws.readyState === WebSocket.OPEN) return true;
  }
  return false;
}

function broadcastMessageToRoom(roomId: number, payload: object) {
  const data = JSON.stringify(payload);
  for (const c of clients) {
    if (c.roomId === roomId && c.ws.readyState === WebSocket.OPEN) {
      try { c.ws.send(data); } catch { /* ignore */ }
    }
  }
}

/** 向指定 user (across all 視窗) 推送 unread 計數刷新訊號。 */
function pushUnreadSignal(userId: number) {
  const data = JSON.stringify({ type: 'unread:refresh' });
  for (const c of clients) {
    if (c.userId === userId && c.ws.readyState === WebSocket.OPEN) {
      try { c.ws.send(data); } catch { /* ignore */ }
    }
  }
}

/** 公開介面：當有新訊息插入後呼叫，廣播畀 room 內所有人 + 觸發 push debounce。 */
export async function notifyNewChatMessage(opts: {
  roomId: number;
  message: AuctionChatMessage;
  recipientUserId: number;
  senderName: string;
}) {
  // 廣播畀正在睇緊呢個 room 嘅人
  broadcastMessageToRoom(opts.roomId, {
    type: 'message',
    message: {
      id: opts.message.id,
      roomId: opts.message.roomId,
      senderId: opts.message.senderId,
      senderRole: opts.message.senderRole,
      messageType: opts.message.messageType,
      content: opts.message.content,
      imageUrl: opts.message.imageUrl,
      createdAt: opts.message.createdAt,
    },
  });

  // 通知收件人刷新 unread badge
  pushUnreadSignal(opts.recipientUserId);

  // 收件人若沒在睇緊呢個 room → 排程 push debounce
  if (!isUserOnlineForRoom(opts.recipientUserId, opts.roomId)) {
    const preview = opts.message.messageType === 'image'
      ? '[圖片]'
      : opts.message.messageType === 'broadcast'
        ? `[廣播] ${(opts.message.content ?? '').slice(0, 50)}`
        : (opts.message.content ?? '').slice(0, 50);

    const existing = offlineDebounce.get(opts.recipientUserId);
    if (existing) {
      existing.count += 1;
      existing.preview = preview;
      existing.roomId = opts.roomId;
      existing.senderName = opts.senderName;
      // 重設 timer (debounce reset)
      clearTimeout(existing.timer);
      existing.timer = setTimeout(() => flushDebounce(opts.recipientUserId), OFFLINE_DEBOUNCE_MS);
    } else {
      const timer = setTimeout(() => flushDebounce(opts.recipientUserId), OFFLINE_DEBOUNCE_MS);
      offlineDebounce.set(opts.recipientUserId, {
        count: 1,
        preview,
        senderName: opts.senderName,
        roomId: opts.roomId,
        timer,
      });
    }
  }
}

async function flushDebounce(userId: number) {
  const entry = offlineDebounce.get(userId);
  if (!entry) return;
  offlineDebounce.delete(userId);

  // 如果用戶已上線並打開 chat → 唔需要 push
  if (isUserAnywhereOnline(userId)) {
    return;
  }

  const title = entry.count === 1
    ? `${entry.senderName} 傳送咗訊息`
    : `${entry.senderName} 傳送咗 ${entry.count} 條訊息`;
  const payload: PushPayload = {
    title,
    body: entry.preview || '（按此查看）',
    url: `/messages/${entry.roomId}`,
    tag: `chat-${entry.roomId}`,
  };
  try {
    await sendPushToUser(userId, payload);
  } catch (e) {
    console.error('[chatWS] push send error:', e);
  }
}

export function attachChatWebSocket(server: HttpServer) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', async (req: IncomingMessage, socket, head) => {
    const url = parseUrl(req.url ?? '');
    if (url.pathname !== '/ws/chat') return; // 唔係 chat 路徑就唔處理 (其他 ws 可共用 server)

    let userId: number | null = null;
    try {
      const user = await sdk.authenticateRequest(req as any);
      if (user) userId = user.id;
    } catch { /* ignore */ }

    if (!userId) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      const client: ClientInfo = { userId: userId!, roomId: null, ws };
      clients.add(client);

      ws.on('message', async (raw) => {
        try {
          const msg = JSON.parse(raw.toString());
          if (msg.type === 'subscribe' && typeof msg.roomId === 'number') {
            // 驗證用戶有權限睇呢個 room
            const room = await getChatRoomById(msg.roomId);
            if (!room || (room.bidderId !== client.userId && room.merchantId !== client.userId)) {
              ws.send(JSON.stringify({ type: 'error', error: 'forbidden' }));
              return;
            }
            client.roomId = msg.roomId;
            // 取消對方還在 debounce 中嘅推送（用戶已上線睇緊）
            const pending = offlineDebounce.get(client.userId);
            if (pending && pending.roomId === msg.roomId) {
              clearTimeout(pending.timer);
              offlineDebounce.delete(client.userId);
            }
            ws.send(JSON.stringify({ type: 'subscribed', roomId: msg.roomId }));
          } else if (msg.type === 'unsubscribe') {
            client.roomId = null;
          } else if (msg.type === 'ping') {
            ws.send(JSON.stringify({ type: 'pong' }));
          }
        } catch (e) {
          console.error('[chatWS] message parse error:', e);
        }
      });

      ws.on('close', () => {
        clients.delete(client);
      });

      ws.on('error', () => {
        clients.delete(client);
      });

      ws.send(JSON.stringify({ type: 'connected', userId: client.userId }));
    });
  });

  console.log('[chatWS] WebSocket server attached at /ws/chat');
}
