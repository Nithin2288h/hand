const db = require('../config/db');

// POST /api/requests
const createRequest = async (req, res) => {
    try {
        const { disaster_id, need_type, description, urgency, latitude, longitude, people_count } = req.body;
        const result = db.prepare(
            `INSERT INTO requests (citizen_id, disaster_id, need_type, description, urgency, latitude, longitude, people_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(req.user.id, disaster_id || null, need_type, description || '', urgency || 'Medium', latitude, longitude, people_count || 1);

        const request = db.prepare('SELECT * FROM requests WHERE id = ?').get(result.lastInsertRowid);

        const io = req.app.get('io');
        if (io) io.emit('request_created', { request });

        res.status(201).json({ success: true, request });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// GET /api/requests
const getRequests = async (req, res) => {
    try {
        const { status, disaster_id, page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;
        const params = [];
        let conditions = [];

        if (status) { params.push(status); conditions.push(`r.status = ?`); }
        if (disaster_id) { params.push(disaster_id); conditions.push(`r.disaster_id = ?`); }

        // Citizens see only their own
        if (req.user.role === 'citizen') {
            params.push(req.user.id);
            conditions.push(`r.citizen_id = ?`);
        }

        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
        params.push(Number(limit), Number(offset));

        const requests = db.prepare(
            `SELECT r.*, u.name AS citizen_name, d.name AS disaster_name
       FROM requests r
       LEFT JOIN users u ON r.citizen_id = u.id
       LEFT JOIN disasters d ON r.disaster_id = d.id
       ${where} ORDER BY
         CASE r.urgency WHEN 'Critical' THEN 1 WHEN 'High' THEN 2 WHEN 'Medium' THEN 3 ELSE 4 END,
         r.created_at ASC
       LIMIT ? OFFSET ?`
        ).all(...params);

        res.json({ success: true, requests });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// PATCH /api/requests/:id/status
const updateRequestStatus = async (req, res) => {
    try {
        const { status } = req.body;
        db.prepare(
            `UPDATE requests SET status = ?, updated_at = datetime('now') WHERE id = ?`
        ).run(status, req.params.id);

        const request = db.prepare('SELECT * FROM requests WHERE id = ?').get(req.params.id);
        if (!request) return res.status(404).json({ success: false, message: 'Request not found' });

        const io = req.app.get('io');
        if (io) {
            io.to(`user_${request.citizen_id}`).emit('request_updated', { request });
        }

        res.json({ success: true, request });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

module.exports = { createRequest, getRequests, updateRequestStatus };
