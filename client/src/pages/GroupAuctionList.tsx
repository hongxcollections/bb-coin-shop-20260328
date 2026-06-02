import { useState, useRef } from "react";
import { Link, useLocation } from "wouter";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useConfirm } from "@/components/ui/confirm-provider";
import { toast } from "sonner";
import { Plus, ChevronLeft, Pencil, Trash2, Globe, Archive, Clock, QrCode, Receipt, ListOrdered, X, Trophy, ChevronsUpDown, ChevronUp, ChevronDown, Download, Printer } from "lucide-react";
import { GroupAuctionShareMenu } from "@/components/ShareMenu";
import { GroupAuctionPosterModal } from "@/components/GroupAuctionPosterModal";
import { GroupAuctionCommissionModal } from "@/components/GroupAuctionCommissionModal";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

const CURR_SYMS: Record<string, string> = { HKD: "HK$", CNY: "¥", USD: "US$", JPY: "JP¥", GBP: "£", EUR: "€" };

const recThStyle = {
  padding: "8px 5px",
  textAlign: "left" as const,
  fontWeight: 600,
  color: "#92400e",
  fontSize: "11px",
  borderBottom: "1px solid #fde68a",
  whiteSpace: "nowrap" as const,
};
const recTdStyle = {
  padding: "7px 5px",
  fontSize: "11px",
  verticalAlign: "middle" as const,
  color: "#374151",
};

type RecordsFilter = "all" | "bid" | "nobid";
type RecordsSortDir = "none" | "asc" | "desc";

