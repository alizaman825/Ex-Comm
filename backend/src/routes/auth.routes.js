const express = require('express');
const ctrl = require('../controllers/auth.controller');
const validate = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimit');
const ah = require('../utils/asyncHandler');

module.exports = () => {
  const router = express.Router();
  const limiter = authLimiter();
  router.post('/register', limiter, validate({ body: ctrl.registerSchema }), ah(ctrl.register));
  router.post('/login', limiter, validate({ body: ctrl.loginSchema }), ah(ctrl.login));
  router.post('/logout', ctrl.logout);
  router.get('/me', requireAuth, ctrl.me);
  return router;
};
