export const config = {
  hasOrderResult: false, // true: 有回傳結果(用OrderResultURL)，false: 不會任何回傳結果(用ClientBackURL)
  // (二選一)以下這個設定，會有回傳結果，但要用前端的api路由來接收post資料，並協助重新導向到前端成功頁面(難度較高，建議一開始使用ClientBackURL)
  OrderResultURL: 'http://localhost:3000/ecpay/api', //前端成功頁面api路由
  // (二選一)以下這個設定，不會任何回傳結果
  ClientBackURL: 'http://localhost:3000/site/cart/status', //前端成功頁面
}
