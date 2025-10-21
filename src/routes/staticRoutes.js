import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'

// 解決 ESM 模組中 __dirname 不存在的問題
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 假設此檔案 (staticRoutes.js) 位於 src/middleware/。
// 則專案根目錄在 ../..
// 圖片目錄的路徑是：[專案根目錄]/public/uploads

// [修正路徑] 直接計算 UPLOADS_DIR，確保從 staticRoutes.js 向上兩級後再進入 public/uploads
const UPLOADS_DIR = path.join(__dirname, '..', '..', 'public', 'uploads') 

// 創建一個 Express Router 實例，作為中介軟體匯出
const staticRouter = express.Router()

/**
 * @description 靜態檔案中介軟體
 * 將 /uploads URL 映射到後端專案的 public/uploads 資料夾
 */
staticRouter.use('/uploads', express.static(UPLOADS_DIR))


export default staticRouter
