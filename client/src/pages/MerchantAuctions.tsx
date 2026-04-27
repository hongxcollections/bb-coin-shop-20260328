import { useState, useRef, useCallback } from "react";
import { Link } from "wouter";
import Header from "@/components/Header";
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
import { parseCategories } from "@/lib/categories";
import {
  Plus, Pencil, Trash2, Archive, RotateCcw, Upload, X,
  ImageIcon, CheckCircle2, AlertCircle, Loader2, ChevronLeft,
  RefreshCw, Eye, Send, CheckSquare, Square, CreditCard, Facebook, Copy, Check,
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

type UploadStatus = "compressing" | "uploading" | "success" | "error";

interface PendingImage {
  id: string;
  file: File;
  previewUrl: string;
  status: UploadStatus;
  errorMsg?: string;
  tempUrl?: string; // S3 URL after pre-upload
}

// Compress image client-side before upload (max 1600px, JPEG 82%)
const compressImage = (file: File, maxPx = 1600, quality = 0.82): Promise<File> =>
  new Promise((resolve) => {
    if (!file.type.startsWith('image/')) { resolve(file); return; }
    const img = new Image();
    const objUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objUrl);
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height, 1));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(file); return; }
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob((blob) => {
        if (!blob) { resolve(file); return; }
        resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }));
      }, 'image/jpeg', quality);
    };
    img.onerror = () => resolve(file);
    img.src = objUrl;
  });

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
  categories: string[];
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
  categories: [],
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
  category?: string | null;
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
            <div key={p.id} className="relative aspect-square rounded-md overflow-hidden border bg-muted group">
              <img src={p.previewUrl} alt="" className="w-full h-full object-cover" />
              {(p.status === "compressing" || p.status === "uploading") && (
                <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center gap-1">
                  <Loader2 className="w-5 h-5 text-white animate-spin" />
                  <span className="text-white text-[10px]">{p.status === "compressing" ? "壓縮中" : "上載中"}</span>
                </div>
              )}
              {p.status === "error" && (
                <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center gap-1">
                  <AlertCircle className="w-5 h-5 text-red-400" />
                  <span className="text-white text-[10px]">上載失敗</span>
                  <button onClick={() => onRemovePending(i)}
                    className="absolute top-0.5 right-0.5 bg-black/60 rounded-full p-0.5">
                    <X className="w-3 h-3 text-white" />
                  </button>
                </div>
              )}
              {p.status === "success" && (
                <>
                  <div className="absolute top-0.5 left-0.5 bg-green-500/80 rounded-full p-0.5">
                    <CheckCircle2 className="w-3 h-3 text-white" />
                  </div>
                  <button onClick={() => onRemovePending(i)}
                    className="absolute top-0.5 right-0.5 bg-black/60 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <X className="w-3 h-3 text-white" />
                  </button>
                </>
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
  onEdit, onDelete, onPublish, onArchive, onRestore, onRelist, onActiveEdit,
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
  onActiveEdit: (a: AuctionItem) => void;
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
        {tab === "進行中" && (
          <p className="text-xs mt-0.5 leading-snug">
            <span className="text-gray-400">最高：</span>
            {auction.highestBidderName ? (
              <>
                <span className="font-semibold text-amber-700">{getCurrencySymbol(auction.currency ?? "HKD")}{Number(auction.currentPrice).toLocaleString()}</span>
                <span className="text-gray-500"> · {auction.highestBidderName}</span>
              </>
            ) : (
              <span className="text-gray-400">未有出價</span>
            )}
          </p>
        )}
        {tab === "已結束" && (
          <p className="text-xs mt-0.5 leading-snug">
            <span className="text-gray-400">中標：</span>
            <span className="font-medium text-amber-700">
              {auction.highestBidderName
                ? `${auction.highestBidderName} (${getCurrencySymbol(auction.currency ?? "HKD")}${Number(auction.currentPrice).toLocaleString()})`
                : "無人出價"}
            </span>
          </p>
        )}
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
            <>
              <Button size="sm" variant="outline" className="h-6 px-1.5 text-xs gap-0.5" onClick={() => onActiveEdit(auction)}>
                <Pencil className="w-2.5 h-2.5" />修改
              </Button>
              <Link href={`/auctions/${auction.id}`}>
                <Button size="sm" variant="outline" className="h-6 px-1.5 text-xs gap-0.5">
                  <Eye className="w-2.5 h-2.5" />查看
                </Button>
              </Link>
            </>
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
  const isUploading = pendingImages.some(p => p.status === "compressing" || p.status === "uploading");

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

  // No-subscription dialog
  const [noSubDialogOpen, setNoSubDialogOpen] = useState(false);

  // Batch Facebook share
  const [batchShareOpen, setBatchShareOpen] = useState(false);
  const [copiedIds, setCopiedIds] = useState<Set<number>>(new Set());
  const [copiedAll, setCopiedAll] = useState(false);

  // Active auction limited edit dialog
  const [activeEditOpen, setActiveEditOpen] = useState(false);
  const [activeEditTarget, setActiveEditTarget] = useState<AuctionItem | null>(null);
  const [activeEditForm, setActiveEditForm] = useState({ title: "", description: "", categories: [] as string[] });
  const [activeEditPending, setActiveEditPending] = useState<PendingImage[]>([]);
  const [activeEditUploaded, setActiveEditUploaded] = useState<UploadedImage[]>([]);
  const isActiveEditUploading = activeEditPending.some(p => p.status === "compressing" || p.status === "uploading");

  const { data: merchantSettings } = trpc.merchants.getSettings.useQuery(undefined, { enabled: isAuthenticated });
  const { data: siteSettingsData } = trpc.siteSettings.getAll.useQuery(undefined, { staleTime: 5 * 60 * 1000 });
  const CATEGORIES = parseCategories(siteSettingsData as Record<string, string> | undefined);
  const { refetch: refetchMyDeposit } = trpc.sellerDeposits.myDeposit.useQuery(undefined, { enabled: isAuthenticated, staleTime: 0, refetchOnWindowFocus: true });
  const { refetch: refetchCanList } = trpc.sellerDeposits.canList.useQuery(undefined, { enabled: false, staleTime: 0 });
  const { refetch: refetchQuotaInfo } = trpc.merchants.getQuotaInfo.useQuery(undefined, { enabled: false, staleTime: 0 });
  const { data: mySubscription } = trpc.subscriptions.mySubscription.useQuery(undefined, { enabled: isAuthenticated, staleTime: 60_000 });
  const { data: myAuctions, isLoading: loadingActive, refetch: refetchActive } = trpc.merchants.myAuctions.useQuery();
  const { data: myDrafts, isLoading: loadingDrafts, refetch: refetchDrafts } = trpc.merchants.myDrafts.useQuery();
  const { data: myArchived, isLoading: loadingArchived, refetch: refetchArchived } = trpc.merchants.myArchived.useQuery();

  const uploadMutation = trpc.merchants.uploadAuctionImage.useMutation();
  const deleteImageMutation = trpc.merchants.deleteAuctionImage.useMutation();
  const preSaveImageMutation = trpc.merchants.preSaveImage.useMutation();
  const registerImagesMutation = trpc.merchants.registerPreSavedImages.useMutation();

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  // Attach pre-uploaded images to an auction (images already on S3)
  const attachPreSavedImages = async (auctionId: number, baseOrder: number): Promise<number> => {
    const ready = pendingImages.filter(p => p.status === "success" && p.tempUrl);
    if (ready.length === 0) return 0;
    await registerImagesMutation.mutateAsync({
      auctionId,
      images: ready.map((p, i) => ({ url: p.tempUrl!, displayOrder: baseOrder + i })),
    });
    return ready.length;
  };

  const createMutation = trpc.merchants.createAuction.useMutation({
    onSuccess: async (result) => {
      let attached = 0;
      if (result?.id && pendingImages.length > 0) {
        attached = await attachPreSavedImages(result.id, 0);
      }
      toast.success(attached > 0 ? `草稿建立成功！已上傳 ${attached} 張圖片` : "草稿已建立");
      closeForm(); refetchDrafts();
    },
    onError: (err) => toast.error(err.message || "建立失敗"),
  });

  const updateMutation = trpc.merchants.updateAuction.useMutation({
    onSuccess: async () => {
      let attached = 0;
      if (editId && pendingImages.length > 0) {
        attached = await attachPreSavedImages(editId, uploadedImages.length);
      }
      toast.success(attached > 0 ? `已更新，上傳了 ${attached} 張圖片` : "草稿已更新");
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

  const updateActiveAuctionMutation = trpc.merchants.updateActiveAuction.useMutation({
    onSuccess: async () => {
      if (activeEditTarget && activeEditPending.length > 0) {
        const ready = activeEditPending.filter(p => p.status === "success" && p.tempUrl);
        if (ready.length > 0) {
          await registerImagesMutation.mutateAsync({
            auctionId: activeEditTarget.id,
            images: ready.map((p, i) => ({ url: p.tempUrl!, displayOrder: activeEditUploaded.length + i })),
          });
        }
      }
      toast.success("拍賣資料已更新");
      setActiveEditOpen(false);
      setActiveEditTarget(null);
      activeEditPending.forEach(p => URL.revokeObjectURL(p.previewUrl));
      setActiveEditPending([]);
      setActiveEditUploaded([]);
      refetchActive();
    },
    onError: (err) => toast.error(err.message || "更新失敗"),
  });

  const handleAddFiles = useCallback((files: File[]) => {
    const newItems: PendingImage[] = files.map((f) => ({
      id: Math.random().toString(36).slice(2) + Date.now(),
      file: f,
      previewUrl: URL.createObjectURL(f),
      status: "compressing" as UploadStatus,
    }));
    setPendingImages((prev) => [...prev, ...newItems]);

    // Compress + pre-upload each image immediately (parallel, while user fills form)
    for (const item of newItems) {
      (async () => {
        const update = (patch: Partial<PendingImage>) =>
          setPendingImages((prev) => prev.map(p => p.id === item.id ? { ...p, ...patch } : p));
        try {
          const compressed = await compressImage(item.file);
          update({ status: 'uploading' });
          const base64 = await new Promise<string>((res, rej) => {
            const r = new FileReader();
            r.onload = () => res((r.result as string).split(',')[1]);
            r.onerror = rej;
            r.readAsDataURL(compressed);
          });
          const result = await preSaveImageMutation.mutateAsync({
            imageData: base64,
            mimeType: 'image/jpeg',
            fileName: compressed.name,
          });
          update({ status: 'success', tempUrl: result.url });
        } catch {
          update({ status: 'error', errorMsg: '上載失敗，請移除後重試' });
        }
      })();
    }
  }, [preSaveImageMutation]);

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
      categories: (() => {
        if (!a.category) return [];
        if (a.category.includes("|")) return a.category.split("|").map(s => s.trim()).filter(Boolean);
        return a.category.trim() ? [a.category.trim()] : [];
      })(),
    });
    setUploadedImages((a.images ?? []).map((img) => ({ url: img.imageUrl, displayOrder: img.displayOrder, imageId: img.id })));
    setPendingImages([]);
    setFormOpen(true);
  };

  const openActiveEdit = (a: AuctionItem) => {
    setActiveEditTarget(a);
    setActiveEditForm({
      title: a.title,
      description: a.description ?? "",
      categories: (() => {
        if (!a.category) return [];
        if (a.category.includes("|")) return a.category.split("|").map(s => s.trim()).filter(Boolean);
        return a.category.trim() ? [a.category.trim()] : [];
      })(),
    });
    setActiveEditUploaded((a.images ?? []).map(img => ({ url: img.imageUrl, displayOrder: img.displayOrder, imageId: img.id })));
    setActiveEditPending([]);
    setActiveEditOpen(true);
  };

  const handleAddActiveEditFiles = useCallback((files: File[]) => {
    const newItems: PendingImage[] = files.map((f) => ({
      id: Math.random().toString(36).slice(2) + Date.now(),
      file: f,
      previewUrl: URL.createObjectURL(f),
      status: "compressing" as UploadStatus,
    }));
    setActiveEditPending((prev) => [...prev, ...newItems]);
    for (const item of newItems) {
      (async () => {
        const update = (patch: Partial<PendingImage>) =>
          setActiveEditPending((prev) => prev.map(p => p.id === item.id ? { ...p, ...patch } : p));
        try {
          const compressed = await compressImage(item.file);
          update({ status: 'uploading' });
          const base64 = await new Promise<string>((res, rej) => {
            const r = new FileReader();
            r.onload = () => res((r.result as string).split(',')[1]);
            r.onerror = rej;
            r.readAsDataURL(compressed);
          });
          const result = await preSaveImageMutation.mutateAsync({ imageData: base64, mimeType: 'image/jpeg', fileName: compressed.name });
          update({ status: 'success', tempUrl: result.url });
        } catch {
          update({ status: 'error', errorMsg: '上載失敗，請移除後重試' });
        }
      })();
    }
  }, [preSaveImageMutation]);

  const handleSubmitActiveEdit = () => {
    if (!activeEditTarget) return;
    if (!activeEditForm.title.trim()) { toast.error("請填寫標題"); return; }
    if (isActiveEditUploading) { toast.error("圖片上載中，請稍後再提交"); return; }
    updateActiveAuctionMutation.mutate({
      id: activeEditTarget.id,
      title: activeEditForm.title,
      description: activeEditForm.description,
      category: activeEditForm.categories.join("|"),
    });
  };

  const handleSubmit = () => {
    if (!form.title.trim() || !form.startingPrice) { toast.error("請填寫標題和起拍價"); return; }
    if (form.categories.length === 0) { toast.error("請至少選擇一個商品分類"); return; }
    const stillUploading = pendingImages.filter(p => p.status === "compressing" || p.status === "uploading");
    if (stillUploading.length > 0) { toast.error(`仍有 ${stillUploading.length} 張圖片上載中，請稍後再提交`); return; }
    const totalImages = uploadedImages.length + pendingImages.filter(p => p.status === "success").length;
    if (totalImages === 0) { toast.error("請上傳至少一幅圖片"); return; }
    const antiSnipeEnabled = form.antiSnipeEnabled ? 1 : 0;
    const antiSnipeMinutes = isNaN(form.antiSnipeMinutes) ? 0 : form.antiSnipeMinutes;
    const extendMinutes = isNaN(form.extendMinutes) || form.extendMinutes < 1 ? 1 : form.extendMinutes;
    const category = form.categories.join("|");
    if (editId) {
      updateMutation.mutate({ id: editId, title: form.title, description: form.description, startingPrice: parseFloat(form.startingPrice), bidIncrement: form.bidIncrement, currency: form.currency as never, antiSnipeEnabled, antiSnipeMinutes, extendMinutes, category });
    } else {
      createMutation.mutate({ title: form.title, description: form.description, startingPrice: parseFloat(form.startingPrice), bidIncrement: form.bidIncrement, currency: form.currency as never, antiSnipeEnabled, antiSnipeMinutes, extendMinutes, category });
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

  const checkCanPublish = async (requiredCount = 1): Promise<boolean> => {
    // Check subscription first
    if (!mySubscription) {
      setNoSubDialogOpen(true);
      return false;
    }
    const { data: fresh } = await refetchMyDeposit();
    if (fresh && fresh.isActive === false) {
      toast.error("商戶暫已被停用，請聯繫客服了解情況");
      return false;
    }

    // Check both publish conditions in parallel
    const [quotaResult, depositResult] = await Promise.all([
      refetchQuotaInfo(),
      refetchCanList(),
    ]);
    const quota = quotaResult.data;
    const deposit = depositResult.data;

    const failReasons: string[] = [];

    // 條件一：發佈點數
    if (quota && !quota.unlimited && (quota.remainingQuota ?? 0) < requiredCount) {
      failReasons.push(`條件一：發佈點數不足（剩餘 ${quota.remainingQuota ?? 0} 次，需要 ${requiredCount} 次）`);
    }

    // 條件二：保證金維持水平
    if (deposit && !deposit.canList) {
      const balance = (deposit.balance ?? 0).toFixed(2);
      const required = (deposit.required ?? 0).toFixed(2);
      failReasons.push(`條件二：保證金維持水平不足（餘額 $${balance}，需要 $${required}）`);
    }

    if (failReasons.length > 0) {
      toast.error(failReasons.join('；'), { duration: 6000 });
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
    if (!(await checkCanPublish(selectedDrafts.size))) return;
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
      <Header />
      {/* 吸附在主頭部導航下方的操作欄 + Tab 列 */}
      <div className="border-b bg-card sticky top-16 z-10">
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

        {/* Tab 列 */}
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

      <div className="max-w-4xl mx-auto px-2 pt-2 pb-28 space-y-1.5">
        {/* ── 進行中 Tab 批量分享欄 ── */}
        {tab === "進行中" && activeAuctions.length > 0 && (
          <div className="flex items-center gap-2 px-1 py-1">
            <Button
              size="sm"
              className="h-7 px-2.5 text-xs gap-1.5 bg-[#1877F2] hover:bg-[#1560c8] text-white border-0"
              onClick={() => setBatchShareOpen(true)}
            >
              <Facebook className="w-3 h-3" />
              批量分享（{activeAuctions.length}）
            </Button>
          </div>
        )}

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
                onActiveEdit={openActiveEdit}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── 建立 / 編輯 草稿 Dialog ── */}
      <Dialog open={formOpen} onOpenChange={(v) => { if (!v) closeForm(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto bg-amber-50">
          <DialogHeader>
            <DialogTitle>{editId ? "編輯草稿" : "建立新草稿"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
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
            <div>
              <Label>標題 *</Label>
              <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="拍賣品名稱" />
            </div>
            <div>
              <Label>描述</Label>
              <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="詳細描述…" rows={3} />
            </div>
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Label>商品分類</Label>
                <span className="text-xs text-red-500 font-medium">（至少選一個）</span>
                {form.categories.length > 0 && (
                  <span className="ml-auto text-xs text-amber-600 font-medium">已選 {form.categories.length} 個</span>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {CATEGORIES.map((cat) => {
                  const selected = form.categories.includes(cat);
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setForm((f) => ({
                        ...f,
                        categories: selected
                          ? f.categories.filter(c => c !== cat)
                          : [...f.categories, cat],
                      }))}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                        selected
                          ? "bg-amber-500 text-white border-amber-500"
                          : "bg-white text-amber-700 border-amber-300 hover:bg-amber-50"
                      }`}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>起拍價 *</Label>
                <div className="flex">
                  <Select value={form.currency} onValueChange={(v) => setForm((f) => ({ ...f, currency: v }))}>
                    <SelectTrigger className="w-[68px] rounded-r-none border-r-0 px-1.5 shrink-0 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CURRENCY_OPTIONS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input type="number" min="0" value={form.startingPrice} onChange={(e) => setForm((f) => ({ ...f, startingPrice: e.target.value }))} placeholder="0" className="rounded-l-none flex-1 min-w-0" />
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
            </div>
            {/* 反狙擊延時設定 */}
            <div className="rounded-lg border border-amber-200 bg-amber-100/70 p-3 space-y-2">
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

      {/* ── 批量分享 Facebook Dialog ── */}
      <Dialog open={batchShareOpen} onOpenChange={(v) => { if (!v) { setBatchShareOpen(false); setCopiedIds(new Set()); setCopiedAll(false); } }}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#1877F2]">
              <Facebook className="w-5 h-5" />
              批量分享
            </DialogTitle>
          </DialogHeader>
          <div className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-700 space-y-0.5 -mt-1">
            <p>• <b>分享</b>：彈出系統分享選單，可選擇 Facebook 群組、WhatsApp 等</p>
            <p>• <b>複製文字</b>：複製格式化文字+連結，手動貼入任何平台</p>
          </div>
          {/* 複製全部按鈕 */}
          <Button
            size="sm"
            variant="outline"
            className={`h-7 text-xs gap-1.5 border-dashed ${copiedAll ? "border-green-400 text-green-600" : "border-amber-400 text-amber-700 hover:bg-amber-50"}`}
            onClick={async () => {
              const allText = activeAuctions.map((a) => {
                const sym = getCurrencySymbol(a.currency ?? "HKD");
                const currentBid = Number(a.currentPrice);
                const endDate = new Date(a.endTime);
                const weekdays = ["日","一","二","三","四","五","六"];
                const mo = endDate.getMonth()+1, dy = endDate.getDate(), wd = weekdays[endDate.getDay()];
                const h = endDate.getHours(), mi = String(endDate.getMinutes()).padStart(2,"0");
                const period = h < 6 ? "凌晨" : h < 12 ? "上午" : h === 12 ? "中午" : h < 18 ? "下午" : "晚上";
                const dh = h < 12 ? h : h === 12 ? 12 : h - 12;
                const endStr = `${mo}月${dy}日(${wd}) ${period}${dh}:${mi}`;
                return `${a.title}\n目前出價 ${sym}${currentBid.toLocaleString()}\n結標時間：${endStr}\n快來競拍！\nhttps://hongxcollections.com/auctions/${a.id}`;
              }).join("\n\n---\n\n");
              await navigator.clipboard.writeText(allText);
              setCopiedAll(true);
              toast.success("已複製全部拍賣文字！貼入 Facebook 群組即可");
              setTimeout(() => setCopiedAll(false), 3000);
            }}
          >
            {copiedAll ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            {copiedAll ? "已複製全部！" : `一鍵複製全部（${activeAuctions.length}）個拍賣文字`}
          </Button>
          <div className="overflow-y-auto flex-1 space-y-2 pr-1">
            {activeAuctions.map((a) => {
              const sym = getCurrencySymbol(a.currency ?? "HKD");
              const currentBid = Number(a.currentPrice);
              const endDate = new Date(a.endTime);
              const weekdays = ["日","一","二","三","四","五","六"];
              const mo = endDate.getMonth()+1, dy = endDate.getDate(), wd = weekdays[endDate.getDay()];
              const h = endDate.getHours(), mi = String(endDate.getMinutes()).padStart(2,"0");
              const period = h < 6 ? "凌晨" : h < 12 ? "上午" : h === 12 ? "中午" : h < 18 ? "下午" : "晚上";
              const dh = h < 12 ? h : h === 12 ? 12 : h - 12;
              const endStr = `${mo}月${dy}日(${wd}) ${period}${dh}:${mi}`;
              const shareText = `${a.title}\n目前出價 ${sym}${currentBid.toLocaleString()}\n結標時間：${endStr}\n快來競拍！`;
              const auctionUrl = `${window.location.origin}/auctions/${a.id}`;
              const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(auctionUrl)}`;
              const img = a.images?.[0]?.imageUrl;
              const isCopied = copiedIds.has(a.id);
              return (
                <div key={a.id} className="rounded-lg border border-amber-100 bg-amber-50/40 overflow-hidden">
                  <div className="flex items-center gap-2.5 p-2.5">
                    <div className="w-12 h-12 rounded-md overflow-hidden bg-muted flex-shrink-0">
                      {img
                        ? <img src={img} alt="" className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center"><ImageIcon className="w-4 h-4 text-muted-foreground/40" /></div>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{a.title}</p>
                      <p className="text-xs text-muted-foreground">{sym}{currentBid.toLocaleString()} · 結標 {endStr}</p>
                    </div>
                  </div>
                  <div className="flex gap-1.5 px-2.5 pb-2.5">
                    <Button
                      size="sm"
                      className="flex-1 h-7 text-xs gap-1 bg-[#1877F2] hover:bg-[#1560c8] text-white border-0"
                      onClick={async () => {
                        // Open window first (synchronous) to avoid popup blocker on mobile
                        window.open(fbUrl, "_blank", "noopener,noreferrer");
                        try { await navigator.clipboard.writeText(shareText); } catch {}
                        toast.success("拍賣文字已複製！在 Facebook 貼文框長按「貼上」即可", { duration: 5000 });
                      }}
                    >
                      <Facebook className="w-3 h-3" />
                      分享
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className={`flex-1 h-7 text-xs gap-1 ${isCopied ? "border-green-400 text-green-600 bg-green-50" : "border-amber-300 text-amber-700 hover:bg-amber-50"}`}
                      onClick={async () => {
                        await navigator.clipboard.writeText(`${shareText}\n${auctionUrl}`);
                        setCopiedIds(prev => new Set([...prev, a.id]));
                        toast.success("已複製！貼入群組帖子即可");
                        setTimeout(() => setCopiedIds(prev => { const n = new Set(prev); n.delete(a.id); return n; }), 3000);
                      }}
                    >
                      {isCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      {isCopied ? "已複製！" : "複製文字"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="pt-2 border-t">
            <Button variant="outline" className="w-full h-8 text-sm" onClick={() => { setBatchShareOpen(false); setCopiedIds(new Set()); setCopiedAll(false); }}>
              關閉
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── 未訂閱提示 Dialog ── */}
      <Dialog open={noSubDialogOpen} onOpenChange={setNoSubDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <CreditCard className="w-5 h-5" />
              需要訂閱月費計劃
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-1">
            <p className="text-sm text-foreground leading-relaxed">
              發佈拍賣需要有效的月費訂閱計劃。請先訂閱合適的計劃，審批通過後即可開始發佈。
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 space-y-1">
              <p className="font-medium">如何訂閱？</p>
              <p>1. 前往「訂閱計劃」頁面選擇計劃</p>
              <p>2. 上傳付款憑證提交申請</p>
              <p>3. 等待管理員審批（通常 1 個工作天）</p>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setNoSubDialogOpen(false)}>關閉</Button>
              <Link href="/subscriptions">
                <Button className="bg-amber-500 hover:bg-amber-600 text-white border-0 gap-1.5" onClick={() => setNoSubDialogOpen(false)}>
                  <CreditCard className="w-4 h-4" />
                  前往訂閱
                </Button>
              </Link>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── 進行中拍賣限制修改 Dialog ── */}
      <Dialog open={activeEditOpen} onOpenChange={(v) => {
        if (!v) {
          setActiveEditOpen(false);
          activeEditPending.forEach(p => URL.revokeObjectURL(p.previewUrl));
          setActiveEditPending([]);
        }
      }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>修改進行中拍賣</DialogTitle>
            <p className="text-xs text-muted-foreground mt-1">只可修改標題、詳情、分類及新增圖片。起標價、每口加幅及結束時間不可更改。</p>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label className="text-sm font-medium">標題 <span className="text-red-500">*</span></Label>
              <Input
                className="mt-1"
                value={activeEditForm.title}
                onChange={e => setActiveEditForm(f => ({ ...f, title: e.target.value }))}
                maxLength={255}
                placeholder="商品標題"
              />
            </div>
            <div>
              <Label className="text-sm font-medium">商品詳情</Label>
              <Textarea
                className="mt-1 min-h-[100px] text-sm"
                value={activeEditForm.description}
                onChange={e => setActiveEditForm(f => ({ ...f, description: e.target.value }))}
                placeholder="商品描述、狀況說明等..."
              />
            </div>
            <div>
              <Label className="text-sm font-medium">分類</Label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setActiveEditForm(f => ({
                      ...f,
                      categories: f.categories.includes(cat)
                        ? f.categories.filter(c => c !== cat)
                        : [...f.categories, cat],
                    }))}
                    className={`px-2 py-0.5 rounded-full text-xs border transition-colors ${activeEditForm.categories.includes(cat) ? "bg-amber-500 text-white border-amber-500" : "border-border text-muted-foreground hover:border-amber-300"}`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium">新增圖片（現有圖片不可刪除）</Label>
              {/* 現有圖片（只顯示，不可刪） */}
              {activeEditUploaded.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {activeEditUploaded.map((img, i) => (
                    <div key={i} className="relative w-16 h-16 rounded-md overflow-hidden bg-muted border">
                      <img src={img.url} alt="" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                        <span className="text-white text-[10px]">已上傳</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {/* 新增圖片上載區 */}
              <div
                className="mt-1.5 border-2 border-dashed rounded-lg p-3 text-center cursor-pointer hover:border-amber-400 transition-colors"
                onClick={() => {
                  const input = document.createElement("input");
                  input.type = "file";
                  input.accept = "image/*";
                  input.multiple = true;
                  input.onchange = (e) => {
                    const files = Array.from((e.target as HTMLInputElement).files ?? []);
                    const totalImages = activeEditUploaded.length + activeEditPending.length + files.length;
                    if (totalImages > MAX_IMAGES) {
                      toast.error(`最多只能上傳 ${MAX_IMAGES} 張圖片`);
                      return;
                    }
                    handleAddActiveEditFiles(files.filter(f => f.size <= MAX_FILE_SIZE));
                  };
                  input.click();
                }}
              >
                <Upload className="w-4 h-4 mx-auto text-muted-foreground mb-1" />
                <p className="text-xs text-muted-foreground">點擊選擇圖片（最多 {MAX_IMAGES} 張）</p>
              </div>
              {activeEditPending.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {activeEditPending.map((p, i) => (
                    <div key={p.id} className="relative w-16 h-16 rounded-md overflow-hidden bg-muted border">
                      <img src={p.previewUrl} alt="" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                        {p.status === "compressing" || p.status === "uploading" ? (
                          <Loader2 className="w-4 h-4 text-white animate-spin" />
                        ) : p.status === "error" ? (
                          <AlertCircle className="w-4 h-4 text-red-400" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4 text-green-400" />
                        )}
                      </div>
                      <button
                        type="button"
                        className="absolute top-0.5 right-0.5 bg-black/60 rounded-full p-0.5"
                        onClick={() => {
                          URL.revokeObjectURL(p.previewUrl);
                          setActiveEditPending(prev => prev.filter((_, idx) => idx !== i));
                        }}
                      >
                        <X className="w-2.5 h-2.5 text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <Button variant="outline" onClick={() => {
                setActiveEditOpen(false);
                activeEditPending.forEach(p => URL.revokeObjectURL(p.previewUrl));
                setActiveEditPending([]);
              }}>取消</Button>
              <Button
                className="bg-amber-500 hover:bg-amber-600 text-white"
                disabled={updateActiveAuctionMutation.isPending || isActiveEditUploading}
                onClick={handleSubmitActiveEdit}
              >
                {updateActiveAuctionMutation.isPending || isActiveEditUploading
                  ? <><Loader2 className="w-4 h-4 animate-spin mr-1" />儲存中...</>
                  : "儲存修改"}
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
