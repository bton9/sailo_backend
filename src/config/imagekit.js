/**
 * ImageKit Configuration
 * 路徑: sailo_backend/src/config/imagekit.js
 *
 * 功能：設定 ImageKit CDN 服務
 * - 頭像圖片上傳至 ImageKit CDN
 * - 不儲存在本地專案資料夾
 * - 提供圖片優化、調整大小等功能
 *
 * 環境變數需求 (.env)：
 * - IMAGEKIT_PUBLIC_KEY - ImageKit 公鑰
 * - IMAGEKIT_PRIVATE_KEY - ImageKit 私鑰
 * - IMAGEKIT_URL_ENDPOINT - ImageKit URL 端點
 *
 * ImageKit 設定步驟：
 * 1. 註冊 ImageKit 帳號: https://imagekit.io/
 * 2. 取得 API 金鑰（Dashboard > Developer Options > API Keys）
 * 3. 設定環境變數
 */

import ImageKit from 'imagekit'
import dotenv from 'dotenv'

// 載入環境變數
dotenv.config()

/**
 * ImageKit 實例
 * 用於後端上傳、刪除等操作
 */
const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
})

/**
 * 驗證 ImageKit 配置是否完整
 * 在應用啟動時檢查必要的環境變數
 */
export function validateImageKitConfig() {
  const requiredVars = [
    'IMAGEKIT_PUBLIC_KEY',
    'IMAGEKIT_PRIVATE_KEY',
    'IMAGEKIT_URL_ENDPOINT',
  ]

  const missing = requiredVars.filter((varName) => !process.env[varName])

  if (missing.length > 0) {
    console.error('ImageKit 配置錯誤: 缺少環境變數', missing)
    console.error(
      '請在 .env 檔案中設定: IMAGEKIT_PUBLIC_KEY, IMAGEKIT_PRIVATE_KEY, IMAGEKIT_URL_ENDPOINT'
    )
    return false
  }

  console.log('ImageKit 配置檢查通過')
  return true
}

/**
 * 取得 ImageKit 認證參數
 * 用於前端直接上傳（client-side upload）
 *
 * @returns {Object} { signature, expire, token }
 */
export function getImageKitAuthParams() {
  return imagekit.getAuthenticationParameters()
}

export default imagekit
