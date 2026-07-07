import express from 'express'
import * as tripFavoriteController from '../../controllers/custom/tripfavoritecontroller.js'
import {
  validateFavorite,
  validateUserId,
} from '../../middleware/custom/tripvalidator.js'
import { authenticate } from '../../middleware/authV2.js'

const router = express.Router()

/**
 * @route   POST /api/trip-favorites
 * @desc    收藏行程
 * @access  Private（需登入）
 */
router.post(
  '/',
  authenticate,
  validateFavorite,
  tripFavoriteController.addFavorite
)

/**
 * @route   DELETE /api/trip-favorites/:userId/:tripId   新增這個
 * @desc    取消收藏 (使用 URL 參數)
 * @access  Private（僅能取消自己的收藏）
 */
router.delete(
  '/:userId/:tripId',
  authenticate,
  tripFavoriteController.removeFavorite
)

/**
 * @route   DELETE /api/trip-favorites   保留這個 (使用 body)
 * @desc    取消收藏 (使用 body)
 * @access  Private（僅能取消自己的收藏）
 */
router.delete(
  '/',
  authenticate,
  validateFavorite,
  tripFavoriteController.removeFavorite
)

/**
 * @route   GET /api/trip-favorites/user/:userId
 * @desc    取得使用者收藏的行程列表
 * @access  Private（只能查詢自己的收藏列表）
 */
router.get(
  '/user/:userId',
  authenticate,
  validateUserId,
  tripFavoriteController.getUserFavorites
)

export default router
