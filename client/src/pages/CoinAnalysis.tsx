import { useState, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import Header from "@/components/Header";
import { Link } from "wouter";
import { toast } from "sonner";
import {
  Upload, Sparkles, Loader2, ImageIcon, ChevronRight,
  Info, Palette, X, Download, ZoomIn,
} from "lucide-react";
import ImageLightbox from "@/components/ImageLightbox";

type AnalysisData = {
  type: string;
  name: string;
  country: string;
  year: string;
  denomination: string;
  material: string;
  dimensions: string;
  weight: string;
  condition: string;
  historicalBackground: string;
  rarity: string;
  estimatedValue: string;
  imageGenerationPrompt: string;
};

const LANG_LABELS: Record<string, Record<string, string>> = {
  zh: {
    pageTitle: "AI 錢幣 / 郵票鑑定",
    pageDesc: "上傳圖片，AI 即時分析歷史、成分、尺寸等資料，並可生成藝術插畫",
    uploadPrompt: "點擊或拖拉上傳圖片",
    uploadHint: "支援 JPG、PNG、WebP（最大 10MB）",
    analyze: "開始分析",
    analyzing: "分析中…",
    generateArt: "生成歷史藝術插畫",
    generating: "生成中…",
    loginRequired: "請先登入才可使用此功能",
    loginBtn: "立即登入",
    resultTitle: "鑑定結果",
    artTitle: "AI 藝術插畫",
    downloadArt: "下載插畫",
    labelType: "類型",
    labelName: "名稱",
    labelCountry: "發行國家/地區",
    labelYear: "發行年份",
    labelDenomination: "面額",
    labelMaterial: "材質/成分",
    labelDimensions: "尺寸",
    labelWeight: "重量",
    labelCondition: "品相",
    labelHistory: "歷史背景",
    labelRarity: "稀有程度",
    labelValue: "估計市值",
    langToggle: "EN",
    reanalyze: "重新分析",
  },
  en: {
    pageTitle: "AI Coin / Stamp Analysis",
    pageDesc: "Upload an image for instant AI analysis of history, composition, dimensions, and generate artistic illustrations",
    uploadPrompt: "Click or drag to upload image",
    uploadHint: "Supports JPG, PNG, WebP (max 10MB)",
    analyze: "Analyze",
    analyzing: "Analyzing…",
    generateArt: "Generate Historical Art",
    generating: "Generating…",
    loginRequired: "Please log in to use this feature",
    loginBtn: "Log In",
    resultTitle: "Analysis Result",
    artTitle: "AI Art Illustration",
    downloadArt: "Download",
    labelType: "Type",
    labelName: "Name",
    labelCountry: "Country/Region",
    labelYear: "Year",
    labelDenomination: "Denomination",
    labelMaterial: "Material",
    labelDimensions: "Dimensions",
    labelWeight: "Weight",
    labelCondition: "Condition",
    labelHistory: "Historical Background",
    labelRarity: "Rarity",
    labelValue: "Est. Market Value",
    langToggle: "中",
    reanalyze: "Re-analyze",
  },
};

export default function CoinAnalysis() {
  const { user } = useAuth();
  const [lang, setLang] = useState<"zh" | "en">("zh");
  const t = LANG_LABELS[lang];

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string>("");
  const [mimeType, setMimeType] = useState<string>("image/jpeg");
  const [dragOver, setDragOver] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [artLightboxOpen, setArtLightboxOpen] = useState(false);
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [artUrl, setArtUrl] = useState<string | null>(null);
  const [artUnavailable, setArtUnavailable] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const analyzeMutation = trpc.coinAnalysis.analyze.useMutation();
  const generateArtMutation = trpc.coinAnalysis.generateArt.useMutation();

  const loadFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("請上傳圖片檔案"); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error("圖片不可超過 10MB"); return; }
    setImageFile(file);
    setAnalysisData(null);
    setArtUrl(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setImagePreview(dataUrl);
      const base64 = dataUrl.split(",")[1];
      setImageBase64(base64);
      setMimeType(file.type);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) loadFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) loadFile(file);
  };

  const handleAnalyze = async () => {
    if (!imageBase64) return;
    setAnalysisData(null);
    setArtUrl(null);
    setArtUnavailable(false);
    try {
      const res = await analyzeMutation.mutateAsync({ imageBase64, mimeType, lang });
      if (res.success) setAnalysisData(res.data as AnalysisData);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "分析失敗，請重試";
      toast.error(msg);
    }
  };

  const handleGenerateArt = async () => {
    if (!analysisData?.imageGenerationPrompt) return;
    try {
      const res = await generateArtMutation.mutateAsync({
        prompt: analysisData.imageGenerationPrompt,
        imageBase64,
        mimeType,
      });
      if (res.success && res.imageUrl) setArtUrl(res.imageUrl);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "生成失敗，請重試";
      if (msg.includes("暫未開放")) {
        setArtUnavailable(true);
      } else {
        toast.error(msg);
      }
    }
  };

  const handleDownloadArt = () => {
    if (!artUrl) return;
    const a = document.createElement("a");
    a.href = artUrl;
    a.download = `coin-art-${Date.now()}.png`;
    a.target = "_blank";
    a.click();
  };

  const fields: Array<{ key: keyof typeof t; value: string | undefined }> = analysisData ? [
    { key: "labelType", value: analysisData.type },
    { key: "labelName", value: analysisData.name },
    { key: "labelCountry", value: analysisData.country },
    { key: "labelYear", value: analysisData.year },
    { key: "labelDenomination", value: analysisData.denomination },
    { key: "labelMaterial", value: analysisData.material },
    { key: "labelDimensions", value: analysisData.dimensions },
    { key: "labelWeight", value: analysisData.weight },
    { key: "labelCondition", value: analysisData.condition },
    { key: "labelRarity", value: analysisData.rarity },
    { key: "labelValue", value: analysisData.estimatedValue },
  ] : [];

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

        {/* 上傳區 */}
        <div
          className={`relative border-2 border-dashed rounded-2xl transition-colors cursor-pointer ${
            dragOver ? "border-amber-400 bg-amber-50" : "border-amber-200 bg-amber-50/50 hover:border-amber-300"
          }`}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

          {imagePreview ? (
            <div className="relative">
              <img
                src={imagePreview}
                alt="uploaded"
                className="w-full rounded-2xl object-contain max-h-72"
                style={{ pointerEvents: 'none' }}
              />
              {/* 換圖 / 放大按鈕 */}
              <div className="absolute top-2 right-2 flex gap-2">
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); setLightboxOpen(true); }}
                  className="w-8 h-8 bg-black/40 rounded-full flex items-center justify-center backdrop-blur-sm hover:bg-black/60 transition-colors"
                >
                  <ZoomIn className="w-4 h-4 text-white" />
                </button>
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); setImageFile(null); setImagePreview(null); setImageBase64(""); setAnalysisData(null); setArtUrl(null); }}
                  className="w-8 h-8 bg-black/40 rounded-full flex items-center justify-center backdrop-blur-sm hover:bg-black/60 transition-colors"
                >
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
            {analyzeMutation.isPending ? (
              <><Loader2 className="w-4 h-4 animate-spin" />{t.analyzing}</>
            ) : (
              <><Info className="w-4 h-4" />{analysisData ? t.reanalyze : t.analyze}</>
            )}
          </button>
        )}

        {/* 分析結果 */}
        {analysisData && (
          <div className="bg-white rounded-2xl border border-amber-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-amber-50 border-b border-amber-100 flex items-center gap-2">
              <Info className="w-4 h-4 text-amber-600" />
              <span className="font-bold text-amber-800 text-sm">{t.resultTitle}</span>
            </div>

            {/* 欄位列表 */}
            <div className="divide-y divide-gray-50">
              {fields.map(({ key, value }) => value && value !== "不詳" && value !== "Unknown" && (
                <div key={key} className="flex gap-3 px-4 py-2.5">
                  <span className="text-xs text-gray-400 w-20 shrink-0 pt-0.5">{t[key]}</span>
                  <span className="text-sm text-gray-800 font-medium flex-1">{value}</span>
                </div>
              ))}
            </div>

            {/* 歷史背景 */}
            {analysisData.historicalBackground && (
              <div className="px-4 pb-4 pt-2">
                <p className="text-xs text-gray-400 mb-1">{t.labelHistory}</p>
                <p className="text-sm text-gray-700 leading-relaxed">{analysisData.historicalBackground}</p>
              </div>
            )}

            {/* 生成藝術插畫按鈕 */}
            {!artUnavailable && (
              <div className="px-4 pb-4">
                <button
                  onClick={handleGenerateArt}
                  disabled={generateArtMutation.isPending}
                  className="w-full py-2.5 rounded-xl font-bold text-white transition-colors flex items-center justify-center gap-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:opacity-60"
                >
                  {generateArtMutation.isPending ? (
                    <><Loader2 className="w-4 h-4 animate-spin" />{t.generating}</>
                  ) : (
                    <><Palette className="w-4 h-4" />{t.generateArt}</>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* 藝術插畫結果 */}
        {artUrl && (
          <div className="bg-white rounded-2xl border border-purple-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-purple-50 border-b border-purple-100 flex items-center gap-2">
              <Palette className="w-4 h-4 text-purple-600" />
              <span className="font-bold text-purple-800 text-sm">{t.artTitle}</span>
            </div>
            <div
              className="relative cursor-zoom-in"
              onClick={() => setArtLightboxOpen(true)}
            >
              <img
                src={artUrl}
                alt="AI Art"
                className="w-full object-contain pointer-events-none"
                style={{ WebkitTouchCallout: 'none' }}
              />
              <div className="absolute top-2 right-2">
                <ZoomIn className="w-5 h-5 text-white drop-shadow-lg" />
              </div>
            </div>
            <div className="px-4 py-3">
              <button
                onClick={handleDownloadArt}
                className="w-full py-2.5 rounded-xl font-semibold text-purple-700 border border-purple-200 hover:bg-purple-50 transition-colors flex items-center justify-center gap-2 text-sm"
              >
                <Download className="w-4 h-4" />{t.downloadArt}
              </button>
            </div>
          </div>
        )}

        {/* 空白提示 */}
        {!imageBase64 && (
          <div className="text-center py-6">
            <div className="flex justify-center gap-6 text-gray-300 mb-4">
              <ImageIcon className="w-10 h-10" />
              <ChevronRight className="w-6 h-6 self-center" />
              <Sparkles className="w-10 h-10" />
              <ChevronRight className="w-6 h-6 self-center" />
              <Palette className="w-10 h-10" />
            </div>
            <p className="text-xs text-gray-400">上傳錢幣或郵票圖片，AI 即時鑑定 + 生成藝術插畫</p>
          </div>
        )}
      </div>

      {/* 燈箱：上傳圖片 */}
      {lightboxOpen && imagePreview && (
        <ImageLightbox
          images={[imagePreview]}
          initialIndex={0}
          onClose={() => setLightboxOpen(false)}
        />
      )}

      {/* 燈箱：藝術插畫 */}
      {artLightboxOpen && artUrl && (
        <ImageLightbox
          images={[artUrl]}
          initialIndex={0}
          alt="AI Art"
          onClose={() => setArtLightboxOpen(false)}
        />
      )}
    </div>
  );
}
