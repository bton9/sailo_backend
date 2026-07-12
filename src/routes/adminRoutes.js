/**
 * 管理者路由 (OAuth 2.0 版本)
 * 檔案路徑: sailo_backend/src/routes/adminRoutes.js
 *
 * 功能說明：
 * - 提供管理者儀表板所需的 API
 * - 所有路由都需要 admin 權限
 */

import express from 'express'
import { authenticate, requireRole } from '../middleware/authV2.js'
import { getDashboardStats } from '../controllers/adminController.js'

const router = express.Router()

/**
 * 取得儀表板統計資料
 * @route GET /api/v2/admin/stats
 * @access 私有路由 (需要 admin 權限)
 */
router.get('/stats', authenticate, requireRole('admin'), getDashboardStats)

export default router
