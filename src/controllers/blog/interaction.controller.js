import db from '../../config/database.js';
import { sendSuccess, sendError } from '../../utils/blog/helpers.js';
import blogConfig from '../../config/blog.config.js';

/**
 * 按讚/取消按讚文章
 * POST /api/blog/posts/:postId/like
 */
export const togglePostLike = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.id;

    const [posts] = await db.query(
      'SELECT post_id, user_id FROM posts WHERE post_id = ?',
      [postId]
    );

    if (posts.length === 0) {
      return sendError(res, '找不到該文章', 404);
    }

    if (!blogConfig.interaction.allowSelfLike && posts[0].user_id === userId) {
      return sendError(res, '無法對自己的文章按讚', 400);
    }

    const [existingLikes] = await db.query(
      'SELECT post_likes_id FROM post_likes WHERE post_id = ? AND user_id = ?',
      [postId, userId]
    );

    if (existingLikes.length > 0) {
      await db.query(
        'DELETE FROM post_likes WHERE post_id = ? AND user_id = ?',
        [postId, userId]
      );
      return sendSuccess(res, { is_liked: false }, '已取消按讚');
    } else {
      await db.query(
        'INSERT INTO post_likes (post_id, user_id) VALUES (?, ?)',
        [postId, userId]
      );
      return sendSuccess(res, { is_liked: true }, '已按讚');
    }

  } catch (error) {
    console.error('按讚文章失敗:', error);
    return sendError(res, '按讚文章失敗', 500);
  }
};

/**
 * 按讚/取消按讚留言
 * POST /api/blog/comments/:commentId/like
 */
export const toggleCommentLike = async (req, res) => {
  try {
    const { commentId } = req.params;
    const userId = req.user.id;

    const [comments] = await db.query(
      'SELECT comment_id, user_id FROM comments WHERE comment_id = ?',
      [commentId]
    );

    if (comments.length === 0) {
      return sendError(res, '找不到該留言', 404);
    }

    if (!blogConfig.interaction.allowSelfLike && comments[0].user_id === userId) {
      return sendError(res, '無法對自己的留言按讚', 400);
    }

    const [existingLikes] = await db.query(
      'SELECT comment_likes_id FROM comment_likes WHERE comment_id = ? AND user_id = ?',
      [commentId, userId]
    );

    if (existingLikes.length > 0) {
      await db.query(
        'DELETE FROM comment_likes WHERE comment_id = ? AND user_id = ?',
        [commentId, userId]
      );
      return sendSuccess(res, { is_liked: false }, '已取消按讚');
    } else {
      await db.query(
        'INSERT INTO comment_likes (comment_id, user_id) VALUES (?, ?)',
        [commentId, userId]
      );
      return sendSuccess(res, { is_liked: true }, '已按讚');
    }

  } catch (error) {
    console.error('按讚留言失敗:', error);
    return sendError(res, '按讚留言失敗', 500);
  }
};

/**
 * 收藏/取消收藏文章
 * POST /api/blog/posts/:postId/bookmark
 */
export const toggleBookmark = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.id;

    const [posts] = await db.query(
      'SELECT post_id, user_id FROM posts WHERE post_id = ?',
      [postId]
    );

    if (posts.length === 0) {
      return sendError(res, '找不到該文章', 404);
    }

    if (!blogConfig.interaction.allowSelfBookmark && posts[0].user_id === userId) {
      return sendError(res, '無法收藏自己的文章', 400);
    }

    const [existingBookmarks] = await db.query(
      'SELECT bookmark_id FROM bookmarks WHERE post_id = ? AND user_id = ?',
      [postId, userId]
    );

    if (existingBookmarks.length > 0) {
      await db.query(
        'DELETE FROM bookmarks WHERE post_id = ? AND user_id = ?',
        [postId, userId]
      );
      return sendSuccess(res, { is_bookmarked: false }, '已取消收藏');
    } else {
      await db.query(
        'INSERT INTO bookmarks (post_id, user_id) VALUES (?, ?)',
        [postId, userId]
      );
      return sendSuccess(res, { is_bookmarked: true }, '已收藏');
    }

  } catch (error) {
    console.error('收藏文章失敗:', error);
    return sendError(res, '收藏文章失敗', 500);
  }
};

/**
 * 取得使用者收藏的文章列表
 * GET /api/blog/users/:userId/bookmarks
 */
export const getUserBookmarks = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page, limit, sort = 'newest' } = req.query;
    const currentUserId = req.user?.id;

    const { formatPagination, getSortSQL, formatPostData } = await import('../../utils/blog/helpers.js');
    const { getPostsQuery, getUserInteractionFields } = await import('../../utils/blog/queries.js');

    const { offset, limit: validLimit } = formatPagination(page, limit);

    let sql = getPostsQuery();
    
    if (currentUserId) {
      sql += getUserInteractionFields(currentUserId);
    }

    sql += `
      INNER JOIN bookmarks b ON p.post_id = b.post_id
      WHERE b.user_id = ? AND p.visible = TRUE
      ORDER BY b.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const [posts] = await db.query(sql, [userId, validLimit, offset]);
    const formattedPosts = posts.map(post => formatPostData(post, currentUserId));

    const [[{ total }]] = await db.query(`
      SELECT COUNT(*) as total 
      FROM bookmarks b
      INNER JOIN posts p ON b.post_id = p.post_id
      WHERE b.user_id = ? AND p.visible = TRUE
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
    console.error('取得收藏列表失敗:', error);
    return sendError(res, '取得收藏列表失敗', 500);
  }
};