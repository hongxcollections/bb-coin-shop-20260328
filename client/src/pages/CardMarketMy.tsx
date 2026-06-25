import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import Header from "@/components/Header";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { ChevronLeft, Edit2, Trash2, Check, ShoppingBag, Loader2, Eye, X } from "lucide-react";
import { useConfirm } from "@/components/ui/confirm-provider";

const CONDITION_LABELS: Record<string, { label: string; color: string }> = {
  NM:  { label: "NM", color: "#4CAF50" },
  LP:  { label: "LP", color: "#8BC34A" },
  MP:  { label: "MP", color: "#FFC107" },
  HP:  { label: "HP", color: "#FF9800" },
  DMG: { label: "DMG", color: "#f44336" },
};

const GAMES_LABEL: Record<string, string> = {
  pokemon: "Pokémon", yugioh: "遊戲王", mtg: "MTG",
  onepiece: "航海王", dragonball: "龍珠", digimon: "數碼暴龍", other: "其他",
};

function timeAgo(dateStr: string | Date) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}分前`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}小時前`;
  return `${Math.floor(hrs / 24)}日前`;
}

interface Listing {
  id: number; game: string; cardName: string; cardNameJa: string | null;
  setName: string | null; setNumber: string | null;
  officialImageUrl: string | null; condition: string;
  isGraded: boolean; gradingOrg: string | null; gradeScore: string | null;
  priceHKD: number; photoUrls: string[]; description: string | null;
  status: string; views: number; createdAt: string;
}

interface WTB {
  id: number; game: string; cardName: string; cardNameJa: string | null;
  setName: string | null; officialImageUrl: string | null;
  maxPriceHKD: number | null; minCondition: string | null;
  notes: string | null; isActive: number; createdAt: string;
}

function EditPriceSheet({ listing, onClose, onSaved }: { listing: Listing; onClose: () => void; onSaved: () => void }) {
  const [priceStr, setPriceStr] = useState(String(listing.priceHKD));
  const [desc, setDesc] = useState(listing.description ?? "");
  const [saving, setSaving] = useState(false);
  const updateMut = trpc.cardTrading.updateListing.useMutation();

  async function handleSave() {
    const price = parseInt(priceStr, 10);
    if (!price || price < 1) { toast.error("請填寫有效售價"); return; }
    setSaving(true);
    try {
      await updateMut.mutateAsync({ id: listing.id, priceHKD: price, description: desc.trim() || undefined });
      toast.success("已更新上架資料");
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "更新失敗");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "rgba(0,0,0,0.85)" }} onClick={onClose}>
      <div className="flex-1" />
      <div
        className="w-full max-w-lg mx-auto rounded-t-3xl overflow-hidden"
        style={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)", borderBottom: "none" }}
        onClick={e => e.stopPropagation()}
      >
        <div className="px-4 pt-4 pb-2">
          <div className="w-10 h-1 rounded-full mx-auto" style={{ background: "rgba(255,255,255,0.2)" }} />
        </div>
        <div className="flex items-center justify-between px-4 pb-4">
          <h3 className="text-base font-black" style={{ color: "#FFDE00" }}>修改上架資料</h3>
          <button onClick={onClose} className="text-xs px-3 py-1 rounded-full" style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)" }}>關閉</button>
        </div>
        <div className="px-4 pb-6 flex flex-col gap-4">
          <div>
            <label className="text-xs mb-1.5 block" style={{ color: "rgba(255,255,255,0.5)" }}>售價 (HKD)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold" style={{ color: "rgba(255,255,255,0.4)" }}>$</span>
              <input
                value={priceStr}
                onChange={e => setPriceStr(e.target.value)}
                inputMode="numeric"
                className="w-full pl-7 pr-3 py-2 text-sm"
                style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "12px", color: "#fff", outline: "none" }}
              />
            </div>
          </div>
          <div>
            <label className="text-xs mb-1.5 block" style={{ color: "rgba(255,255,255,0.5)" }}>備註說明</label>
            <textarea
              value={desc}
              onChange={e => setDesc(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 text-sm resize-none"
              style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "12px", color: "#fff", outline: "none" }}
            />
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-3 rounded-2xl text-sm font-black flex items-center justify-center gap-2"
            style={{ background: "linear-gradient(90deg, #CC0000, #FF4444)", color: "#fff" }}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            儲存更改
          </button>
        </div>
      </div>
    </div>
  );
}

