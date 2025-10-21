/**
 * User Controller
 * 路徑: sailo_backend/src/controllers/userController.js
 *
 * 功能：處理使用者資料相關的 API 請求
 *
 * API 端點：
 * - PUT /api/user/update-nickname - 更新暱稱
 * - PUT /api/user/update-profile - 更新個人資料
 */

import { query } from '../config/database.js'

/**
 * 更新使用者暱稱
 *
 * @route PUT /api/user/update-nickname
 * @header {string} Authorization - Bearer Token (必填)
 * @body {string} nickname - 新暱稱 (必填)
 * @returns {Object} { success, message, user }
 */
export async function updateNickname(req, res) {
  try {
    // ============================================
    // 步驟 1: 取得使用者 ID (由 authenticate middleware 提供)
    // ============================================
    const userId = req.user.userId

    // ============================================
    // 步驟 2: 驗證輸入
    // ============================================
    const { nickname } = req.body

    if (!nickname || !nickname.trim()) {
      return res.status(400).json({
        success: false,
        message: '暱稱不能為空',
      })
    }

    // 檢查暱稱長度 (最多 50 字元)
    if (nickname.length > 50) {
      return res.status(400).json({
        success: false,
        message: '暱稱長度不能超過 50 個字元',
      })
    }

    // ============================================
    // 步驟 3: 更新資料庫
    // ============================================
    await query('UPDATE users SET nickname = ? WHERE id = ?', [
      nickname.trim(),
      userId,
    ])

    console.log(`✅ 使用者 ${userId} 更新暱稱為: ${nickname}`)

    // ============================================
    // 步驟 4: 回傳更新後的資料
    // ============================================
    res.json({
      success: true,
      message: '暱稱更新成功',
      user: {
        nickname: nickname.trim(),
      },
    })
  } catch (error) {
    console.error('❌ Update nickname error:', error)
    res.status(500).json({
      success: false,
      message: '伺服器錯誤，請稍後再試',
    })
  }
}

/**
 * 更新使用者個人資料
 *
 * @route PUT /api/user/update-profile
 * @header {string} Authorization - Bearer Token (必填)
 * @body {string} name - 姓名 (必填)
 * @body {string} phone - 手機號碼 (選填)
 * @body {string} birthday - 生日 YYYY-MM-DD (選填)
 * @body {string} gender - 性別 male/female/other (選填)
 * @returns {Object} { success, message, user }
 */
export async function updateProfile(req, res) {
  try {
    // ============================================
    // 步驟 1: 取得使用者 ID (由 authenticate middleware 提供)
    // ============================================
    const userId = req.user.userId

    // ============================================
    // 步驟 2: 驗證輸入
    // ============================================
    const { name, phone, birthday, gender } = req.body

    // 姓名為必填
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: '姓名不能為空',
      })
    }

    // 驗證姓名長度 (最多 100 字元)
    if (name.length > 100) {
      return res.status(400).json({
        success: false,
        message: '姓名長度不能超過 100 個字元',
      })
    }

    // 驗證手機號碼格式 (如果有提供)
    if (phone && phone.trim()) {
      // 台灣手機號碼格式: 09XX-XXX-XXX 或 09XXXXXXXX
      const phoneRegex = /^09\d{8}$/
      const cleanPhone = phone.replace(/[-\s]/g, '') // 移除分隔符

      if (!phoneRegex.test(cleanPhone)) {
        return res.status(400).json({
          success: false,
          message: '手機號碼格式不正確 (請使用 09XX-XXX-XXX 格式)',
        })
      }
    }

    // 驗證生日格式 (如果有提供)
    if (birthday && birthday.trim()) {
      const birthDate = new Date(birthday)
      const today = new Date()

      // 檢查日期是否有效
      if (isNaN(birthDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: '生日格式不正確',
        })
      }

      // 檢查是否為未來日期
      if (birthDate > today) {
        return res.status(400).json({
          success: false,
          message: '生日不能是未來日期',
        })
      }

      // 檢查年齡是否合理 (至少 1 歲，最多 150 歲)
      const age = (today - birthDate) / (1000 * 60 * 60 * 24 * 365)
      if (age < 1 || age > 150) {
        return res.status(400).json({
          success: false,
          message: '生日設定不合理',
        })
      }
    }

    // 驗證性別 (如果有提供)
    if (gender && !['male', 'female', 'other'].includes(gender)) {
      return res.status(400).json({
        success: false,
        message: '性別選項不正確',
      })
    }

    // ============================================
    // 步驟 3: 更新資料庫
    // ============================================
    await query(
      `UPDATE users 
       SET name = ?, phone = ?, birthday = ?, gender = ? 
       WHERE id = ?`,
      [
        name.trim(),
        phone?.trim() || null,
        birthday?.trim() || null,
        gender || null,
        userId,
      ]
    )

    console.log(`✅ 使用者 ${userId} 更新個人資料`)

    // ============================================
    // 步驟 4: 回傳更新後的資料
    // ============================================
    res.json({
      success: true,
      message: '個人資料更新成功',
      user: {
        name: name.trim(),
        phone: phone?.trim() || null,
        birthday: birthday?.trim() || null,
        gender: gender || null,
      },
    })
  } catch (error) {
    console.error('❌ Update profile error:', error)
    res.status(500).json({
      success: false,
      message: '伺服器錯誤，請稍後再試',
    })
  }
}
