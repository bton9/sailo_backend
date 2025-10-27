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

const router = express.Router()

// ==================== Trip 基本操作 ====================

/**
 * @route   POST /api/trip-management/trips
 * @desc    建立新行程
 * @access  Public (之後可加入認證)
 */
router.post('/trips', validateCreateTrip, tripController.createTrip)

/**
 * @route   GET /api/trip-management/trips/user/:userId
 * @desc    取得使用者的所有行程
 * @access  Public
 */
router.get('/trips/user/:userId', validateUserId, tripController.getUserTrips)

/**
 * @route   GET /api/trip-management/trips/public
 * @desc    取得公開行程列表
 * @access  Public
 */
router.get('/trips/public', tripController2.getPublicTrips)

/**
 * @route   GET /api/trip-management/trips/search
 * @desc    搜尋行程
 * @access  Public
 */
router.get('/trips/search', validateSearch, tripController2.searchTrips)

/**
 * @route   GET /api/trip-management/trips/:tripId
 * @desc    取得單一行程詳細資料
 * @access  Public
 */
router.get('/trips/:tripId', validateTripId, tripController.getTripDetail)

/**
 * @route   PUT /api/trip-management/trips/:tripId
 * @desc    更新行程
 * @access  Public (之後可加入認證,只能更新自己的行程)
 */
router.put('/trips/:tripId', validateUpdateTrip, tripController.updateTrip)

/**
 * @route   DELETE /api/trip-management/trips/:tripId
 * @desc    刪除行程
 * @access  Public (之後可加入認證,只能刪除自己的行程)
 */
router.delete('/trips/:tripId', validateTripId, tripController.deleteTrip)

/**
 * @route   POST /api/trip-management/trips/:tripId/copy
 * @desc    複製行程
 * @access  Public
 */
router.post('/trips/:tripId/copy', validateTripId, tripController2.copyTrip)

// ==================== Trip Item 操作 ====================

/**
 * @route   POST /api/trip-management/trips/days/:tripDayId/items
 * @desc    新增景點到某一天
 * @access  Public
 */
router.post(
  '/trips/days/:tripDayId/items',
  validateAddPlace,
  tripItemController.addPlaceToDay
)

/**
 * @route   DELETE /api/trip-management/trips/items/:tripItemId
 * @desc    刪除行程中的景點
 * @access  Public
 */
router.delete(
  '/trips/items/:tripItemId',
  validateTripItemId,
  tripItemController.removePlaceFromTrip
)

/**
 * @route   PUT /api/trip-management/trips/items/:tripItemId/order
 * @desc    更新景點順序
 * @access  Public
 */
router.put(
  '/trips/items/:tripItemId/order',
  validateUpdateOrder,
  tripItemController.updatePlaceOrder
)

export default router
