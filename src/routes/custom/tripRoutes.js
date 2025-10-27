// ==================== 後端 API (Node.js + Express) ====================
// 檔案: /api/routes/tripRoutes.js

const express = require('express')
const router = express.Router()
const db = require('../config/database') // 你的資料庫連線

// ==================== 1. 建立新行程 ====================
router.post('/trips', async (req, res) => {
  const connection = await db.getConnection()

  try {
    await connection.beginTransaction()

    const {
      trip_name,
      user_id,
      description,
      start_date,
      end_date,
      cover_image_url,
      summary_text,
      is_public,
      location_id,
    } = req.body

    // 驗證必填欄位
    if (!trip_name || !user_id || !start_date || !end_date) {
      return res.status(400).json({
        success: false,
        message: '缺少必填欄位',
      })
    }

    // 建立行程
    const [tripResult] = await connection.execute(
      `INSERT INTO trip (
        trip_name, user_id, description, start_date, end_date,
        cover_image_url, summary_text, is_public, location_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        trip_name,
        user_id,
        description,
        start_date,
        end_date,
        cover_image_url,
        summary_text,
        is_public ? 1 : 0,
        location_id,
      ]
    )

    const tripId = tripResult.insertId

    // 計算天數並自動建立 trip_day
    const startDateObj = new Date(start_date)
    const endDateObj = new Date(end_date)
    const diffTime = Math.abs(endDateObj - startDateObj)
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1

    // 建立每一天的記錄
    for (let i = 0; i < diffDays; i++) {
      const currentDate = new Date(startDateObj)
      currentDate.setDate(currentDate.getDate() + i)

      await connection.execute(
        `INSERT INTO trip_day (trip_id, date, day_number) VALUES (?, ?, ?)`,
        [tripId, currentDate.toISOString().split('T')[0], i + 1]
      )
    }

    await connection.commit()

    res.status(201).json({
      success: true,
      message: '行程建立成功',
      data: {
        trip_id: tripId,
        days_created: diffDays,
      },
    })
  } catch (error) {
    await connection.rollback()
    console.error('建立行程錯誤:', error)
    res.status(500).json({
      success: false,
      message: '建立行程失敗',
      error: error.message,
    })
  } finally {
    connection.release()
  }
})

// ==================== 2. 取得使用者的所有行程 ====================
router.get('/trips/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params
    const { sort = 'updated_at' } = req.query // updated_at, created_at

    const [trips] = await db.execute(
      `SELECT 
        t.*,
        l.name as location_name,
        COUNT(DISTINCT td.trip_day_id) as total_days,
        COUNT(DISTINCT ti.trip_item_id) as total_items
      FROM trip t
      LEFT JOIN location l ON t.location_id = l.location_id
      LEFT JOIN trip_day td ON t.trip_id = td.trip_id
      LEFT JOIN trip_item ti ON td.trip_day_id = ti.trip_day_id
      WHERE t.user_id = ?
      GROUP BY t.trip_id
      ORDER BY t.${sort} DESC`,
      [userId]
    )

    res.json({
      success: true,
      data: trips,
    })
  } catch (error) {
    console.error('取得行程列表錯誤:', error)
    res.status(500).json({
      success: false,
      message: '取得行程列表失敗',
      error: error.message,
    })
  }
})

// ==================== 3. 取得單一行程詳細資料 ====================
router.get('/trips/:tripId', async (req, res) => {
  try {
    const { tripId } = req.params

    // 取得行程基本資料
    const [trips] = await db.execute(
      `SELECT t.*, l.name as location_name
       FROM trip t
       LEFT JOIN location l ON t.location_id = l.location_id
       WHERE t.trip_id = ?`,
      [tripId]
    )

    if (trips.length === 0) {
      return res.status(404).json({
        success: false,
        message: '找不到該行程',
      })
    }

    // 取得每天的行程
    const [days] = await db.execute(
      `SELECT * FROM trip_day WHERE trip_id = ? ORDER BY day_number`,
      [tripId]
    )

    // 取得每天的景點項目
    for (let day of days) {
      const [items] = await db.execute(
        `SELECT 
          ti.*,
          p.name as place_name,
          p.category,
          p.rating,
          p.latitude,
          p.longitude,
          p.google_place_id
        FROM trip_item ti
        LEFT JOIN place p ON ti.place_id = p.place_id
        WHERE ti.trip_day_id = ?
        ORDER BY ti.sort_order`,
        [day.trip_day_id]
      )
      day.items = items
    }

    res.json({
      success: true,
      data: {
        trip: trips[0],
        days: days,
      },
    })
  } catch (error) {
    console.error('取得行程詳細資料錯誤:', error)
    res.status(500).json({
      success: false,
      message: '取得行程詳細資料失敗',
      error: error.message,
    })
  }
})

// ==================== 4. 新增景點到某一天 ====================
router.post('/trips/days/:tripDayId/items', async (req, res) => {
  try {
    const { tripDayId } = req.params
    const { place_id, type, note, start_time, end_time } = req.body

    // 取得當前最大的 sort_order
    const [maxOrder] = await db.execute(
      `SELECT MAX(sort_order) as max_order FROM trip_item WHERE trip_day_id = ?`,
      [tripDayId]
    )

    const sortOrder = (maxOrder[0]?.max_order || 0) + 1

    const [result] = await db.execute(
      `INSERT INTO trip_item 
       (trip_day_id, place_id, type, note, start_time, end_time, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [tripDayId, place_id, type, note, start_time, end_time, sortOrder]
    )

    res.status(201).json({
      success: true,
      message: '景點已加入行程',
      data: {
        trip_item_id: result.insertId,
        sort_order: sortOrder,
      },
    })
  } catch (error) {
    console.error('新增景點錯誤:', error)
    res.status(500).json({
      success: false,
      message: '新增景點失敗',
      error: error.message,
    })
  }
})

// ==================== 5. 刪除行程中的景點 ====================
router.delete('/trips/items/:tripItemId', async (req, res) => {
  try {
    const { tripItemId } = req.params

    await db.execute(`DELETE FROM trip_item WHERE trip_item_id = ?`, [
      tripItemId,
    ])

    res.json({
      success: true,
      message: '景點已從行程中移除',
    })
  } catch (error) {
    console.error('刪除景點錯誤:', error)
    res.status(500).json({
      success: false,
      message: '刪除景點失敗',
      error: error.message,
    })
  }
})

// ==================== 6. 更新景點順序 ====================
router.put('/trips/items/:tripItemId/order', async (req, res) => {
  try {
    const { tripItemId } = req.params
    const { sort_order } = req.body

    await db.execute(
      `UPDATE trip_item SET sort_order = ? WHERE trip_item_id = ?`,
      [sort_order, tripItemId]
    )

    res.json({
      success: true,
      message: '順序已更新',
    })
  } catch (error) {
    console.error('更新順序錯誤:', error)
    res.status(500).json({
      success: false,
      message: '更新順序失敗',
      error: error.message,
    })
  }
})

// ==================== 7. 收藏行程 ====================
router.post('/favorites', async (req, res) => {
  try {
    const { user_id, trip_id } = req.body

    // 檢查是否已收藏
    const [existing] = await db.execute(
      `SELECT * FROM favorite WHERE user_id = ? AND trip_id = ?`,
      [user_id, trip_id]
    )

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: '已經收藏過此行程',
      })
    }

    await db.execute(`INSERT INTO favorite (user_id, trip_id) VALUES (?, ?)`, [
      user_id,
      trip_id,
    ])

    res.status(201).json({
      success: true,
      message: '收藏成功',
    })
  } catch (error) {
    console.error('收藏行程錯誤:', error)
    res.status(500).json({
      success: false,
      message: '收藏失敗',
      error: error.message,
    })
  }
})

