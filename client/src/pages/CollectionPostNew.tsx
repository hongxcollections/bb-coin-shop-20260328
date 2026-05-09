import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/contexts/ToastContext";
import { ChevronLeft, X, Loader2, AlertTriangle } from "lucide-react";

const INTENTS: { key: "display" | "seek_value" | "for_sale"; label: string; desc: string }[] = [
  { key: "display", label: "純展示", desc: "純粹分享心愛收藏，唔需要估價或出讓" },
  { key: "seek_value", label: "求估價 / 求教", desc: "想聽其他藏家或商戶意見、估值、辨偽" },
  { key: "for_sale", label: "想出讓", desc: "希望搵買家。注意：唔可以寫價格／聯絡方式，會被自動隱藏" },
];

export default function CollectionPostNew() {
  const { user, isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();
  const { showToast } = useToast();
  const utils = trpc.useUtils();

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [intent, setIntent] = useState<"display" | "seek_value" | "for_sale">("display");
  const [tagsInput, setTagsInput] = useState("");
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const uploadImage = trpc.community.uploadImage.useMutation();
  const createPost = trpc.community.create.useMutation();
  const lintQuery = trpc.community.lintContent.useQuery(
    { text: `${title}\n${body}\n${tagsInput}` },
    { enabled: title.length > 1 || body.length > 5 }
  );

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" /></div>;
  }
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-2xl mx-auto p-8 text-center">
          <p className="mb-4">請先登入</p>
          <Button onClick={() => navigate(`/login?from=${encodeURIComponent("/collection-square/new")}`)}>登入</Button>
        </div>
      </div>
    );
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    if (imageUrls.length + files.length > 9) {
      showToast({ icon: "⚠️", title: "最多 9 張圖", desc: "", durationMs: 2500 });
      return;
    }
    setUploading(true);
    const uploaded: string[] = [];
    for (const file of Array.from(files)) {
      try {
        if (file.size > 8 * 1024 * 1024) {
          showToast({ icon: "⚠️", title: `${file.name} 超過 8MB`, desc: "", durationMs: 2500 });
          continue;
        }
        const buf = await file.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let binary = "";
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        const base64 = btoa(binary);
        const res = await uploadImage.mutateAsync({
          imageData: base64,
          fileName: file.name,
          mimeType: file.type || "image/jpeg",
        });
        uploaded.push(res.url);
      } catch (e: any) {
        showToast({ icon: "❌", title: "上載失敗", desc: e?.message ?? String(e), durationMs: 3500 });
      }
    }
    setImageUrls((prev) => [...prev, ...uploaded]);
    setUploading(false);
  }

  function removeImage(url: string) {
    setImageUrls((prev) => prev.filter((u) => u !== url));
  }

  async function submit() {
    if (title.trim().length < 2) {
      showToast({ icon: "⚠️", title: "標題太短", desc: "至少 2 個字", durationMs: 2500 });
      return;
    }
    if (imageUrls.length === 0) {
      showToast({ icon: "⚠️", title: "至少上載 1 張圖", desc: "", durationMs: 2500 });
      return;
    }
    setSubmitting(true);
    try {
      const tags = tagsInput.split(/[,，\s]+/).map((s) => s.trim()).filter(Boolean).slice(0, 10);
      const res = await createPost.mutateAsync({
        title: title.trim(),
        body: body.trim(),
        intent,
        tags,
        imageUrls,
      });
      utils.community.list.invalidate();
      if (res.flagged) {
        showToast({
          icon: "⚠️",
          title: "已暫時隱藏，等候 admin 審核",
          desc: `偵測到敏感內容（${res.reason}）。請避免聯絡方式／外部連結／QR 碼。`,
          durationMs: 6000,
        });
        navigate("/collection-square");
      } else {
        showToast({ icon: "✅", title: "發布成功！", desc: "", durationMs: 2500 });
        navigate(`/collection-square/${res.id}`);
      }
    } catch (e: any) {
      showToast({ icon: "❌", title: "發布失敗", desc: e?.message ?? String(e), durationMs: 4000 });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Header />
      <div className="max-w-2xl mx-auto p-4">
        <button onClick={() => navigate("/collection-square")} className="flex items-center text-sm text-gray-600 mb-4 hover:text-gray-900">
          <ChevronLeft className="w-4 h-4" /> 返回藏品廣場
        </button>

        <h1 className="text-2xl font-bold mb-1">發布收藏品</h1>
        <p className="text-sm text-gray-500 mb-6">分享心愛收藏 · 唔可以填寫價格／聯絡方式（會被自動隱藏）</p>

        <div className="bg-white rounded-lg border p-4 space-y-5">
          {/* 圖片 */}
          <div>
            <label className="block text-sm font-medium mb-2">圖片（最多 9 張，每張 ≤ 8MB）</label>
            <div className="grid grid-cols-3 gap-2">
              {imageUrls.map((url) => (
                <div key={url} className="relative aspect-square bg-gray-100 rounded overflow-hidden border">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeImage(url)}
                    className="absolute top-1 right-1 bg-black/60 hover:bg-black text-white rounded-full p-1"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {imageUrls.length < 9 && (
                <label className="aspect-square border-2 border-dashed rounded flex items-center justify-center cursor-pointer hover:bg-gray-50 text-gray-400 text-sm">
                  {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : "+ 加圖"}
                  <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
                </label>
              )}
            </div>
          </div>

          {/* 標題 */}
          <div>
            <label className="block text-sm font-medium mb-2">標題 <span className="text-red-500">*</span></label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例：清代咸豐通寶..." maxLength={255} />
          </div>

          {/* 描述 */}
          <div>
            <label className="block text-sm font-medium mb-2">描述（年代、來源、特徵）</label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="描述呢件藏品嘅故事、年代、品相..."
              rows={5}
              maxLength={5000}
            />
            <div className="text-xs text-gray-400 mt-1">{body.length} / 5000</div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium mb-2">分類 Tags（用空格／逗號分隔，例：清朝 銅錢 樣幣）</label>
            <Input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="清朝 銅錢 樣幣" />
          </div>

          {/* Intent */}
          <div>
            <label className="block text-sm font-medium mb-2">發帖意圖</label>
            <div className="space-y-2">
              {INTENTS.map((opt) => (
                <label
                  key={opt.key}
                  className={`flex items-start gap-3 p-3 border rounded cursor-pointer transition ${
                    intent === opt.key ? "border-amber-400 bg-amber-50" : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <input
                    type="radio"
                    checked={intent === opt.key}
                    onChange={() => setIntent(opt.key)}
                    className="mt-1"
                  />
                  <div>
                    <div className="font-medium text-sm">{opt.label}</div>
                    <div className="text-xs text-gray-500">{opt.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Lint warning */}
          {lintQuery.data?.flagged && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded flex gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold">偵測到敏感字眼：{lintQuery.data.reason}</div>
                <div className="text-xs mt-1">為防止私下交易，本平台禁止聯絡方式／QR 碼／外部連結。如照樣發布，帖文會被自動隱藏待 admin 審核。</div>
              </div>
            </div>
          )}

          <Button onClick={submit} disabled={submitting || uploading} className="w-full bg-amber-500 hover:bg-amber-600 text-white">
            {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            發布
          </Button>
        </div>
      </div>
    </div>
  );
}
