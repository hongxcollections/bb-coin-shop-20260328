import { useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

/**
 * 監聽 service worker 推播訊息，喺前景時：
 * - 彈出站內 toast（即使瀏覽器係前景都睇到）
 * - 播提示音
 * - 即時 invalidate auction queries（毋須等 polling 10 秒）
 */
export function PushForegroundHandler() {
  const utils = trpc.useUtils();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    const handler = (event: MessageEvent) => {
      const msg = event.data;
      if (!msg || msg.type !== "PUSH") return;
      const p = msg.payload || {};
      const title = p.title || "通知";
      const body = p.body || "";
      const url = p.url || "";

      // 1. 站內 toast（用戶睇緊網頁都會見到）
      toast(title, {
        description: body,
        duration: 8000,
        action: url
          ? { label: "查看", onClick: () => { window.location.href = url; } }
          : undefined,
      });

      // 2. 播提示音（短促叮一聲）
      try { audioRef.current?.play().catch(() => {}); } catch {}

      // 3. 即時刷新 auction 相關 query（如果 url 包含 auctionId）
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

  // 預載一個簡短嘅 ping 提示音（base64 wav，約 0.15 秒「叮」）
  return (
    <audio
      ref={audioRef}
      preload="auto"
      src="data:audio/wav;base64,UklGRiQEAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAEAAAAAAAACAAQABgAIAAoADAAOABAAEgAUABYAGAAaABwAHgAgACIAJAAmACgAKgAsAC4AMAAyADQANgA4ADwAPABEAEYASgBOAFAAVABWAFoAXABgAGIAZgBoAGoAbgBwAHIAdAB2AHgAegB8AH4AfgCAAIAAggCCAIQAhACEAIQAhACEAIQAhACCAIIAgACAAH4AfgB8AHoAeAB2AHQAcgBwAG4AbABqAGYAYgBeAFwAVgBSAEwASABEAD4AOAA0AC4AKgAkAB4AGAASAA4ACAACAPz/9v/y/+z/5v/g/9z/1v/Q/8z/xv/A/7z/uv+0/7D/rP+o/6T/oP+e/5z/mv+W/5T/lP+S/5L/kP+Q/5L/kv+S/5L/lP+W/5b/mP+a/5z/oP+i/6T/qP+s/67/sv+0/7j/uv++/8L/xP/I/8r/zv/Q/9T/2P/a/9z/4P/i/+T/5v/q/+r/7P/u/+7/8P/w//L/8v/y//L/8v/y//L/8v/y//L/8v/y//L/8v/y//L/8v/y//L/8v/y//L/8v/y//L/8v/y//L/8v/y//L/8v/y//L/8v/y//L/8v/y//L/"
    />
  );
}
