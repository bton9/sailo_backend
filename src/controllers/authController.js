import { query } from '../config/database.js'
import { hashPassword, verifyPassword } from '../utils/password.js'
import { generateToken, verifyToken } from '../utils/jwt.js'
import { sendPasswordResetEmail } from '../utils/email.js'
import crypto from 'crypto'
import speakeasy from 'speakeasy'
import QRCode from 'qrcode'

/**
 * 登入
 *
 * @route POST /api/auth/login
 * @body {string} email - Email 帳號
 * @body {string} password - 密碼
 * @body {string} token2fa - (選填) 6位數 Google Authenticator 驗證碼
 *
 * 登入流程:
 * 1. 驗證 email 和密碼
 * 2. 檢查是否啟用 2FA
 * 3. 如果啟用 2FA 且未提供 token2fa,回傳 requires2FA: true
 * 4. 如果啟用 2FA 且提供 token2fa,驗證 token
 * 5. 驗證通過後產生 JWT Token 並回傳
 */
export async function login(req, res) {
  try {
    const { email, password, token2fa } = req.body

    // 驗證必填欄位
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email 和密碼為必填欄位',
      })
    }

    // 查詢使用者
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

    // 驗證密碼
    const isPasswordValid = await verifyPassword(password, user.password)

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Email 或密碼錯誤',
      })
    }

    // ============================================
    // Google Authenticator (2FA) 驗證
    // ============================================
    /**
     * 如果使用者啟用了 2FA:
     * 1. 檢查是否提供 token2fa
     * 2. 如果沒有提供,回傳 requires2FA: true (前端顯示驗證碼輸入框)
     * 3. 如果有提供,驗證 token 是否正確
     */
    if (user.google_authenticator_enabled) {
      console.log('🔐 使用者已啟用 2FA,需要驗證')

      // 如果沒有提供 2FA token,要求輸入
      if (!token2fa) {
        return res.status(200).json({
          success: false,
          requires2FA: true,
          message: '請輸入 Google Authenticator 驗證碼',
          // 不回傳 token 和 user,等驗證通過後再給
        })
      }

      // 驗證 2FA token
      const verified = speakeasy.totp.verify({
        secret: user.google_authenticator_secret,
        encoding: 'base32',
        token: token2fa,
        window: 2, // 允許前後 2 個時間窗口
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
    // 產生 JWT Token
    // ============================================
    const token = generateToken({
      userId: user.id,
      email: user.email,
      access: user.access,
    })

    // 準備回傳的使用者資料 (不包含密碼)
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
      success: true,
      message: '登入成功',
      token,
      user: userData,
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
 * 註冊新帳號
 *
 * @route POST /api/auth/register
 * @body {string} email - Email 帳號 (必填)
 * @body {string} password - 密碼 (必填)
 * @body {string} nickname - 暱稱 (選填)
 * @body {string} phone - 手機號碼 (選填)
 *
 * 更新說明：
 * - 移除 name 欄位必填要求
 * - name 將自動使用 nickname 或 email 前綴作為預設值
 */
export async function register(req, res) {
  try {
    const { email, password, nickname, phone } = req.body

    // ============================================
    // 步驟 1: 驗證必填欄位 (僅 email 和 password)
    // ============================================
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email 與密碼為必填欄位',
      })
    }

    // ============================================
    // 步驟 2: 檢查 Email 是否已註冊
    // ============================================
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

    // ============================================
    // 步驟 3: 產生預設姓名
    // ============================================
    // 優先順序：nickname > email 前綴
    let defaultName = nickname || email.split('@')[0]

    console.log('📝 註冊新使用者:', {
      email,
      nickname: nickname || '(未填寫)',
      defaultName,
    })

    // ============================================
    // 步驟 4: 加密密碼
    // ============================================
    const hashedPassword = await hashPassword(password)

    // ============================================
    // 步驟 5: 設定預設頭像 (ImageKit CDN)
    // ============================================
    /**
     * 使用 ImageKit 上的預設頭像
     *
     * ImageKit URL 結構:
     * https://ik.imagekit.io/{imagekit_id}/avatars/avatarxxx01.png?updatedAt={timestamp}
     *
     * 優點:
     * - 使用 CDN 加速，全球快速載入
     * - 統一使用 ImageKit 管理所有圖片資源
     * - 支援即時圖片轉換和優化
     * - 預設頭像永久可用，不會過期
     *
     * 注意:
     * - 此 URL 為系統預設頭像，所有新用戶共用
     * - 用戶可在註冊後透過個人資料頁面上傳自訂頭像
     * - 確保 ImageKit 中存在此預設頭像檔案
     */
    const defaultAvatar =
      'https://ik.imagekit.io/crjen7iza/avatars/avatarxxx01.png?updatedAt=1761200375843'

    // ============================================
    // 步驟 6: 建立新使用者
    // ============================================
    /**
     * 在 users 表中插入新用戶資料
     *
     * 欄位說明:
     * - email: 使用者登入帳號 (必填)
     * - password: bcrypt 加密後的密碼 (必填)
     * - name: 使用者姓名，使用 nickname 或 email 前綴作為預設值
     * - nickname: 使用者暱稱 (選填)
     * - phone: 手機號碼 (選填)
     * - avatar: 頭像 URL，使用 ImageKit 預設頭像 (新增)
     * - access: 權限等級，預設為 'user'
     * - is_active: 帳戶狀態，預設為 TRUE (啟用)
     * - email_verified: Email 驗證狀態，預設為 FALSE (未驗證)
     */
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
    console.log('🖼️ 預設頭像已設定:', defaultAvatar)

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
 * 登出
 */
export async function logout(req, res) {
  res.json({
    success: true,
    message: '登出成功',
  })
}

/**
 * 驗證 Token 並取得使用者資料
 *
 * 改進：從資料庫取得完整的使用者資料，而非僅返回 JWT 中的資訊
 *
 * @route POST /api/auth/verify
 * @header {string} Authorization - Bearer Token
 */
export async function verify(req, res) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '')

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

    // ========================================
    // 從資料庫取得完整使用者資料
    // ========================================
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

    // 檢查帳戶是否已停用
    if (!user.is_active) {
      return res.status(403).json({
        valid: false,
        message: '帳戶已停用',
      })
    }

    // 準備回傳的使用者資料 (不包含密碼等敏感資訊)
    const userData = {
      id: user.id,
      email: user.email,
      name: user.name,
      nickname: user.nickname,
      phone: user.phone,
      avatar: user.avatar,
      access: user.access,
      email_verified: user.email_verified,
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
 * 忘記密碼 - 發送重置密碼郵件
 *
 * 流程：
 * 1. 驗證使用者 Email 是否存在
 * 2. 產生隨機重置 Token (32 bytes hex)
 * 3. 儲存 Token 到資料庫 (有效期 1 小時)
 * 4. 發送密碼重置郵件給使用者
 *
 * @route POST /api/auth/forgot-password
 * @body {string} email - 使用者信箱
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
      console.log('⚠️ Password reset requested for non-existent email:', email)
      return res.json({
        success: true,
        message: '如果該 Email 存在，我們已發送密碼重置郵件',
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
    // 步驟 3: 產生安全的重置 Token
    // ========================================
    // 使用 crypto.randomBytes 產生 32 bytes 隨機資料，轉為 hex 字串
    const resetToken = crypto.randomBytes(32).toString('hex')

    // Token 有效期限：1 小時
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 當前時間 + 1 小時

    // ========================================
    // 步驟 4: 將 Token 儲存到資料庫
    // ========================================
    await query(
      `INSERT INTO password_resets (email, token, expires_at, used) 
       VALUES (?, ?, ?, FALSE)`,
      [email, resetToken, expiresAt]
    )

    console.log('✅ Password reset token created for:', email)

    // ========================================
    // 步驟 5: 發送密碼重置郵件
    // ========================================
    const emailSent = await sendPasswordResetEmail(email, resetToken, user.name)

    if (!emailSent) {
      console.error('❌ Failed to send password reset email to:', email)
      return res.status(500).json({
        success: false,
        message: '郵件發送失敗，請稍後再試',
      })
    }

    res.json({
      success: true,
      message: '密碼重置郵件已發送，請檢查您的信箱',
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
 * 重置密碼 - 驗證 Token 並更新密碼
 *
 * 流程：
 * 1. 驗證 Token 是否有效且未過期
 * 2. 驗證新密碼格式
 * 3. 更新使用者密碼
 * 4. 標記 Token 為已使用
 *
 * @route POST /api/auth/reset-password
 * @body {string} token - 重置 Token
 * @body {string} newPassword - 新密碼
 */
export async function resetPassword(req, res) {
  try {
    const { token, newPassword } = req.body

    // ========================================
    // 步驟 1: 驗證必填欄位
    // ========================================
    if (!token || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Token 與新密碼為必填欄位',
      })
    }

    // 驗證密碼長度
    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: '密碼至少需要 8 個字元',
      })
    }

    // ========================================
    // 步驟 2: 查詢 Token 是否存在
    // ========================================
    const tokens = await query(
      'SELECT * FROM password_resets WHERE token = ? LIMIT 1',
      [token]
    )

    if (tokens.length === 0) {
      return res.status(400).json({
        success: false,
        message: '無效的重置連結',
      })
    }

    const resetRecord = tokens[0]

    // ========================================
    // 步驟 3: 驗證 Token 狀態
    // ========================================
    // 檢查 Token 是否已被使用
    if (resetRecord.used) {
      return res.status(400).json({
        success: false,
        message: '此重置連結已被使用過',
      })
    }

    // 檢查 Token 是否已過期
    const now = new Date()
    const expiresAt = new Date(resetRecord.expires_at)

    if (now > expiresAt) {
      return res.status(400).json({
        success: false,
        message: '重置連結已過期，請重新申請',
      })
    }

    // ========================================
    // 步驟 4: 查詢使用者並更新密碼
    // ========================================
    const users = await query('SELECT * FROM users WHERE email = ? LIMIT 1', [
      resetRecord.email,
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
    // 步驟 5: 標記 Token 為已使用
    // ========================================
    await query('UPDATE password_resets SET used = TRUE WHERE token = ?', [
      token,
    ])

    console.log('✅ Password reset successful for:', user.email)

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
 * @route GET /api/auth/google
 */
export function googleLogin() {
  // 此函式由 Passport 中間件處理，不需要實作內容
  // 僅用於路由定義
}

/**
 * Google 登入回調 - 處理 Google OAuth 回傳
 *
 * 流程：
 * 1. Google 驗證成功後，Passport 會調用此函式
 * 2. 產生 JWT Token
 * 3. 重導向到前端頁面，並帶上 Token
 *
 * @route GET /api/auth/google/callback
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
    // 產生 JWT Token
    // ========================================
    const token = generateToken({
      userId: user.id,
      email: user.email,
      access: user.access,
    })

    console.log('✅ Google login successful for:', user.email)

    // ========================================
    // 重導向到前端頁面 (僅傳遞 Token)
    // ========================================
    // 安全性考量：
    // 1. 僅在 URL 中傳遞 JWT Token
    // 2. 不在 URL 中暴露使用者詳細資訊
    // 3. 前端收到 Token 後，透過 /api/auth/verify 取得使用者資料
    const redirectUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/callback?token=${token}`

    res.redirect(redirectUrl)
  } catch (error) {
    console.error('❌ Google callback error:', error)
    res.redirect(
      `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=server_error`
    )
  }
}

/**
 * Google 登出 - 清除 Passport Session
 *
 * @route POST /api/auth/google/logout
 */
export function googleLogout(req, res) {
  // 登出 Passport session
  req.logout((err) => {
    if (err) {
      console.error('❌ Google logout error:', err)
      return res.status(500).json({
        success: false,
        message: '登出失敗',
      })
    }

    res.json({
      success: true,
      message: 'Google 登出成功',
    })
  })
}

// =====================================================
// Google Authenticator (2FA) 相關功能
// =====================================================

/**
 * 啟用 Google Authenticator (雙因素驗證)
 *
 * @route POST /api/auth/2fa/enable
 * @access Private - 需要 JWT Token
 *
 * 功能流程:
 * 1. 生成 32 字元的隨機密鑰 (secret)
 * 2. 建立包含網站名稱和使用者 email 的 OTP URL
 * 3. 將 OTP URL 轉換為 QR Code 圖片 (Base64)
 * 4. 暫時儲存 secret 到資料庫 (尚未啟用)
 * 5. 回傳 QR Code 和 secret 給前端
 * 6. 使用者需掃描 QR Code 並輸入 6 位數驗證碼確認
 *
 * @returns {Object} { success, qrCode, secret, backupCodes }
 */
export async function enable2FA(req, res) {
  try {
    const userId = req.user.userId // 從 JWT middleware 取得使用者 ID

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
    /**
     * Speakeasy 生成密鑰說明:
     * - length: 32 字元 (推薦長度,安全性高)
     * - encoding: base32 (Google Authenticator 標準編碼)
     */
    const secret = speakeasy.generateSecret({
      length: 32,
      name: `SailoTravel (${user.email})`, // 顯示在 Google Authenticator App 中
      issuer: 'SailoTravel', // 發行者名稱
    })

    console.log('🔑 生成密鑰 - Secret:', secret.base32)

    // ============================================
    // 步驟 4: 生成 OTP Auth URL
    // ============================================
    /**
     * OTP URL 格式:
     * otpauth://totp/SailoTravel:user@example.com?secret=ABC123&issuer=SailoTravel
     *
     * 參數說明:
     * - totp: Time-based One-Time Password
     * - SailoTravel:user@example.com: 帳戶標識
     * - secret: 密鑰 (Base32 編碼)
     * - issuer: 發行者 (顯示在 App 中)
     */
    const otpauthUrl = secret.otpauth_url

    // ============================================
    // 步驟 5: 生成 QR Code (Base64 圖片)
    // ============================================
    /**
     * QRCode.toDataURL() 說明:
     * - 將 OTP URL 轉換為 QR Code 圖片
     * - 回傳 Base64 格式 (data:image/png;base64,...)
     * - 可直接放在 <img src="..." /> 中顯示
     */
    const qrCodeDataURL = await QRCode.toDataURL(otpauthUrl)

    // ============================================
    // 步驟 6: 生成 10 組備用碼
    // ============================================
    /**
     * 備用碼用途:
     * - 當使用者遺失裝置或無法使用 Authenticator 時
     * - 每組 8 位數字母數字組合
     * - 使用後即失效,不可重複使用
     */
    const backupCodes = Array.from({ length: 10 }, () =>
      crypto.randomBytes(4).toString('hex').toUpperCase()
    )

    console.log('🔢 生成備用碼:', backupCodes)

    // ============================================
    // 步驟 7: 儲存到資料庫 (尚未啟用)
    // ============================================
    /**
     * 注意:
     * - google_authenticator_enabled 保持 FALSE
     * - 使用者需驗證成功後才設為 TRUE
     * - backup_codes 儲存為 JSON 格式
     */
    await query(
      `UPDATE users 
       SET google_authenticator_secret = ?,
           backup_codes = ?
       WHERE id = ?`,
      [secret.base32, JSON.stringify(backupCodes), userId]
    )

    console.log('✅ 2FA 設定已儲存 (尚未啟用)')

    // ============================================
    // 步驟 8: 回傳給前端
    // ============================================
    res.json({
      success: true,
      message: '請掃描 QR Code 並輸入驗證碼',
      qrCode: qrCodeDataURL, // Base64 QR Code 圖片
      secret: secret.base32, // 手動輸入用的密鑰
      backupCodes, // 備用碼 (請妥善保存)
    })
  } catch (error) {
    console.error('❌ 啟用 2FA 失敗:', error)
    res.status(500).json({
      success: false,
      message: '伺服器錯誤，請稍後再試',
    })
  }
}

/**
 * 驗證並確認啟用 Google Authenticator
 *
 * @route POST /api/auth/2fa/verify
 * @access Private - 需要 JWT Token
 * @body {string} token - 6 位數驗證碼
 *
 * 功能流程:
 * 1. 取得使用者的 secret
 * 2. 使用 speakeasy 驗證 6 位數驗證碼
 * 3. 驗證成功後,將 google_authenticator_enabled 設為 TRUE
 *
 * @returns {Object} { success, message }
 */
export async function verify2FA(req, res) {
  try {
    const userId = req.user.userId
    const { token } = req.body

    console.log('🔐 驗證 2FA Token - User ID:', userId)

    // ============================================
    // 步驟 1: 驗證必填欄位
    // ============================================
    if (!token) {
      return res.status(400).json({
        success: false,
        message: '驗證碼為必填欄位',
      })
    }

    // ============================================
    // 步驟 2: 查詢使用者 secret
    // ============================================
    const users = await query(
      'SELECT google_authenticator_secret FROM users WHERE id = ? LIMIT 1',
      [userId]
    )

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
        message: '尚未設定 Google Authenticator',
      })
    }

    // ============================================
    // 步驟 3: 驗證 6 位數驗證碼
    // ============================================
    /**
     * Speakeasy 驗證說明:
     * - secret: 之前生成的密鑰
     * - token: 使用者輸入的 6 位數驗證碼
     * - encoding: base32 (必須與生成時相同)
     * - window: 允許時間窗口 (預設 1 = 前後各 30 秒)
     *
     * 回傳:
     * - true: 驗證成功
     * - false: 驗證失敗 (碼錯誤或過期)
     */
    const verified = speakeasy.totp.verify({
      secret: user.google_authenticator_secret,
      encoding: 'base32',
      token: token,
      window: 2, // 允許前後 2 個時間窗口 (約 60 秒容錯)
    })

    if (!verified) {
      console.log('❌ 驗證碼錯誤或已過期')
      return res.status(400).json({
        success: false,
        message: '驗證碼錯誤或已過期',
      })
    }

    // ============================================
    // 步驟 4: 啟用 2FA
    // ============================================
    await query(
      'UPDATE users SET google_authenticator_enabled = TRUE WHERE id = ?',
      [userId]
    )

    console.log('✅ 2FA 已成功啟用')

    res.json({
      success: true,
      message: 'Google Authenticator 已成功啟用',
    })
  } catch (error) {
    console.error('❌ 驗證 2FA 失敗:', error)
    res.status(500).json({
      success: false,
      message: '伺服器錯誤，請稍後再試',
    })
  }
}

/**
 * 停用 Google Authenticator
 *
 * @route POST /api/auth/2fa/disable
 * @access Private - 需要 JWT Token
 * @body {string} password - 使用者密碼 (安全驗證)
 *
 * 功能流程:
 * 1. 驗證使用者密碼
 * 2. 清除 secret 和 backup_codes
 * 3. 將 google_authenticator_enabled 設為 FALSE
 *
 * @returns {Object} { success, message }
 */
export async function disable2FA(req, res) {
  try {
    const userId = req.user.userId
    const { password } = req.body

    console.log('🔓 停用 2FA - User ID:', userId)

    // ============================================
    // 步驟 1: 驗證密碼
    // ============================================
    if (!password) {
      return res.status(400).json({
        success: false,
        message: '請輸入密碼以確認身分',
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

    // 驗證密碼
    const isPasswordValid = await verifyPassword(password, user.password)

    if (!isPasswordValid) {
      console.log('❌ 密碼錯誤')
      return res.status(401).json({
        success: false,
        message: '密碼錯誤',
      })
    }

    // ============================================
    // 步驟 2: 停用 2FA 並清除資料
    // ============================================
    await query(
      `UPDATE users 
       SET google_authenticator_secret = NULL,
           google_authenticator_enabled = FALSE,
           backup_codes = NULL
       WHERE id = ?`,
      [userId]
    )

    console.log('✅ 2FA 已停用')

    res.json({
      success: true,
      message: 'Google Authenticator 已停用',
    })
  } catch (error) {
    console.error('❌ 停用 2FA 失敗:', error)
    res.status(500).json({
      success: false,
      message: '伺服器錯誤，請稍後再試',
    })
  }
}

/**
 * 取得 2FA 狀態
 *
 * @route GET /api/auth/2fa/status
 * @access Private - 需要 JWT Token
 *
 * @returns {Object} { success, enabled, hasBackupCodes }
 */
export async function get2FAStatus(req, res) {
  try {
    const userId = req.user.userId

    const users = await query(
      'SELECT google_authenticator_enabled, backup_codes FROM users WHERE id = ? LIMIT 1',
      [userId]
    )

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: '使用者不存在',
      })
    }

    const user = users[0]

    res.json({
      success: true,
      enabled: user.google_authenticator_enabled === 1,
      hasBackupCodes: user.backup_codes !== null,
    })
  } catch (error) {
    console.error('❌ 取得 2FA 狀態失敗:', error)
    res.status(500).json({
      success: false,
      message: '伺服器錯誤，請稍後再試',
    })
  }
}
