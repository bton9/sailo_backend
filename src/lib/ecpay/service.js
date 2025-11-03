/**
 * @fileoverview ECPay 金流服務模組
 *
 * 此模組負責處理綠界科技(ECPay)金流相關的邏輯，包括：
 * - 產生 ECPay 金流參數
 * - 計算 CheckMacValue 驗證碼
 * - 產生 HTML 表單內容
 *
 * 服務層設計原則：
 * - 不使用 throw 錯誤，而是回傳統一格式的物件
 * - 回傳物件包含 status, message, payload 三個屬性
 * - status: 'success' | 'error'
 * - message: string (描述訊息)
 * - payload: any (實際資料)
 *
 */

import * as crypto from 'crypto'
import { config } from './config.js'

/**
 * 產生 ECPay 金流參數
 *
 * 此函數負責產生綠界科技金流所需的完整參數，包括：
 * - 產生唯一的交易編號
 * - 計算 CheckMacValue 驗證碼
 * - 設定付款方式與回傳網址
 *
 * @param {number} [amount=0] - 交易金額，必須為正整數
 * @param {string} [items=''] - 商品名稱，多筆商品以逗號分隔
 *
 * @returns {Object} 回傳物件包含以下屬性：
 * @returns {string} returns.status - 狀態：'success' 或 'error'
 * @returns {string} returns.message - 描述訊息
 * @returns {Object} returns.payload - 實際資料
 * @returns {string} returns.payload.action - ECPay API 網址
 * @returns {Object} returns.payload.params - ECPay 所需的所有參數
 *
 * @example
 * // 單一商品
 * const result = getECPayParams(100, '商品A')
 *
 * @example
 * // 多筆商品
 * const result = getECPayParams(500, '商品A,商品B,商品C')
 *
 * @throws {Error} 當金額為 0 或未提供時，回傳錯誤狀態
 *
 * @see {@link https://developers.ecpay.com.tw/?p=2856} ECPay 技術文件
 *  信用卡測試卡號：4311-9522-2222-2222 安全碼 222
 */
