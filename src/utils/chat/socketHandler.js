/**
 * WebSocket 事件處理器
 * 路徑: sailo_backend/src/utils/chat/socketHandler.js
 *
 * 功能說明:
 * - 處理 Socket.IO 即時通訊事件
 * - 聊天室加入/離開管理
 * - 即時訊息傳送/接收
 * - 已讀狀態同步
 * - 輸入狀態通知 (typing indicator)
 * - 客服上線/離線狀態
 *
 * Socket Events:
 * - connection: 客戶端連線
 * - disconnect: 客戶端斷線
 * - join_room: 加入聊天室
 * - leave_room: 離開聊天室
 * - send_message: 發送訊息
 * - message_read: 訊息已讀
 * - typing: 輸入中
 * - agent_online: 客服上線
 * - agent_offline: 客服離線
 *
 * 架構: Event-Driven Architecture
 */

import { query } from '../../config/database.js'
import { verifyToken } from '../jwt.js' // 用於驗證 JWT Token

// ============================================
// 儲存使用者 Socket 連線對應表
// ============================================
const userSockets = new Map() // userId -> Set<socketId>
const socketUsers = new Map() // socketId -> userId

/**
 * 設置 Socket.IO 事件處理器
 *
 * @param {Server} io - Socket.IO 伺服器實例
 */
