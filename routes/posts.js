const express = require('express');
const router = express.Router();
const postsController = require('../controllers/postsController');
const commentsController = require('../controllers/commentsController');
const { authenticateToken, optionalAuth } = require('../middleware/authMiddleware');
const { validateObjectId } = require('../middleware/validateObjectId');
const { createPostLimiter, createCommentLimiter } = require('../middleware/rateLimiters');

// Чтение открыто всем; optionalAuth лишь определяет, кто смотрит (для likedByMe)
router.get('/', optionalAuth, postsController.getAllPosts);
router.get('/:id', optionalAuth, validateObjectId('id'), postsController.getPostById);
router.post('/', authenticateToken, createPostLimiter, postsController.createPost);
router.put('/:id', authenticateToken, validateObjectId('id'), postsController.updatePost);
router.delete('/:id', authenticateToken, validateObjectId('id'), postsController.deletePost);

// вложенные комментарии
router.post(
  '/:id/comments',
  authenticateToken,
  validateObjectId('id'),
  createCommentLimiter,
  commentsController.addComment
);
router.put(
  '/:id/comments/:commentId/like',
  authenticateToken,
  validateObjectId('id', 'commentId'),
  commentsController.likeComment
);
router.delete(
  '/:id/comments/:commentId/like',
  authenticateToken,
  validateObjectId('id', 'commentId'),
  commentsController.unlikeComment
);
router.delete(
  '/:id/comments/:commentId',
  authenticateToken,
  validateObjectId('id', 'commentId'),
  commentsController.deleteComment
);

module.exports = router;
