import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import AdminHeader from "@/components/AdminHeader";
import {
  Wifi, Database, Mail, Smartphone, CheckCircle2, XCircle,
  Loader2, ChevronLeft, Activity, Send, Server,
} from "lucide-react";

const RAILWAY_ORIGIN_LS_KEY = "admin_railway_origin_url";
const DEFAULT_RAILWAY_ORIGIN = (() => {
  if (typeof window === "undefined") return "";
  const host = window.location.hostname;
  if (host === "uat.hongxcollections.com") return "https://bb-coin-shop-app-uat-uat-6c7e.up.railway.app";
  return "";
})();

// ── 狀態 badge ──────────────────────────────────────────────────────────────
function StatusBadge({ ok, loading, idle }: { ok?: boolean; loading?: boolean; idle?: boolean }) {
  if (loading) return (
    <span className="flex items-center gap-1 text-xs text-amber-600 font-medium">
      <Loader2 className="w-3.5 h-3.5 animate-spin" />測試中…
    </span>
  );
  if (idle) return <span className="text-xs text-gray-400">尚未測試</span>;
  if (ok) return (
    <span className="flex items-center gap-1 text-xs text-green-600 font-semibold">
      <CheckCircle2 className="w-3.5 h-3.5" />正常
    </span>
  );
  return (
    <span className="flex items-center gap-1 text-xs text-red-500 font-semibold">
      <XCircle className="w-3.5 h-3.5" />失敗
    </span>
  );
}

// ── 延遲顏色 ───────────────────────────────────────────────────────────────
function latencyColor(ms: number) {
  if (ms < 80) return "text-green-600";
  if (ms < 300) return "text-amber-600";
  return "text-red-500";
}

