const express = require('express');
const { getNotifications, markRead, markAllRead } = require('../controllers/notificationController');
const authenticate = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticate, getNotifications);
router.patch('/read-all', authenticate, markAllRead);
router.patch('/:id/read', authenticate, markRead);

module.exports = router;
