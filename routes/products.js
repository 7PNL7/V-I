const router = require('express').Router();
const ctrl = require('../controllers/productController');

router.get('/', ctrl.getAll);
router.get('/api', ctrl.getJSON);
router.post('/', ctrl.create);
router.put('/:id', ctrl.update);
router.delete('/:id', ctrl.remove);
router.get('/:id/bom', ctrl.getBOM);
router.post('/:id/bom', ctrl.addBOM);
router.delete('/:id/bom/:nlId', ctrl.removeBOM);

module.exports = router;
