// controllers/favoriteController.js
import { query } from '../config/database.js'

// 取得使用者所有收藏清單（含景點數量）
export const getUserFavorites = async (req, res) => {
  const userId = req.params.userId
  if (!userId) {
    return res.status(400).json({ success: false, message: '缺少 userId' })
  }

  try {
    // 1️⃣ 取得使用者收藏清單 - 直接接收陣列，不要解構
    const lists = await query(
      `SELECT list_id, name, description, created_at 
       FROM favorite_lists
       WHERE user_id = ?`,
      [userId]
    )
    console.log('✅ lists:', lists)
    console.log('✅ lists type:', Array.isArray(lists))

    if (!lists || lists.length === 0) {
      return res.json({ success: true, favorites: [] })
    }

    // 2️⃣ 取得每個清單的景點數量
    const listIds = lists.map((l) => l.list_id)
    console.log('✅ listIds:', listIds)

    let countMap = {}
    if (listIds.length > 0) {
      const placeholders = listIds.map(() => '?').join(',')
      const countQuery = `SELECT list_id, COUNT(*) as count
                          FROM favorite_list_places
                          WHERE list_id IN (${placeholders})
                          GROUP BY list_id`

      console.log('🔍 執行計數查詢:', countQuery)
      const counts = await query(countQuery, listIds)
      console.log('✅ counts:', counts)

      // 建立 list_id -> count 的對應
      if (counts && Array.isArray(counts)) {
        counts.forEach((row) => {
          countMap[row.list_id] = parseInt(row.count) || 0
        })
      }
    }
    console.log('✅ countMap:', countMap)

    // 3️⃣ 合併每個清單的景點數量
    const favorites = lists.map((list) => {
      return {
        list_id: list.list_id,
        name: list.name,
        description: list.description,
        created_at: list.created_at,
        count: countMap[list.list_id] || 0,
      }
    })

    console.log('✅ 最終結果:', favorites)
    return res.json({ success: true, favorites })
  } catch (err) {
    console.error('❌ getUserFavorites error:', err)
    console.error('❌ Error stack:', err.stack)
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined,
    })
  }
}

// 取得某個清單的所有景點（含圖片）
export const getListPlaces = async (req, res) => {
  const listId = req.params.listId
  if (!listId) {
    return res.status(400).json({ success: false, message: '缺少 listId' })
  }

  try {
    // 取得景點基本資料 - 直接接收陣列
    const places = await query(
      `SELECT p.* 
       FROM favorite_list_places flp
       JOIN places p ON flp.place_id = p.place_id
       WHERE flp.list_id = ?`,
      [listId]
    )
    console.log('✅ places:', places)

    if (!places || places.length === 0) {
      return res.json({ success: true, places: [] })
    }

    // 取得每個景點的封面圖片
    const placeIds = places.map((p) => p.place_id)
    const placeholders = placeIds.map(() => '?').join(',')

    const media = await query(
      `SELECT place_id, url 
       FROM media
       WHERE place_id IN (${placeholders}) AND is_cover = 1`,
      placeIds
    )
    console.log('✅ media:', media)

    // 建立 place_id -> cover_image 的對應
    const mediaMap = {}
    if (media && Array.isArray(media)) {
      media.forEach((m) => {
        mediaMap[m.place_id] = m.url
      })
    }

    // 合併圖片資訊
    const placesWithMedia = places.map((place) => ({
      ...place,
      cover_image: mediaMap[place.place_id] || null,
    }))

    return res.json({ success: true, places: placesWithMedia })
  } catch (err) {
    console.error('❌ getListPlaces error:', err)
    console.error('❌ Error stack:', err.stack)
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined,
    })
  }
}

// 切換收藏（收藏/取消收藏）
export const toggleFavorite = async (req, res) => {
  const { listId, placeId } = req.body
  if (!listId || !placeId) {
    return res.status(400).json({
      success: false,
      message: '缺少 listId 或 placeId',
    })
  }

  try {
    // 檢查是否已收藏 - 直接接收陣列
    const exists = await query(
      `SELECT list_places_id FROM favorite_list_places 
       WHERE list_id = ? AND place_id = ?`,
      [listId, placeId]
    )
    console.log('✅ exists:', exists)
    if (exists && exists.length > 0) {
      // 移除收藏
      await query(
        `DELETE FROM favorite_list_places 
         WHERE list_id = ? AND place_id = ?`,
        [listId, placeId]
      )
      return res.json({ success: true, action: 'removed' })
    } else {
      // 新增收藏
      await query(
        `INSERT INTO favorite_list_places (list_id, place_id) 
         VALUES (?, ?)`,
        [listId, placeId]
      )
      return res.json({ success: true, action: 'added' })
    }
  } catch (err) {
    console.error('❌ toggleFavorite error:', err)
    console.error('❌ Error stack:', err.stack)
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined,
    })
  }
}

// 新增收藏清單
export const createList = async (req, res) => {
  const { userId, name, description } = req.body
  if (!userId || !name) {
    return res.status(400).json({
      success: false,
      message: '缺少 userId 或 name',
    })
  }

  try {
    const result = await query(
      `INSERT INTO favorite_lists (user_id, name, description) 
       VALUES (?, ?, ?)`,
      [userId, name, description || null]
    )
    console.log('✅ createList result:', result)

    return res.json({
      success: true,
      list_id: result.insertId,
      name,
      description: description || null,
    })
  } catch (err) {
    console.error('❌ createList error:', err)
    console.error('❌ Error stack:', err.stack)
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined,
    })
  }
}
// 🗑️ 刪除收藏清單（僅限該使用者）
export const deleteList = async (req, res) => {
  const { userId, listId } = req.params

  if (!userId || !listId) {
    return res.status(400).json({
      success: false,
      message: '❌ 缺少 userId 或 listId',
    })
  }

  try {
    // 檢查清單是否存在且屬於該使用者
    const [list] = await query(
      'SELECT * FROM favorite_lists WHERE list_id = ? AND user_id = ?',
      [listId, userId]
    )

    if (!list) {
      return res.status(404).json({
        success: false,
        message: '❌ 找不到該使用者的收藏清單',
      })
    }

    // 刪除清單中的所有景點
    await query('DELETE FROM favorite_list_places WHERE list_id = ?', [listId])

    // 刪除清單本身
    await query('DELETE FROM favorite_lists WHERE list_id = ?', [listId])

    return res.json({
      success: true,
      message: `✅ 使用者 ${userId} 的收藏清單（ID: ${listId}）刪除成功`,
    })
  } catch (err) {
    console.error('❌ deleteList error:', err)
    return res.status(500).json({
      success: false,
      message: '伺服器錯誤，無法刪除收藏清單',
      error: err.message,
    })
  }
}