export function setupSocketHandlers(io) {
  // ============================================
  // 認證中介軟體
  // ============================================
  io.use(async (socket, next) => {
    try {
      // 從握手資料中取得 Token (優先從 Cookie,其次從 auth/query)
      let token = null

      // 1. 嘗試從 Cookie 中取得 (與 authV2 一致)
      if (socket.handshake.headers.cookie) {
        const cookies = socket.handshake.headers.cookie
          .split(';')
          .reduce((acc, cookie) => {
            const [key, value] = cookie.trim().split('=')
            acc[key] = value
            return acc
          }, {})

        token = cookies.access_token
      }

      // 2. 如果 Cookie 沒有,嘗試從 auth 或 query 取得
      if (!token) {
        token = socket.handshake.auth.token || socket.handshake.query.token
      }

      if (!token) {
        return next(new Error('Authentication error: No token provided'))
      }

      // 驗證 JWT Token
      const decoded = verifyToken(token)

      if (!decoded) {
        return next(new Error('Authentication error: Invalid token'))
      }

      // 將使用者資訊附加到 socket 物件
      // Token payload 使用 userId, email, access
      socket.userId = decoded.userId || decoded.id // 相容兩種格式
      socket.userEmail = decoded.email
      socket.userAccess = decoded.access

      console.log(
        `✅ Socket 認證成功: User ${socket.userId} (${decoded.email})`
      )
      next()
    } catch (error) {
      console.error(' Socket 認證失敗:', error.message)
      next(new Error('Authentication error'))
    }
  })

  // ============================================
  // 連線事件
  // ============================================
  io.on('connection', (socket) => {
    const userId = socket.userId

    console.log(`🔌 使用者連線: ${userId} (Socket ID: ${socket.id})`)

    // 記錄使用者 Socket 連線
    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set())
    }
    userSockets.get(userId).add(socket.id)
    socketUsers.set(socket.id, userId)

    // 通知使用者已連線 (用於多裝置同步)
    socket.emit('connected', {
      userId,
      socketId: socket.id,
      message: 'WebSocket 連線成功',
    })

    // ============================================
    // 事件: 加入聊天室
    // ============================================
    /**
     * 加入聊天室
     *
     * Client emit:
     * socket.emit('join_room', { roomId: 123 })
     *
     * Server broadcast:
     * socket.to(roomId).emit('user_joined', { userId, userName })
     */
    socket.on('join_room', async (data) => {
      try {
        const { roomId } = data
        const roomIdInt = parseInt(roomId)

        // 驗證使用者是否有權限加入此聊天室
        const room = await query(
          `SELECT * FROM customer_service_rooms 
           WHERE id = ${roomIdInt} AND (user_id = ${userId} OR agent_id = ${userId})`
        )

        if (room.length === 0) {
          socket.emit('error', {
            message: '無權加入此聊天室',
            event: 'join_room',
          })
          return
        }

        // 加入 Socket.IO Room
        socket.join(`room_${roomId}`)

        console.log(`👥 使用者 ${userId} 加入聊天室 ${roomId}`)

        // 取得使用者資訊
        const user = await query(
          `SELECT id, name, avatar FROM users WHERE id = ${userId}`
        )

        // 通知聊天室內其他人
        socket.to(`room_${roomId}`).emit('user_joined', {
          roomId,
          userId,
          userName: user[0]?.name || '使用者',
          userAvatar: user[0]?.avatar,
          timestamp: new Date(),
        })

        // 回傳加入成功
        socket.emit('room_joined', {
          roomId,
          message: '已加入聊天室',
        })
      } catch (error) {
        console.error(' 加入聊天室失敗:', error)
        socket.emit('error', {
          message: '加入聊天室失敗',
          event: 'join_room',
          error: error.message,
        })
      }
    })

    // ============================================
    // 事件: 離開聊天室
    // ============================================
    /**
     * 離開聊天室
     *
     * Client emit:
     * socket.emit('leave_room', { roomId: 123 })
     */
    socket.on('leave_room', async (data) => {
      try {
        const { roomId } = data

        socket.leave(`room_${roomId}`)

        console.log(`👋 使用者 ${userId} 離開聊天室 ${roomId}`)

        // 通知聊天室內其他人
        socket.to(`room_${roomId}`).emit('user_left', {
          roomId,
          userId,
          timestamp: new Date(),
        })

        socket.emit('room_left', {
          roomId,
          message: '已離開聊天室',
        })
      } catch (error) {
        console.error(' 離開聊天室失敗:', error)
        socket.emit('error', {
          message: '離開聊天室失敗',
          event: 'leave_room',
        })
      }
    })

    // ============================================
    // 事件: 發送訊息
    // ============================================
    /**
     * 發送訊息
     *
     * Client emit:
     * socket.emit('send_message', {
     *   roomId: 123,
     *   message: '您好',
     *   messageType: 'text' // text/image/file/system
     * })
     *
     * Server broadcast:
     * io.to(roomId).emit('new_message', { id, roomId, senderId, message, ... })
     */
    socket.on('send_message', async (data) => {
      try {
        const {
          roomId,
          message,
          messageType = 'text',
          fileUrl,
          fileName,
          fileSize,
          thumbnailUrl,
        } = data
        const roomIdInt = parseInt(roomId)

        // 驗證權限
        const room = await query(
          `SELECT * FROM customer_service_rooms 
           WHERE id = ${roomIdInt} AND (user_id = ${userId} OR agent_id = ${userId})`
        )

        if (room.length === 0) {
          socket.emit('error', {
            message: '無權發送訊息',
            event: 'send_message',
          })
          return
        }

        // ============================================
        // 🆕 檢查是否為第一則訊息
        // 如果是，先插入歡迎訊息
        // ============================================
        const messageCount = await query(
          `SELECT COUNT(*) as count FROM customer_service_messages 
           WHERE room_id = ${roomIdInt}`
        )

        const isFirstMessage = messageCount[0].count === 0

        if (isFirstMessage) {
          // 插入歡迎訊息
          const welcomeResult = await query(
            `INSERT INTO customer_service_messages 
             (room_id, sender_id, message, message_type) 
             VALUES (${roomIdInt}, ${userId}, '您好!我們已收到您的諮詢,客服人員將盡快為您服務。', 'system')`
          )

          // 取得發送者資訊
          const sender = await query(
            `SELECT id, name, avatar FROM users WHERE id = ${userId}`
          )

          // 建立歡迎訊息物件
          const welcomeMessage = {
            id: welcomeResult.insertId,
            room_id: roomIdInt,
            sender_id: userId,
            sender_name: sender[0]?.name || '系統',
            sender_avatar: sender[0]?.avatar,
            message: '您好!我們已收到您的諮詢,客服人員將盡快為您服務。',
            message_type: 'system',
            file_url: null,
            file_name: null,
            file_size: null,
            thumbnail_url: null,
            is_read: false,
            created_at: new Date().toISOString(),
          }

          // 廣播歡迎訊息
          io.to(`room_${roomId}`).emit('new_message', welcomeMessage)

          console.log(`📢 發送歡迎訊息到聊天室 ${roomId}`)
        }

        // 儲存訊息到資料庫
        const result = await query(
          `INSERT INTO customer_service_messages 
           (room_id, sender_id, message, message_type, file_url, file_name, file_size, thumbnail_url) 
           VALUES (${roomIdInt}, ${userId}, ${message ? `'${message.replace(/'/g, "''")}'` : 'NULL'}, '${messageType}', ${fileUrl ? `'${fileUrl}'` : 'NULL'}, ${fileName ? `'${fileName.replace(/'/g, "''")}'` : 'NULL'}, ${fileSize || 'NULL'}, ${thumbnailUrl ? `'${thumbnailUrl}'` : 'NULL'})`
        )

        // 更新聊天室的 updated_at
        await query(
          `UPDATE customer_service_rooms SET updated_at = NOW() WHERE id = ${roomIdInt}`
        )

        // 取得發送者資訊
        const sender = await query(
          `SELECT id, name, avatar FROM users WHERE id = ${userId}`
        )

        // 建立完整訊息物件
        const newMessage = {
          id: result.insertId,
          room_id: roomId,
          sender_id: userId,
          sender_name: sender[0]?.name || '使用者',
          sender_avatar: sender[0]?.avatar,
          message,
          message_type: messageType,
          file_url: fileUrl,
          file_name: fileName,
          file_size: fileSize,
          thumbnail_url: thumbnailUrl,
          is_read: false,
          created_at: new Date().toISOString(), // 使用 ISO 字串格式
        }

        console.log(`💬 使用者 ${userId} 在聊天室 ${roomId} 發送訊息`)

        // 廣播訊息給聊天室內所有人 (包含發送者)
        io.to(`room_${roomId}`).emit('new_message', newMessage)

        // 若對方不在聊天室,發送通知 (可擴充推播通知)
        const otherUserId =
          room[0].user_id === userId ? room[0].agent_id : room[0].user_id
        if (otherUserId) {
          // 檢查對方是否在線上且在此聊天室
          const otherUserSockets = userSockets.get(otherUserId)
          if (otherUserSockets) {
            otherUserSockets.forEach((socketId) => {
              const otherSocket = io.sockets.sockets.get(socketId)
              // 若對方不在此聊天室,發送新訊息通知
              if (otherSocket && !otherSocket.rooms.has(`room_${roomId}`)) {
                otherSocket.emit('new_message_notification', {
                  roomId,
                  message: newMessage,
                })
              }
            })
          }
        }
      } catch (error) {
        console.error(' 發送訊息失敗:', error)
        socket.emit('error', {
          message: '發送訊息失敗',
          event: 'send_message',
          error: error.message,
        })
      }
    })

    // ============================================
    // 事件: 訊息已讀
    // ============================================
    /**
     * 標記訊息為已讀
     *
     * Client emit:
     * socket.emit('message_read', { roomId: 123, messageIds: [1, 2, 3] })
     *
     * Server broadcast:
     * socket.to(roomId).emit('messages_read', { roomId, messageIds, readBy })
     */
    socket.on('message_read', async (data) => {
      try {
        const { roomId, messageIds } = data

        if (!messageIds || messageIds.length === 0) {
          return
        }

        const roomIdInt = parseInt(roomId)
        const messageIdsStr = messageIds.map((id) => parseInt(id)).join(',')

        // 更新已讀狀態 (僅更新對方發送的訊息)
        await query(
          `UPDATE customer_service_messages 
           SET is_read = 1 
           WHERE id IN (${messageIdsStr}) AND room_id = ${roomIdInt} AND sender_id != ${userId}`
        )

        console.log(`👁️ 使用者 ${userId} 已讀訊息: ${messageIds.join(', ')}`)

        // 通知聊天室內其他人
        socket.to(`room_${roomId}`).emit('messages_read', {
          roomId,
          messageIds,
          readBy: userId,
          timestamp: new Date(),
        })
      } catch (error) {
        console.error(' 標記已讀失敗:', error)
      }
    })

    // ============================================
    // 事件: 輸入中狀態
    // ============================================
    /**
     * 通知對方使用者正在輸入
     *
     * Client emit:
     * socket.emit('typing', { roomId: 123, isTyping: true })
     *
     * Server broadcast:
     * socket.to(roomId).emit('user_typing', { roomId, userId, isTyping })
     */
    socket.on('typing', (data) => {
      const { roomId, isTyping } = data

      socket.to(`room_${roomId}`).emit('user_typing', {
        roomId,
        userId,
        isTyping,
      })
    })

    // ============================================
    // 事件: 客服上線 (Admin only)
    // ============================================
    /**
     * 客服上線通知
     *
     * Client emit:
     * socket.emit('agent_online')
     *
     * Server broadcast:
     * io.emit('agent_status_changed', { agentId, status: 'online' })
     */
    socket.on('agent_online', async () => {
      if (socket.userAccess === 'admin') {
        console.log(`🟢 客服上線: ${userId}`)

        // 更新客服狀態 (可擴充至資料庫)
        io.emit('agent_status_changed', {
          agentId: userId,
          status: 'online',
          timestamp: new Date(),
        })
      }
    })

    // ============================================
    // 事件: 客服離線 (Admin only)
    // ============================================
    socket.on('agent_offline', async () => {
      if (socket.userAccess === 'admin') {
        console.log(`🔴 客服離線: ${userId}`)

        io.emit('agent_status_changed', {
          agentId: userId,
          status: 'offline',
          timestamp: new Date(),
        })
      }
    })

    // ============================================
    // 斷線事件
    // ============================================
    socket.on('disconnect', (reason) => {
      console.log(`🔌 使用者斷線: ${userId} (原因: ${reason})`)

      // 移除 Socket 連線紀錄
      if (userSockets.has(userId)) {
        userSockets.get(userId).delete(socket.id)
        if (userSockets.get(userId).size === 0) {
          userSockets.delete(userId)
        }
      }
      socketUsers.delete(socket.id)

      // 若是客服斷線,通知所有人
      if (socket.userAccess === 'admin') {
        io.emit('agent_status_changed', {
          agentId: userId,
          status: 'offline',
          timestamp: new Date(),
        })
      }
    })

    // ============================================
    // 錯誤處理
    // ============================================
    socket.on('error', (error) => {
      console.error(` Socket 錯誤 (User ${userId}):`, error)
    })
  })

  console.log('✅ WebSocket 事件處理器已設置')
}

