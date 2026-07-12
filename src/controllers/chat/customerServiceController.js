/**
 * 客服聊天控制器
 * 路徑: sailo_backend/src/controllers/chat/customerServiceController.js
 *
 * 功能說明:
 * - 建立/取得客服聊天室
 * - 取得聊天室訊息歷史
 * - 上傳聊天圖片 (ImageKit)
 * - 更新聊天室狀態
 * - 客服人員分配
 * - AI 轉人工功能預留
 *
 * 資料表:
 * - customer_service_rooms: 聊天室資訊
 * - customer_service_messages: 聊天訊息
 * - ai_chat_rooms: AI 聊天室 (預留)
 *
 * 架構: Controller-Service 模式
 * 認證: authV2 (不使用 localStorage)
 */

import { query } from '../../config/database.js'
import ImageKit from 'imagekit'

// ============================================
// ImageKit 配置 (用於聊天圖片上傳)
// ============================================
const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
})

/**
 * 建立或取得客服聊天室
 *
 * 流程:
 * 1. 檢查使用者是否已有進行中的聊天室
 * 2. 若有則返回現有聊天室
 * 3. 若無則建立新聊天室
 *
 * @route POST /api/customer-service/rooms
 * @access Private (需登入)
 * @body {string} subject - 諮詢主題 (選填)
 * @body {string} priority - 優先級 low/medium/high (選填,預設 medium)
 */
export async function createOrGetRoom(req, res) {
  try {
    const userId = req.user?.userId || req.user?.fullUser?.id // 從 authV2 middleware 取得
    const subject = req.body?.subject || null
    const priority = req.body?.priority || 'medium'

    console.log('建立聊天室請求:', {
      userId,
      subject,
      priority,
      user: req.user,
    })

    // 檢查 userId 是否存在
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: '未授權: 無法取得使用者 ID',
      })
    }

    // ============================================
    // 步驟 1: 檢查使用者是否已有進行中的聊天室
    // 只檢查 waiting 和 active 狀態
    // 如果聊天室是 closed 狀態，則建立新的單號
    // ============================================
    const existingRooms = await query(
      `SELECT * FROM customer_service_rooms 
       WHERE user_id = ${userId} 
       AND status IN ('waiting', 'active')
       ORDER BY created_at DESC 
       LIMIT 1`
    )

    // 若已有進行中的聊天室，直接返回
    if (existingRooms.length > 0) {
      const room = existingRooms[0]

      return res.json({
        success: true,
        room: room,
        isNew: false,
      })
    }

    // ============================================
    // 步驟 2: 建立新聊天室
    // ============================================
    const result = await query(
      `INSERT INTO customer_service_rooms 
       (user_id, subject, priority, status, source) 
       VALUES (${userId}, ${subject ? `'${subject}'` : 'NULL'}, '${priority}', 'waiting', 'direct')`
    )

    // 取得新建立的聊天室資訊
    const newRoom = await query(
      `SELECT * FROM customer_service_rooms WHERE id = ${result.insertId}`
    )

    // ============================================
    // 步驟 3: 不再自動發送歡迎訊息
    // 改為使用者發送第一則訊息後才顯示歡迎訊息
    // ============================================

    res.status(201).json({
      success: true,
      room: newRoom[0],
      isNew: true,
    })
  } catch (error) {
    console.error('建立聊天室失敗:', error)
    res.status(500).json({
      success: false,
      message: '建立聊天室失敗',
      error: error.message,
    })
  }
}

/**
 * 取得使用者的所有聊天室
 *
 * @route GET /api/customer-service/rooms
 * @access Private (需登入)
 * @query {string} status - 過濾狀態 waiting/active/closed (選填)
 */
