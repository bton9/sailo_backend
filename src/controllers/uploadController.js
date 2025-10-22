import multer from 'multer'
import path from 'path'
import { query } from '../config/database.js'

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'public/uploads'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname)
    cb(null, `place_${Date.now()}${ext}`)
  },
})

export const uploadImageMiddleware = multer({ storage }).single('image')

// 原有的封面上傳（保留）
export async function handleImageUpload(req, res) {
  const { place_id } = req.body
  const filename = req.file.filename

  const url = `/uploads/${filename}`

  try {
    const sql = `
      INSERT INTO media (place_id, url, is_cover, place_category)
      VALUES (?, ?, 1, (SELECT category FROM places WHERE place_id = ?))
      ON DUPLICATE KEY UPDATE url = VALUES(url)
    `
    await query(sql, [place_id, url, place_id])
    res.json({ success: true, url })
  } catch (err) {
    console.error('❌ 圖片儲存失敗:', err)
    res.status(500).json({ success: false, message: '圖片儲存錯誤' })
  }
}

// ✅ 新增：上傳到相簿（非封面）
export async function handleGalleryUpload(req, res) {
  const { place_id, user_id } = req.body
  const filename = req.file?.filename

  if (!filename) {
    return res.status(400).json({ success: false, message: '未上傳檔案' })
  }

  const url = `${filename}` // 只存檔名，不含 /uploads/

  try {
    // 取得景點分類
    const categoryResult = await query(
      'SELECT category FROM places WHERE place_id = ?',
      [place_id]
    )

    if (!categoryResult || categoryResult.length === 0) {
      return res.status(404).json({ success: false, message: '景點不存在' })
    }

    const place_category = categoryResult[0].category

    // 插入相簿圖片（is_cover = 0）
    const sql = `
      INSERT INTO media (user_id, place_id, place_category, url, is_cover)
      VALUES (?, ?, ?, ?, 0)
    `
    const result = await query(sql, [
      user_id || null,
      place_id,
      place_category,
      url,
    ])

    res.json({
      success: true,
      url: url,
      media_id: result.insertId,
      message: '圖片上傳成功',
    })
  } catch (err) {
    console.error('❌ 相簿圖片儲存失敗:', err)
    res.status(500).json({ success: false, message: '圖片儲存錯誤' })
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