/**
 * 工具函式: 取得使用者的所有 Socket 連線
 *
 * @param {number} userId - 使用者 ID
 * @returns {Set<string>} Socket ID 集合
 */
export function getUserSockets(userId) {
  return userSockets.get(userId) || new Set()
}

/**
 * 工具函式: 取得目前在線使用者數量
 *
 * @returns {number} 在線使用者數
 */
export function getOnlineUserCount() {
  return userSockets.size
}

/**
 * 工具函式: 檢查使用者是否在線
 *
 * @param {number} userId - 使用者 ID
 * @returns {boolean} 是否在線
 */
export function isUserOnline(userId) {
  return userSockets.has(userId)
}

// ============================================
// 客服管理專用事件 (Admin Customer Service)
// ============================================

/**
 * 客服接單事件
 * 當客服接受聊天室時觸發
 *
 * 觸發時機: 客服點擊「接單」按鈕
 * 通知對象:
 * - 聊天室內所有成員（使用者 + 客服）
 * - 其他在線客服（聊天室列表更新）
 *
 * @param {Socket} socket - Socket 實例
 * @param {Object} data - { roomId, agentId }
 */
export function emitRoomAccepted(io, roomId, agentId, roomData) {
  console.log('📌 [Socket] 客服接單:', { roomId, agentId })

  // 通知聊天室內所有成員
  io.to(`room_${roomId}`).emit('room_status_updated', {
    roomId,
    status: 'active',
    agentId,
    message: '客服已加入對話',
    timestamp: new Date().toISOString(),
  })

  // 通知所有在線客服（更新聊天室列表）
  io.emit('room_list_updated', {
    action: 'accept',
    room: roomData,
  })
}