export async function getUserRooms(req, res) {
  try {
    const userId = req.user?.userId || req.user?.fullUser?.id
    const { status } = req.query

    let sql = `
      SELECT 
        csr.*,
        u.name as agent_name,
        (SELECT COUNT(*) FROM customer_service_messages 
         WHERE room_id = csr.id AND is_read = 0 AND sender_id != ? AND message_type != 'system') as unread_count,
        (SELECT message FROM customer_service_messages 
         WHERE room_id = csr.id 
         ORDER BY created_at DESC LIMIT 1) as last_message
      FROM customer_service_rooms csr
      LEFT JOIN users u ON csr.agent_id = u.id
      WHERE csr.user_id = ?
    `

    const params = [userId, userId]

    // 若有指定狀態,加入過濾條件
    if (status) {
      sql += ' AND csr.status = ?'
      params.push(status)
    }

    sql += ' ORDER BY csr.updated_at DESC'

    const rooms = await query(sql, params)

    res.json({
      success: true,
      rooms,
    })
  } catch (error) {
    console.error('取得聊天室失敗:', error)
    res.status(500).json({
      success: false,
      message: '取得聊天室失敗',
      error: error.message,
    })
  }
}

/**
 * 取得聊天室訊息歷史
 *
 * @route GET /api/customer-service/rooms/:roomId/messages
 * @access Private (需登入)
 * @query {number} limit - 取得筆數 (預設 50)
 * @query {number} offset - 偏移量 (預設 0,用於分頁)
 */
export async function getRoomMessages(req, res) {
  try {
    const userId = req.user?.userId || req.user?.fullUser?.id
    const roomId = parseInt(req.params.roomId)
    const limit = parseInt(req.query.limit) || 50
    const offset = parseInt(req.query.offset) || 0

    console.log('getRoomMessages 參數:', {
      roomId,
      limit,
      offset,
      userId,
      roomIdType: typeof roomId,
      limitType: typeof limit,
      offsetType: typeof offset,
      isRoomIdNaN: isNaN(roomId),
      isLimitNaN: isNaN(limit),
      isOffsetNaN: isNaN(offset),
    })

    // 檢查參數是否有效
    if (isNaN(roomId) || isNaN(limit) || isNaN(offset)) {
      return res.status(400).json({
        success: false,
        message: '無效的參數',
        debug: { roomId, limit, offset },
      })
    }

    // ============================================
    // 步驟 1: 驗證使用者是否有權限存取此聊天室
    // ============================================
    const room = await query(
      `SELECT * FROM customer_service_rooms 
       WHERE id = ? AND (user_id = ? OR agent_id = ?)`,
      [roomId, userId, userId]
    )

    if (room.length === 0) {
      return res.status(403).json({
        success: false,
        message: '無權存取此聊天室',
      })
    }

    // ============================================
    // 步驟 2: 取得訊息列表
    // ============================================
    const messages = await query(
      `SELECT csm.id, csm.room_id, csm.sender_id, csm.message, csm.message_type,
              csm.file_url, csm.file_name, csm.file_size, csm.thumbnail_url,
              csm.is_read, csm.created_at,
              u.name as sender_name, u.avatar as sender_avatar 
       FROM customer_service_messages csm 
       LEFT JOIN users u ON csm.sender_id = u.id 
       WHERE csm.room_id = ${roomId} 
       ORDER BY csm.created_at ASC 
       LIMIT ${limit} OFFSET ${offset}`
    )

    // 格式化訊息時間為 ISO 字串
    const formattedMessages = messages.map((msg) => {
      // 確保 created_at 是正確的 ISO 格式
      let isoDate = msg.created_at
      if (msg.created_at instanceof Date) {
        isoDate = msg.created_at.toISOString()
      } else if (typeof msg.created_at === 'string') {
        // MySQL DATETIME 格式: "2025-10-30 15:31:00"
        // 轉換為 ISO 格式: "2025-10-30T15:31:00.000Z"
        isoDate = new Date(msg.created_at).toISOString()
      }

      return {
        id: msg.id,
        room_id: msg.room_id,
        sender_id: msg.sender_id,
        sender_name: msg.sender_name,
        sender_avatar: msg.sender_avatar,
        message: msg.message,
        message_type: msg.message_type,
        file_url: msg.file_url,
        file_name: msg.file_name,
        file_size: msg.file_size,
        thumbnail_url: msg.thumbnail_url,
        is_read: msg.is_read,
        created_at: isoDate,
      }
    })

    // ============================================
    // 步驟 3: 標記訊息為已讀 (僅標記對方發送的訊息)
    // ============================================
    await query(
      `UPDATE customer_service_messages 
       SET is_read = 1 
       WHERE room_id = ${roomId} AND sender_id != ${userId} AND is_read = 0`
    )

    res.json({
      success: true,
      messages: formattedMessages,
      pagination: {
        limit,
        offset,
        hasMore: messages.length === limit,
      },
    })
  } catch (error) {
    console.error('取得訊息失敗:', error)
    res.status(500).json({
      success: false,
      message: '取得訊息失敗',
      error: error.message,
    })
  }
}

