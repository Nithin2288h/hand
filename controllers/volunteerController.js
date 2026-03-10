const db = require('../config/db');

// GET /api/volunteers
const getVolunteers = async (req, res) => {
    try {
        const volunteers = db.prepare(
            `SELECT id, name, email, phone, latitude, longitude, is_available, organization, created_at, age, eligibility_status
       FROM users WHERE role = 'volunteer' ORDER BY is_available DESC, created_at DESC`
        ).all();
        res.json({ success: true, volunteers });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// PATCH /api/volunteers/availability
const updateAvailability = async (req, res) => {
    try {
        const { is_available } = req.body;
        db.prepare('UPDATE users SET is_available = ? WHERE id = ?').run(is_available ? 1 : 0, req.user.id);
        res.json({ success: true, message: `Availability set to ${is_available}` });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// GET /api/volunteers/assignments
const getMyAssignments = async (req, res) => {
    try {
        const assignments = db.prepare(
            `SELECT va.*, r.need_type, r.description, r.urgency, r.latitude AS req_lat, r.longitude AS req_lng,
              r.status AS request_status, r.people_count,
              u.name AS citizen_name, u.phone AS citizen_phone,
              d.name AS disaster_name, d.type AS disaster_type
       FROM volunteer_assignments va
       LEFT JOIN requests r ON va.request_id = r.id
       LEFT JOIN users u ON r.citizen_id = u.id
       LEFT JOIN disasters d ON va.disaster_id = d.id
       WHERE va.volunteer_id = ?
       ORDER BY va.assigned_at DESC`
        ).all(req.user.id);
        res.json({ success: true, assignments });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// PATCH /api/volunteers/assignments/:id/status
const updateAssignmentStatus = async (req, res) => {
    const io = req.app.get('io');
    try {
        const { status } = req.body;

        if (status === 'Completed') {
            db.prepare(
                `UPDATE volunteer_assignments SET status = ?, completed_at = datetime('now') WHERE id = ? AND volunteer_id = ?`
            ).run(status, req.params.id, req.user.id);
        } else {
            db.prepare(
                `UPDATE volunteer_assignments SET status = ?, completed_at = NULL WHERE id = ? AND volunteer_id = ?`
            ).run(status, req.params.id, req.user.id);
        }

        const assignment = db.prepare('SELECT * FROM volunteer_assignments WHERE id = ? AND volunteer_id = ?').get(req.params.id, req.user.id);
        if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found' });

        // Update request status too
        const reqStatus = status === 'Completed' ? 'Completed' : 'In Progress';
        db.prepare(
            `UPDATE requests SET status = ?, updated_at = datetime('now') WHERE id = ?`
        ).run(reqStatus, assignment.request_id);

        const request = db.prepare('SELECT citizen_id FROM requests WHERE id = ?').get(assignment.request_id);

        if (io && request) {
            io.to(`user_${request.citizen_id}`).emit('request_updated', {
                request_id: assignment.request_id,
                status: reqStatus,
            });
        }

        res.json({ success: true, assignment });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// PATCH /api/volunteers/profile
const updateProfile = async (req, res) => {
    try {
        const {
            name, age, phone, emergency_contact, city, blood_group,
            fitness_level, can_lift_heavy, is_first_aid_trained,
            available_emergency, medical_conditions, medical_description
        } = req.body;

        // Eligibility Logic
        let status = 'Eligible';
        let message = 'You are Eligible for Disaster Field Operations.';

        if (age < 20 || age > 30) {
            status = 'Ineligible';
            message = 'Sorry, you are currently not eligible for disaster field volunteering due to age criteria.';
        } else if (fitness_level === 'Low' || can_lift_heavy === 0) {
            status = 'Limited Capability';
            message = 'You are registered but marked as Limited Capability Volunteer.';
        }

        db.prepare(`
            UPDATE users SET 
                name = ?, age = ?, phone = ?, emergency_contact = ?, city = ?, blood_group = ?,
                fitness_level = ?, can_lift_heavy = ?, is_first_aid_trained = ?, 
                available_emergency = ?, medical_conditions = ?, medical_description = ?,
                eligibility_status = ?, has_completed_test = 1
            WHERE id = ?
        `).run(
            name, age, phone, emergency_contact, city, blood_group,
            fitness_level, can_lift_heavy ? 1 : 0, is_first_aid_trained ? 1 : 0,
            available_emergency ? 1 : 0, medical_conditions ? 1 : 0, medical_description,
            status, req.user.id
        );

        const updatedUser = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
        delete updatedUser.password;

        res.json({
            success: true,
            status,
            message,
            user: updatedUser
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

module.exports = { getVolunteers, updateAvailability, getMyAssignments, updateAssignmentStatus, updateProfile };
