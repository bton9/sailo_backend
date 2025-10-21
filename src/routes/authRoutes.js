import express from 'express'
import passport from '../config/passport.js'
import {
  login,
  register,
  logout,
  verify,
  forgotPassword,
  resetPassword,
  googleLogin,
  googleCallback,
  googleLogout,
} from '../controllers/authController.js'

const router = express.Router()

// ============================================
// 本地帳號 (Email + Password) 相關路由
// ============================================

/**
 * 本地登入
 * @route POST /api/auth/login
 * @body {string} email - 使用者信箱
 * @body {string} password - 使用者密碼
 */
router.post('/login', login)

/**
 * 本地註冊
 * @route POST /api/auth/register
 * @body {string} email - 使用者信箱
 * @body {string} password - 使用者密碼
 * @body {string} name - 使用者姓名
 * @body {string} [nickname] - 暱稱 (可選)
 * @body {string} [phone] - 電話 (可選)
 */
router.post('/register', register)

/**
 * 本地登出
 * @route POST /api/auth/logout
 */
router.post('/logout', logout)

/**
 * 驗證 JWT Token
 * @route POST /api/auth/verify
 * @header {string} Authorization - Bearer Token
 */
router.post('/verify', verify)

// ============================================
// 密碼重置相關路由
// ============================================

/**
 * 忘記密碼 - 發送重置密碼郵件
 * @route POST /api/auth/forgot-password
 * @body {string} email - 使用者信箱
 */
router.post('/forgot-password', forgotPassword)

/**
 * 重置密碼 - 使用 Token 更新密碼
 * @route POST /api/auth/reset-password
 * @body {string} token - 重置 Token
 * @body {string} newPassword - 新密碼
 */
router.post('/reset-password', resetPassword)

// ============================================
// Google OAuth 相關路由
// ============================================

/**
 * Google 登入 - 啟動 OAuth 流程
 * @route GET /api/auth/google
 *
 * 此端點會將使用者重導向到 Google 登入頁面
 * 使用者授權後，Google 會重導向回 /api/auth/google/callback
 */
router.get(
  '/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
  })
)

/**
 * Google OAuth 回調
 * @route GET /api/auth/google/callback
 *
 * Google 驗證成功後會調用此端點
 * 自動建立或登入使用者，並產生 JWT Token
 * 最後重導向到前端頁面
 */
router.get(
  '/google/callback',
  passport.authenticate('google', {
    session: false, // 不使用 session，改用 JWT
    failureRedirect: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=google_auth_failed`,
  }),
  googleCallback
)

/**
 * Google 登出
 * @route POST /api/auth/google/logout
 */
router.post('/google/logout', googleLogout)

export default router
