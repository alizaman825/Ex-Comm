const fs = require('fs');
const path = require('path');
const mega = require('../src/scrapers/mega');

const fixture = (name) => fs.readFileSync(path.join(__dirname, 'fixtures/mega', name), 'utf8');

describe('mega sitemap parsing', () => {
  test('sitemap index returns only product sub-sitemaps, not pages/categories/brands/accessories', () => {
    const urls = mega.parseSitemapIndex(fixture('sitemap-index.xml'));
    expect(urls).toEqual(['https://www.mega.pk/sitemap-products-1.xml']);
  });

  test('a product sub-sitemap returns product page URLs', () => {
    const urls = mega.parseProductSitemap(fixture('sitemap-products-1.xml'));
    expect(urls).toEqual([
      'https://www.mega.pk/laptop_products/9001/HP-Victus-Gaming-Laptop-Core-i5.html',
      'https://www.mega.pk/tshirt_products/9002/Mens-Cotton-Crew-Neck-T-Shirt.html',
    ]);
  });
});

describe('mega product page parsing (schema.org Product JSON-LD)', () => {
  test('reads title, price, currency, availability and image from the Product offers block', () => {
    const found = mega.parseProductPage(fixture('product-laptop.html'), 'https://www.mega.pk/laptop_products/9001/HP-Victus-Gaming-Laptop-Core-i5.html');
    expect(found).toMatchObject({
      platform: 'mega',
      externalId: '9001',
      title: 'HP Victus Gaming Laptop Core i5',
      price: 215000,
      currency: 'PKR',
      inStock: true,
    });
    expect(found.image).toBe('https://www.mega.pk/items_images/HP+Victus+Gaming+Laptop_-_9001.webp');
  });

  test('"OutOfStock" availability is read as out of stock', () => {
    const found = mega.parseProductPage(fixture('product-outofstock.html'), 'https://www.mega.pk/laptop_products/9003/Dell-Inspiron-15-Core-i7.html');
    expect(found.inStock).toBe(false);
  });

  test('a page with no readable Product JSON-LD block throws instead of silently storing junk', () => {
    expect(() => mega.parseProductPage('<html><body>no ld+json here</body></html>', 'https://www.mega.pk/x/1/y.html')).toThrow();
  });

  test('a Product block with no price throws', () => {
    const html = '<script type="application/ld+json">{"@type":"Product","name":"X","offers":{"@type":"Offer"}}</script>';
    expect(() => mega.parseProductPage(html, 'https://www.mega.pk/x/1/y.html')).toThrow();
  });
});

describe('launch category filter (phones, laptops, audio, watches, GPUs, home appliances)', () => {
  test('each launch category passes; an unrelated category does not', () => {
    expect(mega.isLaunchCategory('Samsung Galaxy A56 Dual Sim')).toBe(true);
    expect(mega.isLaunchCategory('HP Victus Gaming Laptop Core i5')).toBe(true);
    expect(mega.isLaunchCategory('NVIDIA GeForce RTX 4060 Graphics Card')).toBe(true);
    expect(mega.isLaunchCategory('Sony WH-1000XM5 Wireless Headphones')).toBe(true);
    expect(mega.isLaunchCategory('Apple Watch Series 9')).toBe(true);
    expect(mega.isLaunchCategory('Dawlance Inverter Refrigerator')).toBe(true);
    expect(mega.isLaunchCategory("Men's Cotton Crew Neck T-Shirt")).toBe(false);
    expect(mega.isLaunchCategory('HP Colour LaserJet CP5225N A3 Printer')).toBe(false);
  });
});

describe('disallowed URLs are refused (hard limit 2 + the brief\'s explicit ?q=/sort/filter/brand/page requirement)', () => {
  test('any query string is refused, including ?q=, ?sort=, ?filter=, ?brand= and ?page=', () => {
    expect(() => mega.assertAllowed('https://www.mega.pk/laptops/?q=laptop')).toThrow();
    expect(() => mega.assertAllowed('https://www.mega.pk/laptops/?sort=price')).toThrow();
    expect(() => mega.assertAllowed('https://www.mega.pk/laptops/?filter=brand')).toThrow();
    expect(() => mega.assertAllowed('https://www.mega.pk/laptops/?brand=hp')).toThrow();
    expect(() => mega.assertAllowed('https://www.mega.pk/laptops/?page=2')).toThrow();
    expect(() => mega.assertAllowed('https://www.mega.pk/search?anything=at-all')).toThrow();
  });

  test('robots.txt-disallowed account/cart/checkout/admin paths are refused', () => {
    expect(() => mega.assertAllowed('https://www.mega.pk/cart/')).toThrow();
    expect(() => mega.assertAllowed('https://www.mega.pk/checkout/')).toThrow();
    expect(() => mega.assertAllowed('https://www.mega.pk/login/')).toThrow();
    expect(() => mega.assertAllowed('https://www.mega.pk/account/')).toThrow();
    expect(() => mega.assertAllowed('https://www.mega.pk/admin/')).toThrow();
    expect(() => mega.assertAllowed('https://www.mega.pk/get_cat_url/1')).toThrow();
  });

  test('another host is refused even if the path looks fine', () => {
    expect(() => mega.assertAllowed('https://evil.example.com/laptop_products/1/x.html')).toThrow();
  });

  test('the sitemap and real category-prefixed product URLs (no query string) are allowed', () => {
    expect(() => mega.assertAllowed('https://www.mega.pk/sitemap.xml')).not.toThrow();
    expect(() => mega.assertAllowed('https://www.mega.pk/sitemap-products-1.xml')).not.toThrow();
    expect(() => mega.assertAllowed('https://www.mega.pk/laptop_products/9001/HP-Victus-Gaming-Laptop-Core-i5.html')).not.toThrow();
    expect(() => mega.assertAllowed('https://www.mega.pk/printer_products/462/HP-Colour-LaserJet-CP5225N-A3.html')).not.toThrow();
  });
});
