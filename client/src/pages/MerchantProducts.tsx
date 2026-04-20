import { useState, useRef } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  ChevronLeft, Plus, Package, Pencil, Trash2, Eye, EyeOff,
  ImageIcon, X, Loader2, MessageCircle,
} from "lucide-react";

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

  const { data: products = [], isLoading } = trpc.merchants.myProducts.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const addProduct = trpc.merchants.addProduct.useMutation({
    onSuccess: () => { utils.merchants.myProducts.invalidate(); toast.success("商品已上架"); resetForm(); },
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

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(",")[1];
        const { url } = await uploadImage.mutateAsync({ imageData: base64, fileName: file.name, mimeType: file.type });
        setForm(f => ({ ...f, images: [...f.images, url] }));
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      toast.error(err.message ?? "上傳失敗");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleSubmit() {
    if (!form.title.trim()) return toast.error("請輸入商品名稱");
    const price = parseFloat(form.price);
    if (isNaN(price) || price <= 0) return toast.error("請輸入有效售價");
    const stock = parseInt(form.stock);
    if (isNaN(stock) || stock < 0) return toast.error("請輸入有效庫存量");

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

            <div className="space-y-2">
              <label className="text-xs text-gray-500 font-medium">商品圖片（最多 5 張）</label>
              <div className="flex flex-wrap gap-2">
                {form.images.map((url, i) => (
                  <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200">
                    <img src={url} alt="" className="w-full h-full object-cover" />
                    <button
                      onClick={() => setForm(f => ({ ...f, images: f.images.filter((_, j) => j !== i) }))}
                      className="absolute top-0.5 right-0.5 bg-red-500 text-white rounded-full p-0.5"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                ))}
                {form.images.length < 5 && (
                  <button
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="w-16 h-16 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center hover:border-green-400 transition-colors"
                  >
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin text-gray-400" /> : <ImageIcon className="w-4 h-4 text-gray-400" />}
                  </button>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            </div>

            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={resetForm} disabled={saving}>取消</Button>
              <Button className="flex-1 bg-green-600 hover:bg-green-700 text-white" onClick={handleSubmit} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : (editingId ? "儲存修改" : "確認上架")}
              </Button>
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
        ) : (
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
                      <button
                        onClick={() => startEdit(p)}
                        className="flex items-center gap-1 text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                      >
                        <Pencil className="w-3 h-3" />編輯
                      </button>
                      <button
                        onClick={() => toggleStatus(p)}
                        className="flex items-center gap-1 text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
                      >
                        {p.status === "active" ? <><EyeOff className="w-3 h-3" />下架</> : <><Eye className="w-3 h-3" />上架</>}
                      </button>
                      <button
                        onClick={() => { if (confirm("確定刪除此商品？")) deleteProduct.mutate({ id: p.id }); }}
                        className="flex items-center gap-1 text-xs px-2 py-1 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />刪除
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
