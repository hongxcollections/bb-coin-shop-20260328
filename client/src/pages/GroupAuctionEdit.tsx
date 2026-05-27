import { useState, useEffect, useRef } from "react";
import { useLocation, useParams } from "wouter";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useConfirm } from "@/components/ui/confirm-provider";
import { toast } from "sonner";
import {
  ChevronLeft, Plus, Trash2, ArrowUp, ArrowDown, Upload,
  Save, FileSpreadsheet, Download, GripVertical, Pencil, CheckSquare, Square, X,
} from "lucide-react";

// ── 型別定義 ────────────────────────────────────────────────────────────────
type ColumnRole = "itemTitle" | "startPrice" | "buyNowPrice" | "bidIncrement" | "imageRef" | "customText";

interface ColumnDef {
  key: string;
  label: string;
  role: ColumnRole;
  required: boolean;
  showOnBidPage: boolean;
}

const ROLE_LABELS: Record<ColumnRole, string> = {
  itemTitle: "商品名稱（必填）",
  startPrice: "起拍價（必填）",
  buyNowPrice: "封頂/直購價",
  bidIncrement: "每口加價",
  imageRef: "圖片序號",
  customText: "自由欄位",
};

const PRESET_TEMPLATES: { name: string; columns: ColumnDef[] }[] = [
  {
    name: "PMG 評級幣（標準）",
    columns: [
      { key: "name", label: "品名", role: "itemTitle", required: true, showOnBidPage: true },
      { key: "grade", label: "評分", role: "customText", required: false, showOnBidPage: true },
      { key: "serial", label: "號碼", role: "customText", required: false, showOnBidPage: true },
      { key: "start", label: "起拍價", role: "startPrice", required: true, showOnBidPage: true },
      { key: "cap", label: "封頂價", role: "buyNowPrice", required: false, showOnBidPage: true },
    ],
  },
  {
    name: "普通紙幣",
    columns: [
      { key: "name", label: "品名", role: "itemTitle", required: true, showOnBidPage: true },
      { key: "desc", label: "描述", role: "customText", required: false, showOnBidPage: true },
      { key: "start", label: "起拍價", role: "startPrice", required: true, showOnBidPage: true },
    ],
  },
];

function genKey() { return `col_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`; }

