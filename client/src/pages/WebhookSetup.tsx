import { useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Facebook, Webhook, CheckCircle, ExternalLink, Copy, ArrowLeft,
  Zap, Shield, Clock, AlertCircle, ChevronDown, ChevronUp,
  MousePointerClick, Settings, Bell, Globe, Key, Info
} from "lucide-react";
import { toast } from "sonner";

const WEBHOOK_URL = `${window.location.origin}/api/webhook/facebook`;

function CopyButton({ text, label = "複製" }: { text: string; label?: string }) {
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
      {copied ? "已複製" : label}
    </Button>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-left text-sm font-medium hover:bg-gray-50 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <span>{q}</span>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />}
      </button>
      {open && (
        <div className="px-4 pb-3 text-sm text-muted-foreground border-t border-gray-100 pt-3">
          {a}
        </div>
      )}
    </div>
  );
}

export default function WebhookSetup() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white">
      {/* Nav */}
      <nav className="nav-glass sticky top-0 z-50">
        <div className="container flex items-center h-14 gap-3">
          <Link href="/admin/drafts">
            <Button variant="ghost" size="sm" className="gap-1 text-amber-700">
              <ArrowLeft className="w-4 h-4" /> 返回草稿審核
            </Button>
          </Link>
        </div>
      </nav>

      <div className="container py-10 max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Facebook className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Facebook 自動同步設定</h1>
          <p className="text-muted-foreground text-sm">
            透過 Groups Watcher，在 Facebook 群組發布貼文後，系統自動建立草稿拍賣等待您審核上架
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
            <Badge className="bg-blue-100 text-blue-700 gap-1 text-xs"><Clock className="w-3 h-3" />最快 60 秒同步</Badge>
            <Badge className="bg-emerald-100 text-emerald-700 gap-1 text-xs"><Zap className="w-3 h-3" />AI 自動解析</Badge>
            <Badge className="bg-amber-100 text-amber-700 gap-1 text-xs"><Shield className="w-3 h-3" />需人工審核上架</Badge>
          </div>
        </div>

        {/* Webhook URL highlight box */}
        <div className="bg-white border-2 border-blue-300 rounded-2xl p-5 mb-8 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center shrink-0">
              <Webhook className="w-3.5 h-3.5 text-white" />
            </div>
            <p className="font-semibold text-sm text-blue-800">您的專屬 Webhook URL（設定 Groups Watcher 時填入）</p>
          </div>
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl p-3">
            <code className="text-sm flex-1 break-all text-gray-800 font-mono select-all">{WEBHOOK_URL}</code>
            <CopyButton text={WEBHOOK_URL} />
          </div>
          <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
            <Info className="w-3 h-3 shrink-0" />
            此 URL 是您的專屬接收端點，請勿公開分享給他人。
          </p>
        </div>

        {/* Detailed Tutorial */}
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <MousePointerClick className="w-5 h-5 text-amber-600" />
          詳細設定教學（共 5 步）
        </h2>

        <div className="space-y-5">

          {/* Step 1 */}
          <Card className="border border-amber-100 overflow-hidden">
            <CardHeader className="pb-2 pt-4 px-5 bg-amber-50/50">
              <CardTitle className="flex items-center gap-3 text-base">
                <div className="w-7 h-7 rounded-full bg-amber-500 flex items-center justify-center text-white font-bold text-sm shrink-0">1</div>
                <span className="flex items-center gap-2"><Globe className="w-4 h-4 text-amber-600" />前往 Groups Watcher 官網並註冊帳號</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 pt-3 space-y-3">
              <p className="text-sm">前往 <a href="https://www.groupswatcher.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline font-medium">groupswatcher.com</a>，點擊右上角「<strong>Pricing</strong>」選擇方案。</p>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm space-y-2">
                <p className="font-medium text-blue-800">方案選擇建議：</p>
                <div className="space-y-1 text-blue-700">
                  <div className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 mt-0.5 shrink-0 text-blue-500" />
                    <span><strong>Professional 方案</strong>（推薦）— 最快 60 秒偵測新貼文，支援 Webhook，可監控公開及私人群組</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-amber-500" />
                    <span><strong>免費方案</strong> — 偵測速度較慢（約 5–10 分鐘），且 Webhook 功能僅限 Pro 方案使用</span>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-600">
                <p className="font-medium mb-1">📝 註冊步驟：</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>點擊「Get Started」或「Sign Up」</li>
                  <li>輸入電郵地址及密碼建立帳號</li>
                  <li>確認電郵後登入後台</li>
                </ol>
              </div>
            </CardContent>
          </Card>

          {/* Step 2 */}
          <Card className="border border-amber-100 overflow-hidden">
            <CardHeader className="pb-2 pt-4 px-5 bg-amber-50/50">
              <CardTitle className="flex items-center gap-3 text-base">
                <div className="w-7 h-7 rounded-full bg-amber-500 flex items-center justify-center text-white font-bold text-sm shrink-0">2</div>
                <span className="flex items-center gap-2"><Facebook className="w-4 h-4 text-blue-600" />新增您的 Facebook 群組</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 pt-3 space-y-3">
              <p className="text-sm">登入 Groups Watcher 後台後，點擊「<strong>Add Group</strong>」或「<strong>+ New Campaign</strong>」，然後貼上您的 Facebook 群組連結。</p>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-600 space-y-2">
                <p className="font-medium text-gray-700">如何取得 Facebook 群組連結：</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>在 Facebook 開啟您的拍賣群組</li>
                  <li>複製瀏覽器網址列的完整 URL</li>
                  <li>格式通常為：<code className="bg-white px-1 rounded">facebook.com/groups/您的群組名稱</code></li>
                </ol>
              </div>

              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-700">
                <p className="font-medium mb-1">✅ 重要提示：</p>
                <ul className="space-y-1">
                  <li>• 公開群組及<strong>私人群組均支援</strong>，無需群組管理員權限</li>
                  <li>• 建議先從 1–3 個群組開始測試，確認正常後再新增更多</li>
                  <li>• 群組 URL 填入後，Groups Watcher 會自動開始監控</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Step 3 */}
          <Card className="border border-amber-100 overflow-hidden">
            <CardHeader className="pb-2 pt-4 px-5 bg-amber-50/50">
              <CardTitle className="flex items-center gap-3 text-base">
                <div className="w-7 h-7 rounded-full bg-amber-500 flex items-center justify-center text-white font-bold text-sm shrink-0">3</div>
                <span className="flex items-center gap-2"><Settings className="w-4 h-4 text-gray-600" />設定貼文篩選條件</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 pt-3 space-y-3">
              <p className="text-sm">在群組設定中，選擇要接收哪些貼文的通知：</p>

              <div className="grid grid-cols-1 gap-2">
                <div className="bg-white border border-gray-200 rounded-lg p-3 text-sm">
                  <p className="font-medium mb-1 flex items-center gap-1"><Bell className="w-3.5 h-3.5 text-amber-500" />選項 A：接收所有貼文（推薦）</p>
                  <p className="text-xs text-muted-foreground">群組內任何新貼文都會觸發 Webhook，適合拍賣群組（每篇貼文都是商品）。</p>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg p-3 text-sm">
                  <p className="font-medium mb-1 flex items-center gap-1"><Key className="w-3.5 h-3.5 text-blue-500" />選項 B：關鍵字篩選</p>
                  <p className="text-xs text-muted-foreground">只有包含特定關鍵字的貼文才會觸發，例如「起拍」、「競投」、「HK$」等，可減少不相關貼文。</p>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
                <p className="font-medium mb-1">💡 建議設定（拍賣用途）：</p>
                <p>選擇「<strong>All Posts</strong>（所有貼文）」，讓每篇貼文都自動進入草稿審核，由您在後台決定是否上架。</p>
              </div>
            </CardContent>
          </Card>

          {/* Step 4 */}
          <Card className="border border-amber-100 overflow-hidden">
            <CardHeader className="pb-2 pt-4 px-5 bg-amber-50/50">
              <CardTitle className="flex items-center gap-3 text-base">
                <div className="w-7 h-7 rounded-full bg-amber-500 flex items-center justify-center text-white font-bold text-sm shrink-0">4</div>
                <span className="flex items-center gap-2"><Webhook className="w-4 h-4 text-purple-600" />設定 Webhook 通知渠道</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 pt-3 space-y-3">
              <p className="text-sm">在通知渠道設定中，選擇「<strong>Webhook</strong>」或「<strong>Custom Webhook</strong>」，然後填入以下資料：</p>

              <div className="space-y-2">
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="font-medium text-gray-700 w-28 shrink-0">Webhook URL：</span>
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <code className="text-blue-700 break-all flex-1">{WEBHOOK_URL}</code>
                      <CopyButton text={WEBHOOK_URL} label="複製" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-700 w-28 shrink-0">HTTP Method：</span>
                    <code className="text-green-700 font-bold">POST</code>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-700 w-28 shrink-0">Content-Type：</span>
                    <code className="text-green-700">application/json</code>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-600 space-y-1">
                <p className="font-medium text-gray-700">📋 Groups Watcher 後台操作步驟：</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>進入您剛新增的群組設定頁面</li>
                  <li>找到「<strong>Delivery Channel</strong>」或「<strong>Notifications</strong>」區塊</li>
                  <li>選擇「<strong>Webhook</strong>」</li>
                  <li>在「Webhook URL」欄位貼上上方的 URL</li>
                  <li>確保 Method 設為 <strong>POST</strong></li>
                  <li>儲存設定</li>
                </ol>
              </div>

              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-xs text-purple-700">
                <p className="font-medium mb-1">🔒 可選：設定安全密鑰（建議）</p>
                <p className="mb-2">如需防止他人偽造 Webhook，可在 Groups Watcher 的 Webhook Header 加入：</p>
                <div className="bg-white rounded p-2 font-mono space-y-1">
                  <div><span className="text-gray-500">Header 名稱：</span><span className="text-purple-700">x-webhook-secret</span></div>
                  <div><span className="text-gray-500">Header 值：</span><span className="text-purple-700">（自訂密碼，例如 mySecret123）</span></div>
                </div>
                <p className="mt-2">設定後，請在本網站的 Secrets 管理頁面同步設定 <code className="bg-white px-1 rounded">WEBHOOK_SECRET</code> 環境變數為相同的值。</p>
              </div>
            </CardContent>
          </Card>

          {/* Step 5 */}
          <Card className="border border-amber-100 overflow-hidden">
            <CardHeader className="pb-2 pt-4 px-5 bg-amber-50/50">
              <CardTitle className="flex items-center gap-3 text-base">
                <div className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center text-white font-bold text-sm shrink-0">5</div>
                <span className="flex items-center gap-2"><Zap className="w-4 h-4 text-emerald-600" />測試並確認運作正常</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 pt-3 space-y-3">
              <p className="text-sm">設定完成後，使用 Groups Watcher 的測試功能確認 Webhook 正常運作：</p>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-600 space-y-1">
                <p className="font-medium text-gray-700">測試步驟：</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>在 Groups Watcher 後台找到「<strong>Send test webhook</strong>」按鈕</li>
                  <li>選擇 Payload 類型（建議選「<strong>Single post</strong>」）</li>
                  <li>輸入您的 Webhook URL 並點擊發送</li>
                  <li>回到本網站的「<strong>草稿審核</strong>」頁面</li>
                  <li>如看到新的草稿商品，即表示設定成功！</li>
                </ol>
              </div>

              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm">
                <p className="font-medium text-emerald-800 mb-2">✅ 設定成功後的完整流程：</p>
                <ol className="list-decimal list-inside space-y-1 text-xs text-emerald-700">
                  <li>您在 Facebook 群組發布拍賣貼文</li>
                  <li>Groups Watcher 偵測到新貼文（最快 60 秒）</li>
                  <li>自動發送 Webhook 到您的網站</li>
                  <li>AI 解析貼文標題、描述、起拍價、圖片</li>
                  <li>自動建立「草稿」拍賣</li>
                  <li>您在管理後台「草稿審核」頁面審核並一鍵上架</li>
                </ol>
              </div>

              <div className="mt-2">
                <Link href="/admin/drafts">
                  <Button className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 w-full">
                    <CheckCircle className="w-4 h-4" />
                    前往草稿審核頁面查看結果
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* FAQ */}
        <div className="mt-10">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-600" />
            常見問題
          </h2>
          <div className="space-y-2">
            <FaqItem
              q="Groups Watcher 需要我的 Facebook 帳號密碼嗎？"
              a="不需要。Groups Watcher 使用自己的帳號監控群組，您只需提供群組的 URL 連結，無需提供任何 Facebook 登入資料。"
            />
            <FaqItem
              q="私人群組也可以監控嗎？"
              a="可以。Groups Watcher 的 Professional 方案支援公開及私人群組，無需群組管理員權限。"
            />
            <FaqItem
              q="偵測速度有多快？"
              a="Professional 方案最快可在 60 秒內偵測到新貼文並發送 Webhook。免費方案偵測速度較慢（約 5–10 分鐘），且不支援 Webhook 功能。"
            />
            <FaqItem
              q="AI 解析貼文的準確度如何？"
              a="AI 會嘗試從貼文內容提取商品名稱、描述、起拍價及圖片。如果貼文格式清晰（例如包含明確的金額和商品名稱），準確度較高。建議在草稿審核頁面確認資料後再上架。"
            />
            <FaqItem
              q="如果 Webhook 沒有收到資料怎麼辦？"
              a="請確認：1）Webhook URL 填寫正確（可複製上方的 URL）；2）Groups Watcher 的通知渠道已選擇「Webhook」；3）HTTP Method 設為 POST；4）如設定了 WEBHOOK_SECRET，請確認兩邊的值一致。如問題持續，可使用 Groups Watcher 的「Send test webhook」功能測試。"
            />
            <FaqItem
              q="草稿上架後，原本的 Facebook 貼文連結會保留嗎？"
              a="會。每個從 Facebook 同步的草稿都會保存原始貼文連結，您可以在草稿審核頁面點擊「查看原貼文」直接跳轉到 Facebook。"
            />
          </div>
        </div>

        {/* Alternative */}
        <Card className="mt-8 border border-blue-100 bg-blue-50">
          <CardContent className="p-5">
            <p className="font-medium text-sm mb-2 flex items-center gap-2">
              <ExternalLink className="w-4 h-4 text-blue-600" />
              也可使用 Make.com 或 Zapier 串接
            </p>
            <p className="text-xs text-muted-foreground">
              如果您已使用 Make.com 或 Zapier，可配合 Groups Watcher 的 Webhook 輸出，
              將貼文資料轉發至您的 Webhook URL。本網站的 Webhook 端點接受包含{" "}
              <code className="bg-white px-1 rounded">post_text</code>、
              <code className="bg-white px-1 rounded">message</code> 或{" "}
              <code className="bg-white px-1 rounded">body</code> 欄位的 JSON 格式。
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
