import { useState, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import Header from "@/components/Header";
import { toast } from "sonner";
import { Upload, Loader2, Search, ChevronLeft, Zap, ExternalLink } from "lucide-react";

type PokeResult = {
  cardName?: string;
  cardNameJa?: string;
  set?: string;
  setNumber?: string;
  rarity?: string;
  hp?: number | null;
  types?: string[];
  attacks?: Array<{ name: string; damage?: string | null; cost?: string[] }>;
  releaseYear?: string;
  language?: string;
  condition?: string;
  conditionNote?: string;
  marketPriceHKD?: number | null;
  psa9HKD?: number | null;
  psa10HKD?: number | null;
  gradeEstimate?: number | null;
  worthGrading?: boolean;
  ebaySearchQuery?: string;
  funFact?: string;
  isNotPokemon?: boolean;
};

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  Fire:       { bg: "#FF4422", text: "#fff" },
  Water:      { bg: "#3399FF", text: "#fff" },
  Grass:      { bg: "#5DAA33", text: "#fff" },
  Lightning:  { bg: "#F8D030", text: "#333" },
  Psychic:    { bg: "#F85888", text: "#fff" },
  Fighting:   { bg: "#C03028", text: "#fff" },
  Darkness:   { bg: "#705848", text: "#fff" },
  Metal:      { bg: "#B8B8D0", text: "#333" },
  Dragon:     { bg: "#7038F8", text: "#fff" },
  Colorless:  { bg: "#A8A878", text: "#fff" },
  default:    { bg: "#888", text: "#fff" },
};

const RARITY_COLOR: Record<string, string> = {
  "Common": "#aaa",
  "Uncommon": "#4CAF50",
  "Rare": "#2196F3",
  "Holo Rare": "#9C27B0",
  "Ultra Rare": "#FF9800",
  "Secret Rare": "#f44336",
  "Promo": "#E91E63",
};

const PSA_FEE_HKD = 420;

function TypeBadge({ type }: { type: string }) {
  const c = TYPE_COLORS[type] ?? TYPE_COLORS.default;
  return (
    <span
      className="inline-block text-xs font-bold px-2.5 py-0.5 rounded-full"
      style={{ background: c.bg, color: c.text }}
    >
      {type}
    </span>
  );
}

function PokeBallUpload({ onFile, disabled }: { onFile: (f: File) => void; disabled: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f && f.type.startsWith("image/")) onFile(f);
  }, [onFile]);

  return (
    <div
      className="flex flex-col items-center gap-4 cursor-pointer"
      onClick={() => !disabled && ref.current?.click()}
      onDrop={handleDrop}
      onDragOver={e => e.preventDefault()}
    >
      <div
        className="relative flex items-center justify-center select-none"
        style={{ width: 160, height: 160 }}
      >
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: "linear-gradient(to bottom, #CC0000 50%, #f5f5f5 50%)",
            border: "5px solid #222",
            boxShadow: "0 8px 32px rgba(204,0,0,0.4), 0 2px 8px rgba(0,0,0,0.5)",
          }}
        />
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: "transparent",
            borderTop: "5px solid transparent",
            borderBottom: "5px solid transparent",
            top: "calc(50% - 3px)",
            height: 6,
            borderLeft: "none",
            borderRight: "none",
          }}
        />
        <div
          className="absolute"
          style={{
            top: "calc(50% - 14px)", left: "calc(50% - 14px)",
            width: 28, height: 28,
            borderRadius: "50%",
            background: "#222",
            border: "5px solid #222",
            zIndex: 2,
          }}
        >
          <div
            style={{
              position: "absolute", inset: 3,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #fff 40%, #ddd 100%)",
            }}
          />
        </div>
        <div
          className="absolute"
          style={{
            left: 5, right: 5,
            top: "calc(50% - 3px)",
            height: 6,
            background: "#222",
            zIndex: 1,
          }}
        />
        <div className="relative z-10 flex flex-col items-center" style={{ marginTop: 20 }}>
          <Upload className="w-6 h-6" style={{ color: "#333" }} />
        </div>
      </div>
      <p className="text-sm font-semibold" style={{ color: "#FFDE00" }}>
        點擊或拖放 Pokemon 卡片圖片
      </p>
      <p className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
        支援 JPG / PNG / WEBP
      </p>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); }}
      />
    </div>
  );
}

