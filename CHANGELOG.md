Sailo Backend
Sailo 旅遊行程平台 — Node.js 後端 API 服務
專案簡介（Overview）
Sailo Backend 是 Sailo 旅遊平台的後端服務，負責處理 會員系統、景點資料、行程管理、收藏功能、留言系統、圖片儲存、地圖座標 等所有資料與 API 邏輯。
後端採用 Node.js + Express 搭配 MySQL 資料庫，並以 RESTful API 設計架構。
同時整合 JWT Token 驗證、ImageKit 雲端圖片儲存 與 Leaflet/Google Maps 導航所需的精準經緯度資料。
技術架構（Tech Stack）
Runtime & Framework
Node.js
Express.js
Database & ORM
MySQL
Knex / Sequelize（如果你有使用請告訴我，我能幫你補上）
Authentication
JWT（JSON Web Token）
bcrypt 密碼加密
File Storage
ImageKit（圖片上傳、壓縮、CDN）
Architecture
RESTful API
MVC 架構（Model / Controller / Routes）
中介層（Middleware）處理驗證與錯誤管理
主要後端功能（Backend Features）
會員系統（Auth）
使用者註冊
使用者登入
JWT 身分驗證
密碼加密儲存（bcrypt）
景點資料（Places）
景點列表（支援分類與地區篩選）
景點詳細資訊
Google Maps 連結（導航、評論）
精準經緯度儲存於資料庫（給 Leaflet 使用）
收藏系統（Favorites）
建立收藏清單
新增 / 移除收藏
取得使用者收藏列表
行程管理（Trips）
建立行程（含公開/私人設定）
編輯行程名稱、日期範圍、交通方式
刪除行程
行程複製（複製別人公開行程）
新增 / 刪除行程中的景點
行程中的每日備註系統
留言與回覆（Comments & Replies）
景點留言（可含評分）
景點留言回覆
行程留言 & 回覆（若你有此功能）
圖片上傳（Image Upload）
使用者上傳景點照片
透過 ImageKit 儲存並提供 URL
自動壓縮、裁切、快取加速
安裝與啟動 
npm install
環境變數（.env）
請新增 .env 並填入：
PORT=8080
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=xxxx
DB_NAME=sailo
JWT_SECRET=yourSecretKey
IMAGEKIT_PUBLIC=xxxx
IMAGEKIT_PRIVATE=xxxx
IMAGEKIT_URL=xxxx
npm run dev
Email: pfw6638@gmail.com
GitHub: https://github.com/bton9