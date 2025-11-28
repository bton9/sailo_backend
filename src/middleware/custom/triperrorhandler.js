/**
 * 行程管理 API 專用錯誤處理中介層
 */

const tripErrorHandler = (err, req, res, next) => {
  console.error('Trip API Error:', err)

  // 資料庫錯誤
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({
      success: false,
      message: '資料重複',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined,
    })
  }

  if (err.code === 'ER_NO_REFERENCED_ROW_2') {
    return res.status(400).json({
      success: false,
      message: '關聯的資料不存在',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined,
    })
  }

  if (err.code && err.code.startsWith('ER_')) {
    return res.status(500).json({
      success: false,
      message: '資料庫操作失敗',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined,
    })
  }

  // 驗證錯誤 (express-validator)
  if (err.array && typeof err.array === 'function') {
    return res.status(400).json({
      success: false,
      message: '資料驗證失敗',
      errors: err.array(),
    })
  }

  // 自訂錯誤
  if (err.statusCode) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message || '操作失敗',
      error: process.env.NODE_ENV === 'development' ? err : undefined,
    })
  }

  // 預設錯誤
  res.status(500).json({
    success: false,
    message: '伺服器內部錯誤',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined,
  })
}

export default tripErrorHandler
