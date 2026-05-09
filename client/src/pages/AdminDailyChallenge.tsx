import { useState, useRef, useMemo, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import AdminHeader from "@/components/AdminHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useConfirm } from "@/components/ui/confirm-provider";
import { toast } from "sonner";
import { Plus, Image as ImageIcon, Pencil, Trash2, Calendar, Sparkles, Wand2, SquareDashed, Eye, EyeOff } from "lucide-react";

const COUNTRIES = ["香港","中國","英國","美國","日本","加拿大","澳洲","法國","德國","意大利","俄羅斯","印度","新加坡","馬來西亞","其他"] as const;
const CATEGORIES = ["銅幣","銀幣","金幣","紙幣","紀念幣","流通幣","其他"] as const;

function hkToday() {
  const d = new Date(Date.now() + 8 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
}

type Region = { x: number; y: number; w: number; h: number };

type FormState = {
  id?: number;
  imageUrl: string;
  imageUrlCensored?: string | null;
  imageRegions?: Region[];
  publishDate: string;
  answerCountry: string;
  answerYear: string;
  yearTolerance: string;
  answerCategory: string;
  hint: string;
  description: string;
  status: "draft" | "published" | "closed";
};

const emptyForm: FormState = {
  imageUrl: "",
  imageUrlCensored: null,
  imageRegions: [],
  publishDate: hkToday(),
  answerCountry: "",
  answerYear: "",
  yearTolerance: "5",
  answerCategory: "",
  hint: "",
  description: "",
  status: "draft",
};

export default function AdminDailyChallenge() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const fileRef = useRef<HTMLInputElement>(null);
  const confirm = useConfirm();

  const [form, setForm] = useState<FormState>(emptyForm);
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  const { data: list, isLoading } = trpc.dailyChallenge.adminList.useQuery(undefined, {
    enabled: !!user && user.role === "admin",
  });

  const createMut = trpc.dailyChallenge.adminCreate.useMutation({
    onSuccess: () => {
      toast.success("已建立挑戰");
      setOpen(false);
      setForm(emptyForm);
      utils.dailyChallenge.adminList.invalidate();
    },
    onError: (e) => toast.error(e.message || "建立失敗"),
  });
  const updateMut = trpc.dailyChallenge.adminUpdate.useMutation({
    onSuccess: () => {
      toast.success("已更新");
      setOpen(false);
      setForm(emptyForm);
      utils.dailyChallenge.adminList.invalidate();
    },
    onError: (e) => toast.error(e.message || "更新失敗"),
  });
  const deleteMut = trpc.dailyChallenge.adminDelete.useMutation({
    onSuccess: () => {
      toast.success("已刪除");
      utils.dailyChallenge.adminList.invalidate();
    },
    onError: (e) => toast.error(e.message || "刪除失敗"),
  });
  const uploadMut = trpc.dailyChallenge.adminUploadImage.useMutation();
  const suggestMut = trpc.dailyChallenge.adminGenerateSuggestions.useMutation();
  const mosaicMut = trpc.dailyChallenge.adminApplyMosaic.useMutation({
    onSuccess: () => {
      toast.success("已套用馬賽克並儲存");
      utils.dailyChallenge.adminList.invalidate();
    },
    onError: (e) => toast.error(e.message || "馬賽克處理失敗"),
  });
  const [suggestions, setSuggestions] = useState<Array<{
    country: string; year: number; yearTolerance: number; category: string;
    hint: string; description: string; titleHint: string; imageUrls: string[];
  }>>([]);
  // 每條 suggestion 揀邊張圖（index）
  const [picked, setPicked] = useState<Record<number, number>>({});

  const handleGenerate = async () => {
    try {
      const r = await suggestMut.mutateAsync();
      setSuggestions(r.suggestions);
      // 預設揀第一張圖
      const initPicked: Record<number, number> = {};
      r.suggestions.forEach((_, i) => { initPicked[i] = 0; });
      setPicked(initPicked);
      toast.success(`已生成 ${r.suggestions.length} 個建議，揀張圖再套用`);
    } catch (e: any) {
      toast.error(e?.message || "AI 生成失敗");
    }
  };

  const applySuggestion = (s: typeof suggestions[number], idx: number) => {
    const pickIdx = picked[idx] ?? 0;
    const chosenImage = s.imageUrls[pickIdx] || s.imageUrls[0] || "";
    setForm((f) => ({
      ...f,
      answerCountry: s.country,
      answerYear: String(s.year),
      yearTolerance: String(s.yearTolerance),
      answerCategory: s.category,
      hint: s.hint,
      description: s.description,
      imageUrl: chosenImage || f.imageUrl,
    }));
    setSuggestions([]);
    setPicked({});
    if (chosenImage) {
      toast.success(`已套用：${s.titleHint}（已選圖 #${pickIdx + 1}，可手動更換）`);
    } else {
      toast.success(`已套用：${s.titleHint}（暫時搵唔到對應圖片，請手動上載）`);
    }
  };

  if (user && user.role !== "admin") {
    return <div className="p-10 text-center">需要管理員權限</div>;
  }

  const openNew = () => {
    setForm({ ...emptyForm, publishDate: hkToday() });
    setOpen(true);
  };

  const openEdit = (c: any) => {
    let regions: Region[] = [];
    try {
      if (c.imageRegions) regions = JSON.parse(c.imageRegions);
    } catch {}
    setForm({
      id: c.id,
      imageUrl: c.imageUrl,
      imageUrlCensored: c.imageUrlCensored || null,
      imageRegions: regions,
      publishDate: c.publishDate,
      answerCountry: c.answerCountry,
      answerYear: String(c.answerYear),
      yearTolerance: String(c.yearTolerance ?? 5),
      answerCategory: c.answerCategory,
      hint: c.hint || "",
      description: c.description || "",
      status: c.status,
    });
    setOpen(true);
  };

  // ── 馬賽克編輯：原圖上拉矩形 ──
  const imgEditorRef = useRef<HTMLDivElement>(null);
  const [drawing, setDrawing] = useState<null | { startX: number; startY: number; cur: Region }>(null);
  // 跟住原圖實際 aspect ratio 設 container size，避免 object-contain letterbox 令矩形對唔正
  const [imgRatio, setImgRatio] = useState<number>(4 / 3);
  // 重設 imgRatio 當 imageUrl 變
  useEffect(() => { if (!form.imageUrl) setImgRatio(4 / 3); }, [form.imageUrl]);
  const regions = form.imageRegions || [];
  const setRegions = (rs: Region[]) => setForm((f) => ({ ...f, imageRegions: rs }));

  const onEditorPointerDown = (e: React.PointerEvent) => {
    if (!imgEditorRef.current) return;
    const rect = imgEditorRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setDrawing({ startX: x, startY: y, cur: { x, y, w: 0, h: 0 } });
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const onEditorPointerMove = (e: React.PointerEvent) => {
    if (!drawing || !imgEditorRef.current) return;
    const rect = imgEditorRef.current.getBoundingClientRect();
    const cx = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const cy = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    const x = Math.min(drawing.startX, cx);
    const y = Math.min(drawing.startY, cy);
    const w = Math.abs(cx - drawing.startX);
    const h = Math.abs(cy - drawing.startY);
    setDrawing({ ...drawing, cur: { x, y, w, h } });
  };
  const onEditorPointerUp = () => {
    if (!drawing) return;
    const r = drawing.cur;
    if (r.w > 0.01 && r.h > 0.01) {
      setRegions([...regions, r]);
    }
    setDrawing(null);
  };

  const applyMosaic = async () => {
    if (!form.id) {
      toast.error("請先儲存挑戰，再套用馬賽克");
      return;
    }
    const r = await mosaicMut.mutateAsync({ id: form.id, regions });
    setForm((f) => ({ ...f, imageUrlCensored: r.censoredUrl || null }));
  };
  const clearMosaic = async () => {
    if (!form.id) {
      setRegions([]);
      setForm((f) => ({ ...f, imageUrlCensored: null }));
      return;
    }
    await mosaicMut.mutateAsync({ id: form.id, regions: [] });
    setRegions([]);
    setForm((f) => ({ ...f, imageUrlCensored: null }));
  };

  const handleUpload = async (file: File) => {
    if (file.size > 8 * 1024 * 1024) {
      toast.error("圖片不可超過 8MB");
      return;
    }
    setUploading(true);
    try {
      const reader = new FileReader();
      const dataUrl: string = await new Promise((res, rej) => {
        reader.onload = () => res(reader.result as string);
        reader.onerror = rej;
        reader.readAsDataURL(file);
      });
      const base64 = dataUrl.split(",")[1] || "";
      const r = await uploadMut.mutateAsync({
        imageData: base64,
        fileName: file.name,
        mimeType: file.type || "image/jpeg",
      });
      setForm((f) => ({ ...f, imageUrl: r.url }));
      toast.success("圖片已上載");
    } catch (e: any) {
      toast.error(e?.message || "上載失敗");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const submit = () => {
    if (!form.imageUrl) return toast.error("請先上載圖片");
    if (!form.answerCountry) return toast.error("請揀國家");
    if (!form.answerCategory) return toast.error("請揀種類");
    const year = parseInt(form.answerYear);
    if (isNaN(year)) return toast.error("年份格式錯誤");
    const tol = parseInt(form.yearTolerance);
    if (isNaN(tol) || tol < 0) return toast.error("年份容差錯誤");

    if (form.id) {
      updateMut.mutate({
        id: form.id,
        patch: {
          imageUrl: form.imageUrl,
          publishDate: form.publishDate,
          answerCountry: form.answerCountry,
          answerYear: year,
          yearTolerance: tol,
          answerCategory: form.answerCategory,
          hint: form.hint || null,
          description: form.description || null,
          status: form.status,
        },
      });
    } else {
      createMut.mutate({
        imageUrl: form.imageUrl,
        publishDate: form.publishDate,
        answerCountry: form.answerCountry,
        answerYear: year,
        yearTolerance: tol,
        answerCategory: form.answerCategory,
        hint: form.hint || undefined,
        description: form.description || undefined,
        status: form.status === "closed" ? "published" : form.status,
      });
    }
  };

  const handleDelete = async (id: number) => {
    const ok = await confirm({
      title: "刪除挑戰？",
      description: "連同所有用戶答案會一齊刪除，無法復原。",
      confirmText: "刪除",
      cancelText: "取消",
      tone: "danger",
    });
    if (!ok) return;
    deleteMut.mutate({ id });
  };

  return (
    <div className="min-h-screen bg-stone-50">
      <AdminHeader />
      <div className="container max-w-6xl py-6 md:py-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Calendar className="w-6 h-6 text-amber-600" /> 每日一藏品挑戰
            </h1>
            <p className="text-sm text-muted-foreground mt-1">每日凌晨 00:00（HK）發佈新挑戰，用戶估國家／年代／種類，前 3 名得勳章。</p>
          </div>
          <Button onClick={openNew} className="bg-amber-500 hover:bg-amber-600">
            <Plus className="w-4 h-4 mr-1" /> 新增挑戰
          </Button>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">所有挑戰（最新 100）</CardTitle></CardHeader>
          <CardContent>
            {isLoading && <p className="text-sm text-muted-foreground">載入中…</p>}
            {!isLoading && (!list || list.length === 0) && (
              <p className="text-sm text-muted-foreground py-8 text-center">尚未建立任何挑戰，按右上角「新增挑戰」開始。</p>
            )}
            {list && list.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {list.map((c: any) => (
                  <div
                    key={c.id}
                    className="group relative border border-stone-200 rounded-xl bg-white overflow-hidden hover:border-amber-400 hover:shadow-md transition cursor-pointer"
                    onClick={() => openEdit(c)}
                  >
                    {/* 縮圖 */}
                    <div className="relative aspect-[4/3] bg-stone-100">
                      <img
                        src={c.imageUrlCensored || c.imageUrl}
                        alt=""
                        className="absolute inset-0 w-full h-full object-contain"
                        loading="lazy"
                      />
                      {c.imageUrlCensored && (
                        <span className="absolute top-2 left-2 text-[10px] bg-amber-500 text-white px-2 py-0.5 rounded-full shadow">
                          🟫 已馬賽克
                        </span>
                      )}
                      <span className={`absolute top-2 right-2 text-[10px] px-2 py-0.5 rounded-full shadow ${
                        c.status === "published" ? "bg-emerald-500 text-white" :
                        c.status === "closed" ? "bg-stone-500 text-white" :
                        "bg-amber-100 text-amber-800 border border-amber-300"
                      }`}>
                        {c.status === "published" ? "✓ 已發佈" : c.status === "closed" ? "已結束" : "草稿"}
                      </span>
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-3 py-2">
                        <span className="font-mono text-xs text-white drop-shadow">{c.publishDate}</span>
                      </div>
                    </div>
                    {/* 資料 */}
                    <div className="p-3 space-y-1.5">
                      <div className="text-sm font-medium text-stone-800 truncate">
                        🌍 {c.answerCountry} · 🪙 {c.answerCategory}
                      </div>
                      <div className="text-xs text-stone-600">
                        📅 <b>{c.answerYear}</b> <span className="text-stone-400">(±{c.yearTolerance})</span>
                      </div>
                      {c.hint && (
                        <div className="text-[11px] text-amber-700 bg-amber-50 px-2 py-1 rounded line-clamp-1">
                          💡 {c.hint}
                        </div>
                      )}
                      <div className="flex gap-1.5 pt-1">
                        <Button
                          variant="outline" size="sm"
                          className="flex-1 h-8 text-xs"
                          onClick={(e) => { e.stopPropagation(); openEdit(c); }}
                        >
                          <Pencil className="w-3 h-3 mr-1" /> 編輯
                        </Button>
                        <Button
                          variant="outline" size="sm"
                          className="h-8 text-rose-600 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300"
                          onClick={(e) => { e.stopPropagation(); handleDelete(c.id); }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{form.id ? "編輯挑戰" : "新增每日一藏品挑戰"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {/* AI 一鍵生成建議（新建模式先顯示） */}
            {!form.id && (
              <div className="border border-dashed border-amber-300 bg-amber-50/50 rounded-lg p-3">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="text-xs text-amber-800 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span className="font-medium">AI 出題助手</span>
                    <span className="text-amber-700/70">— 一鍵生成 3 個候選</span>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="border-amber-400 text-amber-700 hover:bg-amber-100"
                    onClick={handleGenerate}
                    disabled={suggestMut.isPending}
                  >
                    <Wand2 className="w-3.5 h-3.5 mr-1" />
                    {suggestMut.isPending ? "生成中…" : suggestions.length ? "重新生成" : "AI 生成建議"}
                  </Button>
                </div>
                {suggestions.length > 0 && (
                  <div className="space-y-2">
                    {suggestions.map((s, i) => {
                      const pickIdx = picked[i] ?? 0;
                      return (
                        <div key={i} className="bg-white rounded-md border border-amber-200 p-2.5 hover:border-amber-400 transition">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-stone-800">
                                {s.titleHint || `${s.country} ${s.year} ${s.category}`}
                              </div>
                              <div className="text-[11px] text-muted-foreground mt-0.5">
                                🌍 {s.country} · 📅 {s.year} (±{s.yearTolerance}) · 🪙 {s.category}
                              </div>
                              {s.hint && (
                                <div className="text-[11px] text-amber-700 mt-1">💡 {s.hint}</div>
                              )}
                              {s.description && (
                                <div className="text-[11px] text-stone-600 mt-1 line-clamp-2">{s.description}</div>
                              )}
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              className="bg-amber-500 hover:bg-amber-600 shrink-0"
                              onClick={() => applySuggestion(s, i)}
                            >
                              套用
                            </Button>
                          </div>
                          {s.imageUrls && s.imageUrls.length > 0 ? (
                            <div>
                              <div className="text-[10px] text-stone-500 mb-1">
                                揀一張圖片（共 {s.imageUrls.length} 張，已選 #{pickIdx + 1}）
                              </div>
                              <div className="grid grid-cols-4 gap-1.5">
                                {s.imageUrls.map((url, j) => (
                                  <button
                                    key={j}
                                    type="button"
                                    onClick={() => setPicked((p) => ({ ...p, [i]: j }))}
                                    className={`relative aspect-square rounded overflow-hidden border-2 transition ${
                                      pickIdx === j ? "border-amber-500 ring-2 ring-amber-300" : "border-stone-200 hover:border-amber-300"
                                    }`}
                                  >
                                    <img src={url} alt="" className="w-full h-full object-cover bg-stone-100" />
                                    {pickIdx === j && (
                                      <div className="absolute top-0.5 right-0.5 bg-amber-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[9px] font-bold shadow">✓</div>
                                    )}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div className="text-[11px] text-stone-500 bg-stone-50 rounded p-2 text-center">
                              暫時搵唔到對應圖片，套用後請手動上載
                            </div>
                          )}
                        </div>
                      );
                    })}
                    <p className="text-[10px] text-amber-700/80 px-1">
                      💡 每條建議自動配對 2-5 張 Wikimedia Commons 圖片，揀一張再「套用」即可。
                    </p>
                  </div>
                )}
                {suggestions.length === 0 && !suggestMut.isPending && (
                  <p className="text-[11px] text-amber-700/70">
                    AI 會根據最近題目避免重複，生成 3 個唔同國家／年代／種類嘅候選，並自動從 Wikimedia Commons 配對真實圖片；揀一個即可發佈。
                  </p>
                )}
              </div>
            )}

            <div>
              <Label className="text-xs">錢幣／紙幣圖片</Label>
              {form.imageUrl ? (
                <div className="mt-1 space-y-2">
                  {/* 馬賽克編輯器：原圖 + 拖拉矩形 */}
                  <div
                    ref={imgEditorRef}
                    className="relative w-full max-h-[60vh] bg-stone-100 rounded overflow-hidden select-none touch-none mx-auto"
                    style={{ aspectRatio: `${imgRatio}`, maxWidth: `min(100%, calc(60vh * ${imgRatio}))` }}
                    onPointerDown={onEditorPointerDown}
                    onPointerMove={onEditorPointerMove}
                    onPointerUp={onEditorPointerUp}
                    onPointerCancel={onEditorPointerUp}
                  >
                    <img
                      src={form.imageUrl}
                      alt=""
                      className="absolute inset-0 w-full h-full object-fill pointer-events-none"
                      draggable={false}
                      onLoad={(e) => {
                        const t = e.currentTarget;
                        if (t.naturalWidth && t.naturalHeight) {
                          setImgRatio(t.naturalWidth / t.naturalHeight);
                        }
                      }}
                    />
                    {/* 已存矩形 */}
                    {regions.map((r, i) => (
                      <div
                        key={i}
                        className="absolute bg-amber-500/40 border-2 border-amber-500 group"
                        style={{
                          left: `${r.x * 100}%`,
                          top: `${r.y * 100}%`,
                          width: `${r.w * 100}%`,
                          height: `${r.h * 100}%`,
                        }}
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setRegions(regions.filter((_, j) => j !== i));
                          }}
                          onPointerDown={(e) => e.stopPropagation()}
                          className="absolute -top-2 -right-2 w-5 h-5 bg-rose-500 text-white rounded-full text-[10px] flex items-center justify-center shadow hover:bg-rose-600"
                          title="刪除呢個馬賽克區域"
                        >×</button>
                      </div>
                    ))}
                    {/* 正在拉嘅矩形 */}
                    {drawing && (
                      <div
                        className="absolute bg-amber-500/30 border-2 border-amber-500 border-dashed pointer-events-none"
                        style={{
                          left: `${drawing.cur.x * 100}%`,
                          top: `${drawing.cur.y * 100}%`,
                          width: `${drawing.cur.w * 100}%`,
                          height: `${drawing.cur.h * 100}%`,
                        }}
                      />
                    )}
                    <Button
                      variant="outline" size="sm"
                      className="absolute top-2 right-2 z-10"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => setForm((f) => ({ ...f, imageUrl: "", imageUrlCensored: null, imageRegions: [] }))}
                    >更換</Button>
                  </div>

                  {/* 馬賽克控制 */}
                  <div className="bg-stone-50 border border-stone-200 rounded p-2.5 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs flex items-center gap-1.5 text-stone-700">
                        <SquareDashed className="w-3.5 h-3.5 text-amber-600" />
                        <span className="font-medium">馬賽克遮蓋區域</span>
                        <span className="text-stone-500">·</span>
                        <span className="text-stone-500">{regions.length} 個</span>
                        {form.imageUrlCensored && (
                          <span className="text-emerald-600 text-[10px] bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">已套用</span>
                        )}
                      </div>
                      <div className="flex gap-1.5">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="text-xs h-7"
                          onClick={clearMosaic}
                          disabled={mosaicMut.isPending || (regions.length === 0 && !form.imageUrlCensored)}
                        >
                          <EyeOff className="w-3 h-3 mr-1" /> 清除
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          className="text-xs h-7 bg-amber-500 hover:bg-amber-600"
                          onClick={applyMosaic}
                          disabled={mosaicMut.isPending || regions.length === 0}
                        >
                          {mosaicMut.isPending ? "處理中…" : (
                            <><Eye className="w-3 h-3 mr-1" /> 套用</>
                          )}
                        </Button>
                      </div>
                    </div>
                    <p className="text-[10px] text-stone-500 leading-relaxed">
                      💡 喺圖上 <b>拖拉矩形</b> 遮蓋紙幣／錢幣上嘅年份字樣，再按「套用」生成模糊版本畀用戶睇。可加多個區域（國家、面值等都可遮）。{!form.id && "（編輯時可用 — 請先儲存挑戰）"}
                    </p>
                    {form.imageUrlCensored && (
                      <div>
                        <div className="text-[10px] text-stone-500 mb-1">用戶實際睇到嘅版本：</div>
                        <img
                          src={form.imageUrlCensored}
                          alt=""
                          className="w-full max-h-32 object-contain bg-white rounded border border-stone-200"
                        />
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div
                  className="mt-1 border-2 border-dashed border-stone-300 rounded-lg p-8 text-center cursor-pointer hover:bg-stone-50"
                  onClick={() => fileRef.current?.click()}
                >
                  <ImageIcon className="w-8 h-8 mx-auto text-stone-400" />
                  <p className="text-sm text-muted-foreground mt-2">{uploading ? "上載中…" : "點此上載圖片（≤8MB）"}</p>
                </div>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUpload(f);
                }}
              />
            </div>

            <div>
              <Label className="text-xs">發佈日期 (YYYY-MM-DD, HK)</Label>
              <Input
                value={form.publishDate}
                onChange={(e) => setForm((f) => ({ ...f, publishDate: e.target.value }))}
                placeholder="2026-05-09"
              />
              <p className="text-[11px] text-muted-foreground mt-1">每日只生效一條已發佈嘅挑戰</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">🌍 國家</Label>
                <Select value={form.answerCountry} onValueChange={(v) => setForm((f) => ({ ...f, answerCountry: v }))}>
                  <SelectTrigger><SelectValue placeholder="揀國家" /></SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">🪙 種類</Label>
                <Select value={form.answerCategory} onValueChange={(v) => setForm((f) => ({ ...f, answerCategory: v }))}>
                  <SelectTrigger><SelectValue placeholder="揀種類" /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">📅 正確年份</Label>
                <Input
                  type="number"
                  value={form.answerYear}
                  onChange={(e) => setForm((f) => ({ ...f, answerYear: e.target.value }))}
                  placeholder="例如 1898"
                />
              </div>
              <div>
                <Label className="text-xs">年份容差 ±</Label>
                <Input
                  type="number"
                  value={form.yearTolerance}
                  onChange={(e) => setForm((f) => ({ ...f, yearTolerance: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <Label className="text-xs">提示（可選，題目會顯示畀用戶）</Label>
              <Input
                value={form.hint}
                onChange={(e) => setForm((f) => ({ ...f, hint: e.target.value }))}
                placeholder="例如：呢套錢幣有龍紋"
              />
            </div>

            <div>
              <Label className="text-xs">背景描述（可選，用戶答完先見到）</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="關於呢個錢幣嘅歷史故事…"
                rows={3}
              />
            </div>

            <div>
              <Label className="text-xs">狀態</Label>
              <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v as any }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">草稿（用戶睇唔到）</SelectItem>
                  <SelectItem value="published">已發佈（即時生效）</SelectItem>
                  {form.id && <SelectItem value="closed">結束（停止接受答案）</SelectItem>}
                </SelectContent>
              </Select>
            </div>

            <Button
              className="w-full bg-amber-500 hover:bg-amber-600"
              onClick={submit}
              disabled={createMut.isPending || updateMut.isPending}
            >
              {createMut.isPending || updateMut.isPending ? "儲存中…" : form.id ? "更新挑戰" : "建立挑戰"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
