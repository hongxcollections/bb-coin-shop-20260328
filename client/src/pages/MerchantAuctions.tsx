import { useState, useRef, useCallback } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
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
  antiSnipeEnabled: boolean;
  antiSnipeMinutes: number;
  extendMinutes: number;
}

const defaultForm: AuctionFormData = {
  title: "",
  description: "",
  startingPrice: "",
  bidIncrement: 30,
  currency: "HKD",
  antiSnipeEnabled: true,
  antiSnipeMinutes: 3,
  extendMinutes: 3,
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
  antiSnipeEnabled?: number | null;
  antiSnipeMinutes?: number | null;
  extendMinutes?: number | null;
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
  onDelete: (id: number, title: string) => void;
  onPublish: (a: AuctionItem) => void;
  onArchive: (id: number) => void;
  onRestore: (id: number) => void;
  onRelist: (id: number) => void;
}) {
  const img = auction.images?.[0]?.imageUrl;
  const isDraft = tab === "草稿";

  return (
    <div className={`flex gap-2 p-2 rounded-lg border transition-colors ${isDraft && selected ? "border-amber-400 bg-amber-50/60" : "bg-card hover:bg-accent/5"}`}>
      {/* Checkbox（只在草稿 tab 顯示） */}
      {isDraft && onToggleSelect && (
        <div className="flex items-center flex-shrink-0">
          <Checkbox
            checked={selected ?? false}
            onCheckedChange={() => onToggleSelect(auction.id)}
            className="border-amber-400 data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500"
          />
        </div>
      )}

      <div className="w-16 h-16 rounded-md overflow-hidden bg-muted flex-shrink-0">
        {img ? (
          <img src={img} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon className="w-5 h-5 text-muted-foreground/40" />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate leading-snug">{auction.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
          起：{getCurrencySymbol(auction.currency ?? "HKD")}{Number(auction.startingPrice).toLocaleString()}
          {" · "}口：${auction.bidIncrement ?? 30}
          {tab === "草稿" && (
            (auction.antiSnipeEnabled ?? 1) === 1
              ? <span className="ml-1 text-amber-500">🛡️{auction.antiSnipeMinutes ?? 3}+{auction.extendMinutes ?? 3}分</span>
              : <span className="ml-1 text-gray-400">🛡️停用</span>
          )}
        </p>
        {auction.endTime && tab !== "草稿" && (
          <p className="text-xs text-muted-foreground leading-snug">
            {tab === "進行中" ? "結：" : "標："}
            {formatDate(auction.endTime)}
          </p>
        )}
        <div className="flex gap-1 mt-1 flex-nowrap">
          {tab === "草稿" && (
            <>
              <Button size="sm" variant="outline" className="h-6 px-1.5 text-xs gap-0.5" onClick={() => onEdit(auction)}>
                <Pencil className="w-2.5 h-2.5" />編輯
              </Button>
              <Button size="sm" variant="outline" className="h-6 px-1.5 text-xs gap-0.5 border-green-300 text-green-700 hover:bg-green-50" onClick={() => onPublish(auction)}>
                <Send className="w-2.5 h-2.5" />發佈
              </Button>
              <Button size="sm" variant="outline" className="h-6 px-1.5 text-xs gap-0.5 border-red-200 text-red-600 hover:bg-red-50" onClick={() => onDelete(auction.id, auction.title)}>
                <Trash2 className="w-2.5 h-2.5" />刪除
              </Button>
            </>
          )}
          {tab === "進行中" && (
            <Link href={`/auctions/${auction.id}`}>
              <Button size="sm" variant="outline" className="h-6 px-1.5 text-xs gap-0.5">
                <Eye className="w-2.5 h-2.5" />查看
              </Button>
            </Link>
          )}
          {tab === "已結束" && (
            <>
              <Link href={`/auctions/${auction.id}`}>
                <Button size="sm" variant="outline" className="h-6 px-1.5 text-xs gap-0.5">
                  <Eye className="w-2.5 h-2.5" />查看
                </Button>
              </Link>
              <Button size="sm" variant="outline" className="h-6 px-1.5 text-xs gap-0.5 border-purple-200 text-purple-700 hover:bg-purple-50" onClick={() => onRelist(auction.id)}>
                <RotateCcw className="w-2.5 h-2.5" />重新刊登
              </Button>
              <Button size="sm" variant="outline" className="h-6 px-1.5 text-xs gap-0.5 border-gray-300 text-gray-600 hover:bg-gray-50" onClick={() => onArchive(auction.id)}>
                <Archive className="w-2.5 h-2.5" />封存
              </Button>
            </>
          )}
          {tab === "封存" && (
            <>
              <Button size="sm" variant="outline" className="h-6 px-1.5 text-xs gap-0.5 border-amber-200 text-amber-700 hover:bg-amber-50" onClick={() => onRestore(auction.id)}>
                <RotateCcw className="w-2.5 h-2.5" />取消封存
              </Button>
              <Button size="sm" variant="outline" className="h-6 px-1.5 text-xs gap-0.5 border-purple-200 text-purple-700 hover:bg-purple-50" onClick={() => onRelist(auction.id)}>
                <RotateCcw className="w-2.5 h-2.5" />重刊
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

  // Delete confirm
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; title: string } | null>(null);

  // Batch publish
  const [selectedDrafts, setSelectedDrafts] = useState<Set<number>>(new Set());
  const [batchPublishOpen, setBatchPublishOpen] = useState(false);
  const [batchEndTime, setBatchEndTime] = useState("");

  const { data: merchantSettings } = trpc.merchants.getSettings.useQuery(undefined, { enabled: isAuthenticated });
  const { refetch: refetchMyDeposit } = trpc.sellerDeposits.myDeposit.useQuery(undefined, { enabled: isAuthenticated, staleTime: 0, refetchOnWindowFocus: true });
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
    onSuccess: (data) => {
      let msg = "拍賣已發佈！";
      if (data.unlimitedQuota) {
        msg += "　發佈次數：無限制";
      } else if (data.remainingQuota !== null && data.remainingQuota !== undefined) {
        msg += `　發佈額餘數：${data.remainingQuota} 次`;
      }
      toast.success(msg);
      setPublishOpen(false);
      refetchDrafts(); refetchActive();
    },
    onError: (err) => toast.error(err.message || "發佈失敗"),
  });

  const batchPublishMutation = trpc.merchants.batchPublishDrafts.useMutation({
    onSuccess: (data) => {
      let msg = data.skipped > 0
        ? `成功發佈 ${data.succeeded} 個，略過 ${data.skipped} 個`
        : `成功發佈 ${data.succeeded} 個拍賣！`;
      if (data.unlimitedQuota) {
        msg += "　發佈次數：無限制";
      } else if (data.remainingQuota !== null && data.remainingQuota !== undefined) {
        msg += `　發佈額餘數：${data.remainingQuota} 次`;
      }
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
      antiSnipeEnabled: (a.antiSnipeEnabled ?? 1) === 1,
      antiSnipeMinutes: a.antiSnipeMinutes ?? 3,
      extendMinutes: a.extendMinutes ?? 3,
    });
    setUploadedImages((a.images ?? []).map((img) => ({ url: img.imageUrl, displayOrder: img.displayOrder, imageId: img.id })));
    setPendingImages([]);
    setFormOpen(true);
  };

  const handleSubmit = () => {
    if (!form.title.trim() || !form.startingPrice) { toast.error("請填寫標題和起拍價"); return; }
    const totalImages = uploadedImages.length + pendingImages.length;
    if (totalImages === 0) { toast.error("請上傳至少一幅圖片"); return; }
    const antiSnipeEnabled = form.antiSnipeEnabled ? 1 : 0;
    const antiSnipeMinutes = isNaN(form.antiSnipeMinutes) ? 0 : form.antiSnipeMinutes;
    const extendMinutes = isNaN(form.extendMinutes) || form.extendMinutes < 1 ? 1 : form.extendMinutes;
    if (editId) {
      updateMutation.mutate({ id: editId, title: form.title, description: form.description, startingPrice: parseFloat(form.startingPrice), bidIncrement: form.bidIncrement, currency: form.currency as never, antiSnipeEnabled, antiSnipeMinutes, extendMinutes });
    } else {
      createMutation.mutate({ title: form.title, description: form.description, startingPrice: parseFloat(form.startingPrice), bidIncrement: form.bidIncrement, currency: form.currency as never, antiSnipeEnabled, antiSnipeMinutes, extendMinutes });
    }
  };

  const calcDefaultEndTime = () => {
    const offset = merchantSettings?.defaultEndDayOffset ?? 7;
    const timeStr = merchantSettings?.defaultEndTime ?? "23:00";
    const d = new Date();
    d.setDate(d.getDate() + offset);
    const [hh, mm] = timeStr.split(":");
    d.setHours(parseInt(hh ?? "23", 10), parseInt(mm ?? "0", 10), 0, 0);
    // 用本地時間格式，避免 toISOString() 轉成 UTC 導致時差
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const checkCanPublish = async (): Promise<boolean> => {
    const { data: fresh } = await refetchMyDeposit();
    if (fresh && fresh.isActive === false) {
      toast.error("商戶暫已被停用，請聯繫客服了解情況");
      return false;
    }
    return true;
  };

  const openPublish = async (a: AuctionItem) => {
    if (!(await checkCanPublish())) return;
    if (!a.images || a.images.length === 0) {
      toast.error("請先上傳至少一幅圖片才能發佈");
      return;
    }
    setPublishTarget(a);
    setPublishEndTime(calcDefaultEndTime());
    setPublishOpen(true);
  };

  const handlePublish = () => {
    if (!publishTarget || !publishEndTime) { toast.error("請選擇結束時間"); return; }
    if (new Date(publishEndTime) <= new Date()) { toast.error("結束時間必須為未來時間"); return; }
    publishMutation.mutate({ id: publishTarget.id, endTime: new Date(publishEndTime) });
  };

  const openBatchPublish = async () => {
    if (selectedDrafts.size === 0) { toast.error("請先選擇要發佈的草稿"); return; }
    if (!(await checkCanPublish())) return;
    const noImageDrafts = draftAuctions.filter(a => selectedDrafts.has(a.id) && (!a.images || a.images.length === 0));
    if (noImageDrafts.length > 0) {
      const titles = noImageDrafts.map(a => `「${a.title}」`).join("、");
      toast.error(`以下草稿尚未上傳圖片，請先上傳：${titles}`);
      return;
    }
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
      {/* 頂部導航 — 把標題和按鈕整合進來，節省垂直空間 */}
      <div className="border-b bg-card fixed top-0 left-0 right-0 z-10">
        <div className="max-w-4xl mx-auto px-3 py-2 flex items-center gap-2">
          <Link href="/merchant-dashboard">
            <span className="text-muted-foreground hover:text-foreground cursor-pointer flex items-center gap-0.5 text-sm">
              <ChevronLeft className="w-3.5 h-3.5" />後台
            </span>
          </Link>
          <span className="text-muted-foreground text-sm">/</span>
          <span className="font-semibold text-amber-600 text-sm flex-1">拍賣管理</span>
          <Button variant="outline" size="sm" onClick={() => { refetchActive(); refetchDrafts(); refetchArchived(); }} className="h-7 px-2 text-xs gap-1">
            <RefreshCw className="w-3 h-3" />刷新
          </Button>
          <Button size="sm" className="gold-gradient text-white border-0 h-7 px-2.5 text-xs gap-1" onClick={() => { setEditId(null); setForm({ ...defaultForm, startingPrice: String(merchantSettings?.defaultStartingPrice ?? 0), bidIncrement: merchantSettings?.defaultBidIncrement ?? 30, antiSnipeEnabled: (merchantSettings?.defaultAntiSnipeEnabled ?? 1) === 1, antiSnipeMinutes: merchantSettings?.defaultAntiSnipeMinutes ?? 3, extendMinutes: merchantSettings?.defaultExtendMinutes ?? 3 }); setPendingImages([]); setUploadedImages([]); setFormOpen(true); }}>
            <Plus className="w-3.5 h-3.5" />建立草稿
          </Button>
        </div>

        {/* Tab 列 — 緊貼導航欄下方 */}
        <div className="flex border-t gap-0 max-w-4xl mx-auto px-0">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); if (t.key !== "草稿") setSelectedDrafts(new Set()); }}
              className={`flex-1 px-2 py-1.5 text-xs font-medium border-b-2 transition-colors ${tab === t.key ? "border-amber-500 text-amber-600" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              {t.label}
              <span className={`ml-1 text-xs px-1 py-0.5 rounded-full ${tab === t.key ? "bg-amber-100 text-amber-700" : "bg-muted text-muted-foreground"}`}>
                {t.count}
              </span>
            </button>
          ))}
        </div>
      </div>
      {/* 固定頂欄高度補偿（導航 + Tab 兩行） */}
      <div className="h-[72px]" />

      <div className="max-w-4xl mx-auto px-2 pt-2 pb-20 space-y-1.5">
        {/* ── 草稿 Tab 批量操作欄 ── */}
        {tab === "草稿" && draftAuctions.length > 0 && (
          <div className="flex items-center gap-2 px-1 py-1">
            <button
              onClick={() => handleSelectAll(draftAuctions)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-amber-600 transition-colors"
            >
              {allDraftSelected
                ? <CheckSquare className="w-3.5 h-3.5 text-amber-500" />
                : <Square className="w-3.5 h-3.5" />}
              {allDraftSelected ? "取消全選" : "全選"}
            </button>

            {someDraftSelected && (
              <>
                <span className="text-xs text-muted-foreground">已選 {selectedDrafts.size} 個</span>
                <Button
                  size="sm"
                  className="h-7 px-2.5 text-xs gap-1 bg-green-600 hover:bg-green-700 text-white border-0"
                  onClick={openBatchPublish}
                >
                  <Send className="w-3 h-3" />
                  批量發佈（{selectedDrafts.size}）
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-1.5 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setSelectedDrafts(new Set())}
                >
                  清除
                </Button>
              </>
            )}
          </div>
        )}

        {/* 列表 — 移除 Card 外框，直接列出卡片節省空間 */}
        {isLoading ? (
          <div className="space-y-1.5 px-1">
            {[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />)}
          </div>
        ) : currentList.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <ImageIcon className="w-10 h-10 mx-auto mb-2 opacity-20" />
            <p className="text-sm font-medium">
              {tab === "草稿" ? "還沒有草稿，點擊「建立草稿」開始刊登" : `沒有${tab}的拍賣`}
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {currentList.map((a) => (
              <AuctionCard
                key={a.id} auction={a} tab={tab}
                selected={selectedDrafts.has(a.id)}
                onToggleSelect={tab === "草稿" ? toggleSelectDraft : undefined}
                onEdit={openEdit}
                onDelete={(id, title) => setDeleteConfirm({ id, title })}
                onPublish={openPublish}
                onArchive={(id) => archiveMutation.mutate({ id })}
                onRestore={(id) => restoreMutation.mutate({ id })}
                onRelist={(id) => relistMutation.mutate({ id })}
              />
            ))}
          </div>
        )}
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
            <div className="grid gap-2" style={{ gridTemplateColumns: "1fr 80px 1fr" }}>
              <div>
                <Label>起拍價 *</Label>
                <Input type="number" min="0" value={form.startingPrice} onChange={(e) => setForm((f) => ({ ...f, startingPrice: e.target.value }))} placeholder="0" />
              </div>
              <div>
                <Label>貨幣</Label>
                <Select value={form.currency} onValueChange={(v) => setForm((f) => ({ ...f, currency: v }))}>
                  <SelectTrigger className="px-2"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCY_OPTIONS.map((c) => <SelectItem key={c.value} value={c.value} className="text-[10px] py-1">{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
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
            </div>
            {/* 反狙擊延時設定 */}
            <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-amber-700">🛡️ 反狙擊延時</p>
                <div className="flex items-center gap-2">
                  <span className={`text-xs ${form.antiSnipeEnabled ? 'text-emerald-600' : 'text-gray-400'}`}>
                    {form.antiSnipeEnabled ? '啟用' : '停用'}
                  </span>
                  <Switch
                    checked={form.antiSnipeEnabled}
                    onCheckedChange={(v) => setForm((f) => ({ ...f, antiSnipeEnabled: v }))}
                    className="data-[state=checked]:bg-amber-500"
                  />
                </div>
              </div>
              <div className={`flex gap-3 transition-opacity ${form.antiSnipeEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                <div className="flex-1">
                  <Label className="text-xs text-amber-700">結束前 X 分鐘觸發</Label>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Input type="number" min={0} max={60}
                      value={isNaN(form.antiSnipeMinutes) ? "" : form.antiSnipeMinutes}
                      onChange={(e) => setForm((f) => ({ ...f, antiSnipeMinutes: e.target.value === "" ? NaN : parseInt(e.target.value) }))}
                      onBlur={() => setForm((f) => ({ ...f, antiSnipeMinutes: isNaN(f.antiSnipeMinutes) ? 0 : Math.min(60, Math.max(0, f.antiSnipeMinutes)) }))}
                      className="h-7 w-16 text-center text-xs border-amber-200" />
                    <span className="text-xs text-amber-600">分鐘</span>
                  </div>
                </div>
                <div className="flex-1">
                  <Label className="text-xs text-amber-700">每次延長 Y 分鐘</Label>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Input type="number" min={1} max={60}
                      value={isNaN(form.extendMinutes) ? "" : form.extendMinutes}
                      onChange={(e) => setForm((f) => ({ ...f, extendMinutes: e.target.value === "" ? NaN : parseInt(e.target.value) }))}
                      onBlur={() => setForm((f) => ({ ...f, extendMinutes: isNaN(f.extendMinutes) || f.extendMinutes < 1 ? 1 : Math.min(60, f.extendMinutes) }))}
                      className="h-7 w-16 text-center text-xs border-amber-200" />
                    <span className="text-xs text-amber-600">分鐘</span>
                  </div>
                </div>
              </div>
              <p className="text-xs text-amber-500">
                {form.antiSnipeEnabled
                  ? (isNaN(form.antiSnipeMinutes) || form.antiSnipeMinutes === 0
                      ? '⚠️ X 設為 0 即不觸發'
                      : `結束前 ${form.antiSnipeMinutes} 分鐘內有出價，自動延長 ${isNaN(form.extendMinutes) ? 1 : form.extendMinutes} 分鐘`)
                  : '已停用，出價不會觸發延時'}
              </p>
            </div>

            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <Label>圖片</Label>
                <span className="text-xs text-red-500 font-medium">（必須至少一幅）</span>
                {uploadedImages.length + pendingImages.length === 0 && (
                  <span className="text-xs text-red-400 ml-auto">⚠ 尚未上傳圖片</span>
                )}
              </div>
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

      {/* ── 刪除草稿確認 Dialog ── */}
      <Dialog open={deleteConfirm !== null} onOpenChange={(v) => { if (!v) setDeleteConfirm(null); }}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>確認刪除草稿</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-1">
            <div>
              <p className="text-sm text-foreground">
                {deleteConfirm ? (deleteConfirm.title.length > 20 ? deleteConfirm.title.slice(0, 20) + "…" : deleteConfirm.title) : ""}
              </p>
              <p className="text-xs text-red-500 mt-1">刪除後不可復原。</p>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setDeleteConfirm(null)}>取消</Button>
              <Button
                variant="destructive"
                disabled={deleteMutation.isPending}
                onClick={() => {
                  if (!deleteConfirm) return;
                  deleteMutation.mutate({ id: deleteConfirm.id });
                  setSelectedDrafts((p) => { const n = new Set(p); n.delete(deleteConfirm.id); return n; });
                  setDeleteConfirm(null);
                }}
              >
                {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                確認刪除
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
