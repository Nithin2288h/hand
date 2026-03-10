const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
    triggerSOS,
    updateLiveLocation,
    getWeather,
    getHospitals,
    getSafeZones,
    getMySOS,
} = require('../controllers/emergencyController');

// Weather (public - no auth needed for weather)
router.get('/weather', getWeather);

// Hospitals
router.get('/hospitals', auth, getHospitals);

// Safe Zones
router.get('/safety/zones', getSafeZones);

// SOS
router.post('/emergency/sos', auth, triggerSOS);
router.get('/emergency/sos', auth, getMySOS);

// Live Location
router.post('/citizen/location', auth, updateLiveLocation);

module.exports = router;
