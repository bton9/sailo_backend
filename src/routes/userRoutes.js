/**
 * 使用者路由
 * 檔案路徑: sailo_backend/src/routes/userRoutes.js
 *
 * 功能說明：
 * - 處理使用者相關的 API 路由
 * - 包含使用者資料更新功能（暱稱、個人資料）
 * - 所有路由都需要經過 JWT 身份驗證
 *
 * 依賴項目：
 * - express: Web 框架
 * - authenticate: JWT 驗證中介層
 * - userController: 使用者控制器函數
 */

import express from 'express'
import { authenticate } from '../middleware/auth.js'
import { updateNickname, updateProfile } from '../controllers/userController.js'
import {
  uploadAvatar,
  deleteAvatar,
  getImageKitAuth,
  upload,
} from '../controllers/avatarController.js'

// 建立路由器實例
const router = express.Router()

// ============================================
// 使用者資料更新相關路由
// ============================================

/**
 * 更新使用者暱稱
 *
 * @route PUT /api/user/update-nickname
 * @access 私有路由 (需要登入)
 * @middleware authenticate - JWT 驗證中介層
 * @controller updateNickname - 處理暱稱更新邏輯
 *
 * @header {string} Authorization - Bearer Token (必填)
 * @body {string} nickname - 新的暱稱 (必填)
 *
 * @returns {Object} 回應格式：
 *   - success: true/false
 *   - message: 操作結果訊息
 *   - user: { nickname } - 更新後的使用者資料
 *
 * @example
 * // 請求範例
 * PUT /api/user/update-nickname
 * Headers: { Authorization: "Bearer eyJhbGc..." }
 * Body: { nickname: "新暱稱" }
 *
 * // 成功回應
 * { success: true, message: "暱稱更新成功", user: { nickname: "新暱稱" } }
 */
router.put('/update-nickname', authenticate, updateNickname)

/**
 * 更新使用者個人資料
 *
 * @route PUT /api/user/update-profile
 * @access 私有路由 (需要登入)
 * @middleware authenticate - JWT 驗證中介層
 * @controller updateProfile - 處理個人資料更新邏輯
 *
 * @header {string} Authorization - Bearer Token (必填)
 * @body {string} name - 姓名 (必填)
 * @body {string} phone - 手機號碼 (選填)
 * @body {string} birthday - 生日 格式: YYYY-MM-DD (選填)
 * @body {string} gender - 性別 可選值: male/female/other (選填)
 *
 * @returns {Object} 回應格式：
 *   - success: true/false
 *   - message: 操作結果訊息
 *   - user: { name, phone, birthday, gender } - 更新後的使用者資料
 *
 * @example
 * // 請求範例
 * PUT /api/user/update-profile
 * Headers: { Authorization: "Bearer eyJhbGc..." }
 * Body: {
 *   name: "張三",
 *   phone: "0912345678",
 *   birthday: "1990-01-01",
 *   gender: "male"
 * }
 *
 * // 成功回應
 * {
 *   success: true,
 *   message: "個人資料更新成功",
 *   user: { name: "張三", phone: "0912345678", ... }
 * }
 */
router.put('/update-profile', authenticate, updateProfile)

// ============================================
// 頭像管理相關路由
// ============================================

/**
 * 取得 ImageKit 認證參數
 *
 * @route GET /api/user/imagekit-auth
 * @access 私有路由 (需要登入)
 * @middleware authenticate - JWT 驗證中介層
 * @controller getImageKitAuth - 產生 ImageKit 認證參數
 *
 * @header {string} Authorization - Bearer Token (必填)
 *
 * @returns {Object} 回應格式：
 *   - success: true/false
 *   - signature: string - ImageKit 簽章
 *   - expire: number - 過期時間戳
 *   - token: string - 認證 token
 *   - publicKey: string - ImageKit 公鑰
 *   - urlEndpoint: string - ImageKit URL 端點
 *
 * @example
 * // 請求範例
 * GET /api/user/imagekit-auth
 * Headers: { Authorization: "Bearer eyJhbGc..." }
 *
 * // 成功回應
 * {
 *   success: true,
 *   signature: "abc123...",
 *   expire: 1634567890,
 *   token: "xyz789...",
 *   publicKey: "public_...",
 *   urlEndpoint: "https://ik.imagekit.io/your_id"
 * }
 */
router.get('/imagekit-auth', authenticate, getImageKitAuth)

/**
 * 上傳使用者頭像到 ImageKit CDN
 *
 * @route POST /api/user/upload-avatar
 * @access 私有路由 (需要登入)
 * @middleware authenticate - JWT 驗證中介層
 * @middleware upload.single('avatar') - Multer 檔案處理中介層（記憶體儲存）
 * @controller uploadAvatar - 處理頭像上傳到 ImageKit
 *
 * @header {string} Authorization - Bearer Token (必填)
 * @header {string} Content-Type - multipart/form-data (必填)
 * @body {File} avatar - 頭像圖片檔案 (必填, FormData 格式)
 *
 * @returns {Object} 回應格式：
 *   - success: true/false
 *   - message: 操作結果訊息
 *   - avatarUrl: string - ImageKit CDN URL
 *   - fileId: string - ImageKit 檔案 ID
 *   - thumbnail: string - 縮圖 URL
 *
 * @example
 * // 請求範例 (使用 FormData)
 * POST /api/user/upload-avatar
 * Headers: {
 *   Authorization: "Bearer eyJhbGc...",
 *   Content-Type: "multipart/form-data"
 * }
 * Body: FormData { avatar: File }
 *
 * // 成功回應
 * {
 *   success: true,
 *   message: "頭像上傳成功",
 *   avatarUrl: "https://ik.imagekit.io/your_id/avatars/avatar_123_1634567890.jpg",
 *   fileId: "abc123xyz...",
 *   thumbnail: "https://ik.imagekit.io/your_id/tr:n-media_library_thumbnail/avatars/..."
 * }
 *
 * 檔案限制：
 * - 支援格式: JPG, PNG, GIF, WEBP
 * - 檔案大小: 最大 5MB
 * - 儲存位置: ImageKit /avatars 資料夾
 * - 命名格式: avatar_userId_timestamp
 * - 自動優化、壓縮、CDN 加速
 */
router.post(
  '/upload-avatar',
  authenticate,
  upload.single('avatar'),
  uploadAvatar
)

/**
 * 刪除使用者頭像（從 ImageKit 和資料庫）
 *
 * @route DELETE /api/user/delete-avatar
 * @access 私有路由 (需要登入)
 * @middleware authenticate - JWT 驗證中介層
 * @controller deleteAvatar - 處理頭像刪除邏輯（ImageKit + DB）
 *
 * @header {string} Authorization - Bearer Token (必填)
 *
 * @returns {Object} 回應格式：
 *   - success: true/false
 *   - message: 操作結果訊息
 *
 * @example
 * // 請求範例
 * DELETE /api/user/delete-avatar
 * Headers: { Authorization: "Bearer eyJhbGc..." }
 *
 * // 成功回應
 * { success: true, message: "頭像已刪除" }
 *
 * 處理流程：
 * 1. 從資料庫查詢 ImageKit fileId
 * 2. 從 ImageKit 刪除圖片檔案
 * 3. 清空資料庫的 avatar 和 avatar_file_id 欄位
 */
router.delete('/delete-avatar', authenticate, deleteAvatar)

// 匯出路由器供 server.js 使用
export default router
