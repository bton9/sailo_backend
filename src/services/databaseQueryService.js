/**
 * 資料庫查詢服務 - LLM 專用
 * 路徑: sailo_backend/src/services/databaseQueryService.js
 *
 * 功能說明:
 * - 為 AI 客服提供安全的資料庫查詢能力
 * - 只允許查詢使用者自己的資料
 * - 限制查詢範圍和類型
 * - 格式化查詢結果供 AI 理解
 *
 * 安全機制:
 * - 查詢白名單：只允許特定類型的查詢
 * - 使用者隔離：只能查詢當前使用者的資料
 * - 參數驗證：嚴格驗證所有輸入參數
 * - 結果限制：限制返回資料量
 */

import { query } from '../config/database.js'

/**
 * 定義允許的查詢類型
 * 每個查詢類型都有明確的 SQL 模板和參數驗證
 */
const ALLOWED_QUERIES = {
  // 使用者資料相關
  user_profile: {
    description: '查詢使用者個人資料',
    sql: `SELECT name, nickname, email, phone, birthday, gender, 
                 created_at, updated_at 
          FROM users 
          WHERE id = ?`,
    params: ['userId'],
    format: (result) => {
      if (!result || result.length === 0) return '找不到使用者資料'
      const user = result[0]
      return `您的資料如下：
- 姓名：${user.name || '未設定'}
- 暱稱：${user.nickname || '未設定'}
- Email：${user.email}
- 電話：${user.phone || '未設定'}
- 生日：${user.birthday || '未設定'}
- 性別：${user.gender === 'male' ? '男性' : user.gender === 'female' ? '女性' : user.gender === 'other' ? '其他' : '未設定'}
- 註冊時間：${new Date(user.created_at).toLocaleString('zh-TW')}
- 最後更新：${new Date(user.updated_at).toLocaleString('zh-TW')}`
    },
  },

  nickname_history: {
    description: '查詢暱稱最後修改時間',
    sql: `SELECT nickname, updated_at 
          FROM users 
          WHERE id = ?`,
    params: ['userId'],
    format: (result) => {
      if (!result || result.length === 0) return '找不到暱稱資料'
      const user = result[0]
      return `您的暱稱是「${user.nickname || '未設定'}」，最後修改時間是 ${new Date(user.updated_at).toLocaleString('zh-TW')}`
    },
  },

  profile_update_time: {
    description: '查詢個人資料最後修改時間',
    sql: `SELECT name, nickname, email, updated_at, created_at 
          FROM users 
          WHERE id = ?`,
    params: ['userId'],
    format: (result) => {
      if (!result || result.length === 0) return '找不到資料'
      const user = result[0]
      const updatedDate = new Date(user.updated_at)
      const createdDate = new Date(user.created_at)
      const now = new Date()

      // 計算時間差（天數）
      const daysSinceUpdate = Math.floor(
        (now - updatedDate) / (1000 * 60 * 60 * 24)
      )
      const daysSinceCreation = Math.floor(
        (now - createdDate) / (1000 * 60 * 60 * 24)
      )

      // 判斷是否曾經修改過
      const hasBeenModified = updatedDate.getTime() !== createdDate.getTime()

      if (hasBeenModified) {
        return `您最後一次修改個人資料的時間是：${updatedDate.toLocaleString('zh-TW')}（${daysSinceUpdate === 0 ? '今天' : daysSinceUpdate === 1 ? '昨天' : `${daysSinceUpdate} 天前`}）`
      } else {
        return `您尚未修改過個人資料。帳號建立於 ${createdDate.toLocaleString('zh-TW')}（${daysSinceCreation} 天前），資料維持原始狀態。`
      }
    },
  },

  my_bookmarks: {
    description: '查詢我的收藏行程數量',
    sql: `SELECT COUNT(*) as count 
          FROM bookmarks 
          WHERE user_id = ?`,
    params: ['userId'],
    format: (result) => {
      const count = result[0].count
      return `您目前有 ${count} 個收藏的行程`
    },
  },

  my_orders_count: {
    description: '查詢我的訂單數量',
    sql: `SELECT COUNT(*) as total,
                 SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                 SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid,
                 SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
          FROM orders 
          WHERE user_id = ?`,
    params: ['userId'],
    format: (result) => {
      const stats = result[0]
      return `您的訂單統計：
- 總訂單數：${stats.total || 0}
- 待付款：${stats.pending || 0}
- 已付款：${stats.paid || 0}
- 已完成：${stats.completed || 0}`
    },
  },

  recent_ai_chats: {
    description: '查詢最近的 AI 對話',
    sql: `SELECT session_name, created_at 
          FROM ai_chat_rooms 
          WHERE user_id = ? 
          ORDER BY created_at DESC 
          LIMIT 5`,
    params: ['userId'],
    format: (result) => {
      if (!result || result.length === 0) return '您還沒有 AI 對話記錄'
      const sessions = result
        .map(
          (s, i) =>
            `${i + 1}. ${s.session_name} - ${new Date(s.created_at).toLocaleString('zh-TW')}`
        )
        .join('\n')
      return `您最近的 AI 對話：\n${sessions}`
    },
  },

  account_created_time: {
    description: '查詢帳號建立時間',
    sql: `SELECT email, created_at 
          FROM users 
          WHERE id = ?`,
    params: ['userId'],
    format: (result) => {
      if (!result || result.length === 0) return '找不到帳號資料'
      const user = result[0]
      const createdDate = new Date(user.created_at)
      const now = new Date()
      const days = Math.floor((now - createdDate) / (1000 * 60 * 60 * 24))
      return `您的帳號 ${user.email} 建立於 ${createdDate.toLocaleString('zh-TW')}，已經使用 ${days} 天了`
    },
  },
}

