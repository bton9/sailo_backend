import db from '../../config/database.js';
import { 
  formatPagination,
  formatPostData,
  sendSuccess, 
  sendError 
} from '../../utils/blog/helpers.js';
import { 
  getPostsQuery
} from '../../utils/blog/queries.js';
import blogConfig from '../../config/blog.config.js';

/**
 * 全站搜尋
 * GET /api/blog/search
 */
export const search = async (req, res) => {
  try {
    const { q, type = 'all', page, limit } = req.query;

    if (!q || q.trim().length < blogConfig.search.minKeywordLength) {
      return sendError(
        res, 
        `搜尋關鍵字至少 ${blogConfig.search.minKeywordLength} 個字元`, 
        400
      );
    }

    const keyword = q.trim();
    const currentUserId = req.user?.id;

    let results = {};

    switch (type) {
      case 'posts':
        results.posts = await searchPosts(keyword, page, limit, currentUserId);
        break;
      case 'users':
        results.users = await searchUsers(keyword, page, limit, currentUserId);
        break;
      case 'tags':
        results.tags = await searchTagsOnly(keyword);
        break;
      case 'all':
      default:
        results.posts = await searchPosts(keyword, 1, 5, currentUserId);
        results.users = await searchUsers(keyword, 1, 5, currentUserId);
        results.tags = await searchTagsOnly(keyword);
        break;
    }

    return sendSuccess(res, results);

  } catch (error) {
    console.error('搜尋失敗:', error);
    return sendError(res, '搜尋失敗', 500);
  }
};

/**
 * 搜尋文章
 */
const searchPosts = async (keyword, page = 1, limit = 10, currentUserId = null) => {
  const { offset, limit: validLimit } = formatPagination(page, limit);

  let sql = getPostsQuery(currentUserId);

  sql += `
    WHERE p.visible = TRUE 
    AND (
      p.title LIKE ? 
      OR p.content LIKE ?
      OR u.name LIKE ?
      OR u.nickname LIKE ?
    )
    ORDER BY p.created_at DESC
    LIMIT ? OFFSET ?
  `;

  const searchPattern = `%${keyword}%`;
  const [posts] = await db.query(sql, [
    searchPattern,
    searchPattern,
    searchPattern,
    searchPattern,
    validLimit,
    offset
  ]);

  const [[{ total }]] = await db.query(`
    SELECT COUNT(*) as total
    FROM posts p
    INNER JOIN users u ON p.user_id = u.id
    WHERE p.visible = TRUE 
    AND (
      p.title LIKE ? 
      OR p.content LIKE ?
      OR u.name LIKE ?
      OR u.nickname LIKE ?
    )
  `, [searchPattern, searchPattern, searchPattern, searchPattern]);

  return {
    data: posts.map(post => formatPostData(post, currentUserId)),
    pagination: {
      total,
      page: parseInt(page),
      limit: validLimit,
      totalPages: Math.ceil(total / validLimit)
    }
  };
};

/**
 * 搜尋使用者
 */
const searchUsers = async (keyword, page = 1, limit = 10, currentUserId = null) => {
  const { offset, limit: validLimit } = formatPagination(page, limit);

  let sql = `
    SELECT 
      u.id,
      u.name,
      u.nickname,
      u.avatar,
      (SELECT COUNT(*) FROM posts WHERE user_id = u.id AND visible = TRUE) as post_count,
      (SELECT COUNT(*) FROM follows WHERE following_id = u.id) as follower_count
  `;

  if (currentUserId) {
    sql += `,
      EXISTS(
        SELECT 1 FROM follows 
        WHERE follower_id = ? AND following_id = u.id
      ) AS is_following
    `;
  }

  sql += `
    FROM users u
    WHERE u.is_active = TRUE
    AND (
      u.name LIKE ?
      OR u.nickname LIKE ?
      OR u.email LIKE ?
    )
    ORDER BY follower_count DESC, u.name ASC
    LIMIT ? OFFSET ?
  `;

  const searchPattern = `%${keyword}%`;
  const params = currentUserId
    ? [currentUserId, searchPattern, searchPattern, searchPattern, validLimit, offset]
    : [searchPattern, searchPattern, searchPattern, validLimit, offset];

  const [users] = await db.query(sql, params);

  const [[{ total }]] = await db.query(`
    SELECT COUNT(*) as total
    FROM users
    WHERE is_active = TRUE
    AND (
      name LIKE ?
      OR nickname LIKE ?
      OR email LIKE ?
    )
  `, [searchPattern, searchPattern, searchPattern]);

  return {
    data: users.map(user => ({
      id: user.id,
      name: user.name,
      nickname: user.nickname,
      avatar: user.avatar,
      stats: {
        posts: user.post_count,
        followers: user.follower_count
      },
      is_following: currentUserId ? user.is_following === 1 : null
    })),
    pagination: {
      total,
      page: parseInt(page),
      limit: validLimit,
      totalPages: Math.ceil(total / validLimit)
    }
  };
};

/**
 * 搜尋標籤
 */
const searchTagsOnly = async (keyword) => {
  const [tags] = await db.query(`
    SELECT 
      st.tag_id,
      st.tagname,
      COUNT(pt.post_id) as usage_count
    FROM sns_tags st
    LEFT JOIN post_tags pt ON st.tag_id = pt.tag_id
    WHERE st.tagname LIKE ?
    GROUP BY st.tag_id, st.tagname
    ORDER BY usage_count DESC, st.tagname ASC
    LIMIT 10
  `, [`%${keyword}%`]);

  return { data: tags };
};

/**
 * 取得熱門搜尋關鍵字
 * GET /api/blog/search/trending
 */
export const getTrendingKeywords = async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const [tags] = await db.query(`
      SELECT 
        st.tagname as keyword,
        COUNT(pt.post_id) as count
      FROM sns_tags st
      INNER JOIN post_tags pt ON st.tag_id = pt.tag_id
      GROUP BY st.tag_id, st.tagname
      ORDER BY count DESC
      LIMIT ?
    `, [parseInt(limit)]);

    return sendSuccess(res, { keywords: tags });

  } catch (error) {
    console.error('取得熱門關鍵字失敗:', error);
    return sendError(res, '取得熱門關鍵字失敗', 500);
  }
};