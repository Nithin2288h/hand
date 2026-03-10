const db = require('../config/db');

// POST /api/resources
const createResource = async (req, res) => {
    try {
        const { type, name, quantity, unit, latitude, longitude, disaster_id } = req.body;
        const result = db.prepare(
            `INSERT INTO resources (ngo_id, type, name, quantity, unit, latitude, longitude, disaster_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(req.user.id, type, name, quantity, unit || 'units', latitude || null, longitude || null, disaster_id || null);

        const resource = db.prepare('SELECT * FROM resources WHERE id = ?').get(result.lastInsertRowid);
        res.status(201).json({ success: true, resource });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// GET /api/resources
const getResources = async (req, res) => {
    try {
        const { status, ngo_id, page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;
        const params = [];
        let conditions = [];

        if (status) { params.push(status); conditions.push(`r.status = ?`); }
        if (ngo_id) { params.push(ngo_id); conditions.push(`r.ngo_id = ?`); }

        // NGOs can only see their own unless admin
        if (req.user.role === 'ngo') {
            params.push(req.user.id);
            conditions.push(`r.ngo_id = ?`);
        }

        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
        params.push(Number(limit), Number(offset));

        const resources = db.prepare(
            `SELECT r.*, u.name AS ngo_name FROM resources r
       LEFT JOIN users u ON r.ngo_id = u.id
       ${where} ORDER BY r.created_at DESC LIMIT ? OFFSET ?`
        ).all(...params);

        res.json({ success: true, resources });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// PUT /api/resources/:id
const updateResource = async (req, res) => {
    try {
        const { type, name, quantity, unit, status, latitude, longitude } = req.body;
        db.prepare(
            `UPDATE resources SET type=?, name=?, quantity=?, unit=?, status=?, latitude=?, longitude=?, updated_at=datetime('now')
       WHERE id=? AND ngo_id=?`
        ).run(type, name, quantity, unit, status, latitude, longitude, req.params.id, req.user.id);

        const resource = db.prepare('SELECT * FROM resources WHERE id = ? AND ngo_id = ?').get(req.params.id, req.user.id);
        if (!resource) return res.status(404).json({ success: false, message: 'Resource not found or unauthorized' });
        res.json({ success: true, resource });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// DELETE /api/resources/:id
const deleteResource = async (req, res) => {
    try {
        db.prepare('DELETE FROM resources WHERE id = ? AND ngo_id = ?').run(req.params.id, req.user.id);
        res.json({ success: true, message: 'Resource deleted' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

module.exports = { createResource, getResources, updateResource, deleteResource };
