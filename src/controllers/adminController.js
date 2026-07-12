/**
 * 管理者儀表板控制器
 * 路徑: sailo_backend/src/controllers/adminController.js
 *
 * 功能說明:
 * - 提供管理者儀表板所需的統計資訊
 * - 需要 admin 權限 (requireRole('admin'))
 */

import { query } from '../config/database.js'

/**
 * 取得儀表板統計資料
 * GET /api/v2/admin/stats
 *
 * Response:
 * {
 *   "success": true,
 *   "stats": {
 *     "totalUsers": 128,
 *     "totalOrders": 45,
 *     "totalProducts": 32
 *   }
 * }
 */
export async function getDashboardStats(req, res) {
  try {
    const [userRows, orderRows, productRows] = await Promise.all([
      query('SELECT COUNT(*) as count FROM users WHERE is_active = 1'),
      query('SELECT COUNT(*) as count FROM orders'),
      query('SELECT COUNT(*) as count FROM products WHERE is_active = 1'),
    ])

    res.json({
      success: true,
      stats: {
        totalUsers: userRows[0].count,
        totalOrders: orderRows[0].count,
        totalProducts: productRows[0].count,
      },
    })
  } catch (error) {
    console.error('查詢管理儀表板統計資料失敗:', error)
    res.status(500).json({
      success: false,
      message: '查詢統計資料失敗',
      error: error.message,
    })
  }
}
