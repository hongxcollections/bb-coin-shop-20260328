import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import AdminHeader from "@/components/AdminHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ChevronLeft, Database, RefreshCw, Clock, HardDrive, CheckCircle, AlertCircle, Shield } from "lucide-react";

function fmtSize(kb: number) {
  if (kb < 1024) return `${kb} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

function fmtDate(d: Date | string) {
  const dt = new Date(d);
  return dt.toLocaleString("zh-HK", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function AdminBackup() {
  const { user, isAuthenticated } = useAuth();
  const [running, setRunning] = useState(false);

  const { data: backups, isLoading, refetch } = trpc.backup.list.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const runMutation = trpc.backup.run.useMutation({
    onSuccess: (result) => {
      toast.success(`備份完成：${result.key}（${result.sizeKb} KB）`);
      refetch();
    },
    onError: (err) => {
      toast.error(`備份失敗：${err.message}`);
    },
    onSettled: () => setRunning(false),
  });

  if (!isAuthenticated || user?.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">無權限</p>
      </div>
    );
  }

  const handleRun = () => {
    setRunning(true);
    runMutation.mutate();
  };

  const list = backups ?? [];
  const dailyCount = list.filter(b => !b.key.includes("-weekly")).length;
  const weeklyCount = list.filter(b => b.key.includes("-weekly")).length;
  const latest = list[0];

  return (
    <div className="min-h-screen bg-amber-50/30">
      <AdminHeader />
      <div className="container max-w-3xl py-6 space-y-5">

        {/* 頂部標題 */}
        <div className="flex items-center gap-3">
          <Link href="/admin">
            <Button variant="ghost" size="sm" className="gap-1 text-amber-700">
              <ChevronLeft className="w-4 h-4" />返回
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-amber-900 flex items-center gap-2">
              <Database className="w-5 h-5 text-amber-600" />資料庫備份管理
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">每日 HKT 02:00 自動備份至 S3 · 每日備份保留 30 天 · 每週快照保留 3 個月</p>
          </div>
        </div>

        {/* 統計卡片 */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="border-amber-100">
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-2xl font-bold text-amber-700">{list.length}</p>
              <p className="text-xs text-muted-foreground mt-1">備份總數</p>
            </CardContent>
          </Card>
          <Card className="border-amber-100">
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-2xl font-bold text-blue-600">{dailyCount}</p>
              <p className="text-xs text-muted-foreground mt-1">每日備份</p>
            </CardContent>
          </Card>
          <Card className="border-amber-100">
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-2xl font-bold text-purple-600">{weeklyCount}</p>
              <p className="text-xs text-muted-foreground mt-1">每週快照</p>
            </CardContent>
          </Card>
        </div>

        {/* 最新備份 + 手動觸發 */}
        <Card className="border-amber-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="w-4 h-4 text-green-600" />備份狀態
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {latest ? (
              <div className="flex items-center gap-3 bg-green-50 border border-green-100 rounded-xl px-4 py-3">
                <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-green-800 truncate">{latest.key.split("/").pop()}</p>
                  <p className="text-xs text-green-600">
                    {fmtDate(latest.lastModified)} · {fmtSize(Math.round(latest.size / 1024))}
                  </p>
                </div>
                {latest.key.includes("-weekly") && (
                  <Badge className="bg-purple-100 text-purple-700 border-purple-200 text-[10px]">週快照</Badge>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-3 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
                <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
                <p className="text-sm text-amber-700">尚無備份紀錄</p>
              </div>
            )}

            <Button
              onClick={handleRun}
              disabled={running}
              className="w-full gap-2 bg-amber-600 hover:bg-amber-700 text-white"
            >
              {running ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Database className="w-4 h-4" />
              )}
              {running ? "備份中，請稍候…" : "立即手動備份"}
            </Button>
            <p className="text-[11px] text-muted-foreground text-center">
              手動備份通常需時 10–60 秒，視乎資料庫大小
            </p>
          </CardContent>
        </Card>

        {/* 備份列表 */}
        <Card className="border-amber-100">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-amber-600" />備份檔案列表
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => refetch()} className="text-amber-600 gap-1">
                <RefreshCw className="w-3.5 h-3.5" />重整
              </Button>
            </div>
            <CardDescription className="text-xs">
              檔案存儲於 S3 · backups/ 目錄（gzip 壓縮）
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-center py-8 text-muted-foreground text-sm">載入中…</p>
            ) : list.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground text-sm">暫無備份檔案</p>
            ) : (
              <div className="space-y-2">
                {list.map((b, i) => {
                  const name = b.key.split("/").pop() ?? b.key;
                  const isWeekly = b.key.includes("-weekly");
                  return (
                    <div
                      key={b.key}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 border ${
                        i === 0 ? "border-green-200 bg-green-50/60" : "border-amber-100 bg-white"
                      }`}
                    >
                      <Clock className={`w-4 h-4 shrink-0 ${i === 0 ? "text-green-500" : "text-amber-400"}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-semibold text-amber-900 truncate">{name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {fmtDate(b.lastModified)} · {fmtSize(Math.round(b.size / 1024))}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {i === 0 && <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px]">最新</Badge>}
                        {isWeekly && <Badge className="bg-purple-100 text-purple-700 border-purple-200 text-[10px]">週快照</Badge>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 還原說明 */}
        <Card className="border-amber-100 bg-amber-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-amber-800">🔄 Disaster Recovery 還原步驟</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="text-xs text-amber-700 space-y-1.5 list-decimal list-inside">
              <li>從 S3 <code className="bg-white px-1 rounded">backups/</code> 下載最近一個 <code className="bg-white px-1 rounded">.sql.gz</code> 檔案</li>
              <li>用 <code className="bg-white px-1 rounded">gunzip backup.sql.gz</code> 解壓縮</li>
              <li>在新 MySQL 執行個體建立空資料庫</li>
              <li>執行 <code className="bg-white px-1 rounded">mysql -u root -p {'<DB名>'} {'<'} backup.sql</code></li>
              <li>更新 Railway 環境變數 <code className="bg-white px-1 rounded">BB_DATABASE_URL</code> 指向新資料庫</li>
              <li>重新部署 Railway 服務</li>
            </ol>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