/**
 * 執行資料庫查詢
 *
 * @param {string} queryType - 查詢類型（必須在 ALLOWED_QUERIES 中）
 * @param {number} userId - 使用者 ID（用於資料隔離）
 * @returns {Promise<string>} 格式化後的查詢結果
 */
export async function executeUserQuery(queryType, userId) {
  try {
    // 驗證查詢類型
    if (!ALLOWED_QUERIES[queryType]) {
      throw new Error(`不支援的查詢類型: ${queryType}`)
    }

    // 驗證使用者 ID
    if (!userId || typeof userId !== 'number') {
      throw new Error('無效的使用者 ID')
    }

    const queryConfig = ALLOWED_QUERIES[queryType]

    // 建立參數對應
    const params = queryConfig.params.map((paramName) => {
      if (paramName === 'userId') return userId
      throw new Error(`未知的參數: ${paramName}`)
    })

    // 執行查詢
    console.log('🔍 執行使用者查詢:', {
      type: queryType,
      userId,
      description: queryConfig.description,
    })

    const result = await query(queryConfig.sql, params)

    // 格式化結果
    const formattedResult = queryConfig.format(result)

    console.log('✅ 查詢完成:', queryType)

    return formattedResult
  } catch (error) {
    console.error(' 資料庫查詢失敗:', error)
    throw error
  }
}

/**
 * 取得所有可用的查詢類型
 * 供 AI 參考使用
 *
 * @returns {Array} 查詢類型列表
 */
export function getAvailableQueries() {
  return Object.entries(ALLOWED_QUERIES).map(([key, config]) => ({
    type: key,
    description: config.description,
  }))
}

/**
 * 根據使用者問題推薦查詢類型
 *
 * @param {string} userMessage - 使用者訊息
 * @returns {string|null} 推薦的查詢類型
 */
export function suggestQueryType(userMessage) {
  const message = userMessage.toLowerCase()

  // 暱稱相關（優先度較高，避免被個人資料覆蓋）
  if (
    message.includes('暱稱') &&
    (message.includes('修改') ||
      message.includes('更新') ||
      message.includes('改過') ||
      message.includes('什麼時候') ||
      message.includes('時間'))
  ) {
    return 'nickname_history'
  }

  // 個人資料最後修改時間（優先度最高，明確詢問修改時間）
  if (
    (message.includes('個人資料') ||
      message.includes('資料') ||
      message.includes('個人訊息') ||
      message.includes('我的資料')) &&
    (message.includes('修改') ||
      message.includes('更新') ||
      message.includes('改過') ||
      message.includes('最後') ||
      message.includes('上次') ||
      message.includes('什麼時候') ||
      message.includes('哪時候') ||
      message.includes('時間'))
  ) {
    return 'profile_update_time'
  }

  // 完整個人資料（不包含時間關鍵字）
  if (
    !message.includes('時間') &&
    !message.includes('修改') &&
    !message.includes('更新') &&
    (message.includes('我的資料') ||
      message.includes('個人資料') ||
      message.includes('基本資料') ||
      message.includes('查詢資料'))
  ) {
    return 'user_profile'
  }

  // 收藏相關
  if (message.includes('收藏') || message.includes('書籤')) {
    return 'my_bookmarks'
  }

  // 訂單相關
  if (message.includes('訂單')) {
    return 'my_orders_count'
  }

  // 帳號建立時間
  if (
    message.includes('帳號') &&
    (message.includes('建立') ||
      message.includes('註冊') ||
      message.includes('多久') ||
      message.includes('什麼時候'))
  ) {
    return 'account_created_time'
  }

  // AI 對話記錄
  if (
    (message.includes('對話') || message.includes('聊天')) &&
    message.includes('記錄')
  ) {
    return 'recent_ai_chats'
  }

  return null
}

export default {
  executeUserQuery,
  getAvailableQueries,
  suggestQueryType,
}
