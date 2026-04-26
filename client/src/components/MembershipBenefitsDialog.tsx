import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Check, X, Crown, Shield, Star, Zap } from "lucide-react";
import { Link } from "wouter";

const LEVELS = [
  { key: "bronze", label: "銅牌", icon: "🥉" },
  { key: "silver", label: "銀牌", icon: "🥈" },
  { key: "gold",   label: "金牌", icon: "🥇" },
  { key: "vip",    label: "VIP",  icon: "💎" },
] as const;

interface BenefitRow {
  icon: React.ReactNode;
  benefit: string;
  bronze: boolean | string;
  silver: boolean | string;
  gold:   boolean | string;
  vip:    boolean | string;
}

const BENEFITS: BenefitRow[] = [
  {
    icon: <Zap className="w-3.5 h-3.5" />,
    benefit: "競標出價",
    bronze: true, silver: true, gold: true, vip: true,
  },
  {
    icon: <Zap className="w-3.5 h-3.5" />,
    benefit: "代理出價",
    bronze: "有限次數", silver: true, gold: true, vip: true,
  },
  {
    icon: <Zap className="w-3.5 h-3.5" />,
    benefit: "匿名出價",
    bronze: false, silver: true, gold: true, vip: true,
  },
  {
    icon: <Star className="w-3.5 h-3.5" />,
    benefit: "即時推播通知",
    bronze: false, silver: true, gold: true, vip: true,
  },
  {
    icon: <Star className="w-3.5 h-3.5" />,
    benefit: "被超標通知",
    bronze: true, silver: true, gold: true, vip: true,
  },
  {
    icon: <Star className="w-3.5 h-3.5" />,
    benefit: "得標確認通知",
    bronze: true, silver: true, gold: true, vip: true,
  },
  {
    icon: <Crown className="w-3.5 h-3.5" />,
    benefit: "個人頁尊榮設計",
    bronze: false, silver: false, gold: true, vip: true,
  },
  {
    icon: <Crown className="w-3.5 h-3.5" />,
    benefit: "優先客服支援",
    bronze: false, silver: false, gold: false, vip: true,
  },
  {
    icon: <Shield className="w-3.5 h-3.5" />,
    benefit: "交易記錄保存",
    bronze: true, silver: true, gold: true, vip: true,
  },
];

function Cell({ val }: { val: boolean | string }) {
  if (val === false) return <X className="w-3.5 h-3.5 text-gray-300 mx-auto" />;
  if (val === true)  return <Check className="w-3.5 h-3.5 text-emerald-500 mx-auto" />;
  return <span className="text-[10px] text-center text-muted-foreground leading-tight block">{val}</span>;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  highlightLevel?: "silver" | "gold" | "vip";
}

export function MembershipBenefitsDialog({ open, onOpenChange, highlightLevel = "silver" }: Props) {
  const highlightIdx = LEVELS.findIndex(l => l.key === highlightLevel);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md mx-2 p-0 overflow-hidden">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Crown className="w-4 h-4 text-amber-500" />
            會員等級權益比較
          </DialogTitle>
        </DialogHeader>

        <div className="px-4 pb-2">
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr>
                  <th className="text-left py-2 pr-2 font-medium text-muted-foreground w-28">功能</th>
                  {LEVELS.map((lv, i) => (
                    <th key={lv.key} className={`text-center py-2 px-1 font-semibold rounded-t-lg ${
                      i === highlightIdx
                        ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-300'
                        : 'text-slate-500'
                    }`}>
                      <div>{lv.icon}</div>
                      <div className="text-[10px]">{lv.label}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {BENEFITS.map((row, ri) => (
                  <tr key={ri} className={ri % 2 === 0 ? 'bg-slate-50/50' : ''}>
                    <td className="py-2 pr-2 text-slate-600 flex items-center gap-1">
                      <span className="text-slate-400">{row.icon}</span>
                      {row.benefit}
                    </td>
                    {LEVELS.map((lv, i) => (
                      <td key={lv.key} className={`text-center py-2 px-1 ${
                        i === highlightIdx ? 'bg-amber-50/60' : ''
                      }`}>
                        <Cell val={row[lv.key]} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="px-4 py-3 bg-amber-50 border-t border-amber-100 flex items-center justify-between gap-2">
          <p className="text-xs text-amber-700">
            累積出價即可自動升級，詳見會員等級頁
          </p>
          <Link href="/member-benefits" onClick={() => onOpenChange(false)}>
            <span className="text-xs font-medium text-amber-600 underline underline-offset-2 whitespace-nowrap">
              查看詳情 →
            </span>
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function useMembershipBenefitsDialog() {
  const [open, setOpen] = useState(false);
  const [highlightLevel, setHighlightLevel] = useState<"silver" | "gold" | "vip">("silver");

  const openDialog = (level: "silver" | "gold" | "vip" = "silver") => {
    setHighlightLevel(level);
    setOpen(true);
  };

  return { open, setOpen, highlightLevel, openDialog };
}
