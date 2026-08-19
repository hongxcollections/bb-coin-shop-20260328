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
  // Fail closed: do not serve ads while settings are still loading or unavailable.
  // This prevents an app shell/list page from briefly rendering an ad before the
  // administrator's disabled setting arrives.
  const enabled = s.adsenseEnabled === "true";
  const publisherId = s.adsensePublisherId || "ca-pub-3555957571802049";
  const pushed = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    if (pushed.current) return;
    const pushAd = () => {
      try {
        const w = window as any;
        w.adsbygoogle = w.adsbygoogle || [];
        w.adsbygoogle.push({});
        pushed.current = true;
      } catch {}
    };

    const existingScript = document.getElementById("adsense-script");
    if (existingScript) {
      pushAd();
      return;
    }

    const script = document.createElement("script");
    script.id = "adsense-script";
    script.async = true;
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(publisherId)}`;
    script.crossOrigin = "anonymous";
    script.onload = pushAd;
    document.head.appendChild(script);
  }, [enabled]);

  if (!enabled) return null;

  const isFixed = width !== undefined && height !== undefined;

  return (
    <div
      className={`overflow-hidden ${className}`}
      style={isFixed ? undefined : { width: "100%", minHeight: "50px" }}
    >
      <ins
        className="adsbygoogle"
        style={isFixed
          ? { display: "inline-block", width: `${width}px`, height: `${height}px` }
          : { display: "block", width: "100%" }}
        data-ad-client={publisherId}
        data-ad-slot={slot}
        {...(!isFixed && { "data-ad-format": format, "data-full-width-responsive": "true" })}
      />
    </div>
  );
}
