import mysql from 'mysql2/promise'
import dotenv from 'dotenv'

dotenv.config()

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'PasswOrs!',
  database: process.env.DB_NAME || 'sailo_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
})

export async function query(sql, params = []) {
  try {
    // 如果沒有參數，直接使用 query
    if (params.length === 0) {
      const [results] = await pool.query(sql)
      return results
    }
    // 有參數時使用 execute (prepared statement)
    const [results] = await pool.execute(sql, params)
    return results
  } catch (error) {
    console.error(' Database query error:', error)
    throw error
  }
}

export default pool
