import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { useState, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { List, Grid3X3, Download, X } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import Header from "@/components/Header";
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
      // fullW：取所有子元素 getBoundingClientRect().right 最大值，解決 overflow visible 後 scrollWidth 唔追蹤 table 真實右邊界問題
      const elRect = el.getBoundingClientRect();
      const allRights = Array.from(el.querySelectorAll("*")).map(
        c => c.getBoundingClientRect().right
      );
      const maxRight = Math.max(elRect.right, ...allRights);
      const fullW = Math.ceil(maxRight - elRect.left) + 8; // +8 補右 padding
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
    <div className="min-h-screen bg-white pb-20">
      <Header />
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

        {/* Hero 標題區 */}
        <div className="mb-4">
          {round.coverImage ? (
            <div className="mx-4 relative rounded-2xl overflow-hidden">
              <img src={round.coverImage} alt="" className="w-full object-cover" style={{ maxHeight: 220 }} />
              <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.15) 55%, transparent 100%)" }} />
              <div className="absolute bottom-0 left-0 right-0 px-4 pb-4">
                {round.periodNumber && (
                  <span className="inline-block text-[11px] text-amber-300 font-semibold mb-1.5 px-2 py-0.5 rounded-full" style={{ background: "rgba(0,0,0,0.35)" }}>
                    第 {round.periodNumber} 期
                  </span>
                )}
                <h1 className="text-white text-xl font-bold leading-snug" style={{ textShadow: "0 1px 4px rgba(0,0,0,0.5)" }}>
                  {round.title}
                </h1>
              </div>
            </div>
          ) : (
            <div className="mx-4 px-4 pt-5 pb-4 rounded-2xl" style={{ background: "linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)" }}>
              {round.periodNumber && (
                <span className="inline-block text-[11px] text-amber-100 font-semibold mb-1.5 px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.2)" }}>
                  第 {round.periodNumber} 期
                </span>
              )}
              <h1 className="text-white text-xl font-bold leading-snug">{round.title}</h1>
            </div>
          )}

          {/* 商戶 + 進入按鈕 */}
          <div className="px-4 pt-3 flex items-center gap-3">
            {(round as any).merchantName ? (
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {(round as any).merchantIcon ? (
                  <img
                    src={`/api/img-proxy?url=${encodeURIComponent((round as any).merchantIcon)}`}
                    alt=""
                    className="w-8 h-8 rounded-full object-cover shrink-0"
                    style={{ border: "2px solid #fde68a" }}
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm font-bold text-amber-700"
                    style={{ background: "linear-gradient(135deg,#fef3c7,#fde68a)" }}>
                    {((round as any).merchantName as string).charAt(0)}
                  </div>
                )}
                <span className="text-sm font-semibold text-gray-800 truncate">{(round as any).merchantName}</span>
              </div>
            ) : <div className="flex-1" />}
            <a
              href={bidUrl}
              className="print:hidden inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-full font-semibold text-white shrink-0"
              style={{ background: "linear-gradient(90deg,#ea580c,#f97316,#fbbf24)" }}
            >
              進入出價 →
            </a>
          </div>

          {/* 日期 */}
          {(round.startAt || round.endAt) && (
            <p className="px-4 mt-1.5 text-xs text-gray-500">
              開拍：{fmtDateShort((round as any).startAt ?? null)} — {fmtDateShort(round.endAt ?? null)}
            </p>
          )}
        </div>

        {/* 清單版 */}
        {mode === "list" && (
          <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" as any, paddingLeft: 8, paddingRight: 8 }}>
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

        {/* 拍賣須知卡片 + QR */}
        {hasRules && (
          <div className="mx-4 mt-5 rounded-2xl overflow-hidden" style={{ border: "1px solid #fde68a" }}>
            <div className="px-4 py-2" style={{ background: "linear-gradient(90deg,#fffbeb,#fef3c7)" }}>
              <span className="text-xs font-bold text-amber-800">拍賣須知</span>
            </div>
            <div className="px-4 py-3 flex gap-4 items-start bg-white">
              <div className="flex-1 min-w-0 space-y-1.5">
                {round.description && (
                  <p className="text-xs text-gray-700 whitespace-pre-line leading-relaxed">{round.description}</p>
                )}
                {(round as any).antiSnipeMode !== "none" && (
                  <p className="text-xs text-blue-600">
                    {(round as any).antiSnipeMode === "per_item"
                      ? `單件延時：出價時間距結束少於 ${(round as any).antiSnipeMinutes} 分鐘，商品自動延長 ${(round as any).antiSnipeExtendMinutes} 分鐘`
                      : `全場延時：出價時間距結束少於 ${(round as any).antiSnipeMinutes} 分鐘，全場自動延長 ${(round as any).antiSnipeExtendMinutes} 分鐘`}
                  </p>
                )}
                {(round.defaultBidIncrement > 0 || commRate > 0) && (
                  <p className="text-xs text-amber-700">
                    {round.defaultBidIncrement > 0 && `每口加幅：HK$${round.defaultBidIncrement}（或個別加幅設定可能不同）`}
                    {commRate > 0 && `　買家傭金：${fmtCommRate(commRate)}`}
                  </p>
                )}
              </div>
              <div className="flex flex-col items-center gap-1 shrink-0">
                <div className="p-1.5 rounded-xl" style={{ background: "#fffbeb", border: "1px solid #fde68a" }}>
                  <QRCodeSVG value={bidUrl} size={68} fgColor="#92400e" bgColor="#fffbeb" />
                </div>
                <p className="text-[9px] text-gray-400 text-center mt-0.5">掃碼出價</p>
              </div>
            </div>
          </div>
        )}

        {/* 冇須知但有 QR：獨立展示 */}
        {!hasRules && (
          <div className="flex flex-col items-center gap-1.5 mt-5">
            <div className="p-2 rounded-xl" style={{ background: "#fffbeb", border: "1px solid #fde68a" }}>
              <QRCodeSVG value={bidUrl} size={72} fgColor="#92400e" bgColor="#fffbeb" />
            </div>
            <p className="text-[10px] text-gray-400">掃碼進入出價頁</p>
          </div>
        )}

        {/* 頁腳 */}
        <div className="mt-5 mx-4 pt-3 flex items-center justify-center gap-2" style={{ borderTop: "1px solid #f3f4f6" }}>
          <div style={{ width: 20, height: 1, background: "linear-gradient(90deg,transparent,#fbbf24)" }} />
          <span className="text-[10px] text-gray-400 tracking-widest">hongxcollections.com</span>
          <div style={{ width: 20, height: 1, background: "linear-gradient(90deg,#fbbf24,transparent)" }} />
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
