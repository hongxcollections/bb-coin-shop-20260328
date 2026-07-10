import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import Header from "@/components/Header";
import { ChevronLeft, Loader2, Search, X } from "lucide-react";

const BROWSE_GAMES = [
  { id: "pokemon",  label: "Pokémon 寶可夢" },
  { id: "yugioh",   label: "遊戲王 Yu-Gi-Oh!" },
  { id: "mtg",      label: "MTG 萬智牌" },
  { id: "digimon",  label: "數碼暴龍 Digimon" },
] as const;

type BrowsableGame = typeof BROWSE_GAMES[number]["id"];

interface SetResult {
  setId: string; name: string; series?: string;
  releaseDate?: string; total?: number; logoUrl?: string | null; symbolUrl?: string | null;
}
interface CardResult {
  cardApiId: string; cardName: string; cardNameJa?: string;
  setName?: string; setNumber?: string; rarity?: string; officialImageUrl?: string;
}

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

export default function CardMarketBrowse() {
  const [, navigate] = useLocation();
  const [game, setGame] = useState<BrowsableGame | "">("");
  const [selectedSet, setSelectedSet] = useState<SetResult | null>(null);
  const [setCardPage, setSetCardPage] = useState(1);
  const [accCards, setAccCards] = useState<CardResult[]>([]);
  const prevSetRef = useRef<string | null>(null);
  const [lbImg, setLbImg] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<CardResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [tab, setTab] = useState<"browse" | "search">("browse");
  const utils = trpc.useUtils();

  const setsQuery = trpc.cardTrading.getSets.useQuery(
    { game: game as BrowsableGame },
    { enabled: !!game && tab === "browse" && !selectedSet, staleTime: 300000 }
  );

  const setCardsQuery = trpc.cardTrading.getSetCards.useQuery(
    { game: game as BrowsableGame, setId: selectedSet?.setId ?? "", page: setCardPage },
    { enabled: !!selectedSet && !!game, staleTime: 120000 }
  );

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

  function handleSelectGame(g: BrowsableGame) {
    setGame(g);
    setSelectedSet(null);
    setSetCardPage(1);
    setAccCards([]);
    prevSetRef.current = null;
    setSearchResults([]);
    setSearchQuery("");
    setTab("browse");
  }

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

  async function handleSearch() {
    if (!searchQuery.trim() || !game) return;
    setIsSearching(true);
    try {
      const results = await utils.cardTrading.searchCards.fetch({ game: game as BrowsableGame, query: searchQuery.trim() });
      setSearchResults(results as CardResult[]);
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }

  return (
    <>
    <div className="min-h-screen pb-20" style={{ background: "#f8f9fa", color: "#111827" }}>
      <Header />
      <div
        style={{ background: "linear-gradient(135deg,#0ea5e9 0%,#38bdf8 60%,#7dd3fc 100%)", borderRadius: 8, marginTop: 3, marginLeft: 5, marginRight: 5 }}
        className="px-4 pt-3 pb-3 flex items-center justify-between"
      >
        <button className="flex items-baseline gap-0.5" onClick={() => navigate("/cardzx/market")}>
          <span className="text-xl font-black text-white" style={{ letterSpacing: "-0.5px" }}>Card</span>
          <span className="text-xl font-black" style={{ color: "#FFDE00", letterSpacing: "-0.5px" }}>Zx</span>
          <span className="text-sm font-bold text-white ml-2 opacity-70">圖鑑瀏覽</span>
        </button>
        <button
          onClick={() => navigate("/cardzx/market")}
          className="p-1.5 rounded-full"
          style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)" }}
        >
          <ChevronLeft className="w-4 h-4 text-white" />
        </button>
      </div>

      <div className="max-w-lg mx-auto px-[5px] pt-4">

        {/* Game chips */}
        <div className="flex flex-wrap gap-2 mb-4">
          {BROWSE_GAMES.map(g => (
            <button
              key={g.id}
              onClick={() => handleSelectGame(g.id)}
              className="flex-shrink-0 px-3.5 py-1.5 rounded-full text-sm font-bold transition-all"
              style={game === g.id
                ? { background: "linear-gradient(90deg,#FFDE00,#FFB800)", color: "#111827", border: "1px solid transparent" }
                : { background: "#fff", color: "#6b7280", border: "1px solid #e5e7eb" }}
            >
              {g.label}
            </button>
          ))}
        </div>

        {!game && (
          <div className="flex flex-col items-center py-16 gap-3">
            <span style={{ fontSize: 52 }}>🃏</span>
            <p className="text-sm font-bold" style={{ color: "#9ca3af" }}>選擇遊戲類別開始瀏覽</p>
          </div>
        )}

        {game && !selectedSet && (
          <>
            {/* Browse / Search tabs */}
            <div className="flex gap-1 mb-4 p-1 rounded-xl" style={{ background: "#fff", border: "1px solid #e5e7eb" }}>
              <button
                onClick={() => { setTab("browse"); setSearchResults([]); }}
                className="flex-1 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                style={tab === "browse"
                  ? { background: "rgba(249,115,22,0.1)", color: "#F97316" }
                  : { color: "#9ca3af" }}
              >
                按系列瀏覽
              </button>
              <button
                onClick={() => { setTab("search"); }}
                className="flex-1 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                style={tab === "search"
                  ? { background: "rgba(255,222,0,0.15)", color: "#111827" }
                  : { color: "#9ca3af" }}
              >
                <Search className="w-3.5 h-3.5" />
                搜尋卡牌
              </button>
            </div>

            {/* Browse mode: sets grid */}
            {tab === "browse" && (
              <>
                <p className="text-xs mb-3" style={{ color: "#9ca3af" }}>選擇系列，瀏覽所有高清卡牌圖鑑</p>
                {setsQuery.isLoading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="w-7 h-7 animate-spin" style={{ color: "#CC0000" }} />
                  </div>
                ) : setsQuery.error ? (
                  <div className="text-center py-8 text-sm" style={{ color: "#9ca3af" }}>無法載入系列資料</div>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {(setsQuery.data as SetResult[] ?? []).map(s => (
                      <button
                        key={s.setId}
                        onClick={() => handleSelectSet(s)}
                        className="flex flex-col items-center p-2 rounded-xl text-center transition-all"
                        style={{ background: "#fff", border: "1px solid #e5e7eb", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
                      >
                        {s.logoUrl ? (
                          <img
                            src={s.logoUrl} alt={s.name}
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
              </>
            )}

            {/* Search mode */}
            {tab === "search" && (
              <div>
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
                {searchResults.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {searchResults.map((r, i) => {
                      const rBadge = getRarityShort(r.rarity);
                      return (
                        <button
                          key={i}
                          onClick={() => setLbImg(r.officialImageUrl ?? null)}
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
                                <span className="text-[8px] font-black px-1 py-px rounded" style={{ background: "rgba(0,0,0,0.75)", color: "#F97316" }}>{rBadge}</span>
                              </div>
                            )}
                            {r.setNumber && (
                              <div className="absolute bottom-1 left-1">
                                <span className="text-[8px] px-1 py-px rounded" style={{ background: "rgba(0,0,0,0.55)", color: "rgba(255,255,255,0.85)" }}>{r.setNumber}</span>
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
                {searchResults.length === 0 && !isSearching && searchQuery && (
                  <div className="text-center py-8 text-xs" style={{ color: "#9ca3af" }}>找不到相關卡牌</div>
                )}
              </div>
            )}
          </>
        )}

        {/* Cards grid (after selecting a set) */}
        {game && selectedSet && (
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
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {accCards.map(card => {
                    const rBadge = getRarityShort(card.rarity);
                    return (
                      <button
                        key={card.cardApiId}
                        onClick={() => card.officialImageUrl && setLbImg(card.officialImageUrl)}
                        className="flex flex-col rounded-xl overflow-hidden text-left transition-all"
                        style={{ background: "#fff", border: "1px solid #e5e7eb", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
                      >
                        <div className="relative w-full" style={{ paddingBottom: "140%" }}>
                          {card.officialImageUrl ? (
                            <img
                              src={card.officialImageUrl} alt={card.cardName}
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
                              <span className="text-[8px] font-black px-1 py-px rounded" style={{ background: "rgba(0,0,0,0.75)", color: "#F97316" }}>{rBadge}</span>
                            </div>
                          )}
                          {card.setNumber && (
                            <div className="absolute bottom-1 left-1">
                              <span className="text-[8px] px-1 py-px rounded" style={{ background: "rgba(0,0,0,0.55)", color: "rgba(255,255,255,0.85)" }}>{card.setNumber}</span>
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
                    onClick={() => setSetCardPage(p => p + 1)}
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
    </div>

    {/* Lightbox */}
    {lbImg && createPortal(
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center"
        style={{ background: "rgba(0,0,0,0.92)" }}
        onClick={() => setLbImg(null)}
      >
        <button
          onClick={() => setLbImg(null)}
          className="absolute top-4 right-4 p-2 rounded-full"
          style={{ background: "rgba(255,255,255,0.15)", zIndex: 10000 }}
        >
          <X className="w-5 h-5 text-white" />
        </button>
        <img
          src={lbImg}
          alt=""
          className="rounded-2xl"
          style={{ maxWidth: "90vw", maxHeight: "85vh", objectFit: "contain" }}
          onClick={e => e.stopPropagation()}
        />
      </div>,
      document.body
    )}
    </>
  );
}
