import { useState, useEffect } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ChevronLeft, Settings, CalendarClock, Save, Loader2, Info, Tag } from "lucide-react";

export default function MerchantSettings() {
  const { isAuthenticated } = useAuth();

  const { data: settings, isLoading } = trpc.merchants.getSettings.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const utils = trpc.useUtils();
  const updateMutation = trpc.merchants.updateSettings.useMutation({
    onSuccess: () => {
      toast.success("設定已儲存！");
      utils.merchants.getSettings.invalidate();
    },
    onError: (err) => toast.error(err.message || "儲存失敗"),
  });

  const [dayOffset, setDayOffset] = useState<string>("7");
  const [endTime, setEndTime] = useState<string>("23:00");
  const [startingPrice, setStartingPrice] = useState<string>("0");
  const [bidIncrement, setBidIncrement] = useState<string>("30");
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (settings && !initialized) {
      setDayOffset(String(settings.defaultEndDayOffset));
      setEndTime(settings.defaultEndTime);
      setStartingPrice(String(settings.defaultStartingPrice ?? 0));
      setBidIncrement(String(settings.defaultBidIncrement ?? 30));
      setInitialized(true);
    }
  }, [settings, initialized]);

  // 預覽：根據今天日期計算示範結束時間
  const previewEndDate = (() => {
    const offset = parseInt(dayOffset, 10);
    if (isNaN(offset) || offset < 1) return null;
    const d = new Date();
    d.setDate(d.getDate() + offset);
    const [hh, mm] = endTime.split(":");
    d.setHours(parseInt(hh || "23", 10), parseInt(mm || "0", 10), 0, 0);
    return d;
  })();

  const previewLabel = previewEndDate
    ? previewEndDate.toLocaleString("zh-HK", {
        year: "numeric", month: "long", day: "numeric",
        weekday: "short", hour: "2-digit", minute: "2-digit",
      })
    : "—";

  const handleSave = () => {
    const offset = parseInt(dayOffset, 10);
    if (isNaN(offset) || offset < 1 || offset > 365) {
      toast.error("天數請填 1–365 之間的整數");
      return;
    }
    if (!/^\d{2}:\d{2}$/.test(endTime)) {
      toast.error("時間格式須為 HH:MM，例如 23:00");
      return;
    }
    const sp = parseFloat(startingPrice);
    if (isNaN(sp) || sp < 0) {
      toast.error("起拍價預值不能為負數");
      return;
    }
    const bi = parseInt(bidIncrement, 10);
    if (isNaN(bi) || bi < 1) {
      toast.error("加幅預值請填 1 或以上的整數");
      return;
    }
    updateMutation.mutate({ defaultEndDayOffset: offset, defaultEndTime: endTime, defaultStartingPrice: sp, defaultBidIncrement: bi });
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">請先登入</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* 頂部導航 */}
      <div className="border-b bg-card fixed top-0 left-0 right-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-2 text-sm flex-wrap">
          <Link href="/merchant-dashboard">
            <span className="text-muted-foreground hover:text-foreground cursor-pointer flex items-center gap-1">
              <ChevronLeft className="w-3.5 h-3.5" />商戶後台
            </span>
          </Link>
          <span className="text-muted-foreground">/</span>
          <span className="font-medium text-amber-600">商戶管理</span>
        </div>
      </div>
      <div className="h-12" />

      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
        {/* 標題 */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
            <Settings className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold">商戶管理</h1>
            <p className="text-sm text-muted-foreground mt-0.5">設定拍賣預設參數</p>
          </div>
        </div>

        {/* 起拍價預值卡片 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Tag className="w-4 h-4 text-amber-500" />
              預設起拍價
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {isLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground py-4">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">載入中…</span>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="startingPrice">新增草稿時自動填入的起拍價</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground whitespace-nowrap">HK$</span>
                    <Input
                      id="startingPrice"
                      type="number"
                      min={0}
                      step="any"
                      value={startingPrice}
                      onChange={(e) => setStartingPrice(e.target.value)}
                      className="w-32"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    新增草稿時，起拍價欄位將自動帶入此金額，你仍可在新增時自由修改。
                  </p>
                </div>

                {/* 每口加幅 */}
                <div className="space-y-2">
                  <Label htmlFor="bidIncrement">預設每口加幅</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground whitespace-nowrap">HK$</span>
                    <Input
                      id="bidIncrement"
                      type="number"
                      min={1}
                      step={1}
                      value={bidIncrement}
                      onChange={(e) => setBidIncrement(e.target.value)}
                      className="w-32"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    新增草稿時，每口加幅欄位將自動帶入此金額。
                  </p>
                </div>

                <div className="flex justify-end pt-1">
                  <Button
                    onClick={handleSave}
                    disabled={updateMutation.isPending}
                    className="gold-gradient text-white border-0 gap-1.5"
                  >
                    {updateMutation.isPending
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Save className="w-4 h-4" />}
                    儲存設定
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* 拍賣結束時間設定卡片 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarClock className="w-4 h-4 text-amber-500" />
              預設拍賣結束時間
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {isLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground py-4">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">載入中…</span>
              </div>
            ) : (
              <>
                {/* 天數偏移 */}
                <div className="space-y-2">
                  <Label htmlFor="dayOffset">
                    發佈後加幾天結束
                    <span className="ml-1.5 text-xs text-muted-foreground">（1–365 天）</span>
                  </Label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground whitespace-nowrap">今日 +</span>
                    <Input
                      id="dayOffset"
                      type="number"
                      min={1}
                      max={365}
                      value={dayOffset}
                      onChange={(e) => setDayOffset(e.target.value)}
                      className="w-24"
                    />
                    <span className="text-sm text-muted-foreground">天</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    例如設 2，今日刊登的拍賣結束日期預設為後天
                  </p>
                </div>

                {/* 結束時間 */}
                <div className="space-y-2">
                  <Label htmlFor="endTime">每日結束時間（HH:MM）</Label>
                  <Input
                    id="endTime"
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-36"
                  />
                  <p className="text-xs text-muted-foreground">
                    例如設 23:00，拍賣將在指定日期的晚上 11 時結束
                  </p>
                </div>

                {/* 預覽 */}
                <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 space-y-1">
                  <div className="flex items-center gap-1.5 text-amber-700 text-xs font-medium">
                    <Info className="w-3.5 h-3.5" />
                    效果預覽（以今天計算）
                  </div>
                  <p className="text-sm font-semibold text-amber-900">
                    {previewLabel}
                  </p>
                  <p className="text-xs text-amber-600">
                    發佈草稿時，結束時間欄位將自動填入以上時間，你仍可在發佈前自由修改。
                  </p>
                </div>

                {/* 儲存按鈕 */}
                <div className="flex justify-end pt-1">
                  <Button
                    onClick={handleSave}
                    disabled={updateMutation.isPending}
                    className="gold-gradient text-white border-0 gap-1.5"
                  >
                    {updateMutation.isPending
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Save className="w-4 h-4" />}
                    儲存設定
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* 說明 */}
        <div className="text-xs text-muted-foreground space-y-1 px-1">
          <p>• 此設定只影響「你自己」的草稿發佈預設值，不影響其他商戶。</p>
          <p>• 每次打開發佈彈窗時，系統自動帶入你設定的天數及時間。</p>
          <p>• 你隨時可在發佈前修改具體結束時間。</p>
        </div>
      </div>
    </div>
  );
}
