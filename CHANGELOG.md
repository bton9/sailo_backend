## [v0.1] - 2025-10-13

- 原始版本
- 登入登出 資料庫 連線設定

## [v0.2] - 2025-10-21

- V2版本
- 各項驗證 頭貼上傳 imgkit google登入

## [v0.3] - 2025-10-23

- 第二次合併完成

## [v0.4] - 2025-10-28

- 第三次合併完成
- 大修JWT＋Refresh token+session

## [v0.5.0] - 2025-11-03

- 第四次合併完成
- AI/人工客服

## [v0.5.4] - 2025-11-07

- 新堯
- 惠欣
- VVN
- +0

## [v0.6.0] - 2025-11-08

- 第五次合併完成
- 新增AI跳轉修改密碼功能

## [v0.6.1] - 2025-11-10

- 改OLLAMA文字檔

## [v0.6.2] - 2025-11-11

- 半穩定版本

## [v0.7.0] - 2025-11-11

- 第六次合併完成

## [v0.7.1] - 2025-11-17

- 更新本地AI 數據抓取方式與對話文字判定

## [v0.7.2] - 2025-11-27

- README 文件整理與更新，移除專案結構章節

## [v0.7.3] - 2025-11-28

- 多個控制器與工具函式進行小幅修正與格式調整

## [v0.8.0] - 2026-06-14

- README 大幅更新

## [v0.8.1] - 2026-07-06

- 刪除測試檔案

## [v0.8.2] - 2026-07-07

- 新增登入驗證 API
- 新增行程搜尋功能
- 移除死路由 tripRoutes.js

## [v0.8.3] - 2026-07-08

- 整個移除 AI 客服（Ollama）功能
- 修復正式環境跨網域登入會失敗的 cookie bug

## [v0.8.4] - 2026-07-09

- Google 登入改用 exchange 端點交換 cookie，不再直接用 res.cookie() 設 cookie 後轉址，token 改暫存記憶體（60 秒短效期、一次性）
- authControllerV2.js 的 login、verify、Google exchange 回應額外附上 accessToken 明文，供 Socket.io 認證中介層在沒有 cookie 時 fallback 使用

## [v0.9.0] - 2026-07-10

- 新增 Admin 儀表板統計 API：adminController.js、adminRoutes.js，GET /api/v2/admin/stats，COUNT users/orders/products
- server.js 掛載新的 admin 路由

## [v0.9.1] - 2026-07-11

- 新增 .env.example，補齊環境變數說明
- 修正 .gitignore 讓範例檔可以被提交

## [v0.9.2] - 2026-07-12

- 全面清除程式碼註解與 console.log 中的 emoji
- 修正 console.log/error/warn 開頭殘留的孤立空格
