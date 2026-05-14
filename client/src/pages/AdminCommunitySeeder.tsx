import { useState, useMemo } from "react";
import { Link } from "wouter";
import AdminHeader from "@/components/AdminHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/contexts/ToastContext";
import { useConfirm } from "@/components/ui/confirm-provider";
import { trpc } from "@/lib/trpc";
import { Sparkles, Trash2, Send, Search, Plus, X, RefreshCw, Pencil, ExternalLink } from "lucide-react";

type DraftImage = { url: string; source: "commons" | "manual" };

export default function AdminCommunitySeeder() {
  const { showToast } = useToast();
  const confirm = useConfirm();
  const utils = trpc.useUtils();

  const [selectedTheme, setSelectedTheme] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<"draft" | "published" | "archived" | "all">("draft");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<{ title: string; body: string; tags: string; images: DraftImage[]; authorUserId: number | null }>({
    title: "", body: "", tags: "", images: [], authorUserId: null,
  });
  const [searchQ, setSearchQ] = useState("");
  const [manualUrl, setManualUrl] = useState("");
  const [searching, setSearching] = useState(false);

  const themes = trpc.adminCommunitySeeder.listThemes.useQuery();
  const drafts = trpc.adminCommunitySeeder.listDrafts.useQuery({ status: statusFilter });
  const authors = trpc.adminCommunitySeeder.listEligibleAuthors.useQuery();

  const generate = trpc.adminCommunitySeeder.generateBatch.useMutation({
    onSuccess: (d) => {
      showToast({ icon: "✨", title: `已生成 ${d.count} 個草稿`, desc: "下面可編輯／加圖／發布", durationMs: 4000 });
      utils.adminCommunitySeeder.listDrafts.invalidate();
    },
    onError: (e) => showToast({ icon: "⚠️", title: "生成失敗", desc: e.message, durationMs: 5000 }),
  });
  const updateDraft = trpc.adminCommunitySeeder.updateDraft.useMutation({
    onSuccess: () => {
      showToast({ icon: "✅", title: "已儲存" });
      setEditingId(null);
      utils.adminCommunitySeeder.listDrafts.invalidate();
    },
    onError: (e) => showToast({ icon: "⚠️", title: "儲存失敗", desc: e.message }),
  });
  const publishDraft = trpc.adminCommunitySeeder.publishDraft.useMutation({
    onSuccess: (d) => {
      showToast({ icon: "🚀", title: "已發布", desc: `Post #${d.postId}` });
      utils.adminCommunitySeeder.listDrafts.invalidate();
    },
    onError: (e) => showToast({ icon: "⚠️", title: "發布失敗", desc: e.message }),
  });
  const deleteDraft = trpc.adminCommunitySeeder.deleteDraft.useMutation({
    onSuccess: () => {
      showToast({ icon: "🗑️", title: "已刪除" });
      utils.adminCommunitySeeder.listDrafts.invalidate();
    },
    onError: (e) => showToast({ icon: "⚠️", title: "刪除失敗", desc: e.message }),
  });
  const searchImages = trpc.adminCommunitySeeder.searchImages.useMutation();
  const uploadImage = trpc.adminCommunitySeeder.uploadImage.useMutation();

  const startEdit = (d: any) => {
    setEditingId(d.id);
    setEditForm({
      title: d.title,
      body: d.body,
      tags: (d.tags || []).join(", "),
      images: d.images || [],
      authorUserId: d.authorUserId ?? null,
    });
  };

  const handleSaveEdit = (id: number) => {
    const tags = editForm.tags.split(",").map(t => t.trim()).filter(Boolean).slice(0, 8);
    updateDraft.mutate({
      id, title: editForm.title, body: editForm.body, tags,
      images: editForm.images, authorUserId: editForm.authorUserId,
    });
  };

  const handleSearchImages = async () => {
    if (!searchQ.trim()) return;
    setSearching(true);
    try {
      const r = await searchImages.mutateAsync({ query: searchQ.trim(), limit: 4 });
      setEditForm(f => ({ ...f, images: [...f.images, ...r.images].slice(0, 10) }));
      showToast({ icon: "🖼️", title: `加咗 ${r.images.length} 張圖` });
      setSearchQ("");
    } catch (e: any) {
      showToast({ icon: "⚠️", title: "搜圖失敗", desc: e.message });
    } finally { setSearching(false); }
  };

  const handleAddManualUrl = () => {
    const u = manualUrl.trim();
    if (!u) return;
    if (!/^https?:\/\//.test(u)) {
      showToast({ icon: "⚠️", title: "請輸入完整 URL" });
      return;
    }
    setEditForm(f => ({ ...f, images: [...f.images, { url: u, source: "manual" as const }].slice(0, 10) }));
    setManualUrl("");
  };

  const handleUploadFile = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      showToast({ icon: "⚠️", title: "圖片太大（限 5MB）" });
      return;
    }
    const mimeType = (["image/jpeg", "image/png", "image/webp"].includes(file.type) ? file.type : "image/jpeg") as "image/jpeg" | "image/png" | "image/webp";
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      try {
        const r = await uploadImage.mutateAsync({ imageData: dataUrl, mimeType });
        setEditForm(f => ({ ...f, images: [...f.images, { url: r.url, source: "manual" as const }].slice(0, 10) }));
        showToast({ icon: "🖼️", title: "圖片已上載" });
      } catch (e: any) {
        showToast({ icon: "⚠️", title: "上載失敗", desc: e.message });
      }
    };
    reader.readAsDataURL(file);
  };

  const removeImage = (idx: number) => {
    setEditForm(f => ({ ...f, images: f.images.filter((_, i) => i !== idx) }));
  };

  const handlePublish = async (d: any) => {
    const ok = await confirm({
      title: "確認發布到藏家天地？",
      description: `將以「${authors.data?.find(a => a.id === (d.authorUserId ?? 0))?.label || "預設管理員"}」身份發布`,
      confirmText: "發布",
    });
    if (!ok) return;
    publishDraft.mutate({ id: d.id, authorUserId: d.authorUserId ?? null });
  };

  const handleDelete = async (d: any) => {
    const ok = await confirm({
      title: d.status === "published" ? "刪除草稿同已發布嘅帖？" : "刪除呢個草稿？",
      description: d.status === "published" ? "藏家天地嘅帖文都會一併刪除" : "唔可以還原",
      confirmText: "刪除",
    });
    if (!ok) return;
    deleteDraft.mutate({ id: d.id, alsoDeletePost: true });
  };

  const themesList = themes.data || [];
  const draftsList = drafts.data || [];
  const authorsList = useMemo(() => authors.data || [], [authors.data]);

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <AdminHeader />
      <div className="container mx-auto px-4 pt-20 max-w-5xl">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-6 h-6 text-violet-600" />
          <h1 className="text-2xl font-bold">藏品社區 AI 助手</h1>
        </div>
        <p className="text-gray-600 text-sm mb-6">揀題材，AI 即場生成 3 個草稿帖文，可編輯後發布到藏家天地，激活社區</p>

        <Card className="p-5 mb-6 bg-gradient-to-br from-violet-50 to-blue-50 border-violet-200">
          <h2 className="font-semibold mb-3 flex items-center gap-2"><Sparkles className="w-4 h-4 text-violet-600" /> 選題材生成</h2>
          <div className="flex flex-col sm:flex-row gap-3">
            <Select value={selectedTheme} onValueChange={setSelectedTheme}>
              <SelectTrigger className="bg-white"><SelectValue placeholder="揀一個題材" /></SelectTrigger>
              <SelectContent>
                {themesList.map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.label} — <span className="text-xs text-gray-500">{t.hint}</span></SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              disabled={!selectedTheme || generate.isPending}
              onClick={() => generate.mutate({ themeId: selectedTheme })}
              className="bg-violet-600 hover:bg-violet-700"
            >
              {generate.isPending ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> 生成中...</> : <><Sparkles className="w-4 h-4 mr-2" /> 生成 3 個草稿</>}
            </Button>
          </div>
          <p className="text-xs text-gray-500 mt-2">每次生成會用 AI + Wikimedia Commons 圖片庫，需時約 20-40 秒</p>
        </Card>

        <div className="flex gap-2 mb-4 items-center">
          <span className="text-sm text-gray-600">狀態：</span>
          {(["draft", "published", "archived", "all"] as const).map(s => (
            <Button
              key={s}
              size="sm"
              variant={statusFilter === s ? "default" : "outline"}
              onClick={() => setStatusFilter(s)}
            >
              {s === "draft" ? "草稿" : s === "published" ? "已發布" : s === "archived" ? "封存" : "全部"}
            </Button>
          ))}
        </div>

        {drafts.isLoading && <p className="text-gray-500">載入中...</p>}
        {!drafts.isLoading && draftsList.length === 0 && (
          <Card className="p-8 text-center text-gray-500">未有任何{statusFilter === "draft" ? "草稿" : ""}，去上面揀題材生成</Card>
        )}

        <div className="space-y-4">
          {draftsList.map((d: any) => {
            const isEditing = editingId === d.id;
            return (
              <Card key={d.id} className="p-5">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <Badge variant="outline" className="bg-violet-50 text-violet-700 border-violet-200">{d.themeLabel}</Badge>
                      <Badge variant={d.status === "published" ? "default" : "secondary"}>
                        {d.status === "draft" ? "草稿" : d.status === "published" ? "已發布" : "封存"}
                      </Badge>
                      {d.publishedPostId && (
                        <Link href={`/community/${d.publishedPostId}`}>
                          <button className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                            <ExternalLink className="w-3 h-3" /> 睇貼文
                          </button>
                        </Link>
                      )}
                    </div>
                    {!isEditing && <h3 className="font-semibold text-lg">{d.title}</h3>}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {!isEditing && d.status !== "published" && (
                      <Button size="sm" variant="outline" onClick={() => startEdit(d)}><Pencil className="w-3 h-3 mr-1" /> 編輯</Button>
                    )}
                    {!isEditing && d.status === "published" && (
                      <Button size="sm" variant="outline" onClick={() => startEdit(d)}><Pencil className="w-3 h-3 mr-1" /> 改</Button>
                    )}
                    {!isEditing && d.status === "draft" && (
                      <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => handlePublish(d)} disabled={publishDraft.isPending}>
                        <Send className="w-3 h-3 mr-1" /> 發布
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className="text-red-600 hover:bg-red-50" onClick={() => handleDelete(d)}><Trash2 className="w-3 h-3" /></Button>
                  </div>
                </div>

                {isEditing ? (
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-gray-600 mb-1 block">標題</label>
                      <Input value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} maxLength={250} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600 mb-1 block">內容</label>
                      <Textarea value={editForm.body} onChange={e => setEditForm(f => ({ ...f, body: e.target.value }))} rows={8} maxLength={5000} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600 mb-1 block">標籤（用逗號分隔）</label>
                      <Input value={editForm.tags} onChange={e => setEditForm(f => ({ ...f, tags: e.target.value }))} placeholder="香港殖民鈔, 伊利沙伯二世" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600 mb-1 block">作者身份</label>
                      <Select
                        value={editForm.authorUserId ? String(editForm.authorUserId) : "default"}
                        onValueChange={v => setEditForm(f => ({ ...f, authorUserId: v === "default" ? null : Number(v) }))}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="default">預設（大BB錢幣店管理員）</SelectItem>
                          {authorsList.map(a => (
                            <SelectItem key={a.id} value={String(a.id)}>{a.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-600 mb-1 block">圖片（{editForm.images.length}/10）</label>
                      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-2">
                        {editForm.images.map((img, i) => (
                          <div key={i} className="relative group aspect-square bg-gray-100 rounded overflow-hidden">
                            <img src={img.url} alt="" className="w-full h-full object-cover" />
                            <button
                              onClick={() => removeImage(i)}
                              className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition"
                            >
                              <X className="w-3 h-3" />
                            </button>
                            <span className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[10px] px-1 text-center">
                              {img.source === "commons" ? "Commons" : "手動"}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <div className="flex gap-1 flex-1">
                          <Input placeholder="搜 Wikimedia Commons (英文 keyword)" value={searchQ} onChange={e => setSearchQ(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSearchImages()} />
                          <Button size="sm" variant="outline" onClick={handleSearchImages} disabled={searching}>
                            {searching ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                          </Button>
                        </div>
                        <div className="flex gap-1 flex-1">
                          <Input placeholder="貼圖片 URL" value={manualUrl} onChange={e => setManualUrl(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAddManualUrl()} />
                          <Button size="sm" variant="outline" onClick={handleAddManualUrl}><Plus className="w-3 h-3" /></Button>
                        </div>
                      </div>
                      <div className="mt-2">
                        <label className="text-xs text-gray-500 block mb-1">或上載本機圖片：</label>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadFile(f); e.currentTarget.value = ""; }}
                          className="text-xs"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button variant="outline" onClick={() => setEditingId(null)}>取消</Button>
                      <Button onClick={() => handleSaveEdit(d.id)} disabled={updateDraft.isPending}>儲存</Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-gray-700 text-sm whitespace-pre-wrap line-clamp-6 mb-3">{d.body}</p>
                    {(d.images || []).length > 0 && (
                      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-3">
                        {(d.images || []).slice(0, 10).map((img: DraftImage, i: number) => (
                          <div key={i} className="aspect-square bg-gray-100 rounded overflow-hidden">
                            <img src={img.url} alt="" className="w-full h-full object-cover" />
                          </div>
                        ))}
                      </div>
                    )}
                    {(d.tags || []).length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {d.tags.map((t: string) => (
                          <Badge key={t} variant="outline" className="text-xs">#{t}</Badge>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
