/**
 * Email 工具模組
 * 路徑: src/utils/email.js
 *
 * 功能：
 * - 使用 Nodemailer 發送郵件
 * - 支援密碼重置驗證信
 * - 支援 Email 驗證信
 * - 支援 HTML 模板郵件
 *
 * 使用方式：
 * import { sendPasswordResetEmail, sendVerificationEmail } from './utils/email.js'
 */

import nodemailer from 'nodemailer'
import dotenv from 'dotenv'

dotenv.config()

/**
 * 建立 Nodemailer 傳輸器
 * 支援多種郵件服務商 (Gmail, Outlook, 自訂 SMTP)
 */
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: process.env.EMAIL_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER, // 發件人信箱
    pass: process.env.EMAIL_PASSWORD, // 發件人密碼或應用程式專用密碼
  },
})

/**
 * 驗證郵件伺服器連線是否正常
 */
export async function verifyEmailConnection() {
  try {
    await transporter.verify()
    console.log('Email server is ready to send messages')
    return true
  } catch (error) {
    console.error('Email server connection failed:', error.message)
    return false
  }
}

/**
 * 發送密碼重置郵件
 *
 * @param {string} email - 收件人信箱
 * @param {string} resetToken - 重置 Token
 * @param {string} userName - 使用者名稱
 * @returns {Promise<boolean>} 是否發送成功
 *
 * 更新說明 (2025-10-15):
 * - 修正重置密碼 URL 路徑從 /reset-password 改為 /auth/reset-password
 * - 確保與前端 Next.js App Router 路由一致
 */
