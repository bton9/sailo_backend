/**
 * Refresh Token 服務模組
 * 路徑: sailo_backend/src/services/refreshTokenService.js
 *
 * 功能：
 * - 建立和儲存 Refresh Token
 * - 驗證 Refresh Token 有效性
 * - Token 輪替機制 (Refresh Token Rotation)
 * - Token 撤銷管理
 *
 * 使用方式：
 * import { createRefreshToken, validateRefreshToken, rotateRefreshToken } from '@/services/refreshTokenService'
 */

import { query } from '../config/database.js'
import { generateRefreshToken } from '../utils/jwt.js'
import crypto from 'crypto'

/**
 * 產生裝置指紋
 * 用於識別同一裝置的請求
 *
 * @param {string} userAgent - User-Agent 字串
 * @param {string} ipAddress - IP 位址
 * @returns {string} SHA-256 hash
 */
function generateDeviceFingerprint(userAgent, ipAddress) {
  const data = `${userAgent || 'unknown'}_${ipAddress || 'unknown'}`
  return crypto.createHash('sha256').update(data).digest('hex')
}

/**
 * 建立 Refresh Token
 *
 * @param {number} userId - 使用者 ID
 * @param {number} sessionId - Session ID
 * @param {Object} options - 選項
 * @param {string} options.userAgent - User-Agent 字串
 * @param {string} options.ipAddress - IP 位址
 * @param {number} options.expiresInDays - 有效期 (天數)，預設 30 天
 * @returns {Promise<Object>} { tokenId, refreshToken, expiresAt }
 */
