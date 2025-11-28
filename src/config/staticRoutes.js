// staticRoutes.js
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const uploadsPath = path.join(__dirname, '../../public/uploads')

export function setupStaticRoutes(app) {
  // 圖片靜態服務
  app.get('/uploads/:filename', (req, res) => {
    const filename = req.params.filename
    const filepath = path.join(uploadsPath, filename)

    fs.readFile(filepath, (err, data) => {
      if (err) {
        console.error(` Error reading file ${filename}:`, err)
        return res.status(500).json({ error: 'Error reading file' })
      }

      res.setHeader(
        'Access-Control-Allow-Origin',
        process.env.FRONTEND_URL || 'http://localhost:3000'
      )
      res.setHeader('Access-Control-Allow-Credentials', 'true')
      console.log(`✅ Serving image: ${filename}`)
      res.send(data)
    })
  })

  // OPTIONS 預檢請求
  app.options('/uploads/:filename', (req, res) => {
    res.setHeader(
      'Access-Control-Allow-Origin',
      process.env.FRONTEND_URL || 'http://localhost:3000'
    )
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    res.setHeader('Access-Control-Allow-Credentials', 'true')
    res.sendStatus(204)
  })
}
