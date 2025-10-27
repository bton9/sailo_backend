// ============================================
// 📁 src/middleware/pd_routes.js
// ============================================
import productsRoutes from '../routes/productsRoutes.js'
import staticRouter from '../routes/staticRoutes.js'

/**
 * 統一路由中間件
 * 集中管理所有應用路由
 */
const setupProductRoutes = (app) => {
  // ==================== API 路由 ====================
  app.use('/api/products', productsRoutes)
  
  // 未來可以在這裡添加其他 API 路由
  // app.use('/api/users', usersRoutes)
  // app.use('/api/orders', ordersRoutes)
  
  // ==================== 靜態資源路由 ====================
  app.use(staticRouter)
  
  console.log('✅ Routes initialized successfully')
}

export default setupProductRoutes