const router = require('express').Router();
const ctrl = require('../controllers/orderController');

router.get('/', ctrl.getAll);
router.post('/', ctrl.create);
router.put('/:id/status', ctrl.updateStatus);
router.get('/:id/mrp', ctrl.checkMRP);

module.exports = router;
