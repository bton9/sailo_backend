import express from 'express'
import {
  getUserFavorites,
  getListPlaces,
  toggleFavorite,
  createList,
  deleteList,
} from '../controllers/favoriteController.js'

const router = express.Router()

// 取得使用者的所有收藏清單（含景點）
router.get('/:userId', getUserFavorites)

// 取得某個清單的所有景點
router.get('/list/:listId', getListPlaces) // 用 listId 取代 listName

// 切換收藏（收藏/取消收藏）
router.post('/toggle', toggleFavorite) // body: { listId, placeId }

// 新增收藏清單
router.post('/list/create', createList)

// 刪除收藏清單（需指定 userId 與 listId）
router.delete('/:userId/list/:listId', deleteList)
export default router
