import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Facebook, Clock, Trash2, CheckCircle, ExternalLink, RefreshCw, Coins, Settings, ArrowLeft } from "lucide-react";
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

export default function AdminDrafts() {
  const { user } = useAuth();
  const utils = trpc.useUtils();

  const { data: drafts, isLoading, refetch } = trpc.auctions.drafts.useQuery(undefined, {
    enabled: user?.role === "admin",
  });

  const publishMutation = trpc.auctions.publish.useMutation({
    onSuccess: () => {
      toast.success("✅ 已成功上架！草稿已發布為正式拍賣。");
      utils.auctions.drafts.invalidate();
      utils.auctions.list.invalidate();
      setPublishDialog(null);
    },
    onError: (err) => {
      toast.error(`上架失敗：${err.message}`);
    },
  });

  const deleteMutation = trpc.auctions.delete.useMutation({
    onSuccess: () => {
      toast.success("已刪除草稿");
      utils.auctions.drafts.invalidate();
    },
    onError: (err) => {
      toast.error(`刪除失敗：${err.message}`);
    },
  });

  const [publishDialog, setPublishDialog] = useState<null | {
    id: number;
    form: PublishForm;
  }>(null);

  function openPublish(draft: {
    id: number;
    title: string;
    description?: string | null;
    startingPrice: string;
    bidIncrement: number;
    currency: string;
  }) {
    const defaultEnd = new Date();
    defaultEnd.setDate(defaultEnd.getDate() + 3);
    setPublishDialog({
      id: draft.id,
      form: {
        title: draft.title,
        description: draft.description ?? "",
        startingPrice: Number(draft.startingPrice),
        endTime: defaultEnd.toISOString().slice(0, 16),
        bidIncrement: draft.bidIncrement,
        currency: (CURRENCY_OPTIONS.includes(draft.currency as Currency) ? draft.currency : "HKD") as Currency,
      },
    });
  }

  function handlePublish() {
    if (!publishDialog) return;
    const { id, form } = publishDialog;
    if (!form.endTime) {
      toast.error("請設定結束時間");
      return;
    }
    publishMutation.mutate({
      id,
      title: form.title,
      description: form.description,
      startingPrice: form.startingPrice,
      endTime: new Date(form.endTime),
      bidIncrement: form.bidIncrement,
      currency: form.currency,
    });
  }

  if (user?.role !== "admin") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">無權限查看此頁面</p>
      </div>
    );
  }

  return (
    <div className="container py-8 max-w-5xl">
      {/* Header */}
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

      {/* Info banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 text-sm text-blue-800">
        <p className="font-medium mb-1">💡 如何使用</p>
        <p>當您在 Facebook 群組發布拍賣貼文後，系統會自動透過 Groups Watcher 偵測並以 AI 解析內容，建立草稿。請在此頁面審核並設定結束時間後上架。</p>
      </div>

      {/* Draft list */}
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
        <div className="space-y-4">
          {drafts.map((draft) => {
            const images = draft.images as Array<{ imageUrl: string }> | undefined;
            const fbUrl = (draft as { fbPostUrl?: string | null }).fbPostUrl;
            const currency = (draft as { currency?: string }).currency ?? "HKD";
            return (
              <Card key={draft.id} className="border border-amber-100 hover:border-amber-200 transition-colors">
                <CardContent className="p-4">
                  <div className="flex gap-4">
                    {/* Image preview */}
                    <div className="w-20 h-20 rounded-lg overflow-hidden bg-amber-50 flex items-center justify-center shrink-0">
                      {images && images.length > 0 ? (
                        <img src={images[0].imageUrl} alt={draft.title} className="w-full h-full object-cover" />
                      ) : (
                        <Coins className="w-8 h-8 text-amber-300" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h3 className="font-semibold text-sm line-clamp-2">{draft.title}</h3>
                        <Badge className="bg-blue-100 text-blue-700 shrink-0">草稿</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{draft.description}</p>
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
                          <a href={fbUrl} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1 text-blue-500 hover:underline">
                            <ExternalLink className="w-3 h-3" />
                            原貼文
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2 shrink-0">
                      <Button size="sm" className="gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() => openPublish(draft as Parameters<typeof openPublish>[0])}>
                        <CheckCircle className="w-3.5 h-3.5" />
                        上架
                      </Button>
                      <Button size="sm" variant="outline" className="gap-1 text-red-500 border-red-200 hover:bg-red-50"
                        onClick={() => {
                          if (confirm("確定刪除此草稿？")) deleteMutation.mutate({ id: draft.id });
                        }}>
                        <Trash2 className="w-3.5 h-3.5" />
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

      {/* Publish Dialog */}
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
                    <SelectTrigger className="w-20 text-[10px] h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCY_OPTIONS.map(c => (
                        <SelectItem key={c} value={c} className="text-[10px]">{c}</SelectItem>
                      ))}
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
                    <SelectTrigger className="w-24 text-xs h-9">
                      <SelectValue />
                    </SelectTrigger>
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
    </div>
  );
}