/**
 * 聊天室關閉事件
 * 當聊天室被關閉時觸發
 *
 * 觸發時機: 客服點擊「關閉」按鈕
 * 通知對象:
 * - 聊天室內所有成員
 * - 所有在線客服
 *
 * @param {Socket} io - Socket.IO 實例
 * @param {number} roomId - 聊天室 ID
 * @param {Object} roomData - 聊天室資料
 */
export function emitRoomClosed(io, roomId, roomData) {
  console.log('🔒 [Socket] 聊天室關閉:', roomId)

  // 通知聊天室內所有成員
  io.to(`room_${roomId}`).emit('room_status_updated', {
    roomId,
    status: 'closed',
    message: '聊天室已關閉',
    timestamp: new Date().toISOString(),
  })

  // 通知所有在線客服
  io.emit('room_list_updated', {
    action: 'close',
    room: roomData,
  })
}

/**
 * 新聊天室建立事件
 * 當使用者建立新的客服聊天室時觸發
 *
 * 觸發時機: 使用者點擊「聯絡客服」
 * 通知對象: 所有在線客服
 *
 * @param {Socket} io - Socket.IO 實例
 * @param {Object} roomData - 聊天室資料
 */
export function emitNewRoomCreated(io, roomData) {
  console.log('🆕 [Socket] 新聊天室建立:', roomData.id)

  // 通知所有在線客服
  io.emit('new_room_created', {
    room: roomData,
    timestamp: new Date().toISOString(),
  })
}

