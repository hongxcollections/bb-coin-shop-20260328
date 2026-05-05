import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Megaphone } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface MerchantBroadcastDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  auctionId: number;
  auctionTitle: string;
}

export default function MerchantBroadcastDialog({ open, onOpenChange, auctionId, auctionTitle }: MerchantBroadcastDialogProps) {
  const [message, setMessage] = useState("");
  const broadcast = trpc.chat.broadcast.useMutation({
    onSuccess: ({ sent }) => {
      toast.success(`✅ 已發送畀 ${sent} 位曾出價買家`);
      setMessage("");
      onOpenChange(false);
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const handleSend = () => {
    const text = message.trim();
    if (!text) {
      toast.error("請輸入訊息內容");
      return;
    }
    broadcast.mutate({ auctionId, message: text });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-amber-600" />
            廣播訊息
          </DialogTitle>
          <DialogDescription>
            訊息會發送畀「{auctionTitle}」所有曾經出價嘅買家。<br />
            <span className="text-xs text-amber-600">⚠️ 每小時只可廣播一次</span>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <Textarea
            placeholder="例：仲有 3 件同類型商品，加 $200 一齊買有 8 折優惠..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            maxLength={500}
            className="resize-none"
          />
          <div className="text-xs text-gray-500 text-right">{message.length} / 500</div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={broadcast.isPending}>
            取消
          </Button>
          <Button onClick={handleSend} disabled={broadcast.isPending || !message.trim()} className="gold-gradient text-white border-0">
            {broadcast.isPending ? "發送中..." : "📢 發送廣播"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
