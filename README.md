# Sailo Backend  旅遊行程規劃平台 API

> 使用 Node.js + Express 打造的 RESTful API 後端服務

![Node.js](https://img.shields.io/badge/Node.js-Express-339933?style=flat-square&logo=node.js)
![MySQL](https://img.shields.io/badge/MySQL-Database-4479A1?style=flat-square&logo=mysql)
![JWT](https://img.shields.io/badge/Auth-JWT-000000?style=flat-square&logo=jsonwebtokens)
![Socket.io](https://img.shields.io/badge/Socket.io-Realtime-010101?style=flat-square&logo=socket.io)

---

## 專案簡介

Sailo Backend 提供前端（[sailo_fronte_end](https://github.com/bton9/sailo_fronte_end)）所需的完整 API 服務，涵蓋使用者驗證、景點管理、行程規劃、即時聊天、購物車與 AI 聊天助手等功能。

資料庫 Schema：[sailo_db](https://github.com/bton9/sailo_db)

---

## 主要功能

###  使用者驗證
- JWT 身份驗證（Access Token + Refresh Token）
- Google OAuth 第三方登入
- OTP 信箱驗證、忘記密碼流程
- 登入失敗次數限制與帳號鎖定機制

###  景點與地圖
- 景點 CRUD，支援分類、城市篩選、關鍵字搜尋
- 景點精準經緯度儲存
- 收藏景點清單管理

###  行程管理（本人負責核心 API）
- 行程建立、編輯、刪除（支援公開 / 私人）
- 多天行程規劃，景點加入 / 移除
- 行程複製、收藏功能
- 景點備註管理

###  即時聊天
- Socket.io 客服聊天室（使用者  客服）
- AI 聊天助手（串接 Ollama 本地模型）
- 聊天歷史紀錄儲存

###  購物車與金流
- 購物車 CRUD
- 訂單建立與狀態管理
- 綠界金流（ECPay）串接

###  圖片上傳
- ImageKit 雲端儲存
- 使用者頭像上傳
- 景點照片上傳與 CDN 快取

###  部落格
- 文章發布、編輯、刪除
- 留言、按讚、追蹤功能
- 標籤系統與搜尋

---

## 技術架構

| 技術 | 用途 |
|------|------|
| Node.js + Express | 後端框架 |
| MySQL | 資料庫 |
| RESTful API | API 設計規範 |
| JWT | 身份驗證 |
| Google OAuth 2.0 | 第三方登入 |
| Socket.io | 即時聊天 |
| ImageKit | 雲端圖片儲存 |
| Ollama | 本地 AI 模型 |
| Speakeasy | OTP 驗證 |
| Nodemailer | 信件發送 |
| ECPay | 綠界金流 |

---

## 專案結構

```
sailo_backend/
 src/
    app.js                # 主程式入口
    config/               # 設定檔
       database.js       # MySQL 連線
       passport.js       # Google OAuth
       imagekit.js       # ImageKit 設定
       ollama.js         # Ollama AI 設定
    controllers/          # 控制器
       authControllerV2.js
       placesController.js
       favoriteController.js
       custom/           # 行程相關（本人負責）
          tripcontroller.js
          tripitemcontroller.js
          tripfavoritecontroller.js
       blog/             # 部落格
       cart/             # 購物車
       chat/             # 聊天室
    routes/               # 路由
       authRoutesV2.js
       placesRoutes.js
       custom/           # 行程路由（本人負責）
       blog/
       cart/
       chat/
    middleware/           # 中介層
       authV2.js         # JWT 驗證
       upload.middleware.js
    services/             # 服務層
       ollamaService.js
       refreshTokenService.js
    utils/                # 工具函式
        email.js
        jwt.js
        password.js
 uploads/                  # 本機上傳暫存
```

---

## 安裝與使用

### 環境需求
- Node.js v18+
- MySQL
- npm

### 安裝步驟

```bash
# 1. Clone 專案
git clone https://github.com/bton9/sailo_backend.git
cd sailo_backend

# 2. 安裝相依套件
npm i

# 3. 設定環境變數
cp .env.example .env
# 填入對應設定（見下方說明）

# 4. 匯入資料庫 Schema
# 請參考 sailo_db repo

# 5. 啟動伺服器
npm start
```

伺服器預設運行於 `http://localhost:5000`

---

## 環境變數

請在專案根目錄建立 `.env` 檔案：

```env
# Server
PORT=
NODE_ENV=
FRONTEND_URL=http://localhost:3000

# Database
DB_HOST=
DB_PORT=
DB_USER=
DB_PASSWORD=
DB_NAME=

# JWT
JWT_SECRET=
JWT_EXPIRES_IN=
JWT_REFRESH_EXPIRES_IN=

# Session
SESSION_SECRET=

# System Settings
MAX_LOGIN_ATTEMPTS=
ACCOUNT_LOCK_MINUTES=

# Gmail
EMAIL_HOST=
EMAIL_PORT=
EMAIL_SECURE=
EMAIL_USER=
EMAIL_PASSWORD=

# Google OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=http://localhost:5000/api/v2/auth/google/callback

# ImageKit
IMAGEKIT_PUBLIC_KEY=
IMAGEKIT_PRIVATE_KEY=
IMAGEKIT_URL_ENDPOINT=

# Ollama AI
OLLAMA_BASE_URL=
OLLAMA_MODEL=
OLLAMA_TEMPERATURE=
OLLAMA_TOP_K=
OLLAMA_REPEAT_PENALTY=
OLLAMA_TIMEOUT=30000
```

> 如需完整設定，請聯繫作者。
---

## 作者
**林新堯**  
資展國際前端工程師就業養成班（2025/6  2025/11）  
GitHub：[@bton9](https://github.com/bton9)