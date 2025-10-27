import express from 'express'
import paymentController from '../../controllers/cart/payment.controller.js'
import { requireAuth } from '../../middleware/cart/authCart.middleware.js'
import { validatePaymentRequest } from '../../middleware/cart/validateCart.middleware.js'

const router = express.Router()

/**
 * @route   POST /api/payment/create
 * @desc    建立ECPay付款請求
 * @access  Private
 */
router.post(
  '/create',
  validatePaymentRequest,
  requireAuth,
  paymentController.createPayment
)

/**
 * @route   GET /api/payment/form/:orderId
 * @desc    取得ECPay付款表單HTML
 * @access  Private
 */
router.get('/form/:orderId', requireAuth, paymentController.getPaymentForm)

/**
 * @route   POST /api/payment/notify
 * @desc    ECPay付款結果通知（Server端接收）
 * @access  Public (ECPay callback)
 * 
 * 注意：此路由不需要認證，因為是 ECPay 伺服器呼叫
 */
router.post('/notify', paymentController.paymentNotify)

/**
 * @route   POST /api/payment/return
 * @desc    ECPay付款結果返回頁面
 * @access  Public (ECPay callback)
 * 
 * 注意：此路由不需要認證，因為是 ECPay 伺服器呼叫
 */
router.post('/return', paymentController.paymentReturn)

/**
 * @route   GET /api/payment/status/:orderId
 * @desc    查詢付款狀態
 * @access  Private
 */
router.get('/status/:orderId', requireAuth, paymentController.getPaymentStatus)

/**
 * @route   POST /api/payment/simulate
 * @desc    模擬付款成功（測試用）
 * @access  Private (開發環境)
 */
if (process.env.NODE_ENV !== 'production') {
  router.post('/simulate', requireAuth, paymentController.simulatePayment)
}


export default router