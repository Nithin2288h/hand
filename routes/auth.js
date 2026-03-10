const express = require('express');
const { body } = require('express-validator');
const { register, login, getMe, getAllUsers, saveFcmToken } = require('../controllers/authController');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/role');
const validate = require('../middleware/validate');

const router = express.Router();

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 */
router.post(
    '/register',
    [
        body('name').notEmpty().withMessage('Name is required'),
        body('email').isEmail().withMessage('Valid email required'),
        body('password').isLength({ min: 6 }).withMessage('Password min 6 characters'),
        body('role').optional().isIn(['admin', 'ngo', 'volunteer', 'citizen']),
        validate,
    ],
    register
);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login user
 *     tags: [Auth]
 */
router.post(
    '/login',
    [
        body('email').isEmail().withMessage('Valid email required'),
        body('password').notEmpty().withMessage('Password required'),
        validate,
    ],
    login
);

router.get('/me', authenticate, getMe);
router.get('/users', authenticate, authorize('admin'), getAllUsers);

// Save FCM push notification token for the logged-in user's device
router.post('/fcm-token', authenticate, saveFcmToken);

module.exports = router;