export const getECPayParams = (amount = 0, items = '') => {
  let itemName =
    items.split(',').length > 1
      ? items.split(',').join('#')
      : '線上商店購買一批'

  if (items.length > 0 && items.split(',').length === 1) {
    itemName = items
  }

  // 除錯資訊輸出
  console.log('amount:', amount)
  console.log('items:', items)
  console.log('itemName:', itemName)

  if (!amount) {
    return {
      status: 'error',
      message: '缺少總金額',
      payload: { amount, items },
    }
  }

  // ==================== 可調整參數區域 ====================
  // 一、選擇帳號，是否為測試環境
  const MerchantID = '3002607' //必填
  const HashKey = 'pwFHCqoQZGmho4w6' //3002607
  const HashIV = 'EkRm7iFT261dpevs' //3002607
  let isStage = true // 測試環境： true；正式環境：false

  // 二、輸入參數
  const TotalAmount = amount // 整數，不可有小數點。金額不可為0。
  const TradeDesc = '商店線上付款' // String(200)
  const ItemName = itemName // String(400) 多筆商品以#分隔

  // 付款結果通知回傳網址（需要真實網址或IP才能正確接收回傳結果）
  const ReturnURL = 'https://www.ecpay.com.tw'
  // 由 config.hasOrderResult 決定使用 OrderResultURL 或 ClientBackURL
  const hasOrderResult = config.hasOrderResult || false
  // OrderResultURL：有回傳結果，需前端 API 路由接收並重新導向
  const OrderResultURL =
    config.OrderResultURL || 'http://localhost:3000/ecpay/api'
  // ClientBackURL：無回傳結果，直接導向成功頁面
  const ClientBackURL =
    config.ClientBackURL || 'http://localhost:3000/ecpay/callback'
  const ChoosePayment = 'ALL'

  // ==================== 固定參數區域 ====================
  const stage = isStage ? '-stage' : ''
  const algorithm = 'sha256'
  const digest = 'hex'
  const APIURL = `https://payment${stage}.ecpay.com.tw/Cashier/AioCheckOut/V5`
  const MerchantTradeNo = `od${new Date().getFullYear()}${(
    new Date().getMonth() + 1
  )
    .toString()
    .padStart(2, '0')}${new Date()
    .getDate()
    .toString()
    .padStart(2, '0')}${new Date()
    .getHours()
    .toString()
    .padStart(2, '0')}${new Date()
    .getMinutes()
    .toString()
    .padStart(2, '0')}${new Date()
    .getSeconds()
    .toString()
    .padStart(2, '0')}${new Date().getMilliseconds().toString().padStart(2)}`

  const MerchantTradeDate = new Date().toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })

  // 三、準備 CheckMacValue 計算參數
  let ParamsBeforeCMV = {
    MerchantID: MerchantID,
    MerchantTradeNo: MerchantTradeNo,
    MerchantTradeDate: MerchantTradeDate.toString(),
    PaymentType: 'aio',
    EncryptType: 1,
    TotalAmount: TotalAmount,
    TradeDesc: TradeDesc,
    ItemName: ItemName,
    ReturnURL: ReturnURL,
    ChoosePayment: ChoosePayment,
    // OrderResultURL,
    // ClientBackURL,
  }

  // 根據 config.hasOrderResult 決定使用 OrderResultURL 或 ClientBackURL
  // 預設為 false，使用 ClientBackURL（無回傳結果，直接導向成功頁面）
  if (config.hasOrderResult) {
    ParamsBeforeCMV.OrderResultURL = OrderResultURL
  } else {
    ParamsBeforeCMV.ClientBackURL = ClientBackURL
  }

  /**
   * 產生 CheckMacValue 驗證碼
   *
   * 根據 ECPay 規範計算 CheckMacValue，用於驗證交易參數的完整性
   *
   * @param {Object} parameters - 需要計算驗證碼的參數物件
   * @param {string} algorithm - 加密演算法，預設為 'sha256'
   * @param {string} digest - 摘要格式，預設為 'hex'
   * @returns {string} 計算出的 CheckMacValue 驗證碼
   * @private
   */
  function CheckMacValueGen(parameters, algorithm, digest) {
    let Step0

    Step0 = Object.entries(parameters)
      .map(([key, value]) => `${key}=${value}`)
      .join('&')

    /**
     * .NET URL 編碼轉換
     *
     * 將 JavaScript 的 URL 編碼轉換為 .NET 格式的編碼
     * 主要處理特殊字元的編碼差異
     *
     * @param {string} string - 需要轉換的編碼字串
     * @returns {string} 轉換後的 .NET 格式編碼字串
     * @private
     */
    function DotNETURLEncode(string) {
      const list = {
        '%2D': '-',
        '%5F': '_',
        '%2E': '.',
        '%21': '!',
        '%2A': '*',
        '%28': '(',
        '%29': ')',
        '%20': '+',
      }

      Object.entries(list).forEach(([encoded, decoded]) => {
        const regex = new RegExp(encoded, 'g')
        string = string.replace(regex, decoded)
      })

      return string
    }

    const Step1 = Step0.split('&')
      .sort((a, b) => {
        const keyA = a.split('=')[0]
        const keyB = b.split('=')[0]
        return keyA.localeCompare(keyB)
      })
      .join('&')
    const Step2 = `HashKey=${HashKey}&${Step1}&HashIV=${HashIV}`
    const Step3 = DotNETURLEncode(encodeURIComponent(Step2))
    const Step4 = Step3.toLowerCase()
    const Step5 = crypto.createHash(algorithm).update(Step4).digest(digest)
    const Step6 = Step5.toUpperCase()
    return Step6
  }
  const CheckMacValue = CheckMacValueGen(ParamsBeforeCMV, algorithm, digest)

  // 四、組合最終參數
  const AllParams = { ...ParamsBeforeCMV, CheckMacValue }

  // 五、回傳結果
  return {
    status: 'success',
    message: '取得ecpay金流參數成功',
    payload: { action: APIURL, params: AllParams },
  }
}

/**
 * 產生 ECPay 金流 HTML 表單內容
 *
 * 此函數產生一個包含所有 ECPay 參數的 HTML 表單，
 * 用於後端直接送出表單到 ECPay 金流頁面
 *
 * @param {string} action - ECPay API 網址
 * @param {Object} params - ECPay 所需的所有參數
 *
 * @returns {string} 完整的 HTML 表單內容，包含：
 * - 隱藏的 input 欄位（包含所有參數）
 * - 自動提交的 JavaScript 程式碼
 *
 * @example
 * // 使用方式
 * const result = getECPayParams(100, '商品A')
 * if (result.status === 'success') {
 *   const htmlContent = getHtmlFormContent(result.payload.action, result.payload.params)
 *   res.send(htmlContent)
 * }
 *
 * @see {@link https://developers.ecpay.com.tw/?p=2856} ECPay 技術文件
 */
export const getHtmlFormContent = (action, params) => {
  const inputs = Object.entries(params)
    .map(function (param) {
      return `<input name=${
        param[0]
      } value="${param[1].toString()}" style="display:none"><br/>`
    })
    .join('')

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <title></title>
    </head>
    <body>
        <form method="post" action="${action}" style="display:none">
    ${inputs}
    <input type="submit" value="送出參數" style="display:none">
        </form>
    <script>
      document.forms[0].submit();
    </script>
    </body>
    </html>
  `

  return htmlContent
}
