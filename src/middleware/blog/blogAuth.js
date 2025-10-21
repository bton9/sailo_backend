// Blog 專用的 auth middleware
import { verifyToken } from '../../utils/jwt.js';

export const blogAuthMiddleware = (req, res, next) => {
  try {
    // 從 header 取得 token
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: '請先登入'
      });
    }

    // 移除 "Bearer " 前綴
    const token = authHeader.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: '請先登入'
      });
    }

    // 驗證 token (使用現有的 verifyToken)
    const decoded = verifyToken(token);
    
    if (!decoded) {
      return res.status(401).json({
        success: false,
        message: 'Token 無效或已過期'
      });
    }

    // 將使用者資訊存入 req.user
    req.user = {
      id: decoded.userId,
      email: decoded.email,
      access: decoded.access
    };

    next();
  } catch (error) {
    console.error('Blog auth middleware error:', error);
    return res.status(401).json({
      success: false,
      message: 'Token 驗證失敗'
    });
  }
};

// 也 export default
export default blogAuthMiddleware;