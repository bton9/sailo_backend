import db from '../../config/database.js';
import { 
  formatPagination,
  formatCommentData,
  sendSuccess, 
  sendError 
} from '../../utils/blog/helpers.js';
import { 
  getCommentsQuery 
} from '../../utils/blog/queries.js';

/**
 * 取得文章的留言列表
 * GET /api/blog/posts/:postId/comments
 */
export const getCommentsByPostId = async (req, res) => {
  try {
    const { postId } = req.params;
    const { page, limit } = req.query;
    const currentUserId = req.user?.id;

    const [posts] = await db.query(
      'SELECT post_id FROM posts WHERE post_id = ? AND visible = TRUE',
      [postId]
    );

    if (posts.length === 0) {
      return sendError(res, '找不到該文章', 404);
    }

    const { offset, limit: validLimit } = formatPagination(page, limit);

    let sql = getCommentsQuery(currentUserId);

    sql += `
      INNER JOIN post_comments pc ON c.comment_id = pc.comment_id
      WHERE pc.post_id = ?
      ORDER BY c.created_at ASC
      LIMIT ? OFFSET ?
    `;

    const [comments] = await db.query(sql, [postId, validLimit, offset]);

    const formattedComments = comments.map(comment => 
      formatCommentData(comment, currentUserId)
    );

    const [[{ total }]] = await db.query(`
      SELECT COUNT(*) as total 
      FROM post_comments 
      WHERE post_id = ?
    `, [postId]);

    return sendSuccess(res, {
      comments: formattedComments,
      pagination: {
        total,
        page: parseInt(page) || 1,
        limit: validLimit,
        totalPages: Math.ceil(total / validLimit)
      }
    });

  } catch (error) {
    console.error('取得留言列表失敗:', error);
    return sendError(res, '取得留言列表失敗', 500);
  }
};

/**
 * 新增留言
 * POST /api/blog/posts/:postId/comments
 */
export const createComment = async (req, res) => {
  const connection = await db.getConnection();
  
  try {
    const { postId } = req.params;
    const { content } = req.body;
    const userId = req.user.id;

    await connection.beginTransaction();

    const [posts] = await connection.query(
      'SELECT post_id FROM posts WHERE post_id = ? AND visible = TRUE',
      [postId]
    );

    if (posts.length === 0) {
      await connection.rollback();
      return sendError(res, '找不到該文章', 404);
    }

    const [commentResult] = await connection.query(
      'INSERT INTO comments (user_id, content) VALUES (?, ?)',
      [userId, content]
    );

    const commentId = commentResult.insertId;

    await connection.query(
      'INSERT INTO post_comments (post_id, comment_id) VALUES (?, ?)',
      [postId, commentId]
    );

    await connection.commit();

    return sendSuccess(res, { comment_id: commentId }, '留言建立成功', 201);

  } catch (error) {
    await connection.rollback();
    console.error('建立留言失敗:', error);
    return sendError(res, '建立留言失敗', 500);
  } finally {
    connection.release();
  }
};

/**
 * 更新留言
 * PUT /api/blog/comments/:commentId
 */
export const updateComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const { content } = req.body;
    const userId = req.user.id;

    const [comments] = await db.query(
      'SELECT user_id FROM comments WHERE comment_id = ?',
      [commentId]
    );

    if (comments.length === 0) {
      return sendError(res, '找不到該留言', 404);
    }

    if (comments[0].user_id !== userId) {
      return sendError(res, '無權限編輯此留言', 403);
    }

    await db.query(
      'UPDATE comments SET content = ? WHERE comment_id = ?',
      [content, commentId]
    );

    return sendSuccess(res, null, '留言更新成功');

  } catch (error) {
    console.error('更新留言失敗:', error);
    return sendError(res, '更新留言失敗', 500);
  }
};

/**
 * 刪除留言
 * DELETE /api/blog/comments/:commentId
 */
export const deleteComment = async (req, res) => {
  const connection = await db.getConnection();
  
  try {
    const { commentId } = req.params;
    const userId = req.user.id;

    await connection.beginTransaction();

    const [comments] = await connection.query(
      'SELECT user_id FROM comments WHERE comment_id = ?',
      [commentId]
    );

    if (comments.length === 0) {
      await connection.rollback();
      return sendError(res, '找不到該留言', 404);
    }

    if (comments[0].user_id !== userId) {
      await connection.rollback();
      return sendError(res, '無權限刪除此留言', 403);
    }

    await connection.query('DELETE FROM comments WHERE comment_id = ?', [commentId]);

    await connection.commit();

    return sendSuccess(res, null, '留言刪除成功');

  } catch (error) {
    await connection.rollback();
    console.error('刪除留言失敗:', error);
    return sendError(res, '刪除留言失敗', 500);
  } finally {
    connection.release();
  }
};