// controllers/reviewsController.js
import pool from '../../config/database.js'

/**
 * ✅ 檢查用戶是否購買過商品 (使用 cart_detail)
 */
const checkUserPurchase = async (userId, productId) => {
  try {
    // 從 cart_detail 檢查用戶是否有此商品的購買記錄
    const [purchases] = await pool.query(
      `SELECT COUNT(*) as count 
      FROM order_detail od 
      JOIN orders o ON od.order_id = o.id 
      WHERE o.user_id = ? AND od.product_id = ?`,
      [userId, productId]
    )

    console.log(purchases)

    return purchases[0].count > 0
  } catch (error) {
    console.error('檢查購買記錄失敗:', error)
    return false
  }
}

/**
 * ✅ 新增評論 (需要登入且購買過)
 */
export const createReview = async (req, res) => {
  try {
    const { productId } = req.params
    const { userId, rating, title, comment, images } = req.body

    // 1. 驗證登入
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: '請先登入',
      })
    }

    // 2. 驗證必填欄位
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        error: '請提供有效的評分 (1-5)',
      })
    }

    if (!comment || comment.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: '請填寫評論內容',
      })
    }

    // 3. 檢查是否購買過
    const hasPurchased = await checkUserPurchase(userId, productId)
    if (!hasPurchased) {
      return res.status(403).json({
        success: false,
        error: '只有購買過此商品的用戶才能評論',
      })
    }

    // 4. 檢查是否已評論過 (排除已刪除的)
    const [existingReview] = await pool.query(
      'SELECT * FROM pd_review WHERE user_id = ? AND product_id = ? AND is_active = 1',
      [userId, productId]
    )

    if (existingReview.length > 0) {
      return res.status(400).json({
        success: false,
        error: '您已經評論過此商品了',
      })
    }

    // 5. 新增評論
    const [result] = await pool.query(
      `INSERT INTO pd_review 
       (product_id, user_id, rating, title, comment, images, is_verified_purchase, is_active) 
       VALUES (?, ?, ?, ?, ?, ?, 1, 1)`,
      [
        productId,
        userId,
        rating,
        title || null,
        comment,
        images ? JSON.stringify(images) : null,
      ]
    )

    // 6. 回傳新增的評論
    const [newReview] = await pool.query(
      `SELECT 
        r.*,
        u.name as user_name,
        u.nickname as user_nickname,
        u.avatar as user_avatar
      FROM pd_review r
      LEFT JOIN users u ON r.user_id = u.id
      WHERE r.id = ?`,
      [result.insertId]
    )

    res.status(201).json({
      success: true,
      message: '評論新增成功',
      data: {
        ...newReview[0],
        images: newReview[0].images ? JSON.parse(newReview[0].images) : [],
      },
    })
  } catch (error) {
    console.error(' 新增評論時出錯:', error)
    res.status(500).json({
      success: false,
      error: '新增評論失敗',
      message: error.message,
    })
  }
}

/**
 * ✅ 編輯評論 (只能編輯自己的)
 */
export const updateReview = async (req, res) => {
  try {
    const { reviewId } = req.params
    const { userId, rating, title, comment, images } = req.body

    // 1. 驗證登入
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: '請先登入',
      })
    }

    // 2. 驗證必填欄位
    if (!comment || comment.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: '請填寫評論內容',
      })
    }

    // 3. 檢查評論是否存在且屬於該用戶
    const [existingReview] = await pool.query(
      'SELECT * FROM pd_review WHERE id = ? AND user_id = ? AND is_active = 1',
      [reviewId, userId]
    )

    if (existingReview.length === 0) {
      return res.status(404).json({
        success: false,
        error: '找不到評論或您沒有權限編輯',
      })
    }

    // 4. 更新評論
    await pool.query(
      `UPDATE pd_review 
       SET rating = ?, title = ?, comment = ?, images = ?, updated_at = NOW()
       WHERE id = ? AND user_id = ?`,
      [
        rating || existingReview[0].rating,
        title !== undefined ? title : existingReview[0].title,
        comment,
        images ? JSON.stringify(images) : existingReview[0].images,
        reviewId,
        userId,
      ]
    )

    // 5. 回傳更新後的評論
    const [updatedReview] = await pool.query(
      `SELECT 
        r.*,
        u.name as user_name,
        u.nickname as user_nickname,
        u.avatar as user_avatar
      FROM pd_review r
      LEFT JOIN users u ON r.user_id = u.id
      WHERE r.id = ?`,
      [reviewId]
    )

    res.json({
      success: true,
      message: '評論更新成功',
      data: {
        ...updatedReview[0],
        images: updatedReview[0].images
          ? JSON.parse(updatedReview[0].images)
          : [],
      },
    })
  } catch (error) {
    console.error(' 更新評論時出錯:', error)
    res.status(500).json({
      success: false,
      error: '更新評論失敗',
      message: error.message,
    })
  }
}

/**
 * ✅ 刪除評論 (只能刪除自己的) - 軟刪除
 */
