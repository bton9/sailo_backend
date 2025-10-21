// Blog 模組設定檔
export default {
  // 分頁設定
  pagination: {
    defaultLimit: 10,
    maxLimit: 50,
  },

  // 文章設定
  post: {
    titleMaxLength: 100,
    contentMaxLength: 5000,
    categories: ['travel', 'food', 'life', 'photo'],
    sortOptions: ['newest', 'likes', 'comments', 'bookmarks'],
  },

  // 留言設定
  comment: {
    contentMaxLength: 1000,
  },

  // 標籤設定
  tag: {
    nameMinLength: 2,
    nameMaxLength: 50,
    maxTagsPerPost: 10,
  },

  // 圖片上傳設定
  upload: {
    maxFileSize: 5 * 1024 * 1024, // 5MB
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif'],
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.gif'],
  },

  // 互動功能設定
  interaction: {
    allowSelfLike: true,
    allowSelfBookmark: true,
    allowSelfFollow: false,
  },

  // 搜尋設定
  search: {
    minKeywordLength: 2,
    maxResults: 100,
  }
};