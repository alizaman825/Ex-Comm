const express = require('express');
const ctrl = require('../controllers/reports.controller');
const validate = require('../middleware/validate');
const { reportLimiter } = require('../middleware/rateLimit');
const ah = require('../utils/asyncHandler');

module.exports = () => {
  const router = express.Router();
  router.post('/', reportLimiter(), validate({ body: ctrl.createSchema }), ah(ctrl.create));
  return router;
};
