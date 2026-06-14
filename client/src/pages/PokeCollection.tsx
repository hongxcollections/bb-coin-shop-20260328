import { useState, useMemo, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import Header from "@/components/Header";
import { toast } from "sonner";
import {
  ChevronLeft, Trash2, BookOpen, Search, X, Pencil, Check,
  SortAsc, Layers, Share2, Loader2, RefreshCw,
} from "lucide-react";
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

type SortKey = "date" | "value" | "name";

const GRADE_COLOR: Record<number, string> = {
  10: "#FFD700", 9: "#4CAF50", 8: "#2196F3",
  7: "#9C27B0", 6: "#FF9800", 5: "#FF5252",
};

function GradeChip({ label, val }: { label: string; val: number | null }) {
  if (val == null) return null;
  const color = GRADE_COLOR[Math.floor(val)] ?? "rgba(255,255,255,0.4)";
  return (
    <div className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", minWidth: 52 }}>
      <span className="text-[9px] font-bold" style={{ color: "rgba(255,255,255,0.45)" }}>{label}</span>
      <span className="text-sm font-black" style={{ color }}>{val}</span>
    </div>
  );
}

export default function PokeCollection() {
  const [, navigate] = useLocation();
  const { isAuthenticated } = useAuth();
  const confirm = useConfirm();
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("date");
  const [groupBySet, setGroupBySet] = useState(false);
  const [selectedCard, setSelectedCard] = useState<SavedCard | null>(null);
  const [editingPrice, setEditingPrice] = useState(false);
  const [priceInput, setPriceInput] = useState("");
  const [sharingImage, setSharingImage] = useState(false);
  const shareCanvasRef = useRef<HTMLCanvasElement>(null);

  const { data: rawCards = [], refetch, isLoading } = trpc.pokeLover.listCards.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const cards = rawCards as SavedCard[];

  const deleteMut = trpc.pokeLover.deleteCard.useMutation({
    onSuccess: () => {
      toast.success("已刪除", { className: "bb-toast-success" });
      refetch();
      setSelectedCard(null);
    },
    onError: () => toast.error("刪除失敗", { className: "bb-toast-err" }),
  });

  const updatePriceMut = trpc.pokeLover.updateCardPrice.useMutation({
    onSuccess: (_, vars) => {
      toast.success("估值已更新", { className: "bb-toast-success" });
      setEditingPrice(false);
      refetch().then(() => {
        setSelectedCard(prev => prev ? { ...prev, marketPriceHKD: vars.marketPriceHKD } : null);
      });
    },
    onError: () => toast.error("更新失敗", { className: "bb-toast-err" }),
  });

  // B1 — stats
  const totalValue = useMemo(() => cards.reduce((s, c) => s + (c.marketPriceHKD ?? 0), 0), [cards]);
  const gradedCards = useMemo(() => cards.filter(c => c.gradeEstimate != null), [cards]);
  const avgPSA = useMemo(() => gradedCards.length
    ? (gradedCards.reduce((s, c) => s + (c.gradeEstimate!), 0) / gradedCards.length).toFixed(1)
    : null, [gradedCards]);
  const topCard = useMemo(() => [...cards].sort((a, b) => (b.marketPriceHKD ?? 0) - (a.marketPriceHKD ?? 0))[0] ?? null, [cards]);

  // A2 + search
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const base = q
      ? cards.filter(c => (c.cardName ?? "").toLowerCase().includes(q) || (c.cardNameJa ?? "").includes(search) || (c.cardSet ?? "").toLowerCase().includes(q))
      : [...cards];
    if (sortBy === "value") return base.sort((a, b) => (b.marketPriceHKD ?? 0) - (a.marketPriceHKD ?? 0));
    if (sortBy === "name") return base.sort((a, b) => (a.cardName ?? "").localeCompare(b.cardName ?? "", "zh-HK"));
    return base; // date — API already returns savedAt DESC
  }, [cards, search, sortBy]);

  // B2 — group by set
  const grouped = useMemo(() => {
    if (!groupBySet) return null;
    const map: Record<string, SavedCard[]> = {};
    for (const c of filtered) {
      const key = c.cardSet || "未分類";
      if (!map[key]) map[key] = [];
      map[key].push(c);
    }
    return Object.entries(map).sort((a, b) => b[1].length - a[1].length);
  }, [filtered, groupBySet]);

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

  const openModal = (card: SavedCard) => {
    setSelectedCard(card);
    setEditingPrice(false);
    setPriceInput(card.marketPriceHKD != null ? String(card.marketPriceHKD) : "");
  };

  const handleSavePrice = () => {
    if (!selectedCard) return;
    const val = parseInt(priceInput, 10);
    updatePriceMut.mutate({ id: selectedCard.id, marketPriceHKD: isNaN(val) ? null : val });
  };

  // D1 — generate share image
  const handleShareCollection = useCallback(async () => {
    if (filtered.length === 0) { toast.error("卡冊係空的", { className: "bb-toast-err" }); return; }
    setSharingImage(true);
    try {
      const COLS = 3, CARD_W = 140, CARD_H = 195, GAP = 8, PAD = 14, HEADER_H = 72, FOOTER_H = 28;
      const rows = Math.ceil(filtered.length / COLS);
      const W = COLS * CARD_W + (COLS + 1) * GAP + PAD * 2;
      const H = HEADER_H + rows * (CARD_H + GAP) + GAP + FOOTER_H;

      const canvas = document.createElement("canvas");
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext("2d")!;

      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, "#0d0d1f"); bg.addColorStop(0.5, "#1a0505"); bg.addColorStop(1, "#0d0d1f");
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

      ctx.fillStyle = "#FFDE00"; ctx.font = "bold 22px sans-serif";
      ctx.fillText("我的 Pokémon 卡冊", PAD, 32);
      ctx.fillStyle = "rgba(255,255,255,0.4)"; ctx.font = "12px sans-serif";
      ctx.fillText(`${filtered.length} 張  ·  合計估值 HKD$${totalValue.toLocaleString("en-HK")}`, PAD, 52);

      for (let i = 0; i < filtered.length; i++) {
        const card = filtered[i];
        const col = i % COLS, row = Math.floor(i / COLS);
        const x = PAD + GAP + col * (CARD_W + GAP);
        const y = HEADER_H + GAP + row * (CARD_H + GAP);
        const IMG_H = Math.round(CARD_H * 0.68), INFO_H = CARD_H - IMG_H;

        ctx.fillStyle = "rgba(255,255,255,0.05)";
        ctx.beginPath(); ctx.roundRect(x, y, CARD_W, CARD_H, 8); ctx.fill();

        if (card.imageThumb) {
          await new Promise<void>(res => {
            const img = new window.Image();
            img.onload = () => {
              ctx.save();
              ctx.beginPath(); ctx.roundRect(x, y, CARD_W, IMG_H, [8, 8, 0, 0]); ctx.clip();
              ctx.drawImage(img, x, y, CARD_W, IMG_H);
              ctx.restore(); res();
            };
            img.onerror = () => res();
            img.src = card.imageThumb!;
          });
        } else {
          ctx.fillStyle = "rgba(255,222,0,0.06)";
          ctx.beginPath(); ctx.roundRect(x, y, CARD_W, IMG_H, [8, 8, 0, 0]); ctx.fill();
          ctx.fillStyle = "rgba(255,255,255,0.15)"; ctx.font = `${Math.round(IMG_H * 0.4)}px sans-serif`;
          ctx.textAlign = "center"; ctx.fillText("🃏", x + CARD_W / 2, y + IMG_H / 2 + 10); ctx.textAlign = "left";
        }

        const grad2 = ctx.createLinearGradient(0, y + IMG_H - 20, 0, y + IMG_H);
        grad2.addColorStop(0, "rgba(0,0,0,0)"); grad2.addColorStop(1, "rgba(0,0,0,0.7)");
        ctx.fillStyle = grad2; ctx.fillRect(x, y + IMG_H - 20, CARD_W, 20);

        const infoY = y + IMG_H;
        ctx.fillStyle = "rgba(255,255,255,0.07)"; ctx.fillRect(x, infoY, CARD_W, INFO_H);

        ctx.fillStyle = "rgba(255,255,255,0.9)"; ctx.font = "bold 9px sans-serif";
        const name = (card.cardName ?? "未知卡片").substring(0, 16);
        ctx.fillText(name, x + 5, infoY + 14);
        if (card.marketPriceHKD != null) {
          ctx.fillStyle = "#FFDE00"; ctx.font = "bold 10px sans-serif";
          ctx.fillText(`HKD$${card.marketPriceHKD.toLocaleString()}`, x + 5, infoY + 27);
        }
        if (card.gradeEstimate != null) {
          const gc = GRADE_COLOR[Math.floor(card.gradeEstimate)] ?? "rgba(255,255,255,0.5)";
          ctx.fillStyle = gc; ctx.font = "bold 9px sans-serif";
          ctx.textAlign = "right"; ctx.fillText(`PSA ${card.gradeEstimate}`, x + CARD_W - 5, infoY + 14); ctx.textAlign = "left";
        }
      }

      ctx.fillStyle = "rgba(255,222,0,0.3)"; ctx.font = "10px sans-serif";
      ctx.fillText("hongxcollections.com", PAD, H - 10);

      const dataUrl = canvas.toDataURL("image/png");
      if (navigator.share && navigator.canShare?.({ files: [] })) {
        const res = await fetch(dataUrl);
        const blob = await res.blob();
        const file = new File([blob], "我的卡冊.png", { type: "image/png" });
        await navigator.share({ files: [file], title: "我的 Pokémon 卡冊" });
      } else {
        const a = document.createElement("a"); a.download = "我的卡冊.png"; a.href = dataUrl; a.click();
      }
      toast.success("圖片已生成", { className: "bb-toast-success" });
    } catch {
      toast.error("生成失敗，請重試", { className: "bb-toast-err" });
    } finally {
      setSharingImage(false);
    }
  }, [filtered, totalValue]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen pb-20" style={{ background: "linear-gradient(160deg, #0d0d1f 0%, #1a0505 40%, #0d0d1f 100%)", color: "#fff" }}>
        <Header />
        <div className="max-w-lg mx-auto px-4 pt-4 flex flex-col items-center justify-center" style={{ minHeight: 300 }}>
          <BookOpen className="w-12 h-12 mb-4" style={{ color: "rgba(255,222,0,0.4)" }} />
          <p className="text-white font-bold mb-2">請先登入</p>
          <p className="text-xs text-center mb-4" style={{ color: "rgba(255,255,255,0.4)" }}>登入後可儲存 Pokémon 卡片到你的卡冊</p>
          <button onClick={() => navigate("/login")} className="px-6 py-2.5 rounded-xl font-bold text-sm" style={{ background: "linear-gradient(135deg, #CC0000, #FF5252)", color: "#fff" }}>
            立即登入
          </button>
        </div>
      </div>
    );
  }

  const renderGrid = (list: SavedCard[]) => (
    <div className="grid grid-cols-2 gap-3">
      {list.map(card => (
        <div key={card.id} onClick={() => openModal(card)} className="rounded-xl overflow-hidden flex flex-col cursor-pointer active:scale-95 transition-transform"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
          {card.imageThumb ? (
            <div className="relative">
              <img src={card.imageThumb} alt={card.cardName ?? ""} className="w-full object-cover" style={{ height: 140 }} />
              <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 50%)" }} />
              {card.gradeEstimate != null && (
                <span className="absolute bottom-2 left-2 text-[10px] font-black px-1.5 py-0.5 rounded"
                  style={{ background: `${GRADE_COLOR[Math.floor(card.gradeEstimate)] ?? "#9C27B0"}cc`, color: "#fff" }}>
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
              <p className="text-xs font-black mt-auto" style={{ color: "#FFDE00" }}>HKD${card.marketPriceHKD.toLocaleString("en-HK")}</p>
            )}
            <p className="text-[9px] mt-1" style={{ color: "rgba(255,255,255,0.2)" }}>
              {new Date(card.savedAt).toLocaleDateString("zh-HK", { month: "numeric", day: "numeric" })}
            </p>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen pb-20" style={{ background: "linear-gradient(160deg, #0d0d1f 0%, #1a0505 40%, #0d0d1f 100%)", color: "#fff" }}>
      <Header />
      <div className="max-w-lg mx-auto px-4 pt-4">
        <button onClick={() => navigate("/pokemon")} className="flex items-center gap-1 text-xs mb-4" style={{ color: "rgba(255,255,255,0.5)" }}>
          <ChevronLeft className="w-4 h-4" /> 返回 PokeLover
        </button>

        {/* Title + D1 share button */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <h1 className="text-2xl font-black tracking-tight leading-none" style={{ color: "#FFDE00" }}>我的卡冊</h1>
            <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
              {isLoading ? "載入中..." : `共 ${cards.length} 張`}
            </p>
          </div>
          <button onClick={handleShareCollection} disabled={sharingImage}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold"
            style={{ background: "rgba(255,222,0,0.12)", border: "1px solid rgba(255,222,0,0.25)", color: "#FFDE00", opacity: sharingImage ? 0.6 : 1 }}>
            {sharingImage ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Share2 className="w-3.5 h-3.5" />}
            {sharingImage ? "生成中..." : "分享卡冊"}
          </button>
        </div>

        {/* B1 — stats bar */}
        {!isLoading && cards.length > 0 && (
          <div className="grid grid-cols-4 gap-2 mb-4">
            {[
              { label: "張數", value: String(cards.length) },
              { label: "合計估值", value: totalValue > 0 ? `$${(totalValue / 1000).toFixed(1)}K` : "—" },
              { label: "平均 PSA", value: avgPSA ?? "—" },
              { label: "最高值", value: topCard?.marketPriceHKD ? `$${(topCard.marketPriceHKD / 1000).toFixed(1)}K` : "—" },
            ].map(stat => (
              <div key={stat.label} className="rounded-xl p-2 text-center" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <p className="text-xs font-black" style={{ color: "#FFDE00" }}>{stat.value}</p>
                <p className="text-[9px] mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>{stat.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* A2 sort + B2 group controls */}
        {!isLoading && cards.length > 1 && (
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <div className="flex items-center gap-1">
              <SortAsc className="w-3 h-3" style={{ color: "rgba(255,255,255,0.35)" }} />
              {(["date", "value", "name"] as SortKey[]).map(k => (
                <button key={k} onClick={() => setSortBy(k)}
                  className="text-[10px] font-bold px-2 py-1 rounded-lg transition-all"
                  style={{
                    background: sortBy === k ? "rgba(255,222,0,0.18)" : "rgba(255,255,255,0.05)",
                    border: `1px solid ${sortBy === k ? "rgba(255,222,0,0.35)" : "rgba(255,255,255,0.08)"}`,
                    color: sortBy === k ? "#FFDE00" : "rgba(255,255,255,0.4)",
                  }}>
                  {k === "date" ? "最新" : k === "value" ? "估值" : "名稱"}
                </button>
              ))}
            </div>
            <button onClick={() => setGroupBySet(g => !g)}
              className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg transition-all"
              style={{
                background: groupBySet ? "rgba(255,222,0,0.18)" : "rgba(255,255,255,0.05)",
                border: `1px solid ${groupBySet ? "rgba(255,222,0,0.35)" : "rgba(255,255,255,0.08)"}`,
                color: groupBySet ? "#FFDE00" : "rgba(255,255,255,0.4)",
              }}>
              <Layers className="w-3 h-3" />
              按套裝
            </button>
          </div>
        )}

        {/* Search */}
        {cards.length > 3 && (
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: "rgba(255,255,255,0.3)" }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜尋卡片、套裝..." className="w-full pl-9 pr-3 py-2 text-sm outline-none text-white placeholder-gray-600"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px" }} />
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
              <button onClick={() => navigate("/pokemon")} className="mt-2 px-4 py-2 rounded-xl text-xs font-bold"
                style={{ background: "rgba(255,222,0,0.12)", border: "1px solid rgba(255,222,0,0.25)", color: "#FFDE00" }}>
                去分析卡片
              </button>
            )}
          </div>
        )}

        {/* B2 grouped / flat grid */}
        {!isLoading && filtered.length > 0 && (
          grouped ? (
            <div className="flex flex-col gap-6">
              {grouped.map(([setName, setCards]) => (
                <div key={setName}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-black" style={{ color: "rgba(255,222,0,0.8)" }}>{setName}</p>
                    <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>
                      {setCards.length} 張
                      {setCards.some(c => c.marketPriceHKD) && ` · HKD$${setCards.reduce((s, c) => s + (c.marketPriceHKD ?? 0), 0).toLocaleString("en-HK")}`}
                    </p>
                  </div>
                  {renderGrid(setCards)}
                </div>
              ))}
            </div>
          ) : renderGrid(filtered)
        )}
      </div>

      {/* A1 — card detail modal */}
      {selectedCard && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: "rgba(0,0,0,0.75)" }}
          onClick={e => { if (e.target === e.currentTarget) setSelectedCard(null); }}>
          <div className="w-full max-w-lg rounded-t-2xl overflow-y-auto" style={{ background: "linear-gradient(180deg, #1a0a1a 0%, #0d0d1f 100%)", maxHeight: "90vh" }}>
            {/* Top image */}
            {selectedCard.imageThumb && (
              <div className="relative w-full" style={{ height: 220 }}>
                <img src={selectedCard.imageThumb} alt={selectedCard.cardName ?? ""} className="w-full h-full object-cover" />
                <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, transparent 40%, rgba(26,10,26,1) 100%)" }} />
              </div>
            )}

            <div className={`px-5 pb-24 ${!selectedCard.imageThumb ? "pt-6" : ""}`}>
              {/* Close */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-black leading-tight" style={{ color: "#fff" }}>{selectedCard.cardName ?? "未知卡片"}</h2>
                  {selectedCard.cardNameJa && <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>{selectedCard.cardNameJa}</p>}
                </div>
                <button onClick={() => setSelectedCard(null)} className="ml-3 p-1.5 rounded-full flex-shrink-0" style={{ background: "rgba(255,255,255,0.08)" }}>
                  <X className="w-4 h-4" style={{ color: "rgba(255,255,255,0.6)" }} />
                </button>
              </div>

              {/* Chips: set + rarity + condition */}
              <div className="flex flex-wrap gap-1.5 mb-4">
                {selectedCard.cardSet && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(255,222,0,0.12)", border: "1px solid rgba(255,222,0,0.25)", color: "#FFDE00" }}>
                    {selectedCard.cardSet}
                  </span>
                )}
                {selectedCard.rarity && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(156,39,176,0.15)", border: "1px solid rgba(156,39,176,0.3)", color: "#CE93D8" }}>
                    {selectedCard.rarity}
                  </span>
                )}
                {selectedCard.condition && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(33,150,243,0.12)", border: "1px solid rgba(33,150,243,0.25)", color: "#90CAF9" }}>
                    {selectedCard.condition}
                  </span>
                )}
              </div>

              {/* Grade estimates row */}
              {(selectedCard.gradeEstimate != null || selectedCard.bgsEstimate != null || selectedCard.cgcEstimate != null || selectedCard.tagEstimate != null) && (
                <div className="mb-4">
                  <p className="text-[10px] font-bold mb-2" style={{ color: "rgba(255,255,255,0.35)" }}>AI 評級估計</p>
                  <div className="flex gap-2 flex-wrap">
                    <GradeChip label="PSA" val={selectedCard.gradeEstimate} />
                    <GradeChip label="BGS" val={selectedCard.bgsEstimate} />
                    <GradeChip label="CGC" val={selectedCard.cgcEstimate} />
                    <GradeChip label="TAG" val={selectedCard.tagEstimate} />
                  </div>
                </div>
              )}

              {/* PSA 9 / PSA 10 */}
              {(selectedCard.psa9HKD != null || selectedCard.psa10HKD != null) && (
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {selectedCard.psa9HKD != null && (
                    <div className="rounded-xl p-3" style={{ background: "rgba(76,175,80,0.08)", border: "1px solid rgba(76,175,80,0.2)" }}>
                      <p className="text-[10px]" style={{ color: "rgba(76,175,80,0.7)" }}>PSA 9 估值</p>
                      <p className="text-sm font-black" style={{ color: "#A5D6A7" }}>HKD${selectedCard.psa9HKD.toLocaleString("en-HK")}</p>
                    </div>
                  )}
                  {selectedCard.psa10HKD != null && (
                    <div className="rounded-xl p-3" style={{ background: "rgba(255,215,0,0.08)", border: "1px solid rgba(255,215,0,0.2)" }}>
                      <p className="text-[10px]" style={{ color: "rgba(255,215,0,0.7)" }}>PSA 10 估值</p>
                      <p className="text-sm font-black" style={{ color: "#FFD700" }}>HKD${selectedCard.psa10HKD.toLocaleString("en-HK")}</p>
                    </div>
                  )}
                </div>
              )}

              {/* C1 — market price editable */}
              <div className="rounded-xl p-3 mb-4" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[10px] font-bold" style={{ color: "rgba(255,255,255,0.35)" }}>市場估值（HKD）</p>
                  {!editingPrice && (
                    <button onClick={() => { setEditingPrice(true); setPriceInput(selectedCard.marketPriceHKD != null ? String(selectedCard.marketPriceHKD) : ""); }}
                      className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-lg"
                      style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.4)" }}>
                      <Pencil className="w-3 h-3" /> 更新
                    </button>
                  )}
                </div>
                {editingPrice ? (
                  <div className="flex gap-2 items-center">
                    <input
                      type="number"
                      value={priceInput}
                      onChange={e => setPriceInput(e.target.value)}
                      placeholder="輸入新估值"
                      className="flex-1 px-3 py-2 text-sm outline-none text-white"
                      style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,222,0,0.3)", borderRadius: "10px" }}
                    />
                    <button onClick={handleSavePrice} disabled={updatePriceMut.isPending}
                      className="p-2 rounded-xl" style={{ background: "rgba(76,175,80,0.2)", border: "1px solid rgba(76,175,80,0.35)" }}>
                      {updatePriceMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" style={{ color: "#A5D6A7" }} /> : <Check className="w-4 h-4" style={{ color: "#A5D6A7" }} />}
                    </button>
                    <button onClick={() => setEditingPrice(false)} className="p-2 rounded-xl" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
                      <X className="w-4 h-4" style={{ color: "rgba(255,255,255,0.4)" }} />
                    </button>
                  </div>
                ) : (
                  <p className="text-xl font-black" style={{ color: selectedCard.marketPriceHKD != null ? "#FFDE00" : "rgba(255,255,255,0.2)" }}>
                    {selectedCard.marketPriceHKD != null ? `HKD$${selectedCard.marketPriceHKD.toLocaleString("en-HK")}` : "未設定"}
                  </p>
                )}
              </div>

              {/* C2 + delete action row */}
              <div className="flex gap-2">
                <button onClick={() => {
                    if (selectedCard.imageThumb) {
                      localStorage.setItem("poke_reanalyze", JSON.stringify({ imageThumb: selectedCard.imageThumb }));
                    }
                    setSelectedCard(null);
                    navigate("/pokemon");
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold"
                  style={{ background: "rgba(255,222,0,0.1)", border: "1px solid rgba(255,222,0,0.25)", color: "#FFDE00" }}>
                  <RefreshCw className="w-4 h-4" /> 重新分析
                </button>
                <button
                  onClick={() => toast.info("本站搜尋功能開發中，敬請期待", { className: "bb-toast-info" })}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.3)", cursor: "not-allowed" }}>
                  <Search className="w-4 h-4" /> 本站搜尋
                </button>
                <button onClick={() => handleDelete(selectedCard)}
                  className="p-2.5 rounded-xl"
                  style={{ background: "rgba(244,67,54,0.1)", border: "1px solid rgba(244,67,54,0.2)" }}>
                  <Trash2 className="w-4 h-4" style={{ color: "#f44336" }} />
                </button>
              </div>

              <p className="text-[9px] text-center mt-3" style={{ color: "rgba(255,255,255,0.2)" }}>
                儲存於 {new Date(selectedCard.savedAt).toLocaleDateString("zh-HK", { year: "numeric", month: "long", day: "numeric" })}
              </p>
            </div>
          </div>
        </div>
      )}

      <canvas ref={shareCanvasRef} className="hidden" />
    </div>
  );
}
