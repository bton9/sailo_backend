import { query } from '../config/database.js'
import { hashPassword, verifyPassword } from '../utils/password.js'
import { generateToken, verifyToken } from '../utils/jwt.js'

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
 * 註冊
 */
export async function register(req, res) {
  try {
    const { email, password, name, phone, nickname } = req.body

    // 驗證必填欄位
    if (!email || !password || !name) {
      return res.status(400).json({
        success: false,
        message: 'Email、密碼與姓名為必填欄位',
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

    // 加密密碼
    const hashedPassword = await hashPassword(password)

    // 建立新使用者
    const result = await query(
      `INSERT INTO users (email, password, name, nickname, phone, access, is_active, email_verified) 
       VALUES (?, ?, ?, ?, ?, 'user', TRUE, FALSE)`,
      [email, hashedPassword, name, nickname || null, phone || null]
    )

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
 * 驗證 Token
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

    const decoded = verifyToken(token)

    if (!decoded) {
      return res.status(401).json({
        valid: false,
        message: 'Token 無效',
      })
    }

    res.json({
      valid: true,
      user: decoded,
    })
  } catch (error) {
    res.status(401).json({
      valid: false,
      message: 'Token 驗證失敗',
    })
  }
}
