import express from 'express'
import { getECPayParams, getHtmlFormContent } from '../../lib/ecpay/service.js' //ecpay

const router = express.Router()

// 付款路由
router.get('/ecpay2', (req, res) => {
  const amount = Number(req.query.amount) || 0
  const items = req.query.items || ''
  // 產生參數，這裡的參數是測試用的，實際上需要從前端取得
  // 總金額為100元，商品為"商品之一x2,商品之二x3,商品之三x4"
  const result = getECPayParams(amount, items)
  // 產生html內容
  const htmlContent = getHtmlFormContent(
    result.payload.action,
    result.payload.params
  )
  // 送出html內容
  res.send(htmlContent)
})

export default router
