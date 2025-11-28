import express from 'express'
import { query } from '../config/database.js'

const router = express.Router()

// ✅ 新增: 取得所有地區
router.get('/', async (req, res) => {
  try {
    const sql = 'SELECT location_id, name FROM locations ORDER BY name'
    const rows = await query(sql)

    res.json({ success: true, data: rows })
  } catch (err) {
    console.error(' SQL Error:', err.message)
    res.status(500).json({
      success: false,
      message: '伺服器錯誤',
      error: err.message,
    })
  }
})

// 取得單一地點
router.get('/:id', async (req, res) => {
  const locationId = req.params.id

  try {
    const sql = 'SELECT location_id, name FROM locations WHERE location_id = ?'
    const rows = await query(sql, [locationId])

    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, message: '找不到地點' })
    }

    res.json({ success: true, data: rows[0] })
  } catch (err) {
    console.error(' SQL Error:', err.message)
    res
      .status(500)
      .json({ success: false, message: '伺服器錯誤', error: err.message })
  }
})

export default router
