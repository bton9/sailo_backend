/**
 * Passport Google OAuth 配置檔
 * 路徑: src/config/passport.js
 *
 * 功能：
 * - 設定 Google OAuth 2.0 驗證策略
 * - 處理 Google 登入回調
 * - 自動建立或更新使用者資料
 *
 * 使用方式：
 * import passport from './config/passport.js'
 */

import passport from 'passport'
import { Strategy as GoogleStrategy } from 'passport-google-oauth20'
import { query } from './database.js'
import dotenv from 'dotenv'

dotenv.config()

/**
 * 配置 Google OAuth 策略
 *
 * 需要在 Google Cloud Console 建立 OAuth 2.0 憑證
 * 網址: https://console.cloud.google.com/apis/credentials
 */
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      callbackURL:
        process.env.GOOGLE_CALLBACK_URL ||
        'http://localhost:5000/api/v2/auth/google/callback',
      // 請求使用者的基本資料與 Email
      scope: ['profile', 'email'],
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        console.log('Google OAuth profile received:', {
          id: profile.id,
          email: profile.emails?.[0]?.value,
          name: profile.displayName,
        })

        // 從 Google 取得的使用者資料
        const googleId = profile.id
        const email = profile.emails?.[0]?.value
        const name = profile.displayName || 'Google User'
        const avatar = profile.photos?.[0]?.value || null

        // 驗證 Email 是否存在
        if (!email) {
          return done(new Error('無法從 Google 取得 Email 資訊'), null)
        }

        // ========================================
        // 步驟 1: 檢查使用者是否已存在 (透過 Google ID)
        // ========================================
        let users = await query(
          'SELECT * FROM users WHERE google_id = ? LIMIT 1',
          [googleId]
        )

        if (users.length > 0) {
          // ========================================
          // 情況 A: Google ID 已存在 (已經用 Google 登入過)
          // ========================================
          const user = users[0]

          console.log('Existing Google user found:', user.email)

          // 更新最後登入時間與頭像 (如果有變更)
          await query(
            'UPDATE users SET avatar = ?, updated_at = NOW() WHERE id = ?',
            [avatar, user.id]
          )

          return done(null, {
            id: user.id,
            email: user.email,
            name: user.name,
            avatar: avatar,
            access: user.access,
            isNewUser: false, // 現有使用者
          })
        }

        // ========================================
        // 步驟 2: 檢查 Email 是否已被本地帳號使用
        // ========================================
        users = await query('SELECT * FROM users WHERE email = ? LIMIT 1', [
          email,
        ])

        if (users.length > 0) {
          // ========================================
          // 情況 B: Email 已存在但沒有 Google ID (本地帳號)
          // 自動綁定 Google 帳號到現有的本地帳號
          // ========================================
          const user = users[0]

          console.log(
            'Linking Google account to existing local account:',
            email
          )

          // 更新使用者資料，綁定 Google ID 與頭像
          await query(
            `UPDATE users 
             SET google_id = ?, 
                 avatar = COALESCE(avatar, ?), 
                 email_verified = TRUE,
                 updated_at = NOW() 
             WHERE id = ?`,
            [googleId, avatar, user.id]
          )

          return done(null, {
            id: user.id,
            email: user.email,
            name: user.name,
            avatar: user.avatar || avatar,
            access: user.access,
            isNewUser: false, // 現有使用者 (已綁定)
          })
        }

        // ========================================
        // 步驟 3: 全新使用者，建立新帳號
        // ========================================
        console.log('Creating new user from Google login:', email)

        const result = await query(
          `INSERT INTO users 
           (email, google_id, name, avatar, access, is_active, email_verified, password) 
           VALUES (?, ?, ?, ?, 'user', TRUE, TRUE, NULL)`,
          [email, googleId, name, avatar]
        )

        const newUserId = result.insertId

        console.log('New user created successfully:', newUserId)

        return done(null, {
          id: newUserId,
          email: email,
          name: name,
          avatar: avatar,
          access: 'user',
          isNewUser: true, // 新使用者
        })
      } catch (error) {
        console.error('Google OAuth strategy error:', error)
        return done(error, null)
      }
    }
  )
)

/**
 * 序列化使用者 (儲存到 session)
 * 只儲存使用者 ID，減少 session 大小
 */
passport.serializeUser((user, done) => {
  done(null, user.id)
})

/**
 * 反序列化使用者 (從 session 還原)
 * 根據 ID 從資料庫查詢完整使用者資料
 */
passport.deserializeUser(async (id, done) => {
  try {
    const users = await query('SELECT * FROM users WHERE id = ? LIMIT 1', [id])

    if (users.length === 0) {
      return done(new Error('找不到使用者'), null)
    }

    const user = users[0]

    // 返回使用者資料 (不包含敏感資訊)
    done(null, {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      access: user.access,
    })
  } catch (error) {
    console.error('Deserialize user error:', error)
    done(error, null)
  }
})

export default passport
