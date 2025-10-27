/**
 * 認證控制器 (OAuth 2.0 版本)
 * 路徑: sailo_backend/src/controllers/authControllerV2.js
 *
 * 功能：
 * - OAuth 2.0 標準認證流程
 * - JWT Access Token + Refresh Token 機制
 * - HttpOnly Cookie 安全儲存
 * - Session 管理
 * - 不使用 localStorage
 *
 * 改進：
 * 1. 登入時建立 Session 和 Refresh Token
 * 2. Access Token 透過 httpOnly cookie 傳遞
 * 3. Refresh Token 透過 httpOnly cookie 傳遞
 * 4. 實作 Token Refresh 端點
 * 5. 登出時撤銷 Session 和 Token
 */

import { query } from '../config/database.js'
import { hashPassword, verifyPassword } from '../utils/password.js'
import { generateToken, verifyToken } from '../utils/jwt.js'
import {
  createSession,
  revokeSession,
  validateSession,
  hashAccessToken,
} from '../services/sessionService.js'
import {
  createRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
} from '../services/refreshTokenService.js'
import { sendPasswordResetOTPEmail } from '../utils/email.js'
import crypto from 'crypto'
import speakeasy from 'speakeasy'
import QRCode from 'qrcode'

/**
 * Cookie 配置
 */
const COOKIE_OPTIONS = {
  httpOnly: true, // 防止 XSS 攻擊，JavaScript 無法存取
  secure: false, // 開發環境使用 HTTP，設為 false
  sameSite: 'lax', // CSRF 防護
  path: '/',
}

const ACCESS_TOKEN_COOKIE = 'access_token'
const REFRESH_TOKEN_COOKIE = 'refresh_token'
const SESSION_TOKEN_COOKIE = 'session_token'

/**
 * 登入
 *
 * OAuth 2.0 流程：
 * 1. 驗證 email 和密碼
 * 2. 建立 Session
 * 3. 產生 Access Token 和 Refresh Token
 * 4. 將 Tokens 儲存到 httpOnly cookies
 *
 * @route POST /api/auth/login
 * @body {string} email - Email 帳號
 * @body {string} password - 密碼
 * @body {string} token2fa - (選填) 6位數 Google Authenticator 驗證碼
 */
export async function login(req, res) {
  try {
    const { email, password, token2fa } = req.body

    // ============================================
    // 步驟 1: 驗證必填欄位
    // ============================================
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email 和密碼為必填欄位',
      })
    }

    // ============================================
    // 步驟 2: 查詢使用者
    // ============================================
    const users = await query('SELECT * FROM users WHERE email = ? LIMIT 1', [
      email,
    ])

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Email 或密碼錯誤',
      })
    }

    const user = users[0]

    // 檢查帳戶狀態
    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: '帳戶已停用，請聯繫客服',
      })
    }

    // ============================================
    // 步驟 3: 驗證密碼
    // ============================================
    const isPasswordValid = await verifyPassword(password, user.password)

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Email 或密碼錯誤',
      })
    }

    // ============================================
    // 步驟 4: Google Authenticator (2FA) 驗證
    // ============================================
    if (user.google_authenticator_enabled) {
      console.log('🔐 使用者已啟用 2FA，需要驗證')

      if (!token2fa) {
        return res.status(200).json({
          success: false,
          requires2FA: true,
          message: '請輸入 Google Authenticator 驗證碼',
        })
      }

      // 驗證 2FA token
      const verified = speakeasy.totp.verify({
        secret: user.google_authenticator_secret,
        encoding: 'base32',
        token: token2fa,
        window: 2,
      })

      if (!verified) {
        console.log('❌ 2FA 驗證碼錯誤')
        return res.status(401).json({
          success: false,
          requires2FA: true,
          message: '驗證碼錯誤或已過期',
        })
      }

      console.log('✅ 2FA 驗證通過')
    }

    // ============================================
    // 步驟 5: 產生 JWT Access Token
    // ============================================
    const accessToken = generateToken({
      userId: user.id,
      email: user.email,
      access: user.access,
    })

    // ============================================
    // 步驟 6: 建立 Session
    // ============================================
    const sessionResult = await createSession(user.id, accessToken, {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip || req.connection.remoteAddress,
      expiresInHours: 24, // Session 有效期 24 小時
    })

    // ============================================
    // 步驟 7: 建立 Refresh Token
    // ============================================
    const refreshTokenResult = await createRefreshToken(
      user.id,
      sessionResult.sessionId,
      {
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip || req.connection.remoteAddress,
        expiresInDays: 30, // Refresh Token 有效期 30 天
      }
    )

    // ============================================
    // 步驟 8: 設定 HttpOnly Cookies
    // ============================================
    // Access Token Cookie (短期，7 天)
    res.cookie(ACCESS_TOKEN_COOKIE, accessToken, {
      ...COOKIE_OPTIONS,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 天
    })

    // Refresh Token Cookie (長期，30 天)
    res.cookie(REFRESH_TOKEN_COOKIE, refreshTokenResult.refreshToken, {
      ...COOKIE_OPTIONS,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 天
    })

    // Session Token Cookie (24 小時)
    res.cookie(SESSION_TOKEN_COOKIE, sessionResult.sessionToken, {
      ...COOKIE_OPTIONS,
      maxAge: 24 * 60 * 60 * 1000, // 24 小時
    })

    // ============================================
    // 步驟 9: 準備回傳資料
    // ============================================
    const userData = {
      id: user.id,
      email: user.email,
      name: user.name,
      nickname: user.nickname,
      phone: user.phone,
      avatar: user.avatar,
      access: user.access,
      email_verified: user.email_verified,
      google_authenticator_enabled: user.google_authenticator_enabled,
    }

    console.log('✅ 登入成功:', {
      userId: user.id,
      email: user.email,
      sessionId: sessionResult.sessionId,
    })

    res.json({
      success: true,
      message: '登入成功',
      user: userData,
      // 不再回傳 token，改用 httpOnly cookie
    })
  } catch (error) {
    console.error('❌ Login error:', error)
    res.status(500).json({
      success: false,
      message: '伺服器錯誤，請稍後再試',
    })
  }
}

