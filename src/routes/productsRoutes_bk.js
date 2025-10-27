// src/routes/productsRoutes.js

import express from 'express'

import {
  getProductCount,
  getProducts,
  getProductById,
  getCategories,
} from '../controllers/productsController.js'

// ⭐ 導入認證 middleware
import { verifyToken } from '../middleware/pd_auth.js'

const router = express.Router()

router.get('/categories', getCategories) /
  // 公開的 API（不需登入）
  router.get('/count', getProductCount)

// 需要登入的 API
router.get('/', verifyToken, getProducts)
router.get('/:id', verifyToken, getProductById)

export default router
