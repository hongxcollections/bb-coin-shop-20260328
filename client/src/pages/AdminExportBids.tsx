import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import AdminHeader from "@/components/AdminHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogOut, Download, FileSpreadsheet, Search } from "lucide-react";
import { toast } from "sonner";
import { Facebook } from "lucide-react";

export default function AdminExportBids() {
  const { user, isAuthenticated, logout } = useAuth();
  const [auctionIdInput, setAuctionIdInput] = useState("");
  const [queryAuctionId, setQueryAuctionId] = useState<number | undefined>(undefined);

  const { data: bids, isLoading, refetch } = trpc.export.bids.useQuery(
    { auctionId: queryAuctionId },
    { enabled: isAuthenticated && user?.role === "admin" }
  );

  if (!isAuthenticated || user?.role !== "admin") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4">🔒</div>
          <p className="text-lg font-medium mb-4">需要管理員權限</p>
          <Link href="/"><Button>返回首頁</Button></Link>
        </div>
      </div>
    );
  }

  const handleSearch = () => {
    const id = parseInt(auctionIdInput.trim());
    if (auctionIdInput.trim() === "") {
      setQueryAuctionId(undefined);
    } else if (!isNaN(id) && id > 0) {
      setQueryAuctionId(id);
    } else {
      toast.error("請輸入有效的拍賣 ID（正整數）");
      return;
    }
    setTimeout(() => refetch(), 100);
  };

  const handleExportCSV = () => {
    if (!bids || bids.length === 0) {
      toast.error("沒有可匯出的資料");
      return;
    }

    // Build CSV
    const headers = ["出價ID", "拍賣ID", "拍賣標題", "用戶ID", "用戶名稱", "出價金額", "貨幣", "是否匿名", "出價時間"];
    type BidRow = {
      bidId: number;
      auctionId: number;
      auctionTitle: string;
      userId: number;
      username: string | null;
      bidAmount: number;
      currency: string;
      isAnonymous: number;
      createdAt: Date | null;
    };
    const rows = (bids as BidRow[]).map((b) => [
      b.bidId,
      b.auctionId,
      `"${(b.auctionTitle ?? "").replace(/"/g, '""')}"`,
      b.userId,
      `"${(b.username ?? "").replace(/"/g, '""')}"`,
      b.bidAmount,
      b.currency,
      b.isAnonymous === 1 ? "是" : "否",
      b.createdAt ? new Date(b.createdAt).toLocaleString("zh-HK") : "",
    ]);

    const csvContent = [headers.join(","), ...rows.map((r: (string | number)[]) => r.join(","))].join("\n");
    const bom = "\uFEFF"; // UTF-8 BOM for Excel
    const blob = new Blob([bom + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const filename = queryAuctionId
      ? `bids_auction_${queryAuctionId}_${new Date().toISOString().slice(0, 10)}.csv`
      : `bids_all_${new Date().toISOString().slice(0, 10)}.csv`;
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`已匯出 ${bids.length} 筆出價記錄`);
  };

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader />

      <div className="container py-8 max-w-4xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-emerald-600" />
            出價記錄匯出
          </h1>
          <p className="text-muted-foreground mt-1">匯出所有出價記錄或指定拍賣的出價記錄為 CSV 格式</p>
        </div>

        {/* Filter */}
        <Card className="mb-6 border-amber-100">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">篩選條件</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <Label htmlFor="auction-id" className="text-sm mb-1.5 block">拍賣 ID（留空則匯出全部）</Label>
                <Input
                  id="auction-id"
                  type="number"
                  min="1"
                  placeholder="例如：42（留空匯出全部）"
                  value={auctionIdInput}
                  onChange={(e) => setAuctionIdInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="border-amber-200 focus:border-amber-400"
                />
              </div>
              <Button onClick={handleSearch} className="gap-2 bg-amber-500 hover:bg-amber-600 text-white">
                <Search className="w-4 h-4" />
                查詢
              </Button>
              <Button
                onClick={handleExportCSV}
                disabled={!bids || bids.length === 0}
                className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <Download className="w-4 h-4" />
                匯出 CSV
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Preview Table */}
        <Card className="border-amber-100">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-base">
              <span>
                {queryAuctionId ? `拍賣 #${queryAuctionId} 的出價記錄` : "全部出價記錄"}
              </span>
              {bids && (
                <span className="text-sm font-normal text-muted-foreground">共 {bids.length} 筆</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-10 bg-amber-50 rounded animate-pulse" />
                ))}
              </div>
            ) : !bids || bids.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileSpreadsheet className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">尚無出價記錄</p>
                <p className="text-sm mt-1">請先查詢或確認有出價資料</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-amber-50 border-b border-amber-100">
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-amber-800">出價ID</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-amber-800">拍賣</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-amber-800">用戶</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-amber-800">出價金額</th>
                      <th className="text-center px-4 py-2.5 text-xs font-semibold text-amber-800">匿名</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-amber-800">出價時間</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-amber-50">
                    {(bids as Array<{
                      bidId: number;
                      auctionId: number;
                      auctionTitle: string;
                      userId: number;
                      username: string | null;
                      bidAmount: number;
                      currency: string;
                      isAnonymous: number;
                      createdAt: Date | null;
                    }>).slice(0, 100).map((b) => (
                      <tr key={b.bidId} className="hover:bg-amber-50/50 transition-colors">
                        <td className="px-4 py-2.5 text-muted-foreground text-xs">#{b.bidId}</td>
                        <td className="px-4 py-2.5">
                          <Link href={`/auctions/${b.auctionId}`}>
                            <span className="text-amber-700 hover:underline cursor-pointer text-xs">
                              #{b.auctionId} {(b.auctionTitle ?? "").slice(0, 20)}{(b.auctionTitle ?? "").length > 20 ? "…" : ""}
                            </span>
                          </Link>
                        </td>
                        <td className="px-4 py-2.5 text-xs">
                          <span className="font-medium">{b.username ?? "—"}</span>
                          {b.isAnonymous === 1 && (
                            <span className="ml-1.5 text-[0.6rem] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">匿名</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right font-bold text-amber-700 text-xs">
                          {b.currency}${b.bidAmount.toLocaleString()}
                        </td>
                        <td className="px-4 py-2.5 text-center text-xs">
                          {b.isAnonymous === 1 ? (
                            <span className="text-slate-500">🕵️</span>
                          ) : (
                            <span className="text-green-500">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">
                          {b.createdAt ? new Date(b.createdAt).toLocaleString("zh-HK") : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {bids.length > 100 && (
                  <div className="px-4 py-3 text-xs text-center text-muted-foreground border-t border-amber-100">
                    預覽顯示前 100 筆，CSV 匯出包含全部 {bids.length} 筆記錄
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