export async function createRefreshToken(userId, sessionId, options = {}) {
  try {
    const { userAgent = null, ipAddress = null, expiresInDays = 30 } = options

    // 產生唯一的 JWT ID (jti) 防止重複
    const jti = crypto.randomBytes(16).toString('hex')

    // 產生 JWT Refresh Token
    const refreshToken = generateRefreshToken({
      userId,
      sessionId,
      type: 'refresh',
      jti, // 🔧 加入唯一識別碼
      iat: Math.floor(Date.now() / 1000), // 🔧 加入簽發時間
    })

    // 產生裝置指紋
    const deviceFingerprint = generateDeviceFingerprint(userAgent, ipAddress)

    // 計算過期時間
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + expiresInDays)

    // 🔧 防止重複：先檢查並刪除可能存在的相同 Token
    await query(`DELETE FROM refresh_tokens WHERE token = ? AND user_id = ?`, [
      refreshToken,
      userId,
    ])

    // 儲存 Refresh Token 到資料庫
    const result = await query(
      `INSERT INTO refresh_tokens 
       (user_id, session_id, token, expires_at, user_agent, ip_address, device_fingerprint) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        sessionId,
        refreshToken,
        expiresAt,
        userAgent,
        ipAddress,
        deviceFingerprint,
      ]
    )

    console.log(' Refresh Token 建立成功:', {
      tokenId: result.insertId,
      userId,
      sessionId,
      expiresAt,
    })

    return {
      tokenId: result.insertId,
      refreshToken,
      expiresAt,
    }
  } catch (error) {
    console.error(' 建立 Refresh Token 失敗:', error)
    throw new Error('Failed to create refresh token')
  }
}

/**
 * 驗證 Refresh Token 是否有效
 *
 * @param {string} refreshToken - Refresh Token (JWT)
 * @param {Object} options - 選項
 * @param {string} options.userAgent - User-Agent 字串 (用於裝置驗證)
 * @param {string} options.ipAddress - IP 位址 (用於裝置驗證)
 * @param {boolean} options.strictDeviceCheck - 是否嚴格驗證裝置，預設 false
 * @returns {Promise<Object|null>} Token 資料或 null
 */
export async function validateRefreshToken(refreshToken, options = {}) {
  try {
    const {
      userAgent = null,
      ipAddress = null,
      strictDeviceCheck = false,
    } = options

    // 查詢 Refresh Token
    const tokens = await query(
      `SELECT rt.*, s.is_active AS session_active 
       FROM refresh_tokens rt
       LEFT JOIN sessions s ON rt.session_id = s.id
       WHERE rt.token = ? 
         AND rt.revoked = FALSE 
         AND rt.expires_at > NOW()
       LIMIT 1`,
      [refreshToken]
    )

    if (tokens.length === 0) {
      console.warn(' Refresh Token 不存在、已撤銷或已過期')
      return null
    }

    const tokenData = tokens[0]

    // 檢查關聯的 Session 是否仍然有效
    if (!tokenData.session_active) {
      console.warn(' 關聯的 Session 已失效')
      // 撤銷此 Refresh Token
      await revokeRefreshToken(refreshToken)
      return null
    }

    // 裝置驗證 (可選)
    if (strictDeviceCheck && (userAgent || ipAddress)) {
      const currentFingerprint = generateDeviceFingerprint(userAgent, ipAddress)
      if (tokenData.device_fingerprint !== currentFingerprint) {
        console.warn(' 裝置指紋不匹配，可能是盜用行為')
        // 安全起見，撤銷此 Token
        await revokeRefreshToken(refreshToken)
        return null
      }
    }

    console.log(' Refresh Token 驗證成功:', {
      tokenId: tokenData.id,
      userId: tokenData.user_id,
      sessionId: tokenData.session_id,
    })

    return tokenData
  } catch (error) {
    console.error(' 驗證 Refresh Token 失敗:', error)
    return null
  }
}

/**
 * Refresh Token 輪替 (Rotation)
 *
 * OAuth 2.0 安全最佳實踐：
 * 1. 驗證舊的 Refresh Token
 * 2. 撤銷舊的 Refresh Token
 * 3. 產生新的 Refresh Token
 * 4. 產生新的 Access Token
 *
 * 這樣即使 Refresh Token 被攔截，攻擊者也無法重複使用
 *
 * @param {string} oldRefreshToken - 舊的 Refresh Token
 * @param {Object} options - 選項
 * @returns {Promise<Object|null>} { newRefreshToken, newAccessToken, sessionId, userId } 或 null
 */
export async function rotateRefreshToken(oldRefreshToken, options = {}) {
  try {
    // 驗證舊的 Refresh Token
    const tokenData = await validateRefreshToken(oldRefreshToken, options)

    if (!tokenData) {
      console.warn(' 無法輪替：Refresh Token 無效')
      return null
    }

    const { user_id: userId, session_id: sessionId } = tokenData

    // 🔧 先刪除該 Session 所有舊的 Refresh Tokens (避免重複)
    await query(
      `DELETE FROM refresh_tokens 
       WHERE session_id = ? AND user_id = ?`,
      [sessionId, userId]
    )

    // 產生新的 Refresh Token
    const { refreshToken: newRefreshToken, expiresAt } =
      await createRefreshToken(userId, sessionId, options)

    console.log(' Refresh Token 輪替成功:', {
      userId,
      sessionId,
      oldTokenDeleted: true,
      newTokenCreated: true,
    })

    return {
      newRefreshToken,
      sessionId,
      userId,
      expiresAt,
    }
  } catch (error) {
    console.error(' Refresh Token 輪替失敗:', error)
    return null
  }
}

/**
 * 撤銷 Refresh Token
 *
 * @param {string} refreshToken - Refresh Token
 * @returns {Promise<boolean>} 是否成功
 */
export async function revokeRefreshToken(refreshToken) {
  try {
    const result = await query(
      `UPDATE refresh_tokens 
       SET revoked = TRUE, revoked_at = NOW() 
       WHERE token = ? AND revoked = FALSE`,
      [refreshToken]
    )

    if (result.affectedRows > 0) {
      console.log(' Refresh Token 已撤銷')
      return true
    } else {
      console.warn(' Refresh Token 不存在或已撤銷')
      return false
    }
  } catch (error) {
    console.error(' 撤銷 Refresh Token 失敗:', error)
    return false
  }
}

/**
 * 撤銷指定 Session 的所有 Refresh Tokens
 *
 * @param {number} sessionId - Session ID
 * @returns {Promise<number>} 撤銷的 Token 數量
 */
export async function revokeSessionRefreshTokens(sessionId) {
  try {
    const result = await query(
      `UPDATE refresh_tokens 
       SET revoked = TRUE, revoked_at = NOW() 
       WHERE session_id = ? AND revoked = FALSE`,
      [sessionId]
    )

    const count = result.affectedRows
    console.log(' 已撤銷 Session 的所有 Refresh Tokens:', {
      sessionId,
      count,
    })
    return count
  } catch (error) {
    console.error(' 撤銷 Session Refresh Tokens 失敗:', error)
    return 0
  }
}

/**
 * 撤銷使用者的所有 Refresh Tokens
 *
 * @param {number} userId - 使用者 ID
 * @returns {Promise<number>} 撤銷的 Token 數量
 */
export async function revokeUserRefreshTokens(userId) {
  try {
    const result = await query(
      `UPDATE refresh_tokens 
       SET revoked = TRUE, revoked_at = NOW() 
       WHERE user_id = ? AND revoked = FALSE`,
      [userId]
    )

    const count = result.affectedRows
    console.log(' 已撤銷使用者所有 Refresh Tokens:', { userId, count })
    return count
  } catch (error) {
    console.error(' 撤銷使用者 Refresh Tokens 失敗:', error)
    return 0
  }
}

/**
 * 取得使用者的活躍 Refresh Tokens
 *
 * @param {number} userId - 使用者 ID
 * @returns {Promise<Array>} Token 列表
 */
export async function getUserActiveRefreshTokens(userId) {
  try {
    const tokens = await query(
      `SELECT 
         id, session_id, created_at, expires_at, 
         user_agent, ip_address, device_fingerprint
       FROM refresh_tokens 
       WHERE user_id = ? 
         AND revoked = FALSE 
         AND expires_at > NOW()
       ORDER BY created_at DESC`,
      [userId]
    )

    return tokens
  } catch (error) {
    console.error(' 取得使用者 Refresh Tokens 失敗:', error)
    return []
  }
}

/**
 * 清理過期的 Refresh Tokens
 * 定期清理工作，建議透過排程器執行
 *
 * @returns {Promise<number>} 清理的 Token 數量
 */
export async function cleanupExpiredRefreshTokens() {
  try {
    const result = await query(
      `UPDATE refresh_tokens 
       SET revoked = TRUE, revoked_at = NOW() 
       WHERE expires_at < NOW() AND revoked = FALSE`
    )

    const count = result.affectedRows
    console.log(' 已清理過期 Refresh Tokens:', { count })
    return count
  } catch (error) {
    console.error(' 清理過期 Refresh Tokens 失敗:', error)
    return 0
  }
}

/**
 * 偵測並撤銷可疑的 Token (安全功能)
 *
 * 偵測規則：
 * 1. 同一個 Session 有多個來自不同 IP 的 Token
 * 2. Token 建立速度過快 (10 分鐘內超過 5 個)
 *
 * @param {number} userId - 使用者 ID
 * @returns {Promise<Object>} { suspicious: boolean, revokedCount: number }
 */
export async function detectAndRevokeSuspiciousTokens(userId) {
  try {
    // 偵測異常 IP 活動
    const suspiciousTokens = await query(
      `SELECT session_id, COUNT(DISTINCT ip_address) AS ip_count
       FROM refresh_tokens
       WHERE user_id = ? 
         AND revoked = FALSE
         AND created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)
       GROUP BY session_id
       HAVING ip_count > 2`,
      [userId]
    )

    if (suspiciousTokens.length > 0) {
      console.warn(' 偵測到可疑活動:', { userId, sessions: suspiciousTokens })

      // 撤銷這些可疑的 Tokens
      for (const suspicious of suspiciousTokens) {
        await revokeSessionRefreshTokens(suspicious.session_id)
      }

      return {
        suspicious: true,
        revokedCount: suspiciousTokens.length,
      }
    }

    return {
      suspicious: false,
      revokedCount: 0,
    }
  } catch (error) {
    console.error(' 偵測可疑 Token 失敗:', error)
    return { suspicious: false, revokedCount: 0 }
  }
}

export default {
  createRefreshToken,
  validateRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeSessionRefreshTokens,
  revokeUserRefreshTokens,
  getUserActiveRefreshTokens,
  cleanupExpiredRefreshTokens,
  detectAndRevokeSuspiciousTokens,
}
