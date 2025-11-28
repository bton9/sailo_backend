import ImageKit from 'imagekit'
import dotenv from 'dotenv'

dotenv.config()

// ImageKit 實例 - 用於行程封面圖上傳
const imagekitTrip = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
})

// 驗證 ImageKit 設定
export const validateImageKitTripConfig = () => {
  const requiredVars = [
    'IMAGEKIT_PUBLIC_KEY',
    'IMAGEKIT_PRIVATE_KEY',
    'IMAGEKIT_URL_ENDPOINT',
  ]

  const missing = requiredVars.filter((varName) => !process.env[varName])

  if (missing.length > 0) {
    console.warn(`⚠️  缺少 ImageKit 環境變數: ${missing.join(', ')}`)
    console.warn('   行程封面圖上傳功能將無法使用')
    return false
  }

  console.log(' ImageKit (行程封面) 設定完成')
  return true
}

export default imagekitTrip
