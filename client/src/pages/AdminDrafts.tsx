import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import AdminHeader from "@/components/AdminHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Facebook, Clock, Trash2, CheckCircle, ExternalLink, RefreshCw,
  Coins, Settings, CheckSquare, Square, Zap, AlertTriangle
} from "lucide-react";
import { getCurrencySymbol } from "./AdminAuctions";

const BID_INCREMENT_OPTIONS = [30, 50, 100, 200, 300, 500, 1000, 2000, 3000, 5000];
const CURRENCY_OPTIONS = ["HKD", "USD", "CNY", "GBP", "EUR", "JPY"] as const;
type Currency = typeof CURRENCY_OPTIONS[number];

interface PublishForm {
  title: string;
  description: string;
  startingPrice: number;
  endTime: string;
  bidIncrement: number;
  currency: Currency;
}

function defaultEndTime(daysFromNow = 3) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().slice(0, 16);
}

export default function AdminDrafts() {
  const { user } = useAuth();
  const utils = trpc.useUtils();

  const { data: drafts, isLoading, refetch } = trpc.auctions.drafts.useQuery(undefined, {
    enabled: user?.role === "admin",
  });

  // ── Selection state ──────────────────────────────────────────────────────────
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const allIds = (drafts ?? []).map(d => d.id);
  const allSelected = allIds.length > 0 && allIds.every(id => selected.has(id));
  const someSelected = selected.size > 0;

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(allIds));
    }
  }

  function toggleOne(id: number) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // ── Single publish ───────────────────────────────────────────────────────────
  const [publishDialog, setPublishDialog] = useState<null | { id: number; form: PublishForm }>(null);

  const publishMutation = trpc.auctions.publish.useMutation({
    onSuccess: () => {
      toast.success("✅ 已成功上架！草稿已發布為正式拍賣。");
      utils.auctions.drafts.invalidate();
      utils.auctions.list.invalidate();
      setPublishDialog(null);
    },
    onError: (err) => toast.error(`上架失敗：${err.message}`),
  });

  function openPublish(draft: { id: number; title: string; description?: string | null; startingPrice: string; bidIncrement: number; currency: string }) {
    setPublishDialog({
      id: draft.id,
      form: {
        title: draft.title,
        description: draft.description ?? "",
        startingPrice: Number(draft.startingPrice),
        endTime: defaultEndTime(3),
        bidIncrement: draft.bidIncrement,
        currency: (CURRENCY_OPTIONS.includes(draft.currency as Currency) ? draft.currency : "HKD") as Currency,
      },
    });
  }

  function handlePublish() {
    if (!publishDialog) return;
    if (!publishDialog.form.endTime) { toast.error("請設定結束時間"); return; }
    publishMutation.mutate({
      id: publishDialog.id,
      title: publishDialog.form.title,
      description: publishDialog.form.description,
      startingPrice: publishDialog.form.startingPrice,
      endTime: new Date(publishDialog.form.endTime),
      bidIncrement: publishDialog.form.bidIncrement,
      currency: publishDialog.form.currency,
    });
  }

  // ── Single delete ────────────────────────────────────────────────────────────
  const deleteMutation = trpc.auctions.delete.useMutation({
    onSuccess: () => {
      toast.success("已刪除草稿");
      utils.auctions.drafts.invalidate();
    },
    onError: (err) => toast.error(`刪除失敗：${err.message}`),
  });

  // ── Batch publish ────────────────────────────────────────────────────────────
  const [batchPublishDialog, setBatchPublishDialog] = useState(false);
  const [batchEndTime, setBatchEndTime] = useState(() => defaultEndTime(3));

  const batchPublishMutation = trpc.auctions.batchPublish.useMutation({
    onSuccess: (result) => {
      toast.success(`✅ 批次上架完成：${result.succeeded} 件成功${result.skipped ? `，${result.skipped} 件略過` : ""}`);
      utils.auctions.drafts.invalidate();
      utils.auctions.list.invalidate();
      setSelected(new Set());
      setBatchPublishDialog(false);
    },
    onError: (err) => toast.error(`批次上架失敗：${err.message}`),
  });

  function handleBatchPublish() {
    if (!batchEndTime) { toast.error("請設定結束時間"); return; }
    batchPublishMutation.mutate({ ids: Array.from(selected), endTime: new Date(batchEndTime) });
  }

  // ── Batch delete ─────────────────────────────────────────────────────────────
  const [batchDeleteConfirm, setBatchDeleteConfirm] = useState(false);

  const batchDeleteMutation = trpc.auctions.batchDelete.useMutation({
    onSuccess: (result) => {
      toast.success(`🗑️ 批次刪除完成：${result.succeeded} 件已刪除`);
      utils.auctions.drafts.invalidate();
      setSelected(new Set());
      setBatchDeleteConfirm(false);
    },
    onError: (err) => toast.error(`批次刪除失敗：${err.message}`),
  });

  // ── Guard ────────────────────────────────────────────────────────────────────
  if (user?.role !== "admin") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">無權限查看此頁面</p>
      </div>
    );
  }

  return (
    <>
      <AdminHeader />
      <div className="container py-8 max-w-5xl">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
            <Facebook className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Facebook 草稿審核</h1>
            <p className="text-sm text-muted-foreground">從 Facebook 群組自動匯入的待審核拍賣</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/webhook-setup">
            <Button variant="outline" size="sm" className="gap-1 text-blue-600 border-blue-200">
              <Settings className="w-4 h-4" />
              設定說明
            </Button>
          </Link>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
            <RefreshCw className="w-4 h-4" />
            重新整理
          </Button>
        </div>
      </div>

      {/* ── Info banner ── */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4 text-sm text-blue-800">
        <p className="font-medium mb-1">💡 如何使用</p>
        <p>當您在 Facebook 群組發布拍賣貼文後，系統會自動透過 Groups Watcher 偵測並以 AI 解析內容，建立草稿。請在此頁面審核並設定結束時間後上架。</p>
      </div>

      {/* ── Batch toolbar (visible when items exist) ── */}
      {!isLoading && drafts && drafts.length > 0 && (
        <div className="flex items-center gap-3 bg-white border border-amber-100 rounded-xl px-4 py-3 mb-4 shadow-sm">
          {/* Select all checkbox */}
          <button
            onClick={toggleAll}
            className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
          >
            {allSelected
              ? <CheckSquare className="w-4 h-4 text-blue-600" />
              : someSelected
                ? <CheckSquare className="w-4 h-4 text-blue-400" />
                : <Square className="w-4 h-4 text-gray-400" />
            }
            {allSelected ? "取消全選" : "全選"}
          </button>

          <span className="text-xs text-muted-foreground">
            共 {drafts.length} 件草稿{someSelected ? `，已選 ${selected.size} 件` : ""}
          </span>

          {/* Batch actions — only visible when something selected */}
          {someSelected && (
            <div className="flex items-center gap-2 ml-auto">
              <Badge className="bg-blue-100 text-blue-700 text-xs">已選 {selected.size} 件</Badge>
              <Button
                size="sm"
                className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => { setBatchEndTime(defaultEndTime(3)); setBatchPublishDialog(true); }}
              >
                <Zap className="w-3.5 h-3.5" />
                批次上架
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-red-500 border-red-200 hover:bg-red-50"
                onClick={() => setBatchDeleteConfirm(true)}
              >
                <Trash2 className="w-3.5 h-3.5" />
                批次刪除
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ── Draft list ── */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 bg-amber-50 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : !drafts || drafts.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Facebook className="w-8 h-8 text-blue-400" />
          </div>
          <p className="text-lg font-medium">暫無待審核草稿</p>
          <p className="text-sm mt-1">Facebook 群組有新貼文時，草稿會自動出現在這裡</p>
        </div>
      ) : (
        <div className="space-y-3">
          {drafts.map((draft) => {
            const images = draft.images as Array<{ imageUrl: string }> | undefined;
            const fbUrl = (draft as { fbPostUrl?: string | null }).fbPostUrl;
            const currency = (draft as { currency?: string }).currency ?? "HKD";
            const isChecked = selected.has(draft.id);

            return (
              <Card
                key={draft.id}
                className={`border transition-all cursor-pointer ${isChecked ? "border-blue-300 bg-blue-50/40" : "border-amber-100 hover:border-amber-200"}`}
                onClick={() => toggleOne(draft.id)}
              >
                <CardContent className="p-4">
                  <div className="flex gap-3 items-start">
                    {/* Checkbox */}
                    <div className="pt-1 shrink-0" onClick={e => e.stopPropagation()}>
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() => toggleOne(draft.id)}
                        className="border-gray-300 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                      />
                    </div>

                    {/* Image preview */}
                    <div className="w-16 h-16 rounded-lg overflow-hidden bg-amber-50 flex items-center justify-center shrink-0">
                      {images && images.length > 0 ? (
                        <img src={images[0].imageUrl} alt={draft.title} className="w-full h-full object-cover" />
                      ) : (
                        <Coins className="w-7 h-7 text-amber-300" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h3 className="font-semibold text-sm line-clamp-1">{draft.title}</h3>
                        <div className="flex items-center gap-1 shrink-0">
                          {(draft as { relistSourceId?: number | null }).relistSourceId && (
                            <Badge className="bg-orange-100 text-orange-700 text-[10px] flex items-center gap-0.5">
                              🔄 重新拍賣
                            </Badge>
                          )}
                          <Badge className="bg-blue-100 text-blue-700 text-[10px]">草稿</Badge>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-1 mb-2">{draft.description}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                        <span className="font-semibold text-amber-600">
                          {getCurrencySymbol(currency)}{Number(draft.startingPrice).toLocaleString()} {currency}
                        </span>
                        <span>每口 {getCurrencySymbol(currency)}{draft.bidIncrement}</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(draft.createdAt).toLocaleString("zh-HK")}
                        </span>
                        {fbUrl && (
                          <a
                            href={fbUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-blue-500 hover:underline"
                            onClick={e => e.stopPropagation()}
                          >
                            <ExternalLink className="w-3 h-3" />
                            原貼文
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Single actions */}
                    <div className="flex flex-col gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                      <Button
                        size="sm"
                        className="gap-1 bg-emerald-600 hover:bg-emerald-700 text-white h-7 text-xs"
                        onClick={() => openPublish(draft as Parameters<typeof openPublish>[0])}
                      >
                        <CheckCircle className="w-3 h-3" />
                        上架
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1 text-red-500 border-red-200 hover:bg-red-50 h-7 text-xs"
                        onClick={() => {
                          if (confirm("確定刪除此草稿？")) deleteMutation.mutate({ id: draft.id });
                        }}
                      >
                        <Trash2 className="w-3 h-3" />
                        刪除
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Single Publish Dialog ── */}
      {publishDialog && (
        <Dialog open onOpenChange={() => setPublishDialog(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>確認上架設定</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <Label className="text-xs">商品名稱</Label>
                <Input value={publishDialog.form.title}
                  onChange={e => setPublishDialog(d => d ? { ...d, form: { ...d.form, title: e.target.value } } : null)} />
              </div>
              <div>
                <Label className="text-xs">描述</Label>
                <Textarea value={publishDialog.form.description} rows={3}
                  onChange={e => setPublishDialog(d => d ? { ...d, form: { ...d.form, description: e.target.value } } : null)} />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <Label className="text-xs">起拍價</Label>
                  <Input type="number" min={0} value={publishDialog.form.startingPrice}
                    onChange={e => setPublishDialog(d => d ? { ...d, form: { ...d.form, startingPrice: Number(e.target.value) } } : null)} />
                </div>
                <div>
                  <Label className="text-xs">貨幣</Label>
                  <Select value={publishDialog.form.currency}
                    onValueChange={v => setPublishDialog(d => d ? { ...d, form: { ...d.form, currency: v as Currency } } : null)}>
                    <SelectTrigger className="w-20 text-[10px] h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CURRENCY_OPTIONS.map(c => <SelectItem key={c} value={c} className="text-[10px]">{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <Label className="text-xs">結束時間 *</Label>
                  <Input type="datetime-local" value={publishDialog.form.endTime}
                    onChange={e => setPublishDialog(d => d ? { ...d, form: { ...d.form, endTime: e.target.value } } : null)} />
                </div>
                <div>
                  <Label className="text-xs">每口加幅</Label>
                  <Select value={String(publishDialog.form.bidIncrement)}
                    onValueChange={v => setPublishDialog(d => d ? { ...d, form: { ...d.form, bidIncrement: Number(v) } } : null)}>
                    <SelectTrigger className="w-24 text-xs h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {BID_INCREMENT_OPTIONS.map(v => (
                        <SelectItem key={v} value={String(v)} className="text-xs">
                          {getCurrencySymbol(publishDialog.form.currency)}{v}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPublishDialog(null)}>取消</Button>
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={handlePublish} disabled={publishMutation.isPending}>
                {publishMutation.isPending ? "上架中..." : "確認上架"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ── Batch Publish Dialog ── */}
      <Dialog open={batchPublishDialog} onOpenChange={setBatchPublishDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-emerald-600" />
              批次上架 {selected.size} 件草稿
            </DialogTitle>
          </DialogHeader>
          <div className="py-3 space-y-3">
            <p className="text-sm text-muted-foreground">
              所有選中的草稿將使用相同的結束時間上架，其餘設定（名稱、描述、起拍價、每口加幅）保持 AI 解析的原始值。
            </p>
            <div>
              <Label className="text-xs">統一結束時間 *</Label>
              <Input
                type="datetime-local"
                value={batchEndTime}
                onChange={e => setBatchEndTime(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchPublishDialog(false)}>取消</Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
              onClick={handleBatchPublish}
              disabled={batchPublishMutation.isPending}
            >
              <Zap className="w-3.5 h-3.5" />
              {batchPublishMutation.isPending ? "上架中..." : `確認上架 ${selected.size} 件`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Batch Delete Confirm ── */}
      <AlertDialog open={batchDeleteConfirm} onOpenChange={setBatchDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              確認批次刪除
            </AlertDialogTitle>
            <AlertDialogDescription>
              即將刪除 <strong>{selected.size} 件</strong>草稿，此操作無法復原。確定繼續？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => batchDeleteMutation.mutate({ ids: Array.from(selected) })}
              disabled={batchDeleteMutation.isPending}
            >
              {batchDeleteMutation.isPending ? "刪除中..." : `確認刪除 ${selected.size} 件`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </>
  );
}
