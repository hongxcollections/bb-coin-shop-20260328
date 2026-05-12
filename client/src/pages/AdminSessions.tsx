import { useState, useMemo } from "react";
import { Link } from "wouter";
import AdminHeader from "@/components/AdminHeader";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useConfirm } from "@/components/ui/confirm-provider";
import { toast } from "sonner";
import { ShieldAlert, Search, Eye, Pencil, Calendar, Package, Store, AlertTriangle } from "lucide-react";

function fmtEnd(d: string | Date): string {
  const dt = new Date(d);
  return dt.toLocaleString("zh-HK", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
}

export default function AdminSessions() {
  const { user, loading } = useAuth();
  const confirm = useConfirm();
  const utils = trpc.useUtils();

  const [keyword, setKeyword] = useState("");
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

  const filtered = useMemo(() => {
    if (!sessions) return [];
    const k = keyword.trim().toLowerCase();
    if (!k) return sessions;
    return sessions.filter((s: any) =>
      String(s.title || "").toLowerCase().includes(k) ||
      String(s.merchantName || "").toLowerCase().includes(k) ||
      String(s.slug || "").toLowerCase().includes(k) ||
      String(s.id) === k
    );
  }, [sessions, keyword]);

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
    <div className="min-h-screen bg-gradient-to-b from-amber-50/50 to-white pt-20 px-4 pb-20">
      <AdminHeader />
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-start gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 bg-rose-100">
            <ShieldAlert className="w-5 h-5 text-rose-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-amber-900">商戶專場管理</h1>
            <p className="text-sm text-muted-foreground">
              共 {sessions?.length || 0} 個專場 ｜ 拆除會清除所有出價紀錄並還原商品
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="mb-4 relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜尋場名 / 商戶 / slug / ID..."
            className="pl-9"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
        </div>

        {/* List */}
        {isLoading ? (
          <p className="text-center text-muted-foreground py-12">載入中...</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">沒有符合的專場</p>
        ) : (
          <div className="space-y-3">
            {filtered.map((s: any) => (
              <Card key={s.id} className="border-amber-100">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-amber-900 truncate">{s.title}</h3>
                        <Badge
                          className={
                            s.status === "published" ? "bg-emerald-100 text-emerald-700 border-emerald-200" :
                            s.status === "draft" ? "bg-gray-100 text-gray-600 border-gray-200" :
                            "bg-rose-100 text-rose-700 border-rose-200"
                          }
                          variant="outline"
                        >
                          {s.status === "published" ? "已發布" : s.status === "draft" ? "草稿" : "已結束"}
                        </Badge>
                        {s.visibility === "unlisted" && (
                          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">隱藏</Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="inline-flex items-center gap-1"><Store className="w-3 h-3" /> {s.merchantName}</span>
                        <span className="inline-flex items-center gap-1"><Package className="w-3 h-3" /> {s.itemCount} 件</span>
                        <span className="inline-flex items-center gap-1"><Calendar className="w-3 h-3" /> {fmtEnd(s.endAt)}</span>
                        <span className="text-gray-400">ID #{s.id}</span>
                        <span className="text-gray-400 truncate max-w-[160px]">/s/{s.merchantUserId}/{s.slug}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link href={`/s/${s.merchantUserId}/${s.slug}`}>
                        <Button size="sm" variant="outline" className="gap-1.5">
                          <Eye className="w-3.5 h-3.5" /> 查看公開頁
                        </Button>
                      </Link>
                      <Link href={`/merchant/sessions/${s.id}`}>
                        <Button size="sm" variant="outline" className="gap-1.5">
                          <Pencil className="w-3.5 h-3.5" /> 編輯
                        </Button>
                      </Link>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 border-rose-300 text-rose-600 hover:bg-rose-50"
                        onClick={() => handleTeardownClick(s)}
                      >
                        <ShieldAlert className="w-3.5 h-3.5" /> 拆除
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
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
