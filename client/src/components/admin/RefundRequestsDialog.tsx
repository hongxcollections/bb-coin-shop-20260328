import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Clock, AlertCircle, Inbox, Loader2, Receipt } from "lucide-react";
import { toast } from "sonner";

const REASON_LABELS: Record<string, string> = {
  buyer_missing: "買家失蹤/不回覆",
  buyer_refused: "買家拒絕付款",
  mutual_cancel: "雙方協議取消",
  other: "其他原因",
};

function StatusBadge({ status }: { status: string }) {
  if (status === "pending") return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5">
      <Clock className="w-3 h-3" /> 審核中
    </span>
  );
  if (status === "approved") return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-2 py-0.5">
      <CheckCircle2 className="w-3 h-3" /> 已批准
    </span>
  );
  if (status === "rejected") return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-red-50 text-red-500 border border-red-200 rounded-full px-2 py-0.5">
      <XCircle className="w-3 h-3" /> 已拒絕
    </span>
  );
  return <span className="text-[10px] text-gray-400">{status}</span>;
}

export function RefundRequestsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const utils = trpc.useUtils();
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");
  const [reviewId, setReviewId] = useState<number | null>(null);
  const [adminNote, setAdminNote] = useState("");

  const { data: requests, isLoading } = trpc.merchants.adminGetRefundRequests.useQuery(undefined, {
    enabled: open,
    refetchInterval: open ? 30000 : false,
  });

  const reviewMutation = trpc.merchants.adminReviewRefundRequest.useMutation({
    onSuccess: (_, vars) => {
      toast.success(vars.status === "approved" ? "已批准並退傭" : "已拒絕申請");
      utils.merchants.adminGetRefundRequests.invalidate();
      setReviewId(null);
      setAdminNote("");
    },
    onError: (err) => toast.error(`操作失敗：${err.message}`),
  });

  const handleReview = (id: number, status: "approved" | "rejected") => {
    reviewMutation.mutate({ id, status, adminNote: adminNote.trim() || undefined });
  };

  type RefundReq = {
    id: number;
    userId: number;
    merchantName?: string | null;
    auctionId: number;
    auctionTitle?: string | null;
    commissionAmount: string | number;
    reason: string;
    reasonDetail?: string | null;
    status: string;
    adminNote?: string | null;
    createdAt: Date | string | null;
  };
  const list = (requests ?? []) as RefundReq[];
  const filtered = list.filter(r => filter === "all" || r.status === filter);
  const counts = {
    pending: list.filter(r => r.status === "pending").length,
    approved: list.filter(r => r.status === "approved").length,
    rejected: list.filter(r => r.status === "rejected").length,
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0">
        {/* Hero */}
        <DialogHeader className="relative overflow-hidden bg-gradient-to-br from-orange-500 via-amber-500 to-orange-600 px-6 py-5 text-white">
          <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -bottom-10 -left-6 w-32 h-32 rounded-full bg-yellow-300/20 blur-2xl" />
          <div className="relative flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-white/20 backdrop-blur text-white text-[10px] font-medium mb-2">
                <Receipt className="w-3 h-3" />
                Commission Refund
              </div>
              <DialogTitle className="text-xl font-bold text-white tracking-tight">
                退傭申請管理
              </DialogTitle>
              <DialogDescription className="text-xs text-white/85 mt-1">
                審核商戶嘅佣金退還申請；批准後會自動退錢入返保證金。
              </DialogDescription>
            </div>
            {counts.pending > 0 && (
              <div className="bg-white/20 backdrop-blur rounded-xl px-3 py-1.5 border border-white/30">
                <p className="text-[10px] text-white/80 uppercase tracking-wider">待審</p>
                <p className="text-2xl font-bold text-white leading-none mt-0.5">{counts.pending}</p>
              </div>
            )}
          </div>
        </DialogHeader>

        {/* Filter pills */}
        <div className="px-6 py-3 border-b border-gray-100 bg-gray-50/50">
          <div className="flex gap-2 flex-wrap">
            {(["all", "pending", "approved", "rejected"] as const).map(f => {
              const cnt = f === "all"
                ? list.length
                : f === "pending" ? counts.pending : f === "approved" ? counts.approved : counts.rejected;
              const active = filter === f;
              const labels = { all: "全部", pending: "審核中", approved: "已批准", rejected: "已拒絕" };
              const colors = active
                ? f === "pending" ? "bg-amber-500 border-amber-500 text-white"
                : f === "approved" ? "bg-emerald-500 border-emerald-500 text-white"
                : f === "rejected" ? "bg-red-500 border-red-500 text-white"
                : "bg-gray-700 border-gray-700 text-white"
                : "bg-white text-gray-600 border-gray-200 hover:border-amber-300";
              return (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${colors}`}
                >
                  {labels[f]}
                  <span className={`ml-1.5 text-[10px] ${active ? "opacity-90" : "opacity-60"}`}>
                    ({cnt})
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <Loader2 className="w-7 h-7 animate-spin mb-2" />
              <p className="text-xs">載入中…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 px-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-gray-100 to-gray-50 mb-3 text-gray-300">
                <Inbox className="w-8 h-8" />
              </div>
              <p className="text-sm font-semibold text-gray-700">沒有符合條件的申請</p>
              <p className="text-xs text-gray-400 mt-1">
                {filter === "pending" ? "所有退傭申請都已處理 🎉" : "切換上方 filter 查看其他狀態"}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(req => (
                <Card
                  key={req.id}
                  className={`overflow-hidden border-l-4 ${
                    req.status === "pending" ? "border-l-amber-500 border-amber-100"
                    : req.status === "approved" ? "border-l-emerald-500 border-emerald-100"
                    : "border-l-red-400 border-red-100"
                  }`}
                >
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-gray-800">申請 #{req.id}</span>
                          <StatusBadge status={req.status} />
                        </div>
                        <p className="text-xs text-amber-700 mt-1 font-medium">
                          {req.merchantName ?? `用戶 #${req.userId}`}
                          <span className="text-gray-400 font-normal ml-2">
                            {req.createdAt ? new Date(req.createdAt).toLocaleString("zh-HK", {
                              month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
                            }) : "—"}
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div className="bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
                        <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-0.5">拍賣</p>
                        <p className="font-medium text-gray-700 truncate">
                          #{req.auctionId}{req.auctionTitle ? ` — ${req.auctionTitle}` : ""}
                        </p>
                      </div>
                      <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-lg px-3 py-2 border border-amber-100">
                        <p className="text-[10px] text-amber-600 uppercase tracking-wider mb-0.5">申請退還傭金</p>
                        <p className="font-bold text-amber-700 text-base leading-none mt-0.5">
                          HK${parseFloat(String(req.commissionAmount)).toFixed(2)}
                        </p>
                      </div>
                    </div>

                    <div className="text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
                      <span className="font-medium text-gray-700">📋 原因：</span>{REASON_LABELS[req.reason] ?? req.reason}
                      {req.reasonDetail && <p className="mt-1 text-gray-500 italic">「{req.reasonDetail}」</p>}
                    </div>

                    {req.adminNote && (
                      <div className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs border ${
                        req.status === "approved"
                          ? "bg-emerald-50 border-emerald-100 text-emerald-700"
                          : "bg-red-50 border-red-100 text-red-600"
                      }`}>
                        <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                        <span><span className="font-medium">管理員備注：</span>{req.adminNote}</span>
                      </div>
                    )}

                    {req.status === "pending" && (
                      <>
                        {reviewId === req.id ? (
                          <div className="space-y-2 border-t border-amber-100 pt-3">
                            <div className="space-y-1">
                              <Label className="text-xs">管理員備注（選填）</Label>
                              <Textarea
                                value={adminNote}
                                onChange={e => setAdminNote(e.target.value)}
                                placeholder="可填寫審核理由…"
                                rows={2}
                                className="border-amber-200 text-sm resize-none"
                                maxLength={500}
                              />
                            </div>
                            <div className="flex gap-2 flex-wrap">
                              <Button
                                size="sm"
                                onClick={() => handleReview(req.id, "approved")}
                                disabled={reviewMutation.isPending}
                                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> 批准退傭
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleReview(req.id, "rejected")}
                                disabled={reviewMutation.isPending}
                                className="flex-1 border-red-300 text-red-600 hover:bg-red-50"
                              >
                                <XCircle className="w-3.5 h-3.5 mr-1" /> 拒絕
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => { setReviewId(null); setAdminNote(""); }}
                                className="px-3 text-gray-400"
                              >
                                取消
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => { setReviewId(req.id); setAdminNote(""); }}
                            className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold shadow"
                          >
                            審批此申請
                          </Button>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between text-xs text-gray-500">
          <span>共 {list.length} 宗紀錄</span>
          <Button size="sm" variant="ghost" onClick={() => onOpenChange(false)}>
            關閉
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
