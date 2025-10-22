import multer from 'multer';
import path from 'path';
import blogConfig from './blog.config.js';

// ===== 本地儲存 =====
const localStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/uploads/blog/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `blog-${uniqueSuffix}${ext}`);
  }
});

// 檔案過濾器
const fileFilter = (req, file, cb) => {
  if (blogConfig.upload.allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('只允許上傳 JPG、PNG、GIF 格式的圖片'), false);
  }
};

// Multer 上傳設定
const upload = multer({
  storage: localStorage,
  limits: {
    fileSize: blogConfig.upload.maxFileSize
  },
  fileFilter: fileFilter
});

export default upload;