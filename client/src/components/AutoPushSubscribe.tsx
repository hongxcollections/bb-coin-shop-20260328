import { useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
  return out;
}

/**
 * 全站靜默自動訂閱推播
 * 條件：已登入 + 瀏覽器支援 + 已授權通知 + 仲未訂閱
 * 用戶毋須做任何事 — 只要曾經授權過一次，之後每次入站自動恢復訂閱
 */
export function AutoPushSubscribe() {
  const { isAuthenticated } = useAuth();
  const { data: keyData } = trpc.push.getPublicKey.useQuery(undefined, { enabled: isAuthenticated });
  const subscribeMut = trpc.push.subscribe.useMutation();
  const triedRef = useRef(false);

  useEffect(() => {
    if (triedRef.current) return;
    if (!isAuthenticated) return;
    if (!keyData?.publicKey) return;
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    triedRef.current = true;

    (async () => {
      try {
        const reg = await navigator.serviceWorker.register("/push-sw.js");
        await navigator.serviceWorker.ready;
        let sub = await reg.pushManager.getSubscription();
        if (!sub) {
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(keyData.publicKey),
          });
        }
        const json = sub.toJSON();
        await subscribeMut.mutateAsync({
          endpoint: json.endpoint!,
          keys: { p256dh: json.keys!.p256dh, auth: json.keys!.auth },
          userAgent: navigator.userAgent.slice(0, 250),
        });
      } catch (e) {
        console.warn("[AutoPush] silent subscribe failed:", e);
      }
    })();
  }, [isAuthenticated, keyData?.publicKey, subscribeMut]);

  return null;
}
