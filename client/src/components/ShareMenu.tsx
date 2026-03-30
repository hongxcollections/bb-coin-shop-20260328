import { useState, useRef, useEffect } from "react";
import { Share2, Copy, Check, X } from "lucide-react";
import { toast } from "sonner";

interface ShareMenuProps {
  auctionId: number;
  title: string;
  latestBid: number;
  currency?: string | null;
}

const SHARE_PLATFORMS = [
  {
    key: "facebook",
    label: "Facebook",
    color: "hover:bg-[#1877F2]/10 hover:text-[#1877F2]",
    icon: (
      <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
        <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.886v2.267h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
      </svg>
    ),
    getUrl: (url: string, text: string) =>
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(text)}`,
  },
  {
    key: "twitter",
    label: "X / Twitter",
    color: "hover:bg-black/10 hover:text-black",
    icon: (
      <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
    getUrl: (url: string, text: string) =>
      `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
  },
  {
    key: "whatsapp",
    label: "WhatsApp",
    color: "hover:bg-[#25D366]/10 hover:text-[#25D366]",
    icon: (
      <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
      </svg>
    ),
    getUrl: (url: string, text: string) =>
      `https://wa.me/?text=${encodeURIComponent(text + " " + url)}`,
  },
] as const;

export function ShareMenu({ auctionId, title, latestBid, currency }: ShareMenuProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const auctionUrl = `${window.location.origin}/auctions/${auctionId}`;
  const curr = currency ?? "HKD";
  const shareText = `【大BB錢幣店】${title} — 目前出價 ${curr === "HKD" ? "HK$" : curr + " "}${latestBid.toLocaleString()}，快來競標！`;

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function handlePlatform(getUrl: (url: string, text: string) => string) {
    window.open(getUrl(auctionUrl, shareText), "_blank", "noopener,noreferrer,width=600,height=500");
    setOpen(false);
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(auctionUrl);
      setCopied(true);
      toast.success("已複製連結");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("複製失敗，請手動複製連結");
    }
    setOpen(false);
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        title="分享"
        className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-800 border border-amber-200 hover:border-amber-400 rounded px-2 py-1 transition-colors bg-amber-50 hover:bg-amber-100"
      >
        <Share2 className="w-3 h-3" />
        分享
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-44 bg-white rounded-xl shadow-lg border border-amber-100 py-1 animate-in fade-in slide-in-from-top-1 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-amber-50">
            <span className="text-[0.65rem] font-semibold text-amber-700 uppercase tracking-wide">分享至</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="w-3 h-3" />
            </button>
          </div>

          {/* Platform buttons */}
          {SHARE_PLATFORMS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => handlePlatform(p.getUrl)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left text-muted-foreground transition-colors ${p.color}`}
            >
              {p.icon}
              {p.label}
            </button>
          ))}

          {/* Divider */}
          <div className="my-1 border-t border-amber-50" />

          {/* Copy link */}
          <button
            type="button"
            onClick={handleCopy}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left text-muted-foreground hover:bg-amber-50/80 hover:text-amber-700 transition-colors"
          >
            {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            {copied ? "已複製！" : "複製連結"}
          </button>
        </div>
      )}
    </div>
  );
}
