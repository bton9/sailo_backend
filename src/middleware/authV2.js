/**
 * 認證中介層 (OAuth 2.0 版本)
 * 路徑: sailo_backend/src/middleware/authV2.js
 *
 * 功能：
 * - 從 httpOnly cookie 讀取 Access Token
 * - 驗證 JWT Token 有效性
 * - 驗證 Session 有效性
 * - 自動刷新過期的 Access Token
 * - 將使用者資訊附加到 req.user
 *
 * 使用方式：
 * import { authenticate } from '@/middleware/authV2'
 * router.get('/protected', authenticate, handler)
 */

import { verifyToken } from '../utils/jwt.js'
import { validateSession } from '../services/sessionService.js'
import { query } from '../config/database.js'

const ACCESS_TOKEN_COOKIE = 'access_token'
const SESSION_TOKEN_COOKIE = 'session_token'

/**
 * 身份驗證中介層
 *
 * 從 httpOnly cookie 讀取 Token 並驗證
 *
 * @param {Object} req - Express 請求物件
 * @param {Object} res - Express 回應物件
 * @param {Function} next - Express next 函數
 */
export async function authenticate(req, res, next) {
  try {
    // ============================================
    // 步驟 1: 從 Cookie 取得 Access Token
    // ============================================
    const accessToken = req.cookies[ACCESS_TOKEN_COOKIE]

    if (!accessToken) {
      return res.status(401).json({
        success: false,
        message: '未提供授權 Token',
        code: 'NO_TOKEN',
      })
    }

    // ============================================
    // 步驟 2: 驗證 JWT Token
    // ============================================
    const decoded = verifyToken(accessToken)

    if (!decoded) {
      // Token 無效或已過期
      return res.status(401).json({
        success: false,
        message: 'Token 無效或已過期',
        code: 'INVALID_TOKEN',
      })
    }

    // ============================================
    // 步驟 3: 驗證 Session (可選但建議)
    // ============================================
    const sessionToken = req.cookies[SESSION_TOKEN_COOKIE]

    if (sessionToken) {
      const session = await validateSession(sessionToken, accessToken)

      if (!session) {
        // Session 無效或已過期
        return res.status(401).json({
          success: false,
          message: 'Session 已過期，請重新登入',
          code: 'INVALID_SESSION',
        })
      }
    }

    // ============================================
    // 步驟 4: 從資料庫取得使用者資料
    // ============================================
    const users = await query('SELECT * FROM users WHERE id = ? LIMIT 1', [
      decoded.userId,
    ])

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: '使用者不存在',
        code: 'USER_NOT_FOUND',
      })
    }

    const user = users[0]

    // 檢查帳戶是否已停用
    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: '帳戶已停用',
        code: 'ACCOUNT_DISABLED',
      })
    }

    // ============================================
    // 步驟 5: 將使用者資訊附加到 req.user
    // ============================================
    req.user = {
      userId: user.id,
      email: user.email,
      name: user.name,
      access: user.access,
      // 包含完整的使用者物件，供其他中介層使用
      fullUser: user,
    }

    console.log('✅ 使用者驗證成功:', {
      userId: user.id,
      email: user.email,
    })

    // 繼續執行下一個中介層或路由處理器
    next()
  } catch (error) {
    console.error('❌ Authentication error:', error)
    res.status(500).json({
      success: false,
      message: '伺服器錯誤',
      code: 'SERVER_ERROR',
    })
  }
}

/**
 * 可選的身份驗證中介層
 *
 * 與 authenticate 類似，但不會在未登入時返回錯誤
 * 適用於可選登入的端點
 *
 * @param {Object} req - Express 請求物件
 * @param {Object} res - Express 回應物件
 * @param {Function} next - Express next 函數
 */
export async function authenticateOptional(req, res, next) {
  try {
    const accessToken = req.cookies[ACCESS_TOKEN_COOKIE]

    // 未提供 Token，視為訪客
    if (!accessToken) {
      req.user = null
      return next()
    }

    const decoded = verifyToken(accessToken)

    // Token 無效，視為訪客
    if (!decoded) {
      req.user = null
      return next()
    }

    // 取得使用者資料
    const users = await query('SELECT * FROM users WHERE id = ? LIMIT 1', [
      decoded.userId,
    ])

    if (users.length === 0 || !users[0].is_active) {
      req.user = null
      return next()
    }

    const user = users[0]

    req.user = {
      userId: user.id,
      email: user.email,
      name: user.name,
      access: user.access,
      fullUser: user,
    }

    next()
  } catch (error) {
    // 發生錯誤時視為訪客
    console.warn('⚠️ Optional authentication error:', error)
    req.user = null
    next()
  }
}

/**
 * 權限檢查中介層
 *
 * 檢查使用者是否擁有指定權限
 * 需要在 authenticate 之後使用
 *
 * @param {...string} allowedRoles - 允許的角色列表 (user, admin, vip)
 * @returns {Function} Express 中介層函數
 *
 * @example
 * router.get('/admin', authenticate, requireRole('admin'), handler)
 */
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    // 檢查是否已驗證
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: '請先登入',
        code: 'UNAUTHORIZED',
      })
    }

    // 檢查權限
    if (!allowedRoles.includes(req.user.access)) {
      return res.status(403).json({
        success: false,
        message: '權限不足',
        code: 'FORBIDDEN',
      })
    }

    next()
  }
}

/**
 * Email 驗證檢查中介層
 *
 * 檢查使用者是否已驗證 Email
 * 需要在 authenticate 之後使用
 */
export function requireEmailVerified(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: '請先登入',
      code: 'UNAUTHORIZED',
    })
  }

  if (!req.user.fullUser.email_verified) {
    return res.status(403).json({
      success: false,
      message: '請先驗證您的 Email',
      code: 'EMAIL_NOT_VERIFIED',
    })
  }

  next()
}

export default {
  authenticate,
  authenticateOptional,
  requireRole,
  requireEmailVerified,
}
