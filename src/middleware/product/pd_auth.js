// ../middleware/pd_auth.js

/**
 * @description 驗證 JWT Token 的中介軟體函式 (已修改為直接放行)
 * @param {object} req - 請求物件
 * @param {object} res - 響應物件
 * @param {function} next - 繼續執行下一個中介軟體的函式
 */
export const verifyToken = (req, res, next) => {
  // 刪除所有驗證邏輯，直接調用 next() 讓請求通過。
  // 注意：這會讓所有使用此中介軟體的 API 失去身份驗證功能。
  next()
}
