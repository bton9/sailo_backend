import pool from '../../config/database.js'

// ImageKit 配置
const IMAGEKIT_URL_ENDPOINT =
  process.env.IMAGEKIT_URL_ENDPOINT || 'https://ik.imagekit.io/crjen7iza'
const IMAGEKIT_PATH = process.env.IMAGEKIT_PATH || '/producsts' // 注意是 producsts

/**
 * 輔助函數:處理圖片路徑,轉為 ImageKit URL
 */
const processImageUrls = (products) => {
  return products.map((product) => {
    const imagesArray = product.images ? product.images.split(',') : []

    const fullImages = imagesArray.map((img) => {
      const trimmedImg = img.trim()

      // 如果已經是完整的 ImageKit URL，直接返回
      if (trimmedImg.startsWith('https://ik.imagekit.io/')) {
        return trimmedImg
      }

      // 如果已經是完整的 http/https URL，直接返回
      if (
        trimmedImg.startsWith('http://') ||
        trimmedImg.startsWith('https://')
      ) {
        return trimmedImg
      }

      // 如果是舊的 /uploads 路徑，轉換為 ImageKit URL
      if (trimmedImg.startsWith('/uploads/')) {
        // 移除 /uploads/ 前綴，只保留檔案名稱
        const fileName = trimmedImg.replace('/uploads/', '')
        return `${IMAGEKIT_URL_ENDPOINT}${IMAGEKIT_PATH}/${fileName}`
      }

      // 如果只是檔案名稱，加上 ImageKit 完整路徑
      return `${IMAGEKIT_URL_ENDPOINT}${IMAGEKIT_PATH}/${trimmedImg}`
    })

    return {
      ...product,
      images: fullImages,
    }
  })
}

/**
 * 取得產品總數
 */
export const getProductCount = async (req, res) => {
  try {
    const {
      search = '',
      categoryId = '',
      inStock = '',
      minPrice = '',
      maxPrice = '',
      specialFilter = '',
    } = req.query

    let countQuery =
      'SELECT COUNT(DISTINCT p.product_id) as count FROM products p WHERE p.is_active = 1'
    const countParams = []

    if (search) {
      countQuery += ' AND (p.product_name LIKE ? OR p.description LIKE ?)'
      countParams.push(`%${search}%`, `%${search}%`)
    }

    if (categoryId) {
      countQuery += ' AND p.category_id = ?'
      countParams.push(parseInt(categoryId))
    }

    if (inStock === 'true') {
      countQuery += ' AND p.stock_quantity > 0'
    }

    if (minPrice) {
      countQuery += ' AND p.price >= ?'
      countParams.push(parseFloat(minPrice))
    }

    if (maxPrice) {
      countQuery += ' AND p.price <= ?'
      countParams.push(parseFloat(maxPrice))
    }

    // 特殊篩選
    if (specialFilter === 'popular') {
      countQuery += ' AND p.favorite_count > 0'
    } else if (specialFilter === 'bestseller') {
      countQuery += ' AND p.review_count > 3'
    } else if (specialFilter === 'highrated') {
      countQuery += ' AND p.avg_rating >= 4.0'
    }

    const [countResult] = await pool.query(countQuery, countParams)

    res.json({
      success: true,
      count: countResult[0].count,
    })
  } catch (error) {
    console.error('查詢產品總數時出錯:', error)
    res.status(500).json({
      success: false,
      error: '查詢產品總數失敗',
      message: error.message,
    })
  }
}

/**
 * 取得產品列表(含進階篩選)
 */
