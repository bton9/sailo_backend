import moment from 'moment'
import cartConfig from '../../config/cart.config.js'

/**
 * 產生訂單編號
 * 格式: ORD-YYYYMMDDHHMMSS
 */
export const generateOrderNumber = () => {
  const timestamp = moment().format('YYYYMMDDHHmmss')
  return `${cartConfig.orderPrefix}-${timestamp}`
}

/**
 * 計算購物車總金額
 */
export const calculateCartTotal = (items) => {
  if (!items || items.length === 0) return 0
  
  return items.reduce((total, item) => {
    const unitPrice = item.unit_price || item.price || 0
    const quantity = item.quantity || 0
    return total + (unitPrice * quantity)
  }, 0)
}

/**
 * 計算運費
 */
export const calculateShipping = (shippingMethod, subtotal) => {
  const shipping = cartConfig.shipping[shippingMethod]
  if (!shipping) return cartConfig.shipping.standard.fee

  // 檢查是否滿足免運門檻
  if (subtotal >= cartConfig.shipping.freeShippingThreshold) {
    return 0
  }

  return shipping.fee
}

/**
 * 計算訂單總金額
 */
export const calculateOrderTotal = (items, shippingMethod = 'standard') => {
  const subtotal = calculateCartTotal(items)
  const shipping = calculateShipping(shippingMethod, subtotal)
  return subtotal + shipping
}

/**
 * 驗證購物車商品數量
 */
export const validateQuantity = (quantity) => {
  const qty = parseInt(quantity)
  if (isNaN(qty)) return false
  if (qty < cartConfig.minQuantityPerItem) return false
  if (qty > cartConfig.maxQuantityPerItem) return false
  return true
}

/**
 * 格式化訂單資料
 */
export const formatOrderData = (order, details) => {
  // 訂單狀態對應
  const statusMap = {
    0: 'pending',      // 待處理
    1: 'processing',   // 處理中
    2: 'shipped',      // 已出貨
    3: 'completed',    // 已完成
    4: 'cancelled',    // 已取消
  }

  // 付款狀態對應
  const paymentStatusMap = {
    0: 'unpaid',       // 未付款
    1: 'paid',         // 已付款
    2: 'failed',       // 付款失敗
    3: 'refunded',     // 已退款
  }

  return {
    id: order.id,
    orderNumber: `#ORD-${order.id.toString().padStart(10, '0')}`,
    date: moment(order.created_at).format('YYYY年MM月DD日'),
    status: statusMap[order.order_status] || 'pending',
    statusText: cartConfig.orderStatus[order.order_status] || '未知狀態',
    paymentStatus: paymentStatusMap[order.payment_status] || 'unpaid',
    paymentStatusText: cartConfig.paymentStatus[order.payment_status] || '未知狀態',
    items: details.map((item) => ({
      id: item.id,
      productId: item.product_id,
      name: item.product_name,
      description: item.description || '',
      quantity: item.quantity,
      unitPrice: item.unit_price,
      price: item.unit_price * item.quantity,
      imageUrl: item.image_url || '',
    })),
    total: order.total,
    paymentMethod: order.payment_method,
    paymentMethodText: order.payment_method === 1 ? 'ECPay 線上付款' : '貨到付款',
    shippingMethod: order.shipping_method,
    shippingAddress: order.shipping_address,
    recipientName: order.recipient_name,
    phone: order.phone,
    createdAt: order.created_at,
    updatedAt: order.updated_at,
  }
}

/**
 * 驗證電子郵件格式
 */
export const validateEmail = (email) => {
  if (!email) return false
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return re.test(email)
}

/**
 * 驗證手機號碼格式（台灣）
 */
export const validatePhone = (phone) => {
  if (!phone) return false
  const re = /^09\d{8}$/
  return re.test(phone.replace(/[-\s]/g, ''))
}

/**
 * 格式化金額顯示
 */
export const formatCurrency = (amount) => {
  return `NT$ ${amount.toLocaleString()}`
}

/**
 * 產生訂單摘要
 */
export const generateOrderSummary = (items) => {
  if (!items || items.length === 0) {
    return '訂單商品'
  }
  
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0)
  const firstProductName = items[0].product_name || items[0].name || '商品'
  
  if (items.length === 1) {
    return `${firstProductName} x${itemCount}`
  }
  
  return `${firstProductName} 等 ${items.length} 項商品`
}

/**
 * 檢查訂單是否可以取消
 */
export const canCancelOrder = (orderStatus) => {
  return orderStatus === 0 || orderStatus === 1 // 待付款或處理中
}

/**
 * 檢查訂單是否可以退款
 */
export const canRefundOrder = (orderStatus, paymentStatus) => {
  return orderStatus !== 4 && paymentStatus === 1 // 未取消且已付款
}

/**
 * 產生隨機字串（用於交易編號等）
 */
export const generateRandomString = (length = 10) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

/**
 * 產生唯一的商店交易編號
 * 格式: ORD + timestamp(13位) + 隨機碼(6位)
 * 總長度: 22 字元（符合 ECPay 限制）
 */
export const generateMerchantTradeNo = () => {
  const timestamp = Date.now().toString()
  const random = generateRandomString(6)
  return `ORD${timestamp}${random}`.substring(0, 20) // ECPay 限制 20 字元
}

export default {
  generateOrderNumber,
  calculateCartTotal,
  calculateShipping,
  calculateOrderTotal,
  validateQuantity,
  formatOrderData,
  validateEmail,
  validatePhone,
  formatCurrency,
  generateOrderSummary,
  canCancelOrder,
  canRefundOrder,
  generateRandomString,
  generateMerchantTradeNo,
}