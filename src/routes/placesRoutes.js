import express from 'express'
import { getPlaces, getPlaceById } from '../controllers/placesController.js'
import {
  uploadImageMiddleware,
  handleImageUpload,
  handleGalleryUpload,
  getPlaceGallery,
  deleteGalleryImage,
} from '../controllers/uploadController.js'
import { query } from '../config/database.js'
import { toggleFavorite } from '../controllers/favoriteController.js'

const router = express.Router()

// 取得全部景點
router.get('/', getPlaces)

//  單一景點（含地點名稱與封面）
router.get('/with-location/:id', async (req, res) => {
  const placeId = req.params.id

  try {
    const sql = `
      SELECT 
        p.place_id,
        p.name,
        p.category,
        p.location_id,
        l.name AS location_name,
        p.description,
        p.rating,
        p.latitude,
        p.longitude,
        m.url AS cover_image
      FROM places p
      LEFT JOIN locations l ON p.location_id = l.location_id
      LEFT JOIN media m ON p.place_id = m.place_id AND m.is_cover = 1
      WHERE p.place_id = ?
      LIMIT 1
    `
    const rows = await query(sql, [placeId])

    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, message: '找不到景點' })
    }

    res.json({ success: true, data: rows[0] })
  } catch (err) {
    console.error(' SQL Error:', err.message)
    res
      .status(500)
      .json({ success: false, message: '伺服器錯誤', error: err.message })
  }
})

// 取得單一景點（包含地點名稱）
router.get('/:id', async (req, res) => {
  const { id } = req.params
  try {
    const sql = `
      SELECT 
        p.*, 
        l.name AS location_name
      FROM places p
      LEFT JOIN locations l ON p.location_id = l.location_id
      WHERE p.place_id = ?
    `
    const rows = await query(sql, [id])

    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, message: '找不到景點' })
    }

    res.json({ success: true, data: rows[0] })
  } catch (err) {
    console.error(' SQL Error:', err.message)
    res
      .status(500)
      .json({ success: false, message: '伺服器錯誤', error: err.message })
  }
})

// ============ 圖片相關路由 ============

// 封面圖片上傳（原有功能）
router.post('/upload', uploadImageMiddleware, handleImageUpload)

//  新增：上傳到相簿
router.post('/gallery/upload', uploadImageMiddleware, handleGalleryUpload)

//  新增：取得景點相簿
router.get('/:place_id/gallery', getPlaceGallery)

//  新增：刪除相簿圖片
router.delete('/gallery/:media_id', deleteGalleryImage)

// ============ 收藏相關路由 ============

// 收藏/取消收藏
router.post('/:place_id/favorite', toggleFavorite)

// 取得使用者收藏清單
router.get('/user/:user_id/favorites', async (req, res) => {
  const { user_id } = req.params
  try {
    const sql = 'SELECT place_id FROM favorites WHERE user_id = ?'
    const rows = await query(sql, [user_id])
    res.json({ success: true, favorites: rows })
  } catch (err) {
    console.error(' SQL Error:', err.message)
    res
      .status(500)
      .json({ success: false, message: '資料庫錯誤', error: err.message })
  }
})

export default router
