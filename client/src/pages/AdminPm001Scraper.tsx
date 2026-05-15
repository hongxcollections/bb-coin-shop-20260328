import { useState } from "react";
import { trpc } from "@/lib/trpc";
import AdminHeader from "@/components/AdminHeader";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Trash2, Save, Search, Globe, ChevronLeft, X } from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";

type Category = { id: string; name: string; url: string };
type ScrapeResult = { title: string; postUrl: string; id: string; matchSource: "title" | "content"; postedAt: string | null };

function genId() {
  return Math.random().toString(36).slice(2, 10);
}

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

  // ── Scraper state ──────────────────────────────────────────────────────────
  const [selectedCatId, setSelectedCatId] = useState("");
  const [keyword, setKeyword] = useState("");
  const [pages, setPages] = useState("3");
  const [dateFilter, setDateFilter] = useState("7");
  const [searchScope, setSearchScope] = useState<"title" | "content" | "both">("both");
  const [results, setResults] = useState<ScrapeResult[] | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [scraping, setScraping] = useState(false);
  const [pagesScraped, setPagesScraped] = useState(0);

  const scrape = trpc.pm001.scrape.useMutation({
    onSuccess: (data) => {
      setResults(data.results as ScrapeResult[]);
      setDismissed(new Set());
      setPagesScraped(data.pagesScraped);
      if (data.results.length === 0) {
        toast.info(`爬取完成，未找到含「${keyword}」的帖子`, { position: "top-center" });
      } else {
        toast.success(`找到 ${data.results.length} 個相關帖子`, { position: "top-center" });
      }
    },
    onError: (e) => toast.error(e.message, { position: "top-center" }),
    onSettled: () => setScraping(false),
  });

  const selectedCat = workingCats.find((c) => c.id === selectedCatId);
  const visibleResults = (results ?? []).filter((r) => !dismissed.has(r.id));

  async function handleScrape() {
    if (!selectedCat) { toast.error("請先選擇分類", { position: "top-center" }); return; }
    if (!keyword.trim()) { toast.error("請輸入搜索關鍵字", { position: "top-center" }); return; }
    setScraping(true);
    setResults(null);
    setDismissed(new Set());
    scrape.mutate({
      url: selectedCat.url,
      keyword: keyword.trim(),
      pages: Math.min(10, Math.max(1, parseInt(pages) || 3)),
      dateFilter: parseInt(dateFilter) || 0,
      searchScope,
    });
  }

  function handleDismiss(id: string) {
    setDismissed((prev) => new Set([...prev, id]));
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
            <p className="text-sm text-muted-foreground">爬取 pm001.net 版塊，按關鍵字篩選帖子（標題 + 內文）</p>
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
                  onKeyDown={(e) => e.key === "Enter" && handleScrape()}
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

            <Button
              onClick={handleScrape}
              disabled={scraping || !selectedCatId || !keyword.trim()}
              className="gap-2 gold-gradient text-white border-0 w-full sm:w-auto"
            >
              {scraping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              {scraping
                ? `爬取中（${searchScope === "title" ? "標題" : searchScope === "content" ? "內文" : "標題+內文"}），請稍候...`
                : "開始搜索"}
            </Button>
            {scraping && searchScope !== "title" && (
              <p className="text-xs text-muted-foreground mt-2">
                正在讀取帖子內文（已過濾作者簽名），時間視乎帖子數量，請耐心等候…
              </p>
            )}
          </CardContent>
        </Card>

        {/* ── 結果 ── */}
        {results !== null && (
          <Card className="border-amber-100">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Search className="w-4 h-4 text-amber-600" />
                  搜索結果
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-amber-700 border-amber-300">
                    顯示 {visibleResults.length} / {results.length} 條
                  </Badge>
                  <Badge variant="outline" className="text-gray-500 border-gray-200 text-xs">
                    掃描 {pagesScraped} 頁
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {results.length === 0 ? (
                <div className="text-center py-8">
                  <Search className="w-10 h-10 mx-auto text-gray-300 mb-3" />
                  <p className="text-sm text-muted-foreground">未找到含「{keyword}」的帖子</p>
                  <p className="text-xs text-gray-400 mt-1">可嘗試增加爬取頁數或換其他關鍵字</p>
                </div>
              ) : visibleResults.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-muted-foreground">所有結果已拆除</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {visibleResults.map((r, i) => (
                    <div
                      key={r.id}
                      className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:bg-amber-50/50 transition-colors group"
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
                      <button
                        type="button"
                        onClick={() => handleDismiss(r.id)}
                        title="拆除此條"
                        className="flex-shrink-0 p-1.5 rounded-md text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