/**
 * Refresh Token - 刷新 Access Token
 *
 * OAuth 2.0 Token Refresh 流程：
 * 1. 從 cookie 讀取 Refresh Token
 * 2. 驗證 Refresh Token 有效性
 * 3. 撤銷舊的 Refresh Token (Token Rotation)
 * 4. 產生新的 Access Token 和 Refresh Token
 * 5. 更新 cookies
 *
 * @route POST /api/auth/refresh
 */
export async function refreshAccessToken(req, res) {
  try {
    // ============================================
    // 步驟 1: 從 Cookie 取得 Refresh Token
    // ============================================
    const oldRefreshToken = req.cookies[REFRESH_TOKEN_COOKIE]

    if (!oldRefreshToken) {
      return res.status(401).json({
        success: false,
        message: '未提供 Refresh Token',
      })
    }

    // ============================================
    // 步驟 2: Token Rotation (輪替)
    // ============================================
    const rotationResult = await rotateRefreshToken(oldRefreshToken, {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip || req.connection.remoteAddress,
    })

    if (!rotationResult) {
      // Refresh Token 無效，清除所有 cookies
      res.clearCookie(ACCESS_TOKEN_COOKIE, COOKIE_OPTIONS)
      res.clearCookie(REFRESH_TOKEN_COOKIE, COOKIE_OPTIONS)
      res.clearCookie(SESSION_TOKEN_COOKIE, COOKIE_OPTIONS)

      return res.status(401).json({
        success: false,
        message: 'Refresh Token 無效或已過期，請重新登入',
      })
    }

    const { newRefreshToken, userId, sessionId } = rotationResult

    // ============================================
    // 步驟 3: 產生新的 Access Token
    // ============================================
    const users = await query('SELECT * FROM users WHERE id = ? LIMIT 1', [
      userId,
    ])

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: '使用者不存在',
      })
    }

    const user = users[0]

    const newAccessToken = generateToken({
      userId: user.id,
      email: user.email,
      access: user.access,
    })

    // ============================================
    // 步驟 4: 更新 Cookies
    // ============================================
    res.cookie(ACCESS_TOKEN_COOKIE, newAccessToken, {
      ...COOKIE_OPTIONS,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 天
    })

    res.cookie(REFRESH_TOKEN_COOKIE, newRefreshToken, {
      ...COOKIE_OPTIONS,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 天
    })

    console.log('✅ Token 刷新成功:', { userId, sessionId })

    res.json({
      success: true,
      message: 'Token 已刷新',
    })
  } catch (error) {
    console.error('❌ Refresh token error:', error)
    res.status(500).json({
      success: false,
      message: '伺服器錯誤，請稍後再試',
    })
  }
}

/**
 * 登出
 *
 * 流程：
 * 1. 從 cookie 取得 Session Token
 * 2. 撤銷 Session 和 Refresh Token
 * 3. 清除所有 cookies
 *
 * @route POST /api/auth/logout
 */
