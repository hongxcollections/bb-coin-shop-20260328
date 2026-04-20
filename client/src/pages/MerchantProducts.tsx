import { useState, useRef, useCallback } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  ChevronLeft, Plus, Package, Pencil, Trash2, Eye, EyeOff,
  ImageIcon, X, Loader2, LayoutList, LayoutGrid, Grid3X3, Maximize2,
} from "lucide-react";

type LayoutMode = "list" | "grid2" | "grid3" | "big";

const CATEGORIES = ["古幣", "紀念幣", "外幣", "銀幣", "金幣", "其他"];
const STATUS_LABELS: Record<string, string> = { active: "上架中", sold: "已售出", hidden: "已下架" };
const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  sold: "bg-gray-100 text-gray-500",
  hidden: "bg-yellow-100 text-yellow-700",
};

interface ProductForm {
  title: string;
  description: string;
  price: string;
  currency: string;
  category: string;
  stock: string;
  images: string[];
}

const EMPTY_FORM: ProductForm = {
  title: "", description: "", price: "", currency: "HKD", category: "", stock: "1", images: [],
};

export default function MerchantProducts() {
  const { isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const fileRef = useRef<HTMLInputElement>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ProductForm>(EMPTY_FORM);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [layout, setLayout] = useState<LayoutMode>(() => {
    return (localStorage.getItem("mp_layout") as LayoutMode) ?? "list";
  });

  const { data: products = [], isLoading } = trpc.merchants.myProducts.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const { data: quotaInfo, isLoading: quotaLoading } = trpc.merchants.getQuotaInfo.useQuery(undefined, {
    enabled: isAuthenticated,
    staleTime: 0,
    refetchOnMount: true,
  });
  const { data: depositCheck } = trpc.sellerDeposits.canList.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  function changeLayout(m: LayoutMode) {
    setLayout(m);
    localStorage.setItem("mp_layout", m);
  }

  const addProduct = trpc.merchants.addProduct.useMutation({
    onSuccess: () => {
      utils.merchants.myProducts.invalidate();
      utils.merchants.getQuotaInfo.invalidate();
      toast.success("商品已上架");
      resetForm();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateProduct = trpc.merchants.updateProduct.useMutation({
    onSuccess: () => { utils.merchants.myProducts.invalidate(); toast.success("商品已更新"); resetForm(); },
    onError: (e) => toast.error(e.message),
  });

  const deleteProduct = trpc.merchants.deleteProduct.useMutation({
    onSuccess: () => { utils.merchants.myProducts.invalidate(); toast.success("商品已刪除"); },
    onError: (e) => toast.error(e.message),
  });

  const uploadImage = trpc.merchants.uploadProductImage.useMutation();

  function resetForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  function startEdit(p: any) {
    const imgs: string[] = (() => { try { return p.images ? JSON.parse(p.images) : []; } catch { return []; } })();
    setForm({
      title: p.title ?? "",
      description: p.description ?? "",
      price: parseFloat(p.price ?? "0").toString(),
      currency: p.currency ?? "HKD",
      category: p.category ?? "",
      stock: String(p.stock ?? 1),
      images: imgs,
    });
    setEditingId(p.id);
    setShowForm(true);
    setTimeout(() => document.getElementById("product-form")?.scrollIntoView({ behavior: "smooth" }), 100);
  }

  const handleImageUpload = useCallback(async (files: File[]) => {
    const MAX = 5;
    const currentCount = form.images.length;
    const slots = MAX - currentCount;
    if (slots <= 0) return;
    const toUpload = files.filter(f => f.type.startsWith("image/")).slice(0, slots);
    if (toUpload.length === 0) return;

    setUploading(true);
    try {
      const results = await Promise.all(
        toUpload.map(async (file) => {
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve((reader.result as string).split(",")[1]);
            reader.onerror = () => reject(new Error("讀取圖片失敗"));
            reader.readAsDataURL(file);
          });
          const { url } = await uploadImage.mutateAsync({ imageData: base64, fileName: file.name, mimeType: file.type || "image/jpeg" });
          return url;
        })
      );
      setForm(f => ({ ...f, images: [...f.images, ...results].slice(0, MAX) }));
      if (results.length > 1) toast.success(`已上傳 ${results.length} 張圖片`);
    } catch (err: any) {
      toast.error(err.message ?? "上傳失敗");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }, [form.images.length, uploadImage]);

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) handleImageUpload(files);
  }

  function handleSubmit() {
    if (!form.title.trim()) return toast.error("請輸入商品名稱");
    const price = parseFloat(form.price);
    if (isNaN(price) || price <= 0) return toast.error("請輸入有效售價");
    const stock = parseInt(form.stock);
    if (isNaN(stock) || stock < 0) return toast.error("請輸入有效庫存量");
    if (form.images.length === 0) return toast.error("請最少上傳一幅商品圖片");
    // 編輯時直接提交，新增時才顯示確認彈窗
    if (editingId) { doSubmit(); } else { setConfirmOpen(true); }
  }

  async function doSubmit() {
    const price = parseFloat(form.price);
    const stock = parseInt(form.stock);
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      price,
      currency: form.currency,
      category: form.category || undefined,
      images: form.images.length > 0 ? JSON.stringify(form.images) : undefined,
      stock,
    };
    setSaving(true);
    try {
      if (editingId) {
        await updateProduct.mutateAsync({ id: editingId, ...payload });
      } else {
        await addProduct.mutateAsync(payload);
      }
    } finally {
      setSaving(false);
      setConfirmOpen(false);
    }
  }

  async function toggleStatus(p: any) {
    const next = p.status === "active" ? "hidden" : "active";
    await updateProduct.mutateAsync({ id: p.id, status: next });
    utils.merchants.myProducts.invalidate();
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-6 text-center">
        <Package className="w-12 h-12 text-amber-400" />
        <h1 className="text-xl font-bold">請先登入</h1>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="max-w-lg mx-auto px-4 pt-4 pb-28 space-y-4">
        <div className="flex items-center gap-3">
          <Link href="/merchant-dashboard">
            <button className="p-2 rounded-xl hover:bg-amber-50 transition-colors">
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
          </Link>
          <Package className="w-5 h-5 text-green-600" />
          <h1 className="text-lg font-bold text-gray-800 flex-1">商品管理</h1>
          <Button
            size="sm"
            className="bg-green-600 hover:bg-green-700 text-white gap-1"
            onClick={() => { setEditingId(null); setForm(EMPTY_FORM); setShowForm(true); setTimeout(() => document.getElementById("product-form")?.scrollIntoView({ behavior: "smooth" }), 100); }}
          >
            <Plus className="w-4 h-4" />
            上架商品
          </Button>
        </div>

        {/* 商品表單 */}
        {showForm && (
          <div id="product-form" className="rounded-2xl bg-white border border-green-200 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-gray-800">{editingId ? "編輯商品" : "新增商品"}</h2>
              <button onClick={resetForm} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4" /></button>
            </div>

            {/* ── 圖片上載（最頂）── */}
            <div className="space-y-2">
              <label className="text-xs text-gray-500 font-medium flex items-center gap-1">
                商品圖片（最少 1 張，最多 5 張）<span className="text-red-500">*</span>
                {uploading && <span className="text-green-600 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" />上傳中…</span>}
              </label>

              {/* 拖放 / 點擊上傳區 */}
              {form.images.length < 5 && (
                <div
                  onClick={() => !uploading && fileRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${uploading ? "border-green-300 bg-green-50 cursor-wait" : "border-gray-300 hover:border-green-400 hover:bg-green-50"}`}
                >
                  {uploading ? (
                    <Loader2 className="w-6 h-6 mx-auto mb-1 text-green-500 animate-spin" />
                  ) : (
                    <ImageIcon className="w-6 h-6 mx-auto mb-1 text-gray-400" />
                  )}
                  <p className="text-xs text-gray-500">
                    {uploading ? "上傳中，請稍候…" : "點擊選擇圖片（可同時選多張）"}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">還可加 {5 - form.images.length} 張</p>
                </div>
              )}
              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileInputChange} />

              {/* 已上傳圖片縮圖 */}
              {form.images.length > 0 && (
                <div className="grid grid-cols-5 gap-2">
                  {form.images.map((url, i) => (
                    <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-gray-200">
                      <img src={url} alt="" className="w-full h-full object-cover" />
                      <button
                        onClick={() => setForm(f => ({ ...f, images: f.images.filter((_, j) => j !== i) }))}
                        className="absolute top-0.5 right-0.5 bg-red-500 text-white rounded-full p-0.5"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                      {i === 0 && (
                        <span className="absolute bottom-0 left-0 right-0 text-center text-white text-[9px] bg-black/50 py-0.5">封面</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── 商品資料 ── */}
            <div className="space-y-2">
              <label className="text-xs text-gray-500 font-medium">商品名稱 *</label>
              <Input placeholder="例：1981年香港一元硬幣" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </div>

            <div className="space-y-2">
              <label className="text-xs text-gray-500 font-medium">商品描述</label>
              <Textarea placeholder="品相、年份、特點等..." rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <label className="text-xs text-gray-500 font-medium">售價 *</label>
                <Input type="number" placeholder="0" min="1" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-gray-500 font-medium">貨幣</label>
                <Select value={form.currency} onValueChange={v => setForm(f => ({ ...f, currency: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="HKD">HKD</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="CNY">CNY</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <label className="text-xs text-gray-500 font-medium">類別</label>
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue placeholder="選擇類別" /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-xs text-gray-500 font-medium">庫存數量</label>
                <Input type="number" placeholder="1" min="0" value={form.stock} onChange={e => setForm(f => ({ ...f, stock: e.target.value }))} />
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={resetForm} disabled={saving || uploading}>取消</Button>
              <Button className="flex-1 bg-green-600 hover:bg-green-700 text-white" onClick={handleSubmit} disabled={saving || uploading}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : (editingId ? "儲存修改" : "確認上架")}
              </Button>
            </div>
          </div>
        )}

        {/* 版面切換列 */}
        {!isLoading && products.length > 0 && (
          <div className="flex items-center justify-between bg-white border border-gray-100 rounded-xl px-3 py-2">
            <span className="text-xs text-gray-400">共 {products.length} 件商品</span>
            <div className="flex items-center gap-1">
              {([
                { mode: "list" as LayoutMode, icon: <LayoutList className="w-4 h-4" />, label: "列表" },
                { mode: "big" as LayoutMode, icon: <Maximize2 className="w-4 h-4" />, label: "大圖" },
                { mode: "grid2" as LayoutMode, icon: <LayoutGrid className="w-4 h-4" />, label: "兩欄" },
                { mode: "grid3" as LayoutMode, icon: <Grid3X3 className="w-4 h-4" />, label: "三欄" },
              ]).map(({ mode, icon, label }) => (
                <button
                  key={mode}
                  title={label}
                  onClick={() => changeLayout(mode)}
                  className={`p-1.5 rounded-lg transition-colors ${layout === mode ? "bg-green-100 text-green-700" : "text-gray-400 hover:bg-gray-100"}`}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 商品列表 */}
        {isLoading ? (
          <div className="text-center py-12 text-4xl animate-spin">💰</div>
        ) : products.length === 0 ? (
          <div className="text-center py-16">
            <Package className="w-12 h-12 text-green-200 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">尚未上架任何商品</p>
            <p className="text-gray-300 text-xs mt-1">點擊「上架商品」開始添加</p>
          </div>
        ) : layout === "list" ? (
          /* ── 列表版面：橫排縮圖＋詳情 ── */
          <div className="space-y-3">
            {(products as any[]).map((p) => {
              const imgs: string[] = (() => { try { return p.images ? JSON.parse(p.images) : []; } catch { return []; } })();
              const price = parseFloat(p.price ?? "0");
              return (
                <div key={p.id} className="bg-white rounded-2xl border border-gray-100 p-3 flex gap-3 items-start">
                  {imgs[0] ? (
                    <img src={imgs[0]} alt={p.title} className="w-16 h-16 rounded-xl object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-gray-50 flex items-center justify-center flex-shrink-0">
                      <Package className="w-6 h-6 text-gray-300" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-1">
                      <h3 className="text-sm font-semibold text-gray-800 line-clamp-1">{p.title}</h3>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full shrink-0 ${STATUS_COLORS[p.status] ?? ""}`}>
                        {STATUS_LABELS[p.status] ?? p.status}
                      </span>
                    </div>
                    {p.category && <span className="text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">{p.category}</span>}
                    <div className="flex items-center gap-3 mt-1">
                      <span className="font-bold text-amber-600 text-sm">{p.currency} ${price.toLocaleString()}</span>
                      <span className="text-xs text-gray-400">庫存 {p.stock}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-2">
                      <button onClick={() => startEdit(p)} className="flex items-center gap-1 text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors">
                        <Pencil className="w-3 h-3" />編輯
                      </button>
                      <button onClick={() => toggleStatus(p)} className="flex items-center gap-1 text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors">
                        {p.status === "active" ? <><EyeOff className="w-3 h-3" />下架</> : <><Eye className="w-3 h-3" />上架</>}
                      </button>
                      <button onClick={() => { if (confirm("確定刪除此商品？")) deleteProduct.mutate({ id: p.id }); }} className="flex items-center gap-1 text-xs px-2 py-1 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition-colors">
                        <Trash2 className="w-3 h-3" />刪除
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : layout === "big" ? (
          /* ── 大圖版面：全寬圖片＋資料在下 ── */
          <div className="space-y-4">
            {(products as any[]).map((p) => {
              const imgs: string[] = (() => { try { return p.images ? JSON.parse(p.images) : []; } catch { return []; } })();
              const price = parseFloat(p.price ?? "0");
              return (
                <div key={p.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                  {imgs[0] ? (
                    <img src={imgs[0]} alt={p.title} className="w-full h-52 object-cover" />
                  ) : (
                    <div className="w-full h-52 bg-gray-50 flex items-center justify-center">
                      <Package className="w-10 h-10 text-gray-200" />
                    </div>
                  )}
                  {imgs.length > 1 && (
                    <div className="flex gap-1 px-3 pt-2 overflow-x-auto">
                      {imgs.slice(1).map((u, i) => (
                        <img key={i} src={u} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0 border border-gray-100" />
                      ))}
                    </div>
                  )}
                  <div className="p-3 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-gray-800 line-clamp-2 text-sm">{p.title}</h3>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full shrink-0 ${STATUS_COLORS[p.status] ?? ""}`}>
                        {STATUS_LABELS[p.status] ?? p.status}
                      </span>
                    </div>
                    {p.description && <p className="text-xs text-gray-500 line-clamp-2">{p.description}</p>}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-amber-600">{p.currency} ${price.toLocaleString()}</span>
                        {p.category && <span className="text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">{p.category}</span>}
                      </div>
                      <span className="text-xs text-gray-400">庫存 {p.stock}</span>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <button onClick={() => startEdit(p)} className="flex items-center gap-1 text-xs px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors flex-1 justify-center">
                        <Pencil className="w-3 h-3" />編輯
                      </button>
                      <button onClick={() => toggleStatus(p)} className="flex items-center gap-1 text-xs px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors flex-1 justify-center">
                        {p.status === "active" ? <><EyeOff className="w-3 h-3" />下架</> : <><Eye className="w-3 h-3" />上架</>}
                      </button>
                      <button onClick={() => { if (confirm("確定刪除此商品？")) deleteProduct.mutate({ id: p.id }); }} className="flex items-center gap-1 text-xs px-3 py-1.5 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition-colors">
                        <Trash2 className="w-3 h-3" />刪除
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : layout === "grid2" ? (
          /* ── 兩欄版面 ── */
          <div className="grid grid-cols-2 gap-3">
            {(products as any[]).map((p) => {
              const imgs: string[] = (() => { try { return p.images ? JSON.parse(p.images) : []; } catch { return []; } })();
              const price = parseFloat(p.price ?? "0");
              return (
                <div key={p.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden flex flex-col">
                  {imgs[0] ? (
                    <img src={imgs[0]} alt={p.title} className="w-full aspect-square object-cover" />
                  ) : (
                    <div className="w-full aspect-square bg-gray-50 flex items-center justify-center">
                      <Package className="w-8 h-8 text-gray-200" />
                    </div>
                  )}
                  <div className="p-2 flex flex-col gap-1 flex-1">
                    <div className="flex items-start justify-between gap-1">
                      <h3 className="text-xs font-semibold text-gray-800 line-clamp-2 flex-1">{p.title}</h3>
                      <span className={`text-[10px] px-1 py-0.5 rounded-full shrink-0 leading-tight ${STATUS_COLORS[p.status] ?? ""}`}>
                        {STATUS_LABELS[p.status] ?? p.status}
                      </span>
                    </div>
                    <span className="font-bold text-amber-600 text-xs">{p.currency} ${price.toLocaleString()}</span>
                    <span className="text-[10px] text-gray-400">庫存 {p.stock}</span>
                    <div className="flex gap-1 mt-auto pt-1">
                      <button onClick={() => startEdit(p)} className="flex-1 text-[10px] py-1 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-center">
                        編輯
                      </button>
                      <button onClick={() => toggleStatus(p)} className="flex-1 text-[10px] py-1 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors text-center">
                        {p.status === "active" ? "下架" : "上架"}
                      </button>
                      <button onClick={() => { if (confirm("確定刪除？")) deleteProduct.mutate({ id: p.id }); }} className="text-[10px] px-1.5 py-1 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition-colors">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* ── 三欄版面（精簡方格）── */
          <div className="grid grid-cols-3 gap-2">
            {(products as any[]).map((p) => {
              const imgs: string[] = (() => { try { return p.images ? JSON.parse(p.images) : []; } catch { return []; } })();
              const price = parseFloat(p.price ?? "0");
              return (
                <div key={p.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden flex flex-col">
                  <div className="relative">
                    {imgs[0] ? (
                      <img src={imgs[0]} alt={p.title} className="w-full aspect-square object-cover" />
                    ) : (
                      <div className="w-full aspect-square bg-gray-50 flex items-center justify-center">
                        <Package className="w-5 h-5 text-gray-200" />
                      </div>
                    )}
                    <span className={`absolute top-1 right-1 text-[9px] px-1 py-0.5 rounded-full leading-tight ${STATUS_COLORS[p.status] ?? ""}`}>
                      {STATUS_LABELS[p.status] ?? p.status}
                    </span>
                  </div>
                  <div className="p-1.5 flex flex-col gap-0.5 flex-1">
                    <h3 className="text-[10px] font-semibold text-gray-800 line-clamp-2 leading-tight">{p.title}</h3>
                    <span className="text-[10px] font-bold text-amber-600">${price.toLocaleString()}</span>
                    <div className="flex gap-1 mt-1">
                      <button onClick={() => startEdit(p)} className="flex-1 text-[9px] py-0.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors text-center">
                        編輯
                      </button>
                      <button onClick={() => toggleStatus(p)} className="flex-1 text-[9px] py-0.5 bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors text-center">
                        {p.status === "active" ? "下架" : "上架"}
                      </button>
                      <button onClick={() => { if (confirm("確定刪除？")) deleteProduct.mutate({ id: p.id }); }} className="text-[9px] px-1 py-0.5 bg-red-50 text-red-500 rounded hover:bg-red-100 transition-colors">
                        <Trash2 className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 確認上架彈窗 */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5 text-green-600" />
              確認上架商品
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-gray-700 pt-1">
                <div className="bg-gray-50 rounded-xl p-3 space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-gray-500">商品名稱</span>
                    <span className="font-medium text-right max-w-[60%]">{form.title}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">售價</span>
                    <span className="font-bold text-amber-600">{form.currency} ${parseFloat(form.price || "0").toLocaleString()}</span>
                  </div>
                  {form.category && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">類別</span>
                      <span>{form.category}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-500">庫存</span>
                    <span>{form.stock} 件</span>
                  </div>
                  {form.images.length > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">圖片</span>
                      <span>{form.images.length} 張</span>
                    </div>
                  )}
                </div>
                {/* 公佈額度狀態 */}
                {(() => {
                  const remaining = quotaInfo ? Math.max(0, Number(quotaInfo.remainingQuota)) : null;
                  const quotaOk = !quotaInfo || quotaInfo.unlimited || (remaining !== null && remaining >= 1);
                  const isError = !depositCheck?.canList || !quotaOk;
                  let quotaLabel = "";
                  if (quotaLoading) {
                    quotaLabel = "查詢額度中…";
                  } else if (!quotaInfo || quotaInfo.unlimited) {
                    quotaLabel = "公佈額度正常（無限制）";
                  } else if (quotaOk) {
                    quotaLabel = `公佈額度正常（剩餘 ${remaining} 次）`;
                  } else {
                    quotaLabel = `公佈額度不足（剩餘 ${remaining} 次），請先購買月費計劃`;
                  }
                  return (
                    <div className={`rounded-lg p-2.5 flex items-start gap-2 ${isError ? "bg-red-50 border border-red-200" : "bg-green-50 border border-green-200"}`}>
                      <span className="text-base leading-none mt-0.5">
                        {quotaLoading ? "⏳" : isError ? "⚠️" : "✅"}
                      </span>
                      <div className="text-xs space-y-0.5">
                        {!depositCheck?.canList ? (
                          <p className="text-red-700 font-medium">{depositCheck?.reason ?? "保證金不足，無法上架"}</p>
                        ) : (
                          <p className={isError ? "text-red-700 font-medium" : "text-green-700"}>{quotaLabel}</p>
                        )}
                      </div>
                    </div>
                  );
                })()}
                <p className="text-xs text-gray-400">確認後商品將立即公開顯示於商戶市集，並扣減 1 次公佈額度。</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); doSubmit(); }}
              disabled={saving || !depositCheck?.canList || (!!quotaInfo && !quotaInfo.unlimited && Number(quotaInfo.remainingQuota) < 1)}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />上架中…</> : "確認上架"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
