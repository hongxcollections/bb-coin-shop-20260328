import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import Header from "@/components/Header";
import { toast } from "sonner";
import { ChevronLeft, Trash2, BookOpen, Search } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useConfirm } from "@/components/ui/confirm-provider";

type SavedCard = {
  id: number;
  userId: number;
  cardName: string | null;
  cardNameJa: string | null;
  imageThumb: string | null;
  gradeEstimate: number | null;
  bgsEstimate: number | null;
  cgcEstimate: number | null;
  tagEstimate: number | null;
  condition: string | null;
  marketPriceHKD: number | null;
  psa9HKD: number | null;
  psa10HKD: number | null;
  cardSet: string | null;
  rarity: string | null;
  savedAt: string;
};

export default function PokeCollection() {
  const [, navigate] = useLocation();
  const { isAuthenticated } = useAuth();
  const confirm = useConfirm();
  const [search, setSearch] = useState("");

  const { data: cards = [], refetch, isLoading } = trpc.pokeLover.listCards.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const deleteMut = trpc.pokeLover.deleteCard.useMutation({
    onSuccess: () => { toast.success("已刪除", { className: "bb-toast-success" }); refetch(); },
    onError: () => toast.error("刪除失敗", { className: "bb-toast-err" }),
  });

  const filtered = (cards as SavedCard[]).filter(c =>
    !search || (c.cardName ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (c.cardNameJa ?? "").includes(search)
  );

  const totalValue = (cards as SavedCard[]).reduce((s, c) => s + (c.marketPriceHKD ?? 0), 0);

  const handleDelete = async (card: SavedCard) => {
    const ok = await confirm({
      title: "刪除卡片",
      description: `確定要從卡冊刪除「${card.cardName ?? "此卡"}」？`,
      confirmLabel: "刪除",
      cancelLabel: "取消",
    });
    if (!ok) return;
    deleteMut.mutate({ id: card.id });
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen pb-20" style={{ background: "linear-gradient(160deg, #0d0d1f 0%, #1a0505 40%, #0d0d1f 100%)", color: "#fff" }}>
        <Header />
        <div className="max-w-lg mx-auto px-4 pt-4 flex flex-col items-center justify-center" style={{ minHeight: 300 }}>
          <BookOpen className="w-12 h-12 mb-4" style={{ color: "rgba(255,222,0,0.4)" }} />
          <p className="text-white font-bold mb-2">請先登入</p>
          <p className="text-xs text-center mb-4" style={{ color: "rgba(255,255,255,0.4)" }}>登入後可儲存 Pokemon 卡片到你的卡冊</p>
          <button onClick={() => navigate("/login")} className="px-6 py-2.5 rounded-xl font-bold text-sm" style={{ background: "linear-gradient(135deg, #CC0000, #FF5252)", color: "#fff" }}>
            立即登入
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20" style={{ background: "linear-gradient(160deg, #0d0d1f 0%, #1a0505 40%, #0d0d1f 100%)", color: "#fff" }}>
      <Header />
      <div className="max-w-lg mx-auto px-4 pt-4">
        <button onClick={() => navigate("/pokemon")} className="flex items-center gap-1 text-xs mb-4" style={{ color: "rgba(255,255,255,0.5)" }}>
          <ChevronLeft className="w-4 h-4" /> 返回 PokeLover
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div>
            <h1 className="text-2xl font-black tracking-tight leading-none" style={{ color: "#FFDE00" }}>我的卡冊</h1>
            <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
              {isLoading ? "載入中..." : `共 ${(cards as SavedCard[]).length} 張`}
              {totalValue > 0 && ` · 合計估值 HKD$${totalValue.toLocaleString("en-HK")}`}
            </p>
          </div>
        </div>

        {/* 搜尋欄 */}
        {(cards as SavedCard[]).length > 4 && (
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: "rgba(255,255,255,0.3)" }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="搜尋卡片..."
              className="w-full pl-9 pr-3 py-2 text-sm outline-none text-white placeholder-gray-600"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px" }}
            />
          </div>
        )}

        {isLoading && (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor: "rgba(255,222,0,0.2)", borderTopColor: "#FFDE00" }} />
          </div>
        )}

        {!isLoading && filtered.length === 0 && (
          <div className="flex flex-col items-center py-16 gap-3">
            <BookOpen className="w-10 h-10" style={{ color: "rgba(255,222,0,0.25)" }} />
            <p className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.4)" }}>
              {search ? "搜尋不到結果" : "卡冊仍是空的"}
            </p>
            {!search && (
              <button
                onClick={() => navigate("/pokemon")}
                className="mt-2 px-4 py-2 rounded-xl text-xs font-bold"
                style={{ background: "rgba(255,222,0,0.12)", border: "1px solid rgba(255,222,0,0.25)", color: "#FFDE00" }}
              >
                去分析卡片
              </button>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          {filtered.map(card => (
            <div
              key={card.id}
              className="rounded-xl overflow-hidden flex flex-col"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              {card.imageThumb ? (
                <div className="relative">
                  <img
                    src={card.imageThumb}
                    alt={card.cardName ?? ""}
                    className="w-full object-cover"
                    style={{ height: 140 }}
                  />
                  <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 50%)" }} />
                  {card.gradeEstimate != null && (
                    <span className="absolute bottom-2 left-2 text-[10px] font-black px-1.5 py-0.5 rounded" style={{ background: "rgba(156,39,176,0.85)", color: "#fff" }}>
                      PSA {card.gradeEstimate}
                    </span>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center" style={{ height: 100, background: "rgba(255,222,0,0.06)" }}>
                  <span style={{ fontSize: 36 }}>🃏</span>
                </div>
              )}
              <div className="p-2.5 flex flex-col flex-1">
                <p className="text-xs font-bold leading-tight line-clamp-2 text-white mb-0.5">{card.cardName ?? "未知卡片"}</p>
                {card.cardNameJa && <p className="text-[10px] leading-tight mb-1" style={{ color: "rgba(255,255,255,0.4)" }}>{card.cardNameJa}</p>}
                {card.cardSet && <p className="text-[9px] mb-1.5 truncate" style={{ color: "rgba(255,255,255,0.3)" }}>{card.cardSet}</p>}
                {card.marketPriceHKD != null && (
                  <p className="text-xs font-black mt-auto" style={{ color: "#FFDE00" }}>
                    HKD${card.marketPriceHKD.toLocaleString("en-HK")}
                  </p>
                )}
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[9px]" style={{ color: "rgba(255,255,255,0.25)" }}>
                    {new Date(card.savedAt).toLocaleDateString("zh-HK", { month: "numeric", day: "numeric" })}
                  </span>
                  <button
                    onClick={() => handleDelete(card)}
                    className="p-1 rounded-lg"
                    style={{ background: "rgba(244,67,54,0.1)", border: "1px solid rgba(244,67,54,0.2)" }}
                  >
                    <Trash2 className="w-3 h-3" style={{ color: "#f44336" }} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