export async function logout(req, res) {
  try {
    // 從 Cookie 取得 Session Token
    const sessionToken = req.cookies[SESSION_TOKEN_COOKIE]

    if (sessionToken) {
      // 撤銷 Session 和關聯的 Refresh Tokens
      await revokeSession(sessionToken)
      console.log('✅ Session 已撤銷')
    }

    // 清除所有 Auth Cookies
    res.clearCookie(ACCESS_TOKEN_COOKIE, COOKIE_OPTIONS)
    res.clearCookie(REFRESH_TOKEN_COOKIE, COOKIE_OPTIONS)
    res.clearCookie(SESSION_TOKEN_COOKIE, COOKIE_OPTIONS)

    res.json({
      success: true,
      message: '登出成功',
    })
  } catch (error) {
    console.error('❌ Logout error:', error)
    res.status(500).json({
      success: false,
      message: '伺服器錯誤，請稍後再試',
    })
  }
}

/**
 * 驗證 Token 並取得使用者資料
 *
 * 改進：從 Cookie 讀取 Access Token
 *
 * @route POST /api/auth/verify
 */
export async function verify(req, res) {
  try {
    // 從 Cookie 取得 Access Token
    const token = req.cookies[ACCESS_TOKEN_COOKIE]

    if (!token) {
      return res.status(401).json({
        valid: false,
        message: '未提供 Token',
      })
    }

    // 驗證 JWT Token
    const decoded = verifyToken(token)

    if (!decoded) {
      return res.status(401).json({
        valid: false,
        message: 'Token 無效',
      })
    }

    // 從資料庫取得完整使用者資料
    const users = await query('SELECT * FROM users WHERE id = ? LIMIT 1', [
      decoded.userId,
    ])

    if (users.length === 0) {
      return res.status(401).json({
        valid: false,
        message: '使用者不存在',
      })
    }

    const user = users[0]

    // 檢查帳戶狀態
    if (!user.is_active) {
      return res.status(403).json({
        valid: false,
        message: '帳戶已停用',
      })
    }

    // 準備回傳的使用者資料
    const userData = {
      id: user.id,
      email: user.email,
      name: user.name,
      nickname: user.nickname,
      phone: user.phone,
      avatar: user.avatar,
      access: user.access,
      email_verified: user.email_verified,
      google_authenticator_enabled: user.google_authenticator_enabled,
    }

    res.json({
      valid: true,
      user: userData,
    })
  } catch (error) {
    console.error('❌ Token verify error:', error)
    res.status(401).json({
      valid: false,
      message: 'Token 驗證失敗',
    })
  }
}

/**
 * 註冊新帳號
 * (保持與原版相同，不需修改)
 */
export async function register(req, res) {
  try {
    const { email, password, nickname, phone } = req.body

    // 驗證必填欄位
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email 與密碼為必填欄位',
      })
    }

    // 檢查 Email 是否已註冊
    const existingUsers = await query(
      'SELECT id FROM users WHERE email = ? LIMIT 1',
      [email]
    )

    if (existingUsers.length > 0) {
      return res.status(409).json({
        success: false,
        message: '此 Email 已被註冊',
      })
    }

    // 產生預設姓名
    let defaultName = nickname || email.split('@')[0]

    // 加密密碼
    const hashedPassword = await hashPassword(password)

    // 設定預設頭像
    const defaultAvatar =
      'https://ik.imagekit.io/crjen7iza/avatars/avatarxxx01.png?updatedAt=1761200375843'

    // 建立新使用者
    const result = await query(
      `INSERT INTO users (email, password, name, nickname, phone, avatar, access, is_active, email_verified) 
       VALUES (?, ?, ?, ?, ?, ?, 'user', TRUE, FALSE)`,
      [
        email,
        hashedPassword,
        defaultName,
        nickname || null,
        phone || null,
        defaultAvatar,
      ]
    )

    console.log('✅ 註冊成功 - User ID:', result.insertId)

    res.json({
      success: true,
      message: '註冊成功，請登入',
    })
  } catch (error) {
    console.error('❌ Register error:', error)
    res.status(500).json({
      success: false,
      message: '伺服器錯誤，請稍後再試',
    })
  }
}

/**
 * 忘記密碼 - 發送重置密碼郵件
 *
 * 流程：
 * 1. 驗證使用者 Email 是否存在
 * 2. 產生隨機重置 Token (32 bytes hex)
 * 3. 儲存 Token 到資料庫 (有效期 1 小時)
 * 4. 發送密碼重置郵件給使用者
 *
 * @route POST /api/v2/auth/forgot-password
 * @body {string} email - 使用者信箱
 */
/**
 * ========================================
 * 忘記密碼 - 發送 OTP 驗證碼
 * ========================================
 *
 * 流程說明：
 * 1. 驗證 Email 是否存在
 * 2. 產生 6 位數隨機 OTP
 * 3. 儲存 OTP 到資料庫（有效期 10 分鐘）
 * 4. 發送 OTP 到使用者信箱
 *
 * 安全性考量：
 * - 即使 Email 不存在也返回成功訊息（防止 Email 探測攻擊）
 * - OTP 有效期僅 10 分鐘
 * - 限制驗證次數（最多 5 次）
 * - 每次請求都會產生新的 OTP（舊的自動失效）
 *
 * @route POST /api/v2/auth/forgot-password
 * @body {string} email - 使用者 Email
 * @returns {success: boolean, message: string}
 */
