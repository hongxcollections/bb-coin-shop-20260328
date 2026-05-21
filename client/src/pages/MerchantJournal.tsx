import { useState, useRef, useMemo, useEffect } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useConfirm } from "@/components/ui/confirm-provider";
import { toast } from "sonner";
import {
  ChevronLeft, Plus, Trash2, ImageIcon, X, Loader2, BookOpen,
  User, Filter, CalendarDays, Tag, Pencil, Check, Users,
  ChevronDown, ChevronUp,
} from "lucide-react";

const TAGS = ["交收", "送評", "入貨", "拍賣", "其他"];
const MAX_IMAGES = 10;

function toLocalDatetimeValue(d?: Date | string | null): string {
  const dt = d ? new Date(d) : new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}
function fmtEntryDate(d: Date | string | null | undefined) {
  if (!d) return "";
  return new Date(d).toLocaleString("zh-HK", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", weekday: "short",
  });
}
function fmtDateOnly(d: Date | string | null | undefined) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("zh-HK", { year: "numeric", month: "2-digit", day: "2-digit" });
}

// ─── Contact Book Card ──────────────────────────────────────────────────────
function ContactBook() {
  const { confirm: confirmDialog } = useConfirm();
  const utils = trpc.useUtils();

  const { data: contacts = [] } = trpc.merchantJournal.listContacts.useQuery();
  const addContact = trpc.merchantJournal.addContact.useMutation({
    onSuccess: () => { utils.merchantJournal.listContacts.invalidate(); setNewName(""); },
    onError: (e) => toast.error(e.message ?? "新增失敗"),
  });
  const renameContact = trpc.merchantJournal.renameContact.useMutation({
    onSuccess: (data) => {
      utils.merchantJournal.listContacts.invalidate();
      utils.merchantJournal.list.invalidate();
      toast.success(`已更新，影響 ${data.affected} 條日誌`);
      setEditingName(null);
    },
    onError: (e) => toast.error(e.message ?? "修改失敗"),
  });
  const deleteContact = trpc.merchantJournal.deleteContact.useMutation({
    onSuccess: (data) => {
      utils.merchantJournal.listContacts.invalidate();
      utils.merchantJournal.list.invalidate();
      toast.success(`已刪除，影響 ${data.affected} 條日誌`);
    },
    onError: (e) => toast.error(e.message ?? "刪除失敗"),
  });

  const [newName, setNewName] = useState("");
  const [editingName, setEditingName] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [open, setOpen] = useState(true);
  const editInputRef = useRef<HTMLInputElement>(null);

  const handleAdd = () => {
    const name = newName.trim();
    if (!name) return;
    addContact.mutate({ name });
  };

  const startEdit = (name: string) => {
    setEditingName(name);
    setEditValue(name);
    setTimeout(() => editInputRef.current?.focus(), 50);
  };

  const commitRename = () => {
    if (!editingName) return;
    const nw = editValue.trim();
    if (!nw) { setEditingName(null); return; }
    renameContact.mutate({ oldName: editingName, newName: nw });
  };

  const handleDelete = async (name: string) => {
    const ok = await confirmDialog({
      title: `刪除「${name}」？`,
      description: "所有日誌中的此人物將一併移除，不能復原。",
      tone: "danger",
    });
    if (!ok) return;
    deleteContact.mutate({ name });
  };

  return (
    <div className="rounded-2xl border bg-card mb-4 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors"
      >
        <span className="flex items-center gap-2 text-sm font-semibold">
          <Users className="w-4 h-4 text-indigo-500" />
          聯絡人名冊
          {contacts.length > 0 && (
            <span className="text-[10px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full font-medium">
              {contacts.length}
            </span>
          )}
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* Contact chips */}
          {contacts.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">尚未新增任何聯絡人</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {(contacts as { id: number; name: string }[]).map(c => (
                <div key={c.id} className="flex items-center gap-0">
                  {editingName === c.name ? (
                    <div className="flex items-center gap-1 bg-amber-50 border border-amber-300 rounded-full px-2 py-0.5">
                      <input
                        ref={editInputRef}
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") setEditingName(null); }}
                        className="text-xs bg-transparent outline-none w-24 text-amber-800"
                        maxLength={100}
                      />
                      <button
                        onClick={commitRename}
                        disabled={renameContact.isPending}
                        className="text-amber-600 hover:text-amber-800"
                      >
                        {renameContact.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                      </button>
                      <button onClick={() => setEditingName(null)} className="text-gray-400 hover:text-gray-600">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <span className="inline-flex items-center gap-1 bg-indigo-100 text-indigo-700 pl-2.5 pr-1 py-0.5 rounded-full text-xs font-medium">
                      {c.name}
                      <button
                        onClick={() => startEdit(c.name)}
                        className="hover:text-amber-600 transition-colors p-0.5 rounded-full"
                        title="修改名稱"
                      >
                        <Pencil className="w-2.5 h-2.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(c.name)}
                        className="hover:text-red-500 transition-colors p-0.5 rounded-full"
                        title="拆除此聯絡人"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Add new contact */}
          <div className="flex items-center gap-2">
            <Input
              placeholder="新增聯絡人⋯"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleAdd(); }}
              maxLength={100}
              className="h-8 text-xs flex-1"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={handleAdd}
              disabled={!newName.trim() || addContact.isPending}
              className="h-8 text-xs px-3"
            >
              {addContact.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground -mt-1">
            修改或拆除聯絡人後，所有相關日誌內容會自動同步
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────
export default function MerchantJournal() {
  const { confirm: confirmDialog } = useConfirm();
  const utils = trpc.useUtils();

  const { data: enabledData, isLoading: enabledLoading } = trpc.merchantJournal.isEnabled.useQuery();
  const { data: bookContacts = [] } = trpc.merchantJournal.listContacts.useQuery(undefined, {
    enabled: enabledData?.enabled === true,
  });
  const { data: rawEntries = [], isLoading: listLoading } = trpc.merchantJournal.list.useQuery(undefined, {
    enabled: enabledData?.enabled === true,
  });

  const contactList = bookContacts as { id: number; name: string }[];
  const entries = rawEntries as any[];

  // ── Form state ──
  const [content, setContent] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [entryAt, setEntryAt] = useState<string>(toLocalDatetimeValue());
  const [entryContacts, setEntryContacts] = useState<string[]>([]);
  const [imageFiles, setImageFiles] = useState<{ file: File; preview: string }[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── # mention state ──
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIdx, setMentionIdx] = useState(0);

  const mentionSuggestions = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    return contactList.filter(c => c.name.toLowerCase().includes(q)).slice(0, 8);
  }, [mentionQuery, contactList]);

  // ── Filter state ──
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterTag, setFilterTag] = useState("");
  const [filterContacts, setFilterContacts] = useState<string[]>([]);
  const [filterContactSearch, setFilterContactSearch] = useState("");
  const [showFilter, setShowFilter] = useState(false);

  // ── Client-side filtering ──
  const filtered = useMemo(() => {
    return entries.filter(e => {
      const dt = new Date(e.entryAt ?? e.createdAt);
      if (filterDateFrom && dt < new Date(filterDateFrom)) return false;
      if (filterDateTo) {
        const to = new Date(filterDateTo);
        to.setDate(to.getDate() + 1);
        if (dt >= to) return false;
      }
      if (filterTag && !(e.tags ?? []).includes(filterTag)) return false;
      if (filterContacts.length > 0) {
        const entryC: string[] = e.contacts ?? [];
        if (!filterContacts.some(fc => entryC.includes(fc))) return false;
      }
      return true;
    });
  }, [entries, filterDateFrom, filterDateTo, filterTag, filterContacts]);

  const hasFilter = filterDateFrom || filterDateTo || filterTag || filterContacts.length > 0;

  const visibleFilterContacts = useMemo(() => {
    const q = filterContactSearch.toLowerCase();
    return contactList.filter(c => !q || c.name.toLowerCase().includes(q));
  }, [contactList, filterContactSearch]);

  // ── Mutations ──
  const uploadImage = trpc.merchantJournal.uploadImage.useMutation();
  const createEntry = trpc.merchantJournal.create.useMutation({
    onSuccess: () => {
      utils.merchantJournal.list.invalidate();
      setContent(""); setSelectedTags([]); setEntryContacts([]);
      setImageFiles([]); setEntryAt(toLocalDatetimeValue());
      toast.success("日誌已記錄");
    },
  });
  const deleteEntry = trpc.merchantJournal.delete.useMutation({
    onSuccess: () => { utils.merchantJournal.list.invalidate(); toast.success("已刪除"); },
  });

  // ── Helpers ──
  const toggleTag = (tag: string) =>
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);

  const toggleEntryContact = (name: string) =>
    setEntryContacts(prev => prev.includes(name) ? prev.filter(x => x !== name) : [...prev, name]);

  // ── # mention ──
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setContent(val);
    const pos = e.target.selectionStart ?? val.length;
    const before = val.slice(0, pos);
    const match = before.match(/#([^#\s,]*)$/);
    if (match) { setMentionQuery(match[1]); setMentionIdx(0); }
    else setMentionQuery(null);
  };

  const insertMention = (name: string) => {
    const ta = textareaRef.current;
    const pos = ta?.selectionStart ?? content.length;
    const before = content.slice(0, pos);
    const after = content.slice(pos);
    const newBefore = before.replace(/#([^#\s,]*)$/, `#${name} `);
    setContent(newBefore + after);
    setMentionQuery(null);
    requestAnimationFrame(() => {
      ta?.focus();
      ta?.setSelectionRange(newBefore.length, newBefore.length);
    });
  };

  const handleContentKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionQuery === null || mentionSuggestions.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setMentionIdx(i => (i + 1) % mentionSuggestions.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setMentionIdx(i => (i - 1 + mentionSuggestions.length) % mentionSuggestions.length); }
    else if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); insertMention(mentionSuggestions[mentionIdx].name); }
    else if (e.key === "Escape") { e.preventDefault(); setMentionQuery(null); }
  };

  useEffect(() => {
    const handle = () => setMentionQuery(null);
    if (mentionQuery !== null) {
      document.addEventListener("click", handle, { once: true });
      return () => document.removeEventListener("click", handle);
    }
  }, [mentionQuery]);

  // ── Images ──
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const toAdd = files.slice(0, MAX_IMAGES - imageFiles.length);
    setImageFiles(prev => [...prev, ...toAdd.map(f => ({ file: f, preview: URL.createObjectURL(f) }))]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };
  const removeImage = (idx: number) =>
    setImageFiles(prev => { URL.revokeObjectURL(prev[idx].preview); return prev.filter((_, i) => i !== idx); });

  // ── Submit ──
  const handleSubmit = async () => {
    if (!content.trim()) { toast.error("請輸入日誌內容"); return; }
    setIsSubmitting(true);
    try {
      const urls: string[] = [];
      for (const { file } of imageFiles) {
        const base64 = await new Promise<string>((res, rej) => {
          const r = new FileReader();
          r.onload = () => res((r.result as string).split(",")[1]);
          r.onerror = rej;
          r.readAsDataURL(file);
        });
        const result = await uploadImage.mutateAsync({ imageData: base64, fileName: file.name, mimeType: file.type || "image/jpeg" });
        urls.push(result.url);
      }
      await createEntry.mutateAsync({
        content: content.trim(),
        tags: selectedTags,
        imageUrls: urls,
        entryAt: entryAt || undefined,
        contacts: entryContacts,
      });
    } catch (err: any) {
      toast.error(err?.message ?? "記錄失敗");
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleFilterContact = (name: string) =>
    setFilterContacts(prev => prev.includes(name) ? prev.filter(x => x !== name) : [...prev, name]);

  // ── Loading / disabled ──
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
          <span className="ml-auto text-xs text-muted-foreground">{entries.length} 條記錄</span>
        </div>

        {/* ── Global Contact Book ── */}
        <ContactBook />

        {/* ── Write form ── */}
        <div className="rounded-2xl border bg-card p-4 mb-4 space-y-3">

          {/* Date/time picker */}
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-amber-500 shrink-0" />
            <input
              type="datetime-local"
              value={entryAt}
              onChange={e => setEntryAt(e.target.value)}
              className="flex-1 text-xs rounded-lg border border-input bg-background px-2.5 py-1.5 text-foreground focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>

          {/* Content + # mention */}
          <div className="relative">
            <Textarea
              ref={textareaRef}
              placeholder="記下今日發生咗什麼⋯（最多 500 字）輸入 # 可快速提及聯絡人"
              value={content}
              onChange={handleContentChange}
              onKeyDown={handleContentKeyDown}
              maxLength={500}
              rows={6}
              className="resize-none text-sm"
            />
            {mentionQuery !== null && mentionSuggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 z-20 rounded-xl border bg-popover shadow-lg overflow-hidden">
                {mentionSuggestions.map((c, i) => (
                  <button
                    key={c.id}
                    onMouseDown={e => { e.preventDefault(); insertMention(c.name); }}
                    className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 transition-colors ${
                      i === mentionIdx ? "bg-amber-50 text-amber-700" : "hover:bg-muted"
                    }`}
                  >
                    <User className="w-3 h-3 opacity-50" /> {c.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="text-[11px] text-muted-foreground text-right -mt-1">{content.length}/500</div>

          {/* Category tags */}
          <div>
            <p className="text-[11px] text-muted-foreground mb-1.5 flex items-center gap-1"><Tag className="w-3 h-3" />類別</p>
            <div className="flex flex-wrap gap-1.5">
              {TAGS.map(tag => (
                <button key={tag} onClick={() => toggleTag(tag)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                    selectedTags.includes(tag)
                      ? "bg-amber-500 text-white border-amber-500"
                      : "bg-muted text-muted-foreground border-transparent hover:border-amber-300"
                  }`}
                >{tag}</button>
              ))}
            </div>
          </div>

          {/* Select contacts from book */}
          {contactList.length > 0 && (
            <div>
              <p className="text-[11px] text-muted-foreground mb-1.5 flex items-center gap-1">
                <User className="w-3 h-3" />相關人物（點選加入此日誌）
              </p>
              <div className="flex flex-wrap gap-1.5">
                {contactList.map(c => (
                  <button key={c.id} onClick={() => toggleEntryContact(c.name)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                      entryContacts.includes(c.name)
                        ? "bg-indigo-500 text-white border-indigo-500"
                        : "bg-indigo-50 text-indigo-700 border-transparent hover:border-indigo-300"
                    }`}
                  >{c.name}</button>
                ))}
              </div>
              {entryContacts.length > 0 && (
                <p className="text-[10px] text-indigo-500 mt-1">
                  已選：{entryContacts.join("、")}
                </p>
              )}
            </div>
          )}

          {/* Image previews */}
          {imageFiles.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {imageFiles.map((f, i) => (
                <div key={i} className="relative w-9 h-9">
                  <img src={f.preview} alt="" className="w-9 h-9 object-cover rounded-lg border" />
                  <button onClick={() => removeImage(i)}
                    className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
                  ><X className="w-2.5 h-2.5" /></button>
                </div>
              ))}
            </div>
          )}

          {/* Bottom row */}
          <div className="flex items-center justify-between">
            {imageFiles.length < MAX_IMAGES ? (
              <button onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-amber-600 transition-colors"
              >
                <ImageIcon className="w-3.5 h-3.5" />加圖片（{imageFiles.length}/{MAX_IMAGES}）
              </button>
            ) : (
              <span className="text-xs text-muted-foreground">{MAX_IMAGES} 張已達上限</span>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileSelect} />
            <Button size="sm" onClick={handleSubmit}
              disabled={isSubmitting || !content.trim()}
              className="gold-gradient text-white font-bold text-xs px-4"
            >
              {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Plus className="w-3.5 h-3.5 mr-1" />記錄</>}
            </Button>
          </div>
        </div>

        {/* ── Filter bar ── */}
        <div className="mb-4">
          <button
            onClick={() => setShowFilter(f => !f)}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors ${
              hasFilter ? "bg-amber-50 border-amber-300 text-amber-700 font-semibold" : "border-gray-200 text-muted-foreground hover:border-amber-300"
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            {hasFilter ? `篩選中${filterContacts.length > 1 ? `（${filterContacts.length} 人）` : ""}` : "篩選"}
            {hasFilter && (
              <button onClick={e => {
                e.stopPropagation();
                setFilterDateFrom(""); setFilterDateTo(""); setFilterTag(""); setFilterContacts([]); setFilterContactSearch("");
              }} className="ml-1 hover:text-red-500"><X className="w-3 h-3" /></button>
            )}
          </button>

          {showFilter && (
            <div className="mt-2 rounded-2xl border bg-card p-3 space-y-3">
              <div>
                <p className="text-[11px] text-muted-foreground mb-1.5 flex items-center gap-1"><CalendarDays className="w-3 h-3" />日期範圍</p>
                <div className="flex items-center gap-2">
                  <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)}
                    className="flex-1 text-xs rounded-lg border border-input bg-background px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-400" />
                  <span className="text-xs text-muted-foreground">至</span>
                  <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)}
                    className="flex-1 text-xs rounded-lg border border-input bg-background px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-400" />
                </div>
              </div>

              <div>
                <p className="text-[11px] text-muted-foreground mb-1.5 flex items-center gap-1"><Tag className="w-3 h-3" />類別篩選</p>
                <div className="flex flex-wrap gap-1.5">
                  {["", ...TAGS].map(tag => (
                    <button key={tag || "all"} onClick={() => setFilterTag(tag)}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                        filterTag === tag ? "bg-amber-500 text-white border-amber-500" : "bg-muted text-muted-foreground border-transparent hover:border-amber-300"
                      }`}
                    >{tag || "全部"}</button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[11px] text-muted-foreground mb-1.5 flex items-center gap-1">
                  <User className="w-3 h-3" />人物篩選
                  <span className="text-gray-400">（可多選，符合其中一人即顯示）</span>
                </p>
                {filterContacts.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {filterContacts.map(c => (
                      <span key={c} className="inline-flex items-center gap-1 bg-indigo-500 text-white px-2 py-0.5 rounded-full text-[10px] font-medium">
                        {c}<button onClick={() => toggleFilterContact(c)} className="hover:opacity-70"><X className="w-2 h-2" /></button>
                      </span>
                    ))}
                  </div>
                )}
                <Input type="text" placeholder="搜尋聯絡人⋯" value={filterContactSearch}
                  onChange={e => setFilterContactSearch(e.target.value)} className="h-8 text-xs mb-2" />
                {visibleFilterContacts.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {visibleFilterContacts.map(c => (
                      <button key={c.id} onClick={() => toggleFilterContact(c.name)}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                          filterContacts.includes(c.name)
                            ? "bg-indigo-500 text-white border-indigo-500"
                            : "bg-indigo-50 text-indigo-700 border-transparent hover:border-indigo-300"
                        }`}
                      >{c.name}</button>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground">
                    {contactList.length === 0 ? "聯絡人名冊為空，先在上方新增聯絡人" : "找不到匹配的聯絡人"}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {hasFilter && (
          <p className="text-xs text-muted-foreground mb-3">篩選結果：{filtered.length} / {entries.length} 條</p>
        )}

        {/* ── Journal list ── */}
        {listLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-amber-400" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-10 text-xs text-muted-foreground">
            <BookOpen className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            {hasFilter ? "無符合條件的記錄" : "尚未有日誌記錄，開始記下今日嘅事吧"}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((entry: any) => (
              <div key={entry.id} className="rounded-2xl border bg-card p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
                    <span className="text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                      {fmtEntryDate(entry.entryAt)}
                    </span>
                    {(entry.tags ?? []).map((tag: string) => (
                      <span key={tag} className="px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-medium">{tag}</span>
                    ))}
                  </div>
                  <button
                    onClick={async () => {
                      const ok = await confirmDialog({ title: "確認刪除？", description: "刪除後不能復原。", tone: "danger" });
                      if (!ok) return;
                      deleteEntry.mutate({ id: entry.id });
                    }}
                    className="shrink-0 text-gray-300 hover:text-red-400 transition-colors mt-0.5"
                  ><Trash2 className="w-3.5 h-3.5" /></button>
                </div>

                <p className="text-sm leading-relaxed whitespace-pre-wrap">{entry.content}</p>

                {(entry.contacts ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {(entry.contacts as string[]).map(c => (
                      <button key={c}
                        onClick={() => { if (!filterContacts.includes(c)) setFilterContacts(prev => [...prev, c]); setShowFilter(true); }}
                        className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full text-[10px] font-medium hover:bg-indigo-100 transition-colors"
                        title="點擊篩選此人物"
                      >
                        <User className="w-2.5 h-2.5" />{c}
                      </button>
                    ))}
                  </div>
                )}

                {(entry.images ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {(entry.images as string[]).map((url: string, i: number) => (
                      <button key={i} onClick={() => setExpandedImage(url)}
                        className="w-9 h-9 rounded-lg overflow-hidden border hover:opacity-80 transition-opacity"
                      >
                        <img src={url} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}

                {entry.entryAt && new Date(entry.entryAt).getTime() !== new Date(entry.createdAt).getTime() && (
                  <p className="text-[10px] text-gray-300">記錄於 {fmtDateOnly(entry.createdAt)}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {expandedImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setExpandedImage(null)}>
          <div className="relative max-w-[80vw] max-h-[70vh]" onClick={e => e.stopPropagation()}>
            <img src={expandedImage} alt="" className="rounded-xl object-contain max-w-[80vw] max-h-[70vh] shadow-2xl" />
            <button onClick={() => setExpandedImage(null)}
              className="absolute -top-3 -right-3 w-7 h-7 bg-white rounded-full flex items-center justify-center shadow-md text-gray-600 hover:text-red-500 transition-colors"
            ><X className="w-4 h-4" /></button>
          </div>
        </div>
      )}
    </div>
  );
}
