import { cn } from "@/lib/utils";

export type MemberLevel = "bronze" | "silver" | "gold" | "vip";

interface MemberBadgeProps {
  level: MemberLevel | string | null | undefined;
  /** "badge" = pill with icon+text, "icon" = icon only, "full" = large card-style */
  variant?: "badge" | "icon" | "full";
  className?: string;
}

const LEVEL_CONFIG: Record<
  MemberLevel,
  {
    label: string;
    icon: string;
    bg: string;
    text: string;
    border: string;
    glow: string;
    ring: string;
    description: string;
  }
> = {
  bronze: {
    label: "銅牌會員",
    icon: "🥉",
    bg: "bg-gradient-to-r from-amber-700 to-amber-500",
    text: "text-white",
    border: "border-amber-600",
    glow: "shadow-amber-400/40",
    ring: "ring-amber-500",
    description: "入門收藏家，享有基本競標功能",
  },
  silver: {
    label: "銀牌會員",
    icon: "🥈",
    bg: "bg-gradient-to-r from-slate-500 to-slate-300",
    text: "text-white",
    border: "border-slate-400",
    glow: "shadow-slate-300/50",
    ring: "ring-slate-400",
    description: "進階藏家，享有優先通知及更多功能",
  },
  gold: {
    label: "金牌會員",
    icon: "🥇",
    bg: "bg-gradient-to-r from-yellow-500 to-amber-300",
    text: "text-yellow-900",
    border: "border-yellow-400",
    glow: "shadow-yellow-400/60",
    ring: "ring-yellow-400",
    description: "資深藏家，享有專屬競標優勢及折扣",
  },
  vip: {
    label: "VIP 會員",
    icon: "💎",
    bg: "bg-gradient-to-r from-violet-600 via-purple-500 to-fuchsia-500",
    text: "text-white",
    border: "border-violet-400",
    glow: "shadow-violet-500/60",
    ring: "ring-violet-400",
    description: "頂級藏家，享有全站最高特權及專屬服務",
  },
};

export function MemberBadge({ level, variant = "badge", className }: MemberBadgeProps) {
  const safeLevel = (level as MemberLevel) in LEVEL_CONFIG ? (level as MemberLevel) : "bronze";
  const cfg = LEVEL_CONFIG[safeLevel];

  if (variant === "icon") {
    return (
      <span
        title={cfg.label}
        className={cn(
          "inline-flex items-center justify-center w-5 h-5 rounded-full text-xs shadow",
          cfg.bg,
          cfg.glow,
          className
        )}
      >
        {cfg.icon}
      </span>
    );
  }

  if (variant === "full") {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-3 rounded-xl px-4 py-3 border shadow-lg",
          cfg.bg,
          cfg.text,
          cfg.border,
          `shadow-lg ${cfg.glow}`,
          className
        )}
      >
        <span className="text-3xl drop-shadow">{cfg.icon}</span>
        <div>
          <p className="font-bold text-base leading-tight">{cfg.label}</p>
          <p className={cn("text-xs opacity-80 mt-0.5", cfg.text)}>{cfg.description}</p>
        </div>
      </div>
    );
  }

  // Default: "badge" variant
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border shadow-sm",
        cfg.bg,
        cfg.text,
        cfg.border,
        `shadow-sm ${cfg.glow}`,
        className
      )}
    >
      <span>{cfg.icon}</span>
      <span>{cfg.label}</span>
    </span>
  );
}

/** Convenience: returns the label string for a given level */
export function getMemberLevelLabel(level: string | null | undefined): string {
  const safeLevel = (level as MemberLevel) in LEVEL_CONFIG ? (level as MemberLevel) : "bronze";
  return LEVEL_CONFIG[safeLevel].label;
}

export { LEVEL_CONFIG };
