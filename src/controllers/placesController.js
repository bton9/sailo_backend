import { query } from '../config/database.js'

// 取得所有景點（列表頁）- 新增 location_name 和 cover_image
export async function getPlaces(req, res) {
  try {
    const { keyword, category, location_id } = req.query

    let sql = `
      SELECT 
        p.*,
        l.name AS location_name,
        (
          SELECT url 
          FROM media 
          WHERE place_id = p.place_id AND is_cover = 1
          LIMIT 1
        ) AS cover_image
      FROM places p
      LEFT JOIN locations l ON p.location_id = l.location_id
      WHERE 1=1
    `
    const params = []

    if (keyword) {
      sql += ' AND (p.name LIKE ? OR p.description LIKE ?)'
      params.push(`%${keyword}%`, `%${keyword}%`)
    }

    if (category) {
      sql += ' AND p.category = ?'
      params.push(category)
    }

    if (location_id) {
      sql += ' AND p.location_id = ?'
      params.push(location_id)
    }

    const rows = await query(sql, params)
    res.json({ success: true, data: rows })
  } catch (err) {
    console.error('❌ SQL Error:', err.message)
    res.status(500).json({ success: false, message: '資料庫錯誤', error: err.message })
  }
}

// 取得單一景點（詳細頁）- 維持原樣
export async function getPlaceById(req, res) {
  const { id } = req.params
  try {
    const sql = `
      SELECT 
        p.*,
        l.name AS location_name,
        (
          SELECT url 
          FROM media 
          WHERE place_id = p.place_id AND is_cover = 1
          LIMIT 1
        ) AS cover_image
      FROM places p
      LEFT JOIN locations l ON p.location_id = l.location_id
      WHERE p.place_id = ?
    `
    const rows = await query(sql, [id])
    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, message: '找不到景點' })
    }
    res.json({ success: true, data: rows[0] })
  } catch (err) {
    console.error('❌ SQL Error:', err.message)
    res
      .status(500)
      .json({ success: false, message: '資料庫錯誤', error: err.message })
  }
}
