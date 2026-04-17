import { useState, useRef, useCallback } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  Plus, Pencil, Trash2, Archive, RotateCcw, Upload, X,
  ImageIcon, CheckCircle2, AlertCircle, Loader2, ChevronLeft,
  RefreshCw, Eye, Send, CheckSquare, Square,
} from "lucide-react";

const MAX_IMAGES = 10;
const MAX_FILE_SIZE = 5 * 1024 * 1024;

const BID_INCREMENT_OPTIONS = [30, 50, 100, 200, 300, 500, 1000, 2000, 3000, 5000];

const CURRENCY_OPTIONS = [
  { value: "HKD", label: "🇭🇰 港幣 HKD", symbol: "HK$" },
  { value: "USD", label: "🇺🇸 美元 USD", symbol: "US$" },
  { value: "CNY", label: "🇨🇳 人民幣 CNY", symbol: "¥" },
  { value: "GBP", label: "🇬🇧 英鎊 GBP", symbol: "£" },
  { value: "EUR", label: "🇪🇺 歐元 EUR", symbol: "€" },
  { value: "JPY", label: "🇯🇵 日圓 JPY", symbol: "¥" },
];

function getCurrencySymbol(c: string) {
  return CURRENCY_OPTIONS.find((x) => x.value === c)?.symbol ?? c + "$";
}

