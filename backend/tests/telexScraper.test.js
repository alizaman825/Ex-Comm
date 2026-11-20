const fs = require('fs');
const path = require('path');
const telex = require('../src/scrapers/telex');

const fixture = (name) => fs.readFileSync(path.join(__dirname, 'fixtures/telex', name), 'utf8');

describe('telex sitemap parsing', () => {
  test('sitemap index returns only product sub-sitemaps', () => {
    const urls = telex.parseSitemapIndex(fixture('sitemap-index.xml'));
    expect(urls).toEqual(['https://www.telex.pk/sitemap_products_1.xml?from=1&to=2']);
  });

  test('a product sub-sitemap returns product page URLs', () => {
    const urls = telex.parseProductSitemap(fixture('sitemap-products-1.xml'));
    expect(urls).toEqual(['https://www.telex.pk/products/infinix-hot-60i', 'https://www.telex.pk/products/cotton-tshirt']);
  });
});

describe('telex product page parsing', () => {
  test('reads price (from og:price:amount), currency, availability and image', () => {
    const found = telex.parseProductPage(fixture('product-infinix.html'), 'https://www.telex.pk/products/infinix-hot-60i');
    expect(found).toMatchObject({
      platform: 'telex',
      externalId: 'infinix-hot-60i',
      title: 'Infinix Hot 60i Dual Sim With Official Warranty',
      price: 53449,
      currency: 'PKR',
      inStock: true,
    });
    expect(found.image).toBe('https://www.telex.pk/cdn/shop/files/infinix-hot-60i.jpg?v=1');
  });

  test('"available":false in the embedded product JSON is read as out of stock', () => {
    const found = telex.parseProductPage(fixture('product-outofstock.html'), 'https://www.telex.pk/products/infinix-note-50-pro');
    expect(found.inStock).toBe(false);
  });

  test('a page with no readable price throws instead of silently storing junk', () => {
    expect(() => telex.parseProductPage('<html></html>', 'https://www.telex.pk/products/x')).toThrow();
  });
});

describe('launch category filter (phones, laptops, GPUs - skip everything else)', () => {
  test('phones, laptops and GPUs pass; unrelated categories do not', () => {
    expect(telex.isLaunchCategory('Infinix Hot 60i Dual Sim')).toBe(true);
    expect(telex.isLaunchCategory('HP Victus Gaming Laptop Core i5')).toBe(true);
    expect(telex.isLaunchCategory('NVIDIA GeForce RTX 4060 Graphics Card')).toBe(true);
    expect(telex.isLaunchCategory("Men's Cotton Crew Neck T-Shirt")).toBe(false);
  });
});

describe('disallowed URLs are refused', () => {
  test('search, cart and account paths are never requested', () => {
    expect(() => telex.assertAllowed('https://www.telex.pk/search?q=phone')).toThrow();
    expect(() => telex.assertAllowed('https://www.telex.pk/cart')).toThrow();
    expect(() => telex.assertAllowed('https://www.telex.pk/account')).toThrow();
    expect(() => telex.assertAllowed('https://evil.example.com/products/x')).toThrow();
  });

  test('sitemap and product URLs on the canonical host are allowed', () => {
    expect(() => telex.assertAllowed('https://www.telex.pk/sitemap.xml')).not.toThrow();
    expect(() => telex.assertAllowed('https://www.telex.pk/sitemap_products_1.xml?from=1&to=2')).not.toThrow();
    expect(() => telex.assertAllowed('https://www.telex.pk/products/infinix-hot-60i')).not.toThrow();
  });
});
