// URL -> controller mapping. Login wale routes upar, baaki sab login ke baad
const router = require('express').Router();
const { wrap: w, requireLogin, loginLimiter } = require('./middleware');
const auth = require('./controllers/auth'), dashboard = require('./controllers/dashboard');
const search = require('./controllers/search'), trash = require('./controllers/trash');
const godown = require('./controllers/godown'), rack = require('./controllers/rack'), orders = require('./controllers/orders');

// --- bina login ---
router.get('/login', auth.page);
router.post('/login', loginLimiter, w(auth.login));
router.post('/logout', auth.logout);

// --- yaha se neeche sab login maangta hai ---
router.use(requireLogin);
router.get('/', w(dashboard.show));

router.get('/search', w(search.show));
router.get('/trash', w(trash.list));
router.post('/trash/:id/restore', w(trash.restore));
router.post('/trash/:id/delete', w(trash.purge));

router.get('/godown', w(godown.list));
router.post('/godown', w(godown.create));
router.post('/godown/:id/move', w(godown.move));
router.post('/godown/:id/edit', w(godown.edit));
router.post('/godown/:id/delete', w(godown.remove));

router.get('/rack', w(rack.list));
router.post('/rack', w(rack.createRack));
router.post('/rack/product', w(rack.createProduct));
router.post('/rack/product/:id/qty', w(rack.changeQty));
router.post('/rack/product/:id/edit', w(rack.editProduct));
router.post('/rack/product/:id/delete', w(rack.removeProduct));
router.post('/rack/:id/:op', w(rack.edit)); // op = add | rename | delete

router.get('/orders', w(orders.list));
router.get('/orders/new', w(orders.newForm)); // ':id' se pehle hona zaroori hai
router.post('/orders', w(orders.create));
router.get('/orders/:id', w(orders.show));
router.get('/orders/:id/bill', w(orders.bill));
router.get('/orders/:id/items', w(orders.itemsForm));
router.post('/orders/:id/items', w(orders.saveItems));
router.post('/orders/:id/edit', w(orders.edit));
router.post('/orders/:id/pay', w(orders.pay));
router.post('/orders/:id/status', w(orders.status));
router.post('/orders/:id/delete', w(orders.remove));

module.exports = router;
