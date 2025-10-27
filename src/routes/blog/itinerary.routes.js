import express from 'express';
const router = express.Router();

// Controller
import {
  getItineraryById,
  getPostsByItinerary,
  copyItinerary
} from '../../controllers/blog/itinerary.controller.js';

// Middleware
import { blogAuthMiddleware as authMiddleware, optionalAuth } from '../../middleware/blog/blogAuth.js';
import validate from '../../middleware/blog/validate.middleware.js';

// Validators
import {
  validateQueryParams
} from '../../utils/blog/validators.js';

/**
 * 行程路由
 * Base: /api/blog/itineraries
 */

// 取得單一行程詳細資訊
router.get(
  '/:tripId',
  getItineraryById
);

// 取得關聯此行程的文章列表
router.get(
  '/:tripId/posts',
  optionalAuth,
  validateQueryParams,
  validate,
  getPostsByItinerary
);

// 複製行程到自己的行程列表
router.post(
  '/:tripId/copy',
  authMiddleware,
  copyItinerary
);

export default router;