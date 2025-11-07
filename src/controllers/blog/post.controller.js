import db from '../../config/database.js';
import { 
  formatPagination, 
  formatPostData, 
  getSortSQL,
  sendSuccess, 
  sendError,
  isValidCategory 
} from '../../utils/blog/helpers.js';
import { 
  getPostsQuery 
} from '../../utils/blog/queries.js';

/**
 * 取得文章列表
 * GET /api/blog/posts
 */
export const getPosts = async (req, res) => {
  try {
    const { page, limit, sort = 'newest', category, tags, following } = req.query;
    const currentUserId = req.user?.id;

    const { offset, limit: validLimit } = formatPagination(page, limit);

    let sql = getPostsQuery(currentUserId);

    const conditions = ['p.visible = TRUE'];
    const params = [];

    if (category && category !== 'all' && isValidCategory(category)) {
      conditions.push('p.category = ?');
      params.push(category);
    }

    if (tags) {
      const tagArray = Array.isArray(tags) ? tags : [tags];
      conditions.push(`
        p.post_id IN (
          SELECT pt.post_id 
          FROM post_tags pt
          INNER JOIN sns_tags st ON pt.tag_id = st.tag_id
          WHERE st.tagname IN (${tagArray.map(() => '?').join(',')})
        )
      `);
      params.push(...tagArray);
    }

    if (following === 'true' && currentUserId) {
      conditions.push(`
        p.user_id IN (
          SELECT following_id 
          FROM follows 
          WHERE follower_id = ?
        )
      `);
      params.push(currentUserId);
    }

    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    sql += ` ORDER BY ${getSortSQL(sort)}`;
    sql += ` LIMIT ? OFFSET ?`;
    params.push(validLimit, offset);

    const [posts] = await db.query(sql, params);
    const formattedPosts = posts.map(post => formatPostData(post, currentUserId));

    let countSql = 'SELECT COUNT(*) as total FROM posts p WHERE p.visible = TRUE';
    const countParams = [];

    if (category && category !== 'all' && isValidCategory(category)) {
      countSql += ' AND p.category = ?';
      countParams.push(category);
    }

    if (tags) {
      const tagArray = Array.isArray(tags) ? tags : [tags];
      countSql += ` AND p.post_id IN (
        SELECT pt.post_id 
        FROM post_tags pt
        INNER JOIN sns_tags st ON pt.tag_id = st.tag_id
        WHERE st.tagname IN (${tagArray.map(() => '?').join(',')})
      )`;
      countParams.push(...tagArray);
    }

    if (following === 'true' && currentUserId) {
      countSql += ` AND p.user_id IN (
        SELECT following_id 
        FROM follows 
        WHERE follower_id = ?
      )`;
      countParams.push(currentUserId);
    }

    const [[{ total }]] = await db.query(countSql, countParams);

    return sendSuccess(res, {
      posts: formattedPosts,
      pagination: {
        total,
        page: parseInt(page) || 1,
        limit: validLimit,
        totalPages: Math.ceil(total / validLimit)
      }
    });

  } catch (error) {
    console.error('取得文章列表失敗:', error);
    return sendError(res, '取得文章列表失敗', 500);
  }
};

/**
 * 取得單一文章
 * GET /api/blog/posts/:postId
 */
export const getPostById = async (req, res) => {
  try {
    const { postId } = req.params;
    const { increment_view } = req.query;
    const currentUserId = req.user?.id;

    let sql = getPostsQuery(currentUserId);

    sql += ' WHERE p.post_id = ? AND p.visible = TRUE';

    const [posts] = await db.query(sql, [postId]);

    if (posts.length === 0) {
      return sendError(res, '找不到該文章', 404);
    }

    // ✅ 修改：只在 increment_view=true 時才增加瀏覽次數
    if (increment_view === 'true') {
      await db.query(
        'UPDATE posts SET view_count = view_count + 1 WHERE post_id = ?',
        [postId]
      );
    }

    const [tags] = await db.query(`
      SELECT st.tag_id, st.tagname
      FROM post_tags pt
      INNER JOIN sns_tags st ON pt.tag_id = st.tag_id
      WHERE pt.post_id = ?
    `, [postId]);

    const [photos] = await db.query(`
      SELECT photo_id, url
      FROM post_photos
      WHERE post_id = ?
      ORDER BY created_at ASC
    `, [postId]);

    const post = posts[0];
    post.tags = tags;
    post.photos = photos.map(photo => photo.url);

    const formattedPost = formatPostData(post, currentUserId);

    return sendSuccess(res, { post: formattedPost });

  } catch (error) {
    console.error('取得文章失敗:', error);
    return sendError(res, '取得文章失敗', 500);
  }
};

