import multer from 'multer'
import { query } from '../config/database.js'
import imagekitTrip from '../config/custom/imagekittrip.js'

// ✅ 改用記憶體儲存，不再儲存到本地檔案系統
const storage = multer.memoryStorage()

// 檔案篩選器
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new Error('不支援的檔案格式。只接受 JPG, JPEG, PNG, WEBP'), false)
  }
}

export const uploadImageMiddleware = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
}).single('image')

// ✅ 封面圖片上傳（使用 ImageKit）
export async function handleImageUpload(req, res) {
  try {
    const { place_id } = req.body

    // 檢查是否有上傳檔案
    if (!req.file) {
      return res.status(400).json({ success: false, message: '未上傳檔案' })
    }

    const file = req.file

    // 生成唯一的檔案名稱
    const timestamp = Date.now()
    const fileName = `place-cover-${place_id}-${timestamp}-${file.originalname}`

    // 上傳到 ImageKit
    const uploadResponse = await imagekitTrip.upload({
      file: file.buffer,
      fileName: fileName,
      folder: '/places/covers', // ImageKit 資料夾
      useUniqueFileName: false,
      tags: ['place', 'cover', `place_${place_id}`],
    })

    const url = uploadResponse.url // ✅ 使用 ImageKit URL

    // 更新資料庫
    const sql = `
      INSERT INTO media (place_id, url, is_cover, place_category)
      VALUES (?, ?, 1, (SELECT category FROM places WHERE place_id = ?))
      ON DUPLICATE KEY UPDATE url = VALUES(url)
    `
    await query(sql, [place_id, url, place_id])

    console.log('✅ 景點封面圖片上傳成功:', url)

    res.json({
      success: true,
      url: url,
      fileId: uploadResponse.fileId,
      thumbnailUrl: uploadResponse.thumbnailUrl,
    })
  } catch (err) {
    console.error('❌ 封面圖片上傳失敗:', err)
    res.status(500).json({
      success: false,
      message: '圖片上傳錯誤',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined,
    })
  }
}

// ✅ 新增：上傳到相簿（使用 ImageKit）
export async function handleGalleryUpload(req, res) {
  try {
    const { place_id, user_id } = req.body

    // 檢查是否有上傳檔案
    if (!req.file) {
      return res.status(400).json({ success: false, message: '未上傳檔案' })
    }

    const file = req.file

    // 生成唯一的檔案名稱
    const timestamp = Date.now()
    const fileName = `place-gallery-${place_id}-${timestamp}-${file.originalname}`

    // 上傳到 ImageKit
    const uploadResponse = await imagekitTrip.upload({
      file: file.buffer, // 檔案 buffer
      fileName: fileName, // 檔案名稱
      folder: '/places/gallery', // ImageKit 資料夾
      useUniqueFileName: false,
      tags: ['place', 'gallery', `place_${place_id}`],
    })

    // 取得景點分類
    const categoryResult = await query(
      'SELECT category FROM places WHERE place_id = ?',
      [place_id]
    )

    if (!categoryResult || categoryResult.length === 0) {
      return res.status(404).json({ success: false, message: '景點不存在' })
    }

    const place_category = categoryResult[0].category

    // 插入相簿圖片到資料庫（儲存 ImageKit URL）
    const sql = `
      INSERT INTO media (user_id, place_id, place_category, url, is_cover)
      VALUES (?, ?, ?, ?, 0)
    `
    const result = await query(sql, [
      user_id || null,
      place_id,
      place_category,
      uploadResponse.url, // ✅ 儲存 ImageKit URL
    ])

    console.log('✅ 景點相簿圖片上傳成功:', uploadResponse.url)

    res.json({
      success: true,
      url: uploadResponse.url, // ✅ 回傳 ImageKit URL
      media_id: result.insertId,
      fileId: uploadResponse.fileId,
      thumbnailUrl: uploadResponse.thumbnailUrl,
      message: '圖片上傳成功',
    })
  } catch (err) {
    console.error('❌ 景點相簿圖片上傳失敗:', err)
    res.status(500).json({
      success: false,
      message: '圖片上傳錯誤',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined,
    })
  }
}

// ✅ 新增：取得景點相簿
export async function getPlaceGallery(req, res) {
  const { place_id } = req.params

  try {
    const sql = `
      SELECT 
        media_id,
        url AS image_url,
        user_id,
        created_at
      FROM media
      WHERE place_id = ? AND is_cover = 0
      ORDER BY created_at DESC
    `
    const rows = await query(sql, [place_id])

    res.json({
      success: true,
      images: rows || [],
    })
  } catch (err) {
    console.error('❌ 取得相簿失敗:', err)
    res.status(500).json({ success: false, message: '資料庫錯誤' })
  }
}

// ✅ 新增：刪除相簿圖片
export async function deleteGalleryImage(req, res) {
  const { media_id } = req.params
  const { user_id } = req.body // 驗證是否為上傳者

  try {
    // 可選：驗證權限
    const checkSql = 'SELECT user_id FROM media WHERE media_id = ?'
    const rows = await query(checkSql, [media_id])

    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, message: '圖片不存在' })
    }

    // 刪除圖片記錄
    const deleteSql = 'DELETE FROM media WHERE media_id = ? AND is_cover = 0'
    await query(deleteSql, [media_id])

    res.json({ success: true, message: '圖片已刪除' })
  } catch (err) {
    console.error('❌ 刪除圖片失敗:', err)
    res.status(500).json({ success: false, message: '刪除失敗' })
  }
}
