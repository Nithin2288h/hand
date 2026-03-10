const express = require('express');
const { body } = require('express-validator');
const {
    createDisaster, getDisasters, getDisasterById,
    updateDisasterStatus, updateDisaster, getStats
} = require('../controllers/disasterController');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/role');
const validate = require('../middleware/validate');

const router = express.Router();

router.get('/stats', authenticate, getStats);
router.get('/', authenticate, getDisasters);
router.get('/:id', authenticate, getDisasterById);

router.post(
    '/',
    authenticate,
    authorize('admin'),
    [
        body('name').notEmpty().withMessage('Name required'),
        body('type').isIn(['Flood', 'Earthquake', 'Cyclone', 'Fire', 'Tsunami', 'Landslide', 'Drought', 'Other']),
        body('latitude').isFloat({ min: -90, max: 90 }),
        body('longitude').isFloat({ min: -180, max: 180 }),
        body('severity').optional().isIn(['Low', 'Medium', 'High', 'Critical']),
        body('radius_km').optional().isInt({ min: 1, max: 1000 }),
        validate,
    ],
    createDisaster
);

router.put('/:id', authenticate, authorize('admin'), updateDisaster);
router.patch('/:id/status', authenticate, authorize('admin'), [
    body('status').isIn(['Active', 'Closed']),
    validate,
], updateDisasterStatus);

module.exports = router;
