import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Eye, EyeOff, BookOpen, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Link } from "wouter";

const CATEGORIES = ["入門", "評級", "拍賣", "保養", "知識", "其他"];

function slugify(title: string) {
  return title
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fff\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);
}

interface ArticleForm {
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  imageUrl: string;
  category: string;
  isPublished: boolean;
}

const BLANK: ArticleForm = { slug: '', title: '', excerpt: '', content: '', imageUrl: '', category: '入門', isPublished: true };

export default function AdminArticles() {
  const utils = trpc.useUtils();
  const { data: articles = [], isLoading } = trpc.articles.adminList.useQuery();
  const [editing, setEditing] = useState<{ id: number | null; form: ArticleForm } | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const create = trpc.articles.create.useMutation({
    onSuccess: () => { toast.success("文章已建立"); utils.articles.adminList.invalidate(); utils.articles.list.invalidate(); setEditing(null); },
    onError: (e) => toast.error(e.message),
  });
  const update = trpc.articles.update.useMutation({
    onSuccess: () => { toast.success("文章已更新"); utils.articles.adminList.invalidate(); utils.articles.list.invalidate(); utils.articles.get.invalidate(); setEditing(null); },
    onError: (e) => toast.error(e.message),
  });
  const del = trpc.articles.delete.useMutation({
    onSuccess: () => { toast.success("文章已刪除"); utils.articles.adminList.invalidate(); utils.articles.list.invalidate(); setDeleteId(null); },
    onError: (e) => toast.error(e.message),
  });

  const openNew = () => setEditing({ id: null, form: { ...BLANK } });
  const openEdit = (a: any) => setEditing({
    id: a.id,
    form: { slug: a.slug, title: a.title, excerpt: a.excerpt ?? '', content: a.content ?? '', imageUrl: a.imageUrl ?? '', category: a.category ?? '入門', isPublished: !!a.isPublished },
  });

  const handleSave = () => {
    if (!editing) return;
    const f = editing.form;
    if (!f.title.trim()) { toast.error("請填寫標題"); return; }
    if (!f.slug.trim()) { toast.error("請填寫 Slug"); return; }
    if (!f.content.trim()) { toast.error("請填寫內容"); return; }
    const payload = { slug: f.slug.trim(), title: f.title.trim(), excerpt: f.excerpt.trim() || undefined, content: f.content.trim(), imageUrl: f.imageUrl.trim() || undefined, category: f.category || undefined, isPublished: f.isPublished ? 1 : 0 };
    if (editing.id == null) create.mutate(payload);
    else update.mutate({ id: editing.id, ...payload });
  };

  const setF = (key: keyof ArticleForm, val: any) => {
    if (!editing) return;
    const form = { ...editing.form, [key]: val };
    if (key === 'title' && editing.id == null) form.slug = slugify(val);
    setEditing({ ...editing, form });
  };

  const isPending = create.isPending || update.isPending;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 pt-10 pb-24">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-amber-500" />
            <h1 className="text-xl font-bold">知識庫文章管理</h1>
          </div>
          <div className="flex gap-2">
            <Link href="/guides">
              <a target="_blank" className="text-xs text-amber-600 underline mr-2 self-center">預覽知識庫</a>
            </Link>
            <Button onClick={openNew} size="sm" className="gold-gradient text-white border-0 gap-1.5">
              <Plus className="w-4 h-4" />新增文章
            </Button>
          </div>
        </div>

        {/* Article list */}
        {isLoading ? (
          <div className="text-center py-16 text-2xl animate-spin">💰</div>
        ) : (articles as any[]).length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">暫無文章，點擊「新增文章」開始</p>
          </div>
        ) : (
          <div className="space-y-2">
            {(articles as any[]).map((a) => (
              <div key={a.id} className="bg-white rounded-2xl border border-gray-100 px-4 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${a.isPublished ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {a.isPublished ? "已發布" : "草稿"}
                    </span>
                    {a.category && <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">{a.category}</span>}
                  </div>
                  <p className="font-medium text-sm mt-0.5 truncate">{a.title}</p>
                  <p className="text-xs text-muted-foreground">/guides/{a.slug}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Link href={`/guides/${a.slug}`}>
                    <a target="_blank" className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-amber-600 transition-colors" title="預覽">
                      <Eye className="w-4 h-4" />
                    </a>
                  </Link>
                  <button onClick={() => openEdit(a)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-blue-600 transition-colors" title="編輯">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => setDeleteId(a.id)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-red-500 transition-colors" title="刪除">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Editor Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4 pb-6 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-2xl my-auto overflow-hidden">
            <div className="bg-amber-500 px-5 py-4 flex items-center justify-between">
              <h2 className="font-bold text-white">{editing.id == null ? "新增文章" : "編輯文章"}</h2>
              <button onClick={() => setEditing(null)} className="text-white/80 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-xs">標題 *</Label>
                  <Input value={editing.form.title} onChange={e => setF('title', e.target.value)} placeholder="文章標題" maxLength={200} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Slug（URL）*</Label>
                  <Input value={editing.form.slug} onChange={e => setF('slug', e.target.value)} placeholder="e.g. coin-collecting-guide" maxLength={200} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">分類</Label>
                  <select
                    value={editing.form.category}
                    onChange={e => setF('category', e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm bg-white"
                  >
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-xs">摘要（顯示於列表頁）</Label>
                  <Textarea value={editing.form.excerpt} onChange={e => setF('excerpt', e.target.value)} rows={2} maxLength={500} placeholder="一句話介紹文章內容…" />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-xs">封面圖片 URL <span className="text-muted-foreground font-normal">（建議使用自有或已獲授權的圖片）</span></Label>
                  <Input value={editing.form.imageUrl} onChange={e => setF('imageUrl', e.target.value)} placeholder="/guides/article-cover.svg 或 https://…" maxLength={500} />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-xs">內文 * <span className="text-muted-foreground font-normal">（支援 ## 標題、**粗體**、- 列表）</span></Label>
                  <Textarea value={editing.form.content} onChange={e => setF('content', e.target.value)} rows={14} maxLength={20000} placeholder="文章內容…" className="font-mono text-xs" />
                </div>
                <div className="col-span-2 flex items-center gap-2">
                  <button
                    onClick={() => setF('isPublished', !editing.form.isPublished)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium border transition-colors ${editing.form.isPublished ? "bg-green-50 border-green-200 text-green-700" : "bg-gray-50 border-gray-200 text-gray-500"}`}
                  >
                    {editing.form.isPublished ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    {editing.form.isPublished ? "已發布（公開）" : "草稿（不公開）"}
                  </button>
                </div>
              </div>
            </div>
            <div className="px-5 py-4 border-t border-gray-100 flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setEditing(null)} disabled={isPending}>取消</Button>
              <Button onClick={handleSave} disabled={isPending} className="gold-gradient text-white border-0 gap-1.5">
                <Save className="w-4 h-4" />{isPending ? "儲存中…" : "儲存文章"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteId != null && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm text-center space-y-4">
            <Trash2 className="w-10 h-10 text-red-400 mx-auto" />
            <p className="font-semibold">確定刪除此文章？</p>
            <p className="text-sm text-muted-foreground">此操作不可復原</p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setDeleteId(null)} disabled={del.isPending}>取消</Button>
              <Button className="flex-1 bg-red-500 hover:bg-red-600 text-white border-0" onClick={() => del.mutate({ id: deleteId! })} disabled={del.isPending}>
                {del.isPending ? "刪除中…" : "確定刪除"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
