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
- [x] 設定說明頁面新增詳細 Groups Watcher 逐步教學（含截圖說明、注意事項、常見問題）
- [x] 為 Groups Watcher 教學每步驟截取真實介面截圖並嵌入設定說明頁面
- [x] 出價後的所有回展訊息顯示在「出價次數」標題上方（inline 訊息區塊，含成功/失敗/提示）
- [x] 出價訊息移至 Price Card 內「出價次數」標題正上方（inline，非獨立卡片）
- [x] 出價處理中訊息增加有趣動畫（跳動硬幣 + 脈衝光暈 + 三點省略動畫）
- [x] 出價成功/失敗訊息加上淡入淡出動畫（出現淡入，6秒後淡出消失）
- [x] 出價成功/失敗訊息底部新增倒數進度條（6秒從滿格縮至零，配合淡出自動關閉）
- [x] 加強出價訊息淡入淡出動畫效果（確保效果清晰可見）
- [x] 出價訊息改為浮動 Pop-up（absolute 定位），不推動其他元素版面
- [x] 出價記錄改為 Collapsible 下拉菜單形式（點擊標題展開/收合，顯示出價次數）
- [x] 「當前最高出價」標籤旁顯示最高出價用戶名稱（括號括住，字體縮小三分一）
- [x] 「當前最高出價」旁改為顯示用戶名稱（非用戶 ID），字體顏色改為紅色
- [x] 主頁「為什麼選擇我們」四個範雇改為 2x2 格局（每行兩個框），縮短版面高度
- [x] 主頁「為什麼選擇我們」四個卡片加上懸停放大（scale-[1.04]）與陰影（shadow-xl）效果
- [x] 主頁「為什麼選擇我們」四個卡片各加上獨特圖標，置於標題上方（垂直排列）
- [x] 所有拍賣頁面卡片「當前出價」旁括號顯示最高出價用戶名稱，字體縮小三分一
- [x] 所有拍賣頁面：為「即將結束」且出價最高的拍賣卡片加上醒目標籤
- [x] 所有拍賣頁面：已結束拍賣排至頁面底部，活躍拍賣顯示在前
- [x] 拍賣詳情頁：已結束拍賣加上灰色「已結束」標籤，隐藏出價按鈕
- [x] 已結束拍賣詳情頁加入「重新拍賣」按鈕（僅管理員可見），快速複製拍品資料重新刊登
- [x] 管理後台草稿列表：「重新拍賣」建立的草稿加上特殊識別標籤（需加 relistSourceId 欄位）
- [x] 拍賣卡片及詳情頁：無出價記錄時在「當前出價」標籤旁顯示「(未有出價)」，字體縮小三分一，黑色
- [x] 主頁商品卡片：無出價記錄時在「當前出價」標籤旁顯示「(未有出價)」，字體縮小三分一，黑色
- [x] 拍賣詳情頁：未有出價時管理員可修改起拍價（後端驗證無出價才允許，前端顯示編輯入口）
- [x] 管理後台「編輯拍賣」表單：未有出價時允許修改起拍價（移除硬性禁止，後端同步驗證）
- [x] 管理後台已結束商品卡片：移除「刪除」和「修改」按鈕，改為「重新上架」按鈕
- [x] 管理後台：已過期拍賣自動更新狀態為 ended（myAuctions 查詢時觸發），統計數字及按鈕顯示正確
- [x] 管理後台：已結束商品排至列表最後，並加上「已結束的商品」標題分隔
- [x] 管理後台「已結束的商品」列表：每個商品顯示最終得標者名稱及出價金額
- [x] 管理後台商品卡片重新設計：圖片最多3張在第一行，其他資料緊湊排列在下方
- [x] 管理後台競拍中商品卡片：加入當前最高出價用戶名稱（或「未有出價」）顯示

## 封存功能

- [x] 資料庫 auctions 表新增 archived 欄位（boolean，預設 false）
- [x] 執行 ALTER TABLE 遷移
- [x] 後端新增 auctions.archive procedure（將已結束拍賣封存）
- [x] 後端新增 auctions.getArchived procedure（取得封存列表，含 highestBidderName）
- [x] 後端新增 auctions.permanentDelete procedure（永久刪除封存拍賣）
- [x] 前端 AdminAuctions.tsx：已結束商品卡片加入「封存」按鈕
- [x] 前端新增 AdminArchive.tsx 封存區頁面（顯示封存商品、永久刪除按鈕）
- [x] 前端 App.tsx 新增封存區路由 /admin/archive
- [x] 後台導航加入「封存區」連結
- [x] 修正：getAuctionsByCreator 查詢排除 archived=1 的商品，確保封存後不再出現在後台已結束列表

## 封存區還原功能

- [x] 後端新增 auctions.restore procedure（將 archived=1 改回 archived=0）
- [x] 前端 AdminArchive.tsx 每張商品卡加入「還原」按鈕
- [x] 新增 vitest 測試覆蓋 restore procedure

## 還原倒數計時器

- [x] AdminArchive.tsx：點擊還原後進入 10 秒倒數，期間顯示取消按鈕，倒數結束才真正執行還原 API

## 取消還原快捷鍵

- [x] AdminArchive.tsx：監聽 Escape 鍵，取消所有進行中的倒數計時器
- [x] 在倒數 UI 顯示「ESC」快捷鍵提示標籤

