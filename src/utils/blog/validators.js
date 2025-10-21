import { body, param, query } from 'express-validator';
import blogConfig from '../../config/blog.config.js';

/**
 * 驗證文章建立
 */
export const validateCreatePost = [
  body('title')
    .trim()
    .notEmpty().withMessage('文章標題為必填')
    .isLength({ max: blogConfig.post.titleMaxLength })
    .withMessage(`標題最多 ${blogConfig.post.titleMaxLength} 個字`),

  body('content')
    .trim()
    .notEmpty().withMessage('文章內容為必填')
    .isLength({ max: blogConfig.post.contentMaxLength })
    .withMessage(`內容最多 ${blogConfig.post.contentMaxLength} 個字`),

  body('category')
    .notEmpty().withMessage('請選擇文章分類')
    .isIn(blogConfig.post.categories)
    .withMessage('無效的分類'),

  body('trip_id')
    .optional({ nullable: true })
    .isInt().withMessage('行程 ID 必須為整數'),

  body('tags')
    .optional()
    .isArray().withMessage('標籤必須為陣列')
    .custom((tags) => {
      if (tags.length > blogConfig.tag.maxTagsPerPost) {
        throw new Error(`最多只能新增 ${blogConfig.tag.maxTagsPerPost} 個標籤`);
      }
      return true;
    }),

  body('image_url')
    .optional({ nullable: true })
    .isURL().withMessage('圖片 URL 格式不正確')
];

/**
 * 驗證文章更新
 */
export const validateUpdatePost = [
  param('postId')
    .isInt().withMessage('文章 ID 必須為整數'),

  body('title')
    .optional()
    .trim()
    .notEmpty().withMessage('文章標題不可為空')
    .isLength({ max: blogConfig.post.titleMaxLength })
    .withMessage(`標題最多 ${blogConfig.post.titleMaxLength} 個字`),

  body('content')
    .optional()
    .trim()
    .notEmpty().withMessage('文章內容不可為空')
    .isLength({ max: blogConfig.post.contentMaxLength })
    .withMessage(`內容最多 ${blogConfig.post.contentMaxLength} 個字`),

  body('category')
    .optional()
    .isIn(blogConfig.post.categories)
    .withMessage('無效的分類'),

  body('trip_id')
    .optional({ nullable: true })
    .isInt().withMessage('行程 ID 必須為整數'),

  body('visible')
    .optional()
    .isBoolean().withMessage('visible 必須為布林值')
];

/**
 * 驗證留言建立
 */
export const validateCreateComment = [
  param('postId')
    .isInt().withMessage('文章 ID 必須為整數'),

  body('content')
    .trim()
    .notEmpty().withMessage('留言內容為必填')
    .isLength({ max: blogConfig.comment.contentMaxLength })
    .withMessage(`留言最多 ${blogConfig.comment.contentMaxLength} 個字`)
];

/**
 * 驗證留言更新
 */
export const validateUpdateComment = [
  param('commentId')
    .isInt().withMessage('留言 ID 必須為整數'),

  body('content')
    .trim()
    .notEmpty().withMessage('留言內容不可為空')
    .isLength({ max: blogConfig.comment.contentMaxLength })
    .withMessage(`留言最多 ${blogConfig.comment.contentMaxLength} 個字`)
];

/**
 * 驗證 ID 參數
 */
export const validatePostId = [
  param('postId')
    .isInt().withMessage('文章 ID 必須為整數')
];

export const validateCommentId = [
  param('commentId')
    .isInt().withMessage('留言 ID 必須為整數')
];

export const validateUserId = [
  param('userId')
    .isInt().withMessage('使用者 ID 必須為整數')
];

export const validateTagId = [
  param('tagId')
    .isInt().withMessage('標籤 ID 必須為整數')
];

/**
 * 驗證查詢參數
 */
export const validateQueryParams = [
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('頁碼必須為正整數'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: blogConfig.pagination.maxLimit })
    .withMessage(`每頁筆數必須介於 1 到 ${blogConfig.pagination.maxLimit} 之間`),

  query('sort')
    .optional()
    .isIn(blogConfig.post.sortOptions)
    .withMessage('無效的排序選項'),

  query('category')
    .optional()
    .isIn([...blogConfig.post.categories, 'all'])
    .withMessage('無效的分類')
];

/**
 * 驗證搜尋參數
 */
export const validateSearchParams = [
  query('q')
    .trim()
    .notEmpty().withMessage('搜尋關鍵字為必填')
    .isLength({ min: blogConfig.search.minKeywordLength })
    .withMessage(`搜尋關鍵字至少 ${blogConfig.search.minKeywordLength} 個字元`),

  query('type')
    .optional()
    .isIn(['all', 'posts', 'users', 'tags'])
    .withMessage('無效的搜尋類型')
];