import { orderQueries, paymentQueries } from '../../utils/cart/queries.js'
import {
  generateOrderSummary,
  generateMerchantTradeNo,
} from '../../utils/cart/helpers.js'
import {
  buildECPayParams,
  generatePaymentFormHTML,
  parsePaymentResult,
} from '../../utils/cart/ecpay.js'

/**
 * 建立ECPay付款請求
 */
export const createPayment = async (req, res) => {
  try {
    const { orderId, email, paymentType } = req.body

    // 取得訂單資訊
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
        message: '無權限為此訂單付款',
      })
    }

    // 檢查訂單狀態
    if (order.payment_status !== 0) {
      return res.status(400).json({
        success: false,
        message: '此訂單已付款或無法付款',
      })
    }

    // 取得訂單明細
    const details = await orderQueries.getOrderDetails(orderId)
    const itemName = generateOrderSummary(details)

    // 產生商店交易編號
    const merchantTradeNo = generateMerchantTradeNo()

    // 建立付款記錄
    await paymentQueries.createPayment({
      orderId,
      merchantTradeNo,
      paymentType: paymentType || 'Credit',
      amount: order.total,
    })

    // 產生ECPay付款表單資料
    const paymentParams = buildECPayParams({
      orderId,
      merchantTradeNo,
      totalAmount: order.total,
      itemName,
      customerEmail: email,
      choosePayment: paymentType || 'ALL',
    })

    res.json({
      success: true,
      message: '付款資料產生成功',
      data: {
        formData: paymentParams,
        actionUrl:
          process.env.NODE_ENV === 'production'
            ? 'https://payment.ecpay.com.tw/Cashier/AioCheckOut/V5'
            : 'https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5',
        merchantTradeNo,
      },
    })
  } catch (error) {
    console.error('Create payment error:', error)
    res.status(500).json({
      success: false,
      message: '建立付款失敗',
      error: error.message,
    })
  }
}

/**
 * 產生ECPay付款表單HTML (用於前端自動提交)
 */
export const getPaymentForm = async (req, res) => {
  try {
    const { orderId } = req.params
    const { email } = req.query

    // 取得訂單資訊
    const order = await orderQueries.getOrder(orderId)
    if (!order) {
      return res.status(404).json({
        success: false,
        message: '訂單不存在',
      })
    }

    // 驗證訂單所有權
    if (req.user && order.user_id !== req.user.userId && req.user.access !== 'admin') {
      return res.status(403).send('無權限為此訂單付款')
    }

    // 檢查訂單狀態
    if (order.payment_status !== 0) {
      return res.status(400).send('此訂單已付款或無法付款')
    }

    // 取得訂單明細
    const details = await orderQueries.getOrderDetails(orderId)
    const itemName = generateOrderSummary(details)

    // 產生商店交易編號
    const merchantTradeNo = generateMerchantTradeNo()

    // 建立付款記錄
    await paymentQueries.createPayment({
      orderId,
      merchantTradeNo,
      paymentType: 'Credit',
      amount: order.total,
    })

    // 產生HTML表單
    const formHTML = generatePaymentFormHTML({
      orderId,
      merchantTradeNo,
      totalAmount: order.total,
      itemName,
      customerEmail: email,
    })

    res.send(formHTML)
  } catch (error) {
    console.error('Get payment form error:', error)
    res.status(500).send('產生付款表單失敗')
  }
}

/**
 * ECPay 付款結果通知 (Server端)
 */
export const paymentNotify = async (req, res) => {
  try {
    console.log('Payment notify received:', req.body)

    // 解析付款結果
    const result = parsePaymentResult(req.body)

    if (!result.success) {
      console.error('Payment verification failed:', result)
      return res.send('0|Payment verification failed')
    }

    // 從商店交易編號查詢付款記錄
    const merchantTradeNo = result.data.merchantTradeNo

    // 更新付款記錄
    await paymentQueries.updatePaymentStatus(
      merchantTradeNo,
      1, // 1: 已付款
      {
        ecpayTradeNo: result.data.tradeNo,
        rtnCode: result.data.rtnCode,
        rtnMsg: result.data.rtnMsg,
      }
    )

    // 取得付款記錄以獲得訂單ID (使用 getPaymentByTradeNo)
    const payment = await paymentQueries.getPaymentByTradeNo(merchantTradeNo)
    if (payment) {
      // 更新訂單付款狀態
      await orderQueries.updatePaymentStatus(payment.order_id, 1) // 1: 已付款
      await orderQueries.updateOrderStatus(payment.order_id, 1) // 1: 處理中

      console.log(`Order ${payment.order_id} payment confirmed`)
    }

    // 回應ECPay (必須回傳 1|OK)
    res.send('1|OK')
  } catch (error) {
    console.error('Payment notify error:', error)
    res.send('0|Error')
  }
}

