export default function Privacy() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-12">
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
            <h2 className="text-xl font-semibold mb-3">7. 您的權利</h2>
            <p>您有權：</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>查閱我們持有的您的個人資料</li>
              <li>要求更正不準確的資料</li>
              <li>要求刪除您的帳戶和相關資料</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. 聯絡我們</h2>
            <p>
              如您對本隱私權政策有任何疑問，請透過電子郵件聯絡我們：ywkyee@gmail.com
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">9. 政策更新</h2>
            <p>
              我們可能會不時更新本隱私權政策。更新後的政策將在本頁面公佈，並更新「最後更新日期」。
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
