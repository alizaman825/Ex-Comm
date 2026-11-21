const express = require('express');
const ctrl = require('../controllers/contact.controller');
const validate = require('../middleware/validate');
const { contactLimiter } = require('../middleware/rateLimit');
const { requireJobKey } = require('../middleware/jobAuth');
const ah = require('../utils/asyncHandler');

module.exports = () => {
  const router = express.Router();
  router.post('/', contactLimiter(), validate({ body: ctrl.createSchema }), ah(ctrl.create));
  // GET /api/contact: owner-only (x-job-key header, same key as /api/jobs/* and /api/reports).
  router.get('/', requireJobKey, validate({ query: ctrl.listQuerySchema }), ah(ctrl.list));
  return router;
};
