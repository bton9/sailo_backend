/**
 * Avatar Controller (ImageKit Version)
 * 路徑: sailo_backend/src/controllers/avatarController.js
 *
 * 功能：處理使用者頭像上傳與刪除（使用 ImageKit CDN）
 *
 * API 端點：
 * - POST /api/user/upload-avatar - 上傳頭像到 ImageKit
 * - DELETE /api/user/delete-avatar - 刪除 ImageKit 上的頭像
 * - GET /api/user/imagekit-auth - 取得 ImageKit 認證參數
 *
 * ImageKit 優勢：
 * - 圖片自動優化（壓縮、格式轉換）
 * - CDN 全球加速
 * - 即時圖片轉換（調整大小、裁切等）
 * - 不佔用伺服器儲存空間
 * - 支援格式：JPG, PNG, GIF, WEBP
 * - 檔案大小限制：5MB
 */

import multer from 'multer'
import imagekit from '../config/imagekit.js'
import { query } from '../config/database.js'

// ============================================
// Multer 記憶體儲存設定
// ============================================

/**
 * 使用記憶體儲存（不寫入磁碟）
 * 檔案將直接從記憶體上傳到 ImageKit
 * 上傳完成後自動釋放記憶體
 */
const storage = multer.memoryStorage()

// ============================================
// 檔案過濾器
// ============================================

/**
 * 只接受圖片檔案
 * 支援格式：JPG, PNG, GIF, WEBP
 *
 * @param {Object} req - Express request
 * @param {Object} file - 上傳的檔案
 * @param {Function} cb - Callback function
 */
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
  ]

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true) // 接受檔案
  } else {
    cb(new Error('只支援 JPG、PNG、GIF、WEBP 格式'), false)
  }
}

// ============================================
// Multer 上傳設定
// ============================================

/**
 * 匯出 multer 中介層供 router 使用
 * - storage: 記憶體儲存（不寫入磁碟）
 * - fileFilter: 檔案類型過濾
 * - limits: 檔案大小限制 5MB
 */
export const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
})

// ============================================
// 取得 ImageKit 認證參數
// ============================================

/**
 * 提供前端上傳所需的認證參數
 * 前端可使用這些參數直接上傳到 ImageKit（可選功能）
 *
 * @route GET /api/user/imagekit-auth
 * @returns {Object} { signature, expire, token, publicKey, urlEndpoint }
 */
export async function getImageKitAuth(req, res) {
  try {
    // 取得認證參數
    const authParams = imagekit.getAuthenticationParameters()

    console.log('ImageKit 認證參數已產生')

    res.json({
      success: true,
      ...authParams,
      publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
      urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
    })
  } catch (error) {
    console.error('產生 ImageKit 認證參數失敗:', error)

    res.status(500).json({
      success: false,
      message: '取得認證參數失敗',
      error: error.message,
    })
  }
}

// ============================================
// 上傳頭像到 ImageKit
// ============================================

/**
 * 上傳頭像到 ImageKit CDN
 *
 * 流程：
 * 1. 驗證使用者身份
 * 2. 查詢並刪除舊頭像（如果存在）
 * 3. 上傳新頭像到 ImageKit
 * 4. 更新資料庫中的頭像 URL
 * 5. 回傳新頭像的 URL
 *
 * @route POST /api/user/upload-avatar
 * @param {File} req.file - 上傳的圖片檔案（由 multer 處理）
 * @returns {Object} { success, message, avatarUrl, fileId }
 */
