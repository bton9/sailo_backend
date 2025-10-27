export const cartConfig = {
  // 購物車商品數量限制
  maxQuantityPerItem: 99,
  minQuantityPerItem: 1,

  // 購物車商品總數限制
  maxItemsInCart: 50,

  // 運費設定
  shipping: {
    standard: {
      name: '標準配送',
      fee: 80,
      estimatedDays: '3-5',
    },
    express: {
      name: '快速配送',
      fee: 150,
      estimatedDays: '1-2',
    },
    freeShippingThreshold: 1000, // 滿額免運門檻
  },

  // 付款方式設定
  paymentMethods: {
    ecpay: {
      name: 'ECPay',
      available: true,
    },
    cod: {
      name: '貨到付款',
      available: true,
      extraFee: 0,
    },
  },

  // 訂單狀態
  orderStatus: {
    0: '待付款',
    1: '處理中',
    2: '配送中',
    3: '已完成',
    4: '已取消',
  },

  // 付款狀態
  paymentStatus: {
    0: '未付款',
    1: '已付款',
    2: '付款失敗',
    3: '已退款',
  },

  // 訂單編號前綴
  orderPrefix: 'ORD',

  // 訂單保留時間(分鐘) - 未付款自動取消
  orderReserveTime: 30,
}

export default cartConfig
