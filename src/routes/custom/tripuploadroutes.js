import express from 'express'
import * as tripUploadController from '../../controllers/custom/tripuploadcontroller.js'
import {
  uploadTripCover,
  handleUploadError,
} from '../../middleware/custom/tripupload.js'
import { authenticate } from '../../middleware/authV2.js'

const router = express.Router()

/**
 * @route   POST /api/trip-upload/cover
 * @desc    上傳行程封面圖
 * @access  Private（需登入）
 */
router.post(
  '/cover',
  authenticate,
  uploadTripCover,
  handleUploadError,
  tripUploadController.uploadTripCover
)

/**
 * @route   DELETE /api/trip-upload/:fileId
 * @desc    刪除 ImageKit 圖片 (選用)
 * @access  Private（需登入）
 */
router.delete('/:fileId', authenticate, tripUploadController.deleteImage)

export default router
