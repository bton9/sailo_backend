/**
 * 購物車模組路由匯總
 * 檔案路徑: backend/src/routes/cart/index.js
 *
 * 功能：整合所有購物車相關路由
 */

import express from 'express'
import cartRoutes from './cart.routes.js'
import orderRoutes from './order.routes.js'
import paymentRoutes from './payment.routes.js'

const router = express.Router()

/**
 * 購物車路由
 * Base: /api/cart
 */
router.use('/cart', cartRoutes)

/**
 * 訂單路由
 * Base: /api/order
 */
router.use('/order', orderRoutes)

/**
 * 付款路由
 * Base: /api/payment
 */
router.use('/payment', paymentRoutes)

/**
 * 健康檢查
 * GET /api/health
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: '購物車模組運作正常',
    timestamp: new Date().toISOString(),
  })
})

export default router
