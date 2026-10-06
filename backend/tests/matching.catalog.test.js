// Matching sanity check over the whole seed catalog: platform-style titles must match their own
// product (no false negatives) and no two different catalog products may match (no false positives).
const catalog = require('../src/seed/catalog');
const { isSameProduct, analyzeTitle } = require('../src/services/matching');

const variants = (t) => [
  `${t} - PTA Approved - Official Warranty`,
  `${t} - Original - Official Warranty`,
  `${t} Global Version`,
  `${t} (Black)`,
];

test('platform-style titles match their own product', () => {
  const misses = [];
  for (const { t } of catalog) {
    for (const v of variants(t)) if (!isSameProduct(v, t)) misses.push(v);
  }
  expect(misses).toEqual([]);
});

test('different catalog products never match each other', () => {
  const clashes = [];
  const analyzed = catalog.map((c) => analyzeTitle(c.t));
  for (let i = 0; i < catalog.length; i += 1) {
    for (let j = i + 1; j < catalog.length; j += 1) {
      if (isSameProduct(analyzed[i], analyzed[j])) clashes.push(`${catalog[i].t} ~ ${catalog[j].t}`);
    }
  }
  expect(clashes).toEqual([]);
});
