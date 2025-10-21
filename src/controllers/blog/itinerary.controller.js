import db from '../../config/database.js';
import { sendSuccess, sendError } from '../../utils/blog/helpers.js';

/**
 * 取得使用者的行程列表
 * GET /api/blog/users/:userId/itineraries
 */
export const getUserItineraries = async (req, res) => {
  try {
    const { userId } = req.params;

    const sql = `
      SELECT 
        t.trip_id,
        t.trip_name,
        t.start_date,
        t.end_date,
        t.cover_image_url,
        t.summary_text,
        DATEDIFF(t.end_date, t.start_date) + 1 AS trip_days,
        DATEDIFF(t.end_date, t.start_date) AS trip_nights,
        
        (SELECT GROUP_CONCAT(DISTINCT l.name ORDER BY l.name SEPARATOR '、')
         FROM trip_items ti
         JOIN trip_days td ON ti.trip_day_id = td.trip_day_id
         JOIN places pl ON ti.place_id = pl.place_id
         JOIN locations l ON pl.location_id = l.location_id
         WHERE td.trip_id = t.trip_id
        ) AS trip_locations
        
      FROM trips t
      WHERE t.user_id = ?
      ORDER BY t.created_at DESC
    `;

    const [itineraries] = await db.query(sql, [userId]);

    const formattedItineraries = itineraries.map(itinerary => ({
      trip_id: itinerary.trip_id,
      trip_name: itinerary.trip_name,
      start_date: itinerary.start_date,
      end_date: itinerary.end_date,
      cover_image_url: itinerary.cover_image_url,
      summary_text: itinerary.summary_text,
      duration: {
        days: itinerary.trip_days,
        nights: itinerary.trip_nights
      },
      locations: itinerary.trip_locations ? itinerary.trip_locations.split('、') : []
    }));

    return sendSuccess(res, { itineraries: formattedItineraries });

  } catch (error) {
    console.error('取得行程列表失敗:', error);
    return sendError(res, '取得行程列表失敗', 500);
  }
};

/**
 * 取得單一行程詳細資訊
 * GET /api/blog/itineraries/:tripId
 */
export const getItineraryById = async (req, res) => {
  try {
    const { tripId } = req.params;

    const [trips] = await db.query(`
      SELECT 
        t.trip_id,
        t.trip_name,
        t.description,
        t.start_date,
        t.end_date,
        t.cover_image_url,
        t.summary_text,
        t.user_id,
        DATEDIFF(t.end_date, t.start_date) + 1 AS trip_days,
        DATEDIFF(t.end_date, t.start_date) AS trip_nights,
        
        u.name AS author_name,
        u.nickname AS author_nickname,
        u.avatar AS author_avatar,
        
        (SELECT GROUP_CONCAT(DISTINCT l.name ORDER BY l.name SEPARATOR '、')
         FROM trip_items ti
         JOIN trip_days td ON ti.trip_day_id = td.trip_day_id
         JOIN places pl ON ti.place_id = pl.place_id
         JOIN locations l ON pl.location_id = l.location_id
         WHERE td.trip_id = t.trip_id
        ) AS trip_locations
        
      FROM trips t
      INNER JOIN users u ON t.user_id = u.id
      WHERE t.trip_id = ?
    `, [tripId]);

    if (trips.length === 0) {
      return sendError(res, '找不到該行程', 404);
    }

    const trip = trips[0];

    const formattedTrip = {
      trip_id: trip.trip_id,
      trip_name: trip.trip_name,
      description: trip.description,
      start_date: trip.start_date,
      end_date: trip.end_date,
      cover_image_url: trip.cover_image_url,
      summary_text: trip.summary_text,
      duration: {
        days: trip.trip_days,
        nights: trip.trip_nights
      },
      locations: trip.trip_locations ? trip.trip_locations.split('、') : [],
      author: {
        id: trip.user_id,
        name: trip.author_name,
        nickname: trip.author_nickname,
        avatar: trip.author_avatar
      }
    };

    return sendSuccess(res, { itinerary: formattedTrip });

  } catch (error) {
    console.error('取得行程詳情失敗:', error);
    return sendError(res, '取得行程詳情失敗', 500);
  }
};

