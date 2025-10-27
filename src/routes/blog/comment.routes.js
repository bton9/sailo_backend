import express from 'express';
const router = express.Router();

// Controller
import {
  updateComment,
  deleteComment
} from '../../controllers/blog/comment.controller.js';

// Middleware
import { blogAuthMiddleware as authMiddleware, optionalAuth } from '../../middleware/blog/blogAuth.js';
import validate from '../../middleware/blog/validate.middleware.js';

// Validators
import {
  validateUpdateComment,
  validateCommentId
} from '../../utils/blog/validators.js';

/**
 * 留言路由
 * Base: /api/blog/comments
 */

// 更新留言
router.put(
  '/:commentId',
  authMiddleware,
  validateUpdateComment,
  validate,
  updateComment
);

// 刪除留言
router.delete(
  '/:commentId',
  authMiddleware,
  validateCommentId,
  validate,
  deleteComment
);

export default router;