const express = require('express');
const { body } = require('express-validator');
const {
    getVolunteers, updateAvailability, getMyAssignments, updateAssignmentStatus, updateProfile
} = require('../controllers/volunteerController');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/role');
const validate = require('../middleware/validate');

const router = express.Router();

router.get('/', authenticate, authorize('admin'), getVolunteers);
router.patch('/availability', authenticate, authorize('volunteer'), [
    body('is_available').isBoolean(), validate,
], updateAvailability);
router.get('/assignments', authenticate, authorize('volunteer'), getMyAssignments);
router.patch('/assignments/:id/status', authenticate, authorize('volunteer'), [
    body('status').isIn(['In Progress', 'Completed', 'Cancelled']), validate,
], updateAssignmentStatus);
router.patch('/profile', authenticate, authorize('volunteer'), updateProfile);

module.exports = router;