function SpinningBall() {
  return (
    <div className="flex flex-col items-center gap-4">
      <div
        className="animate-spin"
        style={{ width: 64, height: 64, borderRadius: "50%",
          background: "linear-gradient(to bottom, #CC0000 50%, #f5f5f5 50%)",
          border: "4px solid #222",
          boxShadow: "0 4px 20px rgba(204,0,0,0.4)",
        }}
      />
      <p className="text-sm font-semibold animate-pulse" style={{ color: "#FFDE00" }}>
        AI 正在識別卡片...
      </p>
    </div>
  );
}

function fmtHKD(n: number) {
  return `HKD $${n.toLocaleString("en-HK")}`;
}

function GradeBar({ grade }: { grade: number }) {
  const colors = ["", "#f44336","#f44336","#FF9800","#FF9800","#FFC107","#FFC107","#8BC34A","#4CAF50","#2196F3","#9C27B0"];
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-0.5">
        {[1,2,3,4,5,6,7,8,9,10].map(i => (
          <div
            key={i}
            style={{
              width: 14, height: 14, borderRadius: 3,
              background: i <= grade ? colors[i] : "rgba(255,255,255,0.1)",
              transition: "background 0.3s",
            }}
          />
        ))}
      </div>
      <span className="text-sm font-black" style={{ color: colors[grade] ?? "#fff" }}>
        {grade}/10
      </span>
    </div>
  );
}

