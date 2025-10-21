import express from 'express';
const router = express.Router();

// Controller
import {
  getPosts,
  getPostById,
  createPost,
  updatePost,
  deletePost,
  getUserPosts
} from '../../controllers/blog/post.controller.js';

// 留言 Controller
import {
  getCommentsByPostId,
  createComment
} from '../../controllers/blog/comment.controller.js';

// Middleware
import { blogAuthMiddleware as authMiddleware } from '../../middleware/blog/blogAuth.js';
import validate from '../../middleware/blog/validate.middleware.js';

// Validators
import {
  validateCreatePost,
  validateUpdatePost,
  validatePostId,
  validateQueryParams,
  validateCreateComment
} from '../../utils/blog/validators.js';

/**
 * 文章路由
 * Base: /api/blog/posts
 */

// 取得文章列表
router.get(
  '/',
  validateQueryParams,
  validate,
  getPosts
);

// 取得單一文章
router.get(
  '/:postId',
  validatePostId,
  validate,
  getPostById
);

// 建立文章
router.post(
  '/',
  authMiddleware,
  validateCreatePost,
  validate,
  createPost
);

// 更新文章
router.put(
  '/:postId',
  authMiddleware,
  validateUpdatePost,
  validate,
  updatePost
);

// 刪除文章
router.delete(
  '/:postId',
  authMiddleware,
  validatePostId,
  validate,
  deletePost
);

// 取得文章的留言列表
router.get(
  '/:postId/comments',
  validatePostId,
  validateQueryParams,
  validate,
  getCommentsByPostId
);

// 新增留言到文章
router.post(
  '/:postId/comments',
  authMiddleware,
  validateCreateComment,
  validate,
  createComment
);

export default router;