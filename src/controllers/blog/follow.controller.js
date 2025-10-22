import db from '../../config/database.js';
import { sendSuccess, sendError } from '../../utils/blog/helpers.js';
import blogConfig from '../../config/blog.config.js';

/**
 * 追蹤/取消追蹤使用者
 * POST /api/blog/users/:userId/follow
 */
export const toggleFollow = async (req, res) => {
  try {
    const { userId } = req.params;
    const followerId = req.user.id;

    if (parseInt(userId) === followerId) {
      if (!blogConfig.interaction.allowSelfFollow) {
        return sendError(res, '無法追蹤自己', 400);
      }
    }

    const [users] = await db.query(
      'SELECT id FROM users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      return sendError(res, '找不到該使用者', 404);
    }

    const [existingFollows] = await db.query(
      'SELECT follow_id FROM follows WHERE follower_id = ? AND following_id = ?',
      [followerId, userId]
    );

    if (existingFollows.length > 0) {
      await db.query(
        'DELETE FROM follows WHERE follower_id = ? AND following_id = ?',
        [followerId, userId]
      );
      return sendSuccess(res, { is_following: false }, '已取消追蹤');
    } else {
      await db.query(
        'INSERT INTO follows (follower_id, following_id) VALUES (?, ?)',
        [followerId, userId]
      );
      return sendSuccess(res, { is_following: true }, '已追蹤');
    }

  } catch (error) {
    console.error('追蹤使用者失敗:', error);
    return sendError(res, '追蹤使用者失敗', 500);
  }
};

/**
 * 取得使用者的追蹤者列表
 * GET /api/blog/users/:userId/followers
 */
export const getFollowers = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page, limit } = req.query;
    const currentUserId = req.user?.id;

    const { formatPagination } = await import('../../utils/blog/helpers.js');
    const { offset, limit: validLimit } = formatPagination(page, limit);

    let sql = `
      SELECT 
        u.id,
        u.name,
        u.nickname,
        u.avatar,
        f.created_at as followed_at
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
      FROM follows f
      INNER JOIN users u ON f.follower_id = u.id
      WHERE f.following_id = ?
      ORDER BY f.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const params = currentUserId 
      ? [currentUserId, userId, validLimit, offset]
      : [userId, validLimit, offset];

    const [followers] = await db.query(sql, params);

    const formattedFollowers = followers.map(follower => ({
      id: follower.id,
      name: follower.name,
      nickname: follower.nickname,
      avatar: follower.avatar,
      followed_at: follower.followed_at,
      is_following: currentUserId ? follower.is_following === 1 : null
    }));

    const [[{ total }]] = await db.query(
      'SELECT COUNT(*) as total FROM follows WHERE following_id = ?',
      [userId]
    );

    return sendSuccess(res, {
      followers: formattedFollowers,
      pagination: {
        total,
        page: parseInt(page) || 1,
        limit: validLimit,
        totalPages: Math.ceil(total / validLimit)
      }
    });

  } catch (error) {
    console.error('取得追蹤者列表失敗:', error);
    return sendError(res, '取得追蹤者列表失敗', 500);
  }
};

/**
 * 取得使用者追蹤中的列表
 * GET /api/blog/users/:userId/following
 */
export const getFollowing = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page, limit } = req.query;
    const currentUserId = req.user?.id;

    const { formatPagination } = await import('../../utils/blog/helpers.js');
    const { offset, limit: validLimit } = formatPagination(page, limit);

    let sql = `
      SELECT 
        u.id,
        u.name,
        u.nickname,
        u.avatar,
        f.created_at as followed_at
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
      FROM follows f
      INNER JOIN users u ON f.following_id = u.id
      WHERE f.follower_id = ?
      ORDER BY f.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const params = currentUserId 
      ? [currentUserId, userId, validLimit, offset]
      : [userId, validLimit, offset];

    const [following] = await db.query(sql, params);

    const formattedFollowing = following.map(user => ({
      id: user.id,
      name: user.name,
      nickname: user.nickname,
      avatar: user.avatar,
      followed_at: user.followed_at,
      is_following: currentUserId ? user.is_following === 1 : null
    }));

    const [[{ total }]] = await db.query(
      'SELECT COUNT(*) as total FROM follows WHERE follower_id = ?',
      [userId]
    );

    return sendSuccess(res, {
      following: formattedFollowing,
      pagination: {
        total,
        page: parseInt(page) || 1,
        limit: validLimit,
        totalPages: Math.ceil(total / validLimit)
      }
    });

  } catch (error) {
    console.error('取得追蹤中列表失敗:', error);
    return sendError(res, '取得追蹤中列表失敗', 500);
  }
};

/**
 * 取得使用者統計資料
 * GET /api/blog/users/:userId/stats
 */
export const getUserStats = async (req, res) => {
  try {
    const { userId } = req.params;

    const [users] = await db.query(
      'SELECT id, name, nickname, avatar FROM users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      return sendError(res, '找不到該使用者', 404);
    }

    const [[postCount]] = await db.query(
      'SELECT COUNT(*) as total FROM posts WHERE user_id = ? AND visible = TRUE',
      [userId]
    );

    const [[followerCount]] = await db.query(
      'SELECT COUNT(*) as total FROM follows WHERE following_id = ?',
      [userId]
    );

    const [[followingCount]] = await db.query(
      'SELECT COUNT(*) as total FROM follows WHERE follower_id = ?',
      [userId]
    );

    return sendSuccess(res, {
      user: users[0],
      stats: {
        posts: postCount.total,
        followers: followerCount.total,
        following: followingCount.total
      }
    });

  } catch (error) {
    console.error('取得使用者統計失敗:', error);
    return sendError(res, '取得使用者統計失敗', 500);
  }
};

/**
 * 檢查是否追蹤某使用者
 * GET /api/blog/users/:userId/follow-status
 */
export const checkFollowStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const followerId = req.user.id;

    // 檢查目標使用者是否存在
    const [users] = await db.query(
      'SELECT id FROM users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      return sendError(res, '找不到該使用者', 404);
    }

    // 檢查是否已追蹤
    const [result] = await db.query(
      'SELECT COUNT(*) as is_following FROM follows WHERE follower_id = ? AND following_id = ?',
      [followerId, userId]
    );

    return sendSuccess(res, {
      is_following: result[0].is_following > 0
    });

  } catch (error) {
    console.error('檢查追蹤狀態失敗:', error);
    return sendError(res, '檢查追蹤狀態失敗', 500);
  }
};