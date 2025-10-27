import express from 'express'
import * as tripUploadController from '../../controllers/custom/tripuploadcontroller.js'
import {
  uploadTripCover,
  handleUploadError,
} from '../../middleware/custom/tripupload.js'

const router = express.Router()

/**
 * @route   POST /api/trip-upload/cover
 * @desc    上傳行程封面圖
 * @access  Public (之後可加入認證)
 */
router.post(
  '/cover',
  uploadTripCover,
  handleUploadError,
  tripUploadController.uploadTripCover
)

/**
 * @route   DELETE /api/trip-upload/:fileId
 * @desc    刪除 ImageKit 圖片 (選用)
 * @access  Public (之後可加入認證)
 */
router.delete('/:fileId', tripUploadController.deleteImage)

export default router
