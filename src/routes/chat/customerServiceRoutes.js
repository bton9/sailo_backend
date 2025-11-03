/**
 * 客服聊天路由
 * 路徑: sailo_backend/src/routes/chat/customerServiceRoutes.js
 *
 * 功能說明:
 * - 定義客服聊天相關的 RESTful API 端點
 * - 整合 authV2 認證中介軟體
 * - 提供聊天室管理、訊息查詢、圖片上傳等功能
 *
 * API 端點:
 * POST   /api/customer-service/rooms              - 建立/取得聊天室
 * GET    /api/customer-service/rooms              - 取得使用者所有聊天室
 * GET    /api/customer-service/rooms/:id/messages - 取得聊天室訊息
 * POST   /api/customer-service/upload             - 上傳聊天圖片
 * PATCH  /api/customer-service/rooms/:id/status   - 更新聊天室狀態
 * PATCH  /api/customer-service/rooms/:id/assign   - 分配客服人員 (Admin)
 * POST   /api/customer-service/transfer-from-ai   - AI 轉人工 (預留)
 */

import express from 'express'
import { authenticate, requireRole } from '../../middleware/authV2.js' // authV2 認證
import {
  createOrGetRoom,
  getUserRooms,
  getRoomMessages,
  getAllHistory,
  uploadChatImage,
  updateRoomStatus,
  assignAgent,
  transferFromAI,
} from '../../controllers/chat/customerServiceController.js'
import {
  getRooms,
  acceptRoom,
  closeRoom,
  getStats,
} from '../../controllers/chat/adminCustomerServiceController.js'

const router = express.Router()

// ============================================
// 所有路由都需要認證 (authV2)
// ============================================
router.use(authenticate)

// ============================================
// 聊天室管理
// ============================================

/**
 * 建立或取得客服聊天室
 * POST /api/customer-service/rooms
 *
 * Request Body:
 * {
 *   "subject": "訂單問題",        // 選填
 *   "priority": "medium"          // 選填: low/medium/high
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "room": { id, user_id, status, ... },
 *   "isNew": true
 * }
 */
router.post('/rooms', createOrGetRoom)

/**
 * 取得使用者的所有聊天室
 * GET /api/customer-service/rooms
 *
 * Query Parameters:
 * - status: waiting/active/closed (選填,過濾狀態)
 *
 * Response:
 * {
 *   "success": true,
 *   "rooms": [
 *     {
 *       "id": 1,
 *       "user_id": 123,
 *       "agent_id": 456,
 *       "agent_name": "客服小美",
 *       "status": "active",
 *       "unread_count": 3,
 *       "last_message": "您好,請問有什麼可以幫您?"
 *     }
 *   ]
 * }
 */
router.get('/rooms', getUserRooms)

/**
 * 取得聊天室訊息歷史
 * GET /api/customer-service/rooms/:roomId/messages
 *
 * Query Parameters:
 * - limit: 取得筆數 (預設 50)
 * - offset: 偏移量 (預設 0,用於分頁)
 *
 * Response:
 * {
 *   "success": true,
 *   "messages": [
 *     {
 *       "id": 1,
 *       "room_id": 1,
 *       "sender_id": 123,
 *       "sender_name": "王小明",
 *       "sender_avatar": "https://...",
 *       "message": "您好",
 *       "message_type": "text",
 *       "created_at": "2025-10-30 10:00:00"
 *     }
 *   ],
 *   "pagination": {
 *     "limit": 50,
 *     "offset": 0,
 *     "hasMore": false
 *   }
 * }
 */
router.get('/rooms/:roomId/messages', getRoomMessages)

/**
 * 取得使用者所有歷史聊天室及訊息
 * GET /api/customer-service/history
 *
 * Response:
 * {
 *   "success": true,
 *   "history": [
 *     {
 *       "id": 1,
 *       "user_id": 123,
 *       "status": "closed",
 *       "created_at": "2025-10-30T10:00:00.000Z",
 *       "agent_name": "客服小王",
 *       "message_count": 15,
 *       "messages": [
 *         {
 *           "id": 1,
 *           "message": "您好",
 *           "sender_display_name": "王小明",
 *           "created_at": "2025-10-30T10:01:00.000Z"
 *         }
 *       ]
 *     }
 *   ],
 *   "total": 3
 * }
 */