// ==================== 8. 取消收藏 ====================
router.delete('/favorites', async (req, res) => {
  try {
    const { user_id, trip_id } = req.body

    await db.execute(`DELETE FROM favorite WHERE user_id = ? AND trip_id = ?`, [
      user_id,
      trip_id,
    ])

    res.json({
      success: true,
      message: '已取消收藏',
    })
  } catch (error) {
    console.error('取消收藏錯誤:', error)
    res.status(500).json({
      success: false,
      message: '取消收藏失敗',
      error: error.message,
    })
  }
})

// ==================== 9. 取得使用者收藏的行程 ====================
router.get('/favorites/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params

    const [favorites] = await db.execute(
      `SELECT 
        f.*,
        t.trip_name,
        t.start_date,
        t.end_date,
        t.cover_image_url,
        t.summary_text,
        u.name as creator_name
      FROM favorite f
      JOIN trip t ON f.trip_id = t.trip_id
      JOIN user u ON t.user_id = u.id
      WHERE f.user_id = ?
      ORDER BY f.created_at DESC`,
      [userId]
    )

    res.json({
      success: true,
      data: favorites,
    })
  } catch (error) {
    console.error('取得收藏列表錯誤:', error)
    res.status(500).json({
      success: false,
      message: '取得收藏列表失敗',
      error: error.message,
    })
  }
})