## 批次還原功能

- [x] 後端新增 auctions.batchRestore procedure（接受 ids 陣列，逐一還原）
- [x] 前端 AdminArchive.tsx 加入「批次模式」切換按鈕
- [x] 批次模式下每張商品卡顯示 Checkbox，支援全選/取消全選
- [x] 底部固定操作列：顯示已選數量、「批次還原」按鈕
- [x] 批次還原觸發 10 秒倒數（共用現有倒數機制），支援 ESC 取消
- [x] 新增 vitest 測試覆蓋 batchRestore procedure

## 封存區篩選器

- [x] 確認 auctions 表 category 欄位是否存在，必要時新增 schema 及 ALTER TABLE
- [x] 後端 getArchived procedure 支援 category、dateFrom、dateTo 篩選參數
- [x] 前端 AdminArchive.tsx 加入篩選列（類別下拉、日期範圍選擇器）
- [x] 篩選結果與批次模式整合（篩選後可勾選批次還原）
- [x] 新增 vitest 測試覆蓋篩選邏輯

## 出價驗證修正

- [x] 後端：無出價記錄時，允許以起拍價出價（最低出價 = startingPrice，而非 currentPrice + bidIncrement）
- [x] 前端：快速出價按鈕「最低出價」金額對應修正（無出價時顯示起拍價）
- [x] 更新 vitest 測試覆蓋第一口出價邏輯

## 代理出價功能

- [x] 資料庫新增 proxyBids 表（userId, auctionId, maxAmount, isActive）
- [x] 執行 CREATE TABLE migration SQL
- [x] 後端 db.ts 新增 setProxyBid / getProxyBid / getActiveProxiesForAuction 查詢函數
- [x] 後端 auctions.ts 新增 runProxyBidEngine：placeBid 後觸發，讓最高代理者自動加價
- [x] 後端新增 auctions.setProxyBid procedure（設定/更新代理出價上限）
- [x] 後端新增 auctions.getMyProxyBid procedure（取得目前用戶的代理設定）
- [x] 前端 AuctionDetail.tsx 加入代理出價切換（一般出價 / 代理出價）
- [x] 前端顯示目前已設定的代理上限（已設定時顯示「代理中：上限 HK$X」）
- [x] 新增 vitest 測試覆蓋代理出價引擎邏輯

## 代理出價歷史紀錄

- [x] 資料庫新增 proxyBidLogs 表（auctionId, triggerUserId, proxyUserId, triggerAmount, proxyAmount, round）
- [x] 執行 CREATE TABLE migration SQL
- [x] 後端 db.ts 新增 insertProxyBidLog / getProxyBidLogs 查詢函數
- [x] 後端 auctions.ts runProxyBidEngine 每輪競價後寫入 log
- [x] 後端新增 auctions.getProxyBidLogs procedure（取得拍賣的代理出價紀錄，含用戶名稱）
- [x] 前端 AuctionDetail.tsx 出價歷史加入「代理紀錄」標籤，顯示每筆自動出價詳情
- [x] 新增 vitest 測試覆蓋 log 寫入邏輯

## 電郵通知功能

- [x] 資料庫 users 表新增 email 欄位
- [x] 資料庫新增 notificationSettings 表（senderName, senderEmail, enableOutbid, enableWon, enableEndingSoon, endingSoonMinutes）
- [x] 執行 ALTER TABLE / CREATE TABLE migration SQL
- [x] 安裝 Resend npm 套件
- [x] 後端建立 server/email.ts（Resend helper + 三種郵件模板：出價被超越、得標、即將結束）
- [x] 後端 placeBid 後觸發「出價被超越」通知給前任最高出價者
- [x] 後端拍賣結束時觸發「得標」通知給得標者
- [x] 後端新增即將結束計時器（endingSoon），在設定時間前發送提醒給所有出價者
- [x] 後端新增 notificationSettings.get / update procedures（管理員專用）
- [x] 後端新增 users.updateEmail procedure（用戶更新自己的電郵）
- [x] 前端用戶個人資料頁加入電郵填寫欄位
- [x] 前端後台新增「通知設定」頁面（發件人名稱/電郵、三種通知開關、即將結束分鐘數）
- [x] 新增 vitest 測試覆蓋郵件觸發邏輯

## 用戶通知偏好設定

- [x] 資料庫 users 表新增 notifyOutbid、notifyWon、notifyEndingSoon 欄位（int 預設 1）
- [x] 執行 ALTER TABLE migration
- [x] 後端 db.ts 更新 getUserById 回傳通知偏好欄位
- [x] 後端新增 users.updateNotificationPrefs procedure
- [x] 後端 placeBid/notifyWon/notifyEndingSoon 發送前檢查用戶個人偏好
- [x] 前端 Profile.tsx 加入三個通知開關（出價被超越、得標、即將結束）
- [x] 新增 vitest 測試覆蓋通知偏好邏輯

## 通知一鍵全部開啟/關閉

- [x] 前端 Profile.tsx 通知類型標題列右側加入「全部開啟」/「全部關閉」切換按鈕

## 出價紀錄顯示格式修改

- [x] 出價紀錄頁面：拍賣標題改為「拍賣 商品名稱」格式，最多20字超過加「..」，字體縮小三分之一
