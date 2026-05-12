import { useState, useMemo } from "react";
import { Link } from "wouter";
import AdminHeader from "@/components/AdminHeader";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useConfirm } from "@/components/ui/confirm-provider";
import { toast } from "sonner";
import {
  ShieldAlert, Search, Eye, Pencil, Calendar, Package, Store,
  AlertTriangle, Layers, CheckCircle2, FileEdit, XCircle, Lock, Globe, Filter, Download
} from "lucide-react";

function fmtEnd(d: string | Date): string {
  const dt = new Date(d);
  return dt.toLocaleString("zh-HK", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
}

type StatusFilter = "all" | "draft" | "published" | "ended";

function StatCard({
  icon, label, value, color, active, onClick,
}: {
  icon: React.ReactNode; label: string; value: number; color: string;
  active?: boolean; onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-xl border-2 p-3 transition-all ${
        active ? `${color} shadow-md scale-[1.02]` : "bg-white border-amber-100 hover:border-amber-200 hover:shadow-sm"
      }`}
    >
      <div className="flex items-center gap-2">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${active ? "bg-white/30" : "bg-amber-50"}`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-[11px] font-medium ${active ? "text-white/90" : "text-muted-foreground"}`}>{label}</p>
          <p className={`text-xl font-bold ${active ? "text-white" : "text-amber-900"}`}>{value}</p>
        </div>
      </div>
    </button>
  );
}

export default function AdminSessions() {
  const { user, loading } = useAuth();
  const confirm = useConfirm();
  const utils = trpc.useUtils();

  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [teardownTarget, setTeardownTarget] = useState<{ id: number; title: string } | null>(null);
  const [teardownTitleInput, setTeardownTitleInput] = useState("");

  const { data: sessions, isLoading } = trpc.merchantSessions.adminListAll.useQuery(
    {},
    { enabled: !!user && user.role === "admin", refetchInterval: 30000 }
  );

  const teardownMut = trpc.merchantSessions.adminTeardown.useMutation({
    onSuccess: (res) => {
      toast.success(`已拆除「${teardownTarget?.title}」｜${res.itemCount} 件商品已還原｜${res.bidsCleared} 條出價已清除`);
      setTeardownTarget(null);
      setTeardownTitleInput("");
      utils.merchantSessions.adminListAll.invalidate();
    },
    onError: (err) => toast.error(err.message || "拆除失敗"),
  });

  const counts = useMemo(() => {
    const c = { all: 0, draft: 0, published: 0, ended: 0 };
    if (sessions) {
      c.all = sessions.length;
      for (const s of sessions as any[]) {
        if (s.status === "draft") c.draft++;
        else if (s.status === "published") c.published++;
        else if (s.status === "ended") c.ended++;
      }
    }
    return c;
  }, [sessions]);

  const filtered = useMemo(() => {
    if (!sessions) return [] as any[];
    const k = keyword.trim().toLowerCase();
    return (sessions as any[]).filter((s) => {
      if (statusFilter !== "all" && s.status !== statusFilter) return false;
      if (!k) return true;
      return (
        String(s.title || "").toLowerCase().includes(k) ||
        String(s.merchantName || "").toLowerCase().includes(k) ||
        String(s.slug || "").toLowerCase().includes(k) ||
        String(s.id) === k
      );
    });
  }, [sessions, keyword, statusFilter]);

  const handleTeardownClick = async (s: any) => {
    const ok1 = await confirm({
      title: "拆除整個專場？",
      description: `「${s.title}」（商戶：${s.merchantName}）將被完全移除。所有商品會還原成主站獨立拍賣（草稿→草稿、流拍→流拍、其他→active +7 日）。`,
      tone: "danger",
      confirmText: "我知道，繼續",
      cancelText: "取消",
    });
    if (!ok1) return;
    const ok2 = await confirm({
      title: "再三確認",
      description: "所有會員嘅出價紀錄會永久刪除（bids / proxyBids / proxyBidLogs）。最後一步會要求逐字輸入專場名。",
      tone: "danger",
      confirmText: "我明白，下一步",
      cancelText: "返回",
    });
    if (!ok2) return;
    setTeardownTarget({ id: s.id, title: s.title });
    setTeardownTitleInput("");
  };

  if (loading) return <div className="p-6">載入中...</div>;
  if (!user || user.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-red-600">需要管理員權限</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50/60 via-white to-white pt-20 px-4 pb-20">
      <AdminHeader />
      <div className="max-w-5xl mx-auto">
        {/* Hero header */}
        <div className="mb-6 rounded-2xl p-5 bg-gradient-to-br from-rose-500 via-rose-600 to-amber-600 text-white shadow-lg">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center shrink-0">
              <ShieldAlert className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold tracking-tight">商戶專場管理</h1>
              <p className="text-sm text-white/85 mt-0.5">
                管理員專用｜拆除會清除所有出價紀錄並還原商品狀態（不可逆）
              </p>
            </div>
          </div>
        </div>

        {/* Stat / Filter cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <StatCard
            icon={<Layers className={`w-4 h-4 ${statusFilter === "all" ? "text-white" : "text-amber-600"}`} />}
            label="全部" value={counts.all} color="bg-amber-600 border-amber-600 text-white"
            active={statusFilter === "all"} onClick={() => setStatusFilter("all")}
          />
          <StatCard
            icon={<CheckCircle2 className={`w-4 h-4 ${statusFilter === "published" ? "text-white" : "text-emerald-600"}`} />}
            label="已發布" value={counts.published} color="bg-emerald-600 border-emerald-600 text-white"
            active={statusFilter === "published"} onClick={() => setStatusFilter("published")}
          />
          <StatCard
            icon={<FileEdit className={`w-4 h-4 ${statusFilter === "draft" ? "text-white" : "text-gray-500"}`} />}
            label="草稿" value={counts.draft} color="bg-gray-600 border-gray-600 text-white"
            active={statusFilter === "draft"} onClick={() => setStatusFilter("draft")}
          />
          <StatCard
            icon={<XCircle className={`w-4 h-4 ${statusFilter === "ended" ? "text-white" : "text-rose-500"}`} />}
            label="已結束" value={counts.ended} color="bg-rose-600 border-rose-600 text-white"
            active={statusFilter === "ended"} onClick={() => setStatusFilter("ended")}
          />
        </div>

        {/* Search */}
        <div className="mb-4 relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜尋場名 / 商戶 / slug / ID..."
            className="pl-9 bg-white border-amber-200 focus-visible:ring-amber-300"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
          {(keyword || statusFilter !== "all") && (
            <div className="mt-2 text-xs text-muted-foreground flex items-center gap-1.5">
              <Filter className="w-3 h-3" />
              顯示 {filtered.length} / {counts.all} 個專場
              {(keyword || statusFilter !== "all") && (
                <button
                  className="text-amber-700 hover:text-amber-900 hover:underline ml-1"
                  onClick={() => { setKeyword(""); setStatusFilter("all"); }}
                >
                  清除篩選
                </button>
              )}
            </div>
          )}
        </div>

        {/* List */}
        {isLoading ? (
          <div className="text-center py-16">
            <div className="inline-block w-8 h-8 border-2 border-amber-300 border-t-amber-600 rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground mt-3">載入中...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 rounded-2xl border-2 border-dashed border-amber-100 bg-amber-50/30">
            <Layers className="w-10 h-10 text-amber-300 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">沒有符合條件的專場</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((s: any) => {
              const statusMeta =
                s.status === "published"
                  ? { label: "已發布", icon: <CheckCircle2 className="w-3 h-3" />, cls: "bg-emerald-100 text-emerald-700 border-emerald-300" }
                  : s.status === "draft"
                    ? { label: "草稿", icon: <FileEdit className="w-3 h-3" />, cls: "bg-gray-100 text-gray-600 border-gray-300" }
                    : { label: "已結束", icon: <XCircle className="w-3 h-3" />, cls: "bg-rose-100 text-rose-700 border-rose-300" };
              return (
                <div
                  key={s.id}
                  className="group bg-white rounded-2xl border border-amber-100 hover:border-amber-300 hover:shadow-md transition-all overflow-hidden"
                >
                  <div className="flex items-stretch">
                    {/* Cover thumb */}
                    <div className="w-24 sm:w-32 shrink-0 bg-gradient-to-br from-amber-100 to-amber-200 flex items-center justify-center overflow-hidden">
                      {s.coverImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={s.coverImage} alt={s.title} className="w-full h-full object-cover" />
                      ) : (
                        <Layers className="w-8 h-8 text-amber-400" />
                      )}
                    </div>

                    {/* Body */}
                    <div className="flex-1 min-w-0 p-3 sm:p-4 flex flex-col gap-2">
                      <div className="flex items-start gap-2 flex-wrap">
                        <h3 className="font-semibold text-amber-900 truncate flex-1 min-w-0">{s.title}</h3>
                        <Badge variant="outline" className={`gap-1 ${statusMeta.cls}`}>
                          {statusMeta.icon} {statusMeta.label}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={s.visibility === "unlisted"
                            ? "bg-amber-50 text-amber-700 border-amber-300 gap-1"
                            : "bg-blue-50 text-blue-700 border-blue-200 gap-1"}
                        >
                          {s.visibility === "unlisted" ? <Lock className="w-3 h-3" /> : <Globe className="w-3 h-3" />}
                          {s.visibility === "unlisted" ? "隱藏" : "公開"}
                        </Badge>
                      </div>

                      <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="inline-flex items-center gap-1"><Store className="w-3 h-3 text-amber-600" /> {s.merchantName}</span>
                        <span className="inline-flex items-center gap-1"><Package className="w-3 h-3 text-amber-600" /> {s.itemCount} 件</span>
                        <span className="inline-flex items-center gap-1"><Calendar className="w-3 h-3 text-amber-600" /> {fmtEnd(s.endAt)}</span>
                      </div>
                      <div className="text-[11px] text-gray-400 truncate">
                        ID #{s.id} ｜ /s/{s.merchantUserId}/{s.slug}
                      </div>

                      <div className="flex items-center gap-2 flex-wrap pt-1">
                        <Link href={`/s/${s.merchantUserId}/${s.slug}`}>
                          <Button size="sm" variant="outline" className="gap-1.5 h-8 border-amber-200 text-amber-700 hover:bg-amber-50">
                            <Eye className="w-3.5 h-3.5" /> 公開頁
                          </Button>
                        </Link>
                        <Link href={`/merchant/sessions/${s.id}`}>
                          <Button size="sm" variant="outline" className="gap-1.5 h-8 border-amber-200 text-amber-700 hover:bg-amber-50">
                            <Pencil className="w-3.5 h-3.5" /> 編輯
                          </Button>
                        </Link>
                        {s.status === "ended" && (
                          <a
                            href={`/merchant/sessions/${s.id}/print/report`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 h-8 px-3 text-xs rounded-md border border-amber-200 text-amber-700 hover:bg-amber-50 font-medium"
                            data-testid={`btn-admin-pdf-${s.id}`}
                          >
                            <Download className="w-3.5 h-3.5" /> 報表 PDF
                          </a>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 h-8 border-rose-300 text-rose-600 hover:bg-rose-50 ml-auto"
                          onClick={() => handleTeardownClick(s)}
                        >
                          <ShieldAlert className="w-3.5 h-3.5" /> 拆除
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Teardown step-3 dialog: title typing */}
      <Dialog
        open={!!teardownTarget}
        onOpenChange={(open) => {
          if (!open) {
            setTeardownTarget(null);
            setTeardownTitleInput("");
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-700">
              <AlertTriangle className="w-5 h-5" /> 最後確認：逐字輸入專場名
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-sm text-rose-800">
              請輸入完整專場名稱「<b>{teardownTarget?.title}</b>」以確認拆除。
            </div>
            <Input
              autoFocus
              value={teardownTitleInput}
              onChange={(e) => setTeardownTitleInput(e.target.value)}
              placeholder={teardownTarget?.title || ""}
            />
            <p className="text-xs text-muted-foreground">
              此動作不可逆轉。所有出價、代理出價、中拍紀錄都會清除。商品將還原成獨立主站拍賣（草稿→草稿、流拍→流拍、其他→active +7 日）。
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setTeardownTarget(null);
                setTeardownTitleInput("");
              }}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              disabled={
                teardownTitleInput.trim() !== (teardownTarget?.title || "").trim() ||
                teardownMut.isPending
              }
              onClick={() => {
                if (!teardownTarget) return;
                teardownMut.mutate({
                  sessionId: teardownTarget.id,
                  confirmTitle: teardownTitleInput.trim(),
                });
              }}
            >
              {teardownMut.isPending ? "拆除中..." : "確認拆除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
