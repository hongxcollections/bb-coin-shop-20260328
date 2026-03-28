import { useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Facebook, Webhook, CheckCircle, ExternalLink, Copy, ArrowLeft, Zap, Shield, Clock } from "lucide-react";
import { toast } from "sonner";

const WEBHOOK_URL = `${window.location.origin}/api/webhook/facebook`;

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-1 shrink-0"
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        toast.success("已複製！");
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? "已複製" : "複製"}
    </Button>
  );
}

const steps = [
  {
    num: 1,
    title: "前往 Groups Watcher 官網",
    icon: <ExternalLink className="w-4 h-4" />,
    content: (
      <div className="space-y-2 text-sm">
        <p>前往 <a href="https://www.groupswatcher.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline font-medium">groupswatcher.com</a> 並建立帳號（Professional 方案可在 60 秒內偵測新貼文）。</p>
        <p className="text-muted-foreground">免費方案亦可使用，但偵測速度較慢（約 5-10 分鐘）。</p>
      </div>
    ),
  },
  {
    num: 2,
    title: "新增您的 Facebook 群組",
    icon: <Facebook className="w-4 h-4" />,
    content: (
      <div className="space-y-2 text-sm">
        <p>登入 Groups Watcher 後，點擊「Add Group」，貼上您的 Facebook 群組連結。</p>
        <p className="text-muted-foreground">無需群組管理員權限，公開及私人群組均支援。</p>
      </div>
    ),
  },
  {
    num: 3,
    title: "設定 Webhook 通知",
    icon: <Webhook className="w-4 h-4" />,
    content: (
      <div className="space-y-3 text-sm">
        <p>在群組設定中選擇「Webhook」通知方式，填入以下 Webhook URL：</p>
        <div className="flex items-center gap-2 bg-gray-50 border rounded-lg p-3">
          <code className="text-xs flex-1 break-all text-gray-700">{WEBHOOK_URL}</code>
          <CopyButton text={WEBHOOK_URL} />
        </div>
        <p className="text-muted-foreground">HTTP Method 選擇 <strong>POST</strong>，Content-Type 選擇 <strong>application/json</strong>。</p>
      </div>
    ),
  },
  {
    num: 4,
    title: "（可選）設定安全密鑰",
    icon: <Shield className="w-4 h-4" />,
    content: (
      <div className="space-y-2 text-sm">
        <p>如需保護 Webhook 端點，可在 Groups Watcher 的 Webhook 設定中加入 Header：</p>
        <div className="bg-gray-50 border rounded-lg p-3 font-mono text-xs space-y-1">
          <div><span className="text-gray-500">Header 名稱：</span><span className="text-blue-700">x-webhook-secret</span></div>
          <div><span className="text-gray-500">Header 值：</span><span className="text-blue-700">（您設定的 WEBHOOK_SECRET 環境變數值）</span></div>
        </div>
        <p className="text-muted-foreground">如不設定密鑰，端點將接受所有請求（不建議用於生產環境）。</p>
      </div>
    ),
  },
  {
    num: 5,
    title: "完成！開始自動同步",
    icon: <Zap className="w-4 h-4" />,
    content: (
      <div className="space-y-2 text-sm">
        <p>設定完成後，每當您在 Facebook 群組發布新貼文，系統會：</p>
        <ol className="list-decimal list-inside space-y-1 text-muted-foreground ml-2">
          <li>Groups Watcher 偵測到新貼文（最快 60 秒）</li>
          <li>自動發送 Webhook 到您的網站</li>
          <li>AI 解析貼文標題、描述、價格、圖片</li>
          <li>建立草稿拍賣，等待您在後台審核</li>
        </ol>
        <div className="mt-3">
          <Link href="/admin/drafts">
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
              <CheckCircle className="w-4 h-4" />
              前往草稿審核頁面
            </Button>
          </Link>
        </div>
      </div>
    ),
  },
];

export default function WebhookSetup() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white">
      {/* Nav */}
      <nav className="nav-glass sticky top-0 z-50">
        <div className="container flex items-center h-14 gap-3">
          <Link href="/admin">
            <Button variant="ghost" size="sm" className="gap-1 text-amber-700">
              <ArrowLeft className="w-4 h-4" /> 返回管理後台
            </Button>
          </Link>
        </div>
      </nav>

      <div className="container py-10 max-w-2xl">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Facebook className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Facebook 自動同步設定</h1>
          <p className="text-muted-foreground">
            透過 Groups Watcher，在 Facebook 群組發布貼文後，系統自動建立草稿拍賣
          </p>
          <div className="flex items-center justify-center gap-4 mt-4">
            <Badge className="bg-blue-100 text-blue-700 gap-1"><Clock className="w-3 h-3" />最快 60 秒同步</Badge>
            <Badge className="bg-emerald-100 text-emerald-700 gap-1"><Zap className="w-3 h-3" />AI 自動解析</Badge>
            <Badge className="bg-amber-100 text-amber-700 gap-1"><Shield className="w-3 h-3" />需人工審核上架</Badge>
          </div>
        </div>

        {/* Webhook URL highlight box */}
        <div className="bg-white border-2 border-blue-300 rounded-2xl p-5 mb-8 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center shrink-0">
              <Webhook className="w-3.5 h-3.5 text-white" />
            </div>
            <p className="font-semibold text-sm text-blue-800">您的 Webhook URL（填入 Groups Watcher）</p>
          </div>
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl p-3">
            <code className="text-sm flex-1 break-all text-gray-800 font-mono select-all">{WEBHOOK_URL}</code>
            <CopyButton text={WEBHOOK_URL} />
          </div>
          <p className="text-xs text-muted-foreground mt-2">此 URL 是您的專屬接收端點，請勿公開分享。</p>
        </div>

        {/* Steps */}
        <div className="space-y-4">
          {steps.map((step) => (
            <Card key={step.num} className="border border-amber-100">
              <CardHeader className="pb-2 pt-4 px-5">
                <CardTitle className="flex items-center gap-3 text-base">
                  <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 font-bold text-sm shrink-0">
                    {step.num}
                  </div>
                  <span className="flex items-center gap-2">
                    {step.icon}
                    {step.title}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-4">
                {step.content}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Alternative: Make.com */}
        <Card className="mt-6 border border-blue-100 bg-blue-50">
          <CardContent className="p-5">
            <p className="font-medium text-sm mb-2">💡 也可使用 Make.com 或 Zapier</p>
            <p className="text-xs text-muted-foreground">
              如果您已使用 Make.com 或 Zapier，可配合 Groups Watcher 的 Webhook 輸出，
              將貼文資料轉發至 <code className="bg-white px-1 rounded">{WEBHOOK_URL}</code>。
              Webhook 接受任何包含 <code className="bg-white px-1 rounded">post_text</code>、
              <code className="bg-white px-1 rounded">message</code> 或 <code className="bg-white px-1 rounded">content</code> 欄位的 JSON 格式。
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
