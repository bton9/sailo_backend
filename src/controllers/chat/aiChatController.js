/**
 * AI 客服 Controller
 * 路徑: sailo_backend/src/controllers/chat/aiChatController.js
 *
 * 功能說明:
 * - 處理 AI 聊天室相關請求
 * - 整合 Ollama AI 服務
 * - 管理對話上下文
 * - 支援轉接人工客服
 *
 * 資料表:
 * - ai_chat_rooms: AI 聊天室
 * - ai_chat_messages: AI 對話訊息
 * - customer_service_rooms: 人工客服聊天室 (轉接用)
 *
 * 使用方式:
 * import { createAIRoom, sendAIMessage, transferToHuman } from '@/controllers/chat/aiChatController'
 */

import { query } from '../../config/database.js'
import {
  generateAIResponse,
  getWelcomeMessage,
  getTransferConfirmMessage,
  getErrorMessage,
} from '../../services/ollamaService.js'

/**
 * 建立或取得 AI 聊天室
 *
 * 流程:
 * 1. 檢查使用者是否有進行中的 AI 聊天室
 * 2. 若有則返回現有聊天室
 * 3. 若無則建立新聊天室並發送歡迎訊息
 *
 * @route POST /api/ai-chat/rooms
 * @access Private (需登入)
 *
 * @returns {Object} { success, room, welcomeMessage }
 */
export async function createOrGetAIRoom(req, res) {
  try {
    const userId = req.user.userId

    // 檢查是否有進行中的 AI 聊天室 (未轉人工)
    const existingRooms = await query(
      `SELECT * FROM ai_chat_rooms 
       WHERE user_id = ? 
         AND is_active = TRUE 
         AND transferred_to_human = FALSE
       ORDER BY created_at DESC 
       LIMIT 1`,
      [userId]
    )

    // 若已有聊天室,直接返回
    if (existingRooms.length > 0) {
      return res.json({
        success: true,
        room: existingRooms[0],
        isNew: false,
      })
    }

    // 建立新的 AI 聊天室
    const result = await query(
      `INSERT INTO ai_chat_rooms 
       (user_id, session_name, is_active, transferred_to_human) 
       VALUES (?, 'AI 助手對話', TRUE, FALSE)`,
      [userId]
    )

    const roomId = result.insertId

    // 取得新建立的聊天室資料
    const newRoom = await query(
      'SELECT * FROM ai_chat_rooms WHERE id = ? LIMIT 1',
      [roomId]
    )

    // 生成歡迎訊息
    const welcomeMessage = getWelcomeMessage()

    res.json({
      success: true,
      room: newRoom[0],
      welcomeMessage,
      isNew: true,
    })
  } catch (error) {
    console.error('❌ 建立 AI 聊天室失敗:', error)
    res.status(500).json({
      success: false,
      message: '建立聊天室失敗',
      error: error.message,
    })
  }
}

/**
 * 發送訊息給 AI 並取得回應
 *
 * 流程:
 * 1. 儲存使用者訊息
 * 2. 載入對話歷史
 * 3. 呼叫 Ollama AI 生成回應
 * 4. 儲存 AI 回應
 * 5. 判斷是否需要轉接人工
 *
 * @route POST /api/ai-chat/messages
 * @access Private (需登入)
 *
 * @body {number} roomId - 聊天室 ID
 * @body {string} message - 使用者訊息
 *
 * @returns {Object} { success, userMessage, aiMessage, shouldTransfer }
 */
