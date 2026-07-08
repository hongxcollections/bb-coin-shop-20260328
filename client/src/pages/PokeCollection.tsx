import { useState, useMemo, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import Header from "@/components/Header";
import { toast } from "sonner";
import {
  ChevronLeft, Trash2, BookOpen, Search, X, Pencil, Check,
  SortAsc, Layers, Share2, Loader2, RefreshCw, LayoutGrid, AlignJustify,
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
  10: "#9C27B0", 9: "#16a34a", 8: "#2196F3",
  7: "#F97316", 6: "#d97706", 5: "#dc2626",
};

function GradeChip({ label, val }: { label: string; val: number | null }) {
  if (val == null) return null;
  const color = GRADE_COLOR[Math.floor(val)] ?? "#9ca3af";
  return (
    <div className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg" style={{ background: `${color}12`, border: `1px solid ${color}30`, minWidth: 52 }}>
      <span className="text-[9px] font-bold" style={{ color: "#6b7280" }}>{label}</span>
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
  const [scrollMode, setScrollMode] = useState(true);
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

  const totalValue = useMemo(() => cards.reduce((s, c) => s + (c.marketPriceHKD ?? 0), 0), [cards]);
  const gradedCards = useMemo(() => cards.filter(c => c.gradeEstimate != null), [cards]);
  const avgPSA = useMemo(() => gradedCards.length
    ? (gradedCards.reduce((s, c) => s + (c.gradeEstimate!), 0) / gradedCards.length).toFixed(1)
    : null, [gradedCards]);
  const topCard = useMemo(() => [...cards].sort((a, b) => (b.marketPriceHKD ?? 0) - (a.marketPriceHKD ?? 0))[0] ?? null, [cards]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const base = q
      ? cards.filter(c => (c.cardName ?? "").toLowerCase().includes(q) || (c.cardNameJa ?? "").includes(search) || (c.cardSet ?? "").toLowerCase().includes(q))
      : [...cards];
    if (sortBy === "value") return base.sort((a, b) => (b.marketPriceHKD ?? 0) - (a.marketPriceHKD ?? 0));
    if (sortBy === "name") return base.sort((a, b) => (a.cardName ?? "").localeCompare(b.cardName ?? "", "zh-HK"));
    return base;
  }, [cards, search, sortBy]);

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

      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H);

      ctx.fillStyle = "#CC0000"; ctx.font = "bold 22px sans-serif";
      ctx.fillText("我的 CardZx 卡冊", PAD, 32);
      ctx.fillStyle = "#6b7280"; ctx.font = "12px sans-serif";
      ctx.fillText(`${filtered.length} 張  ·  合計估值 HKD$${totalValue.toLocaleString("en-HK")}`, PAD, 52);

      for (let i = 0; i < filtered.length; i++) {
        const card = filtered[i];
        const col = i % COLS, row = Math.floor(i / COLS);
        const x = PAD + GAP + col * (CARD_W + GAP);
        const y = HEADER_H + GAP + row * (CARD_H + GAP);
        const IMG_H = Math.round(CARD_H * 0.68), INFO_H = CARD_H - IMG_H;

        ctx.fillStyle = "#f5f6f7";
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
          ctx.fillStyle = "#f0f1f2";
          ctx.beginPath(); ctx.roundRect(x, y, CARD_W, IMG_H, [8, 8, 0, 0]); ctx.fill();
          ctx.fillStyle = "#d1d5db"; ctx.font = `${Math.round(IMG_H * 0.4)}px sans-serif`;
          ctx.textAlign = "center"; ctx.fillText("🃏", x + CARD_W / 2, y + IMG_H / 2 + 10); ctx.textAlign = "left";
        }

        const infoY = y + IMG_H;
        ctx.fillStyle = "#fff"; ctx.fillRect(x, infoY, CARD_W, INFO_H);

        ctx.fillStyle = "#111827"; ctx.font = "bold 9px sans-serif";
        const name = (card.cardName ?? "未知卡片").substring(0, 16);
        ctx.fillText(name, x + 5, infoY + 14);
        if (card.marketPriceHKD != null) {
          ctx.fillStyle = "#CC0000"; ctx.font = "bold 10px sans-serif";
          ctx.fillText(`HKD$${card.marketPriceHKD.toLocaleString()}`, x + 5, infoY + 27);
        }
        if (card.gradeEstimate != null) {
          const gc = GRADE_COLOR[Math.floor(card.gradeEstimate)] ?? "#9ca3af";
          ctx.fillStyle = gc; ctx.font = "bold 9px sans-serif";
          ctx.textAlign = "right"; ctx.fillText(`PSA ${card.gradeEstimate}`, x + CARD_W - 5, infoY + 14); ctx.textAlign = "left";
        }
      }

      ctx.fillStyle = "#9ca3af"; ctx.font = "10px sans-serif";
      ctx.fillText("hongxcollections.com", PAD, H - 10);

      const dataUrl = canvas.toDataURL("image/png");
      if (navigator.share && navigator.canShare?.({ files: [] })) {
        const res = await fetch(dataUrl);
        const blob = await res.blob();
        const file = new File([blob], "我的卡冊.png", { type: "image/png" });
        await navigator.share({ files: [file], title: "我的 CardZx 卡冊" });
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
      <div className="min-h-screen pb-20" style={{ background: "#fff" }}>
        <Header />
        <div className="max-w-lg mx-auto px-4 pt-4 flex flex-col items-center justify-center" style={{ minHeight: 300 }}>
          <BookOpen className="w-12 h-12 mb-4" style={{ color: "rgba(204,0,0,0.3)" }} />
          <p className="font-bold mb-2" style={{ color: "#111827" }}>請先登入</p>
          <p className="text-xs text-center mb-4" style={{ color: "#9ca3af" }}>登入後可儲存 Pokémon 卡片到你的卡冊</p>
          <button onClick={() => navigate("/login")} className="px-6 py-2.5 rounded-xl font-bold text-sm" style={{ background: "linear-gradient(135deg, #FFDE00, #FFB800)", color: "#111827" }}>
            立即登入
          </button>
        </div>
      </div>
    );
  }

  const renderCard = (card: SavedCard, widthStyle?: React.CSSProperties) => (
    <div key={card.id} onClick={() => openModal(card)}
      className="rounded-xl overflow-hidden flex flex-col cursor-pointer active:scale-95 transition-transform flex-shrink-0"
      style={{ background: "#fff", border: "1px solid #e5e7eb", boxShadow: "0 1px 4px rgba(0,0,0,0.05)", ...widthStyle }}>
      {card.imageThumb ? (
        <div className="relative">
          <img src={card.imageThumb} alt={card.cardName ?? ""} className="w-full object-cover" style={{ height: 140 }} />
          <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.3) 0%, transparent 50%)" }} />
          {card.gradeEstimate != null && (
            <span className="absolute bottom-2 left-2 text-[10px] font-black px-1.5 py-0.5 rounded"
              style={{ background: `${GRADE_COLOR[Math.floor(card.gradeEstimate)] ?? "#9C27B0"}ee`, color: "#fff" }}>
              PSA {card.gradeEstimate}
            </span>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-center" style={{ height: 100, background: "#f8f9fa" }}>
          <span style={{ fontSize: 36 }}>🃏</span>
        </div>
      )}
      <div className="p-2.5 flex flex-col flex-1">
        <p className="text-xs font-bold leading-tight line-clamp-2 mb-0.5" style={{ color: "#111827" }}>{card.cardName ?? "未知卡片"}</p>
        {card.cardNameJa && <p className="text-[10px] leading-tight mb-1" style={{ color: "#9ca3af" }}>{card.cardNameJa}</p>}
        {card.cardSet && <p className="text-[9px] mb-1.5 truncate" style={{ color: "#d1d5db" }}>{card.cardSet}</p>}
        {card.marketPriceHKD != null && (
          <p className="text-xs font-black mt-auto" style={{ color: "#CC0000" }}>HKD${card.marketPriceHKD.toLocaleString("en-HK")}</p>
        )}
        <p className="text-[9px] mt-1" style={{ color: "#d1d5db" }}>
          {new Date(card.savedAt).toLocaleDateString("zh-HK", { month: "numeric", day: "numeric" })}
        </p>
      </div>
    </div>
  );

  const renderScroll = (list: SavedCard[]) => (
    <div className="overflow-x-auto" style={{ marginLeft: -16, marginRight: -16, paddingLeft: 16, paddingRight: 16 }}>
      <div className="flex gap-3 pb-2" style={{ width: "max-content" }}>
        {list.map(card => renderCard(card, { width: "calc(45vw - 8px)", maxWidth: 180 }))}
      </div>
    </div>
  );

  const renderGrid = (list: SavedCard[]) => (
    <div className="grid grid-cols-2 gap-3">
      {list.map(card => renderCard(card))}
    </div>
  );

  return (
    <div className="min-h-screen pb-20" style={{ background: "#f8f9fa" }}>
      <Header />
      <div className="max-w-lg mx-auto px-[5px] pt-4">
        <button onClick={() => navigate("/cardzzz")} className="flex items-center gap-1 text-xs mb-4" style={{ color: "#9ca3af" }}>
          <ChevronLeft className="w-4 h-4" /> 返回 CardZx
        </button>

        {/* Title + share button */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <h1 className="text-2xl font-black tracking-tight leading-none" style={{ color: "#111827" }}>我的卡冊</h1>
            <p className="text-xs mt-0.5" style={{ color: "#9ca3af" }}>
              {isLoading ? "載入中..." : `共 ${cards.length} 張`}
            </p>
          </div>
          <button onClick={handleShareCollection} disabled={sharingImage}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold"
            style={{ background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.2)", color: "#F97316", opacity: sharingImage ? 0.6 : 1 }}>
            {sharingImage ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Share2 className="w-3.5 h-3.5" />}
            {sharingImage ? "生成中..." : "分享卡冊"}
          </button>
        </div>

        {/* Stats bar */}
        {!isLoading && cards.length > 0 && (
          <div className="grid grid-cols-4 gap-2 mb-4">
            {[
              { label: "張數", value: String(cards.length) },
              { label: "合計估值", value: totalValue > 0 ? `$${(totalValue / 1000).toFixed(1)}K` : "—" },
              { label: "平均 PSA", value: avgPSA ?? "—" },
              { label: "最高值", value: topCard?.marketPriceHKD ? `$${(topCard.marketPriceHKD / 1000).toFixed(1)}K` : "—" },
            ].map(stat => (
              <div key={stat.label} className="rounded-xl p-2 text-center" style={{ background: "#fff", border: "1px solid #e5e7eb" }}>
                <p className="text-xs font-black" style={{ color: "#CC0000" }}>{stat.value}</p>
                <p className="text-[9px] mt-0.5" style={{ color: "#9ca3af" }}>{stat.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Sort + group controls */}
        {!isLoading && cards.length > 1 && (
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <div className="flex items-center gap-1">
              <SortAsc className="w-3 h-3" style={{ color: "#9ca3af" }} />
              {(["date", "value", "name"] as SortKey[]).map(k => (
                <button key={k} onClick={() => setSortBy(k)}
                  className="text-[10px] font-bold px-2 py-1 rounded-lg transition-all"
                  style={{
                    background: sortBy === k ? "rgba(255,222,0,0.15)" : "#fff",
                    border: `1px solid ${sortBy === k ? "rgba(255,222,0,0.4)" : "#e5e7eb"}`,
                    color: sortBy === k ? "#111827" : "#9ca3af",
                  }}>
                  {k === "date" ? "最新" : k === "value" ? "估值" : "名稱"}
                </button>
              ))}
            </div>
            <button onClick={() => setGroupBySet(g => !g)}
              className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg transition-all"
              style={{
                background: groupBySet ? "rgba(255,222,0,0.15)" : "#fff",
                border: `1px solid ${groupBySet ? "rgba(255,222,0,0.4)" : "#e5e7eb"}`,
                color: groupBySet ? "#111827" : "#9ca3af",
              }}>
              <Layers className="w-3 h-3" />
              按套裝
            </button>
            <button onClick={() => setScrollMode(s => !s)}
              className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg transition-all ml-auto"
              style={{ background: "#fff", border: "1px solid #e5e7eb", color: "#9ca3af" }}
              title={scrollMode ? "切換多行顯示" : "切換橫向捲動"}>
              {scrollMode ? <LayoutGrid className="w-3 h-3" /> : <AlignJustify className="w-3 h-3" />}
              {scrollMode ? "多行" : "橫向"}
            </button>
          </div>
        )}

        {/* Search */}
        {cards.length > 3 && (
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: "#9ca3af" }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜尋卡片、套裝..." className="w-full pl-9 pr-3 py-2 text-sm outline-none placeholder-gray-400"
              style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "10px", color: "#111827" }} />
          </div>
        )}

        {isLoading && (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor: "#e5e7eb", borderTopColor: "#CC0000" }} />
          </div>
        )}

        {!isLoading && filtered.length === 0 && (
          <div className="flex flex-col items-center py-16 gap-3">
            <BookOpen className="w-10 h-10" style={{ color: "rgba(204,0,0,0.2)" }} />
            <p className="text-sm font-semibold" style={{ color: "#9ca3af" }}>
              {search ? "搜尋不到結果" : "卡冊仍是空的"}
            </p>
            {!search && (
              <button onClick={() => navigate("/cardzzz")} className="mt-2 px-4 py-2 rounded-xl text-xs font-bold"
                style={{ background: "rgba(255,222,0,0.15)", border: "1px solid rgba(255,222,0,0.4)", color: "#111827" }}>
                去分析卡片
              </button>
            )}
          </div>
        )}

        {/* Grouped / flat grid */}
        {!isLoading && filtered.length > 0 && (
          grouped ? (
            <div className="flex flex-col gap-6">
              {grouped.map(([setName, setCards]) => (
                <div key={setName}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-black" style={{ color: "#CC0000" }}>{setName}</p>
                    <p className="text-[10px]" style={{ color: "#9ca3af" }}>
                      {setCards.length} 張
                      {setCards.some(c => c.marketPriceHKD) && ` · HKD$${setCards.reduce((s, c) => s + (c.marketPriceHKD ?? 0), 0).toLocaleString("en-HK")}`}
                    </p>
                  </div>
                  {scrollMode ? renderScroll(setCards) : renderGrid(setCards)}
                </div>
              ))}
            </div>
          ) : scrollMode ? renderScroll(filtered) : renderGrid(filtered)
        )}
      </div>

      {/* Card detail modal */}
      {selectedCard && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={e => { if (e.target === e.currentTarget) setSelectedCard(null); }}>
          <div className="w-full max-w-lg rounded-t-2xl overflow-y-auto" style={{ background: "#fff", maxHeight: "90vh", borderTop: "1px solid #e5e7eb" }}>
            {/* Top image */}
            {selectedCard.imageThumb && (
              <div className="relative w-full" style={{ height: 220 }}>
                <img src={selectedCard.imageThumb} alt={selectedCard.cardName ?? ""} className="w-full h-full object-cover" />
                <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, transparent 40%, rgba(255,255,255,0.9) 100%)" }} />
              </div>
            )}

            <div className={`px-5 pb-24 ${!selectedCard.imageThumb ? "pt-6" : ""}`}>
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-black leading-tight" style={{ color: "#111827" }}>{selectedCard.cardName ?? "未知卡片"}</h2>
                  {selectedCard.cardNameJa && <p className="text-sm mt-0.5" style={{ color: "#6b7280" }}>{selectedCard.cardNameJa}</p>}
                </div>
                <button onClick={() => setSelectedCard(null)} className="ml-3 p-1.5 rounded-full flex-shrink-0" style={{ background: "#f3f4f6", border: "1px solid #e5e7eb" }}>
                  <X className="w-4 h-4" style={{ color: "#6b7280" }} />
                </button>
              </div>

              {/* Chips: set + rarity + condition */}
              <div className="flex flex-wrap gap-1.5 mb-4">
                {selectedCard.cardSet && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(255,222,0,0.15)", border: "1px solid rgba(255,222,0,0.4)", color: "#111827" }}>
                    {selectedCard.cardSet}
                  </span>
                )}
                {selectedCard.rarity && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.2)", color: "#7c3aed" }}>
                    {selectedCard.rarity}
                  </span>
                )}
                {selectedCard.condition && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(33,150,243,0.08)", border: "1px solid rgba(33,150,243,0.2)", color: "#2196F3" }}>
                    {selectedCard.condition}
                  </span>
                )}
              </div>

              {/* Grade estimates */}
              {(selectedCard.gradeEstimate != null || selectedCard.bgsEstimate != null || selectedCard.cgcEstimate != null || selectedCard.tagEstimate != null) && (
                <div className="flex gap-2 mb-4 flex-wrap">
                  <GradeChip label="PSA" val={selectedCard.gradeEstimate} />
                  <GradeChip label="BGS" val={selectedCard.bgsEstimate} />
                  <GradeChip label="CGC" val={selectedCard.cgcEstimate} />
                  <GradeChip label="TAG" val={selectedCard.tagEstimate} />
                </div>
              )}

              {/* Market price */}
              <div className="rounded-xl p-4 mb-4" style={{ background: "#f8f9fa", border: "1px solid #e5e7eb" }}>
                <p className="text-xs font-bold mb-2" style={{ color: "#6b7280" }}>參考市場價格</p>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "裸卡 NM", value: selectedCard.marketPriceHKD },
                    { label: "PSA 9", value: selectedCard.psa9HKD },
                    { label: "PSA 10", value: selectedCard.psa10HKD },
                  ].map(({ label, value }) => (
                    <div key={label} className="text-center">
                      <p className="text-[10px] mb-1" style={{ color: "#9ca3af" }}>{label}</p>
                      <p className="text-sm font-black" style={{ color: value ? "#CC0000" : "#d1d5db" }}>
                        {value ? `$${value.toLocaleString("en-HK")}` : "N/A"}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Edit price */}
                {editingPrice ? (
                  <div className="mt-3 flex gap-2 items-center">
                    <input
                      value={priceInput}
                      onChange={e => setPriceInput(e.target.value)}
                      inputMode="numeric"
                      placeholder="輸入裸卡估值"
                      className="flex-1 px-2 py-1 text-sm"
                      style={{ background: "#fff", border: "1px solid #d1d5db", borderRadius: "8px", color: "#111827", outline: "none" }}
                    />
                    <button onClick={handleSavePrice} disabled={updatePriceMut.isPending}
                      className="p-1.5 rounded-lg" style={{ background: "rgba(22,163,74,0.1)", border: "1px solid rgba(22,163,74,0.2)" }}>
                      {updatePriceMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: "#16a34a" }} /> : <Check className="w-3.5 h-3.5" style={{ color: "#16a34a" }} />}
                    </button>
                    <button onClick={() => setEditingPrice(false)} className="p-1.5 rounded-lg" style={{ background: "#f3f4f6", border: "1px solid #e5e7eb" }}>
                      <X className="w-3.5 h-3.5" style={{ color: "#6b7280" }} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setEditingPrice(true)}
                    className="mt-3 flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 rounded-lg"
                    style={{ background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.2)", color: "#F97316" }}>
                    <Pencil className="w-3 h-3" />
                    修改裸卡估值
                  </button>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => selectedCard && handleDelete(selectedCard)}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
                  style={{ background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.15)", color: "#dc2626" }}>
                  <Trash2 className="w-3.5 h-3.5" />
                  刪除
                </button>
                <button
                  onClick={() => navigate("/cardzzz")}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold"
                  style={{ background: "linear-gradient(90deg, #FFDE00, #FFB800)", color: "#111827" }}>
                  再分析卡片
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