/**
 * 取得使用者所有歷史聊天室的訊息
 *
 * @route GET /api/customer-service/history
 * @access Private (需登入)
 * @description 返回使用者所有聊天室及其訊息，用於歷史記錄查看
 */
export async function getAllHistory(req, res) {
  try {
    const userId = req.user?.userId || req.user?.fullUser?.id

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: '未授權: 無法取得使用者 ID',
      })
    }

    // ============================================
    // 步驟 1: 取得使用者所有聊天室
    // ============================================
    const rooms = await query(
      `SELECT 
        csr.*,
        u.name as agent_name,
        u.avatar as agent_avatar,
        (SELECT COUNT(*) FROM customer_service_messages 
         WHERE room_id = csr.id) as message_count
      FROM customer_service_rooms csr
      LEFT JOIN users u ON csr.agent_id = u.id
      WHERE csr.user_id = ?
      ORDER BY csr.updated_at DESC`,
      [userId]
    )

    // ============================================
    // 步驟 2: 取得每個聊天室的訊息
    // ============================================
    const roomsWithMessages = await Promise.all(
      rooms.map(async (room) => {
        const messages = await query(
          `SELECT csm.id, csm.room_id, csm.sender_id, csm.message, csm.message_type,
                  csm.file_url, csm.file_name, csm.file_size, csm.thumbnail_url,
                  csm.is_read, csm.created_at,
                  u.name as sender_name, 
                  COALESCE(u.nickname, u.name) as sender_display_name,
                  u.avatar as sender_avatar 
           FROM customer_service_messages csm 
           LEFT JOIN users u ON csm.sender_id = u.id 
           WHERE csm.room_id = ? 
           ORDER BY csm.created_at ASC`,
          [room.id]
        )

        // 格式化訊息時間
        const formattedMessages = messages.map((msg) => ({
          ...msg,
          created_at: msg.created_at
            ? new Date(msg.created_at).toISOString()
            : null,
        }))

        return {
          ...room,
          messages: formattedMessages,
          created_at: room.created_at
            ? new Date(room.created_at).toISOString()
            : null,
          updated_at: room.updated_at
            ? new Date(room.updated_at).toISOString()
            : null,
          closed_at: room.closed_at
            ? new Date(room.closed_at).toISOString()
            : null,
        }
      })
    )

    res.json({
      success: true,
      history: roomsWithMessages,
      total: rooms.length,
    })
  } catch (error) {
    console.error('取得歷史記錄失敗:', error)
    res.status(500).json({
      success: false,
      message: '取得歷史記錄失敗',
      error: error.message,
    })
  }
}

/**
 * 上傳聊天圖片到 ImageKit
 *
 * @route POST /api/customer-service/upload
 * @access Private (需登入)
 * @body {string} file - Base64 編碼的圖片
 * @body {string} fileName - 檔案名稱
 * @body {number} roomId - 聊天室 ID
 */
