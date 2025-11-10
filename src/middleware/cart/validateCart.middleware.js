import { body, param, query, validationResult } from 'express-validator'
import {
  validateQuantity,
  validateEmail,
  validatePhone,
} from '../../utils/cart/helpers.js'

/**
 * 處理驗證錯誤
 */
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: '資料驗證失敗',
      errors: errors.array(),
    })
  }
  next()
}

/**
 * 驗證加入購物車請求
 */
export const validateAddToCart = [
  body('productId')
    .notEmpty()
    .withMessage('商品ID不能為空')
    .isInt({ min: 1 })
    .withMessage('商品ID必須是正整數'),
  body('quantity')
    .notEmpty()
    .withMessage('數量不能為空')
    .isInt({ min: 1, max: 99 })
    .withMessage('數量必須在1-99之間')
    .custom(validateQuantity)
    .withMessage('數量格式不正確'),
  body('specs').optional().isString().withMessage('規格必須是字串'),
  handleValidationErrors,
]

/**
 * 驗證更新購物車數量
 */
export const validateUpdateQuantity = [
  body('cartDetailId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('項目ID必須是正整數'),
  param('itemId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('項目ID必須是正整數'),
  body('quantity')
    .notEmpty()
    .withMessage('數量不能為空')
    .isInt({ min: 1, max: 99 })
    .withMessage('數量必須在1-99之間')
    .custom(validateQuantity)
    .withMessage('數量格式不正確'),
  handleValidationErrors,
]

/**
 * 驗證刪除購物車項目
 */
export const validateRemoveItem = [
  param('itemId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('項目ID必須是正整數'),
  body('cartDetailId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('項目ID必須是正整數'),
  handleValidationErrors,
]

/**
 * 驗證建立訂單請求
 */
export const validateCreateOrder = [
  body('items')
    .isArray({ min: 1 })
    .withMessage('訂單商品不能為空')
    .custom((items) => {
      return items.every(
        (item) => item.productId && item.quantity && item.unitPrice
      )
    })
    .withMessage('訂單商品格式不正確'),
  body('shippingInfo')
    .notEmpty()
    .withMessage('收件資訊不能為空')
    .isObject()
    .withMessage('收件資訊格式不正確'),
  body('shippingInfo.phone')
    .notEmpty()
    .withMessage('手機號碼不能為空')
    .custom(validatePhone)
    .withMessage('手機號碼格式不正確'),
  body('shippingInfo.email')
    .optional({ checkFalsy: true }) // 允許空字串
    .custom(validateEmail)
    .withMessage('電子郵件格式不正確'),
  body('shippingMethod')
    .notEmpty()
    .withMessage('配送方式不能為空')
    .isIn(['standard', 'express'])
    .withMessage('配送方式不正確'),
  body('paymentMethod')
    .notEmpty()
    .withMessage('付款方式不能為空')
    .isIn(['ecpay', 'cod'])
    .withMessage('付款方式不正確'),
  handleValidationErrors,
]

/**
 * 驗證訂單ID
 */
export const validateOrderId = [
  param('orderId')
    .notEmpty()
    .withMessage('訂單ID不能為空')
    .isInt({ min: 1 })
    .withMessage('訂單ID必須是正整數'),
  handleValidationErrors,
]

/**
 * 驗證用戶ID
 */
export const validateUserId = [
  param('userId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('用戶ID必須是正整數'),
  query('userId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('用戶ID必須是正整數'),
  body('userId').optional().isInt({ min: 1 }).withMessage('用戶ID必須是正整數'),
  handleValidationErrors,
]

/**
 * 驗證付款請求
 */
export const validatePaymentRequest = [
  body('orderId')
    .notEmpty()
    .withMessage('訂單ID不能為空')
    .isInt({ min: 1 })
    .withMessage('訂單ID必須是正整數'),
  body('email')
    .optional()
    .custom(validateEmail)
    .withMessage('電子郵件格式不正確'),
  body('paymentType')
    .optional()
    .isIn(['ALL', 'Credit', 'WebATM', 'ATM', 'CVS', 'BARCODE'])
    .withMessage('付款方式不正確'),
  handleValidationErrors,
]

export default {
  validateAddToCart,
  validateUpdateQuantity,
  validateRemoveItem,
  validateCreateOrder,
  validateOrderId,
  validateUserId,
  validatePaymentRequest,
  handleValidationErrors,
}
