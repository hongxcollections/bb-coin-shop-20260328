import { useState, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import Header from "@/components/Header";
import { Link } from "wouter";
import { toast } from "sonner";
import {
  Upload, Sparkles, Loader2, ImageIcon, ChevronRight,
  Info, X, ZoomIn, Share2, History, FlaskConical,
  Trash2, Clock,
} from "lucide-react";
import ImageLightbox from "@/components/ImageLightbox";

type AnalysisData = {
  type?: string;
  name?: string;
  country?: string;
  year?: string;
  denomination?: string;
  material?: string;
  dimensions?: string;
  weight?: string;
  condition?: string;
  historicalBackground?: string;
  rarity?: string;
  estimatedValue?: string;
  imageGenerationPrompt?: string;
  // English keys fallback
  Type?: string; Name?: string; Country?: string; Year?: string;
  Denomination?: string; Material?: string; Dimensions?: string;
  Weight?: string; Condition?: string; "Historical Background"?: string;
  Rarity?: string; "Estimated Market Value"?: string;
};

type RelatedAuction = {
  id: number;
  title: string;
  currentPrice: number | null;
  startingPrice: number;
  currency: string;
  endTime: string;
  category: string | null;
  thumbUrl: string | null;
};

type HistoryItem = {
  id: number;
  coinName: string | null;
  coinType: string | null;
  coinCountry: string | null;
  analysisData: AnalysisData;
  createdAt: string;
};

const L = {
  zh: {
    pageTitle: "AI 錢幣 / 郵票鑑定",
    pageDesc: "上傳圖片，AI 即時分析歷史、成分、尺寸等資料",
    uploadPrompt: "點擊或拖拉上傳圖片",
    uploadHint: "支援 JPG、PNG、WebP（最大 10MB）",
    analyze: "開始分析",
    analyzing: "分析中…",
    loginRequired: "請先登入才可使用此功能",
    loginBtn: "立即登入",
    resultTitle: "鑑定結果",
    shareCard: "生成分享卡片",
    relatedTitle: "站內相關拍賣",
    noRelated: "暫無相關拍賣",
    historyTab: "歷史記錄",
    analyzeTab: "AI 鑑定",
    emptyHistory: "未有鑑定記錄",
    deleteConfirm: "刪除此記錄？",
    reanalyze: "重新分析",
    langToggle: "EN",
    labelType: "類型", labelName: "名稱", labelCountry: "發行地區",
    labelYear: "年份", labelDenomination: "面額", labelMaterial: "材質",
    labelDimensions: "尺寸", labelWeight: "重量", labelCondition: "品相",
    labelHistory: "歷史背景", labelRarity: "稀有程度", labelValue: "估計市值",
    bidNow: "立即競投",
    startingAt: "起標",
    currentBid: "現時出價",
  },
  en: {
    pageTitle: "AI Coin / Stamp Analysis",
    pageDesc: "Upload an image for instant AI analysis",
    uploadPrompt: "Click or drag to upload",
    uploadHint: "JPG, PNG, WebP (max 10MB)",
    analyze: "Analyze",
    analyzing: "Analyzing…",
    loginRequired: "Please log in to use this feature",
    loginBtn: "Log In",
    resultTitle: "Analysis Result",
    shareCard: "Share Card",
    relatedTitle: "Related Auctions",
    noRelated: "No related auctions",
    historyTab: "History",
    analyzeTab: "Analyze",
    emptyHistory: "No analysis history",
    deleteConfirm: "Delete this record?",
    reanalyze: "Re-analyze",
    langToggle: "中",
    labelType: "Type", labelName: "Name", labelCountry: "Country",
    labelYear: "Year", labelDenomination: "Denomination", labelMaterial: "Material",
    labelDimensions: "Dimensions", labelWeight: "Weight", labelCondition: "Condition",
    labelHistory: "Historical Background", labelRarity: "Rarity", labelValue: "Est. Value",
    bidNow: "Bid Now",
    startingAt: "Starting",
    currentBid: "Current Bid",
  },
};

function getField(d: AnalysisData, zh: string, en: string): string {
  return (d as Record<string, string>)[zh] || (d as Record<string, string>)[en] || "";
}

// ─── Canvas card generator ────────────────────────────────────────────────────
async function generateShareCard(data: AnalysisData, imagePreview: string | null, lang: "zh" | "en"): Promise<void> {
  const W = 800, H = 460;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, "#1a1a2e");
  grad.addColorStop(0.5, "#16213e");
  grad.addColorStop(1, "#0f3460");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Gold accent bar top
  const goldGrad = ctx.createLinearGradient(0, 0, W, 0);
  goldGrad.addColorStop(0, "#b8860b");
  goldGrad.addColorStop(0.5, "#ffd700");
  goldGrad.addColorStop(1, "#b8860b");
  ctx.fillStyle = goldGrad;
  ctx.fillRect(0, 0, W, 4);

  // Subtle grid pattern
  ctx.strokeStyle = "rgba(255,215,0,0.04)";
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

  // Coin image (left side)
  const IMG_SIZE = 200;
  const imgX = 40, imgY = (H - IMG_SIZE) / 2;

  if (imagePreview) {
    try {
      const img = await new Promise<HTMLImageElement>((res, rej) => {
        const el = new Image();
        el.onload = () => res(el);
        el.onerror = rej;
        el.src = imagePreview;
      });
      ctx.save();
      ctx.beginPath();
      ctx.arc(imgX + IMG_SIZE / 2, imgY + IMG_SIZE / 2, IMG_SIZE / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(img, imgX, imgY, IMG_SIZE, IMG_SIZE);
      ctx.restore();
      // Circle border
      ctx.strokeStyle = "#ffd700";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(imgX + IMG_SIZE / 2, imgY + IMG_SIZE / 2, IMG_SIZE / 2, 0, Math.PI * 2);
      ctx.stroke();
    } catch { /* skip image */ }
  }

  // Content area (right side)
  const cx = imagePreview ? imgX + IMG_SIZE + 32 : 40;
  const cw = W - cx - 30;

  // Site name
  ctx.font = "bold 16px sans-serif";
  ctx.fillStyle = "#ffd700";
  ctx.fillText("大BB錢幣店 · hongxcollections.com", cx, 38);

  // AI badge
  ctx.fillStyle = "rgba(255,215,0,0.15)";
  ctx.beginPath(); ctx.roundRect(cx, 48, 90, 22, 4); ctx.fill();
  ctx.fillStyle = "#ffd700";
  ctx.font = "bold 12px sans-serif";
  ctx.fillText("✦ AI 鑑定結果", cx + 8, 63);

  // Coin name (big)
  const coinName = getField(data, "name", "Name") || "未知";
  ctx.font = "bold 28px sans-serif";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(coinName.length > 18 ? coinName.slice(0, 17) + "…" : coinName, cx, 106);

  // Divider
  ctx.fillStyle = "rgba(255,215,0,0.3)";
  ctx.fillRect(cx, 116, cw, 1);

  // Fields
  const fields: [string, string, string][] = [
    ["類型", "type", "Type"],
    ["發行地區", "country", "Country"],
    ["年份", "year", "Year"],
    ["面額", "denomination", "Denomination"],
    ["材質", "material", "Material"],
    ["品相", "condition", "Condition"],
    ["估計市值", "estimatedValue", "Estimated Market Value"],
  ];

  let fy = 140;
  ctx.font = "14px sans-serif";
  for (const [label, zh, en] of fields) {
    const val = getField(data, zh, en);
    if (!val || val === "不詳" || val === "Unknown") continue;
    ctx.fillStyle = "rgba(255,215,0,0.7)";
    ctx.fillText(label, cx, fy);
    ctx.fillStyle = "#e8e8e8";
    const dispVal = val.length > 28 ? val.slice(0, 27) + "…" : val;
    ctx.fillText(dispVal, cx + 72, fy);
    fy += 22;
    if (fy > H - 60) break;
  }

  // Historical snippet
  const hist = getField(data, "historicalBackground", "Historical Background");
  if (hist && fy < H - 60) {
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "italic 12px sans-serif";
    const truncHist = hist.length > 80 ? hist.slice(0, 79) + "…" : hist;
    ctx.fillText(truncHist, cx, fy + 4);
  }

  // Bottom watermark
  ctx.fillStyle = goldGrad;
  ctx.fillRect(0, H - 4, W, 4);
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.font = "11px sans-serif";
  ctx.fillText("由 AI 自動生成，僅供參考，不構成投資建議", cx, H - 14);

  // Download
  const link = document.createElement("a");
  link.download = `coin-analysis-${Date.now()}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

// ─── Related Auction Card ─────────────────────────────────────────────────────
function RelatedAuctionCard({ a, t }: { a: RelatedAuction; t: typeof L.zh }) {
  const price = a.currentPrice ?? a.startingPrice;
  const isCurrent = !!a.currentPrice;
  return (
    <Link href={`/auction/${a.id}`}>
      <div className="flex gap-2 p-2 rounded-xl border border-amber-100 hover:border-amber-300 bg-white hover:bg-amber-50/40 transition-all cursor-pointer">
        <div className="w-14 h-14 rounded-lg overflow-hidden bg-amber-50 shrink-0">
          {a.thumbUrl
            ? <img src={a.thumbUrl} alt={a.title} className="w-full h-full object-cover" />
            : <div className="w-full h-full flex items-center justify-center text-amber-300"><ImageIcon className="w-5 h-5" /></div>
          }
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-gray-800 leading-snug line-clamp-2">{a.title}</p>
          <p className="text-xs text-amber-600 font-bold mt-0.5">
            {isCurrent ? t.currentBid : t.startingAt} {a.currency} {Number(price).toLocaleString()}
          </p>
        </div>
        <div className="flex items-center shrink-0">
          <ChevronRight className="w-3.5 h-3.5 text-amber-400" />
        </div>
      </div>
    </Link>
  );
}

// ─── History Item Card ────────────────────────────────────────────────────────
function HistoryCard({ item, onDelete, onExpand, t }: {
  item: HistoryItem;
  onDelete: (id: number) => void;
  onExpand: (data: AnalysisData) => void;
  t: typeof L.zh;
}) {
  const d = item.analysisData;
  const name = item.coinName || getField(d, "name", "Name") || "未知";
  const country = item.coinCountry || getField(d, "country", "Country") || "";
  const year = getField(d, "year", "Year") || "";
  const value = getField(d, "estimatedValue", "Estimated Market Value") || "";
  const date = new Date(item.createdAt).toLocaleDateString("zh-HK", { month: "short", day: "numeric", year: "numeric" });

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 px-3 py-2.5">
        <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
          <Sparkles className="w-4 h-4 text-amber-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800 truncate">{name}</p>
          <p className="text-xs text-gray-400">{[country, year].filter(Boolean).join(" · ")}{value ? ` · ${value}` : ""}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-xs text-gray-400 hidden sm:block">{date}</span>
          <button
            onClick={() => onExpand(d)}
            className="w-7 h-7 rounded-full bg-amber-50 flex items-center justify-center hover:bg-amber-100 transition-colors"
          >
            <ZoomIn className="w-3.5 h-3.5 text-amber-600" />
          </button>
          <button
            onClick={() => { if (confirm(t.deleteConfirm)) onDelete(item.id); }}
            className="w-7 h-7 rounded-full bg-red-50 flex items-center justify-center hover:bg-red-100 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5 text-red-400" />
          </button>
        </div>
      </div>
      <div className="px-3 pb-1.5 flex items-center gap-1.5">
        <Clock className="w-3 h-3 text-gray-300" />
        <span className="text-xs text-gray-300">{date}</span>
      </div>
    </div>
  );
}

// ─── Analysis Result Panel ────────────────────────────────────────────────────
function AnalysisResult({ data, t, lang, imagePreview, relatedAuctions, loadingRelated }: {
  data: AnalysisData;
  t: typeof L.zh;
  lang: "zh" | "en";
  imagePreview: string | null;
  relatedAuctions: RelatedAuction[];
  loadingRelated: boolean;
}) {
  const [generating, setGenerating] = useState(false);

  const fields: [string, string, string][] = [
    [t.labelType, "type", "Type"],
    [t.labelName, "name", "Name"],
    [t.labelCountry, "country", "Country"],
    [t.labelYear, "year", "Year"],
    [t.labelDenomination, "denomination", "Denomination"],
    [t.labelMaterial, "material", "Material"],
    [t.labelDimensions, "dimensions", "Dimensions"],
    [t.labelWeight, "weight", "Weight"],
    [t.labelCondition, "condition", "Condition"],
    [t.labelRarity, "rarity", "Rarity"],
    [t.labelValue, "estimatedValue", "Estimated Market Value"],
  ];

  const handleShareCard = async () => {
    setGenerating(true);
    try {
      await generateShareCard(data, imagePreview, lang);
    } catch {
      toast.error("生成失敗，請重試");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* 鑑定結果卡 */}
      <div className="bg-white rounded-2xl border border-amber-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 bg-amber-50 border-b border-amber-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-amber-600" />
            <span className="font-bold text-amber-800 text-sm">{t.resultTitle}</span>
          </div>
          <button
            onClick={handleShareCard}
            disabled={generating}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:opacity-90 transition-opacity disabled:opacity-60"
          >
            {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Share2 className="w-3 h-3" />}
            {t.shareCard}
          </button>
        </div>

        <div className="divide-y divide-gray-50">
          {fields.map(([label, zh, en]) => {
            const val = getField(data, zh, en);
            if (!val || val === "不詳" || val === "Unknown") return null;
            return (
              <div key={zh} className="flex gap-3 px-4 py-2.5">
                <span className="text-xs text-gray-400 w-20 shrink-0 pt-0.5">{label}</span>
                <span className="text-sm text-gray-800 font-medium flex-1">{val}</span>
              </div>
            );
          })}
        </div>

        {getField(data, "historicalBackground", "Historical Background") && (
          <div className="px-4 pb-4 pt-2">
            <p className="text-xs text-gray-400 mb-1">{t.labelHistory}</p>
            <p className="text-sm text-gray-700 leading-relaxed">{getField(data, "historicalBackground", "Historical Background")}</p>
          </div>
        )}
      </div>

      {/* 相關拍賣 */}
      <div className="bg-white rounded-2xl border border-amber-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 bg-amber-50 border-b border-amber-100 flex items-center gap-2">
          <FlaskConical className="w-4 h-4 text-amber-600" />
          <span className="font-bold text-amber-800 text-sm">{t.relatedTitle}</span>
        </div>
        {loadingRelated ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />
          </div>
        ) : relatedAuctions.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-5">{t.noRelated}</p>
        ) : (
          <div className="p-3 space-y-2">
            {relatedAuctions.map(a => <RelatedAuctionCard key={a.id} a={a} t={t} />)}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CoinAnalysis() {
  const { user } = useAuth();
  const [lang, setLang] = useState<"zh" | "en">("zh");
  const t = L[lang];

  const [tab, setTab] = useState<"analyze" | "history">("analyze");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string>("");
  const [mimeType, setMimeType] = useState<string>("image/jpeg");
  const [dragOver, setDragOver] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [relatedAuctions, setRelatedAuctions] = useState<RelatedAuction[]>([]);
  const [loadingRelated, setLoadingRelated] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const analyzeMutation = trpc.coinAnalysis.analyze.useMutation();

  const historyQuery = trpc.coinAnalysis.history.list.useQuery(
    { limit: 30 },
    { enabled: tab === "history" && !!user }
  );
  const deleteHistoryMutation = trpc.coinAnalysis.history.delete.useMutation({
    onSuccess: () => historyQuery.refetch(),
  });

  const loadFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("請上傳圖片檔案"); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error("圖片不可超過 10MB"); return; }
    setImageFile(file);
    setAnalysisData(null);
    setRelatedAuctions([]);
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setImagePreview(dataUrl);
      setImageBase64(dataUrl.split(",")[1]);
      setMimeType(file.type);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleAnalyze = async () => {
    if (!imageBase64) return;
    setAnalysisData(null);
    setRelatedAuctions([]);
    try {
      const res = await analyzeMutation.mutateAsync({ imageBase64, mimeType, lang });
      if (res.success) {
        const data = res.data as AnalysisData;
        setAnalysisData(data);
        // 搜尋相關拍賣
        const keywords = [
          getField(data, "name", "Name"),
          getField(data, "country", "Country"),
          getField(data, "type", "Type"),
        ].filter(Boolean);
        if (keywords.length > 0) {
          setLoadingRelated(true);
          // Use direct mutation approach since we have dynamic keywords
          fetchRelatedAuctions(keywords);
        }
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "分析失敗，請重試");
    }
  };

  const utils = trpc.useUtils();
  const fetchRelatedAuctions = async (keywords: string[]) => {
    try {
      const results = await utils.coinAnalysis.searchRelated.fetch({ keywords });
      setRelatedAuctions(results as RelatedAuction[]);
    } catch {
      setRelatedAuctions([]);
    } finally {
      setLoadingRelated(false);
    }
  };

  const handleExpandHistory = (data: AnalysisData) => {
    setAnalysisData(data);
    setImagePreview(null);
    setRelatedAuctions([]);
    setLoadingRelated(true);
    const keywords = [
      getField(data, "name", "Name"),
      getField(data, "country", "Country"),
      getField(data, "type", "Type"),
    ].filter(Boolean);
    fetchRelatedAuctions(keywords);
    setTab("analyze");
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex flex-col items-center justify-center py-32 gap-4 px-6 text-center">
          <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mb-2">
            <Sparkles className="w-8 h-8 text-amber-500" />
          </div>
          <h2 className="text-lg font-bold text-gray-800">{t.pageTitle}</h2>
          <p className="text-gray-500 text-sm max-w-xs">{t.loginRequired}</p>
          <Link href="/login" className="mt-2 bg-amber-500 hover:bg-amber-600 text-white font-semibold px-6 py-2.5 rounded-xl transition-colors">
            {t.loginBtn}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-28">
      <Header />
      <div className="max-w-lg mx-auto px-4 pt-4 space-y-4">

        {/* 標題列 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              {t.pageTitle}
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">{t.pageDesc}</p>
          </div>
          <button
            onClick={() => setLang(l => l === "zh" ? "en" : "zh")}
            className="text-xs font-semibold px-3 py-1.5 rounded-full border border-amber-200 text-amber-700 hover:bg-amber-50 transition-colors"
          >
            {t.langToggle}
          </button>
        </div>

        {/* Tab 切換 */}
        <div className="flex rounded-xl bg-gray-100 p-1 gap-1">
          {(["analyze", "history"] as const).map(tabKey => (
            <button
              key={tabKey}
              onClick={() => setTab(tabKey)}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-1.5 ${
                tab === tabKey
                  ? "bg-white text-amber-700 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tabKey === "analyze" ? <FlaskConical className="w-3.5 h-3.5" /> : <History className="w-3.5 h-3.5" />}
              {tabKey === "analyze" ? t.analyzeTab : t.historyTab}
            </button>
          ))}
        </div>

        {/* ── 分析 Tab ── */}
        {tab === "analyze" && (
          <>
            {/* 上傳區 */}
            <div
              className={`relative border-2 border-dashed rounded-2xl transition-colors cursor-pointer ${
                dragOver ? "border-amber-400 bg-amber-50" : "border-amber-200 bg-amber-50/50 hover:border-amber-300"
              }`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) loadFile(f); }}
            >
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) loadFile(f); }} />
              {imagePreview ? (
                <div className="relative">
                  <img src={imagePreview} alt="uploaded" className="w-full rounded-2xl object-contain max-h-72" style={{ pointerEvents: "none" }} />
                  <div className="absolute top-2 right-2 flex gap-2">
                    <button type="button" onClick={e => { e.stopPropagation(); setLightboxOpen(true); }}
                      className="w-8 h-8 bg-black/40 rounded-full flex items-center justify-center backdrop-blur-sm hover:bg-black/60 transition-colors">
                      <ZoomIn className="w-4 h-4 text-white" />
                    </button>
                    <button type="button" onClick={e => { e.stopPropagation(); setImageFile(null); setImagePreview(null); setImageBase64(""); setAnalysisData(null); setRelatedAuctions([]); }}
                      className="w-8 h-8 bg-black/40 rounded-full flex items-center justify-center backdrop-blur-sm hover:bg-black/60 transition-colors">
                      <X className="w-4 h-4 text-white" />
                    </button>
                  </div>
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/40 text-white text-xs px-3 py-1 rounded-full backdrop-blur-sm pointer-events-none">
                    {imageFile?.name}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center">
                    <Upload className="w-6 h-6 text-amber-500" />
                  </div>
                  <p className="font-semibold text-gray-700 text-sm">{t.uploadPrompt}</p>
                  <p className="text-xs text-gray-400">{t.uploadHint}</p>
                </div>
              )}
            </div>

            {/* 分析按鈕 */}
            {imageBase64 && (
              <button
                onClick={handleAnalyze}
                disabled={analyzeMutation.isPending}
                className="w-full py-3 rounded-xl font-bold text-white transition-colors flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-60"
              >
                {analyzeMutation.isPending
                  ? <><Loader2 className="w-4 h-4 animate-spin" />{t.analyzing}</>
                  : <><Info className="w-4 h-4" />{analysisData ? t.reanalyze : t.analyze}</>
                }
              </button>
            )}

            {/* 結果 + 相關拍賣 */}
            {analysisData && (
              <AnalysisResult
                data={analysisData}
                t={t}
                lang={lang}
                imagePreview={imagePreview}
                relatedAuctions={relatedAuctions}
                loadingRelated={loadingRelated}
              />
            )}

            {/* 空白提示 */}
            {!imageBase64 && !analysisData && (
              <div className="text-center py-6">
                <div className="flex justify-center gap-6 text-gray-300 mb-4">
                  <ImageIcon className="w-10 h-10" />
                  <ChevronRight className="w-6 h-6 self-center" />
                  <Sparkles className="w-10 h-10" />
                  <ChevronRight className="w-6 h-6 self-center" />
                  <Share2 className="w-10 h-10" />
                </div>
                <p className="text-xs text-gray-400">上傳錢幣或郵票圖片，AI 即時鑑定 + 搜尋相關拍賣 + 生成分享卡片</p>
              </div>
            )}
          </>
        )}

        {/* ── 歷史記錄 Tab ── */}
        {tab === "history" && (
          <div className="space-y-2">
            {historyQuery.isLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
              </div>
            ) : !historyQuery.data || historyQuery.data.length === 0 ? (
              <div className="text-center py-12">
                <History className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-gray-400">{t.emptyHistory}</p>
                <button onClick={() => setTab("analyze")} className="mt-3 text-amber-600 text-sm font-semibold hover:underline">
                  {t.analyzeTab} →
                </button>
              </div>
            ) : (
              (historyQuery.data as HistoryItem[]).map(item => (
                <HistoryCard
                  key={item.id}
                  item={item}
                  t={t}
                  onDelete={id => deleteHistoryMutation.mutate({ id })}
                  onExpand={handleExpandHistory}
                />
              ))
            )}
          </div>
        )}
      </div>

      {/* 燈箱 */}
      {lightboxOpen && imagePreview && (
        <ImageLightbox images={[imagePreview]} initialIndex={0} onClose={() => setLightboxOpen(false)} />
      )}
    </div>
  );
}
