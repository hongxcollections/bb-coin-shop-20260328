# 大BB錢幣店 — Project TODO

## 已完成功能

- [x] 全站金色主題設計系統（gold-gradient、nav-glass、countdown-badge、price-tag、hero-bg）
- [x] 響應式導航列（毛玻璃效果、手機/平板/桌面三種斷點）
- [x] 首頁 Hero 區塊（漸層背景、統計數據、動畫效果）
- [x] 首頁熱門拍賣卡片（含倒計時、出價顯示）
- [x] 首頁功能介紹區塊（4 個特色卡片）
- [x] 首頁 CTA 區塊（未登入時顯示）
- [x] 拍賣列表頁（搜尋、篩選、分頁、響應式網格）
- [x] 拍賣詳情頁（圖片縮圖列表、出價卡片、倒計時、出價歷史）
- [x] 個人資料頁（用戶頭像、統計數據、競標記錄）
- [x] 管理員後台（新增/編輯/刪除拍賣、統計數據）
- [x] 實時倒計時（active/ending/ended 三種狀態顏色）
- [x] 出價成功/錯誤 Toast 提示
- [x] 沙盒模擬登入系統（/api/dev/login-page，支援一般用戶/管理員）
- [x] 資料庫 SSL 連線修復（TiDB Cloud 相容）
- [x] 資料庫 Schema（users、auctions、auction_images、bids 四張表）
- [x] tRPC API（auctions.list、detail、create、update、delete、placeBid、myBids、myAuctions）
- [x] S3 圖片上傳功能（auctions.uploadImage）
- [x] 角色權限控制（admin/user，protectedProcedure）

## 待優化功能

- [ ] 實時出價通知（當有人出價超過您時顯示通知）
- [ ] 收藏 / 關注拍賣功能
- [ ] 拍賣分類標籤篩選（古幣、紀念幣、外幣等）
- [ ] 自動結標邏輯（拍賣到期後自動標記結束）
- [x] 出價最低加價限制設定（每口加幅功能）
- [ ] 管理員數據統計儀表板
- [ ] 深色模式切換
- [ ] 搜尋自動補全
- [x] 圖片上傳 UI（管理後台新增拍賣時直接上傳圖片）
- [ ] 出價確認彈窗（防止誤觸）
- [x] 圖片上傳優化：一次最多選取 10 張本地圖片，選完後一次性批量上傳，顯示每張進度
- [x] Bug 修復：起拍價允許 0 元起拍（Server 端驗證從 >0 改為 >=0）
- [x] 新增每口加幅設定：管理員建立/編輯拍賣時可設定每口加幅（HK$30~HK$5000）
- [x] 資料庫新增 bidIncrement 欄位（預設 HK$50）
- [x] Server 端出價驗證：出價金額必須 >= 當前價 + 每口加幅
- [x] AuctionDetail 頁面顯示每口加幅資訊，新增快速出價按鈕（最低、+1口、+2口）
- [x] 管理後台每口加幅改為下拉菜單（Select）形式，標籤與選擇器同行（左標籤右菜單）
- [x] 每口加幅預設値改為 HK$30（前端 defaultForm + 資料庫預設値）
- [x] 資料庫 auctions 表新增 currency 欄位（預設 HKD）
- [x] Server 端 create/update procedure 支援 currency 欄位
- [x] 管理後台新增貨幣選擇下拉菜單（HKD/USD/CNY/GBP/EUR/JPY）
- [x] 拍賣詳情頁及列表頁依 currency 顯示對應貨幣符號
- [x] 管理後台貨幣選擇器移至標籤右手邊（同行排列），Select 選項字體縮小一半
- [x] 貨幣選擇器移至起拍價輸入框右手邊（同行），刪除「貨幣」標籤文字
- [x] 貨幣菜單 SelectTrigger 及選項字體縮小一半（text-xs → text-[10px]）
- [x] 結束時間標籤及輸入框字體縮小三分一，起拍價輸入框拉闊
- [x] 結束時間與每口加幅位置互換
- [x] 所有拍賣頁面商品列表上方新增橫向自動滾動跑馬燈（顯示全部商品縮圖＋名稱＋現價）
- [x] 修復拍賣列表 Badge 顯示錯誤：改為根據 endTime 即時判斷狀態（非依賴 DB status 欄位）
- [x] 資料庫 auctions 表新增 draft 狀態及 fbPostUrl 欄位
- [x] Server 端新增 /api/webhook/facebook POST 端點，AI 解析貼文建立草稿
- [x] 管理後台新增「草稿審核」頁面（待審核列表、一鍵上架/刪除）
- [x] 新增 Webhook 設定說明頁面（引導配置 Groups Watcher）
- [x] 新增 WEBHOOK_SECRET 環境變數驗證保護
- [x] 草稿審核頁面批次操作：全選/取消全選 Checkbox
- [x] 草稿審核頁面批次操作：批次上架（統一設定結束時間）
- [x] 草稿審核頁面批次操作：批次刪除（含確認對話框）
- [x] Server 端新增 auctions.batchPublish 及 auctions.batchDelete procedures
- [x] 設定說明頁面直接顯示完整 Webhook URL 並提供一鍵複製按鈕
