import { useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";

interface AdSenseAdProps {
  slot: string;
  format?: "auto" | "rectangle" | "horizontal" | "vertical";
  className?: string;
}

export default function AdSenseAd({ slot, format = "auto", className = "" }: AdSenseAdProps) {
  const { data: settings } = trpc.siteSettings.getAll.useQuery();
  const s = (settings as Record<string, string> | undefined) ?? {};
  const enabled = s.adsenseEnabled !== "false";
  const publisherId = s.adsensePublisherId || "";
  const ref = useRef<HTMLModElement>(null);
  const pushed = useRef(false);

  useEffect(() => {
    if (!enabled || !publisherId || publisherId === "ca-pub-0000000000000000") return;
    if (pushed.current) return;
    pushed.current = true;
    try {
      const w = window as any;
      w.adsbygoogle = w.adsbygoogle || [];
      w.adsbygoogle.push({});
    } catch {}
  }, [enabled, publisherId]);

  if (!enabled || !publisherId || publisherId === "ca-pub-0000000000000000") return null;

  return (
    <div className={`overflow-hidden ${className}`}>
      <ins
        ref={ref}
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={publisherId}
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </div>
  );
}
