/**
 * 客服管理 API 控制器
 * 路徑: src/controllers/chat/adminCustomerServiceController.js
 * 版本: v1.1.0
 *
 * 功能說明:
 * - 客服端聊天室管理
 * - 接單、關閉聊天室
 * - 統計資訊查詢
 * - 支援 AI 客服擴充
 * - WebSocket 即時通知
 *
 * 認證要求:
 * - 需要 admin 權限
 * - 使用 requireRole('admin') middleware
 */

import db from '../../config/database.js'

// ============================================
// WebSocket IO 實例 (由 server.js 設定)
// ============================================
let io = null

export function setSocketIO(ioInstance) {
  io = ioInstance
  console.log('✅ Socket.IO 實例已設定到 adminCustomerServiceController')
}

/**
 * 獲取聊天室列表
 * GET /api/customer-service/admin/rooms
 *
 * Query 參數:
 * - status: all/waiting/active/closed
 * - priority: high/medium/low
 * - limit: 每頁數量
 * - offset: 偏移量
 */
const getRooms = async (req, res) => {
  try {
    const {
      status = 'all',
      priority = null,
      limit = 50,
      offset = 0,
    } = req.query

    console.log('📋 查詢客服聊天室列表:', { status, priority, limit, offset })

    // 建立查詢條件
    let whereConditions = []
    let queryParams = []

    // 狀態篩選
    if (status !== 'all') {
      whereConditions.push('cr.status = ?')
      queryParams.push(status)
    }

    // 優先級篩選
    if (priority) {
      whereConditions.push('cr.priority = ?')
      queryParams.push(priority)
    }

    const whereClause =
      whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : ''

    // 查詢聊天室
    const query = `
      SELECT 
        cr.id,
        cr.user_id,
        cr.agent_id,
        cr.subject,
        cr.status,
        cr.priority,
        cr.source,
        cr.transfer_context,
        cr.created_at,
        cr.updated_at,
        cr.closed_at,
        COALESCE(u.nickname, u.name) as user_name,
        u.email as user_email,
        COALESCE(a.nickname, a.name) as agent_name,
        (
          SELECT COUNT(*)
          FROM customer_service_messages csm
          WHERE csm.room_id = cr.id
            AND csm.sender_id != ${req.user.userId}
            AND csm.is_read = 0
            AND csm.message_type != 'system'
        ) as unread_count,
        (
          SELECT message
          FROM customer_service_messages csm
          WHERE csm.room_id = cr.id
          ORDER BY csm.created_at DESC
          LIMIT 1
        ) as last_message,
        (
          SELECT created_at
          FROM customer_service_messages csm
          WHERE csm.room_id = cr.id
          ORDER BY csm.created_at DESC
          LIMIT 1
        ) as last_message_time
      FROM customer_service_rooms cr
      LEFT JOIN users u ON cr.user_id = u.id
      LEFT JOIN users a ON cr.agent_id = a.id
      ${whereClause}
      ORDER BY 
        CASE 
          WHEN cr.priority = 'high' THEN 1
          WHEN cr.priority = 'medium' THEN 2
          WHEN cr.priority = 'low' THEN 3
        END,
        cr.created_at ASC
      LIMIT ${parseInt(limit)}
      OFFSET ${parseInt(offset)}
    `

    const [rooms] = await db.query(query, queryParams)

    console.log('✅ 找到聊天室數量:', rooms.length)

    res.json({
      success: true,
      rooms: rooms,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: rooms.length,
      },
    })
  } catch (error) {
    console.error('❌ 查詢聊天室列表失敗:', error)
    res.status(500).json({
      success: false,
      message: '查詢聊天室列表失敗',
      error: error.message,
    })
  }
}

/**
 * 接單（客服接受聊天室）
 * POST /api/customer-service/admin/rooms/:roomId/accept
 */
const acceptRoom = async (req, res) => {
  const connection = await db.getConnection()

  try {
    const { roomId } = req.params
    const agentId = req.user.userId

    console.log('📌 客服接單:', { roomId, agentId })

    await connection.beginTransaction()

    // 檢查聊天室是否存在
    const [rooms] = await connection.query(
      'SELECT * FROM customer_service_rooms WHERE id = ?',
      [roomId]
    )

    if (rooms.length === 0) {
      await connection.rollback()
      return res.status(404).json({
        success: false,
        message: '聊天室不存在',
      })
    }

    const room = rooms[0]

    // 檢查是否已被其他客服接單
    if (
      room.status === 'active' &&
      room.agent_id &&
      room.agent_id !== agentId
    ) {
      await connection.rollback()
      return res.status(400).json({
        success: false,
        message: '此聊天室已被其他客服接單',
      })
    }

    // 更新聊天室狀態
    await connection.query(
      `UPDATE customer_service_rooms 
       SET status = 'active', 
           agent_id = ${agentId},
           updated_at = NOW()
       WHERE id = ${roomId}`,
      []
    )

    // 新增系統訊息
    const messageResult = await connection.query(
      `INSERT INTO customer_service_messages 
       (room_id, sender_id, message, message_type, created_at)
       VALUES (${roomId}, ${agentId}, '客服已加入對話', 'system', NOW())`,
      []
    )

    await connection.commit()

    console.log('✅ 接單成功')

    // ============================================
    // 🆕 透過 WebSocket 即時發送「客服已加入對話」訊息
    // ============================================
    if (io) {
      // 取得客服資訊
      const [agent] = await connection.query(
        'SELECT id, name, avatar FROM users WHERE id = ?',
        [agentId]
      )

      const systemMessage = {
        id: messageResult[0].insertId,
        room_id: parseInt(roomId),
        sender_id: agentId,
        sender_name: agent?.name || '客服',
        sender_avatar: agent?.avatar,
        message: '客服已加入對話',
        message_type: 'system',
        file_url: null,
        file_name: null,
        file_size: null,
        thumbnail_url: null,
        is_read: false,
        created_at: new Date().toISOString(),
      }

      io.to(`room_${roomId}`).emit('new_message', systemMessage)
      console.log(`📢 WebSocket 發送: 客服已加入對話 (聊天室 ${roomId})`)
    }

    res.json({
      success: true,
      message: '接單成功',
    })
  } catch (error) {
    await connection.rollback()
    console.error('❌ 接單失敗:', error)
    res.status(500).json({
      success: false,
      message: '接單失敗',
      error: error.message,
    })
  } finally {
    connection.release()
  }
}

