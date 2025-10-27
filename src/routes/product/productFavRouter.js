// routes/favoriteRoutes.js
import express from 'express'
import {
  checkFavoriteStatus,
  toggleFavorite,
  getUserFavorites,
} from '../../controllers/product/productFav.js'

const router = express.Router()

// ========== 收藏功能路由 ==========

// 檢查收藏狀態
router.get('/products/:id/favorite/check', checkFavoriteStatus)

// 切換收藏 (加入/移除)
router.post('/products/:id/favorite', toggleFavorite)

// 取得用戶收藏列表
router.get('/users/:userId/favorites', getUserFavorites)

export default router
