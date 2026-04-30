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

// ─── Canvas helpers ───────────────────────────────────────────────────────────
function wrapText(c: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number): number {
  let line = "", curY = y;
  for (const ch of text) {
    const test = line + ch;
    if (c.measureText(test).width > maxW && line.length > 0) {
      c.fillText(line, x, curY);
      line = ch; curY += lh;
    } else { line = test; }
  }
  if (line) { c.fillText(line, x, curY); curY += lh; }
  return curY;
}

// ─── Canvas card generator ────────────────────────────────────────────────────
async function generateShareCard(data: AnalysisData, imagePreview: string | null): Promise<void> {
  // ── Dimensions ──
  const W = 860, H = 460;
  const IMG_PANEL = 260;   // left image panel width
  const R_PAD = 28;        // right section horizontal padding
  const RX = IMG_PANEL + R_PAD;  // right content start x
  const RW = W - RX - R_PAD;     // right content width

  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const c = canvas.getContext("2d")!;

  // ── Gold gradient helper ──
  const gold = (x0: number, x1: number) => {
    const g = c.createLinearGradient(x0, 0, x1, 0);
    g.addColorStop(0, "#b45309"); g.addColorStop(0.4, "#f59e0b");
    g.addColorStop(0.6, "#fbbf24"); g.addColorStop(1, "#d97706");
    return g;
  };

  // ── Full background: site dark brown ──
  c.fillStyle = "#1c1917";
  c.fillRect(0, 0, W, H);

  // Subtle dot texture
  c.fillStyle = "rgba(180,83,9,0.07)";
  for (let tx = 0; tx < W; tx += 20)
    for (let ty = 0; ty < H; ty += 20)
      c.fillRect(tx, ty, 1.2, 1.2);

  // ── Left image panel ──
  const panelGrad = c.createLinearGradient(0, 0, IMG_PANEL, 0);
  panelGrad.addColorStop(0, "#292118"); panelGrad.addColorStop(1, "#1c1917");
  c.fillStyle = panelGrad;
  c.fillRect(0, 0, IMG_PANEL, H);

  // Amber glow behind image
  const glow = c.createRadialGradient(IMG_PANEL / 2, H / 2, 20, IMG_PANEL / 2, H / 2, 130);
  glow.addColorStop(0, "rgba(245,158,11,0.18)"); glow.addColorStop(1, "transparent");
  c.fillStyle = glow;
  c.fillRect(0, 0, IMG_PANEL, H);

  // Vertical gold separator line
  const sepGrad = c.createLinearGradient(0, 0, 0, H);
  sepGrad.addColorStop(0, "transparent"); sepGrad.addColorStop(0.3, "#f59e0b");
  sepGrad.addColorStop(0.7, "#f59e0b"); sepGrad.addColorStop(1, "transparent");
  c.strokeStyle = sepGrad; c.lineWidth = 1.5;
  c.beginPath(); c.moveTo(IMG_PANEL, 0); c.lineTo(IMG_PANEL, H); c.stroke();

  // ── Coin image ──
  const IMG_R = 100;
  const ICX = IMG_PANEL / 2, ICY = H / 2 + 10;
  if (imagePreview) {
    try {
      const img = await new Promise<HTMLImageElement>((res, rej) => {
        const el = new Image(); el.onload = () => res(el); el.onerror = rej; el.src = imagePreview;
      });
      c.shadowColor = "rgba(245,158,11,0.4)"; c.shadowBlur = 24;
      c.save();
      c.beginPath(); c.arc(ICX, ICY, IMG_R, 0, Math.PI * 2); c.clip();
      c.drawImage(img, ICX - IMG_R, ICY - IMG_R, IMG_R * 2, IMG_R * 2);
      c.restore();
      c.shadowColor = "transparent"; c.shadowBlur = 0;
      // Gold ring
      c.strokeStyle = gold(ICX - IMG_R, ICX + IMG_R); c.lineWidth = 3;
      c.beginPath(); c.arc(ICX, ICY, IMG_R + 1, 0, Math.PI * 2); c.stroke();
      // Outer halo ring
      c.strokeStyle = "rgba(245,158,11,0.25)"; c.lineWidth = 1;
      c.beginPath(); c.arc(ICX, ICY, IMG_R + 9, 0, Math.PI * 2); c.stroke();
    } catch { /* skip */ }
  } else {
    // placeholder circle
    c.strokeStyle = "rgba(245,158,11,0.3)"; c.lineWidth = 2;
    c.beginPath(); c.arc(ICX, ICY, IMG_R, 0, Math.PI * 2); c.stroke();
  }

  // ── Top gold bar ──
  c.fillStyle = gold(0, W);
  c.fillRect(0, 0, W, 5);

  // ── Right content ──
  let y = 32;

  // AI badge
  c.font = "11px sans-serif";
  const badge = "✦ AI 鑑定結果";
  const bw = c.measureText(badge).width + 20;
  c.fillStyle = "rgba(245,158,11,0.15)";
  c.strokeStyle = "rgba(245,158,11,0.5)"; c.lineWidth = 1;
  c.beginPath(); c.rect(RX, y - 12, bw, 20); c.fill(); c.stroke();
  c.fillStyle = "#fbbf24"; c.textAlign = "left";
  c.fillText(badge, RX + 10, y);
  y += 26;

  // Coin name
  const coinName = getField(data, "name", "Name") || "未知";
  c.font = "bold 28px sans-serif";
  c.fillStyle = "#fef3c7";
  const dispName = coinName.length > 22 ? coinName.slice(0, 21) + "…" : coinName;
  c.fillText(dispName, RX, y);
  y += 10;

  // Divider
  const divG = c.createLinearGradient(RX, 0, RX + RW, 0);
  divG.addColorStop(0, "#f59e0b"); divG.addColorStop(1, "transparent");
  c.fillStyle = divG; c.fillRect(RX, y, RW, 1);
  y += 16;

  // ── Fields (2-column grid) ──
  const fieldDefs: [string, string, string][] = [
    ["類型", "type", "Type"], ["發行地區", "country", "Country"],
    ["年份", "year", "Year"], ["面額", "denomination", "Denomination"],
    ["材質", "material", "Material"], ["尺寸", "dimensions", "Dimensions"],
    ["重量", "weight", "Weight"], ["品相", "condition", "Condition"],
    ["稀有程度", "rarity", "Rarity"], ["估計市值", "estimatedValue", "Estimated Market Value"],
  ];
  const activeFields = fieldDefs
    .map(([label, zh, en]) => ({ label, val: getField(data, zh, en) }))
    .filter(f => f.val && f.val !== "不詳" && f.val !== "Unknown");

  const ROW_H = 26;
  const colHalf = Math.floor(RW / 2);
  const col2X = RX + colHalf + 8;
  const LABEL_W = 52;

  for (let i = 0; i < activeFields.length; i += 2) {
    const rowY = y + Math.floor(i / 2) * ROW_H;
    // Alternating row bg
    if (Math.floor(i / 2) % 2 === 0) {
      c.fillStyle = "rgba(245,158,11,0.04)";
      c.fillRect(RX - 4, rowY - 16, RW + 8, ROW_H);
    }
    // Left
    c.fillStyle = "rgba(251,191,36,0.7)"; c.font = "11px sans-serif";
    c.fillText(activeFields[i].label, RX, rowY);
    c.fillStyle = "#fef3c7"; c.font = "bold 12px sans-serif";
    const v1 = activeFields[i].val.length > 14 ? activeFields[i].val.slice(0, 13) + "…" : activeFields[i].val;
    c.fillText(v1, RX + LABEL_W, rowY);
    // Right
    if (i + 1 < activeFields.length) {
      c.fillStyle = "rgba(251,191,36,0.7)"; c.font = "11px sans-serif";
      c.fillText(activeFields[i + 1].label, col2X, rowY);
      c.fillStyle = "#fef3c7"; c.font = "bold 12px sans-serif";
      const v2 = activeFields[i + 1].val.length > 14 ? activeFields[i + 1].val.slice(0, 13) + "…" : activeFields[i + 1].val;
      c.fillText(v2, col2X + LABEL_W, rowY);
    }
  }
  y += Math.ceil(activeFields.length / 2) * ROW_H + 8;

  // ── Historical background ──
  const hist = getField(data, "historicalBackground", "Historical Background");
  if (hist && y < H - 40) {
    // Thin separator
    c.fillStyle = "rgba(245,158,11,0.15)"; c.fillRect(RX, y, RW, 1);
    y += 12;
    c.fillStyle = "rgba(251,191,36,0.6)"; c.font = "11px sans-serif";
    c.fillText("歷史背景", RX, y); y += 16;
    c.fillStyle = "#d6d3d1"; c.font = "12px sans-serif";
    y = wrapText(c, hist, RX, y, RW, 20);
  }

  // ── Bottom bar ──
  c.fillStyle = gold(0, W); c.fillRect(0, H - 5, W, 5);

  // Disclaimer
  c.fillStyle = "rgba(214,211,209,0.3)"; c.font = "10px sans-serif"; c.textAlign = "right";
  c.fillText("AI 自動生成，僅供參考", W - R_PAD, H - 10);

  // ── Download ──
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
      await generateShareCard(data, imagePreview);
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
  const [debugError, setDebugError] = useState<string | null>(null);
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
    setDebugError(null);
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
    setDebugError(null);
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
      const raw = e instanceof Error ? e.message : "未知錯誤";
      setDebugError(raw);
      toast.error("分析失敗，詳情見下方", { duration: 5000 });
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

            {/* 調試面板：顯示每個模型的詳細錯誤 */}
            {debugError && (
              <div style={{ background: "#1c1917", border: "1px solid #78350f", borderRadius: 12, padding: "12px 14px", marginTop: 8 }}>
                <div style={{ color: "#fbbf24", fontWeight: 700, fontSize: 13, marginBottom: 6 }}>🔍 調試資訊（每個模型的錯誤）：</div>
                <div style={{ color: "#fcd34d", fontSize: 11, lineHeight: 1.7, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                  {debugError.replace(/[|]/g, "\n")}
                </div>
                <button
                  onClick={() => setDebugError(null)}
                  style={{ marginTop: 8, fontSize: 11, color: "#9ca3af", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                >
                  關閉
                </button>
              </div>
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
