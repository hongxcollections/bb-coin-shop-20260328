export default function Privacy() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-3xl mx-auto pt-12 pb-20">
        <h1 className="text-3xl font-bold mb-8">隱私權政策</h1>
        <p className="text-sm text-muted-foreground mb-8">最後更新日期：2026 年 4 月 14 日</p>

        <div className="space-y-6 text-sm leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold mb-3">1. 簡介</h2>
            <p>
              歡迎使用「hongxcollections」（以下簡稱「本網站」）。本網站由 Hong X Collections 營運，網址為 hongxcollections.com。我們非常重視您的隱私，本隱私權政策說明我們如何收集、使用和保護您的個人資料。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. 我們收集的資料</h2>
            <p>當您使用本網站時，我們可能收集以下資料：</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li><strong>帳戶資料</strong>：透過 Google 登入時，我們會取得您的姓名、電子郵件地址和個人頭像。</li>
              <li><strong>競拍記錄</strong>：您在本網站上的出價記錄和交易資料。</li>
              <li><strong>使用資料</strong>：您的瀏覽行為、裝置資訊和 IP 地址等技術資料。</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. 資料使用目的</h2>
            <p>我們收集的資料用於以下目的：</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>提供和維護拍賣服務</li>
              <li>處理您的競拍和交易</li>
              <li>發送拍賣相關通知（如結標提醒、得標通知）</li>
              <li>改善網站功能和使用者體驗</li>
              <li>防止欺詐和確保網站安全</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. 資料分享</h2>
            <p>
              我們不會出售您的個人資料。我們僅在以下情況下分享您的資料：
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>經您同意</li>
              <li>為履行法律義務</li>
              <li>與提供服務所需的第三方服務商合作（如雲端儲存、電子郵件服務）</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. 資料安全</h2>
            <p>
              我們採取合理的技術和組織措施來保護您的個人資料，包括使用 SSL/TLS 加密傳輸、安全的資料庫儲存等。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. Cookie 使用</h2>
            <p>
              本網站使用 Cookie 來維持您的登入狀態和改善使用體驗。您可以透過瀏覽器設定管理 Cookie。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. 第三方廣告及 Google AdSense</h2>
            <p className="mb-2">
              本網站使用 Google AdSense 顯示廣告。Google 及其合作夥伴（第三方廣告商）可能透過 Cookie、網路信標或類似技術，根據您過去對本網站或其他網站的瀏覽紀錄，向您提供個人化廣告。
            </p>
            <p className="mb-2">
              Google 使用 DoubleClick Cookie，令廣告商及其代理機構能夠根據您對本網站及其他網站的存取情況顯示廣告。
            </p>
            <p className="mb-2">
              您可透過以下方式選擇退出個人化廣告：
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>
                前往 <a href="https://www.google.com/settings/ads" target="_blank" rel="noopener noreferrer" className="underline text-amber-600">Google 廣告設定</a> 調整偏好設定
              </li>
              <li>
                前往 <a href="https://www.networkadvertising.org/choices/" target="_blank" rel="noopener noreferrer" className="underline text-amber-600">Network Advertising Initiative 退出頁面</a>，選擇退出第三方廣告商使用 Cookie
              </li>
            </ul>
            <p className="mt-2">
              如需了解 Google 如何使用資料，請參閱 <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="underline text-amber-600">Google 私隱政策</a>。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. 您的權利</h2>
            <p>您有權：</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>查閱我們持有的您的個人資料</li>
              <li>要求更正不準確的資料</li>
              <li>要求刪除您的帳戶和相關資料</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">9. 聯絡我們</h2>
            <p className="mb-3">如您對本隱私權政策有任何疑問，請透過以下方式聯絡我們：</p>
            <ul className="space-y-1">
              <li><strong>資料控制者：</strong>hongxcollections.com</li>
              <li><strong>電郵：</strong><a href="mailto:ywkyee@gmail.com" className="underline text-amber-600">ywkyee@gmail.com</a></li>
              <li><strong>WhatsApp：</strong><a href="https://wa.me/85297927793" target="_blank" rel="noopener noreferrer" className="underline text-amber-600">+852 9792 7793</a></li>
              <li><strong>地址：</strong>Shop 340, 3/F, Ho Mong Lok Shopping Centre, 163-173 Portland Street, Mong Kok, Kowloon, Hong Kong</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">10. 政策更新</h2>
            <p>
              我們可能會不時更新本隱私權政策。更新後的政策將在本頁面公佈，並更新「最後更新日期」。
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