export default function AdminSystemTest() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();

  // ── Ping state ──
  const [pingResults, setPingResults] = useState<{ rtt: number; serverTime: string }[]>([]);
  const [pingRunning, setPingRunning] = useState(false);
  const pingMut = trpc.systemTest.ping.useMutation();

  // ── 直連 Railway origin (bypass CF) state ──
  const [railwayOrigin, setRailwayOrigin] = useState<string>(DEFAULT_RAILWAY_ORIGIN);
  const [railwayResults, setRailwayResults] = useState<{ rtt: number }[]>([]);
  const [railwayRunning, setRailwayRunning] = useState(false);
  const [railwayError, setRailwayError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(RAILWAY_ORIGIN_LS_KEY);
      if (saved && saved.trim()) setRailwayOrigin(saved.trim());
    } catch {}
  }, []);

  // ── DB state ──
  const [dbResult, setDbResult] = useState<{ ok: boolean; ms: number; error?: string } | null>(null);
  const dbMut = trpc.systemTest.dbCheck.useMutation();

  // ── Email state ──
  const [emailTo, setEmailTo] = useState("");
  const [emailResult, setEmailResult] = useState<{ ok: boolean; emailId?: string; resendError?: string } | null>(null);
  const emailMut = trpc.systemTest.sendTestEmail.useMutation();

  // ── SMS state ──
  const [smsPhone, setSmsPhone] = useState("");
  const [smsResult, setSmsResult] = useState<{ ok: boolean; error?: string } | null>(null);
  const smsMut = trpc.systemTest.sendTestSms.useMutation();

  // ─────────────────────────────────────────────────────────────────────────

  if (authLoading) return null;
  if (!isAuthenticated || user?.role !== "admin") {
    navigate("/");
    return null;
  }

  // ── 連續 5 次 Ping ─────────────────────────────────────────────────────
  async function runPing() {
    setPingResults([]);
    setPingRunning(true);
    const res: typeof pingResults = [];
    for (let i = 0; i < 5; i++) {
      const t0 = Date.now();
      try {
        const data = await pingMut.mutateAsync();
        const rtt = Date.now() - t0;
        res.push({ rtt, serverTime: data.serverTime });
        setPingResults([...res]);
      } catch {
        res.push({ rtt: -1, serverTime: "" });
        setPingResults([...res]);
      }
      if (i < 4) await new Promise(r => setTimeout(r, 300));
    }
    setPingRunning(false);
  }

  // ── DB 測試 ────────────────────────────────────────────────────────────
  async function runDbCheck() {
    setDbResult(null);
    const data = await dbMut.mutateAsync();
    setDbResult(data as any);
  }

  // ── Email 測試 ─────────────────────────────────────────────────────────
  async function runEmailTest() {
    if (!emailTo.trim()) return;
    setEmailResult(null);
    const data = await emailMut.mutateAsync({ to: emailTo.trim() });
    setEmailResult(data);
  }

  // ── SMS 測試 ───────────────────────────────────────────────────────────
  async function runSmsTest() {
    if (!smsPhone.trim()) return;
    setSmsResult(null);
    const data = await smsMut.mutateAsync({ phone: smsPhone.trim() });
    setSmsResult(data as any);
  }

  const avgPing = pingResults.length > 0
    ? Math.round(pingResults.filter(r => r.rtt >= 0).reduce((s, r) => s + r.rtt, 0) / pingResults.filter(r => r.rtt >= 0).length)
    : null;

  // ── 直連 Railway origin 連續 5 次 ping ──
  // 用 fetch + mode:'no-cors' 對 /robots.txt 量度 RTT。Opaque response 唔讀 body，但 Promise resolve 嗰刻 = 收到 response，timing 有效。
  // 對比同一 host 經 CF 嘅延遲，可分辨 CF 加價 vs origin 自己慢。
  async function runRailwayPing() {
    const origin = railwayOrigin.trim().replace(/\/+$/, "");
    setRailwayError(null);
    setRailwayResults([]);
    if (!origin) {
      setRailwayError("請先填寫 Railway origin URL（例如 https://bb-coin-shop-app-xxx.up.railway.app）");
      return;
    }
    if (!/^https?:\/\//.test(origin)) {
      setRailwayError("URL 必須以 https:// 或 http:// 開頭");
      return;
    }
    try {
      localStorage.setItem(RAILWAY_ORIGIN_LS_KEY, origin);
    } catch {}
    setRailwayRunning(true);
    const res: { rtt: number }[] = [];
    for (let i = 0; i < 5; i++) {
      const url = `${origin}/robots.txt?_=${Date.now()}_${i}`;
      const t0 = Date.now();
      try {
        await fetch(url, { mode: "no-cors", cache: "no-store" });
        res.push({ rtt: Date.now() - t0 });
      } catch {
        res.push({ rtt: -1 });
      }
      setRailwayResults([...res]);
      if (i < 4) await new Promise(r => setTimeout(r, 300));
    }
    setRailwayRunning(false);
  }

  const avgRailway = railwayResults.length > 0
    ? (() => {
        const ok = railwayResults.filter(r => r.rtt >= 0);
        return ok.length === 0 ? null : Math.round(ok.reduce((s, r) => s + r.rtt, 0) / ok.length);
      })()
    : null;

  const cfDelta = (avgPing !== null && avgRailway !== null) ? avgPing - avgRailway : null;

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader />
      <div className="container max-w-xl mx-auto py-6 space-y-5">

        {/* 標題 */}
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/admin")} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <ChevronLeft className="w-5 h-5 text-gray-500" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-800">🛠️ 系統測試</h1>
            <p className="text-xs text-gray-500">診斷伺服器、資料庫、電郵及短訊功能</p>
          </div>
        </div>

        {/* ── 1. 網速 / 延遲測試 ──────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <Wifi className="w-4 h-4 text-blue-500" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-800 text-sm">網速 / 伺服器延遲</h2>
              <p className="text-xs text-gray-400">量度瀏覽器 → 伺服器往返時間（RTT）</p>
            </div>
          </div>

          {pingResults.length > 0 && (
            <div className="space-y-1.5">
              {pingResults.map((r, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className="text-gray-400 w-12">#{i + 1}</span>
                  {r.rtt < 0 ? (
                    <span className="text-red-400">逾時 / 失敗</span>
                  ) : (
                    <>
                      <span className={`font-bold ${latencyColor(r.rtt)}`}>{r.rtt} ms</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${r.rtt < 80 ? "bg-green-400" : r.rtt < 300 ? "bg-amber-400" : "bg-red-400"}`}
                          style={{ width: `${Math.min((r.rtt / 1000) * 100, 100)}%` }}
                        />
                      </div>
                    </>
                  )}
                </div>
              ))}
              {!pingRunning && avgPing !== null && (
                <div className="pt-2 border-t border-gray-50 text-xs text-gray-500 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5" />
                  平均延遲：<span className={`font-bold ${latencyColor(avgPing)}`}>{avgPing} ms</span>
                  <span className="ml-auto text-gray-400">
                    {avgPing < 80 ? "🟢 極快" : avgPing < 300 ? "🟡 一般" : "🔴 偏慢"}
                  </span>
                </div>
              )}
            </div>
          )}

          <button
            onClick={runPing}
            disabled={pingRunning}
            className="w-full py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {pingRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wifi className="w-4 h-4" />}
            {pingRunning ? `測試中… (${pingResults.length}/5)` : "開始延遲測試 (5次)"}
          </button>
        </div>

        {/* ── 1b. 直連 Railway origin (bypass CF) ─────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
              <Server className="w-4 h-4 text-indigo-500" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-semibold text-gray-800 text-sm">直連 Railway origin (bypass Cloudflare)</h2>
              <p className="text-xs text-gray-400">繞過 CF，直接 ping Railway *.up.railway.app；對比上面 RTT 分辨 CF 慢定 origin 慢</p>
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Railway origin URL</label>
            <input
              type="url"
              value={railwayOrigin}
              onChange={(e) => setRailwayOrigin(e.target.value)}
              placeholder="https://bb-coin-shop-app-xxx.up.railway.app"
              className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-indigo-400"
              disabled={railwayRunning}
            />
            <p className="text-[10px] text-gray-400 mt-1">URL 會儲入瀏覽器 localStorage，下次自動帶返。Railway dashboard → Service → Settings → Networking 攞 Public Domain。</p>
          </div>

          {railwayError && (
            <div className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg p-2">
              {railwayError}
            </div>
          )}

          {railwayResults.length > 0 && (
            <div className="space-y-1.5">
              {railwayResults.map((r, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className="text-gray-400 w-12">#{i + 1}</span>
                  {r.rtt < 0 ? (
                    <span className="text-red-400">逾時 / 失敗</span>
                  ) : (
                    <>
                      <span className={`font-bold ${latencyColor(r.rtt)}`}>{r.rtt} ms</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${r.rtt < 80 ? "bg-green-400" : r.rtt < 300 ? "bg-amber-400" : "bg-red-400"}`}
                          style={{ width: `${Math.min((r.rtt / 1000) * 100, 100)}%` }}
                        />
                      </div>
                    </>
                  )}
                </div>
              ))}
              {!railwayRunning && avgRailway !== null && (
                <div className="pt-2 border-t border-gray-50 text-xs text-gray-500 flex items-center gap-1.5 flex-wrap">
                  <Activity className="w-3.5 h-3.5" />
                  平均延遲：<span className={`font-bold ${latencyColor(avgRailway)}`}>{avgRailway} ms</span>
                  <span className="ml-auto text-gray-400">
                    {avgRailway < 80 ? "🟢 極快" : avgRailway < 300 ? "🟡 一般" : "🔴 偏慢"}
                  </span>
                </div>
              )}
            </div>
          )}

          {cfDelta !== null && (
            <div className={`text-xs rounded-lg p-2 border ${cfDelta > 100 ? "bg-amber-50 border-amber-200 text-amber-800" : cfDelta < -50 ? "bg-blue-50 border-blue-200 text-blue-800" : "bg-green-50 border-green-200 text-green-800"}`}>
              <strong>CF vs 直連差值：</strong>
              {cfDelta >= 0
                ? `CF 慢 ${cfDelta} ms（${cfDelta > 100 ? "CF 路由較慢" : "正常範圍"}）`
                : `CF 快 ${Math.abs(cfDelta)} ms（CF 邊緣 cache / PoP 較近）`}
            </div>
          )}

          <button
            onClick={runRailwayPing}
            disabled={railwayRunning}
            className="w-full py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {railwayRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Server className="w-4 h-4" />}
            {railwayRunning ? `測試中… (${railwayResults.length}/5)` : "開始直連測試 (5次)"}
          </button>
        </div>

        {/* ── 2. 資料庫延遲 ───────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center">
              <Database className="w-4 h-4 text-purple-500" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-800 text-sm">資料庫連線</h2>
              <p className="text-xs text-gray-400">伺服器 → MySQL 資料庫往返時間</p>
            </div>
            <div className="ml-auto">
              <StatusBadge
                ok={dbResult?.ok}
                loading={dbMut.isPending}
                idle={!dbResult && !dbMut.isPending}
              />
            </div>
          </div>

          {dbResult && (
            <div className={`rounded-xl p-3 text-sm ${dbResult.ok ? "bg-green-50" : "bg-red-50"}`}>
              {dbResult.ok ? (
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span className="text-green-700 font-medium">
                    資料庫正常，查詢耗時 <span className={`font-bold ${latencyColor(dbResult.ms)}`}>{dbResult.ms} ms</span>
                  </span>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-red-600">
                    <XCircle className="w-4 h-4" />
                    <span className="font-medium">資料庫連線失敗</span>
                  </div>
                  {dbResult.error && <p className="text-xs text-red-400 pl-6">{dbResult.error}</p>}
                </div>
              )}
            </div>
          )}

          <button
            onClick={runDbCheck}
            disabled={dbMut.isPending}
            className="w-full py-2.5 rounded-xl bg-purple-500 hover:bg-purple-600 text-white text-sm font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {dbMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
            {dbMut.isPending ? "測試中…" : "測試資料庫連線"}
          </button>
        </div>

        {/* ── 3. 電郵測試 ─────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
              <Mail className="w-4 h-4 text-amber-500" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-800 text-sm">電郵發送測試</h2>
              <p className="text-xs text-gray-400">輸入電郵地址，確認能否正常接收</p>
            </div>
            {emailResult && (
              <div className="ml-auto">
                <StatusBadge ok={emailResult.ok} />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <input
              type="email"
              placeholder="輸入測試電郵地址"
              value={emailTo}
              onChange={e => { setEmailTo(e.target.value); setEmailResult(null); }}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
            />
            {emailResult && (
              <div className={`rounded-xl p-3 text-xs ${emailResult.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
                {emailResult.ok
                  ? `✅ 電郵已發送！請到 ${emailTo} 查收（Email ID: ${emailResult.emailId ?? "-"}）`
                  : `❌ 發送失敗：${emailResult.resendError ?? "未知錯誤"}`}
              </div>
            )}
          </div>

          <button
            onClick={runEmailTest}
            disabled={emailMut.isPending || !emailTo.trim()}
            className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {emailMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {emailMut.isPending ? "發送中…" : "發送測試電郵"}
          </button>
        </div>

        {/* ── 4. 手機短訊測試 ──────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
              <Smartphone className="w-4 h-4 text-green-500" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-800 text-sm">手機短訊測試</h2>
              <p className="text-xs text-gray-400">輸入手機號碼（含國家碼），確認能否收到短訊</p>
            </div>
            {smsResult && (
              <div className="ml-auto">
                <StatusBadge ok={smsResult.ok} />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <input
              type="tel"
              placeholder="例：+85291234567"
              value={smsPhone}
              onChange={e => { setSmsPhone(e.target.value); setSmsResult(null); }}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-300"
            />
            <p className="text-[11px] text-gray-400">香港：+852xxxxxxxx　中國：+86xxxxxxxxxx　其他需帶國家碼</p>
            {smsResult && (
              <div className={`rounded-xl p-3 text-xs ${smsResult.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
                {smsResult.ok
                  ? `✅ 短訊已發送至 ${smsPhone}，請查收（測試碼 000000）`
                  : `❌ 發送失敗：${smsResult.error ?? "未知錯誤"}`}
              </div>
            )}
          </div>

          <button
            onClick={runSmsTest}
            disabled={smsMut.isPending || !smsPhone.trim()}
            className="w-full py-2.5 rounded-xl bg-green-500 hover:bg-green-600 text-white text-sm font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {smsMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Smartphone className="w-4 h-4" />}
            {smsMut.isPending ? "發送中…" : "發送測試短訊"}
          </button>
        </div>

        {/* ── 備注 ──────────────────────────────────────────────────────── */}
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-xs text-amber-700 space-y-1">
          <p className="font-semibold">📌 備注</p>
          <p>• 延遲測試量度的是瀏覽器到 Railway 伺服器，若 UAT 順暢而 Production 慢，建議到 Railway 控制台查看 Production 服務的部署地區及資源使用。</p>
          <p>• 電郵由 Resend 服務發送，短訊由 Twilio（非大陸）或阿里雲（+86）發送。</p>
          <p>• 短訊測試碼固定為 <span className="font-mono font-bold">000000</span>，收到即代表短訊系統正常。</p>
        </div>

      </div>
    </div>
  );
}
