import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";

const STORAGE_KEY = "bb-push-volume";

export function getPushVolume(): number {
  if (typeof window === "undefined") return 1;
  const v = parseFloat(localStorage.getItem(STORAGE_KEY) ?? "1");
  if (isNaN(v)) return 1;
  return Math.max(0, Math.min(1, v));
}

export function PushVolumeSlider() {
  const [vol, setVol] = useState<number>(() => getPushVolume());
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(vol));
  }, [vol]);

  const preview = (v: number) => {
    if (previewTimer.current) clearTimeout(previewTimer.current);
    previewTimer.current = setTimeout(() => {
      try {
        const a = audioRef.current;
        if (!a) return;
        a.currentTime = 0;
        a.volume = v;
        a.play().catch(() => {});
      } catch {}
    }, 250);
  };

  const pct = Math.round(vol * 100);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {vol > 0 ? (
            <Volume2 className="w-4 h-4 text-amber-600" />
          ) : (
            <VolumeX className="w-4 h-4 text-muted-foreground" />
          )}
          <div>
            <p className="text-sm font-medium leading-none">推播鈴聲音量</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              收到出價被超越等推播時嘅提示音大細
            </p>
          </div>
        </div>
        <span className="text-xs font-medium text-amber-700 min-w-[3ch] text-right">
          {pct}%
        </span>
      </div>
      <div className="px-3 py-2 rounded-lg bg-amber-50/60 border border-amber-100">
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={pct}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10) / 100;
            setVol(v);
            preview(v);
          }}
          className="w-full accent-amber-500"
          aria-label="推播鈴聲音量"
        />
        <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
          <span>靜音</span>
          <span>細</span>
          <span>中</span>
          <span>大</span>
        </div>
      </div>
      <audio ref={audioRef} src="/notify.wav" preload="auto" playsInline />
    </div>
  );
}
