const express = require('express');
const ctrl = require('../controllers/user.controller');
const validate = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const ah = require('../utils/asyncHandler');

module.exports = () => {
  const router = express.Router();
  // Every route here modifies only the signed-in user's own account.
  router.use(requireAuth);
  router.patch('/me', validate({ body: ctrl.updateProfileSchema }), ah(ctrl.updateProfile));
  router.patch('/me/password', validate({ body: ctrl.changePasswordSchema }), ah(ctrl.changePassword));
  router.delete('/me', validate({ body: ctrl.deleteAccountSchema }), ah(ctrl.deleteAccount));
  return router;
};
