/**
 * AI 客服路由
 * 路徑: sailo_backend/src/routes/chat/aiChatRoutes.js
 *
 * 功能說明:
 * - 定義 AI 客服相關 API 路由
 * - 所有路由需要身份驗證
 * - 整合 Ollama AI 服務
 *
 * API 端點:
 * POST   /api/ai-chat/rooms              - 建立/取得 AI 聊天室
 * GET    /api/ai-chat/rooms              - 取得使用者所有 AI 聊天室
 * POST   /api/ai-chat/messages           - 發送訊息給 AI
 * GET    /api/ai-chat/rooms/:id/messages - 取得聊天室訊息
 * POST   /api/ai-chat/transfer           - 轉接人工客服
 *
 * 使用方式:
 * import aiChatRoutes from '@/routes/chat/aiChatRoutes'
 * app.use('/api/ai-chat', aiChatRoutes)
 */

import express from 'express'
import { authenticate } from '../../middleware/authV2.js'
import {
  createOrGetAIRoom,
  sendAIMessage,
  getAIMessages,
  transferToHuman,
  getUserAIRooms,
} from '../../controllers/chat/aiChatController.js'

const router = express.Router()

// ============================================
// AI 聊天室管理
// ============================================

/**
 * 建立或取得 AI 聊天室
 *
 * @route POST /api/ai-chat/rooms
 * @access Private (需登入)
 *
 * @description
 * 若使用者已有進行中的 AI 聊天室,返回現有聊天室
 * 若無,則建立新聊天室並返回歡迎訊息
 *
 * @returns {Object} 回應格式:
 *   - success: true/false
 *   - room: 聊天室物件
 *   - welcomeMessage: 歡迎訊息 (僅新建時)
 *   - isNew: 是否為新建立
 *
 * @example
 * // 請求
 * POST /api/ai-chat/rooms
 * Headers: { Authorization: "Bearer ..." }
 *
 * // 成功回應 (新建)
 * {
 *   "success": true,
 *   "room": { id: 1, user_id: 1, ... },
 *   "welcomeMessage": "您好！我是...",
 *   "isNew": true
 * }
 */
router.post('/rooms', authenticate, createOrGetAIRoom)

/**
 * 取得使用者所有 AI 聊天室
 *
 * @route GET /api/ai-chat/rooms
 * @access Private (需登入)
 *
 * @returns {Object} 回應格式:
 *   - success: true/false
 *   - rooms: 聊天室陣列
 *
 * @example
 * // 請求
 * GET /api/ai-chat/rooms
 * Headers: { Authorization: "Bearer ..." }
 *
 * // 成功回應
 * {
 *   "success": true,
 *   "rooms": [
 *     { id: 1, session_name: "AI 助手對話", message_count: 10, ... }
 *   ]
 * }
 */
router.get('/rooms', authenticate, getUserAIRooms)

// ============================================
// AI 訊息管理
// ============================================

/**
 * 發送訊息給 AI
 *
 * @route POST /api/ai-chat/messages
 * @access Private (需登入)
 *
 * @body {number} roomId - 聊天室 ID
 * @body {string} message - 使用者訊息
 *
 * @returns {Object} 回應格式:
 *   - success: true/false
 *   - message: 訊息物件 (包含 AI 回應)
 *
 * @example
 * // 請求
 * POST /api/ai-chat/messages
 * Headers: { Authorization: "Bearer ..." }
 * Body: { roomId: 1, message: "如何查詢訂單?" }
 *
 * // 成功回應
 * {
 *   "success": true,
 *   "message": {
 *     "id": 1,
 *     "userMessage": "如何查詢訂單?",
 *     "aiResponse": "您可以到會員中心...",
 *     "tokensUsed": 150,
 *     "shouldTransfer": false
 *   }
 * }
 */
router.post('/messages', authenticate, sendAIMessage)

/**
 * 取得 AI 聊天室訊息
 *
 * @route GET /api/ai-chat/rooms/:roomId/messages
 * @access Private (需登入)
 *
 * @param {number} roomId - 聊天室 ID
 *
 * @returns {Object} 回應格式:
 *   - success: true/false
 *   - messages: 訊息陣列
 *
 * @example
 * // 請求
 * GET /api/ai-chat/rooms/1/messages
 * Headers: { Authorization: "Bearer ..." }
 *
 * // 成功回應
 * {
 *   "success": true,
 *   "messages": [
 *     {
 *       "id": 1,
 *       "user_message": "如何查詢訂單?",
 *       "ai_response": "您可以到...",
 *       "created_at": "2025-01-01 10:00:00"
 *     }
 *   ]
 * }
 */
router.get('/rooms/:roomId/messages', authenticate, getAIMessages)

// ============================================
// 轉接人工客服
// ============================================

/**
 * 轉接人工客服
 *
 * @route POST /api/ai-chat/transfer
 * @access Private (需登入)
 *
 * @body {number} roomId - AI 聊天室 ID
 *
 * @description
 * 將 AI 聊天室轉接到人工客服
 * 會建立新的客服聊天室,並傳遞對話上下文
 *
 * @returns {Object} 回應格式:
 *   - success: true/false
 *   - message: 操作結果訊息
 *   - customerServiceRoom: 新建立的客服聊天室物件
 *
 * @example
 * // 請求
 * POST /api/ai-chat/transfer
 * Headers: { Authorization: "Bearer ..." }
 * Body: { roomId: 1 }
 *
 * // 成功回應
 * {
 *   "success": true,
 *   "message": "已轉接人工客服",
 *   "customerServiceRoom": {
 *     "id": 10,
 *     "user_id": 1,
 *     "status": "waiting",
 *     "source": "ai_transfer",
 *     ...
 *   }
 * }
 */
router.post('/transfer', authenticate, transferToHuman)

export default router
