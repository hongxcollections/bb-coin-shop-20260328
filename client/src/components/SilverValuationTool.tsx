import { useState, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Loader2,
  Upload,
  X,
  RefreshCw,
  Trash2,
  History,
  Plus,
} from "lucide-react";

type CoinResult = {
  isSilver: boolean;
  coinName: string;
  country: string;
  year: string;
  silverPurity: number;
  weightGrams: number;
  silverContentGrams: number;
  purityNote: string;
  notes: string;
};

type BatchItem = {
  id: string;
  file: File;
  preview: string;
  status: "pending" | "identifying" | "done" | "error";
  result?: CoinResult;
  error?: string;
};

type HistoryEntry = {
  id: string;
  timestamp: number;
  coinName: string;
  silverContentGrams: number;
  spotPrice: number;
  discount: number;
  offer: number;
  imagePreview?: string;
};

const HISTORY_KEY = "silver_valuation_history_v1";

function loadHistory(): HistoryEntry[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]"); } catch { return []; }
}
function persistHistory(h: HistoryEntry[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0, 100)));
}

export function SilverValuationTool({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<"tool" | "batch" | "history">("tool");

  // ── 單件模式 ───────────────────────────────────────────────────────────────
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [coinData, setCoinData] = useState<CoinResult | null>(null);
  const [identifying, setIdentifying] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── 共用計算欄 ─────────────────────────────────────────────────────────────
  const [spotPrice, setSpotPrice] = useState("");
  const [discount, setDiscount] = useState("85");
  const [fetchingPrice, setFetchingPrice] = useState(false);

  // ── 批量模式 ───────────────────────────────────────────────────────────────
  const [batch, setBatch] = useState<BatchItem[]>([]);
  const [batchIdentifying, setBatchIdentifying] = useState(false);
  const batchFileRef = useRef<HTMLInputElement>(null);

  // ── 歷史紀錄 ───────────────────────────────────────────────────────────────
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory());

  const identifyMut = trpc.silverTool.identify.useMutation();
  const spotQuery = trpc.silverTool.getSpotPrice.useQuery(undefined, { enabled: false });

  // ── helpers ────────────────────────────────────────────────────────────────
  async function fileToBase64(file: File): Promise<string> {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = e => res((e.target!.result as string).split(",")[1]);
      r.onerror = rej;
      r.readAsDataURL(file);
    });
  }

  function makePreview(file: File): Promise<string> {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = e => res(e.target!.result as string);
      r.onerror = rej;
      r.readAsDataURL(file);
    });
  }

  const handleFile = useCallback(async (file: File) => {
    setImage(file);
    const preview = await makePreview(file);
    setImagePreview(preview);
    setCoinData(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith("image/")) handleFile(file);
  }, [handleFile]);

  async function identify() {
    if (!image) return;
    setIdentifying(true);
    try {
      const b64 = await fileToBase64(image);
      const r = await identifyMut.mutateAsync({ imageBase64: b64, mimeType: image.type || "image/jpeg" });
      setCoinData(r);
      if (!r.isSilver) toast.warning("AI 識別：呢枚唔係銀幣，請確認", { className: "bb-toast-info" });
    } catch (e: any) {
      toast.error(`識別失敗：${e?.message ?? "未知錯誤"}`, { className: "bb-toast-err" });
    } finally {
      setIdentifying(false);
    }
  }

  async function fetchSpot() {
    setFetchingPrice(true);
    try {
      const r = await spotQuery.refetch();
      if (r.data?.ok && r.data.hkdPerGram) {
        setSpotPrice(String(r.data.hkdPerGram));
        toast.success(`銀價更新：HK$${r.data.hkdPerGram}/克`, { className: "bb-toast-success" });
      } else {
        toast.error("無法取得銀價，請手動輸入", { className: "bb-toast-err" });
      }
    } catch {
      toast.error("銀價獲取失敗", { className: "bb-toast-err" });
    } finally {
      setFetchingPrice(false);
    }
  }

  function reset() { setImage(null); setImagePreview(null); setCoinData(null); }

  // 計算
  const silverContent = coinData?.silverContentGrams ?? 0;
  const spotNum = parseFloat(spotPrice) || 0;
  const discountNum = parseFloat(discount) || 0;
  const silverValue = silverContent * spotNum;
  const offer = silverValue * (discountNum / 100);
  const canCalc = silverContent > 0 && spotNum > 0 && discountNum > 0;

  function saveOffer() {
    if (!canCalc || !coinData) return;
    const entry: HistoryEntry = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      coinName: coinData.coinName,
      silverContentGrams: silverContent,
      spotPrice: spotNum,
      discount: discountNum,
      offer,
      imagePreview: imagePreview ?? undefined,
    };
    const h = [entry, ...loadHistory()];
    persistHistory(h);
    setHistory(h);
    toast.success("報價已儲存", { className: "bb-toast-success" });
  }

  // ── 批量模式 ───────────────────────────────────────────────────────────────
  async function addBatchFiles(files: FileList | null) {
    if (!files) return;
    const newItems: BatchItem[] = await Promise.all(
      Array.from(files).filter(f => f.type.startsWith("image/")).map(async f => ({
        id: `${Date.now()}-${Math.random()}`,
        file: f,
        preview: await makePreview(f),
        status: "pending" as const,
      }))
    );
    setBatch(prev => [...prev, ...newItems]);
  }

  async function identifyBatch(itemId: string) {
    setBatch(prev => prev.map(i => i.id === itemId ? { ...i, status: "identifying" } : i));
    const item = batch.find(i => i.id === itemId);
    if (!item) return;
    try {
      const b64 = await fileToBase64(item.file);
      const r = await identifyMut.mutateAsync({ imageBase64: b64, mimeType: item.file.type || "image/jpeg" });
      setBatch(prev => prev.map(i => i.id === itemId ? { ...i, status: "done", result: r } : i));
    } catch (e: any) {
      setBatch(prev => prev.map(i => i.id === itemId ? { ...i, status: "error", error: String(e?.message ?? "失敗") } : i));
    }
  }

  async function identifyAllBatch() {
    setBatchIdentifying(true);
    const pending = batch.filter(i => i.status === "pending" || i.status === "error");
    for (const item of pending) {
      await identifyBatch(item.id);
    }
    setBatchIdentifying(false);
  }

  function saveBatchOffer(item: BatchItem) {
    if (!item.result || !spotNum || !discountNum) return;
    const sc = item.result.silverContentGrams;
    const o = sc * spotNum * (discountNum / 100);
    const entry: HistoryEntry = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      coinName: item.result.coinName,
      silverContentGrams: sc,
      spotPrice: spotNum,
      discount: discountNum,
      offer: o,
      imagePreview: item.preview,
    };
    const h = [entry, ...loadHistory()];
    persistHistory(h);
    setHistory(h);
    toast.success(`已儲存：${item.result.coinName}`, { className: "bb-toast-success" });
  }

  function saveAllBatch() {
    const done = batch.filter(i => i.status === "done" && i.result);
    done.forEach(saveBatchOffer);
    if (done.length) toast.success(`已儲存 ${done.length} 筆報價`, { className: "bb-toast-success" });
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md w-full p-0 gap-0" style={{ maxHeight: "92vh", overflowY: "auto" }}>
        <DialogHeader className="px-4 pt-4 pb-3 border-b">
          <DialogTitle className="text-base font-bold">🪙 銀幣收購報價工具</DialogTitle>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex border-b sticky top-0 bg-white z-10">
          {(["tool", "batch", "history"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2.5 text-[11px] font-semibold transition-colors ${tab === t ? "border-b-2 border-amber-500 text-amber-700 bg-amber-50/50" : "text-gray-400 hover:text-gray-600"}`}
            >
              {t === "tool" ? "🔍 識別" : t === "batch" ? `📦 批量${batch.length > 0 ? ` (${batch.length})` : ""}` : `📋 紀錄 (${history.length})`}
            </button>
          ))}
        </div>

        <div className="p-4 space-y-4">

          {/* ── 識別工具 tab ─────────────────────────────────────────────────── */}
          {tab === "tool" && (
            <>
              {/* Image upload */}
              {!imagePreview ? (
                <div
                  onDrop={handleDrop}
                  onDragOver={e => e.preventDefault()}
                  onClick={() => fileRef.current?.click()}
                  className="border-2 border-dashed border-gray-200 rounded-2xl p-8 text-center cursor-pointer hover:border-amber-400 hover:bg-amber-50/40 transition-colors"
                >
                  <Upload className="w-9 h-9 text-gray-300 mx-auto mb-2" />
                  <p className="text-xs text-gray-500 font-medium">上傳或拖放銀幣圖片</p>
                  <p className="text-[10px] text-gray-400 mt-1">支援 JPG / PNG / WEBP</p>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
                </div>
              ) : (
                <div className="relative">
                  <img src={imagePreview} className="w-full max-h-48 object-contain rounded-xl border border-gray-100 bg-gray-50" alt="coin" />
                  <button onClick={reset} className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1 transition">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Identify button */}
              {image && !coinData && (
                <button
                  onClick={identify}
                  disabled={identifying}
                  className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white text-sm font-bold flex items-center justify-center gap-2 transition disabled:opacity-60"
                >
                  {identifying ? <><Loader2 className="w-4 h-4 animate-spin" /> AI 識別中...</> : "✨ AI 自動識別"}
                </button>
              )}

              {/* Coin result */}
              {coinData && (
                <div className={`rounded-xl p-3 space-y-2 border ${coinData.isSilver ? "bg-slate-50 border-slate-200" : "bg-orange-50 border-orange-200"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-bold text-sm text-gray-800 leading-tight">{coinData.coinName}</p>
                    <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${coinData.isSilver ? "bg-slate-200 text-slate-700" : "bg-orange-200 text-orange-700"}`}>
                      {coinData.isSilver ? "銀幣 ✓" : "非銀幣 ⚠️"}
                    </span>
                  </div>
                  {(coinData.country || coinData.year) && (
                    <p className="text-xs text-gray-500">{[coinData.country, coinData.year].filter(Boolean).join(" · ")}</p>
                  )}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-white rounded-lg p-2 text-center border border-gray-100">
                      <p className="text-[10px] text-gray-400 mb-0.5">成色</p>
                      <p className="text-xs font-bold text-gray-800 leading-tight">{coinData.purityNote || `${(coinData.silverPurity * 1000).toFixed(0)}`}</p>
                    </div>
                    <div className="bg-white rounded-lg p-2 text-center border border-gray-100">
                      <p className="text-[10px] text-gray-400 mb-0.5">標準重量</p>
                      <p className="text-xs font-bold text-gray-800">{coinData.weightGrams.toFixed(2)}g</p>
                    </div>
                    <div className="bg-amber-50 rounded-lg p-2 text-center border border-amber-200">
                      <p className="text-[10px] text-amber-600 mb-0.5">銀含量</p>
                      <p className="text-xs font-bold text-amber-800">{coinData.silverContentGrams.toFixed(2)}g</p>
                    </div>
                  </div>
                  {coinData.notes && <p className="text-[10px] text-gray-400">⚠️ {coinData.notes}</p>}
                  <button onClick={identify} disabled={identifying} className="text-[10px] text-amber-600 hover:underline flex items-center gap-1">
                    <RefreshCw className="w-2.5 h-2.5" /> 重新識別
                  </button>
                </div>
              )}

              {/* Price inputs */}
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-semibold text-gray-600 mb-1.5">銀價（港元/克）</p>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={spotPrice}
                      onChange={e => setSpotPrice(e.target.value)}
                      placeholder="如：6.50"
                      className="flex-1 text-sm outline-none px-3 py-2"
                      style={{ background: "#fff", border: "1px solid #E5E5E5", borderRadius: "12px" }}
                    />
                    <button
                      onClick={fetchSpot}
                      disabled={fetchingPrice}
                      className="px-3 py-2 text-xs font-semibold text-sky-700 bg-sky-50 hover:bg-sky-100 rounded-xl flex items-center gap-1.5 transition disabled:opacity-60 whitespace-nowrap border border-sky-200"
                    >
                      {fetchingPrice ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                      自動取價
                    </button>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-600 mb-1.5 flex justify-between">
                    <span>收購折扣</span>
                    <span className="text-amber-600 font-bold">{discount}%</span>
                  </p>
                  <input
                    type="range"
                    min="50" max="100" step="1"
                    value={discount}
                    onChange={e => setDiscount(e.target.value)}
                    className="w-full accent-amber-500"
                  />
                  <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                    <span>50%</span><span>75%</span><span>100%</span>
                  </div>
                </div>
              </div>

              {/* Offer */}
              {canCalc && (
                <div className="rounded-xl bg-gradient-to-br from-amber-50 to-yellow-50 border border-amber-200 p-4">
                  <p className="text-[10px] text-gray-500 mb-2">計算明細</p>
                  <p className="text-[11px] text-gray-500">
                    銀含量 {coinData?.silverContentGrams.toFixed(2)}g × HK${spotNum}/g
                    {" = "}
                    <span className="text-gray-700 font-semibold">HK${silverValue.toFixed(2)}</span>
                  </p>
                  <p className="text-[11px] text-gray-500">× {discount}% 折扣 =</p>
                  <p className="text-3xl font-extrabold text-amber-700 mt-1 mb-0.5">HK$ {offer.toFixed(0)}</p>
                  <p className="text-[10px] text-amber-600/70">收購報價</p>
                  <button
                    onClick={saveOffer}
                    className="mt-3 w-full py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition"
                  >
                    📋 儲存報價紀錄
                  </button>
                </div>
              )}
            </>
          )}

          {/* ── 批量模式 tab ─────────────────────────────────────────────────── */}
          {tab === "batch" && (
            <>
              {/* Batch upload */}
              <div
                onDrop={async e => { e.preventDefault(); await addBatchFiles(e.dataTransfer.files); }}
                onDragOver={e => e.preventDefault()}
                onClick={() => batchFileRef.current?.click()}
                className="border-2 border-dashed border-gray-200 rounded-2xl p-5 text-center cursor-pointer hover:border-amber-400 hover:bg-amber-50/40 transition-colors"
              >
                <Plus className="w-7 h-7 text-gray-300 mx-auto mb-1" />
                <p className="text-xs text-gray-500 font-medium">加入多張銀幣圖片</p>
                <p className="text-[10px] text-gray-400 mt-0.5">可一次選擇多張</p>
                <input ref={batchFileRef} type="file" accept="image/*" multiple className="hidden" onChange={e => addBatchFiles(e.target.files)} />
              </div>

              {batch.length > 0 && (
                <>
                  {/* Price inputs (same as tool tab) */}
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={spotPrice}
                      onChange={e => setSpotPrice(e.target.value)}
                      placeholder="銀價 HK$/克"
                      className="flex-1 text-sm outline-none px-3 py-2"
                      style={{ background: "#fff", border: "1px solid #E5E5E5", borderRadius: "12px" }}
                    />
                    <button
                      onClick={fetchSpot}
                      disabled={fetchingPrice}
                      className="px-3 py-2 text-xs font-semibold text-sky-700 bg-sky-50 hover:bg-sky-100 rounded-xl flex items-center gap-1 transition disabled:opacity-60 border border-sky-200"
                    >
                      {fetchingPrice ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                      取價
                    </button>
                    <input
                      type="number"
                      value={discount}
                      onChange={e => setDiscount(e.target.value)}
                      placeholder="折扣%"
                      className="w-20 text-sm outline-none px-3 py-2 text-center"
                      style={{ background: "#fff", border: "1px solid #E5E5E5", borderRadius: "12px" }}
                    />
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-2">
                    <button
                      onClick={identifyAllBatch}
                      disabled={batchIdentifying || batch.every(i => i.status === "done")}
                      className="flex-1 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition disabled:opacity-60"
                    >
                      {batchIdentifying ? <Loader2 className="w-3 h-3 animate-spin" /> : "✨"}
                      全部識別
                    </button>
                    <button
                      onClick={saveAllBatch}
                      disabled={!batch.some(i => i.status === "done") || !spotNum || !discountNum}
                      className="flex-1 py-2 rounded-xl bg-green-500 hover:bg-green-600 text-white text-xs font-bold transition disabled:opacity-60"
                    >
                      📋 儲存全部報價
                    </button>
                    <button
                      onClick={() => setBatch([])}
                      className="px-3 py-2 rounded-xl border border-gray-200 text-gray-400 hover:text-red-500 text-xs transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Batch list */}
                  <div className="space-y-2">
                    {batch.map(item => {
                      const sc = item.result?.silverContentGrams ?? 0;
                      const itemOffer = sc * spotNum * (discountNum / 100);
                      return (
                        <div key={item.id} className="flex gap-3 p-3 rounded-xl border bg-gray-50 items-start">
                          <img src={item.preview} className="w-14 h-14 object-cover rounded-lg border shrink-0" alt="" />
                          <div className="flex-1 min-w-0">
                            {item.status === "pending" && (
                              <p className="text-xs text-gray-400">等待識別...</p>
                            )}
                            {item.status === "identifying" && (
                              <p className="text-xs text-amber-500 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> AI 識別中...</p>
                            )}
                            {item.status === "error" && (
                              <p className="text-xs text-red-500">識別失敗：{item.error}</p>
                            )}
                            {item.status === "done" && item.result && (
                              <>
                                <p className="text-xs font-semibold text-gray-800 truncate">{item.result.coinName}</p>
                                <p className="text-[10px] text-gray-500">{item.result.purityNote} · {item.result.silverContentGrams.toFixed(2)}g 銀</p>
                                {spotNum > 0 && discountNum > 0 && (
                                  <p className="text-sm font-bold text-amber-700 mt-0.5">HK$ {itemOffer.toFixed(0)}</p>
                                )}
                              </>
                            )}
                          </div>
                          <div className="flex flex-col gap-1.5 shrink-0">
                            {(item.status === "pending" || item.status === "error") && (
                              <button
                                onClick={() => identifyBatch(item.id)}
                                disabled={batchIdentifying}
                                className="text-[10px] px-2 py-1 rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200 transition disabled:opacity-50 font-semibold"
                              >
                                識別
                              </button>
                            )}
                            <button
                              onClick={() => setBatch(prev => prev.filter(i => i.id !== item.id))}
                              className="text-[10px] px-2 py-1 rounded-lg bg-gray-100 text-gray-400 hover:bg-red-50 hover:text-red-500 transition"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </>
          )}

          {/* ── 報價紀錄 tab ─────────────────────────────────────────────────── */}
          {tab === "history" && (
            <>
              {history.length === 0 ? (
                <div className="text-center py-12 text-gray-300">
                  <History className="w-10 h-10 mx-auto mb-2" />
                  <p className="text-xs">未有報價紀錄</p>
                </div>
              ) : (
                <>
                  <div className="flex justify-end">
                    <button
                      onClick={() => { localStorage.removeItem(HISTORY_KEY); setHistory([]); }}
                      className="text-[10px] text-red-400 hover:text-red-600 flex items-center gap-0.5 transition"
                    >
                      <Trash2 className="w-3 h-3" /> 清除全部
                    </button>
                  </div>
                  <div className="space-y-2">
                    {history.map(h => (
                      <div key={h.id} className="flex gap-3 p-3 rounded-xl border bg-gray-50 items-center">
                        {h.imagePreview && (
                          <img src={h.imagePreview} className="w-12 h-12 object-cover rounded-lg border shrink-0" alt="" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-800 truncate">{h.coinName}</p>
                          <p className="text-[10px] text-gray-400">{new Date(h.timestamp).toLocaleString("zh-HK")}</p>
                          <p className="text-[10px] text-gray-500 mt-0.5">
                            {h.silverContentGrams.toFixed(2)}g 銀 × HK${h.spotPrice}/g × {h.discount}%
                          </p>
                        </div>
                        <p className="text-base font-extrabold text-amber-700 shrink-0">HK${h.offer.toFixed(0)}</p>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
