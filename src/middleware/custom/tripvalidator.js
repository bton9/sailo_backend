import { body, param, query, validationResult } from 'express-validator'

/**
 * 處理驗證結果
 */
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    // 加入這些 log
    console.log('❌ 驗證失敗!')
    console.log('收到的資料:', req.body)
    console.log('錯誤詳情:', errors.array())

    return res.status(400).json({
      success: false,
      message: '資料驗證失敗',
      errors: errors.array(), // 回傳詳細錯誤
    })
  }
  next()
}

/**
 * 建立行程驗證規則
 */
export const validateCreateTrip = [
  body('trip_name')
    .trim()
    .notEmpty()
    .withMessage('行程名稱為必填')
    .isLength({ min: 1, max: 100 })
    .withMessage('行程名稱長度需在 1-100 字之間'),

  body('user_id')
    .notEmpty()
    .withMessage('使用者 ID 為必填')
    .isInt({ min: 1 })
    .withMessage('使用者 ID 必須為正整數'),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('描述最多 1000 字'),

  body('start_date')
    .notEmpty()
    .withMessage('開始日期為必填')
    .isDate()
    .withMessage('開始日期格式錯誤 (需為 YYYY-MM-DD)'),

  body('end_date')
    .notEmpty()
    .withMessage('結束日期為必填')
    .isDate()
    .withMessage('結束日期格式錯誤 (需為 YYYY-MM-DD)')
    .custom((endDate, { req }) => {
      if (new Date(endDate) < new Date(req.body.start_date)) {
        throw new Error('結束日期不能早於開始日期')
      }
      return true
    }),

  body('cover_image_url')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isURL()
    .withMessage('封面圖片 URL 格式錯誤'),

  body('summary_text')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('摘要最多 200 字'),

  body('is_public')
    .optional()
    .isBoolean()
    .withMessage('is_public 必須為布林值'),

  body('location_id')
    .optional({ nullable: true })
    .isInt({ min: 1 })
    .withMessage('location_id 必須為正整數'),

  handleValidationErrors,
]

/**
 * 更新行程驗證規則
 */
export const validateUpdateTrip = [
  param('tripId').isInt({ min: 1 }).withMessage('行程 ID 必須為正整數'),

  body('trip_name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('行程名稱長度需在 1-100 字之間'),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('描述最多 1000 字'),

  body('start_date').optional().isDate().withMessage('開始日期格式錯誤'),

  body('end_date').optional().isDate().withMessage('結束日期格式錯誤'),

  body('cover_image_url')
    .optional()
    .trim()
    .isURL()
    .withMessage('封面圖片 URL 格式錯誤'),

  body('summary_text')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('摘要最多 200 字'),

  body('is_public')
    .optional()
    .isBoolean()
    .withMessage('is_public 必須為布林值'),

  body('location_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('location_id 必須為正整數'),

  handleValidationErrors,
]

/**
 * 新增景點驗證規則
 */
export const validateAddPlace = [
  param('tripDayId').isInt({ min: 1 }).withMessage('trip_day_id 必須為正整數'),

  body('place_id')
    .notEmpty()
    .withMessage('景點 ID 為必填')
    .isInt({ min: 1 })
    .withMessage('景點 ID 必須為正整數'),

  body('type')
    .optional()
    .isIn(['景點', '餐廳', '住宿'])
    .withMessage('類型必須為: 景點, 餐廳, 住宿'),

  body('note')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('備註最多 500 字'),

  // ✅ 修改為可選（允許 null 或空值）
  body('start_time')
    .optional({ nullable: true, checkFalsy: true })
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/)
    .withMessage('開始時間格式錯誤 (需為 HH:MM:SS)'),

  body('end_time')
    .optional({ nullable: true, checkFalsy: true })
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/)
    .withMessage('結束時間格式錯誤 (需為 HH:MM:SS)'),

  handleValidationErrors,
]

/**
 * 更新順序驗證規則
 */
export const validateUpdateOrder = [
  param('tripItemId')
    .isInt({ min: 1 })
    .withMessage('trip_item_id 必須為正整數'),

  body('sort_order')
    .notEmpty()
    .withMessage('排序順序為必填')
    .isInt({ min: 1 })
    .withMessage('排序順序必須為正整數'),

  handleValidationErrors,
]

/**
 * ID 參數驗證
 */
export const validateTripId = [
  param('tripId').isInt({ min: 1 }).withMessage('行程 ID 必須為正整數'),
  handleValidationErrors,
]

export const validateUserId = [
  param('userId').isInt({ min: 1 }).withMessage('使用者 ID 必須為正整數'),
  handleValidationErrors,
]

export const validateTripItemId = [
  param('tripItemId')
    .isInt({ min: 1 })
    .withMessage('trip_item_id 必須為正整數'),
  handleValidationErrors,
]

/**
 * 收藏驗證規則
 */
export const validateFavorite = [
  body('user_id')
    .notEmpty()
    .withMessage('使用者 ID 為必填')
    .isInt({ min: 1 })
    .withMessage('使用者 ID 必須為正整數'),

  body('trip_id')
    .notEmpty()
    .withMessage('行程 ID 為必填')
    .isInt({ min: 1 })
    .withMessage('行程 ID 必須為正整數'),

  handleValidationErrors,
]

/**
 * 搜尋驗證規則
 */
export const validateSearch = [
  query('keyword')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('搜尋關鍵字長度需在 1-100 字之間'),

  query('location_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('location_id 必須為正整數'),

  query('is_public')
    .optional()
    .isIn(['0', '1', 'true', 'false'])
    .withMessage('is_public 必須為 0, 1, true 或 false'),

  handleValidationErrors,
]