export async function sendAIMessage(req, res) {
  try {
    const userId = req.user.userId
    const { roomId, message } = req.body

    // 驗證輸入
    if (!roomId || !message?.trim()) {
      return res.status(400).json({
        success: false,
        message: '缺少必要參數',
      })
    }

    // 驗證聊天室擁有者
    const rooms = await query(
      'SELECT * FROM ai_chat_rooms WHERE id = ? AND user_id = ? LIMIT 1',
      [roomId, userId]
    )

    if (rooms.length === 0) {
      return res.status(403).json({
        success: false,
        message: '無權訪問此聊天室',
      })
    }

    const room = rooms[0]

    // 檢查聊天室是否已轉人工
    if (room.transferred_to_human) {
      return res.status(400).json({
        success: false,
        message: '此聊天室已轉接人工客服',
      })
    }

    // 載入對話歷史 (最近 10 輪)
    const historyMessages = await query(
      `SELECT user_message, ai_response 
       FROM ai_chat_messages 
       WHERE room_id = ? 
       ORDER BY created_at DESC 
       LIMIT 10`,
      [roomId]
    )

    // 轉換為 Ollama 格式 (反轉順序,因為是倒序查詢)
    const conversationHistory = historyMessages.reverse().flatMap((msg) => [
      { role: 'user', content: msg.user_message },
      { role: 'assistant', content: msg.ai_response },
    ])

    // 呼叫 AI 生成回應
    // 🆕 v4.0.0: 傳遞 userId 以支援資料庫查詢
    let aiResponse, tokensUsed, shouldTransfer, queryExecuted

    try {
      const result = await generateAIResponse(
        message.trim(),
        conversationHistory,
        userId // 🆕 傳遞使用者 ID
      )
      aiResponse = result.response
      tokensUsed = result.tokens
      shouldTransfer = result.shouldTransfer
      queryExecuted = result.queryExecuted || false // 🆕 記錄是否執行了資料庫查詢
    } catch (error) {
      console.error('❌ AI 生成回應失敗:', error)
      aiResponse = getErrorMessage(error)
      tokensUsed = 0
      shouldTransfer = true // 發生錯誤時建議轉人工
      queryExecuted = false
    }

    // 儲存對話記錄
    const messageResult = await query(
      `INSERT INTO ai_chat_messages 
       (room_id, user_id, user_message, ai_response, tokens_used, model_version, is_transfer_request) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        roomId,
        userId,
        message.trim(),
        aiResponse,
        tokensUsed,
        'llama3.1:8b',
        shouldTransfer,
      ]
    )

    const messageId = messageResult.insertId

    // 更新聊天室活動時間
    await query('UPDATE ai_chat_rooms SET updated_at = NOW() WHERE id = ?', [
      roomId,
    ])

    res.json({
      success: true,
      message: {
        id: messageId,
        roomId,
        userMessage: message.trim(),
        aiResponse,
        tokensUsed,
        shouldTransfer,
        queryExecuted, // 🆕 v4.0.0: 返回是否執行了資料庫查詢
        createdAt: new Date(),
      },
    })
  } catch (error) {
    console.error('❌ 發送 AI 訊息失敗:', error)
    res.status(500).json({
      success: false,
      message: '發送訊息失敗',
      error: error.message,
    })
  }
}

/**
 * 取得 AI 聊天室訊息記錄
 *
 * @route GET /api/ai-chat/rooms/:roomId/messages
 * @access Private (需登入)
 *
 * @returns {Object} { success, messages }
 */
export async function getAIMessages(req, res) {
  try {
    const userId = req.user.userId
    const { roomId } = req.params

    // 驗證聊天室擁有者
    const rooms = await query(
      'SELECT * FROM ai_chat_rooms WHERE id = ? AND user_id = ? LIMIT 1',
      [roomId, userId]
    )

    if (rooms.length === 0) {
      return res.status(403).json({
        success: false,
        message: '無權訪問此聊天室',
      })
    }

    // 取得訊息記錄
    const messages = await query(
      `SELECT 
         id, room_id, user_message, ai_response, 
         tokens_used, model_version, is_transfer_request, created_at
       FROM ai_chat_messages 
       WHERE room_id = ? 
       ORDER BY created_at ASC`,
      [roomId]
    )

    res.json({
      success: true,
      messages,
    })
  } catch (error) {
    console.error('❌ 取得 AI 訊息失敗:', error)
    res.status(500).json({
      success: false,
      message: '取得訊息失敗',
      error: error.message,
    })
  }
}

/**
 * 轉接人工客服
 *
 * 流程:
 * 1. 標記 AI 聊天室為已轉人工
 * 2. 建立新的人工客服聊天室
 * 3. 整理對話上下文並傳遞
 * 4. 發送系統訊息通知
 *
 * @route POST /api/ai-chat/transfer
 * @access Private (需登入)
 *
 * @body {number} roomId - AI 聊天室 ID
 *
 * @returns {Object} { success, customerServiceRoom }
 */
export async function transferToHuman(req, res) {
  try {
    const userId = req.user.userId
    const { roomId } = req.body

    // 驗證 AI 聊天室
    const aiRooms = await query(
      'SELECT * FROM ai_chat_rooms WHERE id = ? AND user_id = ? LIMIT 1',
      [roomId, userId]
    )

    if (aiRooms.length === 0) {
      return res.status(403).json({
        success: false,
        message: '無權訪問此聊天室',
      })
    }

    const aiRoom = aiRooms[0]

    // 檢查是否已轉接
    if (aiRoom.transferred_to_human) {
      return res.status(400).json({
        success: false,
        message: '此聊天室已轉接人工客服',
        customerServiceRoomId: aiRoom.customer_service_room_id,
      })
    }

    // 整理對話上下文
    const messages = await query(
      `SELECT user_message, ai_response, created_at 
       FROM ai_chat_messages 
       WHERE room_id = ? 
       ORDER BY created_at ASC`,
      [roomId]
    )

    // 🆕 v3.2.0: 只保留 3 分鐘內的對話記錄
    const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000)
    const recentMessages = messages.filter((msg) => {
      const msgTime = new Date(msg.created_at)
      return msgTime >= threeMinutesAgo
    })

    // 如果沒有最近的對話，使用預設訊息
    let context = ''
    if (recentMessages.length === 0) {
      context = '(近期無對話記錄)'
    } else {
      context = recentMessages
        .map((msg, index) => {
          const timestamp = new Date(msg.created_at).toLocaleString('zh-TW')
          return `[${index + 1}] ${timestamp}\n使用者: ${msg.user_message}\nAI: ${msg.ai_response}`
        })
        .join('\n\n---\n\n')
    }

    const transferContext = `【從 AI 客服轉接】\n\n對話記錄:\n(僅顯示 3 分鐘內的對話)\n\n${context}`

    // 🔧 簡化轉接流程: 只建立客服聊天室，不手動更新 ai_chat_rooms
    // transferred_to_human 欄位由資料庫自動管理或透過關聯推斷

    // 步驟 1: 建立人工客服聊天室並設定 ai_chat_room_id
    const csResult = await query(
      `INSERT INTO customer_service_rooms 
       (user_id, status, priority, subject, source, ai_chat_room_id, transfer_context) 
       VALUES (?, 'waiting', 'medium', 'AI 轉人工', 'ai_transfer', ?, ?)`,
      [userId, roomId, transferContext]
    )

    const csRoomId = csResult.insertId

    // 步驟 2: 在人工客服聊天室發送系統訊息
    await query(
      `INSERT INTO customer_service_messages 
       (room_id, sender_id, message, message_type) 
       VALUES (?, ?, ?, 'system')`,
      [csRoomId, userId, getTransferConfirmMessage()]
    )

    // 步驟 3: 取得新建立的客服聊天室資料
    const newCSRoom = await query(
      'SELECT * FROM customer_service_rooms WHERE id = ? LIMIT 1',
      [csRoomId]
    )

    res.json({
      success: true,
      message: '已轉接人工客服',
      customerServiceRoom: newCSRoom[0],
    })
  } catch (error) {
    console.error('❌ 轉接人工客服失敗:', error)
    res.status(500).json({
      success: false,
      message: '轉接失敗',
      error: error.message,
    })
  }
}

/**
 * 取得使用者的 AI 聊天室列表
 *
 * @route GET /api/ai-chat/rooms
 * @access Private (需登入)
 *
 * @returns {Object} { success, rooms }
 */
export async function getUserAIRooms(req, res) {
  try {
    const userId = req.user.userId

    const rooms = await query(
      `SELECT 
         acr.*,
         (SELECT COUNT(*) FROM ai_chat_messages WHERE room_id = acr.id) as message_count
       FROM ai_chat_rooms acr
       WHERE acr.user_id = ?
       ORDER BY acr.updated_at DESC`,
      [userId]
    )

    res.json({
      success: true,
      rooms,
    })
  } catch (error) {
    console.error('❌ 取得 AI 聊天室列表失敗:', error)
    res.status(500).json({
      success: false,
      message: '取得聊天室列表失敗',
      error: error.message,
    })
  }
}

export default {
  createOrGetAIRoom,
  sendAIMessage,
  getAIMessages,
  transferToHuman,
  getUserAIRooms,
}
