import pool from '../../config/database.js'
import { success, error } from '../../utils/custom/response.js'

/**
 * 行程管理 Controller
 */

// ==================== 1. 建立新行程 ====================
export const createTrip = async (req, res, next) => {
  const connection = await pool.getConnection()

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

    // 建立行程
    const [tripResult] = await connection.execute(
      `INSERT INTO trips (
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

    // 計算天數並自動建立 trip_days
    const startDateObj = new Date(start_date)
    const endDateObj = new Date(end_date)
    const diffTime = Math.abs(endDateObj - startDateObj)
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1

    // 建立每一天的記錄
    for (let i = 0; i < diffDays; i++) {
      const currentDate = new Date(startDateObj)
      currentDate.setDate(currentDate.getDate() + i)

      await connection.execute(
        `INSERT INTO trip_days (trip_id, date, day_number) VALUES (?, ?, ?)`,
        [tripId, currentDate.toISOString().split('T')[0], i + 1]
      )
    }

    await connection.commit()

    success(
      res,
      { trip_id: tripId, days_created: diffDays },
      '行程建立成功',
      201
    )
  } catch (err) {
    await connection.rollback()
    next(err)
  } finally {
    connection.release()
  }
}

// ==================== 2. 取得使用者的所有行程 ====================
export const getUserTrips = async (req, res, next) => {
  try {
    const { userId } = req.params
    const { sort = 'created_at' } = req.query //  預設使用 created_at

    // 允許的排序欄位 (只保留你資料庫有的欄位)
    const allowedSortFields = ['created_at', 'start_date', 'trip_name']
    const sortField = allowedSortFields.includes(sort) ? sort : 'created_at'

    const [trips] = await pool.execute(
      `SELECT 
    t.*,
    l.name as location_name,
    COUNT(DISTINCT td.trip_day_id) as total_days,
    COUNT(DISTINCT ti.trip_item_id) as total_items
  FROM trips t
  LEFT JOIN locations l ON t.location_id = l.location_id
  LEFT JOIN trip_days td ON t.trip_id = td.trip_id
  LEFT JOIN trip_items ti ON td.trip_day_id = ti.trip_day_id
  WHERE t.user_id = ?
  GROUP BY t.trip_id
  ORDER BY t.${sortField} DESC`,
      [userId]
    )

    success(res, trips, '取得行程列表成功')
  } catch (err) {
    next(err)
  }
}

// ==================== 3. 取得單一行程詳細資料 ====================
export const getTripDetail = async (req, res, next) => {
  try {
    const { tripId } = req.params

    // 取得行程基本資料
    const [trips] = await pool.execute(
      `SELECT t.*, l.name as location_name
       FROM trips t                                    --  確保是 trips
       LEFT JOIN locations l ON t.location_id = l.location_id
       WHERE t.trip_id = ?`,
      [tripId]
    )

    if (trips.length === 0) {
      return error(res, '找不到該行程', 404)
    }

    // 取得每天的行程
    const [days] = await pool.execute(
      `SELECT * FROM trip_days WHERE trip_id = ? ORDER BY day_number`,
      [tripId]
    )

    // 取得每天的景點項目
    for (let day of days) {
      const [items] = await pool.execute(
        `SELECT 
          ti.*,
          p.name as place_name,
          p.category,
          p.rating,
          p.latitude,
          p.longitude,
          p.google_place_id
        FROM trip_items ti                            --  確保是 trip_items
        LEFT JOIN places p ON ti.place_id = p.place_id
        WHERE ti.trip_day_id = ?
        ORDER BY ti.sort_order`,
        [day.trip_day_id]
      )
      day.items = items
    }

    success(res, { trip: trips[0], days }, '取得行程詳細資料成功')
  } catch (err) {
    next(err)
  }
}

// ==================== 4. 更新行程 ====================
export const updateTrip = async (req, res, next) => {
  try {
    const { tripId } = req.params
    const updateFields = req.body

    // 檢查行程是否存在
    const [existingTrip] = await pool.execute(
      `SELECT trip_id FROM trips WHERE trip_id = ?`,
      [tripId]
    )

    if (existingTrip.length === 0) {
      return error(res, '找不到該行程', 404)
    }

    // 建立動態更新 SQL
    const allowedFields = [
      'trip_name',
      'description',
      'start_date',
      'end_date',
      'cover_image_url',
      'summary_text',
      'is_public',
      'location_id',
    ]

    const updates = []
    const values = []

    for (const [key, value] of Object.entries(updateFields)) {
      if (allowedFields.includes(key)) {
        updates.push(`${key} = ?`)
        values.push(value)
      }
    }

    if (updates.length === 0) {
      return error(res, '沒有可更新的欄位', 400)
    }

    values.push(tripId)

    await pool.execute(
      `UPDATE trips SET ${updates.join(', ')} WHERE trip_id = ?`,
      values
    )

    success(res, null, '行程更新成功')
  } catch (err) {
    next(err)
  }
}

// ==================== 5. 刪除行程 ====================
export const deleteTrip = async (req, res, next) => {
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()

    const { tripId } = req.params

    // 檢查行程是否存在
    const [existingTrip] = await connection.execute(
      `SELECT trip_id FROM trips WHERE trip_id = ?`,
      [tripId]
    )

    if (existingTrip.length === 0) {
      await connection.rollback()
      return error(res, '找不到該行程', 404)
    }

    // 先刪除 trip_items (最底層)
    await connection.execute(
      `DELETE ti FROM trip_items ti
       INNER JOIN trip_days td ON ti.trip_day_id = td.trip_day_id
       WHERE td.trip_id = ?`,
      [tripId]
    )

    // 再刪除 trip_days
    await connection.execute(`DELETE FROM trip_days WHERE trip_id = ?`, [
      tripId,
    ])

    // 刪除 trip_favorites 中的記錄
    await connection.execute(`DELETE FROM trip_favorites WHERE trip_id = ?`, [
      tripId,
    ])

    // 最後刪除 trips
    await connection.execute(`DELETE FROM trips WHERE trip_id = ?`, [tripId])

    await connection.commit()

    success(res, null, '行程已刪除')
  } catch (err) {
    await connection.rollback()
    next(err)
  } finally {
    connection.release()
  }
}

export default {
  createTrip,
  getUserTrips,
  getTripDetail,
  updateTrip,
  deleteTrip,
}