router.get('/history', getAllHistory)

// ============================================
// 圖片上傳 (ImageKit)
// ============================================

/**
 * 上傳聊天圖片
 * POST /api/customer-service/upload
 *
 * Request Body:
 * {
 *   "file": "data:image/png;base64,...",  // Base64 編碼的圖片
 *   "fileName": "screenshot.png",
 *   "roomId": 1
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "message": "圖片上傳成功",
 *   "imageUrl": "https://ik.imagekit.io/...",
 *   "thumbnailUrl": "https://ik.imagekit.io/.../tr:w-200",
 *   "messageId": 123
 * }
 */
router.post('/upload', uploadChatImage)

// ============================================
// 聊天室狀態管理
// ============================================

/**
 * 更新聊天室狀態
 * PATCH /api/customer-service/rooms/:roomId/status
 *
 * Request Body:
 * {
 *   "status": "closed"  // waiting/active/closed
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "message": "聊天室狀態已更新",
 *   "status": "closed"
 * }
 */
router.patch('/rooms/:roomId/status', updateRoomStatus)

// ============================================
// 客服人員分配 (Admin 專用)
// ============================================

/**
 * 分配客服人員
 * PATCH /api/customer-service/rooms/:roomId/assign
 *
 * Request Body:
 * {
 *   "agentId": 456
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "message": "客服人員已分配",
 *   "agent": { id, name, avatar }
 * }
 *
 * 權限: 僅 admin 可使用
 */
router.patch('/rooms/:roomId/assign', assignAgent)

// ============================================
// AI 轉人工功能 (預留)
// ============================================

/**
 * AI 轉人工
 * POST /api/customer-service/transfer-from-ai
 *
 * Request Body:
 * {
 *   "aiRoomId": 123,
 *   "context": "使用者詢問退款流程..."  // 選填,AI 對話上下文
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "message": "AI 轉人工成功",
 *   "roomId": 456
 * }
 *
 * 功能說明:
 * 1. 將 AI 聊天室轉接到人工客服
 * 2. 保留 AI 對話上下文
 * 3. 建立高優先級客服聊天室
 */
router.post('/transfer-from-ai', transferFromAI)

// ============================================
// 客服管理端點 (需要 admin 權限)
// ============================================

/**
 * GET /api/customer-service/admin/rooms
 *
 * 查詢聊天室列表（客服端）
 * 需要 admin 權限
 *
 * Query 參數:
 * - status: all/waiting/active/closed
 * - priority: high/medium/low
 * - limit: 每頁數量（預設 50）
 * - offset: 偏移量（預設 0）
 */
router.get('/admin/rooms', authenticate, requireRole('admin'), getRooms)

/**
 * POST /api/customer-service/admin/rooms/:roomId/accept
 *
 * 客服接單
 * 需要 admin 權限
 *
 * 功能說明:
 * 1. 將聊天室狀態改為 active
 * 2. 綁定客服人員
 * 3. 新增系統訊息
 */
router.post(
  '/admin/rooms/:roomId/accept',
  authenticate,
  requireRole('admin'),
  acceptRoom
)

/**
 * POST /api/customer-service/admin/rooms/:roomId/close
 *
 * 關閉聊天室
 * 需要 admin 權限
 *
 * 功能說明:
 * 1. 將聊天室狀態改為 closed
 * 2. 記錄關閉時間
 * 3. 新增系統訊息
 */
router.post(
  '/admin/rooms/:roomId/close',
  authenticate,
  requireRole('admin'),
  closeRoom
)

/**
 * GET /api/customer-service/admin/stats
 *
 * 查詢統計資訊
 * 需要 admin 權限
 *
 * Response:
 * {
 *   "success": true,
 *   "stats": {
 *     "waiting": 5,
 *     "active": 3,
 *     "closed_today": 12,
 *     "avg_response_time": 180
 *   }
 * }
 */
router.get('/admin/stats', authenticate, requireRole('admin'), getStats)

export default router
