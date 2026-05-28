import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Printer, List, Grid3X3 } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";

type ColumnDef = { key: string; label: string; role: string; showOnBidPage?: boolean };

function fmtDateTime(d: string | Date | null) {
  if (!d) return "—";
  const dt = new Date(d);
  return `${dt.getFullYear()}-${(dt.getMonth() + 1).toString().padStart(2, "0")}-${dt.getDate().toString().padStart(2, "0")} ${dt.getHours().toString().padStart(2, "0")}:${dt.getMinutes().toString().padStart(2, "0")}`;
}

export default function GroupAuctionFlyer() {
  const params = useParams<{ roundId: string }>();
  const roundId = parseInt(params.roundId, 10);
  const [mode, setMode] = useState<"list" | "grid">("list");
  const { isAuthenticated } = useAuth();

  const { data, isLoading, error } = trpc.groupAuctions.getRound.useQuery(
    { roundId },
    { enabled: !isNaN(roundId) }
  );
  const { data: isMerchant } = trpc.merchants.isMerchant.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const round = data?.round;
  const items = data?.items ?? [];
  const bidUrl = typeof window !== "undefined" ? `${window.location.origin}/group/${roundId}` : `/group/${roundId}`;

  const columns: ColumnDef[] = (() => {
    try { return JSON.parse(round?.columnsJson ?? "[]"); } catch { return []; }
  })();
  const titleCol = columns.find(c => c.role === "itemTitle");
  const customCols = columns.filter(c => c.role === "customText");

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">載入中...</div>;
  }
  if (error || !round) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">場次不存在</div>;
  }

  return (
    <div className="min-h-screen bg-white">
      {/* 工具列（不列印） */}
      <div className="print:hidden flex items-center gap-2 px-[3px] py-3 bg-gray-50 border-b border-gray-100">
        <button
          onClick={() => setMode("list")}
          className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg ${mode === "list" ? "bg-amber-500 text-white" : "bg-white text-gray-600 border"}`}>
          <List className="w-3 h-3" /> 清單版
        </button>
        {isMerchant && (
          <button
            onClick={() => setMode("grid")}
            className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg ${mode === "grid" ? "bg-amber-500 text-white" : "bg-white text-gray-600 border"}`}>
            <Grid3X3 className="w-3 h-3" /> 圖片版
          </button>
        )}
        {isMerchant && (
          <button
            onClick={() => window.print()}
            className="ml-auto flex items-center gap-1 text-xs bg-gray-800 text-white px-3 py-1.5 rounded-lg">
            <Printer className="w-3 h-3" /> 列印 / 儲存 PDF
          </button>
        )}
      </div>

      {/* 廣告單張主體 */}
      <div className="max-w-2xl mx-auto px-[3px] py-8" style={{ fontFamily: "system-ui, sans-serif" }}>
        {/* 標題區 */}
        <div className="text-center mb-6">
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
          {round.endAt && (
            <p className="text-sm text-gray-600 mt-1">
              結拍時間：{fmtDateTime(round.endAt)}
            </p>
          )}
        </div>

        {/* 清單版 */}
        {mode === "list" && (
          <div>
            <div>
              {/* 標題行 */}
              <div
                className="grid text-xs font-semibold text-white px-2 py-1 rounded-lg mb-1"
                style={{
                  background: "linear-gradient(90deg, #f59e0b, #ef4444)",
                  gridTemplateColumns: `2rem 1fr ${customCols.length > 0 ? "4rem" : ""} 4rem`,
                }}
              >
                <span>序</span>
                <span>品名</span>
                {customCols.length > 0 && <span>{customCols[0]?.label}</span>}
                <span className="text-right">起拍</span>
              </div>
              {items.map((item, idx) => {
                const data = (() => { try { return JSON.parse(item.dataJson); } catch { return {}; } })();
                const title = titleCol ? data[titleCol.key] : "";
                const customVal = customCols.length > 0 ? data[customCols[0].key] : "";
                return (
                  <div
                    key={item.id}
                    className="grid text-xs px-2 py-1 border-b border-gray-100"
                    style={{
                      gridTemplateColumns: `2rem 1fr ${customCols.length > 0 ? "4rem" : ""} 4rem`,
                      background: idx % 2 === 0 ? "#fafafa" : "white",
                    }}
                  >
                    <span className="text-gray-400">{idx + 1}</span>
                    <span className="truncate text-gray-800">{title}</span>
                    {customCols.length > 0 && (
                      <span className="text-gray-500">{customVal}</span>
                    )}
                    <span className="text-right text-amber-700 font-semibold">
                      ${item.startPrice}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 圖片版（Grid） */}
        {mode === "grid" && (
          <div className="grid grid-cols-4 gap-2">
            {items.map((item, idx) => {
              const data = (() => { try { return JSON.parse(item.dataJson); } catch { return {}; } })();
              const title = titleCol ? data[titleCol.key] : "";
              const images = data?.images ?? [];
              const imgUrl = (() => {
                try {
                  const ids: number[] = JSON.parse(item.imageIdsJson ?? "[]");
                  const poolImg = data?.images?.[0];
                  return poolImg ?? null;
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
                      <p className="text-[9px] text-gray-400">{data[customCols[0].key]}</p>
                    )}
                    <p className="text-[10px] text-amber-600 font-bold mt-0.5">HK${item.startPrice}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 拍賣須知 + QR Code */}
        <div className="mt-8 flex gap-6 items-start">
          <div className="flex-1">
            {round.description && (
              <div>
                <p className="text-sm font-bold text-gray-800 mb-2">拍賣須知：</p>
                <div className="text-xs text-gray-600 space-y-1 whitespace-pre-line">
                  {round.description}
                </div>
              </div>
            )}
          </div>
          <div className="flex flex-col items-center gap-1 flex-shrink-0">
            <QRCodeSVG value={bidUrl} size={80} />
            <p className="text-[10px] text-gray-500 text-center">長按識別二維碼<br />進入出價頁</p>
          </div>
        </div>

        {/* 頁腳 */}
        <div className="mt-6 text-center text-xs text-gray-300 border-t border-gray-100 pt-3">
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
    </div>
  );
}
