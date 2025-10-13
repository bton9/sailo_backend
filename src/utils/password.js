/**
 * 密碼加密工具模組
 * 路徑: sailo/utils/password.js
 *
 * 功能：
 * - 密碼雜湊加密 (bcrypt)
 * - 密碼驗證
 * - 密碼強度檢測
 */

import bcrypt from 'bcryptjs'

/**
 * 加密密碼
 * @param {string} password - 明文密碼
 * @returns {Promise<string>} 加密後的密碼
 */
export async function hashPassword(password) {
  const salt = await bcrypt.genSalt(10)
  return bcrypt.hash(password, salt)
}

/**
 * 驗證密碼
 * @param {string} password - 使用者輸入的密碼
 * @param {string} hashedPassword - 資料庫中的加密密碼
 * @returns {Promise<boolean>} 是否匹配
 */
export async function verifyPassword(password, hashedPassword) {
  return bcrypt.compare(password, hashedPassword)
}

/**
 * 檢查密碼強度
 * @param {string} password - 密碼
 * @returns {Object} { isValid, strength, message }
 */
export function checkPasswordStrength(password) {
  const result = {
    isValid: false,
    strength: 'weak',
    message: '',
    score: 0,
  }

  // 基本長度檢查
  if (!password || password.length < 8) {
    result.message = '密碼至少需要 8 個字元'
    return result
  }

  let score = 0

  // 長度加分
  if (password.length >= 12) score += 2
  else if (password.length >= 10) score += 1

  // 包含小寫字母
  if (/[a-z]/.test(password)) score += 1

  // 包含大寫字母
  if (/[A-Z]/.test(password)) score += 1

  // 包含數字
  if (/\d/.test(password)) score += 1

  // 包含特殊字元
  if (/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) score += 2

  result.score = score

  // 判斷強度
  if (score >= 6) {
    result.strength = 'strong'
    result.isValid = true
    result.message = '強密碼'
  } else if (score >= 4) {
    result.strength = 'medium'
    result.isValid = true
    result.message = '中等強度密碼'
  } else {
    result.strength = 'weak'
    result.message = '密碼強度不足，請包含大小寫字母、數字與特殊字元'
  }

  return result
}

export default {
  hashPassword,
  verifyPassword,
  checkPasswordStrength,
}
