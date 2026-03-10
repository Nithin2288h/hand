const express = require('express');
const { allocate } = require('../controllers/allocationController');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/role');

const router = express.Router();

// POST /api/allocate
router.post('/', authenticate, authorize('admin'), allocate);

module.exports = router;
