import express from 'express';
const router = express.Router();

// 引入各個路由模組
import postRoutes from './post.routes.js';
import commentRoutes from './comment.routes.js';
import interactionRoutes from './interaction.routes.js';
import followRoutes from './follow.routes.js';
import tagRoutes from './tag.routes.js';
import photoRoutes from './photo.routes.js';
import searchRoutes from './search.routes.js';
import itineraryRoutes from './itinerary.routes.js';

// 註冊路由
router.use('/posts', postRoutes);
router.use('/comments', commentRoutes);
router.use('/interactions', interactionRoutes);
router.use('/users', followRoutes);
router.use('/tags', tagRoutes);
router.use('/photos', photoRoutes);
router.use('/search', searchRoutes);
router.use('/itineraries', itineraryRoutes);

export default router;