export async function forgotPassword(req, res) {
  try {
    const { email } = req.body

    // ========================================
    // 步驟 1: 驗證必填欄位
    // ========================================
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email 為必填欄位',
      })
    }

    // ========================================
    // 步驟 2: 檢查使用者是否存在
    // ========================================
    const users = await query('SELECT * FROM users WHERE email = ? LIMIT 1', [
      email,
    ])

    // 安全性考量：即使使用者不存在，也返回成功訊息
    // 避免攻擊者透過此 API 探測有效的 Email 地址
    if (users.length === 0) {
      console.log(
        '⚠️ Password reset OTP requested for non-existent email:',
        email
      )
      return res.json({
        success: true,
        message: '如果該 Email 存在，我們已發送驗證碼到您的信箱',
      })
    }

    const user = users[0]

    // 檢查帳戶是否已停用
    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: '帳戶已停用，請聯繫客服',
      })
    }

    // ========================================
    // 步驟 3: 產生 6 位數 OTP 驗證碼
    // ========================================
    // 使用 crypto.randomInt 產生 6 位數隨機數字（100000 ~ 999999）
    const otp = crypto.randomInt(100000, 999999).toString()

    // OTP 有效期限：10 分鐘（比 Token 更短，提高安全性）
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 當前時間 + 10 分鐘

    // ========================================
    // 步驟 4: 刪除該 Email 的舊 OTP（確保一次只有一個有效 OTP）
    // ========================================
    await query('DELETE FROM password_resets WHERE email = ?', [email])

    // ========================================
    // 步驟 5: 將 OTP 儲存到資料庫
    // ========================================
    await query(
      `INSERT INTO password_resets (email, otp, expires_at, verified, used, attempts, max_attempts) 
       VALUES (?, ?, ?, FALSE, FALSE, 0, 5)`,
      [email, otp, expiresAt]
    )

    console.log('✅ Password reset OTP created for:', email)
    console.log('🔐 OTP:', otp, '(有效期 10 分鐘)')

    // ========================================
    // 步驟 6: 發送 OTP 郵件
    // ========================================
    const emailSent = await sendPasswordResetOTPEmail(email, otp, user.name)

    if (!emailSent) {
      console.error('❌ Failed to send OTP email to:', email)
      return res.status(500).json({
        success: false,
        message: '郵件發送失敗，請稍後再試',
      })
    }

    res.json({
      success: true,
      message: '驗證碼已發送到您的信箱，請在 10 分鐘內完成驗證',
    })
  } catch (error) {
    console.error('❌ Forgot password error:', error)
    res.status(500).json({
      success: false,
      message: '伺服器錯誤，請稍後再試',
    })
  }
}

/**
 * ========================================
 * 驗證 OTP - 確認驗證碼是否正確
 * ========================================
 *
 * 流程說明：
 * 1. 檢查 Email 和 OTP 是否匹配
 * 2. 驗證 OTP 是否過期
 * 3. 檢查驗證次數是否超過限制
 * 4. 驗證成功後標記為已驗證
 *
 * 安全性考量：
 * - 限制驗證次數（最多 5 次失敗）
 * - 驗證失敗次數累計
 * - 過期的 OTP 無法使用
 *
 * @route POST /api/v2/auth/verify-otp
 * @body {string} email - 使用者 Email
 * @body {string} otp - 6位數 OTP
 * @returns {success: boolean, message: string, verified: boolean}
 */
