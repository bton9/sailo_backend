import express from 'express';
const router = express.Router();

// Controller
import {
  getAllTags,
  searchTags,
  getPostsByTag,
  addTagsToPost,
  removeTagFromPost
} from '../../controllers/blog/tag.controller.js';

// Middleware
import { blogAuthMiddleware as authMiddleware } from '../../middleware/blog/blogAuth.js';
import validate from '../../middleware/blog/validate.middleware.js';

// Validators
import {
  validateTagId,
  validatePostId,
  validateQueryParams
} from '../../utils/blog/validators.js';

/**
 * 標籤路由
 * Base: /api/blog/tags
 */

// 取得所有標籤列表
router.get(
  '/',
  getAllTags
);

// 搜尋標籤
router.get(
  '/search',
  searchTags
);

// 取得指定標籤的文章列表
router.get(
  '/:tagId/posts',
  validateTagId,
  validateQueryParams,
  validate,
  getPostsByTag
);

// 新增標籤到文章
router.post(
  '/posts/:postId',
  authMiddleware,
  validatePostId,
  validate,
  addTagsToPost
);

// 從文章移除標籤
router.delete(
  '/posts/:postId/:tagId',
  authMiddleware,
  validatePostId,
  validateTagId,
  validate,
  removeTagFromPost
);

export default router;