const db = require('../config/db');
const https = require('https');

// ─────────────────────────────────────────────
// Utility: Haversine Distance (km)
// ─────────────────────────────────────────────
function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─────────────────────────────────────────────
// POST /api/emergency/sos
// ─────────────────────────────────────────────
const triggerSOS = (req, res) => {
    const citizenId = req.user.id;
    const { latitude, longitude, alert_type = 'General', message = '' } = req.body;

    if (!latitude || !longitude) {
        return res.status(400).json({ success: false, message: 'Location coordinates required.' });
    }

    // Save emergency request
    const insert = db.prepare(`
    INSERT INTO citizen_emergency_requests (citizen_id, latitude, longitude, alert_type, message, status)
    VALUES (?, ?, ?, ?, ?, 'Active')
  `);
    const result = insert.run(citizenId, latitude, longitude, alert_type, message);

    // Find nearby NGOs (100km) and Volunteers (50km)
    const users = db.prepare(`SELECT id, name, role, latitude, longitude FROM users WHERE latitude IS NOT NULL`).all();
    const citizen = db.prepare('SELECT name FROM users WHERE id = ?').get(citizenId);

    const nearbyNGOs = users.filter(
        u => u.role === 'ngo' && haversine(latitude, longitude, u.latitude, u.longitude) <= 100
    );
    const nearbyVolunteers = users.filter(
        u => u.role === 'volunteer' && haversine(latitude, longitude, u.latitude, u.longitude) <= 50
    );

    // Broadcast via Socket.io
    const io = req.app.get('io');
    if (io) {
        const alertPayload = {
            type: 'SOS_ALERT',
            requestId: result.lastInsertRowid,
            citizenId,
            citizenName: citizen?.name ?? 'Unknown',
            latitude,
            longitude,
            alert_type,
            message,
            timestamp: new Date().toISOString(),
        };

        [...nearbyNGOs, ...nearbyVolunteers].forEach(u => {
            io.to(`user_${u.id}`).emit('sos_alert', alertPayload);
        });

        // Broadcast to admin room too
        io.emit('new_sos_alert', alertPayload);
    }

    res.status(201).json({
        success: true,
        message: `SOS sent! Notified ${nearbyNGOs.length} NGOs and ${nearbyVolunteers.length} volunteers nearby.`,
        requestId: result.lastInsertRowid,
        notified: { ngos: nearbyNGOs.length, volunteers: nearbyVolunteers.length },
    });
};

// ─────────────────────────────────────────────
// POST /api/citizen/location
// ─────────────────────────────────────────────
const updateLiveLocation = (req, res) => {
    const citizenId = req.user.id;
    const { latitude, longitude } = req.body;

    if (!latitude || !longitude) {
        return res.status(400).json({ success: false, message: 'Coordinates required.' });
    }

    // Upsert into citizen_locations
    db.prepare(`
    INSERT INTO citizen_locations (citizen_id, latitude, longitude, timestamp)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
  `).run(citizenId, latitude, longitude);

    // Update user's current location
    db.prepare('UPDATE users SET latitude = ?, longitude = ? WHERE id = ?').run(latitude, longitude, citizenId);

    // Broadcast via socket
    const io = req.app.get('io');
    if (io) {
        const user = db.prepare('SELECT id, name, role FROM users WHERE id = ?').get(citizenId);
        io.emit('citizen_location_update', {
            userId: citizenId,
            name: user?.name,
            latitude,
            longitude,
            timestamp: new Date().toISOString(),
        });
    }

    res.json({ success: true, message: 'Location updated and broadcast.' });
};

