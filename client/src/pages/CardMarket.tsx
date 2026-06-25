import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import Header from "@/components/Header";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { Search, Plus, ShoppingBag, Tag, Eye, ChevronRight } from "lucide-react";

const GAMES = [
  { id: "", label: "全部" },
  { id: "pokemon", label: "Pokémon" },
  { id: "yugioh", label: "遊戲王" },
  { id: "mtg", label: "MTG" },
  { id: "onepiece", label: "航海王" },
  { id: "dragonball", label: "龍珠" },
  { id: "digimon", label: "數碼暴龍" },
  { id: "other", label: "其他" },
] as const;

const CONDITION_LABELS: Record<string, { label: string; color: string }> = {
  NM:  { label: "NM", color: "#4CAF50" },
  LP:  { label: "LP", color: "#8BC34A" },
  MP:  { label: "MP", color: "#FFC107" },
  HP:  { label: "HP", color: "#FF9800" },
  DMG: { label: "DMG", color: "#f44336" },
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
  id: number; userId: number; game: string;
  cardApiId: string | null; cardName: string; cardNameJa: string | null;
  setName: string | null; setNumber: string | null; rarity: string | null;
  officialImageUrl: string | null;
  condition: string; isGraded: boolean; gradingOrg: string | null; gradeScore: string | null;
  priceHKD: number; photoUrls: string[]; description: string | null;
  status: string; views: number; createdAt: string; sellerName: string | null;
}

function ListingCard({ listing, onClick }: { listing: Listing; onClick: () => void }) {
  const cond = CONDITION_LABELS[listing.condition] ?? { label: listing.condition, color: "#9C27B0" };
  const img = listing.photoUrls[0] ?? listing.officialImageUrl;
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col rounded-2xl overflow-hidden text-left"
      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
    >
      <div className="relative w-full" style={{ paddingBottom: "130%" }}>
        {img ? (
          <img src={img} alt={listing.cardName} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(255,222,0,0.06)" }}>
            <span style={{ fontSize: 36 }}>🃏</span>
          </div>
        )}
        <div className="absolute top-1.5 left-1.5">
          <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md" style={{ background: cond.color + "33", color: cond.color, border: `1px solid ${cond.color}55` }}>
            {listing.isGraded && listing.gradeScore ? `${listing.gradingOrg} ${listing.gradeScore}` : cond.label}
          </span>
        </div>
      </div>
      <div className="p-2">
        <p className="text-xs font-black leading-tight line-clamp-2 mb-1" style={{ color: "#FFDE00" }}>{listing.cardName}</p>
        {listing.setName && <p className="text-[10px] line-clamp-1 mb-1" style={{ color: "rgba(255,255,255,0.4)" }}>{listing.setName}{listing.setNumber ? ` #${listing.setNumber}` : ""}</p>}
        <p className="text-sm font-black" style={{ color: "#fff" }}>HKD ${listing.priceHKD.toLocaleString()}</p>
        <div className="flex items-center justify-between mt-1">
          <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.35)" }}>{listing.sellerName ?? "賣家"}</span>
          <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.25)" }}>{timeAgo(listing.createdAt)}</span>
        </div>
      </div>
    </button>
  );
}

interface WTB {
  id: number; userId: number; game: string; cardName: string;
  cardNameJa: string | null; setName: string | null; setNumber: string | null;
  officialImageUrl: string | null; maxPriceHKD: number | null;
  minCondition: string | null; notes: string | null; createdAt: string; buyerName: string | null;
}