/**
 * 建立文章
 * POST /api/blog/posts
 */
export const createPost = async (req, res) => {
  const connection = await db.getConnection();
  
  try {
    const { title, content, category, trip_id, place_id, tags = [] } = req.body;
    const userId = req.user.id;


    // ✅ 新增：防呆檢查
    if (trip_id && place_id) {
      await connection.rollback();
      return sendError(res, '文章只能關聯行程或景點其中一個', 400);
    }

    await connection.beginTransaction();

    const [result] = await connection.query(`
      INSERT INTO posts (user_id, title, content, category, trip_id, place_id, visible)
      VALUES (?, ?, ?, ?, ?, ?, TRUE)
    `, [userId, title, content, category, trip_id || null, place_id || null]);

    const postId = result.insertId;

    if (tags && tags.length > 0) {
      for (const tagName of tags) {
        const [existingTags] = await connection.query(
          'SELECT tag_id FROM sns_tags WHERE tagname = ?',
          [tagName]
        );

        let tagId;
        if (existingTags.length > 0) {
          tagId = existingTags[0].tag_id;
        } else {
          const [tagResult] = await connection.query(
            'INSERT INTO sns_tags (tagname) VALUES (?)',
            [tagName]
          );
          tagId = tagResult.insertId;
        }

        await connection.query(
          'INSERT INTO post_tags (post_id, tag_id) VALUES (?, ?)',
          [postId, tagId]
        );
      }
    }

    await connection.commit();

    return sendSuccess(res, { post_id: postId }, '文章建立成功', 201);

  } catch (error) {
    await connection.rollback();
    console.error('建立文章失敗:', error);
    return sendError(res, '建立文章失敗', 500);
  } finally {
    connection.release();
  }
};

/**
 * 更新文章
 * PUT /api/blog/posts/:postId
 */
export const updatePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.id;
    const { title, content, category, trip_id, place_id, visible } = req.body;


    // ✅ 新增：防呆檢查
    if (trip_id && place_id) {
      return sendError(res, '文章只能關聯行程或景點其中一個', 400);
    }

    const [posts] = await db.query(
      'SELECT user_id FROM posts WHERE post_id = ?',
      [postId]
    );

    if (posts.length === 0) {
      return sendError(res, '找不到該文章', 404);
    }

    if (posts[0].user_id !== userId) {
      return sendError(res, '無權限編輯此文章', 403);
    }

    const updates = [];
    const params = [];

    if (title !== undefined) {
      updates.push('title = ?');
      params.push(title);
    }
    if (content !== undefined) {
      updates.push('content = ?');
      params.push(content);
    }
    if (category !== undefined) {
      updates.push('category = ?');
      params.push(category);
    }
    if (trip_id !== undefined) {
      updates.push('trip_id = ?');
      params.push(trip_id || null);
    }
     // ✅ 新增：place_id 更新
    if (place_id !== undefined) {
      updates.push('place_id = ?');
      params.push(place_id || null);
    }
    if (visible !== undefined) {
      updates.push('visible = ?');
      params.push(visible);
    }

    if (updates.length === 0) {
      return sendError(res, '沒有要更新的欄位', 400);
    }

    params.push(postId);

    await db.query(
      `UPDATE posts SET ${updates.join(', ')} WHERE post_id = ?`,
      params
    );

    return sendSuccess(res, null, '文章更新成功');

  } catch (error) {
    console.error('更新文章失敗:', error);
    return sendError(res, '更新文章失敗', 500);
  }
};

