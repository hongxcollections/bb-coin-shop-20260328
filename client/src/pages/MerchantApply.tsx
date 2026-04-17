import { useState, useRef } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ChevronLeft, Store, X, CheckCircle2, Clock, XCircle, ImagePlus } from "lucide-react";

const CATEGORIES = ["港幣", "人民幣", "外幣", "紙幣", "金銀幣", "其他"];

function StatusBanner({ status, adminNote }: { status: string; adminNote?: string | null }) {
  if (status === "pending") return (
    <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5 flex items-start gap-3">
      <Clock className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
      <div>
        <p className="font-semibold text-amber-800">申請審核中</p>
        <p className="text-sm text-amber-700 mt-0.5">我們會在 1-3 個工作天內審核你的申請，請耐心等候。</p>
      </div>
    </div>
  );
  if (status === "approved") return (
    <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-5 flex items-start gap-3">
      <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" />
      <div>
        <p className="font-semibold text-emerald-800">申請已獲批准 🎉</p>
        <p className="text-sm text-emerald-700 mt-0.5">恭喜！管理員將會聯絡你完成保證金繳交及開通商戶帳號。</p>
        {adminNote && <p className="text-sm text-emerald-600 mt-1 italic">備注：{adminNote}</p>}
      </div>
    </div>
  );
  if (status === "rejected") return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-5 flex items-start gap-3">
      <XCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
      <div>
        <p className="font-semibold text-red-700">申請未獲批准</p>
        {adminNote && <p className="text-sm text-red-600 mt-0.5">原因：{adminNote}</p>}
        <p className="text-sm text-red-500 mt-1">如有疑問，請聯絡客服。</p>
      </div>
    </div>
  );
  return null;
}

