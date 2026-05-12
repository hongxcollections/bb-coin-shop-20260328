import { useMemo, useState } from "react";
import { Link, useRoute } from "wouter";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useConfirm } from "@/components/ui/confirm-provider";
import { toast } from "sonner";
import { ChevronLeft, Plus, Trash2, Save, Eye, Send, X, Clock } from "lucide-react";

function fmtDateTimeLocal(d: Date) {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmtEndTime(d: Date | string) {
  const date = new Date(d);
  return date.toLocaleString("zh-HK", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
}

function getCurrencySymbol(c?: string) {
  switch (c) {
    case "USD": return "US$"; case "CNY": return "¥"; case "GBP": return "£";
    case "EUR": return "€"; case "JPY": return "¥"; default: return "HK$";
  }
}

function statusLabel(s: string, hasWinner: boolean) {
  if (s === "active") return { txt: "競拍中", cls: "bg-green-50 text-green-700" };
  if (s === "draft") return { txt: "草稿", cls: "bg-amber-50 text-amber-700" };
  if ((s === "ended" || s === "archived") && !hasWinner) return { txt: "流拍", cls: "bg-orange-50 text-orange-700" };
  if (s === "ended" || s === "sold") return { txt: "已結束", cls: "bg-gray-100 text-gray-600" };
  return { txt: s, cls: "bg-gray-100 text-gray-600" };
}

export default function MerchantSessionEdit() {
  const { user } = useAuth();
  const confirm = useConfirm();
  const [, params] = useRoute<{ id: string }>("/merchant/sessions/:id");
  const sessionId = params ? parseInt(params.id, 10) : 0;

  const { data, isLoading, refetch } = trpc.merchantSessions.getMine.useQuery(
    { id: sessionId },
    {
      enabled: sessionId > 0,
      // 每 15 秒 refetch，價錢／最高出價者實時更新
      refetchInterval: 15000,
      refetchOnWindowFocus: true,
    }
  );
  const { data: myEligible } = trpc.merchantSessions.myEligibleAuctions.useQuery(undefined, { enabled: !!user });

  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    title: "", description: "", coverImage: "",
    endAt: "", visibility: "public" as "public" | "unlisted",
  });
  const [showPicker, setShowPicker] = useState(false);
  const [pickedIds, setPickedIds] = useState<Set<number>>(new Set());

  const updateMut = trpc.merchantSessions.update.useMutation({
    onSuccess: () => { toast.success("已儲存"); setEditing(false); refetch(); },
    onError: (e) => toast.error(e.message || "儲存失敗"),
  });
  const addItemsMut = trpc.merchantSessions.addItems.useMutation({
    onSuccess: ({ added, skipped }) => {
      toast.success(`加入 ${added} 件${skipped > 0 ? `（${skipped} 件已存在）` : ""}`);
      setShowPicker(false); setPickedIds(new Set()); refetch();
    },
    onError: (e) => toast.error(e.message || "加入失敗"),
  });
  const removeItemMut = trpc.merchantSessions.removeItem.useMutation({
    onSuccess: (_d, vars) => {
      toast.success(vars.archiveAuction ? "已移除並收返做流拍（隱藏）" : "已移除");
      refetch();
    },
    onError: (e) => toast.error(e.message || "移除失敗"),
  });
  const publishMut = trpc.merchantSessions.publish.useMutation({
    onSuccess: ({ activated }) => {
      toast.success(activated > 0 ? `已發佈，自動上架 ${activated} 件商品` : "已發佈");
      refetch();
    },
    onError: (e) => toast.error(e.message || "發佈失敗"),
  });
  const bulkPublishMut = trpc.merchantSessions.bulkPublishItems.useMutation({
    onSuccess: ({ published }) => { toast.success(published > 0 ? `已上架 ${published} 件商品（endTime 設為場結束時間）` : "冇可上架嘅商品"); refetch(); },
    onError: (e) => toast.error(e.message || "操作失敗"),
  });

  // 移除 item 時嘅 3-option dialog（只喺 published session + 該 auction 為 active 時用）
  const [removeTarget, setRemoveTarget] = useState<{ auctionId: number; title: string } | null>(null);

  const session = data?.session;
  const items = data?.items || [];
  const itemAuctionIds = useMemo(() => new Set(items.map(it => it.auctionId)), [items]);

  // 商戶可揀嘅 auction：自己嘅 draft + 流拍（未喺 session 入面）
  const allEligible = useMemo(() => {
    return ((myEligible || []) as any[]).filter((a: any) => a && a.id && !itemAuctionIds.has(a.id));
  }, [myEligible, itemAuctionIds]);

  function startEdit() {
    if (!session) return;
    setEditForm({
      title: session.title,
      description: session.description || "",
      coverImage: session.coverImage || "",
      endAt: fmtDateTimeLocal(new Date(session.endAt)),
      visibility: session.visibility,
    });
    setEditing(true);
  }
  function saveEdit() {
    if (!sessionId) return;
    const endAt = new Date(editForm.endAt);
    if (isNaN(endAt.getTime())) { toast.error("結束時間格式錯誤"); return; }
    updateMut.mutate({
      id: sessionId,
      title: editForm.title.trim(),
      description: editForm.description.trim() || null,
      coverImage: editForm.coverImage.trim() || null,
      endAt,
      visibility: editForm.visibility,
    });
  }

  if (isLoading) return <div className="min-h-screen bg-amber-50/30"><Header /><div className="text-center py-12">載入中...</div></div>;
  if (!session) return <div className="min-h-screen bg-amber-50/30"><Header /><div className="text-center py-12 text-gray-500">專場不存在</div></div>;

  const isLocked = session.status === "ended";
  const isPublished = session.status === "published";
  // 計「需要上架」嘅商品：draft 或 流拍（status=ended 但無人贏）
  const needPublishCount = items.filter(it => {
    const a = it.auction as any;
    if (!a) return false;
    if (a.status === "draft") return true;
    if (a.status === "ended" && !a.highestBidderId) return true;
    return false;
  }).length;

  return (
    <div className="min-h-screen bg-amber-50/30">
      <Header />
      <div className="container mx-auto max-w-3xl px-4 py-6 pb-20">
        <Link href="/merchant/sessions" className="inline-flex items-center gap-1 text-sm text-amber-700 hover:underline mb-3">
          <ChevronLeft className="w-4 h-4" /> 返回專場列表
        </Link>

        <div className="bg-white border border-amber-100 rounded-2xl p-4 mb-4">
          {!editing ? (
            <>
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h1 className="text-xl font-bold text-amber-900">{session.title}</h1>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      session.status === "published" ? "bg-green-100 text-green-700"
                      : session.status === "ended" ? "bg-gray-100 text-gray-600"
                      : "bg-amber-100 text-amber-700"
                    }`}>
                      {session.status === "published" ? "已發佈" : session.status === "ended" ? "已結束" : "草稿"}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    結束 {new Date(session.endAt).toLocaleString("zh-HK", { hour12: false })}
                    {" · "}{session.visibility === "public" ? "公開" : "半私密"}
                    {" · "}/s/{user?.id}/{session.slug}
                  </p>
                  {session.description && <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">{session.description}</p>}
                  {session.coverImage && (
                    <img src={session.coverImage} alt="cover" className="mt-2 max-h-32 rounded-lg object-cover" />
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                {!isLocked && <Button size="sm" variant="outline" onClick={startEdit}>編輯資料</Button>}
                {session.status !== "draft" && (
                  <a href={`/s/${user?.id}/${session.slug}`} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="outline"><Eye className="w-3.5 h-3.5 mr-1" /> 查看公開頁</Button>
                  </a>
                )}
                {session.status === "draft" && (
                  <Button size="sm" className="bg-green-600 hover:bg-green-700"
                    onClick={() => publishMut.mutate({ id: sessionId })}>
                    <Send className="w-3.5 h-3.5 mr-1" /> 發佈
                  </Button>
                )}
                {isPublished && needPublishCount > 0 && (
                  <Button size="sm" variant="outline" className="border-blue-300 text-blue-700"
                    onClick={async () => {
                      const ok = await confirm({ title: `批量上架 ${needPublishCount} 件商品`, description: "將呢場入面所有未上架（草稿／流拍）商品變成競拍中，endTime 設為場結束時間。", confirmText: "全部上架", cancelText: "取消" });
                      if (ok) bulkPublishMut.mutate({ sessionId });
                    }}>
                    一鍵上架 {needPublishCount} 件
                  </Button>
                )}
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <div><Label>專場名稱</Label><Input value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} maxLength={200} /></div>
              <div><Label>簡介</Label><Textarea rows={3} value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} maxLength={2000} /></div>
              <div><Label>封面圖 URL</Label><Input value={editForm.coverImage} onChange={(e) => setEditForm({ ...editForm, coverImage: e.target.value })} /></div>
              <div><Label>結束時間</Label><Input type="datetime-local" value={editForm.endAt} onChange={(e) => setEditForm({ ...editForm, endAt: e.target.value })} /></div>
              <div>
                <Label>公開設定</Label>
                <Select value={editForm.visibility} onValueChange={(v) => setEditForm({ ...editForm, visibility: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">公開</SelectItem>
                    <SelectItem value="unlisted">半私密（只 URL 入到）</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setEditing(false)}>取消</Button>
                <Button onClick={saveEdit} disabled={updateMut.isPending} className="bg-amber-600 hover:bg-amber-700">
                  <Save className="w-3.5 h-3.5 mr-1" /> 儲存
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-amber-900">專場商品 ({items.length})</h2>
          {!isLocked && (
            <Button size="sm" onClick={() => setShowPicker(true)} className="bg-amber-600 hover:bg-amber-700">
              <Plus className="w-3.5 h-3.5 mr-1" /> 加入拍賣品
            </Button>
          )}
        </div>

        {items.length === 0 ? (
          <div className="text-center bg-white rounded-2xl border border-amber-100 p-6 text-gray-500 text-sm">
            仲未加入任何拍賣品。
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((it) => {
              const a = it.auction as any;
              if (!a) return (
                <div key={it.id} className="bg-white border border-amber-100 rounded-xl p-3 text-xs text-rose-600">
                  Auction #{it.auctionId} 已被刪除
                  {!isLocked && (
                    <Button size="sm" variant="ghost" className="ml-2 text-rose-600"
                      onClick={() => removeItemMut.mutate({ sessionId, auctionId: it.auctionId })}>
                      移除
                    </Button>
                  )}
                </div>
              );
              const firstImg = (a.images && a.images.length > 0) ? a.images[0].imageUrl : null;
              const sl = statusLabel(a.status, !!a.highestBidderId);
              return (
                <div key={it.id} className="bg-white border border-amber-100 rounded-xl p-3 flex items-center gap-3">
                  <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-amber-100 flex items-center justify-center shrink-0">
                    {firstImg ? (
                      <img src={firstImg} alt={a.title} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-2xl">🪙</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link href={`/auctions/${a.id}`}>
                      <a className="font-medium text-sm text-amber-900 hover:underline truncate block">{a.title}</a>
                    </Link>
                    <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-2 flex-wrap">
                      <span className={`px-1.5 py-0.5 rounded ${sl.cls}`}>{sl.txt}</span>
                      <span>{getCurrencySymbol(a.currency)} {Number(a.currentPrice).toLocaleString()}</span>
                    </div>
                    <div className="text-[11px] text-gray-500 mt-0.5 inline-flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      結束 {fmtEndTime(a.endTime)}
                    </div>
                  </div>
                  {!isLocked && (
                    <Button size="sm" variant="ghost" className="text-rose-600 shrink-0"
                      onClick={async () => {
                        // 已有人出價 → 直接拒絕拆除
                        if (a.highestBidderId) {
                          toast.error("此商品已有人出價，不得從專場拆除");
                          return;
                        }
                        // Published session + auction 已 active → 彈 3-option dialog
                        if (isPublished && a.status === "active") {
                          setRemoveTarget({ auctionId: it.auctionId, title: a.title });
                          return;
                        }
                        // 其他情況：簡單 confirm
                        const desc = a.status === "active"
                          ? "Auction 本身會繼續喺主站賣到原 endTime。"
                          : "Auction 本身唔會刪除，維持現狀。";
                        const ok = await confirm({ title: "從專場移除？", description: desc, confirmText: "移除", cancelText: "取消" });
                        if (ok) removeItemMut.mutate({ sessionId, auctionId: it.auctionId, archiveAuction: false });
                      }}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Picker dialog */}
      <Dialog open={showPicker} onOpenChange={setShowPicker}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>揀拍賣品加入專場</DialogTitle></DialogHeader>
          <div className="text-xs text-gray-500 mb-2">只顯示你嘅<b>草稿（未發佈）</b>同<b>流拍（已結束無人贏）</b>auction。已結標／競拍中嘅唔可以加入。</div>
          {allEligible.length === 0 ? (
            <div className="text-center text-gray-500 py-8 text-sm">冇可加入嘅 auction。請先去「拍賣管理」建立草稿。</div>
          ) : (
            <div className="max-h-96 overflow-y-auto space-y-1">
              {allEligible.map((a: any) => {
                const checked = pickedIds.has(a.id);
                const firstImg = (a.images && a.images.length > 0) ? a.images[0].imageUrl : null;
                const sl = statusLabel(a.status, !!a.highestBidderId);
                return (
                  <label key={a.id} className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer ${checked ? "bg-amber-50 border border-amber-300" : "hover:bg-gray-50 border border-transparent"}`}>
                    <input type="checkbox" checked={checked} onChange={(e) => {
                      const next = new Set(pickedIds);
                      if (e.target.checked) next.add(a.id); else next.delete(a.id);
                      setPickedIds(next);
                    }} />
                    <div className="w-12 h-12 rounded-md overflow-hidden bg-amber-100 flex items-center justify-center shrink-0">
                      {firstImg ? (
                        <img src={firstImg} alt={a.title} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xl">🪙</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{a.title}</div>
                      <div className="text-xs text-gray-500 flex items-center gap-1.5 flex-wrap">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] ${sl.cls}`}>{sl.txt}</span>
                        <span>{getCurrencySymbol(a.currency)} {Number(a.currentPrice).toLocaleString()}</span>
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
          <DialogFooter>
            <span className="text-xs text-gray-500 mr-auto self-center">已揀 {pickedIds.size} 件</span>
            <Button variant="outline" onClick={() => { setShowPicker(false); setPickedIds(new Set()); }}><X className="w-3.5 h-3.5 mr-1" /> 取消</Button>
            <Button onClick={() => addItemsMut.mutate({ sessionId, auctionIds: Array.from(pickedIds) })}
              disabled={pickedIds.size === 0 || addItemsMut.isPending} className="bg-amber-600 hover:bg-amber-700">
              加入 ({pickedIds.size})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 移除商品 3-option dialog（published + active auction） */}
      <Dialog open={!!removeTarget} onOpenChange={(o) => { if (!o) setRemoveTarget(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>從專場移除「{removeTarget?.title}」</DialogTitle></DialogHeader>
          <div className="text-sm text-gray-700 space-y-2">
            <p>呢件商品而家已上架競拍中。從專場移除後，你想：</p>
            <ul className="text-xs text-gray-500 list-disc pl-5 space-y-1">
              <li><b>繼續喺主站賣</b> — Auction 維持 active，繼續喺主站列表出現直至原 endTime</li>
              <li><b>收返做流拍隱藏</b> — Auction 改返做已結束狀態，喺主站隱藏（適合純粹由專場 driving 嘅商品）</li>
            </ul>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setRemoveTarget(null)}>取消</Button>
            <Button variant="outline" className="border-amber-300 text-amber-700"
              disabled={removeItemMut.isPending}
              onClick={() => {
                if (!removeTarget) return;
                removeItemMut.mutate({ sessionId, auctionId: removeTarget.auctionId, archiveAuction: true });
                setRemoveTarget(null);
              }}>
              收返做流拍隱藏
            </Button>
            <Button className="bg-amber-600 hover:bg-amber-700"
              disabled={removeItemMut.isPending}
              onClick={() => {
                if (!removeTarget) return;
                removeItemMut.mutate({ sessionId, auctionId: removeTarget.auctionId, archiveAuction: false });
                setRemoveTarget(null);
              }}>
              繼續喺主站賣
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
}
