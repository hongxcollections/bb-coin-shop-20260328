import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { QRCodeSVG } from "qrcode.react";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";

interface SessionPosterProps {
  open: boolean;
  onClose: () => void;
  session: {
    title: string;
    slug: string;
    coverImage?: string | null;
    endAt: string | Date;
    itemCount: number;
    description?: string | null;
  };
  merchantUserId: number | string;
}

function fmtEndLong(d: string | Date) {
  const date = new Date(d);
  return `${date.getMonth() + 1}月${date.getDate()}日 ${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
}

export function SessionPosterModal({ open, onClose, session, merchantUserId }: SessionPosterProps) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedMsg, setCopiedMsg] = useState(false);

  const fullUrl = `https://hongxcollections.com/s/${merchantUserId}/${session.slug}`;
  const shortUrl = `hongxcollections.com/s/${merchantUserId}/${session.slug}`;

  const promoMsg =
    `【${session.title}】\n` +
    `📦 共 ${session.itemCount} 件珍藏　截拍：${fmtEndLong(session.endAt)}\n` +
    (session.description ? `${session.description}\n` : "") +
    `\n直接網頁出價！首次用電話號碼登記（30秒），之後每場自動登入，出價即時生效，唔需要再留言 +幾號！\n\n${fullUrl}`;

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

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xs p-0 overflow-hidden rounded-2xl">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle className="text-base font-semibold text-amber-900">微信群入場海報</DialogTitle>
        </DialogHeader>

        {/* ── 海報本體（長按截圖用）── */}
        <div className="mx-4 rounded-2xl overflow-hidden border border-amber-200 shadow-md">
          {/* 頂部橙色帶 */}
          <div
            className="flex items-center justify-between px-4 py-2"
            style={{ background: "linear-gradient(90deg, #d97706 0%, #f59e0b 100%)" }}
          >
            <span className="text-white text-[10px] font-semibold tracking-wide">香港錢幣拍賣</span>
            <span className="text-white/70 text-[9px]">hongxcollections.com</span>
          </div>

          {/* 封面圖 */}
          {session.coverImage ? (
            <div className="w-full h-36 overflow-hidden">
              <img src={session.coverImage} alt="封面" className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="w-full h-12 bg-amber-50 flex items-center justify-center">
              <span className="text-amber-300 text-2xl">🏆</span>
            </div>
          )}

          {/* 場名 + 資訊 */}
          <div className="bg-white px-4 pt-3 pb-1 text-center">
            <h2 className="text-[15px] font-bold text-amber-900 leading-snug">{session.title}</h2>
            <div className="flex items-center justify-center gap-3 text-[10px] text-gray-500 mt-1">
              <span>📦 {session.itemCount} 件商品</span>
              <span>截拍 {fmtEndLong(session.endAt)}</span>
            </div>
          </div>

          {/* QR Code */}
          <div className="bg-white flex justify-center pb-3 pt-2">
            <div
              className="p-2 rounded-xl inline-block"
              style={{ border: "1.5px solid #fde68a" }}
            >
              <QRCodeSVG value={fullUrl} size={136} fgColor="#92400e" bgColor="#ffffff" level="M" />
            </div>
          </div>

          {/* 短網址 */}
          <div className="bg-white text-center pb-3">
            <p className="text-[11px] font-semibold text-amber-700">掃碼或點連結直接出價</p>
            <p className="text-[9px] text-gray-400 mt-0.5 break-all px-3">{shortUrl}</p>
          </div>

          {/* 底部提示 */}
          <div className="bg-amber-50 border-t border-amber-100 px-4 py-2 text-center">
            <p className="text-[10px] text-amber-600">首次用電話號碼登記（30秒），之後自動登入</p>
          </div>
        </div>

        <p className="text-[10px] text-gray-400 text-center mt-1 mb-1">↑ 長按海報即可截圖分享</p>

        {/* ── 快捷操作按鈕 ── */}
        <div className="px-4 pb-4 flex flex-col gap-2">
          <Button variant="outline" className="w-full text-sm h-9" onClick={copyLink}>
            {copiedLink
              ? <Check className="w-4 h-4 mr-2 text-green-600" />
              : <Copy className="w-4 h-4 mr-2" />}
            複製專場連結
          </Button>
          <Button
            className="w-full text-sm h-9"
            style={{ background: "linear-gradient(90deg, #d97706, #f59e0b)", color: "#fff" }}
            onClick={copyMsg}
          >
            {copiedMsg
              ? <Check className="w-4 h-4 mr-2" />
              : <Copy className="w-4 h-4 mr-2" />}
            複製微信推廣訊息
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
