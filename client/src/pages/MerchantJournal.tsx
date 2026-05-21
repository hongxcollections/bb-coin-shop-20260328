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
  User, Filter, CalendarDays, Tag,
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
  const dt = new Date(d);
  return dt.toLocaleString("zh-HK", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", weekday: "short",
  });
}

function fmtDateOnly(d: Date | string | null | undefined) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("zh-HK", { year: "numeric", month: "2-digit", day: "2-digit" });
}

export default function MerchantJournal() {
  const { confirm: confirmDialog } = useConfirm();
  const utils = trpc.useUtils();

  const { data: enabledData, isLoading: enabledLoading } = trpc.merchantJournal.isEnabled.useQuery();
  const { data: rawEntries = [], isLoading: listLoading } = trpc.merchantJournal.list.useQuery(undefined, {
    enabled: enabledData?.enabled === true,
  });

  // ── Form state ──
  const [content, setContent] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [entryAt, setEntryAt] = useState<string>(toLocalDatetimeValue());
  const [contacts, setContacts] = useState<string[]>([]);
  const [contactInput, setContactInput] = useState("");
  const [editingChipIdx, setEditingChipIdx] = useState<number | null>(null);
  const [imageFiles, setImageFiles] = useState<{ file: File; preview: string }[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const contactInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── # mention state ──
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIdx, setMentionIdx] = useState(0);

  // ── Filter state ──
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterTag, setFilterTag] = useState("");
  const [filterContacts, setFilterContacts] = useState<string[]>([]);
  const [filterContactSearch, setFilterContactSearch] = useState("");
  const [showFilter, setShowFilter] = useState(false);

  const entries = rawEntries as any[];

  // ── Derived: all contacts across saved entries ──
  const allContacts = useMemo(() => {
    const set = new Set<string>();
    entries.forEach(e => (e.contacts ?? []).forEach((c: string) => set.add(c)));
    contacts.forEach(c => set.add(c));
    return Array.from(set).sort();
  }, [entries, contacts]);

  // ── # mention suggestions ──
  const mentionSuggestions = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    return allContacts.filter(c => c.toLowerCase().includes(q)).slice(0, 8);
  }, [mentionQuery, allContacts]);

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
        const hasAny = filterContacts.some(fc => entryC.includes(fc));
        if (!hasAny) return false;
      }
      return true;
    });
  }, [entries, filterDateFrom, filterDateTo, filterTag, filterContacts]);

  const hasFilter = filterDateFrom || filterDateTo || filterTag || filterContacts.length > 0;

  // ── Visible contact chips in filter (after text search) ──
  const visibleFilterContacts = useMemo(() => {
    const q = filterContactSearch.toLowerCase();
    return allContacts.filter(c => !q || c.toLowerCase().includes(q));
  }, [allContacts, filterContactSearch]);

  // ── Mutations ──
  const uploadImage = trpc.merchantJournal.uploadImage.useMutation();
  const createEntry = trpc.merchantJournal.create.useMutation({
    onSuccess: () => {
      utils.merchantJournal.list.invalidate();
      setContent("");
      setSelectedTags([]);
      setContacts([]);
      setContactInput("");
      setEditingChipIdx(null);
      setImageFiles([]);
      setEntryAt(toLocalDatetimeValue());
      toast.success("日誌已記錄");
    },
  });
  const deleteEntry = trpc.merchantJournal.delete.useMutation({
    onSuccess: () => { utils.merchantJournal.list.invalidate(); toast.success("已刪除"); },
  });

  // ── Helpers: tags ──
  const toggleTag = (tag: string) =>
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);

  // ── Helpers: contacts chip ──
  const commitContact = (raw: string = contactInput) => {
    const name = raw.trim();
    if (!name) { setContactInput(""); return; }
    if (editingChipIdx !== null) {
      setContacts(prev => prev.map((c, i) => i === editingChipIdx ? name : c));
      setEditingChipIdx(null);
    } else {
      if (!contacts.includes(name)) setContacts(prev => [...prev, name]);
    }
    setContactInput("");
    contactInputRef.current?.focus();
  };

  const editChip = (idx: number) => {
    setContactInput(contacts[idx]);
    setEditingChipIdx(idx);
    contactInputRef.current?.focus();
  };

  const removeChip = (idx: number) => {
    setContacts(prev => prev.filter((_, i) => i !== idx));
    if (editingChipIdx === idx) { setContactInput(""); setEditingChipIdx(null); }
  };

  const handleContactKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); commitContact(); }
    if (e.key === "Backspace" && !contactInput && contacts.length > 0 && editingChipIdx === null)
      editChip(contacts.length - 1);
    if (e.key === "Escape") { setContactInput(""); setEditingChipIdx(null); }
  };

  // ── Helpers: # mention ──
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setContent(val);
    const pos = e.target.selectionStart ?? val.length;
    const before = val.slice(0, pos);
    const match = before.match(/#([^#\s,]*)$/);
    if (match) {
      setMentionQuery(match[1]);
      setMentionIdx(0);
    } else {
      setMentionQuery(null);
    }
  };

  const insertMention = (name: string) => {
    const ta = textareaRef.current;
    const pos = ta?.selectionStart ?? content.length;
    const before = content.slice(0, pos);
    const after = content.slice(pos);
    const newBefore = before.replace(/#([^#\s,]*)$/, `#${name} `);
    const newContent = newBefore + after;
    setContent(newContent);
    setMentionQuery(null);
    requestAnimationFrame(() => {
      ta?.focus();
      ta?.setSelectionRange(newBefore.length, newBefore.length);
    });
  };

  const handleContentKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionQuery === null || mentionSuggestions.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setMentionIdx(i => (i + 1) % mentionSuggestions.length); }
    if (e.key === "ArrowUp") { e.preventDefault(); setMentionIdx(i => (i - 1 + mentionSuggestions.length) % mentionSuggestions.length); }
    if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); insertMention(mentionSuggestions[mentionIdx]); }
    if (e.key === "Escape") { e.preventDefault(); setMentionQuery(null); }
  };

  // Close mention on outside click
  useEffect(() => {
    const handle = () => setMentionQuery(null);
    if (mentionQuery !== null) {
      document.addEventListener("click", handle, { once: true });
      return () => document.removeEventListener("click", handle);
    }
  }, [mentionQuery]);

  // ── Helpers: images ──
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const toAdd = files.slice(0, MAX_IMAGES - imageFiles.length);
    setImageFiles(prev => [...prev, ...toAdd.map(f => ({ file: f, preview: URL.createObjectURL(f) }))]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeImage = (idx: number) => {
    setImageFiles(prev => { URL.revokeObjectURL(prev[idx].preview); return prev.filter((_, i) => i !== idx); });
  };

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
        contacts,
      });
    } catch (err: any) {
      toast.error(err?.message ?? "記錄失敗");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Toggle filter contact ──
  const toggleFilterContact = (c: string) =>
    setFilterContacts(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);

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
              placeholder="記下今日發生咗什麼⋯（最多 500 字）輸入 # 可標記人物"
              value={content}
              onChange={handleContentChange}
              onKeyDown={handleContentKeyDown}
              maxLength={500}
              rows={3}
              className="resize-none text-sm"
            />
            {mentionQuery !== null && mentionSuggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 z-20 rounded-xl border bg-popover shadow-lg overflow-hidden">
                {mentionSuggestions.map((c, i) => (
                  <button
                    key={c}
                    onMouseDown={e => { e.preventDefault(); insertMention(c); }}
                    className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 transition-colors ${
                      i === mentionIdx ? "bg-amber-50 text-amber-700" : "hover:bg-muted"
                    }`}
                  >
                    <User className="w-3 h-3 opacity-50" /> {c}
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
          </div>

          {/* Contacts chip input */}
          <div>
            <p className="text-[11px] text-muted-foreground mb-1.5 flex items-center gap-1">
              <User className="w-3 h-3" />相關人物
              <span className="text-gray-400">（Enter 加入 · 點擊 chip 修改 · Backspace 修改上一個）</span>
            </p>
            <div className="flex flex-wrap items-center gap-1.5 min-h-[36px] rounded-lg border border-input bg-background px-2.5 py-1.5 focus-within:ring-2 focus-within:ring-amber-400">
              {contacts.map((c, idx) => (
                <span
                  key={idx}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer transition-colors ${
                    editingChipIdx === idx
                      ? "bg-amber-100 text-amber-700 ring-1 ring-amber-400"
                      : "bg-indigo-100 text-indigo-700 hover:bg-indigo-200"
                  }`}
                >
                  <button
                    onClick={() => editChip(idx)}
                    className="hover:underline"
                    title="點擊修改"
                  >
                    {c}
                  </button>
                  <button
                    onClick={() => removeChip(idx)}
                    className="hover:text-red-500 ml-0.5"
                    title="移除"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              ))}
              <input
                ref={contactInputRef}
                type="text"
                value={contactInput}
                onChange={e => setContactInput(e.target.value)}
                onKeyDown={handleContactKeyDown}
                onBlur={() => { if (contactInput.trim()) commitContact(); }}
                placeholder={contacts.length === 0 ? "輸入人名⋯" : ""}
                className="flex-1 min-w-[80px] text-xs bg-transparent outline-none placeholder:text-muted-foreground"
              />
            </div>
            {editingChipIdx !== null && (
              <p className="text-[10px] text-amber-600 mt-1">正在修改「{contacts[editingChipIdx]}」→ 輸入新名稱後按 Enter 確認，Esc 取消</p>
            )}
          </div>

          {/* Image previews */}
          {imageFiles.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {imageFiles.map((f, i) => (
                <div key={i} className="relative w-9 h-9">
                  <img src={f.preview} alt="" className="w-9 h-9 object-cover rounded-lg border" />
                  <button
                    onClick={() => removeImage(i)}
                    className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Bottom row */}
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
            <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileSelect} />
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
              <button
                onClick={e => {
                  e.stopPropagation();
                  setFilterDateFrom(""); setFilterDateTo("");
                  setFilterTag(""); setFilterContacts([]);
                  setFilterContactSearch("");
                }}
                className="ml-1 hover:text-red-500"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </button>

          {showFilter && (
            <div className="mt-2 rounded-2xl border bg-card p-3 space-y-3">
              {/* Date range */}
              <div>
                <p className="text-[11px] text-muted-foreground mb-1.5 flex items-center gap-1"><CalendarDays className="w-3 h-3" />日期範圍</p>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={filterDateFrom}
                    onChange={e => setFilterDateFrom(e.target.value)}
                    className="flex-1 text-xs rounded-lg border border-input bg-background px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-400"
                  />
                  <span className="text-xs text-muted-foreground">至</span>
                  <input
                    type="date"
                    value={filterDateTo}
                    onChange={e => setFilterDateTo(e.target.value)}
                    className="flex-1 text-xs rounded-lg border border-input bg-background px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-400"
                  />
                </div>
              </div>

              {/* Category filter */}
              <div>
                <p className="text-[11px] text-muted-foreground mb-1.5 flex items-center gap-1"><Tag className="w-3 h-3" />類別篩選</p>
                <div className="flex flex-wrap gap-1.5">
                  {["", ...TAGS].map(tag => (
                    <button
                      key={tag || "all"}
                      onClick={() => setFilterTag(tag)}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                        filterTag === tag
                          ? "bg-amber-500 text-white border-amber-500"
                          : "bg-muted text-muted-foreground border-transparent hover:border-amber-300"
                      }`}
                    >
                      {tag || "全部"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Contact multi-select filter */}
              <div>
                <p className="text-[11px] text-muted-foreground mb-1.5 flex items-center gap-1">
                  <User className="w-3 h-3" />人物篩選
                  <span className="text-gray-400">（可多選，符合其中一人即顯示）</span>
                </p>
                {filterContacts.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {filterContacts.map(c => (
                      <span key={c} className="inline-flex items-center gap-1 bg-indigo-500 text-white px-2 py-0.5 rounded-full text-[10px] font-medium">
                        {c}
                        <button onClick={() => toggleFilterContact(c)} className="hover:opacity-70"><X className="w-2 h-2" /></button>
                      </span>
                    ))}
                  </div>
                )}
                <Input
                  type="text"
                  placeholder="搜尋人物名⋯"
                  value={filterContactSearch}
                  onChange={e => setFilterContactSearch(e.target.value)}
                  className="h-8 text-xs mb-2"
                />
                {visibleFilterContacts.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {visibleFilterContacts.map(c => (
                      <button
                        key={c}
                        onClick={() => toggleFilterContact(c)}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                          filterContacts.includes(c)
                            ? "bg-indigo-500 text-white border-indigo-500"
                            : "bg-indigo-50 text-indigo-700 border-transparent hover:border-indigo-300"
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground">
                    {allContacts.length === 0 ? "暫無人物記錄，新增日誌並標記人物後即可在此篩選" : "找不到匹配的人物"}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Results count ── */}
        {hasFilter && (
          <p className="text-xs text-muted-foreground mb-3">
            篩選結果：{filtered.length} / {entries.length} 條
          </p>
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
                {/* Header row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
                    <span className="text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                      {fmtEntryDate(entry.entryAt)}
                    </span>
                    {(entry.tags ?? []).map((tag: string) => (
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
                    className="shrink-0 text-gray-300 hover:text-red-400 transition-colors mt-0.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Content */}
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{entry.content}</p>

                {/* Contacts */}
                {(entry.contacts ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {(entry.contacts as string[]).map(c => (
                      <button
                        key={c}
                        onClick={() => {
                          if (!filterContacts.includes(c)) setFilterContacts(prev => [...prev, c]);
                          setShowFilter(true);
                        }}
                        className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full text-[10px] font-medium hover:bg-indigo-100 transition-colors"
                        title="點擊篩選此人物"
                      >
                        <User className="w-2.5 h-2.5" />{c}
                      </button>
                    ))}
                  </div>
                )}

                {/* Images — 3/5 original size (w-9 h-9 ≈ 34px) */}
                {(entry.images ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {(entry.images as string[]).map((url, i) => (
                      <button
                        key={i}
                        onClick={() => setExpandedImage(url)}
                        className="w-9 h-9 rounded-lg overflow-hidden border hover:opacity-80 transition-opacity"
                      >
                        <img src={url} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}

                {/* Created-at footnote */}
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
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setExpandedImage(null)}
        >
          <div className="relative max-w-[80vw] max-h-[70vh]" onClick={e => e.stopPropagation()}>
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
