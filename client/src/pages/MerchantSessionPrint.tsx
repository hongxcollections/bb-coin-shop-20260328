import { useEffect, useMemo } from "react";
import { useRoute } from "wouter";
import { trpc } from "@/lib/trpc";

function getCurrencySymbol(c?: string) {
  switch (c) {
    case "USD": return "US$"; case "CNY": return "¥"; case "GBP": return "£";
    case "EUR": return "€"; case "JPY": return "¥"; default: return "HK$";
  }
}

function fmtDateTime(d: Date | string | null | undefined) {
  if (!d) return "-";
  return new Date(d).toLocaleString("zh-HK", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
}

export default function MerchantSessionPrint() {
  const [, reportParams] = useRoute<{ id: string }>("/merchant/sessions/:id/print/report");
  const [, invoiceParams] = useRoute<{ id: string; winnerId: string }>("/merchant/sessions/:id/print/invoice/:winnerId");
  const sessionId = reportParams ? parseInt(reportParams.id, 10) : invoiceParams ? parseInt(invoiceParams.id, 10) : 0;
  const winnerId = invoiceParams ? parseInt(invoiceParams.winnerId, 10) : null;
  const mode: "report" | "invoice" = winnerId ? "invoice" : "report";

  const { data, isLoading } = trpc.merchantSessions.getMine.useQuery(
    { id: sessionId },
    { enabled: sessionId > 0 }
  );
  const { data: emailStatus } = trpc.merchantSessions.getEmailStatus.useQuery(
    { sessionId },
    { enabled: sessionId > 0 && mode === "report" }
  );

  const session = data?.session;
  const items = data?.items || [];
  const summary = data?.summary;

  const soldItems = useMemo(
    () => items.filter((it: any) => it.auction?.highestBidderId),
    [items]
  );

  const winnerItems = useMemo(() => {
    if (!winnerId) return [];
    return soldItems.filter((it: any) => it.auction.highestBidderId === winnerId);
  }, [soldItems, winnerId]);

  const winnerInfo = useMemo(() => {
    if (!winnerId || winnerItems.length === 0) return null;
    const a = winnerItems[0].auction;
    const totalsByCurrency: Record<string, number> = {};
    for (const it of winnerItems) {
      const cur = it.auction.currency || "HKD";
      totalsByCurrency[cur] = (totalsByCurrency[cur] || 0) + (parseFloat(String(it.auction.currentPrice)) || 0);
    }
    return { name: a.highestBidderName ?? `用戶 #${winnerId}`, totalsByCurrency };
  }, [winnerItems, winnerId]);

  useEffect(() => {
    if (!isLoading && data) {
      const t = setTimeout(() => window.print(), 600);
      return () => clearTimeout(t);
    }
  }, [isLoading, data]);

  if (sessionId <= 0) return <div className="p-8">無效的專場 ID</div>;
  if (isLoading || !session) return <div className="p-8">載入中...</div>;
  if (mode === "invoice" && winnerItems.length === 0) {
    return <div className="p-8">該中標者於此專場冇得標記錄</div>;
  }

  return (
    <>
      <style>{`
        @media print {
          @page { size: A4; margin: 14mm; }
          .no-print { display: none !important; }
        }
        body { background: #fff; }
      `}</style>
      <div className="max-w-3xl mx-auto px-6 py-6 text-gray-900" style={{ fontFamily: "system-ui, -apple-system, 'PingFang HK', 'Microsoft JhengHei', sans-serif" }}>
        <div className="no-print mb-4 flex items-center justify-end gap-2">
          <button
            onClick={() => window.print()}
            className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-semibold"
          >
            列印 / 儲存為 PDF
          </button>
        </div>

        <div className="border-b-2 border-amber-600 pb-3 mb-4">
          <div className="text-xs text-gray-500">hongxcollections — 大BB錢幣店</div>
          <h1 className="text-2xl font-bold text-amber-900 mt-1">
            {mode === "report" ? "📊 專場成交報表" : "🧾 中標 invoice"}
          </h1>
          <div className="text-sm text-gray-600 mt-1">
            專場：<span className="font-semibold">{session.title}</span>
          </div>
          <div className="text-xs text-gray-500 mt-0.5">
            結束時間：{fmtDateTime(session.endAt)}
            {mode === "report" && emailStatus?.sentAt && (
              <> ・ 中標通知發送時間：{fmtDateTime(emailStatus.sentAt)}</>
            )}
          </div>
        </div>

        {mode === "report" && summary && (
          <>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="border border-emerald-200 rounded p-2 text-center">
                <div className="text-xs text-gray-600">成交</div>
                <div className="text-xl font-bold text-emerald-700">{summary.soldCount}</div>
              </div>
              <div className="border border-gray-200 rounded p-2 text-center">
                <div className="text-xs text-gray-600">流拍</div>
                <div className="text-xl font-bold text-gray-500">{summary.unsoldCount}</div>
              </div>
              <div className="border border-amber-200 rounded p-2 text-center">
                <div className="text-xs text-gray-600">總商品</div>
                <div className="text-xl font-bold text-amber-900">{summary.totalCount}</div>
              </div>
            </div>
            <div className="border border-amber-300 rounded p-3 mb-4 bg-amber-50">
              <div className="text-sm font-semibold text-amber-900 mb-1">總成交額</div>
              {Object.keys(summary.totalsByCurrency || {}).length === 0 ? (
                <div className="text-right text-xl font-bold text-amber-700">{getCurrencySymbol(summary.currency)}0</div>
              ) : Object.entries(summary.totalsByCurrency).map(([cur, amt]) => (
                <div key={cur} className="flex justify-between">
                  <span className="text-xs text-gray-700">{cur}</span>
                  <span className="text-xl font-bold text-amber-700 tabular-nums">{getCurrencySymbol(cur)}{Math.round(amt as number).toLocaleString()}</span>
                </div>
              ))}
            </div>

            <h2 className="text-base font-semibold text-amber-900 mb-2">成交明細</h2>
            {soldItems.length === 0 ? (
              <div className="text-sm text-gray-500 py-4">本場全部商品流拍</div>
            ) : (
              <table className="w-full text-sm border border-gray-200">
                <thead className="bg-amber-100 text-amber-900">
                  <tr>
                    <th className="text-left px-2 py-1.5 font-semibold border-r border-amber-200">#</th>
                    <th className="text-left px-2 py-1.5 font-semibold border-r border-amber-200">商品</th>
                    <th className="text-left px-2 py-1.5 font-semibold border-r border-amber-200">中標者</th>
                    <th className="text-right px-2 py-1.5 font-semibold">成交價</th>
                  </tr>
                </thead>
                <tbody>
                  {soldItems.map((it: any, idx: number) => {
                    const a = it.auction;
                    return (
                      <tr key={it.id} className="border-t border-gray-200">
                        <td className="px-2 py-1.5 text-gray-500 border-r border-gray-100 tabular-nums">{idx + 1}</td>
                        <td className="px-2 py-1.5 border-r border-gray-100">{a.title}</td>
                        <td className="px-2 py-1.5 border-r border-gray-100">{a.highestBidderName ?? `用戶 #${a.highestBidderId}`}</td>
                        <td className="px-2 py-1.5 text-right font-semibold tabular-nums">
                          {getCurrencySymbol(a.currency)}{Number(a.currentPrice).toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </>
        )}

        {mode === "invoice" && winnerInfo && (
          <>
            <div className="border border-amber-200 rounded p-3 mb-3 bg-amber-50">
              <div className="text-xs text-gray-600">買家</div>
              <div className="text-lg font-semibold text-amber-900">{winnerInfo.name}</div>
            </div>
            <h2 className="text-base font-semibold text-amber-900 mb-2">得標商品（共 {winnerItems.length} 件）</h2>
            <table className="w-full text-sm border border-gray-200 mb-3">
              <thead className="bg-amber-100 text-amber-900">
                <tr>
                  <th className="text-left px-2 py-1.5 font-semibold border-r border-amber-200">#</th>
                  <th className="text-left px-2 py-1.5 font-semibold border-r border-amber-200">商品</th>
                  <th className="text-right px-2 py-1.5 font-semibold">成交價</th>
                </tr>
              </thead>
              <tbody>
                {winnerItems.map((it: any, idx: number) => {
                  const a = it.auction;
                  return (
                    <tr key={it.id} className="border-t border-gray-200">
                      <td className="px-2 py-1.5 text-gray-500 border-r border-gray-100 tabular-nums">{idx + 1}</td>
                      <td className="px-2 py-1.5 border-r border-gray-100">{a.title}</td>
                      <td className="px-2 py-1.5 text-right font-semibold tabular-nums">
                        {getCurrencySymbol(a.currency)}{Number(a.currentPrice).toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="border-t-2 border-amber-600 pt-3">
              <div className="text-sm font-semibold text-amber-900 mb-1">總成交額</div>
              {Object.entries(winnerInfo.totalsByCurrency).map(([cur, amt]) => (
                <div key={cur} className="flex justify-between">
                  <span className="text-xs text-gray-700">{cur}</span>
                  <span className="text-2xl font-extrabold text-amber-700 tabular-nums">{getCurrencySymbol(cur)}{Math.round(amt as number).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="mt-6 pt-3 border-t border-gray-200 text-[10px] text-gray-500">
          列印時間：{fmtDateTime(new Date())} ・ hongxcollections.com
        </div>
      </div>
    </>
  );
}
