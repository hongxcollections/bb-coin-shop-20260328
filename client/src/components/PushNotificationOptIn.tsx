import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Bell, BellOff, BellRing, Loader2 } from "lucide-react";
import { toast } from "sonner";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
  return out;
}

export function PushNotificationOptIn() {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);

  const { data: keyData } = trpc.push.getPublicKey.useQuery();
  const subscribeMut = trpc.push.subscribe.useMutation();
  const unsubscribeMut = trpc.push.unsubscribe.useMutation();
  const testMut = trpc.push.test.useMutation();

  useEffect(() => {
    const ok = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    setSupported(ok);
    if (!ok) return;
    setPermission(Notification.permission);
    navigator.serviceWorker.getRegistration("/push-sw.js").then(async (reg) => {
      if (reg) {
        const sub = await reg.pushManager.getSubscription();
        setSubscribed(!!sub);
      }
    }).catch(() => {});
  }, []);

  const enable = async () => {
    if (!keyData?.publicKey) { toast.error("推播服務未配置，請聯絡管理員"); return; }
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.register("/push-sw.js");
      await navigator.serviceWorker.ready;
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") { toast.error("已拒絕通知權限，請到瀏覽器設定開啟"); setBusy(false); return; }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(keyData.publicKey),
      });
      const json = sub.toJSON();
      await subscribeMut.mutateAsync({
        endpoint: json.endpoint!,
        keys: { p256dh: json.keys!.p256dh, auth: json.keys!.auth },
        userAgent: navigator.userAgent.slice(0, 250),
      });
      setSubscribed(true);
      toast.success("推播通知已啟用！");
    } catch (e: any) {
      toast.error("啟用失敗：" + (e?.message ?? "未知錯誤"));
    } finally { setBusy(false); }
  };

  const disable = async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/push-sw.js");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await unsubscribeMut.mutateAsync({ endpoint: sub.endpoint });
        await sub.unsubscribe();
      }
      setSubscribed(false);
      toast.success("已關閉推播通知");
    } catch (e: any) {
      toast.error("關閉失敗：" + (e?.message ?? "未知錯誤"));
    } finally { setBusy(false); }
  };

  const test = async () => {
    setBusy(true);
    try {
      const r = await testMut.mutateAsync();
      if (r.sent > 0) toast.success(`已發送測試推播（${r.sent} 個裝置）`);
      else toast.error("無已啟用裝置");
    } catch (e: any) {
      toast.error("測試失敗：" + (e?.message ?? "未知錯誤"));
    } finally { setBusy(false); }
  };

  if (supported === null) return null;
  if (!supported) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800 flex items-start gap-2">
        <BellOff className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold">您的瀏覽器不支援推播通知</p>
          <p className="text-xs mt-1">請使用最新版 Chrome / Edge / Firefox / Safari（iOS 16.4+），並把網站「加到主畫面」啟用 PWA 模式。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-lg p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center flex-shrink-0">
          <BellRing className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm text-amber-900">即時推播通知</h3>
          <p className="text-xs text-amber-700 mt-0.5">
            開啟後，當您關注的拍賣有新出價，{subscribed ? "瀏覽器即時彈出通知（毋須查看電郵）" : "毋須等電郵，瀏覽器秒級彈出通知"}。
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {!subscribed ? (
          <Button size="sm" onClick={enable} disabled={busy} className="bg-amber-600 hover:bg-amber-700 text-white">
            {busy ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Bell className="w-4 h-4 mr-1" />}
            啟用推播
          </Button>
        ) : (
          <>
            <Button size="sm" variant="outline" onClick={disable} disabled={busy} className="border-amber-300 text-amber-700">
              {busy ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <BellOff className="w-4 h-4 mr-1" />}
              關閉
            </Button>
            <Button size="sm" variant="outline" onClick={test} disabled={busy} className="border-amber-300 text-amber-700">
              發送測試
            </Button>
            <span className="text-xs text-green-700 bg-green-50 px-2 py-1 rounded-full self-center">✓ 已啟用</span>
          </>
        )}
      </div>
      {permission === "denied" && (
        <p className="text-xs text-red-600">⚠ 已拒絕通知權限。請到瀏覽器設定 → 網站權限 → 通知 → 開啟。</p>
      )}
    </div>
  );
}