export async function uploadAvatar(req, res) {
  try {
    // ============ 步驟 1: 驗證檔案是否存在 ============
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: '請選擇要上傳的圖片',
      })
    }

    console.log('收到上傳請求:', {
      filename: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
    })

    const userId = req.user.userId

    // ============ 步驟 2: 查詢並刪除舊頭像 ============
    try {
      // 查詢使用者目前的頭像 URL 和 fileId
      const [rows] = await query(
        'SELECT avatar, avatar_file_id FROM users WHERE id = ?',
        [userId]
      )

      // 如果有舊頭像，從 ImageKit 刪除
      if (rows && rows.avatar_file_id) {
        try {
          await imagekit.deleteFile(rows.avatar_file_id)
          console.log('已刪除舊頭像:', rows.avatar_file_id)
        } catch (err) {
          // 如果刪除失敗（例如檔案已不存在），記錄但繼續執行
          console.error('刪除舊頭像失敗:', err.message)
        }
      }
    } catch (err) {
      console.error('查詢舊頭像失敗:', err)
      // 繼續執行，不中斷上傳流程
    }

    // ============ 步驟 3: 上傳到 ImageKit ============

    // 產生唯一的檔案名稱
    const timestamp = Date.now()
    const fileName = `avatar_${userId}_${timestamp}`

    console.log('開始上傳到 ImageKit...')

    // 上傳圖片到 ImageKit
    const uploadResponse = await imagekit.upload({
      file: req.file.buffer, // 檔案內容（Buffer）
      fileName: fileName, // ImageKit 上的檔案名稱
      folder: '/avatars', // 儲存資料夾
      useUniqueFileName: true, // 確保檔案名稱唯一
      tags: [`user_${userId}`, 'avatar'], // 標籤，方便管理
    })

    console.log('ImageKit 上傳成功:', {
      fileId: uploadResponse.fileId,
      url: uploadResponse.url,
    })

    // ============ 步驟 4: 更新資料庫 ============

    // 儲存 ImageKit 的 URL 和 fileId 到資料庫
    await query(
      'UPDATE users SET avatar = ?, avatar_file_id = ? WHERE id = ?',
      [uploadResponse.url, uploadResponse.fileId, userId]
    )

    console.log('資料庫已更新')

    // ============ 步驟 5: 回傳成功訊息 ============
    res.json({
      success: true,
      message: '頭像上傳成功',
      avatarUrl: uploadResponse.url, // ImageKit CDN URL
      fileId: uploadResponse.fileId, // ImageKit 檔案 ID
      thumbnail: uploadResponse.thumbnailUrl, // 縮圖 URL（可選）
    })
  } catch (error) {
    console.error('上傳頭像失敗:', error)

    // 回傳錯誤訊息
    res.status(500).json({
      success: false,
      message: '上傳失敗，請稍後再試',
      error: error.message,
    })
  }
}

// ============================================
// 刪除頭像
// ============================================

/**
 * 刪除使用者頭像（從 ImageKit 和資料庫）
 *
 * 流程：
 * 1. 驗證使用者身份
 * 2. 查詢使用者的頭像 fileId
 * 3. 從 ImageKit 刪除檔案
 * 4. 清空資料庫中的頭像欄位
 *
 * @route DELETE /api/user/delete-avatar
 * @returns {Object} { success, message }
 */
export async function deleteAvatar(req, res) {
  try {
    const userId = req.user.userId

    console.log('開始刪除頭像, userId:', userId)

    // ============ 步驟 1: 查詢頭像資訊 ============
    const [rows] = await query(
      'SELECT avatar, avatar_file_id FROM users WHERE id = ?',
      [userId]
    )

    // 檢查是否有頭像
    if (!rows || !rows.avatar) {
      return res.status(404).json({
        success: false,
        message: '目前沒有頭像',
      })
    }

    const fileId = rows.avatar_file_id

    // ============ 步驟 2: 從 ImageKit 刪除檔案 ============
    if (fileId) {
      try {
        await imagekit.deleteFile(fileId)
        console.log('已從 ImageKit 刪除頭像:', fileId)
      } catch (err) {
        console.error('ImageKit 刪除失敗:', err.message)
        // 即使 ImageKit 刪除失敗，仍繼續清空資料庫
      }
    }

    // ============ 步驟 3: 清空資料庫欄位 ============
    await query(
      'UPDATE users SET avatar = NULL, avatar_file_id = NULL WHERE id = ?',
      [userId]
    )

    console.log('頭像已刪除')

    // ============ 步驟 4: 回傳成功訊息 ============
    res.json({
      success: true,
      message: '頭像已刪除',
    })
  } catch (error) {
    console.error('刪除頭像失敗:', error)

    res.status(500).json({
      success: false,
      message: '刪除頭像失敗',
      error: error.message,
    })
  }
}
