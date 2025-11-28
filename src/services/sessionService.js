/**
 * Session 服務模組
 * 路徑: sailo_backend/src/services/sessionService.js
 *
 * 功能：
 * - 建立和管理使用者 Session
 * - Session 生命週期管理
 * - Session 驗證與延長
 * - 裝置資訊追蹤
 *
 * 使用方式：
 * import { createSession, validateSession, revokeSession } from '@/services/sessionService'
 */

import crypto from 'crypto'
import { query } from '../config/database.js'

/**
 * 產生 Session Token
 * @returns {string} 128 字元的隨機 hex 字串
 */
function generateSessionToken() {
  return crypto.randomBytes(64).toString('hex')
}

/**
 * 產生 Access Token Hash
 * 用於驗證 Access Token 與 Session 的對應關係
 * @param {string} accessToken - JWT Access Token
 * @returns {string} SHA-256 hash
 */
export function hashAccessToken(accessToken) {
  return crypto.createHash('sha256').update(accessToken).digest('hex')
}

/**
 * 解析 User-Agent 取得裝置資訊
 * @param {string} userAgent - User-Agent 字串
 * @returns {Object} 裝置資訊
 */
function parseDeviceInfo(userAgent) {
  if (!userAgent) {
    return {
      browser: 'Unknown',
      os: 'Unknown',
      device: 'Unknown',
    }
  }

  const info = {
    browser: 'Unknown',
    os: 'Unknown',
    device: 'Desktop',
  }

  // 偵測瀏覽器
  if (userAgent.includes('Chrome')) info.browser = 'Chrome'
  else if (userAgent.includes('Firefox')) info.browser = 'Firefox'
  else if (userAgent.includes('Safari')) info.browser = 'Safari'
  else if (userAgent.includes('Edge')) info.browser = 'Edge'
  else if (userAgent.includes('Opera')) info.browser = 'Opera'

  // 偵測作業系統
  if (userAgent.includes('Windows')) info.os = 'Windows'
  else if (userAgent.includes('Mac OS')) info.os = 'macOS'
  else if (userAgent.includes('Linux')) info.os = 'Linux'
  else if (userAgent.includes('Android')) info.os = 'Android'
  else if (userAgent.includes('iOS')) info.os = 'iOS'

  // 偵測裝置類型
  if (userAgent.includes('Mobile')) info.device = 'Mobile'
  else if (userAgent.includes('Tablet')) info.device = 'Tablet'

  return info
}

/**
 * 建立新的 Session
 *
 * @param {number} userId - 使用者 ID
 * @param {string} accessToken - JWT Access Token
 * @param {Object} options - 選項
 * @param {string} options.userAgent - User-Agent 字串
 * @param {string} options.ipAddress - IP 位址
 * @param {number} options.expiresInHours - Session 有效期 (小時)，預設 24 小時
 * @returns {Promise<Object>} { sessionId, sessionToken }
 */
