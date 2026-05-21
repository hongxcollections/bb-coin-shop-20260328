import { Link } from "wouter";
import { MapPin, Mail, MessageCircle, Clock, Shield, Star, FileText } from "lucide-react";

export default function About() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-3xl mx-auto pt-12 pb-20">
        <h1 className="text-3xl font-bold mb-2">關於我們</h1>
        <p className="text-sm text-muted-foreground mb-10">About hongxcollections.com</p>

        <div className="space-y-8 text-sm leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold mb-3">平台簡介</h2>
            <p className="text-muted-foreground">
              hongxcollections.com 是一個專注香港錢幣收藏的拍賣平台，成立於 2025 年。
              我們為錢幣愛好者提供安全、透明的競投環境，支援代理投標、防截標機制，
              並設有四個會員等級，讓資深藏家享有更多專屬優惠。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">我們的服務</h2>
            <ul className="space-y-2 text-muted-foreground">
              <li className="flex items-start gap-2">
                <Star className="w-4 h-4 mt-0.5 text-amber-500 shrink-0" />
                <span>香港錢幣網上拍賣，即時競投</span>
              </li>
              <li className="flex items-start gap-2">
                <Star className="w-4 h-4 mt-0.5 text-amber-500 shrink-0" />
                <span>代理投標（Proxy Bid）——設定上限，系統自動出價</span>
              </li>
              <li className="flex items-start gap-2">
                <Star className="w-4 h-4 mt-0.5 text-amber-500 shrink-0" />
                <span>商戶專場拍賣，品牌化展示藏品</span>
              </li>
              <li className="flex items-start gap-2">
                <Star className="w-4 h-4 mt-0.5 text-amber-500 shrink-0" />
                <span>藏品社區，收藏心得交流社群</span>
              </li>
              <li className="flex items-start gap-2">
                <Star className="w-4 h-4 mt-0.5 text-amber-500 shrink-0" />
                <span>四級會員制度，累積積分享專屬優惠</span>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">誠信承諾</h2>
            <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50">
              <Shield className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-muted-foreground">
                我們嚴格審核商戶資格，確保每件拍賣品真實可靠。平台設有保證金制度，
                保障買賣雙方權益。如有任何爭議，歡迎直接聯絡我們跟進處理。
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">聯絡我們</h2>
            <ul className="space-y-3 text-muted-foreground">
              <li className="flex items-start gap-3">
                <MapPin className="w-4 h-4 mt-0.5 text-amber-500 shrink-0" />
                <span>Shop 340, 3/F, Ho Mong Lok Shopping Centre, 163-173 Portland Street, Mong Kok, Kowloon, Hong Kong</span>
              </li>
              <li className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-amber-500 shrink-0" />
                <a href="mailto:ywkyee@gmail.com" className="underline hover:text-amber-600 transition-colors">ywkyee@gmail.com</a>
              </li>
              <li className="flex items-center gap-3">
                <MessageCircle className="w-4 h-4 text-amber-500 shrink-0" />
                <a href="https://wa.me/85297927793" target="_blank" rel="noopener noreferrer" className="underline hover:text-amber-600 transition-colors">WhatsApp: +852 9792 7793</a>
              </li>
              <li className="flex items-center gap-3">
                <Clock className="w-4 h-4 text-amber-500 shrink-0" />
                <span>服務時間：星期一至六 11:00–20:00（香港時間）</span>
              </li>
              <li className="flex items-center gap-3">
                <FileText className="w-4 h-4 text-amber-500 shrink-0" />
                <span>業務名稱：hongxcollections</span>
              </li>
              <li className="flex items-center gap-3">
                <FileText className="w-4 h-4 text-amber-500 shrink-0" />
                <span>商業登記號碼：56630138-000-10-25-A</span>
              </li>
            </ul>
          </section>

          <section className="pt-4 border-t border-border text-xs text-muted-foreground flex gap-4">
            <Link href="/terms" className="hover:text-amber-600 transition-colors underline">服務條款</Link>
            <Link href="/privacy" className="hover:text-amber-600 transition-colors underline">隱私政策</Link>
            <Link href="/" className="hover:text-amber-600 transition-colors underline">返回首頁</Link>
          </section>
        </div>
      </div>
    </div>
  );
}
