import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import Header from "@/components/Header";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { Search, Upload, X, ChevronLeft, Loader2, Check, Plus, ShoppingBag, Grid3x3, ChevronRight, Share2, Heart } from "lucide-react";

const GAMES = [
  { id: "pokemon", label: "Pokémon", emoji: "⚡" },
  { id: "yugioh", label: "遊戲王", emoji: "👁" },
  { id: "mtg", label: "MTG", emoji: "🌊" },
  { id: "onepiece", label: "航海王", emoji: "⚓" },
  { id: "dragonball", label: "龍珠", emoji: "🐉" },
  { id: "digimon", label: "數碼暴龍", emoji: "💾" },
  { id: "other", label: "手動填寫", emoji: "🃏" },
] as const;

type GameId = typeof GAMES[number]["id"];
type BrowsableGame = "pokemon" | "yugioh" | "mtg" | "digimon";

const CONDITIONS = [
  { id: "NM", label: "NM — 近全新", desc: "無可見磨損" },
  { id: "LP", label: "LP — 輕微磨損", desc: "輕微刮痕或折痕" },
  { id: "MP", label: "MP — 中度磨損", desc: "明顯磨損但可辨別" },
  { id: "HP", label: "HP — 嚴重磨損", desc: "大量磨損" },
  { id: "DMG", label: "DMG — 損壞", desc: "破損/摺痕" },
] as const;

interface CardResult {
  cardApiId: string; cardName: string; cardNameJa?: string;
  setName?: string; setNumber?: string; rarity?: string; officialImageUrl?: string;
}

interface SetResult {
  setId: string; name: string; series?: string;
  releaseDate?: string; total?: number; logoUrl?: string | null; symbolUrl?: string | null;
}

type Mode = "sell" | "wtb";
type Step2Tab = "browse" | "search";

function getRarityShort(rarity: string | null | undefined): string | null {
  if (!rarity) return null;
  const r = rarity.toLowerCase();
  if (r.includes("special illustration")) return "SAR";
  if (r.includes("illustration rare")) return "IR";
  if (r.includes("amazing rare")) return "AR";
  if (r.includes("hyper rare")) return "HR";
  if (r.includes("double rare")) return "RR";
  if (r.includes("ultra rare")) return "UR";
  if (r.includes("secret rare")) return "SR";
  if (r.includes("rainbow rare")) return "RR";
  if (r.includes("gold rare")) return "GR";
  if (r.includes("starlight")) return "StR";
  if (r.includes("super rare")) return "SR";
  if (r.includes("full art")) return "FA";
  if (r.includes("ace spec")) return "ACE";
  if (r.includes("promo")) return "PR";
  if (r.includes("uncommon")) return "U";
  if (r.includes("common")) return "C";
  if (r.includes("rare")) return "R";
  if (rarity.length <= 4) return rarity.toUpperCase();
  return null;
}

const BROWSABLE_GAMES: GameId[] = ["pokemon", "yugioh", "mtg", "digimon"];