function formatDateTimeLocal(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ── 主元件 ───────────────────────────────────────────────────────────────────
export default function GroupAuctionEdit() {
  const params = useParams<{ id?: string }>();
  const roundId = params.id ? parseInt(params.id, 10) : null;
  const isNew = !roundId;
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const confirm = useConfirm();
  const [tab, setTab] = useState<"basic" | "columns" | "images" | "items">("basic");

  // ── 基本設定 state ──
  const [basic, setBasic] = useState({
    title: "",
    periodNumber: "",
    description: "",
    coverImage: "",
    startAt: "",
    endAt: formatDateTimeLocal(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)),
    defaultBidIncrement: "50",
    buyerCommissionRate: "0",
    antiSnipeMinutes: "5",
    antiSnipeExtendMinutes: "5",
    antiSnipeMode: "per_item" as "none" | "per_item" | "whole_round",
    displayCurrencies: "HKD,CNY",
  });

  // ── 欄位設定 state ──
  const [columns, setColumns] = useState<ColumnDef[]>([
    { key: "name", label: "品名", role: "itemTitle", required: true, showOnBidPage: true },
    { key: "start", label: "起拍價", role: "startPrice", required: true, showOnBidPage: true },
  ]);
  const [templateName, setTemplateName] = useState("");
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);

  // ── 圖片集 state ──
  const [images, setImages] = useState<{ id: number; url: string; s3Key: string }[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const imageFileRef = useRef<HTMLInputElement>(null);

  // ── 商品 state ──
  const [items, setItems] = useState<any[]>([]);
  const [csvText, setCsvText] = useState("");
  const [showCsvImport, setShowCsvImport] = useState(false);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [csvMapping, setCsvMapping] = useState<Record<string, string>>({});
  // 批量刪除
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  // 行內編輯
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [editFields, setEditFields] = useState<Record<string, string>>({});

  // ── tRPC ──
  const { data: roundData, isLoading, refetch } = trpc.groupAuctions.getMine.useQuery(
    { id: roundId! },
    { enabled: !!roundId && !!user }
  );
  const { data: templates } = trpc.groupAuctions.listTemplates.useQuery(undefined, { enabled: !!user });

  const createMut = trpc.groupAuctions.createRound.useMutation({
    onSuccess: (d) => { toast.success("場次已建立"); setLocation(`/merchant/group-auctions/${d.id}`); },
    onError: (e) => toast.error(e.message || "建立失敗"),
  });
  const updateMut = trpc.groupAuctions.updateRound.useMutation({
    onSuccess: () => { toast.success("已儲存"); refetch(); },
    onError: (e) => toast.error(e.message || "儲存失敗"),
  });
  const saveTemplateMut = trpc.groupAuctions.saveTemplate.useMutation({
    onSuccess: () => { toast.success("Template 已儲存"); setShowSaveTemplate(false); },
    onError: (e) => toast.error(e.message || "儲存失敗"),
  });
  const recordImageMut = trpc.groupAuctions.recordImage.useMutation();
  const deleteImageMut = trpc.groupAuctions.deleteImage.useMutation({
    onSuccess: () => refetch(),
    onError: (e) => toast.error(e.message || "刪除失敗"),
  });
  const importItemsMut = trpc.groupAuctions.importItems.useMutation({
    onSuccess: (d) => { toast.success(`已匯入 ${d.imported} 件商品`); setShowCsvImport(false); refetch(); },
    onError: (e) => toast.error(e.message || "匯入失敗"),
  });
  const updateItemMut = trpc.groupAuctions.updateItem.useMutation({
    onSuccess: () => { setEditingItemId(null); refetch(); },
    onError: (e) => toast.error(e.message || "更新失敗"),
  });
  const deleteItemMut = trpc.groupAuctions.deleteItem.useMutation({
    onSuccess: () => { toast.success("已刪除"); refetch(); },
    onError: (e) => toast.error(e.message || "刪除失敗"),
  });
  const batchDeleteItemsMut = trpc.groupAuctions.batchDeleteItems.useMutation({
    onSuccess: (r) => {
      toast.success(`已刪除 ${r.deleted} 件`);
      setSelectedIds(new Set());
      setSelectMode(false);
      refetch();
    },
    onError: (e) => toast.error(e.message || "批量刪除失敗"),
  });
  const reorderItemsMut = trpc.groupAuctions.reorderItems.useMutation({
    onError: (e) => toast.error(e.message || "排序失敗"),
  });

  // ── 載入現有場次資料 ──
  useEffect(() => {
    if (!roundData) return;
    const r = roundData.round;
    setBasic({
      title: r.title,
      periodNumber: r.periodNumber ?? "",
      description: r.description ?? "",
      coverImage: r.coverImage ?? "",
      startAt: r.startAt ? formatDateTimeLocal(new Date(r.startAt)) : "",
      endAt: r.endAt ? formatDateTimeLocal(new Date(r.endAt)) : "",
      defaultBidIncrement: String(r.defaultBidIncrement),
      buyerCommissionRate: String(parseFloat(String(r.buyerCommissionRate)) * 100),
      antiSnipeMinutes: String(r.antiSnipeMinutes),
      antiSnipeExtendMinutes: String(r.antiSnipeExtendMinutes),
      antiSnipeMode: r.antiSnipeMode,
      displayCurrencies: (r as any).displayCurrencies ?? "HKD,CNY",
    });
    if (r.columnsJson) {
      try { setColumns(JSON.parse(r.columnsJson)); } catch {}
    }
    setImages(roundData.images.map(img => ({ id: img.id, url: img.url, s3Key: img.s3Key })));
    setItems(roundData.items);
  }, [roundData]);

  // ── 儲存基本設定 ──
  function handleSaveBasic() {
    const payload = {
      title: basic.title.trim(),
      periodNumber: basic.periodNumber || undefined,
      description: basic.description || undefined,
      coverImage: basic.coverImage || undefined,
      startAt: basic.startAt || undefined,
      endAt: basic.endAt || undefined,
      defaultBidIncrement: parseInt(basic.defaultBidIncrement, 10) || 50,
      buyerCommissionRate: (parseFloat(basic.buyerCommissionRate) || 0) / 100,
      antiSnipeMinutes: parseInt(basic.antiSnipeMinutes, 10) || 0,
      antiSnipeExtendMinutes: parseInt(basic.antiSnipeExtendMinutes, 10) || 5,
      antiSnipeMode: basic.antiSnipeMode,
      displayCurrencies: basic.displayCurrencies || "HKD,CNY",
      columnsJson: JSON.stringify(columns),
    };
    if (!payload.title) { toast.error("請輸入場次名稱"); return; }
    if (isNew) {
      createMut.mutate(payload);
    } else {
      updateMut.mutate({ id: roundId!, ...payload });
    }
  }

  // ── 儲存欄位設定 ──
  function handleSaveColumns() {
    if (!roundId) { toast.error("請先儲存基本設定"); return; }
    const hasTitleRole = columns.some(c => c.role === "itemTitle");
    const hasPriceRole = columns.some(c => c.role === "startPrice");
    if (!hasTitleRole || !hasPriceRole) {
      toast.error("欄位設定必須包含「商品名稱」和「起拍價」角色");
      return;
    }
    updateMut.mutate({ id: roundId, columnsJson: JSON.stringify(columns) });
  }

  // ── 上載圖片 ──
  async function handleImageUpload(files: FileList) {
    if (!roundId) { toast.error("請先儲存場次"); return; }
    setUploadingImages(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const res = await fetch("/api/trpc/groupAuctions.getImageUploadUrl", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            json: { roundId, filename: file.name, mimeType: file.type },
          }),
        });
        const json = await res.json();
        const { uploadUrl, publicUrl, s3Key } = json?.result?.data?.json ?? {};
        if (!uploadUrl) throw new Error("取得上載 URL 失敗");
        await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
        const img = await recordImageMut.mutateAsync({
          roundId, s3Key, url: publicUrl, displayOrder: images.length + i,
        });
        setImages(prev => [...prev, { id: img.id, url: publicUrl, s3Key }]);
      }
      toast.success(`已上載 ${files.length} 張圖片`);
    } catch (e: any) {
      toast.error(e.message || "上載失敗");
    } finally {
      setUploadingImages(false);
      refetch();
    }
  }

  // ── CSV 解析（支援半形逗號、全形逗號、Tab） ──
  function parseCsv(text: string) {
    const lines = text.trim().split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) { toast.error("CSV 至少要有標題行和一行資料"); return; }
    // 自動偵測分隔符：優先 Tab，其次半形逗號，最後全形逗號
    const firstLine = lines[0];
    const delim = firstLine.includes("\t") ? "\t"
      : firstLine.includes(",") ? ","
      : "，";
    const splitLine = (l: string) =>
      l.split(delim).map(c => c.trim().replace(/^"|"$/g, ""));
    const headers = splitLine(firstLine);
    // 過濾全空行
    const rows = lines.slice(1)
      .map(splitLine)
      .filter(r => r.some(c => c !== ""));
    setCsvHeaders(headers);
    setCsvRows(rows);
    // 自動配對欄位（完全匹配 > 包含匹配 > 起頭匹配）
    const mapping: Record<string, string> = {};
    columns.forEach(col => {
      const exact = headers.find(h => h === col.label);
      const contains = headers.find(h =>
        h.toLowerCase().includes(col.label.toLowerCase()) ||
        col.label.toLowerCase().includes(h.toLowerCase())
      );
      const matched = exact ?? contains ?? undefined;
      if (matched) mapping[col.key] = matched;
    });
    setCsvMapping(mapping);
  }

  // ── CSV import 確認 ──
  function handleCsvImport() {
    if (!roundId) { toast.error("請先儲存場次"); return; }
    const titleCol = columns.find(c => c.role === "itemTitle");
    const priceCol = columns.find(c => c.role === "startPrice");
    if (!titleCol || !priceCol) { toast.error("欄位設定缺少名稱或起拍價角色"); return; }
    const items = csvRows.map(row => {
      const data: Record<string, string> = {};
      columns.forEach(col => {
        const csvHeader = csvMapping[col.key];
        const colIdx = csvHeader ? csvHeaders.indexOf(csvHeader) : -1;
        data[col.key] = colIdx >= 0 ? (row[colIdx] ?? "") : "";
      });
      const startPriceCsvHeader = csvMapping[priceCol.key];
      const startPriceIdx = startPriceCsvHeader ? csvHeaders.indexOf(startPriceCsvHeader) : -1;
      const startPrice = startPriceIdx >= 0 ? parseInt(row[startPriceIdx] ?? "0", 10) || 0 : 0;
      const buyNowCol = columns.find(c => c.role === "buyNowPrice");
      const buyNowHeader = buyNowCol ? csvMapping[buyNowCol.key] : undefined;
      const buyNowIdx = buyNowHeader ? csvHeaders.indexOf(buyNowHeader) : -1;
      const buyNowPrice = buyNowIdx >= 0 && row[buyNowIdx] ? parseInt(row[buyNowIdx], 10) || undefined : undefined;
      const incCol = columns.find(c => c.role === "bidIncrement");
      const incHeader = incCol ? csvMapping[incCol.key] : undefined;
      const incIdx = incHeader ? csvHeaders.indexOf(incHeader) : -1;
      const bidIncrement = incIdx >= 0 && row[incIdx] ? parseInt(row[incIdx], 10) || 0 : 0;
      return { dataJson: JSON.stringify(data), startPrice, bidIncrement, buyNowPrice };
    });
    importItemsMut.mutate({ roundId, items });
  }

  // ── 列移動 ──
  function moveColumn(idx: number, dir: -1 | 1) {
    const next = [...columns];
    const swap = idx + dir;
    if (swap < 0 || swap >= next.length) return;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    setColumns(next);
  }

  const round = roundData?.round;
  const isEnded = round?.status === "ended";
  const inputStyle = { background: "#fff", border: "1px solid #E5E5E5", borderRadius: "12px" };

  const TABS = [
    { key: "basic", label: "基本設定" },
    { key: "columns", label: "欄位設定" },
    { key: "images", label: "圖片集", disabled: isNew },
    { key: "items", label: "商品管理", disabled: isNew },
  ] as const;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Header />
      <div className="max-w-2xl mx-auto px-4 pt-4">
        <div className="flex items-center gap-2 mb-4">
          <button onClick={() => setLocation("/merchant/group-auctions")} className="text-gray-500">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold text-gray-900">
            {isNew ? "新建場次" : (round?.title || "編輯場次")}
          </h1>
          {round?.status && (
            <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${
              round.status === "draft" ? "bg-gray-100 text-gray-600" :
              round.status === "published" ? "bg-green-100 text-green-700" :
              "bg-amber-100 text-amber-700"
            }`}>
              {round.status === "draft" ? "草稿" : round.status === "published" ? "進行中" : "已結拍"}
            </span>
          )}
        </div>

        {/* 結拍後快速連結 */}
        {round?.status === "ended" && roundId && (
          <div className="flex gap-2 mb-4">
            <a href={`/merchant/group-auctions/${roundId}/export?format=by_order`}
              className="flex items-center gap-1 text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 px-3 py-1.5 rounded-xl">
              <Download className="w-3 h-3" /> 匯出 CSV（序號）
            </a>
            <a href={`/merchant/group-auctions/${roundId}/export?format=by_buyer`}
              className="flex items-center gap-1 text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 px-3 py-1.5 rounded-xl">
              <Download className="w-3 h-3" /> 匯出 CSV（買家）
            </a>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-4">
          {TABS.map(t => (
            <button
              key={t.key}
              disabled={"disabled" in t && t.disabled}
              onClick={() => setTab(t.key as any)}
              className={`flex-1 text-xs py-1.5 rounded-lg font-medium transition-colors ${
                tab === t.key ? "bg-white text-amber-700 shadow-sm" : "text-gray-500"
              } ${("disabled" in t && t.disabled) ? "opacity-40 cursor-not-allowed" : ""}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── 基本設定 Tab ── */}
        {tab === "basic" && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">場次名稱 *</label>
                <input
                  className="w-full px-3 py-2 text-sm outline-none"
                  style={inputStyle}
                  placeholder="例：廣州一品收藏商行 5月月度大拍"
                  value={basic.title}
                  onChange={e => setBasic(p => ({ ...p, title: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">期數（選填）</label>
                <input
                  className="w-full px-3 py-2 text-sm outline-none"
                  style={inputStyle}
                  placeholder="例：2000"
                  value={basic.periodNumber}
                  onChange={e => setBasic(p => ({ ...p, periodNumber: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">拍賣須知（選填）</label>
                <textarea
                  className="w-full px-3 py-2 text-sm outline-none resize-none"
                  style={inputStyle}
                  rows={3}
                  placeholder="例：本場拍賣不支持7天無理由退貨..."
                  value={basic.description}
                  onChange={e => setBasic(p => ({ ...p, description: e.target.value }))}
                />
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
              <p className="text-xs font-semibold text-gray-600">時間設定</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">開拍時間（選填）</label>
                  <input type="datetime-local" className="w-full px-3 py-2 text-sm outline-none" style={inputStyle}
                    value={basic.startAt} onChange={e => setBasic(p => ({ ...p, startAt: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">結拍時間</label>
                  <input type="datetime-local" className="w-full px-3 py-2 text-sm outline-none" style={inputStyle}
                    value={basic.endAt} onChange={e => setBasic(p => ({ ...p, endAt: e.target.value }))} />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
              <p className="text-xs font-semibold text-gray-600">出價規則</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">每口加價（HK$）</label>
                  <input className="w-full px-3 py-2 text-sm outline-none" style={inputStyle}
                    value={basic.defaultBidIncrement}
                    onChange={e => setBasic(p => ({ ...p, defaultBidIncrement: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">買家傭金（%）</label>
                  <input className="w-full px-3 py-2 text-sm outline-none" style={inputStyle}
                    placeholder="0 = 不收"
                    value={basic.buyerCommissionRate}
                    onChange={e => setBasic(p => ({ ...p, buyerCommissionRate: e.target.value }))} />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
              <p className="text-xs font-semibold text-gray-600">延時模式（Anti-snipe）</p>
              <div className="space-y-2">
                {[
                  { v: "none", label: "關閉" },
                  { v: "per_item", label: "單件延時（任何商品最後 X 分鐘有出價，延長該商品）" },
                  { v: "whole_round", label: "全場延時（任何商品出價，延長整場）" },
                ].map(opt => (
                  <label key={opt.v} className="flex items-start gap-2 cursor-pointer">
                    <input type="radio" className="mt-0.5" value={opt.v}
                      checked={basic.antiSnipeMode === opt.v}
                      onChange={() => setBasic(p => ({ ...p, antiSnipeMode: opt.v as any }))} />
                    <span className="text-sm text-gray-700">{opt.label}</span>
                  </label>
                ))}
              </div>
              {basic.antiSnipeMode !== "none" && (
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">觸發緩衝（分鐘）</label>
                    <input className="w-full px-3 py-2 text-sm outline-none" style={inputStyle}
                      value={basic.antiSnipeMinutes}
                      onChange={e => setBasic(p => ({ ...p, antiSnipeMinutes: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">延長時間（分鐘）</label>
                    <input className="w-full px-3 py-2 text-sm outline-none" style={inputStyle}
                      value={basic.antiSnipeExtendMinutes}
                      onChange={e => setBasic(p => ({ ...p, antiSnipeExtendMinutes: e.target.value }))} />
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
              <p className="text-xs font-semibold text-gray-600">出價頁貨幣顯示</p>
              <p className="text-xs text-gray-400">買家可在出價頁切換顯示貨幣（以 HKD 為底換算）。勾選越前，預設顯示越優先</p>
              <div className="flex flex-wrap gap-3">
                {(["HKD", "CNY", "USD", "JPY", "GBP", "EUR"] as const).map(cur => {
                  const list = basic.displayCurrencies.split(",").map(s => s.trim()).filter(Boolean);
                  const checked = list.includes(cur);
                  return (
                    <label key={cur} className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={e => {
                          const updated = [...list];
                          if (e.target.checked) { if (!updated.includes(cur)) updated.push(cur); }
                          else { const idx = updated.indexOf(cur); if (idx !== -1) updated.splice(idx, 1); }
                          setBasic(p => ({ ...p, displayCurrencies: updated.join(",") || "HKD" }));
                        }}
                      />
                      <span className="text-sm text-gray-700">{cur}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <button
              onClick={handleSaveBasic}
              disabled={createMut.isPending || updateMut.isPending}
              className="w-full bg-amber-500 hover:bg-amber-600 text-white font-semibold py-3 rounded-2xl"
            >
              {isNew ? "建立場次" : "儲存設定"}
            </button>
          </div>
        )}

        {/* ── 欄位設定 Tab ── */}
        {tab === "columns" && (
          <div className="space-y-4">
            {/* 從 Template 載入 */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <p className="text-xs font-semibold text-gray-600 mb-2">從 Template 載入</p>
              <div className="flex flex-wrap gap-2">
                {PRESET_TEMPLATES.map(pt => (
                  <button key={pt.name}
                    onClick={() => setColumns(pt.columns.map(c => ({ ...c, key: genKey() })))}
                    className="text-xs bg-amber-50 hover:bg-amber-100 text-amber-700 px-3 py-1.5 rounded-lg">
                    {pt.name}
                  </button>
                ))}
                {templates?.map(t => (
                  <button key={t.id}
                    onClick={() => { try { setColumns(JSON.parse(t.columnsJson)); } catch {} }}
                    className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg">
                    {t.name}
                  </button>
                ))}
              </div>
            </div>

            {/* 欄位列表 */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-2">
              <p className="text-xs font-semibold text-gray-600 mb-3">欄位設定（可上下調序）</p>
              {columns.map((col, idx) => (
                <div key={col.key} className="flex items-center gap-2 p-2 bg-gray-50 rounded-xl">
                  <GripVertical className="w-4 h-4 text-gray-300 flex-shrink-0" />
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    <input
                      className="px-2 py-1 text-sm outline-none"
                      style={{ ...inputStyle, borderRadius: "8px" }}
                      placeholder="欄位名稱"
                      value={col.label}
                      onChange={e => {
                        const next = [...columns];
                        next[idx] = { ...next[idx], label: e.target.value };
                        setColumns(next);
                      }}
                    />
                    <select
                      className="px-2 py-1 text-sm outline-none"
                      style={{ ...inputStyle, borderRadius: "8px" }}
                      value={col.role}
                      onChange={e => {
                        const next = [...columns];
                        next[idx] = { ...next[idx], role: e.target.value as ColumnRole };
                        setColumns(next);
                      }}
                    >
                      {(Object.entries(ROLE_LABELS) as [ColumnRole, string][]).map(([v, l]) => (
                        <option key={v} value={v}>{l}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => moveColumn(idx, -1)} disabled={idx === 0}
                      className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30">
                      <ArrowUp className="w-3 h-3" />
                    </button>
                    <button onClick={() => moveColumn(idx, 1)} disabled={idx === columns.length - 1}
                      className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30">
                      <ArrowDown className="w-3 h-3" />
                    </button>
                    <button onClick={() => setColumns(columns.filter((_, i) => i !== idx))}
                      className="p-1 text-red-400 hover:text-red-600">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}

              <button
                onClick={() => setColumns(prev => [...prev, { key: genKey(), label: "新欄位", role: "customText", required: false, showOnBidPage: true }])}
                className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700 mt-2"
              >
                <Plus className="w-3 h-3" /> 加欄位
              </button>
            </div>

            <div className="flex gap-2">
              <button onClick={handleSaveColumns}
                disabled={updateMut.isPending}
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-semibold py-2.5 rounded-2xl text-sm">
                <Save className="w-4 h-4 inline mr-1" />
                儲存欄位設定
              </button>
              <button onClick={() => setShowSaveTemplate(true)}
                className="bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium py-2.5 px-4 rounded-2xl text-sm">
                儲存為 Template
              </button>
            </div>

            {showSaveTemplate && (
              <div className="bg-white rounded-2xl border border-blue-100 p-4 space-y-3">
                <p className="text-sm font-medium text-gray-700">Template 名稱</p>
                <input className="w-full px-3 py-2 text-sm outline-none" style={inputStyle}
                  placeholder="例：PMG 評級幣（廣州一品）"
                  value={templateName}
                  onChange={e => setTemplateName(e.target.value)} />
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      if (!templateName.trim()) { toast.error("請輸入 Template 名稱"); return; }
                      saveTemplateMut.mutate({ name: templateName.trim(), columnsJson: JSON.stringify(columns) });
                    }}
                    className="flex-1 bg-blue-500 text-white text-sm py-2 rounded-xl">儲存</button>
                  <button onClick={() => setShowSaveTemplate(false)}
                    className="px-4 text-sm text-gray-500 py-2 rounded-xl bg-gray-100">取消</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── 圖片集 Tab ── */}
        {tab === "images" && roundId && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <p className="text-xs font-semibold text-gray-600 mb-3">場次圖片集（可配給商品）</p>
              <input ref={imageFileRef} type="file" accept="image/*" multiple className="hidden"
                onChange={e => e.target.files && handleImageUpload(e.target.files)} />
              <button
                onClick={() => imageFileRef.current?.click()}
                disabled={uploadingImages}
                className="flex items-center gap-2 w-full justify-center border-2 border-dashed border-amber-200 text-amber-600 hover:border-amber-400 rounded-xl py-4 text-sm"
              >
                <Upload className="w-4 h-4" />
                {uploadingImages ? "上載中..." : "點擊上載圖片（可多選）"}
              </button>
            </div>

            {images.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {images.map((img, idx) => (
                  <div key={img.id} className="relative rounded-xl overflow-hidden aspect-square">
                    <img src={img.url} className="w-full h-full object-cover" />
                    <div className="absolute top-1 left-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                      #{idx + 1}
                    </div>
                    <button
                      onClick={async () => {
                        const ok = await confirm({ title: "刪除圖片", description: "確認刪除這張圖片？" });
                        if (ok) deleteImageMut.mutate({ id: img.id });
                      }}
                      className="absolute top-1 right-1 bg-red-500/80 text-white rounded-full p-0.5"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {images.length === 0 && (
              <p className="text-center text-xs text-gray-400 py-4">未有圖片</p>
            )}
          </div>
        )}

        {/* ── 商品管理 Tab ── */}
        {tab === "items" && roundId && (
          <div className="space-y-4">
            {/* 工具列 */}
            <div className="flex flex-wrap gap-2 items-center">
              {!selectMode ? (
                <>
                  <button
                    onClick={() => setShowCsvImport(true)}
                    className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium px-3 py-2 rounded-xl"
                  >
                    <FileSpreadsheet className="w-4 h-4" /> 匯入 CSV
                  </button>
                  {!isEnded && items.length > 0 && (
                    <button
                      onClick={() => setSelectMode(true)}
                      className="flex items-center gap-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-2 rounded-xl"
                    >
                      <CheckSquare className="w-4 h-4" /> 批量刪除
                    </button>
                  )}
                </>
              ) : (
                <>
                  <button
                    onClick={() => {
                      if (selectedIds.size === items.length) {
                        setSelectedIds(new Set());
                      } else {
                        setSelectedIds(new Set(items.map(i => i.id)));
                      }
                    }}
                    className="flex items-center gap-1.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1.5 rounded-xl"
                  >
                    {selectedIds.size === items.length ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                    {selectedIds.size === items.length ? "取消全選" : `全選 (${items.length})`}
                  </button>
                  {selectedIds.size > 0 && (
                    <button
                      onClick={async () => {
                        const ok = await confirm({
                          title: "批量刪除",
                          description: `確認刪除選中的 ${selectedIds.size} 件商品？出價記錄一併刪除。`,
                        });
                        if (ok) batchDeleteItemsMut.mutate({ roundId: roundId!, ids: Array.from(selectedIds) });
                      }}
                      disabled={batchDeleteItemsMut.isPending}
                      className="flex items-center gap-1.5 text-xs bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-xl"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> 刪除 {selectedIds.size} 件
                    </button>
                  )}
                  <button
                    onClick={() => { setSelectMode(false); setSelectedIds(new Set()); }}
                    className="flex items-center gap-1 text-xs text-gray-500 px-3 py-1.5 rounded-xl bg-gray-100"
                  >
                    <X className="w-3.5 h-3.5" /> 取消
                  </button>
                </>
              )}
              {round?.status === "ended" && (
                <>
                  <ExportCsvButton roundId={roundId} format="by_order" label="匯出（序號）" columns={columns} />
                  <ExportCsvButton roundId={roundId} format="by_buyer" label="匯出（買家）" columns={columns} />
                </>
              )}
            </div>

            {/* CSV Import Dialog */}
            {showCsvImport && (
              <div className="bg-white rounded-2xl border border-amber-100 p-4 space-y-3">
                <p className="text-sm font-semibold text-gray-700">匯入 CSV</p>
                <p className="text-xs text-gray-500">貼上 CSV 內容（第一行為標題行，支援半形逗號、全形逗號、Tab）</p>
                <textarea
                  className="w-full px-3 py-2 text-xs outline-none resize-none font-mono"
                  style={inputStyle}
                  rows={6}
                  placeholder={"品名,描述,起拍\n生肖馬年,J098003688,100"}
                  value={csvText}
                  onChange={e => { setCsvText(e.target.value); }}
                  onBlur={() => csvText && parseCsv(csvText)}
                />
                <button
                  onClick={() => csvText && parseCsv(csvText)}
                  className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1.5 rounded-lg"
                >
                  解析
                </button>

                {csvHeaders.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-600 mb-2">欄位配對（CSV 列 → 系統欄位）</p>
                    <div className="space-y-2">
                      {columns.map(col => (
                        <div key={col.key} className="flex items-center gap-2">
                          <span className="text-xs text-gray-600 w-24 flex-shrink-0">{col.label}</span>
                          <select
                            className="flex-1 px-2 py-1 text-xs outline-none"
                            style={{ ...inputStyle, borderRadius: "8px" }}
                            value={csvMapping[col.key] ?? ""}
                            onChange={e => setCsvMapping(p => ({ ...p, [col.key]: e.target.value }))}
                          >
                            <option value="">（忽略）</option>
                            {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                          </select>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-gray-400 mt-2">識別到 {csvRows.length} 行 · 預覽：{csvRows[0]?.join(" | ")}</p>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={handleCsvImport}
                    disabled={importItemsMut.isPending || csvRows.length === 0}
                    className="flex-1 bg-amber-500 text-white text-sm py-2 rounded-xl"
                  >
                    確認匯入 {csvRows.length > 0 ? `(${csvRows.length} 件)` : ""}
                  </button>
                  <button onClick={() => { setShowCsvImport(false); setCsvText(""); setCsvHeaders([]); setCsvRows([]); }}
                    className="px-4 text-sm text-gray-500 py-2 rounded-xl bg-gray-100">取消</button>
                </div>
              </div>
            )}

            {/* 商品列表 */}
            {items.length === 0 && !showCsvImport && (
              <div className="text-center py-10 text-gray-400 text-sm">
                未有商品，請匯入 CSV
              </div>
            )}

            <div className="space-y-2">
              {items.map((item, idx) => {
                const data = (() => { try { return JSON.parse(item.dataJson); } catch { return {}; } })();
                const titleCol = columns.find(c => c.role === "itemTitle");
                const title = titleCol ? data[titleCol.key] : `商品 ${idx + 1}`;
                const hasBids = (item.bidCount ?? 0) > 0;
                const isEditing = editingItemId === item.id;
                const isSelected = selectedIds.has(item.id);

                return (
                  <div key={item.id}
                    className={`bg-white rounded-xl border p-3 transition-colors ${
                      isSelected ? "border-red-300 bg-red-50" : "border-gray-100"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {/* 多選 checkbox */}
                      {selectMode && (
                        <button
                          onClick={() => {
                            const next = new Set(selectedIds);
                            if (next.has(item.id)) next.delete(item.id);
                            else next.add(item.id);
                            setSelectedIds(next);
                          }}
                          className="flex-shrink-0"
                        >
                          {isSelected
                            ? <CheckSquare className="w-4 h-4 text-red-500" />
                            : <Square className="w-4 h-4 text-gray-300" />
                          }
                        </button>
                      )}

                      <span className="text-xs text-gray-400 w-6 text-center flex-shrink-0">{idx + 1}</span>

                      <div className="flex-1 min-w-0" onClick={() => {
                        if (selectMode) {
                          const next = new Set(selectedIds);
                          if (next.has(item.id)) next.delete(item.id); else next.add(item.id);
                          setSelectedIds(next);
                        }
                      }}>
                        <p className="text-sm font-medium text-gray-800 truncate">{title || "—"}</p>
                        {/* 顯示所有 customText 欄位（描述等） */}
                        {columns.filter(c => c.role === "customText" && data[c.key]).map(c => (
                          <p key={c.key} className="text-xs text-gray-500 truncate">{data[c.key]}</p>
                        ))}
                        <p className="text-xs text-gray-400">
                          起拍 HK${item.startPrice}
                          {item.buyNowPrice ? ` | 封頂 HK$${item.buyNowPrice}` : ""}
                          {hasBids && <span className="text-amber-600 ml-1">• 有出價</span>}
                          {item.status !== "active" && ` | ${item.status === "sold" ? "✓ 已成交" : "流拍"}`}
                        </p>
                      </div>

                      {!selectMode && !isEnded && (
                        <div className="flex gap-1 flex-shrink-0">
                          <button
                            onClick={() => {
                              if (isEditing) { setEditingItemId(null); return; }
                              setEditingItemId(item.id);
                              const ef: Record<string, string> = {};
                              columns.forEach(c => { ef[c.key] = data[c.key] ?? ""; });
                              ef.__startPrice = String(item.startPrice);
                              ef.__buyNowPrice = item.buyNowPrice ? String(item.buyNowPrice) : "";
                              ef.__bidIncrement = item.bidIncrement ? String(item.bidIncrement) : "";
                              setEditFields(ef);
                            }}
                            className="p-1.5 text-blue-400 hover:text-blue-600"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={async () => {
                              const ok = await confirm({ title: "刪除商品", description: "確認刪除？出價記錄一併刪除。" });
                              if (ok) deleteItemMut.mutate({ id: item.id });
                            }}
                            className="p-1.5 text-red-400 hover:text-red-600"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* 行內編輯展開 */}
                    {isEditing && (
                      <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                        {/* 只渲染 customText / imageRef 角色的欄位，價格欄位下方單獨處理 */}
                        {columns.filter(c => c.role !== "startPrice" && c.role !== "buyNowPrice" && c.role !== "bidIncrement").map(col => (
                          <div key={col.key} className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 w-20 flex-shrink-0">{col.label}</span>
                            <input
                              className="flex-1 px-2 py-1 text-sm outline-none"
                              style={{ background: "#fff", border: "1px solid #E5E5E5", borderRadius: "8px" }}
                              value={editFields[col.key] ?? ""}
                              onChange={e => setEditFields(p => ({ ...p, [col.key]: e.target.value }))}
                            />
                          </div>
                        ))}
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500 w-20 flex-shrink-0">起拍價</span>
                          <input
                            className="flex-1 px-2 py-1 text-sm outline-none"
                            style={{ background: hasBids ? "#f9fafb" : "#fff", border: "1px solid #E5E5E5", borderRadius: "8px", color: hasBids ? "#9ca3af" : undefined }}
                            disabled={hasBids}
                            placeholder={hasBids ? "已有出價，不可修改" : ""}
                            value={editFields.__startPrice ?? ""}
                            onChange={e => setEditFields(p => ({ ...p, __startPrice: e.target.value }))}
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500 w-20 flex-shrink-0">封頂價</span>
                          <input
                            className="flex-1 px-2 py-1 text-sm outline-none"
                            style={{ background: hasBids ? "#f9fafb" : "#fff", border: "1px solid #E5E5E5", borderRadius: "8px", color: hasBids ? "#9ca3af" : undefined }}
                            disabled={hasBids}
                            placeholder={hasBids ? "已有出價，不可修改" : "留空 = 無封頂"}
                            value={editFields.__buyNowPrice ?? ""}
                            onChange={e => setEditFields(p => ({ ...p, __buyNowPrice: e.target.value }))}
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500 w-20 flex-shrink-0">每口加價</span>
                          <input
                            className="flex-1 px-2 py-1 text-sm outline-none"
                            style={{ background: "#fff", border: "1px solid #E5E5E5", borderRadius: "8px" }}
                            placeholder="留空 = 用場次預設"
                            value={editFields.__bidIncrement ?? ""}
                            onChange={e => setEditFields(p => ({ ...p, __bidIncrement: e.target.value }))}
                          />
                        </div>
                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={() => {
                              const colData: Record<string, string> = {};
                              columns.forEach(c => { colData[c.key] = editFields[c.key] ?? ""; });
                              const patch: any = { id: item.id, dataJson: JSON.stringify(colData) };
                              if (!hasBids) {
                                patch.startPrice = parseInt(editFields.__startPrice || "0", 10) || 0;
                                const buyNow = editFields.__buyNowPrice ? parseInt(editFields.__buyNowPrice, 10) : null;
                                patch.buyNowPrice = buyNow && buyNow > 0 ? buyNow : null;
                              }
                              const inc = parseInt(editFields.__bidIncrement || "0", 10);
                              patch.bidIncrement = inc > 0 ? inc : 0;
                              updateItemMut.mutate(patch);
                            }}
                            disabled={updateItemMut.isPending}
                            className="flex-1 bg-amber-500 text-white text-xs py-1.5 rounded-lg"
                          >
                            儲存
                          </button>
                          <button
                            onClick={() => setEditingItemId(null)}
                            className="px-4 text-xs text-gray-500 py-1.5 rounded-lg bg-gray-100"
                          >
                            取消
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
}

// ── 匯出 CSV 按鈕 ────────────────────────────────────────────────────────────
function ExportCsvButton({ roundId, format, label, columns }: {
  roundId: number; format: "by_order" | "by_buyer"; label: string; columns: ColumnDef[];
}) {
  const { data, refetch } = trpc.groupAuctions.exportResults.useQuery(
    { roundId, format },
    { enabled: false }
  );

  function downloadCsv() {
    refetch().then((r) => {
      const rows = r.data?.rows;
      if (!rows || rows.length === 0) { toast.error("暫無結果資料"); return; }
      const cols = columns.map(c => c.label);
      const extraCols = ["起拍價", "成交價", "傭金率", "傭金", "應付總額", "買家", "狀態"];
      const header = [...cols, ...extraCols].join(",");
      const lines = rows.map((row: any) => {
        const colVals = columns.map(c => {
          const v = String(row[c.key] ?? "").replace(/,/g, "，");
          return v;
        });
        const extra = [
          row.startPrice ?? "",
          row.finalPrice ?? "",
          row.commissionRate ?? "",
          row.commission ?? "",
          row.total ?? "",
          String(row.buyerName ?? "").replace(/,/g, "，"),
          row.status ?? "",
        ];
        return [...colVals, ...extra].join(",");
      });
      const csv = [header, ...lines].join("\n");
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `group-auction-${roundId}-${format}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  return (
    <button onClick={downloadCsv}
      className="flex items-center gap-1 text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-2 rounded-xl">
      <Download className="w-3 h-3" /> {label}
    </button>
  );
}
