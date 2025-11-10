import { cartQueries, productQueries } from '../../utils/cart/queries.js'
import { calculateCartTotal, calculateShipping } from '../../utils/cart/helpers.js'
import cartConfig from '../../config/cart.config.js'

/**
 * 取得用戶購物車
 */
export const getCart = async (req, res) => {
  try {
    // 支援兩種方式: URL 參數或從 JWT 取得
    const userId =
      req.params.userId || req.query.userId || req.userId || req.user?.userId

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: '缺少用戶ID',
      })
    }

    // 直接取得購物車商品 (含即時價格)
    const items = await cartQueries.getCartItems(userId)

    // 計算金額
    const subtotal = calculateCartTotal(items)
    const shipping = calculateShipping('standard', subtotal)
    const total = subtotal + shipping

    res.json({
      success: true,
      items: items.map((item) => ({
        id: item.id,
        productId: item.product_id,
        name: item.product_name,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unit_price, // 即時價格
        imageUrl: item.image_url,
        stockQuantity: item.stock_quantity,
        subtotal: item.unit_price * item.quantity,
        addedAt: item.created_at,
      })),
      summary: {
        subtotal,
        shipping,
        total,
        itemCount: items.length,
        totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
      },
    })
  } catch (error) {
    console.error('Get cart error:', error)
    res.status(500).json({
      success: false,
      message: '取得購物車失敗',
      error: error.message,
    })
  }
}

/**
 * 加入商品到購物車
 */
export const addToCart = async (req, res) => {
  try {
    const userId = req.userId || req.user?.userId
    const { productId, quantity } = req.body

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: '缺少用戶ID',
      })
    }

    // 檢查商品是否存在
    const product = await productQueries.getProduct(productId)
    if (!product) {
      return res.status(404).json({
        success: false,
        message: '商品不存在',
      })
    }

    // 檢查商品是否已在購物車
    const existingItem = await cartQueries.getCartItem(userId, productId)

    if (existingItem) {
      // 計算新數量
      const newQuantity = existingItem.quantity + quantity

      // 檢查庫存
      const hasStock = await productQueries.checkStock(productId, newQuantity)
      if (!hasStock) {
        return res.status(400).json({
          success: false,
          message: '超過庫存數量',
          availableStock: product.stock_quantity,
        })
      }

      // 檢查是否超過單項限制
      if (newQuantity > cartConfig.maxQuantityPerItem) {
        return res.status(400).json({
          success: false,
          message: `單項商品數量不能超過 ${cartConfig.maxQuantityPerItem} 件`,
        })
      }

      // 更新數量
      await cartQueries.updateCartItemQuantity(existingItem.id, newQuantity)

      return res.json({
        success: true,
        message: '已更新購物車商品數量',
        data: {
          itemId: existingItem.id,
          productId,
          quantity: newQuantity,
        },
      })
    }

    // 新增商品 - 檢查庫存
    const hasStock = await productQueries.checkStock(productId, quantity)
    if (!hasStock) {
      return res.status(400).json({
        success: false,
        message: '庫存不足',
        availableStock: product.stock_quantity,
      })
    }

    // 檢查購物車商品總數限制
    const itemCount = await cartQueries.getCartItemCount(userId)
    if (itemCount >= cartConfig.maxItemsInCart) {
      return res.status(400).json({
        success: false,
        message: `購物車商品種類不能超過 ${cartConfig.maxItemsInCart} 種`,
      })
    }

    // 新增商品 (使用 ON DUPLICATE KEY UPDATE)
    const result = await cartQueries.addCartItem(userId, productId, quantity)

    res.json({
      success: true,
      message: '成功加入購物車',
      data: {
        itemId: result,
        productId,
        quantity,
        productName: product.product_name,
        unitPrice: product.price,
      },
    })
  } catch (error) {
    console.error('Add to cart error:', error)
    res.status(500).json({
      success: false,
      message: '加入購物車失敗',
      error: error.message,
    })
  }
}

/**
 * 更新購物車商品數量
 */
export const updateCartItem = async (req, res) => {
  try {
    // 支援兩種方式: URL參數或Body參數
    const itemId = req.params.itemId || req.body.cartDetailId || req.body.itemId
    const { quantity } = req.body

    if (!itemId) {
      return res.status(400).json({
        success: false,
        message: '缺少商品ID',
      })
    }

    // 驗證數量
    if (quantity < 1 || quantity > cartConfig.maxQuantityPerItem) {
      return res.status(400).json({
        success: false,
        message: `數量必須在 1-${cartConfig.maxQuantityPerItem} 之間`,
      })
    }

    // 取得購物車項目
    const item = await cartQueries.getCartItemById(itemId)

    if (!item) {
      return res.status(404).json({
        success: false,
        message: '購物車項目不存在',
      })
    }

    // 檢查庫存
    const hasStock = await productQueries.checkStock(item.product_id, quantity)
    if (!hasStock) {
      return res.status(400).json({
        success: false,
        message: '庫存不足',
        availableStock: item.stock_quantity,
      })
    }

    // 更新數量
    await cartQueries.updateCartItemQuantity(itemId, quantity)

    res.json({
      success: true,
      message: '更新成功',
      data: {
        itemId,
        quantity,
      },
    })
  } catch (error) {
    console.error('Update cart item error:', error)
    res.status(500).json({
      success: false,
      message: '更新失敗',
      error: error.message,
    })
  }
}

/**
 * 刪除購物車商品
 */
export const removeCartItem = async (req, res) => {
  try {
    // 支援兩種方式: URL參數或Body參數
    const itemId = req.params.itemId || req.body.cartDetailId || req.body.itemId

    if (!itemId) {
      return res.status(400).json({
        success: false,
        message: '缺少商品ID',
      })
    }

    const affected = await cartQueries.removeCartItem(itemId)

    if (affected === 0) {
      return res.status(404).json({
        success: false,
        message: '購物車項目不存在',
      })
    }

    res.json({
      success: true,
      message: '刪除成功',
    })
  } catch (error) {
    console.error('Remove cart item error:', error)
    res.status(500).json({
      success: false,
      message: '刪除失敗',
      error: error.message,
    })
  }
}

/**
 * 清空購物車
 */
export const clearCart = async (req, res) => {
  try {
    const userId = req.params.userId || req.userId || req.user?.userId

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: '缺少用戶ID',
      })
    }

    const affected = await cartQueries.clearCart(userId)

    res.json({
      success: true,
      message: '購物車已清空',
      itemsRemoved: affected,
    })
  } catch (error) {
    console.error('Clear cart error:', error)
    res.status(500).json({
      success: false,
      message: '清空購物車失敗',
      error: error.message,
    })
  }
}

export default {
  getCart,
  addToCart,
  updateCartItem,
  removeCartItem,
  clearCart,
}