import express from 'express';
const router = express.Router();

// Controller
import {
  togglePostLike,
  toggleCommentLike,
  toggleBookmark
} from '../../controllers/blog/interaction.controller.js';

// Middleware
import { blogAuthMiddleware as authMiddleware, optionalAuth } from '../../middleware/blog/blogAuth.js';
import validate from '../../middleware/blog/validate.middleware.js';

// Validators
import {
  validatePostId,
  validateCommentId
} from '../../utils/blog/validators.js';

/**
 * 互動功能路由
 * Base: /api/blog/interactions
 */

// 按讚/取消按讚文章
router.post(
  '/posts/:postId/like',
  authMiddleware,
  validatePostId,
  validate,
  togglePostLike
);

// 按讚/取消按讚留言
router.post(
  '/comments/:commentId/like',
  authMiddleware,
  validateCommentId,
  validate,
  toggleCommentLike
);

// 收藏/取消收藏文章
router.post(
  '/posts/:postId/bookmark',
  authMiddleware,
  validatePostId,
  validate,
  toggleBookmark
);

export default router;