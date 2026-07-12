import pool from '../../config/database.js'
import { success, error } from '../../utils/custom/response.js'

/**
 * Trip Favorites Controller
 * 表：trip_favorites、trips、trip_days、trip_items、locations、users
 */

// ==================== 新增收藏 ====================
export const addFavorite = async (req, res, next) => {
  try {
    const { trip_id } = req.body
    // 收藏的擁有者一律是目前登入的使用者，不採用前端傳來的 user_id
    const user_id = req.user.userId

    // 檢查行程是否存在
    const [trip] = await pool.execute(
      'SELECT trip_id FROM trips WHERE trip_id = ?',
      [trip_id]
    )
    if (trip.length === 0) {
      return error(res, '找不到該行程', 404)
    }

    // 是否已收藏
    const [exists] = await pool.execute(
      'SELECT favorite_id FROM trip_favorites WHERE user_id = ? AND trip_id = ?',
      [user_id, trip_id]
    )
    if (exists.length > 0) {
      return error(res, '此行程已收藏', 400)
    }

    // 新增收藏
    const [result] = await pool.execute(
      `INSERT INTO trip_favorites (user_id, trip_id, created_at)
       VALUES (?, ?, NOW())`,
      [user_id, trip_id]
    )

    success(res, { favorite_id: result.insertId }, '收藏成功', 201)
  } catch (err) {
    next(err)
  }
}

// ==================== 移除收藏 ====================
export const removeFavorite = async (req, res, next) => {
  try {
    // 一律使用目前登入的使用者身分，不採用 URL 或 body 傳來的 userId，
    // 避免任何人能取消別人的收藏
    const userId = req.user.userId
    const tripId = req.params.tripId || req.body.trip_id

    console.log('取消收藏:', { userId, tripId })

    // 驗證參數
    if (!userId || !tripId) {
      return error(res, '缺少必要參數', 400)
    }

    //  使用 pool.execute
    const [result] = await pool.execute(
      'DELETE FROM trip_favorites WHERE user_id = ? AND trip_id = ?',
      [userId, tripId]
    )

    // 檢查是否有刪除資料
    if (result.affectedRows === 0) {
      return error(res, '找不到此收藏記錄', 404)
    }

    success(res, null, '取消收藏成功')
  } catch (err) {
    console.error('取消收藏錯誤:', err)
    next(err)
  }
}

// ==================== 取得使用者收藏列表 ====================
export const getUserFavorites = async (req, res, next) => {
  try {
    const { userId } = req.params

    // 只能查詢自己的收藏列表
    if (Number(userId) !== req.user.userId) {
      return error(res, '無權查詢其他使用者的收藏列表', 403)
    }

    const [favorites] = await pool.execute(
      `SELECT 
        f.*,
        t.trip_name,
        t.start_date,
        t.end_date,
        t.cover_image_url,
        t.summary_text,
        t.is_public,
        u.name as creator_name,
        u.avatar as creator_avatar,
        l.name as location_name,
        COUNT(DISTINCT td.trip_day_id) as total_days,
        COUNT(DISTINCT ti.trip_item_id) as total_items
      FROM trip_favorites f
      INNER JOIN trips t ON f.trip_id = t.trip_id
      LEFT JOIN users u ON t.user_id = u.id
      LEFT JOIN locations l ON t.location_id = l.location_id
      LEFT JOIN trip_days td ON t.trip_id = td.trip_id
      LEFT JOIN trip_items ti ON td.trip_day_id = ti.trip_day_id
      WHERE f.user_id = ?
      GROUP BY f.favorite_id
      ORDER BY f.created_at DESC`,
      [userId]
    )

    success(res, favorites, '取得收藏列表成功')
  } catch (err) {
    next(err)
  }
}

export default {
  addFavorite,
  removeFavorite,
  getUserFavorites,
}
