import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import Header from "@/components/Header";
import { useState } from "react";
import { ChevronLeft, CheckCircle2, XCircle, Clock, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const REASON_LABELS: Record<string, string> = {
  buyer_missing: "買家失蹤/不回覆",
  buyer_refused: "買家拒絕付款",
  mutual_cancel: "雙方協議取消",
  other: "其他原因",
};

function StatusBadge({ status }: { status: string }) {
  if (status === "pending") return (
    <span className="inline-flex items-center gap-1 text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5">
      <Clock className="w-3 h-3" /> 審核中
    </span>
  );
  if (status === "approved") return (
    <span className="inline-flex items-center gap-1 text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-2 py-0.5">
      <CheckCircle2 className="w-3 h-3" /> 已批准
    </span>
  );
  if (status === "rejected") return (
    <span className="inline-flex items-center gap-1 text-xs font-medium bg-red-50 text-red-500 border border-red-200 rounded-full px-2 py-0.5">
      <XCircle className="w-3 h-3" /> 已拒絕
    </span>
  );
  return <span className="text-xs text-gray-400">{status}</span>;
}

export default function AdminRefundRequests() {
  const { isAuthenticated, user, loading } = useAuth();
  const [reviewId, setReviewId] = useState<number | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");

  const utils = trpc.useUtils();

  const { data: requests, isLoading } = trpc.merchants.adminGetRefundRequests.useQuery(undefined, {
    enabled: isAuthenticated && user?.role === "admin",
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

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-4xl animate-spin">💰</div>
    </div>
  );

  if (!isAuthenticated || user?.role !== "admin") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-gray-500">沒有權限</p>
      </div>
    );
  }

  const filtered = requests?.filter(r => filter === "all" || r.status === filter) ?? [];
  const pendingCount = requests?.filter(r => r.status === "pending").length ?? 0;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="max-w-2xl mx-auto px-4 pt-4 pb-12 space-y-4">

        <div className="flex items-center gap-2">
          <Link href="/admin/deposits" className="p-1.5 rounded-xl hover:bg-amber-50 transition-colors">
            <ChevronLeft className="w-5 h-5 text-amber-700" />
          </Link>
          <h1 className="text-xl font-bold text-amber-900">退傭申請管理</h1>
          {pendingCount > 0 && (
            <Badge className="bg-red-500 text-white text-xs">{pendingCount} 待審</Badge>
          )}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 flex-wrap">
          {(["all", "pending", "approved", "rejected"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                filter === f
                  ? "bg-amber-600 text-white border-amber-600"
                  : "bg-white text-gray-600 border-gray-200 hover:border-amber-300"
              }`}
            >
              {f === "all" ? "全部" : f === "pending" ? "審核中" : f === "approved" ? "已批准" : "已拒絕"}
              {f !== "all" && (
                <span className="ml-1 text-xs opacity-70">
                  ({requests?.filter(r => r.status === f).length ?? 0})
                </span>
              )}
            </button>
          ))}
        </div>

        {isLoading ? (
          <p className="text-sm text-gray-400 text-center py-6">載入中…</p>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl bg-amber-50 border border-amber-100 p-6 text-center text-sm text-amber-600">
            沒有符合條件的申請
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(req => (
              <Card key={req.id} className={`rounded-2xl ${req.status === "pending" ? "border-amber-200" : "border-gray-100"}`}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-800">
                        申請 #{req.id}
                        <span className="text-gray-400 font-normal ml-2 text-xs">
                          {new Date(req.createdAt!).toLocaleString("zh-HK", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </p>
                      <p className="text-xs text-amber-700 mt-0.5 font-medium">{req.merchantName ?? `用戶 #${req.userId}`}</p>
                    </div>
                    <StatusBadge status={req.status} />
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                    <div className="bg-gray-50 rounded-lg p-2 border border-gray-100">
                      <p className="text-gray-400 mb-0.5">拍賣</p>
                      <p className="font-medium">#{req.auctionId}{req.auctionTitle ? ` — ${req.auctionTitle}` : ""}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2 border border-gray-100">
                      <p className="text-gray-400 mb-0.5">申請退還傭金</p>
                      <p className="font-semibold text-amber-700">HK${parseFloat(String(req.commissionAmount)).toFixed(2)}</p>
                    </div>
                  </div>

                  <div className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
                    <span className="font-medium">原因：</span>{REASON_LABELS[req.reason] ?? req.reason}
                    {req.reasonDetail && <p className="mt-1 text-gray-400">{req.reasonDetail}</p>}
                  </div>

                  {req.adminNote && (
                    <div className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs border ${req.status === "approved" ? "bg-emerald-50 border-emerald-100 text-emerald-700" : "bg-red-50 border-red-100 text-red-600"}`}>
                      <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                      <span>管理員備注：{req.adminNote}</span>
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
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleReview(req.id, "approved")}
                              disabled={reviewMutation.isPending}
                              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
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
                          variant="outline"
                          onClick={() => { setReviewId(req.id); setAdminNote(""); }}
                          className="w-full border-amber-200 text-amber-700 hover:bg-amber-50"
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
    </div>
  );
}
