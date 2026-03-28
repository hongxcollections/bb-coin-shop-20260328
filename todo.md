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
- [ ] 出價最低加價限制設定
- [ ] 管理員數據統計儀表板
- [ ] 深色模式切換
- [ ] 搜尋自動補全
- [x] 圖片上傳 UI（管理後台新增拍賣時直接上傳圖片）
- [ ] 出價確認彈窗（防止誤觸）
- [x] 圖片上傳優化：一次最多選取 10 張本地圖片，選完後一次性批量上傳，顯示每張進度
- [x] Bug 修復：起拍價允許 0 元起拍（Server 端驗證從 >0 改為 >=0）