// ─────────────────────────────────────────────
// GET /api/weather?lat=&lon=
// ─────────────────────────────────────────────
const getWeather = (req, res) => {
    const { lat, lon } = req.query;
    if (!lat || !lon) {
        return res.status(400).json({ success: false, message: 'lat and lon are required.' });
    }

    const apiKey = process.env.OPENWEATHER_API_KEY;

    // If no API key, return realistic mock data
    if (!apiKey || apiKey === 'your_openweather_key_here') {
        return res.json({
            success: true,
            mock: true,
            weather: {
                temp: 28.5,
                feels_like: 31.2,
                condition: 'Partly Cloudy',
                icon: '02d',
                humidity: 72,
                wind_speed: 14.4,
                visibility: 8,
                city: 'Your Location',
                pressure: 1012,
            },
        });
    }

    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;
    https.get(url, (apiRes) => {
        let data = '';
        apiRes.on('data', chunk => (data += chunk));
        apiRes.on('end', () => {
            try {
                const parsed = JSON.parse(data);
                if (parsed.cod !== 200) {
                    return res.status(502).json({ success: false, message: 'Weather API error.' });
                }
                res.json({
                    success: true,
                    weather: {
                        temp: Math.round(parsed.main.temp),
                        feels_like: Math.round(parsed.main.feels_like),
                        condition: parsed.weather[0].main,
                        icon: parsed.weather[0].icon,
                        humidity: parsed.main.humidity,
                        wind_speed: Math.round(parsed.wind.speed * 3.6),
                        visibility: Math.round((parsed.visibility || 10000) / 1000),
                        city: parsed.name,
                        pressure: parsed.main.pressure,
                    },
                });
            } catch (e) {
                res.status(500).json({ success: false, message: 'Failed to parse weather data.' });
            }
        });
    }).on('error', () => {
        res.status(502).json({ success: false, message: 'Failed to reach weather service.' });
    });
};

// ─────────────────────────────────────────────
// GET /api/hospitals?lat=&lon=
// ─────────────────────────────────────────────
const getHospitals = (req, res) => {
    const { lat, lon } = req.query;
    if (!lat || !lon) {
        return res.status(400).json({ success: false, message: 'lat and lon are required.' });
    }

    // Return mock hospitals (Google Places requires billing-enabled key)
    // When you have a key, swap with Places API call
    const hospitals = [
        { name: 'Apollo Hospital', address: 'Greams Rd, Chennai', distance: 1.8, phone: '044-28293333', lat: parseFloat(lat) + 0.01, lon: parseFloat(lon) + 0.01 },
        { name: 'Fortis Malar Hospital', address: 'Gandhi Irwin Rd, Chennai', distance: 3.2, phone: '044-42892222', lat: parseFloat(lat) - 0.02, lon: parseFloat(lon) + 0.02 },
        { name: 'MIOT International', address: 'MT Road, Chennai', distance: 5.5, phone: '044-22490900', lat: parseFloat(lat) + 0.03, lon: parseFloat(lon) - 0.01 },
        { name: 'Vijaya Hospital', address: 'NSK Salai, Chennai', distance: 7.1, phone: '044-24810000', lat: parseFloat(lat) - 0.04, lon: parseFloat(lon) - 0.02 },
    ];

    res.json({ success: true, hospitals });
};

// ─────────────────────────────────────────────
// GET /api/safety/zones
// ─────────────────────────────────────────────
const getSafeZones = (req, res) => {
    try {
        const zones = db.prepare('SELECT * FROM safe_zones WHERE is_active = 1').all();
        res.json({ success: true, zones });
    } catch (e) {
        res.status(500).json({ success: false, message: 'Could not load safe zones.' });
    }
};

// ─────────────────────────────────────────────
// GET /api/emergency/sos - list citizen's own SOS requests
// ─────────────────────────────────────────────
const getMySOS = (req, res) => {
    const citizenId = req.user.id;
    const requests = db.prepare(
        'SELECT * FROM citizen_emergency_requests WHERE citizen_id = ? ORDER BY created_at DESC LIMIT 10'
    ).all(citizenId);
    res.json({ success: true, requests });
};

module.exports = { triggerSOS, updateLiveLocation, getWeather, getHospitals, getSafeZones, getMySOS };
