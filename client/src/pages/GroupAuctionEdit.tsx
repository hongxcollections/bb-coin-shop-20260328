import { useState, useEffect, useRef } from "react";
import { sify, tify } from "chinese-conv";
import { useLocation, useParams } from "wouter";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import { PinchZoomImage } from "@/components/PinchZoomImage";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useConfirm } from "@/components/ui/confirm-provider";
import { toast } from "sonner";
import {
  ChevronLeft, ChevronDown, Plus, Trash2, ArrowUp, ArrowDown, Upload,
  Save, FileSpreadsheet, Download, GripVertical, Pencil, CheckSquare, Square, X, Check, ZoomIn,
} from "lucide-react";

const CURR_SYMS: Record<string, string> = { HKD: "HK$", CNY: "¥", USD: "US$", JPY: "JP¥", GBP: "£", EUR: "€" };

// ── 型別定義 ────────────────────────────────────────────────────────────────
type ColumnRole = "itemTitle" | "itemNumber" | "startPrice" | "buyNowPrice" | "bidIncrement" | "imageRef" | "customText";

interface ColumnDef {
  key: string;
  label: string;
  role: ColumnRole;
  required: boolean;
  showOnBidPage: boolean;
}

const ROLE_LABELS: Record<ColumnRole, string> = {
  itemTitle: "商品名稱（必填）",
  itemNumber: "商品號碼（必填）",
  startPrice: "起拍價（必填）",
  buyNowPrice: "封頂/直購價",
  bidIncrement: "每口加價",
  imageRef: "圖片序號",
  customText: "自由欄位",
};

const PRESET_TEMPLATES: { name: string; columns: ColumnDef[] }[] = [
  {
    name: "綜合商品",
    columns: [
      { key: "name", label: "名稱", role: "itemTitle", required: true, showOnBidPage: true },
      { key: "serial", label: "號碼", role: "itemNumber", required: true, showOnBidPage: true },
      { key: "start", label: "起拍價", role: "startPrice", required: true, showOnBidPage: true },
    ],
  },
];

function genKey() { return `col_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`; }

const COLOR_PRESETS_LIST = [
  { key: "gold",   bg: "#b45309" },
  { key: "red",    bg: "#b91c1c" },
  { key: "green",  bg: "#15803d" },
  { key: "blue",   bg: "#1d4ed8" },
  { key: "orange", bg: "#c2410c" },
  { key: "purple", bg: "#7c3aed" },
  { key: "pink",   bg: "#be185d" },
  { key: "teal",   bg: "#0f766e" },
] as const;

