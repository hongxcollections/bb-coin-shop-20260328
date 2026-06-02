import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { useState, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { List, Grid3X3, Download, X } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { sify, tify } from "chinese-conv";

type ColumnDef = { key: string; label: string; role: string; showOnBidPage?: boolean };
type ColorRuleKey = "gold" | "red" | "green" | "blue" | "orange" | "purple" | "pink" | "teal";
type ColorRule = { id: string; keywords: string; color: ColorRuleKey; style?: "bg" | "text"; weight?: "bold" | "normal" };

const COLOR_PRESETS: { key: ColorRuleKey; bg: string }[] = [
  { key: "gold",   bg: "#b45309" },
  { key: "red",    bg: "#b91c1c" },
  { key: "green",  bg: "#15803d" },
  { key: "blue",   bg: "#1d4ed8" },
  { key: "orange", bg: "#c2410c" },
  { key: "purple", bg: "#7c3aed" },
  { key: "pink",   bg: "#be185d" },
  { key: "teal",   bg: "#0f766e" },
];

function expandChinese(kw: string): string[] {
  return [...new Set([kw, sify(kw), tify(kw)])].filter(Boolean);
}

function getColorRuleMatch(
  rules: ColorRule[],
  itemData: Record<string, string>
): { color: string; keywords: string[]; style: "bg" | "text"; weight: "bold" | "normal" } | null {
  if (!rules.length) return null;
  const allTextRaw = Object.values(itemData).join(" ").toLowerCase();
  const allTextS = sify(allTextRaw);
  for (const rule of rules) {
    const rawKws = rule.keywords.split(/[,，|｜\n]/).map(k => k.trim().toLowerCase()).filter(Boolean);
    if (rawKws.length === 0) continue;
    if (rawKws.some(kw => allTextRaw.includes(kw) || allTextS.includes(sify(kw)))) {
      const preset = COLOR_PRESETS.find(p => p.key === rule.color);
      if (preset) return {
        color: preset.bg,
        keywords: [...new Set(rawKws.flatMap(expandChinese))],
        style: rule.style === "text" ? "text" : "bg",
        weight: rule.weight === "normal" ? "normal" : "bold",
      };
    }
  }
  return null;
}

function highlightKw(text: string, kws: string[], color: string, style: "bg" | "text" = "bg", weight: "bold" | "normal" = "bold") {
  if (!kws.length || !text) return <>{text}</>;
  for (const kw of kws) {
    const idx = text.toLowerCase().indexOf(kw);
    if (idx >= 0) {
      return (
        <>
          {text.slice(0, idx)}
          <span style={style === "bg"
            ? { background: color, color: "#fff", padding: "0 2px", borderRadius: "3px", fontWeight: weight === "bold" ? 700 : 400 }
            : { color, fontWeight: weight === "bold" ? 700 : 400 }
          }>
            {text.slice(idx, idx + kw.length)}
          </span>
          {text.slice(idx + kw.length)}
        </>
      );
    }
  }
  return <>{text}</>;
}

function fmtDateShort(d: string | Date | null) {
  if (!d) return "—";
  const dt = new Date(d);
  return `${dt.getMonth() + 1}月${dt.getDate()}日 ${dt.getHours().toString().padStart(2, "0")}:${dt.getMinutes().toString().padStart(2, "0")}`;
}

function fmtCommRate(rate: number) {
  const pct = rate * 100;
  return `${pct % 1 === 0 ? pct.toFixed(0) : pct.toFixed(1)}%`;
}

export default function GroupAuctionFlyer() {
  const params = useParams<{ roundId: string }>();
  const roundId = parseInt(params.roundId, 10);
  const [mode, setMode] = useState<"list" | "grid">("list");
  const [saving, setSaving] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewFilename, setPreviewFilename] = useState("");
  const flyerRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();

  const { data, isLoading, error } = trpc.groupAuctions.getRound.useQuery(
    { roundId },
    { enabled: !isNaN(roundId) }
  );
  const round = data?.round;
  const isOwner = !!(user && round && Number(user.id) === Number(round.merchantUserId));
  const items = data?.items ?? [];
  const flyerImages = data?.images ?? [];
  const flyerImageMap = new Map(flyerImages.map((img: any) => [img.id as number, img.url as string]));
  const bidUrl = typeof window !== "undefined" ? `${window.location.origin}/group/${roundId}` : `/group/${roundId}`;

  const columns: ColumnDef[] = (() => {
    try { return JSON.parse(round?.columnsJson ?? "[]"); } catch { return []; }
  })();
  const titleCol = columns.find(c => c.role === "itemTitle");
  const itemNumCol = columns.find(c => c.role === "itemNumber");
  const customCols = columns.filter(c => c.role === "customText");

  const colorRules: ColorRule[] = (() => {
    try { return JSON.parse((round as any)?.colorRulesJson ?? "[]"); } catch { return []; }
  })();

  const commRate = round ? parseFloat(String((round as any).buyerCommissionRate ?? 0)) : 0;
  const hasRules = round && (round.description || (round as any).antiSnipeMode !== "none" || round.defaultBidIncrement > 0 || commRate > 0);

  async function saveImage() {
    if (!flyerRef.current) return;
    setSaving(true);
    await new Promise(r => setTimeout(r, 80));

    // 暫時移除 overflow 裁剪，讓完整 table 寬度可被捕捉
    const el = flyerRef.current;
    const overflowEls = Array.from(el.querySelectorAll<HTMLElement>("*")).filter(
      e => e.style.overflowX === "auto" || e.style.overflow === "auto"
    );
    const origStyles = overflowEls.map(e => ({ x: e.style.overflowX, o: e.style.overflow }));
    overflowEls.forEach(e => { e.style.overflowX = "visible"; e.style.overflow = "visible"; });

    await new Promise(r => setTimeout(r, 40));

    try {
      const { toPng } = await import("html-to-image");
      const fullW = el.scrollWidth;
      const fullH = el.scrollHeight;
      const dataUrl = await toPng(el, {
        backgroundColor: "#ffffff",
        pixelRatio: 3,
        width: fullW,
        height: fullH,
        style: { width: `${fullW}px`, height: `${fullH}px` },
      });
      const filename = `廣告頁-${round?.title ?? "拍賣"}.png`;
      setPreviewFilename(filename);
      setPreviewUrl(dataUrl);
    } catch {
      toast.error("儲存圖片失敗");
    } finally {
      overflowEls.forEach((e, i) => { e.style.overflowX = origStyles[i].x; e.style.overflow = origStyles[i].o; });
      setSaving(false);
    }
  }

  const thStyle = (extra?: React.CSSProperties): React.CSSProperties => ({
    padding: "6px 8px",
    textAlign: "left",
    whiteSpace: "nowrap",
    color: "#fff",
    fontWeight: 600,
    background: "#f97316",
    ...extra,
  });

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">載入中...</div>;
  }
  if (error || !round) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">場次不存在</div>;
  }

  return (
    <div className="min-h-screen bg-white">
      {/* 工具列（不列印） */}
      <div className="print:hidden flex items-center gap-2 px-3 py-3 bg-gray-50 border-b border-gray-100">
        <button
          onClick={() => setMode("list")}
          className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg ${mode === "list" ? "bg-amber-500 text-white" : "bg-white text-gray-600 border"}`}>
          <List className="w-3 h-3" /> 清單版
        </button>
        <button
          onClick={() => isOwner ? setMode("grid") : toast.info("此功能只開放給本場次商戶")}
          className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg ${mode === "grid" ? "bg-amber-500 text-white" : "bg-white text-gray-600 border"}`}>
          <Grid3X3 className="w-3 h-3" /> 圖片版
        </button>
        <button
          onClick={saveImage}
          disabled={saving}
          className="ml-auto flex items-center gap-1 text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg disabled:opacity-60">
          <Download className="w-3 h-3" /> {saving ? "生成中..." : "儲存廣告頁面"}
        </button>
      </div>

      {/* 廣告單張主體（capture 範圍） */}
      <div ref={flyerRef} className="max-w-2xl mx-auto py-6" style={{ fontFamily: "system-ui, sans-serif", background: "#fff" }}>

        {/* 標題區 */}
        <div className="text-center mb-5 px-4">
          {round.coverImage && (
            <img src={round.coverImage} className="w-full h-48 object-cover rounded-2xl mb-4" />
          )}
          <div
            className="inline-block text-white text-center px-6 py-3 rounded-2xl mb-2"
            style={{ background: "linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)" }}
          >
            <p className="text-sm opacity-90">
              {round.periodNumber ? `第 ${round.periodNumber} 期` : "團購拍賣"}
            </p>
            <h1 className="text-xl font-bold">【{round.title}】</h1>
          </div>
          {(round.startAt || round.endAt) && (
            <p className="text-sm text-gray-600 mt-1">
              開拍時間：{fmtDateShort((round as any).startAt ?? null)} 至 {fmtDateShort(round.endAt ?? null)}
            </p>
          )}
          <a
            href={bidUrl}
            className="print:hidden inline-flex items-center gap-1.5 mt-2 px-4 py-1.5 rounded-full text-sm font-semibold text-white"
            style={{ background: "linear-gradient(90deg, #ea580c 0%, #f97316 60%, #fbbf24 100%)" }}
          >
            進入拍賣頁面 →
          </a>
        </div>

        {/* 清單版 */}
        {mode === "list" && (
          <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" as any, paddingLeft: 8 }}>
            <table style={{ borderCollapse: "collapse", fontSize: 12, width: "100%" }}>
              <thead>
                <tr>
                  <th style={thStyle({ background: "#f59e0b", borderRadius: "8px 0 0 8px", paddingLeft: 4 })}>序</th>
                  <th style={thStyle({ background: "linear-gradient(90deg,#f59e0b,#f97316)" })}>商品名稱</th>
                  {itemNumCol && (
                    <th style={thStyle()}>{itemNumCol.label || "號碼"}</th>
                  )}
                  {customCols.map(c => (
                    <th key={c.key} style={thStyle()}>{c.label}</th>
                  ))}
                  <th style={thStyle({ background: "#ef4444", textAlign: "right", borderRadius: "0 8px 8px 0" })}>起拍</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => {
                  const d = (() => { try { return JSON.parse(item.dataJson); } catch { return {} as Record<string, string>; } })();
                  const title = titleCol ? (d[titleCol.key] || "") : "";
                  const itemNum = itemNumCol ? (d[itemNumCol.key] || "") : "";
                  const colorMatch = getColorRuleMatch(colorRules, d);
                  const rowBg = idx % 2 === 0 ? "#fafafa" : "#ffffff";
                  return (
                    <tr key={item.id} style={{ background: rowBg, borderBottom: "1px solid #f3f4f6" }}>
                      <td style={{ padding: "6px 8px", whiteSpace: "nowrap", color: "#9ca3af" }}>{idx + 1}</td>
                      <td style={{ padding: "6px 8px", whiteSpace: "nowrap", color: "#1f2937" }}>
                        {colorMatch ? highlightKw(title || "—", colorMatch.keywords, colorMatch.color, colorMatch.style, colorMatch.weight) : (title || "—")}
                      </td>
                      {itemNumCol && (
                        <td style={{ padding: "6px 8px", whiteSpace: "nowrap", color: "#6b7280" }}>
                          {colorMatch ? highlightKw(itemNum || "—", colorMatch.keywords, colorMatch.color, colorMatch.style, colorMatch.weight) : (itemNum || "—")}
                        </td>
                      )}
                      {customCols.map(c => (
                        <td key={c.key} style={{ padding: "6px 8px", whiteSpace: "nowrap", color: "#6b7280" }}>
                          {colorMatch ? highlightKw(d[c.key] || "—", colorMatch.keywords, colorMatch.color, colorMatch.style, colorMatch.weight) : (d[c.key] || "—")}
                        </td>
                      ))}
                      <td style={{ padding: "6px 8px", textAlign: "right", whiteSpace: "nowrap", color: "#b45309", fontWeight: 600 }}>
                        ${item.startPrice}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* 圖片版（Grid） */}
        {mode === "grid" && (
          <div className="grid grid-cols-4 gap-2 px-4">
            {items.map((item, idx) => {
              const d = (() => { try { return JSON.parse(item.dataJson); } catch { return {} as Record<string, string>; } })();
              const title = titleCol ? d[titleCol.key] : "";
              const imgUrl = (() => {
                try {
                  const ids: number[] = JSON.parse((item as any).imageIdsJson ?? "[]");
                  if (ids.length === 0) return null;
                  return flyerImageMap.get(ids[0]) ?? null;
                } catch { return null; }
              })();
              return (
                <div key={item.id} className="border border-gray-100 rounded-xl overflow-hidden">
                  <div className="h-20 bg-gray-100 flex items-center justify-center">
                    {imgUrl ? (
                      <img src={imgUrl} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-gray-300 text-xs">#{idx + 1}</span>
                    )}
                  </div>
                  <div className="p-1.5">
                    <p className="text-[10px] text-gray-700 truncate leading-tight">{title}</p>
                    {customCols.length > 0 && (
                      <p className="text-[9px] text-gray-400">{d[customCols[0].key]}</p>
                    )}
                    <p className="text-[10px] text-amber-600 font-bold mt-0.5">HK${item.startPrice}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 拍賣須知 + QR Code */}
        <div className="mt-6 px-4 flex gap-6 items-start">
          <div className="flex-1 space-y-1">
            {hasRules && (
              <p className="text-sm font-bold text-gray-800 mb-1.5">拍賣須知：</p>
            )}
            {/* 拍賣須知文字（第一行） */}
            {round.description && (
              <div className="text-xs text-gray-600 whitespace-pre-line">
                {round.description}
              </div>
            )}
            {/* 延遲結標設定 */}
            {(round as any).antiSnipeMode !== "none" && (
              <p className="text-xs text-blue-600">
                {(round as any).antiSnipeMode === "per_item"
                  ? `單件延時：出價時間距結束少於 ${(round as any).antiSnipeMinutes} 分鐘，商品自動延長 ${(round as any).antiSnipeExtendMinutes} 分鐘`
                  : `全場延時：出價時間距結束少於 ${(round as any).antiSnipeMinutes} 分鐘，全場自動延長 ${(round as any).antiSnipeExtendMinutes} 分鐘`}
              </p>
            )}
            {/* 每口加幅 + 傭金 */}
            {(round.defaultBidIncrement > 0 || commRate > 0) && (
              <p className="text-xs text-amber-700">
                {round.defaultBidIncrement > 0 && `每口加幅：HK$${round.defaultBidIncrement}（或個別加幅設定可能不同）`}
                {commRate > 0 && `　買家傭金：${fmtCommRate(commRate)}`}
              </p>
            )}
          </div>
          <div className="flex flex-col items-center gap-1 flex-shrink-0">
            <QRCodeSVG value={bidUrl} size={80} fgColor="#92400e" />
            <p className="text-[10px] text-gray-500 text-center">長按識別二維碼<br />進入出價頁</p>
          </div>
        </div>

        {/* 頁腳 */}
        <div className="mt-6 px-4 text-center text-xs text-gray-300 border-t border-gray-100 pt-3">
          hongxcollections.com
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body { margin: 0; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>

      {/* 儲存圖片預覽 overlay */}
      {previewUrl && (
        <div className="fixed inset-0 z-[10000] bg-black/90 flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-sm flex flex-col items-center gap-3">
            <img
              src={previewUrl}
              alt="廣告頁面"
              className="w-full rounded-2xl shadow-2xl object-contain"
              style={{ maxHeight: "70vh" }}
            />
            <p className="text-white/60 text-xs text-center">長按圖片儲存至相冊</p>
            <div className="flex gap-3 w-full">
              <a
                href={previewUrl}
                download={previewFilename}
                className="flex-1 flex items-center justify-center gap-1.5 text-sm bg-white/15 hover:bg-white/25 text-white px-4 py-2.5 rounded-xl"
              >
                <Download className="w-4 h-4" /> 下載
              </a>
              <button
                onClick={() => setPreviewUrl(null)}
                className="flex-1 flex items-center justify-center gap-1.5 text-sm bg-white/10 hover:bg-white/20 text-white/80 px-4 py-2.5 rounded-xl"
              >
                <X className="w-4 h-4" /> 關閉
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