export const deleteReview = async (req, res) => {
  try {
    const { reviewId } = req.params
    const { userId } = req.body

    // 1. 驗證登入
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: '請先登入',
      })
    }

    // 2. 檢查評論是否存在且屬於該用戶
    const [existingReview] = await pool.query(
      'SELECT * FROM pd_review WHERE id = ? AND user_id = ? AND is_active = 1',
      [reviewId, userId]
    )

    if (existingReview.length === 0) {
      return res.status(404).json({
        success: false,
        error: '找不到評論或您沒有權限刪除',
      })
    }

    // 3. 軟刪除 (設為不活躍)
    await pool.query(
      'UPDATE pd_review SET is_active = 0, updated_at = NOW() WHERE id = ? AND user_id = ?',
      [reviewId, userId]
    )

    res.json({
      success: true,
      message: '評論刪除成功',
    })
  } catch (error) {
    console.error(' 刪除評論時出錯:', error)
    res.status(500).json({
      success: false,
      error: '刪除評論失敗',
      message: error.message,
    })
  }
}

/**
 * ✅ 檢查用戶是否可以評論此商品
 */
export const checkReviewPermission = async (req, res) => {
  try {
    const { productId } = req.params
    const { userId } = req.query

    console.log(productId, userId)

    if (!userId) {
      return res.json({
        success: true,
        canReview: false,
        reason: '請先登入',
      })
    }

    // 1. 檢查是否購買過
    const hasPurchased = await checkUserPurchase(userId, productId)
    if (!hasPurchased) {
      return res.json({
        success: true,
        canReview: false,
        reason: '只有購買過此商品的用戶才能評論',
      })
    }

    // 2. 檢查是否已評論過 (排除已刪除的)
    const [existingReview] = await pool.query(
      `SELECT 
        r.*,
        u.name as user_name,
        u.nickname as user_nickname,
        u.avatar as user_avatar
      FROM pd_review r
      LEFT JOIN users u ON r.user_id = u.id
      WHERE r.user_id = ? AND r.product_id = ? AND r.is_active = 1`,
      [userId, productId]
    )

    if (existingReview.length > 0) {
      return res.json({
        success: true,
        canReview: false,
        hasReviewed: true,
        review: {
          ...existingReview[0],
          images: existingReview[0].images
            ? JSON.parse(existingReview[0].images)
            : [],
        },
        reason: '您已經評論過此商品了',
      })
    }

    // 3. 可以評論
    res.json({
      success: true,
      canReview: true,
    })
  } catch (error) {
    console.error(' 檢查評論權限時出錯:', error)
    res.status(500).json({
      success: false,
      error: '檢查評論權限失敗',
      message: error.message,
    })
  }
}

/**
 * ✅ 標記評論為有幫助
 */
export const markReviewHelpful = async (req, res) => {
  try {
    const { reviewId } = req.params
    const { userId } = req.body

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: '請先登入',
      })
    }

    // 檢查評論是否存在且活躍
    const [review] = await pool.query(
      'SELECT * FROM pd_review WHERE id = ? AND is_active = 1',
      [reviewId]
    )

    if (review.length === 0) {
      return res.status(404).json({
        success: false,
        error: '找不到評論',
      })
    }

    // 檢查是否已標記過
    const [existing] = await pool.query(
      'SELECT * FROM pd_review_helpful WHERE review_id = ? AND user_id = ?',
      [reviewId, userId]
    )

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        error: '您已經標記過此評論了',
      })
    }

    // 新增標記
    await pool.query(
      'INSERT INTO pd_review_helpful (review_id, user_id) VALUES (?, ?)',
      [reviewId, userId]
    )

    // 更新計數
    await pool.query(
      'UPDATE pd_review SET helpful_count = helpful_count + 1 WHERE id = ?',
      [reviewId]
    )

    res.json({
      success: true,
      message: '感謝您的反饋',
    })
  } catch (error) {
    console.error(' 標記評論時出錯:', error)
    res.status(500).json({
      success: false,
      error: '操作失敗',
      message: error.message,
    })
  }
}

/**
 * ✅ 取得用戶的購買記錄 (用於測試/除錯)
 */
export const getUserPurchases = async (req, res) => {
  try {
    const { userId } = req.params

    const [purchases] = await pool.query(
      `SELECT 
        cd.id,
        cd.product_id,
        cd.quantity,
        cd.unit_price,
        cd.created_at,
        p.product_name,
        p.images
      FROM cart_detail cd
      JOIN carts c ON cd.cart_id = c.id
      JOIN products p ON cd.product_id = p.product_id
      WHERE c.user_id = ?
      ORDER BY cd.created_at DESC`,
      [userId]
    )

    res.json({
      success: true,
      data: purchases.map((item) => ({
        ...item,
        images: item.images ? JSON.parse(item.images) : [],
      })),
    })
  } catch (error) {
    console.error(' 取得購買記錄時出錯:', error)
    res.status(500).json({
      success: false,
      error: '取得購買記錄失敗',
      message: error.message,
    })
  }
}
