import { Link, useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { BookOpen, ChevronLeft, Tag, Calendar, ShieldCheck, UserRound } from "lucide-react";
import AdSenseAd from "@/components/AdSenseAd";
import { useSeoMeta } from "@/lib/useSeoMeta";

const CATEGORY_COLORS: Record<string, string> = {
  入門: "bg-green-100 text-green-700",
  評級: "bg-blue-100 text-blue-700",
  拍賣: "bg-amber-100 text-amber-700",
  保養: "bg-purple-100 text-purple-700",
  知識: "bg-rose-100 text-rose-700",
};

function renderContent(content: string) {
  // Simple markdown-like renderer: ## headings, **bold**, | tables, - lists, blank lines = paragraphs
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    // h2
    if (line.startsWith('## ')) {
      elements.push(<h2 key={i} className="text-lg font-semibold mt-6 mb-2 text-gray-900">{line.slice(3)}</h2>);
      i++; continue;
    }
    // h3
    if (line.startsWith('### ')) {
      elements.push(<h3 key={i} className="text-base font-semibold mt-4 mb-1.5 text-gray-800">{line.slice(4)}</h3>);
      i++; continue;
    }
    // Table (starts with |)
    if (line.startsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].startsWith('|')) {
        tableLines.push(lines[i]);
        i++;
      }
      const isHeader = (l: string) => /^[\s|:-]+$/.test(l.replace(/\|/g, ''));
      const rows = tableLines.filter(l => !isHeader(l));
      elements.push(
        <div key={i + '_tbl'} className="overflow-x-auto my-4">
          <table className="w-full text-sm border-collapse">
            <tbody>
              {rows.map((row, ri) => {
                const cells = row.split('|').filter((_, ci) => ci > 0 && ci < row.split('|').length - 1);
                return (
                  <tr key={ri} className={ri === 0 ? "bg-amber-50 font-semibold" : ri % 2 === 0 ? "bg-gray-50" : "bg-white"}>
                    {cells.map((cell, ci) => (
                      <td key={ci} className="border border-gray-200 px-3 py-2">{cell.trim()}</td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      );
      continue;
    }
    // List item
    if (line.startsWith('- ') || line.startsWith('* ')) {
      const listItems: string[] = [];
      while (i < lines.length && (lines[i].startsWith('- ') || lines[i].startsWith('* '))) {
        listItems.push(lines[i].slice(2));
        i++;
      }
      elements.push(
        <ul key={i + '_ul'} className="list-disc list-inside space-y-1 my-3 text-gray-700 text-sm leading-relaxed pl-2">
          {listItems.map((item, li) => <li key={li}>{renderInline(item)}</li>)}
        </ul>
      );
      continue;
    }
    // Numbered list
    if (/^\d+\. /.test(line)) {
      const listItems: string[] = [];
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        listItems.push(lines[i].replace(/^\d+\. /, ''));
        i++;
      }
      elements.push(
        <ol key={i + '_ol'} className="list-decimal list-inside space-y-1 my-3 text-gray-700 text-sm leading-relaxed pl-2">
          {listItems.map((item, li) => <li key={li}>{renderInline(item)}</li>)}
        </ol>
      );
      continue;
    }
    // Blank line
    if (line.trim() === '') { i++; continue; }
    // Paragraph
    elements.push(<p key={i} className="text-sm text-gray-700 leading-relaxed my-2">{renderInline(line)}</p>);
    i++;
  }
  return elements;
}

function renderInline(text: string): React.ReactNode {
  // Bold **text** and ❌/✅ markers
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i} className="font-semibold text-gray-900">{part.slice(2, -2)}</strong>
      : <span key={i}>{part}</span>
  );
}

export default function GuideDetail() {
  const params = useParams<{ slug: string }>();
  const { data: article, isLoading, error } = trpc.articles.get.useQuery({ slug: params.slug ?? '' }, {
    enabled: !!params.slug,
  });
  const { data: allArticles = [] } = trpc.articles.list.useQuery();
  const articleContent = typeof article?.content === "string" ? article.content : "";
  const articleDescription = article?.excerpt
    || articleContent.replace(/[#|*_`>-]/g, " ").replace(/\s+/g, " ").trim().slice(0, 155)
    || "香港錢幣收藏、評級、保養及拍賣實用指南。";

  useSeoMeta({
    title: article?.title ? `${article.title}｜錢幣知識庫` : "錢幣知識庫",
    description: articleDescription,
    ogUrl: params.slug ? `/guides/${params.slug}` : "/guides",
    ogType: "article",
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-2xl animate-spin">💰</div>
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container max-w-3xl mx-auto pt-12 pb-24 px-4 text-center">
          <BookOpen className="w-12 h-12 mx-auto mb-3 text-amber-200" />
          <p className="text-muted-foreground mb-4">找不到此文章</p>
          <Link href="/guides" className="text-amber-600 underline text-sm">返回知識庫</Link>
        </div>
      </div>
    );
  }

  const relatedArticles = (allArticles as any[])
    .filter((candidate) => candidate.slug !== article.slug)
    .sort((a, b) => Number(b.category === article.category) - Number(a.category === article.category))
    .slice(0, 3);

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-3xl mx-auto pt-10 pb-24 px-4">
        {/* Back */}
        <Link href="/guides" className="inline-flex items-center gap-1 text-sm text-amber-600 hover:text-amber-700 mb-6 transition-colors">
          <ChevronLeft className="w-4 h-4" />知識庫
        </Link>

        {/* Meta */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          {(article as any).category && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${CATEGORY_COLORS[(article as any).category] ?? "bg-gray-100 text-gray-600"}`}>
              <Tag className="w-3 h-3" />{(article as any).category}
            </span>
          )}
          {(article as any).publishedAt && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              更新於 {new Date((article as any).updatedAt ?? (article as any).publishedAt).toLocaleDateString("zh-HK")}
            </span>
          )}
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <UserRound className="w-3 h-3" />
            香港錢幣研究編輯部
          </span>
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{(article as any).title}</h1>
        {(article as any).excerpt && (
          <p className="text-sm text-muted-foreground mb-6 leading-relaxed border-l-4 border-amber-200 pl-3">
            {(article as any).excerpt}
          </p>
        )}

        {(article as any).imageUrl && (
          <figure className="mb-6 overflow-hidden rounded-2xl border border-amber-100 bg-amber-50">
            <img
              src={(article as any).imageUrl}
              alt={`${(article as any).title}的編輯插畫`}
              className="block aspect-[1200/520] w-full object-cover"
            />
            <figcaption className="border-t border-amber-100 bg-white px-3 py-2 text-xs text-muted-foreground">
              知識庫原創編輯插畫
            </figcaption>
          </figure>
        )}

        {/* Content */}
        <article className="prose-sm max-w-none">
          {renderContent(articleContent)}
        </article>

        {relatedArticles.length > 0 && (
          <section className="mt-9 rounded-2xl border border-amber-100 bg-amber-50/60 p-4" aria-labelledby="related-guides">
            <div className="mb-3 flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-amber-600" />
              <h2 id="related-guides" className="font-semibold text-gray-900">延伸閱讀</h2>
            </div>
            <div className="space-y-2">
              {relatedArticles.map((related) => (
                <Link
                  key={related.id}
                  href={`/guides/${related.slug}`}
                  className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2.5 text-sm font-medium text-gray-800 transition-colors hover:text-amber-700"
                >
                  <span className="line-clamp-1">{related.title}</span>
                  <ChevronLeft className="h-4 w-4 shrink-0 rotate-180 text-amber-500" />
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Only show one ad after a substantial article, never before the content. */}
        {articleContent.trim().length >= 1000 && (
          <div className="mt-8">
            <AdSenseAd slot="9658476126" format="auto" className="rounded-xl overflow-hidden" />
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-border">
          <p className="mb-3 flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-amber-600" />
            本文由香港錢幣研究編輯部審閱，供收藏研究參考；交易前請自行核實資料。
          </p>
          <div className="flex gap-4 text-xs text-muted-foreground">
          <Link href="/guides" className="hover:text-amber-600 transition-colors underline">更多文章</Link>
          <Link href="/" className="hover:text-amber-600 transition-colors underline">返回首頁</Link>
          <Link href="/auctions" className="hover:text-amber-600 transition-colors underline">瀏覽拍賣</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
