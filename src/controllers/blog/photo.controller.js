import db from '../../config/database.js';
import { sendSuccess, sendError } from '../../utils/blog/helpers.js';

/**
 * 上傳圖片
 * POST /api/blog/photos/upload
 */
export const uploadPhoto = async (req, res) => {
  try {
    if (!req.file) {
      return sendError(res, '請上傳圖片檔案', 400);
    }

    let imageUrl;
    
    if (req.file.filename) {
      const protocol = req.protocol;
      const host = req.get('host');
      imageUrl = `${protocol}://${host}/uploads/blog/${req.file.filename}`;
    }
    else if (req.file.path) {
      imageUrl = req.file.path;
    }
    else if (req.file.location) {
      imageUrl = req.file.location;
    }
    else {
      return sendError(res, '圖片上傳失敗', 500);
    }

    return sendSuccess(res, { 
      url: imageUrl,
      filename: req.file.filename || req.file.key
    }, '圖片上傳成功', 201);

  } catch (error) {
    console.error('上傳圖片失敗:', error);
    return sendError(res, '上傳圖片失敗', 500);
  }
};

/**
 * 將圖片關聯到文章
 * POST /api/blog/posts/:postId/photos
 */
export const addPhotoToPost = async (req, res) => {
  try {
    const { postId } = req.params;
    const { url } = req.body;
    const userId = req.user.id;

    if (!url) {
      return sendError(res, '請提供圖片 URL', 400);
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

    const [result] = await db.query(
      'INSERT INTO post_photos (post_id, url) VALUES (?, ?)',
      [postId, url]
    );

    return sendSuccess(res, { 
      photo_id: result.insertId,
      url 
    }, '圖片新增成功', 201);

  } catch (error) {
    console.error('新增圖片失敗:', error);
    return sendError(res, '新增圖片失敗', 500);
  }
};

/**
 * 取得文章的所有圖片
 * GET /api/blog/posts/:postId/photos
 */
export const getPostPhotos = async (req, res) => {
  try {
    const { postId } = req.params;

    const [posts] = await db.query(
      'SELECT post_id FROM posts WHERE post_id = ?',
      [postId]
    );

    if (posts.length === 0) {
      return sendError(res, '找不到該文章', 404);
    }

    const [photos] = await db.query(`
      SELECT photo_id, url, created_at
      FROM post_photos
      WHERE post_id = ?
      ORDER BY created_at ASC
    `, [postId]);

    return sendSuccess(res, { photos });

  } catch (error) {
    console.error('取得圖片列表失敗:', error);
    return sendError(res, '取得圖片列表失敗', 500);
  }
};

/**
 * 刪除文章的圖片
 * DELETE /api/blog/photos/:photoId
 */
export const deletePhoto = async (req, res) => {
  try {
    const { photoId } = req.params;
    const userId = req.user.id;

    const [photos] = await db.query(`
      SELECT pp.photo_id, pp.post_id, p.user_id
      FROM post_photos pp
      INNER JOIN posts p ON pp.post_id = p.post_id
      WHERE pp.photo_id = ?
    `, [photoId]);

    if (photos.length === 0) {
      return sendError(res, '找不到該圖片', 404);
    }

    if (photos[0].user_id !== userId) {
      return sendError(res, '無權限刪除此圖片', 403);
    }

    await db.query('DELETE FROM post_photos WHERE photo_id = ?', [photoId]);

    return sendSuccess(res, null, '圖片刪除成功');

  } catch (error) {
    console.error('刪除圖片失敗:', error);
    return sendError(res, '刪除圖片失敗', 500);
  }
};