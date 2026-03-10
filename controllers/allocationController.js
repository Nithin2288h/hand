const db = require('../config/db');

/**
 * POST /api/allocate
 * Allocation Engine using SQLite transaction
 */
const allocate = async (req, res) => {
    const io = req.app.get('io');

    try {
        const allocateTransaction = db.transaction(() => {
            // Get pending requests sorted by urgency and time
            const requests = db.prepare(
                `SELECT r.* FROM requests r
       INNER JOIN disasters d ON r.disaster_id = d.id
       WHERE r.status = 'Pending' AND d.status = 'Active'
       ORDER BY
         CASE r.urgency WHEN 'Critical' THEN 1 WHEN 'High' THEN 2 WHEN 'Medium' THEN 3 ELSE 4 END,
         r.created_at ASC
       LIMIT 20`
            ).all();

            if (requests.length === 0) {
                return { allocated: [], message: 'No pending requests to allocate' };
            }

            const allocated = [];
            const usedVolunteers = new Set();

            for (const request of requests) {
                // Find available volunteer not already used in this batch
                const volunteers = db.prepare(
                    `SELECT u.id FROM users u
          WHERE u.role = 'volunteer' AND u.is_available = 1 AND u.eligibility_status = 'Eligible'
          AND u.id NOT IN (
            SELECT va.volunteer_id FROM volunteer_assignments va WHERE va.status IN ('Assigned', 'In Progress')
          )`
                ).all();

                const volunteer = volunteers.find(v => !usedVolunteers.has(v.id));
                if (!volunteer) continue;

                usedVolunteers.add(volunteer.id);

                // Find matching resource
                const resource = db.prepare(
                    `SELECT id FROM resources
          WHERE status = 'Available' AND quantity > 0
          ORDER BY quantity DESC LIMIT 1`
                ).get();

                const resourceId = resource ? resource.id : null;

                // Create assignment
                const assignResult = db.prepare(
                    `INSERT INTO volunteer_assignments (volunteer_id, request_id, resource_id, disaster_id, status)
          VALUES (?, ?, ?, ?, 'Assigned')`
                ).run(volunteer.id, request.id, resourceId, request.disaster_id);

                const assignment = db.prepare('SELECT * FROM volunteer_assignments WHERE id = ?').get(assignResult.lastInsertRowid);

                // Update request status
                db.prepare(
                    `UPDATE requests SET status = 'Assigned', updated_at = datetime('now') WHERE id = ?`
                ).run(request.id);

                // Mark volunteer as unavailable
                db.prepare('UPDATE users SET is_available = 0 WHERE id = ?').run(volunteer.id);

                // Mark resource as Reserved
                if (resourceId) {
                    db.prepare(
                        `UPDATE resources SET status = 'Reserved', updated_at = datetime('now') WHERE id = ?`
                    ).run(resourceId);
                }

                allocated.push({ assignment, request, volunteer_id: volunteer.id });
            }

            return { allocated };
        });

        const result = allocateTransaction();

        // Send Socket.io notifications outside the transaction
        if (io) {
            for (const item of result.allocated) {
                io.to(`user_${item.volunteer_id}`).emit('assignment_created', {
                    assignment: item.assignment,
                    request: item.request,
                });
                io.to(`user_${item.request.citizen_id}`).emit('request_updated', {
                    request_id: item.request.id,
                    status: 'Assigned',
                    message: 'A volunteer has been assigned to your request!',
                });
            }
        }

        res.json({
            success: true,
            message: `Allocation complete. ${result.allocated.length} request(s) assigned.`,
            allocated: result.allocated.length,
            assignments: result.allocated,
        });
    } catch (err) {
        console.error('Allocation error:', err.message);
        res.status(500).json({ success: false, message: 'Server error during allocation' });
    }
};

module.exports = { allocate };
