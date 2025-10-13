import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import authRoutes from './src/routes/authRoutes.js'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 5000

// ============ Middleware ============
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  })
)
app.use(express.json())

// ============ Routes ============
app.use('/api/auth', authRoutes)

// ============ Health Check ============
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Backend server is running' })
})

// ============ Error Handling ============
app.use((err, req, res, next) => {
  console.error('Error:', err)
  res.status(500).json({
    success: false,
    message: 'Internal server error',
  })
})

// ============ Start Server ============
app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`)
})
