import { useState, useEffect, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Search, X, ExternalLink, ChevronLeft, ChevronRight, Database, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import Header from "@/components/Header";

type SaleStatus = "all" | "sold" | "unsold";

interface Record {
  id: number;
  lotNumber: string | null;
  title: string;
  description: string | null;
  estimateLow: number | null;
  estimateHigh: number | null;
  soldPrice: number | null;
  currency: string;
  auctionHouse: string | null;
  auctionDate: string | null;
  saleStatus: string;
  imageUrl: string | null;
  imagesJson: string | null;
  sourceNote: string | null;
}

function parseImages(r: Record): string[] {
  try {
    if (r.imagesJson) {
      const arr = JSON.parse(r.imagesJson);
      if (Array.isArray(arr) && arr.length > 0) return arr;
    }
  } catch {}
  return r.imageUrl ? [r.imageUrl] : [];
}

function fmtPrice(val: number | null, currency = "HKD") {
  if (val == null) return null;
  return `${currency} ${val.toLocaleString()}`;
}

function extractSpinkUrl(sourceNote: string | null) {
  if (!sourceNote) return null;
  const m = sourceNote.match(/https?:\/\/[^\s|]+/);
  return m ? m[0] : null;
}

function RecordCard({ r, onImageClick }: { r: Record; onImageClick: (images: string[], startIdx?: number) => void }) {
  const isSold = r.saleStatus === "sold";
  const url = extractSpinkUrl(r.sourceNote);
  const hasEst = r.estimateLow != null || r.estimateHigh != null;
  const images = parseImages(r);
  const estStr = hasEst
    ? [fmtPrice(r.estimateLow, r.currency), r.estimateHigh != null ? r.estimateHigh.toLocaleString() : null]
        .filter(Boolean)
        .join(" – ")
    : null;

  return (
    <div className="flex gap-3 bg-white rounded-xl border border-gray-100 shadow-sm p-3 hover:shadow-md transition-shadow">
      {/* Thumbnail */}
      <div className="shrink-0 relative">
        {images.length > 0 ? (
          <div className="relative cursor-pointer" onClick={() => onImageClick(images, 0)}>
            <img
              src={images[0]}
              alt={r.title}
              className="w-[72px] h-[72px] object-cover rounded-lg border border-gray-200"
            />
            {images.length > 1 && (
              <span className="absolute bottom-0.5 right-0.5 bg-black/60 text-white text-[9px] font-bold px-1 py-0.5 rounded leading-none">
                1/{images.length}
              </span>
            )}
          </div>
        ) : (
          <div className="w-[72px] h-[72px] rounded-lg bg-gray-100 flex items-center justify-center">
            <Database className="h-5 w-5 text-gray-300" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-start justify-between gap-1">
          <p className="text-sm font-semibold text-gray-800 leading-snug line-clamp-2">{r.title}</p>
          {/* Sale badge */}
          <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-1 ${
            isSold ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
          }`}>
            {isSold ? "成交" : "流拍"}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-gray-500">
          {r.lotNumber && (
            <span className="font-mono bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-[10px]">
              Lot {r.lotNumber}
            </span>
          )}
          {r.auctionHouse && <span>{r.auctionHouse}</span>}
          {r.auctionDate && <span className="text-gray-400">{r.auctionDate}</span>}
        </div>

        <div className="flex items-center justify-between gap-2">
          {estStr && <span className="text-xs text-gray-400">估價 {estStr}</span>}
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-blue-400 hover:text-blue-600 ml-auto"
              onClick={e => e.stopPropagation()}
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>

        {/* 成交金額 — 獨立突出一行 */}
        <div className={`text-sm font-bold ${isSold ? "text-green-700" : "text-gray-400"}`}>
          {isSold
            ? r.soldPrice != null
              ? `成交：${fmtPrice(r.soldPrice, r.currency)}`
              : "成交：— （金額未記錄）"
            : "流拍"}
        </div>
      </div>
    </div>
  );
}

const PAGE_SIZE = 20;

export default function AuctionSearch() {
  const [inputVal, setInputVal] = useState("");
  const [keyword, setKeyword] = useState("");
  const [saleStatus, setSaleStatus] = useState<SaleStatus>("all");
  const [houseFilter, setHouseFilter] = useState<string>("");
  const [offset, setOffset] = useState(0);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxIdx, setLightboxIdx] = useState(0);
  const [showFilters, setShowFilters] = useState(false);

  const openLightbox = useCallback((images: string[], startIdx = 0) => {
    setLightboxImages(images);
    setLightboxIdx(startIdx);
  }, []);
  const closeLightbox = useCallback(() => setLightboxImages([]), []);
  const prevImage = useCallback(() => setLightboxIdx(i => Math.max(0, i - 1)), []);
  const nextImage = useCallback((total: number) => setLightboxIdx(i => Math.min(total - 1, i + 1)), []);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounce keyword
  useEffect(() => {
    const t = setTimeout(() => {
      setKeyword(inputVal);
      setOffset(0);
    }, 350);
    return () => clearTimeout(t);
  }, [inputVal]);

  const { data, isFetching } = trpc.auctionRecords.search.useQuery(
    { keyword, saleStatus, auctionHouse: houseFilter || undefined, limit: PAGE_SIZE, offset },
    { staleTime: 10_000 }
  );

  const { data: houses } = trpc.auctionRecords.listHouses.useQuery(undefined, { staleTime: 60_000 });

  const records: Record[] = (data?.records as Record[] | undefined) ?? [];
  const total = data?.total ?? 0;
  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const clearSearch = useCallback(() => {
    setInputVal("");
    setKeyword("");
    setOffset(0);
    inputRef.current?.focus();
  }, []);

  const prevPage = () => setOffset(o => Math.max(0, o - PAGE_SIZE));
  const nextPage = () => setOffset(o => o + PAGE_SIZE);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      {/* Sticky search bar — sits just below the fixed Header (top-16 = 64px) */}
      <div className="sticky top-16 z-30 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 pt-3 pb-3 space-y-2.5">
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-bold text-gray-700 whitespace-nowrap">拍賣紀錄庫</h1>
            {/* Search input */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              <input
                ref={inputRef}
                value={inputVal}
                onChange={e => setInputVal(e.target.value)}
                placeholder="搜尋錢幣名稱、批號、年份…"
                className="w-full pl-9 pr-8 py-2 text-sm rounded-full border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
                autoFocus
              />
              {inputVal && (
                <button
                  onClick={clearSearch}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <button
              onClick={() => setShowFilters(v => !v)}
              className={`shrink-0 p-2 rounded-full border ${showFilters || saleStatus !== "all" || houseFilter ? "border-orange-400 bg-orange-50 text-orange-600" : "border-gray-300 text-gray-500"}`}
            >
              <SlidersHorizontal className="h-4 w-4" />
            </button>
          </div>

          {/* Filter chips */}
          {showFilters && (
            <div className="space-y-2 pb-1">
              {/* Status filter */}
              <div className="flex gap-1.5 flex-wrap">
                {(["all", "sold", "unsold"] as SaleStatus[]).map(s => (
                  <button
                    key={s}
                    onClick={() => { setSaleStatus(s); setOffset(0); }}
                    className={`text-xs px-3 py-1 rounded-full border font-medium transition-colors ${
                      saleStatus === s
                        ? "bg-orange-500 border-orange-500 text-white"
                        : "bg-white border-gray-300 text-gray-600 hover:border-orange-400"
                    }`}
                  >
                    {s === "all" ? "全部" : s === "sold" ? "成交" : "流拍"}
                  </button>
                ))}
              </div>

              {/* Auction house filter */}
              {houses && houses.length > 0 && (
                <div className="flex gap-1.5 flex-wrap">
                  <button
                    onClick={() => { setHouseFilter(""); setOffset(0); }}
                    className={`text-xs px-3 py-1 rounded-full border font-medium transition-colors ${
                      !houseFilter
                        ? "bg-blue-500 border-blue-500 text-white"
                        : "bg-white border-gray-300 text-gray-600 hover:border-blue-400"
                    }`}
                  >
                    全部拍賣行
                  </button>
                  {houses.map(h => (
                    <button
                      key={h}
                      onClick={() => { setHouseFilter(h); setOffset(0); }}
                      className={`text-xs px-3 py-1 rounded-full border font-medium transition-colors ${
                        houseFilter === h
                          ? "bg-blue-500 border-blue-500 text-white"
                          : "bg-white border-gray-300 text-gray-600 hover:border-blue-400"
                      }`}
                    >
                      {h}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Result count */}
          <div className="flex items-center justify-between text-xs text-gray-500 pb-0.5">
            <span>
              {isFetching ? (
                <span className="text-orange-500">搜尋中…</span>
              ) : keyword || saleStatus !== "all" || houseFilter ? (
                `找到 ${total} 條紀錄`
              ) : (
                `共 ${total} 條入庫紀錄`
              )}
            </span>
            {totalPages > 1 && (
              <span>第 {page} / {totalPages} 頁</span>
            )}
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="max-w-2xl mx-auto px-4 py-4 pb-36 space-y-2.5">
        {records.length === 0 && !isFetching ? (
          <div className="text-center py-20">
            <Database className="h-10 w-10 mx-auto text-gray-300 mb-3" />
            {keyword ? (
              <>
                <p className="text-gray-500 font-medium">找不到「{keyword}」的紀錄</p>
                <p className="text-xs text-gray-400 mt-1">嘗試更短的關鍵字，例如品種名稱或年份</p>
              </>
            ) : (
              <>
                <p className="text-gray-500 font-medium">資料庫暫時為空</p>
                <p className="text-xs text-gray-400 mt-1">請先在管理後台批量導入拍賣紀錄</p>
              </>
            )}
          </div>
        ) : (
          <>
            {records.map(r => (
              <RecordCard key={r.id} r={r} onImageClick={openLightbox} />
            ))}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 pt-2 pb-8">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={prevPage}
                  disabled={offset === 0}
                  className="gap-1"
                >
                  <ChevronLeft className="h-4 w-4" />
                  上一頁
                </Button>
                <span className="text-sm text-gray-500">{page} / {totalPages}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={nextPage}
                  disabled={offset + PAGE_SIZE >= total}
                  className="gap-1"
                >
                  下一頁
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Gallery Lightbox */}
      {lightboxImages.length > 0 && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center"
          onClick={closeLightbox}
        >
          {/* Close */}
          <button
            onClick={closeLightbox}
            className="absolute top-4 right-4 text-white bg-black/50 rounded-full p-2 z-10"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Counter */}
          {lightboxImages.length > 1 && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white text-sm font-medium bg-black/50 px-3 py-1 rounded-full z-10">
              {lightboxIdx + 1} / {lightboxImages.length}
            </div>
          )}

          {/* Main image */}
          <img
            src={lightboxImages[lightboxIdx]}
            alt={`圖片 ${lightboxIdx + 1}`}
            className="max-w-full max-h-[75vh] object-contain rounded shadow-2xl"
            onClick={e => e.stopPropagation()}
          />

          {/* Prev / Next arrows */}
          {lightboxImages.length > 1 && (
            <>
              <button
                onClick={e => { e.stopPropagation(); prevImage(); }}
                disabled={lightboxIdx === 0}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-white bg-black/50 rounded-full p-3 disabled:opacity-20 hover:bg-black/70 transition-colors z-10"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                onClick={e => { e.stopPropagation(); nextImage(lightboxImages.length); }}
                disabled={lightboxIdx === lightboxImages.length - 1}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white bg-black/50 rounded-full p-3 disabled:opacity-20 hover:bg-black/70 transition-colors z-10"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </>
          )}

          {/* Thumbnail strip (多圖時顯示) */}
          {lightboxImages.length > 1 && (
            <div
              className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 px-4"
              onClick={e => e.stopPropagation()}
            >
              {lightboxImages.map((url, i) => (
                <img
                  key={i}
                  src={url}
                  alt={`縮圖 ${i + 1}`}
                  onClick={() => setLightboxIdx(i)}
                  className={`w-12 h-12 object-cover rounded cursor-pointer border-2 transition-all ${
                    i === lightboxIdx ? "border-white scale-110" : "border-transparent opacity-60 hover:opacity-100"
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
