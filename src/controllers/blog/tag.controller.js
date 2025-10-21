import db from '../../config/database.js';
import { 
  sendSuccess, 
  sendError,
  sanitizeTagName,
  isValidTagName 
} from '../../utils/blog/helpers.js';

/**
 * 取得所有標籤列表
 * GET /api/blog/tags
 */
export const getAllTags = async (req, res) => {
  try {
    const { limit } = req.query;
    const validLimit = limit ? parseInt(limit) : null;

    let sql = `
      SELECT 
        st.tag_id,
        st.tagname,
        COUNT(pt.post_id) as usage_count
      FROM sns_tags st
      LEFT JOIN post_tags pt ON st.tag_id = pt.tag_id
      GROUP BY st.tag_id, st.tagname
      ORDER BY usage_count DESC, st.tagname ASC
    `;

    if (validLimit && validLimit > 0) {
      sql += ` LIMIT ?`;
      var [tags] = await db.query(sql, [validLimit]);
    } else {
      var [tags] = await db.query(sql);
    }

    return sendSuccess(res, { tags });

  } catch (error) {
    console.error('取得標籤列表失敗:', error);
    return sendError(res, '取得標籤列表失敗', 500);
  }
};

/**
 * 搜尋標籤
 * GET /api/blog/tags/search
 */
export const searchTags = async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.trim().length === 0) {
      return sendError(res, '請輸入搜尋關鍵字', 400);
    }

    const keyword = sanitizeTagName(q);

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

    return sendSuccess(res, { tags });

  } catch (error) {
    console.error('搜尋標籤失敗:', error);
    return sendError(res, '搜尋標籤失敗', 500);
  }
};

/**
 * 取得指定標籤的文章列表
 * GET /api/blog/tags/:tagId/posts
 */
export const getPostsByTag = async (req, res) => {
  try {
    const { tagId } = req.params;
    const { page, limit, sort = 'newest' } = req.query;
    const currentUserId = req.user?.id;

    const { 
      formatPagination, 
      getSortSQL,
      formatPostData 
    } = await import('../../utils/blog/helpers.js');
    const { 
      getPostsQuery, 
      getUserInteractionFields 
    } = await import('../../utils/blog/queries.js');

    const [tags] = await db.query(
      'SELECT tag_id, tagname FROM sns_tags WHERE tag_id = ?',
      [tagId]
    );

    if (tags.length === 0) {
      return sendError(res, '找不到該標籤', 404);
    }

    const { offset, limit: validLimit } = formatPagination(page, limit);

    let sql = getPostsQuery();
    
    if (currentUserId) {
      sql += getUserInteractionFields(currentUserId);
    }

    sql += `
      INNER JOIN post_tags pt ON p.post_id = pt.post_id
      WHERE pt.tag_id = ? AND p.visible = TRUE
      ORDER BY ${getSortSQL(sort)}
      LIMIT ? OFFSET ?
    `;

    const [posts] = await db.query(sql, [tagId, validLimit, offset]);
    const formattedPosts = posts.map(post => formatPostData(post, currentUserId));

    const [[{ total }]] = await db.query(`
      SELECT COUNT(*) as total 
      FROM post_tags pt
      INNER JOIN posts p ON pt.post_id = p.post_id
      WHERE pt.tag_id = ? AND p.visible = TRUE
    `, [tagId]);

    return sendSuccess(res, {
      tag: tags[0],
      posts: formattedPosts,
      pagination: {
        total,
        page: parseInt(page) || 1,
        limit: validLimit,
        totalPages: Math.ceil(total / validLimit)
      }
    });

  } catch (error) {
    console.error('取得標籤文章失敗:', error);
    return sendError(res, '取得標籤文章失敗', 500);
  }
};

/**
 * 新增標籤到文章
 * POST /api/blog/posts/:postId/tags
 */
export const addTagsToPost = async (req, res) => {
  const connection = await db.getConnection();
  
  try {
    const { postId } = req.params;
    const { tags } = req.body;
    const userId = req.user.id;

    if (!Array.isArray(tags) || tags.length === 0) {
      return sendError(res, '請提供標籤陣列', 400);
    }

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
      return sendError(res, '無權限編輯此文章', 403);
    }

    const addedTags = [];

    for (const tagName of tags) {
      const cleanedTagName = sanitizeTagName(tagName);

      if (!isValidTagName(cleanedTagName)) {
        await connection.rollback();
        return sendError(res, `標籤「${tagName}」格式不正確`, 400);
      }

      let [existingTags] = await connection.query(
        'SELECT tag_id FROM sns_tags WHERE tagname = ?',
        [cleanedTagName]
      );

      let tagId;
      if (existingTags.length > 0) {
        tagId = existingTags[0].tag_id;
      } else {
        const [tagResult] = await connection.query(
          'INSERT INTO sns_tags (tagname) VALUES (?)',
          [cleanedTagName]
        );
        tagId = tagResult.insertId;
      }

      const [existingRelations] = await connection.query(
        'SELECT post_tags_id FROM post_tags WHERE post_id = ? AND tag_id = ?',
        [postId, tagId]
      );

      if (existingRelations.length === 0) {
        await connection.query(
          'INSERT INTO post_tags (post_id, tag_id) VALUES (?, ?)',
          [postId, tagId]
        );
        addedTags.push({ tag_id: tagId, tagname: cleanedTagName });
      }
    }

    await connection.commit();

    return sendSuccess(res, { added_tags: addedTags }, '標籤新增成功');

  } catch (error) {
    await connection.rollback();
    console.error('新增標籤失敗:', error);
    return sendError(res, '新增標籤失敗', 500);
  } finally {
    connection.release();
  }
};

/**
 * 從文章移除標籤
 * DELETE /api/blog/posts/:postId/tags/:tagId
 */
export const removeTagFromPost = async (req, res) => {
  try {
    const { postId, tagId } = req.params;
    const userId = req.user.id;

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

    const [result] = await db.query(
      'DELETE FROM post_tags WHERE post_id = ? AND tag_id = ?',
      [postId, tagId]
    );

    if (result.affectedRows === 0) {
      return sendError(res, '該文章沒有此標籤', 404);
    }

    return sendSuccess(res, null, '標籤移除成功');

  } catch (error) {
    console.error('移除標籤失敗:', error);
    return sendError(res, '移除標籤失敗', 500);
  }
};