function ListingRow({ listing, onRefresh }: { listing: Listing; onRefresh: () => void }) {
  const confirm = useConfirm();
  const [editOpen, setEditOpen] = useState(false);
  const removeMut = trpc.cardTrading.removeListing.useMutation();
  const markSoldMut = trpc.cardTrading.markSold.useMutation();
  const cond = CONDITION_LABELS[listing.condition] ?? { label: listing.condition, color: "#9C27B0" };
  const img = listing.photoUrls[0] ?? listing.officialImageUrl;

  async function handleRemove() {
    const ok = await confirm({ title: "下架此記錄？", description: "下架後不會顯示在市場，可重新上架。", confirmText: "確認下架" });
    if (!ok) return;
    try {
      await removeMut.mutateAsync({ id: listing.id });
      toast.success("已下架");
      onRefresh();
    } catch { toast.error("下架失敗"); }
  }

  async function handleMarkSold() {
    const ok = await confirm({ title: "標記為已售出？", description: "標記後此上架記錄將關閉。", confirmText: "確認售出" });
    if (!ok) return;
    try {
      await markSoldMut.mutateAsync({ id: listing.id });
      toast.success("已標記為售出");
      onRefresh();
    } catch { toast.error("操作失敗"); }
  }

  return (
    <>
      {editOpen && <EditPriceSheet listing={listing} onClose={() => setEditOpen(false)} onSaved={onRefresh} />}
      <div className="flex items-center gap-3 p-3 rounded-2xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
        {img ? (
          <img src={img} alt="" className="rounded-xl flex-shrink-0 object-cover" style={{ width: 48, height: 66 }} />
        ) : (
          <div className="rounded-xl flex-shrink-0 flex items-center justify-center" style={{ width: 48, height: 66, background: "rgba(255,222,0,0.08)" }}>
            <span style={{ fontSize: 24 }}>🃏</span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-black leading-tight line-clamp-1" style={{ color: "#fff" }}>{listing.cardName}</p>
          {listing.setName && <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>{listing.setName}</p>}
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-xs font-black" style={{ color: "#FFDE00" }}>HKD ${listing.priceHKD.toLocaleString()}</span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md" style={{ background: cond.color + "22", color: cond.color }}>
              {listing.isGraded && listing.gradeScore ? `${listing.gradingOrg} ${listing.gradeScore}` : cond.label}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <Eye className="w-3 h-3" style={{ color: "rgba(255,255,255,0.3)" }} />
            <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>{listing.views}</span>
            <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.25)" }}>{timeAgo(listing.createdAt)}</span>
          </div>
        </div>
        {listing.status === "active" && (
          <div className="flex flex-col gap-1.5 flex-shrink-0">
            <button onClick={() => setEditOpen(true)} className="p-1.5 rounded-lg" style={{ background: "rgba(255,222,0,0.12)", border: "1px solid rgba(255,222,0,0.2)" }}>
              <Edit2 className="w-3.5 h-3.5" style={{ color: "#FFDE00" }} />
            </button>
            <button onClick={handleMarkSold} className="p-1.5 rounded-lg" style={{ background: "rgba(76,175,80,0.12)", border: "1px solid rgba(76,175,80,0.2)" }}>
              <Check className="w-3.5 h-3.5" style={{ color: "#4CAF50" }} />
            </button>
            <button onClick={handleRemove} className="p-1.5 rounded-lg" style={{ background: "rgba(244,67,54,0.1)", border: "1px solid rgba(244,67,54,0.2)" }}>
              <Trash2 className="w-3.5 h-3.5" style={{ color: "#f44336" }} />
            </button>
          </div>
        )}
        {listing.status === "sold" && (
          <span className="text-[10px] font-black px-2 py-1 rounded-full flex-shrink-0" style={{ background: "rgba(76,175,80,0.15)", color: "#4CAF50", border: "1px solid rgba(76,175,80,0.3)" }}>已售出</span>
        )}
        {listing.status === "removed" && (
          <span className="text-[10px] font-black px-2 py-1 rounded-full flex-shrink-0" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.35)" }}>已下架</span>
        )}
      </div>
    </>
  );
}

