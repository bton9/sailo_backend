import blogConfig from '../../config/blog.config.js';

/**
 * 格式化分頁參數
 */
export const formatPagination = (page = 1, limit = blogConfig.pagination.defaultLimit) => {
  const parsedPage = parseInt(page, 10);
  const parsedLimit = parseInt(limit, 10);

  const validPage = parsedPage > 0 ? parsedPage : 1;
  const validLimit = parsedLimit > 0 && parsedLimit <= blogConfig.pagination.maxLimit
    ? parsedLimit
    : blogConfig.pagination.defaultLimit;

  return {
    offset: (validPage - 1) * validLimit,
    limit: validLimit,
    page: validPage
  };
};

/**
 * 格式化文章資料（支援完整行程資訊）
 */
export const formatPostData = (post, currentUserId = null) => {
  if (!post) return null;
  
  return {
    // === 基本資訊 ===
    post_id: post.post_id,
    title: post.title,
    content: post.content,
    category: post.category,
    trip_id: post.trip_id,
    visible: post.visible,
    view_count: post.view_count,
    created_at: post.created_at,
    updated_at: post.updated_at,
    
    // === 作者資訊 (統一格式) ===
    author: {
      user_id: post.author_id,
      name: post.author_name,
      nickname: post.author_nickname,
      avatar: post.author_avatar,
      display_name: post.author_nickname || post.author_name
    },
    
    // === 行程資訊 (完整版本) ===
    itinerary: post.trip_id ? {
      trip_id: post.trip_id,
      trip_name: post.trip_name,
      start_date: post.start_date,
      end_date: post.end_date,
      cover_image_url: post.cover_image_url,
      summary_text: post.summary_text,
      days: post.trip_days,
      nights: post.trip_nights,
      locations: post.trip_locations || ''  // ⚠️ 保持字串格式（用「、」分隔）
    } : null,
    
    // === 統計資訊 (確保數字類型) ===
    stats: {
      likes: parseInt(post.like_count) || 0,
      comments: parseInt(post.comment_count) || 0,
      bookmarks: parseInt(post.bookmark_count) || 0
    },
    
    // === 使用者互動狀態 ===
    user_interaction: currentUserId ? {
      is_liked: post.is_liked === 1,
      is_bookmarked: post.is_bookmarked === 1,
      is_following_author: post.is_following_author === 1,
      is_author: post.author_id === currentUserId
    } : null,
    
    // === 標籤 (相容多種格式) ===
    tags: post.tags 
      ? (Array.isArray(post.tags) ? post.tags : JSON.parse(post.tags))
      : [],
    
    // === 圖片 (相容多種格式) ===
    photos: post.photos 
      ? (Array.isArray(post.photos) ? post.photos : JSON.parse(post.photos))
      : []
  };
};

/**
 * 格式化留言資料
 */
export const formatCommentData = (comment, currentUserId = null) => {
  if (!comment) return null;

  return {
    comment_id: comment.comment_id,
    content: comment.content,
    created_at: comment.created_at,
    updated_at: comment.updated_at,

    author: {
      user_id: comment.user_id,
      name: comment.author_name,
      nickname: comment.author_nickname,
      avatar: comment.author_avatar,
      display_name: comment.author_nickname || comment.author_name
    },

    stats: {
      likes: parseInt(comment.like_count) || 0
    },

    user_interaction: currentUserId ? {
      is_liked: comment.is_liked === 1,
      is_author: comment.user_id === currentUserId
    } : null
  };
};

/**
 * 驗證分類是否有效
 */
export const isValidCategory = (category) => {
  return blogConfig.post.categories.includes(category);
};

/**
 * 驗證排序選項是否有效
 */
export const isValidSortOption = (sortBy) => {
  return blogConfig.post.sortOptions.includes(sortBy);
};

/**
 * 取得排序 SQL
 */
export const getSortSQL = (sortBy = 'newest') => {
  switch (sortBy) {
    case 'likes':
      return 'like_count DESC, p.created_at DESC';
    case 'comments':
      return 'comment_count DESC, p.created_at DESC';
    case 'bookmarks':
      return 'bookmark_count DESC, p.created_at DESC';
    case 'newest':
    default:
      return 'p.created_at DESC';
  }
};

/**
 * 建立成功回應
 */
export const sendSuccess = (res, data = null, message = 'Success', statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data
  });
};

/**
 * 建立錯誤回應
 */
export const sendError = (res, message = 'Error', statusCode = 400) => {
  return res.status(statusCode).json({
    success: false,
    message,
    data: null
  });
};

/**
 * 清理標籤名稱
 */
export const sanitizeTagName = (tagName) => {
  return tagName
    .trim()
    .replace(/^#/, '')
    .replace(/\s+/g, ' ');
};

/**
 * 驗證標籤名稱
 */
export const isValidTagName = (tagName) => {
  const cleaned = sanitizeTagName(tagName);
  return cleaned.length >= blogConfig.tag.nameMinLength && 
         cleaned.length <= blogConfig.tag.nameMaxLength;
};