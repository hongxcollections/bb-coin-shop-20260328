import { useState, useRef } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useConfirm } from "@/components/ui/confirm-provider";
import { toast } from "sonner";
import { ChevronLeft, Plus, Trash2, ImageIcon, X, Loader2, BookOpen } from "lucide-react";

const TAGS = ["交收", "送評", "入貨", "拍賣", "其他"];
const MAX_IMAGES = 5;

function fmtDateTime(d: Date | string) {
  const dt = new Date(d);
  return dt.toLocaleString("zh-HK", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function MerchantJournal() {
  const { confirm: confirmDialog } = useConfirm();
  const utils = trpc.useUtils();

  const { data: enabledData, isLoading: enabledLoading } = trpc.merchantJournal.isEnabled.useQuery();
  const { data: entries = [], isLoading: listLoading } = trpc.merchantJournal.list.useQuery(undefined, {
    enabled: enabledData?.enabled === true,
  });

  const [content, setContent] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [imageFiles, setImageFiles] = useState<{ file: File; preview: string }[]>([]);
  const [uploadedUrls, setUploadedUrls] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadImage = trpc.merchantJournal.uploadImage.useMutation();
  const createEntry = trpc.merchantJournal.create.useMutation({
    onSuccess: () => {
      utils.merchantJournal.list.invalidate();
      setContent("");
      setSelectedTags([]);
      setImageFiles([]);
      setUploadedUrls([]);
      toast.success("日誌已記錄");
    },
  });
  const deleteEntry = trpc.merchantJournal.delete.useMutation({
    onSuccess: () => {
      utils.merchantJournal.list.invalidate();
      toast.success("已刪除");
    },
  });

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const remaining = MAX_IMAGES - imageFiles.length;
    const toAdd = files.slice(0, remaining);
    const newPreviews = toAdd.map(f => ({ file: f, preview: URL.createObjectURL(f) }));
    setImageFiles(prev => [...prev, ...newPreviews]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeImage = (idx: number) => {
    setImageFiles(prev => {
      URL.revokeObjectURL(prev[idx].preview);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const handleSubmit = async () => {
    if (!content.trim()) {
      toast.error("請輸入日誌內容");
      return;
    }
    setIsSubmitting(true);
    try {
      const urls: string[] = [];
      for (const { file } of imageFiles) {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve((reader.result as string).split(",")[1]);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        const result = await uploadImage.mutateAsync({
          imageData: base64,
          fileName: file.name,
          mimeType: file.type || "image/jpeg",
        });
        urls.push(result.url);
      }
      await createEntry.mutateAsync({
        content: content.trim(),
        tags: selectedTags,
        imageUrls: urls,
      });
    } catch (err: any) {
      toast.error(err?.message ?? "記錄失敗");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (enabledLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
        </div>
      </div>
    );
  }

  if (!enabledData?.enabled) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container max-w-lg mx-auto px-4 pt-8 pb-20 text-center">
          <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">日誌功能未開通，請聯絡管理員。</p>
          <Link href="/merchant-dashboard">
            <Button variant="outline" className="mt-4 text-xs">返回商戶後台</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container max-w-lg mx-auto px-4 pt-4 pb-20">
        {/* Back */}
        <Link href="/merchant-dashboard">
          <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-amber-600 mb-4">
            <ChevronLeft className="w-4 h-4" /> 返回商戶後台
          </button>
        </Link>

        <div className="flex items-center gap-2 mb-5">
          <BookOpen className="w-5 h-5 text-amber-500" />
          <h1 className="text-lg font-bold">商戶日誌</h1>
        </div>

        {/* Write form */}
        <div className="rounded-2xl border bg-card p-4 mb-6 space-y-3">
          <Textarea
            placeholder="今日發生咗什麼？（最多 500 字）"
            value={content}
            onChange={e => setContent(e.target.value)}
            maxLength={500}
            rows={3}
            className="resize-none text-sm"
          />
          <div className="flex items-center gap-1 text-xs text-muted-foreground justify-end">
            {content.length}/500
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-1.5">
            {TAGS.map(tag => (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                  selectedTags.includes(tag)
                    ? "bg-amber-500 text-white border-amber-500"
                    : "bg-muted text-muted-foreground border-transparent hover:border-amber-300"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>

          {/* Image previews */}
          {imageFiles.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {imageFiles.map((f, i) => (
                <div key={i} className="relative w-14 h-14">
                  <img
                    src={f.preview}
                    alt=""
                    className="w-14 h-14 object-cover rounded-lg border"
                  />
                  <button
                    onClick={() => removeImage(i)}
                    className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Image add button */}
          <div className="flex items-center justify-between">
            {imageFiles.length < MAX_IMAGES ? (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-amber-600 transition-colors"
              >
                <ImageIcon className="w-3.5 h-3.5" />
                加圖片（{imageFiles.length}/{MAX_IMAGES}）
              </button>
            ) : (
              <span className="text-xs text-muted-foreground">{MAX_IMAGES} 張已達上限</span>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={isSubmitting || !content.trim()}
              className="gold-gradient text-white font-bold text-xs px-4"
            >
              {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Plus className="w-3.5 h-3.5 mr-1" />記錄</>}
            </Button>
          </div>
        </div>

        {/* Journal list */}
        {listLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-10 text-xs text-muted-foreground">
            <BookOpen className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            尚未有日誌記錄，開始記下今日嘅事吧
          </div>
        ) : (
          <div className="space-y-3">
            {(entries as any[]).map((entry) => (
              <div key={entry.id} className="rounded-2xl border bg-card p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] text-muted-foreground">{fmtDateTime(entry.createdAt)}</span>
                    {entry.tags.map((tag: string) => (
                      <span key={tag} className="px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-medium">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <button
                    onClick={async () => {
                      const ok = await confirmDialog({ title: "確認刪除？", description: "刪除後不能復原。", tone: "danger" });
                      if (!ok) return;
                      deleteEntry.mutate({ id: entry.id });
                    }}
                    className="shrink-0 text-gray-300 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{entry.content}</p>
                {entry.images.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {entry.images.map((url: string, i: number) => (
                      <button
                        key={i}
                        onClick={() => setExpandedImage(url)}
                        className="w-14 h-14 rounded-lg overflow-hidden border hover:opacity-80 transition-opacity"
                      >
                        <img src={url} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox - small overlay, not full screen */}
      {expandedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setExpandedImage(null)}
        >
          <div
            className="relative max-w-[80vw] max-h-[70vh]"
            onClick={e => e.stopPropagation()}
          >
            <img
              src={expandedImage}
              alt=""
              className="rounded-xl object-contain max-w-[80vw] max-h-[70vh] shadow-2xl"
            />
            <button
              onClick={() => setExpandedImage(null)}
              className="absolute -top-3 -right-3 w-7 h-7 bg-white rounded-full flex items-center justify-center shadow-md text-gray-600 hover:text-red-500 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
