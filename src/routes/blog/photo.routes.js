import express from 'express';
const router = express.Router();

// Controller
import {
  uploadPhoto,
  addPhotoToPost,
  getPostPhotos,
  deletePhoto
} from '../../controllers/blog/photo.controller.js';

// Middleware
import { blogAuthMiddleware as authMiddleware } from '../../middleware/blog/blogAuth.js';
import { uploadSingle } from '../../middleware/upload.middleware.js';
import validate from '../../middleware/blog/validate.middleware.js';

// Validators
import {
  validatePostId
} from '../../utils/blog/validators.js';

/**
 * 圖片路由
 * Base: /api/blog/photos
 */

// 上傳單一圖片
router.post(
  '/upload',
  authMiddleware,
  uploadSingle,
  uploadPhoto
);

// 刪除圖片
router.delete(
  '/:photoId',
  authMiddleware,
  deletePhoto
);

// 取得文章的所有圖片
router.get(
  '/posts/:postId',
  validatePostId,
  validate,
  getPostPhotos
);

// 將圖片關聯到文章
router.post(
  '/posts/:postId',
  authMiddleware,
  validatePostId,
  validate,
  addPhotoToPost
);

export default router;