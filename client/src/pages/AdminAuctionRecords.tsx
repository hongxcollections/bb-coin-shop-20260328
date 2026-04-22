import { useState, useRef } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import AdminHeader from "@/components/AdminHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ChevronLeft, Upload, CheckCircle, Trash2,
  Image, Loader2, Check, X, Edit2, Database, AlertCircle, AlertTriangle, Save, Link2
} from "lucide-react";

type ExtractedLot = {
  lotNumber?: string | null;
  title: string;
  description?: string | null;
  estimateLow?: number | null;
  estimateHigh?: number | null;
  soldPrice?: number | null;
  currency: string;
  saleStatus: "sold" | "unsold";
  auctionHouse?: string | null;
  auctionDate?: string | null;
  sourceNote?: string | null;
};

type AuctionRecord = ExtractedLot & {
  id: number;
  importStatus: "pending" | "confirmed";
  createdAt: string;
  imageUrl?: string | null;
};

function fmtPrice(price: number | string | null | undefined, currency = "HKD") {
  if (price == null || price === "") return "—";
  const num = typeof price === "string" ? parseFloat(price) : price;
  if (isNaN(num)) return "—";
  return `${currency} ${num.toLocaleString()}`;
}

export default function AdminAuctionRecords() {
  const { user, isAuthenticated } = useAuth();
  const [tab, setTab] = useState<"upload" | "pending" | "confirmed">("upload");

  // Upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [auctionHouse, setAuctionHouse] = useState("Spink");
  const [auctionDate, setAuctionDate] = useState("");
  const [sourceNote, setSourceNote] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedLots, setExtractedLots] = useState<ExtractedLot[]>([]);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editBuf, setEditBuf] = useState<Partial<ExtractedLot>>({});

  // Duplicate dialog state
  const [dupeDialog, setDupeDialog] = useState<{ pendingId: number } | null>(null);

  // Records list
  const pendingList = trpc.auctionRecords.list.useQuery(
    { importStatus: "pending", limit: 100, offset: 0 },
    { enabled: isAuthenticated && user?.role === "admin" && tab === "pending" }
  );
  const confirmedList = trpc.auctionRecords.list.useQuery(
    { importStatus: "confirmed", limit: 100, offset: 0 },
    { enabled: isAuthenticated && user?.role === "admin" && tab === "confirmed" }
  );
  const savePending = trpc.auctionRecords.savePending.useMutation({
    onSuccess: (data) => {
      toast.success(`已儲存 ${data.inserted} 條待確認紀錄`);
      setExtractedLots([]);
      setTab("pending");
    },
    onError: (err) => toast.error(err.message),
  });

  const confirmOne = trpc.auctionRecords.confirm.useMutation({
    onSuccess: (data, variables) => {
      if (data.isDuplicate) {
        setDupeDialog({ pendingId: variables.id });
        return;
      }
      toast.success("已確認入庫");
      pendingList.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const confirmAll = trpc.auctionRecords.confirmAll.useMutation({
    onSuccess: (data) => {
      if (data.skipped > 0) {
        toast.success(`已確認 ${data.confirmed} 條，跳過 ${data.skipped} 條重複紀錄`);
      } else {
        toast.success(`已確認 ${data.confirmed} 條紀錄`);
      }
      pendingList.refetch();
      setTab("confirmed");
      confirmedList.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteOne = trpc.auctionRecords.delete.useMutation({
    onSuccess: () => {
      toast.success("已刪除");
      pendingList.refetch();
      confirmedList.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const deletePending = trpc.auctionRecords.deletePending.useMutation({
    onSuccess: (data) => {
      toast.success(`已清除 ${data.deleted} 條待確認紀錄`);
      pendingList.refetch();
      setExtractedLots([]);
    },
    onError: (err) => toast.error(err.message),
  });

  // Batch auction import state
  const [auctionUrl, setAuctionUrl] = useState("");
  const [maxLots, setMaxLots] = useState(300);
  const [batchResult, setBatchResult] = useState<{ imported: number; skipped: number; auctionTitle: string | null; discovered: number } | null>(null);
  const importAuction = trpc.auctionRecords.importFromSpinkAuction.useMutation({
    onSuccess: (data) => {
      setBatchResult(data);
      toast.success(`批量導入完成：新增 ${data.imported} 條，跳過 ${data.skipped} 條重複`);
      setTab("pending");
      pendingList.refetch();
    },
    onError: (err) => toast.error(`批量導入失敗：${err.message}`),
  });

  // URL import state
  const [spinkUrl, setSpinkUrl] = useState("");
  const importFromUrl = trpc.auctionRecords.importFromSpinkUrl.useMutation({
    onSuccess: (data) => {
      const status = data.saleStatus === 'sold' ? '✅ 成交' : '⚪ 流拍';
      toast.success(`已導入批號 ${data.lotNumber ?? data.id} [${status}]：${data.title.slice(0, 35)}…（${data.imageCount} 張圖）`);
      setSpinkUrl("");
      setTab("pending");
      pendingList.refetch();
    },
    onError: (err) => toast.error(`導入失敗：${err.message}`),
  });

  if (!isAuthenticated || user?.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">沒有權限</p>
      </div>
    );
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setIsExtracting(true);
    const allLots: ExtractedLot[] = [];

    for (const file of files) {
      try {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(",")[1]);
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const mimeType = file.type || "image/jpeg";
        const res = await fetch("/api/auction-records/extract-screenshot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            imageBase64: base64,
            mimeType,
            auctionHouse: auctionHouse || null,
            auctionDate: auctionDate || null,
            sourceNote: sourceNote || null,
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "分析失敗");
        }

        const data = await res.json();
        allLots.push(...(data.lots || []));
      } catch (err: any) {
        toast.error(`${file.name}：${err.message}`);
      }
    }

    setExtractedLots(prev => [...prev, ...allLots]);
    setIsExtracting(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const startEdit = (idx: number) => {
    setEditingIdx(idx);
    setEditBuf({ ...extractedLots[idx] });
  };

  const saveEdit = () => {
    if (editingIdx == null) return;
    const updated = [...extractedLots];
    updated[editingIdx] = { ...updated[editingIdx], ...editBuf };
    setExtractedLots(updated);
    setEditingIdx(null);
  };

  const removeLot = (idx: number) => {
    setExtractedLots(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSavePending = () => {
    if (!extractedLots.length) return;
    savePending.mutate({ lots: extractedLots });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader />

      {/* 重複紀錄確認對話框 */}
      <AlertDialog open={!!dupeDialog} onOpenChange={(open) => !open && setDupeDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              偵測到重複紀錄
            </AlertDialogTitle>
            <AlertDialogDescription>
              此批號已存在於已入庫紀錄中（相同拍賣行、日期及批號）。
              你確定要強制再次入庫嗎？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDupeDialog(null)}>取消（保留待確認）</AlertDialogCancel>
            <AlertDialogAction
              className="bg-amber-500 hover:bg-amber-600"
              onClick={() => {
                if (dupeDialog) {
                  confirmOne.mutate({ id: dupeDialog.pendingId, force: true });
                  setDupeDialog(null);
                }
              }}
            >
              強制入庫
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/admin">
            <Button variant="ghost" size="icon">
              <ChevronLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Database className="h-6 w-6" />
              成交紀錄數據庫
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              上傳拍賣截圖 → AI 自動提取 → 確認入庫
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-6">
          {[
            { key: "upload", label: "上傳截圖" },
            { key: "pending", label: `待確認 ${pendingList.data?.total ?? ""}` },
            { key: "confirmed", label: `已入庫 ${confirmedList.data?.total ?? ""}` },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key as any)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === t.key
                  ? "bg-primary text-white"
                  : "bg-white border text-gray-600 hover:bg-gray-50"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ─── Upload Tab ─── */}
        {tab === "upload" && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">截圖設定</CardTitle>
                <CardDescription>設定好後選擇截圖，可一次上傳多張</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label>拍賣行</Label>
                    <Input
                      value={auctionHouse}
                      onChange={e => setAuctionHouse(e.target.value)}
                      placeholder="例：Spink"
                    />
                  </div>
                  <div>
                    <Label>拍賣日期（可選）</Label>
                    <Input
                      type="date"
                      value={auctionDate}
                      onChange={e => setAuctionDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>備注（可選）</Label>
                    <Input
                      value={sourceNote}
                      onChange={e => setSourceNote(e.target.value)}
                      placeholder="例：Spink 2025年3月拍賣"
                    />
                  </div>
                </div>

                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors"
                >
                  {isExtracting ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      <p className="text-sm font-medium">AI 正在分析截圖...</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Image className="h-8 w-8 text-gray-400" />
                      <p className="text-sm font-medium">點擊上傳截圖</p>
                      <p className="text-xs text-muted-foreground">
                        支援 JPG、PNG，可一次選多張
                      </p>
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Batch Auction Import */}
            <Card className="border-primary/30 bg-primary/5">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Database className="h-4 w-4 text-primary" />
                  整個拍賣一鍵批量導入
                </CardTitle>
                <CardDescription>
                  貼上 Spink 拍賣頁或任何拍品網址，系統自動追蹤所有批號並批量入庫
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    value={auctionUrl}
                    onChange={e => { setAuctionUrl(e.target.value); setBatchResult(null); }}
                    placeholder="https://live.spink.com/auctions/4-KK06SP"
                    className="flex-1 text-sm bg-white"
                  />
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">上限</span>
                    <Input
                      type="number"
                      value={maxLots}
                      onChange={e => setMaxLots(Math.max(1, Math.min(1000, parseInt(e.target.value) || 300)))}
                      className="w-20 text-sm bg-white"
                      min={1}
                      max={1000}
                    />
                  </div>
                  <Button
                    onClick={() => importAuction.mutate({ url: auctionUrl.trim(), maxLots })}
                    disabled={!auctionUrl.trim() || importAuction.isPending}
                    className="shrink-0"
                  >
                    {importAuction.isPending ? (
                      <><Loader2 className="h-4 w-4 animate-spin mr-1" />導入中…</>
                    ) : (
                      <><CheckCircle className="h-4 w-4 mr-1" />批量導入</>
                    )}
                  </Button>
                </div>
                {importAuction.isPending && (
                  <div className="flex items-center gap-2 text-sm text-primary">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>正在抓取拍品資料，請稍候（每 15 條並行，需時 1-3 分鐘）…</span>
                  </div>
                )}
                {batchResult && (
                  <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm">
                    <p className="font-medium text-green-800">✅ 批量導入完成</p>
                    {batchResult.auctionTitle && (
                      <p className="text-green-700 mt-0.5 text-xs">{batchResult.auctionTitle}</p>
                    )}
                    <p className="text-green-700 mt-1">
                      新增 <strong>{batchResult.imported}</strong> 條・
                      跳過重複 <strong>{batchResult.skipped}</strong> 條・
                      共發現 <strong>{batchResult.discovered}</strong> 個批號
                    </p>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  支援：拍賣頁 URL（.../auctions/...）或任何拍品 URL（.../lots/view/...）。圖片使用 Spink CDN 原址，成交價需手動補填。
                </p>
              </CardContent>
            </Card>

            {/* Spink URL Import */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Link2 className="h-4 w-4" />
                  Spink URL 直接導入
                </CardTitle>
                <CardDescription>
                  在 Spink Live app 按「共用」，複製網址後貼上，自動抓取資料及圖片
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Input
                    value={spinkUrl}
                    onChange={e => setSpinkUrl(e.target.value)}
                    placeholder="https://live.spink.com/lots/view/4-KK09UE"
                    className="flex-1 text-sm"
                    onKeyDown={e => {
                      if (e.key === "Enter" && spinkUrl.trim() && !importFromUrl.isPending) {
                        importFromUrl.mutate({ url: spinkUrl.trim() });
                      }
                    }}
                  />
                  <Button
                    onClick={() => importFromUrl.mutate({ url: spinkUrl.trim() })}
                    disabled={!spinkUrl.trim() || importFromUrl.isPending}
                  >
                    {importFromUrl.isPending ? (
                      <><Loader2 className="h-4 w-4 animate-spin mr-1" />抓取中…</>
                    ) : (
                      <><Upload className="h-4 w-4 mr-1" />導入</>
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  自動抓取：批號、標題、估計低/高、描述、圖片（存入 S3）。成交價請在待確認頁手動填寫。
                </p>
              </CardContent>
            </Card>

            {/* Extracted Results */}
            {extractedLots.length > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">
                        AI 提取結果（{extractedLots.length} 條）
                      </CardTitle>
                      <CardDescription>請核對數據後儲存</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setExtractedLots([])}
                      >
                        <X className="h-4 w-4 mr-1" />
                        清除
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSavePending}
                        disabled={savePending.isPending}
                      >
                        {savePending.isPending ? (
                          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4 mr-1" />
                        )}
                        儲存為待確認
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {extractedLots.map((lot, idx) => (
                      <div
                        key={idx}
                        className="border rounded-lg p-3 bg-white"
                      >
                        {editingIdx === idx ? (
                          <EditLotForm
                            lot={editBuf}
                            onChange={setEditBuf}
                            onSave={saveEdit}
                            onCancel={() => setEditingIdx(null)}
                          />
                        ) : (
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                {lot.lotNumber && (
                                  <span className="text-xs font-mono text-gray-500">
                                    批號{lot.lotNumber}
                                  </span>
                                )}
                                <Badge
                                  variant={lot.saleStatus === "sold" ? "default" : "secondary"}
                                  className="text-xs"
                                >
                                  {lot.saleStatus === "sold" ? "已售出" : "流拍"}
                                </Badge>
                              </div>
                              <p className="font-medium text-sm mt-1">{lot.title}</p>
                              {lot.description && (
                                <p className="text-xs text-muted-foreground mt-0.5">{lot.description}</p>
                              )}
                              <div className="flex gap-4 mt-1 text-xs text-gray-600">
                                {(lot.estimateLow || lot.estimateHigh) && (
                                  <span>
                                    估計：{fmtPrice(lot.estimateLow, lot.currency)} – {fmtPrice(lot.estimateHigh, lot.currency)}
                                  </span>
                                )}
                                {lot.soldPrice != null && (
                                  <span className="font-semibold text-green-700">
                                    成交：{fmtPrice(lot.soldPrice, lot.currency)}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-1 shrink-0">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => startEdit(idx)}
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive"
                                onClick={() => removeLot(idx)}
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* ─── Pending Tab ─── */}
        {tab === "pending" && (
          <div>
            {pendingList.isError ? (
              <div className="text-center py-12">
                <AlertCircle className="h-8 w-8 mx-auto text-red-400 mb-2" />
                <p className="text-muted-foreground">載入失敗：{pendingList.error?.message}</p>
                <Button size="sm" variant="outline" className="mt-3" onClick={() => pendingList.refetch()}>重試</Button>
              </div>
            ) : pendingList.isLoading || !pendingList.data ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (pendingList.data.records ?? []).length === 0 ? (
              <div className="text-center py-12">
                <AlertCircle className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-muted-foreground">沒有待確認紀錄</p>
              </div>
            ) : (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      共 {pendingList.data.total} 條待確認
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deletePending.mutate()}
                      disabled={deletePending.isPending}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      清除全部
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => confirmAll.mutate({ force: false })}
                      disabled={confirmAll.isPending}
                    >
                      {confirmAll.isPending ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <CheckCircle className="h-4 w-4 mr-1" />
                      )}
                      全部確認入庫
                    </Button>
                  </div>
                </div>
                <RecordTable
                  records={(pendingList.data.records ?? []) as AuctionRecord[]}
                  onConfirm={(id) => confirmOne.mutate({ id, force: false })}
                  onDelete={(id) => deleteOne.mutate({ id })}
                  showConfirm
                />
              </div>
            )}
          </div>
        )}

        {/* ─── Confirmed Tab ─── */}
        {tab === "confirmed" && (
          <div>
            {confirmedList.isError ? (
              <div className="text-center py-12">
                <AlertCircle className="h-8 w-8 mx-auto text-red-400 mb-2" />
                <p className="text-muted-foreground">載入失敗：{confirmedList.error?.message}</p>
                <Button size="sm" variant="outline" className="mt-3" onClick={() => confirmedList.refetch()}>重試</Button>
              </div>
            ) : confirmedList.isLoading || !confirmedList.data ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (confirmedList.data.records ?? []).length === 0 ? (
              <div className="text-center py-12">
                <Database className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-muted-foreground">數據庫暫時為空</p>
              </div>
            ) : (
              <div>
                <p className="text-sm text-muted-foreground mb-4">
                  共 {confirmedList.data.total} 條已入庫紀錄
                </p>
                <RecordTable
                  records={(confirmedList.data.records ?? []) as AuctionRecord[]}
                  onDelete={(id) => deleteOne.mutate({ id })}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function EditLotForm({
  lot,
  onChange,
  onSave,
  onCancel,
}: {
  lot: Partial<ExtractedLot>;
  onChange: (v: Partial<ExtractedLot>) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">批號</Label>
          <Input
            className="h-7 text-sm"
            value={lot.lotNumber ?? ""}
            onChange={e => onChange({ ...lot, lotNumber: e.target.value || null })}
          />
        </div>
        <div>
          <Label className="text-xs">狀態</Label>
          <select
            className="w-full h-7 text-sm border rounded px-2"
            value={lot.saleStatus ?? "sold"}
            onChange={e => onChange({ ...lot, saleStatus: e.target.value as any })}
          >
            <option value="sold">已售出</option>
            <option value="unsold">流拍</option>
          </select>
        </div>
      </div>
      <div>
        <Label className="text-xs">幣種名稱</Label>
        <Input
          className="h-7 text-sm"
          value={lot.title ?? ""}
          onChange={e => onChange({ ...lot, title: e.target.value })}
        />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <Label className="text-xs">估計低</Label>
          <Input
            className="h-7 text-sm"
            type="number"
            value={lot.estimateLow ?? ""}
            onChange={e => onChange({ ...lot, estimateLow: e.target.value ? Number(e.target.value) : null })}
          />
        </div>
        <div>
          <Label className="text-xs">估計高</Label>
          <Input
            className="h-7 text-sm"
            type="number"
            value={lot.estimateHigh ?? ""}
            onChange={e => onChange({ ...lot, estimateHigh: e.target.value ? Number(e.target.value) : null })}
          />
        </div>
        <div>
          <Label className="text-xs">成交價</Label>
          <Input
            className="h-7 text-sm"
            type="number"
            value={lot.soldPrice ?? ""}
            onChange={e => onChange({ ...lot, soldPrice: e.target.value ? Number(e.target.value) : null })}
          />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={onCancel}>取消</Button>
        <Button size="sm" onClick={onSave}>
          <Check className="h-3.5 w-3.5 mr-1" />
          確認
        </Button>
      </div>
    </div>
  );
}

function RecordTable({
  records,
  onConfirm,
  onDelete,
  showConfirm = false,
}: {
  records: AuctionRecord[];
  onConfirm?: (id: number) => void;
  onDelete: (id: number) => void;
  showConfirm?: boolean;
}) {
  return (
    <div className="rounded-lg border overflow-hidden bg-white">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-3 py-2 font-medium text-xs text-gray-500">圖</th>
              <th className="text-left px-3 py-2 font-medium text-xs text-gray-500">批號</th>
              <th className="text-left px-3 py-2 font-medium text-xs text-gray-500">名稱</th>
              <th className="text-left px-3 py-2 font-medium text-xs text-gray-500">拍賣行</th>
              <th className="text-left px-3 py-2 font-medium text-xs text-gray-500">估計</th>
              <th className="text-left px-3 py-2 font-medium text-xs text-gray-500">成交</th>
              <th className="text-left px-3 py-2 font-medium text-xs text-gray-500">狀態</th>
              <th className="text-right px-3 py-2 font-medium text-xs text-gray-500">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {(records ?? []).map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-2 py-1">
                  {r.imageUrl ? (
                    <a href={r.imageUrl} target="_blank" rel="noopener noreferrer">
                      <img src={r.imageUrl} alt="" className="w-10 h-10 object-cover rounded border" />
                    </a>
                  ) : (
                    <div className="w-10 h-10 rounded border bg-gray-100 flex items-center justify-center">
                      <Image className="h-4 w-4 text-gray-300" />
                    </div>
                  )}
                </td>
                <td className="px-3 py-2 font-mono text-xs text-gray-500">
                  {r.lotNumber ?? "—"}
                </td>
                <td className="px-3 py-2" style={{maxWidth: '160px'}}>
                  <p className="font-medium text-xs leading-snug line-clamp-2">{r.title}</p>
                </td>
                <td className="px-3 py-2 text-xs text-gray-600">
                  <div>{r.auctionHouse ?? "—"}</div>
                  {r.auctionDate && (
                    <div className="text-muted-foreground">{r.auctionDate}</div>
                  )}
                </td>
                <td className="px-3 py-2 text-xs whitespace-nowrap">
                  {r.estimateLow || r.estimateHigh
                    ? `${fmtPrice(r.estimateLow, r.currency)} – ${fmtPrice(r.estimateHigh, r.currency)}`
                    : "—"}
                </td>
                <td className="px-3 py-2 text-xs font-semibold whitespace-nowrap">
                  {r.soldPrice != null ? (
                    <span className="text-green-700">{fmtPrice(r.soldPrice, r.currency)}</span>
                  ) : "—"}
                </td>
                <td className="px-3 py-2">
                  <Badge
                    variant={r.saleStatus === "sold" ? "default" : "secondary"}
                    className="text-xs"
                  >
                    {r.saleStatus === "sold" ? "售出" : "流拍"}
                  </Badge>
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-1 justify-end">
                    {showConfirm && onConfirm && (
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7 border-green-300 text-green-700 hover:bg-green-50"
                        onClick={() => onConfirm(r.id)}
                        title="確認入庫"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7 border-red-300 text-red-600 hover:bg-red-50"
                      onClick={() => onDelete(r.id)}
                      title="刪除"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
