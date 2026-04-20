import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import Header from "@/components/Header";
import { useState } from "react";
import {
  ChevronLeft, RotateCcw, AlertCircle, CheckCircle2, XCircle,
  Clock, PlusCircle, ChevronDown, ChevronUp,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

export default function MerchantRefundRequests() {
  const { isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();

  const [showForm, setShowForm] = useState(false);
  const [auctionId, setAuctionId] = useState("");
  const [reason, setReason] = useState<string>("");
  const [reasonDetail, setReasonDetail] = useState("");

  const utils = trpc.useUtils();

  const { data: requests, isLoading } = trpc.merchants.myRefundRequests.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const submitMutation = trpc.merchants.submitRefundRequest.useMutation({
    onSuccess: () => {
      toast.success("退傭申請已提交，等候管理員審核");
      utils.merchants.myRefundRequests.invalidate();
      setShowForm(false);
      setAuctionId("");
      setReason("");
      setReasonDetail("");
    },
    onError: (err) => toast.error(`提交失敗：${err.message}`),
  });

  const handleSubmit = () => {
    const id = parseInt(auctionId);
    if (!id || id <= 0) { toast.error("請輸入有效的拍賣編號"); return; }
    if (!reason) { toast.error("請選擇申請原因"); return; }
    submitMutation.mutate({ auctionId: id, reason: reason as "buyer_missing" | "buyer_refused" | "mutual_cancel" | "other", reasonDetail: reasonDetail || undefined });
  };

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-4xl animate-spin">💰</div>
    </div>
  );

  if (!isAuthenticated) {
    navigate("/login");
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="max-w-lg mx-auto px-4 pt-4 pb-28 space-y-4">

        <div className="flex items-center gap-2">
          <Link href="/merchant-dashboard" className="p-1.5 rounded-xl hover:bg-amber-50 transition-colors">
            <ChevronLeft className="w-5 h-5 text-amber-700" />
          </Link>
          <h1 className="text-xl font-bold text-amber-900">退傭申請</h1>
        </div>

        <p className="text-sm text-gray-500 rounded-xl bg-gray-50 border border-gray-100 px-4 py-3">
          若拍賣成交後買家失蹤或拒絕付款，可申請退還已扣除的傭金。每個拍賣只能提交一次申請。
        </p>

        {/* New request form */}
        <Card className="rounded-2xl border-amber-100">
          <CardContent className="p-4">
            <button
              onClick={() => setShowForm(v => !v)}
              className="w-full flex items-center justify-between text-sm font-semibold text-amber-900"
            >
              <span className="flex items-center gap-2">
                <PlusCircle className="w-4 h-4 text-amber-600" />
                提交新申請
              </span>
              {showForm ? <ChevronUp className="w-4 h-4 text-amber-500" /> : <ChevronDown className="w-4 h-4 text-amber-500" />}
            </button>
            {showForm && (
              <div className="mt-4 space-y-3 border-t border-amber-100 pt-4">
                <div className="space-y-1.5">
                  <Label>拍賣編號</Label>
                  <Input
                    type="number"
                    value={auctionId}
                    onChange={e => setAuctionId(e.target.value)}
                    placeholder="請輸入拍賣 ID（例如 123）"
                    className="border-amber-200"
                  />
                  <p className="text-xs text-gray-400">只限已結束且有成交的拍賣</p>
                </div>
                <div className="space-y-1.5">
                  <Label>申請原因</Label>
                  <Select value={reason} onValueChange={setReason}>
                    <SelectTrigger className="border-amber-200">
                      <SelectValue placeholder="選擇原因…" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(REASON_LABELS).map(([v, l]) => (
                        <SelectItem key={v} value={v}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>補充說明（選填）</Label>
                  <Textarea
                    value={reasonDetail}
                    onChange={e => setReasonDetail(e.target.value)}
                    placeholder="可提供更多細節說明…"
                    className="border-amber-200 text-sm resize-none"
                    rows={3}
                    maxLength={500}
                  />
                </div>
                <Button
                  onClick={handleSubmit}
                  disabled={submitMutation.isPending}
                  className="w-full bg-amber-600 hover:bg-amber-700 text-white"
                >
                  {submitMutation.isPending ? "提交中…" : "提交申請"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Request list */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-amber-600" />
            <h2 className="font-semibold text-amber-900 text-sm">我的申請記錄</h2>
          </div>

          {isLoading ? (
            <p className="text-sm text-gray-400 text-center py-6">載入中…</p>
          ) : !requests || requests.length === 0 ? (
            <div className="rounded-2xl bg-amber-50 border border-amber-100 p-6 text-center text-sm text-amber-600">
              尚無退傭申請記錄
            </div>
          ) : (
            <div className="space-y-2">
              {requests.map(req => (
                <Card key={req.id} className="rounded-2xl border-gray-100">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-gray-800 truncate">
                          拍賣 #{req.auctionId}
                          {req.auctionTitle && <span className="text-gray-500 font-normal ml-1">— {req.auctionTitle}</span>}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {new Date(req.createdAt!).toLocaleString("zh-HK", { year: "numeric", month: "2-digit", day: "2-digit" })}
                        </p>
                      </div>
                      <StatusBadge status={req.status} />
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>申請退還：<span className="font-semibold text-amber-700">HK${parseFloat(String(req.commissionAmount)).toFixed(2)}</span></span>
                      <span>{REASON_LABELS[req.reason] ?? req.reason}</span>
                    </div>
                    {req.reasonDetail && (
                      <p className="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">{req.reasonDetail}</p>
                    )}
                    {req.adminNote && (
                      <div className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs border ${req.status === "approved" ? "bg-emerald-50 border-emerald-100 text-emerald-700" : "bg-red-50 border-red-100 text-red-600"}`}>
                        <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                        <span>管理員備注：{req.adminNote}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
