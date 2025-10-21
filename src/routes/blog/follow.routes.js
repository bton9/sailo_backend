import express from 'express';
const router = express.Router();

// Controller
import {
  toggleFollow,
  getFollowers,
  getFollowing,
  getUserStats,
  checkFollowStatus  // ⭐ 加這行
} from '../../controllers/blog/follow.controller.js';

import {
  getUserPosts,
  getUserLikedPosts  // ⭐ 加這行
} from '../../controllers/blog/post.controller.js';

import {
  getUserBookmarks
} from '../../controllers/blog/interaction.controller.js';

import {
  getUserItineraries
} from '../../controllers/blog/itinerary.controller.js';

// Middleware
import { blogAuthMiddleware as authMiddleware } from '../../middleware/blog/blogAuth.js';
import validate from '../../middleware/blog/validate.middleware.js';

// Validators
import {
  validateUserId,
  validateQueryParams
} from '../../utils/blog/validators.js';

/**
 * 使用者相關路由
 * Base: /api/blog/users
 */

// 取得使用者統計資料
router.get(
  '/:userId/stats',
  validateUserId,
  validate,
  getUserStats
);

// 取得使用者的文章列表
router.get(
  '/:userId/posts',
  validateUserId,
  validateQueryParams,
  validate,
  getUserPosts
);

// ⭐ 新增:取得使用者按讚的文章
router.get(
  '/:userId/liked',
  validateUserId,
  validateQueryParams,
  validate,
  getUserLikedPosts
);

// 取得使用者的收藏列表
router.get(
  '/:userId/bookmarks',
  validateUserId,
  validateQueryParams,
  validate,
  getUserBookmarks
);

// 取得使用者的行程列表
router.get(
  '/:userId/itineraries',
  validateUserId,
  validate,
  getUserItineraries
);

// 追蹤/取消追蹤使用者
router.post(
  '/:userId/follow',
  authMiddleware,
  validateUserId,
  validate,
  toggleFollow
);

// ⭐ 新增:檢查追蹤狀態
router.get(
  '/:userId/follow-status',
  authMiddleware,
  validateUserId,
  validate,
  checkFollowStatus
);

// 取得使用者的追蹤者列表
router.get(
  '/:userId/followers',
  validateUserId,
  validateQueryParams,
  validate,
  getFollowers
);

// 取得使用者追蹤中的列表
router.get(
  '/:userId/following',
  validateUserId,
  validateQueryParams,
  validate,
  getFollowing
);

export default router;