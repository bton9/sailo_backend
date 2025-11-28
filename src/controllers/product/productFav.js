// controllers/favoritesController.js
import pool from '../../config/database.js'

const IMAGE_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

/**
 * 輔助函數:處理圖片路徑,轉為完整的絕對 URL
 */
const processImageUrls = (products) => {
  return products.map((product) => {
    const imagesArray = product.images ? product.images.split(',') : []

    const fullImages = imagesArray.map((img) => {
      const trimmedImg = img.trim()
      if (trimmedImg.startsWith('/uploads')) {
        return IMAGE_BASE_URL + trimmedImg
      }
      return trimmedImg
    })

    return {
      ...product,
      images: fullImages,
    }
  })
}

/**
 * ✅ 檢查商品是否已收藏
 */
export const checkFavoriteStatus = async (req, res) => {
  try {
    const { id } = req.params
    const { userId } = req.query

    if (!userId) {
      return res.json({
        success: true,
        isFavorite: false,
      })
    }

    const [existing] = await pool.query(
      'SELECT * FROM pd_favorite WHERE user_id = ? AND product_id = ?',
      [userId, id]
    )

    res.json({
      success: true,
      isFavorite: existing.length > 0,
    })
  } catch (error) {
    console.error(' 檢查收藏狀態時出錯:', error)
    res.status(500).json({
      success: false,
      error: '檢查收藏狀態失敗',
      message: error.message,
    })
  }
}

/**
 * ✅ 切換產品收藏狀態 (改進版)
 */
export const toggleFavorite = async (req, res) => {
  try {
    const { id } = req.params
    const { userId } = req.body

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: '請先登入',
      })
    }

    // 檢查是否已收藏
    const [existing] = await pool.query(
      'SELECT * FROM pd_favorite WHERE user_id = ? AND product_id = ?',
      [userId, id]
    )

    if (existing.length > 0) {
      // 取消收藏
      await pool.query(
        'DELETE FROM pd_favorite WHERE user_id = ? AND product_id = ?',
        [userId, id]
      )

      await pool.query(
        'UPDATE products SET favorite_count = GREATEST(favorite_count - 1, 0) WHERE product_id = ?',
        [id]
      )

      res.json({
        success: true,
        message: '已取消收藏',
        isFavorite: false,
      })
    } else {
      // 加入收藏
      await pool.query(
        'INSERT INTO pd_favorite (user_id, product_id) VALUES (?, ?)',
        [userId, id]
      )

      await pool.query(
        'UPDATE products SET favorite_count = favorite_count + 1 WHERE product_id = ?',
        [id]
      )

      res.json({
        success: true,
        message: '已加入收藏',
        isFavorite: true,
      })
    }
  } catch (error) {
    console.error(' 切換收藏狀態時出錯:', error)
    res.status(500).json({
      success: false,
      error: '操作失敗',
      message: error.message,
    })
  }
}

/**
 * 取得使用者的收藏商品列表
 */
export const getUserFavorites = async (req, res) => {
  try {
    const { userId } = req.params

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: '請先登入',
      })
    }

    const [favorites] = await pool.query(
      `SELECT 
        p.*,
        pc.category_name,
        f.created_at as favorited_at,
        GROUP_CONCAT(pi.image_url) as images
      FROM pd_favorite f
      JOIN products p ON f.product_id = p.product_id
      LEFT JOIN product_categories pc ON p.category_id = pc.category_id
      LEFT JOIN product_images pi ON p.product_id = pi.product_id
      WHERE f.user_id = ? AND p.is_active = 1
      GROUP BY p.product_id
      ORDER BY f.created_at DESC`,
      [userId]
    )

    const processedFavorites = processImageUrls(favorites)

    res.json({
      success: true,
      data: processedFavorites,
      total: processedFavorites.length,
    })
  } catch (error) {
    console.error(' 查詢收藏列表時出錯:', error)
    res.status(500).json({
      success: false,
      error: '查詢收藏列表失敗',
      message: error.message,
    })
  }
}
