const express = require('express');
const { body } = require('express-validator');
const { createResource, getResources, updateResource, deleteResource } = require('../controllers/resourceController');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/role');
const validate = require('../middleware/validate');

const router = express.Router();

router.get('/', authenticate, getResources);

router.post('/', authenticate, authorize('ngo', 'admin'), [
    body('type').notEmpty(),
    body('name').notEmpty(),
    body('quantity').isInt({ min: 0 }),
    validate,
], createResource);

router.put('/:id', authenticate, authorize('ngo', 'admin'), updateResource);
router.delete('/:id', authenticate, authorize('ngo', 'admin'), deleteResource);

module.exports = router;
