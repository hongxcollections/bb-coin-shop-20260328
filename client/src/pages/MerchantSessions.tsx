import { useState } from "react";
import { Link, useLocation } from "wouter";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useConfirm } from "@/components/ui/confirm-provider";
import { toast } from "sonner";
import { Plus, Calendar, Eye, Trash2, Send, ChevronLeft, Lock, Globe, Pencil } from "lucide-react";
import { CoverImageUpload } from "@/components/CoverImageUpload";
import { SessionShareMenu } from "@/components/ShareMenu";

function formatDateTimeLocal(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmtEnd(s: string | Date): string {
  const d = new Date(s);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

export default function MerchantSessions() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const confirm = useConfirm();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    coverImage: "",
    endAt: formatDateTimeLocal(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
    visibility: "public" as "public" | "unlisted",
    addItemsCutoffMinutes: 30,
  });

  const { data: sessions, isLoading, refetch } = trpc.merchantSessions.myList.useQuery(undefined, {
    enabled: !!user,
  });

  const createMut = trpc.merchantSessions.create.useMutation({
    onSuccess: ({ id }) => {
      toast.success("專場已建立");
      setShowCreate(false);
      refetch();
      setLocation(`/merchant/sessions/${id}`);
    },
    onError: (e) => toast.error(e.message || "建立失敗"),
  });
  const publishMut = trpc.merchantSessions.publish.useMutation({
    onSuccess: ({ activated }) => {
      toast.success(activated > 0 ? `已發佈，自動上架 ${activated} 件商品` : "已發佈");
      refetch();
    },
    onError: (e) => toast.error(e.message || "發佈失敗"),
  });
  const deleteMut = trpc.merchantSessions.delete.useMutation({
    onSuccess: () => { toast.success("已刪除"); refetch(); },
    onError: (e) => toast.error(e.message || "刪除失敗"),
  });

  function handleCreate() {
    if (!form.title.trim()) { toast.error("請輸入專場名稱"); return; }
    const endAt = new Date(form.endAt);
    if (isNaN(endAt.getTime()) || endAt.getTime() < Date.now() + 5 * 60 * 1000) {
      toast.error("結束時間至少要 5 分鐘後"); return;
    }
    createMut.mutate({
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      coverImage: form.coverImage.trim() || undefined,
      endAt,
      visibility: form.visibility,
      addItemsCutoffMinutes: form.addItemsCutoffMinutes,
    });
  }

  return (
    <div className="min-h-screen bg-amber-50/30">
      <Header />
      <div className="container mx-auto max-w-3xl px-4 py-6 pb-20">
        <Link href="/merchant-dashboard" className="inline-flex items-center gap-1 text-sm text-amber-700 hover:underline mb-3">
          <ChevronLeft className="w-4 h-4" /> 返回商戶後台
        </Link>
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-amber-900">我嘅拍賣專場</h1>
          <Button onClick={() => setShowCreate(true)} className="bg-amber-600 hover:bg-amber-700">
            <Plus className="w-4 h-4 mr-1" /> 新建專場
          </Button>
        </div>

        <div className="text-xs text-gray-500 bg-amber-100/60 border border-amber-200 rounded-xl px-3 py-2 mb-4">
          專場 = 你自己嘅小型拍賣會。建立場名 + 結束日，揀齊你嘅拍賣品加入，就會有條公開 URL（<code>/s/你嘅ID/場slug</code>）集中展示。價錢同主站 <code>/auctions/:id</code> 同步。
        </div>

        {isLoading ? (
          <div className="text-center text-gray-500 py-12">載入中...</div>
        ) : !sessions || sessions.length === 0 ? (
          <div className="text-center bg-white rounded-2xl border border-amber-100 p-8">
            <div className="text-5xl mb-3">📦</div>
            <p className="text-gray-600">仲未有任何專場。撳「新建專場」開始。</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((s) => (
              <div key={s.id} className="bg-white border border-amber-100 rounded-2xl p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-semibold text-amber-900 truncate">{s.title}</h3>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        s.status === "published" ? "bg-green-100 text-green-700"
                        : s.status === "ended" ? "bg-gray-100 text-gray-600"
                        : "bg-amber-100 text-amber-700"
                      }`}>
                        {s.status === "published" ? "已發佈" : s.status === "ended" ? "已結束" : "草稿"}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium inline-flex items-center gap-0.5">
                        {s.visibility === "public" ? <><Globe className="w-2.5 h-2.5" /> 公開</> : <><Lock className="w-2.5 h-2.5" /> 半私密</>}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold ${s.itemCount > 0 ? "bg-amber-100 text-amber-800" : "bg-gray-100 text-gray-500"}`}>
                        📦 {s.itemCount} 件商品
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> 結束 {fmtEnd(s.endAt)}
                      </span>
                      <span className="text-gray-400">/s/{user?.id}/{s.slug}</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Link href={`/merchant/sessions/${s.id}`}>
                    <Button size="sm" variant="outline"><Pencil className="w-3.5 h-3.5 mr-1" /> 編輯內容</Button>
                  </Link>
                  {s.status !== "draft" && (
                    <a href={`/s/${user?.id}/${s.slug}`} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="outline"><Eye className="w-3.5 h-3.5 mr-1" /> 查看公開頁</Button>
                    </a>
                  )}
                  {s.status !== "draft" && user?.id && (
                    <SessionShareMenu
                      merchantUserId={user.id}
                      slug={s.slug}
                      title={s.title}
                      endTime={s.endAt}
                    />
                  )}
                  {s.status === "draft" && (
                    <Button size="sm" className="bg-green-600 hover:bg-green-700"
                      disabled={s.itemCount === 0 || publishMut.isPending}
                      title={s.itemCount === 0 ? "請先加入至少 1 件拍賣品" : undefined}
                      onClick={() => {
                        if (s.itemCount === 0) {
                          toast.error("請先加入至少 1 件拍賣品先可以發佈專場");
                          return;
                        }
                        publishMut.mutate({ id: s.id });
                      }}
                    >
                      <Send className="w-3.5 h-3.5 mr-1" /> 發佈
                    </Button>
                  )}
                  {(s.status === "draft" || s.itemCount === 0) && (
                    <Button size="sm" variant="outline" className="text-rose-700 border-rose-300"
                      onClick={async () => {
                        const desc = s.status === "draft"
                          ? "只係刪 session 本身，唔影響入面嘅 auction。"
                          : "呢個專場冇商品，可直接刪除。";
                        const ok = await confirm({ title: "刪除專場？", description: desc, confirmText: "確定刪除", cancelText: "取消" });
                        if (ok) deleteMut.mutate({ id: s.id });
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1" /> 刪除
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-h-[90vh] flex flex-col gap-0 p-0">
          <DialogHeader className="px-6 pt-6 pb-3 border-b">
            <DialogTitle>新建拍賣專場</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 px-6 py-4 overflow-y-auto flex-1">
            <div>
              <Label>專場名稱 *</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="例：6月香港錢幣專拍" maxLength={200} />
            </div>
            <div>
              <Label>簡介（選填）</Label>
              <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={2000} />
            </div>
            <div>
              <Label>封面圖（選填）</Label>
              <CoverImageUpload value={form.coverImage} onChange={(url) => setForm({ ...form, coverImage: url })} />
              <p className="text-xs text-gray-400 mt-1">用於 Facebook 分享預覽，建議 1200×630</p>
            </div>
            <div>
              <Label>結束日期時間 *</Label>
              <Input type="datetime-local" value={form.endAt} onChange={(e) => setForm({ ...form, endAt: e.target.value })} />
            </div>
            <div>
              <Label>公開設定</Label>
              <Select value={form.visibility} onValueChange={(v) => setForm({ ...form, visibility: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">公開 — 商戶頁同主站搜尋見到</SelectItem>
                  <SelectItem value="unlisted">半私密 — 只可以由直接 URL 入</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>加品截止（結束前 N 分鐘內凍結加入新商品）</Label>
              <Input
                type="number" min={0} max={1440}
                value={form.addItemsCutoffMinutes}
                onChange={(e) => setForm({ ...form, addItemsCutoffMinutes: parseInt(e.target.value || "0", 10) })}
              />
              <p className="text-[11px] text-gray-500 mt-1">
                預設 30 分鐘。避免 bidder 漏睇最後一刻新加入嘅商品。設 0 = 隨時可加。事後可以喺專場內再改。
              </p>
            </div>
          </div>
          <DialogFooter className="px-6 py-4 border-t bg-amber-50/40">
            <Button variant="outline" onClick={() => setShowCreate(false)}>取消</Button>
            <Button onClick={handleCreate} disabled={createMut.isPending} className="bg-amber-600 hover:bg-amber-700">
              {createMut.isPending ? "建立中..." : "建立"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
}