export async function sendPasswordResetEmail(email, resetToken, userName) {
  try {
    // ============================================
    // 建立重置密碼連結
    // ============================================
    // 路徑: /auth/reset-password (對應前端 app/auth/reset-password/page.jsx)
    // 參數: token (用於驗證使用者身份)
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/reset-password?token=${resetToken}`

    console.log('準備發送密碼重置郵件:', {
      to: email,
      resetUrl: resetUrl,
      userName: userName || '(未提供)',
    })

    // HTML 郵件模板
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="zh-TW">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: #f4f4f4;
            margin: 0;
            padding: 0;
          }
          .container {
            max-width: 600px;
            margin: 30px auto;
            background: #ffffff;
            border-radius: 10px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
            overflow: hidden;
          }
          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #ffffff;
            padding: 30px;
            text-align: center;
          }
          .header h1 {
            margin: 0;
            font-size: 28px;
          }
          .content {
            padding: 40px 30px;
          }
          .content h2 {
            color: #333333;
            font-size: 22px;
            margin-bottom: 20px;
          }
          .content p {
            color: #666666;
            line-height: 1.8;
            margin-bottom: 20px;
          }
          .button {
            display: inline-block;
            padding: 15px 40px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #ffffff;
            text-decoration: none;
            border-radius: 50px;
            font-weight: bold;
            text-align: center;
            margin: 20px 0;
          }
          .button:hover {
            background: linear-gradient(135deg, #764ba2 0%, #667eea 100%);
          }
          .warning {
            background-color: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 15px;
            margin: 20px 0;
            border-radius: 5px;
          }
          .warning p {
            margin: 0;
            color: #856404;
          }
          .footer {
            background-color: #f8f9fa;
            padding: 20px;
            text-align: center;
            color: #6c757d;
            font-size: 14px;
          }
          .footer a {
            color: #667eea;
            text-decoration: none;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>密碼重置請求</h1>
          </div>
          <div class="content">
            <h2>親愛的 ${userName || '使用者'}，您好！</h2>
            <p>我們收到了您的密碼重置請求。請點擊下方按鈕來重設您的密碼：</p>
            
            <div style="text-align: center;">
              <a href="${resetUrl}" class="button">立即重設密碼</a>
            </div>
            
            <p>或者複製以下連結到瀏覽器開啟：</p>
            <p style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; word-break: break-all; font-family: monospace; font-size: 13px;">
              ${resetUrl}
            </p>
            
            <div class="warning">
              <p><strong> 重要提示：</strong></p>
              <p>• 此連結將在 <strong>1 小時後</strong> 失效</p>
              <p>• 如果您沒有提出此請求，請忽略此郵件</p>
              <p>• 為了帳戶安全，請勿將此連結分享給他人</p>
            </div>
            
            <p>如有任何問題，歡迎聯繫我們的客服團隊。</p>
          </div>
          <div class="footer">
            <p>此郵件由 SailoTravel 系統自動發送，請勿直接回覆</p>
            <p>© ${new Date().getFullYear()} SailoTravel. All rights reserved.</p>
            <p><a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}">返回首頁</a></p>
          </div>
        </div>
      </body>
      </html>
    `

    // 純文字版本 (作為備援)
    const textContent = `
親愛的 ${userName || '使用者'}，

我們收到了您的密碼重置請求。請複製以下連結到瀏覽器開啟來重設您的密碼：

${resetUrl}

重要提示：
- 此連結將在 1 小時後失效
- 如果您沒有提出此請求，請忽略此郵件
- 為了帳戶安全，請勿將此連結分享給他人

如有任何問題，歡迎聯繫我們的客服團隊。

© ${new Date().getFullYear()} SailoTravel. All rights reserved.
此郵件由系統自動發送，請勿直接回覆。
    `

    // 發送郵件
    const info = await transporter.sendMail({
      from: `"SailoTravel 客服中心" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'SailoTravel - 密碼重置請求',
      text: textContent,
      html: htmlContent,
    })

    console.log('Password reset email sent:', info.messageId)
    return true
  } catch (error) {
    console.error('Failed to send password reset email:', error)
    return false
  }
}

/**
 * 發送 Email 驗證信
 *
 * @param {string} email - 收件人信箱
 * @param {string} verificationToken - 驗證 Token
 * @param {string} userName - 使用者名稱
 * @returns {Promise<boolean>} 是否發送成功
 */
export async function sendVerificationEmail(
  email,
  verificationToken,
  userName
) {
  try {
    // 建立驗證連結
    const verifyUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${verificationToken}`

    // HTML 郵件模板
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="zh-TW">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: #f4f4f4;
            margin: 0;
            padding: 0;
          }
          .container {
            max-width: 600px;
            margin: 30px auto;
            background: #ffffff;
            border-radius: 10px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
            overflow: hidden;
          }
          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #ffffff;
            padding: 30px;
            text-align: center;
          }
          .header h1 {
            margin: 0;
            font-size: 28px;
          }
          .content {
            padding: 40px 30px;
          }
          .content h2 {
            color: #333333;
            font-size: 22px;
            margin-bottom: 20px;
          }
          .content p {
            color: #666666;
            line-height: 1.8;
            margin-bottom: 20px;
          }
          .button {
            display: inline-block;
            padding: 15px 40px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #ffffff;
            text-decoration: none;
            border-radius: 50px;
            font-weight: bold;
            text-align: center;
            margin: 20px 0;
          }
          .footer {
            background-color: #f8f9fa;
            padding: 20px;
            text-align: center;
            color: #6c757d;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Email 驗證</h1>
          </div>
          <div class="content">
            <h2>歡迎加入 SailoTravel！</h2>
            <p>親愛的 ${userName || '使用者'}，感謝您註冊 SailoTravel 帳號。</p>
            <p>請點擊下方按鈕驗證您的電子郵件地址：</p>
            
            <div style="text-align: center;">
              <a href="${verifyUrl}" class="button">立即驗證 Email</a>
            </div>
            
            <p>或者複製以下連結到瀏覽器開啟：</p>
            <p style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; word-break: break-all; font-family: monospace; font-size: 13px;">
              ${verifyUrl}
            </p>
            
            <p>此連結將在 <strong>24 小時後</strong> 失效。</p>
          </div>
          <div class="footer">
            <p>此郵件由 SailoTravel 系統自動發送，請勿直接回覆</p>
            <p>© ${new Date().getFullYear()} SailoTravel. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `

    // 發送郵件
    const info = await transporter.sendMail({
      from: `"SailoTravel 客服中心" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'SailoTravel - Email 驗證',
      html: htmlContent,
    })

    console.log('Verification email sent:', info.messageId)
    return true
  } catch (error) {
    console.error('Failed to send verification email:', error)
    return false
  }
}

/**
 * 發送歡迎郵件 (註冊完成後)
 *
 * @param {string} email - 收件人信箱
 * @param {string} userName - 使用者名稱
 * @returns {Promise<boolean>} 是否發送成功
 */
export async function sendWelcomeEmail(email, userName) {
  try {
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="zh-TW">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: #f4f4f4;
            margin: 0;
            padding: 0;
          }
          .container {
            max-width: 600px;
            margin: 30px auto;
            background: #ffffff;
            border-radius: 10px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
            overflow: hidden;
          }
          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #ffffff;
            padding: 30px;
            text-align: center;
          }
          .content {
            padding: 40px 30px;
          }
          .footer {
            background-color: #f8f9fa;
            padding: 20px;
            text-align: center;
            color: #6c757d;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>歡迎加入 SailoTravel！</h1>
          </div>
          <div class="content">
            <h2>親愛的 ${userName}，</h2>
            <p>感謝您註冊 SailoTravel！我們很高興您加入我們的旅遊大家庭。</p>
            <p>您現在可以開始使用所有功能，探索精彩的旅程！</p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} SailoTravel. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `

    await transporter.sendMail({
      from: `"SailoTravel 客服中心" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: '歡迎加入 SailoTravel！',
      html: htmlContent,
    })

    console.log('Welcome email sent to:', email)
    return true
  } catch (error) {
    console.error('Failed to send welcome email:', error)
    return false
  }
}