/**
 * 刪除文章
 * DELETE /api/blog/posts/:postId
 */
export const deletePost = async (req, res) => {
  const connection = await db.getConnection();
  
  try {
    const { postId } = req.params;
    const userId = req.user.id;

    await connection.beginTransaction();

    const [posts] = await connection.query(
      'SELECT user_id FROM posts WHERE post_id = ?',
      [postId]
    );

    if (posts.length === 0) {
      await connection.rollback();
      return sendError(res, '找不到該文章', 404);
    }

    if (posts[0].user_id !== userId) {
      await connection.rollback();
      return sendError(res, '無權限刪除此文章', 403);
    }

    await connection.query('DELETE FROM posts WHERE post_id = ?', [postId]);

    await connection.commit();

    return sendSuccess(res, null, '文章刪除成功');

  } catch (error) {
    await connection.rollback();
    console.error('刪除文章失敗:', error);
    return sendError(res, '刪除文章失敗', 500);
  } finally {
    connection.release();
  }
};

/**
 * 取得使用者的文章列表
 * GET /api/blog/users/:userId/posts
 */
export const getUserPosts = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page, limit, sort = 'newest', category } = req.query;
    const currentUserId = req.user?.id;

    const { offset, limit: validLimit } = formatPagination(page, limit);

    let sql = getPostsQuery(currentUserId);

    const conditions = ['p.user_id = ?', 'p.visible = TRUE'];
    const params = [userId];

    if (category && category !== 'all' && isValidCategory(category)) {
      conditions.push('p.category = ?');
      params.push(category);
    }

    sql += ` WHERE ${conditions.join(' AND ')}`;
    sql += ` ORDER BY ${getSortSQL(sort)}`;
    sql += ` LIMIT ? OFFSET ?`;
    params.push(validLimit, offset);

    const [posts] = await db.query(sql, params);
    const formattedPosts = posts.map(post => formatPostData(post, currentUserId));

    let countSql = 'SELECT COUNT(*) as total FROM posts WHERE user_id = ? AND visible = TRUE';
    const countParams = [userId];

    if (category && category !== 'all' && isValidCategory(category)) {
      countSql += ' AND category = ?';
      countParams.push(category);
    }

    const [[{ total }]] = await db.query(countSql, countParams);

    return sendSuccess(res, {
      posts: formattedPosts,
      pagination: {
        total,
        page: parseInt(page) || 1,
        limit: validLimit,
        totalPages: Math.ceil(total / validLimit)
      }
    });

  } catch (error) {
    console.error('取得使用者文章失敗:', error);
    return sendError(res, '取得使用者文章失敗', 500);
  }
};

/**
 * 取得使用者按讚的文章列表
 * GET /api/blog/users/:userId/liked
 */
export const getUserLikedPosts = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page, limit, sort = 'newest' } = req.query;
    const currentUserId = req.user?.id;

    const { offset, limit: validLimit } = formatPagination(page, limit);

    let sql = getPostsQuery(currentUserId);

    sql += `
      INNER JOIN post_likes plk ON p.post_id = plk.post_id
      WHERE plk.user_id = ? AND p.visible = TRUE
      ORDER BY pl.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const [posts] = await db.query(sql, [userId, validLimit, offset]);
    const formattedPosts = posts.map(post => formatPostData(post, currentUserId));

    const [[{ total }]] = await db.query(`
      SELECT COUNT(*) as total 
      FROM post_likes plk
      INNER JOIN posts p ON plk.post_id = p.post_id
      WHERE plk.user_id = ? AND p.visible = TRUE
    `, [userId]);

    return sendSuccess(res, {
      posts: formattedPosts,
      pagination: {
        total,
        page: parseInt(page) || 1,
        limit: validLimit,
        totalPages: Math.ceil(total / validLimit)
      }
    });

  } catch (error) {
    console.error('取得按讚文章失敗:', error);
    return sendError(res, '取得按讚文章失敗', 500);
  }
};