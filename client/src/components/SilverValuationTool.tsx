import { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Loader2,
  Upload,
  X,
  RefreshCw,
  Trash2,
  History,
  Plus,
} from "lucide-react";

// ── Silver parsing helpers ─────────────────────────────────────────────────

function parseSilverPurity(material: string): number {
  const m = (material ?? "").toLowerCase();
  if (m.includes(".999") || m.includes("999") || m.includes("純銀") || m.includes("fine silver")) return 0.999;
  if (m.includes(".925") || m.includes("925") || m.includes("sterling")) return 0.925;
  if (m.includes(".900") || m.includes("900")) return 0.900;
  if (m.includes(".800") || m.includes("800")) return 0.800;
  if (m.includes(".720") || m.includes("720")) return 0.720;
  if (m.includes(".585") || m.includes("585")) return 0.585;
  if (m.includes(".500") || m.includes("500")) return 0.500;
  return 0;
}

function parseWeightGrams(weight: string): number {
  if (!weight || weight === "-") return 0;
  const m = (weight ?? "").match(/([\d.]+)/);
  return m ? parseFloat(m[1]) : 0;
}

function isSilverMaterial(material: string): boolean {
  const m = (material ?? "").toLowerCase();
  return m.includes("銀") || m.includes("silver") || parseSilverPurity(material) > 0;
}

function purityLabel(purity: number): string {
  if (purity === 0.999) return "999 純銀";
  if (purity === 0.925) return "925 Sterling";
  if (purity === 0.900) return "900 銀";
  if (purity === 0.800) return "800 銀";
  if (purity === 0.720) return "720 銀";
  if (purity === 0.585) return "585 銀";
  if (purity === 0.500) return "500 銀";
  return purity > 0 ? `${(purity * 1000).toFixed(0)} 銀` : "未知";
}

type CoinResult = {
  isSilver: boolean;
  coinName: string;
  country: string;
  year: string;
  silverPurity: number;
  weightGrams: number;
  silverContentGrams: number;
  purityNote: string;
  material: string;
  notes: string;
};

function extractSilverCoin(data: any): CoinResult {
  const material: string = data?.material ?? data?.Material ?? "";
  const weight: string = data?.weight ?? data?.Weight ?? "";
  const silverPurity = parseSilverPurity(material);
  const weightGrams = parseWeightGrams(weight);
  const silverContentGrams = Math.round(weightGrams * silverPurity * 10000) / 10000;
  const notes: string[] = [];
  if (silverPurity === 0 && isSilverMaterial(material)) notes.push("未能識別成色，請手動確認");
  if (weightGrams === 0) notes.push("未能識別重量，請手動輸入");
  return {
    isSilver: isSilverMaterial(material),
    coinName: data?.name ?? data?.Name ?? "未知幣種",
    country: data?.country ?? data?.Country ?? "",
    year: data?.year ?? data?.Year ?? "",
    silverPurity,
    weightGrams,
    silverContentGrams,
    purityNote: purityLabel(silverPurity),
    material,
    notes: notes.join("；"),
  };
}

// ── Local history ──────────────────────────────────────────────────────────

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

// ── Component ──────────────────────────────────────────────────────────────