export async function uploadChatImage(req, res) {
  try {
    const userId = req.user?.userId || req.user?.fullUser?.id
    const { file, fileName } = req.body
    const roomId = parseInt(req.body.roomId)

    console.log('圖片上傳請求:', {
      userId,
      roomId,
      fileName,
      fileLength: file?.length || 0,
    })

    // ============================================
    // 步驟 1: 驗證使用者是否有權限存取此聊天室
    // ============================================
    const room = await query(
      `SELECT * FROM customer_service_rooms 
       WHERE id = ${roomId} AND (user_id = ${userId} OR agent_id = ${userId})`
    )

    if (room.length === 0) {
      console.log('無權存取聊天室:', { roomId, userId })
      return res.status(403).json({
        success: false,
        message: '無權存取此聊天室',
      })
    }

    console.log('聊天室驗證通過:', room[0])

    // ============================================
    // 步驟 2: 上傳圖片到 ImageKit
    // ============================================
    const uploadResult = await imagekit.upload({
      file, // Base64 字串或 Buffer
      fileName: `chat_${roomId}_${Date.now()}_${fileName}`,
      folder: '/customer_service/chat_images', // ImageKit 資料夾路徑
      useUniqueFileName: true,
      tags: [`room_${roomId}`, `user_${userId}`],
    })

    console.log('ImageKit 上傳成功:', {
      url: uploadResult.url,
      size: uploadResult.size,
    })

    // ============================================
    // 步驟 3: 儲存圖片訊息到資料庫
    // ============================================
    // 處理可能為 NULL 的值
    const fileSize = uploadResult.size || null
    const thumbnailUrl = uploadResult.thumbnailUrl || uploadResult.url || null
    const safeFileName = uploadResult.name.replace(/'/g, "''") // SQL 字串轉義

    const result = await query(
      `INSERT INTO customer_service_messages 
       (room_id, sender_id, message_type, file_url, file_name, file_size, thumbnail_url) 
       VALUES (${roomId}, ${userId}, 'image', '${uploadResult.url}', '${safeFileName}', ${fileSize ? fileSize : 'NULL'}, ${thumbnailUrl ? `'${thumbnailUrl}'` : 'NULL'})`
    )

    console.log('訊息儲存成功:', result.insertId)

    res.json({
      success: true,
      message: '圖片上傳成功',
      imageUrl: uploadResult.url,
      thumbnailUrl: uploadResult.thumbnailUrl || uploadResult.url,
      messageId: result.insertId,
    })
  } catch (error) {
    console.error('圖片上傳失敗:', error)
    res.status(500).json({
      success: false,
      message: '圖片上傳失敗',
      error: error.message,
    })
  }
}

/**
 * 更新聊天室狀態
 *
 * @route PATCH /api/customer-service/rooms/:roomId/status
 * @access Private (需登入,且為該聊天室參與者)
 * @body {string} status - 新狀態 waiting/active/closed
 */
export async function updateRoomStatus(req, res) {
  try {
    const userId = req.user?.userId || req.user?.fullUser?.id
    const roomId = parseInt(req.params.roomId)
    const { status } = req.body

    // 驗證狀態值
    const validStatuses = ['waiting', 'active', 'closed']
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: '無效的狀態值',
      })
    }

    // 驗證權限
    const room = await query(
      `SELECT * FROM customer_service_rooms 
       WHERE id = ? AND (user_id = ? OR agent_id = ?)`,
      [roomId, userId, userId]
    )

    if (room.length === 0) {
      return res.status(403).json({
        success: false,
        message: '無權修改此聊天室',
      })
    }

    // 更新狀態
    const updateData = { status }
    if (status === 'closed') {
      updateData.closed_at = new Date()
    }

    await query(
      `UPDATE customer_service_rooms 
       SET status = ?, closed_at = ? 
       WHERE id = ?`,
      [status, updateData.closed_at || null, roomId]
    )

    res.json({
      success: true,
      message: '聊天室狀態已更新',
      status,
    })
  } catch (error) {
    console.error('更新狀態失敗:', error)
    res.status(500).json({
      success: false,
      message: '更新狀態失敗',
      error: error.message,
    })
  }
}