export async function createSession(userId, accessToken, options = {}) {
  try {
    const { userAgent = null, ipAddress = null, expiresInHours = 24 } = options

    // 產生 Session Token
    const sessionToken = generateSessionToken()

    // 產生 Access Token Hash
    const accessTokenHash = hashAccessToken(accessToken)

    // 解析裝置資訊
    const deviceInfo = parseDeviceInfo(userAgent)

    // 計算過期時間
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + expiresInHours)

    // 插入 Session 到資料庫
    const result = await query(
      `INSERT INTO sessions 
       (user_id, session_token, access_token_hash, expires_at, user_agent, ip_address, device_info) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        sessionToken,
        accessTokenHash,
        expiresAt,
        userAgent,
        ipAddress,
        JSON.stringify(deviceInfo),
      ]
    )

    console.log(' Session 建立成功:', {
      sessionId: result.insertId,
      userId,
      expiresAt,
      device: deviceInfo,
    })

    return {
      sessionId: result.insertId,
      sessionToken,
      expiresAt,
    }
  } catch (error) {
    console.error(' 建立 Session 失敗:', error)
    throw new Error('Failed to create session')
  }
}

/**
 * 驗證 Session 是否有效
 *
 * @param {string} sessionToken - Session Token
 * @param {string} accessToken - JWT Access Token (選填，用於額外驗證)
 * @returns {Promise<Object|null>} Session 資料或 null
 */
export async function validateSession(sessionToken, accessToken = null) {
  try {
    // 查詢 Session
    const sessions = await query(
      `SELECT * FROM sessions 
       WHERE session_token = ? 
         AND is_active = TRUE 
         AND expires_at > NOW() 
       LIMIT 1`,
      [sessionToken]
    )

    if (sessions.length === 0) {
      console.warn(' Session 不存在或已過期')
      return null
    }

    const session = sessions[0]

    // 如果提供 Access Token，驗證 Hash 是否匹配
    if (accessToken) {
      const accessTokenHash = hashAccessToken(accessToken)
      if (session.access_token_hash !== accessTokenHash) {
        console.warn(' Access Token Hash 不匹配')
        return null
      }
    }

    // 更新最後活動時間
    await query('UPDATE sessions SET last_activity = NOW() WHERE id = ?', [
      session.id,
    ])

    console.log(' Session 驗證成功:', {
      sessionId: session.id,
      userId: session.user_id,
    })

    return session
  } catch (error) {
    console.error(' 驗證 Session 失敗:', error)
    return null
  }
}

/**
 * 延長 Session 有效期
 *
 * @param {number} sessionId - Session ID
 * @param {number} extendHours - 延長時數，預設 24 小時
 * @returns {Promise<boolean>} 是否成功
 */
export async function extendSession(sessionId, extendHours = 24) {
  try {
    const newExpiresAt = new Date()
    newExpiresAt.setHours(newExpiresAt.getHours() + extendHours)

    await query(
      'UPDATE sessions SET expires_at = ?, last_activity = NOW() WHERE id = ?',
      [newExpiresAt, sessionId]
    )

    console.log(' Session 延長成功:', { sessionId, newExpiresAt })
    return true
  } catch (error) {
    console.error(' 延長 Session 失敗:', error)
    return false
  }
}

/**
 * 撤銷 Session (登出)
 *
 * @param {string} sessionToken - Session Token
 * @returns {Promise<boolean>} 是否成功
 */
export async function revokeSession(sessionToken) {
  try {
    // 停用 Session
    await query(
      'UPDATE sessions SET is_active = FALSE WHERE session_token = ?',
      [sessionToken]
    )

    // 撤銷關聯的 Refresh Tokens
    await query(
      `UPDATE refresh_tokens rt
       JOIN sessions s ON rt.session_id = s.id
       SET rt.revoked = TRUE, rt.revoked_at = NOW()
       WHERE s.session_token = ? AND rt.revoked = FALSE`,
      [sessionToken]
    )

    console.log(' Session 已撤銷:', { sessionToken })
    return true
  } catch (error) {
    console.error(' 撤銷 Session 失敗:', error)
    return false
  }
}

/**
 * 撤銷使用者的所有 Sessions (全部登出)
 *
 * @param {number} userId - 使用者 ID
 * @returns {Promise<number>} 撤銷的 Session 數量
 */
export async function revokeAllUserSessions(userId) {
  try {
    // 停用所有 Sessions
    const result = await query(
      'UPDATE sessions SET is_active = FALSE WHERE user_id = ? AND is_active = TRUE',
      [userId]
    )

    // 撤銷所有 Refresh Tokens
    await query(
      `UPDATE refresh_tokens 
       SET revoked = TRUE, revoked_at = NOW() 
       WHERE user_id = ? AND revoked = FALSE`,
      [userId]
    )

    const count = result.affectedRows
    console.log(' 已撤銷使用者所有 Sessions:', { userId, count })
    return count
  } catch (error) {
    console.error(' 撤銷所有 Sessions 失敗:', error)
    return 0
  }
}

/**
 * 取得使用者的所有活躍 Sessions
 *
 * @param {number} userId - 使用者 ID
 * @returns {Promise<Array>} Session 列表
 */
export async function getUserActiveSessions(userId) {
  try {
    const sessions = await query(
      `SELECT 
         id, created_at, last_activity, expires_at,
         user_agent, ip_address, device_info
       FROM sessions 
       WHERE user_id = ? 
         AND is_active = TRUE 
         AND expires_at > NOW()
       ORDER BY last_activity DESC`,
      [userId]
    )

    // 解析 device_info JSON
    return sessions.map((session) => ({
      ...session,
      device_info: session.device_info ? JSON.parse(session.device_info) : null,
    }))
  } catch (error) {
    console.error(' 取得使用者 Sessions 失敗:', error)
    return []
  }
}

/**
 * 清理過期的 Sessions
 * 定期清理工作，建議透過排程器執行
 *
 * @returns {Promise<number>} 清理的 Session 數量
 */
export async function cleanupExpiredSessions() {
  try {
    const result = await query(
      `UPDATE sessions 
       SET is_active = FALSE 
       WHERE expires_at < NOW() AND is_active = TRUE`
    )

    const count = result.affectedRows
    console.log(' 已清理過期 Sessions:', { count })
    return count
  } catch (error) {
    console.error(' 清理過期 Sessions 失敗:', error)
    return 0
  }
}

export default {
  createSession,
  validateSession,
  extendSession,
  revokeSession,
  revokeAllUserSessions,
  getUserActiveSessions,
  cleanupExpiredSessions,
}