/**
 * ========================================
 * 發送密碼重置 OTP 郵件
 * ========================================
 *
 * 功能說明：
 * - 發送 6 位數 OTP 驗證碼到使用者信箱
 * - 取代原本的 Token 連結方式
 * - OTP 有效期 10 分鐘
 *
 * @param {string} email - 收件人信箱
 * @param {string} otp - 6 位數 OTP 驗證碼
 * @param {string} userName - 使用者名稱
 * @returns {Promise<boolean>} 是否發送成功
 */
export async function sendPasswordResetOTPEmail(email, otp, userName) {
  try {
    console.log('準備發送密碼重置 OTP 郵件:', {
      to: email,
      otp: otp,
      userName: userName || '(未提供)',
    })

    // HTML 郵件模板
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="zh-TW">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: #f4f4f4;
            margin: 0;
            padding: 0;
          }
          .container {
            max-width: 600px;
            margin: 30px auto;
            background: #ffffff;
            border-radius: 10px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
            overflow: hidden;
          }
          .header {
            background: #3e3e3e;
            color: #ffffff;
            padding: 30px;
            text-align: center;
          }
          .header h1 {
            margin: 0;
            font-size: 24px;
          }
          .content {
            padding: 40px 30px;
          }
          .otp-box {
            background: #3e3e3e;
            color: #ffffff;
            font-size: 36px;
            font-weight: bold;
            letter-spacing: 8px;
            text-align: center;
            padding: 25px;
            margin: 30px 0;
            border-radius: 8px;
            font-family: 'Courier New', monospace;
          }
          .info-box {
            background: #f8f9fa;
            border-left: 4px solid #3e3e3e;
            padding: 15px 20px;
            margin: 20px 0;
            border-radius: 4px;
          }
          .warning-box {
            background: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 15px 20px;
            margin: 20px 0;
            border-radius: 4px;
          }
          .footer {
            background: #f8f9fa;
            padding: 20px;
            text-align: center;
            font-size: 12px;
            color: #6c757d;
          }
          p {
            line-height: 1.6;
            color: #333;
          }
          strong {
            color: #667eea;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <!-- 標題區 -->
          <div class="header">
            <h1>密碼重置驗證碼</h1>
          </div>
          
          <!-- 內容區 -->
          <div class="content">
            <p>哈囉 <strong>${userName || '會員'}</strong>，</p>
            <p>我們收到了您的密碼重置請求。請使用以下 6 位數驗證碼完成密碼重置：</p>
            
            <!-- OTP 驗證碼 -->
            <div class="otp-box">
              ${otp}
            </div>
            
            <!-- 重要資訊 -->
            <div class="info-box">
              <p style="margin: 0;">
                <strong>⏰ 有效期限：</strong> 此驗證碼將在 <strong>10 分鐘</strong>後失效
              </p>
            </div>
            
            <div class="info-box">
              <p style="margin: 0;">
                <strong>驗證次數：</strong> 最多可驗證 <strong>5 次</strong>，超過後需重新申請
              </p>
            </div>
            
            <!-- 安全提醒 -->
            <div class="warning-box">
              <p style="margin: 0;">
                <strong> 安全提醒：</strong><br>
                • 請勿將驗證碼分享給任何人<br>
                • SailoTravel 不會主動要求您提供驗證碼<br>
                • 如果您未申請密碼重置，請忽略此郵件
              </p>
            </div>
            
            <p style="margin-top: 30px;">
              如有任何問題，歡迎聯繫我們的客服團隊。
            </p>
            
            <p style="color: #6c757d; font-size: 14px;">
              祝您旅途愉快！<br>
              <strong>SailoTravel 團隊</strong>
            </p>
          </div>
          
          <!-- 頁尾 -->
          <div class="footer">
            <p style="margin: 5px 0;">© 2025 SailoTravel. All rights reserved.</p>
            <p style="margin: 5px 0;">這是系統自動發送的郵件，請勿直接回覆</p>
          </div>
        </div>
      </body>
      </html>
    `

    // 發送郵件
    await transporter.sendMail({
      from: `"SailoTravel 客服中心" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: '密碼重置驗證碼 - SailoTravel',
      html: htmlContent,
    })

    console.log('Password reset OTP email sent to:', email)
    return true
  } catch (error) {
    console.error('Failed to send password reset OTP email:', error)
    return false
  }
}

export default {
  verifyEmailConnection,
  sendPasswordResetEmail,
  sendPasswordResetOTPEmail,
  sendVerificationEmail,
  sendWelcomeEmail,
}