export default function MerchantApply() {
  const { user, isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();

  const { data: myApp, isLoading: loadingApp, refetch } = trpc.merchants.myApplication.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const uploadPhoto = trpc.merchants.uploadPhoto.useMutation();
  const submit = trpc.merchants.submit.useMutation({
    onSuccess: () => {
      toast.success("申請已成功提交！我們會盡快審核。");
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const [form, setForm] = useState({
    contactName: "",
    merchantName: "",
    selfIntro: "",
    whatsapp: "",
    categories: [] as string[],
  });
  const [photos, setPhotos] = useState<string[]>([]); // uploaded S3 URLs
  const [previews, setPreviews] = useState<string[]>([]); // local previews
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function toggleCategory(cat: string) {
    setForm(f => ({
      ...f,
      categories: f.categories.includes(cat)
        ? f.categories.filter(c => c !== cat)
        : [...f.categories, cat],
    }));
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    if (photos.length + files.length > 6) {
      toast.error("最多上傳 6 張照片");
      return;
    }
    setUploading(true);
    try {
      for (const file of files) {
        const reader = new FileReader();
        const base64 = await new Promise<string>((res, rej) => {
          reader.onload = () => res((reader.result as string).split(",")[1]);
          reader.onerror = rej;
          reader.readAsDataURL(file);
        });
        const previewUrl = URL.createObjectURL(file);
        const result = await uploadPhoto.mutateAsync({
          imageData: base64,
          fileName: file.name.replace(/[^a-zA-Z0-9._-]/g, "_"),
          mimeType: file.type || "image/jpeg",
        });
        setPhotos(prev => [...prev, result.url]);
        setPreviews(prev => [...prev, previewUrl]);
      }
    } catch (err: unknown) {
      toast.error((err as { message?: string })?.message ?? "圖片上傳失敗");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function removePhoto(i: number) {
    setPhotos(p => p.filter((_, idx) => idx !== i));
    setPreviews(p => p.filter((_, idx) => idx !== i));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.contactName.trim()) return toast.error("請填寫聯繫姓名");
    if (!form.merchantName.trim()) return toast.error("請填寫商戶名稱");
    if (!form.selfIntro.trim() || form.selfIntro.trim().length < 10) return toast.error("自我介紹最少 10 個字");
    if (!form.whatsapp.trim()) return toast.error("請填寫 WhatsApp 號碼");
    if (form.categories.length === 0) return toast.error("請至少選擇一個貨品類別");
    if (photos.length < 3) return toast.error("請上傳最少 3 張貨品樣本照片");

    submit.mutate({
      contactName: form.contactName.trim(),
      merchantName: form.merchantName.trim(),
      selfIntro: form.selfIntro.trim(),
      whatsapp: form.whatsapp.trim(),
      categories: form.categories,
      samplePhotos: photos,
    });
  }

  if (loading || loadingApp) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-4xl animate-spin">🪙</div>
    </div>
  );

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-6 text-center">
        <Store className="w-12 h-12 text-amber-400" />
        <h1 className="text-xl font-bold">請先登入</h1>
        <p className="text-muted-foreground text-sm">申請商戶需要先登入帳號</p>
        <Button className="gold-gradient text-white border-0" onClick={() => window.location.href = getLoginUrl()}>
          立即登入
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50">
      <Header />
      <div className="container max-w-2xl pt-6 pb-28 px-4">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1 mb-6 text-sm text-muted-foreground">
          <Link href="/" className="flex items-center gap-1 hover:text-amber-700 transition-colors">
            <ChevronLeft className="w-4 h-4" /> 返回
          </Link>
        </div>

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 gold-gradient rounded-xl flex items-center justify-center flex-shrink-0">
            <Store className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-amber-900">開通商戶</h1>
            <p className="text-xs text-muted-foreground">填寫以下資料，我們審核後將聯絡你</p>
          </div>
        </div>

        {/* Existing application status */}
        {myApp && (
          <div className="mb-6">
            <StatusBanner status={myApp.status} adminNote={myApp.adminNote} />
            {myApp.status === "pending" && (
              <div className="mt-4 rounded-xl border border-amber-100 bg-white p-4 space-y-2 text-sm text-gray-600">
                {myApp.contactName && <p><span className="font-medium text-gray-800">聯繫姓名：</span>{myApp.contactName}</p>}
                <p><span className="font-medium text-gray-800">商戶名稱：</span>{myApp.merchantName}</p>
                <p><span className="font-medium text-gray-800">WhatsApp：</span>{myApp.whatsapp}</p>
                <p><span className="font-medium text-gray-800">類別：</span>{JSON.parse(myApp.categories).join("、")}</p>
              </div>
            )}
          </div>
        )}

        {/* Form — only show if no pending application */}
        {(!myApp || myApp.status === "rejected") && (
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* 商戶名稱 */}
            <div className="bg-white rounded-2xl border border-amber-100 p-4 space-y-3 shadow-sm">
              <h2 className="font-semibold text-amber-900 text-sm">基本資料</h2>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">聯繫姓名 *</label>
                <Input
                  placeholder="例如：陳大文"
                  value={form.contactName}
                  onChange={e => setForm(f => ({ ...f, contactName: e.target.value }))}
                  maxLength={50}
                  className="border-amber-200 focus:border-amber-400"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">商戶名稱 *</label>
                <Input
                  placeholder="例如：大BB錢幣"
                  value={form.merchantName}
                  onChange={e => setForm(f => ({ ...f, merchantName: e.target.value }))}
                  maxLength={50}
                  className="border-amber-200 focus:border-amber-400"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">WhatsApp 號碼 *</label>
                <Input
                  placeholder="例如：+852 9123 4567"
                  value={form.whatsapp}
                  onChange={e => setForm(f => ({ ...f, whatsapp: e.target.value }))}
                  className="border-amber-200 focus:border-amber-400"
                />
              </div>
            </div>

            {/* 自我介紹 */}
            <div className="bg-white rounded-2xl border border-amber-100 p-4 space-y-2 shadow-sm">
              <h2 className="font-semibold text-amber-900 text-sm">自我介紹 *</h2>
              <p className="text-xs text-gray-400">簡單介紹你的收藏背景及出售貨品（最少 10 字）</p>
              <textarea
                className="w-full min-h-[100px] rounded-lg border border-amber-200 focus:border-amber-400 focus:outline-none px-3 py-2 text-sm resize-none"
                placeholder="例如：本人收藏港幣逾 10 年，主要買賣 1960-1990 年代港幣硬幣，所有貨品均保證真品……"
                value={form.selfIntro}
                onChange={e => setForm(f => ({ ...f, selfIntro: e.target.value }))}
                maxLength={500}
              />
              <p className="text-xs text-gray-400 text-right">{form.selfIntro.length}/500</p>
            </div>

            {/* 主要類別 */}
            <div className="bg-white rounded-2xl border border-amber-100 p-4 space-y-3 shadow-sm">
              <h2 className="font-semibold text-amber-900 text-sm">主要貨品類別 *</h2>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat} type="button"
                    onClick={() => toggleCategory(cat)}
                    className={`rounded-full px-3.5 py-1.5 text-sm font-medium border-2 transition-all ${
                      form.categories.includes(cat)
                        ? "border-amber-500 bg-amber-50 text-amber-800"
                        : "border-gray-100 bg-gray-50 text-gray-600 hover:border-amber-200"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* 樣本照片 */}
            <div className="bg-white rounded-2xl border border-amber-100 p-4 space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-amber-900 text-sm">貨品樣本照片 *</h2>
                <span className="text-xs text-gray-400">最少 3 張，最多 6 張</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {previews.map((src, i) => (
                  <div key={i} className="aspect-square rounded-xl overflow-hidden relative border border-amber-100">
                    <img src={src} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removePhoto(i)}
                      className="absolute top-1 right-1 w-5 h-5 bg-black/50 rounded-full flex items-center justify-center"
                    >
                      <X className="w-3 h-3 text-white" />
                    </button>
                  </div>
                ))}
                {previews.length < 6 && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="aspect-square rounded-xl border-2 border-dashed border-amber-200 flex flex-col items-center justify-center gap-1 text-amber-400 hover:border-amber-400 hover:bg-amber-50 transition-all disabled:opacity-50"
                  >
                    {uploading ? (
                      <div className="animate-spin text-lg">⏳</div>
                    ) : (
                      <>
                        <ImagePlus className="w-5 h-5" />
                        <span className="text-xs">上傳</span>
                      </>
                    )}
                  </button>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleFileChange}
              />
              {photos.length < 3 && (
                <p className="text-xs text-amber-600">⚠ 仍需上傳 {3 - photos.length} 張照片</p>
              )}
            </div>

            {/* 提示 */}
            <div className="bg-amber-50 rounded-xl border border-amber-100 px-4 py-3 text-xs text-amber-700 space-y-1">
              <p>📋 申請成功後，管理員會透過 WhatsApp 聯絡你。</p>
              <p>💰 批准後需繳交保證金，金額由管理員根據貨品類型設定。</p>
            </div>

            <Button
              type="submit"
              disabled={submit.isPending || uploading}
              className="w-full gold-gradient text-white border-0 h-12 text-base font-semibold rounded-xl"
            >
              {submit.isPending ? "提交中…" : "提交申請"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
