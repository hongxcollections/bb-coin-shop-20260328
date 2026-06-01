import { X, Printer } from "lucide-react";
import { trpc } from "@/lib/trpc";

interface Props {
  open: boolean;
  onClose: () => void;
  roundId: number;
  roundTitle: string;
  type?: "buyer" | "platform";
}

export function GroupAuctionCommissionModal({ open, onClose, roundId, roundTitle, type = "buyer" }: Props) {
  const buyerResult = trpc.groupAuctions.getBuyerCommissionSummary.useQuery(
    { roundId },
    { enabled: open && type === "buyer", staleTime: 60_000 }
  );
  const platformResult = trpc.groupAuctions.getPlatformCommissionSummary.useQuery(
    { roundId },
    { enabled: open && type === "platform", staleTime: 60_000 }
  );

  const isLoading = type === "buyer" ? buyerResult.isLoading : platformResult.isLoading;
  const data = type === "buyer" ? buyerResult.data : platformResult.data;

  const title = type === "buyer" ? "買家傭金匯報" : "平台傭金匯報";
  const rateLabel = type === "buyer" ? "買家傭金率" : "平台傭金率";
  const commLabel = type === "buyer" ? "買家傭金" : "平台傭金";

  if (!open) return null;

  const handlePrint = () => {
    window.print();
  };

  const fmtDate = (d: string | Date | null | undefined) => {
    if (!d) return "—";
    return new Date(d).toLocaleString("zh-HK", { dateStyle: "short", timeStyle: "short" });
  };

  const fmtMoney = (n: number, decimals = 0) =>
    n.toLocaleString("en", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #ga-commission-portal,
          #ga-commission-portal * { visibility: visible !important; }
          #ga-commission-portal { position: fixed; inset: 0; background: white; z-index: 99999; }
          #ga-commission-portal .no-print { display: none !important; }
          #ga-commission-portal .modal-backdrop { background: transparent !important; position: static !important; display: block !important; }
          #ga-commission-portal .modal-box {
            position: static !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            max-height: none !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
          }
          #ga-commission-portal .modal-body {
            overflow: visible !important;
            max-height: none !important;
          }
        }
      `}</style>

      <div id="ga-commission-portal">
        <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-[6px] pb-20">
          <div className="modal-box bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">

            {/* Header */}
            <div className="no-print flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
              <h2 className="font-bold text-gray-900 text-base">{title}</h2>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="modal-body overflow-y-auto flex-1 p-5">

              {/* Info block */}
              <div className="mb-5">
                <h1 className="text-base font-bold text-gray-900">
                  {data?.round.title ?? roundTitle}
                  {data?.round.periodNumber ? ` · 第 ${data.round.periodNumber} 期` : ""}
                </h1>
                <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-xs text-gray-500">
                  {data?.round.endAt && <span>結拍：{fmtDate(data.round.endAt)}</span>}
                  <span>{rateLabel}：{data ? (data.round.commissionRate * 100).toFixed(1) : "—"}%</span>
                </div>
              </div>

              {isLoading && (
                <p className="text-center text-gray-400 text-sm py-12">載入中...</p>
              )}

              {data && (
                <>
                  {data.soldItems.length === 0 ? (
                    <p className="text-center text-gray-400 text-sm py-12">未有成交商品，無傭金記錄</p>
                  ) : (
                    <table className="w-full border-collapse" style={{ fontSize: "10px" }}>
                      <thead>
                        <tr>
                          <th className="text-left p-2 border border-gray-200 bg-amber-50 text-amber-800 font-semibold w-10">#</th>
                          <th className="text-left p-2 border border-gray-200 bg-amber-50 text-amber-800 font-semibold">商品名稱</th>
                          <th className="text-right p-2 border border-gray-200 bg-amber-50 text-amber-800 font-semibold">成交價</th>
                          <th className="text-right p-2 border border-gray-200 bg-amber-50 text-amber-800 font-semibold">{commLabel}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(data.soldItems as Array<{ id: number; order: number; name: string; lotNo?: string | null; finalPrice: number; commission: number; buyNowPrice?: number | null; isCapped?: boolean }>).map((item, idx) => (
                          <tr key={item.id} className="border-b border-gray-200">
                            <td className="px-2 py-1.5 text-gray-400">{item.order}</td>
                            <td className="px-2 py-1.5 text-gray-900">
                              {item.name}{item.lotNo ? `·${item.lotNo}` : ""}
                            </td>
                            <td className="px-2 py-1.5 text-right text-gray-900">
                              {item.isCapped && item.buyNowPrice ? (
                                <div className="flex items-start justify-end gap-[3px]">
                                  <span>HK${fmtMoney(item.finalPrice)}</span>
                                  <span className="inline-block bg-orange-100 text-orange-600 font-semibold px-1 py-0.5 rounded leading-none" style={{ fontSize: "5px" }}>
                                    封頂價
                                  </span>
                                </div>
                              ) : (
                                <span>HK${fmtMoney(item.finalPrice)}</span>
                              )}
                            </td>
                            <td className="px-2 py-1.5 text-right text-rose-600 font-medium">
                              HK${fmtMoney(item.commission, 2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="font-semibold">
                          <td className="p-2 border border-gray-200 bg-amber-50 text-amber-800" colSpan={2}>
                            合計（{data.soldCount} 件成交）
                          </td>
                          <td className="p-2 border border-gray-200 bg-amber-50 text-right text-amber-800">
                            HK${fmtMoney(data.totalSales)}
                          </td>
                          <td className="p-2 border border-gray-200 bg-amber-50 text-right text-rose-600">
                            HK${fmtMoney(data.totalCommission, 2)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  )}

                  <p className="text-xs text-gray-400 mt-4">
                    列印日期：{new Date().toLocaleDateString("zh-HK")} · 大BB錢幣店 hongxcollections.com
                  </p>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="no-print flex justify-end gap-2 px-5 py-3 border-t border-gray-100 flex-shrink-0">
              <button
                onClick={handlePrint}
                disabled={isLoading || !data}
                className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-xl"
              >
                <Printer className="w-4 h-4" />
                列印 / 下載 PDF
              </button>
              <button
                onClick={onClose}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium px-4 py-2 rounded-xl"
              >
                關閉
              </button>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}
