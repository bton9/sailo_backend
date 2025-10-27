import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import session from 'express-session'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import passport from './src/config/passport.js'
import { validateImageKitConfig } from './src/config/imagekit.js'
// import authRoutes from './src/routes/authRoutes.js' // 舊版已棄用
import authRoutesV2 from './src/routes/authRoutesV2.js' // OAuth 2.0 版本
import userRoutes from './src/routes/userRoutes.js'
import blogRoutes from './src/routes/blog/index.js' //blog用
import setupProductRoutes from './src/middleware/pd_router.js'
// 行程規畫用
import locationRoutes from './src/routes/location.js'
import placesRoutes from './src/routes/placesRoutes.js'
import favoriteRoutes from './src/routes/favoriteRoutes.js'
import { setupStaticRoutes } from './src/config/staticRoutes.js'
// 行程規畫用
import cartRoutes from './src/routes/cart/index.js' //購物車用

// ES Modules 環境下取得 __dirname
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config()

// ============ 驗證 ImageKit 配置 ============
validateImageKitConfig()

const app = express()
const PORT = process.env.PORT || 5000

// ============ Middleware ============
app.use(
  cors({
    origin: [
      process.env.FRONTEND_URL || 'http://localhost:3000',
      'http://localhost:3001', // 支援 port 3001 (當 3000 被佔用時)
    ],
    credentials: true, // 允許傳送 cookies
  })
)
app.use(express.json())
app.use(cookieParser()) // 解析 cookies

// ============ Session 配置 ============
// 用於 Passport Google OAuth
app.use(
  session({
    secret:
      process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production', // 生產環境使用 HTTPS
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 小時
    },
  })
)

// ============ 靜態檔案服務 ============
// 提供 uploads 目錄中的檔案訪問（用於頭像圖片）
app.use('/uploads', express.static(path.join(__dirname, 'uploads')))
console.log('✅ 靜態檔案目錄:', path.join(__dirname, 'uploads'))

// ============ ProductRoutes ============
setupProductRoutes(app)

// ============ Passport 初始化 ============
app.use(passport.initialize())
app.use(passport.session()) // 啟用 Passport session 支援

// ============ Routes ============
// app.use('/api/auth', authRoutes) // 舊版認證 (向後相容)
app.use('/api/v2/auth', authRoutesV2) // OAuth 2.0 版本 (新)
app.use('/api/v2/user', userRoutes) // OAuth 2.0 版本 (新)

// ============ Health Check ============
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Backend server is running' })
})

// ============ Error Handling ============
app.use((err, req, res, next) => {
  console.error('❌ Server Error:', err)
  console.error('Error Stack:', err.stack)
  console.error('Request URL:', req.url)
  console.error('Request Method:', req.method)

  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined,
  })
})

// ============ Start Server ============
app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`)
})

// === 部落格 ===

// === Routes ===
app.use('/api/blog', blogRoutes) //blog用

// === 圖片上傳用的 ===

app.use('/uploads', express.static(path.join(__dirname, 'public/uploads'))) //blog用 之後會刪掉

// ===  部落格 ===

// === 行程規畫用 ===

// ============ Routes ============
// 地區資料相關 API（如縣市、行政區）
app.use('/api/locations', locationRoutes)
/*景點（Places）相關路由 /api/places*/
app.use('/api/places', placesRoutes)
/*收藏清單（Favorites）相關路由 api/favorites -----------------------*/
app.use('/api/favorites', favoriteRoutes)
// ============ 靜態圖片與 CORS 預檢路由 ============
// 包含景點封面圖片或使用者上傳檔案的靜態資源服務設定
setupStaticRoutes(app)

// === 行程規畫用 ===

// === Cart Routes ===
app.use('/api', cartRoutes)
