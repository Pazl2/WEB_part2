const express = require('express');
const router = express.Router();
const postsController = require('../controllers/postsController');
const commentsController = require('../controllers/commentsController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { validateObjectId } = require('../middleware/validateObjectId');

router.get('/', postsController.getAllPosts);
router.get('/:id', validateObjectId('id'), postsController.getPostById);
router.post('/', authenticateToken, postsController.createPost);
router.put('/:id', authenticateToken, validateObjectId('id'), postsController.updatePost);
router.delete('/:id', authenticateToken, validateObjectId('id'), postsController.deletePost);

// вложенные комментарии
router.post(
  '/:id/comments',
  authenticateToken,
  validateObjectId('id'),
  commentsController.addComment
);
router.patch(
  '/:id/comments/:commentId/like',
  authenticateToken,
  validateObjectId('id', 'commentId'),
  commentsController.likeComment
);
router.delete(
  '/:id/comments/:commentId',
  authenticateToken,
  validateObjectId('id', 'commentId'),
  commentsController.deleteComment
);

module.exports = router;