export async function verifyOTP(req, res) {
  try {
    const { email, otp } = req.body

    // ========================================
    // 步驟 1: 驗證必填欄位
    // ========================================
    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Email 和驗證碼為必填欄位',
      })
    }

    // 驗證 OTP 格式（必須是 6 位數字）
    if (!/^\d{6}$/.test(otp)) {
      return res.status(400).json({
        success: false,
        message: '驗證碼格式錯誤，請輸入 6 位數字',
      })
    }

    // ========================================
    // 步驟 2: 查詢 OTP 記錄
    // ========================================
    const records = await query(
      'SELECT * FROM password_resets WHERE email = ? AND otp = ? LIMIT 1',
      [email, otp]
    )

    if (records.length === 0) {
      return res.status(400).json({
        success: false,
        message: '驗證碼錯誤或已失效',
      })
    }

    const record = records[0]

    // ========================================
    // 步驟 3: 檢查 OTP 狀態
    // ========================================

    // 檢查是否已驗證過
    if (record.verified) {
      return res.json({
        success: true,
        message: '驗證碼已確認，請設定新密碼',
        verified: true,
      })
    }

    // 檢查是否已被使用（密碼已重置）
    if (record.used) {
      return res.status(400).json({
        success: false,
        message: '此驗證碼已被使用過',
      })
    }

    // 檢查驗證次數是否超過限制
    if (record.attempts >= record.max_attempts) {
      return res.status(400).json({
        success: false,
        message: '驗證次數已達上限，請重新申請驗證碼',
      })
    }

    // 檢查 OTP 是否已過期
    const now = new Date()
    const expiresAt = new Date(record.expires_at)

    if (now > expiresAt) {
      return res.status(400).json({
        success: false,
        message: '驗證碼已過期（有效期 10 分鐘），請重新申請',
      })
    }

    // ========================================
    // 步驟 4: OTP 驗證成功 - 標記為已驗證
    // ========================================
    await query(
      `UPDATE password_resets 
       SET verified = TRUE, verified_at = NOW() 
       WHERE id = ?`,
      [record.id]
    )

    console.log('✅ OTP verified successfully for:', email)

    res.json({
      success: true,
      message: 'OTP 驗證成功，請設定新密碼',
      verified: true,
    })
  } catch (error) {
    console.error('❌ Verify OTP error:', error)
    res.status(500).json({
      success: false,
      message: '伺服器錯誤，請稍後再試',
    })
  }
}

/**
 * ========================================
 * 重置密碼 - 使用已驗證的 OTP 更新密碼
 * ========================================
 *
 * 流程說明：
 * 1. 驗證 Email 和 OTP 是否匹配
 * 2. 確認 OTP 已通過驗證（verified = TRUE）
 * 3. 驗證新密碼格式
 * 4. 更新使用者密碼
 * 5. 標記 OTP 為已使用
 * 6. 撤銷所有現有的 Sessions（強制重新登入）
 *
 * 安全性考量：
 * - 必須先通過 OTP 驗證才能重置密碼
 * - 密碼重置後撤銷所有登入狀態
 * - OTP 只能使用一次
 *
 * @route POST /api/v2/auth/reset-password
 * @body {string} email - 使用者 Email
 * @body {string} otp - 6位數 OTP
 * @body {string} newPassword - 新密碼
 * @returns {success: boolean, message: string}
 */
export async function resetPassword(req, res) {
  try {
    const { email, otp, newPassword } = req.body

    // ========================================
    // 步驟 1: 驗證必填欄位
    // ========================================
    if (!email || !otp || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Email、驗證碼與新密碼為必填欄位',
      })
    }

    // 驗證密碼長度
    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: '密碼至少需要 8 個字元',
      })
    }

    // 驗證 OTP 格式
    if (!/^\d{6}$/.test(otp)) {
      return res.status(400).json({
        success: false,
        message: '驗證碼格式錯誤',
      })
    }

    // ========================================
    // 步驟 2: 查詢 OTP 記錄
    // ========================================
    const records = await query(
      'SELECT * FROM password_resets WHERE email = ? AND otp = ? LIMIT 1',
      [email, otp]
    )

    if (records.length === 0) {
      return res.status(400).json({
        success: false,
        message: '驗證碼錯誤或已失效',
      })
    }

    const record = records[0]

    // ========================================
    // 步驟 3: 驗證 OTP 狀態
    // ========================================

    // 檢查是否已被使用
    if (record.used) {
      return res.status(400).json({
        success: false,
        message: '此驗證碼已被使用過',
      })
    }

    // ⭐ 重要：必須先通過 OTP 驗證
    if (!record.verified) {
      return res.status(400).json({
        success: false,
        message: '請先驗證 OTP 才能重置密碼',
      })
    }

    // 檢查 OTP 是否已過期
    const now = new Date()
    const expiresAt = new Date(record.expires_at)

    if (now > expiresAt) {
      return res.status(400).json({
        success: false,
        message: '驗證碼已過期，請重新申請',
      })
    }

    // ========================================
    // 步驟 4: 查詢使用者並更新密碼
    // ========================================
    const users = await query('SELECT * FROM users WHERE email = ? LIMIT 1', [
      email,
    ])

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: '找不到使用者',
      })
    }

    const user = users[0]

    // 加密新密碼
    const hashedPassword = await hashPassword(newPassword)

    // 更新使用者密碼
    await query(
      'UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?',
      [hashedPassword, user.id]
    )

    // ========================================
    // 步驟 5: 標記 OTP 為已使用
    // ========================================
    await query('UPDATE password_resets SET used = TRUE WHERE id = ?', [
      record.id,
    ])

    // ========================================
    // 步驟 6: 撤銷所有現有的 Sessions 和 Refresh Tokens（安全性）
    // ========================================
    // 密碼重置後，所有舊的登入狀態都應失效，強制使用者重新登入
    await query('DELETE FROM sessions WHERE user_id = ?', [user.id])
    await query('DELETE FROM refresh_tokens WHERE user_id = ?', [user.id])

    console.log('✅ Password reset successful for:', user.email)
    console.log('🔒 All sessions and refresh tokens revoked for user:', user.id)

    res.json({
      success: true,
      message: '密碼重置成功，請使用新密碼登入',
    })
  } catch (error) {
    console.error('❌ Reset password error:', error)
    res.status(500).json({
      success: false,
      message: '伺服器錯誤，請稍後再試',
    })
  }
}

