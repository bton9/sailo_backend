import pool from '../../config/database.js'

/**
 * 購物車相關查詢（修正版 - 移除 is_primary 欄位）
 *
 * 重要變更:
 * - 移除對 product_images.is_primary 的依賴
 * - 直接取得第一張圖片
 */
export const cartQueries = {
  /**
   * 取得用戶購物車商品列表（含商品資訊和最新價格）
   * @param {number} userId - 用戶ID
   * @returns {Array} 購物車商品列表
   */
  async getCartItems(userId) {
    const [rows] = await pool.query(
      `SELECT 
        ci.id,
        ci.user_id,
        ci.product_id,
        ci.quantity,
        ci.created_at,
        p.product_name,
        p.description,
        p.price AS unit_price,
        p.stock_quantity,
        p.is_active,
        (SELECT image_url FROM product_images WHERE product_id = p.product_id LIMIT 1) AS image_url
      FROM cart_items ci
      INNER JOIN products p ON ci.product_id = p.product_id
      WHERE ci.user_id = ?
      ORDER BY ci.created_at DESC`,
      [userId]
    )
    return rows
  },

  /**
   * 檢查特定商品是否已在購物車
   * @param {number} userId - 用戶ID
   * @param {number} productId - 商品ID
   * @returns {Object|null} 購物車項目
   */
  async getCartItem(userId, productId) {
    const [rows] = await pool.query(
      `SELECT 
        ci.*,
        p.price AS current_price,
        p.stock_quantity
      FROM cart_items ci
      INNER JOIN products p ON ci.product_id = p.product_id
      WHERE ci.user_id = ? AND ci.product_id = ?`,
      [userId, productId]
    )
    return rows[0]
  },

  /**
   * 根據 cart_item_id 取得單一購物車項目
   * @param {number} cartItemId - 購物車項目ID
   * @returns {Object|null} 購物車項目
   */
  async getCartItemById(cartItemId) {
    const [rows] = await pool.query(
      `SELECT 
        ci.*,
        p.price AS current_price,
        p.stock_quantity,
        p.product_name
      FROM cart_items ci
      INNER JOIN products p ON ci.product_id = p.product_id
      WHERE ci.id = ?`,
      [cartItemId]
    )
    return rows[0]
  },

  /**
   * 新增商品到購物車（如已存在則更新數量）
   * @param {number} userId - 用戶ID
   * @param {number} productId - 商品ID
   * @param {number} quantity - 數量
   * @returns {number} 插入的 ID 或影響的行數
   */
  async addCartItem(userId, productId, quantity) {
    const [result] = await pool.query(
      `INSERT INTO cart_items (user_id, product_id, quantity)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE 
         quantity = quantity + VALUES(quantity),
         created_at = CURRENT_TIMESTAMP`,
      [userId, productId, quantity]
    )
    return result.insertId || result.affectedRows
  },

  /**
   * 更新購物車商品數量
   * @param {number} cartItemId - 購物車項目ID
   * @param {number} quantity - 新數量
   * @returns {number} 影響的行數
   */
  async updateCartItemQuantity(cartItemId, quantity) {
    const [result] = await pool.query(
      'UPDATE cart_items SET quantity = ? WHERE id = ?',
      [quantity, cartItemId]
    )
    return result.affectedRows
  },

  /**
   * 刪除購物車商品
   * @param {number} cartItemId - 購物車項目ID
   * @returns {number} 影響的行數
   */
  async removeCartItem(cartItemId) {
    const [result] = await pool.query('DELETE FROM cart_items WHERE id = ?', [
      cartItemId,
    ])
    return result.affectedRows
  },

  /**
   * 清空用戶購物車
   * @param {number} userId - 用戶ID
   * @returns {number} 影響的行數
   */
  async clearCart(userId) {
    const [result] = await pool.query(
      'DELETE FROM cart_items WHERE user_id = ?',
      [userId]
    )
    return result.affectedRows
  },

  /**
   * 取得購物車商品總數
   * @param {number} userId - 用戶ID
   * @returns {number} 商品總數
   */
  async getCartItemCount(userId) {
    const [rows] = await pool.query(
      'SELECT COUNT(*) as count FROM cart_items WHERE user_id = ?',
      [userId]
    )
    return rows[0].count
  },
}

/**
 * 商品相關查詢
 */
