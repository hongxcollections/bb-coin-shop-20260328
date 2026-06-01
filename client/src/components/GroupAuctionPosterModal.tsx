import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { QRCodeCanvas } from "qrcode.react";
import { Copy, Check, Download } from "lucide-react";
import { toast } from "sonner";

interface GroupAuctionPosterProps {
  open: boolean;
  onClose: () => void;
  round: {
    id: number;
    title: string;
    coverImage?: string | null;
    startAt?: string | Date | null;
    endAt?: string | Date | null;
    periodNumber?: number | null;
  };
  merchantName?: string | null;
  merchantAvatar?: string | null;
}

function fmtDate(d: string | Date | null | undefined) {
  if (!d) return null;
  const dt = new Date(d);
  return `${dt.getMonth() + 1}月${dt.getDate()}日 ${dt.getHours().toString().padStart(2, "0")}:${dt.getMinutes().toString().padStart(2, "0")}`;
}

export function GroupAuctionPosterModal({ open, onClose, round, merchantName, merchantAvatar }: GroupAuctionPosterProps) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedMsg, setCopiedMsg] = useState(false);
  const qrRef = useRef<HTMLCanvasElement>(null);

  const fullUrl = `https://hongxcollections.com/group/${round.id}`;
  const shortUrl = `hongxcollections.com/group/${round.id}`;
  const periodStr = round.periodNumber ? `第 ${round.periodNumber} 期` : "";
  const displayTitle = periodStr ? `【${round.title}】${periodStr}` : `【${round.title}】`;

  const startStr = fmtDate(round.startAt);
  const endStr = fmtDate(round.endAt) ?? "待定";
  const dateRangeStr = startStr ? `${startStr} 至 ${endStr}` : endStr;

  const promoMsg =
    `${displayTitle}\n` +
    `拍賣 ${dateRangeStr}\n` +
    `\n直接網頁出價！首次用手機登記（30秒），之後每場自動登入，出價實時生效，不需要再留言 +序號商品！\n\n${fullUrl}`;

  function copyLink() {
    navigator.clipboard.writeText(fullUrl).then(() => {
      setCopiedLink(true);
      toast.success("連結已複製");
      setTimeout(() => setCopiedLink(false), 2500);
    });
  }

  function copyMsg() {
    navigator.clipboard.writeText(promoMsg).then(() => {
      setCopiedMsg(true);
      toast.success("推廣訊息已複製，可直接貼入微信群");
      setTimeout(() => setCopiedMsg(false), 2500);
    });
  }

  function downloadQr() {
    const qrCanvas = qrRef.current;
    if (!qrCanvas) return;

    const scale = 3;
    const size = 200 * scale;
    const pad = 24 * scale;
    const merchantH = 22 * scale;
    const titleH = 18 * scale;
    const poweredH = 8 * scale;
    const gapAfterQR = 8 * scale;
    const gapLine = 4 * scale;

    const canvas = document.createElement("canvas");
    canvas.width = size + pad * 2;
    canvas.height = pad + size + gapAfterQR + merchantH + gapLine + titleH + gapLine + poweredH + pad;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // 畫 QR code（保持琥珀色，從 QRCodeCanvas 複製過來）
    ctx.drawImage(qrCanvas, 0, 0, qrCanvas.width, qrCanvas.height, pad, pad, size, size);

    const merchantText = merchantName || "商戶";
    const titleText = round.title || "";
    const rightX = pad + size;
    const merchantY = pad + size + gapAfterQR + merchantH / 2;
    const titleY = pad + size + gapAfterQR + merchantH + gapLine + titleH / 2;
    const poweredY = pad + size + gapAfterQR + merchantH + gapLine + titleH + gapLine + poweredH / 2;

    const makeGoldGradient = (y: number) => {
      const g = ctx.createLinearGradient(0, y - 10 * scale, 0, y + 10 * scale);
      g.addColorStop(0, "#f59e0b");
      g.addColorStop(0.5, "#d97706");
      g.addColorStop(1, "#92400e");
      return g;
    };

    ctx.textBaseline = "middle";
    ctx.textAlign = "right";
    // 第一行：商戶名稱
    ctx.font = `bold ${18 * scale}px -apple-system, BlinkMacSystemFont, "PingFang TC", "Microsoft JhengHei", sans-serif`;
    ctx.fillStyle = makeGoldGradient(merchantY);
    ctx.fillText(merchantText, rightX, merchantY);
    // 第二行：團拍名稱
    ctx.font = `bold ${15 * scale}px -apple-system, BlinkMacSystemFont, "PingFang TC", "Microsoft JhengHei", sans-serif`;
    ctx.fillStyle = makeGoldGradient(titleY);
    ctx.fillText(titleText, rightX, titleY);
    // 第三行：Powered by
    ctx.font = `${3 * scale}px -apple-system, BlinkMacSystemFont, sans-serif`;
    ctx.fillStyle = makeGoldGradient(poweredY);
    ctx.fillText("Powered by hongxcollections.com", rightX, poweredY);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `qr-group-${round.id}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, "image/png");
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xs p-0 overflow-hidden rounded-2xl mb-20">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle className="text-base font-semibold text-amber-900">微信群入場海報</DialogTitle>
        </DialogHeader>

        {/* ── 海報本體（長按截圖用）── */}
        <div className="mx-4 rounded-2xl overflow-hidden border border-amber-200 shadow-md">
          {/* 頂部橙色帶：商戶頭像 + 名稱 */}
          <div
            className="flex items-center justify-between px-3 py-2"
            style={{ background: "linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)" }}
          >
            <div className="flex items-center gap-1.5">
              {merchantAvatar ? (
                <img
                  src={merchantAvatar}
                  alt="商戶頭像"
                  className="w-5 h-5 rounded-full object-cover border border-white/40"
                />
              ) : (
                <div className="w-5 h-5 rounded-full bg-white/25 flex items-center justify-center text-[9px] text-white font-bold flex-shrink-0">
                  {(merchantName ?? "商").charAt(0)}
                </div>
              )}
              <span className="text-white text-[10px] font-semibold leading-tight max-w-[120px] truncate">
                {merchantName ?? "商戶"}
              </span>
            </div>
            <span className="text-white/60 text-[9px] flex-shrink-0">hongxcollections.com</span>
          </div>

          {/* 封面圖 */}
          {round.coverImage ? (
            <div className="w-full h-36 overflow-hidden">
              <img src={round.coverImage} alt="封面" className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="w-full h-10 bg-amber-50 flex items-center justify-center">
              <span className="text-amber-300 text-xl">🏆</span>
            </div>
          )}

          {/* 場名 + 資訊 */}
          <div className="bg-white px-4 pt-3 pb-1 text-center">
            {round.periodNumber && (
              <p className="text-[10px] text-amber-500 font-semibold mb-0.5">第 {round.periodNumber} 期</p>
            )}
            <h2 className="text-[15px] font-bold text-amber-900 leading-snug">{round.title}</h2>
            <p className="text-[10px] text-gray-500 mt-1">拍賣 {dateRangeStr}</p>
          </div>

          {/* QR Code */}
          <div className="bg-white flex justify-center pb-3 pt-2">
            <div className="p-2 rounded-xl inline-block" style={{ border: "1.5px solid #fde68a" }}>
              <QRCodeCanvas ref={qrRef} value={fullUrl} size={136} fgColor="#92400e" bgColor="#ffffff" level="M" />
            </div>
          </div>

          {/* 短網址 */}
          <div className="bg-white text-center pb-3">
            <p className="text-[11px] font-semibold text-amber-700">掃碼或點連結直接出價</p>
            <p className="text-[9px] text-gray-400 mt-0.5 break-all px-3">{shortUrl}</p>
          </div>

          {/* 底部提示 */}
          <div className="bg-amber-50 border-t border-amber-100 px-4 py-2 text-center">
            <p className="text-[10px] text-amber-600">首次用手機登記（30秒），之後自動登入</p>
          </div>
        </div>

        <p className="text-[10px] text-gray-400 text-center mt-1 mb-1">↑ 長按海報即可截圖分享</p>

        {/* ── 快捷操作按鈕 ── */}
        <div className="px-4 pb-4 flex flex-col gap-2">
          <Button variant="outline" className="w-full text-sm h-9" onClick={downloadQr}>
            <Download className="w-4 h-4 mr-2" />
            下載 QR Code
          </Button>
          <Button variant="outline" className="w-full text-sm h-9" onClick={copyLink}>
            {copiedLink ? <Check className="w-4 h-4 mr-2 text-green-600" /> : <Copy className="w-4 h-4 mr-2" />}
            複製出價頁連結
          </Button>
          <Button
            className="w-full text-sm h-9"
            style={{ background: "linear-gradient(135deg, #f59e0b, #ef4444)", color: "#fff" }}
            onClick={copyMsg}
          >
            {copiedMsg ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
            複製微信推廣訊息
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
