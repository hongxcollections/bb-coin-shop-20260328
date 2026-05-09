import { useState } from "react";
import { useLocation, useRoute, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/contexts/ToastContext";
import { useConfirm } from "@/components/ui/confirm-provider";
import { Heart, Bookmark, MessageCircle, Eye, ChevronLeft, Trash2, Store, ShoppingBag, AlertTriangle } from "lucide-react";

function intentBadge(intent: string) {
  if (intent === "seek_value") return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">求估價</Badge>;
  if (intent === "for_sale") return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">想出讓</Badge>;
  return <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100">展示</Badge>;
}

export default function CollectionPostDetail() {
  const [, params] = useRoute<{ id: string }>("/collection-square/:id");
  const [, navigate] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const { showToast } = useToast();
  const confirm = useConfirm();
  const utils = trpc.useUtils();

  const id = Number(params?.id || 0);
  const { data: post, isLoading } = trpc.community.get.useQuery({ id }, { enabled: id > 0 });
  const { data: comments } = trpc.community.listComments.useQuery({ postId: id }, { enabled: id > 0 });


  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [commentText, setCommentText] = useState("");

  const toggleLike = trpc.community.toggleLike.useMutation({
    onSuccess: () => utils.community.get.invalidate({ id }),
  });
  const toggleSave = trpc.community.toggleSave.useMutation({
    onSuccess: () => utils.community.get.invalidate({ id }),
  });
  const addComment = trpc.community.addComment.useMutation({
    onSuccess: () => {
      utils.community.listComments.invalidate({ postId: id });
      utils.community.get.invalidate({ id });
    },
  });
  const deleteComment = trpc.community.deleteComment.useMutation({
    onSuccess: () => utils.community.listComments.invalidate({ postId: id }),
  });
  const deletePost = trpc.community.delete.useMutation({
    onSuccess: () => navigate("/collection-square"),
  });
  const adminSetHidden = trpc.community.adminSetHidden.useMutation({
    onSuccess: () => utils.community.get.invalidate({ id }),
  });

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" /></div>;
  }
  if (!post) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-2xl mx-auto p-8 text-center text-gray-500">帖文不存在或已被隱藏</div>
      </div>
    );
  }

  const isOwner = user?.id === post.userId;
  const isAdmin = user?.role === "admin";
  const images = (post as any).images || [];

  async function handleDelete() {
    const ok = await confirm({ title: "刪除帖文？", description: "此動作不可還原。", confirmText: "刪除", cancelText: "取消" });
    if (!ok) return;
    await deletePost.mutateAsync({ id });
  }

  async function handleSubmitComment() {
    if (!isAuthenticated) {
      navigate(`/login?from=${encodeURIComponent(`/collection-square/${id}`)}`);
      return;
    }
    const text = commentText.trim();
    if (!text) return;
    try {
      const res = await addComment.mutateAsync({ postId: id, content: text });
      setCommentText("");
      if ((res as any).flagged) {
        showToast({ icon: "⚠️", title: "留言已暫時隱藏待審核", desc: `偵測到：${(res as any).reason}`, durationMs: 5000 });
      } else {
        showToast({ icon: "✅", title: "已留言", desc: "", durationMs: 2000 });
      }
    } catch (e: any) {
      showToast({ icon: "❌", title: "留言失敗", desc: e?.message ?? String(e), durationMs: 3500 });
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      <Header />
      <div className="max-w-3xl mx-auto p-4">
        <button onClick={() => navigate("/collection-square")} className="flex items-center text-sm text-gray-600 mb-3 hover:text-gray-900">
          <ChevronLeft className="w-4 h-4" /> 返回藏品廣場
        </button>

        {(post as any).isHidden && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded mb-3 flex gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div>
              <div className="font-semibold">此帖文已被隱藏</div>
              {(post as any).flagReason && <div className="text-xs mt-1">原因：{(post as any).flagReason}</div>}
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg border overflow-hidden">
          {/* Image */}
          {images.length > 0 && (
            <div>
              <div className="aspect-square bg-gray-100">
                <img src={images[activeImageIdx]?.imageUrl} alt="" className="w-full h-full object-contain" />
              </div>
              {images.length > 1 && (
                <div className="flex gap-2 p-2 overflow-x-auto">
                  {images.map((img: any, i: number) => (
                    <button
                      key={img.id}
                      onClick={() => setActiveImageIdx(i)}
                      className={`shrink-0 w-16 h-16 rounded border overflow-hidden ${i === activeImageIdx ? "border-amber-500 ring-2 ring-amber-200" : "border-gray-200"}`}
                    >
                      <img src={img.imageUrl} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">{intentBadge(post.intent)}</div>
                <h1 className="text-xl font-bold text-gray-900">{post.title}</h1>
              </div>
              {(isOwner || isAdmin) && (
                <Button size="sm" variant="ghost" onClick={handleDelete} className="text-red-600">
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>

            {/* author */}
            <div className="flex items-center gap-2 text-sm">
              {(post as any).author?.photoUrl ? (
                <img src={(post as any).author.photoUrl} alt="" className="w-7 h-7 rounded-full object-cover" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-gray-200" />
              )}
              <span className="text-gray-700">{(post as any).author?.name ?? "匿名"}</span>
              {(post as any).authorIsMerchant && <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">商戶</Badge>}
              <span className="text-gray-400 text-xs ml-auto flex items-center gap-2">
                <span className="flex items-center gap-0.5"><Eye className="w-3 h-3" />{post.viewCount}</span>
              </span>
            </div>

            {post.body && <div className="text-sm text-gray-800 whitespace-pre-wrap">{post.body}</div>}

            {(post as any).tags?.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {(post as any).tags.map((t: string) => (
                  <span key={t} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">#{t}</span>
                ))}
              </div>
            )}

            {/* For sale CTA */}
            {post.intent === "for_sale" && (
              <div className="border border-amber-300 bg-amber-50 rounded p-3 text-sm space-y-2">
                <div className="font-semibold text-amber-900">想出讓呢件藏品？</div>
                {(post as any).authorIsMerchant ? (
                  <div className="text-amber-800 text-xs">藏家係已開通商戶，可以前往佢嘅商戶頁面查詢正式上架嘅商品／拍賣。</div>
                ) : isOwner ? (
                  <>
                    <div className="text-amber-800 text-xs">你需要先開通商戶身份，先可以正式上架拍賣／商品銷售。</div>
                    <Link href="/merchant-apply" className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-500 text-white rounded text-xs hover:bg-amber-600">
                      <Store className="w-3 h-3" /> 申請開通商戶
                    </Link>
                  </>
                ) : (
                  <div className="text-amber-800 text-xs">如想了解，請喺下方留言查詢；正式交易需藏家開通商戶後在拍賣／商品頁進行。</div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2 pt-2 border-t">
              <Button
                size="sm"
                variant={(post as any).isLiked ? "default" : "outline"}
                onClick={() => {
                  if (!isAuthenticated) { navigate(`/login?from=${encodeURIComponent(`/collection-square/${id}`)}`); return; }
                  toggleLike.mutate({ postId: id });
                }}
                className={(post as any).isLiked ? "bg-red-500 hover:bg-red-600 text-white" : ""}
              >
                <Heart className={`w-4 h-4 mr-1 ${(post as any).isLiked ? "fill-white" : ""}`} />
                {post.likeCount}
              </Button>
              <Button
                size="sm"
                variant={(post as any).isSaved ? "default" : "outline"}
                onClick={() => {
                  if (!isAuthenticated) { navigate(`/login?from=${encodeURIComponent(`/collection-square/${id}`)}`); return; }
                  toggleSave.mutate({ postId: id });
                }}
                className={(post as any).isSaved ? "bg-amber-500 hover:bg-amber-600 text-white" : ""}
              >
                <Bookmark className={`w-4 h-4 mr-1 ${(post as any).isSaved ? "fill-white" : ""}`} />
                收藏
              </Button>
              <span className="ml-auto flex items-center text-sm text-gray-600">
                <MessageCircle className="w-4 h-4 mr-1" />{post.commentCount}
              </span>
              {isAdmin && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => adminSetHidden.mutate({ postId: id, hidden: !(post as any).isHidden })}
                  className="text-xs"
                >
                  {(post as any).isHidden ? "取消隱藏" : "隱藏"}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Comments */}
        <div className="bg-white rounded-lg border mt-4 p-4">
          <h2 className="font-semibold mb-3">留言（{comments?.length ?? 0}）</h2>

          <div className="space-y-3 mb-4">
            {comments?.length === 0 && <div className="text-sm text-gray-400 text-center py-6">仲未有留言，做第一個！</div>}
            {comments?.map((c: any) => (
              <div key={c.id} className={`flex gap-2 ${c.isHidden ? "opacity-50" : ""}`}>
                {c.authorPhoto ? (
                  <img src={c.authorPhoto} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gray-200 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span className="font-medium text-gray-700">{c.authorName ?? "匿名"}</span>
                    <span>{new Date(c.createdAt).toLocaleString("zh-HK")}</span>
                    {c.isHidden ? <span className="text-red-500">[已隱藏]</span> : null}
                  </div>
                  <div className="text-sm text-gray-800 whitespace-pre-wrap">{c.content}</div>
                </div>
                {(user?.id === c.userId || isAdmin) && (
                  <button
                    onClick={async () => {
                      const ok = await confirm({ title: "刪除留言？", confirmText: "刪除", cancelText: "取消" });
                      if (!ok) return;
                      await deleteComment.mutateAsync({ commentId: c.id });
                    }}
                    className="text-gray-400 hover:text-red-600 flex-shrink-0"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {isAuthenticated ? (
            <div className="space-y-2">
              <Textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="留言（請勿留聯絡方式／價格／外部連結）"
                rows={2}
                maxLength={1000}
              />
              <Button onClick={handleSubmitComment} disabled={addComment.isPending || !commentText.trim()} className="bg-amber-500 hover:bg-amber-600 text-white">
                發送留言
              </Button>
            </div>
          ) : (
            <Button onClick={() => navigate(`/login?from=${encodeURIComponent(`/collection-square/${id}`)}`)} variant="outline">登入後留言</Button>
          )}
        </div>
      </div>
    </div>
  );
}
