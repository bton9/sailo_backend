import express from 'express'
import * as tripController from '../../controllers/custom/tripcontroller.js'
import * as tripController2 from '../../controllers/custom/tripcontroller2.js'
import * as tripItemController from '../../controllers/custom/tripitemcontroller.js'
import {
  validateCreateTrip,
  validateUpdateTrip,
  validateAddPlace,
  validateUpdateOrder,
  validateTripId,
  validateUserId,
  validateTripItemId,
  validateSearch,
} from '../../middleware/custom/tripvalidator.js'
import { authenticate } from '../../middleware/authV2.js'

const router = express.Router()

// ==================== Trip 基本操作 ====================

/**
 * @route   POST /api/trip-management/trips
 * @desc    建立新行程
 * @access  Private（需登入）
 */
router.post(
  '/trips',
  authenticate,
  validateCreateTrip,
  tripController.createTrip
)

/**
 * @route   GET /api/trip-management/trips/user/:userId
 * @desc    取得使用者的所有行程
 * @access  Private（只能查詢自己的行程列表）
 */
router.get(
  '/trips/user/:userId',
  authenticate,
  validateUserId,
  tripController.getUserTrips
)

/**
 * @route   GET /api/trip-management/trips/public
 * @desc    取得公開行程列表
 * @access  Public（公開行程瀏覽，不需登入）
 */
router.get('/trips/public', tripController2.getPublicTrips)

/**
 * @route   GET /api/trip-management/trips/search
 * @desc    搜尋行程（僅搜尋公開行程）
 * @access  Public（公開行程瀏覽，不需登入）
 */
router.get('/trips/search', validateSearch, tripController2.searchTrips)

/**
 * @route   GET /api/trip-management/trips/:tripId
 * @desc    取得單一行程詳細資料
 * @access  Private（公開行程任何登入者可看，私人行程僅本人可看）
 */
router.get(
  '/trips/:tripId',
  authenticate,
  validateTripId,
  tripController.getTripDetail
)

/**
 * @route   PUT /api/trip-management/trips/:tripId
 * @desc    更新行程
 * @access  Private（僅能更新自己的行程）
 */
router.put(
  '/trips/:tripId',
  authenticate,
  validateUpdateTrip,
  tripController.updateTrip
)

/**
 * @route   DELETE /api/trip-management/trips/:tripId
 * @desc    刪除行程
 * @access  Private（僅能刪除自己的行程）
 */
router.delete(
  '/trips/:tripId',
  authenticate,
  validateTripId,
  tripController.deleteTrip
)

/**
 * @route   POST /api/trip-management/trips/:tripId/copy
 * @desc    複製行程
 * @access  Private（僅能複製公開行程或自己的行程）
 */
router.post(
  '/trips/:tripId/copy',
  authenticate,
  validateTripId,
  tripController2.copyTrip
)

// ==================== Trip Item 操作 ====================

/**
 * @route   POST /api/trip-management/trips/days/:tripDayId/items
 * @desc    新增景點到某一天
 * @access  Private（僅能操作自己的行程）
 */
router.post(
  '/trips/days/:tripDayId/items',
  authenticate,
  validateAddPlace,
  tripItemController.addPlaceToDay
)

/**
 * @route   DELETE /api/trip-management/trips/items/:tripItemId
 * @desc    刪除行程中的景點
 * @access  Private（僅能操作自己的行程）
 */
router.delete(
  '/trips/items/:tripItemId',
  authenticate,
  validateTripItemId,
  tripItemController.removePlaceFromTrip
)

/**
 * @route   PUT /api/trip-management/trips/items/:tripItemId/order
 * @desc    更新景點順序
 * @access  Private（僅能操作自己的行程）
 */
router.put(
  '/trips/items/:tripItemId/order',
  authenticate,
  validateUpdateOrder,
  tripItemController.updatePlaceOrder
)

export default router
