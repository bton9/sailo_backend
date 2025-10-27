import crypto from 'crypto'

/**
 * ECPay 綠界金流工具函式
 * 注意: 這裡提供基礎架構,實際使用時請填入你的綠界商店資訊
 */

// ECPay 設定 (從環境變數讀取)
const ECPAY_CONFIG = {
  MerchantID: process.env.ECPAY_MERCHANT_ID || '2000132',
  HashKey: process.env.ECPAY_HASH_KEY || '5294y06JbISpM5x9',
  HashIV: process.env.ECPAY_HASH_IV || 'v77hoKGq4kWxNNIS',
  PaymentURL:
    process.env.NODE_ENV === 'production'
      ? 'https://payment.ecpay.com.tw/Cashier/AioCheckOut/V5'
      : 'https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5',
  ReturnURL: process.env.ECPAY_RETURN_URL || 'http://localhost:3000/api/payment/return',
  NotifyURL: process.env.ECPAY_NOTIFY_URL || 'http://localhost:3000/api/payment/notify',
  ClientBackURL: process.env.FRONTEND_URL || 'http://localhost:3001',
}

/**
 * 產生 CheckMacValue (檢查碼)
 */
export const generateCheckMacValue = (params) => {
  // 1. 將參數依照字母順序排序
  const sortedParams = Object.keys(params)
    .sort()
    .reduce((acc, key) => {
      acc[key] = params[key]
      return acc
    }, {})

  // 2. 組合字串
  let checkStr = `HashKey=${ECPAY_CONFIG.HashKey}`
  
  for (const [key, value] of Object.entries(sortedParams)) {
    checkStr += `&${key}=${value}`
  }
  
  checkStr += `&HashIV=${ECPAY_CONFIG.HashIV}`

  // 3. URL encode
  checkStr = encodeURIComponent(checkStr).toLowerCase()

  // 4. 特殊字元處理
  checkStr = checkStr
    .replace(/%2d/g, '-')
    .replace(/%5f/g, '_')
    .replace(/%2e/g, '.')
    .replace(/%21/g, '!')
    .replace(/%2a/g, '*')
    .replace(/%28/g, '(')
    .replace(/%29/g, ')')
    .replace(/%20/g, '+')

  // 5. SHA256 加密並轉大寫
  const hash = crypto.createHash('sha256').update(checkStr).digest('hex')
  return hash.toUpperCase()
}

/**
 * 建立 ECPay 付款參數
 */
export const buildECPayParams = (orderData) => {
  const {
    orderId,
    merchantTradeNo,
    totalAmount,
    itemName,
    customerEmail,
    choosePayment = 'ALL', // ALL, Credit, WebATM, ATM, CVS, BARCODE
  } = orderData

  const tradeDate = new Date()
    .toISOString()
    .replace(/T/, ' ')
    .replace(/\..+/, '')

  const params = {
    MerchantID: ECPAY_CONFIG.MerchantID,
    MerchantTradeNo: merchantTradeNo,
    MerchantTradeDate: tradeDate,
    PaymentType: 'aio',
    TotalAmount: totalAmount,
    TradeDesc: '商品購買',
    ItemName: itemName,
    ReturnURL: ECPAY_CONFIG.ReturnURL,
    ChoosePayment: choosePayment,
    ClientBackURL: `${ECPAY_CONFIG.ClientBackURL}/success?orderId=${orderId}`,
    ItemURL: `${ECPAY_CONFIG.ClientBackURL}/products`,
    Remark: `訂單編號:${orderId}`,
    ChooseSubPayment: '',
    OrderResultURL: `${ECPAY_CONFIG.ClientBackURL}/success?orderId=${orderId}`,
    NeedExtraPaidInfo: 'Y',
    EncryptType: 1,
  }

  // 如果有客戶 Email 就加入
  if (customerEmail) {
    params.Email = customerEmail
  }

  // 產生檢查碼
  params.CheckMacValue = generateCheckMacValue(params)

  return params
}

/**
 * 產生 ECPay 付款表單 HTML
 */
export const generatePaymentFormHTML = (orderData) => {
  const params = buildECPayParams(orderData)

  let formHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>正在前往付款...</title>
  <style>
    body {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      background-color: #f5f3ef;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .loading {
      text-align: center;
    }
    .spinner {
      border: 4px solid #e8e5e0;
      border-top: 4px solid #5b8a9e;
      border-radius: 50%;
      width: 50px;
      height: 50px;
      animation: spin 1s linear infinite;
      margin: 0 auto 20px;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    h2 {
      color: #333;
      margin: 0;
    }
  </style>
</head>
<body>
  <div class="loading">
    <div class="spinner"></div>
    <h2>正在前往付款頁面...</h2>
    <p>請稍候，系統正在處理您的付款請求</p>
  </div>
  <form id="ecpay_form" method="post" action="${ECPAY_CONFIG.PaymentURL}">
`

  // 加入所有參數
  for (const [key, value] of Object.entries(params)) {
    formHTML += `    <input type="hidden" name="${key}" value="${value}" />\n`
  }

  formHTML += `
  </form>
  <script>
    document.getElementById('ecpay_form').submit();
  </script>
</body>
</html>
`

  return formHTML
}

/**
 * 驗證 ECPay 回傳的 CheckMacValue
 */
export const verifyECPayCallback = (data) => {
  const receivedCheckMacValue = data.CheckMacValue
  delete data.CheckMacValue // 移除 CheckMacValue 後計算

  const calculatedCheckMacValue = generateCheckMacValue(data)

  return receivedCheckMacValue === calculatedCheckMacValue
}

/**
 * 解析 ECPay 付款結果
 */
export const parsePaymentResult = (data) => {
  // 驗證檢查碼
  const isValid = verifyECPayCallback(data)

  if (!isValid) {
    return {
      success: false,
      message: '付款驗證失敗',
      data: null,
    }
  }

  // RtnCode: 1 為成功
  const isSuccess = parseInt(data.RtnCode) === 1

  return {
    success: isSuccess,
    message: data.RtnMsg || '付款處理完成',
    data: {
      merchantTradeNo: data.MerchantTradeNo,
      tradeNo: data.TradeNo,
      tradeAmt: data.TradeAmt,
      paymentDate: data.PaymentDate,
      paymentType: data.PaymentType,
      tradeDate: data.TradeDate,
      rtnCode: data.RtnCode,
      rtnMsg: data.RtnMsg,
    },
  }
}

export default {
  generateCheckMacValue,
  buildECPayParams,
  generatePaymentFormHTML,
  verifyECPayCallback,
  parsePaymentResult,
  ECPAY_CONFIG,
}
