/**
 * 統一的 API 回應格式
 */

/**
 * 成功回應
 * @param {Object} res - Express response 物件
 * @param {*} data - 回傳的資料
 * @param {string} message - 成功訊息
 * @param {number} statusCode - HTTP 狀態碼 (預設 200)
 */
export const success = (
  res,
  data = null,
  message = '操作成功',
  statusCode = 200
) => {
  return res.status(statusCode).json({
    success: true,
    data,
    message,
  })
}

/**
 * 失敗回應
 * @param {Object} res - Express response 物件
 * @param {string} message - 錯誤訊息
 * @param {number} statusCode - HTTP 狀態碼 (預設 400)
 * @param {*} error - 詳細錯誤資訊 (開發環境才顯示)
 */
export const error = (
  res,
  message = '操作失敗',
  statusCode = 400,
  errorDetails = null
) => {
  const response = {
    success: false,
    message,
  }

  // 只在開發環境顯示詳細錯誤
  if (process.env.NODE_ENV === 'development' && errorDetails) {
    response.error = errorDetails
  }

  return res.status(statusCode).json(response)
}

/**
 * 建立回應 - 根據條件自動選擇成功或失敗
 * @param {Object} res - Express response 物件
 * @param {boolean} condition - 成功條件
 * @param {*} data - 成功時回傳的資料
 * @param {string} successMessage - 成功訊息
 * @param {string} errorMessage - 失敗訊息
 */
export const createResponse = (
  res,
  condition,
  data = null,
  successMessage = '操作成功',
  errorMessage = '操作失敗'
) => {
  if (condition) {
    return success(res, data, successMessage)
  } else {
    return error(res, errorMessage)
  }
}

export default {
  success,
  error,
  createResponse,
}
