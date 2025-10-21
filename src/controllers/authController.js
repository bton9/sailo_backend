import { query } from '../config/database.js'
import { hashPassword, verifyPassword } from '../utils/password.js'
import { generateToken, verifyToken } from '../utils/jwt.js'
import { sendPasswordResetEmail } from '../utils/email.js'
import crypto from 'crypto'

/**
 * 登入
 */
export async function login(req, res) {
  try {
    const { email, password } = req.body

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

    // 產生 JWT Token
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
    // 步驟 5: 建立新使用者
    // ============================================
    const result = await query(
      `INSERT INTO users (email, password, name, nickname, phone, access, is_active, email_verified) 
       VALUES (?, ?, ?, ?, ?, 'user', TRUE, FALSE)`,
      [email, hashedPassword, defaultName, nickname || null, phone || null]
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
