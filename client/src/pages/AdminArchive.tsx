import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  TrendingUp, Clock, LogOut, Trash2, Facebook, Archive,
  X, CheckSquare, Square, ListChecks,
} from "lucide-react";
import { getCurrencySymbol } from "./AdminAuctions";

const RESTORE_COUNTDOWN = 10; // seconds

function formatDate(date: Date) {
  return new Date(date).toLocaleString("zh-HK", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

type PendingRestore = { id: number; title: string; secondsLeft: number };

/** Shared countdown hook — starts a countdown for a set of IDs, fires callback on finish */
function useCountdown(
  onFinish: (ids: number[]) => void,
) {
  const [countdown, setCountdown] = useState<{ ids: number[]; secondsLeft: number } | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = (ids: number[]) => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setCountdown({ ids, secondsLeft: RESTORE_COUNTDOWN });
    intervalRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (!prev) return null;
        const next = prev.secondsLeft - 1;
        if (next <= 0) {
          clearInterval(intervalRef.current!);
          intervalRef.current = null;
          onFinish(prev.ids);
          return null;
        }
        return { ...prev, secondsLeft: next };
      });
    }, 1000);
  };

  const cancel = () => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    setCountdown(null);
  };

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  return { countdown, start, cancel };
}

export default function AdminArchive() {
  const { user, isAuthenticated, logout } = useAuth();
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // ── Single-item restore countdown (Map: id → state) ──
  const [pendingRestores, setPendingRestores] = useState<Map<number, PendingRestore>>(new Map());
  const intervalsRef = useRef<Map<number, ReturnType<typeof setInterval>>>(new Map());

  // ── Batch mode state ──
  const [batchMode, setBatchMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const { data: archivedList, isLoading, refetch } = trpc.auctions.getArchived.useQuery();

  // ── Mutations ──
  const restoreAuction = trpc.auctions.restore.useMutation({
    onSuccess: (_data, variables) => {
      toast.success("已還原至後台已結束列表");
      setPendingRestores((prev) => { const n = new Map(prev); n.delete(variables.id); return n; });
      refetch();
    },
    onError: (err, variables) => {
      toast.error(err.message || "還原失敗");
      setPendingRestores((prev) => { const n = new Map(prev); n.delete(variables.id); return n; });
    },
  });

  const batchRestoreMutation = trpc.auctions.batchRestore.useMutation({
    onSuccess: (data) => {
      toast.success(`已還原 ${data.succeeded} 件商品${data.skipped > 0 ? `（${data.skipped} 件略過）` : ""}`);
      setSelectedIds(new Set());
      setBatchMode(false);
      refetch();
    },
    onError: (err) => toast.error(err.message || "批次還原失敗"),
  });

  const permanentDelete = trpc.auctions.permanentDelete.useMutation({
    onSuccess: () => { toast.success("已永久刪除"); setDeletingId(null); refetch(); },
    onError: (err) => { toast.error(err.message || "刪除失敗"); setDeletingId(null); },
  });

  // ── Batch countdown ──
  const batchCountdown = useCountdown((ids) => batchRestoreMutation.mutate({ ids }));

  // ── Cleanup single-item intervals on unmount ──
  useEffect(() => () => { intervalsRef.current.forEach((id) => clearInterval(id)); }, []);

  // ── Escape key: cancel single + batch countdowns ──
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      let cancelled = false;
      if (pendingRestores.size > 0) {
        intervalsRef.current.forEach((id) => clearInterval(id));
        intervalsRef.current.clear();
        setPendingRestores(new Map());
        cancelled = true;
      }
      if (batchCountdown.countdown) {
        batchCountdown.cancel();
        cancelled = true;
      }
      if (cancelled) toast.info("已按 ESC 取消所有還原操作");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pendingRestores, batchCountdown]);

  // ── Single-item restore ──
  const handleRestore = (id: number, title: string) => {
    if (pendingRestores.has(id)) return;
    setPendingRestores((prev) => { const n = new Map(prev); n.set(id, { id, title, secondsLeft: RESTORE_COUNTDOWN }); return n; });
    const intervalId = setInterval(() => {
      setPendingRestores((prev) => {
        const entry = prev.get(id);
        if (!entry) { clearInterval(intervalId); intervalsRef.current.delete(id); return prev; }
        const secs = entry.secondsLeft - 1;
        if (secs <= 0) {
          clearInterval(intervalId); intervalsRef.current.delete(id);
          restoreAuction.mutate({ id });
          const n = new Map(prev); n.set(id, { ...entry, secondsLeft: 0 }); return n;
        }
        const n = new Map(prev); n.set(id, { ...entry, secondsLeft: secs }); return n;
      });
    }, 1000);
    intervalsRef.current.set(id, intervalId);
  };

  const handleCancelRestore = (id: number) => {
    const iid = intervalsRef.current.get(id);
    if (iid !== undefined) { clearInterval(iid); intervalsRef.current.delete(id); }
    setPendingRestores((prev) => { const n = new Map(prev); n.delete(id); return n; });
    toast.info("已取消還原");
  };

  const handlePermanentDelete = (id: number, title: string) => {
    if (confirm(`⚠️ 警告：此操作無法還原！\n\n確定要永久刪除「${title}」及其所有出價記錄嗎？`)) {
      setDeletingId(id); permanentDelete.mutate({ id });
    }
  };

  // ── Batch selection helpers ──
  const allIds = (archivedList ?? []).map((a: { id: number }) => a.id);
  const allSelected = allIds.length > 0 && allIds.every((id) => selectedIds.has(id));
  const toggleSelect = (id: number) =>
    setSelectedIds((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleSelectAll = () =>
    setSelectedIds(allSelected ? new Set() : new Set(allIds));
  const exitBatchMode = () => { setBatchMode(false); setSelectedIds(new Set()); batchCountdown.cancel(); };

  // ── Batch restore: start countdown ──
  const handleBatchRestore = () => {
    if (selectedIds.size === 0) return;
    batchCountdown.start(Array.from(selectedIds));
  };

  if (!isAuthenticated || user?.role !== "admin") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4">🔒</div>
          <p className="text-lg font-medium mb-4">需要管理員權限</p>
          <Link href="/"><Button className="gold-gradient text-white border-0">返回首頁</Button></Link>
        </div>
      </div>
    );
  }

  type ArchivedItem = {
    id: number; title: string; description: string | null;
    startingPrice: string | number; currentPrice: string | number;
    highestBidderId?: number | null; highestBidderName?: string | null;
    endTime: Date; status: string; bidIncrement?: number; currency?: string;
    images: Array<{ imageUrl: string }>; archived: number;
  };

  const bc = batchCountdown.countdown;

  return (
    <div className="min-h-screen bg-background pb-28">
      {/* Navigation */}
      <nav className="nav-glass sticky top-0 z-50">
        <div className="container flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2 font-bold text-xl">
            <span className="text-2xl">💰</span>
            <span className="gold-gradient-text">大BB錢幣店</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/admin">
              <Button variant="ghost" size="sm" className="text-amber-700 hover:text-amber-900 hover:bg-amber-50">管理後台</Button>
            </Link>
            <Link href="/admin/drafts">
              <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 gap-1">
                <Facebook className="w-3.5 h-3.5" /> 草稿審核
              </Button>
            </Link>
            <Link href="/profile">
              <Button variant="ghost" size="sm" className="text-amber-700 hover:text-amber-900 hover:bg-amber-50">{user?.name}</Button>
            </Link>
            <Button variant="outline" size="sm" onClick={logout} className="border-red-200 text-red-600 hover:bg-red-50">
              <LogOut className="w-3.5 h-3.5 mr-1" /> 登出
            </Button>
          </div>
        </div>
      </nav>

      <div className="container py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Archive className="w-6 h-6 text-gray-500" />
              <h1 className="text-3xl font-bold">封存區</h1>
            </div>
            <p className="text-muted-foreground mt-1">已封存的拍賣商品。在此可永久刪除記錄（此操作無法還原）。</p>
          </div>
          <div className="flex items-center gap-2">
            {!batchMode ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBatchMode(true)}
                disabled={!archivedList || archivedList.length === 0}
                className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 gap-1.5"
              >
                <ListChecks className="w-4 h-4" />
                批次還原
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={exitBatchMode} className="border-gray-300 text-gray-600 gap-1">
                <X className="w-3.5 h-3.5" /> 退出批次模式
              </Button>
            )}
            <div className="text-right">
              <div className="text-2xl font-bold text-gray-500">{archivedList?.length ?? 0}</div>
              <div className="text-xs text-muted-foreground">封存商品</div>
            </div>
          </div>
        </div>

        {/* Batch mode select-all bar */}
        {batchMode && (
          <div className="mb-4 flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5">
            <Checkbox
              id="select-all"
              checked={allSelected}
              onCheckedChange={toggleSelectAll}
              className="border-emerald-400 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
            />
            <label htmlFor="select-all" className="text-sm font-medium text-emerald-800 cursor-pointer select-none">
              {allSelected ? "取消全選" : "全選"}
            </label>
            <span className="text-xs text-emerald-600 ml-auto">
              已選 <span className="font-bold">{selectedIds.size}</span> / {allIds.length} 件
            </span>
          </div>
        )}

        {/* Warning Banner */}
        <div className="mb-6 flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          <span className="text-lg leading-none mt-0.5">⚠️</span>
          <div>
            <span className="font-semibold">永久刪除警告：</span>
            永久刪除後，商品資料及所有出價記錄將無法恢復。請謹慎操作。
          </div>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}
          </div>
        ) : archivedList && archivedList.length > 0 ? (
          <div className="space-y-3">
            {(archivedList as ArchivedItem[]).map((auction) => {
              const images = auction.images ?? [];
              const previewImages = images.slice(0, 3);
              const currency = auction.currency ?? "HKD";
              const gain = Number(auction.currentPrice) - Number(auction.startingPrice);
              const gainPct = Number(auction.startingPrice) > 0
                ? ((gain / Number(auction.startingPrice)) * 100).toFixed(1) : "0";
              const isDeleting = deletingId === auction.id;
              const pending = pendingRestores.get(auction.id);
              const isSelected = selectedIds.has(auction.id);
              const inBatchCountdown = bc && bc.ids.includes(auction.id);

              return (
                <Card
                  key={auction.id}
                  onClick={batchMode && !bc ? () => toggleSelect(auction.id) : undefined}
                  className={[
                    "border-gray-200 transition-all",
                    batchMode && !bc ? "cursor-pointer" : "",
                    pending || inBatchCountdown ? "bg-emerald-50/60 border-emerald-200" :
                      isSelected ? "bg-emerald-50/40 border-emerald-300 ring-1 ring-emerald-300" :
                        "bg-gray-50/50 hover:border-gray-300",
                  ].join(" ")}
                >
                  <CardContent className="p-3">
                    {/* Row 0 (batch mode): Checkbox */}
                    {batchMode && (
                      <div className="flex items-center gap-2 mb-2" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSelect(auction.id)}
                          disabled={!!bc}
                          className="border-emerald-400 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                        />
                        <span className="text-xs text-gray-500 select-none">
                          {isSelected ? "已選取" : "點擊選取"}
                        </span>
                      </div>
                    )}

                    {/* Row 1: Images */}
                    {previewImages.length > 0 && (
                      <div className="flex gap-1.5 mb-2">
                        {previewImages.map((img, i) => (
                          <div key={i} className="w-16 h-14 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100">
                            <img src={img.imageUrl} alt="" className="w-full h-full object-cover opacity-70" />
                          </div>
                        ))}
                        {images.length > 3 && (
                          <div className="w-16 h-14 rounded-lg bg-gray-100 flex items-center justify-center text-xs text-gray-400 font-medium flex-shrink-0">
                            +{images.length - 3}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Row 2: Title + Badge + Action buttons */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
                        <h3 className="font-semibold text-sm truncate max-w-[200px] text-gray-600">{auction.title}</h3>
                        <Badge className={`text-[10px] px-1.5 py-0 ${(pending || inBatchCountdown) ? "bg-emerald-500 text-white" : "bg-gray-400 text-white"}`}>
                          {(pending || inBatchCountdown) ? "還原中..." : "已封存"}
                        </Badge>
                      </div>

                      {/* Single-item action buttons (hidden in batch mode) */}
                      {!batchMode && (
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {pending ? (
                            <div className="flex items-center gap-1.5">
                              <div className="relative w-7 h-7 flex-shrink-0">
                                <svg className="w-7 h-7 -rotate-90" viewBox="0 0 28 28">
                                  <circle cx="14" cy="14" r="11" fill="none" stroke="#d1fae5" strokeWidth="3" />
                                  <circle
                                    cx="14" cy="14" r="11" fill="none" stroke="#10b981" strokeWidth="3"
                                    strokeDasharray={`${2 * Math.PI * 11}`}
                                    strokeDashoffset={`${2 * Math.PI * 11 * (1 - pending.secondsLeft / RESTORE_COUNTDOWN)}`}
                                    strokeLinecap="round"
                                    style={{ transition: "stroke-dashoffset 0.9s linear" }}
                                  />
                                </svg>
                                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-emerald-700">
                                  {pending.secondsLeft}
                                </span>
                              </div>
                              <Button
                                size="sm"
                                onClick={() => handleCancelRestore(auction.id)}
                                className="bg-gray-200 hover:bg-gray-300 text-gray-700 border-0 text-xs px-2 h-7"
                              >
                                <X className="w-3 h-3 mr-1" />
                                取消還原
                                <kbd className="ml-1.5 inline-flex items-center rounded border border-gray-400 bg-white px-1 font-mono text-[9px] text-gray-500 leading-none">ESC</kbd>
                              </Button>
                            </div>
                          ) : (
                            <>
                              <Button
                                size="sm"
                                onClick={() => handleRestore(auction.id, auction.title)}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white border-0 text-xs px-2 h-7"
                              >
                                ↩ 還原
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handlePermanentDelete(auction.id, auction.title)}
                                disabled={isDeleting || permanentDelete.isPending}
                                className="bg-red-600 hover:bg-red-700 text-white border-0 text-xs px-2 h-7"
                              >
                                <Trash2 className="w-3 h-3 mr-1" />
                                {isDeleting ? "刪除中..." : "永久刪除"}
                              </Button>
                            </>
                          )}
                        </div>
                      )}

                      {/* Batch countdown indicator per card */}
                      {batchMode && inBatchCountdown && (
                        <div className="flex-shrink-0">
                          <div className="relative w-7 h-7">
                            <svg className="w-7 h-7 -rotate-90" viewBox="0 0 28 28">
                              <circle cx="14" cy="14" r="11" fill="none" stroke="#d1fae5" strokeWidth="3" />
                              <circle
                                cx="14" cy="14" r="11" fill="none" stroke="#10b981" strokeWidth="3"
                                strokeDasharray={`${2 * Math.PI * 11}`}
                                strokeDashoffset={`${2 * Math.PI * 11 * (1 - (bc?.secondsLeft ?? 0) / RESTORE_COUNTDOWN)}`}
                                strokeLinecap="round"
                                style={{ transition: "stroke-dashoffset 0.9s linear" }}
                              />
                            </svg>
                            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-emerald-700">
                              {bc?.secondsLeft}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Row 3: Price + End time */}
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-0.5 font-medium text-gray-500">
                        <TrendingUp className="w-3 h-3 text-gray-400" />
                        {getCurrencySymbol(currency)}{Number(auction.currentPrice).toLocaleString()} {currency}
                        {gain > 0 && <span className="text-gray-400 ml-1">+{gainPct}%</span>}
                      </span>
                      <span className="flex items-center gap-0.5 text-gray-400">
                        <Clock className="w-3 h-3" />
                        {formatDate(new Date(auction.endTime))}
                      </span>
                    </div>

                    {/* Row 4: Winner info */}
                    {auction.highestBidderId ? (
                      <div className="mt-1.5 flex items-center gap-1 text-xs bg-gray-100 border border-gray-200 rounded px-2 py-0.5">
                        <span className="text-gray-400">🏆</span>
                        <span className="font-semibold text-gray-500 truncate max-w-[120px]">
                          {auction.highestBidderName ?? `用戶 #${auction.highestBidderId}`}
                        </span>
                        <span className="text-gray-300">·</span>
                        <span className="font-bold text-gray-500">
                          {getCurrencySymbol(currency)}{Number(auction.currentPrice).toLocaleString()} {currency}
                        </span>
                      </div>
                    ) : (
                      <div className="mt-1 text-xs text-gray-400 italic">未有出價，流拍</div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-20 text-muted-foreground">
            <div className="text-5xl mb-4">📭</div>
            <p className="text-lg font-medium text-gray-500">封存區暫無商品</p>
            <p className="text-sm mt-1 text-gray-400">在管理後台將已結束商品封存後，即會顯示於此處</p>
            <Link href="/admin">
              <Button variant="outline" className="mt-4 border-gray-300 text-gray-600">返回管理後台</Button>
            </Link>
          </div>
        )}
      </div>

      {/* ── Batch action bar (fixed bottom) ── */}
      {batchMode && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-emerald-200 bg-white/95 backdrop-blur-sm shadow-lg">
          <div className="container py-3 flex items-center gap-3">
            {bc ? (
              /* Countdown state */
              <>
                <div className="relative w-9 h-9 flex-shrink-0">
                  <svg className="w-9 h-9 -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="14" fill="none" stroke="#d1fae5" strokeWidth="3.5" />
                    <circle
                      cx="18" cy="18" r="14" fill="none" stroke="#10b981" strokeWidth="3.5"
                      strokeDasharray={`${2 * Math.PI * 14}`}
                      strokeDashoffset={`${2 * Math.PI * 14 * (1 - bc.secondsLeft / RESTORE_COUNTDOWN)}`}
                      strokeLinecap="round"
                      style={{ transition: "stroke-dashoffset 0.9s linear" }}
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-emerald-700">
                    {bc.secondsLeft}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-emerald-800">
                    {bc.secondsLeft} 秒後還原 {bc.ids.length} 件商品
                  </p>
                  <p className="text-xs text-emerald-600">按下取消或 ESC 可中止</p>
                </div>
                <Button
                  size="sm"
                  onClick={() => { batchCountdown.cancel(); toast.info("已取消批次還原"); }}
                  className="bg-gray-200 hover:bg-gray-300 text-gray-700 border-0 gap-1"
                >
                  <X className="w-3.5 h-3.5" />
                  取消
                  <kbd className="ml-1 inline-flex items-center rounded border border-gray-400 bg-white px-1 font-mono text-[9px] text-gray-500 leading-none">ESC</kbd>
                </Button>
              </>
            ) : (
              /* Selection state */
              <>
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {selectedIds.size > 0
                    ? <CheckSquare className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    : <Square className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                  <span className="text-sm text-gray-700">
                    已選取 <span className="font-bold text-emerald-700">{selectedIds.size}</span> 件商品
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exitBatchMode}
                  className="border-gray-300 text-gray-600"
                >
                  取消
                </Button>
                <Button
                  size="sm"
                  onClick={handleBatchRestore}
                  disabled={selectedIds.size === 0 || batchRestoreMutation.isPending}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white border-0 gap-1.5"
                >
                  ↩ 還原 {selectedIds.size > 0 ? `${selectedIds.size} 件` : ""}
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