/**
 * 關閉聊天室
 * POST /api/customer-service/admin/rooms/:roomId/close
 */
const closeRoom = async (req, res) => {
  const connection = await db.getConnection()

  try {
    const { roomId } = req.params
    const agentId = req.user.userId

    console.log('🔒 關閉聊天室:', { roomId, agentId })

    await connection.beginTransaction()

    // 檢查聊天室是否存在
    const [rooms] = await connection.query(
      'SELECT * FROM customer_service_rooms WHERE id = ?',
      [roomId]
    )

    if (rooms.length === 0) {
      await connection.rollback()
      return res.status(404).json({
        success: false,
        message: '聊天室不存在',
      })
    }

    const room = rooms[0]

    // 檢查權限（只有接單的客服或管理員可以關閉）
    if (room.agent_id && room.agent_id !== agentId) {
      // 可以在這裡加上檢查是否為超級管理員
      await connection.rollback()
      return res.status(403).json({
        success: false,
        message: '您沒有權限關閉此聊天室',
      })
    }

    // 更新聊天室狀態
    await connection.query(
      `UPDATE customer_service_rooms 
       SET status = 'closed', 
           closed_at = NOW(),
           updated_at = NOW()
       WHERE id = ${roomId}`,
      []
    )

    // 新增系統訊息
    await connection.query(
      `INSERT INTO customer_service_messages 
       (room_id, sender_id, message, message_type, created_at)
       VALUES (${roomId}, ${agentId}, '聊天室已關閉', 'system', NOW())`,
      []
    )

    await connection.commit()

    console.log('✅ 關閉成功')

    // ============================================
    // 🆕 透過 WebSocket 通知使用者聊天室已關閉
    // ============================================
    if (io) {
      io.to(`room_${roomId}`).emit('room_closed', {
        roomId: parseInt(roomId),
        message: '客服已結束此對話',
        closedAt: new Date().toISOString(),
      })
      console.log(`📢 WebSocket 通知: 聊天室 ${roomId} 已關閉`)
    }

    res.json({
      success: true,
      message: '聊天室已關閉',
    })
  } catch (error) {
    await connection.rollback()
    console.error('❌ 關閉聊天室失敗:', error)
    res.status(500).json({
      success: false,
      message: '關閉聊天室失敗',
      error: error.message,
    })
  } finally {
    connection.release()
  }
}

/**
 * 獲取統計資訊
 * GET /api/customer-service/admin/stats
 */
const getStats = async (req, res) => {
  try {
    console.log('📊 查詢統計資訊')

    // 等待中數量
    const [waitingCount] = await db.query(
      `SELECT COUNT(*) as count 
       FROM customer_service_rooms 
       WHERE status = 'waiting'`,
      []
    )

    // 進行中數量
    const [activeCount] = await db.query(
      `SELECT COUNT(*) as count 
       FROM customer_service_rooms 
       WHERE status = 'active'`,
      []
    )

    // 今日已關閉數量
    const [closedTodayCount] = await db.query(
      `SELECT COUNT(*) as count 
       FROM customer_service_rooms 
       WHERE status = 'closed' 
         AND DATE(closed_at) = CURDATE()`,
      []
    )

    // 平均回應時間（秒）
    const [avgResponseTime] = await db.query(
      `SELECT AVG(TIMESTAMPDIFF(SECOND, cr.created_at, csm.created_at)) as avg_time
       FROM customer_service_rooms cr
       INNER JOIN customer_service_messages csm ON cr.id = csm.room_id
       WHERE csm.sender_id = cr.agent_id
         AND csm.created_at = (
           SELECT MIN(created_at)
           FROM customer_service_messages
           WHERE room_id = cr.id AND sender_id = cr.agent_id
         )
         AND DATE(cr.created_at) = CURDATE()`,
      []
    )

    const stats = {
      waiting: waitingCount[0].count,
      active: activeCount[0].count,
      closed_today: closedTodayCount[0].count,
      avg_response_time: Math.round(avgResponseTime[0].avg_time || 0),
    }

    console.log('✅ 統計資訊:', stats)

    res.json({
      success: true,
      stats: stats,
    })
  } catch (error) {
    console.error('❌ 查詢統計資訊失敗:', error)
    res.status(500).json({
      success: false,
      message: '查詢統計資訊失敗',
      error: error.message,
    })
  }
}

/**
 * AI 客服預留功能
 *
 * 未來可擴充的端點：
 * - POST /api/customer-service/admin/ai/transfer - AI 轉人工
 * - GET /api/customer-service/admin/ai/history - AI 對話記錄
 * - POST /api/customer-service/admin/ai/config - AI 設定
 */

export { getRooms, acceptRoom, closeRoom, getStats }
