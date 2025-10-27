import express from 'express';
const router = express.Router();

// Controller
import {
  search,
  getTrendingKeywords
} from '../../controllers/blog/search.controller.js';

// Middleware
import { optionalAuth } from '../../middleware/blog/blogAuth.js';
import validate from '../../middleware/blog/validate.middleware.js';

// Validators
import {
  validateSearchParams
} from '../../utils/blog/validators.js';

/**
 * 搜尋路由
 * Base: /api/blog/search
 */

// 全站搜尋
router.get(
  '/',
  optionalAuth,
  validateSearchParams,
  validate,
  search
);

// 取得熱門搜尋關鍵字
router.get(
  '/trending',
  getTrendingKeywords
);

export default router;