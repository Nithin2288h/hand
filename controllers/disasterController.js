const db = require('../config/db');
const { haversineDistance } = require('../utils/haversine');
const AlertNotificationService = require('../services/AlertNotificationService');
const fcmService = require('../services/fcmService');

// Helper: send notifications to users within radius
const sendGeoNotifications = async (io, disaster) => {
    try {
        // Trigger the alerts in background (no await) so admin doesn't wait
        AlertNotificationService.sendDisasterAlerts(disaster).catch(err =>
            console.error('[DisasterController] Background alert error:', err.message)
        );

        const users = db.prepare(
            'SELECT id, name, email, phone, role, is_available, latitude, longitude FROM users WHERE latitude IS NOT NULL AND longitude IS NOT NULL'
        ).all();

        const notifiedUsers = [];
        for (const user of users) {
            const dist = haversineDistance(
                parseFloat(disaster.latitude),
                parseFloat(disaster.longitude),
                parseFloat(user.latitude),
                parseFloat(user.longitude)
            );

            // Determine if this user is within the notification radius
            console.log(`[GeoCheck] User: ${user.name}, Role: ${user.role}, Distance: ${dist.toFixed(2)}km, Radius: ${disaster.radius_km}km`);

            if (dist <= disaster.radius_km || dist <= 100) {
                console.log(`[GeoMatch] Match! User ${user.name} is within range.`);
                const message = `⚠️ DISASTER ALERT: ${disaster.name} (${disaster.type}) - Severity: ${disaster.severity}. You are within ${Math.round(dist)} km of the affected area.`;

                // Standard In-App Notification (Always sent if within radius)
                if (dist <= disaster.radius_km) {
                    console.log(`[GeoInApp] Saving in-app alert for ${user.name}`);
                    const result = db.prepare(
                        `INSERT INTO notifications (user_id, disaster_id, type, message)
                         VALUES (?, ?, 'disaster_alert', ?)`
                    ).run(user.id, disaster.id, message);

                    const notification = db.prepare('SELECT * FROM notifications WHERE id = ?').get(result.lastInsertRowid);
                    if (io) {
                        io.to(`user_${user.id}`).emit('notification', { notification, disaster });
                    }
                    notifiedUsers.push(user.id);
                }

                // Multi-Channel External Alerts (Now handled by AlertNotificationService)
                // This service handles role-based alerts and 2-min repeats
            }
        }

        return notifiedUsers.length;
    } catch (err) {
        console.error('Geo-notification error:', err.message);
        return 0;
    }
};

// POST /api/disasters
const createDisaster = async (req, res) => {
    const io = req.app.get('io');
    try {
        const { name, type, severity, description, latitude, longitude, radius_km } = req.body;

        const result = db.prepare(
            `INSERT INTO disasters (name, type, severity, description, latitude, longitude, radius_km, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(name, type, severity || 'Medium', description || '', latitude, longitude, radius_km || 100, req.user.id);

        const disaster = db.prepare('SELECT * FROM disasters WHERE id = ?').get(result.lastInsertRowid);
        const notifiedCount = await sendGeoNotifications(io, disaster);

        // 🔔 Push notification to ALL users via FCM
        fcmService.sendToAllUsers(
            `⚠️ DISASTER ALERT: ${disaster.name}`,
            `${disaster.type} — Severity: ${disaster.severity}. Stay safe and follow emergency guidelines.`,
            {
                disasterId: String(disaster.id),
                type: disaster.type,
                severity: disaster.severity,
                latitude: String(disaster.latitude),
                longitude: String(disaster.longitude),
            }
        ).catch(err => console.error('[FCM] Push error:', err.message));

        if (io) {
            io.emit('disaster_created', { disaster, notifiedCount });
        }

        res.status(201).json({
            success: true,
            message: `Disaster created. ${notifiedCount} users notified within ${disaster.radius_km} km.`,
            disaster,
            notifiedCount,
        });
    } catch (err) {
        console.error('Create disaster error:', err.message);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// GET /api/disasters
const getDisasters = async (req, res) => {
    try {
        const { status, page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;

        let query = `SELECT d.*, u.name AS created_by_name FROM disasters d
                 LEFT JOIN users u ON d.created_by = u.id`;
        const params = [];

        if (status) {
            query += ' WHERE d.status = ?';
            params.push(status);
        }

        query += ` ORDER BY d.created_at DESC LIMIT ? OFFSET ?`;
        params.push(Number(limit), Number(offset));

        const disasters = db.prepare(query).all(...params);

        const countQuery = `SELECT COUNT(*) AS count FROM disasters${status ? ' WHERE status = ?' : ''}`;
        const countResult = db.prepare(countQuery).get(...(status ? [status] : []));

        res.json({
            success: true,
            disasters,
            total: countResult.count,
            page: parseInt(page),
            totalPages: Math.ceil(countResult.count / limit),
        });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// GET /api/disasters/:id
const getDisasterById = async (req, res) => {
    try {
        const disaster = db.prepare(
            `SELECT d.*, u.name AS created_by_name FROM disasters d
       LEFT JOIN users u ON d.created_by = u.id WHERE d.id = ?`
        ).get(req.params.id);

        if (!disaster) {
            return res.status(404).json({ success: false, message: 'Disaster not found' });
        }
        res.json({ success: true, disaster });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// PATCH /api/disasters/:id/status
const updateDisasterStatus = async (req, res) => {
    const io = req.app.get('io');
    try {
        const { status } = req.body;
        db.prepare(
            `UPDATE disasters SET status = ?, updated_at = datetime('now') WHERE id = ?`
        ).run(status, req.params.id);

        const disaster = db.prepare('SELECT * FROM disasters WHERE id = ?').get(req.params.id);
        if (!disaster) {
            return res.status(404).json({ success: false, message: 'Disaster not found' });
        }
        if (io) io.emit('disaster_updated', { disaster });
        res.json({ success: true, disaster });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// PUT /api/disasters/:id
const updateDisaster = async (req, res) => {
    try {
        const { name, type, severity, description, latitude, longitude, radius_km } = req.body;
        db.prepare(
            `UPDATE disasters SET name=?, type=?, severity=?, description=?, latitude=?, longitude=?, radius_km=?, updated_at=datetime('now')
       WHERE id=?`
        ).run(name, type, severity, description, latitude, longitude, radius_km, req.params.id);

        const disaster = db.prepare('SELECT * FROM disasters WHERE id = ?').get(req.params.id);
        if (!disaster) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, disaster });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// GET /api/disasters/stats
const getStats = async (req, res) => {
    try {
        const active = db.prepare("SELECT COUNT(*) AS count FROM disasters WHERE status = 'Active'").get();
        const total = db.prepare('SELECT COUNT(*) AS count FROM disasters').get();
        const pending = db.prepare("SELECT COUNT(*) AS count FROM requests WHERE status = 'Pending'").get();
        const resources = db.prepare("SELECT COALESCE(SUM(quantity), 0) AS total FROM resources WHERE status = 'Available'").get();
        const users = db.prepare('SELECT COUNT(*) AS count FROM users').get();
        const volunteers = db.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'volunteer' AND eligibility_status = 'Eligible'").get();

        res.json({
            success: true,
            stats: {
                activeDisasters: active.count,
                totalDisasters: total.count,
                pendingRequests: pending.count,
                totalResources: resources.total,
                totalUsers: users.count,
                totalVolunteers: volunteers.count,
            },
        });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

module.exports = { createDisaster, getDisasters, getDisasterById, updateDisasterStatus, updateDisaster, getStats };
