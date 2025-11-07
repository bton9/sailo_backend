import {
  orderQueries,
  cartQueries,
  productQueries,
} from '../../utils/cart/queries.js'
import {
  generateOrderNumber,
  calculateOrderTotal,
  formatOrderData,
} from '../../utils/cart/helpers.js'
import pool from '../../config/database.js'

/**
 * 建立訂單
 */
export const createOrder = async (req, res) => {
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()

    const userId = req.body.userId || req.user?.userId
    const { items, shippingInfo, shippingMethod, paymentMethod, notes } =
      req.body

    if (!userId) {
      await connection.rollback()
      return res.status(400).json({
        success: false,
        message: '缺少用戶ID',
      })
    }

    // 驗證所有商品是否存在且庫存足夠
    for (const item of items) {
      const product = await productQueries.getProduct(item.productId)
      if (!product) {
        await connection.rollback()
        return res.status(404).json({
          success: false,
          message: `商品 ${item.productId} 不存在`,
        })
      }

      const hasStock = await productQueries.checkStock(
        item.productId,
        item.quantity
      )
      if (!hasStock) {
        await connection.rollback()
        return res.status(400).json({
          success: false,
          message: `商品「${product.product_name}」庫存不足`,
          availableStock: product.stock_quantity,
        })
      }
    }

    // 計算訂單總金額
    const total = calculateOrderTotal(items, shippingMethod)

    // 組合收件人姓名
    const recipientName =
      shippingInfo.recipientName ||
      `${shippingInfo.lastName || ''}${shippingInfo.firstName || ''}`.trim() ||
      '未提供'

    // 組合完整地址
    const shippingAddress =
      shippingInfo.address ||
      `${shippingInfo.zipCode || ''} ${shippingInfo.city || ''}${shippingInfo.district || ''}${shippingInfo.detailAddress || ''}`.trim()

    // 付款方式對應
    const paymentMethodMap = {
      ecpay: 1,
      credit: 1,
      cod: 2,
      atm: 2,
    }

    // 配送方式對應
    const shippingMethodMap = {
      standard: 1,
      express: 2,
      store: 2,
    }

    // 建立訂單
    const orderData = {
      userId,
      total,
      paymentMethod: paymentMethodMap[paymentMethod] || 1,
      paymentStatus: 0, // 0: 未付款
      recipientName,
      phone: shippingInfo.phone,
      shippingMethod: shippingMethodMap[shippingMethod] || 1,
      shippingAddress,
      orderStatus: 0, // 0: 待處理
    }

    const orderId = await orderQueries.createOrder(orderData)

    // 建立訂單明細 - 保存價格快照
    for (const item of items) {
      const product = await productQueries.getProduct(item.productId)

      // 使用下單時的價格 (從商品或傳入的 unitPrice)
      const unitPrice = item.unitPrice || product.price

      await orderQueries.createOrderDetail(
        orderId,
        item.productId,
        item.quantity,
        unitPrice // 價格快照
      )

      // 更新庫存
      await productQueries.updateStock(item.productId, item.quantity)
    }

    // 清空購物車 (使用新版 API)
    await cartQueries.clearCart(userId)

    await connection.commit()

    // 產生訂單編號顯示格式
    const orderNumber = `ORD-${orderId.toString().padStart(10, '0')}`

    res.json({
      success: true,
      message: '訂單建立成功',
      data: {
        orderId,
        orderNumber,
        total,
        paymentMethod,
        shippingInfo: {
          recipientName,
          phone: shippingInfo.phone,
          address: shippingAddress,
        },
      },
    })
  } catch (error) {
    await connection.rollback()
    console.error('Create order error:', error)
    res.status(500).json({
      success: false,
      message: '建立訂單失敗',
      error: error.message,
    })
  } finally {
    connection.release()
  }
}

/**
 * 取得訂單詳情
 */
