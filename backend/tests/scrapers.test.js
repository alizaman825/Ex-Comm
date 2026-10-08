// Offline parser tests against saved responses (tests/fixtures, captured 2026-10-07).
const fs = require('fs');
const path = require('path');
const daraz = require('../src/scrapers/daraz');
const priceoye = require('../src/scrapers/priceoye');
const { PoliteQueue } = require('../src/scrapers/politeQueue');
const { parsePrice } = require('../src/scrapers/parse');

const fixture = (name) => fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8');

function expectValidListing(l, platform) {
  expect(l.platform).toBe(platform);
  expect(typeof l.externalId).toBe('string');
  expect(l.title.length).toBeGreaterThan(3);
  expect(l.url).toMatch(/^https:\/\//);
  expect(l.price).toBeGreaterThan(0);
  expect(l.currency).toBe('PKR');
  if (l.originalPrice !== null) expect(l.originalPrice).toBeGreaterThan(l.price);
  if (l.rating !== null) expect(l.rating).toBeGreaterThan(0);
}

describe('parsePrice', () => {
  test.each([
    ['Rs. 127,000', 127000],
    ['127000', 127000],
    [' Rs  40,499 ', 40499],
    ['', null],
    [null, null],
    ['Rs. 0', null],
  ])('%p -> %p', (input, expected) => expect(parsePrice(input)).toBe(expected));
});

describe('Daraz parser', () => {
  test('parses 40 listings from a search response', () => {
    const listings = daraz.parse(JSON.parse(fixture('daraz-galaxy-a55.json')));
    expect(listings).toHaveLength(40);
    listings.forEach((l) => expectValidListing(l, 'daraz'));
    expect(listings[0]).toMatchObject({ externalId: '550702491', price: 127000, originalPrice: 140000, inStock: true });
    expect(listings[0].url).toBe('https://www.daraz.pk/products/a55-5g-8gb-256gb-66-mah-pta-1-i550702491.html');
  });

  test('captures seller identity (Daraz is a marketplace of many sellers - docs/MULTI_SELLER_PLAN.md)', () => {
    const listings = daraz.parse(JSON.parse(fixture('daraz-galaxy-a55.json')));
    expect(listings[0]).toMatchObject({ sellerId: '6005273856532', sellerName: 'Smart Phone Line', sellerLocation: 'Punjab' });
    const sellers = new Set(listings.map((l) => l.sellerId));
    expect(sellers.size).toBeGreaterThan(30); // this fixture has 36 distinct sellers across 40 listings
  });

  test('parses ratings and review counts when present', () => {
    const listings = daraz.parse(JSON.parse(fixture('daraz-airpods-pro.json')));
    expect(listings.length).toBeGreaterThan(30);
    expect(listings.some((l) => l.rating && l.reviewCount > 0)).toBe(true);
  });

  test('returns [] for a search with no results', () => {
    expect(daraz.parse(JSON.parse(fixture('daraz-empty.json')))).toEqual([]);
  });

  test('throws BLOCKED on an unexpected (captcha) response', () => {
    expect(() => daraz.parse({ url: 'https://www.daraz.pk/punish' })).toThrow(expect.objectContaining({ code: 'BLOCKED' }));
  });
});

describe('PriceOye parser', () => {
  test('parses product cards', () => {
    const listings = priceoye.parse(fixture('priceoye-galaxy-a55.html'));
    expect(listings).toHaveLength(24);
    listings.forEach((l) => expectValidListing(l, 'priceoye'));
    expect(listings[0]).toMatchObject({
      externalId: '15610',
      title: 'Infinix Smart 20',
      price: 40499,
      originalPrice: 41999,
      rating: 4.9,
      reviewCount: 35,
      inStock: true,
      category: 'Mobiles',
    });
    expect(listings[0].image).toMatch(/^https:\/\/images\.priceoye\.pk\//);
  });

  test('detects out-of-stock products', () => {
    const listings = priceoye.parse(fixture('priceoye-galaxy-a55.html'));
    expect(listings.filter((l) => !l.inStock)).toHaveLength(8);
  });

  test('parses a second page layout (iphone search)', () => {
    const listings = priceoye.parse(fixture('priceoye-iphone-15.html'));
    expect(listings.length).toBeGreaterThan(10);
  });

  test('throws PARSE on an unrelated page', () => {
    expect(() => priceoye.parse('<html><body><h1>Maintenance</h1></body></html>')).toThrow(
      expect.objectContaining({ code: 'PARSE' })
    );
  });
});

describe('PoliteQueue', () => {
  test('runs one task at a time with a delay between requests', async () => {
    const q = new PoliteQueue('test', { minDelayMs: 50, maxDelayMs: 60 });
    const starts = [];
    let running = 0;
    let maxRunning = 0;
    const task = () => q.run(async () => {
      running += 1;
      maxRunning = Math.max(maxRunning, running);
      starts.push(Date.now());
      await new Promise((r) => setTimeout(r, 5));
      running -= 1;
    });
    await Promise.all([task(), task(), task()]);
    expect(maxRunning).toBe(1);
    expect(starts[1] - starts[0]).toBeGreaterThanOrEqual(45);
    expect(starts[2] - starts[1]).toBeGreaterThanOrEqual(45);
  });

  test('opens the circuit after 3 consecutive failures', async () => {
    const q = new PoliteQueue('test', { minDelayMs: 0, maxDelayMs: 0, cooldownMs: 60000 });
    const fail = () => q.run(async () => { throw new Error('boom'); }).catch((e) => e);
    await fail();
    await fail();
    await fail();
    expect(q.circuitOpen).toBe(true);
    const err = await fail();
    expect(err.code).toBe('CIRCUIT_OPEN');
  });
});

describe('re-fetch by stored id / URL', () => {
  const http = require('../src/scrapers/http');
  afterEach(() => jest.restoreAllMocks());

  test('Daraz item id comes from the numeric externalId or the product URL', () => {
    expect(daraz.itemIdOf({ externalId: '550702491' })).toBe('550702491');
    expect(daraz.itemIdOf({ externalId: 'x', url: 'https://www.daraz.pk/products/a55-5g-pta-i550702491.html' })).toBe('550702491');
    expect(daraz.itemIdOf({ externalId: 'seed-a55-daraz', url: 'https://www.daraz.pk/catalog/?q=a55' })).toBeNull();
  });

  test('Daraz: returns the exact item looked up by id', async () => {
    const get = jest.spyOn(http, 'get').mockResolvedValue({ data: JSON.parse(fixture('daraz-by-id.json')) });
    const fresh = await daraz.fetchListing({ externalId: '550702491' });
    expect(get.mock.calls[0][0]).toContain('q=550702491');
    expect(fresh).toMatchObject({ platform: 'daraz', externalId: '550702491' });
    expect(fresh.price).toBeGreaterThan(0);
  });

  test('Daraz: null when the item is no longer listed; UNLINKED without an id', async () => {
    jest.spyOn(http, 'get').mockResolvedValue({ data: JSON.parse(fixture('daraz-by-id-missing.json')) });
    expect(await daraz.fetchListing({ externalId: '999999999999' })).toBeNull();
    await expect(daraz.fetchListing({ externalId: 'seed-x', url: 'https://www.daraz.pk/catalog/?q=x' })).rejects.toMatchObject({ code: 'UNLINKED' });
  });

  test('PriceOye: product URLs are re-fetchable, search URLs are not', () => {
    expect(priceoye.isProductUrl('https://priceoye.pk/mobiles/infinix/infinix-smart-20')).toBe(true);
    expect(priceoye.isProductUrl('https://priceoye.pk/search?q=infinix')).toBe(false);
    expect(priceoye.isProductUrl('https://example.com/mobiles/a/b')).toBe(false);
    expect(priceoye.isProductUrl('not a url')).toBe(false);
  });

  test('PriceOye: parses price, retail price, rating and stock from a product page', () => {
    const fresh = priceoye.parseProduct(fixture('priceoye-product-infinix-smart-20.html'), 'https://priceoye.pk/mobiles/infinix/infinix-smart-20');
    expect(fresh).toMatchObject({
      platform: 'priceoye', externalId: '15610', title: 'Infinix Smart 20', price: 40499, originalPrice: 41999,
      rating: 5, reviewCount: 35, inStock: true, currency: 'PKR',
    });
  });

  test('PriceOye: fetchListing reads the stored URL; 404 means the product is gone', async () => {
    const url = 'https://priceoye.pk/mobiles/infinix/infinix-smart-20';
    const get = jest.spyOn(http, 'get').mockResolvedValue({ data: fixture('priceoye-product-infinix-smart-20.html') });
    expect((await priceoye.fetchListing({ url })).price).toBe(40499);
    expect(get).toHaveBeenCalledWith(url, expect.anything());
    get.mockRejectedValue(new http.ScrapeError('HTTP 404', { code: 'HTTP', status: 404 }));
    expect(await priceoye.fetchListing({ url })).toBeNull();
    await expect(priceoye.fetchListing({ url: 'https://priceoye.pk/search?q=x' })).rejects.toMatchObject({ code: 'UNLINKED' });
  });

  test('PriceOye: a page without product data is a PARSE error', () => {
    expect(() => priceoye.parseProduct('<html><body>Not found</body></html>', 'u')).toThrow(expect.objectContaining({ code: 'PARSE' }));
  });
});
