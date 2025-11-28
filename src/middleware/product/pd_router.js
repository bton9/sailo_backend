// ============================================
//  src/middleware/pd_routes.js
// ============================================
import productsRoutes from '../../routes/product/productsRoutes.js'
import staticRouter from '../../routes/product/staticRoutes.js'
import productReviewsRouter from '../../routes/product/productReviewsRouter.js'
import ProductFavRouter from '../../routes/product/productFavRouter.js'

/**
 * 統一路由中間件
 * 集中管理所有應用路由
 */
const setupProductRoutes = (app) => {
  // ==================== API 路由 ====================
  app.use('/api/products', productsRoutes)

  app.use('/api', productReviewsRouter)

  app.use('/api', ProductFavRouter)

  // ==================== 靜態資源路由 ====================
  app.use(staticRouter)

  console.log(' Routes initialized successfully')
  console.log(' Routes initialized successfully')
  console.log('   - Products API: /api/products/*')
  console.log('   - Reviews API: /api/products/:id/reviews/*')
  console.log('   - Reviews API: /api/reviews/*')
}

export default setupProductRoutes
