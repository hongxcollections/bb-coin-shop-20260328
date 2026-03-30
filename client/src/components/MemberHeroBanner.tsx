import { type MemberLevel } from "./MemberBadge";

interface MemberHeroBannerProps {
  level?: string | null;
  name?: string | null;
}

const LEVEL_CONFIG: Record<MemberLevel, {
  bg: string;
  shimmer: string;
  orb1: string;
  orb2: string;
  orb3: string;
  title: string;
  subtitle: string;
  icon: string;
  particles: string[];
  textColor: string;
  subtitleColor: string;
}> = {
  bronze: {
    bg: "from-amber-800 via-amber-600 to-orange-500",
    shimmer: "from-transparent via-amber-300/20 to-transparent",
    orb1: "bg-amber-400/30",
    orb2: "bg-orange-500/20",
    orb3: "bg-amber-700/25",
    title: "銅牌收藏家",
    subtitle: "踏上錢幣收藏之旅",
    icon: "🥉",
    particles: ["🪙", "✦", "◆", "🪙", "✦"],
    textColor: "text-amber-50",
    subtitleColor: "text-amber-200",
  },
  silver: {
    bg: "from-slate-600 via-slate-400 to-gray-300",
    shimmer: "from-transparent via-white/25 to-transparent",
    orb1: "bg-slate-300/40",
    orb2: "bg-gray-200/30",
    orb3: "bg-slate-500/30",
    title: "銀牌藏家",
    subtitle: "精選珍幣，品味非凡",
    icon: "🥈",
    particles: ["⬟", "✦", "◈", "⬟", "✧"],
    textColor: "text-slate-50",
    subtitleColor: "text-slate-200",
  },
  gold: {
    bg: "from-yellow-600 via-amber-400 to-yellow-300",
    shimmer: "from-transparent via-yellow-100/35 to-transparent",
    orb1: "bg-yellow-300/40",
    orb2: "bg-amber-200/30",
    orb3: "bg-yellow-600/30",
    title: "金牌資深藏家",
    subtitle: "匯聚珍稀，傳承價值",
    icon: "🥇",
    particles: ["★", "✦", "◆", "★", "✦"],
    textColor: "text-yellow-50",
    subtitleColor: "text-yellow-100",
  },
  vip: {
    bg: "from-violet-900 via-purple-700 to-fuchsia-600",
    shimmer: "from-transparent via-purple-200/30 to-transparent",
    orb1: "bg-violet-400/35",
    orb2: "bg-fuchsia-400/25",
    orb3: "bg-purple-900/40",
    title: "💎 VIP 頂級藏家",
    subtitle: "尊享無界，臻品至上",
    icon: "💎",
    particles: ["💎", "✦", "◆", "✧", "💎"],
    textColor: "text-violet-50",
    subtitleColor: "text-violet-200",
  },
};

export function MemberHeroBanner({ level, name }: MemberHeroBannerProps) {
  const cfg = LEVEL_CONFIG[(level as MemberLevel) ?? "bronze"] ?? LEVEL_CONFIG.bronze;

  return (
    <div className={`relative overflow-hidden rounded-t-xl bg-gradient-to-r ${cfg.bg} h-36 md:h-44`}>
      {/* Animated shimmer sweep */}
      <div
        className={`absolute inset-0 bg-gradient-to-r ${cfg.shimmer} animate-[shimmer_3s_ease-in-out_infinite]`}
        style={{ backgroundSize: "200% 100%" }}
      />

      {/* Decorative orbs */}
      <div className={`absolute -top-8 -left-8 w-40 h-40 rounded-full ${cfg.orb1} blur-2xl`} />
      <div className={`absolute top-4 right-12 w-28 h-28 rounded-full ${cfg.orb2} blur-xl`} />
      <div className={`absolute -bottom-6 left-1/2 w-52 h-20 rounded-full ${cfg.orb3} blur-2xl`} />

      {/* Floating particles */}
      {cfg.particles.map((p, i) => (
        <span
          key={i}
          className={`absolute select-none ${cfg.subtitleColor} opacity-40 text-lg`}
          style={{
            left: `${12 + i * 18}%`,
            top: `${20 + (i % 3) * 25}%`,
            animation: `float ${2.5 + i * 0.4}s ease-in-out ${i * 0.3}s infinite alternate`,
            fontSize: i === 0 || i === 4 ? "1.4rem" : "0.9rem",
          }}
        >
          {p}
        </span>
      ))}

      {/* Large background icon */}
      <div
        className="absolute right-6 top-1/2 -translate-y-1/2 text-7xl md:text-8xl opacity-15 select-none"
        style={{ filter: "blur(1px)" }}
      >
        {cfg.icon}
      </div>

      {/* Content */}
      <div className="relative z-10 h-full flex flex-col justify-end px-6 pb-5">
        <p className={`text-xs font-semibold tracking-widest uppercase ${cfg.subtitleColor} mb-0.5`}>
          {cfg.subtitle}
        </p>
        <h2 className={`text-2xl md:text-3xl font-extrabold ${cfg.textColor} drop-shadow`}>
          {cfg.icon !== "💎" ? `${cfg.icon} ` : ""}{cfg.title}
        </h2>
        {name && (
          <p className={`text-sm mt-1 ${cfg.subtitleColor} font-medium`}>
            歡迎回來，{name}
          </p>
        )}
      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-black/10 to-transparent" />

      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes float {
          from { transform: translateY(0px) rotate(0deg); }
          to { transform: translateY(-8px) rotate(8deg); }
        }
      `}</style>
    </div>
  );
}
