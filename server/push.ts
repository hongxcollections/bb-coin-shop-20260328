import webpush from "web-push";
import { getDb } from "./db";
import { pushSubscriptions, users } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";

let _configured = false;
function configure() {
  if (_configured) return;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subj = process.env.VAPID_SUBJECT ?? "mailto:admin@hongxcollections.com";
  if (!pub || !priv) {
    console.warn("[Push] VAPID keys missing — Web Push disabled");
    return;
  }
  webpush.setVapidDetails(subj, pub, priv);
  _configured = true;
}

export function getVapidPublicKey(): string {
  return process.env.VAPID_PUBLIC_KEY ?? "";
}

export async function savePushSubscription(
  userId: number,
  sub: { endpoint: string; keys: { p256dh: string; auth: string } },
  userAgent?: string,
) {
  const db = await getDb();
  // Upsert by endpoint
  try {
    await db.insert(pushSubscriptions).values({
      userId,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      userAgent: userAgent ?? null,
    });
  } catch {
    // Likely duplicate endpoint — update userId in case ownership changed
    await db
      .update(pushSubscriptions)
      .set({ userId, p256dh: sub.keys.p256dh, auth: sub.keys.auth, userAgent: userAgent ?? null })
      .where(eq(pushSubscriptions.endpoint, sub.endpoint));
  }
}

export async function removePushSubscription(endpoint: string, userId?: number) {
  const db = await getDb();
  if (userId != null) {
    await db.delete(pushSubscriptions).where(
      and(eq(pushSubscriptions.endpoint, endpoint), eq(pushSubscriptions.userId, userId)),
    );
  } else {
    await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
  }
}

export async function listUserSubscriptions(userId: number) {
  const db = await getDb();
  return await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  icon?: string;
}

export async function sendPushToUser(userId: number, payload: PushPayload): Promise<number> {
  configure();
  if (!_configured) return 0;
  const subs = await listUserSubscriptions(userId);
  if (subs.length === 0) return 0;
  let sent = 0;
  await Promise.all(
    subs.map(async (s) => {
      const host = (() => { try { return new URL(s.endpoint).host; } catch { return "unknown"; } })();
      const tail = s.endpoint.slice(-12);
      try {
        const res: any = await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
        );
        sent++;
        console.log(`[Push] OK user=${userId} host=${host} tail=...${tail} status=${res?.statusCode ?? '?'} ua=${(s.userAgent ?? '').slice(0, 60)}`);
      } catch (err: any) {
        const code = err?.statusCode;
        if (code === 410 || code === 404) {
          await removePushSubscription(s.endpoint).catch(() => {});
          console.warn(`[Push] EXPIRED user=${userId} host=${host} tail=...${tail} status=${code} — cleaned up`);
        } else {
          console.error(`[Push] FAIL user=${userId} host=${host} tail=...${tail} status=${code ?? '?'} msg=${err?.message ?? err}`);
        }
      }
    }),
  );
  return sent;
}

/** 精準推送到指定 endpoint（只推那一個瀏覽器） */
export async function sendPushToEndpoint(endpoint: string, payload: PushPayload): Promise<boolean> {
  configure();
  if (!_configured) return false;
  const db = await getDb();
  const rows = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
  if (rows.length === 0) return false;
  const s = rows[0];
  const host = (() => { try { return new URL(s.endpoint).host; } catch { return "unknown"; } })();
  const tail = s.endpoint.slice(-12);
  try {
    const res: any = await webpush.sendNotification(
      { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
      JSON.stringify(payload),
    );
    console.log(`[Push] OK (endpoint) user=${s.userId} host=${host} tail=...${tail} status=${res?.statusCode ?? '?'}`);
    return true;
  } catch (err: any) {
    const code = err?.statusCode;
    if (code === 410 || code === 404) {
      await removePushSubscription(s.endpoint).catch(() => {});
      console.warn(`[Push] EXPIRED (endpoint) host=${host} tail=...${tail} status=${code} — cleaned up`);
    } else {
      console.error(`[Push] FAIL (endpoint) host=${host} tail=...${tail} status=${code ?? '?'} msg=${err?.message ?? err}`);
    }
    return false;
  }
}

// 快速判斷會員等級是否 silver+
export async function isSilverOrAbove(userId: number): Promise<boolean> {
  const db = await getDb();
  const rows = await db.select({ memberLevel: users.memberLevel }).from(users).where(eq(users.id, userId));
  const lvl = rows[0]?.memberLevel;
  return lvl === "silver" || lvl === "gold" || lvl === "vip";
}
