const { z } = require('zod');
const { PLATFORMS } = require('../models');
const search = require('../services/search');
const aliexpress = require('../services/aliexpressCheck');
const ebay = require('../services/ebayCheck');
const { config } = require('../config/env');
const AppError = require('../utils/AppError');

const bool = z.enum(['true', 'false', '1', '0']).transform((v) => v === 'true' || v === '1');
const num = (min = 0) => z.coerce.number().min(min).finite();

const searchQuerySchema = z
  .object({
    q: z.string().trim().min(2, 'Search for at least 2 characters').max(100).optional(),
    category: z.string().trim().max(60).optional(),
    platform: z
      .string()
      .transform((s) => s.split(',').map((p) => p.trim().toLowerCase()).filter(Boolean))
      .pipe(z.array(z.enum(PLATFORMS)))
      .optional(),
    minPrice: num().optional(),
    maxPrice: num().optional(),
    minRating: num().pipe(z.number().max(5)).optional(),
    sort: z.enum(['relevance', 'price_asc', 'price_desc', 'rating', 'discount']).default('relevance'),
    page: z.coerce.number().int().min(1).max(100).default(1),
    pageSize: z.coerce.number().int().min(1).max(48).default(12),
    limit: z.coerce.number().int().min(1).max(400).default(24), // live search: how many results to return (more are loaded from the stores on demand)
    live: bool.default('true'),
    refresh: bool.default('false'), // ignore an earlier live result and check the stores again
  })
  .refine((v) => v.q || v.category, { message: 'Provide a search term (q) or a category', path: ['q'] })
  .refine((v) => v.minPrice === undefined || v.maxPrice === undefined || v.minPrice <= v.maxPrice, {
    message: 'Minimum price cannot be greater than maximum price',
    path: ['minPrice'],
  });

const aliexpressBodySchema = z.object({ q: z.string().trim().min(2, 'Search for at least 2 characters').max(100) });
const ebayBodySchema = aliexpressBodySchema;

async function checkAliExpress(req, res) {
  if (config.demoMode) throw new AppError(409, 'Demo mode: live store checks are switched off.');
  res.json(await aliexpress.checkAliExpress(req.body.q));
}

async function checkEbay(req, res) {
  if (config.demoMode) throw new AppError(409, 'Demo mode: live store checks are switched off.');
  res.json(await ebay.checkEbay(req.body.q));
}

async function searchProducts(req, res) {
  res.json(await search.search(req.validQuery));
}

module.exports = { searchProducts, searchQuerySchema, checkAliExpress, aliexpressBodySchema, checkEbay, ebayBodySchema };
