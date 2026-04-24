import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import AdminHeader from "@/components/AdminHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ChevronLeft, Database, RefreshCw, Clock, HardDrive,
  CheckCircle, AlertCircle, Shield, Bell, Archive, BarChart3, Trash2
} from "lucide-react";

const DB_LIMIT_MB = 1024; // Railway free tier 1 GB reference

function fmtSize(kb: number) {
  if (kb < 1024) return `${kb} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}
function fmtMb(mb: number) {
  if (mb < 1) return `${Math.round(mb * 1024)} KB`;
  return `${mb.toFixed(2)} MB`;
}
function fmtDate(d: Date | string) {
  return new Date(d).toLocaleString("zh-HK", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function AdminBackup() {
  const { user, isAuthenticated } = useAuth();
  const [runningBackup, setRunningBackup] = useState(false);
  const [runningCleanup, setRunningCleanup] = useState(false);
  const [runningArchive, setRunningArchive] = useState(false);

  const { data: backups, isLoading: backupsLoading, refetch: refetchBackups } = trpc.backup.list.useQuery(undefined, { refetchOnWindowFocus: false });
  const { data: dbSize, isLoading: sizeLoading, refetch: refetchSize } = trpc.backup.dbSize.useQuery(undefined, { refetchOnWindowFocus: false });

  const runMutation = trpc.backup.run.useMutation({
    onSuccess: (r) => { toast.success(`備份完成：${r.key}（${r.sizeKb} KB）`); refetchBackups(); },
    onError: (e) => toast.error(`備份失敗：${e.message}`),
    onSettled: () => setRunningBackup(false),
  });
  const cleanupMutation = trpc.backup.cleanupNotifications.useMutation({
    onSuccess: (r) => {
      toast.success(`清理完成：通知 ${r.notificationsDeleted} 條、代理出價日誌 ${r.proxyBidLogsDeleted} 條、過期推播 ${r.pushSubsDeleted} 條`);
      refetchSize();
    },
    onError: (e) => toast.error(`清理失敗：${e.message}`),
    onSettled: () => setRunningCleanup(false),
  });
  const archiveMutation = trpc.backup.archiveBids.useMutation({
    onSuccess: (r) => {
      toast.success(`歸檔完成：處理 ${r.auctionsProcessed} 場拍賣，歸檔 ${r.archived} 條出價記錄`);
      refetchSize();
    },
    onError: (e) => toast.error(`歸檔失敗：${e.message}`),
    onSettled: () => setRunningArchive(false),
  });

  if (!isAuthenticated || user?.role !== "admin") {
    return <div className="min-h-screen flex items-center justify-center"><p className="text-muted-foreground">無權限</p></div>;
  }

  const list = backups ?? [];
  const latest = list[0];
  const usedMb = dbSize?.totalMb ?? 0;
  const usedPct = Math.min(100, (usedMb / DB_LIMIT_MB) * 100);
  const barColor = usedPct > 80 ? "bg-red-500" : usedPct > 50 ? "bg-amber-500" : "bg-green-500";

  return (
    <div className="min-h-screen bg-amber-50/30">
      <AdminHeader />
      <div className="container max-w-3xl py-6 space-y-4">

        {/* 標題 */}
        <div className="flex items-center gap-3">
          <Link href="/admin">
            <Button variant="ghost" size="sm" className="gap-1 text-amber-700"><ChevronLeft className="w-4 h-4" />返回</Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-amber-900 flex items-center gap-2">
              <Database className="w-5 h-5 text-amber-600" />資料庫管理
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">備份 · 容量監控 · 自動維護</p>
          </div>
        </div>

        {/* ── ③ DB 容量監控 ── */}
        <Card className="border-amber-200">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-amber-600" />資料庫容量
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => refetchSize()} className="text-amber-600 gap-1 h-7">
                <RefreshCw className="w-3 h-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {sizeLoading ? (
              <p className="text-sm text-muted-foreground text-center py-2">載入中…</p>
            ) : dbSize ? (
              <>
                {/* 進度條 */}
                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="font-semibold text-amber-900">{fmtMb(usedMb)} 已用</span>
                    <span className="text-muted-foreground">參考上限 {fmtMb(DB_LIMIT_MB)}（Railway）</span>
                  </div>
                  <div className="w-full bg-amber-100 rounded-full h-3 overflow-hidden">
                    <div
                      className={`h-3 rounded-full transition-all duration-500 ${barColor}`}
                      style={{ width: `${Math.max(usedPct, 0.5)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                    <span>{usedPct.toFixed(2)}% 已用</span>
                    <span>{fmtMb(DB_LIMIT_MB - usedMb)} 剩餘</span>
                  </div>
                </div>

                {/* 小統計 */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "資料", val: fmtMb(dbSize.dataMb) },
                    { label: "索引", val: fmtMb(dbSize.indexMb) },
                    { label: "Tables", val: `${dbSize.tableCount} 張` },
                  ].map(s => (
                    <div key={s.label} className="text-center bg-amber-50 rounded-xl py-2">
                      <p className="text-sm font-bold text-amber-700">{s.val}</p>
                      <p className="text-[10px] text-muted-foreground">{s.label}</p>
                    </div>
                  ))}
                </div>

                {/* Top tables */}
                <div>
                  <p className="text-[11px] font-semibold text-amber-800 mb-1.5">最大的 Table</p>
                  <div className="space-y-1">
                    {dbSize.tables.slice(0, 8).map(t => (
                      <div key={t.name} className="flex items-center gap-2 text-xs">
                        <span className="text-amber-900 font-mono w-44 truncate">{t.name}</span>
                        <div className="flex-1 bg-amber-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="h-1.5 rounded-full bg-amber-400"
                            style={{ width: `${dbSize.tables[0]?.sizeMb ? (t.sizeMb / dbSize.tables[0].sizeMb) * 100 : 0}%` }}
                          />
                        </div>
                        <span className="text-muted-foreground w-14 text-right">{fmtMb(t.sizeMb)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>

        {/* ── 維護操作 ── */}
        <Card className="border-amber-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-amber-600" />資料維護
            </CardTitle>
            <CardDescription className="text-xs">自動排程：每日 HKT 02:00 清理通知、每週一 HKT 03:00 歸檔出價記錄</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">

            {/* ① 清理舊通知 */}
            <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-xl p-3">
              <Bell className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-blue-900">清理舊通知 & 日誌</p>
                <p className="text-[11px] text-blue-600 mt-0.5">刪除 90 天前通知、6 個月前代理出價日誌、過期推播 Token</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={runningCleanup}
                onClick={() => { setRunningCleanup(true); cleanupMutation.mutate(); }}
                className="border-blue-200 text-blue-700 hover:bg-blue-100 shrink-0 gap-1"
              >
                {runningCleanup ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                立即清理
              </Button>
            </div>

            {/* ② 歸檔舊出價記錄 */}
            <div className="flex items-start gap-3 bg-purple-50 border border-purple-100 rounded-xl p-3">
              <Archive className="w-4 h-4 text-purple-500 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-purple-900">歸檔舊出價記錄</p>
                <p className="text-[11px] text-purple-600 mt-0.5">結拍超過 1 年的拍賣，所有出價移入 bids_archive 表，只保留得標者最後一口</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={runningArchive}
                onClick={() => { setRunningArchive(true); archiveMutation.mutate(); }}
                className="border-purple-200 text-purple-700 hover:bg-purple-100 shrink-0 gap-1"
              >
                {runningArchive ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Archive className="w-3 h-3" />}
                立即歸檔
              </Button>
            </div>

          </CardContent>
        </Card>

        {/* ── 備份管理 ── */}
        <Card className="border-amber-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="w-4 h-4 text-green-600" />S3 備份
            </CardTitle>
            <CardDescription className="text-xs">每日 HKT 02:00 自動備份 · 每日保留 30 天 · 週快照保留 3 個月</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* 最新備份狀態 */}
            {latest ? (
              <div className="flex items-center gap-3 bg-green-50 border border-green-100 rounded-xl px-4 py-3">
                <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-green-800 truncate">{latest.key.split("/").pop()}</p>
                  <p className="text-xs text-green-600">{fmtDate(latest.lastModified)} · {fmtSize(Math.round(latest.size / 1024))}</p>
                </div>
                {latest.key.includes("-weekly") && <Badge className="bg-purple-100 text-purple-700 border-purple-200 text-[10px]">週快照</Badge>}
              </div>
            ) : (
              <div className="flex items-center gap-3 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
                <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
                <p className="text-sm text-amber-700">尚無備份紀錄</p>
              </div>
            )}

            <Button
              onClick={() => { setRunningBackup(true); runMutation.mutate(); }}
              disabled={runningBackup}
              className="w-full gap-2 bg-amber-600 hover:bg-amber-700 text-white"
            >
              {runningBackup ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
              {runningBackup ? "備份中，請稍候…" : "立即手動備份"}
            </Button>

            {/* 備份列表 */}
            {!backupsLoading && list.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[11px] font-semibold text-amber-800">所有備份（{list.length} 個）</p>
                  <Button variant="ghost" size="sm" onClick={() => refetchBackups()} className="h-6 text-amber-600 gap-1 text-[10px]">
                    <RefreshCw className="w-3 h-3" />重整
                  </Button>
                </div>
                <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                  {list.map((b, i) => {
                    const name = b.key.split("/").pop() ?? b.key;
                    const isWeekly = b.key.includes("-weekly");
                    return (
                      <div key={b.key} className={`flex items-center gap-2.5 rounded-xl px-3 py-2 border text-xs ${i === 0 ? "border-green-200 bg-green-50/60" : "border-amber-100 bg-white"}`}>
                        <Clock className={`w-3.5 h-3.5 shrink-0 ${i === 0 ? "text-green-500" : "text-amber-400"}`} />
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-amber-900 truncate">{name}</p>
                          <p className="text-muted-foreground">{fmtDate(b.lastModified)} · {fmtSize(Math.round(b.size / 1024))}</p>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          {i === 0 && <Badge className="bg-green-100 text-green-700 border-green-200 text-[9px]">最新</Badge>}
                          {isWeekly && <Badge className="bg-purple-100 text-purple-700 border-purple-200 text-[9px]">週快照</Badge>}
                        </div>
                      </div>
                    );
                  })}
                </div>
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
              <li>從 S3 <code className="bg-white px-1 rounded">backups/</code> 下載最近 <code className="bg-white px-1 rounded">.sql.gz</code></li>
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