export function SilverValuationTool({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<"tool" | "batch" | "history">("tool");

  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [coinData, setCoinData] = useState<CoinResult | null>(null);
  const [identifying, setIdentifying] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [spotPrice, setSpotPrice] = useState("");
  const [discount, setDiscount] = useState("85");
  const [fetchingPrice, setFetchingPrice] = useState(false);
  const [cnyRef, setCnyRef] = useState<number | null>(null);

  const [batch, setBatch] = useState<BatchItem[]>([]);
  const [batchIdentifying, setBatchIdentifying] = useState(false);
  const batchFileRef = useRef<HTMLInputElement>(null);

  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory());

  // 專用輕量 identify endpoint（精簡 prompt + 完整 model fallback 鏈，速度快 4-6x）
  const analyzeMut = trpc.silverTool.identify.useMutation();
  const spotQuery = trpc.silverTool.getSpotPrice.useQuery(undefined, { enabled: false });
  const hkPricesQuery = trpc.silverTool.getHKSilverPrices.useQuery(undefined, { enabled: false });
  const [hkPrices, setHkPrices] = useState<null | Awaited<ReturnType<typeof hkPricesQuery.refetch>>["data"]>(null);
  const [loadingHK, setLoadingHK] = useState(false);
  const [expandedStore, setExpandedStore] = useState<string | null>(null);

  // 開啟 modal 時自動取現貨價
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    async function autoFetch() {
      try {
        const r = await spotQuery.refetch();
        if (cancelled) return;
        if (r.data?.ok && r.data.hkdPerGram) {
          setSpotPrice(String(r.data.hkdPerGram));
          setCnyRef(r.data.cnyPerGram ?? null);
        }
      } catch { /* ignore */ }
    }
    autoFetch();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // ── Image helpers ──────────────────────────────────────────────────────────
  /** 壓縮至 max 1024px JPEG，大幅縮減 payload */
  async function fileToBase64(file: File): Promise<string> {
    return new Promise((res, rej) => {
      const img = new Image();
      const objUrl = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(objUrl);
        const MAX = 1024;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          if (width > height) { height = Math.round(height * MAX / width); width = MAX; }
          else { width = Math.round(width * MAX / height); height = MAX; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
        res(canvas.toDataURL("image/jpeg", 0.82).split(",")[1]);
      };
      img.onerror = rej;
      img.src = objUrl;
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
    setImagePreview(await makePreview(file));
    setCoinData(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith("image/")) handleFile(file);
  }, [handleFile]);

  // ── Identify ───────────────────────────────────────────────────────────────
  async function identify() {
    if (!image) return;
    setIdentifying(true);
    try {
      const b64 = await fileToBase64(image);
      const result = await analyzeMut.mutateAsync({ imageBase64: b64, mimeType: "image/jpeg", lang: "zh" });
      const parsed = extractSilverCoin(result.data);
      setCoinData(parsed);
      if (!parsed.isSilver) {
        toast.warning("AI 識別：呢枚唔係銀幣，請確認材質", { className: "bb-toast-info" });
      } else if (parsed.silverPurity === 0 || parsed.weightGrams === 0) {
        toast.warning("部分資料未能識別，請手動補充", { className: "bb-toast-info" });
      }
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
        setCnyRef(r.data.cnyPerGram ?? null);
        const cnyStr = r.data.cnyPerGram ? `  ·  融通金參考 CNY¥${r.data.cnyPerGram}/克` : "";
        toast.success(`銀價更新：HK$${r.data.hkdPerGram}/克${cnyStr}`, { className: "bb-toast-success" });
      } else {
        toast.error("無法取得銀價，請手動輸入", { className: "bb-toast-err" });
      }
    } catch {
      toast.error("銀價獲取失敗", { className: "bb-toast-err" });
    } finally {
      setFetchingPrice(false);
    }
  }

  async function fetchHKPrices() {
    setLoadingHK(true);
    try {
      const r = await hkPricesQuery.refetch();
      setHkPrices(r.data ?? null);
    } catch { /* ignore */ } finally {
      setLoadingHK(false);
    }
  }

  function reset() { setImage(null); setImagePreview(null); setCoinData(null); }

  // ── Calculations ───────────────────────────────────────────────────────────
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

  // ── Batch ──────────────────────────────────────────────────────────────────
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

  async function identifyBatchItem(itemId: string) {
    setBatch(prev => prev.map(i => i.id === itemId ? { ...i, status: "identifying" } : i));
    const item = batch.find(i => i.id === itemId);
    if (!item) return;
    try {
      const b64 = await fileToBase64(item.file);
      const result = await analyzeMut.mutateAsync({ imageBase64: b64, mimeType: "image/jpeg", lang: "zh" });
      const parsed = extractSilverCoin(result.data);
      setBatch(prev => prev.map(i => i.id === itemId ? { ...i, status: "done", result: parsed } : i));
    } catch (e: any) {
      setBatch(prev => prev.map(i => i.id === itemId ? { ...i, status: "error", error: String(e?.message ?? "失敗") } : i));
    }
  }

  async function identifyAllBatch() {
    setBatchIdentifying(true);
    for (const item of batch.filter(i => i.status === "pending" || i.status === "error")) {
      await identifyBatchItem(item.id);
    }
    setBatchIdentifying(false);
  }

  function saveBatchOffer(item: BatchItem) {
    if (!item.result || !spotNum || !discountNum) return;
    const sc = item.result.silverContentGrams;
    const o = sc * spotNum * (discountNum / 100);
    const entry: HistoryEntry = {
      id: Date.now().toString() + Math.random(),
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
  }

  function saveAllBatch() {
    const done = batch.filter(i => i.status === "done" && i.result);
    done.forEach(saveBatchOffer);
    if (done.length) toast.success(`已儲存 ${done.length} 筆報價`, { className: "bb-toast-success" });
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (!open) return null;
  return createPortal(
    <>
      {/* 半透明背板 */}
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200 }}
      />
      {/* Modal 本體：頂部 64px (header)，底部 68px+safe area (bottom nav)，左右各 5px */}
      <div
        style={{
          position: "fixed",
          top: 64,
          left: 5,
          right: 5,
          bottom: "calc(68px + env(safe-area-inset-bottom, 0px))",
          zIndex: 201,
          background: "#fff",
          borderRadius: 14,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
        }}
      >
        {/* Header */}
        <div className="px-4 pt-3 pb-2.5 border-b flex items-center justify-between" style={{ flexShrink: 0 }}>
          <p className="text-base font-bold">🪙 銀幣報價工具</p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b bg-white" style={{ flexShrink: 0 }}>
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

        {/* 唯一可 scroll 區域 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">

          {/* ── 識別工具 ── */}
          {tab === "tool" && (
            <>
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

              {image && !coinData && (
                <button
                  onClick={identify}
                  disabled={identifying}
                  className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white text-sm font-bold flex items-center justify-center gap-2 transition disabled:opacity-60"
                >
                  {identifying ? <><Loader2 className="w-4 h-4 animate-spin" /> AI 識別中...</> : "✨ AI 自動識別"}
                </button>
              )}

              {/* 手動輸入重量（未識別到時顯示） */}
              {coinData && coinData.weightGrams === 0 && (
                <div className="rounded-xl bg-amber-50 border border-amber-200 p-3">
                  <p className="text-xs font-semibold text-amber-700 mb-1.5">未能識別重量，請手動輸入</p>
                  <input
                    type="number"
                    placeholder="重量（克，如 26.73）"
                    className="w-full text-sm outline-none px-3 py-2"
                    style={{ background: "#fff", border: "1px solid #E5E5E5", borderRadius: "12px" }}
                    onChange={e => {
                      const g = parseFloat(e.target.value) || 0;
                      setCoinData(prev => prev ? { ...prev, weightGrams: g, silverContentGrams: Math.round(g * prev.silverPurity * 10000) / 10000 } : prev);
                    }}
                  />
                </div>
              )}

              {/* 手動輸入成色（未識別到時顯示） */}
              {coinData && coinData.silverPurity === 0 && coinData.isSilver && (
                <div className="rounded-xl bg-amber-50 border border-amber-200 p-3">
                  <p className="text-xs font-semibold text-amber-700 mb-1.5">未能識別成色，請選擇或手動輸入</p>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {[0.999, 0.925, 0.900, 0.800].map(p => (
                      <button
                        key={p}
                        onClick={() => setCoinData(prev => prev ? { ...prev, silverPurity: p, purityNote: purityLabel(p), silverContentGrams: Math.round(prev.weightGrams * p * 10000) / 10000 } : prev)}
                        className="text-[11px] px-2.5 py-1 rounded-lg bg-white border border-amber-300 text-amber-700 hover:bg-amber-100 font-semibold transition"
                      >
                        {purityLabel(p)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

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
                  {coinData.material && (
                    <p className="text-[10px] text-gray-400 leading-tight">{coinData.material}</p>
                  )}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-white rounded-lg p-2 text-center border border-gray-100">
                      <p className="text-[10px] text-gray-400 mb-0.5">成色</p>
                      <p className="text-xs font-bold text-gray-800">{coinData.purityNote}</p>
                    </div>
                    <div className="bg-white rounded-lg p-2 text-center border border-gray-100">
                      <p className="text-[10px] text-gray-400 mb-0.5">標準重量</p>
                      <p className="text-xs font-bold text-gray-800">{coinData.weightGrams > 0 ? `${coinData.weightGrams}g` : "—"}</p>
                    </div>
                    <div className="bg-amber-50 rounded-lg p-2 text-center border border-amber-200">
                      <p className="text-[10px] text-amber-600 mb-0.5">銀含量</p>
                      <p className="text-xs font-bold text-amber-800">{coinData.silverContentGrams > 0 ? `${coinData.silverContentGrams.toFixed(2)}g` : "—"}</p>
                    </div>
                  </div>
                  {coinData.notes && <p className="text-[10px] text-orange-500">⚠️ {coinData.notes}</p>}
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
                  {cnyRef && (
                    <p className="text-[10px] text-gray-400 mt-1">
                      融通金參考：CNY¥{cnyRef}/克（國際現貨換算，僅供參考）
                    </p>
                  )}
                </div>

                {/* 商行銀價參考 */}
                {(() => {
                  const stores = hkPrices?.sources ?? [
                    { name: "LPM",   url: "https://www.lpm.hk/zh/precious-metals-prices/",           hkdPerGram: null as number | null },
                    { name: "三省",   url: "https://www.sam-sing.com.hk",                              hkdPerGram: null as number | null },
                    { name: "週生生", url: "https://www.chowsangsung.com/tc/goldsilverprice.aspx",     hkdPerGram: null as number | null },
                    { name: "週大福", url: "https://www.chowtaifook.com/hk/zh/precious-metal-price",   hkdPerGram: null as number | null },
                  ];
                  return (
                    <div className="border border-gray-100 rounded-xl overflow-hidden">
                      {/* header row */}
                      <div className="flex items-center justify-between px-3 py-2 bg-gray-50">
                        <p className="text-[11px] font-bold text-gray-600">商行銀價參考</p>
                        <button
                          onClick={fetchHKPrices}
                          disabled={loadingHK}
                          className="flex items-center gap-1 text-[10px] text-sky-600 hover:text-sky-800 disabled:opacity-50"
                        >
                          {loadingHK ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <RefreshCw className="w-2.5 h-2.5" />}
                          查詢現貨
                        </button>
                      </div>
                      {/* 現貨條 */}
                      {hkPrices?.spotHkdPerGram && (
                        <div className="px-3 py-1.5 bg-amber-50 border-b border-gray-100">
                          <p className="text-[10px] text-amber-700 font-semibold">
                            國際現貨：HK${hkPrices.spotHkdPerGram}/克（USD${hkPrices.spotUsdPerOz}/oz）
                          </p>
                        </div>
                      )}
                      {/* 商行列表（可伸縮） */}
                      <div className="divide-y divide-gray-100">
                        {stores.map((s) => {
                          const isOpen = expandedStore === s.name;
                          return (
                            <div key={s.name}>
                              <button
                                className="flex items-center justify-between w-full px-3 py-2.5 text-left"
                                onClick={() => setExpandedStore(isOpen ? null : s.name)}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="text-[11px] font-semibold text-gray-700">{s.name}</span>
                                  {s.hkdPerGram ? (
                                    <span className="text-[11px] font-bold text-amber-700">HK${s.hkdPerGram}/克</span>
                                  ) : (
                                    <span className="text-[10px] text-gray-400">請查看官網</span>
                                  )}
                                </div>
                                <ChevronDown className={`w-3 h-3 text-gray-400 shrink-0 ml-2 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                              </button>
                              {isOpen && (
                                <div className="px-3 pb-3 bg-gray-50 flex items-center justify-between">
                                  <p className="text-[10px] text-gray-500">官網可查閱最新回購及出售價格</p>
                                  <a href={s.url} target="_blank" rel="noopener noreferrer"
                                    className="text-[11px] font-semibold text-sky-600 hover:text-sky-800 shrink-0 ml-3"
                                  >
                                    前往官網 →
                                  </a>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      {!hkPrices && (
                        <p className="text-[10px] text-gray-400 px-3 pb-2.5 text-center">點「查詢現貨」取得國際銀價，商行官網以 JS 動態載入</p>
                      )}
                    </div>
                  );
                })()}

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

              {canCalc && (
                <div className="rounded-xl bg-gradient-to-br from-amber-50 to-yellow-50 border border-amber-200 p-4">
                  <p className="text-[10px] text-gray-500 mb-2">計算明細</p>
                  <p className="text-[11px] text-gray-500">
                    銀含量 {coinData?.silverContentGrams.toFixed(2)}g × HK${spotNum}/g = <span className="text-gray-700 font-semibold">HK${silverValue.toFixed(2)}</span>
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

          {/* ── 批量模式 ── */}
          {tab === "batch" && (
            <>
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
                  {cnyRef && (
                    <p className="text-[10px] text-gray-400">
                      融通金參考：CNY¥{cnyRef}/克（國際現貨換算）
                    </p>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={identifyAllBatch}
                      disabled={batchIdentifying || batch.every(i => i.status === "done")}
                      className="flex-1 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition disabled:opacity-60"
                    >
                      {batchIdentifying ? <Loader2 className="w-3 h-3 animate-spin" /> : "✨"} 全部識別
                    </button>
                    <button
                      onClick={saveAllBatch}
                      disabled={!batch.some(i => i.status === "done") || !spotNum || !discountNum}
                      className="flex-1 py-2 rounded-xl bg-green-500 hover:bg-green-600 text-white text-xs font-bold transition disabled:opacity-60"
                    >
                      📋 儲存全部報價
                    </button>
                    <button onClick={() => setBatch([])} className="px-3 py-2 rounded-xl border border-gray-200 text-gray-400 hover:text-red-500 text-xs transition">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="space-y-2">
                    {batch.map(item => {
                      const sc = item.result?.silverContentGrams ?? 0;
                      const itemOffer = sc * spotNum * (discountNum / 100);
                      return (
                        <div key={item.id} className="flex gap-3 p-3 rounded-xl border bg-gray-50 items-start">
                          <img src={item.preview} className="w-14 h-14 object-cover rounded-lg border shrink-0" alt="" />
                          <div className="flex-1 min-w-0">
                            {item.status === "pending" && <p className="text-xs text-gray-400">等待識別...</p>}
                            {item.status === "identifying" && <p className="text-xs text-amber-500 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> AI 識別中...</p>}
                            {item.status === "error" && <p className="text-xs text-red-500">識別失敗：{item.error}</p>}
                            {item.status === "done" && item.result && (
                              <>
                                <p className="text-xs font-semibold text-gray-800 truncate">{item.result.coinName}</p>
                                <p className="text-[10px] text-gray-500">{item.result.purityNote} · {item.result.silverContentGrams > 0 ? `${item.result.silverContentGrams.toFixed(2)}g 銀` : "重量未知"}</p>
                                {spotNum > 0 && discountNum > 0 && sc > 0 && (
                                  <p className="text-sm font-bold text-amber-700 mt-0.5">HK$ {itemOffer.toFixed(0)}</p>
                                )}
                              </>
                            )}
                          </div>
                          <div className="flex flex-col gap-1.5 shrink-0">
                            {(item.status === "pending" || item.status === "error") && (
                              <button
                                onClick={() => identifyBatchItem(item.id)}
                                disabled={batchIdentifying}
                                className="text-[10px] px-2 py-1 rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200 transition disabled:opacity-50 font-semibold"
                              >
                                識別
                              </button>
                            )}
                            <button onClick={() => setBatch(prev => prev.filter(i => i.id !== item.id))} className="text-[10px] px-2 py-1 rounded-lg bg-gray-100 text-gray-400 hover:bg-red-50 hover:text-red-500 transition">
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

          {/* ── 報價紀錄 ── */}
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
                    <button onClick={() => { localStorage.removeItem(HISTORY_KEY); setHistory([]); }} className="text-[10px] text-red-400 hover:text-red-600 flex items-center gap-0.5 transition">
                      <Trash2 className="w-3 h-3" /> 清除全部
                    </button>
                  </div>
                  <div className="space-y-2">
                    {history.map(h => (
                      <div key={h.id} className="flex gap-3 p-3 rounded-xl border bg-gray-50 items-center">
                        {h.imagePreview && <img src={h.imagePreview} className="w-12 h-12 object-cover rounded-lg border shrink-0" alt="" />}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-800 truncate">{h.coinName}</p>
                          <p className="text-[10px] text-gray-400">{new Date(h.timestamp).toLocaleString("zh-HK")}</p>
                          <p className="text-[10px] text-gray-500 mt-0.5">{h.silverContentGrams.toFixed(2)}g 銀 × HK${h.spotPrice}/g × {h.discount}%</p>
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
      </div>
    </>,
    document.body,
  );
}
