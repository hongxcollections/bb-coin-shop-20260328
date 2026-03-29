import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { TrendingUp, Clock, LogOut, Trash2, Facebook, Archive, X } from "lucide-react";
import { getCurrencySymbol } from "./AdminAuctions";

const RESTORE_COUNTDOWN = 10; // seconds

function formatDate(date: Date) {
  return new Date(date).toLocaleString("zh-HK", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

/** Countdown state for a pending restore */
type PendingRestore = {
  id: number;
  title: string;
  secondsLeft: number;
};

export default function AdminArchive() {
  const { user, isAuthenticated, logout } = useAuth();
  const [deletingId, setDeletingId] = useState<number | null>(null);
  // Map of auctionId → pending restore state
  const [pendingRestores, setPendingRestores] = useState<Map<number, PendingRestore>>(new Map());
  // Refs to hold interval IDs so we can clear them
  const intervalsRef = useRef<Map<number, ReturnType<typeof setInterval>>>(new Map());

  const { data: archivedList, isLoading, refetch } = trpc.auctions.getArchived.useQuery();

  const restoreAuction = trpc.auctions.restore.useMutation({
    onSuccess: (_data, variables) => {
      toast.success("已還原至後台已結束列表");
      setPendingRestores((prev) => {
        const next = new Map(prev);
        next.delete(variables.id);
        return next;
      });
      refetch();
    },
    onError: (err, variables) => {
      toast.error(err.message || "還原失敗");
      setPendingRestores((prev) => {
        const next = new Map(prev);
        next.delete(variables.id);
        return next;
      });
    },
  });

  const permanentDelete = trpc.auctions.permanentDelete.useMutation({
    onSuccess: () => {
      toast.success("已永久刪除");
      setDeletingId(null);
      refetch();
    },
    onError: (err) => {
      toast.error(err.message || "刪除失敗");
      setDeletingId(null);
    },
  });

  // Clean up all intervals on unmount
  useEffect(() => {
    return () => {
      intervalsRef.current.forEach((id) => clearInterval(id));
    };
  }, []);

  // Escape key: cancel ALL pending restores
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && pendingRestores.size > 0) {
        intervalsRef.current.forEach((intervalId) => clearInterval(intervalId));
        intervalsRef.current.clear();
        setPendingRestores(new Map());
        toast.info("已按 ESC 取消所有還原操作");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pendingRestores]);

  /** Start a 10-second countdown for a given auction, then fire the API */
  const handleRestore = (id: number, title: string) => {
    // If already pending, ignore
    if (pendingRestores.has(id)) return;

    // Register pending restore
    setPendingRestores((prev) => {
      const next = new Map(prev);
      next.set(id, { id, title, secondsLeft: RESTORE_COUNTDOWN });
      return next;
    });

    // Tick every second
    const intervalId = setInterval(() => {
      setPendingRestores((prev) => {
        const entry = prev.get(id);
        if (!entry) {
          clearInterval(intervalId);
          intervalsRef.current.delete(id);
          return prev;
        }
        const newSeconds = entry.secondsLeft - 1;
        if (newSeconds <= 0) {
          // Time's up — fire the API
          clearInterval(intervalId);
          intervalsRef.current.delete(id);
          restoreAuction.mutate({ id });
          // Keep entry in map (mutation callbacks will remove it)
          const next = new Map(prev);
          next.set(id, { ...entry, secondsLeft: 0 });
          return next;
        }
        const next = new Map(prev);
        next.set(id, { ...entry, secondsLeft: newSeconds });
        return next;
      });
    }, 1000);

    intervalsRef.current.set(id, intervalId);
  };

  /** Cancel a pending restore */
  const handleCancelRestore = (id: number) => {
    const intervalId = intervalsRef.current.get(id);
    if (intervalId !== undefined) {
      clearInterval(intervalId);
      intervalsRef.current.delete(id);
    }
    setPendingRestores((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
    toast.info("已取消還原");
  };

  const handlePermanentDelete = (id: number, title: string) => {
    if (confirm(`⚠️ 警告：此操作無法還原！\n\n確定要永久刪除「${title}」及其所有出價記錄嗎？`)) {
      setDeletingId(id);
      permanentDelete.mutate({ id });
    }
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
    id: number;
    title: string;
    description: string | null;
    startingPrice: string | number;
    currentPrice: string | number;
    highestBidderId?: number | null;
    highestBidderName?: string | null;
    endTime: Date;
    status: string;
    bidIncrement?: number;
    currency?: string;
    images: Array<{ imageUrl: string }>;
    archived: number;
  };

  return (
    <div className="min-h-screen bg-background">
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
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Archive className="w-6 h-6 text-gray-500" />
              <h1 className="text-3xl font-bold">封存區</h1>
            </div>
            <p className="text-muted-foreground mt-1">
              已封存的拍賣商品。在此可永久刪除記錄（此操作無法還原）。
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-gray-500">{archivedList?.length ?? 0}</div>
            <div className="text-xs text-muted-foreground">封存商品</div>
          </div>
        </div>

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
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : archivedList && archivedList.length > 0 ? (
          <div className="space-y-3">
            {(archivedList as ArchivedItem[]).map((auction) => {
              const images = auction.images ?? [];
              const previewImages = images.slice(0, 3);
              const currency = auction.currency ?? "HKD";
              const gain = Number(auction.currentPrice) - Number(auction.startingPrice);
              const gainPct = Number(auction.startingPrice) > 0
                ? ((gain / Number(auction.startingPrice)) * 100).toFixed(1)
                : "0";
              const isDeleting = deletingId === auction.id;
              const pending = pendingRestores.get(auction.id);
              const isRestoring = restoreAuction.isPending && !pendingRestores.has(auction.id);

              return (
                <Card
                  key={auction.id}
                  className={`border-gray-200 transition-all ${pending ? "bg-emerald-50/60 border-emerald-200" : "bg-gray-50/50 hover:border-gray-300"}`}
                >
                  <CardContent className="p-3">
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
                        <Badge className={`text-[10px] px-1.5 py-0 ${pending ? "bg-emerald-500 text-white" : "bg-gray-400 text-white"}`}>
                          {pending ? "還原中..." : "已封存"}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {pending ? (
                          /* ── Countdown + Cancel ── */
                          <div className="flex items-center gap-1.5">
                            {/* Circular countdown indicator */}
                            <div className="relative w-7 h-7 flex-shrink-0">
                              <svg className="w-7 h-7 -rotate-90" viewBox="0 0 28 28">
                                <circle cx="14" cy="14" r="11" fill="none" stroke="#d1fae5" strokeWidth="3" />
                                <circle
                                  cx="14" cy="14" r="11"
                                  fill="none"
                                  stroke="#10b981"
                                  strokeWidth="3"
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
                          /* ── Normal buttons ── */
                          <>
                            <Button
                              size="sm"
                              onClick={() => handleRestore(auction.id, auction.title)}
                              disabled={isRestoring}
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
              <Button variant="outline" className="mt-4 border-gray-300 text-gray-600">
                返回管理後台
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
