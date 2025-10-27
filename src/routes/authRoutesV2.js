/**
 * 認證路由 (OAuth 2.0 版本)
 * 路徑: sailo_backend/src/routes/authRoutesV2.js
 *
 * 功能：
 * - OAuth 2.0 標準認證端點
 * - HttpOnly Cookie 認證
 * - Token Refresh 端點
 * - Session 管理
 *
 * 端點列表：
 * - POST /api/auth/login - 登入
 * - POST /api/auth/register - 註冊
 * - POST /api/auth/logout - 登出
 * - POST /api/auth/verify - 驗證 Token
 * - POST /api/auth/refresh - 刷新 Access Token
 */

import express from 'express'
import passport from '../config/passport.js'
import {
  login,
  register,
  logout,
  verify,
  refreshAccessToken,
  forgotPassword,
  verifyOTP,
  resetPassword,
  googleLogin,
  googleCallback,
  enable2FA,
  verify2FA,
  disable2FA,
  get2FAStatus,
} from '../controllers/authControllerV2.js'
import { authenticate } from '../middleware/authV2.js'

const router = express.Router()

// ============================================
// 認證端點
// ============================================

/**
 * 登入
 * @route POST /api/auth/login
 * @body {string} email - 使用者信箱
 * @body {string} password - 使用者密碼
 * @body {string} [token2fa] - Google Authenticator 驗證碼 (如果啟用 2FA)
 *
 * @response Cookies:
 * - access_token: JWT Access Token (httpOnly)
 * - refresh_token: JWT Refresh Token (httpOnly)
 * - session_token: Session Token (httpOnly)
 */
router.post('/login', login)

/**
 * 註冊
 * @route POST /api/auth/register
 * @body {string} email - 使用者信箱
 * @body {string} password - 使用者密碼
 * @body {string} [nickname] - 暱稱 (可選)
 * @body {string} [phone] - 電話 (可選)
 */
router.post('/register', register)

/**
 * 登出
 * @route POST /api/auth/logout
 *
 * @cookies:
 * - session_token: Session Token (用於撤銷 Session)
 *
 * @response Cookies 全部清除
 */
router.post('/logout', logout)

/**
 * 驗證 Token
 * @route POST /api/auth/verify
 *
 * @cookies:
 * - access_token: JWT Access Token
 *
 * @response {object} { valid: true, user: {...} }
 */
router.post('/verify', verify)

/**
 * 刷新 Access Token
 * @route POST /api/auth/refresh
 *
 * OAuth 2.0 Token Refresh 流程：
 * 1. 從 httpOnly cookie 讀取 Refresh Token
 * 2. 驗證 Refresh Token
 * 3. 撤銷舊的 Refresh Token (Token Rotation)
 * 4. 產生新的 Access Token 和 Refresh Token
 * 5. 更新 httpOnly cookies
 *
 * @cookies:
 * - refresh_token: JWT Refresh Token
 *
 * @response Cookies:
 * - access_token: 新的 JWT Access Token
 * - refresh_token: 新的 JWT Refresh Token
 */
router.post('/refresh', refreshAccessToken)

// ============================================
// 密碼重設端點 (OTP 驗證方式)
// ============================================

/**
 * 忘記密碼 - 發送 6 位數 OTP 到信箱
 * @route POST /api/v2/auth/forgot-password
 * @body {string} email - 使用者信箱
 * @returns {success, message}
 */
router.post('/forgot-password', forgotPassword)

/**
 * 驗證 OTP - 確認 6 位數驗證碼
 * @route POST /api/v2/auth/verify-otp
 * @body {string} email - 使用者信箱
 * @body {string} otp - 6 位數 OTP
 * @returns {success, message, verified}
 */
router.post('/verify-otp', verifyOTP)

/**
 * 重置密碼 - 使用已驗證的 OTP 設定新密碼
 * @route POST /api/v2/auth/reset-password
 * @body {string} email - 使用者信箱
 * @body {string} otp - 6 位數 OTP (已驗證)
 * @body {string} newPassword - 新密碼
 * @returns {success, message}
 */
router.post('/reset-password', resetPassword)

// ============================================
// Google OAuth 端點
// ============================================