export const getOrder = async (req, res) => {
  try {
    const { orderId } = req.params

    const order = await orderQueries.getOrder(orderId)
    if (!order) {
      return res.status(404).json({
        success: false,
        message: '訂單不存在',
      })
    }

    // 驗證訂單所有權 (如果有 JWT)
    if (req.user && order.user_id !== req.user.userId && req.user.access !== 'admin') {
      return res.status(403).json({
        success: false,
        message: '無權限查看此訂單',
      })
    }

    const details = await orderQueries.getOrderDetails(orderId)

    const formattedOrder = formatOrderData(order, details)

    // 補充收件資訊
    const enhancedOrder = {
      ...formattedOrder,
      shippingInfo: {
        recipientName: order.recipient_name || '',
        phone: order.phone || '',
        email: order.email || '',
        address: order.shipping_address || '',
        zipCode: '',
        city: '',
        district: '',
        detailAddress: order.shipping_address || '',
      },
    }

    res.json({
      success: true,
      data: enhancedOrder,
    })
  } catch (error) {
    console.error('Get order error:', error)
    res.status(500).json({
      success: false,
      message: '取得訂單失敗',
      error: error.message,
    })
  }
}

/**
 * 取得用戶所有訂單
 */
export const getUserOrders = async (req, res) => {
  try {
    const userId = req.params.userId || req.query.userId || req.user?.userId
    const { status } = req.query // 可選的狀態篩選

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: '缺少用戶ID',
      })
    }

    // 驗證訂單所有權 (如果有 JWT)
    if (req.user && parseInt(userId) !== req.user.userId && req.user.access !== 'admin') {
      return res.status(403).json({
        success: false,
        message: '無權限查看此用戶的訂單',
      })
    }

    // 狀態對應: all, processing, shipped, completed, cancelled
    const statusMap = {
      all: null,
      processing: 1,
      shipped: 2,
      completed: 3,
      cancelled: 4,
    }

    const statusCode = status ? statusMap[status] : null

    let orders = await orderQueries.getUserOrders(userId, statusCode)

    // 取得每個訂單的明細
    const ordersWithDetails = await Promise.all(
      orders.map(async (order) => {
        const details = await orderQueries.getOrderDetails(order.id)
        return formatOrderData(order, details)
      })
    )

    res.json({
      success: true,
      data: {
        orders: ordersWithDetails,
        total: ordersWithDetails.length,
      },
    })
  } catch (error) {
    console.error('Get user orders error:', error)
    res.status(500).json({
      success: false,
      message: '取得訂單列表失敗',
      error: error.message,
    })
  }
}

/**
 * 取消訂單
 */
export const cancelOrder = async (req, res) => {
  try {
    const { orderId } = req.params

    const order = await orderQueries.getOrder(orderId)
    if (!order) {
      return res.status(404).json({
        success: false,
        message: '訂單不存在',
      })
    }

    // 驗證訂單所有權
    if (req.user && order.user_id !== req.user.userId && req.user.access !== 'admin') {
      return res.status(403).json({
        success: false,
        message: '無權限取消此訂單',
      })
    }

    // 只有已下單或處理中的訂單可以取消
    if (order.order_status !== 0 && order.order_status !== 1) {
      return res.status(400).json({
        success: false,
        message: '此訂單無法取消',
        currentStatus: order.order_status,
      })
    }

    // 更新訂單狀態為已取消
    await orderQueries.updateOrderStatus(orderId, 4)

    // 恢復庫存
    const details = await orderQueries.getOrderDetails(orderId)
    for (const item of details) {
      // 用負數來增加庫存
      await productQueries.updateStock(item.product_id, -item.quantity)
    }

    res.json({
      success: true,
      message: '訂單已取消',
    })
  } catch (error) {
    console.error('Cancel order error:', error)
    res.status(500).json({
      success: false,
      message: '取消訂單失敗',
      error: error.message,
    })
  }
}

/**
 * 更新訂單狀態 (管理員功能)
 */
export const updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params
    const { status } = req.body

    const order = await orderQueries.getOrder(orderId)
    if (!order) {
      return res.status(404).json({
        success: false,
        message: '訂單不存在',
      })
    }

    // 驗證狀態值
    if (![0, 1, 2, 3, 4].includes(parseInt(status))) {
      return res.status(400).json({
        success: false,
        message: '無效的訂單狀態',
      })
    }

    await orderQueries.updateOrderStatus(orderId, status)

    res.json({
      success: true,
      message: '訂單狀態更新成功',
    })
  } catch (error) {
    console.error('Update order status error:', error)
    res.status(500).json({
      success: false,
      message: '更新訂單狀態失敗',
      error: error.message,
    })
  }
}

export default {
  createOrder,
  getOrder,
  getUserOrders,
  cancelOrder,
  updateOrderStatus,
}