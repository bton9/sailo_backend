import pool from '../../config/database.js'
import { success, error } from '../../utils/custom/response.js'

/**
 * 行程景點項目管理 Controller
 */

// ==================== 1. 新增景點到某一天 ====================
export const addPlaceToDay = async (req, res, next) => {
  try {
    const { tripDayId } = req.params
    const {
      place_id,
      type = 'attraction',
      note = null,
      start_time = null,
      end_time = null,
    } = req.body

    // 檢查 trip_days 是否存在
    const [existingDay] = await pool.execute(
      `SELECT trip_day_id FROM trip_days WHERE trip_day_id = ?`,
      [tripDayId]
    )

    if (existingDay.length === 0) {
      return error(res, '找不到該天的行程', 404)
    }

    // 取得當前最大的 sort_order
    const [maxOrder] = await pool.execute(
      `SELECT MAX(sort_order) as max_order FROM trip_items WHERE trip_day_id = ?`,
      [tripDayId]
    )

    const sortOrder = (maxOrder[0]?.max_order || 0) + 1

    const [result] = await pool.execute(
      `INSERT INTO trip_items
   (trip_day_id, place_id, type, note, start_time, end_time, sort_order)
   VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [tripDayId, place_id, type, note, start_time, end_time, sortOrder]
    )

    success(
      res,
      {
        trip_item_id: result.insertId,
        sort_order: sortOrder,
      },
      '景點已加入行程',
      201
    )
  } catch (err) {
    next(err)
  }
}

// ==================== 2. 刪除行程中的景點 ====================
export const removePlaceFromTrip = async (req, res, next) => {
  try {
    const { tripItemId } = req.params

    // 檢查項目是否存在
    const [existing] = await pool.execute(
      `SELECT trip_item_id FROM trip_items WHERE trip_item_id = ?`,
      [tripItemId]
    )

    if (existing.length === 0) {
      return error(res, '找不到該景點項目', 404)
    }

    await pool.execute(`DELETE FROM trip_items WHERE trip_item_id = ?`, [
      tripItemId,
    ])

    success(res, null, '景點已從行程中移除')
  } catch (err) {
    next(err)
  }
}

// ==================== 3. 更新景點順序 ====================
export const updatePlaceOrder = async (req, res, next) => {
  try {
    const { tripItemId } = req.params
    const { sort_order } = req.body

    // 檢查項目是否存在
    const [existing] = await pool.execute(
      `SELECT trip_item_id FROM trip_items WHERE trip_item_id = ?`,
      [tripItemId]
    )

    if (existing.length === 0) {
      return error(res, '找不到該景點項目', 404)
    }

    await pool.execute(
      `UPDATE trip_items SET sort_order = ? WHERE trip_item_id = ?`,
      [sort_order, tripItemId]
    )

    success(res, null, '順序已更新')
  } catch (err) {
    next(err)
  }
}

export default {
  addPlaceToDay,
  removePlaceFromTrip,
  updatePlaceOrder,
}