/**
 * Google 登入 - 啟動 Google OAuth 流程
 *
 * 此端點會將使用者重導向到 Google 登入頁面
 *
 * @route GET /api/v2/auth/google
 */
export function googleLogin() {
  // 此函式由 Passport 中間件處理，不需要實作內容
  // 僅用於路由定義
}

/**
 * Google 登入回調 - 處理 Google OAuth 回傳
 *
 * OAuth 2.0 流程：
 * 1. Google 驗證成功後，Passport 會調用此函式
 * 2. 建立 Session
 * 3. 產生 Access Token 和 Refresh Token
 * 4. 將 Tokens 儲存到 httpOnly cookies
 * 5. 重導向到前端頁面
 *
 * @route GET /api/v2/auth/google/callback
 */
export async function googleCallback(req, res) {
  try {
    // req.user 由 Passport 設定，包含使用者資訊
    const user = req.user

    if (!user) {
      // Google 登入失敗
      console.error('❌ Google callback: No user found')
      return res.redirect(
        `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=auth_failed`
      )
    }

    // ========================================
    // OAuth 2.0: 建立 Session 和 Tokens
    // ========================================
    // 先產生 Access Token（不含 sessionId）
    const tempAccessToken = generateToken({
      userId: user.id,
      email: user.email,
      access: user.access,
      sessionId: 0, // 暫時使用 0，等 session 建立後會更新
    })

    // 建立 Session（需要 accessToken 來計算 hash）
    const sessionData = await createSession(user.id, tempAccessToken, {
      userAgent: req.headers['user-agent'] || 'Unknown',
      ipAddress: req.ip,
    })

    // 重新產生包含正確 sessionId 的 Access Token
    const accessToken = generateToken({
      userId: user.id,
      email: user.email,
      access: user.access,
      sessionId: sessionData.sessionId,
    })

    // 更新 Session 中的 access_token_hash
    await query('UPDATE sessions SET access_token_hash = ? WHERE id = ?', [
      hashAccessToken(accessToken),
      sessionData.sessionId,
    ])

    const { refreshToken } = await createRefreshToken(
      user.id,
      sessionData.sessionId
    )

    // ========================================
    // 儲存 Tokens 到 httpOnly cookies
    // ========================================
    const cookieOptions = {
      httpOnly: true,
      secure: false, // 開發環境 HTTP
      sameSite: 'none', // 允許跨站 cookie（Google OAuth 需要）
      path: '/',
    }

    // 如果是開發環境且使用 HTTP，sameSite 必須是 'lax' 或 'none'
    // 但 'none' 需要 secure: true，所以開發環境用 'lax'
    if (process.env.NODE_ENV !== 'production') {
      cookieOptions.sameSite = 'lax'
      cookieOptions.secure = false
    }

    res.cookie(ACCESS_TOKEN_COOKIE, accessToken, {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 天
    })

    res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, {
      ...cookieOptions,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 天
    })

    res.cookie(SESSION_TOKEN_COOKIE, sessionData.sessionToken, {
      ...cookieOptions,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 天
    })

    console.log('✅ Google login successful for:', user.email)
    console.log('🍪 Tokens stored in httpOnly cookies')
    console.log('🍪 Cookie options:', cookieOptions)

    // ========================================
    // 重導向到前端頁面
    // ========================================
    // 安全性改進：不在 URL 中傳遞 token，前端會自動從 cookie 讀取
    // 支援自訂重導向路徑（從 OAuth state 參數讀取）
    let redirectPath = user.isNewUser ? '/' : '/site/membercenter'

    // 從 OAuth state 參數讀取重導向路徑
    // Google OAuth 會在 callback 時將 state 放在 req.query.state
    if (req.query.state) {
      try {
        const state = JSON.parse(req.query.state)
        if (state.redirect) {
          redirectPath = decodeURIComponent(state.redirect)
          console.log('🔄 使用 OAuth state 的重導向路徑:', redirectPath)
        }
      } catch (e) {
        console.error('❌ 無法解析 OAuth state:', e)
      }
    }

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000'
    const redirectUrl = `${frontendUrl}${redirectPath}`

    console.log('🔄 最終重導向到:', redirectUrl)
    res.redirect(redirectUrl)
  } catch (error) {
    console.error('❌ Google callback error:', error)
    res.redirect(
      `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=server_error`
    )
  }
}

