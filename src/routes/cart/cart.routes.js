import express from 'express'
import cartController from '../../controllers/cart/cart.controller.js'
import {
  validateAddToCart,
  validateUpdateQuantity,
  validateRemoveItem,
  validateUserId,
} from '../../middleware/cart/validateCart.middleware.js'
import {
  requireAuth,
  optionalAuth,
  rateLimiter,
} from '../../middleware/cart/authCart.middleware.js'

const router = express.Router()

/**
 * @route   POST /api/cart/add
 * @desc    加入商品到購物車
 * @access  Private
 * 
 * 注意：此路由放在最前面避免與動態路由衝突
 */
router.post(
  '/add',
  validateAddToCart,
  requireAuth,
  rateLimiter(50, 60000), // 限制每分鐘50次請求
  cartController.addToCart
)

/**
 * @route   PATCH /api/cart/update
 * @desc    更新購物車商品數量（前端使用此路徑）
 * @access  Private
 */
router.patch(
  '/update',
  validateUpdateQuantity,
  requireAuth,
  cartController.updateCartItem
)

/**
 * @route   DELETE /api/cart/remove
 * @desc    刪除購物車商品（前端使用此路徑）
 * @access  Private
 */
router.delete(
  '/remove',
  validateRemoveItem,
  requireAuth,
  cartController.removeCartItem
)

/**
 * @route   GET /api/cart
 * @desc    取得用戶購物車（使用 query parameter 或 JWT）
 * @access  Private (optionalAuth - 如果有 JWT 就用，沒有就從 query 取)
 * 
 * 使用方式:
 * - GET /api/cart (從 JWT 取 userId)
 * - GET /api/cart?userId=1 (從 query 取 userId)
 */
router.get('/', optionalAuth, cartController.getCart)

/**
 * @route   DELETE /api/cart/clear
 * @desc    清空購物車（使用 JWT 取得 userId）
 * @access  Private
 */
router.delete('/clear', requireAuth, cartController.clearCart)

/**
 * @route   GET /api/cart/:userId
 * @desc    取得用戶購物車（使用路徑參數）
 * @access  Private
 */
router.get('/:userId', validateUserId, optionalAuth, cartController.getCart)

/**
 * @route   PUT /api/cart/item/:itemId
 * @desc    更新購物車商品數量（備用路徑）
 * @access  Private
 */
router.put(
  '/item/:itemId',
  validateUpdateQuantity,
  requireAuth,
  cartController.updateCartItem
)

/**
 * @route   DELETE /api/cart/item/:itemId
 * @desc    刪除購物車商品（備用路徑）
 * @access  Private
 */
router.delete(
  '/item/:itemId',
  validateRemoveItem,
  requireAuth,
  cartController.removeCartItem
)

/**
 * @route   DELETE /api/cart/:userId/clear
 * @desc    清空購物車（使用路徑參數）
 * @access  Private
 */
router.delete(
  '/:userId/clear',
  validateUserId,
  requireAuth,
  cartController.clearCart
)

export default router