const express = require('express');
const router = express.Router();
const usersController = require('../controllers/usersController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/requireRole');
const { validateObjectId } = require('../middleware/validateObjectId');

router.delete(
  '/:id',
  authenticateToken,
  requireRole('admin'),
  validateObjectId('id'),
  usersController.deleteUser
);

module.exports = router;
