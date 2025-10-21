import upload from '../config/upload.config.js';
import { sendError } from '../utils/blog/helpers.js';

/**
 * 單一圖片上傳中介軟體
 */
export const uploadSingle = (req, res, next) => {
  const uploadHandler = upload.single('image');
  
  uploadHandler(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return sendError(res, '檔案大小不能超過 5MB', 400);
      }
      
      if (err.message) {
        return sendError(res, err.message, 400);
      }
      
      return sendError(res, '圖片上傳失敗', 500);
    }
    
    next();
  });
};

/**
 * 多張圖片上傳中介軟體
 */
export const uploadMultiple = (req, res, next) => {
  const uploadHandler = upload.array('images', 5);
  
  uploadHandler(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return sendError(res, '單一檔案大小不能超過 5MB', 400);
      }
      
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return sendError(res, '最多只能上傳 5 張圖片', 400);
      }
      
      if (err.message) {
        return sendError(res, err.message, 400);
      }
      
      return sendError(res, '圖片上傳失敗', 500);
    }
    
    next();
  });
};