function AuctionRecordsSheet({ roundId, roundTitle, onClose, onSaveImage }: {
  roundId: number;
  roundTitle: string;
  onClose: () => void;
  onSaveImage: (url: string, filename: string) => void;
}) {
  const [filter, setFilter] = useState<RecordsFilter>("all");
  const [sortDir, setSortDir] = useState<RecordsSortDir>("none");
  const captureRef = useRef<HTMLTableElement>(null);

  const { data, isLoading } = trpc.groupAuctions.getRound.useQuery(
    { roundId },
    { refetchInterval: 5000, staleTime: 0 }
  );

  const round = (data as any)?.round;
  const allItems: any[] = (data as any)?.items ?? [];

  const columns: any[] = (() => {
    try { return JSON.parse(round?.columnsJson ?? "[]"); } catch { return []; }
  })();
  const titleCol = columns.find((c: any) => c.role === "itemTitle");
  const extraCols = columns.filter((c: any) => c.role === "itemNumber" || c.role === "customText");

  const currency = (round?.displayCurrencies ?? "HKD").split(",")[0].trim() || "HKD";
  const sym = CURR_SYMS[currency] ?? "HK$";
  const fmtP = (n: number | null | undefined) =>
    n != null ? `${sym}${Math.round(Number(n)).toLocaleString()}` : "—";

  const getItemData = (item: any): Record<string, string> => {
    try { return JSON.parse(item.dataJson); } catch { return {}; }
  };

  const withBid = allItems.filter(i => i.topBidderId != null).length;
  const noBid = allItems.filter(i => i.topBidderId == null).length;

  const filtered =
    filter === "bid" ? allItems.filter(i => i.topBidderId != null) :
    filter === "nobid" ? allItems.filter(i => i.topBidderId == null) :
    allItems;

  const items = sortDir === "none" ? filtered : [...filtered].sort((a, b) => {
    const na = (a.topBidderName ?? "").toLowerCase();
    const nb = (b.topBidderName ?? "").toLowerCase();
    if (na === nb) return 0;
    const cmp = na < nb ? -1 : 1;
    return sortDir === "asc" ? cmp : -cmp;
  });

  const SortIcon = sortDir === "asc" ? ChevronUp : sortDir === "desc" ? ChevronDown : ChevronsUpDown;

  async function saveImage() {
    if (!captureRef.current) return;
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(captureRef.current, { backgroundColor: "#ffffff", pixelRatio: 2 });
      onSaveImage(dataUrl, `拍賣紀錄-${round?.title ?? roundTitle}.png`);
    } catch { toast.error("儲存圖片失敗"); }
  }

  function handlePrint() {
    const title = round?.title ?? roundTitle;
    const extraThHtml = extraCols.length > 0
      ? extraCols.map((c: any) => `<th style="padding:6px 8px;text-align:left;border-bottom:2px solid #d97706">${c.label || "號碼"}</th>`).join("")
      : `<th style="padding:6px 8px;text-align:left;border-bottom:2px solid #d97706">商品號碼</th>`;
    const rows = allItems.map((item: any, idx: number) => {
      const d = getItemData(item);
      const itemTitle = titleCol ? d[titleCol.key] : `商品 ${idx + 1}`;
      const hasBid = item.topBidderId != null;
      const extraTdHtml = extraCols.length > 0
        ? extraCols.map((c: any) => `<td style="padding:5px 8px">${d[c.key] || "—"}</td>`).join("")
        : `<td style="padding:5px 8px;color:#9ca3af">—</td>`;
      return `<tr style="border-bottom:1px solid #f3f4f6;background:${hasBid ? "#fffdf5" : "#fff"}">
        <td style="padding:5px 8px">${idx + 1}</td>
        <td style="padding:5px 8px">${itemTitle || "—"}</td>
        ${extraTdHtml}
        <td style="padding:5px 8px;text-align:right;color:#6b7280">${fmtP(item.startPrice)}</td>
        <td style="padding:5px 8px;text-align:right;${hasBid ? "font-weight:700;color:#d97706" : "color:#d1d5db"}">${hasBid ? fmtP(item.currentPrice) : "—"}</td>
        <td style="padding:5px 8px;${hasBid ? "color:#374151" : "color:#d1d5db"}">${hasBid ? (item.topBidderName || "—") : "—"}</td>
      </tr>`;
    }).join("");
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title} 拍賣紀錄</title>
      <style>body{font-family:sans-serif;padding:20px;font-size:12px}@media print{body{padding:8px}}</style>
      </head><body>
      <h2 style="margin-bottom:4px">${title} — 拍賣紀錄</h2>
      <p style="color:#666;margin-bottom:16px;font-size:11px">共 ${allItems.length} 件 · 已出價 ${withBid} 件 · 未出價 ${noBid} 件</p>
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead><tr style="background:#fffbeb">
          <th style="padding:6px 8px;text-align:left;border-bottom:2px solid #d97706">#</th>
          <th style="padding:6px 8px;text-align:left;border-bottom:2px solid #d97706">商品名稱</th>
          ${extraThHtml}
          <th style="padding:6px 8px;text-align:right;border-bottom:2px solid #d97706">起拍價</th>
          <th style="padding:6px 8px;text-align:right;border-bottom:2px solid #d97706">領先價錢</th>
          <th style="padding:6px 8px;text-align:left;border-bottom:2px solid #d97706">領先用戶</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      </body></html>`;
    const w = window.open("", "_blank");
    if (!w) { toast.error("請允許彈出視窗"); return; }
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 300);
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-lg p-0 overflow-hidden rounded-2xl mb-20">
        <DialogHeader className="px-4 pt-4 pb-2 border-b border-gray-100">
          <DialogTitle className="text-base font-semibold text-amber-900">拍賣紀錄</DialogTitle>
          <p className="text-xs text-gray-400 mt-0.5">{round?.title ?? roundTitle}</p>
        </DialogHeader>

        {!isLoading && allItems.length > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-100">
            {([
              { key: "all" as RecordsFilter, label: "全部", count: allItems.length },
              { key: "bid" as RecordsFilter, label: "已出價", count: withBid },
              { key: "nobid" as RecordsFilter, label: "未出價", count: noBid },
            ] as const).map(btn => (
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

        <div className="overflow-y-auto overflow-x-auto px-4" style={{ maxHeight: "50vh", scrollbarWidth: "thin" as const }}>
          {isLoading && <p className="text-center text-gray-400 text-sm py-10">載入中...</p>}
          {!isLoading && allItems.length === 0 && <p className="text-center text-gray-400 text-sm py-10">未有商品紀錄</p>}
          {!isLoading && items.length === 0 && allItems.length > 0 && <p className="text-center text-gray-400 text-sm py-10">沒有符合條件的商品</p>}
          {!isLoading && items.length > 0 && (
            <table ref={captureRef} style={{ borderCollapse: "collapse", fontSize: "11px", minWidth: "max-content", width: "100%", background: "#fff" }}>
              <thead>
                <tr style={{ background: "#fffbeb" }}>
                  <th style={recThStyle}>#</th>
                  <th style={{ ...recThStyle, minWidth: 160 }}>商品名稱</th>
                  {extraCols.length > 0
                    ? extraCols.map((c: any) => <th key={c.key} style={{ ...recThStyle, minWidth: 80 }}>{c.label || "號碼"}</th>)
                    : <th style={{ ...recThStyle, minWidth: 80 }}>商品號碼</th>
                  }
                  <th style={{ ...recThStyle, minWidth: 80, textAlign: "right" }}>起拍價</th>
                  <th style={{ ...recThStyle, minWidth: 90, textAlign: "right" }}>領先價錢</th>
                  <th style={{ ...recThStyle, minWidth: 110 }}>
                    <button
                      className="flex items-center gap-1"
                      style={{ color: sortDir !== "none" ? "#d97706" : "#92400e" }}
                      onClick={() => setSortDir(d => d === "none" ? "asc" : d === "asc" ? "desc" : "none")}
                    >
                      領先用戶 <SortIcon className="w-3 h-3" />
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((item: any, idx: number) => {
                  const d = getItemData(item);
                  const itemTitle = titleCol ? d[titleCol.key] : `商品 ${idx + 1}`;
                  const hasBid = item.topBidderId != null;
                  return (
                    <tr key={item.id} style={{ borderBottom: "1px solid #f3f4f6", background: hasBid ? "#fffdf5" : "#fff" }}>
                      <td style={recTdStyle}>{idx + 1}</td>
                      <td style={{ ...recTdStyle, minWidth: 160, whiteSpace: "nowrap" }}>{itemTitle || "—"}</td>
                      {extraCols.length > 0
                        ? extraCols.map((c: any) => (
                            <td key={c.key} style={{ ...recTdStyle, minWidth: 80, whiteSpace: "nowrap", fontWeight: 600, color: "#374151" }}>
                              {d[c.key] || "—"}
                            </td>
                          ))
                        : <td style={{ ...recTdStyle, minWidth: 80, color: "#9ca3af" }}>—</td>
                      }
                      <td style={{ ...recTdStyle, minWidth: 80, textAlign: "right", color: "#6b7280", whiteSpace: "nowrap" }}>
                        {fmtP(item.startPrice)}
                      </td>
                      <td style={{ ...recTdStyle, minWidth: 90, textAlign: "right", fontWeight: hasBid ? 700 : 400, color: hasBid ? "#d97706" : "#d1d5db", whiteSpace: "nowrap" }}>
                        {hasBid ? fmtP(item.currentPrice) : "—"}
                      </td>
                      <td style={{ ...recTdStyle, minWidth: 110, whiteSpace: "nowrap", color: hasBid ? "#374151" : "#d1d5db" }}>
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

        {!isLoading && allItems.length > 0 && (
          <div className="flex items-center gap-4 px-4 py-2 border-t border-gray-100 bg-gray-50">
            <span className="text-xs text-gray-500">共 <strong>{allItems.length}</strong> 件</span>
            <span className="text-xs text-emerald-600">已出價 <strong>{withBid}</strong> 件</span>
            <span className="text-xs text-gray-400">未出價 <strong>{noBid}</strong> 件</span>
          </div>
        )}

        {!isLoading && allItems.length > 0 && (
          <div className="flex gap-2 px-4 pb-4 pt-2">
            <button
              onClick={saveImage}
              className="flex-1 flex items-center justify-center gap-1.5 text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-2 rounded-xl"
            >
              <Download className="w-3.5 h-3.5" /> 儲存圖片
            </button>
            <button
              onClick={handlePrint}
              className="flex-1 flex items-center justify-center gap-1.5 text-xs bg-amber-50 hover:bg-amber-100 text-amber-700 px-3 py-2 rounded-xl"
            >
              <Printer className="w-3.5 h-3.5" /> 列印
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function statusLabel(s: string) {
  if (s === "draft") return { text: "草稿", cls: "bg-gray-100 text-gray-600" };
  if (s === "published") return { text: "進行中", cls: "bg-green-100 text-green-700" };
  return { text: "已結束", cls: "bg-amber-100 text-amber-700" };
}

function fmtDate(d: string | Date | null) {
  if (!d) return "—";
  const dt = new Date(d);
  return `${dt.getMonth() + 1}/${dt.getDate()} ${dt.getHours().toString().padStart(2, "0")}:${dt.getMinutes().toString().padStart(2, "0")}`;
}

function fmtDateShort(d: string | Date | null) {
  if (!d) return "—";
  const dt = new Date(d);
  return `${dt.getMonth() + 1}月${dt.getDate()}日 ${dt.getHours().toString().padStart(2, "0")}:${dt.getMinutes().toString().padStart(2, "0")}`;
}

type DestroyTarget = { round: any; step: 1 | 2; inputVal: string } | null;

export default function GroupAuctionList() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const confirm = useConfirm();
  const [activeTab, setActiveTab] = useState<"published" | "draft" | "ended" | "archived">("published");
  const [posterRound, setPosterRound] = useState<any | null>(null);
  const [commissionRound, setCommissionRound] = useState<any | null>(null);
  const [platformCommissionRound, setPlatformCommissionRound] = useState<any | null>(null);
  const [recordsRound, setRecordsRound] = useState<any | null>(null);
  const [recPreviewUrl, setRecPreviewUrl] = useState<string | null>(null);
  const [recPreviewFilename, setRecPreviewFilename] = useState("");
  const [destroyTarget, setDestroyTarget] = useState<DestroyTarget>(null);

  const { data: rounds, isLoading, refetch } = trpc.groupAuctions.myListRounds.useQuery(undefined, {
    enabled: !!user,
  });

  const { data: merchantApp } = trpc.merchants.myApplication.useQuery(undefined, { enabled: !!user });

  const deleteMut = trpc.groupAuctions.deleteRound.useMutation({
    onSuccess: () => { toast.success("已刪除"); refetch(); },
    onError: (e) => toast.error(e.message || "刪除失敗"),
  });

  const destroyMut = trpc.groupAuctions.destroyRound.useMutation({
    onSuccess: () => {
      toast.success("場次已拆除");
      refetch();
      setDestroyTarget(null);
    },
    onError: (e) => toast.error(e.message || "拆除失敗"),
  });

  const publishMut = trpc.groupAuctions.publishRound.useMutation({
    onSuccess: () => { toast.success("已發布，出價頁已公開"); refetch(); },
    onError: (e) => toast.error(e.message || "發布失敗"),
  });

  const endMut = trpc.groupAuctions.endRound.useMutation({
    onSuccess: () => { toast.success("場次已結拍"); refetch(); },
    onError: (e) => toast.error(e.message || "結拍失敗"),
  });

  const archiveMut = trpc.groupAuctions.archiveRound.useMutation({
    onSuccess: () => { toast.success("已封存"); refetch(); },
    onError: (e) => toast.error(e.message || "封存失敗"),
  });

  const unarchiveMut = trpc.groupAuctions.unarchiveRound.useMutation({
    onSuccess: () => { toast.success("已取消封存"); refetch(); },
    onError: (e) => toast.error(e.message || "取消封存失敗"),
  });

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Header />
      <div className="max-w-2xl mx-auto px-[3px] pt-4">
        <div className="flex items-center gap-2 mb-4">
          <button onClick={() => setLocation("/merchant-dashboard")} className="text-gray-500 hover:text-gray-700">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold text-gray-900">團購拍賣</h1>
          <div className="ml-auto">
            <Link href="/merchant/group-auctions/new">
              <button className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium px-3 py-1.5 rounded-xl">
                <Plus className="w-4 h-4" />
                新建場次
              </button>
            </Link>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-4">
          {(["published", "draft", "ended", "archived"] as const).map(tab => {
            const labels = { published: "Live", draft: "草稿", ended: "已結束", archived: "封存" };
            const count = tab === "archived"
              ? rounds?.filter(r => r.status === "ended" && r.isArchived).length ?? 0
              : tab === "ended"
              ? rounds?.filter(r => r.status === "ended" && !r.isArchived).length ?? 0
              : rounds?.filter(r => r.status === tab).length ?? 0;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 text-xs py-1.5 rounded-lg font-medium transition-colors ${
                  activeTab === tab ? "bg-white text-amber-700 shadow-sm" : "text-gray-500"
                }`}
              >
                {labels[tab]}{count > 0 ? ` (${count})` : ""}
              </button>
            );
          })}
        </div>

        {isLoading && (
          <div className="text-center py-12 text-gray-400 text-sm">載入中...</div>
        )}

        {!isLoading && (() => {
          const visible = activeTab === "archived"
            ? rounds?.filter(r => r.status === "ended" && r.isArchived)
            : activeTab === "ended"
            ? rounds?.filter(r => r.status === "ended" && !r.isArchived)
            : rounds?.filter(r => r.status === activeTab);
          if ((visible?.length ?? 0) > 0) return null;
          const emptyMsg: Record<string, string> = {
            published: "未有進行中場次", draft: "未有草稿場次",
            ended: "未有已結束場次", archived: "未有封存場次",
          };
          return (
            <div className="text-center py-16 text-gray-400">
              <Archive className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">{emptyMsg[activeTab]}</p>
            </div>
          );
        })()}

        <div className="space-y-3">
          {(activeTab === "archived"
            ? rounds?.filter(r => r.status === "ended" && r.isArchived)
            : activeTab === "ended"
            ? rounds?.filter(r => r.status === "ended" && !r.isArchived)
            : rounds?.filter(r => r.status === activeTab)
          )?.map((r) => {
            const sl = statusLabel(r.status);
            return (
              <div key={r.id} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  {r.coverImage ? (
                    <img src={r.coverImage} className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
                      <Archive className="w-6 h-6 text-amber-300" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sl.cls}`}>{sl.text}</span>
                      {r.periodNumber && (
                        <span className="text-xs text-gray-400">第 {r.periodNumber} 期</span>
                      )}
                    </div>
                    <p className="font-semibold text-gray-900 mt-1 truncate">{r.title}</p>
                    <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                      <Clock className="w-3 h-3" />
                      {r.startAt || r.endAt
                        ? `開拍時間：${fmtDateShort(r.startAt ?? null)} 至 ${fmtDateShort(r.endAt ?? null)}`
                        : "未設開拍時間"}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  <Link href={r.status === "ended"
                    ? `/merchant/group-auctions/${r.id}?tab=results`
                    : `/merchant/group-auctions/${r.id}`}>
                    <button className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border ${
                      r.status === "ended"
                        ? "bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200"
                        : "bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-200"
                    }`}>
                      {r.status === "ended" ? <Archive className="w-3 h-3" /> : <Pencil className="w-3 h-3" />}
                      {r.status === "ended" ? "成績紀錄" : "管理"}
                    </button>
                  </Link>

                  {r.status === "published" && (
                    <Link href={`/group/${r.id}`}>
                      <button className="flex items-center gap-1 text-xs bg-green-100 hover:bg-green-200 text-green-700 px-3 py-1.5 rounded-lg">
                        <Globe className="w-3 h-3" />
                        出價頁
                      </button>
                    </Link>
                  )}

                  {r.status === "published" && (
                    <button
                      onClick={() => setRecordsRound(r)}
                      className="flex items-center gap-1 text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-3 py-1.5 rounded-lg"
                    >
                      <ListOrdered className="w-3 h-3" />
                      拍賣紀錄
                    </button>
                  )}

                  <button
                    onClick={() => setPosterRound(r)}
                    className="flex items-center gap-1 text-xs bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 px-3 py-1.5 rounded-lg"
                  >
                    <QrCode className="w-3 h-3" />
                    入場海報
                  </button>

                  {r.status === "published" && (
                    <GroupAuctionShareMenu
                      roundId={r.id}
                      title={r.title}
                      endAt={r.endAt}
                    />
                  )}

                  {r.status === "draft" && (
                    <button
                      onClick={async () => {
                        const ok = await confirm({ title: "發布場次", description: "發布後出價頁即時公開，確認？" });
                        if (ok) publishMut.mutate({ id: r.id });
                      }}
                      className="flex items-center gap-1 text-xs bg-amber-100 hover:bg-amber-200 text-amber-700 px-3 py-1.5 rounded-lg"
                    >
                      <Globe className="w-3 h-3" />
                      發布
                    </button>
                  )}

                  {r.status === "published" && (
                    <button
                      onClick={async () => {
                        const ok = await confirm({ title: "手動結拍", description: "結拍後所有仍 active 商品將標記為結果，無法再出價。確認？" });
                        if (ok) endMut.mutate({ id: r.id });
                      }}
                      className="flex items-center gap-1 text-xs bg-rose-100 hover:bg-rose-200 text-rose-700 px-3 py-1.5 rounded-lg"
                    >
                      <Archive className="w-3 h-3" />
                      結拍
                    </button>
                  )}

                  {/* 已結束 + 封存 tab 共用：買家傭金 / 平台傭金 */}
                  {r.status === "ended" && (
                    <>
                      <button
                        onClick={() => setCommissionRound(r)}
                        className="flex items-center gap-1 text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-lg"
                      >
                        <Receipt className="w-3 h-3" />
                        買家傭金
                      </button>
                      <button
                        onClick={() => setPlatformCommissionRound(r)}
                        className="flex items-center gap-1 text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-3 py-1.5 rounded-lg"
                      >
                        <Receipt className="w-3 h-3" />
                        平台傭金
                      </button>

                      {/* 已結束（非封存）：封存 + 拆除 */}
                      {!r.isArchived ? (
                        <>
                          <button
                            onClick={async () => {
                              const ok = await confirm({ title: "封存場次", description: "封存後場次會移至封存tab，可隨時取消封存。確認？" });
                              if (ok) archiveMut.mutate({ id: r.id });
                            }}
                            className="flex items-center gap-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-500 border border-gray-300 px-3 py-1.5 rounded-lg"
                          >
                            <Archive className="w-3 h-3" />
                            封存
                          </button>
                          <button
                            onClick={() => setDestroyTarget({ round: r, step: 1, inputVal: "" })}
                            className="flex items-center gap-1 text-xs bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-3 py-1.5 rounded-lg"
                          >
                            <Trash2 className="w-3 h-3" />
                            拆除
                          </button>
                        </>
                      ) : (
                        /* 封存 tab：取消封存 */
                        <button
                          onClick={() => unarchiveMut.mutate({ id: r.id })}
                          className="flex items-center gap-1 text-xs bg-amber-50 hover:bg-amber-100 text-amber-600 border border-amber-200 px-3 py-1.5 rounded-lg"
                        >
                          <Archive className="w-3 h-3" />
                          取消封存
                        </button>
                      )}
                    </>
                  )}

                  {r.status === "draft" && (
                    <button
                      onClick={async () => {
                        const ok = await confirm({ title: "刪除場次", description: "刪除後不可恢復，所有商品及出價記錄一併刪除。確認？" });
                        if (ok) deleteMut.mutate({ id: r.id });
                      }}
                      className="flex items-center gap-1 text-xs bg-red-50 hover:bg-red-100 text-red-500 px-3 py-1.5 rounded-lg"
                    >
                      <Trash2 className="w-3 h-3" />
                      刪除
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <BottomNav />

      {/* Poster modal */}
      {posterRound && (
        <GroupAuctionPosterModal
          open={!!posterRound}
          onClose={() => setPosterRound(null)}
          round={posterRound}
          merchantName={(merchantApp as any)?.merchantName ?? (user as any)?.name}
          merchantAvatar={(merchantApp as any)?.merchantIcon || (user as any)?.photoUrl}
        />
      )}

      {recordsRound && (
        <AuctionRecordsSheet
          roundId={recordsRound.id}
          roundTitle={recordsRound.title}
          onClose={() => setRecordsRound(null)}
          onSaveImage={(url, fn) => { setRecPreviewUrl(url); setRecPreviewFilename(fn); }}
        />
      )}

      {recPreviewUrl && (
        <div className="fixed inset-0 z-[10000] bg-black/90 flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-sm flex flex-col items-center gap-3">
            <img
              src={recPreviewUrl}
              alt="拍賣紀錄"
              className="w-full rounded-2xl shadow-2xl object-contain"
              style={{ maxHeight: "70vh" }}
            />
            <p className="text-white/60 text-xs text-center">長按圖片儲存至相冊</p>
            <div className="flex gap-3 w-full">
              <a
                href={recPreviewUrl}
                download={recPreviewFilename}
                className="flex-1 flex items-center justify-center gap-1.5 text-sm bg-white/15 hover:bg-white/25 text-white px-4 py-2.5 rounded-xl"
              >
                <Download className="w-4 h-4" /> 下載
              </a>
              <button
                onClick={() => setRecPreviewUrl(null)}
                className="flex-1 text-sm bg-white/10 hover:bg-white/20 text-white/80 px-4 py-2.5 rounded-xl"
              >
                關閉
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Commission modals — 已結束 + 封存 tab 共用同一 component */}
      {commissionRound && (
        <GroupAuctionCommissionModal
          open={!!commissionRound}
          onClose={() => setCommissionRound(null)}
          roundId={commissionRound.id}
          roundTitle={commissionRound.title}
          type="buyer"
        />
      )}
      {platformCommissionRound && (
        <GroupAuctionCommissionModal
          open={!!platformCommissionRound}
          onClose={() => setPlatformCommissionRound(null)}
          roundId={platformCommissionRound.id}
          roundTitle={platformCommissionRound.title}
          type="platform"
        />
      )}

      {/* 拆除確認 — 單一 AlertDialog，step 控制內容 */}
      <AlertDialog open={!!destroyTarget} onOpenChange={(open) => { if (!open && !destroyMut.isPending) setDestroyTarget(null); }}>
        <AlertDialogContent>
          {destroyTarget?.step === 1 ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>拆除場次？</AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="text-sm text-gray-600 space-y-2">
                    <p>此操作不可撤銷，以下資料將被永久刪除：</p>
                    <ul className="list-disc list-inside text-gray-500 space-y-1">
                      <li>場次資料及所有商品</li>
                      <li>所有出價紀錄</li>
                      <li>場次圖片</li>
                    </ul>
                    <p className="text-amber-700 font-medium">已扣除的平台傭金保留在保證金紀錄，不受影響。</p>
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setDestroyTarget(null)}>取消</AlertDialogCancel>
                <button
                  className="inline-flex items-center justify-center rounded-md bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2"
                  onClick={() => setDestroyTarget(prev => prev ? { ...prev, step: 2 } : null)}
                >
                  繼續
                </button>
              </AlertDialogFooter>
            </>
          ) : (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>輸入場次名稱確認</AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="text-sm text-gray-600 space-y-3">
                    <p>請輸入以下場次名稱以確認拆除：</p>
                    <p className="font-semibold text-gray-900 bg-gray-100 rounded-lg px-3 py-2 break-all">
                      {destroyTarget?.round?.title}
                    </p>
                    <input
                      className="w-full text-sm outline-none px-3 py-2"
                      style={{ background: "#fff", border: "1px solid #E5E5E5", borderRadius: "12px" }}
                      placeholder="輸入場次名稱..."
                      value={destroyTarget?.inputVal ?? ""}
                      onChange={(e) => setDestroyTarget(prev => prev ? { ...prev, inputVal: e.target.value } : null)}
                    />
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setDestroyTarget(null)}>取消</AlertDialogCancel>
                <button
                  className="inline-flex items-center justify-center rounded-md bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2 disabled:opacity-40"
                  disabled={destroyTarget?.inputVal !== destroyTarget?.round?.title || destroyMut.isPending}
                  onClick={() => {
                    if (destroyTarget && destroyTarget.inputVal === destroyTarget.round.title) {
                      destroyMut.mutate({ id: destroyTarget.round.id });
                    }
                  }}
                >
                  {destroyMut.isPending ? "拆除中..." : "確認拆除"}
                </button>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
