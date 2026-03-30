ALTER TABLE `notificationSettings` ADD `paymentInstructions` text DEFAULT ('接受付款方式：FPS、八達通、微信支付、支付寶、BOCPay、Visa

FPS 轉數快：請轉帳至 [電話號碼/電郵]，並備注拍賣編號。') NOT NULL;--> statement-breakpoint
ALTER TABLE `notificationSettings` ADD `deliveryInfo` text DEFAULT ('交收安排：
1. 建議順豐到付（買家承擔運費）
2. 歡迎來店自取（請提前聯絡預約）
3. 如有查詢請聯絡大BB錢幣店') NOT NULL;