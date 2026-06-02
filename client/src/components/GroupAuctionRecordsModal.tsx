import { useState } from "react";
import { X, Trophy, ChevronsUpDown, ChevronUp, ChevronDown } from "lucide-react";
import { trpc } from "@/lib/trpc";

interface Props {
  open: boolean;
  onClose: () => void;
  roundId: number;
  roundTitle: string;
}

const CURR_SYMS: Record<string, string> = { HKD: "HK$", CNY: "¥", USD: "US$", JPY: "JP¥", GBP: "£", EUR: "€" };

type ColumnDef = { key: string; label: string; role: string };
type Filter = "all" | "bid" | "nobid";
type SortDir = "none" | "asc" | "desc";

function getItemData(item: any): Record<string, string> {
  try { return JSON.parse(item.dataJson); } catch { return {}; }
}

export function GroupAuctionRecordsModal({ open, onClose, roundId, roundTitle }: Props) {
  const [filter, setFilter] = useState<Filter>("all");
  const [sortDir, setSortDir] = useState<SortDir>("none");

  const { data, isLoading } = trpc.groupAuctions.getRound.useQuery(
    { roundId },
    { enabled: open, refetchInterval: 5000, staleTime: 0 }
  );

  if (!open) return null;

  const round = data?.round;
  const allItems: any[] = data?.items ?? [];

  const columns: ColumnDef[] = (() => {
    try { return JSON.parse(round?.columnsJson ?? "[]"); } catch { return []; }
  })();
  const titleCol = columns.find(c => c.role === "itemTitle");
  const extraCols = columns.filter(c => c.role === "itemNumber" || c.role === "customText");

  const currency = ((round as any)?.displayCurrencies ?? "HKD").split(",")[0].trim() || "HKD";
  const sym = CURR_SYMS[currency] ?? "HK$";
  const fmtPrice = (n: number | null | undefined) =>
    n != null ? `${sym}${Math.round(Number(n)).toLocaleString()}` : "—";

  const withBid = allItems.filter(i => i.topBidderId != null).length;
  const noBid = allItems.filter(i => i.topBidderId == null).length;

  const filtered = filter === "bid"
    ? allItems.filter(i => i.topBidderId != null)
    : filter === "nobid"
      ? allItems.filter(i => i.topBidderId == null)
      : allItems;

  const items = sortDir === "none" ? filtered : [...filtered].sort((a, b) => {
    const na = (a.topBidderName ?? "").toLowerCase();
    const nb = (b.topBidderName ?? "").toLowerCase();
    if (na === nb) return 0;
    const cmp = na < nb ? -1 : 1;
    return sortDir === "asc" ? cmp : -cmp;
  });

  function cycleSort() {
    setSortDir(d => d === "none" ? "asc" : d === "asc" ? "desc" : "none");
  }

  const SortIcon = sortDir === "asc" ? ChevronUp : sortDir === "desc" ? ChevronDown : ChevronsUpDown;

  const filterBtns: { key: Filter; label: string; count: number }[] = [
    { key: "all", label: "全部", count: allItems.length },
    { key: "bid", label: "有出價", count: withBid },
    { key: "nobid", label: "未出價", count: noBid },
  ];

  return (
    <div className="fixed inset-0 z-[9999] flex items-end" onClick={onClose}>
      {/* 背景遮罩 */}
      <div className="absolute inset-0 bg-black/50" />

      {/* 底部 sheet — 跟 AuctionFbPanel 完全相同 pattern */}
      <div
        className="relative z-10 w-full bg-white rounded-t-2xl shadow-2xl flex flex-col"
        style={{ maxHeight: "82vh" }}
        onClick={e => e.stopPropagation()}
      >
        {/* drag handle */}
        <div className="flex justify-center pt-2 pb-1 flex-shrink-0">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="font-bold text-gray-900 text-sm">拍賣紀錄</h2>
            <p className="text-xs text-gray-400 mt-0.5">{round?.title ?? roundTitle}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 篩選 bar */}
        {!isLoading && allItems.length > 0 && (
          <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2 border-b border-gray-100">
            {filterBtns.map(btn => (
              <button
                key={btn.key}
                onClick={() => setFilter(btn.key)}
                className="text-xs px-3 py-1 rounded-full transition-colors"
                style={{
                  background: filter === btn.key ? "#d97706" : "#f3f4f6",
                  color: filter === btn.key ? "#fff" : "#6b7280",
                  fontWeight: filter === btn.key ? 700 : 400,
                }}
              >
                {btn.label} {btn.count}
              </button>
            ))}
          </div>
        )}

        {/* Table */}
        <div className="flex-1 overflow-y-auto overflow-x-auto" style={{ scrollbarWidth: "thin" }}>
          {isLoading && (
            <p className="text-center text-gray-400 text-sm py-10">載入中...</p>
          )}
          {!isLoading && allItems.length === 0 && (
            <p className="text-center text-gray-400 text-sm py-10">未有商品紀錄</p>
          )}
          {!isLoading && items.length === 0 && allItems.length > 0 && (
            <p className="text-center text-gray-400 text-sm py-10">沒有符合條件的商品</p>
          )}
          {!isLoading && items.length > 0 && (
            <table style={{ borderCollapse: "collapse", fontSize: "11px", minWidth: "max-content", width: "100%" }}>
              <thead>
                <tr style={{ background: "#fffbeb" }}>
                  <th style={thStyle}>#</th>
                  <th style={{ ...thStyle, minWidth: 160 }}>商品名稱</th>
                  {extraCols.length > 0
                    ? extraCols.map(c => (
                        <th key={c.key} style={{ ...thStyle, minWidth: 80 }}>{c.label || "號碼"}</th>
                      ))
                    : <th style={{ ...thStyle, minWidth: 80 }}>商品號碼</th>
                  }
                  <th style={{ ...thStyle, minWidth: 80, textAlign: "right" }}>起拍價</th>
                  <th style={{ ...thStyle, minWidth: 90, textAlign: "right" }}>領先價錢</th>
                  <th style={{ ...thStyle, minWidth: 110 }}>
                    <button
                      className="flex items-center gap-1"
                      style={{ color: sortDir !== "none" ? "#d97706" : "#92400e" }}
                      onClick={cycleSort}
                    >
                      領先用戶 <SortIcon className="w-3 h-3" />
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => {
                  const d = getItemData(item);
                  const itemTitle = titleCol ? d[titleCol.key] : `商品 ${idx + 1}`;
                  const hasBid = item.topBidderId != null;
                  return (
                    <tr key={item.id} style={{ borderBottom: "1px solid #f3f4f6", background: hasBid ? "#fffdf5" : "#fff" }}>
                      <td style={tdStyle}>{idx + 1}</td>
                      <td style={{ ...tdStyle, minWidth: 160, whiteSpace: "nowrap" }}>{itemTitle || "—"}</td>
                      {extraCols.length > 0
                        ? extraCols.map(c => (
                            <td key={c.key} style={{ ...tdStyle, minWidth: 80, whiteSpace: "nowrap", fontWeight: 600, color: "#374151" }}>
                              {d[c.key] || "—"}
                            </td>
                          ))
                        : <td style={{ ...tdStyle, minWidth: 80, color: "#9ca3af" }}>—</td>
                      }
                      <td style={{ ...tdStyle, minWidth: 80, textAlign: "right", color: "#6b7280", whiteSpace: "nowrap" }}>
                        {fmtPrice(item.startPrice)}
                      </td>
                      <td style={{ ...tdStyle, minWidth: 90, textAlign: "right", fontWeight: hasBid ? 700 : 400, color: hasBid ? "#d97706" : "#d1d5db", whiteSpace: "nowrap" }}>
                        {hasBid ? fmtPrice(item.currentPrice) : "—"}
                      </td>
                      <td style={{ ...tdStyle, minWidth: 110, whiteSpace: "nowrap", color: hasBid ? "#374151" : "#d1d5db" }}>
                        {hasBid ? (
                          <span className="flex items-center gap-1">
                            <Trophy className="w-3 h-3 text-amber-400 flex-shrink-0" />
                            {item.topBidderName || "—"}
                          </span>
                        ) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer 統計 */}
        {!isLoading && allItems.length > 0 && (
          <div className="flex-shrink-0 flex items-center gap-4 px-4 py-2 border-t border-gray-100 bg-gray-50">
            <span className="text-xs text-gray-500">共 <strong>{allItems.length}</strong> 件</span>
            <span className="text-xs text-emerald-600">有出價 <strong>{withBid}</strong> 件</span>
            <span className="text-xs text-gray-400">未出價 <strong>{noBid}</strong> 件</span>
          </div>
        )}

        {/* 底部固定空位 — 跟 AuctionFbPanel/AuctionImageLightbox 完全一樣 */}
        <div className="h-6 flex-shrink-0" />
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "7px 10px",
  fontWeight: 600,
  color: "#92400e",
  borderBottom: "1px solid #fde68a",
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  padding: "7px 10px",
  color: "#374151",
};
