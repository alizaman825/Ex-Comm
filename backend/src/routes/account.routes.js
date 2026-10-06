const express = require('express');
const wishlist = require('../controllers/wishlist.controller');
const alerts = require('../controllers/alerts.controller');
const notifications = require('../controllers/notifications.controller');
const validate = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const ah = require('../utils/asyncHandler');

// Wishlist, alerts and notifications: every route belongs to the signed-in user.
function wishlistRouter() {
  const router = express.Router();
  router.use(requireAuth);
  router.get('/', ah(wishlist.list));
  router.post('/', validate({ body: wishlist.addSchema }), ah(wishlist.add));
  router.delete('/:productId', validate({ params: wishlist.paramsSchema }), ah(wishlist.remove));
  return router;
}

function alertsRouter() {
  const router = express.Router();
  router.use(requireAuth);
  router.get('/', ah(alerts.list));
  router.post('/', validate({ body: alerts.createSchema }), ah(alerts.create));
  router.patch('/:id', validate({ params: alerts.idParams, body: alerts.updateSchema }), ah(alerts.update));
  router.delete('/:id', validate({ params: alerts.idParams }), ah(alerts.remove));
  return router;
}

function notificationsRouter() {
  const router = express.Router();
  router.use(requireAuth);
  router.get('/', validate({ query: notifications.listQuerySchema }), ah(notifications.list));
  router.get('/unread-count', ah(notifications.unreadCount));
  router.patch('/read-all', ah(notifications.markAllRead));
  router.patch('/:id/read', validate({ params: notifications.idParams }), ah(notifications.markRead));
  return router;
}

module.exports = { wishlistRouter, alertsRouter, notificationsRouter };
