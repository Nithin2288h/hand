const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

const generateToken = (user) => {
    return jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
};

const { checkVolunteerEligibility } = require('../utils/volunteer_helper');

// POST /api/auth/register
const register = async (req, res) => {
    try {
        const { name, email, password, role, latitude, longitude, phone, organization, age } = req.body;

        const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
        if (existing) {
            return res.status(409).json({ success: false, message: 'Email already registered' });
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        // Check eligibility if volunteer
        let eligibilityStatus = 'Eligible';
        if (role === 'volunteer') {
            const eligibility = checkVolunteerEligibility(age || 0);
            eligibilityStatus = eligibility.status;
        }

        const result = db.prepare(
            `INSERT INTO users (name, email, password, role, latitude, longitude, phone, organization, age, eligibility_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(name, email, hashedPassword, role || 'citizen', latitude || null, longitude || null, phone || null, organization || null, age || null, eligibilityStatus);

        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
        delete user.password;
        const token = generateToken(user);

        res.status(201).json({ success: true, message: 'Registration successful', token, user });
    } catch (err) {
        console.error('Register error:', err.message);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// POST /api/auth/login
const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Email and password are required' });
        }

        const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid email or password' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid email or password' });
        }

        const userWithoutPassword = { ...user };
        delete userWithoutPassword.password;

        const token = generateToken(user);

        res.json({ success: true, message: 'Login successful', token, user: userWithoutPassword });
    } catch (err) {
        console.error('Login error:', err.message);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// GET /api/auth/me
const getMe = async (req, res) => {
    try {
        res.json({ success: true, user: req.user });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// GET /api/auth/users (admin only)
const getAllUsers = async (req, res) => {
    try {
        const users = db.prepare(
            'SELECT id, name, email, role, latitude, longitude, phone, organization, is_available, created_at FROM users ORDER BY created_at DESC'
        ).all();
        res.json({ success: true, users });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// POST /api/auth/fcm-token  (authenticated)
const saveFcmToken = async (req, res) => {
    try {
        const { fcm_token } = req.body;
        if (!fcm_token) {
            return res.status(400).json({ success: false, message: 'fcm_token is required' });
        }
        db.prepare('UPDATE users SET fcm_token = ? WHERE id = ?').run(fcm_token, req.user.id);
        console.log(`[FCM] ✅ Token saved for user ${req.user.id}`);
        res.json({ success: true, message: 'FCM token saved' });
    } catch (err) {
        console.error('Save FCM token error:', err.message);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

module.exports = { register, login, getMe, getAllUsers, saveFcmToken };
