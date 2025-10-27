import express from 'express'
import * as tripFavoriteController from '../../controllers/custom/tripfavoritecontroller.js'
import {
  validateFavorite,
  validateUserId,
} from '../../middleware/custom/tripvalidator.js'

const router = express.Router()

/**
 * @route   POST /api/trip-favorites
 * @desc    收藏行程
 * @access  Public (之後可加入認證)
 */
router.post('/', validateFavorite, tripFavoriteController.addFavorite)

/**
 * @route   DELETE /api/trip-favorites/:userId/:tripId  ✅ 新增這個
 * @desc    取消收藏 (使用 URL 參數)
 * @access  Public
 */
router.delete('/:userId/:tripId', tripFavoriteController.removeFavorite)

/**
 * @route   DELETE /api/trip-favorites  ✅ 保留這個 (使用 body)
 * @desc    取消收藏 (使用 body)
 * @access  Public (之後可加入認證)
 */
router.delete('/', validateFavorite, tripFavoriteController.removeFavorite)

/**
 * @route   GET /api/trip-favorites/user/:userId
 * @desc    取得使用者收藏的行程列表
 * @access  Public
 */
router.get(
  '/user/:userId',
  validateUserId,
  tripFavoriteController.getUserFavorites
)

export default router
