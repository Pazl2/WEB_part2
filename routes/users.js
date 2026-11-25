const express = require('express');
const router = express.Router();
const usersController = require('../controllers/usersController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/requireRole');
const { validateIntegerId } = require('../middleware/validateIntegerId');

// id пользователя — целое число (PostgreSQL), а не ObjectId
router.delete(
  '/:id',
  authenticateToken,
  requireRole('admin'),
  validateIntegerId('id'),
  usersController.deleteUser
);

module.exports = router;