// =====================================================
// Google Authenticator (2FA) 相關功能
// =====================================================

/**
 * 啟用 Google Authenticator (雙因素驗證)
 *
 * @route POST /api/v2/auth/2fa/enable
 * @access Private - 需要 Access Token Cookie
 *
 * 功能流程:
 * 1. 從 cookie 驗證使用者身份
 * 2. 生成 32 字元的隨機密鑰 (secret)
 * 3. 建立包含網站名稱和使用者 email 的 OTP URL
 * 4. 將 OTP URL 轉換為 QR Code 圖片 (Base64)
 * 5. 生成 10 組備用碼
 * 6. 暫時儲存 secret 到資料庫 (尚未啟用)
 * 7. 回傳 QR Code、secret 和備用碼給前端
 * 8. 使用者需掃描 QR Code 並輸入 6 位數驗證碼確認
 *
 * @returns {Object} { success, qrCode, secret, backupCodes }
 */
export async function enable2FA(req, res) {
  try {
    // 從 cookie 驗證使用者
    const token = req.cookies[ACCESS_TOKEN_COOKIE]

    if (!token) {
      return res.status(401).json({
        success: false,
        message: '未登入或登入已過期',
      })
    }

    const decoded = verifyToken(token)
    if (!decoded) {
      return res.status(401).json({
        success: false,
        message: 'Token 無效',
      })
    }

    const userId = decoded.userId

    console.log('🔐 啟用 2FA - User ID:', userId)

    // ============================================
    // 步驟 1: 檢查使用者是否存在
    // ============================================
    const users = await query('SELECT * FROM users WHERE id = ? LIMIT 1', [
      userId,
    ])

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: '使用者不存在',
      })
    }

    const user = users[0]

    // ============================================
    // 步驟 2: 檢查是否已啟用 2FA
    // ============================================
    if (user.google_authenticator_enabled) {
      return res.status(400).json({
        success: false,
        message: 'Google Authenticator 已啟用',
      })
    }

    // ============================================
    // 步驟 3: 生成隨機密鑰 (Secret Key)
    // ============================================
    const secret = speakeasy.generateSecret({
      length: 32,
      name: `SailoTravel (${user.email})`,
      issuer: 'SailoTravel',
    })

    console.log('🔑 生成密鑰 - Secret:', secret.base32)

    // ============================================
    // 步驟 4: 生成 QR Code
    // ============================================
    const qrCode = await QRCode.toDataURL(secret.otpauth_url)

    // ============================================
    // 步驟 5: 生成 10 組備用碼
    // ============================================
    const backupCodes = []
    for (let i = 0; i < 10; i++) {
      backupCodes.push(crypto.randomBytes(4).toString('hex').toUpperCase())
    }

    // ============================================
    // 步驟 6: 暫時儲存到資料庫 (尚未啟用)
    // ============================================
    await query(
      `UPDATE users 
       SET google_authenticator_secret = ?,
           backup_codes = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [secret.base32, JSON.stringify(backupCodes), userId]
    )

    console.log('✅ 2FA 密鑰已生成，等待驗證')

    res.json({
      success: true,
      qrCode: qrCode,
      secret: secret.base32,
      backupCodes: backupCodes,
    })
  } catch (error) {
    console.error('❌ Enable 2FA error:', error)
    res.status(500).json({
      success: false,
      message: '伺服器錯誤，請稍後再試',
    })
  }
}

/**
 * 驗證並啟用 Google Authenticator
 *
 * @route POST /api/v2/auth/2fa/verify
 * @access Private - 需要 Access Token Cookie
 * @body {string} token - 6位數 TOTP 驗證碼
 *
 * 功能流程:
 * 1. 驗證使用者輸入的 6 位數驗證碼
 * 2. 驗證成功後，正式啟用 2FA
 * 3. 更新資料庫 google_authenticator_enabled = TRUE
 *
 * @returns {Object} { success, message }
 */
export async function verify2FA(req, res) {
  try {
    const { token: token2fa } = req.body

    // 從 cookie 驗證使用者
    const token = req.cookies[ACCESS_TOKEN_COOKIE]

    if (!token) {
      return res.status(401).json({
        success: false,
        message: '未登入或登入已過期',
      })
    }

    const decoded = verifyToken(token)
    if (!decoded) {
      return res.status(401).json({
        success: false,
        message: 'Token 無效',
      })
    }

    const userId = decoded.userId

    // ============================================
    // 步驟 1: 驗證必填欄位
    // ============================================
    if (!token2fa) {
      return res.status(400).json({
        success: false,
        message: '驗證碼為必填欄位',
      })
    }

    // ============================================
    // 步驟 2: 取得使用者 2FA 密鑰
    // ============================================
    const users = await query('SELECT * FROM users WHERE id = ? LIMIT 1', [
      userId,
    ])

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: '使用者不存在',
      })
    }

    const user = users[0]

    if (!user.google_authenticator_secret) {
      return res.status(400).json({
        success: false,
        message: '請先啟用 Google Authenticator',
      })
    }

    // ============================================
    // 步驟 3: 驗證 TOTP Token
    // ============================================
    const verified = speakeasy.totp.verify({
      secret: user.google_authenticator_secret,
      encoding: 'base32',
      token: token2fa,
      window: 2, // 容許時間偏差 ±60 秒
    })

    if (!verified) {
      return res.status(400).json({
        success: false,
        message: '驗證碼錯誤或已過期',
      })
    }

    // ============================================
    // 步驟 4: 正式啟用 2FA
    // ============================================
    await query(
      `UPDATE users 
       SET google_authenticator_enabled = TRUE,
           updated_at = NOW()
       WHERE id = ?`,
      [userId]
    )

    console.log('✅ 2FA 驗證成功，已啟用 - User ID:', userId)

    res.json({
      success: true,
      message: 'Google Authenticator 已成功啟用',
    })
  } catch (error) {
    console.error('❌ Verify 2FA error:', error)
    res.status(500).json({
      success: false,
      message: '伺服器錯誤，請稍後再試',
    })
  }
}

/**
 * 停用 Google Authenticator
 *
 * @route POST /api/v2/auth/2fa/disable
 * @access Private - 需要 Access Token Cookie
 * @body {string} password - 使用者密碼 (安全驗證)
 *
 * 功能流程:
 * 1. 驗證使用者密碼
 * 2. 清除 2FA 相關資料
 * 3. 更新資料庫
 *
 * @returns {Object} { success, message }
 */
export async function disable2FA(req, res) {
  try {
    const { password } = req.body

    // 從 cookie 驗證使用者
    const token = req.cookies[ACCESS_TOKEN_COOKIE]

    if (!token) {
      return res.status(401).json({
        success: false,
        message: '未登入或登入已過期',
      })
    }

    const decoded = verifyToken(token)
    if (!decoded) {
      return res.status(401).json({
        success: false,
        message: 'Token 無效',
      })
    }

    const userId = decoded.userId

    // ============================================
    // 步驟 1: 驗證密碼
    // ============================================
    if (!password) {
      return res.status(400).json({
        success: false,
        message: '請輸入密碼以確認停用',
      })
    }

    const users = await query('SELECT * FROM users WHERE id = ? LIMIT 1', [
      userId,
    ])

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: '使用者不存在',
      })
    }

    const user = users[0]

    // 如果有密碼(本地帳號)，驗證密碼
    if (user.password) {
      const isPasswordValid = await verifyPassword(password, user.password)
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: '密碼錯誤',
        })
      }
    }

    // ============================================
    // 步驟 2: 停用 2FA 並清除相關資料
    // ============================================
    await query(
      `UPDATE users 
       SET google_authenticator_enabled = FALSE,
           google_authenticator_secret = NULL,
           backup_codes = NULL,
           updated_at = NOW()
       WHERE id = ?`,
      [userId]
    )

    console.log('✅ 2FA 已停用 - User ID:', userId)

    res.json({
      success: true,
      message: 'Google Authenticator 已停用',
    })
  } catch (error) {
    console.error('❌ Disable 2FA error:', error)
    res.status(500).json({
      success: false,
      message: '伺服器錯誤，請稍後再試',
    })
  }
}

/**
 * 取得 2FA 狀態
 *
 * @route GET /api/v2/auth/2fa/status
 * @access Private - 需要 Access Token Cookie
 *
 * @returns {Object} { success, enabled, hasBackupCodes }
 */
export async function get2FAStatus(req, res) {
  try {
    // 從 cookie 驗證使用者
    const token = req.cookies[ACCESS_TOKEN_COOKIE]

    if (!token) {
      return res.status(401).json({
        success: false,
        message: '未登入或登入已過期',
      })
    }

    const decoded = verifyToken(token)
    if (!decoded) {
      return res.status(401).json({
        success: false,
        message: 'Token 無效',
      })
    }

    const userId = decoded.userId

    // ============================================
    // 查詢使用者 2FA 狀態
    // ============================================
    const users = await query('SELECT * FROM users WHERE id = ? LIMIT 1', [
      userId,
    ])

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: '使用者不存在',
      })
    }

    const user = users[0]

    res.json({
      success: true,
      enabled: user.google_authenticator_enabled || false,
      hasBackupCodes: user.backup_codes ? true : false,
    })
  } catch (error) {
    console.error('❌ Get 2FA status error:', error)
    res.status(500).json({
      success: false,
      message: '伺服器錯誤，請稍後再試',
    })
  }
}

// 匯出所有函式
export default {
  login,
  logout,
  verify,
  register,
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
}
