import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import passport from './src/config/passport.js'
import { validateImageKitConfig } from './src/config/imagekit.js'
import authRoutes from './src/routes/authRoutes.js'
import userRoutes from './src/routes/userRoutes.js'

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
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  })
)
app.use(express.json())

// ============ 靜態檔案服務 ============
// 提供 uploads 目錄中的檔案訪問（用於頭像圖片）
app.use('/uploads', express.static(path.join(__dirname, 'uploads')))
console.log('✅ 靜態檔案目錄:', path.join(__dirname, 'uploads'))

// ============ Passport 初始化 ============
app.use(passport.initialize())

// ============ Routes ============
app.use('/api/auth', authRoutes)
app.use('/api/user', userRoutes)

// ============ Health Check ============
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Backend server is running' })
})

// ============ Error Handling ============
app.use((err, req, res, next) => {
  console.error('Error:', err)
  res.status(500).json({
    success: false,
    message: 'Internal server error',
  })
})

// ============ Start Server ============
app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`)
})
