import { useState, useRef, useMemo } from "react";
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
const MAX_IMAGES = 5;

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
  const [imageFiles, setImageFiles] = useState<{ file: File; preview: string }[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const contactInputRef = useRef<HTMLInputElement>(null);

  // ── Filter state ──
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterTag, setFilterTag] = useState("");
  const [filterContact, setFilterContact] = useState("");
  const [showFilter, setShowFilter] = useState(false);

  const entries = rawEntries as any[];

  // ── Derived: all contacts across entries ──
  const allContacts = useMemo(() => {
    const set = new Set<string>();
    entries.forEach(e => (e.contacts ?? []).forEach((c: string) => set.add(c)));
    return Array.from(set).sort();
  }, [entries]);

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
      if (filterContact) {
        const lc = filterContact.toLowerCase();
        if (!(e.contacts ?? []).some((c: string) => c.toLowerCase().includes(lc))) return false;
      }
      return true;
    });
  }, [entries, filterDateFrom, filterDateTo, filterTag, filterContact]);

  const hasFilter = filterDateFrom || filterDateTo || filterTag || filterContact;

  // ── Mutations ──
  const uploadImage = trpc.merchantJournal.uploadImage.useMutation();
  const createEntry = trpc.merchantJournal.create.useMutation({
    onSuccess: () => {
      utils.merchantJournal.list.invalidate();
      setContent("");
      setSelectedTags([]);
      setContacts([]);
      setContactInput("");
      setImageFiles([]);
      setEntryAt(toLocalDatetimeValue());
      toast.success("日誌已記錄");
    },
  });
  const deleteEntry = trpc.merchantJournal.delete.useMutation({
    onSuccess: () => { utils.merchantJournal.list.invalidate(); toast.success("已刪除"); },
  });

  // ── Helpers ──
  const toggleTag = (tag: string) =>
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);

  const addContact = () => {
    const name = contactInput.trim();
    if (!name) return;
    if (!contacts.includes(name)) setContacts(prev => [...prev, name]);
    setContactInput("");
    contactInputRef.current?.focus();
  };

  const handleContactKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addContact(); }
    if (e.key === "Backspace" && !contactInput && contacts.length > 0)
      setContacts(prev => prev.slice(0, -1));
  };

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

          {/* Content */}
          <Textarea
            placeholder="記下今日發生咗什麼⋯（最多 500 字）"
            value={content}
            onChange={e => setContent(e.target.value)}
            maxLength={500}
            rows={3}
            className="resize-none text-sm"
          />
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

          {/* Contacts input */}
          <div>
            <p className="text-[11px] text-muted-foreground mb-1.5 flex items-center gap-1"><User className="w-3 h-3" />相關人物（Enter 或逗號加入）</p>
            <div className="flex flex-wrap items-center gap-1.5 min-h-[36px] rounded-lg border border-input bg-background px-2.5 py-1.5 focus-within:ring-2 focus-within:ring-amber-400">
              {contacts.map(c => (
                <span key={c} className="inline-flex items-center gap-1 bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full text-xs font-medium">
                  {c}
                  <button onClick={() => setContacts(prev => prev.filter(x => x !== c))} className="hover:text-red-500">
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
                onBlur={addContact}
                placeholder={contacts.length === 0 ? "輸入人名⋯" : ""}
                className="flex-1 min-w-[80px] text-xs bg-transparent outline-none placeholder:text-muted-foreground"
              />
            </div>
          </div>

          {/* Image previews */}
          {imageFiles.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {imageFiles.map((f, i) => (
                <div key={i} className="relative w-14 h-14">
                  <img src={f.preview} alt="" className="w-14 h-14 object-cover rounded-lg border" />
                  <button
                    onClick={() => removeImage(i)}
                    className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
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
            {hasFilter ? "篩選中" : "篩選"}
            {hasFilter && (
              <button
                onClick={e => { e.stopPropagation(); setFilterDateFrom(""); setFilterDateTo(""); setFilterTag(""); setFilterContact(""); }}
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

              {/* Contact filter */}
              <div>
                <p className="text-[11px] text-muted-foreground mb-1.5 flex items-center gap-1"><User className="w-3 h-3" />人物篩選</p>
                {allContacts.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {allContacts.map(c => (
                      <button
                        key={c}
                        onClick={() => setFilterContact(filterContact === c ? "" : c)}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                          filterContact === c
                            ? "bg-indigo-500 text-white border-indigo-500"
                            : "bg-indigo-50 text-indigo-700 border-transparent hover:border-indigo-300"
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                ) : null}
                <Input
                  type="text"
                  placeholder="搜尋人物名⋯"
                  value={filterContact}
                  onChange={e => setFilterContact(e.target.value)}
                  className="h-8 text-xs"
                />
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
                        onClick={() => { setFilterContact(c); setShowFilter(true); }}
                        className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full text-[10px] font-medium hover:bg-indigo-100 transition-colors"
                      >
                        <User className="w-2.5 h-2.5" />{c}
                      </button>
                    ))}
                  </div>
                )}

                {/* Images */}
                {(entry.images ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {(entry.images as string[]).map((url, i) => (
                      <button
                        key={i}
                        onClick={() => setExpandedImage(url)}
                        className="w-14 h-14 rounded-lg overflow-hidden border hover:opacity-80 transition-opacity"
                      >
                        <img src={url} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}

                {/* Created-at footnote (if different from entryAt) */}
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