/**
 * Google 登入 - 啟動 OAuth 流程
 * @route GET /api/v2/auth/google
 */
router.get(
  '/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
  })
)

/**
 * Google OAuth 回調
 * @route GET /api/v2/auth/google/callback
 *
 * @response Redirect to frontend with cookies set:
 * - access_token: JWT Access Token (httpOnly)
 * - refresh_token: JWT Refresh Token (httpOnly)
 * - session_token: Session Token (httpOnly)
 */
router.get(
  '/google/callback',
  passport.authenticate('google', {
    failureRedirect: '/login',
  }),
  googleCallback
)

// ============================================
// Google Authenticator (2FA) 端點
// ============================================

/**
 * 啟用 Google Authenticator
 * @route POST /api/v2/auth/2fa/enable
 * @access Private
 *
 * @response {object} { success, qrCode, secret, backupCodes }
 */
router.post('/2fa/enable', authenticate, enable2FA)

/**
 * 驗證並啟用 Google Authenticator
 * @route POST /api/v2/auth/2fa/verify
 * @access Private
 * @body {string} token - 6位數驗證碼
 */
router.post('/2fa/verify', authenticate, verify2FA)

/**
 * 停用 Google Authenticator
 * @route POST /api/v2/auth/2fa/disable
 * @access Private
 * @body {string} password - 使用者密碼
 */
router.post('/2fa/disable', authenticate, disable2FA)

/**
 * 取得 2FA 狀態
 * @route GET /api/v2/auth/2fa/status
 * @access Private
 *
 * @response {object} { success, enabled, hasBackupCodes }
 */
router.get('/2fa/status', authenticate, get2FAStatus)

// ============================================
// Session 管理端點 (需要驗證)
// ============================================

/**
 * 取得使用者的所有活躍 Sessions
 * @route GET /api/auth/sessions
 * @access Private
 */
router.get('/sessions', authenticate, async (req, res) => {
  try {
    const { getUserActiveSessions } = await import(
      '../services/sessionService.js'
    )
    const sessions = await getUserActiveSessions(req.user.userId)

    res.json({
      success: true,
      sessions,
    })
  } catch (error) {
    console.error('❌ Get sessions error:', error)
    res.status(500).json({
      success: false,
      message: '取得 Sessions 失敗',
    })
  }
})

/**
 * 撤銷指定 Session
 * @route DELETE /api/auth/sessions/:sessionId
 * @access Private
 */
router.delete('/sessions/:sessionId', authenticate, async (req, res) => {
  try {
    const { query } = await import('../config/database.js')
    const { revokeSession } = await import('../services/sessionService.js')
    const sessionId = parseInt(req.params.sessionId)

    // 檢查 Session 是否屬於當前使用者
    const sessions = await query(
      'SELECT session_token FROM sessions WHERE id = ? AND user_id = ? LIMIT 1',
      [sessionId, req.user.userId]
    )

    if (sessions.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Session 不存在',
      })
    }

    // 撤銷 Session
    await revokeSession(sessions[0].session_token)

    res.json({
      success: true,
      message: 'Session 已撤銷',
    })
  } catch (error) {
    console.error('❌ Revoke session error:', error)
    res.status(500).json({
      success: false,
      message: '撤銷 Session 失敗',
    })
  }
})

/**
 * 撤銷所有 Sessions (全部登出)
 * @route POST /api/auth/sessions/revoke-all
 * @access Private
 */
router.post('/sessions/revoke-all', authenticate, async (req, res) => {
  try {
    const { revokeAllUserSessions } = await import(
      '../services/sessionService.js'
    )
    const count = await revokeAllUserSessions(req.user.userId)

    // 清除當前的 cookies
    res.clearCookie('access_token', { httpOnly: true, path: '/' })
    res.clearCookie('refresh_token', { httpOnly: true, path: '/' })
    res.clearCookie('session_token', { httpOnly: true, path: '/' })

    res.json({
      success: true,
      message: `已撤銷 ${count} 個 Sessions`,
      count,
    })
  } catch (error) {
    console.error('❌ Revoke all sessions error:', error)
    res.status(500).json({
      success: false,
      message: '撤銷所有 Sessions 失敗',
    })
  }
})

export default router
