import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import Header from "@/components/Header";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { Search, Upload, X, ChevronLeft, Loader2, Check, Plus, ShoppingBag, Grid3x3, ChevronRight } from "lucide-react";

const GAMES = [
  { id: "pokemon", label: "Pokémon", emoji: "⚡" },
  { id: "yugioh", label: "遊戲王", emoji: "👁" },
  { id: "mtg", label: "MTG", emoji: "🌊" },
  { id: "onepiece", label: "航海王", emoji: "⚓" },
  { id: "dragonball", label: "龍珠", emoji: "🐉" },
  { id: "digimon", label: "數碼暴龍", emoji: "💾" },
  { id: "other", label: "其他", emoji: "🃏" },
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
  const [, navigate] = useLocation();
  const { isAuthenticated } = useAuth();
  const [mode, setMode] = useState<Mode>("sell");

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [game, setGame] = useState<GameId | "">("");

  // Step 2: browse or search tab
  const [step2Tab, setStep2Tab] = useState<Step2Tab>("browse");
  // Browse mode: set selection
  const [selectedSet, setSelectedSet] = useState<SetResult | null>(null);
  const [setCardPage, setSetCardPage] = useState(1);
  const [accCards, setAccCards] = useState<CardResult[]>([]);
  // Search mode
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<CardResult[]>([]);

  const [selectedCard, setSelectedCard] = useState<CardResult | null>(null);
  const [manualName, setManualName] = useState("");
  const [manualSet, setManualSet] = useState("");
  const [manualSetNo, setManualSetNo] = useState("");

  // Sell-specific
  const [condition, setCondition] = useState<"NM" | "LP" | "MP" | "HP" | "DMG">("NM");
  const [isGraded, setIsGraded] = useState(false);
  const [gradingOrg, setGradingOrg] = useState("PSA");
  const [gradeScore, setGradeScore] = useState("");
  const [priceStr, setPriceStr] = useState("");
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // WTB-specific
  const [maxPriceStr, setMaxPriceStr] = useState("");
  const [wtbCondition, setWtbCondition] = useState<"NM" | "LP" | "MP" | "HP" | "DMG" | "">("NM");
  const [wtbNotes, setWtbNotes] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  const utils = trpc.useUtils();
  const signUploadMut = trpc.cardTrading.signPhotoUpload.useMutation();
  const createListingMut = trpc.cardTrading.createListing.useMutation();
  const createWTBMut = trpc.cardTrading.createWTB.useMutation();

  const isBrowsable = game && BROWSABLE_GAMES.includes(game as GameId);

  // Sets query — only for browsable games, when in browse tab, no set selected yet
  const setsQuery = trpc.cardTrading.getSets.useQuery(
    { game: game as BrowsableGame },
    { enabled: !!isBrowsable && step2Tab === "browse" && step === 2 && !selectedSet, staleTime: 300000 }
  );

  // Set cards query — when a set is selected
  const setCardsQuery = trpc.cardTrading.getSetCards.useQuery(
    { game: game as BrowsableGame, setId: selectedSet?.setId ?? "", page: setCardPage },
    {
      enabled: !!selectedSet && !!isBrowsable,
      staleTime: 120000,
    }
  );

  // Accumulate cards across pages when set cards query data changes
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
    setStep(3);
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

  async function handlePhotoUpload(files: FileList | null) {
    if (!files || photos.length >= 6) return;
    const allowed = Math.min(files.length, 6 - photos.length);
    setUploading(true);
    const newUrls: string[] = [];
    try {
      for (let i = 0; i < allowed; i++) {
        const file = files[i];
        const { uploadUrl, finalUrl } = await signUploadMut.mutateAsync({
          mimeType: file.type || "image/jpeg",
          fileName: file.name || "card.jpg",
        });
        await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type || "image/jpeg" } });
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
      });
      toast.success("已成功上架！");
      navigate("/cardzzz/market/my");
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
        officialImageUrl: selectedCard?.officialImageUrl,
        maxPriceHKD: maxPrice,
        minCondition: wtbCondition || undefined,
        notes: wtbNotes.trim() || undefined,
      });
      toast.success("已登記求購！有人上架同款卡即通知你");
      navigate("/cardzzz/market/my");
    } catch (e: any) {
      toast.error(e?.message ?? "登記失敗");
    } finally {
      setSubmitting(false);
    }
  }

  const cardName = selectedCard?.cardName ?? manualName;
  const cardSet = selectedCard?.setName ?? manualSet;
  const cardImg = selectedCard?.officialImageUrl;

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen pb-20 flex flex-col" style={{ background: "linear-gradient(160deg, #0d0d1f 0%, #1a0505 40%, #0d0d1f 100%)", color: "#fff" }}>
        <Header />
        <div className="flex-1 flex flex-col items-center justify-center px-4 gap-4">
          <span style={{ fontSize: 48 }}>🔒</span>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>請先登入才可上架或求購</p>
          <button onClick={() => navigate("/login")} className="px-6 py-2 rounded-full font-bold text-sm" style={{ background: "linear-gradient(90deg, #CC0000, #FF4444)", color: "#fff" }}>
            前往登入
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20" style={{ background: "linear-gradient(160deg, #0d0d1f 0%, #1a0505 40%, #0d0d1f 100%)", color: "#fff" }}>
      <Header />
      <div className="max-w-lg mx-auto px-4 pt-4">
        {/* Back + title */}
        <div className="flex items-center gap-3 mb-5">
          <button onClick={() => navigate("/cardzzz/market")} className="p-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.07)" }}>
            <ChevronLeft className="w-4 h-4" style={{ color: "rgba(255,255,255,0.7)" }} />
          </button>
          <h1 className="text-xl font-black" style={{ color: "#FFDE00" }}>CardZzz 市場</h1>
        </div>

        {/* Mode toggle */}
        <div className="flex gap-2 mb-5 p-1 rounded-2xl" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
          <button
            onClick={() => { setMode("sell"); setStep(1); }}
            className="flex-1 py-2 rounded-xl font-bold text-sm transition-all"
            style={mode === "sell" ? { background: "linear-gradient(90deg, #CC0000, #FF4444)", color: "#fff" } : { color: "rgba(255,255,255,0.5)" }}
          >
            上架出售
          </button>
          <button
            onClick={() => { setMode("wtb"); setStep(1); }}
            className="flex-1 py-2 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-1.5"
            style={mode === "wtb" ? { background: "rgba(255,222,0,0.2)", color: "#FFDE00", border: "1px solid rgba(255,222,0,0.35)" } : { color: "rgba(255,255,255,0.5)" }}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            求購 WTB
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-6">
          {[1, 2, 3].map(s => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0"
                style={step >= s ? { background: "linear-gradient(90deg, #CC0000, #FF4444)", color: "#fff" } : { background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.3)" }}>
                {step > s ? <Check className="w-3 h-3" /> : s}
              </div>
              {s < 3 && <div className="flex-1 h-px" style={{ background: step > s ? "rgba(204,0,0,0.5)" : "rgba(255,255,255,0.1)" }} />}
            </div>
          ))}
        </div>

        {/* ── Step 1: Choose game ──────────────────────────── */}
        {step === 1 && (
          <div>
            <p className="text-sm font-bold mb-3" style={{ color: "rgba(255,255,255,0.7)" }}>選擇遊戲類型</p>
            <div className="grid grid-cols-2 gap-2">
              {GAMES.map(g => (
                <button
                  key={g.id}
                  onClick={() => {
                    setGame(g.id);
                    setStep(2);
                    setSelectedCard(null);
                    setSelectedSet(null);
                    setSearchQuery("");
                    setSearchResults([]);
                    setAccCards([]);
                    prevSetRef.current = null;
                    setStep2Tab(BROWSABLE_GAMES.includes(g.id as GameId) ? "browse" : "search");
                  }}
                  className="flex items-center gap-3 p-3 rounded-2xl transition-all"
                  style={{ background: game === g.id ? "rgba(204,0,0,0.2)" : "rgba(255,255,255,0.05)", border: `1px solid ${game === g.id ? "rgba(204,0,0,0.5)" : "rgba(255,255,255,0.08)"}` }}
                >
                  <span style={{ fontSize: 24 }}>{g.emoji}</span>
                  <span className="text-sm font-bold" style={{ color: game === g.id ? "#FFDE00" : "rgba(255,255,255,0.8)" }}>{g.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Step 2: Find card ──────────────────────────── */}
        {step === 2 && (
          <div>
            {/* Tab toggle — only for browsable games */}
            {isBrowsable && (
              <div className="flex gap-1 mb-4 p-1 rounded-xl" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <button
                  onClick={() => { setStep2Tab("browse"); setSearchResults([]); }}
                  className="flex-1 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                  style={step2Tab === "browse"
                    ? { background: "rgba(255,222,0,0.18)", color: "#FFDE00" }
                    : { color: "rgba(255,255,255,0.45)" }}
                >
                  <Grid3x3 className="w-3.5 h-3.5" />
                  按系列瀏覽
                </button>
                <button
                  onClick={() => { setStep2Tab("search"); setSelectedSet(null); setAccCards([]); prevSetRef.current = null; }}
                  className="flex-1 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                  style={step2Tab === "search"
                    ? { background: "rgba(255,255,255,0.12)", color: "#fff" }
                    : { color: "rgba(255,255,255,0.45)" }}
                >
                  <Search className="w-3.5 h-3.5" />
                  搜尋
                </button>
              </div>
            )}

            {/* ── Browse mode ── */}
            {step2Tab === "browse" && isBrowsable && (
              <div>
                {!selectedSet ? (
                  /* Set list */
                  <div>
                    <p className="text-xs mb-3" style={{ color: "rgba(255,255,255,0.4)" }}>
                      選擇系列，瀏覽所有高清卡牌圖鑑
                    </p>
                    {setsQuery.isLoading ? (
                      <div className="flex justify-center py-12">
                        <Loader2 className="w-7 h-7 animate-spin" style={{ color: "#FFDE00" }} />
                      </div>
                    ) : setsQuery.error ? (
                      <div className="text-center py-8 text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
                        無法載入系列，請切換「搜尋」模式
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto pr-1" style={{ scrollbarWidth: "none" }}>
                        {(setsQuery.data as SetResult[] ?? []).map(s => (
                          <button
                            key={s.setId}
                            onClick={() => handleSelectSet(s)}
                            className="flex items-center gap-3 p-3 rounded-xl text-left transition-all"
                            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
                          >
                            {s.logoUrl ? (
                              <img
                                src={s.logoUrl}
                                alt={s.name}
                                className="flex-shrink-0 object-contain"
                                style={{ width: 56, height: 32 }}
                                onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                              />
                            ) : (
                              <div className="flex-shrink-0 flex items-center justify-center rounded-lg" style={{ width: 56, height: 32, background: "rgba(255,222,0,0.08)" }}>
                                <span style={{ fontSize: 18 }}>🃏</span>
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold leading-tight line-clamp-1" style={{ color: "#fff" }}>{s.name}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                {s.series && <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.35)" }}>{s.series}</span>}
                                {s.total && <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>{s.total} 張</span>}
                                {s.releaseDate && <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.25)" }}>{s.releaseDate.substring(0, 7)}</span>}
                              </div>
                            </div>
                            <ChevronLeft className="w-3 h-3 flex-shrink-0 rotate-180" style={{ color: "rgba(255,255,255,0.3)" }} />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  /* Card grid inside set */
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <button
                        onClick={handleBackToSets}
                        className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full"
                        style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.6)" }}
                      >
                        <ChevronLeft className="w-3 h-3" />
                        返回
                      </button>
                      <p className="text-xs font-bold flex-1 min-w-0 line-clamp-1" style={{ color: "#FFDE00" }}>{selectedSet.name}</p>
                      {selectedSet.total && (
                        <span className="text-[10px] flex-shrink-0" style={{ color: "rgba(255,255,255,0.35)" }}>{selectedSet.total} 張</span>
                      )}
                    </div>

                    {setCardsQuery.isLoading && accCards.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 gap-3">
                        <Loader2 className="w-7 h-7 animate-spin" style={{ color: "#FFDE00" }} />
                        <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>載入卡牌圖鑑中...</p>
                      </div>
                    ) : (
                      <div>
                        <div className="grid grid-cols-3 gap-2 mb-3" style={{ maxHeight: "55vh", overflowY: "auto", scrollbarWidth: "none" }}>
                          {accCards.map(card => {
                            const rBadge = getRarityShort(card.rarity);
                            return (
                              <button
                                key={card.cardApiId}
                                onClick={() => handleSelectCard(card)}
                                className="flex flex-col rounded-xl overflow-hidden text-left transition-all"
                                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
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
                                    <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(255,222,0,0.05)" }}>
                                      <span style={{ fontSize: 24 }}>🃏</span>
                                    </div>
                                  )}
                                  {rBadge && (
                                    <div className="absolute top-1 right-1">
                                      <span className="text-[8px] font-black px-1 py-px rounded" style={{ background: "rgba(0,0,0,0.8)", color: "#FFDE00" }}>
                                        {rBadge}
                                      </span>
                                    </div>
                                  )}
                                  {card.setNumber && (
                                    <div className="absolute bottom-1 left-1">
                                      <span className="text-[8px] px-1 py-px rounded" style={{ background: "rgba(0,0,0,0.65)", color: "rgba(255,255,255,0.7)" }}>
                                        {card.setNumber}
                                      </span>
                                    </div>
                                  )}
                                </div>
                                <div className="px-1.5 py-1.5">
                                  <p className="text-[10px] font-bold leading-tight line-clamp-2" style={{ color: "#fff" }}>{card.cardName}</p>
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
                            style={{ background: "rgba(255,222,0,0.1)", color: "#FFDE00", border: "1px solid rgba(255,222,0,0.25)" }}
                          >
                            {setCardsQuery.isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                            載入更多卡牌
                          </button>
                        )}
                        {accCards.length === 0 && !setCardsQuery.isLoading && (
                          <div className="text-center py-8 text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>此系列暫無卡牌資料</div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── Search mode ── */}
            {(step2Tab === "search" || !isBrowsable) && (
              <div>
                <p className="text-xs mb-4" style={{ color: "rgba(255,255,255,0.35)" }}>
                  {isBrowsable ? "輸入卡名搜尋，或切換「按系列瀏覽」" : "請手動填寫卡牌資料"}
                </p>

                {isBrowsable && (
                  <div className="flex gap-2 mb-3">
                    <input
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && handleSearch()}
                      placeholder="輸入卡牌名稱搜尋..."
                      className="flex-1 px-3 py-2 text-sm"
                      style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "12px", color: "#fff", outline: "none" }}
                    />
                    <button
                      onClick={handleSearch}
                      disabled={isSearching || !searchQuery.trim()}
                      className="px-3 py-2 rounded-xl font-bold text-sm flex items-center gap-1.5"
                      style={{ background: "rgba(255,222,0,0.15)", color: "#FFDE00", border: "1px solid rgba(255,222,0,0.3)" }}
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
                          onClick={() => { setSelectedCard(r); setStep(3); }}
                          className="flex flex-col rounded-xl overflow-hidden text-left"
                          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
                        >
                          <div className="relative w-full" style={{ paddingBottom: "140%" }}>
                            {r.officialImageUrl ? (
                              <img src={r.officialImageUrl} alt={r.cardName} className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
                            ) : (
                              <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(255,222,0,0.05)" }}>
                                <span style={{ fontSize: 24 }}>🃏</span>
                              </div>
                            )}
                            {rBadge && (
                              <div className="absolute top-1 right-1">
                                <span className="text-[8px] font-black px-1 py-px rounded" style={{ background: "rgba(0,0,0,0.8)", color: "#FFDE00" }}>
                                  {rBadge}
                                </span>
                              </div>
                            )}
                            {r.setNumber && (
                              <div className="absolute bottom-1 left-1">
                                <span className="text-[8px] px-1 py-px rounded" style={{ background: "rgba(0,0,0,0.65)", color: "rgba(255,255,255,0.7)" }}>
                                  {r.setNumber}
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="px-1.5 py-1.5">
                            <p className="text-[10px] font-bold leading-tight line-clamp-2" style={{ color: "#fff" }}>{r.cardName}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Manual entry */}
                <div className="p-4 rounded-2xl mb-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <p className="text-xs font-bold mb-3" style={{ color: "rgba(255,255,255,0.5)" }}>手動填寫</p>
                  <div className="flex flex-col gap-3">
                    <div>
                      <label className="text-xs mb-1 block" style={{ color: "rgba(255,255,255,0.5)" }}>卡牌名稱 *</label>
                      <input
                        value={manualName}
                        onChange={e => setManualName(e.target.value)}
                        placeholder="例：Charizard / 噴火龍"
                        className="w-full px-3 py-2 text-sm"
                        style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "12px", color: "#fff", outline: "none" }}
                      />
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="text-xs mb-1 block" style={{ color: "rgba(255,255,255,0.5)" }}>系列名稱</label>
                        <input
                          value={manualSet}
                          onChange={e => setManualSet(e.target.value)}
                          placeholder="例：Base Set"
                          className="w-full px-3 py-2 text-sm"
                          style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "12px", color: "#fff", outline: "none" }}
                        />
                      </div>
                      <div style={{ width: 100 }}>
                        <label className="text-xs mb-1 block" style={{ color: "rgba(255,255,255,0.5)" }}>卡號</label>
                        <input
                          value={manualSetNo}
                          onChange={e => setManualSetNo(e.target.value)}
                          placeholder="4/102"
                          className="w-full px-3 py-2 text-sm"
                          style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "12px", color: "#fff", outline: "none" }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button onClick={() => setStep(1)} className="flex-1 py-2.5 rounded-2xl text-sm font-bold" style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.6)" }}>
                    上一步
                  </button>
                  <button
                    onClick={() => { if (manualName.trim()) { setSelectedCard(null); setStep(3); } else { toast.error("請先搜尋選擇卡牌，或手動填寫名稱"); } }}
                    className="flex-1 py-2.5 rounded-2xl text-sm font-bold"
                    style={{ background: "linear-gradient(90deg, #CC0000, #FF4444)", color: "#fff" }}
                  >
                    手動填寫繼續
                  </button>
                </div>
              </div>
            )}

            {/* Back button for browse mode */}
            {step2Tab === "browse" && isBrowsable && (
              <div className="mt-4">
                <button onClick={() => setStep(1)} className="w-full py-2.5 rounded-2xl text-sm font-bold" style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.6)" }}>
                  上一步
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Step 3: Details ──────────────────────────────── */}
        {step === 3 && (
          <div>
            {/* Card preview */}
            <div className="flex items-center gap-3 mb-5 p-3 rounded-2xl" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
              {cardImg ? (
                <img src={cardImg} alt="" className="rounded-xl object-cover flex-shrink-0" style={{ width: 48, height: 66 }} />
              ) : (
                <div className="rounded-xl flex-shrink-0 flex items-center justify-center" style={{ width: 48, height: 66, background: "rgba(255,222,0,0.08)" }}>
                  <span style={{ fontSize: 28 }}>🃏</span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-black" style={{ color: "#FFDE00" }}>{cardName || "（未填卡名）"}</p>
                {cardSet && <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>{cardSet}</p>}
                <span className="text-[10px] px-1.5 py-0.5 rounded-full mt-1 inline-block" style={{ background: "rgba(255,222,0,0.12)", color: "#FFDE00" }}>
                  {GAMES.find(g => g.id === game)?.label}
                </span>
              </div>
              <button onClick={() => setStep(2)} className="text-[10px] px-2 py-1 rounded-full" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" }}>
                更換
              </button>
            </div>

            {mode === "sell" ? (
              <>
                {/* Photos */}
                <div className="mb-4">
                  <label className="text-sm font-bold mb-2 block" style={{ color: "rgba(255,255,255,0.7)" }}>實物相片（最多 6 張）*</label>
                  <div className="flex gap-2 flex-wrap">
                    {photos.map((url, i) => (
                      <div key={i} className="relative rounded-xl overflow-hidden" style={{ width: 72, height: 100 }}>
                        <img src={url} alt="" className="w-full h-full object-cover" />
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
                        style={{ width: 72, height: 100, background: "rgba(255,255,255,0.05)", border: "2px dashed rgba(255,255,255,0.15)" }}
                      >
                        {uploading ? <Loader2 className="w-5 h-5 animate-spin" style={{ color: "rgba(255,255,255,0.4)" }} /> : <Plus className="w-5 h-5" style={{ color: "rgba(255,255,255,0.4)" }} />}
                        <span className="text-[9px]" style={{ color: "rgba(255,255,255,0.35)" }}>{uploading ? "上載中" : "加相片"}</span>
                      </button>
                    )}
                  </div>
                  <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={e => handlePhotoUpload(e.target.files)} />
                  <p className="text-[10px] mt-1.5" style={{ color: "rgba(255,255,255,0.3)" }}>請上載實物相片，增加買家信心</p>
                </div>

                {/* Condition */}
                <div className="mb-4">
                  <label className="text-sm font-bold mb-2 block" style={{ color: "rgba(255,255,255,0.7)" }}>品相</label>
                  <div className="flex flex-col gap-1.5">
                    {CONDITIONS.map(c => (
                      <button
                        key={c.id}
                        onClick={() => setCondition(c.id)}
                        className="flex items-center justify-between p-2.5 rounded-xl transition-all"
                        style={condition === c.id
                          ? { background: "rgba(204,0,0,0.15)", border: "1px solid rgba(204,0,0,0.4)" }
                          : { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
                      >
                        <span className="text-xs font-bold" style={{ color: condition === c.id ? "#fff" : "rgba(255,255,255,0.7)" }}>{c.label}</span>
                        <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.35)" }}>{c.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Graded toggle */}
                <div className="mb-4 p-3 rounded-2xl flex items-center justify-between" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <div>
                    <p className="text-sm font-bold" style={{ color: "rgba(255,255,255,0.8)" }}>評級卡</p>
                    <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>PSA / BGS / CGC 等</p>
                  </div>
                  <button
                    onClick={() => setIsGraded(p => !p)}
                    className="w-12 h-6 rounded-full transition-all relative"
                    style={{ background: isGraded ? "#CC0000" : "rgba(255,255,255,0.15)" }}
                  >
                    <div className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all" style={{ left: isGraded ? 26 : 2 }} />
                  </button>
                </div>

                {isGraded && (
                  <div className="flex gap-2 mb-4">
                    <div className="flex-1">
                      <label className="text-xs mb-1 block" style={{ color: "rgba(255,255,255,0.5)" }}>評級機構</label>
                      <select
                        value={gradingOrg}
                        onChange={e => setGradingOrg(e.target.value)}
                        className="w-full px-3 py-2 text-sm"
                        style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "12px", color: "#fff", outline: "none" }}
                      >
                        {["PSA", "BGS", "CGC", "SGC", "其他"].map(o => <option key={o} value={o} style={{ background: "#1a1a2e" }}>{o}</option>)}
                      </select>
                    </div>
                    <div style={{ width: 100 }}>
                      <label className="text-xs mb-1 block" style={{ color: "rgba(255,255,255,0.5)" }}>評分</label>
                      <input
                        value={gradeScore}
                        onChange={e => setGradeScore(e.target.value)}
                        placeholder="10 / 9.5"
                        className="w-full px-3 py-2 text-sm"
                        style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "12px", color: "#fff", outline: "none" }}
                      />
                    </div>
                  </div>
                )}

                {/* Price */}
                <div className="mb-4">
                  <label className="text-sm font-bold mb-2 block" style={{ color: "rgba(255,255,255,0.7)" }}>售價 (HKD) *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold" style={{ color: "rgba(255,255,255,0.4)" }}>$</span>
                    <input
                      value={priceStr}
                      onChange={e => setPriceStr(e.target.value)}
                      placeholder="0"
                      inputMode="numeric"
                      className="w-full pl-7 pr-3 py-3 text-lg font-black"
                      style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "12px", color: "#FFDE00", outline: "none" }}
                    />
                  </div>
                </div>

                {/* Description */}
                <div className="mb-6">
                  <label className="text-sm font-bold mb-2 block" style={{ color: "rgba(255,255,255,0.7)" }}>備註說明（可選）</label>
                  <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="例：背面有輕微花痕，不影響正面觀感"
                    rows={3}
                    className="w-full px-3 py-2.5 text-sm resize-none"
                    style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "12px", color: "#fff", outline: "none" }}
                  />
                </div>

                <div className="flex gap-2">
                  <button onClick={() => setStep(2)} className="py-3 px-5 rounded-2xl text-sm font-bold" style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.6)" }}>
                    上一步
                  </button>
                  <button
                    onClick={handleSubmitSell}
                    disabled={submitting}
                    className="flex-1 py-3 rounded-2xl font-black text-sm flex items-center justify-center gap-2"
                    style={{ background: "linear-gradient(90deg, #CC0000, #FF4444)", color: "#fff" }}
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    確認上架
                  </button>
                </div>
              </>
            ) : (
              /* WTB mode */
              <>
                <div className="mb-4">
                  <label className="text-sm font-bold mb-2 block" style={{ color: "rgba(255,255,255,0.7)" }}>最高出價 (HKD)（可選）</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold" style={{ color: "rgba(255,255,255,0.4)" }}>$</span>
                    <input
                      value={maxPriceStr}
                      onChange={e => setMaxPriceStr(e.target.value)}
                      placeholder="留空代表面議"
                      inputMode="numeric"
                      className="w-full pl-7 pr-3 py-3 text-lg font-black"
                      style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "12px", color: "#FFDE00", outline: "none" }}
                    />
                  </div>
                </div>

                <div className="mb-4">
                  <label className="text-sm font-bold mb-2 block" style={{ color: "rgba(255,255,255,0.7)" }}>最低品相要求（可選）</label>
                  <div className="flex flex-wrap gap-1.5">
                    {(["", "NM", "LP", "MP", "HP", "DMG"] as const).map(c => (
                      <button
                        key={c}
                        onClick={() => setWtbCondition(c)}
                        className="text-xs px-3 py-1.5 rounded-full font-bold transition-all"
                        style={wtbCondition === c
                          ? { background: "rgba(255,222,0,0.2)", color: "#FFDE00", border: "1px solid rgba(255,222,0,0.4)" }
                          : { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.1)" }
                        }
                      >
                        {c || "不限"}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mb-6">
                  <label className="text-sm font-bold mb-2 block" style={{ color: "rgba(255,255,255,0.7)" }}>備註（可選）</label>
                  <textarea
                    value={wtbNotes}
                    onChange={e => setWtbNotes(e.target.value)}
                    placeholder="例：需要英文版，或日版均可"
                    rows={3}
                    className="w-full px-3 py-2.5 text-sm resize-none"
                    style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "12px", color: "#fff", outline: "none" }}
                  />
                </div>

                <div className="flex gap-2">
                  <button onClick={() => setStep(2)} className="py-3 px-5 rounded-2xl text-sm font-bold" style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.6)" }}>
                    上一步
                  </button>
                  <button
                    onClick={handleSubmitWTB}
                    disabled={submitting}
                    className="flex-1 py-3 rounded-2xl font-black text-sm flex items-center justify-center gap-2"
                    style={{ background: "rgba(255,222,0,0.2)", color: "#FFDE00", border: "1px solid rgba(255,222,0,0.4)" }}
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
  );
}
