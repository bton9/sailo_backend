/**
 * JWT 工具模組
 * 路徑: sailo/utils/jwt.js
 *
 * 功能：
 * - 產生 JWT Access Token 與 Refresh Token
 * - 驗證 Token 有效性
 * - 解析 Token 內容
 *
 * 使用方式：
 * import { generateToken, verifyToken } from '@/utils/jwt'
 */

import jwt from 'jsonwebtoken'

// JWT 密鑰 (從環境變數讀取)
const JWT_SECRET =
  process.env.JWT_SECRET ||
  'your-super-secret-jwt-key-change-this-in-production-2025'
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d'
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '30d'

/**
 * 產生 Access Token
 * @param {Object} payload - Token 內容 (通常包含 userId, email, access)
 * @returns {string} JWT Token
 */
export function generateToken(payload) {
  try {
    return jwt.sign(payload, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
      issuer: 'sailo-app',
    })
  } catch (error) {
    console.error('❌ Token 產生失敗:', error)
    throw new Error('Token generation failed')
  }
}

/**
 * 產生 Refresh Token (有效期較長)
 * @param {Object} payload - Token 內容
 * @returns {string} Refresh Token
 */
export function generateRefreshToken(payload) {
  try {
    return jwt.sign(payload, JWT_SECRET, {
      expiresIn: JWT_REFRESH_EXPIRES_IN,
      issuer: 'sailo-app',
    })
  } catch (error) {
    console.error('❌ Refresh Token 產生失敗:', error)
    throw new Error('Refresh token generation failed')
  }
}

/**
 * 驗證 Token 有效性
 * @param {string} token - JWT Token
 * @returns {Object|null} 解析後的 payload，失敗則返回 null
 */
export function verifyToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: 'sailo-app',
    })
    return decoded
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      console.warn('⚠️ Token 已過期')
    } else if (error.name === 'JsonWebTokenError') {
      console.warn('⚠️ Token 無效')
    } else {
      console.error('❌ Token 驗證失敗:', error)
    }
    return null
  }
}

/**
 * 解析 Token (不驗證有效性)
 * @param {string} token - JWT Token
 * @returns {Object|null} 解析後的 payload
 */
export function decodeToken(token) {
  try {
    return jwt.decode(token)
  } catch (error) {
    console.error('❌ Token 解析失敗:', error)
    return null
  }
}

export default {
  generateToken,
  generateRefreshToken,
  verifyToken,
  decodeToken,
}