/**
 * 分配客服人員 (Admin 專用)
 *
 * @route PATCH /api/customer-service/rooms/:roomId/assign
 * @access Private (需登入且為 admin)
 * @body {number} agentId - 客服人員 ID
 */
export async function assignAgent(req, res) {
  try {
    const roomId = parseInt(req.params.roomId)
    const { agentId } = req.body

    // 驗證是否為 admin
    if (req.user.access !== 'admin') {
      return res.status(403).json({
        success: false,
        message: '僅管理員可分配客服',
      })
    }

    // 驗證客服人員是否存在且為 admin
    const agent = await query(
      'SELECT * FROM users WHERE id = ? AND access = "admin"',
      [agentId]
    )

    if (agent.length === 0) {
      return res.status(404).json({
        success: false,
        message: '客服人員不存在',
      })
    }

    // 分配客服並更新狀態為 active
    await query(
      `UPDATE customer_service_rooms 
       SET agent_id = ?, status = 'active' 
       WHERE id = ?`,
      [agentId, roomId]
    )

    // 發送系統訊息通知
    await query(
      `INSERT INTO customer_service_messages 
       (room_id, sender_id, message, message_type) 
       VALUES (?, ?, ?, 'system')`,
      [roomId, agentId, `客服 ${agent[0].name} 已加入對話`]
    )

    res.json({
      success: true,
      message: '客服人員已分配',
      agent: agent[0],
    })
  } catch (error) {
    console.error('分配客服失敗:', error)
    res.status(500).json({
      success: false,
      message: '分配客服失敗',
      error: error.message,
    })
  }
}

/**
 * AI 轉人工功能 (預留)
 *
 * 流程:
 * 1. 從 AI 聊天室建立客服聊天室
 * 2. 複製 AI 對話上下文
 * 3. 更新 AI 聊天室狀態
 *
 * @route POST /api/customer-service/transfer-from-ai
 * @access Private (需登入)
 * @body {number} aiRoomId - AI 聊天室 ID
 * @body {string} context - 轉接上下文
 */
export async function transferFromAI(req, res) {
  try {
    const userId = req.user?.userId || req.user?.fullUser?.id
    const { aiRoomId, context } = req.body

    // ============================================
    // 步驟 1: 驗證 AI 聊天室
    // ============================================
    const aiRoom = await query(
      'SELECT * FROM ai_chat_rooms WHERE id = ? AND user_id = ?',
      [aiRoomId, userId]
    )

    if (aiRoom.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'AI 聊天室不存在',
      })
    }

    if (aiRoom[0].transferred_to_human) {
      return res.status(400).json({
        success: false,
        message: '此對話已轉接過',
      })
    }

    // ============================================
    // 步驟 2: 建立客服聊天室
    // ============================================
    const result = await query(
      `INSERT INTO customer_service_rooms 
       (user_id, subject, priority, status, source, ai_chat_room_id, transfer_context) 
       VALUES (?, ?, 'high', 'waiting', 'ai_transfer', ?, ?)`,
      [userId, 'AI 轉接', aiRoomId, context || null]
    )

    const roomId = result.insertId

    // ============================================
    // 步驟 3: 更新 AI 聊天室狀態
    // ============================================
    await query(
      `UPDATE ai_chat_rooms 
       SET transferred_to_human = TRUE, 
           transfer_requested_at = NOW(), 
           customer_service_room_id = ? 
       WHERE id = ?`,
      [roomId, aiRoomId]
    )

    // ============================================
    // 步驟 4: 發送系統訊息
    // ============================================
    await query(
      `INSERT INTO customer_service_messages 
       (room_id, sender_id, message, message_type) 
       VALUES (?, ?, ?, 'system')`,
      [roomId, userId, '已從 AI 助手轉接,客服人員將盡快為您服務。']
    )

    // 若有上下文,也加入訊息
    if (context) {
      await query(
        `INSERT INTO customer_service_messages 
         (room_id, sender_id, message, message_type) 
         VALUES (?, ?, ?, 'system')`,
        [roomId, userId, `對話紀錄:\n${context}`]
      )
    }

    res.status(201).json({
      success: true,
      message: 'AI 轉人工成功',
      roomId,
    })
  } catch (error) {
    console.error('AI 轉人工失敗:', error)
    res.status(500).json({
      success: false,
      message: 'AI 轉人工失敗',
      error: error.message,
    })
  }
}