/**
 * ECPay 付款結果返回頁面
 */
export const paymentReturn = async (req, res) => {
  try {
    console.log('Payment return received:', req.body)

    // 解析付款結果
    const result = parsePaymentResult(req.body)

    if (result.success) {
      // 從商店交易編號取得訂單ID
      const merchantTradeNo = result.data.merchantTradeNo
      const payment = await paymentQueries.getPaymentByTradeNo(merchantTradeNo)

      if (payment) {
        // 🔥 付款成功 - 導向前端狀態頁面
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001'
        res.redirect(
          `${frontendUrl}/site/cart/status?status=success&orderId=${payment.order_id}`
        )
      } else {
        // 找不到付款記錄
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001'
        const reason = encodeURIComponent('找不到付款記錄')
        res.redirect(
          `${frontendUrl}/site/cart/status?status=failed&orderId=0&reason=${reason}`
        )
      }
    } else {
      // 🔥 付款失敗 - 導向前端狀態頁面
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001'
      const reason = encodeURIComponent(result.message || '付款失敗')
      
      // 嘗試從商店交易編號取得訂單ID
      const merchantTradeNo = result.data?.merchantTradeNo
      let orderId = 0
      
      if (merchantTradeNo) {
        const payment = await paymentQueries.getPaymentByTradeNo(merchantTradeNo)
        if (payment) {
          orderId = payment.order_id
        }
      }
      
      res.redirect(
        `${frontendUrl}/site/cart/status?status=failed&orderId=${orderId}&reason=${reason}`
      )
    }
  } catch (error) {
    console.error('Payment return error:', error)
    
    // 🔥 發生錯誤 - 導向前端狀態頁面
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001'
    const reason = encodeURIComponent('付款處理錯誤')
    res.redirect(
      `${frontendUrl}/site/cart/status?status=failed&orderId=0&reason=${reason}`
    )
  }
}

/**
 * 查詢付款狀態
 */
export const getPaymentStatus = async (req, res) => {
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
        message: '無權限查看此訂單的付款狀態',
      })
    }

    const payment = await paymentQueries.getPayment(orderId)

    res.json({
      success: true,
      data: {
        orderId: order.id,
        paymentStatus: order.payment_status,
        paymentStatusText: ['未付款', '已付款', '付款失敗', '已退款'][
          order.payment_status
        ],
        orderStatus: order.order_status,
        total: order.total,
        paymentInfo: payment
          ? {
              merchantTradeNo: payment.merchant_trade_no,
              paymentType: payment.payment_type,
              paymentDate: payment.payment_date,
            }
          : null,
      },
    })
  } catch (error) {
    console.error('Get payment status error:', error)
    res.status(500).json({
      success: false,
      message: '查詢付款狀態失敗',
      error: error.message,
    })
  }
}

/**
 * 測試用：模擬付款成功
 */
export const simulatePayment = async (req, res) => {
  try {
    const { orderId } = req.body

    const order = await orderQueries.getOrder(orderId)
    if (!order) {
      return res.status(404).json({
        success: false,
        message: '訂單不存在',
      })
    }

    // 更新付款狀態
    await orderQueries.updatePaymentStatus(orderId, 1)
    await orderQueries.updateOrderStatus(orderId, 1)

    res.json({
      success: true,
      message: '付款模擬成功',
    })
  } catch (error) {
    console.error('Simulate payment error:', error)
    res.status(500).json({
      success: false,
      message: '模擬付款失敗',
      error: error.message,
    })
  }
}

export default {
  createPayment,
  getPaymentForm,
  paymentNotify,
  paymentReturn,
  getPaymentStatus,
  simulatePayment,
}