function WTBRow({ wtb, onRefresh }: { wtb: WTB; onRefresh: () => void }) {
  const confirm = useConfirm();
  const deactivateMut = trpc.cardTrading.deactivateWTB.useMutation();

  async function handleDeactivate() {
    const ok = await confirm({ title: "移除此求購記錄？", description: "移除後不會再收到相關通知。", confirmText: "確認移除" });
    if (!ok) return;
    try {
      await deactivateMut.mutateAsync({ id: wtb.id });
      toast.success("已移除求購記錄");
      onRefresh();
    } catch { toast.error("操作失敗"); }
  }

  return (
    <div className="flex items-center gap-3 p-3 rounded-2xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
      {wtb.officialImageUrl ? (
        <img src={wtb.officialImageUrl} alt="" className="rounded-xl flex-shrink-0 object-cover" style={{ width: 40, height: 56 }} />
      ) : (
        <div className="rounded-xl flex-shrink-0 flex items-center justify-center" style={{ width: 40, height: 56, background: "rgba(255,222,0,0.08)" }}>
          <span style={{ fontSize: 20 }}>🃏</span>
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-black leading-tight line-clamp-1" style={{ color: "#fff" }}>{wtb.cardName}</p>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "rgba(255,222,0,0.1)", color: "#FFDE00" }}>{GAMES_LABEL[wtb.game] ?? wtb.game}</span>
          {wtb.maxPriceHKD && <span className="text-[10px] font-bold" style={{ color: "#4CAF50" }}>上限 ${wtb.maxPriceHKD}</span>}
          {wtb.minCondition && <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>最低 {wtb.minCondition}</span>}
        </div>
        {wtb.notes && <p className="text-[10px] mt-0.5 line-clamp-1" style={{ color: "rgba(255,255,255,0.35)" }}>{wtb.notes}</p>}
      </div>
      {wtb.isActive ? (
        <button onClick={handleDeactivate} className="p-1.5 rounded-lg flex-shrink-0" style={{ background: "rgba(244,67,54,0.1)", border: "1px solid rgba(244,67,54,0.2)" }}>
          <X className="w-3.5 h-3.5" style={{ color: "#f44336" }} />
        </button>
      ) : (
        <span className="text-[10px] flex-shrink-0" style={{ color: "rgba(255,255,255,0.3)" }}>已關閉</span>
      )}
    </div>
  );
}

type Tab = "active" | "sold" | "removed" | "wtb";

export default function CardMarketMy() {
  const [, navigate] = useLocation();
  const { isAuthenticated } = useAuth();
  const [tab, setTab] = useState<Tab>("active");

  const { data: activeListings = [], refetch: refetchActive } = trpc.cardTrading.getMyListings.useQuery({ status: "active", limit: 50 }, { enabled: isAuthenticated });
  const { data: soldListings = [], refetch: refetchSold } = trpc.cardTrading.getMyListings.useQuery({ status: "sold", limit: 50 }, { enabled: isAuthenticated });
  const { data: removedListings = [], refetch: refetchRemoved } = trpc.cardTrading.getMyListings.useQuery({ status: "removed", limit: 50 }, { enabled: isAuthenticated });
  const { data: myWTBs = [], refetch: refetchWTBs } = trpc.cardTrading.getMyWTBs.useQuery({ limit: 50 }, { enabled: isAuthenticated });

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen pb-20 flex flex-col" style={{ background: "linear-gradient(160deg, #0d0d1f 0%, #1a0505 40%, #0d0d1f 100%)", color: "#fff" }}>
        <Header />
        <div className="flex-1 flex flex-col items-center justify-center px-4 gap-4">
          <span style={{ fontSize: 48 }}>🔒</span>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>請先登入</p>
          <button onClick={() => navigate("/login")} className="px-6 py-2 rounded-full font-bold text-sm" style={{ background: "linear-gradient(90deg, #CC0000, #FF4444)", color: "#fff" }}>
            前往登入
          </button>
        </div>
      </div>
    );
  }

  const TABS: { id: Tab; label: string; count?: number }[] = [
    { id: "active", label: "上架中", count: (activeListings as Listing[]).length },
    { id: "sold", label: "已售出", count: (soldListings as Listing[]).length },
    { id: "removed", label: "已下架", count: (removedListings as Listing[]).length },
    { id: "wtb", label: "求購 WTB", count: (myWTBs as WTB[]).filter(w => w.isActive).length },
  ];

  const currentListings: Listing[] =
    tab === "active" ? (activeListings as Listing[]) :
    tab === "sold" ? (soldListings as Listing[]) :
    tab === "removed" ? (removedListings as Listing[]) : [];

  const currentRefresh =
    tab === "active" ? refetchActive :
    tab === "sold" ? refetchSold :
    tab === "removed" ? refetchRemoved : refetchWTBs;

  return (
    <div className="min-h-screen pb-20" style={{ background: "linear-gradient(160deg, #0d0d1f 0%, #1a0505 40%, #0d0d1f 100%)", color: "#fff" }}>
      <Header />
      <div className="max-w-lg mx-auto px-4 pt-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <button onClick={() => navigate("/cardzzz/market")} className="p-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.07)" }}>
            <ChevronLeft className="w-4 h-4" style={{ color: "rgba(255,255,255,0.7)" }} />
          </button>
          <h1 className="text-xl font-black flex-1" style={{ color: "#FFDE00" }}>我的卡牌清單</h1>
          <button onClick={() => navigate("/cardzzz/market/sell")} className="text-xs px-3 py-1.5 rounded-full font-bold" style={{ background: "linear-gradient(90deg, #CC0000, #FF4444)", color: "#fff" }}>
            + 上架
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 p-1 rounded-2xl" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="flex-1 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1"
              style={tab === t.id
                ? { background: tab === "wtb" ? "rgba(255,222,0,0.2)" : "linear-gradient(90deg, #CC0000, #FF4444)", color: tab === "wtb" ? "#FFDE00" : "#fff" }
                : { color: "rgba(255,255,255,0.4)" }}
            >
              {t.id === "wtb" && <ShoppingBag className="w-3 h-3" />}
              {t.label}
              {(t.count ?? 0) > 0 && (
                <span className="text-[9px] px-1 py-0.5 rounded-full min-w-[16px] text-center" style={{ background: "rgba(255,255,255,0.15)" }}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        {tab !== "wtb" ? (
          <div className="flex flex-col gap-2">
            {currentListings.length === 0 ? (
              <div className="flex flex-col items-center py-10 gap-3">
                <span style={{ fontSize: 40 }}>🃏</span>
                <p className="text-sm" style={{ color: "rgba(255,255,255,0.35)" }}>
                  {tab === "active" ? "未有上架記錄" : tab === "sold" ? "未有售出記錄" : "未有下架記錄"}
                </p>
                {tab === "active" && (
                  <button onClick={() => navigate("/cardzzz/market/sell")} className="text-sm px-4 py-2 rounded-full font-bold" style={{ background: "rgba(255,222,0,0.12)", color: "#FFDE00", border: "1px solid rgba(255,222,0,0.25)" }}>
                    立即上架
                  </button>
                )}
              </div>
            ) : (
              currentListings.map(l => (
                <ListingRow key={l.id} listing={l} onRefresh={currentRefresh} />
              ))
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {(myWTBs as WTB[]).length === 0 ? (
              <div className="flex flex-col items-center py-10 gap-3">
                <span style={{ fontSize: 40 }}>🔍</span>
                <p className="text-sm" style={{ color: "rgba(255,255,255,0.35)" }}>未有求購記錄</p>
                <button onClick={() => navigate("/cardzzz/market/sell")} className="text-sm px-4 py-2 rounded-full font-bold" style={{ background: "rgba(255,222,0,0.12)", color: "#FFDE00", border: "1px solid rgba(255,222,0,0.25)" }}>
                  登記求購
                </button>
              </div>
            ) : (
              (myWTBs as WTB[]).map(w => (
                <WTBRow key={w.id} wtb={w} onRefresh={refetchWTBs} />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
