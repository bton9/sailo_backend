/**
 * Blog SQL 查詢輔助函式
 *
 * 本檔案包含所有 Blog 相關的 SQL 查詢字串
 * - getCommentsQuery: 取得留言列表
 * - getPostsQuery: 取得文章列表（含行程、標籤、圖片）
 * - getUserInteractionFields: 使用者互動狀態（文章）
 * - getCommentInteractionFields: 使用者互動狀態（留言）
 */

/**
 * 取得留言列表的 SQL (含 JOIN users)
 */
export const getCommentsQuery = (currentUserId = null) => {
  const interactionFields = currentUserId
    ? `
      EXISTS(SELECT 1 FROM comment_likes WHERE comment_id = c.comment_id AND user_id = ${currentUserId}) AS is_liked`
    : `
      0 AS is_liked`

  return `
    SELECT 
      c.comment_id,
      c.content,
      c.created_at,
      c.updated_at,
      c.user_id,
      
      u.name AS author_name,
      u.nickname AS author_nickname,
      u.avatar AS author_avatar,
      
      (SELECT COUNT(*) FROM comment_likes WHERE comment_id = c.comment_id) AS like_count,
      
      ${interactionFields.trim()}

    FROM comments c
    INNER JOIN users u ON c.user_id = u.id
  `
}

/**
 * 取得文章列表的 SQL (含完整行程資訊)
 */
export const getPostsQuery = (currentUserId = null) => {
  const interactionFields = currentUserId
    ? `
      EXISTS(SELECT 1 FROM post_likes WHERE post_id = p.post_id AND user_id = ${currentUserId}) AS is_liked,
      EXISTS(SELECT 1 FROM bookmarks WHERE post_id = p.post_id AND user_id = ${currentUserId}) AS is_bookmarked,
      EXISTS(SELECT 1 FROM follows WHERE follower_id = ${currentUserId} AND following_id = p.user_id) AS is_following_author`
    : `
      0 AS is_liked,
      0 AS is_bookmarked,
      0 AS is_following_author`

  return `
    SELECT 
      -- 文章基本資訊
      p.post_id,
      p.title,
      p.content,
      p.category,
      p.trip_id,
      p.place_id,
      p.visible,
      p.view_count,
      p.created_at,
      p.updated_at,
      
      -- 作者資訊
      u.id AS author_id,
      u.name AS author_name,
      u.nickname AS author_nickname,
      u.avatar AS author_avatar,
      
      -- 行程基本資訊
      t.trip_name,
      t.start_date,
      t.end_date,
      t.cover_image_url,
      t.summary_text,
      DATEDIFF(t.end_date, t.start_date) + 1 AS trip_days,
      DATEDIFF(t.end_date, t.start_date) AS trip_nights,

      --  新增：景點基本資訊
      pl.name AS place_name,
      pl.category AS place_category,
      pl.rating AS place_rating,
      pl.description AS place_description,
      loc.name AS place_location_name,
      (SELECT url FROM media WHERE place_id = pl.place_id AND is_cover = 1 LIMIT 1) AS place_cover_image,
      
      -- 地點列表（從行程項目中取得不重複的城市名稱）
      (SELECT GROUP_CONCAT(DISTINCT l.name ORDER BY l.name SEPARATOR '、')
       FROM trip_items ti
       JOIN trip_days td ON ti.trip_day_id = td.trip_day_id
       JOIN places pl_trip ON ti.place_id = pl_trip.place_id 
       JOIN locations l ON pl_trip.location_id = l.location_id
       WHERE td.trip_id = t.trip_id
      ) AS trip_locations,
      
      -- 統計資料
      (SELECT COUNT(*) FROM post_likes WHERE post_id = p.post_id) AS like_count,
      (SELECT COUNT(*) FROM post_comments WHERE post_id = p.post_id) AS comment_count,
      (SELECT COUNT(*) FROM bookmarks WHERE post_id = p.post_id) AS bookmark_count,
      
      -- 標籤（JSON 格式）
      (SELECT JSON_ARRAYAGG(JSON_OBJECT('tag_id', st.tag_id, 'tagname', st.tagname))
       FROM post_tags pt
       LEFT JOIN sns_tags st ON pt.tag_id = st.tag_id
       WHERE pt.post_id = p.post_id
      ) AS tags,
      
      -- 圖片（JSON 格式）
      (SELECT JSON_ARRAYAGG(JSON_OBJECT('photo_id', pp.photo_id, 'url', pp.url))
       FROM post_photos pp
       WHERE pp.post_id = p.post_id
      ) AS photos,

      ${interactionFields.trim()}
      
    FROM posts p
    INNER JOIN users u ON p.user_id = u.id
    LEFT JOIN trips t ON p.trip_id = t.trip_id

    --  新增：景點 LEFT JOIN
    LEFT JOIN places pl ON p.place_id = pl.place_id
    LEFT JOIN locations loc ON pl.location_id = loc.location_id
  `
}
