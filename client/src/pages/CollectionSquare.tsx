import { useState } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Heart, MessageCircle, Eye, Plus, Search, Sparkles, HelpCircle, Tag } from "lucide-react";

const INTENT_TABS: { key: "all" | "display" | "seek_value" | "for_sale"; label: string; icon?: any }[] = [
  { key: "all", label: "全部" },
  { key: "display", label: "純展示", icon: Sparkles },
  { key: "seek_value", label: "求估價", icon: HelpCircle },
  { key: "for_sale", label: "想出讓", icon: Tag },
];

function intentBadge(intent: string) {
  if (intent === "seek_value") return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">求估價</Badge>;
  if (intent === "for_sale") return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">想出讓</Badge>;
  return <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100">展示</Badge>;
}

export default function CollectionSquare() {
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [intent, setIntent] = useState<"all" | "display" | "seek_value" | "for_sale">("all");
  const [sort, setSort] = useState<"latest" | "hot">("latest");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const { data, isLoading } = trpc.community.list.useQuery({
    intent,
    sort,
    search: search || undefined,
    limit: 30,
  });

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Header />
      <div className="max-w-5xl mx-auto px-4 pt-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">藏品社區</h1>
            <p className="text-sm text-gray-500 mt-1">分享你嘅收藏 · 求教估價 · 想出讓嘅可申請開通商戶</p>
          </div>
          <Button
            onClick={() => {
              if (!isAuthenticated) {
                navigate(`/login?from=${encodeURIComponent("/collection-square/new")}`);
                return;
              }
              navigate("/collection-square/new");
            }}
            className="bg-amber-500 hover:bg-amber-600 text-white"
          >
            <Plus className="w-4 h-4 mr-1" /> 發布
          </Button>
        </div>

        <div className="flex gap-2 mb-3 overflow-x-auto -mx-4 px-4">
          {INTENT_TABS.map((t) => {
            const active = intent === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setIntent(t.key)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-sm border transition ${
                  active ? "bg-amber-500 text-white border-amber-500" : "bg-white text-gray-700 border-gray-200"
                }`}
              >
                {t.label}
              </button>
            );
          })}
          <div className="ml-auto flex gap-1">
            {(["latest", "hot"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSort(s)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-sm border transition ${
                  sort === s ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-700 border-gray-200"
                }`}
              >
                {s === "latest" ? "最新" : "最熱"}
              </button>
            ))}
          </div>
        </div>

        <form
          className="flex gap-2 mb-4"
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(searchInput.trim());
          }}
        >
          <Input
            placeholder="搜尋帖文標題或內容..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="bg-white"
          />
          <Button type="submit" variant="outline">
            <Search className="w-4 h-4" />
          </Button>
          {search && (
            <Button type="button" variant="ghost" onClick={() => { setSearchInput(""); setSearch(""); }}>
              清除
            </Button>
          )}
        </form>

        {isLoading && (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!isLoading && (data?.items?.length ?? 0) === 0 && (
          <div className="bg-white rounded-lg p-12 text-center text-gray-500 border">
            暫時冇相關帖文，做第一個分享嘅人啦！
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {data?.items?.map((post: any) => (
            <Link
              key={post.id}
              href={`/collection-square/${post.id}`}
              className="bg-white rounded-lg overflow-hidden border hover:shadow-md transition block"
            >
              <div className="aspect-square bg-gray-100 relative">
                {post.coverImage ? (
                  <img src={post.coverImage} alt={post.title} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-300">無圖片</div>
                )}
                <div className="absolute top-2 left-2">{intentBadge(post.intent)}</div>
                {post.imageCount > 1 && (
                  <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded">
                    +{post.imageCount}
                  </div>
                )}
                {post.isHidden ? (
                  <div className="absolute bottom-2 left-2 bg-red-600 text-white text-xs px-2 py-0.5 rounded">已隱藏</div>
                ) : null}
              </div>
              <div className="p-2.5">
                <div className="font-medium text-sm text-gray-900 line-clamp-2 min-h-[2.5em]">{post.title}</div>
                <div className="flex items-center gap-1 mt-2 text-xs text-gray-500">
                  {post.authorPhoto ? (
                    <img src={post.authorPhoto} alt="" className="w-4 h-4 rounded-full object-cover" />
                  ) : (
                    <div className="w-4 h-4 rounded-full bg-gray-200" />
                  )}
                  <span className="truncate flex-1">{post.authorName ?? "匿名"}</span>
                </div>
                <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
                  <span className="flex items-center gap-0.5">
                    <Heart className={`w-3 h-3 ${post.isLiked ? "fill-red-500 text-red-500" : ""}`} />
                    {post.likeCount}
                  </span>
                  <span className="flex items-center gap-0.5"><MessageCircle className="w-3 h-3" />{post.commentCount}</span>
                  <span className="flex items-center gap-0.5 ml-auto"><Eye className="w-3 h-3" />{post.viewCount}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
