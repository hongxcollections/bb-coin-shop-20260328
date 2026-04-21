import { useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { getPushVolume } from "./PushVolumeSlider";

/**
 * 監聽 service worker 推播訊息，喺前景時：
 * - 彈出站內 toast
 * - 播提示音（HTMLAudioElement 主，Web Audio fallback）
 * - 即時 invalidate auction queries
 */
export function PushForegroundHandler() {
  const utils = trpc.useUtils();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioReadyRef = useRef(false);

  // 用戶任何 click/touch 後預熱 audio（解 autoplay policy）
  useEffect(() => {
    const unlock = () => {
      if (!audioRef.current) return;
      if (audioReadyRef.current) return;
      const a = audioRef.current;
      a.muted = true;
      a.play().then(() => {
        a.pause();
        a.currentTime = 0;
        a.muted = false;
        audioReadyRef.current = true;
      }).catch(() => {
        a.muted = false;
      });
    };
    window.addEventListener("click", unlock, { passive: true });
    window.addEventListener("touchstart", unlock, { passive: true });
    return () => {
      window.removeEventListener("click", unlock);
      window.removeEventListener("touchstart", unlock);
    };
  }, []);

  const playChime = () => {
    const v = getPushVolume();
    if (v <= 0) return; // 用戶選擇靜音
    const a = audioRef.current;
    if (a) {
      try {
        a.currentTime = 0;
        a.volume = v;
        const p = a.play();
        if (p && typeof p.then === "function") {
          p.catch(() => playChimeWebAudio(v));
        }
        return;
      } catch {
        // fall through
      }
    }
    playChimeWebAudio(v);
  };

  // Fallback：Web Audio API 即時合成
  const playChimeWebAudio = (vol: number) => {
    try {
      const Ctor = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
      if (!Ctor) return;
      const ctx = new Ctor();
      const peak = 0.5 * vol;
      const playTone = (freq: number, startAt: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        osc.connect(gain);
        gain.connect(ctx.destination);
        const t0 = ctx.currentTime + startAt;
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.exponentialRampToValueAtTime(Math.max(peak, 0.001), t0 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
        osc.start(t0);
        osc.stop(t0 + duration + 0.05);
      };
      playTone(880, 0, 0.25);
      playTone(660, 0.18, 0.32);
      setTimeout(() => ctx.close().catch(() => {}), 800);
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

      toast(title, {
        description: body,
        duration: 8000,
        className: "bb-toast-success",
      });

      playChime();

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

  return (
    <audio
      ref={audioRef}
      src="/notify.wav"
      preload="auto"
      playsInline
    />
  );
}
