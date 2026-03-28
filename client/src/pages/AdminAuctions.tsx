import { useState, useRef, useCallback } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, TrendingUp, Clock, LogOut, Upload, X, ImageIcon, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

const MAX_IMAGES = 10;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// 每口加幅預設選項（HK$）
const BID_INCREMENT_OPTIONS = [30, 50, 100, 200, 300, 500, 1000, 2000, 3000, 5000];

// 貨幣選項
const CURRENCY_OPTIONS = [
  { value: 'HKD', label: '🇭🇰 港幣 HKD', symbol: 'HK$' },
  { value: 'USD', label: '🇺🇸 美元 USD', symbol: 'US$' },
  { value: 'CNY', label: '🇨🇳 人民幣 CNY', symbol: '¥' },
  { value: 'GBP', label: '🇬🇧 英鎊 GBP', symbol: '£' },
  { value: 'EUR', label: '🇪🇺 歐元 EUR', symbol: '€' },
  { value: 'JPY', label: '🇯🇵 日圓 JPY', symbol: '¥' },
];

export function getCurrencySymbol(currency: string): string {
  return CURRENCY_OPTIONS.find(c => c.value === currency)?.symbol ?? currency + '$';
}

function formatDate(date: Date) {
  return new Date(date).toLocaleString("zh-HK", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

interface AuctionFormData {
  title: string;
  description: string;
  startingPrice: string;
  endTime: string;
  bidIncrement: number;
  currency: string;
}

interface UploadedImage {
  url: string;
  displayOrder: number;
  imageId?: number;
}

type UploadStatus = "pending" | "uploading" | "success" | "error";

interface PendingImage {
  file: File;
  previewUrl: string;
  displayOrder: number;
  status: UploadStatus;
  errorMsg?: string;
}

const defaultForm: AuctionFormData = {
  title: "",
  description: "",
  startingPrice: "",
  endTime: "",
  bidIncrement: 30,
  currency: "HKD",
};

// ─── Image Upload Zone Component ────────────────────────────────────────────
function ImageUploadZone({
  pendingImages,
  uploadedImages,
  onAddFiles,
  onRemovePending,
  onRemoveUploaded,
  isUploading,
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

  const processFiles = useCallback(
    (rawFiles: File[]) => {
      const imageFiles = rawFiles.filter((f) => f.type.startsWith("image/"));
      const oversized = imageFiles.filter((f) => f.size > MAX_FILE_SIZE);
      if (oversized.length > 0) {
        toast.error(`${oversized.length} 張圖片超過 5MB 限制，已略過`);
      }
      const valid = imageFiles.filter((f) => f.size <= MAX_FILE_SIZE);
      if (valid.length === 0) return;
      const toAdd = valid.slice(0, remaining);
      if (valid.length > remaining) {
        toast.warning(`最多只能上傳 ${MAX_IMAGES} 張，已自動截取前 ${toAdd.length} 張`);
      }
      onAddFiles(toAdd);
    },
    [remaining, onAddFiles]
  );

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (!canAddMore) return;
    processFiles(Array.from(e.dataTransfer.files));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    processFiles(Array.from(e.target.files ?? []));
    e.target.value = "";
  };

  const hasImages = totalCount > 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>商品圖片</Label>
        <span className="text-xs text-muted-foreground">
          {totalCount} / {MAX_IMAGES} 張
        </span>
      </div>

      {/* Drop Zone */}
      {canAddMore ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer select-none ${
            isDragging
              ? "border-amber-400 bg-amber-50 scale-[1.01]"
              : "border-amber-200 hover:border-amber-400 hover:bg-amber-50/50"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFileChange}
          />
          <div className="flex flex-col items-center gap-2 pointer-events-none">
            <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
              <Upload className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-amber-800">點擊選擇或拖拽圖片至此</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                可一次選取最多 {remaining} 張 · 每張最大 5MB · 支援 JPG、PNG、WebP
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center text-sm text-muted-foreground bg-gray-50">
          已達上限 {MAX_IMAGES} 張，請先刪除部分圖片再新增
        </div>
      )}

      {/* Image Grid */}
      {hasImages && (
        <div className="grid grid-cols-4 gap-2">
          {/* Already uploaded images */}
          {uploadedImages.map((img, idx) => (
            <div key={`uploaded-${idx}`} className="relative group aspect-square rounded-lg overflow-hidden border border-amber-100 bg-amber-50">
              <img src={img.url} alt="" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all" />
              {!isUploading && (
                <button
                  type="button"
                  onClick={() => onRemoveUploaded(idx)}
                  className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 z-10"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
              {/* Uploaded badge */}
              <div className="absolute bottom-1 left-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 drop-shadow" />
              </div>
            </div>
          ))}

          {/* Pending images */}
          {pendingImages.map((img, idx) => (
            <div key={`pending-${idx}`} className="relative group aspect-square rounded-lg overflow-hidden border-2 border-amber-200 bg-amber-50">
              <img src={img.previewUrl} alt="" className="w-full h-full object-cover" />

              {/* Status overlay */}
              {img.status === "uploading" && (
                <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-1">
                  <Loader2 className="w-5 h-5 text-white animate-spin" />
                  <span className="text-white text-xs">上傳中</span>
                </div>
              )}
              {img.status === "success" && (
                <div className="absolute inset-0 bg-emerald-500/30 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-emerald-500 drop-shadow" />
                </div>
              )}
              {img.status === "error" && (
                <div className="absolute inset-0 bg-red-500/40 flex flex-col items-center justify-center gap-1 p-1">
                  <AlertCircle className="w-5 h-5 text-red-200" />
                  <span className="text-red-100 text-xs text-center leading-tight">{img.errorMsg ?? "失敗"}</span>
                </div>
              )}

              {/* Remove button (only when not uploading) */}
              {img.status === "pending" && (
                <button
                  type="button"
                  onClick={() => onRemovePending(idx)}
                  className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 z-10"
                >
                  <X className="w-3 h-3" />
                </button>
              )}

              {/* Pending badge */}
              {img.status === "pending" && (
                <div className="absolute bottom-1 left-1 bg-amber-500/80 text-white text-xs px-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                  待上傳
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Upload progress summary */}
      {isUploading && (
        <div className="flex items-center gap-2 text-xs bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <Loader2 className="w-3.5 h-3.5 text-amber-600 animate-spin flex-shrink-0" />
          <span className="text-amber-800">
            正在上傳圖片（{pendingImages.filter(p => p.status === "success").length + pendingImages.filter(p => p.status === "uploading").length} / {pendingImages.length}）...
          </span>
        </div>
      )}

      {!hasImages && !isUploading && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-amber-50 rounded-lg p-3">
          <ImageIcon className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <span>尚未選擇圖片，拍賣將顯示預設錢幣圖示</span>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function AdminAuctions() {
  const { user, isAuthenticated, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<AuctionFormData>(defaultForm);
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const { data: auctions, isLoading, refetch } = trpc.auctions.myAuctions.useQuery();

  const uploadImageMutation = trpc.auctions.uploadImage.useMutation();
  const deleteImageMutation = trpc.auctions.deleteImage.useMutation();

  // ── Batch upload all pending images ──
  const uploadAllPending = async (auctionId: number): Promise<number> => {
    setIsUploading(true);
    let successCount = 0;

    for (let i = 0; i < pendingImages.length; i++) {
      const pending = pendingImages[i];
      if (pending.status !== "pending") continue;

      // Mark as uploading
      setPendingImages((prev) =>
        prev.map((p, idx) => idx === i ? { ...p, status: "uploading" } : p)
      );

      try {
        const base64 = await fileToBase64(pending.file);
        await uploadImageMutation.mutateAsync({
          auctionId,
          imageData: base64,
          fileName: pending.file.name,
          displayOrder: uploadedImages.length + i,
          mimeType: pending.file.type || "image/jpeg",
        });
        // Mark as success
        setPendingImages((prev) =>
          prev.map((p, idx) => idx === i ? { ...p, status: "success" } : p)
        );
        successCount++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "上傳失敗";
        setPendingImages((prev) =>
          prev.map((p, idx) => idx === i ? { ...p, status: "error", errorMsg: msg } : p)
        );
      }
    }

    setIsUploading(false);
    return successCount;
  };

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const createAuction = trpc.auctions.create.useMutation({
    onSuccess: async (result) => {
      let uploaded = 0;
      if (pendingImages.length > 0 && result?.id) {
        uploaded = await uploadAllPending(result.id);
      }
      const msg = uploaded > 0
        ? `拍賣建立成功！已上傳 ${uploaded} 張圖片`
        : "拍賣建立成功！";
      toast.success(msg);
      closeDialog();
      refetch();
    },
    onError: (err) => toast.error(err.message || "建立失敗"),
  });

  const updateAuction = trpc.auctions.update.useMutation({
    onSuccess: async () => {
      let uploaded = 0;
      if (pendingImages.length > 0 && editId) {
        uploaded = await uploadAllPending(editId);
      }
      const msg = uploaded > 0
        ? `拍賣更新成功！已上傳 ${uploaded} 張圖片`
        : "拍賣更新成功！";
      toast.success(msg);
      closeDialog();
      refetch();
    },
    onError: (err) => toast.error(err.message || "更新失敗"),
  });

  const deleteAuction = trpc.auctions.delete.useMutation({
    onSuccess: () => { toast.success("拍賣已刪除"); refetch(); },
    onError: (err) => toast.error(err.message || "刪除失敗"),
  });

  const handleAddFiles = useCallback((files: File[]) => {
    const newPending: PendingImage[] = files.map((file, i) => ({
      file,
      previewUrl: URL.createObjectURL(file),
      displayOrder: uploadedImages.length + pendingImages.length + i,
      status: "pending" as UploadStatus,
    }));
    setPendingImages((prev) => [...prev, ...newPending]);
  }, [uploadedImages.length, pendingImages.length]);

  const handleRemovePending = (idx: number) => {
    setPendingImages((prev) => {
      URL.revokeObjectURL(prev[idx].previewUrl);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const handleRemoveUploaded = async (idx: number) => {
    const img = uploadedImages[idx];
    if (img.imageId) {
      try {
        await deleteImageMutation.mutateAsync({ imageId: img.imageId });
        setUploadedImages((prev) => prev.filter((_, i) => i !== idx));
        toast.success("圖片已刪除");
      } catch {
        toast.error("刪除圖片失敗");
      }
    } else {
      setUploadedImages((prev) => prev.filter((_, i) => i !== idx));
    }
  };

  const closeDialog = () => {
    setOpen(false);
    setEditId(null);
    setForm(defaultForm);
    pendingImages.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    setPendingImages([]);
    setUploadedImages([]);
  };

  const handleSubmit = () => {
    if (!form.title.trim() || !form.startingPrice || !form.endTime) {
      toast.error("請填寫所有必填欄位");
      return;
    }
    if (form.bidIncrement < 30 || form.bidIncrement > 5000) {
      toast.error("每口加幅必須介於 HK$30 至 HK$5000 之間");
      return;
    }
    if (editId) {
      updateAuction.mutate({
        id: editId,
        title: form.title,
        description: form.description,
        endTime: new Date(form.endTime),
        bidIncrement: form.bidIncrement,
        currency: form.currency as 'HKD' | 'USD' | 'CNY' | 'GBP' | 'EUR' | 'JPY',
      });
    } else {
      createAuction.mutate({
        title: form.title,
        description: form.description,
        startingPrice: parseFloat(form.startingPrice),
        endTime: new Date(form.endTime),
        bidIncrement: form.bidIncrement,
        currency: form.currency as 'HKD' | 'USD' | 'CNY' | 'GBP' | 'EUR' | 'JPY',
      });
    }
  };

  const openEdit = (auction: {
    id: number;
    title: string;
    description: string | null;
    startingPrice: string | number;
    endTime: Date;
    bidIncrement?: number;
    images: unknown;
  }) => {
    setEditId(auction.id);
    const images = auction.images as Array<{ id?: number; imageUrl: string; displayOrder: number }>;
    setForm({
      title: auction.title,
      description: auction.description ?? "",
      startingPrice: String(auction.startingPrice),
      endTime: new Date(auction.endTime).toISOString().slice(0, 16),
      bidIncrement: auction.bidIncrement ?? 30,
      currency: (auction as { currency?: string }).currency ?? "HKD",
    });
    setUploadedImages(
      (images ?? []).map((img) => ({
        url: img.imageUrl,
        displayOrder: img.displayOrder,
        imageId: img.id,
      }))
    );
    setPendingImages([]);
    setOpen(true);
  };

  if (!isAuthenticated || user?.role !== "admin") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4">🔒</div>
          <p className="text-lg font-medium mb-4">需要管理員權限</p>
          <Link href="/"><Button className="gold-gradient text-white border-0">返回首頁</Button></Link>
        </div>
      </div>
    );
  }

  const activeCount = (auctions ?? []).filter((a: { status: string }) => a.status === "active").length;
  const endedCount = (auctions ?? []).filter((a: { status: string }) => a.status === "ended").length;
  const isMutating = createAuction.isPending || updateAuction.isPending || isUploading;
  const pendingCount = pendingImages.filter((p) => p.status === "pending").length;

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="nav-glass sticky top-0 z-50">
        <div className="container flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2 font-bold text-xl">
            <span className="text-2xl">💰</span>
            <span className="gold-gradient-text">大BB錢幣店</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/auctions">
              <Button variant="ghost" size="sm" className="text-amber-700 hover:text-amber-900 hover:bg-amber-50">所有拍賣</Button>
            </Link>
            <Link href="/profile">
              <Button variant="ghost" size="sm" className="text-amber-700 hover:text-amber-900 hover:bg-amber-50">{user?.name}</Button>
            </Link>
            <Button variant="outline" size="sm" onClick={logout} className="border-red-200 text-red-600 hover:bg-red-50">
              <LogOut className="w-3.5 h-3.5 mr-1" /> 登出
            </Button>
          </div>
        </div>
      </nav>

      <div className="container py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">管理後台</h1>
            <p className="text-muted-foreground mt-1">管理所有拍賣商品</p>
          </div>
          <Dialog open={open} onOpenChange={(v) => { if (!v) closeDialog(); else setOpen(true); }}>
            <DialogTrigger asChild>
              <Button className="gold-gradient text-white border-0 shadow-md hover:opacity-90">
                <Plus className="w-4 h-4 mr-2" /> 新增拍賣
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editId ? "編輯拍賣" : "新增拍賣"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                {/* Basic Info */}
                <div>
                  <Label htmlFor="title">拍品名稱 *</Label>
                  <Input
                    id="title"
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    placeholder="例：1980年香港一元硬幣"
                    className="mt-1 border-amber-200 focus-visible:ring-amber-400"
                  />
                </div>
                <div>
                  <Label htmlFor="desc">描述</Label>
                  <textarea
                    id="desc"
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder="拍品詳細說明、品相、歷史背景等..."
                    rows={3}
                    className="mt-1 w-full rounded-md border border-amber-200 bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 resize-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="price">起拍價 *</Label>
                    <div className="flex items-center gap-1 mt-1">
                      <Input
                        id="price"
                        type="number"
                        min="0"
                        value={form.startingPrice}
                        onChange={(e) => setForm((f) => ({ ...f, startingPrice: e.target.value }))}
                        placeholder="100"
                        className="border-amber-200 focus-visible:ring-amber-400"
                        disabled={!!editId}
                      />
                      <Select
                        value={form.currency}
                        onValueChange={(val) => setForm((f) => ({ ...f, currency: val }))}
                      >
                        <SelectTrigger id="currency" className="w-24 h-9 text-xs border-amber-200 focus:ring-amber-400 px-2 shrink-0">
                          <SelectValue placeholder="貨幣" />
                        </SelectTrigger>
                        <SelectContent>
                          {CURRENCY_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value} className="text-xs">
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {editId && <p className="text-xs text-muted-foreground mt-1">編輯時不可修改起拍價</p>}
                  </div>
                  <div>
                    <Label htmlFor="endTime">結束時間 *</Label>
                    <Input
                      id="endTime"
                      type="datetime-local"
                      value={form.endTime}
                      onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
                      className="mt-1 border-amber-200 focus-visible:ring-amber-400"
                    />
                  </div>
                </div>

                {/* Bid Increment */}
                <div className="flex items-center justify-between gap-4">
                  <Label htmlFor="bidIncrement" className="shrink-0 font-medium">每口加幅</Label>
                  <Select
                    value={String(form.bidIncrement)}
                    onValueChange={(val) => setForm((f) => ({ ...f, bidIncrement: parseInt(val) }))}
                  >
                    <SelectTrigger id="bidIncrement" className="w-44 border-amber-200 focus:ring-amber-400">
                      <SelectValue placeholder="選擇加幅" />
                    </SelectTrigger>
                    <SelectContent>
                      {BID_INCREMENT_OPTIONS.map((val) => (
                        <SelectItem key={val} value={String(val)}>
                          {getCurrencySymbol(form.currency)}{val.toLocaleString()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Image Upload Zone */}
                <ImageUploadZone
                  pendingImages={pendingImages}
                  uploadedImages={uploadedImages}
                  onAddFiles={handleAddFiles}
                  onRemovePending={handleRemovePending}
                  onRemoveUploaded={handleRemoveUploaded}
                  isUploading={isUploading}
                />

                {/* Submit Button */}
                <Button
                  onClick={handleSubmit}
                  disabled={isMutating}
                  className="w-full gold-gradient text-white border-0 h-11"
                >
                  {isMutating ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {isUploading
                        ? `上傳圖片中（${pendingImages.filter(p => p.status === "success").length}/${pendingImages.length}）...`
                        : "處理中..."}
                    </span>
                  ) : (
                    <>
                      {editId ? "更新拍賣" : "建立拍賣"}
                      {pendingCount > 0 && (
                        <span className="ml-2 bg-white/20 text-white text-xs px-2 py-0.5 rounded-full">
                          + {pendingCount} 張圖片
                        </span>
                      )}
                    </>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: "全部拍賣", value: auctions?.length ?? 0, color: "text-amber-700" },
            { label: "競拍中", value: activeCount, color: "text-emerald-600" },
            { label: "已結束", value: endedCount, color: "text-gray-500" },
          ].map((s) => (
            <Card key={s.label} className="border-amber-100 text-center">
              <CardContent className="py-4">
                <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Auctions List */}
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-20 bg-amber-50 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : auctions && auctions.length > 0 ? (
          <div className="space-y-3">
            {auctions.map((auction: {
              id: number;
              title: string;
              description: string | null;
              startingPrice: string | number;
              currentPrice: string | number;
              endTime: Date;
              status: string;
              bidIncrement?: number;
              images: unknown;
            }) => {
              const images = auction.images as Array<{ imageUrl: string }>;
              const gain = Number(auction.currentPrice) - Number(auction.startingPrice);
              const gainPct = Number(auction.startingPrice) > 0
                ? ((gain / Number(auction.startingPrice)) * 100).toFixed(1)
                : "0";
              return (
                <Card key={auction.id} className="border-amber-100 hover:border-amber-300 transition-all">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      {/* Thumbnail */}
                      <div className="w-16 h-16 rounded-xl coin-placeholder flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {images?.[0]?.imageUrl ? (
                          <img src={images[0].imageUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-2xl">🪙</span>
                        )}
                      </div>
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="font-semibold text-sm truncate">{auction.title}</h3>
                          <Badge className={auction.status === "active"
                            ? "bg-emerald-500 text-white text-xs"
                            : "bg-gray-400 text-white text-xs"}>
                            {auction.status === "active" ? "競拍中" : "已結束"}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" />
                            {getCurrencySymbol((auction as { currency?: string }).currency ?? 'HKD')}{Number(auction.currentPrice).toLocaleString()}
                            <span className="text-muted-foreground">{(auction as { currency?: string }).currency ?? 'HKD'}</span>
                            {gain > 0 && <span className="text-emerald-600 font-medium ml-1">+{gainPct}%</span>}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDate(new Date(auction.endTime))}
                          </span>
                          {auction.bidIncrement && (
                            <span className="flex items-center gap-1 text-amber-600 font-medium">
                              每口 {getCurrencySymbol((auction as { currency?: string }).currency ?? 'HKD')}{auction.bidIncrement}
                            </span>
                          )}
                          {images && images.length > 0 && (
                            <span className="flex items-center gap-1 text-amber-600">
                              <ImageIcon className="w-3 h-3" />
                              {images.length} 張圖片
                            </span>
                          )}
                        </div>
                      </div>
                      {/* Actions */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEdit(auction)}
                          className="border-amber-200 text-amber-700 hover:bg-amber-50"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            if (confirm("確定要刪除此拍賣嗎？")) {
                              deleteAuction.mutate({ id: auction.id });
                            }
                          }}
                          className="border-red-200 text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-20 text-muted-foreground">
            <div className="text-5xl mb-4">📦</div>
            <p className="text-lg font-medium">尚無拍賣商品</p>
            <p className="text-sm mt-1">點擊「新增拍賣」開始建立</p>
          </div>
        )}
      </div>
    </div>
  );
}
