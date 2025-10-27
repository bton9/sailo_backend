import multer from 'multer'
import path from 'path'

/**
 * Multer 設定 - 記憶體儲存 (用於 ImageKit 上傳)
 */
const storage = multer.memoryStorage()

/**
 * 檔案篩選器
 */
const fileFilter = (req, file, cb) => {
  // 允許的檔案類型
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new Error('不支援的檔案格式。只接受 JPG, JPEG, PNG, WEBP'), false)
  }
}

/**
 * Multer 上傳設定
 */
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
})

/**
 * 單一檔案上傳中介層
 */
export const uploadTripCover = upload.single('cover_image')

/**
 * 處理上傳錯誤
 */
export const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: '檔案大小超過限制 (最大 10MB)',
      })
    }
    return res.status(400).json({
      success: false,
      message: `上傳錯誤: ${err.message}`,
    })
  }

  if (err) {
    return res.status(400).json({
      success: false,
      message: err.message || '檔案上傳失敗',
    })
  }

  next()
}

export default upload
