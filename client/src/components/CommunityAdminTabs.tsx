import { Link, useLocation } from "wouter";
import { Sparkles, Coins } from "lucide-react";

const TABS = [
  { href: "/admin/daily-challenge", label: "每日一藏品挑戰", Icon: Coins },
  { href: "/admin/community-seeder", label: "AI 帖文生成", Icon: Sparkles },
];

export default function CommunityAdminTabs() {
  const [loc] = useLocation();
  return (
    <div className="border-b bg-white sticky top-16 z-30">
      <div className="container mx-auto px-4">
        <div className="flex items-center gap-1 overflow-x-auto">
          <span className="text-xs text-gray-500 mr-3 shrink-0 hidden sm:inline">藏品社區管理</span>
          {TABS.map(({ href, label, Icon }) => {
            const active = loc.startsWith(href);
            return (
              <Link key={href} href={href}>
                <button
                  className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                    active
                      ? "border-violet-600 text-violet-700"
                      : "border-transparent text-gray-600 hover:text-gray-900"
                  }`}
                >
                  <Icon className="w-4 h-4" /> {label}
                </button>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
