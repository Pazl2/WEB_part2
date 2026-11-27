const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { registerLimiter, loginLimiter, verifyLimiter } = require('../middleware/rateLimiters');

router.post('/register', registerLimiter, authController.register);
router.post('/login', loginLimiter, authController.login);
router.post('/verify-2fa', verifyLimiter, authController.verifyTwoFactor);
router.get('/me', authenticateToken, authController.getMe);

module.exports = router;