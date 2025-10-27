import imagekitTrip from '../../config/custom/imagekittrip.js'
import { success, error } from '../../utils/custom/response.js'

/**
 * 行程圖片上傳 Controller
 */

// ==================== 上傳行程封面圖 ====================
export const uploadTripCover = async (req, res, next) => {
  try {
    // 檢查是否有上傳檔案
    if (!req.file) {
      return error(res, '請選擇要上傳的圖片', 400)
    }

    const file = req.file

    // 生成唯一的檔案名稱
    const timestamp = Date.now()
    const fileName = `trip-cover-${timestamp}-${file.originalname}`

    // 上傳到 ImageKit
    const uploadResponse = await imagekitTrip.upload({
      file: file.buffer, // 檔案 buffer
      fileName: fileName, // 檔案名稱
      folder: '/trips/covers', // ImageKit 資料夾
      useUniqueFileName: false, // 使用我們自己產生的檔名
      tags: ['trip', 'cover'], // 標籤
    })

    // 回傳上傳結果
    success(
      res,
      {
        url: uploadResponse.url, // 圖片 URL
        fileId: uploadResponse.fileId, // ImageKit file ID
        thumbnailUrl: uploadResponse.thumbnailUrl, // 縮圖 URL
        fileName: uploadResponse.name, // 檔案名稱
        size: uploadResponse.size, // 檔案大小 (bytes)
        width: uploadResponse.width, // 圖片寬度
        height: uploadResponse.height, // 圖片高度
      },
      '圖片上傳成功',
      201
    )
  } catch (err) {
    console.error('ImageKit 上傳錯誤:', err)
    return error(
      res,
      '圖片上傳失敗',
      500,
      process.env.NODE_ENV === 'development' ? err.message : undefined
    )
  }
}

// ==================== 刪除 ImageKit 圖片 (選用) ====================
export const deleteImage = async (req, res, next) => {
  try {
    const { fileId } = req.params

    if (!fileId) {
      return error(res, '缺少 fileId 參數', 400)
    }

    // 從 ImageKit 刪除圖片
    await imagekitTrip.deleteFile(fileId)

    success(res, null, '圖片已刪除')
  } catch (err) {
    console.error('ImageKit 刪除錯誤:', err)
    return error(
      res,
      '圖片刪除失敗',
      500,
      process.env.NODE_ENV === 'development' ? err.message : undefined
    )
  }
}

export default {
  uploadTripCover,
  deleteImage,
}
