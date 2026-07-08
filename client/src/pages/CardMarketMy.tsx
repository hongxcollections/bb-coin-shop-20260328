import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import ImageLightbox from "@/components/ImageLightbox";
import { trpc } from "@/lib/trpc";
import { useLocation, useSearch } from "wouter";
import Header from "@/components/Header";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { ChevronLeft, Edit2, Trash2, Check, ShoppingBag, Loader2, Eye, X, Plus, RotateCcw } from "lucide-react";
import { useConfirm } from "@/components/ui/confirm-provider";

const CONDITION_LABELS: Record<string, { label: string; color: string }> = {
  NM:  { label: "NM", color: "#16a34a" },
  LP:  { label: "LP", color: "#65a30d" },
  MP:  { label: "MP", color: "#d97706" },
  HP:  { label: "HP", color: "#ea580c" },
  DMG: { label: "DMG", color: "#dc2626" },
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

const CONDITIONS = [
  { id: "NM", label: "NM — 近全新", desc: "無可見磨損" },
  { id: "LP", label: "LP — 輕微磨損", desc: "輕微刮痕或折痕" },
  { id: "MP", label: "MP — 中度磨損", desc: "明顯磨損但可辨別" },
  { id: "HP", label: "HP — 嚴重磨損", desc: "大量磨損" },
  { id: "DMG", label: "DMG — 損壞", desc: "破損/摺痕" },
] as const;

interface Listing {
  id: number; game: string; cardName: string; cardNameJa: string | null;
  setName: string | null; setNumber: string | null;
  officialImageUrl: string | null; condition: string;
  isGraded: boolean; gradingOrg: string | null; gradeScore: string | null;
  priceHKD: number; photoUrls: string[]; description: string | null;
  deliveryMethod: string | null;
  status: string; views: number; createdAt: string;
}

interface WTB {
  id: number; game: string; cardName: string; cardNameJa: string | null;
  setName: string | null; officialImageUrl: string | null;
  maxPriceHKD: number | null; minCondition: string | null;
  notes: string | null; isActive: number; createdAt: string;
}

function EditPriceSheet({ listing, onClose, onSaved }: { listing: Listing; onClose: () => void; onSaved: () => void }) {
  const [condition, setCondition] = useState(listing.condition as "NM" | "LP" | "MP" | "HP" | "DMG");
  const [isGraded, setIsGraded] = useState(listing.isGraded);
  const [gradingOrg, setGradingOrg] = useState(listing.gradingOrg ?? "PSA");
  const [lbIdx, setLbIdx] = useState<number | null>(null);
  const [gradeScore, setGradeScore] = useState(listing.gradeScore ?? "");
  const [priceStr, setPriceStr] = useState(String(listing.priceHKD));
  const [desc, setDesc] = useState(listing.description ?? "");
  const [deliveryMethod, setDeliveryMethod] = useState(listing.deliveryMethod ?? "面交或郵寄");
  const [photos, setPhotos] = useState<string[]>(listing.photoUrls);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const updateMut = trpc.cardTrading.updateListing.useMutation();
  const signUploadMut = trpc.cardTrading.signPhotoUpload.useMutation();

  async function handlePhotoUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    const remaining = 6 - photos.length;
    const toUpload = Array.from(files).slice(0, remaining);
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const file of toUpload) {
        const { uploadUrl, finalUrl } = await signUploadMut.mutateAsync({ mimeType: file.type, fileName: file.name });
        await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
        urls.push(finalUrl);
      }
      setPhotos(p => [...p, ...urls]);
    } catch { toast.error("上載相片失敗"); }
    finally { setUploading(false); }
  }

  async function handleSave() {
    const price = parseInt(priceStr, 10);
    if (!price || price < 1) { toast.error("請填寫有效售價"); return; }
    setSaving(true);
    try {
      await updateMut.mutateAsync({
        id: listing.id,
        priceHKD: price,
        description: desc.trim() || undefined,
        condition,
        isGraded,
        gradingOrg: isGraded ? gradingOrg : null,
        gradeScore: isGraded ? gradeScore.trim() || null : null,
        deliveryMethod,
        photoUrls: photos,
      });
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
    <div className="fixed inset-0 z-[9999] flex flex-col" style={{ background: "rgba(0,0,0,0.5)" }} onClick={onClose}>
      <div className="flex-1" />
      <div
        className="w-full max-w-lg mx-auto rounded-t-3xl flex flex-col"
        style={{ background: "#fff", borderTop: "1px solid #e5e7eb", maxHeight: "85vh" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="px-4 pt-4 pb-2 flex justify-center flex-shrink-0">
          <div className="w-10 h-1 rounded-full" style={{ background: "#d1d5db" }} />
        </div>
        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-3 flex-shrink-0">
          <h3 className="text-base font-black" style={{ color: "#111827" }}>修改上架資料</h3>
          <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: "#f3f4f6", border: "1px solid #e5e7eb" }}>
            <X className="w-3.5 h-3.5" style={{ color: "#6b7280" }} />
          </button>
        </div>
        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 px-4 pb-6 space-y-4">

          {/* Photos */}
          <div>
            <label className="text-xs font-bold mb-2 block" style={{ color: "#6b7280" }}>實物相片（最多 6 張）</label>
            <div className="flex gap-2 flex-wrap">
              {photos.map((url, i) => (
                <div key={i} className="relative rounded-xl overflow-hidden flex-shrink-0" style={{ width: 64, height: 88 }}>
                  <img
                    src={url} alt=""
                    className="w-full h-full object-cover cursor-pointer"
                    onClick={() => setLbIdx(i)}
                  />
                  <button
                    onClick={() => setPhotos(p => p.filter((_, j) => j !== i))}
                    className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ background: "rgba(0,0,0,0.7)" }}
                  >
                    <X className="w-3 h-3 text-white" />
                  </button>
                </div>
              ))}
              {photos.length < 6 && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="rounded-xl flex flex-col items-center justify-center gap-1 flex-shrink-0"
                  style={{ width: 64, height: 88, background: "#f8f9fa", border: "2px dashed #d1d5db" }}
                >
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" style={{ color: "#9ca3af" }} /> : <Plus className="w-4 h-4" style={{ color: "#9ca3af" }} />}
                  <span className="text-[9px]" style={{ color: "#9ca3af" }}>{uploading ? "上載中" : "加相片"}</span>
                </button>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={e => handlePhotoUpload(e.target.files)} />
          </div>

          {/* 裸卡 / 評級卡 二選一 */}
          <div>
            <label className="text-xs font-bold mb-1.5 block" style={{ color: "#6b7280" }}>卡牌類型</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsGraded(false)}
                className="flex-shrink-0 text-xs px-4 py-1.5 rounded-full font-bold transition-all"
                style={!isGraded
                  ? { background: "linear-gradient(90deg,#FFDE00,#FFB800)", color: "#111827", border: "1px solid #FFB800" }
                  : { background: "#f3f4f6", color: "#6b7280", border: "1px solid #e5e7eb" }}
              >裸卡 Raw</button>
              <button
                type="button"
                onClick={() => setIsGraded(true)}
                className="flex-shrink-0 text-xs px-4 py-1.5 rounded-full font-bold transition-all"
                style={isGraded
                  ? { background: "linear-gradient(90deg,#FFDE00,#FFB800)", color: "#111827", border: "1px solid #FFB800" }
                  : { background: "#f3f4f6", color: "#6b7280", border: "1px solid #e5e7eb" }}
              >評級卡</button>
            </div>
          </div>

          {/* 裸卡：顯示品相 */}
          {!isGraded && (
            <div>
              <label className="text-xs font-bold mb-1.5 block" style={{ color: "#6b7280" }}>品相</label>
              <div className="flex gap-2 overflow-x-auto pb-0.5" style={{ scrollbarWidth: "none" }}>
                {CONDITIONS.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCondition(c.id as typeof condition)}
                    className="flex-shrink-0 text-xs px-3 py-1.5 rounded-full font-bold whitespace-nowrap transition-all"
                    style={condition === c.id
                      ? { background: "linear-gradient(90deg,#FFDE00,#FFB800)", color: "#111827", border: "1px solid #FFB800" }
                      : { background: "#f3f4f6", color: "#6b7280", border: "1px solid #e5e7eb" }}
                  >{c.label}</button>
                ))}
              </div>
            </div>
          )}

          {/* 評級卡：顯示評級機構 + 評分 */}
          {isGraded && (
            <div className="flex flex-col gap-2.5">
              <div>
                <label className="text-xs mb-1.5 block" style={{ color: "#6b7280" }}>評級機構</label>
                <div className="flex gap-2 overflow-x-auto pb-0.5" style={{ scrollbarWidth: "none" }}>
                  {["PSA", "BGS", "CGC", "SGC", "其他"].map(o => (
                    <button
                      key={o}
                      type="button"
                      onClick={() => setGradingOrg(o)}
                      className="flex-shrink-0 text-xs px-3 py-1.5 rounded-full font-bold whitespace-nowrap transition-all"
                      style={gradingOrg === o
                        ? { background: "linear-gradient(90deg,#FFDE00,#FFB800)", color: "#111827", border: "1px solid #FFB800" }
                        : { background: "#f3f4f6", color: "#6b7280", border: "1px solid #e5e7eb" }}
                    >{o}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs mb-1.5 block" style={{ color: "#6b7280" }}>評分</label>
                <input
                  value={gradeScore}
                  onChange={e => setGradeScore(e.target.value)}
                  placeholder="10 / 9.5"
                  className="w-full px-3 py-2 text-sm"
                  style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", color: "#111827", outline: "none" }}
                />
              </div>
            </div>
          )}

          {/* Price */}
          <div>
            <label className="text-xs font-bold mb-1.5 block" style={{ color: "#6b7280" }}>售價 (HKD)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold" style={{ color: "#9ca3af" }}>$</span>
              <input
                value={priceStr}
                onChange={e => setPriceStr(e.target.value)}
                inputMode="numeric"
                className="w-full pl-7 pr-3 py-2.5 text-sm font-black"
                style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", color: "#CC0000", outline: "none" }}
              />
            </div>
          </div>

          {/* Delivery */}
          <div>
            <label className="text-xs font-bold mb-1.5 block" style={{ color: "#6b7280" }}>交收方法</label>
            <div className="flex gap-2 overflow-x-auto pb-0.5" style={{ scrollbarWidth: "none" }}>
              {["面交相約", "郵寄", "面交或郵寄"].map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setDeliveryMethod(m)}
                  className="flex-shrink-0 text-xs px-3 py-1.5 rounded-full font-bold whitespace-nowrap transition-all"
                  style={deliveryMethod === m
                    ? { background: "linear-gradient(90deg,#FFDE00,#FFB800)", color: "#111827", border: "1px solid #FFB800" }
                    : { background: "#f3f4f6", color: "#6b7280", border: "1px solid #e5e7eb" }}
                >{m}</button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-bold mb-1.5 block" style={{ color: "#6b7280" }}>備註說明</label>
            <textarea
              value={desc}
              onChange={e => setDesc(e.target.value)}
              rows={3}
              placeholder="例：背面有輕微花痕，不影響正面觀感"
              className="w-full px-3 py-2 text-sm resize-none"
              style={{ background: "#f8f9fa", border: "1px solid #e5e7eb", borderRadius: "12px", color: "#111827", outline: "none" }}
            />
          </div>

          {/* Save button */}
          <div style={{ paddingBottom: 40 }}>
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full py-3 rounded-2xl text-sm font-black flex items-center justify-center gap-2"
              style={{ background: "linear-gradient(90deg, #FFDE00, #FFB800)", color: "#111827" }}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              儲存更改
            </button>
          </div>
        </div>
      </div>

      {lbIdx !== null && createPortal(
        <ImageLightbox images={photos} initialIndex={lbIdx} onClose={() => setLbIdx(null)} />,
        document.body
      )}
    </div>
  );
}

function ListingRow({ listing, onRefresh }: { listing: Listing; onRefresh: () => void }) {
  const confirm = useConfirm();
  const [editOpen, setEditOpen] = useState(false);
  const [lbIdx, setLbIdx] = useState<number | null>(null);
  const removeMut = trpc.cardTrading.removeListing.useMutation();
  const markSoldMut = trpc.cardTrading.markSold.useMutation();
  const relistMut = trpc.cardTrading.relistListing.useMutation();
  const cond = CONDITION_LABELS[listing.condition] ?? { label: listing.condition, color: "#7c3aed" };
  const photos = listing.photoUrls.length ? listing.photoUrls : (listing.officialImageUrl ? [listing.officialImageUrl] : []);
  const img = photos[0] ?? null;

  const cardInfo = `${listing.cardName}｜HKD $${listing.priceHKD.toLocaleString()}`;

  async function handleRemove() {
    const ok = await confirm({ title: "下架此記錄？", description: `${cardInfo}\n\n下架後不會顯示在市場，可重新上架。`, confirmText: "確認下架" });
    if (!ok) return;
    try {
      await removeMut.mutateAsync({ id: listing.id });
      toast.success("已下架");
      onRefresh();
    } catch { toast.error("下架失敗"); }
  }

  async function handleMarkSold() {
    const ok = await confirm({ title: "標記為已售出？", description: `${cardInfo}\n\n標記後此上架記錄將關閉。`, confirmText: "確認售出" });
    if (!ok) return;
    try {
      await markSoldMut.mutateAsync({ id: listing.id });
      toast.success("已標記為售出");
      onRefresh();
    } catch { toast.error("操作失敗"); }
  }

  async function handleRelist() {
    const ok = await confirm({ title: "重新上架？", description: `${cardInfo}\n\n確認後此記錄將重新顯示在市場。`, confirmText: "確認上架" });
    if (!ok) return;
    try {
      await relistMut.mutateAsync({ id: listing.id });
      toast.success("已重新上架");
      onRefresh();
    } catch { toast.error("操作失敗"); }
  }

  return (
    <>
      {editOpen && <EditPriceSheet listing={listing} onClose={() => setEditOpen(false)} onSaved={onRefresh} />}
      {lbIdx !== null && createPortal(
        <ImageLightbox images={photos} initialIndex={lbIdx} onClose={() => setLbIdx(null)} bottomInset={80} />,
        document.body
      )}
      <div className="relative flex items-center gap-3 p-3 rounded-2xl overflow-hidden" style={{ background: "#fff", border: "1px solid #e5e7eb", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
        {/* Corner ribbon — top-right triangle */}
        {listing.status === "sold" && (
          <div className="absolute pointer-events-none" style={{ top: 0, right: 0, width: 50, height: 50 }}>
            <div style={{ position: "absolute", top: 0, right: 0, width: 0, height: 0, borderStyle: "solid", borderWidth: "0 50px 50px 0", borderColor: "transparent #dc2626 transparent transparent" }} />
            <div style={{ position: "absolute", top: 8, right: -1, width: 38, transform: "rotate(45deg)", color: "#fff", fontSize: 8, fontWeight: 900, textAlign: "center", lineHeight: 1.2 }}>已售出</div>
          </div>
        )}
        {listing.status === "removed" && (
          <div className="absolute pointer-events-none" style={{ top: 0, right: 0, width: 50, height: 50 }}>
            <div style={{ position: "absolute", top: 0, right: 0, width: 0, height: 0, borderStyle: "solid", borderWidth: "0 50px 50px 0", borderColor: "transparent #6b7280 transparent transparent" }} />
            <div style={{ position: "absolute", top: 8, right: -1, width: 38, transform: "rotate(45deg)", color: "#fff", fontSize: 8, fontWeight: 900, textAlign: "center", lineHeight: 1.2 }}>已下架</div>
          </div>
        )}

        <div className="flex-shrink-0 rounded-xl overflow-hidden" style={{ width: 48, height: 66 }}>
          {img ? (
            <img
              src={img} alt=""
              className="w-full h-full object-cover cursor-pointer active:opacity-80"
              style={{ opacity: listing.status !== "active" ? 0.5 : 1 }}
              onClick={() => setLbIdx(0)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center" style={{ background: "#f8f9fa" }}>
              <span style={{ fontSize: 24 }}>🃏</span>
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-black leading-tight line-clamp-1" style={{ color: "#111827" }}>{listing.cardName}</p>
          {listing.setName && <p className="text-[10px] mt-0.5" style={{ color: "#9ca3af" }}>{listing.setName}</p>}
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-xs font-black" style={{ color: "#CC0000" }}>HKD ${listing.priceHKD.toLocaleString()}</span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md" style={{ background: cond.color + "18", color: cond.color }}>
              {listing.isGraded && listing.gradeScore ? `${listing.gradingOrg} ${listing.gradeScore}` : cond.label}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <Eye className="w-3 h-3" style={{ color: "#9ca3af" }} />
            <span className="text-[10px]" style={{ color: "#9ca3af" }}>{listing.views}</span>
            <span className="text-[10px]" style={{ color: "#d1d5db" }}>{timeAgo(listing.createdAt)}</span>
            {(listing.status === "sold" || listing.status === "removed") && (
              <button
                onClick={handleRelist}
                disabled={relistMut.isPending}
                className="ml-auto text-[10px] font-black px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0"
                style={{ background: "linear-gradient(90deg,#FFDE00,#FFB800)", color: "#111827", border: "none" }}
              >重新上架</button>
            )}
          </div>
        </div>
        {listing.status === "active" && (
          <div className="flex flex-col gap-1.5 flex-shrink-0">
            <button onClick={() => setEditOpen(true)} className="p-1.5 rounded-lg" style={{ background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.2)" }}>
              <Edit2 className="w-3.5 h-3.5" style={{ color: "#F97316" }} />
            </button>
            <button onClick={handleMarkSold} className="p-1.5 rounded-lg" style={{ background: "rgba(22,163,74,0.1)", border: "1px solid rgba(22,163,74,0.2)" }}>
              <Check className="w-3.5 h-3.5" style={{ color: "#16a34a" }} />
            </button>
            <button onClick={handleRemove} className="p-1.5 rounded-lg" style={{ background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.15)" }}>
              <Trash2 className="w-3.5 h-3.5" style={{ color: "#dc2626" }} />
            </button>
          </div>
        )}
      </div>
    </>
  );
}

function EditWTBSheet({ wtb, onClose, onSaved }: { wtb: WTB; onClose: () => void; onSaved: () => void }) {
  const [maxPriceStr, setMaxPriceStr] = useState(wtb.maxPriceHKD ? String(wtb.maxPriceHKD) : "");
  const [minCondition, setMinCondition] = useState(wtb.minCondition ?? "");
  const [notes, setNotes] = useState(wtb.notes ?? "");
  const [saving, setSaving] = useState(false);
  const updateMut = trpc.cardTrading.updateWTB.useMutation();

  async function handleSave() {
    setSaving(true);
    try {
      await updateMut.mutateAsync({
        id: wtb.id,
        maxPriceHKD: maxPriceStr ? (parseInt(maxPriceStr, 10) || null) : null,
        minCondition: minCondition || null,
        notes: notes.trim() || null,
      });
      toast.success("已更新求購資料");
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "更新失敗");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col" style={{ background: "rgba(0,0,0,0.5)" }} onClick={onClose}>
      <div className="flex-1" />
      <div
        className="w-full max-w-lg mx-auto rounded-t-3xl flex flex-col"
        style={{ background: "#fff", borderTop: "1px solid #e5e7eb", maxHeight: "70vh" }}
        onClick={e => e.stopPropagation()}
      >
        <div className="px-4 pt-4 pb-2 flex justify-center flex-shrink-0">
          <div className="w-10 h-1 rounded-full" style={{ background: "#d1d5db" }} />
        </div>
        <div className="flex items-center justify-between px-4 pb-3 flex-shrink-0">
          <h3 className="text-base font-black" style={{ color: "#111827" }}>修改求購條件</h3>
          <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: "#f3f4f6", border: "1px solid #e5e7eb" }}>
            <X className="w-3.5 h-3.5" style={{ color: "#6b7280" }} />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-4 pb-6 space-y-4">
          <div>
            <p className="text-xs font-black mb-1" style={{ color: "#111827" }}>{wtb.cardName}</p>
          </div>
          <div>
            <label className="text-xs font-bold mb-1.5 block" style={{ color: "#6b7280" }}>心水上限價 (HKD，選填)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold" style={{ color: "#9ca3af" }}>$</span>
              <input
                value={maxPriceStr}
                onChange={e => setMaxPriceStr(e.target.value)}
                inputMode="numeric"
                placeholder="不限"
                className="w-full pl-7 pr-3 py-2.5 text-sm font-black"
                style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", color: "#16a34a", outline: "none" }}
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold mb-1.5 block" style={{ color: "#6b7280" }}>最低品相（選填）</label>
            <div className="flex gap-2 flex-wrap">
              {["", "NM", "LP", "MP", "HP", "DMG"].map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setMinCondition(c)}
                  className="text-xs px-3 py-1.5 rounded-full font-bold transition-all"
                  style={minCondition === c
                    ? { background: "linear-gradient(90deg,#FFDE00,#FFB800)", color: "#111827", border: "1px solid #FFB800" }
                    : { background: "#f3f4f6", color: "#6b7280", border: "1px solid #e5e7eb" }}
                >{c === "" ? "不限" : c}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-bold mb-1.5 block" style={{ color: "#6b7280" }}>備註（選填）</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="例：只接受有封套、不介意輕微花"
              className="w-full px-3 py-2 text-sm resize-none"
              style={{ background: "#f8f9fa", border: "1px solid #e5e7eb", borderRadius: "12px", color: "#111827", outline: "none" }}
            />
          </div>
          <div style={{ paddingBottom: 40 }}>
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full py-3 rounded-2xl text-sm font-black flex items-center justify-center gap-2"
              style={{ background: "linear-gradient(90deg, #FFDE00, #FFB800)", color: "#111827" }}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              儲存更改
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function WTBRow({ wtb, onRefresh }: { wtb: WTB; onRefresh: () => void }) {
  const confirm = useConfirm();
  const deactivateMut = trpc.cardTrading.deactivateWTB.useMutation();
  const reactivateMut = trpc.cardTrading.reactivateWTB.useMutation();
  const [lbOpen, setLbOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  async function handleDeactivate() {
    const ok = await confirm({ title: "關閉此求購記錄？", description: "關閉後不會再收到相關通知，可隨時重開。", confirmText: "確認關閉" });
    if (!ok) return;
    try {
      await deactivateMut.mutateAsync({ id: wtb.id });
      toast.success("已關閉求購記錄");
      onRefresh();
    } catch { toast.error("操作失敗"); }
  }

  async function handleReactivate() {
    try {
      await reactivateMut.mutateAsync({ id: wtb.id });
      toast.success("已重開求購記錄");
      onRefresh();
    } catch { toast.error("操作失敗"); }
  }

  return (
    <>
      {editOpen && <EditWTBSheet wtb={wtb} onClose={() => setEditOpen(false)} onSaved={onRefresh} />}
      <div className="relative flex items-center gap-3 p-3 rounded-2xl overflow-hidden" style={{ background: wtb.isActive ? "#fff" : "#fafafa", border: "1px solid #e5e7eb", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
        {/* Corner ribbon for closed WTB */}
        {!wtb.isActive && (
          <div className="absolute pointer-events-none" style={{ top: 0, right: 0, width: 50, height: 50 }}>
            <div style={{ position: "absolute", top: 0, right: 0, width: 0, height: 0, borderStyle: "solid", borderWidth: "0 50px 50px 0", borderColor: "transparent #6b7280 transparent transparent" }} />
            <div style={{ position: "absolute", top: 8, right: -1, width: 38, transform: "rotate(45deg)", color: "#fff", fontSize: 8, fontWeight: 900, textAlign: "center", lineHeight: 1.2 }}>已關閉</div>
          </div>
        )}

        {wtb.officialImageUrl ? (
          <>
            <img
              src={wtb.officialImageUrl} alt=""
              className="rounded-xl flex-shrink-0 object-cover cursor-pointer"
              style={{ width: 40, height: 56, opacity: wtb.isActive ? 1 : 0.45 }}
              onClick={() => setLbOpen(true)}
            />
            {lbOpen && createPortal(
              <ImageLightbox images={[wtb.officialImageUrl]} initialIndex={0} onClose={() => setLbOpen(false)} />,
              document.body
            )}
          </>
        ) : (
          <div className="rounded-xl flex-shrink-0 flex items-center justify-center" style={{ width: 40, height: 56, background: "#f8f9fa" }}>
            <span style={{ fontSize: 20 }}>🃏</span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-black leading-tight line-clamp-1" style={{ color: wtb.isActive ? "#111827" : "#9ca3af" }}>{wtb.cardName}</p>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "rgba(249,115,22,0.1)", color: "#F97316", border: "1px solid rgba(249,115,22,0.2)" }}>{GAMES_LABEL[wtb.game] ?? wtb.game}</span>
            {wtb.maxPriceHKD && <span className="text-[10px] font-bold" style={{ color: "#16a34a" }}>上限 ${wtb.maxPriceHKD}</span>}
            {wtb.minCondition && <span className="text-[10px]" style={{ color: "#9ca3af" }}>最低 {wtb.minCondition}</span>}
          </div>
          {wtb.notes && <p className="text-[10px] mt-0.5 line-clamp-1" style={{ color: "#9ca3af" }}>{wtb.notes}</p>}
          {!wtb.isActive && (
            <div className="mt-1">
              <button
                onClick={handleReactivate}
                disabled={reactivateMut.isPending}
                className="flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full whitespace-nowrap"
                style={{ background: "rgba(14,165,233,0.1)", border: "1px solid rgba(14,165,233,0.25)", color: "#0369a1" }}
              >
                <RotateCcw className="w-3 h-3" />
                重新開啟
              </button>
            </div>
          )}
        </div>
        {wtb.isActive && (
          <div className="flex flex-col gap-1.5 flex-shrink-0">
            <button onClick={() => setEditOpen(true)} className="p-1.5 rounded-lg" style={{ background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.2)" }}>
              <Edit2 className="w-3.5 h-3.5" style={{ color: "#F97316" }} />
            </button>
            <button onClick={handleDeactivate} disabled={deactivateMut.isPending} className="p-1.5 rounded-lg" style={{ background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.15)" }}>
              <X className="w-3.5 h-3.5" style={{ color: "#dc2626" }} />
            </button>
          </div>
        )}
      </div>
    </>
  );
}

type Tab = "active" | "sold" | "removed" | "wtb";

export default function CardMarketMy() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [tab, setTab] = useState<Tab>(() => {
    const p = new URLSearchParams(search).get("tab");
    if (p === "sold" || p === "removed" || p === "wtb") return p;
    return "active";
  });

  const { data: activeListings = [], refetch: refetchActive } = trpc.cardTrading.getMyListings.useQuery({ status: "active", limit: 50 }, { enabled: isAuthenticated, refetchOnMount: "always" });
  const { data: soldListings = [], refetch: refetchSold } = trpc.cardTrading.getMyListings.useQuery({ status: "sold", limit: 50 }, { enabled: isAuthenticated, refetchOnMount: "always" });
  const { data: removedListings = [], refetch: refetchRemoved } = trpc.cardTrading.getMyListings.useQuery({ status: "removed", limit: 50 }, { enabled: isAuthenticated, refetchOnMount: "always" });
  const { data: myWTBs = [], refetch: refetchWTBs } = trpc.cardTrading.getMyWTBs.useQuery({ limit: 50 }, { enabled: isAuthenticated, refetchOnMount: "always" });

  useEffect(() => {
    if (isAuthenticated) {
      refetchActive();
      refetchSold();
      refetchRemoved();
      refetchWTBs();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate(`/login?from=${encodeURIComponent(window.location.pathname + window.location.search)}`);
    }
  }, [authLoading, isAuthenticated]);

  if (authLoading || !isAuthenticated) return null;

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

  function refetchAll() {
    refetchActive();
    refetchSold();
    refetchRemoved();
  }

  const currentRefresh =
    tab === "active" ? refetchActive :
    tab === "sold" ? refetchSold :
    tab === "removed" ? refetchRemoved : refetchWTBs;

  return (
    <div className="min-h-screen pb-20" style={{ background: "#f8f9fa" }}>
      <Header />
      {/* CardZzz sub-header strip */}
      <div
        className="flex items-center justify-between px-4 py-2.5"
        style={{ marginTop: 3, marginLeft: 5, marginRight: 5, background: "linear-gradient(90deg,#1e3a5f 0%,#0369a1 60%,#0ea5e9 100%)", borderRadius: 10 }}
      >
        <div className="flex items-baseline gap-0.5">
          <span className="text-xl font-black text-white" style={{ letterSpacing: "-0.5px" }}>Card</span>
          <span className="text-xl font-black" style={{ color: "#FFDE00", letterSpacing: "-0.5px" }}>Zx</span>
          <span className="text-xs font-bold ml-2" style={{ color: "rgba(255,255,255,0.6)" }}>我的清單</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/cardzx/market/sell")}
            className="text-xs px-3 py-1.5 rounded-full font-bold"
            style={{ background: "linear-gradient(90deg,#FFDE00,#FFB800)", color: "#111827" }}
          >
            + 上架
          </button>
          <button
            onClick={() => navigate("/cardzx/market")}
            className="p-1.5 rounded-full"
            style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)" }}
          >
            <ChevronLeft className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>
      <div className="max-w-lg mx-auto px-[5px] pt-4">


        {/* Tabs */}
        <div className="flex gap-1 mb-4 p-1 rounded-2xl" style={{ background: "#fff", border: "1px solid #e5e7eb" }}>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="flex-1 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1"
              style={tab === t.id
                ? { background: t.id === "wtb" ? "rgba(249,115,22,0.12)" : "linear-gradient(90deg, #FFDE00, #FFB800)", color: t.id === "wtb" ? "#F97316" : "#111827" }
                : { color: "#9ca3af" }}
            >
              {t.id === "wtb" && <ShoppingBag className="w-3 h-3" />}
              {t.label}
              {(t.count ?? 0) > 0 && (
                <span className="text-[9px] px-1 py-0.5 rounded-full min-w-[16px] text-center" style={{ background: tab === t.id ? "rgba(255,255,255,0.25)" : "#f3f4f6", color: tab === t.id ? "#fff" : "#9ca3af" }}>
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
                <p className="text-sm" style={{ color: "#9ca3af" }}>
                  {tab === "active" ? "未有上架記錄" : tab === "sold" ? "未有售出記錄" : "未有下架記錄"}
                </p>
                {tab === "active" && (
                  <button onClick={() => navigate("/cardzx/market/sell")} className="text-sm px-4 py-2 rounded-full font-bold" style={{ background: "rgba(249,115,22,0.1)", color: "#F97316", border: "1px solid rgba(249,115,22,0.25)" }}>
                    立即上架
                  </button>
                )}
              </div>
            ) : (
              currentListings.map(l => (
                <ListingRow key={l.id} listing={l} onRefresh={refetchAll} />
              ))
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {(myWTBs as WTB[]).length === 0 ? (
              <div className="flex flex-col items-center py-10 gap-3">
                <span style={{ fontSize: 40 }}>🔍</span>
                <p className="text-sm" style={{ color: "#9ca3af" }}>未有求購記錄</p>
                <button onClick={() => navigate("/cardzx/market/wtb")} className="text-sm px-4 py-2 rounded-full font-bold" style={{ background: "rgba(249,115,22,0.1)", color: "#F97316", border: "1px solid rgba(249,115,22,0.25)" }}>
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
