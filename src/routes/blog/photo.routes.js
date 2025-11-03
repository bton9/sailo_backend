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
import { blogAuthMiddleware as authMiddleware, optionalAuth } from '../../middleware/blog/blogAuth.js';
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
  uploadPhoto
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

// 刪除圖片
router.delete(
  '/:photoId',
  authMiddleware,
  deletePhoto
);

export default router;