function WTBCard({ wtb }: { wtb: WTB }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
      {wtb.officialImageUrl ? (
        <img src={wtb.officialImageUrl} alt="" className="rounded-lg flex-shrink-0 object-cover" style={{ width: 36, height: 50 }} />
      ) : (
        <div className="rounded-lg flex-shrink-0 flex items-center justify-center" style={{ width: 36, height: 50, background: "rgba(255,222,0,0.08)" }}>
          <span style={{ fontSize: 20 }}>🃏</span>
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-black leading-tight line-clamp-1" style={{ color: "#FFDE00" }}>{wtb.cardName}</p>
        {wtb.setName && <p className="text-[10px] line-clamp-1" style={{ color: "rgba(255,255,255,0.4)" }}>{wtb.setName}</p>}
        <div className="flex items-center gap-2 mt-0.5">
          {wtb.maxPriceHKD && <span className="text-[10px] font-bold" style={{ color: "#4CAF50" }}>最高 HKD ${wtb.maxPriceHKD}</span>}
          {wtb.minCondition && <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>最低 {wtb.minCondition}</span>}
        </div>
      </div>
      <span className="text-[10px] flex-shrink-0" style={{ color: "rgba(255,255,255,0.3)" }}>{wtb.buyerName ?? "用戶"}</span>
    </div>
  );
}

interface ListingDetailSheet {
  listing: Listing;
  onClose: () => void;
}

function ListingDetailSheet({ listing, onClose }: ListingDetailSheet) {
  const { isAuthenticated, user } = useAuth();
  const [, navigate] = useLocation();
  const [photoIdx, setPhotoIdx] = useState(0);
  const photos = listing.photoUrls.length ? listing.photoUrls : (listing.officialImageUrl ? [listing.officialImageUrl] : []);
  const cond = CONDITION_LABELS[listing.condition] ?? { label: listing.condition, color: "#9C27B0" };

  function handleContact() {
    if (!isAuthenticated) { toast.info("請先登入"); return; }
    navigate(`/messages`);
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "rgba(0,0,0,0.85)" }} onClick={onClose}>
      <div className="flex-1" />
      <div
        className="w-full max-w-lg mx-auto rounded-t-3xl overflow-hidden flex flex-col"
        style={{ background: "linear-gradient(180deg, #1a1a2e 0%, #0d0d1f 100%)", maxHeight: "88vh", border: "1px solid rgba(255,255,255,0.1)", borderBottom: "none" }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 pt-4 pb-2 flex-shrink-0">
          <div className="w-10 h-1 rounded-full mx-auto" style={{ background: "rgba(255,255,255,0.2)" }} />
        </div>
        <div className="flex items-center justify-between px-4 pb-3 flex-shrink-0">
          <h2 className="text-base font-black" style={{ color: "#FFDE00" }}>卡牌詳情</h2>
          <button onClick={onClose} className="text-xs px-3 py-1 rounded-full" style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)" }}>關閉</button>
        </div>

        <div className="overflow-y-auto flex-1 px-4 pb-24">
          {photos.length > 0 && (
            <div className="mb-4">
              <img src={photos[photoIdx]} alt="" className="w-full rounded-2xl object-contain" style={{ maxHeight: 240, background: "rgba(255,255,255,0.04)" }} />
              {photos.length > 1 && (
                <div className="flex gap-1.5 mt-2 justify-center">
                  {photos.map((p, i) => (
                    <button key={i} onClick={() => setPhotoIdx(i)}>
                      <img src={p} alt="" className="rounded-lg object-cover" style={{ width: 44, height: 44, border: i === photoIdx ? "2px solid #FFDE00" : "2px solid rgba(255,255,255,0.1)" }} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex-1 min-w-0">
              {listing.game && (
                <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mb-1" style={{ background: "rgba(255,222,0,0.12)", color: "#FFDE00", border: "1px solid rgba(255,222,0,0.25)" }}>
                  {GAMES.find(g => g.id === listing.game)?.label ?? listing.game}
                </span>
              )}
              <h3 className="text-xl font-black leading-tight" style={{ color: "#fff" }}>{listing.cardName}</h3>
              {listing.cardNameJa && <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>{listing.cardNameJa}</p>}
              {listing.setName && <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>{listing.setName}{listing.setNumber ? ` #${listing.setNumber}` : ""}</p>}
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-2xl font-black" style={{ color: "#FFDE00" }}>HKD ${listing.priceHKD.toLocaleString()}</p>
              <span className="text-xs font-bold px-2 py-0.5 rounded-md" style={{ background: cond.color + "22", color: cond.color }}>
                {listing.isGraded && listing.gradeScore ? `${listing.gradingOrg} ${listing.gradeScore}` : cond.label}
              </span>
            </div>
          </div>

          {listing.description && (
            <p className="text-sm mb-3 leading-relaxed" style={{ color: "rgba(255,255,255,0.65)" }}>{listing.description}</p>
          )}

          <div className="flex items-center gap-2 mb-4 p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0" style={{ background: "rgba(255,222,0,0.15)", color: "#FFDE00" }}>
              {(listing.sellerName ?? "S").charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold" style={{ color: "#fff" }}>{listing.sellerName ?? "賣家"}</p>
              <div className="flex items-center gap-1">
                <Eye className="w-3 h-3" style={{ color: "rgba(255,255,255,0.3)" }} />
                <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>{listing.views} 次瀏覽</span>
                <span className="text-[10px] ml-1" style={{ color: "rgba(255,255,255,0.25)" }}>{timeAgo(listing.createdAt)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-shrink-0 px-4 py-3" style={{ background: "rgba(13,13,31,0.95)", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          {isAuthenticated && user?.id !== listing.userId ? (
            <button
              onClick={handleContact}
              className="w-full py-3 rounded-2xl font-black text-sm"
              style={{ background: "linear-gradient(90deg, #CC0000, #FF4444)", color: "#fff" }}
            >
              私訊賣家洽購
            </button>
          ) : !isAuthenticated ? (
            <button
              onClick={() => navigate("/login")}
              className="w-full py-3 rounded-2xl font-black text-sm"
              style={{ background: "linear-gradient(90deg, #CC0000, #FF4444)", color: "#fff" }}
            >
              登入後洽購
            </button>
          ) : (
            <div className="text-center text-xs py-2" style={{ color: "rgba(255,255,255,0.35)" }}>這是你的上架記錄</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CardMarket() {
  const [, navigate] = useLocation();
  const { isAuthenticated } = useAuth();
  const [game, setGame] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [showWTB, setShowWTB] = useState(false);

  const { data: listings = [], isLoading } = trpc.cardTrading.getListings.useQuery({
    game: game || undefined,
    cardName: search || undefined,
    limit: 40,
    offset: 0,
  }, { staleTime: 30000 });

  const { data: wtbs = [] } = trpc.cardTrading.getWTBs.useQuery({
    game: game || undefined,
    limit: 20,
    offset: 0,
  }, { staleTime: 60000 });

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearch(searchInput.trim());
  }

  return (
    <div className="min-h-screen pb-20" style={{ background: "linear-gradient(160deg, #0d0d1f 0%, #1a0505 40%, #0d0d1f 100%)", color: "#fff" }}>
      <Header />

      {selectedListing && (
        <ListingDetailSheet listing={selectedListing} onClose={() => setSelectedListing(null)} />
      )}

      <div className="max-w-lg mx-auto px-4 pt-4">
        {/* Hero */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-full flex-shrink-0" style={{ background: "linear-gradient(to bottom, #CC0000 50%, #f5f5f5 50%)", border: "2px solid #333" }} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black tracking-tight leading-none" style={{ color: "#FFDE00", textShadow: "0 2px 8px rgba(255,222,0,0.4)" }}>
                CardZzz
              </h1>
              <span className="text-xs font-black px-2 py-0.5 rounded-full" style={{ background: "rgba(255,222,0,0.15)", color: "#FFDE00", border: "1px solid rgba(255,222,0,0.3)" }}>市場</span>
            </div>
            <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>TCG 卡牌買賣交易平台</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => navigate("/cardzzz/market/my")}
              className="text-xs px-3 py-1.5 rounded-full font-semibold"
              style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.12)" }}>
              我的
            </button>
          </div>
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} className="relative mb-4">
          <input
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="搜尋卡牌名稱..."
            className="w-full pr-10 pl-4 py-2.5 text-sm"
            style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "12px", color: "#fff", outline: "none" }}
          />
          <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2">
            <Search className="w-4 h-4" style={{ color: "rgba(255,255,255,0.4)" }} />
          </button>
        </form>

        {/* Game tabs */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 mb-4" style={{ scrollbarWidth: "none" }}>
          {GAMES.map(g => (
            <button
              key={g.id}
              onClick={() => setGame(g.id)}
              className="flex-shrink-0 text-xs px-3 py-1.5 rounded-full font-semibold transition-all"
              style={game === g.id
                ? { background: "linear-gradient(90deg, #CC0000, #FF4444)", color: "#fff" }
                : { background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.1)" }
              }
            >
              {g.label}
            </button>
          ))}
        </div>

        {/* Listings grid */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "#FFDE00", borderTopColor: "transparent" }} />
          </div>
        ) : listings.length === 0 ? (
          <div className="flex flex-col items-center py-12 gap-3">
            <span style={{ fontSize: 48 }}>🃏</span>
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>暫時未有上架記錄</p>
            {isAuthenticated && (
              <button onClick={() => navigate("/cardzzz/market/sell")}
                className="text-sm px-4 py-2 rounded-full font-bold"
                style={{ background: "rgba(255,222,0,0.15)", color: "#FFDE00", border: "1px solid rgba(255,222,0,0.3)" }}>
                立即上架
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 mb-6">
            {(listings as Listing[]).map(l => (
              <ListingCard key={l.id} listing={l} onClick={() => setSelectedListing(l)} />
            ))}
          </div>
        )}

        {/* WTB section */}
        {wtbs.length > 0 && (
          <div className="mb-6">
            <button
              className="flex items-center justify-between w-full mb-3"
              onClick={() => setShowWTB(p => !p)}
            >
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-4 h-4" style={{ color: "#FFDE00" }} />
                <span className="text-sm font-black" style={{ color: "#FFDE00" }}>求購清單 (WTB)</span>
                <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: "rgba(255,222,0,0.12)", color: "#FFDE00" }}>{wtbs.length}</span>
              </div>
              <ChevronRight className="w-4 h-4 transition-transform" style={{ color: "rgba(255,255,255,0.4)", transform: showWTB ? "rotate(90deg)" : "none" }} />
            </button>
            {showWTB && (
              <div className="flex flex-col gap-2">
                {(wtbs as WTB[]).map(w => <WTBCard key={w.id} wtb={w} />)}
                <button onClick={() => navigate("/cardzzz/market/wtb")}
                  className="text-xs text-center py-2"
                  style={{ color: "rgba(255,222,0,0.6)" }}>
                  我想求購 →
                </button>
              </div>
            )}
          </div>
        )}

        {/* Empty WTB section promo */}
        {wtbs.length === 0 && (
          <div className="mb-6 p-4 rounded-2xl flex items-center justify-between" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div>
              <p className="text-sm font-bold" style={{ color: "#FFDE00" }}>想求購特定卡？</p>
              <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>登記 WTB，有人上架即通知你</p>
            </div>
            <button onClick={() => navigate("/cardzzz/market/wtb")}
              className="text-xs px-3 py-1.5 rounded-full font-bold flex-shrink-0"
              style={{ background: "rgba(255,222,0,0.15)", color: "#FFDE00", border: "1px solid rgba(255,222,0,0.3)" }}>
              登記
            </button>
          </div>
        )}
      </div>

      {/* FAB */}
      {isAuthenticated && (
        <button
          onClick={() => navigate("/cardzzz/market/sell")}
          className="fixed z-40 rounded-full shadow-2xl flex items-center gap-2 font-black text-sm"
          style={{ bottom: 76, right: 16, background: "linear-gradient(90deg, #CC0000, #FF4444)", color: "#fff", padding: "12px 18px", boxShadow: "0 4px 24px rgba(204,0,0,0.5)" }}
        >
          <Plus className="w-4 h-4" />
          上架
        </button>
      )}
    </div>
  );
}