/**
 * 取得關聯此行程的文章列表
 * GET /api/blog/itineraries/:tripId/posts
 */
export const getPostsByItinerary = async (req, res) => {
  try {
    const { tripId } = req.params;
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

    const [trips] = await db.query(
      'SELECT trip_id FROM trips WHERE trip_id = ?',
      [tripId]
    );

    if (trips.length === 0) {
      return sendError(res, '找不到該行程', 404);
    }

    const { offset, limit: validLimit } = formatPagination(page, limit);

    let sql = getPostsQuery();
    
    if (currentUserId) {
      sql += getUserInteractionFields(currentUserId);
    }

    sql += `
      WHERE p.trip_id = ? AND p.visible = TRUE
      ORDER BY ${getSortSQL(sort)}
      LIMIT ? OFFSET ?
    `;

    const [posts] = await db.query(sql, [tripId, validLimit, offset]);
    const formattedPosts = posts.map(post => formatPostData(post, currentUserId));

    const [[{ total }]] = await db.query(
      'SELECT COUNT(*) as total FROM posts WHERE trip_id = ? AND visible = TRUE',
      [tripId]
    );

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
    console.error('取得行程文章失敗:', error);
    return sendError(res, '取得行程文章失敗', 500);
  }
};

/**
 * 複製行程到自己的行程列表
 * POST /api/blog/itineraries/:tripId/copy
 */
export const copyItinerary = async (req, res) => {
  const connection = await db.getConnection();
  
  try {
    const { tripId } = req.params;
    const userId = req.user.id;

    await connection.beginTransaction();

    const [originalTrips] = await connection.query(
      'SELECT * FROM trips WHERE trip_id = ?',
      [tripId]
    );

    if (originalTrips.length === 0) {
      await connection.rollback();
      return sendError(res, '找不到該行程', 404);
    }

    const originalTrip = originalTrips[0];

    const [newTripResult] = await connection.query(`
      INSERT INTO trips (
        trip_name, 
        user_id, 
        description, 
        start_date, 
        end_date, 
        cover_image_url, 
        summary_text
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      `${originalTrip.trip_name} (副本)`,
      userId,
      originalTrip.description,
      originalTrip.start_date,
      originalTrip.end_date,
      originalTrip.cover_image_url,
      originalTrip.summary_text
    ]);

    const newTripId = newTripResult.insertId;

    const [tripDays] = await connection.query(
      'SELECT * FROM trip_days WHERE trip_id = ? ORDER BY day_number ASC',
      [tripId]
    );

    const dayIdMapping = {};

    for (const day of tripDays) {
      const [newDayResult] = await connection.query(`
        INSERT INTO trip_days (trip_id, date, day_number)
        VALUES (?, ?, ?)
      `, [newTripId, day.date, day.day_number]);

      dayIdMapping[day.trip_day_id] = newDayResult.insertId;
    }

    if (Object.keys(dayIdMapping).length > 0) {
      const [tripItems] = await connection.query(
        'SELECT * FROM trip_items WHERE trip_day_id IN (?) ORDER BY sort_order ASC',
        [Object.keys(dayIdMapping)]
      );

      for (const item of tripItems) {
        const newTripDayId = dayIdMapping[item.trip_day_id];

        await connection.query(`
          INSERT INTO trip_items (
            trip_day_id, 
            place_id, 
            type, 
            start_time, 
            end_time, 
            sort_order
          )
          VALUES (?, ?, ?, ?, ?, ?)
        `, [
          newTripDayId,
          item.place_id,
          item.type,
          item.start_time,
          item.end_time,
          item.sort_order
        ]);
      }
    }

    await connection.commit();

    return sendSuccess(res, { 
      trip_id: newTripId,
      message: '行程已複製到您的行程列表'
    }, '複製成功', 201);

  } catch (error) {
    await connection.rollback();
    console.error('複製行程失敗:', error);
    return sendError(res, '複製行程失敗', 500);
  } finally {
    connection.release();
  }
};