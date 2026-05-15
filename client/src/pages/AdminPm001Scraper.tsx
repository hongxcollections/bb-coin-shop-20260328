import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import AdminHeader from "@/components/AdminHeader";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, Trash2, Save, Search, Globe, ChevronLeft, X, Bookmark, BookmarkCheck } from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";

type Category = { id: string; name: string; url: string };
type ScrapeResult = { title: string; postUrl: string; id: string; matchSource: "title" | "content"; postedAt: string | null };
type PostInfo = { boardId: string; id: string; title: string; postedAt: string | null; titleMatched: boolean };
type SearchPhase = "idle" | "listing" | "fetching" | "done";

const LS_SAVED_KEY = "pm001_saved_posts";

function loadSavedPosts(): ScrapeResult[] {
  try {
    const raw = localStorage.getItem(LS_SAVED_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ScrapeResult[];
  } catch { return []; }
}

function persistSavedPosts(list: ScrapeResult[]) {
  try {
    localStorage.setItem(LS_SAVED_KEY, JSON.stringify(list));
  } catch {}
}

function genId() {
  return Math.random().toString(36).slice(2, 10);
}

const BATCH_SIZE = 6;

export default function AdminPm001Scraper() {
  const { user, isAuthenticated } = useAuth();
  const isAdmin = isAuthenticated && user?.role === "admin";

  const { data: savedCats, isLoading: catsLoading, refetch: refetchCats } = trpc.pm001.getCategories.useQuery(
    undefined, { enabled: isAdmin }
  );

  const [cats, setCats] = useState<Category[] | null>(null);
  const [catsSaving, setCatsSaving] = useState(false);
  const workingCats: Category[] = cats ?? (savedCats ?? []);

  const saveCategories = trpc.pm001.saveCategories.useMutation({
    onSuccess: () => {
      toast.success("分類已儲存", { position: "top-center" });
      setCats(null);
      refetchCats();
    },
    onError: (e) => toast.error(e.message, { position: "top-center" }),
  });

  function handleCatChange(id: string, field: keyof Category, value: string) {
    setCats((prev) =>
      (prev ?? savedCats ?? []).map((c) => c.id === id ? { ...c, [field]: value } : c)
    );
  }

  function handleAddCat() {
    setCats([...(cats ?? savedCats ?? []), { id: genId(), name: "", url: "" }]);
  }

  function handleDeleteCat(id: string) {
    setCats((prev) => (prev ?? savedCats ?? []).filter((c) => c.id !== id));
  }

  async function handleSaveCats() {
    const toSave = workingCats.filter((c) => c.name.trim() && c.url.trim());
    setCatsSaving(true);
    try { await saveCategories.mutateAsync(toSave); }
    finally { setCatsSaving(false); }
  }

  // ── Scraper state ─────────────────────────────────────────────────────────
  const [selectedCatId, setSelectedCatId] = useState("");
  const [keyword, setKeyword] = useState("");
  const [pages, setPages] = useState("3");
  const [dateFilter, setDateFilter] = useState("1");
  const [searchScope, setSearchScope] = useState<"title" | "content" | "both">("both");

  const [phase, setPhase] = useState<SearchPhase>("idle");
  const [progress, setProgress] = useState({ checked: 0, total: 0, listed: 0 });
  const [results, setResults] = useState<ScrapeResult[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [savedPosts, setSavedPosts] = useState<ScrapeResult[]>(() => loadSavedPosts());
  const [pagesScraped, setPagesScraped] = useState(0);
  const abortRef = useRef(false);
  const isBusy = phase === "listing" || phase === "fetching";

  const listPostsMutation = trpc.pm001.listPosts.useMutation();
  const fetchPostBatchMutation = trpc.pm001.fetchPostBatch.useMutation();

  // ── auto-persist saved posts ──────────────────────────────────────────────
  useEffect(() => {
    persistSavedPosts(savedPosts);
  }, [savedPosts]);

  const selectedCat = workingCats.find((c) => c.id === selectedCatId);
  const visibleResults = results.filter((r) => !dismissed.has(r.id));
  const savedIdSet = new Set(savedPosts.map(s => s.id));

  async function handleScrape() {
    if (!selectedCat) { toast.error("請先選擇分類", { position: "top-center" }); return; }
    if (!keyword.trim()) { toast.error("請輸入搜索關鍵字", { position: "top-center" }); return; }

    abortRef.current = false;
    setPhase("listing");
    setResults([]);
    setDismissed(new Set());
    setProgress({ checked: 0, total: 0, listed: 0 });
    setPagesScraped(0);

    let posts: PostInfo[] = [];
    try {
      const res = await listPostsMutation.mutateAsync({
        url: selectedCat.url,
        keyword: keyword.trim(),
        pages: Math.min(10, Math.max(1, parseInt(pages) || 3)),
        dateFilter: parseInt(dateFilter) || 0,
      });
      posts = res.posts as PostInfo[];
      setPagesScraped(res.pagesScraped);
      setProgress(p => ({ ...p, listed: posts.length }));
    } catch (e: any) {
      toast.error(e.message || "爬取失敗", { position: "top-center" });
      setPhase("idle");
      return;
    }

    if (abortRef.current) { setPhase("idle"); return; }

    // Title-only scope: done immediately
    if (searchScope === "title") {
      const titleResults: ScrapeResult[] = posts
        .filter(p => p.titleMatched)
        .map(p => ({
          title: p.title,
          postUrl: `http://www.pm001.net/dispbbs.asp?boardID=${p.boardId}&ID=${p.id}&page=1`,
          id: p.id,
          matchSource: "title" as const,
          postedAt: p.postedAt,
        }));
      setResults(titleResults);
      setPhase("done");
      if (titleResults.length === 0) {
        toast.info(`未找到含「${keyword.trim()}」的帖子`, { position: "top-center" });
      } else {
        toast.success(`找到 ${titleResults.length} 個相關帖子`, { position: "top-center" });
      }
      return;
    }

    // scope = content or both
    const titleMatchedMap = new Map<string, PostInfo>(
      posts.filter(p => p.titleMatched).map(p => [p.id, p])
    );
    const titleResults: ScrapeResult[] = searchScope === "both"
      ? [...titleMatchedMap.values()].map(p => ({
          title: p.title,
          postUrl: `http://www.pm001.net/dispbbs.asp?boardID=${p.boardId}&ID=${p.id}&page=1`,
          id: p.id,
          matchSource: "title" as const,
          postedAt: p.postedAt,
        }))
      : [];

    if (titleResults.length > 0) setResults(titleResults);

    const toCheck = searchScope === "content"
      ? posts
      : posts.filter(p => !titleMatchedMap.has(p.id));

    setPhase("fetching");
    setProgress({ checked: 0, total: toCheck.length, listed: posts.length });

    const contentResults: ScrapeResult[] = [];
    for (let i = 0; i < toCheck.length; i += BATCH_SIZE) {
      if (abortRef.current) break;
      const batch = toCheck.slice(i, i + BATCH_SIZE);
      try {
        const res = await fetchPostBatchMutation.mutateAsync({
          posts: batch.map(p => ({ boardId: p.boardId, id: p.id })),
          keyword: keyword.trim(),
        });
        for (const id of res.matchedIds) {
          const p = batch.find(x => x.id === id);
          if (p) {
            contentResults.push({
              title: p.title,
              postUrl: `http://www.pm001.net/dispbbs.asp?boardID=${p.boardId}&ID=${p.id}&page=1`,
              id: p.id,
              matchSource: "content",
              postedAt: p.postedAt,
            });
          }
        }
      } catch (e: any) {
        console.warn("[pm001 fetchPostBatch] batch failed", e?.message);
      }
      const checked = Math.min(i + BATCH_SIZE, toCheck.length);
      setProgress({ checked, total: toCheck.length, listed: posts.length });
      setResults([...titleResults, ...contentResults]);
    }

    setPhase("done");
    const total = titleResults.length + contentResults.length;
    if (total === 0) {
      toast.info(`未找到含「${keyword.trim()}」的帖子`, { position: "top-center" });
    } else {
      const parts: string[] = [];
      if (titleResults.length > 0) parts.push(`標題 ${titleResults.length}`);
      if (contentResults.length > 0) parts.push(`內文 ${contentResults.length}`);
      toast.success(`找到 ${total} 個相關帖子（${parts.join(" / ")}）`, { position: "top-center" });
    }
  }

  function handleStop() {
    abortRef.current = true;
    setPhase("done");
  }

  function handleDismiss(id: string) {
    setDismissed((prev) => new Set([...prev, id]));
  }

  function handleSavePost(r: ScrapeResult) {
    setSavedPosts((prev) => {
      if (prev.some(x => x.id === r.id)) return prev;
      return [...prev, r];
    });
    toast.success("已儲存", { position: "top-center", duration: 1500 });
  }

  function handleUnsavePost(id: string) {
    setSavedPosts((prev) => prev.filter(s => s.id !== id));
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">無權限</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 pb-20">
      <AdminHeader />
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/admin">
            <button className="flex items-center text-sm text-amber-700 hover:text-amber-900 font-medium">
              <ChevronLeft className="w-4 h-4 mr-1" />返回後台
            </button>
          </Link>
          <div className="w-10 h-10 gold-gradient rounded-xl flex items-center justify-center">
            <Globe className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-amber-900">pm001.net 錢幣搜索</h1>
            <p className="text-sm text-muted-foreground">爬取 pm001.net 版塊，按關鍵字篩選帖子</p>
          </div>
        </div>

        {/* ── 分類管理 ── */}
        <Card className="border-amber-100 mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Globe className="w-4 h-4 text-amber-600" />
              版塊分類管理
            </CardTitle>
          </CardHeader>
          <CardContent>
            {catsLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
              </div>
            ) : (
              <div className="space-y-3">
                {workingCats.map((c) => (
                  <div key={c.id} className="flex gap-2 items-center">
                    <Input
                      value={c.name}
                      onChange={(e) => handleCatChange(c.id, "name", e.target.value)}
                      placeholder="分類名稱"
                      className="w-32 flex-shrink-0 text-sm"
                    />
                    <Input
                      value={c.url}
                      onChange={(e) => handleCatChange(c.id, "url", e.target.value)}
                      placeholder="http://www.pm001.net/index.asp?boardID=XX"
                      className="flex-1 text-sm font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => handleDeleteCat(c.id)}
                      className="p-2 text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                {workingCats.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">尚未新增版塊分類</p>
                )}
                <div className="flex gap-2 pt-1">
                  <Button variant="outline" size="sm" onClick={handleAddCat} className="gap-1.5 text-amber-700 border-amber-300">
                    <Plus className="w-4 h-4" />新增分類
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSaveCats}
                    disabled={catsSaving || saveCategories.isPending}
                    className="gap-1.5 gold-gradient text-white border-0"
                  >
                    {catsSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    儲存分類
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── 搜索 ── */}
        <Card className="border-amber-100 mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Search className="w-4 h-4 text-amber-600" />
              關鍵字搜索
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
              <div className="col-span-2 sm:col-span-1">
                <Label className="text-xs text-muted-foreground mb-1 block">版塊分類</Label>
                <select
                  value={selectedCatId}
                  onChange={(e) => setSelectedCatId(e.target.value)}
                  className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-amber-400"
                >
                  <option value="">-- 選擇分類 --</option>
                  {workingCats.filter(c => c.name && c.url).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <Label className="text-xs text-muted-foreground mb-1 block">關鍵字（繁簡均可）</Label>
                <Input
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="如：光緒、龙凤、香港"
                  onKeyDown={(e) => e.key === "Enter" && !isBusy && handleScrape()}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">搜尋範圍</Label>
                <select
                  value={searchScope}
                  onChange={(e) => setSearchScope(e.target.value as "title" | "content" | "both")}
                  className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-amber-400"
                >
                  <option value="title">僅標題</option>
                  <option value="content">僅內文</option>
                  <option value="both">標題 + 內文</option>
                </select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">發帖日期範圍</Label>
                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-amber-400"
                >
                  <option value="1">最近 1 日</option>
                  <option value="3">最近 3 日</option>
                  <option value="7">最近 7 日</option>
                  <option value="30">最近 30 日</option>
                  <option value="0">不限（全部）</option>
                </select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">爬取頁數（1–10）</Label>
                <Input
                  value={pages}
                  onChange={(e) => setPages(e.target.value)}
                  placeholder="3"
                />
              </div>
            </div>

            {selectedCat && (
              <p className="text-xs text-muted-foreground mb-3 font-mono break-all">
                {selectedCat.url}
              </p>
            )}

            <div className="flex flex-wrap gap-2 items-center">
              <Button
                onClick={handleScrape}
                disabled={isBusy || !selectedCatId || !keyword.trim()}
                className="gap-2 gold-gradient text-white border-0"
              >
                {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                {isBusy ? "搜索中..." : "開始搜索"}
              </Button>
              {isBusy && (
                <Button variant="outline" size="sm" onClick={handleStop} className="text-red-600 border-red-200 hover:bg-red-50">
                  停止
                </Button>
              )}
            </div>

            {phase === "listing" && (
              <div className="mt-3 p-3 bg-amber-50 rounded-lg border border-amber-100">
                <div className="flex items-center gap-2 text-sm text-amber-800">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  正在爬取版塊帖子列表…
                </div>
              </div>
            )}
            {phase === "fetching" && (
              <div className="mt-3 p-3 bg-amber-50 rounded-lg border border-amber-100">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-sm text-amber-800">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    正在讀取帖子內文（已過濾簽名）
                  </div>
                  <span className="text-sm font-mono font-semibold text-amber-900">
                    {progress.checked} / {progress.total}
                  </span>
                </div>
                <div className="w-full bg-amber-100 rounded-full h-1.5">
                  <div
                    className="bg-amber-500 h-1.5 rounded-full transition-all duration-300"
                    style={{ width: progress.total > 0 ? `${(progress.checked / progress.total) * 100}%` : "0%" }}
                  />
                </div>
                {results.length > 0 && (
                  <p className="text-xs text-amber-600 mt-1.5">目前已找到 {results.length} 條相關帖子</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── 已儲存帖子（永久保存） ── */}
        {savedPosts.length > 0 && (
          <Card className="border-emerald-200 mb-6">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <BookmarkCheck className="w-4 h-4 text-emerald-600" />
                已儲存帖子（{savedPosts.length}）
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {savedPosts.map((s, i) => (
                  <div
                    key={s.id}
                    className="flex items-center gap-3 p-3 rounded-lg border border-emerald-100 bg-emerald-50/30 group"
                  >
                    <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 text-xs flex items-center justify-center font-bold flex-shrink-0">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <a
                        href={s.postUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-emerald-800 hover:text-emerald-600 hover:underline leading-snug break-words"
                      >
                        {s.title}
                      </a>
                      {s.postedAt && (
                        <div className="text-[10px] text-gray-400 mt-0.5">{s.postedAt}</div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleUnsavePost(s.id)}
                      title="移除收藏"
                      className="flex-shrink-0 p-1.5 rounded-md text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── 搜尋結果 ── */}
        {(results.length > 0 || phase === "done") && (
          <Card className="border-amber-100">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Search className="w-4 h-4 text-amber-600" />
                  搜索結果
                </CardTitle>
                <div className="flex items-center gap-2 flex-wrap">
                  {pagesScraped > 0 && (
                    <span className="text-xs px-2 py-0.5 rounded border border-gray-200 text-gray-500">
                      掃描 {pagesScraped} 頁
                    </span>
                  )}
                  <span className="text-xs px-2 py-0.5 rounded border border-amber-200 text-amber-700">
                    顯示 {visibleResults.length} / {results.length} 條
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {results.length === 0 ? (
                <div className="text-center py-8">
                  <Search className="w-10 h-10 mx-auto text-gray-300 mb-3" />
                  <p className="text-sm text-muted-foreground">未找到相關帖子</p>
                  <p className="text-xs text-gray-400 mt-1">可嘗試增加爬取頁數或換其他關鍵字</p>
                </div>
              ) : visibleResults.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-muted-foreground">所有結果已拆除</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {visibleResults.map((r, i) => {
                    const isSaved = savedIdSet.has(r.id);
                    return (
                      <div
                        key={r.id}
                        className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:bg-amber-50/50 transition-colors"
                      >
                        <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 text-xs flex items-center justify-center font-bold flex-shrink-0">
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <a
                            href={r.postUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium text-amber-800 hover:text-amber-600 hover:underline leading-snug break-words"
                          >
                            {r.title}
                          </a>
                          <div className="mt-0.5 flex items-center gap-1.5 flex-wrap">
                            {r.matchSource === "content" ? (
                              <span className="inline-block text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-100">
                                內文匹配
                              </span>
                            ) : (
                              <span className="inline-block text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 border border-amber-100">
                                標題匹配
                              </span>
                            )}
                            {r.postedAt && (
                              <span className="text-[10px] text-gray-400">{r.postedAt}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => isSaved ? handleUnsavePost(r.id) : handleSavePost(r)}
                            title={isSaved ? "已儲存（按一下取消）" : "儲存此帖"}
                            className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md border transition-colors ${
                              isSaved
                                ? "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                                : "border-gray-200 text-gray-500 hover:text-emerald-700 hover:border-emerald-300 hover:bg-emerald-50"
                            }`}
                          >
                            {isSaved ? <BookmarkCheck className="w-3.5 h-3.5" /> : <Bookmark className="w-3.5 h-3.5" />}
                            {isSaved ? "已儲存" : "儲存"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDismiss(r.id)}
                            title="拆除（從此次結果隱藏）"
                            className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md border border-gray-200 text-gray-500 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                            拆除
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
