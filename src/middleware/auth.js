/**
 * Authentication Middleware
 * 路徑: sailo_backend/src/middleware/auth.js
 *
 * 功能：驗證 JWT Token，保護需要身份驗證的路由
 *
 * 使用方式：
 * import { authenticate } from '../middleware/auth.js'
 * router.put('/update-profile', authenticate, updateProfile)
 */

import { verifyToken } from '../utils/jwt.js'

/**
 * 身份驗證中介層
 *
 * 從請求的 Authorization Header 中提取並驗證 JWT Token
 * 驗證成功後，將使用者資訊附加到 req.user
 *
 * @param {Object} req - Express 請求物件
 * @param {Object} res - Express 回應物件
 * @param {Function} next - Express next 函數
 * @returns {void}
 */
export function authenticate(req, res, next) {
  try {
    // ============================================
    // 步驟 1: 從 Header 取得 Token
    // ============================================
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: '未提供授權 Token',
      })
    }

    // 移除 "Bearer " 前綴
    const token = authHeader.replace('Bearer ', '')

    // ============================================
    // 步驟 2: 驗證 Token
    // ============================================
    const decoded = verifyToken(token)

    if (!decoded) {
      return res.status(401).json({
        success: false,
        message: 'Token 無效或已過期',
      })
    }

    // ============================================
    // 步驟 3: 將使用者資訊附加到請求物件
    // ============================================
    // decoded 包含: { userId, email, access }
    req.user = decoded

    // 繼續執行下一個中介層或路由處理器
    next()
  } catch (error) {
    console.error('❌ Authentication error:', error)
    return res.status(401).json({
      success: false,
      message: '身份驗證失敗',
    })
  }
}
