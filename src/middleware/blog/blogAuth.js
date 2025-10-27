// Blog 專用的 auth middleware
// 🔐 Auth V2: 使用 httpOnly cookies
import { verifyToken } from '../../utils/jwt.js'

export const blogAuthMiddleware = (req, res, next) => {
  try {
    // 🔐 Auth V2: 從 httpOnly cookie 取得 access_token
    const token = req.cookies?.access_token

    if (!token) {
      return res.status(401).json({
        success: false,
        message: '請先登入',
      })
    }

    // 驗證 token (使用現有的 verifyToken)
    const decoded = verifyToken(token)

    if (!decoded) {
      return res.status(401).json({
        success: false,
        message: 'Token 無效或已過期',
      })
    }

    // 將使用者資訊存入 req.user
    req.user = {
      id: decoded.userId,
      email: decoded.email,
      access: decoded.access,
    }

    next()
  } catch (error) {
    console.error('Blog auth middleware error:', error)
    return res.status(401).json({
      success: false,
      message: 'Token 驗證失敗',
    })
  }
}

// 也 export default
export default blogAuthMiddleware

/**
 * 可選登入的 middleware
 * 🔐 Auth V2: 從 httpOnly cookie 讀取
 * - 有 token：驗證並設置 req.user
 * - 沒有 token：不報錯，req.user = undefined
 */
export const optionalAuth = (req, res, next) => {
  try {
    // 🔐 Auth V2: 從 httpOnly cookie 取得 access_token
    const token = req.cookies?.access_token

    if (!token) {
      req.user = undefined
      return next()
    }

    const decoded = verifyToken(token)

    if (decoded) {
      req.user = {
        id: decoded.userId,
        email: decoded.email,
        access: decoded.access,
      }
    } else {
      req.user = undefined
    }

    next()
  } catch (error) {
    console.warn('Optional auth warning:', error.message)
    req.user = undefined
    next()
  }
}
