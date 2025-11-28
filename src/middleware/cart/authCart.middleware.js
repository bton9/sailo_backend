/**
 * 購物車模組認證中介層
 * 檔案路徑: backend/src/middleware/cart/authCart.middleware.js
 *
 * 功能：整合 Auth V2 的 httpOnly cookie JWT 認證系統
 *
 * Auth V2 規範：
 * - 使用 httpOnly cookies (不使用 localStorage)
 * - Cookie 名稱: access_token
 * - JWT Payload 結構: { userId, email, access, iss, iat, exp }
 */

import { verifyToken } from '../../utils/jwt.js'

/**
 * 檢查用戶是否登入（必須登入才能訪問）
 *
 * Auth V2: 從 httpOnly cookie 讀取 JWT
 */
export const requireAuth = (req, res, next) => {
  try {
    // 🔐 Auth V2: 從 httpOnly cookie 取得 access_token
    const token = req.cookies?.access_token

    if (!token) {
      return res.status(401).json({
        success: false,
        message: '請先登入',
        code: 'UNAUTHORIZED',
      })
    }

    // 驗證 Token
    const decoded = verifyToken(token)

    if (!decoded) {
      return res.status(401).json({
        success: false,
        message: 'Token 無效或已過期',
        code: 'TOKEN_INVALID',
      })
    }

    // 將使用者資訊附加到請求物件
    req.user = decoded
    req.userId = decoded.userId // 方便後續使用

    next()
  } catch (error) {
    console.error(' Authentication error:', error)
    return res.status(401).json({
      success: false,
      message: '身份驗證失敗',
      code: 'AUTH_ERROR',
    })
  }
}

/**
 * 可選的認證（允許訪客和登入用戶）
 *
 * Auth V2: 如果有 cookie 就驗證，沒有也不會報錯
 */
export const optionalAuth = (req, res, next) => {
  try {
    // 🔐 Auth V2: 從 httpOnly cookie 取得 access_token
    const token = req.cookies?.access_token

    if (token) {
      const decoded = verifyToken(token)

      if (decoded) {
        req.user = decoded
        req.userId = decoded.userId
      }
    }

    // 無論有沒有 token 都繼續
    next()
  } catch (error) {
    // 即使驗證失敗也繼續，因為這是可選的
    console.warn('⚠️ Optional auth failed:', error.message)
    next()
  }
}

/**
 * 檢查用戶是否為管理員
 */
export const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: '請先登入',
      code: 'UNAUTHORIZED',
    })
  }

  if (req.user.access !== 'admin') {
    return res.status(403).json({
      success: false,
      message: '權限不足，需要管理員權限',
      code: 'FORBIDDEN',
    })
  }

  next()
}

/**
 * 驗證用戶是否擁有該購物車
 *
 * 檢查 req.user.userId 是否與請求的 userId 匹配
 */
export const validateCartOwnership = (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: '請先登入',
        code: 'UNAUTHORIZED',
      })
    }

    const requestedUserId = parseInt(
      req.params.userId || req.body.userId || req.query.userId
    )

    // 檢查是否為本人或管理員
    if (req.user.userId !== requestedUserId && req.user.access !== 'admin') {
      return res.status(403).json({
        success: false,
        message: '無權限存取此購物車',
        code: 'FORBIDDEN',
      })
    }

    next()
  } catch (error) {
    console.error(' Ownership validation error:', error)
    return res.status(500).json({
      success: false,
      message: '驗證失敗',
      error: error.message,
    })
  }
}

/**
 * API Rate Limiting（簡單實作）
 *
 * 使用 Map 記錄每個 IP 的請求次數
 */
const requestCounts = new Map()

export const rateLimiter = (maxRequests = 100, windowMs = 60000) => {
  return (req, res, next) => {
    const identifier = req.ip || req.connection.remoteAddress

    if (!identifier) {
      return next()
    }

    const now = Date.now()

    if (!requestCounts.has(identifier)) {
      requestCounts.set(identifier, { count: 1, resetTime: now + windowMs })
      return next()
    }

    const record = requestCounts.get(identifier)

    if (now > record.resetTime) {
      record.count = 1
      record.resetTime = now + windowMs
      return next()
    }

    if (record.count >= maxRequests) {
      return res.status(429).json({
        success: false,
        message: '請求過於頻繁，請稍後再試',
        code: 'TOO_MANY_REQUESTS',
      })
    }

    record.count++
    next()
  }
}

/**
 * 清理過期的 rate limit 記錄（每小時執行一次）
 */
setInterval(() => {
  const now = Date.now()
  for (const [identifier, record] of requestCounts.entries()) {
    if (now > record.resetTime) {
      requestCounts.delete(identifier)
    }
  }
}, 3600000) // 1小時

export default {
  requireAuth,
  optionalAuth,
  requireAdmin,
  validateCartOwnership,
  rateLimiter,
}