/**
 * 客服上線/離線狀態
 *
 * 用途: 追蹤客服在線狀態
 * 預留功能:
 * - 智能分配（優先分給在線客服）
 * - 顯示可用客服數量
 * - 自動排班管理
 */
const onlineAgents = new Set()

export function setAgentOnline(agentId) {
  onlineAgents.add(agentId)
  console.log('🟢 [Socket] 客服上線:', agentId, '在線數:', onlineAgents.size)
}

export function setAgentOffline(agentId) {
  onlineAgents.delete(agentId)
  console.log('🔴 [Socket] 客服離線:', agentId, '在線數:', onlineAgents.size)
}

export function getOnlineAgents() {
  return Array.from(onlineAgents)
}

export function getOnlineAgentCount() {
  return onlineAgents.size
}

// ============================================
// AI 客服預留事件
// ============================================

/**
 * AI 轉人工事件
 *
 * 未來擴充功能:
 * - AI 判斷無法處理時自動轉接
 * - 保留 AI 對話記錄
 * - 標記為高優先級
 * - 通知在線客服
 *
 * 觸發條件:
 * - AI 識別到複雜問題
 * - 使用者明確要求人工客服
 * - AI 回答失敗次數過多
 */
export function emitAITransfer(io, roomData, aiContext) {
  console.log('🤖 [Socket] AI 轉人工:', roomData.id)

  // 通知所有在線客服（高優先級）
  io.emit('ai_transfer_request', {
    room: roomData,
    aiContext: aiContext,
    priority: 'high',
    timestamp: new Date().toISOString(),
  })
}