export const productQueries = {
  /**
   * 取得商品資訊（含主圖片）
   * @param {number} productId - 商品ID
   * @returns {Object|null} 商品資訊
   */
  async getProduct(productId) {
    const [rows] = await pool.query(
      `SELECT 
        p.*,
        (SELECT image_url FROM product_images WHERE product_id = p.product_id LIMIT 1) as main_image_url
       FROM products p
       WHERE p.product_id = ? AND p.is_active = 1`,
      [productId]
    )
    return rows[0]
  },

  /**
   * 檢查商品庫存
   * @param {number} productId - 商品ID
   * @param {number} quantity - 需要的數量
   * @returns {boolean} 是否有足夠庫存
   */
  async checkStock(productId, quantity) {
    const [rows] = await pool.query(
      'SELECT stock_quantity FROM products WHERE product_id = ? AND is_active = 1',
      [productId]
    )
    if (!rows[0]) return false
    return rows[0].stock_quantity >= quantity
  },

  /**
   * 更新商品庫存
   * @param {number} productId - 商品ID
   * @param {number} quantity - 要減少的數量（正數減少，負數增加）
   * @returns {number} 影響的行數
   */
  async updateStock(productId, quantity) {
    const [result] = await pool.query(
      'UPDATE products SET stock_quantity = stock_quantity - ? WHERE product_id = ?',
      [quantity, productId]
    )
    return result.affectedRows
  },
}

/**
 * 訂單相關查詢
 */
export const orderQueries = {
  /**
   * 建立訂單
   * @param {Object} orderData - 訂單資料
   * @returns {number} 訂單ID
   */
  async createOrder(orderData) {
    const {
      userId,
      total,
      paymentMethod,
      paymentStatus,
      recipientName,
      phone,
      shippingMethod,
      shippingAddress,
      orderStatus,
    } = orderData

    const [result] = await pool.query(
      `INSERT INTO orders 
       (user_id, total, payment_method, payment_status, 
        recipient_name, phone, shipping_method, shipping_address, order_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        total,
        paymentMethod,
        paymentStatus,
        recipientName,
        phone,
        shippingMethod,
        shippingAddress,
        orderStatus,
      ]
    )
    return result.insertId
  },

  /**
   * 新增訂單明細（保存價格快照）
   * @param {number} orderId - 訂單ID
   * @param {number} productId - 商品ID
   * @param {number} quantity - 數量
   * @param {number} unitPrice - 單價（下單時的價格快照）
   * @returns {number} 明細ID
   */
  async createOrderDetail(orderId, productId, quantity, unitPrice) {
    const [result] = await pool.query(
      `INSERT INTO order_detail 
       (order_id, product_id, quantity, unit_price) 
       VALUES (?, ?, ?, ?)`,
      [orderId, productId, quantity, unitPrice]
    )
    return result.insertId
  },

  /**
   * 取得訂單資訊
   * @param {number} orderId - 訂單ID
   * @returns {Object|null} 訂單資訊
   */
  async getOrder(orderId) {
    const [rows] = await pool.query('SELECT * FROM orders WHERE id = ?', [
      orderId,
    ])
    return rows[0]
  },

  /**
   * 取得訂單明細（含商品資訊）
   * @param {number} orderId - 訂單ID
   * @returns {Array} 訂單明細列表
   */
  async getOrderDetails(orderId) {
    const [rows] = await pool.query(
      `SELECT 
        od.id,
        od.order_id,
        od.product_id,
        od.quantity,
        od.unit_price,
        p.product_name,
        p.description,
        (SELECT image_url FROM product_images WHERE product_id = p.product_id LIMIT 1) AS image_url
      FROM order_detail od
      INNER JOIN products p ON od.product_id = p.product_id
      WHERE od.order_id = ?`,
      [orderId]
    )
    return rows
  },

  /**
   * 更新訂單狀態
   * @param {number} orderId - 訂單ID
   * @param {number} status - 訂單狀態
   * @returns {number} 影響的行數
   */
  async updateOrderStatus(orderId, status) {
    const [result] = await pool.query(
      'UPDATE orders SET order_status = ? WHERE id = ?',
      [status, orderId]
    )
    return result.affectedRows
  },

  /**
   * 更新付款狀態
   * @param {number} orderId - 訂單ID
   * @param {number} status - 付款狀態
   * @returns {number} 影響的行數
   */
  async updatePaymentStatus(orderId, status) {
    const [result] = await pool.query(
      'UPDATE orders SET payment_status = ? WHERE id = ?',
      [status, orderId]
    )
    return result.affectedRows
  },

  /**
   * 取得用戶所有訂單
   * @param {number} userId - 用戶ID
   * @param {number|null} status - 訂單狀態（null = 全部）
   * @returns {Array} 訂單列表
   */
  async getUserOrders(userId, status = null) {
    let query = 'SELECT * FROM orders WHERE user_id = ?'
    const params = [userId]

    if (status !== null) {
      query += ' AND order_status = ?'
      params.push(status)
    }

    query += ' ORDER BY created_at DESC'

    const [rows] = await pool.query(query, params)
    return rows
  },
}

export default {
  cartQueries,
  productQueries,
  orderQueries,
}
