import { useMemo, useState, useEffect } from "react";
import { Link, useRoute, useLocation } from "wouter";
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
import { ChevronLeft, Plus, Trash2, Save, Eye, Send, X, Clock, ChevronUp, ChevronDown, Globe, Lock, Pencil, ShieldAlert, AlertTriangle } from "lucide-react";
import { CoverImageUpload } from "@/components/CoverImageUpload";
import { SessionShareMenu } from "@/components/ShareMenu";

function fmtDateTimeLocal(d: Date) {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmtEndTime(d: Date | string) {
  const date = new Date(d);
  return date.toLocaleString("zh-HK", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
}

function ItemCountdownOverlay({ endTime }: { endTime: Date | string }) {
  const [txt, setTxt] = useState("");
  const [urgent, setUrgent] = useState(false);
  useEffect(() => {
    function update() {
      const diff = new Date(endTime).getTime() - Date.now();
      if (diff <= 0) { setTxt("已結束"); setUrgent(false); return; }
      const totalHours = diff / 3600000;
      if (totalHours > 12) {
        const days = Math.floor(diff / 86400000);
        const remH = Math.floor((diff % 86400000) / 3600000);
        setTxt(days >= 1 ? (remH > 0 ? `${days}天${remH}h` : `${days}天`) : `${Math.floor(totalHours)}h`);
        setUrgent(false);
      } else {
        const h = Math.floor(totalHours);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        const pad = (n: number) => String(n).padStart(2, "0");
        setTxt(h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`);
        setUrgent(diff < 3600000);
      }
    }
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [endTime]);
  if (!txt) return null;
  const isEnded = txt === "已結束";
  return (
    <div className={`absolute bottom-0 left-0 right-0 px-1 py-0.5 flex items-center justify-center gap-0.5 text-[9px] font-bold leading-none ${
      isEnded ? "bg-gray-700/80 text-white" : urgent ? "bg-red-600 text-white animate-pulse" : "bg-black/55 text-white"
    }`}>
      <Clock className="w-2 h-2 shrink-0" />{txt}
    </div>
  );
}

function BidHistoryToggle({ auctionId, bidCount, currency }: { auctionId: number; bidCount: number; currency?: string }) {
  const [open, setOpen] = useState(false);
  const { data, isLoading } = trpc.auctions.auctionBidHistory.useQuery(
    { auctionId },
    { enabled: open, refetchInterval: open ? 8000 : false }
  );
  const curr = (() => {
    switch (currency) {
      case "USD": return "US$"; case "CNY": return "¥"; case "GBP": return "£";
      case "EUR": return "€"; case "JPY": return "¥"; default: return "HK$";
    }
  })();
  return (
    <span className="inline-flex flex-col">
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(o => !o); }}
        className="inline-flex items-center gap-0.5 text-amber-700 hover:text-amber-900 hover:underline"
      >
        {bidCount} 個出價
        {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>
      {open && (
        <div className="mt-1 w-full max-w-xs bg-amber-50/60 border border-amber-100 rounded-md p-2 text-[11px] space-y-0.5">
          {isLoading && <div className="text-gray-400">載入中...</div>}
          {!isLoading && (!data || data.length === 0) && <div className="text-gray-400">無出價紀錄</div>}
          {!isLoading && data && data.slice(0, 20).map((b: any) => (
            <div key={b.id} className="flex items-center justify-between gap-2">
              <span className="truncate text-gray-700">{b.username}</span>
              <span className="text-amber-700 font-semibold shrink-0">{curr}{Number(b.bidAmount).toLocaleString()}</span>
              <span className="text-gray-400 shrink-0">{new Date(b.createdAt).toLocaleString("zh-HK", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })}</span>
            </div>
          ))}
          {data && data.length > 20 && <div className="text-gray-400 text-[10px]">只顯示最近 20 條</div>}
        </div>
      )}
    </span>
  );
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
      refetchInterval: 8000,
      refetchOnWindowFocus: true,
    }
  );
  const { data: myEligible } = trpc.merchantSessions.myEligibleAuctions.useQuery(undefined, { enabled: !!user });

  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    title: "", description: "", coverImage: "",
    endAt: "", visibility: "public" as "public" | "unlisted",
    addItemsCutoffMinutes: 30,
  });
  const [showPicker, setShowPicker] = useState(false);
  const [pickedIds, setPickedIds] = useState<Set<number>>(new Set());

  const updateMut = trpc.merchantSessions.update.useMutation({
    onSuccess: () => { toast.success("已儲存"); setEditing(false); refetch(); },
    onError: (e) => toast.error(e.message || "儲存失敗"),
  });
  const addItemsMut = trpc.merchantSessions.addItems.useMutation({
    onSuccess: ({ added, skipped, revivedEnded }: any) => {
      const parts = [`加入 ${added} 件`];
      if (skipped > 0) parts.push(`${skipped} 件已存在`);
      if (revivedEnded > 0) parts.push(`其中 ${revivedEnded} 件流拍商品已重新開拍`);
      toast.success(parts.join(" ｜ "));
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

  // Admin 拆除整個專場（3 步確認 + 輸入專場名）
  const [, navigate] = useLocation();
  const [teardownOpen, setTeardownOpen] = useState(false);
  const [teardownTitle, setTeardownTitle] = useState("");
  const isAdmin = user?.role === "admin";
  const adminTeardownMut = trpc.merchantSessions.adminTeardown.useMutation({
    onSuccess: (r: any) => {
      toast.success(`已拆除專場（${r.itemCount} 件商品已還原 / ${r.bidsCleared} 條出價已清除）`);
      setTeardownOpen(false); setTeardownTitle("");
      navigate("/merchant/sessions");
    },
    onError: (e) => toast.error(e.message || "拆除失敗"),
  });
  async function handleAdminTeardownClick() {
    if (!session) return;
    const ok1 = await confirm({
      title: "拆除整個商戶專場？",
      description: `將會永久拆除「${session.title}」呢個專場。\n\n• 專場本身會被刪除\n• 所有商品會回到原狀（草稿／流拍／重新拍賣）\n• 所有會員出價／中拍紀錄全部清除\n• 動作無法復原`,
      tone: "danger",
      confirmText: "繼續",
      cancelText: "取消",
    });
    if (!ok1) return;
    const ok2 = await confirm({
      title: "再次確認",
      description: `你確定要清除呢場所有競拍紀錄？\n所有出價過嘅會員會睇到 bid history 消失。\n${items.length} 件商品會 reset 為起拍價並回到主站。`,
      tone: "danger",
      confirmText: "我明白，繼續",
      cancelText: "取消",
    });
    if (!ok2) return;
    setTeardownOpen(true);
  }

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
      addItemsCutoffMinutes: (session as any).addItemsCutoffMinutes ?? 30,
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
      addItemsCutoffMinutes: Math.max(0, Math.min(1440, Number(editForm.addItemsCutoffMinutes) || 0)),
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

        <div className="bg-gradient-to-br from-amber-500 via-amber-600 to-orange-600 rounded-2xl shadow-lg overflow-hidden mb-5">
          {!editing ? (
            <>
              {session.coverImage && (
                <div className="w-full h-40 sm:h-48 bg-amber-200 overflow-hidden">
                  <img src={session.coverImage} alt="cover" className="w-full h-full object-cover" />
                </div>
              )}
              <div className="p-5 text-white">
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <h1 className="text-2xl font-bold drop-shadow-sm">{session.title}</h1>
                  <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold ${
                    session.status === "published" ? "bg-emerald-100 text-emerald-800"
                    : session.status === "ended" ? "bg-gray-200 text-gray-700"
                    : "bg-amber-100 text-amber-900"
                  }`}>
                    {session.status === "published" ? "已發佈" : session.status === "ended" ? "已結束" : "草稿"}
                  </span>
                  <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-white/20 ${session.visibility === "unlisted" ? "" : ""}`}>
                    {session.visibility === "public" ? <><Globe className="w-3 h-3" /> 公開</> : <><Lock className="w-3 h-3" /> 半私密</>}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm text-white/90 mb-2">
                  <Clock className="w-4 h-4 shrink-0" />
                  <span>結束 {new Date(session.endAt).toLocaleString("zh-HK", { hour12: false })}</span>
                </div>
                <div className="text-[11px] text-white/70 font-mono mb-2 break-all">/s/{user?.id}/{session.slug}</div>
                {session.description && (
                  <p className="text-sm text-white/95 mt-2 whitespace-pre-wrap leading-relaxed bg-white/10 rounded-lg p-3">{session.description}</p>
                )}
              </div>
              <div className="bg-white/95 backdrop-blur px-4 py-3 flex flex-wrap gap-2 border-t border-amber-200">
                {!isLocked && <Button size="sm" variant="outline" onClick={startEdit}><Pencil className="w-3.5 h-3.5 mr-1" /> 編輯資料</Button>}
                {session.status !== "draft" && (
                  <a href={`/s/${user?.id}/${session.slug}`} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="outline"><Eye className="w-3.5 h-3.5 mr-1" /> 查看公開頁</Button>
                  </a>
                )}
                {session.status !== "draft" && user?.id && (
                  <SessionShareMenu
                    merchantUserId={user.id}
                    slug={session.slug}
                    title={session.title}
                    endTime={session.endAt}
                  />
                )}
                {session.status === "draft" && (
                  <Button size="sm" className="bg-green-600 hover:bg-green-700"
                    disabled={items.length === 0 || publishMut.isPending}
                    title={items.length === 0 ? "請先加入至少 1 件拍賣品" : undefined}
                    onClick={() => {
                      if (items.length === 0) {
                        toast.error("請先加入至少 1 件拍賣品先可以發佈專場");
                        return;
                      }
                      publishMut.mutate({ id: sessionId });
                    }}>
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
                {isAdmin && (
                  <Button size="sm" variant="outline" className="border-rose-400 text-rose-700 hover:bg-rose-50 ml-auto"
                    onClick={handleAdminTeardownClick}
                    disabled={adminTeardownMut.isPending}
                  >
                    <ShieldAlert className="w-3.5 h-3.5 mr-1" />
                    {adminTeardownMut.isPending ? "處理中..." : "Admin: 拆除整個專場"}
                  </Button>
                )}
              </div>
            </>
          ) : (
            <div className="bg-white p-5 space-y-5">
              {/* Section 1: 基本資料 */}
              <section className="space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b border-amber-100">
                  <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center"><Pencil className="w-3.5 h-3.5" /></div>
                  <h3 className="text-sm font-semibold text-amber-900">基本資料</h3>
                </div>
                <div>
                  <Label className="text-xs text-gray-600">專場名稱 <span className="text-rose-500">*</span></Label>
                  <Input
                    className="mt-1 border-amber-200 focus-visible:ring-amber-400"
                    placeholder="例：2026 春季精品專場"
                    value={editForm.title}
                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                    maxLength={200}
                  />
                  <p className="text-[10px] text-gray-400 mt-1 text-right tabular-nums">{editForm.title.length}/200</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-600">簡介</Label>
                  <Textarea
                    className="mt-1 border-amber-200 focus-visible:ring-amber-400"
                    placeholder="一段簡單介紹，會喺公開頁顯示"
                    rows={3}
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    maxLength={2000}
                  />
                  <p className="text-[10px] text-gray-400 mt-1 text-right tabular-nums">{editForm.description.length}/2000</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-600">封面圖</Label>
                  <div className="mt-1">
                    <CoverImageUpload value={editForm.coverImage} onChange={(url) => setEditForm({ ...editForm, coverImage: url })} />
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1">建議用 1200×630 橫向圖，FB／WhatsApp 分享會用呢張做預覽</p>
                </div>
              </section>

              {/* Section 2: 顯示設定 */}
              <section className="space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b border-amber-100">
                  <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center"><Globe className="w-3.5 h-3.5" /></div>
                  <h3 className="text-sm font-semibold text-amber-900">顯示設定</h3>
                </div>
                <div>
                  <Label className="text-xs text-gray-600">公開設定</Label>
                  <Select value={editForm.visibility} onValueChange={(v) => setEditForm({ ...editForm, visibility: v as any })}>
                    <SelectTrigger className="mt-1 border-amber-200 focus:ring-amber-400"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="public">公開（搜尋／分享都搵到）</SelectItem>
                      <SelectItem value="unlisted">半私密（只有知道 URL 嘅人入到）</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </section>

              {/* Section 3: 時間設定 */}
              <section className="space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b border-amber-100">
                  <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center"><Clock className="w-3.5 h-3.5" /></div>
                  <h3 className="text-sm font-semibold text-amber-900">時間設定</h3>
                </div>
                <div>
                  <Label className="text-xs text-gray-600">結束時間 <span className="text-rose-500">*</span></Label>
                  <Input
                    type="datetime-local"
                    className="mt-1 border-amber-200 focus-visible:ring-amber-400"
                    value={editForm.endAt}
                    onChange={(e) => setEditForm({ ...editForm, endAt: e.target.value })}
                  />
                  <p className="text-[10px] text-gray-500 mt-1">所有商品 endTime 會自動同步到呢個時間</p>
                </div>
                <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-3">
                  <Label className="text-xs text-amber-900 font-semibold">加品截止（結束前 N 分鐘內凍結加入新商品）</Label>
                  <div className="flex items-center gap-2 mt-1.5">
                    <Input
                      type="number" min={0} max={1440} inputMode="numeric"
                      className="border-amber-300 focus-visible:ring-amber-400 w-28"
                      value={editForm.addItemsCutoffMinutes === null || editForm.addItemsCutoffMinutes === undefined ? "" : String(editForm.addItemsCutoffMinutes)}
                      onChange={(e) => {
                        const raw = e.target.value;
                        if (raw === "") { setEditForm({ ...editForm, addItemsCutoffMinutes: "" as any }); return; }
                        const n = parseInt(raw, 10);
                        if (Number.isNaN(n)) return;
                        setEditForm({ ...editForm, addItemsCutoffMinutes: Math.max(0, Math.min(1440, n)) });
                      }}
                      onBlur={() => {
                        const v = editForm.addItemsCutoffMinutes;
                        if (v === "" as any || v === null || v === undefined || Number.isNaN(Number(v))) {
                          setEditForm({ ...editForm, addItemsCutoffMinutes: 0 });
                        }
                      }}
                    />
                    <span className="text-xs text-amber-800">分鐘</span>
                  </div>
                  <p className="text-[11px] text-amber-700 mt-1.5">避免 bidder 漏睇最後一刻加入嘅商品。設 0 = 隨時可加，預設 30。</p>
                </div>
              </section>

              <div className="flex gap-2 pt-3 border-t border-amber-100">
                <Button variant="outline" onClick={() => setEditing(false)} className="flex-1 sm:flex-initial">取消</Button>
                <Button onClick={saveEdit} disabled={updateMut.isPending} className="bg-amber-600 hover:bg-amber-700 flex-1 sm:flex-initial">
                  <Save className="w-3.5 h-3.5 mr-1" /> {updateMut.isPending ? "儲存中..." : "儲存修改"}
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-amber-900">專場商品 ({items.length})</h2>
          {!isLocked && (() => {
            const cutoffMin = (session as any).addItemsCutoffMinutes ?? 30;
            const cutoffMs = new Date(session.endAt).getTime() - cutoffMin * 60 * 1000;
            const past = isPublished && Date.now() >= cutoffMs;
            return past ? (
              <span className="text-xs text-rose-600">已過加品截止（結束前 {cutoffMin} 分鐘）</span>
            ) : (
              <Button size="sm" onClick={() => setShowPicker(true)} className="bg-amber-600 hover:bg-amber-700">
                <Plus className="w-3.5 h-3.5 mr-1" /> 加入拍賣品
              </Button>
            );
          })()}
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
              const endedByTime = new Date(a.endTime).getTime() <= Date.now();
              const effectiveStatus = (endedByTime && (a.status === "active" || a.status === "draft")) ? "ended" : a.status;
              const sl = statusLabel(effectiveStatus, !!a.highestBidderId);
              return (
                <div key={it.id} className="bg-white border border-amber-100 rounded-xl p-3 flex items-center gap-3">
                  <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-amber-100 flex items-center justify-center shrink-0">
                    {firstImg ? (
                      <img src={firstImg} alt={a.title} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-2xl">🪙</span>
                    )}
                    <ItemCountdownOverlay endTime={a.endTime} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link href={`/auctions/${a.id}`}>
                      <a className="font-medium text-sm text-amber-900 hover:underline truncate block">{a.title}</a>
                    </Link>
                    <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-2 flex-wrap">
                      <span className={`px-1.5 py-0.5 rounded ${sl.cls}`}>{sl.txt}</span>
                      <span>{getCurrencySymbol(a.currency)} {Number(a.currentPrice).toLocaleString()}</span>
                      {a.highestBidderId ? (
                        <span className="text-rose-600 font-medium">最高: {a.highestBidderName ?? '未知'}</span>
                      ) : (
                        <span className="text-gray-400">未有出價</span>
                      )}
                      {(() => {
                        const bc = Number(a.bidCount ?? 0);
                        return bc > 0 ? (
                          <BidHistoryToggle auctionId={a.id} bidCount={bc} currency={a.currency} />
                        ) : null;
                      })()}
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

      {/* Admin: 拆除確認 dialog（第 3 步：輸入專場名） */}
      <Dialog open={teardownOpen} onOpenChange={(o) => { if (!o) { setTeardownOpen(false); setTeardownTitle(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-rose-700 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" /> 最後確認：拆除整個專場
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-rose-800 text-xs leading-relaxed">
              呢個動作會：
              <ul className="list-disc ml-4 mt-1 space-y-0.5">
                <li>刪除「{session?.title}」呢個專場 + 所有 {items.length} 件商品連結</li>
                <li>清除所有出價／中拍紀錄（bids / proxyBids）</li>
                <li>商品：草稿回草稿、流拍維持流拍、其他全部 reset 為起拍價，回主站拍賣中（endTime +7 日）</li>
                <li><b>無法復原</b></li>
              </ul>
            </div>
            <div>
              <Label className="text-xs text-gray-700">請輸入專場完整名稱「<span className="font-semibold text-rose-700">{session?.title}</span>」確認：</Label>
              <Input
                className="mt-1.5 border-rose-300 focus-visible:ring-rose-400"
                value={teardownTitle}
                onChange={(e) => setTeardownTitle(e.target.value)}
                placeholder={session?.title}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setTeardownOpen(false); setTeardownTitle(""); }}>取消</Button>
            <Button
              className="bg-rose-600 hover:bg-rose-700"
              disabled={teardownTitle.trim() !== (session?.title || "").trim() || adminTeardownMut.isPending}
              onClick={() => adminTeardownMut.mutate({ sessionId, confirmTitle: teardownTitle.trim() })}
            >
              {adminTeardownMut.isPending ? "拆除中..." : "確認拆除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
}