/**
 * 提交客服滿意度評分
 *
 * 流程:
 * 1. 驗證聊天室是否存在且已關閉
 * 2. 驗證評分有效性 (1-5 星)
 * 3. 檢查是否已評分 (一個聊天室只能評分一次)
 * 4. 寫入評分資料
 *
 * @route POST /api/customer-service/rooms/:roomId/rating
 * @access Private (需登入)
 * @body {number} rating - 評分 (1-5)
 * @body {string} comment - 評價留言 (選填)
 */
export async function submitRating(req, res) {
  try {
    const userId = req.user?.userId || req.user?.fullUser?.id
    const { roomId } = req.params
    const { rating, comment = null } = req.body

    console.log('使用者提交評分:', { userId, roomId, rating, comment })

    // ============================================
    // 步驟 1: 驗證評分有效性
    // ============================================
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: '評分必須在 1-5 之間',
      })
    }

    // ============================================
    // 步驟 2: 檢查聊天室是否存在
    // ============================================
    const rooms = await query(
      'SELECT * FROM customer_service_rooms WHERE id = ?',
      [roomId]
    )

    if (rooms.length === 0) {
      return res.status(404).json({
        success: false,
        message: '聊天室不存在',
      })
    }

    const room = rooms[0]

    // ============================================
    // 步驟 3: 驗證權限 (只有聊天室的使用者可以評分)
    // ============================================
    if (room.user_id !== userId) {
      return res.status(403).json({
        success: false,
        message: '您沒有權限為此聊天室評分',
      })
    }

    // ============================================
    // 步驟 4: 檢查聊天室是否已關閉
    // ============================================
    if (room.status !== 'closed') {
      return res.status(400).json({
        success: false,
        message: '聊天室尚未關閉，無法評分',
      })
    }

    // ============================================
    // 步驟 5: 檢查客服人員是否存在
    // ============================================
    if (!room.agent_id) {
      return res.status(400).json({
        success: false,
        message: '此聊天室沒有客服人員，無法評分',
      })
    }

    // ============================================
    // 步驟 6: 檢查是否已評分
    // ============================================
    const existingRatings = await query(
      'SELECT * FROM customer_service_ratings WHERE room_id = ?',
      [roomId]
    )

    if (existingRatings.length > 0) {
      return res.status(400).json({
        success: false,
        message: '您已經為此聊天室評分過了',
      })
    }

    // ============================================
    // 步驟 7: 寫入評分資料
    // ============================================
    await query(
      `INSERT INTO customer_service_ratings 
       (room_id, user_id, agent_id, rating, comment) 
       VALUES (?, ?, ?, ?, ?)`,
      [roomId, userId, room.agent_id, rating, comment]
    )

    console.log('評分提交成功')

    res.json({
      success: true,
      message: '感謝您的評分！',
    })
  } catch (error) {
    console.error('提交評分失敗:', error)
    res.status(500).json({
      success: false,
      message: '提交評分失敗',
      error: error.message,
    })
  }
}
