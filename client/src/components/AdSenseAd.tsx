import { useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";

interface AdSenseAdProps {
  slot: string;
  format?: "auto" | "rectangle" | "horizontal" | "vertical";
  width?: number;
  height?: number;
  className?: string;
}

export default function AdSenseAd({ slot, format = "auto", width, height, className = "" }: AdSenseAdProps) {
  const { data: settings } = trpc.siteSettings.getAll.useQuery();
  const s = (settings as Record<string, string> | undefined) ?? {};
  const enabled = s.adsenseEnabled !== "false";
  const publisherId = s.adsensePublisherId || "ca-pub-3555957571802049";
  const pushed = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    if (pushed.current) return;
    pushed.current = true;
    try {
      const w = window as any;
      w.adsbygoogle = w.adsbygoogle || [];
      w.adsbygoogle.push({});
    } catch {}
  }, [enabled]);

  if (!enabled) return null;

  const isFixed = width !== undefined && height !== undefined;

  return (
    <div className={`overflow-hidden ${className}`}>
      <ins
        className="adsbygoogle"
        style={isFixed
          ? { display: "inline-block", width: `${width}px`, height: `${height}px` }
          : { display: "block" }}
        data-ad-client={publisherId}
        data-ad-slot={slot}
        {...(!isFixed && { "data-ad-format": format, "data-full-width-responsive": "true" })}
      />
    </div>
  );
}
