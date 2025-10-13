import express from 'express'
import {
  login,
  register,
  logout,
  verify,
} from '../controllers/authController.js'

const router = express.Router()

// POST /api/auth/login
router.post('/login', login)

// POST /api/auth/register
router.post('/register', register)

// POST /api/auth/logout
router.post('/logout', logout)

// POST /api/auth/verify
router.post('/verify', verify)

export default router