function expandChinese(kw: string): string[] {
  const s = sify(kw); const t = tify(kw);
  return [...new Set([kw, s, t])].filter(Boolean);
}
function getColorRuleMatch(rules: { id: string; keywords: string; color: string; style?: string; weight?: string }[], itemData: Record<string, string>): { color: string; keywords: string[]; style: "bg" | "text"; weight: "bold" | "normal" } | null {
  if (!rules.length) return null;
  const allTextRaw = Object.values(itemData).join(" ").toLowerCase();
  const allTextS = sify(allTextRaw);
  for (const rule of rules) {
    const rawKws = rule.keywords.split(/[,，|｜\n]/).map(k => k.trim().toLowerCase()).filter(Boolean);
    if (!rawKws.length) continue;
    if (rawKws.some(kw => allTextRaw.includes(kw) || allTextS.includes(sify(kw)))) {
      const preset = COLOR_PRESETS_LIST.find(p => p.key === rule.color);
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
  const lower = text.toLowerCase();
  // 收集所有 keyword 的匹配位置
  const matches: { start: number; end: number }[] = [];
  for (const kw of kws) {
    if (!kw) continue;
    let from = 0;
    while (from < lower.length) {
      const idx = lower.indexOf(kw, from);
      if (idx < 0) break;
      matches.push({ start: idx, end: idx + kw.length });
      from = idx + kw.length;
    }
  }
  if (!matches.length) return <>{text}</>;
  // 排序 + 合併重疊範圍
  matches.sort((a, b) => a.start - b.start);
  const merged: { start: number; end: number }[] = [];
  for (const m of matches) {
    const last = merged[merged.length - 1];
    if (last && m.start < last.end) { last.end = Math.max(last.end, m.end); }
    else merged.push({ ...m });
  }
  // 建立 React nodes
  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  const spanStyle = style === "bg"
    ? { background: color, color: "#fff", padding: "0 2px", borderRadius: "3px", fontWeight: weight === "bold" ? 700 : 400 }
    : { color, fontWeight: weight === "bold" ? 700 : 400 };
  for (const { start, end } of merged) {
    if (cursor < start) nodes.push(text.slice(cursor, start));
    nodes.push(<span key={start} style={spanStyle}>{text.slice(start, end)}</span>);
    cursor = end;
  }
  if (cursor < text.length) nodes.push(text.slice(cursor));
  return <>{nodes}</>;
}

const COLOR_PRESETS = [
  { key: "gold",   label: "金", bg: "#b45309" },
  { key: "red",    label: "紅", bg: "#b91c1c" },
  { key: "green",  label: "綠", bg: "#15803d" },
  { key: "blue",   label: "藍", bg: "#1d4ed8" },
  { key: "orange", label: "橙", bg: "#c2410c" },
  { key: "purple", label: "紫", bg: "#7c3aed" },
  { key: "pink",   label: "粉", bg: "#be185d" },
  { key: "teal",   label: "青", bg: "#0f766e" },
] as const;
type ColorRuleKey = typeof COLOR_PRESETS[number]["key"];
type ColorRule = { id: string; keywords: string; color: ColorRuleKey; style: "bg" | "text"; weight: "bold" | "normal" };

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
  const tabParam = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("tab") : null;
  const [tab, setTab] = useState<"basic" | "columns" | "images" | "items" | "results">(
    (["basic", "columns", "images", "items", "results"] as const).includes(tabParam as any) ? tabParam as any : "basic"
  );
  const changeTab = (key: "basic" | "columns" | "images" | "items" | "results") => {
    setTab(key);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", key);
    window.history.replaceState(null, "", url.toString());
  };
  const [resultSortDir, setResultSortDir] = useState<"desc" | "asc">("desc");
  const [resultBuyerKey, setResultBuyerKey] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [invoiceBuyerKey, setInvoiceBuyerKey] = useState<string | null>(null);
  const invoiceRef = useRef<HTMLDivElement>(null);
  const [showAllInvoice, setShowAllInvoice] = useState(false);
  const allInvoiceRef = useRef<HTMLDivElement>(null);
  const [invoicePreviewUrl, setInvoicePreviewUrl] = useState<string | null>(null);
  const [invoicePreviewFilename, setInvoicePreviewFilename] = useState("");

  // ── 重拍 state ──
  const [relistMode, setRelistMode] = useState<"auction" | "product" | "group" | null>(null);
  const [relistSelectedIds, setRelistSelectedIds] = useState<Set<number>>(new Set());
  const [relistSheet, setRelistSheet] = useState(false);

  // 從列表頁「重拍」按鈕跳入時，自動啟動 relistMode
  useEffect(() => {
    const param = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("relist") : null;
    if (param === "auction" || param === "product" || param === "group") {
      setRelistMode(param);
      if (param === "group") changeTab("results");
      const url = new URL(window.location.href);
      url.searchParams.delete("relist");
      window.history.replaceState(null, "", url.toString());
    }
  }, []);

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
    displayCurrencies: "CNY",
    minDurationMinutes: "60",
  });

  // ── 欄位設定 state ──
  const [columns, setColumns] = useState<ColumnDef[]>(
    PRESET_TEMPLATES[0].columns.map(c => ({ ...c, key: genKey() }))
  );
  const [templateName, setTemplateName] = useState("");
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [colorRuleTemplateName, setColorRuleTemplateName] = useState("");
  const [showSaveColorRuleTemplate, setShowSaveColorRuleTemplate] = useState(false);
  const [colorRuleTemplateOverwriteId, setColorRuleTemplateOverwriteId] = useState<number | null>(null);

  // ── 圖片集 state ──
  const [images, setImages] = useState<{ id: number; url: string; s3Key: string }[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [imageUploadProgress, setImageUploadProgress] = useState<{ done: number; total: number } | null>(null);
  const imageFileRef = useRef<HTMLInputElement>(null);

  // ── 場次推廣圖片 state（存 {url, s3Key}，最多 10 張；兼容舊純 URL 格式）──
  const [promoImages, setPromoImages] = useState<{ url: string; s3Key: string }[]>([]);
  const [uploadingPromo, setUploadingPromo] = useState(false);
  const [colorRules, setColorRules] = useState<ColorRule[]>([]);
  const [promoUploadProgress, setPromoUploadProgress] = useState<{ done: number; total: number } | null>(null);
  const promoFileRef = useRef<HTMLInputElement>(null);

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
  // 批量改價
  const [bulkPriceMode, setBulkPriceMode] = useState(false);
  const [bulkStartPrice, setBulkStartPrice] = useState("");
  const [bulkBidIncrement, setBulkBidIncrement] = useState("");
  const [bulkBuyNowPrice, setBulkBuyNowPrice] = useState("");
  // 代出價
  type ProxyBidPreview = { seq: number; itemId: number; itemNum: string; itemTitle: string; bidderName: string; currentPrice: number; newPrice: number; inc: number; error?: string };
  type ProxyBidLogEntry = { bidId: number; itemId: number; itemNum: string; itemTitle: string; bidderName: string; amount: number };
  const [proxyBidMode, setProxyBidMode] = useState(false);
  const [proxySeqInput, setProxySeqInput] = useState("");
  const [proxyBidderInput, setProxyBidderInput] = useState("");
  const [proxyNameHistory, setProxyNameHistory] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("proxyNameHistory") || "[]"); } catch { return []; }
  });
  const [proxyLog, setProxyLog] = useState<ProxyBidLogEntry[]>([]);
  const [showProxyNameDropdown, setShowProxyNameDropdown] = useState(false);
  const [proxySuccessBanner, setProxySuccessBanner] = useState<{ bidderName: string; items: { num: string; title: string; amount: number }[] } | null>(null);
  // 行內編輯
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [editFields, setEditFields] = useState<Record<string, string>>({});
  const [editImageIds, setEditImageIds] = useState<number[]>([]);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const scrollToItemIdRef = useRef<number | null>(null);

  // ── tRPC ──
  const { data: roundData, isLoading, refetch } = trpc.groupAuctions.getMine.useQuery(
    { id: roundId! },
    { enabled: !!roundId && !!user }
  );
  const { data: templates } = trpc.groupAuctions.listTemplates.useQuery(undefined, { enabled: !!user });
  const { data: colorRuleTemplates, refetch: refetchColorRuleTemplates } = trpc.groupAuctions.listColorRuleTemplates.useQuery(undefined, { enabled: !!user });
  const saveColorRuleTemplateMut = trpc.groupAuctions.saveColorRuleTemplate.useMutation({
    onSuccess: () => { toast.success("上色範本已儲存"); setShowSaveColorRuleTemplate(false); setColorRuleTemplateName(""); setColorRuleTemplateOverwriteId(null); refetchColorRuleTemplates(); },
    onError: (e) => toast.error(e.message || "儲存失敗"),
  });
  const updateColorRuleTemplateMut = trpc.groupAuctions.updateColorRuleTemplate.useMutation({
    onSuccess: () => { toast.success("上色範本已更新"); setShowSaveColorRuleTemplate(false); setColorRuleTemplateName(""); setColorRuleTemplateOverwriteId(null); refetchColorRuleTemplates(); },
    onError: (e) => toast.error(e.message || "更新失敗"),
  });
  const deleteColorRuleTemplateMut = trpc.groupAuctions.deleteColorRuleTemplate.useMutation({
    onSuccess: () => { refetchColorRuleTemplates(); },
    onError: (e) => toast.error(e.message || "刪除失敗"),
  });
  const { data: myApp } = trpc.merchants.myApplication.useQuery(undefined, { enabled: !!user });

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
  const getImageUploadUrlMut = trpc.groupAuctions.getImageUploadUrl.useMutation();
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
    onSuccess: () => {
      const targetId = scrollToItemIdRef.current;
      setEditingItemId(null);
      refetch().then(() => {
        if (targetId !== null) {
          setTimeout(() => {
            document.getElementById(`edit-item-${targetId}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }, 60);
        }
      });
    },
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
  const relistAsGroupDraftMut = trpc.groupAuctions.relistAsGroupDraft.useMutation({
    onSuccess: (d) => {
      toast.success(`已複製為新草稿，共 ${d.itemCount} 件商品`);
      setRelistSheet(false);
    },
    onError: (e) => toast.error(e.message || "操作失敗"),
  });
  const relistAsAuctionDraftsMut = trpc.groupAuctions.relistAsAuctionDrafts.useMutation({
    onSuccess: (d) => {
      toast.success(`已複製 ${d.created} 件至拍賣草稿`);
      setRelistMode(null); setRelistSelectedIds(new Set()); setRelistSheet(false);
    },
    onError: (e) => toast.error(e.message || "操作失敗"),
  });
  const relistAsProductDraftsMut = trpc.groupAuctions.relistAsProductDrafts.useMutation({
    onSuccess: (d) => {
      toast.success(`已複製 ${d.created} 件至商品管理草稿`);
      setRelistMode(null); setRelistSelectedIds(new Set()); setRelistSheet(false);
    },
    onError: (e) => toast.error(e.message || "操作失敗"),
  });
  const relistSelectedAsGroupDraftMut = trpc.groupAuctions.relistSelectedAsGroupDraft.useMutation({
    onSuccess: (d) => {
      toast.success(`已複製 ${d.itemCount} 件為新團拍草稿`);
      setRelistMode(null); setRelistSelectedIds(new Set()); setRelistSheet(false);
    },
    onError: (e) => toast.error(e.message || "操作失敗"),
  });
  const merchantProxyBidMut = trpc.groupAuctions.merchantProxyBid.useMutation({
    onSuccess: (r, vars) => {
      const ok = r.results.filter(x => x.success);
      const newLogEntries: ProxyBidLogEntry[] = ok.map(x => {
        const it = items.find(i => i.id === x.itemId);
        const numCol = columns.find(c => c.role === "itemNumber");
        const titleCol = columns.find(c => c.role === "itemTitle");
        const d = (() => { try { return JSON.parse((it as any)?.dataJson ?? "{}"); } catch { return {}; } })();
        return { bidId: x.bidId!, itemId: x.itemId, itemNum: numCol ? (d[numCol.key] || "") : "", itemTitle: titleCol ? (d[titleCol.key] || "") : "", bidderName: x.bidderName!, amount: x.amount! };
      });
      setProxyLog(prev => [...newLogEntries, ...prev].slice(0, 30));
      // Banner：代出價結果顯示喺頂部（可關閉）
      if (ok.length > 0) {
        setProxySuccessBanner({
          bidderName: newLogEntries[0].bidderName,
          items: newLogEntries.map(e => ({ num: e.itemNum, title: e.itemTitle, amount: e.amount })),
        });
      }
      if (r.results.some(x => !x.success)) {
        toast.error(r.results.filter(x => !x.success).map(f => f.error).join("、"));
      }
      // 儲存出價用戶到歷史
      const name = vars.bids[0]?.bidderName;
      if (name) {
        setProxyNameHistory(prev => {
          const next = [name, ...prev.filter(n => n !== name)].slice(0, 20);
          try { localStorage.setItem("proxyNameHistory", JSON.stringify(next)); } catch {}
          return next;
        });
      }
      setProxySeqInput("");
      refetch();
    },
    onError: (e) => toast.error(e.message || "代出價失敗"),
  });
  const undoProxyBidMut = trpc.groupAuctions.undoProxyBid.useMutation({
    onSuccess: (_, vars) => {
      setProxyLog(prev => {
        const entry = prev.find(e => e.bidId === vars.bidId);
        toast.success(entry ? `已撤銷 ${entry.bidderName} 嘅代出價` : "已撤銷代出價");
        return prev.filter(e => e.bidId !== vars.bidId);
      });
      refetch();
    },
    onError: (e) => toast.error(e.message || "撤銷失敗"),
  });
  const recalcResultsMut = trpc.groupAuctions.recalcResults.useMutation({
    onSuccess: (r) => {
      toast.success(r.fixed > 0 ? `已修正 ${r.fixed} 件商品結果` : "結果已是最新，無需修正");
      refetch();
    },
    onError: (e) => toast.error(e.message || "修正失敗"),
  });
  const batchUpdatePricesMut = trpc.groupAuctions.batchUpdatePrices.useMutation({
    onSuccess: (r) => {
      const parts = [`已更新 ${r.updated} 件`];
      if (r.skippedDueToBids > 0) parts.push(`${r.skippedDueToBids} 件因有出價跳過起拍/封頂`);
      toast.success(parts.join("，"));
      setSelectedIds(new Set());
      setBulkPriceMode(false);
      setBulkStartPrice(""); setBulkBidIncrement(""); setBulkBuyNowPrice("");
      refetch();
    },
    onError: (e) => toast.error(e.message || "批量改價失敗"),
  });
  const reorderItemsMut = trpc.groupAuctions.reorderItems.useMutation({
    onError: (e) => toast.error(e.message || "排序失敗"),
  });
  const resetBidIncrementsMut = trpc.groupAuctions.resetItemBidIncrements.useMutation({
    onSuccess: () => { toast.success("所有商品每口加價已重設為場次預設"); refetch(); },
    onError: (e) => toast.error(e.message || "重設失敗"),
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
      ...((() => {
        const loadedCurr = ((r as any).displayCurrencies ?? "CNY").split(",")[0].trim() || "CNY";
        return {
          defaultBidIncrement: String(r.defaultBidIncrement),
          displayCurrencies: loadedCurr,
          minDurationMinutes: String((r as any).minDurationMinutes ?? 60),
        };
      })()),
      buyerCommissionRate: String(parseFloat(String(r.buyerCommissionRate)) * 100),
      antiSnipeMinutes: String(r.antiSnipeMinutes),
      antiSnipeExtendMinutes: String(r.antiSnipeExtendMinutes),
      antiSnipeMode: r.antiSnipeMode,
    });
    if (r.columnsJson) {
      try { setColumns(JSON.parse(r.columnsJson)); } catch {}
    }
    setImages(roundData.images.map(img => ({ id: img.id, url: img.url, s3Key: img.s3Key })));
    setItems(roundData.items);
    try {
      const raw: any[] = JSON.parse((roundData.round as any).promoImagesJson ?? "[]");
      // 兼容舊格式（純 URL string）
      setPromoImages(raw.map(item => typeof item === "string" ? { url: item, s3Key: "" } : item));
    } catch { setPromoImages([]); }
    try {
      const raw: any[] = JSON.parse((roundData.round as any).colorRulesJson ?? "[]");
      setColorRules(raw.map(r => ({ ...r, style: r.style ?? "bg", weight: r.weight ?? "bold" })));
    } catch { setColorRules([]); }
    // 已結拍的場次自動跳到成績紀錄 tab
    if (roundData.round?.status === "ended") {
      changeTab("results");
    }
  }, [roundData]);

  // ── 儲存基本設定 ──
  function handleSaveBasic() {
    const payload = {
      title: basic.title.trim(),
      periodNumber: basic.periodNumber || undefined,
      description: basic.description || undefined,
      coverImage: basic.coverImage || undefined,
      startAt: basic.startAt ? new Date(basic.startAt).toISOString() : undefined,
      endAt: basic.endAt ? new Date(basic.endAt).toISOString() : undefined,
      defaultBidIncrement: parseInt(basic.defaultBidIncrement, 10) || 50,
      buyerCommissionRate: (parseFloat(basic.buyerCommissionRate) || 0) / 100,
      antiSnipeMinutes: parseInt(basic.antiSnipeMinutes, 10) || 0,
      antiSnipeExtendMinutes: parseInt(basic.antiSnipeExtendMinutes, 10) || 5,
      antiSnipeMode: basic.antiSnipeMode,
      displayCurrencies: basic.displayCurrencies || "HKD,CNY",
      minDurationMinutes: parseInt(basic.minDurationMinutes, 10) || 0,
      columnsJson: JSON.stringify(columns),
      promoImagesJson: JSON.stringify(promoImages), // 儲存 {url, s3Key}[] 格式
      colorRulesJson: JSON.stringify(colorRules),
    };
    if (!payload.title) { toast.error("請輸入場次名稱"); return; }
    if (payload.minDurationMinutes > 0 && payload.startAt && payload.endAt) {
      const diffMs = new Date(payload.endAt).getTime() - new Date(payload.startAt).getTime();
      if (diffMs < payload.minDurationMinutes * 60 * 1000) {
        toast.error(`結拍時間必須比開拍時間至少遲 ${payload.minDurationMinutes} 分鐘`);
        return;
      }
    }
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
    const count = files.length;
    setUploadingImages(true);
    setImageUploadProgress({ done: 0, total: count });
    try {
      for (let i = 0; i < count; i++) {
        const file = files[i];
        const compressed = await compressImage(file);
        const { uploadUrl, publicUrl, s3Key } = await getImageUploadUrlMut.mutateAsync({
          roundId, filename: file.name, mimeType: "image/jpeg",
        });
        if (!uploadUrl) throw new Error("取得上載 URL 失敗");
        await fetch(uploadUrl, { method: "PUT", body: compressed, headers: { "Content-Type": "image/jpeg" } });
        const img = await recordImageMut.mutateAsync({
          roundId, s3Key, url: publicUrl, displayOrder: images.length + i,
        });
        setImages(prev => [...prev, { id: img.id, url: publicUrl, s3Key }]);
        setImageUploadProgress({ done: i + 1, total: count });
      }
      toast.success(`已上載 ${count} 張圖片`);
    } catch (e: any) {
      toast.error(e.message || "上載失敗");
    } finally {
      setUploadingImages(false);
      setImageUploadProgress(null);
      refetch();
    }
  }

  // ── 壓縮圖片至最大 1200px / JPEG 0.82（client-side，大圖由 5MB 縮至 ~150KB）──
  function compressImage(file: File, maxPx = 1200, quality = 0.82): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        let { width, height } = img;
        if (width > maxPx || height > maxPx) {
          if (width >= height) { height = Math.round((height / width) * maxPx); width = maxPx; }
          else { width = Math.round((width / height) * maxPx); height = maxPx; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
        canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("壓縮失敗")), "image/jpeg", quality);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("圖片讀取失敗")); };
      img.src = url;
    });
  }

  // ── 上載場次推廣圖片（壓縮後逐張上載，顯示進度）──
  async function handlePromoUpload(files: FileList) {
    if (!roundId) { toast.error("請先儲存場次"); return; }
    const remain = 10 - promoImages.length;
    if (remain <= 0) { toast.info("最多上載 10 張推廣圖片"); return; }
    const count = Math.min(files.length, remain);
    const fileArray = Array.from(files).slice(0, count);
    setUploadingPromo(true);
    setPromoUploadProgress({ done: 0, total: count });
    const newItems: { url: string; s3Key: string }[] = [];
    try {
      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i];
        // 壓縮
        const compressed = await compressImage(file);
        // 取 presigned URL
        const { uploadUrl, publicUrl, s3Key } = await getImageUploadUrlMut.mutateAsync({
          roundId, filename: `promo_${file.name}`, mimeType: "image/jpeg",
        });
        // 上載壓縮後的 blob
        await fetch(uploadUrl, { method: "PUT", body: compressed, headers: { "Content-Type": "image/jpeg" } });
        newItems.push({ url: publicUrl, s3Key });
        setPromoUploadProgress({ done: i + 1, total: count });
      }
      setPromoImages(prev => [...prev, ...newItems]);
      toast.success(`已上載 ${newItems.length} 張推廣圖片，記得儲存設定`);
    } catch (e: any) {
      toast.error(e.message || "上載失敗");
    } finally {
      setUploadingPromo(false);
      setPromoUploadProgress(null);
      if (promoFileRef.current) promoFileRef.current.value = "";
    }
  }

  // ── 將推廣圖片加入圖片集（register 到 DB，回傳帶 id 的 image record）──
  async function addPromoToGallery(pi: { url: string; s3Key: string }): Promise<{ id: number; url: string; s3Key: string } | null> {
    if (!roundId) return null;
    const existing = images.find(img => img.url === pi.url);
    if (existing) return existing;
    try {
      const img = await recordImageMut.mutateAsync({ roundId, s3Key: pi.s3Key, url: pi.url, displayOrder: images.length });
      const newImg = { id: img.id, url: pi.url, s3Key: pi.s3Key };
      setImages(prev => [...prev, newImg]);
      return newImg;
    } catch (e: any) {
      toast.error(e.message || "加入圖片集失敗");
      return null;
    }
  }

  // ── CSV 解析（支援半形逗號、全形逗號、Tab） ──
  function parseCsv(text: string) {
    // 先把全形逗號統一轉半形，確保混用時正常解析
    const normalized = text.replace(/，/g, ",");
    const lines = normalized.trim().split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) { toast.error("CSV 至少要有標題行和一行資料"); return; }
    // 自動偵測分隔符：優先 Tab，其次半形逗號
    const firstLine = lines[0];
    const delim = firstLine.includes("\t") ? "\t" : ",";
    const splitLine = (l: string) =>
      l.split(delim).map(c => c.trim().replace(/^"|"$/g, ""));
    const headers = splitLine(firstLine);
    // 過濾全空行
    const rows = lines.slice(1)
      .map(splitLine)
      .filter(r => r.some(c => c !== ""));
    // 如果 data 行比 header 多欄，自動補 header（欄N）確保可配對
    const maxCols = rows.reduce((m, r) => Math.max(m, r.length), headers.length);
    while (headers.length < maxCols) {
      headers.push(`欄${headers.length + 1}`);
    }
    setCsvHeaders(headers);
    setCsvRows(rows);
    // 自動配對欄位（完全匹配 > 包含匹配）
    // 別名表：CSV header 常見別名 → 系統欄位 label
    const ALIASES: Record<string, string[]> = {
      "名稱": ["品名", "商品名", "名"],
      "號碼": ["號", "編號", "序號", "serial", "no"],
      "起拍價": ["起拍", "起標價", "底價", "price", "start"],
      "封頂價": ["封頂", "直購", "cap", "buynow"],
    };
    const mapping: Record<string, string> = {};
    columns.forEach(col => {
      const aliases = ALIASES[col.label] ?? [];
      const allLabels = [col.label, ...aliases];
      const exact = headers.find(h => allLabels.some(l => h === l));
      const contains = headers.find(h =>
        allLabels.some(l =>
          h.toLowerCase().includes(l.toLowerCase()) ||
          l.toLowerCase().includes(h.toLowerCase())
        )
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

  type TabKey = "basic" | "columns" | "images" | "items" | "results";
  const TABS: { key: TabKey; label: string; disabled?: boolean }[] = isEnded
    ? [{ key: "results", label: "成交紀錄" }]
    : [
      { key: "basic", label: "基本設定" },
      { key: "columns", label: "欄位設定" },
      { key: "images", label: "圖片集", disabled: isNew },
      { key: "items", label: "商品管理", disabled: isNew },
    ];

  const currSym = CURR_SYMS[basic.displayCurrencies] ?? "HK$";

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* 代出價成功 fixed floating popup */}
      {proxySuccessBanner && (
        <div
          style={{
            position: "fixed",
            top: 16,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 9999,
            width: "calc(100% - 32px)",
            maxWidth: 520,
            background: "var(--popup-bg)",
            color: "var(--popup-text)",
            borderRadius: "var(--popup-radius)",
            boxShadow: "var(--popup-shadow)",
            padding: "12px 14px",
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "var(--popup-text)", marginBottom: 5 }}>
              {proxySuccessBanner.bidderName} 代出價成功
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {proxySuccessBanner.items.map((it, i) => (
                <div key={i} style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  padding: "5px 0",
                  borderTop: i > 0 ? "1px solid rgba(255,255,255,0.25)" : "none",
                }}>
                  <span style={{ fontSize: 11, color: "var(--popup-desc)", minWidth: 0, flex: 1 }}>
                    {[it.num, it.title].filter(Boolean).join("  ")}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--popup-text)", flexShrink: 0 }}>
                    HK${it.amount.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <button
            onClick={() => setProxySuccessBanner(null)}
            style={{ flexShrink: 0, color: "rgba(255,255,255,0.7)", marginTop: 1, background: "none", border: "none", cursor: "pointer", padding: 0 }}
          >
            <X style={{ width: 15, height: 15 }} />
          </button>
        </div>
      )}
      <Header />
      <div className="max-w-2xl mx-auto px-[3px] pt-4">
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


        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-4">
          {TABS.map(t => (
            <button
              key={t.key}
              disabled={"disabled" in t && t.disabled}
              onClick={() => changeTab(t.key as any)}
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
              <div>
                <label className="text-xs text-gray-500 mb-1 block">開拍至結拍最短距離（分鐘，0 = 不設限）</label>
                <input className="w-full px-3 py-2 text-sm outline-none" style={inputStyle}
                  placeholder="預設 60"
                  value={basic.minDurationMinutes}
                  onChange={e => setBasic(p => ({ ...p, minDurationMinutes: e.target.value }))} />
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
              <p className="text-xs font-semibold text-gray-600">出價規則</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">每口加價（{({"HKD":"HK$","CNY":"¥","USD":"US$","JPY":"¥","GBP":"£","EUR":"€"} as Record<string,string>)[basic.displayCurrencies] ?? "HK$"}）</label>
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
              <p className="text-xs font-semibold text-gray-600">出價頁加價幣種</p>
              <p className="text-xs text-gray-400">買家出價頁所有金額顯示的幣種（以 HKD 換算），預設人民幣</p>
              <div className="flex flex-wrap gap-3">
                {(["HKD", "CNY", "USD", "JPY", "GBP", "EUR"] as const).map(cur => (
                  <label key={cur} className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="displayCurrency"
                      checked={basic.displayCurrencies === cur}
                      onChange={() => setBasic(p => ({ ...p, displayCurrencies: cur }))}
                    />
                    <span className="text-sm text-gray-700">{cur}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* 場次推廣圖片（用作 live banner 背景）*/}
            {!isNew && (
              <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
                <p className="text-xs font-semibold text-gray-600">場次推廣圖片（最多 10 張，將顯示於出價頁橙色橫幅）</p>
                <input ref={promoFileRef} type="file" accept="image/*" multiple className="hidden"
                  onChange={e => e.target.files && handlePromoUpload(e.target.files)} />
                {promoImages.length < 10 && (
                  <div className="space-y-2">
                    <button
                      onClick={() => promoFileRef.current?.click()}
                      disabled={uploadingPromo}
                      className="flex items-center gap-2 w-full justify-center border-2 border-dashed border-amber-200 text-amber-600 hover:border-amber-400 rounded-xl py-3 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <Upload className="w-4 h-4" />
                      {uploadingPromo
                        ? promoUploadProgress
                          ? `壓縮上載中 ${promoUploadProgress.done}／${promoUploadProgress.total} 張...`
                          : "準備中..."
                        : `點擊上載（已 ${promoImages.length}/10 張）`}
                    </button>
                    {uploadingPromo && promoUploadProgress && (
                      <div className="w-full bg-amber-100 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-amber-500 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${Math.round((promoUploadProgress.done / promoUploadProgress.total) * 100)}%` }}
                        />
                      </div>
                    )}
                  </div>
                )}
                {promoImages.length > 0 && (
                  <div className="grid grid-cols-5 gap-2">
                    {promoImages.map((pi, i) => {
                      const inGallery = images.some(img => img.url === pi.url);
                      return (
                        <div key={i} className="relative">
                          <img src={pi.url} alt="" className="w-full aspect-square object-cover rounded-xl" />
                          {/* 加入／移出圖片集 */}
                          <button
                            title={inGallery ? "點擊移出圖片集" : "加入圖片集"}
                            onClick={async () => {
                              if (inGallery) {
                                const imgRecord = images.find(img => img.url === pi.url);
                                if (!imgRecord) return;
                                try {
                                  await deleteImageMut.mutateAsync({ id: imgRecord.id });
                                  setImages(prev => prev.filter(img => img.id !== imgRecord.id));
                                  toast.success("已從圖片集移除");
                                } catch (e: any) {
                                  toast.error(e.message || "移除失敗");
                                }
                                return;
                              }
                              const r = await addPromoToGallery(pi);
                              if (r) toast.success("已加入圖片集，可在商品圖片選擇器使用");
                            }}
                            className={`absolute top-1 left-1 rounded-full w-5 h-5 flex items-center justify-center shadow text-white text-[10px] font-bold ${inGallery ? "bg-amber-500 hover:bg-red-500" : "bg-gray-600 hover:bg-amber-500"}`}
                          >{inGallery ? "✓" : "＋"}</button>
                          {/* 刪除 */}
                          <button
                            onClick={() => setPromoImages(p => p.filter((_, j) => j !== i))}
                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center shadow"
                          ><Trash2 className="w-3 h-3" /></button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* 商品上色規則 */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-600">商品上色規則</p>
                <span className="text-[10px] text-gray-400">首條符合規則生效</span>
              </div>
              <p className="text-[11px] text-gray-400">根據關鍵字自動為商品行上色。多個關鍵字用 ｜ 分隔（逗號亦可），任一符合即上色。</p>
              {colorRules.map((rule, rIdx) => (
                <div key={rule.id} className="rounded-xl p-2 space-y-1.5" style={{ background: "#f9fafb", border: "1px solid #f3f4f6" }}>
                  {/* 第一行：關鍵字輸入 + 刪除 */}
                  <div className="flex items-center gap-2">
                    <input
                      className="flex-1 px-2.5 py-1.5 text-xs outline-none"
                      style={{ background: "#fff", border: "1px solid #E5E5E5", borderRadius: "10px" }}
                      placeholder="關鍵字，用 ｜ 分隔"
                      value={rule.keywords}
                      onChange={e => setColorRules(p => p.map((r, i) => i === rIdx ? { ...r, keywords: e.target.value } : r))}
                    />
                    <button onClick={() => setColorRules(p => p.filter((_, i) => i !== rIdx))}>
                      <X className="w-4 h-4 text-gray-400 hover:text-red-500" />
                    </button>
                  </div>
                  {/* 第二行：顏色色塊 + 底/字 + 粗/正 */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {COLOR_PRESETS.map(p => (
                      <button
                        key={p.key}
                        title={p.label}
                        onClick={() => setColorRules(prev => prev.map((r, i) => i === rIdx ? { ...r, color: p.key } : r))}
                        style={{ width: 22, height: 22, borderRadius: 6, background: p.bg, border: rule.color === p.key ? "2.5px solid #d97706" : "1px solid #e5e7eb", flexShrink: 0 }}
                      />
                    ))}
                    <div style={{ width: 1, height: 18, background: "#e5e7eb", flexShrink: 0 }} />
                    <button
                      title={rule.style === "text" ? "文字顏色模式（點擊換底色）" : "底色模式（點擊換文字顏色）"}
                      onClick={() => setColorRules(p => p.map((r, i) => i === rIdx ? { ...r, style: r.style === "text" ? "bg" : "text" } : r))}
                      style={{ fontSize: 11, padding: "2px 7px", borderRadius: 5, background: rule.style === "text" ? "#f3f4f6" : "#374151", color: rule.style === "text" ? "#374151" : "#fff", border: "1px solid #e5e7eb", fontWeight: 600, flexShrink: 0 }}
                    >
                      {rule.style === "text" ? "字色" : "底色"}
                    </button>
                    <button
                      title={rule.weight === "normal" ? "正常字重（點擊換粗體）" : "粗體（點擊換正常）"}
                      onClick={() => setColorRules(p => p.map((r, i) => i === rIdx ? { ...r, weight: r.weight === "normal" ? "bold" : "normal" } : r))}
                      style={{ fontSize: 11, padding: "2px 7px", borderRadius: 5, background: rule.weight === "normal" ? "#f3f4f6" : "#374151", color: rule.weight === "normal" ? "#374151" : "#fff", border: "1px solid #e5e7eb", fontWeight: rule.weight === "normal" ? 400 : 700, flexShrink: 0 }}
                    >
                      {rule.weight === "normal" ? "正常" : "粗體"}
                    </button>
                  </div>
                </div>
              ))}
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => setColorRules(p => [...p, { id: `cr_${Date.now()}`, keywords: "", color: "gold", style: "bg", weight: "bold" }])}
                  className="flex items-center gap-1.5 text-xs text-amber-600 hover:text-amber-700"
                >
                  <Plus className="w-3.5 h-3.5" /> 加入規則
                </button>
                {colorRules.length > 0 && (
                  <button
                    onClick={() => setShowSaveColorRuleTemplate(true)}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 ml-auto"
                  >
                    儲存為上色範本
                  </button>
                )}
              </div>
              {/* 儲存上色範本 */}
              {showSaveColorRuleTemplate && (
                <div className="bg-white rounded-xl border border-blue-100 p-3 space-y-2">
                  {/* 覆蓋現有範本 dropdown */}
                  {colorRuleTemplates && colorRuleTemplates.length > 0 && (
                    <div>
                      <p className="text-[11px] text-gray-400 mb-1">覆蓋現有範本（可選）</p>
                      <select
                        className="w-full px-2.5 py-1.5 text-xs outline-none"
                        style={{ background: "#fff", border: "1px solid #E5E5E5", borderRadius: "10px" }}
                        value={colorRuleTemplateOverwriteId ?? ""}
                        onChange={e => {
                          const val = e.target.value;
                          if (val === "") {
                            setColorRuleTemplateOverwriteId(null);
                            setColorRuleTemplateName("");
                          } else {
                            const id = Number(val);
                            setColorRuleTemplateOverwriteId(id);
                            const found = colorRuleTemplates.find(t => t.id === id);
                            if (found) setColorRuleTemplateName(found.name);
                          }
                        }}
                      >
                        <option value="">── 建立新範本 ──</option>
                        {colorRuleTemplates.map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <p className="text-xs font-medium text-gray-700">
                    {colorRuleTemplateOverwriteId ? "更新範本名稱" : "新範本名稱"}
                  </p>
                  <input
                    className="w-full px-3 py-1.5 text-xs outline-none"
                    style={{ background: "#fff", border: "1px solid #E5E5E5", borderRadius: "10px" }}
                    placeholder="例：PMG 評級幣上色規則"
                    value={colorRuleTemplateName}
                    onChange={e => setColorRuleTemplateName(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        if (!colorRuleTemplateName.trim()) { toast.error("請輸入範本名稱"); return; }
                        const rulesJson = JSON.stringify(colorRules);
                        if (colorRuleTemplateOverwriteId) {
                          updateColorRuleTemplateMut.mutate({ id: colorRuleTemplateOverwriteId, name: colorRuleTemplateName.trim(), rulesJson });
                        } else {
                          saveColorRuleTemplateMut.mutate({ name: colorRuleTemplateName.trim(), rulesJson });
                        }
                      }}
                      className="flex-1 bg-blue-500 text-white text-xs py-1.5 rounded-lg"
                    >{colorRuleTemplateOverwriteId ? "覆蓋更新" : "儲存新範本"}</button>
                    <button onClick={() => { setShowSaveColorRuleTemplate(false); setColorRuleTemplateName(""); setColorRuleTemplateOverwriteId(null); }}
                      className="px-3 text-xs text-gray-500 py-1.5 rounded-lg bg-gray-100">取消</button>
                  </div>
                </div>
              )}
              {/* 載入上色範本 */}
              {colorRuleTemplates && colorRuleTemplates.length > 0 && (
                <div className="pt-1">
                  <p className="text-[11px] text-gray-400 mb-1.5">載入已儲存範本：</p>
                  <div className="flex flex-wrap gap-1.5">
                    {colorRuleTemplates.map(t => (
                      <div key={t.id} className="flex items-center gap-0.5">
                        <button
                          onClick={() => {
                            try {
                              const raw: any[] = JSON.parse(t.rulesJson);
                              setColorRules(raw.map(r => ({ ...r, id: `cr_${Date.now()}_${Math.random().toString(36).slice(2,5)}`, style: r.style ?? "bg", weight: r.weight ?? "bold" })));
                            } catch {}
                          }}
                          className="text-[11px] bg-blue-50 hover:bg-blue-100 text-blue-700 px-2.5 py-1 rounded-lg"
                        >{t.name}</button>
                        <button
                          onClick={() => deleteColorRuleTemplateMut.mutate({ id: t.id })}
                          className="p-0.5 text-gray-300 hover:text-red-400"
                        ><X className="w-3 h-3" /></button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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
              <div className="space-y-2">
                <button
                  onClick={() => imageFileRef.current?.click()}
                  disabled={uploadingImages}
                  className="flex items-center gap-2 w-full justify-center border-2 border-dashed border-amber-200 text-amber-600 hover:border-amber-400 rounded-xl py-4 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <Upload className="w-4 h-4" />
                  {uploadingImages
                    ? imageUploadProgress
                      ? `壓縮上載中 ${imageUploadProgress.done}／${imageUploadProgress.total} 張...`
                      : "準備中..."
                    : "點擊上載圖片（可多選）"}
                </button>
                {uploadingImages && imageUploadProgress && (
                  <div className="w-full bg-amber-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-amber-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${Math.round((imageUploadProgress.done / imageUploadProgress.total) * 100)}%` }}
                    />
                  </div>
                )}
              </div>
            </div>

            {images.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {images.map((img, idx) => (
                  <div key={img.id} className="relative rounded-xl overflow-hidden aspect-square">
                    <PinchZoomImage src={img.url} className="w-full h-full object-cover" fullscreenOnClick />
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
            <div className="flex gap-2 items-center overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
              {!selectMode && !bulkPriceMode ? (
                <>
                  <button
                    onClick={() => setShowCsvImport(true)}
                    className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium px-3 py-2 rounded-xl"
                  >
                    <FileSpreadsheet className="w-4 h-4" /> 匯入 CSV
                  </button>
                  {!isEnded && items.length > 0 && (
                    <button
                      onClick={() => { setSelectMode(true); setSelectedIds(new Set()); }}
                      className="flex items-center gap-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-2 rounded-xl"
                    >
                      <CheckSquare className="w-4 h-4" /> 批量刪除
                    </button>
                  )}
                  {items.length > 0 && (
                    <button
                      onClick={() => { setBulkPriceMode(true); setSelectedIds(new Set()); }}
                      className="flex items-center gap-1.5 text-sm bg-blue-50 hover:bg-blue-100 text-blue-600 px-3 py-2 rounded-xl"
                    >
                      <Pencil className="w-4 h-4" /> 批量改價
                    </button>
                  )}
                  {round?.status === "published" && items.length > 0 && (
                    <button
                      onClick={() => setProxyBidMode(v => !v)}
                      className={`flex items-center gap-1.5 text-sm px-3 py-2 rounded-xl ${proxyBidMode ? "bg-orange-500 text-white" : "bg-orange-50 hover:bg-orange-100 text-orange-600"}`}
                    >
                      代出價
                    </button>
                  )}
                  {items.length > 0 && (
                    <button
                      onClick={async () => {
                        const ok = await confirm({
                          title: "重設所有商品每口加價",
                          description: `將所有商品的個別每口加價清除，改用場次預設值（${basic.defaultBidIncrement || round?.defaultBidIncrement}）。此操作不可撤銷。`,
                        });
                        if (ok) resetBidIncrementsMut.mutate({ roundId: roundId! });
                      }}
                      disabled={resetBidIncrementsMut.isPending}
                      className="flex items-center gap-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-2 rounded-xl"
                    >
                      套用場次預設加價至所有商品
                    </button>
                  )}
                </>
              ) : selectMode ? (
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
              ) : (
                /* bulkPriceMode toolbar */
                <>
                  <button
                    onClick={() => {
                      if (selectedIds.size === items.length) setSelectedIds(new Set());
                      else setSelectedIds(new Set(items.map(i => i.id)));
                    }}
                    className="flex items-center gap-1.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1.5 rounded-xl"
                  >
                    {selectedIds.size === items.length ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                    {selectedIds.size === items.length ? "取消全選" : `全選 (${items.length})`}
                  </button>
                  <button
                    onClick={() => { setBulkPriceMode(false); setSelectedIds(new Set()); setBulkStartPrice(""); setBulkBidIncrement(""); setBulkBuyNowPrice(""); }}
                    className="flex items-center gap-1 text-xs text-gray-500 px-3 py-1.5 rounded-xl bg-gray-100"
                  >
                    <X className="w-3.5 h-3.5" /> 取消
                  </button>
                </>
              )}
            </div>

            {/* 批量改價 price panel */}
            {bulkPriceMode && (
              <div className="rounded-2xl p-3 space-y-2.5" style={{ background: "#eff6ff", border: "1px solid #bfdbfe" }}>
                <p className="text-xs font-semibold text-blue-700">批量改價 — 留空則不修改該欄位</p>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <p className="text-[11px] text-gray-500 mb-1">起拍價 (HK$)</p>
                    <input
                      type="number"
                      className="w-full px-2 py-1.5 text-sm outline-none"
                      style={{ background: "#fff", border: "1px solid #E5E5E5", borderRadius: "10px" }}
                      placeholder="不改"
                      value={bulkStartPrice}
                      onChange={e => setBulkStartPrice(e.target.value)}
                    />
                  </div>
                  <div>
                    <p className="text-[11px] text-gray-500 mb-1">每口加幅 (HK$)</p>
                    <input
                      type="number"
                      className="w-full px-2 py-1.5 text-sm outline-none"
                      style={{ background: "#fff", border: "1px solid #E5E5E5", borderRadius: "10px" }}
                      placeholder="不改"
                      value={bulkBidIncrement}
                      onChange={e => setBulkBidIncrement(e.target.value)}
                    />
                  </div>
                  <div>
                    <p className="text-[11px] text-gray-500 mb-1">封頂價 (HK$)</p>
                    <input
                      type="number"
                      className="w-full px-2 py-1.5 text-sm outline-none"
                      style={{ background: "#fff", border: "1px solid #E5E5E5", borderRadius: "10px" }}
                      placeholder="不改"
                      value={bulkBuyNowPrice}
                      onChange={e => setBulkBuyNowPrice(e.target.value)}
                    />
                  </div>
                </div>
                <p className="text-[10px] text-blue-500">已有出價的商品：起拍價及封頂價不會更改，每口加幅仍可修改</p>
                <button
                  disabled={selectedIds.size === 0 || batchUpdatePricesMut.isPending || (!bulkStartPrice && !bulkBidIncrement && !bulkBuyNowPrice)}
                  onClick={() => {
                    const payload: Parameters<typeof batchUpdatePricesMut.mutate>[0] = {
                      roundId: roundId!,
                      ids: Array.from(selectedIds),
                    };
                    if (bulkStartPrice) payload.startingPrice = parseInt(bulkStartPrice, 10);
                    if (bulkBidIncrement) payload.bidIncrement = parseInt(bulkBidIncrement, 10);
                    if (bulkBuyNowPrice) payload.buyNowPrice = parseInt(bulkBuyNowPrice, 10);
                    batchUpdatePricesMut.mutate(payload);
                  }}
                  className="w-full py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                  style={{ background: "linear-gradient(90deg,#2563eb,#3b82f6)" }}
                >
                  {batchUpdatePricesMut.isPending ? "套用中…" : `套用至已選 ${selectedIds.size} 件`}
                </button>
              </div>
            )}

            {/* 代出價 panel */}
            {proxyBidMode && (() => {
              const numCol = columns.find(c => c.role === "itemNumber");
              const titleCol = columns.find(c => c.role === "itemTitle");
              const defaultInc = parseInt(basic.defaultBidIncrement, 10) || (round?.defaultBidIncrement ?? 50);

              // 解析序號輸入，支援多種 pattern
              const parseSeqInput = (raw: string): number[] => {
                const text = raw.trim();
                if (!text) return [];
                const seqs = new Set<number>();
                // "32起" → 32 到最後
                const fromMatch = text.match(/^(\d+)起$/);
                if (fromMatch) {
                  const start = parseInt(fromMatch[1], 10);
                  for (let i = start; i <= items.length; i++) seqs.add(i);
                  return [...seqs];
                }
                // 去掉所有 "+"，再按 逗號/頓號/空格 分割
                const parts = text.replace(/\+/g, "").split(/[,，\s]+/).filter(Boolean);
                for (const p of parts) {
                  // 範圍 "1-5"
                  const range = p.match(/^(\d+)-(\d+)$/);
                  if (range) {
                    const a = parseInt(range[1], 10), b = parseInt(range[2], 10);
                    for (let i = Math.min(a, b); i <= Math.max(a, b); i++) {
                      if (i >= 1 && i <= items.length) seqs.add(i);
                    }
                  } else {
                    const n = parseInt(p, 10);
                    if (!isNaN(n) && n >= 1 && n <= items.length) seqs.add(n);
                  }
                }
                return [...seqs].sort((a, b) => a - b);
              };

              const seqs = parseSeqInput(proxySeqInput);
              const bidderName = proxyBidderInput.trim();

              const preview: ProxyBidPreview[] = seqs.map(seq => {
                const it = items[seq - 1];
                if (!it) return { seq, itemId: -1, itemNum: String(seq), itemTitle: "", bidderName, currentPrice: 0, newPrice: 0, inc: 0, error: `序號 ${seq} 不存在` };
                if (it.status !== "active") {
                  const d: Record<string, string> = (() => { try { return JSON.parse(it.dataJson); } catch { return {}; } })();
                  return { seq, itemId: it.id, itemNum: numCol ? (d[numCol.key] || String(seq)) : String(seq), itemTitle: titleCol ? (d[titleCol.key] || "") : "", bidderName, currentPrice: 0, newPrice: 0, inc: 0, error: "商品已結拍" };
                }
                const d: Record<string, string> = (() => { try { return JSON.parse(it.dataJson); } catch { return {}; } })();
                const ttl = titleCol ? (d[titleCol.key] || "") : "";
                const numVal = numCol ? (d[numCol.key] || "") : "";
                const curPx = (it as any).currentPrice ?? it.startPrice;
                const inc = it.bidIncrement > 0 ? it.bidIncrement : defaultInc;
                const hasBidsAlready = ((it as any).bidCount ?? 0) > 0;
                const newPx = hasBidsAlready ? curPx + inc : (it.startPrice > 0 ? it.startPrice : inc);
                const capErr = it.buyNowPrice && newPx > it.buyNowPrice ? `超封頂 $${it.buyNowPrice}` : undefined;
                return { seq, itemId: it.id, itemNum: numVal || String(seq), itemTitle: ttl, bidderName, currentPrice: curPx, newPrice: newPx, inc, error: capErr };
              });

              const validBids = preview.filter(p => !p.error && p.itemId > 0 && bidderName);
              const canSubmit = validBids.length > 0 && !!bidderName && !merchantProxyBidMut.isPending;

              return (
                <div className="rounded-2xl p-3 space-y-3" style={{ background: "#fff7ed", border: "1px solid #fed7aa" }}>
                  <p className="text-xs font-semibold text-orange-700">管理員代出價面板</p>

                  {/* Field 1 — 序號 */}
                  <div>
                    <p className="text-[11px] text-gray-500 mb-1">商品序號（左側數字）</p>
                    <input
                      className="w-full px-3 py-2 text-sm outline-none font-mono"
                      style={{ background: "#fff", border: "1px solid #E5E5E5", borderRadius: "12px" }}
                      placeholder="例：+1,+2  或  1-5  或  32起  或  3 7 12"
                      value={proxySeqInput}
                      onChange={e => setProxySeqInput(e.target.value)}
                    />
                  </div>

                  {/* Field 2 — 出價用戶 */}
                  {(() => {
                    const filteredNames = proxyNameHistory.filter(n =>
                      !proxyBidderInput.trim() || n.toLowerCase().includes(proxyBidderInput.toLowerCase())
                    );
                    return (
                      <div>
                        <p className="text-[11px] text-gray-500 mb-1">出價用戶</p>
                        <div style={{ position: "relative" }}>
                          <input
                            className="w-full px-3 py-2 text-sm outline-none"
                            style={{ background: "#fff", border: "1px solid #E5E5E5", borderRadius: "12px" }}
                            placeholder="輸入或選擇..."
                            value={proxyBidderInput}
                            onChange={e => { setProxyBidderInput(e.target.value); }}
                            onFocus={() => setShowProxyNameDropdown(true)}
                            onBlur={() => setTimeout(() => setShowProxyNameDropdown(false), 150)}
                          />
                          {showProxyNameDropdown && filteredNames.length > 0 && (
                            <div style={{
                              position: "absolute",
                              top: "calc(100% + 4px)",
                              left: 0,
                              right: 0,
                              background: "#fff",
                              border: "1px solid #E5E5E5",
                              borderRadius: 12,
                              boxShadow: "0 4px 16px rgba(0,0,0,0.10)",
                              zIndex: 200,
                              maxHeight: 200,
                              overflowY: "auto",
                            }}>
                              {filteredNames.map((n, i) => (
                                <button
                                  key={n}
                                  type="button"
                                  onMouseDown={e => { e.preventDefault(); setProxyBidderInput(n); setShowProxyNameDropdown(false); }}
                                  style={{
                                    display: "block",
                                    width: "100%",
                                    textAlign: "left",
                                    padding: "9px 14px",
                                    fontSize: 13,
                                    color: "#374151",
                                    background: "none",
                                    border: "none",
                                    borderBottom: i < filteredNames.length - 1 ? "1px solid #f3f4f6" : "none",
                                    cursor: "pointer",
                                  }}
                                >
                                  {n}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* 預覽 table */}
                  {seqs.length > 0 && bidderName && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr style={{ background: "#ffedd5" }}>
                            <th className="px-2 py-1 text-left font-semibold text-orange-800">序號</th>
                            <th className="px-2 py-1 text-left font-semibold text-orange-800">商品</th>
                            <th className="px-2 py-1 text-right font-semibold text-orange-800">現價</th>
                            <th className="px-2 py-1 text-right font-semibold text-orange-800">新出價</th>
                            <th className="px-2 py-1 text-left font-semibold text-orange-800">狀態</th>
                          </tr>
                        </thead>
                        <tbody>
                          {preview.map((p) => (
                            <tr key={p.seq} style={{ borderBottom: "1px solid #fed7aa", background: p.error ? "#fef2f2" : "#fffbf7" }}>
                              <td className="px-2 py-1 font-mono text-orange-600">{p.seq}</td>
                              <td className="px-2 py-1 max-w-[130px] truncate">{p.itemTitle || p.itemNum || "—"}</td>
                              <td className="px-2 py-1 text-right">{p.currentPrice > 0 ? `$${p.currentPrice}` : "—"}</td>
                              <td className="px-2 py-1 text-right font-semibold text-orange-700">{p.error ? "—" : `$${p.newPrice}`}</td>
                              <td className="px-2 py-1">{p.error ? <span className="text-red-500">{p.error}</span> : <span className="text-green-600">✓</span>}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* 確認按鈕 */}
                  <button
                    disabled={!canSubmit}
                    onClick={() => merchantProxyBidMut.mutate({ roundId: roundId!, bids: validBids.map(p => ({ itemId: p.itemId, bidderName })) })}
                    className="w-full py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-40"
                    style={{ background: "linear-gradient(90deg,#ea580c,#f97316)" }}
                  >
                    {merchantProxyBidMut.isPending ? "代出價中…" : validBids.length > 0 ? `確認代出價 ${validBids.length} 件 → ${bidderName}` : "輸入序號及出價用戶"}
                  </button>

                  {/* 最近代出價記錄 */}
                  {proxyLog.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-[11px] font-semibold text-orange-700">最近代出價記錄（可撤銷）</p>
                      {proxyLog.map(e => (
                        <div key={e.bidId} className="flex items-center justify-between bg-white rounded-xl px-3 py-1.5" style={{ border: "1px solid #fed7aa" }}>
                          <span className="text-xs text-gray-700">
                            <span className="font-mono text-orange-600 mr-1">{e.itemNum}</span>
                            <span className="text-gray-500 mr-1 max-w-[80px] truncate inline-block align-middle">{e.itemTitle}</span>
                            <span className="font-medium">{e.bidderName}</span>
                            <span className="text-gray-400 ml-1">${e.amount}</span>
                          </span>
                          <button
                            disabled={undoProxyBidMut.isPending}
                            onClick={() => undoProxyBidMut.mutate({ bidId: e.bidId })}
                            className="text-xs text-red-500 hover:text-red-700 px-2 py-0.5 rounded-lg hover:bg-red-50 disabled:opacity-50 flex-shrink-0"
                          >
                            撤銷
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* CSV Import Dialog */}
            {showCsvImport && (
              <div className="bg-white rounded-2xl border border-amber-100 p-4 space-y-3">
                <p className="text-sm font-semibold text-gray-700">匯入 CSV</p>
                <p className="text-xs text-gray-500">貼上 CSV 內容（第一行為標題行，支援逗號「,」「，」及 Tab 分隔）</p>
                <textarea
                  className="w-full px-3 py-2 text-xs outline-none resize-none font-mono"
                  style={inputStyle}
                  rows={6}
                  placeholder={"名稱,號碼,起拍價\n1999年人民幣1元,R2Y9222201,500"}
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
                const numCol = columns.find(c => c.role === "itemNumber");
                const title = titleCol ? (data[titleCol.key] || "") : `商品 ${idx + 1}`;
                const itemNum = numCol ? (data[numCol.key] || "") : "";
                const colorMatch = getColorRuleMatch(colorRules, data);
                const hasBids = (item.bidCount ?? 0) > 0;
                const isEditing = editingItemId === item.id;
                const isSelected = selectedIds.has(item.id);

                return (
                  <div key={item.id}
                    id={`edit-item-${item.id}`}
                    className={`rounded-xl border p-3 transition-colors ${
                      isEditing ? "border-amber-300 bg-amber-50" :
                      isSelected && selectMode ? "border-red-300 bg-red-50" :
                      isSelected && bulkPriceMode ? "border-blue-300 bg-blue-50" :
                      "bg-white border-gray-100"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {/* 多選 checkbox */}
                      {(selectMode || bulkPriceMode) && (
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
                            ? <CheckSquare className={`w-4 h-4 ${bulkPriceMode ? "text-blue-500" : "text-red-500"}`} />
                            : <Square className="w-4 h-4 text-gray-300" />
                          }
                        </button>
                      )}

                      <span className="text-xs text-gray-400 w-6 text-center flex-shrink-0">{idx + 1}</span>

                      <div className="flex-1 min-w-0" onClick={() => {
                        if (selectMode || bulkPriceMode) {
                          const next = new Set(selectedIds);
                          if (next.has(item.id)) next.delete(item.id); else next.add(item.id);
                          setSelectedIds(next);
                        }
                      }}>
                        <p className="text-sm font-medium text-gray-800">
                          {colorMatch
                            ? <>{highlightKw(title || "—", colorMatch.keywords, colorMatch.color, colorMatch.style, colorMatch.weight)}{itemNum && <><span className="text-gray-400 mx-1">•</span>{highlightKw(itemNum, colorMatch.keywords, colorMatch.color, colorMatch.style, colorMatch.weight)}</>}</>
                            : <>{title || "—"}{itemNum && <><span className="text-gray-400 mx-1">•</span>{itemNum}</>}</>
                          }
                        </p>
                        {/* 顯示所有 customText 欄位（描述等） */}
                        {columns.filter(c => c.role === "customText" && data[c.key]).map(c => (
                          <p key={c.key} className="text-xs text-gray-500 truncate">{data[c.key]}</p>
                        ))}
                        <hr className="my-1 border-gray-100" />
                        <p className="text-xs text-gray-400">
                          {`起拍 ${currSym}${item.startPrice} • +${item.bidIncrement || parseInt(basic.defaultBidIncrement, 10) || 50} • ${item.buyNowPrice ? `封${item.buyNowPrice}` : "無封頂"}`}
                          {(() => {
                            if (item.status === "sold") {
                              const atCap = item.buyNowPrice != null && Number((item as any).finalPrice) === item.buyNowPrice;
                              return <span className="text-green-600"> • {atCap ? `✓ 封頂价${currSym}${item.buyNowPrice}成交` : `✓ ${currSym}${(item as any).finalPrice ?? (item as any).currentPrice}成交`}</span>;
                            }
                            if (item.status === "unsold") return <span> • 流拍</span>;
                            if (hasBids) {
                              const proxyName = (item as any).leadingProxyName as string | null;
                              const isProxy = (item as any).leadingIsProxy as boolean;
                              const leadingBidderName = (item as any).leadingBidderName as string | null;
                              return (
                                <span className="text-amber-600">
                                  {" • "}
                                  {isProxy && proxyName
                                    ? <><span className="text-orange-500 font-medium">{proxyName}</span><span style={{ background: "#1e3a8a", color: "#fff", fontSize: 9, borderRadius: 5, padding: "0px 4px", lineHeight: "14px", fontWeight: 600, marginLeft: 3, marginRight: 3 }}>代</span></>
                                    : leadingBidderName
                                      ? <span className="font-medium">{leadingBidderName}</span>
                                      : null
                                  }
                                  {" "}領先 {currSym}{(item as any).currentPrice ?? ""}
                                </span>
                              );
                            }
                            return null;
                          })()}
                        </p>
                      </div>

                      {!selectMode && !isEnded && (
                        <div className="flex gap-1 flex-shrink-0">
                          <button
                            onClick={() => {
                              const isBuyNowSold = item.status === "sold" && item.buyNowPrice != null && Number((item as any).finalPrice) === item.buyNowPrice;
                              if (isBuyNowSold) return;
                              if (isEditing) { setEditingItemId(null); return; }
                              setEditingItemId(item.id);
                              const ef: Record<string, string> = {};
                              columns.forEach(c => { ef[c.key] = data[c.key] ?? ""; });
                              ef.__startPrice = String(item.startPrice);
                              ef.__buyNowPrice = item.buyNowPrice ? String(item.buyNowPrice) : "";
                              ef.__bidIncrement = item.bidIncrement ? String(item.bidIncrement) : "";
                              setEditFields(ef);
                              let ids: number[] = [];
                              try { ids = JSON.parse((item as any).imageIdsJson ?? "[]"); } catch {}
                              setEditImageIds(ids);
                            }}
                            disabled={item.status === "sold" && item.buyNowPrice != null && Number((item as any).finalPrice) === item.buyNowPrice}
                            className="p-1.5 text-blue-400 hover:text-blue-600 disabled:opacity-30 disabled:cursor-not-allowed"
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
                          <span className="text-xs text-gray-500 w-20 flex-shrink-0">起拍價（{currSym}）</span>
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
                          <span className="text-xs text-gray-500 w-20 flex-shrink-0">每口加價（{currSym}）</span>
                          <input
                            className="flex-1 px-2 py-1 text-sm outline-none"
                            style={{ background: "#fff", border: "1px solid #E5E5E5", borderRadius: "8px" }}
                            placeholder="留空 = 用場次預設"
                            value={editFields.__bidIncrement ?? ""}
                            onChange={e => setEditFields(p => ({ ...p, __bidIncrement: e.target.value }))}
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500 w-20 flex-shrink-0">封頂價（{currSym}）</span>
                          <input
                            className="flex-1 px-2 py-1 text-sm outline-none"
                            style={{ background: hasBids ? "#f9fafb" : "#fff", border: "1px solid #E5E5E5", borderRadius: "8px", color: hasBids ? "#9ca3af" : undefined }}
                            disabled={hasBids}
                            placeholder={hasBids ? "已有出價，不可修改" : "留空 = 無封頂"}
                            value={editFields.__buyNowPrice ?? ""}
                            onChange={e => setEditFields(p => ({ ...p, __buyNowPrice: e.target.value }))}
                          />
                        </div>
                        {!hasBids && (() => {
                          const sp = parseInt(editFields.__startPrice || "0", 10) || 0;
                          const inc = parseInt(editFields.__bidIncrement || "0", 10) || parseInt(basic.defaultBidIncrement, 10) || 50;
                          const effectiveFirstBid = sp > 0 ? sp : inc;
                          const minCap = effectiveFirstBid + inc;
                          const capVal = editFields.__buyNowPrice ? parseInt(editFields.__buyNowPrice, 10) : null;
                          const isInvalid = capVal !== null && !isNaN(capVal) && capVal < minCap;
                          return (
                            <p className="text-[10px] ml-[88px]" style={{ color: isInvalid ? "#ef4444" : "#9ca3af" }}>
                              {isInvalid ? `封頂價最少 ${currSym}${minCap}` : `最少 ${currSym}${minCap}（起拍 + 每口 × ${sp > 0 ? 1 : 2}）`}
                            </p>
                          );
                        })()}
                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={() => {
                              const colData: Record<string, string> = {};
                              columns.forEach(c => { colData[c.key] = editFields[c.key] ?? ""; });
                              const patch: any = { id: item.id, dataJson: JSON.stringify(colData), imageIdsJson: JSON.stringify(editImageIds) };
                              if (!hasBids) {
                                const sp = parseInt(editFields.__startPrice || "0", 10) || 0;
                                patch.startPrice = sp;
                                const buyNowRaw = editFields.__buyNowPrice ? parseInt(editFields.__buyNowPrice, 10) : null;
                                patch.buyNowPrice = buyNowRaw && buyNowRaw > 0 ? buyNowRaw : null;
                                // 封頂價校驗
                                if (patch.buyNowPrice != null) {
                                  const inc2 = parseInt(editFields.__bidIncrement || "0", 10) || parseInt(basic.defaultBidIncrement, 10) || 50;
                                  const effectiveFirst = sp > 0 ? sp : inc2;
                                  const minCap = effectiveFirst + inc2;
                                  if (patch.buyNowPrice < minCap) {
                                    toast.error(`封頂價最少 ${currSym}${minCap}`);
                                    return;
                                  }
                                }
                              }
                              const inc = parseInt(editFields.__bidIncrement || "0", 10);
                              patch.bidIncrement = inc > 0 ? inc : 0;
                              scrollToItemIdRef.current = item.id;
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

                        {/* 圖片選擇器 */}
                        {images.length > 0 && (
                          <div className="pt-1">
                            <p className="text-xs text-gray-500 mb-1.5">關聯圖片（最多 10 張，點選）</p>
                            <div className="flex flex-wrap gap-1.5">
                              {images.map(img => {
                                const sel = editImageIds.includes(img.id);
                                return (
                                  <button
                                    key={img.id}
                                    type="button"
                                    onClick={() => {
                                      if (sel) {
                                        setEditImageIds(p => p.filter(id => id !== img.id));
                                      } else if (editImageIds.length < 10) {
                                        setEditImageIds(p => [...p, img.id]);
                                      } else {
                                        toast.info("最多可選 10 張圖片");
                                      }
                                    }}
                                    className="relative flex-shrink-0"
                                    style={{ width: 48, height: 48 }}
                                  >
                                    <img src={img.url} alt="" className="w-full h-full object-cover rounded-lg" style={{ border: sel ? "2px solid #f59e0b" : "2px solid #e5e7eb" }} />
                                    {sel && (
                                      <div className="absolute inset-0 rounded-lg bg-amber-500/20 flex items-center justify-center">
                                        <Check className="w-3.5 h-3.5 text-amber-600" />
                                      </div>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                            {editImageIds.length > 0 && (
                              <p className="text-[10px] text-amber-600 mt-1">已選 {editImageIds.length} 張</p>
                            )}
                          </div>
                        )}

                        {/* 推廣圖片快選（自動加入圖片集再選） */}
                        {promoImages.filter(pi => !images.some(img => img.url === pi.url)).length > 0 && (
                          <div className="pt-1">
                            <p className="text-[10px] text-gray-400 mb-1.5">推廣圖片（點擊自動加入圖片集並選取）</p>
                            <div className="flex flex-wrap gap-1.5">
                              {promoImages.filter(pi => !images.some(img => img.url === pi.url)).map((pi, i) => (
                                <button
                                  key={i}
                                  type="button"
                                  disabled={editImageIds.length >= 10}
                                  onClick={async () => {
                                    if (editImageIds.length >= 10) { toast.info("最多可選 10 張圖片"); return; }
                                    const img = await addPromoToGallery(pi);
                                    if (img) setEditImageIds(p => [...p, img.id]);
                                  }}
                                  className="relative flex-shrink-0 disabled:opacity-40"
                                  style={{ width: 48, height: 48 }}
                                  title="加入圖片集並選取"
                                >
                                  <img src={pi.url} alt="" className="w-full h-full object-cover rounded-lg" style={{ border: "2px dashed #f59e0b" }} />
                                  <div className="absolute inset-0 rounded-lg bg-amber-500/20 flex items-center justify-center">
                                    <Plus className="w-3 h-3 text-amber-600" />
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── 成績紀錄 Tab ── */}
        {tab === "results" && (() => {
          const showCols = columns.filter(c => c.showOnBidPage);
          const commRate = parseFloat(String(round?.buyerCommissionRate ?? "0")) || 0;
          const commPct = Math.round(commRate * 100);

          // Use correct DB fields: status='sold'/'unsold', winnerId, finalPrice, dataJson
          const soldItems = [...items.filter(it => (it as any).status === 'sold')].sort((a, b) => {
            const ap = (a as any).finalPrice ?? 0;
            const bp = (b as any).finalPrice ?? 0;
            return resultSortDir === "desc" ? bp - ap : ap - bp;
          });
          const unsoldItems = items.filter(it => (it as any).status === 'unsold');

          // Proxy badge
          const ProxyBadge = () => (
            <span style={{ background: "#1e3a8a", color: "#fff", fontSize: 10, borderRadius: 6, padding: "0px 5px", lineHeight: "16px", fontWeight: 600, whiteSpace: "nowrap", flexShrink: 0 }}>代</span>
          );

          // buyer key: "user:N" for real bidders, "proxy:Name" for proxy bidders
          function getBuyerKey(it: any): string | null {
            if ((it as any).leadingIsProxy && (it as any).leadingProxyName) return `proxy:${(it as any).leadingProxyName}`;
            const uid = (it as any).winnerId as number | null;
            return uid ? `user:${uid}` : null;
          }
          const buyerMap = new Map<string, { name: string; photoUrl: string | null; isProxy: boolean; whatsapp: string | null; facebook: string | null }>();
          soldItems.forEach(it => {
            const key = getBuyerKey(it);
            if (!key || buyerMap.has(key)) return;
            if ((it as any).leadingIsProxy && (it as any).leadingProxyName) {
              buyerMap.set(key, { name: (it as any).leadingProxyName, photoUrl: null, isProxy: true, whatsapp: null, facebook: null });
            } else {
              const uid = (it as any).winnerId as number;
              buyerMap.set(key, { name: (it as any).winnerName ?? `用戶${uid}`, photoUrl: (it as any).winnerPhotoUrl ?? null, isProxy: false, whatsapp: (it as any).winnerWhatsapp ?? null, facebook: (it as any).winnerFacebook ?? null });
            }
          });
          const buyers = [...buyerMap.entries()];

          const filteredSold = resultBuyerKey
            ? soldItems.filter(it => getBuyerKey(it) === resultBuyerKey)
            : soldItems;

          const totalAllAmt = soldItems.reduce((s, it) => s + ((it as any).finalPrice ?? 0), 0);
          const filteredAmt = filteredSold.reduce((s, it) => s + ((it as any).finalPrice ?? 0), 0);
          const filteredComm = Math.round(filteredAmt * commRate);

          function parseData(it: any) {
            try { return JSON.parse(it.dataJson || "{}"); } catch { return {}; }
          }

          const TD = 'style="border:1px solid #ddd;padding:5px 8px"';
          const TDR = 'style="border:1px solid #ddd;padding:5px 8px;text-align:right"';
          const TDB = 'style="border:1px solid #ddd;padding:5px 8px;font-weight:bold"';
          const TDBR = 'style="border:1px solid #ddd;padding:5px 8px;font-weight:bold;text-align:right"';
          const TH = 'style="border:1px solid #ddd;padding:5px 8px;background:#f5f5f5;text-align:left"';
          const THR = 'style="border:1px solid #ddd;padding:5px 8px;background:#f5f5f5;text-align:right"';

          function buildPrintHtml(buyerKey: string | null) {
            const targetItems = buyerKey !== null
              ? soldItems.filter(it => getBuyerKey(it) === buyerKey)
              : soldItems;
            const buyerLabel = buyerKey !== null ? (buyerMap.get(buyerKey)?.name ?? "") : "全場";
            const printCols = showCols.filter(c => c.role !== "startPrice");
            const colTh = printCols.map(c => `<th ${TH}>${c.label}</th>`).join("");
            const commTh = commRate > 0 ? `<th ${THR}>買家傭金(${commPct}%)</th>` : "";
            const soldRows = targetItems.map(it => {
              const d = parseData(it);
              const price = (it as any).finalPrice ?? 0;
              const comm = Math.round(price * commRate);
              const colTd = printCols.map(c => `<td ${TD}>${d[c.key] ?? "—"}</td>`).join("");
              const commTd = commRate > 0 ? `<td ${TDR}>HK$${comm.toLocaleString()}</td>` : "";
              const itIsProxy = !!(it as any).leadingIsProxy;
              const itBuyerName = itIsProxy ? ((it as any).leadingProxyName ?? (it as any).winnerName ?? "") : ((it as any).winnerName ?? "");
              const buyerTd = buyerKey === null ? `<td ${TD}>${itBuyerName}${itIsProxy ? " (代)" : ""}</td>` : "";
              return `<tr>${colTd}<td ${TDR}>HK$${price.toLocaleString()}</td>${commTd}<td ${TDBR}>HK$${(price + comm).toLocaleString()}</td>${buyerTd}</tr>`;
            }).join("");
            const totalAmt = targetItems.reduce((s, it) => s + ((it as any).finalPrice ?? 0), 0);
            const totalComm = Math.round(totalAmt * commRate);
            const fspan = printCols.length + (buyerKey === null ? 1 : 0);
            const buyerColTh = buyerKey === null ? `<th ${TH}>買家</th>` : "";
            const commFoot = commRate > 0 ? `<td ${TDBR}>HK$${totalComm.toLocaleString()}</td>` : "";
            const soldTfoot = `<tfoot><tr><td colspan="${fspan}" ${TDB}>合計 ${targetItems.length} 件</td><td ${TDBR}>HK$${totalAmt.toLocaleString()}</td>${commFoot}<td ${TDBR}>HK$${(totalAmt + totalComm).toLocaleString()}</td></tr></tfoot>`;

            let unsoldSection = "";
            if (!buyerKey && unsoldItems.length > 0) {
              const uColTh = printCols.map(c => `<th ${TH}>${c.label}</th>`).join("");
              const uRows = unsoldItems.map(it => {
                const d = parseData(it);
                const colTd = printCols.map(c => `<td ${TD}>${d[c.key] ?? "—"}</td>`).join("");
                return `<tr>${colTd}<td ${TDR} style="color:#999">HK$${((it as any).startPrice ?? 0).toLocaleString()}</td></tr>`;
              }).join("");
              unsoldSection = `<h3 style="margin:28px 0 8px">流拍商品（${unsoldItems.length} 件）</h3><table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr>${uColTh}<th ${THR}>起拍價</th></tr></thead><tbody>${uRows}</tbody></table>`;
            }
            return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${round?.title} 成交紀錄</title><style>body{font-family:sans-serif;padding:20px;font-size:13px}h2,h3{margin-bottom:8px}table{width:100%;border-collapse:collapse}@media print{body{padding:8px}}</style></head><body><h2>${round?.title} — 成交紀錄（${buyerLabel}）</h2><p style="color:#666;margin-bottom:16px">有成交 ${targetItems.length} 件 · 成交額 HK$${totalAmt.toLocaleString()}${commRate > 0 ? ` · 買家傭金 HK$${totalComm.toLocaleString()} · 合計 HK$${(totalAmt + totalComm).toLocaleString()}` : ""}</p><h3>有成交商品</h3><table><thead><tr>${colTh}<th ${THR}>成交價</th>${commTh}<th ${THR}>合計</th>${buyerColTh}</tr></thead><tbody>${soldRows}</tbody>${soldTfoot}</table>${unsoldSection}</body></html>`;
          }

          function doPrint(buyerKey: string | null) {
            const w = window.open("", "_blank");
            if (!w) { toast.error("請允許彈出視窗"); return; }
            w.document.write(buildPrintHtml(buyerKey));
            w.document.close();
            setTimeout(() => w.print(), 300);
          }

          return (
            <div className={`space-y-4 ${relistMode ? "pb-20" : ""}`}>
              {/* Summary */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-white rounded-xl border border-gray-100 p-3 text-center">
                  <p className="text-xl font-bold text-green-600">{soldItems.length}</p>
                  <p className="text-xs text-gray-400 mt-0.5">有成交</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 p-3 text-center">
                  <p className="text-xl font-bold text-gray-300">{unsoldItems.length}</p>
                  <p className="text-xs text-gray-400 mt-0.5">流拍</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 p-3 text-center">
                  <p className="text-xl font-bold text-amber-600">{buyers.length}</p>
                  <p className="text-xs text-gray-400 mt-0.5">買家</p>
                </div>
              </div>
              {totalAllAmt > 0 && (
                <div className="bg-white rounded-xl border border-gray-100 p-3">
                  <p className="text-xs text-gray-400 mb-1">全場成交統計</p>
                  <p className="text-sm font-semibold text-gray-900">
                    成交 HK${totalAllAmt.toLocaleString()}
                    {commRate > 0 && (
                      <span className="text-gray-500 font-normal"> + 買家傭金({commPct}%) HK${Math.round(totalAllAmt * commRate).toLocaleString()} = <span className="text-amber-700 font-bold">HK${(totalAllAmt + Math.round(totalAllAmt * commRate)).toLocaleString()}</span></span>
                    )}
                  </p>
                </div>
              )}

              {/* Controls */}
              <div className="flex items-center gap-2 flex-wrap">
                {relistMode === null ? (
                  <>
                    <button
                      onClick={() => setResultSortDir(d => d === "desc" ? "asc" : "desc")}
                      className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1.5 rounded-lg"
                    >
                      成交價：{resultSortDir === "desc" ? "高→低" : "低→高"}
                    </button>
                    <button
                      onClick={() => recalcResultsMut.mutate({ id: round.id })}
                      disabled={recalcResultsMut.isPending}
                      className="text-xs bg-amber-50 hover:bg-amber-100 text-amber-700 px-3 py-1.5 rounded-lg disabled:opacity-50"
                    >
                      {recalcResultsMut.isPending ? "修正中…" : "重新計算結果"}
                    </button>
                    <div className="ml-auto flex items-center gap-2">
                      <button
                        onClick={() => setShowAllInvoice(true)}
                        className="flex items-center gap-1 text-xs bg-green-50 hover:bg-green-100 text-green-700 px-3 py-1.5 rounded-xl"
                      >
                        <Download className="w-3 h-3" /> 全場成交單
                      </button>
                      <button
                        onClick={() => setRelistSheet(true)}
                        className="flex items-center gap-1 text-xs bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 rounded-xl font-medium"
                      >
                        重拍
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => { setRelistMode(null); setRelistSelectedIds(new Set()); }}
                      className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1.5 rounded-lg"
                    >
                      取消選擇
                    </button>
                    <button
                      onClick={() => {
                        const allIds = [...soldItems, ...unsoldItems].map((it: any) => it.id as number);
                        const allSelected = allIds.every(id => relistSelectedIds.has(id));
                        if (allSelected) {
                          setRelistSelectedIds(new Set());
                        } else {
                          setRelistSelectedIds(new Set(allIds));
                        }
                      }}
                      className="text-xs bg-orange-50 hover:bg-orange-100 text-orange-700 px-3 py-1.5 rounded-lg"
                    >
                      {[...soldItems, ...unsoldItems].every((it: any) => relistSelectedIds.has(it.id)) ? "取消全選" : "全選"}
                    </button>
                    <span className="text-xs text-gray-500">已選 {relistSelectedIds.size} 件</span>
                  </>
                )}
              </div>

              {/* Sold items — accordion per buyer */}
              {soldItems.length === 0 && (
                <div className="text-center py-10 text-gray-400 text-sm">此場次暫無得標紀錄</div>
              )}
              {soldItems.length > 0 && (() => {
                function toggleSection(key: string) {
                  setExpandedSections(prev => {
                    const next = new Set(prev);
                    if (next.has(key)) next.delete(key); else next.add(key);
                    return next;
                  });
                }
                function renderItems(itemList: typeof soldItems, showBuyer: boolean) {
                  return (
                    <div style={{ display: "flex", flexDirection: "column", gap: "5px", padding: "4px", background: "#f3f4f6" }}>
                      {itemList.map((it) => {
                        const d = parseData(it);
                        const price = (it as any).finalPrice ?? 0;
                        const comm = Math.round(price * commRate);
                        const itemIsProxy = !!(it as any).leadingIsProxy;
                        const effectiveBuyer = itemIsProxy ? ((it as any).leadingProxyName ?? (it as any).winnerName ?? "") : ((it as any).winnerName ?? "");
                        const itemColVals = showCols
                          .filter(c => c.role !== "startPrice" && d[c.key] != null && d[c.key] !== "")
                          .map(c => d[c.key]);
                        const itemId = (it as any).id as number;
                        const isChecked = relistSelectedIds.has(itemId);
                        return (
                          <div
                            key={itemId}
                            className={`flex items-center gap-2 px-3 py-2 text-xs min-w-0 bg-white rounded-lg ${relistMode ? "cursor-pointer" : ""} ${relistMode && isChecked ? "ring-1 ring-orange-400" : ""}`}
                            onClick={relistMode ? () => {
                              setRelistSelectedIds(prev => {
                                const next = new Set(prev);
                                if (next.has(itemId)) next.delete(itemId); else next.add(itemId);
                                return next;
                              });
                            } : undefined}
                          >
                            {relistMode && (
                              <span className={`flex-shrink-0 w-4 h-4 rounded border ${isChecked ? "bg-orange-500 border-orange-500" : "border-gray-300"} flex items-center justify-center`}>
                                {isChecked && <Check className="w-2.5 h-2.5 text-white" />}
                              </span>
                            )}
                            <span className="text-gray-400 font-mono w-5 flex-shrink-0 text-right">{(it as any).displayOrder + 1}</span>
                            <span className="flex-1 min-w-0 text-gray-700 truncate">{itemColVals.join(" · ") || "—"}</span>
                            {showBuyer && (
                              <span className="flex items-center gap-1 flex-shrink-0">
                                <span className="text-gray-400 truncate max-w-[5rem]">{effectiveBuyer}</span>
                                {itemIsProxy && <ProxyBadge />}
                              </span>
                            )}
                            <span className="ml-auto flex-shrink-0 text-right whitespace-nowrap">
                              <span className="text-gray-600">HK${price.toLocaleString()}</span>
                              {commRate > 0 && <span className="text-gray-400"> +{comm.toLocaleString()}</span>}
                              <span className="font-bold text-gray-900"> ={( price + comm).toLocaleString()}</span>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  );
                }
                const sections: { key: string; label: string; items: typeof soldItems; showBuyer: boolean; isProxy: boolean; whatsapp: string | null; facebook: string | null }[] = [
                  { key: "all", label: `全部 (${soldItems.length})`, items: soldItems, showBuyer: true, isProxy: false, whatsapp: null, facebook: null },
                  ...buyers.map(([key, buyer]) => {
                    const buyerItems = soldItems.filter(it => getBuyerKey(it) === key);
                    const buyerAmt = buyerItems.reduce((s, it) => s + ((it as any).finalPrice ?? 0), 0);
                    const buyerComm = Math.round(buyerAmt * commRate);
                    return {
                      key,
                      label: `${buyer.name} (${buyerItems.length})${commRate > 0 ? ` · HK$${buyerAmt.toLocaleString()} + 傭 HK$${buyerComm.toLocaleString()} = HK$${(buyerAmt + buyerComm).toLocaleString()}` : ` · 成交 HK$${buyerAmt.toLocaleString()}`}`,
                      items: buyerItems,
                      showBuyer: false,
                      isProxy: buyer.isProxy,
                      whatsapp: buyer.whatsapp ?? null,
                      facebook: buyer.facebook ?? null,
                    };
                  }),
                ];
                return (
                  <div className="space-y-2">
                    {sections.map(sec => {
                      const isExpanded = expandedSections.has(sec.key);
                      return (
                        <div key={sec.key} className="border border-gray-200 rounded-xl overflow-hidden">
                          <div className="flex items-center bg-gray-50 hover:bg-gray-100">
                            <button
                              onClick={() => toggleSection(sec.key)}
                              className="flex-1 flex items-center justify-between px-3 py-2.5 text-left min-w-0"
                            >
                              <span className="text-xs font-semibold text-gray-700 flex items-center gap-1.5 min-w-0">
                                <span className="truncate">{sec.label}</span>
                                {sec.isProxy && <ProxyBadge />}
                              </span>
                              <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 ml-1 transition-transform duration-150 ${isExpanded ? "" : "-rotate-90"}`} />
                            </button>
                            {sec.key !== "all" && (
                              <button
                                onClick={() => setInvoiceBuyerKey(sec.key)}
                                className="flex-shrink-0 text-xs bg-amber-500 hover:bg-amber-600 text-white px-2.5 py-1 rounded-lg mr-2"
                              >
                                成交單
                              </button>
                            )}
                          </div>
                          {isExpanded && renderItems(sec.items, sec.showBuyer)}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {/* Unsold items */}
              {!resultBuyerKey && unsoldItems.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 mb-2">流拍商品 ({unsoldItems.length})</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: "5px", padding: "4px", background: "#f3f4f6" }}>
                    {unsoldItems.map(it => {
                      const d = parseData(it);
                      const startPrice = (it as any).startPrice ?? 0;
                      const itemId = (it as any).id as number;
                      const isChecked = relistSelectedIds.has(itemId);
                      return (
                        <div
                          key={itemId}
                          className={`flex items-center gap-2 px-3 py-2 text-xs min-w-0 bg-white rounded-lg opacity-60 ${relistMode ? "cursor-pointer !opacity-100" : ""} ${relistMode && isChecked ? "ring-1 ring-orange-400" : ""}`}
                          onClick={relistMode ? () => {
                            setRelistSelectedIds(prev => {
                              const next = new Set(prev);
                              if (next.has(itemId)) next.delete(itemId); else next.add(itemId);
                              return next;
                            });
                          } : undefined}
                        >
                          {relistMode && (
                            <span className={`flex-shrink-0 w-4 h-4 rounded border ${isChecked ? "bg-orange-500 border-orange-500" : "border-gray-300"} flex items-center justify-center`}>
                              {isChecked && <Check className="w-2.5 h-2.5 text-white" />}
                            </span>
                          )}
                          <span className="text-gray-400 font-mono w-5 flex-shrink-0 text-right">{(it as any).displayOrder + 1}</span>
                          <span className="flex-1 min-w-0 text-gray-600 truncate">
                            {showCols.filter(c => c.role !== "startPrice" && d[c.key] != null && d[c.key] !== "").map(c => d[c.key]).join(" · ") || "—"}
                          </span>
                          <span className="ml-auto flex-shrink-0 text-gray-400 whitespace-nowrap">起拍 HK${startPrice.toLocaleString()}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 重拍選擇確認 bar */}
              {relistMode !== null && (
                <div
                  style={{
                    position: "fixed",
                    bottom: 60,
                    left: 0,
                    right: 0,
                    zIndex: 50,
                    background: "#fff",
                    borderTop: "1px solid #e5e7eb",
                    padding: "12px 16px",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    boxShadow: "0 -4px 12px rgba(0,0,0,0.08)",
                  }}
                >
                  <span className="text-sm text-gray-600 flex-1">
                    已選 <span className="font-bold text-orange-600">{relistSelectedIds.size}</span> 件
                  </span>
                  <button
                    onClick={() => { setRelistMode(null); setRelistSelectedIds(new Set()); }}
                    className="text-xs text-gray-500 px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200"
                  >
                    取消
                  </button>
                  <button
                    disabled={relistSelectedIds.size === 0 || relistAsAuctionDraftsMut.isPending || relistAsProductDraftsMut.isPending || relistSelectedAsGroupDraftMut.isPending}
                    onClick={() => {
                      if (relistSelectedIds.size === 0) { toast.error("請先選擇商品"); return; }
                      const ids = [...relistSelectedIds];
                      if (relistMode === "auction") {
                        relistAsAuctionDraftsMut.mutate({ roundId: roundId!, itemIds: ids });
                      } else if (relistMode === "product") {
                        relistAsProductDraftsMut.mutate({ roundId: roundId!, itemIds: ids });
                      } else if (relistMode === "group") {
                        relistSelectedAsGroupDraftMut.mutate({ roundId: roundId!, itemIds: ids });
                      }
                    }}
                    className="text-xs text-white px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 disabled:opacity-50 font-medium"
                  >
                    {relistAsAuctionDraftsMut.isPending || relistAsProductDraftsMut.isPending || relistSelectedAsGroupDraftMut.isPending ? "處理中…" : (
                      relistMode === "auction" ? "加入拍賣草稿" : relistMode === "group" ? "複製為新團拍草稿" : "加入商品草稿"
                    )}
                  </button>
                </div>
              )}

              {/* 重拍選項 bottom sheet */}
              {relistSheet && (
                <div
                  style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.4)" }}
                  onClick={() => setRelistSheet(false)}
                >
                  <div
                    style={{
                      position: "absolute",
                      bottom: 0,
                      left: 0,
                      right: 0,
                      background: "#fff",
                      borderRadius: "20px 20px 0 0",
                      padding: "20px 16px 32px",
                    }}
                    onClick={e => e.stopPropagation()}
                  >
                    <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
                    <p className="text-sm font-bold text-gray-800 mb-4">重拍 — 選擇操作</p>
                    <div className="space-y-3">
                      <button
                        disabled={relistAsGroupDraftMut.isPending}
                        onClick={() => relistAsGroupDraftMut.mutate({ roundId: roundId! })}
                        className="w-full text-left px-4 py-3.5 rounded-xl border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
                      >
                        <p className="text-sm font-semibold text-gray-800">
                          {relistAsGroupDraftMut.isPending ? "複製中…" : "重新上拍（整場）"}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">將整場資料（包括所有商品及圖片）複製為新草稿</p>
                      </button>
                      <button
                        onClick={() => { setRelistMode("auction"); setRelistSheet(false); setRelistSelectedIds(new Set()); }}
                        className="w-full text-left px-4 py-3.5 rounded-xl border border-gray-200 hover:bg-gray-50"
                      >
                        <p className="text-sm font-semibold text-gray-800">拍賣商品</p>
                        <p className="text-xs text-gray-400 mt-0.5">選定商品複製至商戶後台「拍賣草稿」</p>
                      </button>
                      <button
                        onClick={() => { setRelistMode("product"); setRelistSheet(false); setRelistSelectedIds(new Set()); }}
                        className="w-full text-left px-4 py-3.5 rounded-xl border border-gray-200 hover:bg-gray-50"
                      >
                        <p className="text-sm font-semibold text-gray-800">出售商品</p>
                        <p className="text-xs text-gray-400 mt-0.5">選定商品複製至商戶後台「商品管理草稿」</p>
                      </button>
                    </div>
                    <button onClick={() => setRelistSheet(false)} className="mt-4 w-full py-3 text-sm text-gray-400 hover:text-gray-600">取消</button>
                  </div>
                </div>
              )}

              {/* Invoice Modal */}
              {invoiceBuyerKey !== null && (() => {
                const invoiceBuyer = buyerMap.get(invoiceBuyerKey);
                const buyerName = invoiceBuyer?.name ?? "";
                const buyerIsProxy = invoiceBuyer?.isProxy ?? false;
                const buyerItems = soldItems
                  .filter(it => getBuyerKey(it) === invoiceBuyerKey)
                  .sort((a, b) => (a as any).displayOrder - (b as any).displayOrder);
                const buyerAmt = buyerItems.reduce((s, it) => s + ((it as any).finalPrice ?? 0), 0);
                const buyerComm = Math.round(buyerAmt * commRate);
                const now = new Date();
                const dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;

                async function saveImage() {
                  if (!invoiceRef.current) return;
                  try {
                    const { toPng } = await import('html-to-image');
                    const dataUrl = await toPng(invoiceRef.current, { backgroundColor: '#ffffff', pixelRatio: 2 });
                    setInvoicePreviewFilename(`成交單-${buyerName}.png`);
                    setInvoicePreviewUrl(dataUrl);
                  } catch (e) { toast.error("儲存圖片失敗"); }
                }

                function proxyUrl(url: string | null | undefined) {
                  if (!url) return null;
                  return `/api/img-proxy?url=${encodeURIComponent(url)}`;
                }

                return (
                  <div
                    className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center p-4"
                    onClick={() => setInvoiceBuyerKey(null)}
                  >
                    <div
                      className="bg-white rounded-2xl shadow-2xl w-full max-w-sm flex flex-col"
                      style={{ maxHeight: "90vh" }}
                      onClick={e => e.stopPropagation()}
                    >
                      {/* Capturable invoice area */}
                      <div ref={invoiceRef} className="p-5 overflow-y-auto flex-1 bg-white rounded-t-2xl">
                        <div className="text-center mb-4 pb-3 border-b border-gray-200">
                          <p className="text-sm font-bold text-gray-900">{round?.title}</p>
                          <p className="text-xs text-gray-400 mt-0.5">成交單 · {dateStr}</p>
                        </div>
                        {/* 買家行 */}
                        {(() => {
                          const buyerProxySrc = proxyUrl(invoiceBuyer?.photoUrl ?? null);
                          const wsNum = (() => {
                            const raw = invoiceBuyer?.whatsapp;
                            if (!raw) return null;
                            const digits = raw.replace(/\D/g, '');
                            if (!digits) return null;
                            if (digits.length === 8) return `852${digits}`;
                            if (digits.startsWith('852') && digits.length >= 11) return digits;
                            if (digits.length > 8) return digits;
                            return digits;
                          })();
                          const wsHref = wsNum ? `https://wa.me/${wsNum}` : null;
                          const fbRaw = invoiceBuyer?.facebook ?? null;
                          const fbHref = (() => {
                            if (!fbRaw) return null;
                            const s = fbRaw.trim();
                            // already an m.me link
                            if (s.includes('m.me/')) return s.startsWith('http') ? s : `https://${s}`;
                            // extract username from facebook.com URL
                            const m = s.match(/facebook\.com\/([^/?#\s]+)/);
                            const username = m ? m[1] : s.replace(/^https?:\/\/[^/]*\/?/, '').split(/[/?#]/)[0] || s;
                            return `https://m.me/${username}`;
                          })();
                          return (
                            <div className="mb-3">
                              <div className="flex justify-end gap-1 mb-1">
                                {wsHref ? (
                                  <a href={wsHref} target="_blank" rel="noopener noreferrer"
                                    className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                                    style={{ background: '#25D366', color: '#fff', lineHeight: '16px' }}>WS</a>
                                ) : (
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                                    style={{ background: '#e5e7eb', color: '#9ca3af', lineHeight: '16px' }}>WS</span>
                                )}
                                {fbHref ? (
                                  <a href={fbHref} target="_blank" rel="noopener noreferrer"
                                    className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                                    style={{ background: '#0084FF', color: '#fff', lineHeight: '16px' }}>MSN</a>
                                ) : (
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                                    style={{ background: '#e5e7eb', color: '#9ca3af', lineHeight: '16px' }}>MSN</span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                {buyerProxySrc
                                  ? <img src={buyerProxySrc} className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
                                  : <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-blue-600">{buyerName.charAt(0) || "?"}</div>
                                }
                                <p className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                                  {buyerName}
                                  {buyerIsProxy && <span style={{ background: "#1e3a8a", color: "#fff", fontSize: 10, borderRadius: 6, padding: "0px 5px", lineHeight: "16px", fontWeight: 600 }}>代</span>}
                                </p>
                              </div>
                            </div>
                          );
                        })()}
                        {/* 成交明細 */}
                        <div style={{ display: "flex", flexDirection: "column", gap: "3px", marginBottom: "16px" }}>
                          {buyerItems.map(it => {
                            const d = parseData(it);
                            const price = (it as any).finalPrice ?? 0;
                            const comm = Math.round(price * commRate);
                            const colVals = showCols
                              .filter(c => c.role !== "startPrice" && d[c.key] != null && d[c.key] !== "")
                              .map(c => d[c.key]);
                            return (
                              <div key={(it as any).id} className="flex items-start gap-2 text-xs py-1.5 border-b border-gray-100">
                                <span className="text-gray-400 font-mono w-5 text-right flex-shrink-0 mt-0.5">{(it as any).displayOrder + 1}</span>
                                <div className="flex-1 min-w-0">
                                  <span className="text-gray-800">{colVals.join(" · ") || "—"}</span>
                                </div>
                                <div className="text-right flex-shrink-0">
                                  <p className="text-gray-700 font-medium">HK${price.toLocaleString()}</p>
                                  {commRate > 0 && <p className="text-gray-400">傭 HK${comm.toLocaleString()}</p>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        {/* 合計行 */}
                        <div className="pt-2 border-t border-gray-300 text-right">
                          <p className="text-sm text-gray-700 font-medium whitespace-nowrap">
                            應付合計 <span style={{ fontSize: "8px" }} className="text-gray-400 font-normal">({buyerItems.length} 件)</span>{" "}
                            <span className="text-lg font-bold text-amber-700">HK${(buyerAmt + buyerComm).toLocaleString()}</span>
                          </p>
                        </div>
                        {/* 商戶行 */}
                        {(() => {
                          const merchantRawSrc = (myApp as any)?.merchantIcon || (user as any)?.photoUrl || null;
                          const merchantProxySrc = proxyUrl(merchantRawSrc);
                          const merchantDisplayName = myApp?.merchantName || user?.name || "";
                          return (
                            <div style={{ marginTop: "18px" }} className="flex items-center justify-center gap-1.5">
                              {merchantProxySrc
                                ? <img src={merchantProxySrc} style={{ width: "10px", height: "10px" }} className="rounded-full object-cover flex-shrink-0" />
                                : <div style={{ width: "10px", height: "10px", fontSize: "6px" }} className="rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0 font-bold text-amber-700">{merchantDisplayName.charAt(0) || "?"}</div>
                              }
                              <p style={{ fontSize: "10px" }} className="text-gray-400">{merchantDisplayName}</p>
                            </div>
                          );
                        })()}
                      </div>
                      {/* Action buttons */}
                      <div className="px-4 py-3 border-t flex gap-2 flex-shrink-0">
                        <button
                          onClick={saveImage}
                          className="flex-1 flex items-center justify-center gap-1 text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-2 rounded-xl"
                        >
                          <Download className="w-3.5 h-3.5" /> 儲存圖片
                        </button>
                        <button
                          onClick={() => setInvoiceBuyerKey(null)}
                          className="flex-shrink-0 text-gray-400 hover:text-gray-600 px-2"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* 全場成交單 popup */}
              {showAllInvoice && (() => {
                const now2 = new Date();
                const dateStr2 = `${now2.getFullYear()}-${String(now2.getMonth()+1).padStart(2,'0')}-${String(now2.getDate()).padStart(2,'0')}`;
                const allPrintCols = showCols.filter(c => c.role !== "startPrice");
                const grandAmt = soldItems.reduce((s, it) => s + ((it as any).finalPrice ?? 0), 0);
                const grandComm = Math.round(grandAmt * commRate);
                const buyerIds2 = [...buyerMap.keys()];
                const merchantRawSrc2 = (myApp as any)?.merchantIcon || (user as any)?.photoUrl || null;
                const merchantProxySrc2 = merchantRawSrc2 ? `/api/img-proxy?url=${encodeURIComponent(merchantRawSrc2)}` : null;
                const merchantDisplayName2 = myApp?.merchantName || user?.name || "";

                async function saveAllImage() {
                  if (!allInvoiceRef.current) return;
                  try {
                    const { toPng } = await import('html-to-image');
                    const dataUrl = await toPng(allInvoiceRef.current, { backgroundColor: '#ffffff', pixelRatio: 2 });
                    setInvoicePreviewFilename(`全場成交單-${round?.title ?? ''}.png`);
                    setInvoicePreviewUrl(dataUrl);
                  } catch { toast.error("儲存圖片失敗"); }
                }

                function printAll() {
                  const html = buildPrintHtml(null);
                  const w = window.open("", "_blank");
                  if (!w) { toast.error("請允許彈出視窗"); return; }
                  w.document.write(html);
                  w.document.close();
                  w.focus();
                  setTimeout(() => { w.print(); }, 400);
                }

                return (
                  <div className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm flex flex-col max-h-[90vh]">
                      <div ref={allInvoiceRef} className="p-5 overflow-y-auto flex-1 bg-white rounded-t-2xl">
                        <div className="text-center mb-4 pb-3 border-b border-gray-200">
                          <p className="text-sm font-bold text-gray-900">{round?.title}</p>
                          <p className="text-xs text-gray-400 mt-0.5">全場成交單 · {dateStr2}</p>
                        </div>
                        {buyerIds2.map(bKey => {
                          const bBuyer = buyerMap.get(bKey);
                          const bName = bBuyer?.name ?? bKey;
                          const bIsProxy = bBuyer?.isProxy ?? false;
                          const bProxySrc = bBuyer?.photoUrl ? `/api/img-proxy?url=${encodeURIComponent(bBuyer.photoUrl)}` : null;
                          const bItems = soldItems.filter(it => getBuyerKey(it) === bKey);
                          const bAmt = bItems.reduce((s, it) => s + ((it as any).finalPrice ?? 0), 0);
                          const bComm = Math.round(bAmt * commRate);
                          return (
                            <div key={bKey} className="mb-5 pb-4 border-b border-gray-100 last:border-0">
                              <div className="flex items-center gap-2 mb-2">
                                {bProxySrc
                                  ? <img src={bProxySrc} className="w-5 h-5 rounded-full object-cover flex-shrink-0" />
                                  : <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 text-[9px] font-bold text-blue-600">{bName.charAt(0) || "?"}</div>
                                }
                                <p className="text-xs font-semibold text-gray-900 flex items-center gap-1">
                                  {bName}
                                  {bIsProxy && <span style={{ background: "#1e3a8a", color: "#fff", fontSize: 9, borderRadius: 5, padding: "0px 4px", lineHeight: "15px", fontWeight: 600 }}>代</span>}
                                </p>
                              </div>
                              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                                {bItems.map(it => {
                                  const d = parseData(it);
                                  const price = (it as any).finalPrice ?? 0;
                                  const comm = Math.round(price * commRate);
                                  const colVals = allPrintCols
                                    .filter(c => d[c.key] != null && d[c.key] !== "")
                                    .map(c => d[c.key]);
                                  return (
                                    <div key={(it as any).id} className="flex items-start gap-2 text-xs py-1 border-b border-gray-50">
                                      <span className="text-gray-400 font-mono w-4 text-right flex-shrink-0">{(it as any).displayOrder + 1}</span>
                                      <span className="flex-1 min-w-0 text-gray-800">{colVals.join(" · ") || "—"}</span>
                                      <div className="text-right flex-shrink-0">
                                        <p className="text-gray-700 font-medium">HK${price.toLocaleString()}</p>
                                        {commRate > 0 && <p className="text-gray-400" style={{ fontSize: "10px" }}>傭 HK${comm.toLocaleString()}</p>}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                              <div className="text-right mt-1.5">
                                <p className="text-xs text-gray-600 font-medium">
                                  小計 ({bItems.length} 件){" "}
                                  <span className="text-amber-700 font-bold">HK${(bAmt + bComm).toLocaleString()}</span>
                                  {commRate > 0 && <span className="text-gray-400 font-normal ml-1">（含傭 HK${bComm.toLocaleString()}）</span>}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                        <div className="pt-2 border-t-2 border-gray-300 text-right">
                          <p className="text-sm text-gray-700 font-medium whitespace-nowrap">
                            全場合計 <span style={{ fontSize: "8px" }} className="text-gray-400 font-normal">({soldItems.length} 件)</span>{" "}
                            <span className="text-lg font-bold text-amber-700">HK${(grandAmt + grandComm).toLocaleString()}</span>
                          </p>
                        </div>
                        {/* 流拍紀錄 */}
                        {unsoldItems.length > 0 && (
                          <div className="mt-4 pt-3 border-t border-gray-100">
                            <p className="text-xs font-semibold text-gray-400 mb-2">流拍商品 ({unsoldItems.length})</p>
                            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                              {unsoldItems.map(it => {
                                const d = parseData(it);
                                const sp = (it as any).startPrice ?? 0;
                                const unsoldColVals = allPrintCols
                                  .filter(c => d[c.key] != null && d[c.key] !== "")
                                  .map(c => d[c.key]);
                                return (
                                  <div key={(it as any).id} className="flex items-center gap-2 text-xs py-1 opacity-60">
                                    <span className="text-gray-400 font-mono w-4 text-right flex-shrink-0">{(it as any).displayOrder + 1}</span>
                                    <span className="flex-1 min-w-0 text-gray-600 truncate">{unsoldColVals.join(" · ") || "—"}</span>
                                    <span className="flex-shrink-0 text-gray-400 whitespace-nowrap">起拍 HK${sp.toLocaleString()}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        <div style={{ marginTop: "18px" }} className="flex items-center justify-center gap-1.5">
                          {merchantProxySrc2
                            ? <img src={merchantProxySrc2} style={{ width: "10px", height: "10px" }} className="rounded-full object-cover flex-shrink-0" />
                            : <div style={{ width: "10px", height: "10px", fontSize: "6px" }} className="rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0 font-bold text-amber-700">{merchantDisplayName2.charAt(0) || "?"}</div>
                          }
                          <p style={{ fontSize: "10px" }} className="text-gray-400">{merchantDisplayName2}</p>
                        </div>
                      </div>
                      <div className="px-4 py-3 border-t flex gap-2 flex-shrink-0">
                        <button onClick={saveAllImage} className="flex-1 flex items-center justify-center gap-1 text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-2 rounded-xl">
                          <Download className="w-3.5 h-3.5" /> 儲存圖片
                        </button>
                        <button onClick={() => setShowAllInvoice(false)} className="flex-shrink-0 text-gray-400 hover:text-gray-600 px-2">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          );
        })()}
      </div>
      <BottomNav />

      {/* Lightbox */}
      {/* 成交單圖片預覽 */}
      {invoicePreviewUrl && (
        <div className="fixed inset-0 z-[10000] bg-black/90 flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-sm flex flex-col items-center gap-3">
            <PinchZoomImage
              src={invoicePreviewUrl}
              alt="成交單"
              className="w-full rounded-2xl shadow-2xl object-contain"
              style={{ maxHeight: "70vh" }}
              fullscreenOnClick
            />
            <p className="text-white/60 text-xs text-center">點擊圖片放大 · 長按儲存至相冊</p>
            <div className="flex gap-3 w-full">
              <a
                href={invoicePreviewUrl}
                download={invoicePreviewFilename}
                className="flex-1 flex items-center justify-center gap-1.5 text-sm bg-white/15 hover:bg-white/25 text-white px-4 py-2.5 rounded-xl"
              >
                <Download className="w-4 h-4" /> 下載
              </a>
              <button
                onClick={() => setInvoicePreviewUrl(null)}
                className="flex-1 text-sm bg-white/10 hover:bg-white/20 text-white/80 px-4 py-2.5 rounded-xl"
              >
                關閉
              </button>
            </div>
          </div>
        </div>
      )}

      {lightboxUrl && (
        <div
          className="fixed inset-0 z-[9999] bg-black/85 flex items-center justify-center"
          onClick={() => setLightboxUrl(null)}
        >
          <img src={lightboxUrl} alt="" className="max-w-full max-h-full object-contain rounded-lg" style={{ maxHeight: "90vh", maxWidth: "95vw" }} />
          <button className="absolute top-4 right-4 text-white/70 hover:text-white" onClick={() => setLightboxUrl(null)}>
            <X className="w-7 h-7" />
          </button>
        </div>
      )}
    </div>
  );
}

// ── 匯出 CSV 按鈕 ────────────────────────────────────────────────────────────
function ExportCsvButton({ roundId, format, label, columns, buyerId }: {
  roundId: number; format: "by_order" | "by_buyer"; label: string; columns: ColumnDef[]; buyerId?: number | null;
}) {
  const { refetch } = trpc.groupAuctions.exportResults.useQuery(
    { roundId, format, buyerId: buyerId ?? undefined },
    { enabled: false }
  );

  function downloadCsv() {
    refetch().then((r) => {
      const rows = r.data?.rows;
      if (!rows || rows.length === 0) { toast.error("暫無結果資料"); return; }
      const cols = columns.map(c => c.label);
      const extraCols = ["起拍價", "成交價", "買家傭金率", "買家傭金", "應付總額", "買家", "狀態"];
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
