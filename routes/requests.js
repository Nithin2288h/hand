const express = require('express');
const { body } = require('express-validator');
const { createRequest, getRequests, updateRequestStatus } = require('../controllers/requestController');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/role');
const validate = require('../middleware/validate');

const router = express.Router();

router.get('/', authenticate, getRequests);

router.post('/', authenticate, authorize('citizen', 'admin'), [
    body('need_type').isIn(['Food', 'Water', 'Medical', 'Shelter', 'Rescue', 'Clothing', 'Other']),
    body('latitude').isFloat({ min: -90, max: 90 }),
    body('longitude').isFloat({ min: -180, max: 180 }),
    validate,
], createRequest);

router.patch('/:id/status', authenticate, authorize('admin', 'volunteer'), [
    body('status').isIn(['Pending', 'Assigned', 'In Progress', 'Completed', 'Cancelled']),
    validate,
], updateRequestStatus);

module.exports = router;
