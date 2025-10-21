import { validationResult } from 'express-validator';
import { sendError } from '../../utils/blog/helpers.js';

/**
 * 驗證中介軟體
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => error.msg);
    return sendError(res, errorMessages[0], 400);
  }
  
  next();
};

export default validate;