export const getProducts = async (req, res) => {
  try {
    const {
      search = '',
      page = 1,
      perPage = 12,
      categoryId = '',
      sortBy = 'created_at',
      sortOrder = 'DESC',
      inStock = '',
      minPrice = '',
      maxPrice = '',
      specialFilter = '',
    } = req.query

    const offset = (parseInt(page) - 1) * parseInt(perPage)

    // 主查詢 - 加入分類資訊和圖片
    let query = `
      SELECT 
        p.*,
        pc.category_name,
        pc.parent_name,
        GROUP_CONCAT(pi.image_url) as images
      FROM products p
      LEFT JOIN product_categories pc ON p.category_id = pc.category_id
      LEFT JOIN product_images pi ON p.product_id = pi.product_id
      WHERE p.is_active = 1
    `
    const params = []

    // 搜尋條件
    if (search) {
      query += ' AND (p.product_name LIKE ? OR p.description LIKE ?)'
      params.push(`%${search}%`, `%${search}%`)
    }

    // 分類篩選
    if (categoryId) {
      query += ' AND p.category_id = ?'
      params.push(parseInt(categoryId))
    }

    // 庫存篩選
    if (inStock === 'true') {
      query += ' AND p.stock_quantity > 0'
    }

    // 價格範圍篩選
    if (minPrice) {
      query += ' AND p.price >= ?'
      params.push(parseFloat(minPrice))
    }
    if (maxPrice) {
      query += ' AND p.price <= ?'
      params.push(parseFloat(maxPrice))
    }

    // GROUP BY 必須在特殊篩選之前
    query += ' GROUP BY p.product_id'

    // 特殊篩選 (使用 HAVING 因為涉及聚合欄位)
    if (specialFilter === 'popular') {
      query += ' HAVING p.favorite_count > 0'
    } else if (specialFilter === 'bestseller') {
      query += ' HAVING p.review_count > 3'
    } else if (specialFilter === 'highrated') {
      query += ' HAVING p.avg_rating >= 4.0'
    }

    // 排序（防止 SQL 注入）
    const sortMapping = {
      product_id: 'p.product_id',
      product_name: 'p.product_name',
      price: 'p.price',
      avg_rating: 'p.avg_rating',
      created_at: 'p.created_at',
      favorite_count: 'p.favorite_count',
      review_count: 'p.review_count',
    }

    const allowedSortOrders = ['ASC', 'DESC']

    const validSortBy = sortMapping[sortBy] || 'p.created_at'
    const validSortOrder = allowedSortOrders.includes(sortOrder.toUpperCase())
      ? sortOrder.toUpperCase()
      : 'DESC'

    query += ` ORDER BY ${validSortBy} ${validSortOrder}`

    // 分頁
    query += ' LIMIT ? OFFSET ?'
    params.push(parseInt(perPage), offset)

    console.log('執行查詢:', query)
    console.log('參數:', params)

    const [products] = await pool.query(query, params)

    // 處理圖片資料
    const processedProducts = processImageUrls(products)

    res.json({
      success: true,
      data: processedProducts,
      page: parseInt(page),
      perPage: parseInt(perPage),
      total: processedProducts.length,
    })
  } catch (error) {
    console.error('查詢產品列表時出錯:', error)
    res.status(500).json({
      success: false,
      error: '查詢產品列表失敗',
      message: error.message,
    })
  }
}

/**
 * 取得單一產品(含完整資訊、圖片、評論)
 */
export const getProductById = async (req, res) => {
  try {
    const { id } = req.params

    const [products] = await pool.query(
      `SELECT 
        p.*,
        pc.category_name,
        pc.parent_name,
        pc.description as category_description,
        GROUP_CONCAT(pi.image_url) as images
      FROM products p
      LEFT JOIN product_categories pc ON p.category_id = pc.category_id
      LEFT JOIN product_images pi ON p.product_id = pi.product_id
      WHERE p.product_id = ? AND p.is_active = 1
      GROUP BY p.product_id`,
      [id]
    )

    if (products.length === 0) {
      return res.status(404).json({
        success: false,
        error: '產品不存在',
      })
    }

    const [product] = processImageUrls(products)

    // 查詢產品評論
    try {
      const [reviews] = await pool.query(
        `SELECT 
          r.*,
          u.name as user_name,
          u.nickname as user_nickname,
          u.avatar as user_avatar
        FROM pd_review r
        LEFT JOIN users u ON r.user_id = u.id
        WHERE r.product_id = ? AND r.is_active = 1
        ORDER BY r.helpful_count DESC, r.created_at DESC
        LIMIT 10`,
        [id]
      )

      product.reviews = reviews.map((review) => ({
        ...review,
        images:
          review.images && typeof review.images === 'string'
            ? JSON.parse(review.images)
            : [],
      }))
    } catch (reviewError) {
      console.log('查詢評論時出錯:', reviewError.message)
      product.reviews = []
    }

    res.json({
      success: true,
      data: product,
    })
  } catch (error) {
    console.error('查詢產品時出錯:', error)
    res.status(500).json({
      success: false,
      error: '查詢產品失敗',
      message: error.message,
    })
  }
}

/**
 * 取得產品分類列表
 */
export const getCategories = async (req, res) => {
  try {
    const [categories] = await pool.query(
      `SELECT 
        pc.*,
        COUNT(p.product_id) as product_count
      FROM product_categories pc
      LEFT JOIN products p ON pc.category_id = p.category_id AND p.is_active = 1
      GROUP BY pc.category_id
      ORDER BY pc.category_id ASC`
    )

    res.json({
      success: true,
      data: categories,
    })
  } catch (error) {
    console.error('查詢分類列表時出錯:', error)
    res.status(500).json({
      success: false,
      error: '查詢分類列表失敗',
      message: error.message,
    })
  }
}

/**
 * 取得熱門產品
 */
export const getPopularProducts = async (req, res) => {
  try {
    const { limit = 10 } = req.query

    const [products] = await pool.query(
      `SELECT 
        p.*,
        pc.category_name,
        GROUP_CONCAT(pi.image_url) as images
      FROM products p
      LEFT JOIN product_categories pc ON p.category_id = pc.category_id
      LEFT JOIN product_images pi ON p.product_id = pi.product_id
      WHERE p.is_active = 1
      GROUP BY p.product_id
      ORDER BY 
        (p.avg_rating * 0.6 + (p.favorite_count / 100) * 0.4) DESC,
        p.review_count DESC
      LIMIT ?`,
      [parseInt(limit)]
    )

    const processedProducts = processImageUrls(products)

    res.json({
      success: true,
      data: processedProducts,
    })
  } catch (error) {
    console.error('查詢熱門產品時出錯:', error)
    res.status(500).json({
      success: false,
      error: '查詢熱門產品失敗',
      message: error.message,
    })
  }
}