// ==================== 10. 複製行程 ====================
router.post('/trips/:tripId/copy', async (req, res) => {
  const connection = await db.getConnection()

  try {
    await connection.beginTransaction()

    const { tripId } = req.params
    const { user_id } = req.body

    // 取得原行程資料
    const [originalTrip] = await connection.execute(
      `SELECT * FROM trip WHERE trip_id = ?`,
      [tripId]
    )

    if (originalTrip.length === 0) {
      return res.status(404).json({
        success: false,
        message: '找不到原行程',
      })
    }

    const trip = originalTrip[0]

    // 建立新行程
    const [newTrip] = await connection.execute(
      `INSERT INTO trip (
        trip_name, user_id, description, start_date, end_date,
        cover_image_url, summary_text, is_public, location_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        `${trip.trip_name} - 複製`,
        user_id,
        trip.description,
        trip.start_date,
        trip.end_date,
        trip.cover_image_url,
        trip.summary_text,
        0, // 複製的行程預設為私人
        trip.location_id,
      ]
    )

    const newTripId = newTrip.insertId

    // 複製每一天
    const [days] = await connection.execute(
      `SELECT * FROM trip_day WHERE trip_id = ? ORDER BY day_number`,
      [tripId]
    )

    for (const day of days) {
      const [newDay] = await connection.execute(
        `INSERT INTO trip_day (trip_id, date, day_number) VALUES (?, ?, ?)`,
        [newTripId, day.date, day.day_number]
      )

      const newDayId = newDay.insertId

      // 複製該天的景點
      const [items] = await connection.execute(
        `SELECT * FROM trip_item WHERE trip_day_id = ? ORDER BY sort_order`,
        [day.trip_day_id]
      )

      for (const item of items) {
        await connection.execute(
          `INSERT INTO trip_item 
           (trip_day_id, place_id, type, note, start_time, end_time, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            newDayId,
            item.place_id,
            item.type,
            item.note,
            item.start_time,
            item.end_time,
            item.sort_order,
          ]
        )
      }
    }

    await connection.commit()

    res.status(201).json({
      success: true,
      message: '行程複製成功',
      data: {
        new_trip_id: newTripId,
      },
    })
  } catch (error) {
    await connection.rollback()
    console.error('複製行程錯誤:', error)
    res.status(500).json({
      success: false,
      message: '複製行程失敗',
      error: error.message,
    })
  } finally {
    connection.release()
  }
})

// ==================== 11. 刪除行程 ====================
router.delete('/trips/:tripId', async (req, res) => {
  try {
    const { tripId } = req.params

    // 由於有設定 ON DELETE CASCADE，刪除 trip 會自動刪除相關的 trip_day 和 trip_item
    await db.execute(`DELETE FROM trip WHERE trip_id = ?`, [tripId])

    res.json({
      success: true,
      message: '行程已刪除',
    })
  } catch (error) {
    console.error('刪除行程錯誤:', error)
    res.status(500).json({
      success: false,
      message: '刪除行程失敗',
      error: error.message,
    })
  }
})

module.exports = router
