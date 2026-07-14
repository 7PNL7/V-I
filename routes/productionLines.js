const router = require('express').Router();
const ctrl = require('../controllers/productionLineController');

router.get('/', ctrl.getAll);
router.get('/:id/detail', ctrl.getDetail);
router.put('/:id/status', ctrl.updateStatus);
router.put('/:id/steps', ctrl.updateStepStatus);

module.exports = router;
