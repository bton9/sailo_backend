// routes/productReviewsRouter.js
import express from 'express'
import {
  createReview,
  updateReview,
  deleteReview,
  checkReviewPermission,
  markReviewHelpful,
} from '../../controllers/product/productReviewController.js' //  修正：檔案名稱對應

const router = express.Router()

// ============ 評論權限檢查 ============
// GET /api/products/:productId/reviews/permission?userId=xxx
router.get('/products/:productId/reviews/permission', checkReviewPermission)

// ============ 評論 CRUD ============
// POST /api/products/:productId/reviews
router.post('/products/:productId/reviews', createReview)

// PUT /api/reviews/:reviewId
router.put('/reviews/:reviewId', updateReview)

// DELETE /api/reviews/:reviewId
router.delete('/reviews/:reviewId', deleteReview)

// ============ 評論互動 ============
// POST /api/reviews/:reviewId/helpful
router.post('/reviews/:reviewId/helpful', markReviewHelpful)

export default router
