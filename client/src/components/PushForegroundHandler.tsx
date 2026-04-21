import { useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

/**
 * 監聽 service worker 推播訊息，喺前景時：
 * - 彈出站內 toast（即使瀏覽器係前景都睇到）
 * - 播提示音（Web Audio API 即時合成「叮咚」）
 * - 即時 invalidate auction queries（毋須等 polling）
 */
export function PushForegroundHandler() {
  const utils = trpc.useUtils();
  const audioCtxRef = useRef<AudioContext | null>(null);

  // 確保用戶任何 click/touch 後 unlock AudioContext（瀏覽器 autoplay policy）
  useEffect(() => {
    const unlock = () => {
      if (!audioCtxRef.current) {
        try {
          const Ctor = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
          if (Ctor) audioCtxRef.current = new Ctor();
        } catch {}
      }
      if (audioCtxRef.current?.state === "suspended") {
        audioCtxRef.current.resume().catch(() => {});
      }
    };
    window.addEventListener("click", unlock, { once: false, passive: true });
    window.addEventListener("touchstart", unlock, { once: false, passive: true });
    return () => {
      window.removeEventListener("click", unlock);
      window.removeEventListener("touchstart", unlock);
    };
  }, []);

  const playChime = () => {
    try {
      let ctx = audioCtxRef.current;
      if (!ctx) {
        const Ctor = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
        if (!Ctor) return;
        ctx = new Ctor();
        audioCtxRef.current = ctx;
      }
      if (ctx.state === "suspended") ctx.resume().catch(() => {});

      // 「叮—咚」雙音：880Hz → 660Hz
      const playTone = (freq: number, startAt: number, duration: number) => {
        const osc = ctx!.createOscillator();
        const gain = ctx!.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        osc.connect(gain);
        gain.connect(ctx!.destination);
        const t0 = ctx!.currentTime + startAt;
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.exponentialRampToValueAtTime(0.5, t0 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
        osc.start(t0);
        osc.stop(t0 + duration + 0.05);
      };
      playTone(880, 0, 0.25);
      playTone(660, 0.18, 0.32);
    } catch {}
  };

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    const handler = (event: MessageEvent) => {
      const msg = event.data;
      if (!msg || msg.type !== "PUSH") return;
      const p = msg.payload || {};
      const title = p.title || "通知";
      const body = p.body || "";
      const url = p.url || "";

      // 1. 站內 toast — 套用 --popup-* 黑底主題
      toast(title, {
        description: body,
        duration: 8000,
        className: "bb-toast-success",
      });

      // 2. 播提示音
      playChime();

      // 3. 即時刷新 auction 相關 query
      const m = url.match(/\/auctions\/(\d+)/);
      if (m) {
        const auctionId = parseInt(m[1], 10);
        utils.auctions.detail.invalidate({ id: auctionId }).catch(() => {});
        utils.auctions.auctionBidHistory.invalidate({ auctionId }).catch(() => {});
        utils.auctions.myBids.invalidate().catch(() => {});
        utils.auctions.list.invalidate().catch(() => {});
      }
    };

    navigator.serviceWorker.addEventListener("message", handler);
    return () => navigator.serviceWorker.removeEventListener("message", handler);
  }, [utils]);

  return null;
}