function formatDate(d: Date | string) {
  return new Date(d).toLocaleString("zh-HK", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

type UploadStatus = "pending" | "uploading" | "success" | "error";

interface PendingImage {
  file: File;
  previewUrl: string;
  status: UploadStatus;
  errorMsg?: string;
}

interface UploadedImage {
  url: string;
  displayOrder: number;
  imageId?: number;
}

interface AuctionFormData {
  title: string;
  description: string;
  startingPrice: string;
  bidIncrement: number;
  currency: string;
}

const defaultForm: AuctionFormData = {
  title: "",
  description: "",
  startingPrice: "",
  bidIncrement: 30,
  currency: "HKD",
};

type AuctionItem = {
  id: number;
  title: string;
  description: string | null;
  startingPrice: string | number;
  currentPrice: string | number;
  endTime: Date | string;
  status: string;
  bidIncrement: number | null;
  currency: string | null;
  highestBidderId: number | null;
  archived?: number | null;
  images: Array<{ id?: number; imageUrl: string; displayOrder: number }>;
};

// ─── Image Upload Zone ────────────────────────────────────────────────────────
function ImageUploadZone({
  pendingImages, uploadedImages, onAddFiles, onRemovePending, onRemoveUploaded, isUploading,
}: {
  pendingImages: PendingImage[];
  uploadedImages: UploadedImage[];
  onAddFiles: (files: File[]) => void;
  onRemovePending: (idx: number) => void;
  onRemoveUploaded: (idx: number) => void;
  isUploading: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const totalCount = uploadedImages.length + pendingImages.length;
  const remaining = MAX_IMAGES - totalCount;
  const canAddMore = remaining > 0 && !isUploading;

  const processFiles = useCallback((rawFiles: File[]) => {
    const valid = rawFiles.filter((f) => f.type.startsWith("image/") && f.size <= MAX_FILE_SIZE);
    const oversized = rawFiles.filter((f) => f.type.startsWith("image/") && f.size > MAX_FILE_SIZE);
    if (oversized.length > 0) toast.error(`${oversized.length} 張圖片超過 5MB，已略過`);
    const toAdd = valid.slice(0, remaining);
    if (toAdd.length > 0) onAddFiles(toAdd);
  }, [remaining, onAddFiles]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    processFiles(Array.from(e.dataTransfer.files));
  };

  const totalImages = uploadedImages.length + pendingImages.length;

  return (
    <div className="space-y-3">
      {canAddMore && (
        <div
          className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${isDragging ? "border-amber-400 bg-amber-50" : "border-muted-foreground/30 hover:border-amber-400"}`}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
        >
          <Upload className="w-6 h-6 mx-auto mb-1 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">拖放或點擊上傳圖片（最多 {MAX_IMAGES} 張，每張上限 5MB）</p>
          <p className="text-xs text-muted-foreground mt-0.5">還可加 {remaining} 張</p>
          <input ref={fileInputRef} type="file" multiple accept="image/*" className="hidden"
            onChange={(e) => { if (e.target.files) processFiles(Array.from(e.target.files)); e.target.value = ""; }} />
        </div>
      )}
      {totalImages > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {uploadedImages.map((img, i) => (
            <div key={`up-${i}`} className="relative aspect-square rounded-md overflow-hidden border bg-muted group">
              <img src={img.url} alt="" className="w-full h-full object-cover" />
              <button onClick={() => onRemoveUploaded(i)}
                className="absolute top-0.5 right-0.5 bg-black/60 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <X className="w-3 h-3 text-white" />
              </button>
            </div>
          ))}
          {pendingImages.map((p, i) => (
            <div key={`pend-${i}`} className="relative aspect-square rounded-md overflow-hidden border bg-muted group">
              <img src={p.previewUrl} alt="" className="w-full h-full object-cover" />
              {p.status === "uploading" && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <Loader2 className="w-5 h-5 text-white animate-spin" />
                </div>
              )}
              {p.status === "error" && (
                <div className="absolute bottom-0 left-0 right-0 bg-red-500/80 px-1 py-0.5">
                  <AlertCircle className="w-3 h-3 text-white inline mr-0.5" />
                  <span className="text-white text-xs">失敗</span>
                </div>
              )}
              {p.status === "success" && (
                <div className="absolute top-0.5 left-0.5 bg-green-500/80 rounded-full p-0.5">
                  <CheckCircle2 className="w-3 h-3 text-white" />
                </div>
              )}
              {p.status === "pending" && (
                <button onClick={() => onRemovePending(i)}
                  className="absolute top-0.5 right-0.5 bg-black/60 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <X className="w-3 h-3 text-white" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Auction Card ─────────────────────────────────────────────────────────────
function AuctionCard({
  auction, tab, selected, onToggleSelect,
  onEdit, onDelete, onPublish, onArchive, onRestore, onRelist,
}: {
  auction: AuctionItem;
  tab: string;
  selected?: boolean;
  onToggleSelect?: (id: number) => void;
  onEdit: (a: AuctionItem) => void;
  onDelete: (id: number) => void;
  onPublish: (a: AuctionItem) => void;
  onArchive: (id: number) => void;
  onRestore: (id: number) => void;
  onRelist: (id: number) => void;
}) {
  const img = auction.images?.[0]?.imageUrl;
  const isDraft = tab === "草稿";

  return (
    <div className={`flex gap-3 p-3 rounded-lg border transition-colors ${isDraft && selected ? "border-amber-400 bg-amber-50/60" : "bg-card hover:bg-accent/5"}`}>
      {/* Checkbox（只在草稿 tab 顯示） */}
      {isDraft && onToggleSelect && (
        <div className="flex items-start pt-1 flex-shrink-0">
          <Checkbox
            checked={selected ?? false}
            onCheckedChange={() => onToggleSelect(auction.id)}
            className="border-amber-400 data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500"
          />
        </div>
      )}

      <div className="w-14 h-14 rounded-md overflow-hidden bg-muted flex-shrink-0">
        {img ? (
          <img src={img} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon className="w-6 h-6 text-muted-foreground/40" />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{auction.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          起拍：{getCurrencySymbol(auction.currency ?? "HKD")}{Number(auction.startingPrice).toLocaleString()}
          {" · "}每口：{auction.currency ?? "HKD"}${auction.bidIncrement ?? 30}
        </p>
        {auction.endTime && tab !== "草稿" && (
          <p className="text-xs text-muted-foreground mt-0.5">
            {tab === "進行中" ? "結束：" : tab === "已結束" ? "結標：" : ""}
            {formatDate(auction.endTime)}
          </p>
        )}
        <div className="flex gap-1.5 mt-2 flex-nowrap overflow-x-auto">
          {tab === "草稿" && (
            <>
              <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1" onClick={() => onEdit(auction)}>
                <Pencil className="w-3 h-3" />編輯
              </Button>
              <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1 border-green-300 text-green-700 hover:bg-green-50" onClick={() => onPublish(auction)}>
                <Send className="w-3 h-3" />發佈
              </Button>
              <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1 border-red-200 text-red-600 hover:bg-red-50" onClick={() => onDelete(auction.id)}>
                <Trash2 className="w-3 h-3" />刪除
              </Button>
            </>
          )}
          {tab === "進行中" && (
            <Link href={`/auctions/${auction.id}`}>
              <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1">
                <Eye className="w-3 h-3" />查看
              </Button>
            </Link>
          )}
          {tab === "已結束" && (
            <>
              <Link href={`/auctions/${auction.id}`}>
                <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1">
                  <Eye className="w-3 h-3" />查看
                </Button>
              </Link>
              <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1 border-purple-200 text-purple-700 hover:bg-purple-50" onClick={() => onRelist(auction.id)}>
                <RotateCcw className="w-3 h-3" />重新刊登
              </Button>
              <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1 border-gray-300 text-gray-600 hover:bg-gray-50" onClick={() => onArchive(auction.id)}>
                <Archive className="w-3 h-3" />封存
              </Button>
            </>
          )}
          {tab === "封存" && (
            <>
              <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1 border-amber-200 text-amber-700 hover:bg-amber-50" onClick={() => onRestore(auction.id)}>
                <RotateCcw className="w-3 h-3" />取消封存
              </Button>
              <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1 border-purple-200 text-purple-700 hover:bg-purple-50" onClick={() => onRelist(auction.id)}>
                <RotateCcw className="w-3 h-3" />重新刊登
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function MerchantAuctions() {
  const { isAuthenticated } = useAuth();
  const [tab, setTab] = useState<"進行中" | "草稿" | "已結束" | "封存">("草稿");

  // Create/Edit dialog
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<AuctionFormData>(defaultForm);
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // Single publish dialog
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishTarget, setPublishTarget] = useState<AuctionItem | null>(null);
  const [publishEndTime, setPublishEndTime] = useState("");

  // Batch publish
  const [selectedDrafts, setSelectedDrafts] = useState<Set<number>>(new Set());
  const [batchPublishOpen, setBatchPublishOpen] = useState(false);
  const [batchEndTime, setBatchEndTime] = useState("");

  const { data: merchantSettings } = trpc.merchants.getSettings.useQuery(undefined, { enabled: isAuthenticated });
  const { data: myAuctions, isLoading: loadingActive, refetch: refetchActive } = trpc.merchants.myAuctions.useQuery();
  const { data: myDrafts, isLoading: loadingDrafts, refetch: refetchDrafts } = trpc.merchants.myDrafts.useQuery();
  const { data: myArchived, isLoading: loadingArchived, refetch: refetchArchived } = trpc.merchants.myArchived.useQuery();

  const uploadMutation = trpc.merchants.uploadAuctionImage.useMutation();
  const deleteImageMutation = trpc.merchants.deleteAuctionImage.useMutation();

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const uploadAllPending = async (auctionId: number): Promise<number> => {
    setIsUploading(true);
    const toUpload = pendingImages.map((p, i) => ({ p, i })).filter(({ p }) => p.status === "pending");
    if (toUpload.length === 0) { setIsUploading(false); return 0; }
    setPendingImages((prev) => prev.map((p, idx) => toUpload.some(({ i }) => i === idx) ? { ...p, status: "uploading" } : p));
    let ok = 0;
    const results = await Promise.allSettled(toUpload.map(async ({ p, i }) => {
      const base64 = await fileToBase64(p.file);
      await uploadMutation.mutateAsync({ auctionId, imageData: base64, fileName: p.file.name, displayOrder: uploadedImages.length + i, mimeType: p.file.type || "image/jpeg" });
      return i;
    }));
    const successIdx = new Set<number>();
    const errorMap = new Map<number, string>();
    results.forEach((r, j) => {
      const { i } = toUpload[j];
      if (r.status === "fulfilled") { successIdx.add(i); ok++; }
      else errorMap.set(i, r.reason instanceof Error ? r.reason.message : "上傳失敗");
    });
    setPendingImages((prev) => prev.map((p, idx) => {
      if (successIdx.has(idx)) return { ...p, status: "success" };
      if (errorMap.has(idx)) return { ...p, status: "error", errorMsg: errorMap.get(idx) };
      return p;
    }));
    setIsUploading(false);
    return ok;
  };

  const createMutation = trpc.merchants.createAuction.useMutation({
    onSuccess: async (result) => {
      const uploaded = pendingImages.length > 0 && result?.id ? await uploadAllPending(result.id) : 0;
      toast.success(uploaded > 0 ? `草稿建立成功！已上傳 ${uploaded} 張圖片` : "草稿已建立");
      closeForm(); refetchDrafts();
    },
    onError: (err) => toast.error(err.message || "建立失敗"),
  });

  const updateMutation = trpc.merchants.updateAuction.useMutation({
    onSuccess: async () => {
      const uploaded = pendingImages.length > 0 && editId ? await uploadAllPending(editId) : 0;
      toast.success(uploaded > 0 ? `已更新，上傳了 ${uploaded} 張圖片` : "草稿已更新");
      closeForm(); refetchDrafts();
    },
    onError: (err) => toast.error(err.message || "更新失敗"),
  });

  const deleteMutation = trpc.merchants.deleteAuction.useMutation({
    onSuccess: () => { toast.success("草稿已刪除"); refetchDrafts(); },
    onError: (err) => toast.error(err.message || "刪除失敗"),
  });

  const publishMutation = trpc.merchants.publishDraft.useMutation({
    onSuccess: () => {
      toast.success("拍賣已發佈！");
      setPublishOpen(false);
      refetchDrafts(); refetchActive();
    },
    onError: (err) => toast.error(err.message || "發佈失敗"),
  });

  const batchPublishMutation = trpc.merchants.batchPublishDrafts.useMutation({
    onSuccess: (data) => {
      const msg = data.skipped > 0
        ? `成功發佈 ${data.succeeded} 個，略過 ${data.skipped} 個`
        : `成功發佈 ${data.succeeded} 個拍賣！`;
      toast.success(msg);
      setBatchPublishOpen(false);
      setSelectedDrafts(new Set());
      refetchDrafts(); refetchActive();
    },
    onError: (err) => toast.error(err.message || "批量發佈失敗"),
  });

  const archiveMutation = trpc.merchants.archiveAuction.useMutation({
    onSuccess: () => { toast.success("已封存"); refetchActive(); refetchArchived(); },
    onError: (err) => toast.error(err.message || "封存失敗"),
  });

  const restoreMutation = trpc.merchants.restoreAuction.useMutation({
    onSuccess: () => { toast.success("已取消封存"); refetchArchived(); refetchActive(); },
    onError: (err) => toast.error(err.message || "恢復失敗"),
  });

  const relistMutation = trpc.merchants.relistAuction.useMutation({
    onSuccess: () => {
      toast.success("已建立重新刊登草稿！請前往草稿頁設定結束時間並發佈");
      setTab("草稿"); refetchDrafts(); refetchActive(); refetchArchived();
    },
    onError: (err) => toast.error(err.message || "重新刊登失敗"),
  });

  const handleAddFiles = useCallback((files: File[]) => {
    const newPending: PendingImage[] = files.map((f) => ({
      file: f, previewUrl: URL.createObjectURL(f), status: "pending",
    }));
    setPendingImages((prev) => [...prev, ...newPending]);
  }, []);

  const handleRemovePending = (idx: number) => {
    setPendingImages((prev) => { URL.revokeObjectURL(prev[idx].previewUrl); return prev.filter((_, i) => i !== idx); });
  };

  const handleRemoveUploaded = async (idx: number) => {
    const img = uploadedImages[idx];
    if (img.imageId) {
      try {
        await deleteImageMutation.mutateAsync({ auctionId: editId!, imageId: img.imageId });
        setUploadedImages((prev) => prev.filter((_, i) => i !== idx));
        toast.success("圖片已刪除");
      } catch { toast.error("刪除圖片失敗"); }
    } else {
      setUploadedImages((prev) => prev.filter((_, i) => i !== idx));
    }
  };

  const closeForm = () => {
    setFormOpen(false); setEditId(null); setForm(defaultForm);
    pendingImages.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    setPendingImages([]); setUploadedImages([]);
  };

  const openEdit = (a: AuctionItem) => {
    setEditId(a.id);
    setForm({
      title: a.title, description: a.description ?? "",
      startingPrice: String(a.startingPrice),
      bidIncrement: a.bidIncrement ?? 30, currency: a.currency ?? "HKD",
    });
    setUploadedImages((a.images ?? []).map((img) => ({ url: img.imageUrl, displayOrder: img.displayOrder, imageId: img.id })));
    setPendingImages([]);
    setFormOpen(true);
  };

  const handleSubmit = () => {
    if (!form.title.trim() || !form.startingPrice) { toast.error("請填寫標題和起拍價"); return; }
    if (editId) {
      updateMutation.mutate({ id: editId, title: form.title, description: form.description, startingPrice: parseFloat(form.startingPrice), bidIncrement: form.bidIncrement, currency: form.currency as never });
    } else {
      createMutation.mutate({ title: form.title, description: form.description, startingPrice: parseFloat(form.startingPrice), bidIncrement: form.bidIncrement, currency: form.currency as never });
    }
  };

  const calcDefaultEndTime = () => {
    const offset = merchantSettings?.defaultEndDayOffset ?? 7;
    const timeStr = merchantSettings?.defaultEndTime ?? "23:00";
    const d = new Date();
    d.setDate(d.getDate() + offset);
    const [hh, mm] = timeStr.split(":");
    d.setHours(parseInt(hh ?? "23", 10), parseInt(mm ?? "0", 10), 0, 0);
    return d.toISOString().slice(0, 16);
  };

  const openPublish = (a: AuctionItem) => {
    setPublishTarget(a);
    setPublishEndTime(calcDefaultEndTime());
    setPublishOpen(true);
  };

  const handlePublish = () => {
    if (!publishTarget || !publishEndTime) { toast.error("請選擇結束時間"); return; }
    if (new Date(publishEndTime) <= new Date()) { toast.error("結束時間必須為未來時間"); return; }
    publishMutation.mutate({ id: publishTarget.id, endTime: new Date(publishEndTime) });
  };

  const openBatchPublish = () => {
    if (selectedDrafts.size === 0) { toast.error("請先選擇要發佈的草稿"); return; }
    setBatchEndTime(calcDefaultEndTime());
    setBatchPublishOpen(true);
  };

  const handleBatchPublish = () => {
    if (selectedDrafts.size === 0) return;
    if (!batchEndTime) { toast.error("請選擇結束時間"); return; }
    if (new Date(batchEndTime) <= new Date()) { toast.error("結束時間必須為未來時間"); return; }
    batchPublishMutation.mutate({ ids: Array.from(selectedDrafts), endTime: new Date(batchEndTime) });
  };

  const toggleSelectDraft = (id: number) => {
    setSelectedDrafts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleSelectAll = (drafts: AuctionItem[]) => {
    if (selectedDrafts.size === drafts.length) {
      setSelectedDrafts(new Set());
    } else {
      setSelectedDrafts(new Set(drafts.map((d) => d.id)));
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">請先登入</p>
      </div>
    );
  }

  const now = new Date();
  const activeAuctions = (myAuctions ?? []).filter((a: AuctionItem) =>
    a.status === "active" && new Date(a.endTime) > now
  ) as AuctionItem[];
  const endedAuctions = (myAuctions ?? []).filter((a: AuctionItem) =>
    a.status === "ended" || (a.status === "active" && new Date(a.endTime) <= now)
  ) as AuctionItem[];
  const draftAuctions = (myDrafts ?? []) as AuctionItem[];
  const archivedAuctions = (myArchived ?? []) as AuctionItem[];

  const TABS = [
    { key: "進行中", label: "進行中", count: activeAuctions.length },
    { key: "草稿", label: "草稿", count: draftAuctions.length },
    { key: "已結束", label: "已結束", count: endedAuctions.length },
    { key: "封存", label: "封存", count: archivedAuctions.length },
  ] as const;

  const currentList = tab === "進行中" ? activeAuctions : tab === "草稿" ? draftAuctions : tab === "已結束" ? endedAuctions : archivedAuctions;
  const isLoading = tab === "進行中" ? loadingActive : tab === "草稿" ? loadingDrafts : tab === "已結束" ? loadingActive : loadingArchived;
  const isMutating = createMutation.isPending || updateMutation.isPending || isUploading;

  const allDraftSelected = draftAuctions.length > 0 && selectedDrafts.size === draftAuctions.length;
  const someDraftSelected = selectedDrafts.size > 0;

  return (
    <div className="min-h-screen bg-background">
      {/* 頂部導航 */}
      <div className="border-b bg-card fixed top-0 left-0 right-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-2 text-sm flex-wrap">
          <Link href="/merchant-dashboard">
            <span className="text-muted-foreground hover:text-foreground cursor-pointer flex items-center gap-1">
              <ChevronLeft className="w-3.5 h-3.5" />商戶後台
            </span>
          </Link>
          <span className="text-muted-foreground">/</span>
          <span className="font-medium text-amber-600">拍賣管理</span>
        </div>
      </div>
      <div className="h-12" />

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">
        {/* 標題列 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">拍賣管理</h1>
            <p className="text-sm text-muted-foreground mt-0.5">管理你的拍賣刊登</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => { refetchActive(); refetchDrafts(); refetchArchived(); }} className="gap-1.5">
              <RefreshCw className="w-3.5 h-3.5" />刷新
            </Button>
            <Button size="sm" className="gold-gradient text-white border-0 gap-1.5" onClick={() => { setEditId(null); setForm(defaultForm); setPendingImages([]); setUploadedImages([]); setFormOpen(true); }}>
              <Plus className="w-4 h-4" />建立草稿
            </Button>
          </div>
        </div>

        {/* Tab 列 */}
        <div className="flex border-b gap-0">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); if (t.key !== "草稿") setSelectedDrafts(new Set()); }}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t.key ? "border-amber-500 text-amber-600" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              {t.label}
              <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${tab === t.key ? "bg-amber-100 text-amber-700" : "bg-muted text-muted-foreground"}`}>
                {t.count}
              </span>
            </button>
          ))}
        </div>

        {/* ── 草稿 Tab 批量操作欄 ── */}
        {tab === "草稿" && draftAuctions.length > 0 && (
          <div className="flex items-center gap-3 px-1">
            <button
              onClick={() => handleSelectAll(draftAuctions)}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-amber-600 transition-colors"
            >
              {allDraftSelected
                ? <CheckSquare className="w-4 h-4 text-amber-500" />
                : <Square className="w-4 h-4" />}
              {allDraftSelected ? "取消全選" : "全選"}
            </button>

            {someDraftSelected && (
              <>
                <span className="text-xs text-muted-foreground">已選 {selectedDrafts.size} 個</span>
                <Button
                  size="sm"
                  className="h-8 px-3 text-xs gap-1.5 bg-green-600 hover:bg-green-700 text-white border-0"
                  onClick={openBatchPublish}
                >
                  <Send className="w-3.5 h-3.5" />
                  一鍵批量發佈（{selectedDrafts.size}）
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setSelectedDrafts(new Set())}
                >
                  清除選擇
                </Button>
              </>
            )}
          </div>
        )}

        {/* 列表 */}
        <Card>
          <CardContent className="pt-4">
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-muted rounded-lg animate-pulse" />)}
              </div>
            ) : currentList.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p className="font-medium">
                  {tab === "草稿" ? "還沒有草稿，點擊「建立草稿」開始刊登" : `沒有${tab}的拍賣`}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {currentList.map((a) => (
                  <AuctionCard
                    key={a.id} auction={a} tab={tab}
                    selected={selectedDrafts.has(a.id)}
                    onToggleSelect={tab === "草稿" ? toggleSelectDraft : undefined}
                    onEdit={openEdit}
                    onDelete={(id) => { deleteMutation.mutate({ id }); setSelectedDrafts((p) => { const n = new Set(p); n.delete(id); return n; }); }}
                    onPublish={openPublish}
                    onArchive={(id) => archiveMutation.mutate({ id })}
                    onRestore={(id) => restoreMutation.mutate({ id })}
                    onRelist={(id) => relistMutation.mutate({ id })}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── 建立 / 編輯 草稿 Dialog ── */}
      <Dialog open={formOpen} onOpenChange={(v) => { if (!v) closeForm(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "編輯草稿" : "建立新草稿"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>標題 *</Label>
              <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="拍賣品名稱" />
            </div>
            <div>
              <Label>描述</Label>
              <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="詳細描述…" rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>起拍價 *</Label>
                <Input type="number" min="0" value={form.startingPrice} onChange={(e) => setForm((f) => ({ ...f, startingPrice: e.target.value }))} placeholder="0" />
              </div>
              <div>
                <Label>貨幣</Label>
                <Select value={form.currency} onValueChange={(v) => setForm((f) => ({ ...f, currency: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCY_OPTIONS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>每口加幅</Label>
              <Select value={String(form.bidIncrement)} onValueChange={(v) => setForm((f) => ({ ...f, bidIncrement: Number(v) }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BID_INCREMENT_OPTIONS.map((v) => <SelectItem key={v} value={String(v)}>{form.currency}${v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>圖片</Label>
              <ImageUploadZone
                pendingImages={pendingImages} uploadedImages={uploadedImages}
                onAddFiles={handleAddFiles} onRemovePending={handleRemovePending}
                onRemoveUploaded={handleRemoveUploaded} isUploading={isUploading} />
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={closeForm}>取消</Button>
              <Button onClick={handleSubmit} disabled={isMutating} className="gold-gradient text-white border-0">
                {isMutating ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
                {editId ? "儲存更改" : "建立草稿"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── 單個發佈 Dialog ── */}
      <Dialog open={publishOpen} onOpenChange={(v) => { if (!v) setPublishOpen(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>設定結束時間並發佈</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-sm text-muted-foreground">即將發佈：<span className="font-medium text-foreground">{publishTarget?.title}</span></p>
            <div>
              <Label>結束時間 *</Label>
              <Input type="datetime-local" value={publishEndTime} onChange={(e) => setPublishEndTime(e.target.value)} />
              <p className="text-xs text-muted-foreground mt-1">發佈後拍賣即刻開始</p>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setPublishOpen(false)}>取消</Button>
              <Button onClick={handlePublish} disabled={publishMutation.isPending} className="bg-green-600 hover:bg-green-700 text-white border-0">
                {publishMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Send className="w-4 h-4 mr-1.5" />}
                確認發佈
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── 批量發佈 Dialog ── */}
      <Dialog open={batchPublishOpen} onOpenChange={(v) => { if (!v) setBatchPublishOpen(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>批量發佈草稿</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
              <p className="text-sm font-medium text-amber-800">
                即將發佈 <span className="text-lg font-bold">{selectedDrafts.size}</span> 個草稿
              </p>
              <p className="text-xs text-amber-600 mt-0.5">所有選中的草稿將使用相同的結束時間</p>
            </div>
            <div>
              <Label>統一結束時間 *</Label>
              <Input type="datetime-local" value={batchEndTime} onChange={(e) => setBatchEndTime(e.target.value)} />
              <p className="text-xs text-muted-foreground mt-1">發佈後所有拍賣同步開始，結束時間相同</p>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setBatchPublishOpen(false)}>取消</Button>
              <Button onClick={handleBatchPublish} disabled={batchPublishMutation.isPending} className="bg-green-600 hover:bg-green-700 text-white border-0 gap-1.5">
                {batchPublishMutation.isPending
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Send className="w-4 h-4" />}
                確認批量發佈
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
