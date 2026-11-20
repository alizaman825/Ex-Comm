const express = require('express');
const ctrl = require('../controllers/reports.controller');
const validate = require('../middleware/validate');
const { reportLimiter } = require('../middleware/rateLimit');
const { requireJobKey } = require('../middleware/jobAuth');
const ah = require('../utils/asyncHandler');

module.exports = () => {
  const router = express.Router();
  router.post('/', reportLimiter(), validate({ body: ctrl.createSchema }), ah(ctrl.create));
  // GET /api/reports: owner-only (x-job-key header, same key as /api/jobs/*), no admin UI yet.
  router.get('/', requireJobKey, validate({ query: ctrl.listQuerySchema }), ah(ctrl.list));
  return router;
};
