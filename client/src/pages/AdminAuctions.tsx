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
import { Plus, Pencil, Trash2, TrendingUp, Clock, LogOut, Upload, X, ImageIcon, Camera } from "lucide-react";

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
}

interface UploadedImage {
  url: string;
  displayOrder: number;
  imageId?: number;
}

interface PendingImage {
  file: File;
  previewUrl: string;
  displayOrder: number;
}

const defaultForm: AuctionFormData = {
  title: "",
  description: "",
  startingPrice: "",
  endTime: "",
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
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"));
      if (files.length > 0) onAddFiles(files);
    },
    [onAddFiles]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith("image/"));
    if (files.length > 0) onAddFiles(files);
    e.target.value = "";
  };

  const allImages = [...uploadedImages, ...pendingImages];
  const hasImages = allImages.length > 0;

  return (
    <div className="space-y-3">
      <Label>商品圖片</Label>

      {/* Drop Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer ${
          isDragging
            ? "border-amber-400 bg-amber-50"
            : "border-amber-200 hover:border-amber-400 hover:bg-amber-50/50"
        }`}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFileChange}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileChange}
        />
        <div className="flex flex-col items-center gap-2 pointer-events-none">
          <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
            <Upload className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-amber-800">點擊選擇或拖拽圖片至此</p>
            <p className="text-xs text-muted-foreground mt-0.5">支援 JPG、PNG、WebP，每張最大 5MB</p>
          </div>
        </div>
      </div>

      {/* Camera Button for mobile */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full border-amber-200 text-amber-700 hover:bg-amber-50"
        onClick={(e) => { e.preventDefault(); cameraInputRef.current?.click(); }}
      >
        <Camera className="w-4 h-4 mr-2" />
        用相機拍照上傳
      </Button>

      {/* Image Previews */}
      {hasImages && (
        <div className="grid grid-cols-3 gap-2">
          {/* Already uploaded images */}
          {uploadedImages.map((img, idx) => (
            <div key={`uploaded-${idx}`} className="relative group aspect-square rounded-lg overflow-hidden border border-amber-100">
              <img src={img.url} alt="" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all" />
              <button
                type="button"
                onClick={() => onRemoveUploaded(idx)}
                className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
              >
                <X className="w-3 h-3" />
              </button>
              <div className="absolute bottom-1 left-1 bg-emerald-500 text-white text-xs px-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                已上傳
              </div>
            </div>
          ))}

          {/* Pending images (not yet uploaded) */}
          {pendingImages.map((img, idx) => (
            <div key={`pending-${idx}`} className="relative group aspect-square rounded-lg overflow-hidden border border-amber-200">
              <img src={img.previewUrl} alt="" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all" />
              <button
                type="button"
                onClick={() => onRemovePending(idx)}
                className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
              >
                <X className="w-3 h-3" />
              </button>
              {isUploading && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              <div className="absolute bottom-1 left-1 bg-amber-500 text-white text-xs px-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                待上傳
              </div>
            </div>
          ))}
        </div>
      )}

      {!hasImages && (
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

  const createAuction = trpc.auctions.create.useMutation({
    onSuccess: async (result) => {
      if (pendingImages.length > 0 && result?.id) {
        await uploadPendingImages(result.id);
      }
      toast.success("拍賣建立成功！");
      closeDialog();
      refetch();
    },
    onError: (err) => toast.error(err.message || "建立失敗"),
  });

  const updateAuction = trpc.auctions.update.useMutation({
    onSuccess: async () => {
      if (pendingImages.length > 0 && editId) {
        await uploadPendingImages(editId);
      }
      toast.success("拍賣更新成功！");
      closeDialog();
      refetch();
    },
    onError: (err) => toast.error(err.message || "更新失敗"),
  });

  const deleteAuction = trpc.auctions.delete.useMutation({
    onSuccess: () => { toast.success("拍賣已刪除"); refetch(); },
    onError: (err) => toast.error(err.message || "刪除失敗"),
  });

  const uploadImageMutation = trpc.auctions.uploadImage.useMutation();
  const deleteImageMutation = trpc.auctions.deleteImage.useMutation();

  const uploadPendingImages = async (auctionId: number) => {
    setIsUploading(true);
    let successCount = 0;
    for (let i = 0; i < pendingImages.length; i++) {
      const pending = pendingImages[i];
      try {
        const base64 = await fileToBase64(pending.file);
        await uploadImageMutation.mutateAsync({
          auctionId,
          imageData: base64,
          fileName: pending.file.name,
          displayOrder: uploadedImages.length + i,
          mimeType: pending.file.type || "image/jpeg",
        });
        successCount++;
      } catch {
        toast.error(`圖片 ${pending.file.name} 上傳失敗`);
      }
    }
    setIsUploading(false);
    if (successCount > 0) toast.success(`${successCount} 張圖片上傳成功`);
  };

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(",")[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleAddFiles = (files: File[]) => {
    const newPending: PendingImage[] = files.map((file, i) => ({
      file,
      previewUrl: URL.createObjectURL(file),
      displayOrder: uploadedImages.length + pendingImages.length + i,
    }));
    setPendingImages((prev) => [...prev, ...newPending]);
  };

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
    if (!form.title || !form.startingPrice || !form.endTime) {
      toast.error("請填寫所有必填欄位");
      return;
    }
    if (editId) {
      updateAuction.mutate({
        id: editId,
        title: form.title,
        description: form.description,
        endTime: new Date(form.endTime),
      });
    } else {
      createAuction.mutate({
        title: form.title,
        description: form.description,
        startingPrice: parseFloat(form.startingPrice),
        endTime: new Date(form.endTime),
      });
    }
  };

  const openEdit = (auction: {
    id: number;
    title: string;
    description: string | null;
    startingPrice: string | number;
    endTime: Date;
    images: unknown;
  }) => {
    setEditId(auction.id);
    const images = auction.images as Array<{ id?: number; imageUrl: string; displayOrder: number }>;
    setForm({
      title: auction.title,
      description: auction.description ?? "",
      startingPrice: String(auction.startingPrice),
      endTime: new Date(auction.endTime).toISOString().slice(0, 16),
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
  const isPending = createAuction.isPending || updateAuction.isPending || isUploading;

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
                    className="mt-1 border-amber-200"
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
                    <Label htmlFor="price">起拍價（HK$）*</Label>
                    <Input
                      id="price"
                      type="number"
                      value={form.startingPrice}
                      onChange={(e) => setForm((f) => ({ ...f, startingPrice: e.target.value }))}
                      placeholder="100"
                      className="mt-1 border-amber-200"
                      disabled={!!editId}
                    />
                    {editId && <p className="text-xs text-muted-foreground mt-1">編輯時不可修改起拍價</p>}
                  </div>
                  <div>
                    <Label htmlFor="endTime">結束時間 *</Label>
                    <Input
                      id="endTime"
                      type="datetime-local"
                      value={form.endTime}
                      onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
                      className="mt-1 border-amber-200"
                    />
                  </div>
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

                <Button
                  onClick={handleSubmit}
                  disabled={isPending}
                  className="w-full gold-gradient text-white border-0"
                >
                  {isPending ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      {isUploading ? "上傳圖片中..." : "處理中..."}
                    </span>
                  ) : editId ? "更新拍賣" : "建立拍賣"}
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
                            HK${Number(auction.currentPrice).toLocaleString()}
                            {gain > 0 && <span className="text-emerald-600 font-medium ml-1">+{gainPct}%</span>}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDate(new Date(auction.endTime))}
                          </span>
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
