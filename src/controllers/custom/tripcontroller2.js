import pool from '../../config/database.js'
import { success, error } from '../../utils/custom/response.js'

/**
 * 行程管理 Controller - 第2部分
 */

// ==================== 6. 複製行程 ====================
export const copyTrip = async (req, res, next) => {
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()

    const { tripId } = req.params
    const { user_id } = req.body

    // 取得原行程資料
    const [originalTrip] = await connection.execute(
      `SELECT * FROM trips WHERE trip_id = ?`,
      [tripId]
    )

    if (originalTrip.length === 0) {
      await connection.rollback()
      return error(res, '找不到原行程', 404)
    }

    const trip = originalTrip[0]

    // 建立新行程
    const [newTrip] = await connection.execute(
      `INSERT INTO trips (
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
      `SELECT * FROM trip_days WHERE trip_id = ? ORDER BY day_number`,
      [tripId]
    )

    for (const day of days) {
      const [newDay] = await connection.execute(
        `INSERT INTO trip_days (trip_id, date, day_number) VALUES (?, ?, ?)`,
        [newTripId, day.date, day.day_number]
      )

      const newDayId = newDay.insertId

      // 複製該天的景點
      const [items] = await connection.execute(
        `SELECT * FROM trip_items WHERE trip_day_id = ? ORDER BY sort_order`,
        [day.trip_day_id]
      )

      for (const item of items) {
        await connection.execute(
          `INSERT INTO trip_items
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

    success(res, { new_trip_id: newTripId }, '行程複製成功', 201)
  } catch (err) {
    await connection.rollback()
    next(err)
  } finally {
    connection.release()
  }
}

// ==================== 7. 搜尋行程 ====================
export const searchTrips = async (req, res, next) => {
  try {
    const { keyword, location_id, is_public } = req.query

    let sql = `
      SELECT 
        t.*,
        l.name as location_name,
        u.name as user_name,
        COUNT(DISTINCT td.trip_day_id) as total_days,
        COUNT(DISTINCT ti.trip_item_id) as total_items
      FROM trips t
      LEFT JOIN locations l ON t.location_id = l.location_id
      LEFT JOIN users u ON t.user_id = u.id
      LEFT JOIN trip_days td ON t.trip_id = td.trip_id
      LEFT JOIN trip_items ti ON td.trip_day_id = ti.trip_day_id
      WHERE 1=1
    `

    const params = []

    if (keyword) {
      sql += ` AND (t.trip_name LIKE ? OR t.description LIKE ?)`
      params.push(`%${keyword}%`, `%${keyword}%`)
    }

    if (location_id) {
      sql += ` AND t.location_id = ?`
      params.push(location_id)
    }

    if (is_public !== undefined) {
      const isPublicValue = is_public === 'true' || is_public === '1' ? 1 : 0
      sql += ` AND t.is_public = ?`
      params.push(isPublicValue)
    }

    sql += ` GROUP BY t.trip_id ORDER BY t.created_at DESC`

    const [trips] = await pool.execute(sql, params)

    success(res, trips, '搜尋完成')
  } catch (err) {
    next(err)
  }
}

// ==================== 8. 取得公開行程列表 ====================
export const getPublicTrips = async (req, res, next) => {
  try {
    const { location_id, sort = 'created_at' } = req.query

    const allowedSortFields = ['created_at', 'start_date', 'trip_name']
    const sortField = allowedSortFields.includes(sort) ? sort : 'created_at'

    let sql = `
      SELECT 
        t.*,
        l.name as location_name,
        u.name as user_name,
        u.avatar as user_avatar,
        COUNT(DISTINCT td.trip_day_id) as total_days,
        COUNT(DISTINCT ti.trip_item_id) as total_items,
        COUNT(DISTINCT f.favorite_id) as favorite_count
      FROM trips t
      LEFT JOIN locations l ON t.location_id = l.location_id
      LEFT JOIN users u ON t.user_id = u.id
      LEFT JOIN trip_days td ON t.trip_id = td.trip_id
      LEFT JOIN trip_items ti ON td.trip_day_id = ti.trip_day_id
      LEFT JOIN trip_favorites f ON t.trip_id = f.trip_id
      WHERE t.is_public = 1
    `

    const params = []

    if (location_id) {
      sql += ` AND t.location_id = ?`
      params.push(location_id)
    }

    sql += ` GROUP BY t.trip_id ORDER BY t.${sortField} DESC`

    const [trips] = await pool.execute(sql, params)

    success(res, trips, '取得公開行程列表成功')
  } catch (err) {
    next(err)
  }
}

export default {
  copyTrip,
  searchTrips,
  getPublicTrips,
}
