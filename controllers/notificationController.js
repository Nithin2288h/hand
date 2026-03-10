const db = require('../config/db');

// GET /api/notifications
const getNotifications = async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;

        const notifications = db.prepare(
            `SELECT n.*, d.name AS disaster_name, d.type AS disaster_type, d.severity
       FROM notifications n
       LEFT JOIN disasters d ON n.disaster_id = d.id
       WHERE n.user_id = ?
       ORDER BY n.created_at DESC
       LIMIT ? OFFSET ?`
        ).all(req.user.id, Number(limit), Number(offset));

        const unreadCount = db.prepare(
            'SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND read_status = 0'
        ).get(req.user.id);

        res.json({
            success: true,
            notifications,
            unreadCount: unreadCount.count,
        });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// PATCH /api/notifications/:id/read
const markRead = async (req, res) => {
    try {
        db.prepare(
            'UPDATE notifications SET read_status = 1 WHERE id = ? AND user_id = ?'
        ).run(req.params.id, req.user.id);
        res.json({ success: true, message: 'Marked as read' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// PATCH /api/notifications/read-all
const markAllRead = async (req, res) => {
    try {
        db.prepare(
            'UPDATE notifications SET read_status = 1 WHERE user_id = ?'
        ).run(req.user.id);
        res.json({ success: true, message: 'All notifications marked as read' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

module.exports = { getNotifications, markRead, markAllRead };
