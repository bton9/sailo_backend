import express from 'express'
import orderController from '../../controllers/cart/order.controller.js'
import {
  validateCreateOrder,
  validateOrderId,
  validateUserId,
} from '../../middleware/cart/validateCart.middleware.js'
import {
  requireAuth,
  requireAdmin,
} from '../../middleware/cart/authCart.middleware.js'

const router = express.Router()

/**
 * @route   POST /api/order/create
 * @desc    建立訂單
 * @access  Private
 */
router.post(
  '/create',
  validateCreateOrder,
  requireAuth,
  orderController.createOrder
)

/**
 * @route   GET /api/order/list
 * @desc    取得用戶所有訂單（使用 JWT 或 query parameter）
 * @access  Private
 * 
 * 使用方式:
 * - GET /api/order/list (從 JWT 取 userId)
 * - GET /api/order/list?userId=1 (從 query 取 userId)
 * - GET /api/order/list?status=processing (篩選狀態)
 */
router.get('/list', requireAuth, orderController.getUserOrders)

/**
 * @route   GET /api/order/user/:userId
 * @desc    取得用戶所有訂單（使用路徑參數）
 * @access  Private
 */
router.get(
  '/user/:userId',
  validateUserId,
  requireAuth,
  orderController.getUserOrders
)

/**
 * @route   GET /api/order/:orderId
 * @desc    取得訂單詳情
 * @access  Private
 */
router.get('/:orderId', validateOrderId, requireAuth, orderController.getOrder)

/**
 * @route   PUT /api/order/:orderId/cancel
 * @desc    取消訂單
 * @access  Private
 */
router.put(
  '/:orderId/cancel',
  validateOrderId,
  requireAuth,
  orderController.cancelOrder
)

/**
 * @route   PUT /api/order/:orderId/status
 * @desc    更新訂單狀態（管理員功能）
 * @access  Admin
 */
router.put(
  '/:orderId/status',
  validateOrderId,
  requireAuth,
  requireAdmin,
  orderController.updateOrderStatus
)

export default router