export default function CardMarketSell() {
  const [location, navigate] = useLocation();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [mode, setMode] = useState<Mode>(location.includes("/wtb") ? "wtb" : "sell");

  const [step, setStep] = useState<1 | 2>(1);
  const [game, setGame] = useState<GameId | "">("");

  const [step2Tab, setStep2Tab] = useState<Step2Tab>("browse");
  const [selectedSet, setSelectedSet] = useState<SetResult | null>(null);
  const [setCardPage, setSetCardPage] = useState(1);
  const [accCards, setAccCards] = useState<CardResult[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<CardResult[]>([]);

  const [selectedCard, setSelectedCard] = useState<CardResult | null>(null);
  const [manualName, setManualName] = useState("");
  const [manualSet, setManualSet] = useState("");
  const [manualSetNo, setManualSetNo] = useState("");

  const [condition, setCondition] = useState<"NM" | "LP" | "MP" | "HP" | "DMG">("NM");
  const [isGraded, setIsGraded] = useState(false);
  const [gradingOrg, setGradingOrg] = useState("PSA");
  const [gradeScore, setGradeScore] = useState("");
  const [priceStr, setPriceStr] = useState("");
  const [description, setDescription] = useState("");
  const [deliveryMethod, setDeliveryMethod] = useState("面交或郵寄");
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Photo lightbox
  const [lbIdx, setLbIdx] = useState<number | null>(null);
  const lbZoom = useRef(1);
  const lbPanX = useRef(0);
  const lbPanY = useRef(0);
  const pinchStartDist = useRef(0);
  const pinchStartZoom = useRef(1);
  const panStartTouch = useRef({ x: 0, y: 0 });
  const panStartOffset = useRef({ x: 0, y: 0 });
  const lbImgRef = useRef<HTMLImageElement>(null);
  const [lbRender, setLbRender] = useState(0);
  const applyTransform = useCallback(() => {
    if (lbImgRef.current) {
      lbImgRef.current.style.transform = `translate(${lbPanX.current}px,${lbPanY.current}px) scale(${lbZoom.current})`;
    }
  }, []);
  const [lbSingleImg, setLbSingleImg] = useState<string | null>(null);
  const closeLb = useCallback(() => { setLbIdx(null); setLbSingleImg(null); lbZoom.current=1; lbPanX.current=0; lbPanY.current=0; }, []);
  const resetLbTransform = () => { lbZoom.current=1; lbPanX.current=0; lbPanY.current=0; applyTransform(); setLbRender(n=>n+1); };

  const [maxPriceStr, setMaxPriceStr] = useState("");
  const [wtbCondition, setWtbCondition] = useState<"NM" | "LP" | "MP" | "HP" | "DMG" | "">("NM");
  const [wtbNotes, setWtbNotes] = useState("");
  const [wtbPhotos, setWtbPhotos] = useState<string[]>([]);
  const [wtbOfficialUrl, setWtbOfficialUrl] = useState<string | null>(null);
  const [wtbUploading, setWtbUploading] = useState(false);
  const wtbFileInputRef = useRef<HTMLInputElement>(null);

  const [previewCard, setPreviewCard] = useState<CardResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  const utils = trpc.useUtils();
  const signUploadMut = trpc.cardTrading.signPhotoUpload.useMutation();
  const createListingMut = trpc.cardTrading.createListing.useMutation();
  const createWTBMut = trpc.cardTrading.createWTB.useMutation();

  const isBrowsable = game && BROWSABLE_GAMES.includes(game as GameId);

  const setsQuery = trpc.cardTrading.getSets.useQuery(
    { game: game as BrowsableGame },
    { enabled: !!isBrowsable && mode !== "wtb" && step2Tab === "browse" && step === 1 && !selectedSet, staleTime: 300000 }
  );

  const setCardsQuery = trpc.cardTrading.getSetCards.useQuery(
    { game: game as BrowsableGame, setId: selectedSet?.setId ?? "", page: setCardPage },
    { enabled: !!selectedSet && !!isBrowsable, staleTime: 120000 }
  );

  const prevSetRef = useRef<string | null>(null);
  useEffect(() => {
    if (!setCardsQuery.data || !selectedSet) return;
    const key = `${selectedSet.setId}-${setCardPage}`;
    if (prevSetRef.current === key) return;
    prevSetRef.current = key;
    const newCards = setCardsQuery.data.cards as CardResult[];
    if (setCardPage === 1) {
      setAccCards(newCards);
    } else {
      setAccCards(prev => {
        const ids = new Set(prev.map(c => c.cardApiId));
        return [...prev, ...newCards.filter(c => !ids.has(c.cardApiId))];
      });
    }
  }, [setCardsQuery.data, selectedSet, setCardPage]);

  function handleSelectSet(s: SetResult) {
    setSelectedSet(s);
    setSetCardPage(1);
    setAccCards([]);
    prevSetRef.current = null;
  }

  function handleBackToSets() {
    setSelectedSet(null);
    setSetCardPage(1);
    setAccCards([]);
    prevSetRef.current = null;
  }

  function handleLoadMore() {
    setSetCardPage(p => p + 1);
  }

  function handleSelectCard(card: CardResult) {
    setSelectedCard(card);
    setStep(2);
  }

  async function handleSearch() {
    if (!searchQuery.trim() || !game) return;
    setIsSearching(true);
    setSearchResults([]);
    try {
      const results = await utils.cardTrading.searchCards.fetch({ game: game as GameId, query: searchQuery.trim() });
      setSearchResults(results as CardResult[]);
    } catch {
      toast.error("搜尋失敗，請手動填寫卡牌資料");
    } finally {
      setIsSearching(false);
    }
  }

  async function compressImage(file: File, maxPx = 1400, quality = 0.82): Promise<{ blob: Blob; mimeType: string }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        let { width, height } = img;
        if (width > maxPx || height > maxPx) {
          if (width >= height) { height = Math.round(height * maxPx / width); width = maxPx; }
          else { width = Math.round(width * maxPx / height); height = maxPx; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
        canvas.toBlob(blob => {
          if (!blob) { reject(new Error("compress failed")); return; }
          resolve({ blob, mimeType: "image/jpeg" });
        }, "image/jpeg", quality);
      };
      img.onerror = reject;
      img.src = url;
    });
  }

  // sync official image when card is selected
  useEffect(() => {
    setWtbOfficialUrl(selectedCard?.officialImageUrl ?? null);
  }, [selectedCard]);

  async function handleWtbPhotoUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    const totalSlots = (wtbOfficialUrl ? 1 : 0) + wtbPhotos.length;
    const remaining = 6 - totalSlots;
    if (remaining <= 0) return;
    const toUpload = Array.from(files).slice(0, remaining);
    setWtbUploading(true);
    try {
      const urls = await Promise.all(toUpload.map(async file => {
        const { blob, mimeType } = await compressImage(file);
        const { uploadUrl, finalUrl } = await signUploadMut.mutateAsync({
          mimeType, fileName: file.name.replace(/\.[^.]+$/, ".jpg"),
        });
        await fetch(uploadUrl, { method: "PUT", body: blob, headers: { "Content-Type": mimeType } });
        return finalUrl;
      }));
      setWtbPhotos(p => [...p, ...urls]);
    } catch { toast.error("上載失敗，請重試"); }
    finally { setWtbUploading(false); }
  }

  async function handlePhotoUpload(files: FileList | null) {
    if (!files || photos.length >= 6) return;
    const allowed = Math.min(files.length, 6 - photos.length);
    setUploading(true);
    const newUrls: string[] = [];
    try {
      for (let i = 0; i < allowed; i++) {
        const file = files[i];
        const { blob, mimeType } = await compressImage(file);
        const { uploadUrl, finalUrl } = await signUploadMut.mutateAsync({
          mimeType,
          fileName: file.name.replace(/\.[^.]+$/, ".jpg"),
        });
        await fetch(uploadUrl, { method: "PUT", body: blob, headers: { "Content-Type": mimeType } });
        newUrls.push(finalUrl);
      }
      setPhotos(p => [...p, ...newUrls]);
      toast.success(`已上載 ${newUrls.length} 張相片`);
    } catch {
      toast.error("上載失敗，請重試");
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmitSell() {
    const price = parseInt(priceStr, 10);
    if (!price || price < 1) { toast.error("請填寫有效售價"); return; }
    if (photos.length === 0) { toast.error("請至少上載一張實物相片"); return; }
    const cardName = selectedCard?.cardName ?? manualName.trim();
    if (!cardName) { toast.error("請填寫卡牌名稱"); return; }
    setSubmitting(true);
    try {
      await createListingMut.mutateAsync({
        game: game as GameId,
        cardApiId: selectedCard?.cardApiId,
        cardName,
        cardNameJa: selectedCard?.cardNameJa,
        setName: (selectedCard?.setName ?? manualSet.trim()) || undefined,
        setNumber: (selectedCard?.setNumber ?? manualSetNo.trim()) || undefined,
        rarity: selectedCard?.rarity,
        officialImageUrl: selectedCard?.officialImageUrl,
        condition,
        isGraded,
        gradingOrg: isGraded ? gradingOrg : undefined,
        gradeScore: isGraded ? gradeScore : undefined,
        priceHKD: price,
        photoUrls: photos,
        description: description.trim() || undefined,
        deliveryMethod,
      });
      await utils.cardTrading.getMyListings.invalidate();
      toast.success("已成功上架！");
      navigate("/cardzx/market/my?tab=active");
    } catch (e: any) {
      toast.error(e?.message ?? "上架失敗");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmitWTB() {
    const cardName = selectedCard?.cardName ?? manualName.trim();
    if (!cardName) { toast.error("請填寫卡牌名稱"); return; }
    const maxPrice = maxPriceStr ? parseInt(maxPriceStr, 10) : undefined;
    setSubmitting(true);
    try {
      await createWTBMut.mutateAsync({
        game: game as GameId,
        cardApiId: selectedCard?.cardApiId,
        cardName,
        cardNameJa: selectedCard?.cardNameJa,
        setName: (selectedCard?.setName ?? manualSet.trim()) || undefined,
        setNumber: (selectedCard?.setNumber ?? manualSetNo.trim()) || undefined,
        officialImageUrl: wtbOfficialUrl || undefined,
        maxPriceHKD: maxPrice,
        minCondition: wtbCondition || undefined,
        notes: wtbNotes.trim() || undefined,
        photoUrls: wtbPhotos.length > 0 ? wtbPhotos : undefined,
      });
      toast.success("已登記求購！有人上架同款卡即通知你");
      navigate("/cardzx/market/my?tab=wtb");
    } catch (e: any) {
      toast.error(e?.message ?? "登記失敗");
    } finally {
      setSubmitting(false);
    }
  }

  const cardName = selectedCard?.cardName ?? manualName;
  const cardSet = selectedCard?.setName ?? manualSet;
  const cardImg = selectedCard?.officialImageUrl;

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate(`/login?from=${encodeURIComponent(window.location.pathname)}`);
    }
  }, [authLoading, isAuthenticated]);

  if (authLoading || !isAuthenticated) return null;

  return (
    <>
    <div className="min-h-screen pb-20" style={{ background: "#f8f9fa", color: "#111827" }}>
      <Header />
      {/* ── CardZzz sub-header strip ── */}
      <div
        style={{ background: "linear-gradient(135deg,#0369a1 0%,#0284c7 60%,#0ea5e9 100%)", borderRadius: 8, marginTop: 3, marginLeft: 5, marginRight: 5 }}
        className="px-4 pt-3 pb-3 flex items-center justify-between"
      >
        <div className="flex items-baseline gap-0.5">
          <span className="text-xl font-black text-white" style={{ letterSpacing: "-0.5px" }}>Card</span>
          <span className="text-xl font-black" style={{ color: "#FFDE00", letterSpacing: "-0.5px" }}>Zx</span>
        </div>
        <button
          onClick={() => navigate("/cardzx/market")}
          className="p-1.5 rounded-full"
          style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)" }}
        >
          <ChevronLeft className="w-4 h-4 text-white" />
        </button>
      </div>
      <div className="max-w-lg mx-auto px-[5px] pt-4">
        {/* Mode toggle */}
        <div className="flex gap-2 mb-5 p-1 rounded-2xl" style={{ background: "#fff", border: "1px solid #e5e7eb" }}>
          <button
            onClick={() => { setMode("sell"); }}
            className="flex-1 py-2 rounded-xl font-bold text-sm transition-all"
            style={mode === "sell" ? { background: "linear-gradient(90deg, #FFDE00, #FFB800)", color: "#111827" } : { color: "#9ca3af" }}
          >
            上架出售
          </button>
          <button
            onClick={() => { setMode("wtb"); }}
            className="flex-1 py-2 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-1.5"
            style={mode === "wtb" ? { background: "rgba(249,115,22,0.1)", color: "#F97316", border: "1px solid rgba(249,115,22,0.25)" } : { color: "#9ca3af" }}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            求購 WTB
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-6">
          {[1, 2].map(s => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0"
                style={step >= s ? { background: "linear-gradient(90deg, #FFDE00, #FFB800)", color: "#111827" } : { background: "#f3f4f6", color: "#d1d5db", border: "1px solid #e5e7eb" }}>
                {step > s ? <Check className="w-3 h-3" /> : s}
              </div>
              {s < 2 && <div className="flex-1 h-px" style={{ background: step > s ? "rgba(255,222,0,0.5)" : "#e5e7eb" }} />}
            </div>
          ))}
        </div>

        {/* ── Step 1: Choose game + Find card ──────────────────────────── */}
        {step === 1 && (
          <div>
            {/* Game chips */}
            <p className="text-xs font-bold mb-2" style={{ color: "#6b7280" }}>選擇遊戲</p>
            <div className="flex gap-2 mb-4 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
              {GAMES.map(g => (
                <button
                  key={g.id}
                  onClick={() => {
                    if (game !== g.id) {
                      setGame(g.id);
                      setSelectedCard(null);
                      setSelectedSet(null);
                      setSearchQuery("");
                      setSearchResults([]);
                      setAccCards([]);
                      prevSetRef.current = null;
                      setStep2Tab(BROWSABLE_GAMES.includes(g.id as GameId) && mode !== "wtb" ? "browse" : "search");
                    }
                  }}
                  className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all"
                  style={game === g.id
                    ? { background: "rgba(255,222,0,0.15)", color: "#CC0000", border: "1px solid rgba(255,222,0,0.4)" }
                    : { background: "#fff", color: "#6b7280", border: "1px solid #e5e7eb" }}
                >
                  <span>{g.emoji}</span>
                  <span>{g.label}</span>
                </button>
              ))}
            </div>

            {!game && <div className="py-8 text-center text-sm" style={{ color: "#9ca3af" }}>請先選擇遊戲類型</div>}

            {/* Tab toggle — sell mode + browsable games only */}
            {isBrowsable && mode !== "wtb" && (
              <div className="flex gap-1 mb-4 p-1 rounded-xl" style={{ background: "#fff", border: "1px solid #e5e7eb" }}>
                <button
                  onClick={() => { setStep2Tab("browse"); setSearchResults([]); }}
                  className="flex-1 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                  style={step2Tab === "browse"
                    ? { background: "rgba(249,115,22,0.1)", color: "#F97316" }
                    : { color: "#9ca3af" }}
                >
                  <Grid3x3 className="w-3.5 h-3.5" />
                  按系列瀏覽
                </button>
                <button
                  onClick={() => { setStep2Tab("search"); setSelectedSet(null); setAccCards([]); prevSetRef.current = null; }}
                  className="flex-1 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                  style={step2Tab === "search"
                    ? { background: "rgba(255,222,0,0.15)", color: "#111827" }
                    : { color: "#9ca3af" }}
                >
                  <Search className="w-3.5 h-3.5" />
                  搜尋
                </button>
              </div>
            )}

            {/* ── Browse mode ── */}
            {game && step2Tab === "browse" && isBrowsable && mode !== "wtb" && (
              <div>
                {!selectedSet ? (
                  <div>
                    <p className="text-xs mb-3" style={{ color: "#9ca3af" }}>
                      選擇系列，瀏覽所有高清卡牌圖鑑
                    </p>
                    {setsQuery.isLoading ? (
                      <div className="flex justify-center py-12">
                        <Loader2 className="w-7 h-7 animate-spin" style={{ color: "#CC0000" }} />
                      </div>
                    ) : setsQuery.error ? (
                      <div className="text-center py-8 text-sm" style={{ color: "#9ca3af" }}>
                        無法載入系列，請切換「搜尋」模式
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-2 max-h-[60vh] overflow-y-auto" style={{ scrollbarWidth: "none" }}>
                        {(setsQuery.data as SetResult[] ?? []).map(s => (
                          <button
                            key={s.setId}
                            onClick={() => handleSelectSet(s)}
                            className="flex flex-col items-center p-2 rounded-xl text-center transition-all"
                            style={{ background: "#fff", border: "1px solid #e5e7eb", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
                          >
                            {s.logoUrl ? (
                              <img
                                src={s.logoUrl}
                                alt={s.name}
                                className="object-contain mb-1.5"
                                style={{ width: "100%", height: 36 }}
                                onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                              />
                            ) : (
                              <div className="flex items-center justify-center mb-1.5 rounded-lg w-full" style={{ height: 36, background: "#f3f4f6" }}>
                                <span style={{ fontSize: 18 }}>🃏</span>
                              </div>
                            )}
                            <p className="text-[10px] font-bold leading-tight line-clamp-2 w-full" style={{ color: "#111827" }}>{s.name}</p>
                            {s.releaseDate && <span className="text-[9px] mt-0.5" style={{ color: "#d1d5db" }}>{s.releaseDate.substring(0, 7)}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <button
                        onClick={handleBackToSets}
                        className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full"
                        style={{ background: "#f3f4f6", color: "#6b7280", border: "1px solid #e5e7eb" }}
                      >
                        <ChevronLeft className="w-3 h-3" />
                        返回
                      </button>
                      <p className="text-xs font-bold flex-1 min-w-0 line-clamp-1" style={{ color: "#CC0000" }}>{selectedSet.name}</p>
                      {selectedSet.total && (
                        <span className="text-[10px] flex-shrink-0" style={{ color: "#9ca3af" }}>{selectedSet.total} 張</span>
                      )}
                    </div>

                    {setCardsQuery.isLoading && accCards.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 gap-3">
                        <Loader2 className="w-7 h-7 animate-spin" style={{ color: "#CC0000" }} />
                        <p className="text-xs" style={{ color: "#9ca3af" }}>載入卡牌圖鑑中...</p>
                      </div>
                    ) : (
                      <div>
                        <div className="grid grid-cols-2 gap-2 mb-3" style={{ maxHeight: "55vh", overflowY: "auto", scrollbarWidth: "none" }}>
                          {accCards.map(card => {
                            const rBadge = getRarityShort(card.rarity);
                            return (
                              <button
                                key={card.cardApiId}
                                onClick={() => setPreviewCard(card)}
                                className="flex flex-col rounded-xl overflow-hidden text-left transition-all"
                                style={{ background: "#fff", border: "1px solid #e5e7eb", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
                              >
                                <div className="relative w-full" style={{ paddingBottom: "140%" }}>
                                  {card.officialImageUrl ? (
                                    <img
                                      src={card.officialImageUrl}
                                      alt={card.cardName}
                                      className="absolute inset-0 w-full h-full object-cover"
                                      loading="lazy"
                                    />
                                  ) : (
                                    <div className="absolute inset-0 flex items-center justify-center" style={{ background: "#f8f9fa" }}>
                                      <span style={{ fontSize: 24 }}>🃏</span>
                                    </div>
                                  )}
                                  {rBadge && (
                                    <div className="absolute top-1 right-1">
                                      <span className="text-[8px] font-black px-1 py-px rounded" style={{ background: "rgba(0,0,0,0.75)", color: "#F97316" }}>
                                        {rBadge}
                                      </span>
                                    </div>
                                  )}
                                  {card.setNumber && (
                                    <div className="absolute bottom-1 left-1">
                                      <span className="text-[8px] px-1 py-px rounded" style={{ background: "rgba(0,0,0,0.55)", color: "rgba(255,255,255,0.85)" }}>
                                        {card.setNumber}
                                      </span>
                                    </div>
                                  )}
                                </div>
                                <div className="px-1.5 py-1.5">
                                  <p className="text-[10px] font-bold leading-tight line-clamp-2" style={{ color: "#111827" }}>{card.cardName}</p>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                        {(setCardsQuery.data as any)?.hasMore && (
                          <button
                            onClick={handleLoadMore}
                            disabled={setCardsQuery.isFetching}
                            className="w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2"
                            style={{ background: "rgba(249,115,22,0.1)", color: "#F97316", border: "1px solid rgba(249,115,22,0.25)" }}
                          >
                            {setCardsQuery.isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                            載入更多卡牌
                          </button>
                        )}
                        {accCards.length === 0 && !setCardsQuery.isLoading && (
                          <div className="text-center py-8 text-xs" style={{ color: "#9ca3af" }}>此系列暫無卡牌資料</div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── Search mode ── */}
            {game && (step2Tab === "search" || !isBrowsable || mode === "wtb") && (
              <div>
                <p className="text-xs mb-4" style={{ color: "#9ca3af" }}>
                  {(isBrowsable && mode !== "wtb") ? "輸入卡名搜尋，或切換「按系列瀏覽」" : isBrowsable ? "輸入卡名搜尋" : "請手動填寫卡牌資料"}
                </p>

                {isBrowsable && (
                  <div className="flex gap-2 mb-3">
                    <input
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && handleSearch()}
                      placeholder="輸入卡牌名稱搜尋..."
                      className="flex-1 px-3 py-2 text-sm"
                      style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", color: "#111827", outline: "none" }}
                    />
                    <button
                      onClick={handleSearch}
                      disabled={isSearching || !searchQuery.trim()}
                      className="px-3 py-2 rounded-xl font-bold text-sm flex items-center gap-1.5"
                      style={{ background: "rgba(249,115,22,0.1)", color: "#F97316", border: "1px solid rgba(249,115,22,0.25)" }}
                    >
                      {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    </button>
                  </div>
                )}

                {searchResults.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 mb-4 max-h-72 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
                    {searchResults.map((r, i) => {
                      const rBadge = getRarityShort(r.rarity);
                      return (
                        <button
                          key={i}
                          onClick={() => setPreviewCard(r)}
                          className="flex flex-col rounded-xl overflow-hidden text-left"
                          style={{ background: "#fff", border: "1px solid #e5e7eb", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
                        >
                          <div className="relative w-full" style={{ paddingBottom: "140%" }}>
                            {r.officialImageUrl ? (
                              <img src={r.officialImageUrl} alt={r.cardName} className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
                            ) : (
                              <div className="absolute inset-0 flex items-center justify-center" style={{ background: "#f8f9fa" }}>
                                <span style={{ fontSize: 24 }}>🃏</span>
                              </div>
                            )}
                            {rBadge && (
                              <div className="absolute top-1 right-1">
                                <span className="text-[8px] font-black px-1 py-px rounded" style={{ background: "rgba(0,0,0,0.75)", color: "#F97316" }}>
                                  {rBadge}
                                </span>
                              </div>
                            )}
                            {r.setNumber && (
                              <div className="absolute bottom-1 left-1">
                                <span className="text-[8px] px-1 py-px rounded" style={{ background: "rgba(0,0,0,0.55)", color: "rgba(255,255,255,0.85)" }}>
                                  {r.setNumber}
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="px-1.5 py-1.5">
                            <p className="text-[10px] font-bold leading-tight line-clamp-2" style={{ color: "#111827" }}>{r.cardName}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Manual entry */}
                <div className="p-4 rounded-2xl mb-4" style={{ background: "#fff", border: "1px solid #e5e7eb", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
                  <p className="text-xs font-bold mb-3" style={{ color: "#6b7280" }}>手動填寫</p>
                  <div className="flex flex-col gap-3">
                    <div>
                      <label className="text-xs mb-1 block" style={{ color: "#6b7280" }}>卡牌名稱 *</label>
                      <input
                        value={manualName}
                        onChange={e => setManualName(e.target.value)}
                        placeholder="例：Charizard / 噴火龍"
                        className="w-full px-3 py-2 text-sm"
                        style={{ background: "#f8f9fa", border: "1px solid #e5e7eb", borderRadius: "12px", color: "#111827", outline: "none" }}
                      />
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="text-xs mb-1 block" style={{ color: "#6b7280" }}>系列名稱</label>
                        <input
                          value={manualSet}
                          onChange={e => setManualSet(e.target.value)}
                          placeholder="例：Base Set"
                          className="w-full px-3 py-2 text-sm"
                          style={{ background: "#f8f9fa", border: "1px solid #e5e7eb", borderRadius: "12px", color: "#111827", outline: "none" }}
                        />
                      </div>
                      <div style={{ width: 100 }}>
                        <label className="text-xs mb-1 block" style={{ color: "#6b7280" }}>卡號</label>
                        <input
                          value={manualSetNo}
                          onChange={e => setManualSetNo(e.target.value)}
                          placeholder="4/102"
                          className="w-full px-3 py-2 text-sm"
                          style={{ background: "#f8f9fa", border: "1px solid #e5e7eb", borderRadius: "12px", color: "#111827", outline: "none" }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <button
                    onClick={() => { if (manualName.trim()) { setSelectedCard(null); setStep(2); } else { toast.error("請先搜尋選擇卡牌，或手動填寫名稱"); } }}
                    className="w-full py-2.5 rounded-2xl text-sm font-bold"
                    style={{ background: "linear-gradient(90deg, #FFDE00, #FFB800)", color: "#111827" }}
                  >
                    手動填寫繼續
                  </button>
                </div>
              </div>
            )}

          </div>
        )}

        {/* ── Step 2: Details ──────────────────────────────── */}
        {step === 2 && (
          <div>
            {/* Card preview */}
            <div className="flex gap-4 mb-5 p-4 rounded-2xl items-center" style={{ background: "#fff", border: "1px solid #e5e7eb", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
              {/* Card image */}
              <div className="flex-shrink-0">
                {cardImg ? (
                  <img
                    src={cardImg} alt=""
                    className="rounded-xl object-cover cursor-pointer"
                    style={{ width: 88, height: 122, display: "block" }}
                    onClick={() => { lbZoom.current=1; lbPanX.current=0; lbPanY.current=0; setLbSingleImg(cardImg); }}
                  />
                ) : (
                  <div className="rounded-xl flex items-center justify-center" style={{ width: 88, height: 122, background: "#f3f4f6" }}>
                    <span style={{ fontSize: 36 }}>🃏</span>
                  </div>
                )}
              </div>
              {/* Card info */}
              <div className="flex-1 min-w-0">
                {/* Rarity + set number */}
                {(selectedCard?.rarity || selectedCard?.setNumber) && (
                  <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                    {getRarityShort(selectedCard?.rarity) && (
                      <span className="text-[11px] font-black px-2 py-0.5 rounded-full" style={{ background: "linear-gradient(90deg,#FFDE00,#FFB800)", color: "#111827" }}>
                        {getRarityShort(selectedCard?.rarity)}
                      </span>
                    )}
                    {selectedCard?.setNumber && (
                      <span className="text-[11px] font-bold" style={{ color: "#9ca3af" }}>{selectedCard.setNumber}</span>
                    )}
                  </div>
                )}
                {/* Card name */}
                <p className="text-base font-black leading-tight mb-1" style={{ color: "#111827" }}>{cardName || "（未填卡名）"}</p>
                {/* Set name + game */}
                {cardSet && <p className="text-[11px] mb-1.5 line-clamp-1" style={{ color: "#9ca3af" }}>{cardSet}</p>}
                <span className="text-[10px] px-1.5 py-0.5 rounded-full inline-block" style={{ background: "rgba(249,115,22,0.1)", color: "#F97316", border: "1px solid rgba(249,115,22,0.2)" }}>
                  {GAMES.find(g => g.id === game)?.label}
                </span>
                {/* Change button */}
                <div className="mt-2">
                  <button onClick={() => setStep(1)} className="text-[10px] px-2.5 py-1 rounded-full" style={{ background: "#f3f4f6", color: "#6b7280", border: "1px solid #e5e7eb" }}>
                    更換卡牌
                  </button>
                </div>
              </div>
            </div>

            {mode === "sell" ? (
              <>
                {/* Photos */}
                <div className="mb-4">
                  <label className="text-sm font-bold mb-2 block" style={{ color: "#6b7280" }}>實物相片（最多 6 張）*</label>
                  <div className="flex gap-2 flex-wrap">
                    {photos.map((url, i) => (
                      <div key={i} className="relative rounded-xl overflow-hidden" style={{ width: 72, height: 100 }}>
                        <img
                          src={url} alt="" className="w-full h-full object-cover cursor-pointer"
                          onClick={() => { lbZoom.current=1; lbPanX.current=0; lbPanY.current=0; setLbIdx(i); }}
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
                        className="rounded-xl flex flex-col items-center justify-center gap-1"
                        style={{ width: 72, height: 100, background: "#f8f9fa", border: "2px dashed #d1d5db" }}
                      >
                        {uploading ? <Loader2 className="w-5 h-5 animate-spin" style={{ color: "#9ca3af" }} /> : <Plus className="w-5 h-5" style={{ color: "#9ca3af" }} />}
                        <span className="text-[9px]" style={{ color: "#9ca3af" }}>{uploading ? "上載中" : "加相片"}</span>
                      </button>
                    )}
                  </div>
                  <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={e => handlePhotoUpload(e.target.files)} />
                  <p className="text-[10px] mt-1.5" style={{ color: "#9ca3af" }}>請上載實物相片，增加買家信心</p>
                </div>

                {/* 裸卡 / 評級卡 二選一 */}
                <div className="mb-4">
                  <label className="text-sm font-bold mb-2 block" style={{ color: "#6b7280" }}>卡牌類型</label>
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
                  <div className="mb-4">
                    <label className="text-sm font-bold mb-2 block" style={{ color: "#6b7280" }}>品相</label>
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
                  <div className="mb-4">
                    <div className="mb-2">
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
                      <label className="text-xs mb-1 block" style={{ color: "#6b7280" }}>評分</label>
                      <input
                        value={gradeScore}
                        onChange={e => setGradeScore(e.target.value)}
                        placeholder="10 / 9.5"
                        className="w-full px-3 py-2 text-sm"
                        style={{ background: "#f8f9fa", border: "1px solid #e5e7eb", borderRadius: "12px", color: "#111827", outline: "none" }}
                      />
                    </div>
                  </div>
                )}

                {/* Price */}
                <div className="mb-4">
                  <label className="text-sm font-bold mb-2 block" style={{ color: "#6b7280" }}>售價 (HKD) *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold" style={{ color: "#9ca3af" }}>$</span>
                    <input
                      value={priceStr}
                      onChange={e => setPriceStr(e.target.value)}
                      placeholder="0"
                      inputMode="numeric"
                      className="w-full pl-7 pr-3 py-3 text-lg font-black"
                      style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", color: "#CC0000", outline: "none" }}
                    />
                  </div>
                </div>

                {/* Description */}
                <div className="mb-4">
                  <label className="text-sm font-bold mb-2 block" style={{ color: "#6b7280" }}>備註說明（可選）</label>
                  <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="例：背面有輕微花痕，不影響正面觀感"
                    rows={3}
                    className="w-full px-3 py-2.5 text-sm resize-none"
                    style={{ background: "#f8f9fa", border: "1px solid #e5e7eb", borderRadius: "12px", color: "#111827", outline: "none" }}
                  />
                </div>

                {/* Delivery Method */}
                <div className="mb-6">
                  <label className="text-sm font-bold mb-2 block" style={{ color: "#6b7280" }}>交收方法</label>
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

                <div className="flex gap-2">
                  <button onClick={() => setStep(1)} className="py-3 px-5 rounded-2xl text-sm font-bold" style={{ background: "#f3f4f6", color: "#6b7280", border: "1px solid #e5e7eb" }}>
                    上一步
                  </button>
                  <button
                    onClick={handleSubmitSell}
                    disabled={submitting}
                    className="flex-1 py-3 rounded-2xl font-black text-sm flex items-center justify-center gap-2"
                    style={{ background: "linear-gradient(90deg, #FFDE00, #FFB800)", color: "#111827" }}
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    確認上架
                  </button>
                </div>
              </>
            ) : (
              /* WTB mode */
              <>
                {/* WTB 相片 */}
                <div className="mb-4">
                  <label className="text-sm font-bold mb-2 block" style={{ color: "#6b7280" }}>相片（最多 6 張，選填）</label>
                  <div className="flex gap-2 flex-wrap">
                    {/* Official image slot */}
                    {wtbOfficialUrl && (
                      <div className="relative rounded-xl overflow-hidden flex-shrink-0" style={{ width: 64, height: 88 }}>
                        <img src={wtbOfficialUrl} alt="" className="w-full h-full object-cover" />
                        <div className="absolute bottom-0 left-0 right-0 text-center text-[8px] font-bold text-white py-0.5" style={{ background: "rgba(0,0,0,0.6)" }}>官方圖</div>
                        <button
                          onClick={() => setWtbOfficialUrl(null)}
                          className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full flex items-center justify-center"
                          style={{ background: "rgba(0,0,0,0.7)" }}
                        ><X className="w-3 h-3 text-white" /></button>
                      </div>
                    )}
                    {/* Uploaded photos */}
                    {wtbPhotos.map((url, i) => (
                      <div key={i} className="relative rounded-xl overflow-hidden flex-shrink-0" style={{ width: 64, height: 88 }}>
                        <img src={url} alt="" className="w-full h-full object-cover" />
                        <button
                          onClick={() => setWtbPhotos(p => p.filter((_, j) => j !== i))}
                          className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full flex items-center justify-center"
                          style={{ background: "rgba(0,0,0,0.7)" }}
                        ><X className="w-3 h-3 text-white" /></button>
                      </div>
                    ))}
                    {/* Add button */}
                    {(wtbOfficialUrl ? 1 : 0) + wtbPhotos.length < 6 && (
                      <button
                        onClick={() => wtbFileInputRef.current?.click()}
                        disabled={wtbUploading}
                        className="rounded-xl flex flex-col items-center justify-center gap-1 flex-shrink-0"
                        style={{ width: 64, height: 88, background: "#f8f9fa", border: "2px dashed #d1d5db" }}
                      >
                        {wtbUploading ? <Loader2 className="w-4 h-4 animate-spin" style={{ color: "#9ca3af" }} /> : <Plus className="w-4 h-4" style={{ color: "#9ca3af" }} />}
                        <span className="text-[9px]" style={{ color: "#9ca3af" }}>{wtbUploading ? "上載中" : "加相片"}</span>
                      </button>
                    )}
                  </div>
                  <input ref={wtbFileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={e => handleWtbPhotoUpload(e.target.files)} />
                </div>

                <div className="mb-4">
                  <label className="text-sm font-bold mb-2 block" style={{ color: "#6b7280" }}>最高出價 (HKD)（可選）</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold" style={{ color: "#9ca3af" }}>$</span>
                    <input
                      value={maxPriceStr}
                      onChange={e => setMaxPriceStr(e.target.value)}
                      placeholder="留空代表面議"
                      inputMode="numeric"
                      className="w-full pl-7 pr-3 py-3 text-lg font-black"
                      style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", color: "#F97316", outline: "none" }}
                    />
                  </div>
                </div>

                <div className="mb-4">
                  <label className="text-sm font-bold mb-2 block" style={{ color: "#6b7280" }}>最低品相要求（可選）</label>
                  <div className="flex flex-wrap gap-1.5">
                    {(["", "NM", "LP", "MP", "HP", "DMG"] as const).map(c => (
                      <button
                        key={c}
                        onClick={() => setWtbCondition(c)}
                        className="text-xs px-3 py-1.5 rounded-full font-bold transition-all"
                        style={wtbCondition === c
                          ? { background: "rgba(249,115,22,0.1)", color: "#F97316", border: "1px solid rgba(249,115,22,0.3)" }
                          : { background: "#fff", color: "#9ca3af", border: "1px solid #e5e7eb" }
                        }
                      >
                        {c || "不限"}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mb-6">
                  <label className="text-sm font-bold mb-2 block" style={{ color: "#6b7280" }}>備註（可選）</label>
                  <textarea
                    value={wtbNotes}
                    onChange={e => setWtbNotes(e.target.value)}
                    placeholder="例：需要英文版，或日版均可"
                    rows={3}
                    className="w-full px-3 py-2.5 text-sm resize-none"
                    style={{ background: "#f8f9fa", border: "1px solid #e5e7eb", borderRadius: "12px", color: "#111827", outline: "none" }}
                  />
                </div>

                <div className="flex gap-2">
                  <button onClick={() => setStep(1)} className="py-3 px-5 rounded-2xl text-sm font-bold" style={{ background: "#f3f4f6", color: "#6b7280", border: "1px solid #e5e7eb" }}>
                    上一步
                  </button>
                  <button
                    onClick={handleSubmitWTB}
                    disabled={submitting}
                    className="flex-1 py-3 rounded-2xl font-black text-sm flex items-center justify-center gap-2"
                    style={{ background: "rgba(249,115,22,0.1)", color: "#F97316", border: "1px solid rgba(249,115,22,0.3)" }}
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingBag className="w-4 h-4" />}
                    登記求購
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>

    {/* ── Card Preview Bottom Sheet ── */}

    {previewCard && (
      <div className="fixed inset-0 z-[9999] flex items-end" onClick={() => setPreviewCard(null)}>
        <div className="absolute inset-0 bg-black/60" />
        <div
          className="relative z-10 w-full bg-white rounded-t-3xl shadow-2xl flex flex-col"
          style={{ maxHeight: "90vh" }}
          onClick={e => e.stopPropagation()}
        >
          {/* Drag handle + close */}
          <div className="flex items-center justify-between px-4 pt-3 pb-1 flex-shrink-0">
            <div className="w-8" />
            <div className="w-10 h-1 rounded-full" style={{ background: "#e5e7eb" }} />
            <button
              onClick={() => setPreviewCard(null)}
              className="w-8 h-8 flex items-center justify-center rounded-full"
              style={{ background: "#f3f4f6", color: "#6b7280" }}
            >
              ✕
            </button>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto px-4 pt-2 pb-2">
            {/* Large card image */}
            <div className="relative w-full mb-4 rounded-2xl overflow-hidden shadow-lg"
              style={{ paddingBottom: "140%", background: "#f3f4f6" }}>
              {previewCard.officialImageUrl ? (
                <img
                  src={previewCard.officialImageUrl}
                  alt={previewCard.cardName}
                  className="absolute inset-0 w-full h-full object-contain"
                  style={{ background: "#1a1a2e" }}
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center" style={{ background: "#f8f9fa" }}>
                  <span style={{ fontSize: 64 }}>🃏</span>
                </div>
              )}
            </div>

            {/* Card info */}
            <p className="text-sm font-black mb-0.5" style={{ color: "#111827" }}>{previewCard.cardName}</p>
            {previewCard.cardNameJa && (
              <p className="text-xs mb-1" style={{ color: "#6b7280" }}>{previewCard.cardNameJa}</p>
            )}
            {(previewCard.setName || previewCard.setNumber) && (
              <p className="text-xs" style={{ color: "#9ca3af" }}>
                {[previewCard.setName, previewCard.setNumber].filter(Boolean).join(" · ")}
              </p>
            )}
            {previewCard.rarity && (
              <p className="text-xs mt-1" style={{ color: "#F97316" }}>{previewCard.rarity}</p>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex-shrink-0 px-4 pt-3" style={{ borderTop: "1px solid #f3f4f6", paddingBottom: 40 }}>
            <div className="flex gap-2">
              {/* 收藏 */}
              <button
                onClick={() => {
                  setMode("wtb");
                  setSelectedCard(previewCard);
                  setStep(2);
                  setPreviewCard(null);
                }}
                className="flex-1 py-3 px-3 rounded-2xl font-bold flex items-center justify-center gap-1.5"
                style={{ background: "#fff", color: "#111827", border: "1px solid #e5e7eb" }}
              >
                <Heart className="w-4 h-4 flex-shrink-0" style={{ color: "#dc2626" }} />
                <span className="text-sm">收藏</span>
              </button>

              {/* 分享 icon only */}
              <button
                onClick={() => {
                  const text = [previewCard.cardName, previewCard.setName, previewCard.setNumber].filter(Boolean).join(" · ");
                  if (navigator.share) {
                    navigator.share({ title: previewCard.cardName, text }).catch(() => {});
                  } else {
                    navigator.clipboard?.writeText(text).then(() => toast.success("已複製卡牌資訊"));
                  }
                }}
                className="py-3 px-4 rounded-2xl font-bold flex items-center justify-center"
                style={{ background: "#fff", color: "#111827", border: "1px solid #e5e7eb" }}
              >
                <Share2 className="w-5 h-5" style={{ color: "#6b7280" }} />
              </button>

              {/* 我要賣卡 */}
              <button
                onClick={() => {
                  setMode("sell");
                  setSelectedCard(previewCard);
                  setStep(2);
                  setPreviewCard(null);
                }}
                className="rounded-2xl font-black flex items-center justify-center"
                style={{ flex: 2, paddingTop: 12, paddingBottom: 12, paddingLeft: 12, paddingRight: 12, background: "#F97316", color: "#fff" }}
              >
                <span className="text-sm">我要賣卡</span>
              </button>
            </div>
          </div>

          {/* Bottom spacer */}
          <div className="h-6 flex-shrink-0" />
        </div>
      </div>
    )}

    {/* Photo lightbox portal */}
    {lbIdx !== null && photos[lbIdx] && createPortal(
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.55)', pointerEvents: 'auto' }}
        onClick={(e) => { if (e.target === e.currentTarget) closeLb(); }}
      >
        <div
          style={{ position: 'relative', width: '94vw', maxWidth: 480, height: '72vh', background: '#111', borderRadius: 20, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 40px rgba(0,0,0,0.7)' }}
          onTouchStart={(e) => {
            if (e.touches.length === 2) {
              e.preventDefault();
              const dx = e.touches[0].clientX - e.touches[1].clientX;
              const dy = e.touches[0].clientY - e.touches[1].clientY;
              pinchStartDist.current = Math.sqrt(dx*dx + dy*dy);
              pinchStartZoom.current = lbZoom.current;
            } else if (e.touches.length === 1) {
              panStartTouch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
              panStartOffset.current = { x: lbPanX.current, y: lbPanY.current };
            }
          }}
          onTouchMove={(e) => {
            if (e.touches.length === 2) {
              e.preventDefault();
              const dx = e.touches[0].clientX - e.touches[1].clientX;
              const dy = e.touches[0].clientY - e.touches[1].clientY;
              const dist = Math.sqrt(dx*dx + dy*dy);
              lbZoom.current = Math.min(6, Math.max(1, pinchStartZoom.current * dist / pinchStartDist.current));
              applyTransform();
              setLbRender(n => n+1);
            } else if (e.touches.length === 1 && lbZoom.current > 1) {
              e.preventDefault();
              lbPanX.current = panStartOffset.current.x + e.touches[0].clientX - panStartTouch.current.x;
              lbPanY.current = panStartOffset.current.y + e.touches[0].clientY - panStartTouch.current.y;
              applyTransform();
            }
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px 8px', flexShrink: 0 }}>
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>{(lbIdx ?? 0) + 1} / {photos.length}</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {lbZoom.current > 1 && (
                <button onClick={resetLbTransform} style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: 'none', borderRadius: 8, padding: '4px 10px', fontSize: 11, cursor: 'pointer' }}>重設</button>
              )}
              <button onClick={closeLb} style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: 'none', borderRadius: 20, padding: '5px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>關閉</button>
            </div>
          </div>

          {/* Image */}
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 8px 10px' }}>
            <img
              ref={lbImgRef}
              src={photos[lbIdx]}
              alt=""
              draggable={false}
              style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 12, display: 'block', userSelect: 'none', pointerEvents: 'none', transformOrigin: 'center center', willChange: 'transform' }}
            />
          </div>

          {/* Thumbnail strip (if multiple) */}
          {photos.length > 1 && (
            <div style={{ display: 'flex', gap: 6, padding: '0 12px 10px', flexShrink: 0, overflowX: 'auto' }}>
              {photos.map((url, i) => (
                <button
                  key={i}
                  onClick={() => { lbZoom.current=1; lbPanX.current=0; lbPanY.current=0; setLbIdx(i); }}
                  style={{ flexShrink: 0, width: 44, height: 60, borderRadius: 8, overflow: 'hidden', border: i === lbIdx ? '2px solid #FFDE00' : '2px solid transparent', padding: 0, cursor: 'pointer', background: 'none' }}
                >
                  <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                </button>
              ))}
            </div>
          )}

          <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 10, textAlign: 'center', paddingBottom: 8, flexShrink: 0 }}>兩指放大 / 點背景關閉</p>
        </div>
      </div>,
      document.body
    )}

    {/* Single card image lightbox */}
    {lbSingleImg && createPortal(
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.55)', pointerEvents: 'auto' }}
        onClick={(e) => { if (e.target === e.currentTarget) closeLb(); }}
      >
        <div
          style={{ position: 'relative', width: '94vw', maxWidth: 480, height: '72vh', background: '#111', borderRadius: 20, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 40px rgba(0,0,0,0.7)' }}
          onTouchStart={(e) => {
            if (e.touches.length === 2) {
              e.preventDefault();
              const dx = e.touches[0].clientX - e.touches[1].clientX;
              const dy = e.touches[0].clientY - e.touches[1].clientY;
              pinchStartDist.current = Math.sqrt(dx*dx + dy*dy);
              pinchStartZoom.current = lbZoom.current;
            } else if (e.touches.length === 1) {
              panStartTouch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
              panStartOffset.current = { x: lbPanX.current, y: lbPanY.current };
            }
          }}
          onTouchMove={(e) => {
            if (e.touches.length === 2) {
              e.preventDefault();
              const dx = e.touches[0].clientX - e.touches[1].clientX;
              const dy = e.touches[0].clientY - e.touches[1].clientY;
              const dist = Math.sqrt(dx*dx + dy*dy);
              lbZoom.current = Math.min(6, Math.max(1, pinchStartZoom.current * dist / pinchStartDist.current));
              applyTransform();
              setLbRender(n => n+1);
            } else if (e.touches.length === 1 && lbZoom.current > 1) {
              e.preventDefault();
              lbPanX.current = panStartOffset.current.x + e.touches[0].clientX - panStartTouch.current.x;
              lbPanY.current = panStartOffset.current.y + e.touches[0].clientY - panStartTouch.current.y;
              applyTransform();
            }
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '10px 14px 8px', flexShrink: 0, gap: 8 }}>
            {lbZoom.current > 1 && (
              <button onClick={resetLbTransform} style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: 'none', borderRadius: 8, padding: '4px 10px', fontSize: 11, cursor: 'pointer' }}>重設</button>
            )}
            <button onClick={closeLb} style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: 'none', borderRadius: 20, padding: '5px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>關閉</button>
          </div>
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 8px 10px' }}>
            <img
              ref={lbImgRef}
              src={lbSingleImg}
              alt=""
              draggable={false}
              style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 12, display: 'block', userSelect: 'none', pointerEvents: 'none', transformOrigin: 'center center', willChange: 'transform' }}
            />
          </div>
          <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 10, textAlign: 'center', paddingBottom: 8, flexShrink: 0 }}>兩指放大 / 點背景關閉</p>
        </div>
      </div>,
      document.body
    )}
    </>
  );
}
