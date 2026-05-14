import { useState, useMemo, useRef } from "react";
import { Link } from "wouter";
import AdminHeader from "@/components/AdminHeader";
import CommunityAdminTabs from "@/components/CommunityAdminTabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/contexts/ToastContext";
import { useConfirm } from "@/components/ui/confirm-provider";
import { trpc } from "@/lib/trpc";
import { Sparkles, Trash2, Send, Search, Plus, X, RefreshCw, Pencil, ExternalLink, Upload, Image as ImageIcon, Link2, Video } from "lucide-react";

type DraftImage = { url: string; source: "commons" | "manual" };

export default function AdminCommunitySeeder() {
  const { showToast } = useToast();
  const confirm = useConfirm();
  const utils = trpc.useUtils();

  const [selectedTheme, setSelectedTheme] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<"draft" | "published" | "archived" | "all">("draft");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<{
    title: string; body: string; tags: string; images: DraftImage[];
    authorUserId: number | null; themeId: string;
  }>({
    title: "", body: "", tags: "", images: [], authorUserId: null, themeId: "",
  });
  const [searchQ, setSearchQ] = useState("");
  const [manualUrl, setManualUrl] = useState("");
  const [searching, setSearching] = useState(false);
  const [importUrl, setImportUrl] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 題材管理
  const [showThemeMgr, setShowThemeMgr] = useState(false);
  const [editingThemeId, setEditingThemeId] = useState<string | null>(null);
  const [themeForm, setThemeForm] = useState<{ id: string; label: string; hint: string; sortOrder: string }>({
    id: "", label: "", hint: "", sortOrder: "100",
  });

  const themes = trpc.adminCommunitySeeder.listThemes.useQuery();
  const createTheme = trpc.adminCommunitySeeder.createTheme.useMutation({
    onSuccess: () => {
      showToast({ icon: "✅", title: "已新增題材" });
      setThemeForm({ id: "", label: "", hint: "", sortOrder: "100" });
      utils.adminCommunitySeeder.listThemes.invalidate();
    },
    onError: (e) => showToast({ icon: "⚠️", title: "新增失敗", desc: e.message }),
  });
  const updateTheme = trpc.adminCommunitySeeder.updateTheme.useMutation({
    onSuccess: () => {
      showToast({ icon: "✅", title: "已更新" });
      setEditingThemeId(null);
      utils.adminCommunitySeeder.listThemes.invalidate();
    },
    onError: (e) => showToast({ icon: "⚠️", title: "更新失敗", desc: e.message }),
  });
  const deleteTheme = trpc.adminCommunitySeeder.deleteTheme.useMutation({
    onSuccess: () => {
      showToast({ icon: "🗑️", title: "已刪除" });
      utils.adminCommunitySeeder.listThemes.invalidate();
    },
    onError: (e) => showToast({ icon: "⚠️", title: "刪除失敗", desc: e.message }),
  });
  const drafts = trpc.adminCommunitySeeder.listDrafts.useQuery({ status: statusFilter });
  const authors = trpc.adminCommunitySeeder.listEligibleAuthors.useQuery();

  const generate = trpc.adminCommunitySeeder.generateBatch.useMutation({
    onSuccess: (d) => {
      showToast({ icon: "✨", title: `已生成 ${d.count} 個草稿` });
      utils.adminCommunitySeeder.listDrafts.invalidate();
    },
    onError: (e) => showToast({ icon: "⚠️", title: "生成失敗", desc: e.message }),
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
    onSuccess: (r) => {
      showToast({ icon: "🚀", title: "已發布到藏品社區", desc: r.title ? `「${r.title.slice(0, 40)}」` : undefined });
      setStatusFilter("published");
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
  const testFetchUrl = trpc.adminCommunitySeeder.testFetchUrl.useMutation({
    onSuccess: (r: any) => {
      const fmt = (n: string, x: any) => {
        if (!x) return `${n}: -`;
        if (x.ok) return `${n}: ✅ ${x.title || x.titleHint || x.status || x.htmlLen || ""}`.trim();
        return `${n}: ❌ ${x.status ? "HTTP " + x.status : ""}${x.err ? " " + x.err : ""}`.trim();
      };
      const desc = [fmt("Jina", r.jina), fmt("Wayback", r.wayback), fmt("Direct", r.direct)].join("\n");
      showToast({ icon: "🔧", title: "Railway 抓取診斷", desc, durationMs: 12000 });
    },
    onError: (e) => showToast({ icon: "⚠️", title: "診斷 RPC 失敗", desc: e.message }),
  });
  const generateFromUrl = trpc.adminCommunitySeeder.generateFromUrl.useMutation({
    onSuccess: (r) => {
      const parts: string[] = [];
      if (r.title) parts.push(`「${r.title.slice(0, 30)}」`);
      parts.push(`${r.imageCount} 張圖`);
      if (r.videoCount > 0) parts.push(`${r.videoCount} 個視頻連結（已附入內文末尾）`);
      showToast({ icon: "🔗", title: "已從連結生成草稿", desc: parts.join("｜"), durationMs: 5000 });
      setImportUrl("");
      setStatusFilter("draft");
      utils.adminCommunitySeeder.listDrafts.invalidate();
      // 自動進入編輯模式：refetch 之後揾返新 draft
      setTimeout(() => {
        utils.adminCommunitySeeder.listDrafts.invalidate();
      }, 100);
    },
    onError: (e) => showToast({ icon: "⚠️", title: "抓取失敗", desc: e.message, durationMs: 5000 }),
  });

  const startEdit = (d: any) => {
    setEditingId(d.id);
    setEditForm({
      title: d.title,
      body: d.body,
      tags: (d.tags || []).join(", "),
      images: d.images || [],
      authorUserId: d.authorUserId ?? null,
      themeId: d.themeId || "",
    });
  };

  const handleSaveEdit = (id: number) => {
    const tags = editForm.tags.split(",").map(t => t.trim()).filter(Boolean).slice(0, 8);
    updateDraft.mutate({
      id, title: editForm.title, body: editForm.body, tags,
      images: editForm.images, authorUserId: editForm.authorUserId,
      themeId: editForm.themeId || undefined,
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
    const authorLabel = d.authorUserId
      ? (authors.data?.find(a => a.id === d.authorUserId)?.label || `User #${d.authorUserId}`)
      : "預設（大BB錢幣店）";
    const titlePreview = (d.title || "").slice(0, 60);
    const ok = await confirm({
      title: "確認發布呢個草稿？",
      description: `「${titlePreview}」\n作者：${authorLabel}`,
      confirmText: "發布",
    });
    if (!ok) return;
    publishDraft.mutate({ id: d.id, authorUserId: d.authorUserId ?? null });
  };

  const handleDelete = async (d: any) => {
    const ok = await confirm({
      title: d.status === "published" ? "刪除草稿同已發布嘅帖？" : "刪除呢個草稿？",
      description: d.status === "published" ? "藏品社區嘅帖文都會一併刪除" : "唔可以還原",
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
      <CommunityAdminTabs />
      <div className="container mx-auto px-4 pt-6 max-w-5xl">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-6 h-6 text-violet-600" />
          <h1 className="text-2xl font-bold">AI 帖文生成</h1>
        </div>
        <p className="text-gray-600 text-sm mb-6">揀題材 → AI 即場生成 3 個草稿 → 編輯後發布到藏品社區</p>

        <Card className="p-5 mb-6 bg-gradient-to-br from-violet-50 to-blue-50 border-violet-200">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold flex items-center gap-2"><Sparkles className="w-4 h-4 text-violet-600" /> 選題材生成</h2>
            <Button size="sm" variant="outline" onClick={() => setShowThemeMgr(v => !v)}>
              {showThemeMgr ? <><X className="w-3.5 h-3.5 mr-1" /> 收起管理</> : <><Pencil className="w-3.5 h-3.5 mr-1" /> 管理題材</>}
            </Button>
          </div>

          {showThemeMgr && (
            <div className="mb-4 p-3 bg-white rounded-lg border border-violet-200 space-y-3">
              <div className="text-xs text-gray-600 font-medium">已有題材（{themesList.length}）</div>
              <div className="space-y-2">
                {themesList.map(t => editingThemeId === t.id ? (
                  <div key={t.id} className="p-3 bg-violet-50 rounded border border-violet-300 space-y-2">
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <code className="bg-white px-1.5 py-0.5 rounded">{t.id}</code>
                      {t.isSystem && <Badge variant="outline" className="text-xs">系統</Badge>}
                    </div>
                    <Input value={themeForm.label} onChange={e => setThemeForm({ ...themeForm, label: e.target.value })} placeholder="名稱" className="bg-white" />
                    <Textarea value={themeForm.hint} onChange={e => setThemeForm({ ...themeForm, hint: e.target.value })} placeholder="提示（用作 AI prompt + 揀題材時嘅描述）" rows={2} className="bg-white" />
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-600">排序：</span>
                      <Input type="number" inputMode="numeric" value={themeForm.sortOrder} onChange={e => setThemeForm({ ...themeForm, sortOrder: e.target.value })} className="bg-white w-24" />
                      <div className="flex-1" />
                      <Button size="sm" variant="ghost" onClick={() => setEditingThemeId(null)}>取消</Button>
                      <Button size="sm" onClick={() => updateTheme.mutate({ id: t.id, label: themeForm.label, hint: themeForm.hint, sortOrder: parseInt(themeForm.sortOrder, 10) || 100 })} disabled={updateTheme.isPending}>儲存</Button>
                    </div>
                  </div>
                ) : (
                  <div key={t.id} className="flex items-start gap-2 p-2 bg-gray-50 rounded text-sm">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{t.label}</span>
                        <code className="text-xs text-gray-500 bg-white px-1 rounded">{t.id}</code>
                        {t.isSystem && <Badge variant="outline" className="text-xs">系統</Badge>}
                        <span className="text-xs text-gray-400 ml-auto">#{t.sortOrder}</span>
                      </div>
                      <div className="text-xs text-gray-600 mt-0.5 break-words">{t.hint}</div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button size="sm" variant="ghost" onClick={() => { setEditingThemeId(t.id); setThemeForm({ id: t.id, label: t.label, hint: t.hint, sortOrder: String(t.sortOrder) }); }}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      {!t.isSystem && (
                        <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700" onClick={async () => {
                          if (await confirm({ title: "刪除題材？", description: `「${t.label}」會即刻消失。如果有 draft 用緊呢個題材，會 block 刪除。`, confirmText: "刪除", tone: "danger" })) {
                            deleteTheme.mutate({ id: t.id });
                          }
                        }} disabled={deleteTheme.isPending}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t pt-3 mt-3 space-y-2">
                <div className="text-xs text-gray-600 font-medium">+ 新增題材</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Input value={themeForm.id} onChange={e => setThemeForm({ ...themeForm, id: e.target.value })} placeholder="ID（細楷英文/數字/dash，例：rare-stamps）" className="bg-white" />
                  <Input value={themeForm.label} onChange={e => setThemeForm({ ...themeForm, label: e.target.value })} placeholder="名稱（中文，例：稀有郵票）" className="bg-white" />
                </div>
                <Textarea value={themeForm.hint} onChange={e => setThemeForm({ ...themeForm, hint: e.target.value })} placeholder="提示（俾 AI 知道呢個題材包括啲咩）" rows={2} className="bg-white" />
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-600">排序：</span>
                  <Input type="number" inputMode="numeric" value={themeForm.sortOrder} onChange={e => setThemeForm({ ...themeForm, sortOrder: e.target.value })} className="bg-white w-24" />
                  <div className="flex-1" />
                  <Button size="sm" onClick={() => createTheme.mutate({ id: themeForm.id.trim(), label: themeForm.label.trim(), hint: themeForm.hint.trim(), sortOrder: parseInt(themeForm.sortOrder, 10) || 100 })} disabled={!themeForm.id.trim() || !themeForm.label.trim() || !themeForm.hint.trim() || createTheme.isPending}>
                    <Plus className="w-3.5 h-3.5 mr-1" /> 新增
                  </Button>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <Select value={selectedTheme} onValueChange={setSelectedTheme}>
              <SelectTrigger className="bg-white"><SelectValue placeholder="揀一個題材" /></SelectTrigger>
              <SelectContent>
                {themesList.map(t => (
                  <SelectItem key={t.id} value={t.id}>
                    <div className="flex flex-col items-start">
                      <span className="font-medium">{t.label}</span>
                      <span className="text-xs text-gray-500">{t.hint}</span>
                    </div>
                  </SelectItem>
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
          <p className="text-xs text-gray-500 mt-2">每次需時約 20-40 秒（AI 生成 + Wikimedia Commons 圖片庫）</p>
        </Card>

        <Card className="p-5 mb-6 bg-gradient-to-br from-sky-50 to-cyan-50 border-sky-200">
          <h2 className="font-semibold mb-1 flex items-center gap-2"><Link2 className="w-4 h-4 text-sky-600" /> 從連結抓取（網絡轉載）</h2>
          <p className="text-xs text-gray-600 mb-3">貼一條外部文章 URL，系統會自動抓取標題、內文、圖片同視頻連結，生成 1 個 draft 等你修改。</p>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              className="bg-white"
              placeholder="https://example.com/article"
              value={importUrl}
              onChange={e => setImportUrl(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && importUrl.trim() && !generateFromUrl.isPending) {
                  e.preventDefault();
                  generateFromUrl.mutate({ url: importUrl.trim() });
                }
              }}
              disabled={generateFromUrl.isPending}
            />
            <Button
              onClick={() => generateFromUrl.mutate({ url: importUrl.trim() })}
              disabled={!importUrl.trim() || generateFromUrl.isPending}
              className="bg-sky-600 hover:bg-sky-700"
            >
              {generateFromUrl.isPending
                ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> 抓取中...</>
                : <><Link2 className="w-4 h-4 mr-2" /> 從連結生成</>}
            </Button>
            <Button
              variant="outline"
              onClick={() => testFetchUrl.mutate({ url: importUrl.trim() })}
              disabled={!importUrl.trim() || testFetchUrl.isPending}
              title="淨係診斷 Railway 邊一路 fetch fail，唔會生成 draft"
            >
              {testFetchUrl.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : "🔧 診斷"}
            </Button>
          </div>
          <p className="text-xs text-gray-500 mt-2 flex items-start gap-1">
            <Video className="w-3.5 h-3.5 mt-0.5 shrink-0" /> 視頻（YouTube / Vimeo 等）會以連結形式附入內文，唔會自動 embed；圖片會 mirror 落 S3。
          </p>
        </Card>

        <div className="flex gap-2 mb-4 items-center flex-wrap">
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
              <Card key={d.id} className="overflow-hidden">
                {/* Header bar with status + theme + actions */}
                <div className="flex items-center justify-between gap-2 px-5 py-3 bg-gray-50 border-b flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <Badge variant={d.status === "published" ? "default" : "secondary"} className="shrink-0">
                      {d.status === "draft" ? "草稿" : d.status === "published" ? "已發布" : "封存"}
                    </Badge>
                    <Badge variant="outline" className="bg-violet-50 text-violet-700 border-violet-200 shrink-0">{d.themeLabel}</Badge>
                    {d.publishedPostId && (
                      <Link href={`/collection-square/${d.publishedPostId}`}>
                        <button className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                          <ExternalLink className="w-3 h-3" /> 睇貼文
                        </button>
                      </Link>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {!isEditing && (
                      <Button size="sm" variant="outline" onClick={() => startEdit(d)}>
                        <Pencil className="w-3 h-3 mr-1" /> 編輯
                      </Button>
                    )}
                    {!isEditing && d.status === "draft" && (
                      <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => handlePublish(d)} disabled={publishDraft.isPending}>
                        <Send className="w-3 h-3 mr-1" /> 發布
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className="text-red-600 hover:bg-red-50" onClick={() => handleDelete(d)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>

                <div className="p-5">
                  {/* Title row — own line, larger */}
                  {!isEditing && (
                    <h3 className="font-bold text-lg sm:text-xl leading-tight mb-3 break-words">{d.title}</h3>
                  )}

                  {isEditing ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-medium text-gray-700 mb-1 block">題材</label>
                          <Select value={editForm.themeId} onValueChange={v => setEditForm(f => ({ ...f, themeId: v }))}>
                            <SelectTrigger><SelectValue placeholder="揀題材" /></SelectTrigger>
                            <SelectContent>
                              {themesList.map(t => (
                                <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-700 mb-1 block">作者身份</label>
                          <Select
                            value={editForm.authorUserId ? String(editForm.authorUserId) : "default"}
                            onValueChange={v => setEditForm(f => ({ ...f, authorUserId: v === "default" ? null : Number(v) }))}
                          >
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="default">預設（大BB錢幣店）</SelectItem>
                              {authorsList.map(a => (
                                <SelectItem key={a.id} value={String(a.id)}>{a.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-medium text-gray-700 mb-1 block">標題</label>
                        <Input value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} maxLength={250} />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-700 mb-1 block">內容</label>
                        <Textarea value={editForm.body} onChange={e => setEditForm(f => ({ ...f, body: e.target.value }))} rows={8} maxLength={5000} />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-700 mb-1 block">標籤（用逗號分隔）</label>
                        <Input value={editForm.tags} onChange={e => setEditForm(f => ({ ...f, tags: e.target.value }))} placeholder="香港殖民鈔, 伊利沙伯二世" />
                      </div>

                      {/* Images section */}
                      <div className="border rounded-lg p-3 bg-gray-50">
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                            <ImageIcon className="w-3.5 h-3.5" /> 圖片 ({editForm.images.length}/10)
                          </label>
                        </div>

                        {editForm.images.length > 0 ? (
                          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-3">
                            {editForm.images.map((img, i) => (
                              <div key={i} className="relative group aspect-square bg-white rounded border overflow-hidden">
                                <img src={img.url} alt="" className="w-full h-full object-cover" />
                                <button
                                  type="button"
                                  onClick={() => removeImage(i)}
                                  className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 shadow opacity-90 hover:opacity-100 hover:scale-110 transition"
                                  title="移除呢張圖"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                                <span className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[10px] px-1 text-center">
                                  {img.source === "commons" ? "Commons" : "手動"}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-500 mb-3 text-center py-3 bg-white rounded border-dashed border">未有圖片，請從下面加入</p>
                        )}

                        <div className="space-y-2">
                          {/* Upload button — primary */}
                          <div className="flex flex-col sm:flex-row gap-2">
                            <input
                              ref={fileInputRef}
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              className="hidden"
                              onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadFile(f); e.currentTarget.value = ""; }}
                            />
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="bg-white flex-1"
                              onClick={() => fileInputRef.current?.click()}
                              disabled={uploadImage.isPending || editForm.images.length >= 10}
                            >
                              <Upload className="w-3.5 h-3.5 mr-1" />
                              {uploadImage.isPending ? "上載中..." : "上載本機圖片"}
                            </Button>
                          </div>
                          {/* Wikimedia search */}
                          <div className="flex gap-1">
                            <Input
                              className="bg-white text-sm"
                              placeholder="搜 Wikimedia Commons (英文 keyword)"
                              value={searchQ}
                              onChange={e => setSearchQ(e.target.value)}
                              onKeyDown={e => e.key === "Enter" && (e.preventDefault(), handleSearchImages())}
                              disabled={editForm.images.length >= 10}
                            />
                            <Button size="sm" variant="outline" className="bg-white" onClick={handleSearchImages} disabled={searching || editForm.images.length >= 10}>
                              {searching ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                            </Button>
                          </div>
                          {/* Manual URL */}
                          <div className="flex gap-1">
                            <Input
                              className="bg-white text-sm"
                              placeholder="貼圖片 URL"
                              value={manualUrl}
                              onChange={e => setManualUrl(e.target.value)}
                              onKeyDown={e => e.key === "Enter" && (e.preventDefault(), handleAddManualUrl())}
                              disabled={editForm.images.length >= 10}
                            />
                            <Button size="sm" variant="outline" className="bg-white" onClick={handleAddManualUrl} disabled={editForm.images.length >= 10}>
                              <Plus className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2 justify-end pt-2 border-t">
                        <Button variant="outline" onClick={() => setEditingId(null)}>取消</Button>
                        <Button onClick={() => handleSaveEdit(d.id)} disabled={updateDraft.isPending}>
                          {updateDraft.isPending ? "儲存中..." : "儲存"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-gray-700 text-sm whitespace-pre-wrap line-clamp-6 mb-3">{d.body}</p>
                      {(d.images || []).length > 0 && (
                        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-3">
                          {(d.images || []).slice(0, 10).map((img: DraftImage, i: number) => (
                            <div key={i} className="aspect-square bg-gray-100 rounded overflow-hidden border">
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
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