export default function PokeLover() {
  const [, navigate] = useLocation();
  const [imagePreview, setImagePreview] = useState<string>("");
  const [result, setResult] = useState<PokeResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [rawPriceInput, setRawPriceInput] = useState("");

  const analyzeMut = trpc.pokeLover.analyze.useMutation({
    onSuccess: (res) => {
      const data = res.data as PokeResult;
      if (data.isNotPokemon) {
        toast.error("呢張唔似係 Pokemon 卡，請重新上載", { className: "bb-toast-err" });
        setResult(null);
      } else {
        setResult(data);
        if (data.marketPriceHKD) setRawPriceInput(String(data.marketPriceHKD));
      }
      setIsAnalyzing(false);
    },
    onError: (err) => {
      toast.error(err.message || "分析失敗，請重試", { className: "bb-toast-err" });
      setIsAnalyzing(false);
    },
  });

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setImagePreview(dataUrl);
      setResult(null);
      setIsAnalyzing(true);
      const base64 = dataUrl.split(",")[1];
      const mime = file.type || "image/jpeg";
      analyzeMut.mutate({ imageBase64: base64, mimeType: mime });
    };
    reader.readAsDataURL(file);
  };

  const rawPrice = parseInt(rawPriceInput, 10) || 0;
  const psa9 = result?.psa9HKD ?? 0;
  const psa10 = result?.psa10HKD ?? 0;
  const profitPsa9 = psa9 - rawPrice - PSA_FEE_HKD;
  const profitPsa10 = psa10 - rawPrice - PSA_FEE_HKD;

  const rarityColor = result?.rarity ? (RARITY_COLOR[result.rarity] ?? "#9C27B0") : "#9C27B0";

  return (
    <div
      className="min-h-screen pb-20"
      style={{
        background: "linear-gradient(160deg, #0d0d1f 0%, #1a0505 40%, #0d0d1f 100%)",
        color: "#fff",
      }}
    >
      <Header />

      <div className="max-w-lg mx-auto px-4 pt-4">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-1 text-xs mb-4"
          style={{ color: "rgba(255,255,255,0.5)" }}
        >
          <ChevronLeft className="w-4 h-4" /> 返回
        </button>

        <div className="flex items-center gap-3 mb-1">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
            style={{
              background: "linear-gradient(to bottom, #CC0000 50%, #f5f5f5 50%)",
              border: "2px solid #333",
            }}
          />
          <div>
            <h1
              className="text-2xl font-black tracking-tight leading-none"
              style={{ color: "#FFDE00", textShadow: "0 2px 8px rgba(255,222,0,0.4)" }}
            >
              PokeLover
            </h1>
            <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>
              AI 智能 Pokemon 卡片鑑定 · 市場估價
            </p>
          </div>
        </div>

        <div
          className="rounded-2xl p-px mt-5 mb-6"
          style={{ background: "linear-gradient(135deg, #CC0000, #FFDE00, #CC0000)" }}
        >
          <div
            className="rounded-2xl p-6 flex flex-col items-center"
            style={{ background: "#13131f" }}
          >
            {isAnalyzing ? (
              <SpinningBall />
            ) : imagePreview && result ? (
              <div className="flex gap-4 items-start w-full">
                <img
                  src={imagePreview}
                  alt="Card"
                  className="rounded-xl object-cover flex-shrink-0"
                  style={{ width: 90, height: 126, border: "2px solid rgba(255,222,0,0.3)" }}
                />
                <div className="flex-1 min-w-0">
                  <p
                    className="text-xl font-black leading-tight"
                    style={{ color: "#FFDE00" }}
                  >
                    {result.cardName ?? "未知卡片"}
                  </p>
                  {result.cardNameJa && (
                    <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>
                      {result.cardNameJa}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {(result.types ?? []).map(t => <TypeBadge key={t} type={t} />)}
                    {result.rarity && (
                      <span
                        className="text-xs font-bold px-2.5 py-0.5 rounded-full"
                        style={{ background: rarityColor + "33", color: rarityColor, border: `1px solid ${rarityColor}66` }}
                      >
                        {result.rarity}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-2">
                    {result.hp && (
                      <span className="text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>
                        HP <span className="font-bold text-white">{result.hp}</span>
                      </span>
                    )}
                    {result.set && (
                      <span className="text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>
                        {result.set}{result.setNumber ? ` #${result.setNumber}` : ""}
                      </span>
                    )}
                    {result.releaseYear && (
                      <span className="text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>
                        {result.releaseYear}
                      </span>
                    )}
                    {result.language && (
                      <span className="text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>
                        {result.language}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ) : imagePreview ? (
              <SpinningBall />
            ) : (
              <PokeBallUpload onFile={handleFile} disabled={isAnalyzing} />
            )}
          </div>
        </div>

        {imagePreview && !isAnalyzing && (
          <button
            onClick={() => { setImagePreview(""); setResult(null); setRawPriceInput(""); }}
            className="text-xs mb-4"
            style={{ color: "rgba(255,255,255,0.4)" }}
          >
            ↩ 重新上載
          </button>
        )}

        {result && !result.isNotPokemon && (
          <>
            {result.attacks && result.attacks.length > 0 && (
              <div
                className="rounded-xl p-4 mb-4"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                <p className="text-xs font-bold mb-3" style={{ color: "rgba(255,255,255,0.5)" }}>技能</p>
                <div className="flex flex-col gap-2">
                  {result.attacks.map((atk, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex gap-0.5">
                          {(atk.cost ?? []).slice(0, 4).map((c, ci) => {
                            const col = TYPE_COLORS[c]?.bg ?? "#888";
                            return (
                              <div key={ci} style={{ width: 12, height: 12, borderRadius: "50%", background: col, border: "1px solid rgba(0,0,0,0.3)" }} />
                            );
                          })}
                        </div>
                        <span className="text-sm font-semibold text-white">{atk.name}</span>
                      </div>
                      {atk.damage && (
                        <span className="text-sm font-black" style={{ color: "#FFDE00" }}>{atk.damage}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div
              className="rounded-xl p-4 mb-4"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <p className="text-xs font-bold mb-3" style={{ color: "rgba(255,255,255,0.5)" }}>品相評估</p>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-base font-black text-white">{result.condition ?? "—"}</p>
                  {result.conditionNote && (
                    <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>{result.conditionNote}</p>
                  )}
                </div>
                {result.gradeEstimate != null && (
                  <div className="flex flex-col items-end gap-1">
                    <p className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>估計 PSA 等級</p>
                    <GradeBar grade={result.gradeEstimate} />
                  </div>
                )}
              </div>
            </div>

            <div
              className="rounded-xl p-4 mb-4"
              style={{ background: "rgba(255,222,0,0.07)", border: "1px solid rgba(255,222,0,0.2)" }}
            >
              <p className="text-xs font-bold mb-3" style={{ color: "rgba(255,222,0,0.7)" }}>參考市場價格</p>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "裸卡 NM", value: result.marketPriceHKD },
                  { label: "PSA 9", value: result.psa9HKD },
                  { label: "PSA 10", value: result.psa10HKD },
                ].map(({ label, value }) => (
                  <div key={label} className="text-center">
                    <p className="text-[10px] mb-1" style={{ color: "rgba(255,255,255,0.5)" }}>{label}</p>
                    <p className="text-sm font-black" style={{ color: value ? "#FFDE00" : "rgba(255,255,255,0.3)" }}>
                      {value ? `$${value.toLocaleString("en-HK")}` : "N/A"}
                    </p>
                  </div>
                ))}
              </div>
              <p className="text-[10px] mt-2 text-center" style={{ color: "rgba(255,255,255,0.3)" }}>
                * AI 估算僅供參考，實際成交價以市場為準
              </p>
            </div>

            {(psa9 > 0 || psa10 > 0) && (
              <div
                className="rounded-xl p-4 mb-4"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="w-4 h-4" style={{ color: "#FFDE00" }} />
                  <p className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.7)" }}>
                    PSA 送評計算器
                  </p>
                </div>
                <div className="mb-3">
                  <p className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.5)" }}>你的買入價 (HKD)</p>
                  <input
                    type="number"
                    value={rawPriceInput}
                    onChange={e => setRawPriceInput(e.target.value)}
                    placeholder="輸入買入價"
                    className="w-full px-3 py-2 text-sm outline-none text-white placeholder-gray-500"
                    style={{
                      background: "rgba(255,255,255,0.07)",
                      border: "1px solid rgba(255,255,255,0.15)",
                      borderRadius: "10px",
                    }}
                  />
                </div>
                {rawPrice > 0 && (
                  <div className="flex flex-col gap-2">
                    {psa9 > 0 && (
                      <div className="flex items-center justify-between rounded-lg px-3 py-2" style={{ background: profitPsa9 > 0 ? "rgba(76,175,80,0.15)" : "rgba(244,67,54,0.15)" }}>
                        <div>
                          <p className="text-xs font-bold text-white">PSA 9 得標</p>
                          <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.5)" }}>
                            {fmtHKD(psa9)} − {fmtHKD(rawPrice)} − 送評費 ${PSA_FEE_HKD}
                          </p>
                        </div>
                        <p className="text-sm font-black" style={{ color: profitPsa9 > 0 ? "#4CAF50" : "#f44336" }}>
                          {profitPsa9 > 0 ? "+" : ""}{fmtHKD(profitPsa9)}
                        </p>
                      </div>
                    )}
                    {psa10 > 0 && (
                      <div className="flex items-center justify-between rounded-lg px-3 py-2" style={{ background: profitPsa10 > 0 ? "rgba(76,175,80,0.15)" : "rgba(244,67,54,0.15)" }}>
                        <div>
                          <p className="text-xs font-bold text-white">PSA 10 得標</p>
                          <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.5)" }}>
                            {fmtHKD(psa10)} − {fmtHKD(rawPrice)} − 送評費 ${PSA_FEE_HKD}
                          </p>
                        </div>
                        <p className="text-sm font-black" style={{ color: profitPsa10 > 0 ? "#4CAF50" : "#f44336" }}>
                          {profitPsa10 > 0 ? "+" : ""}{fmtHKD(profitPsa10)}
                        </p>
                      </div>
                    )}
                    {result.worthGrading !== undefined && (
                      <p className="text-xs text-center mt-1 font-semibold" style={{ color: result.worthGrading ? "#4CAF50" : "#FF9800" }}>
                        {result.worthGrading ? "AI 建議：值得送 PSA 評級" : "AI 建議：裸卡持有較划算"}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {result.funFact && (
              <div
                className="rounded-xl p-4 mb-4"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>💡 冷知識</p>
                <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.75)" }}>{result.funFact}</p>
              </div>
            )}

            {result.ebaySearchQuery && (
              <a
                href={`https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(result.ebaySearchQuery)}&LH_Complete=1&LH_Sold=1`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-bold text-sm mb-4"
                style={{ background: "linear-gradient(135deg, #E53238, #F5AF02)", color: "#fff" }}
              >
                <Search className="w-4 h-4" />
                eBay 成交紀錄參考
                <ExternalLink className="w-3.5 h-3.5 opacity-80" />
              </a>
            )}
          </>
        )}

        {!imagePreview && (
          <div
            className="rounded-xl p-4 mt-2"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <p className="text-xs font-bold mb-2" style={{ color: "rgba(255,222,0,0.6)" }}>PokeLover 可以做到</p>
            {[
              "識別卡片名稱、系列、卡號、稀有度",
              "參考市場估價（裸卡 / PSA 9 / PSA 10）",
              "AI 品相評估及 PSA 等級預測",
              "PSA 送評回報計算器",
              "eBay 成交紀錄直連搜尋",
            ].map((t, i) => (
              <div key={i} className="flex items-start gap-2 mb-1.5">
                <span style={{ color: "#CC0000", flexShrink: 0 }}>●</span>
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>{t}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
