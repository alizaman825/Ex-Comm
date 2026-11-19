const { analyzeTitle, isSameProduct, normalizeText, findBestMatch } = require('../src/services/matching');

describe('normalizeText', () => {
  test('joins units and expands RAM/storage shorthand', () => {
    expect(normalizeText('Galaxy A55 8/256 GB')).toBe('galaxy a55 8gb 256gb');
    expect(normalizeText('Redmi Note 14 (8GB+256GB)')).toBe('redmi note 14 8gb 256gb');
    expect(normalizeText('Power Bank 20000 mAh 22.5 W')).toBe('power bank 20000mah 22.5w');
  });

  test('expands hyphenated RAM/storage shorthand without mangling it into one token', () => {
    // real PriceOye title; previously the general hyphen-join ran first and glued this into "8gb512gb",
    // a token that matched neither a storage pattern nor the other store's separate "16gb 512gb"
    expect(normalizeText('Lenovo ThinkPad E14 (8GB-512GB)')).toBe('lenovo thinkpad e14 8gb 512gb');
    expect(normalizeText('Xiaomi Redmi Note-14 8GB-256GB')).toBe('xiaomi redmi note 14 8gb 256gb');
  });
});

describe('analyzeTitle', () => {
  test('detects brand from aliases and drops marketing words and colours', () => {
    const a = analyzeTitle('Apple iPhone 15 (128GB) - Black - PTA Approved - Official Warranty');
    expect(a.brand).toBe('apple');
    expect(a.tokens).toEqual(['iphone', '15', '128gb']);
  });

  test('key is order independent', () => {
    expect(analyzeTitle('Samsung Galaxy A55 5G 8GB 256GB').key).toBe(analyzeTitle('Samsung 8GB 256GB Galaxy A55 5G').key);
  });
});

describe('isSameProduct', () => {
  const same = [
    ['Apple iPhone 15 (128GB) - Black - PTA Approved', 'iPhone 15 128 GB Blue'],
    ['Samsung Galaxy A55 5G - 8GB RAM 256GB ROM - Official Warranty', 'Samsung Galaxy A55 5G 8GB 256GB'],
    ['Samsung Galaxy A55 5G 256GB', 'Samsung Galaxy A55 5G 8/256'],
    ['Sony WH-1000XM5 Wireless Noise Cancelling Headphones', 'Sony WH1000XM5 Headphones Black'],
    ['Xiaomi Redmi Note 14 8GB 256GB Global Version Smartphone', 'Redmi Note 14 (8GB+256GB) PTA Approved'],
    ['Anker 20W USB-C Fast Charger', 'Anker 20W USB C Charger Original'],
  ];
  test.each(same)('%s == %s', (a, b) => expect(isSameProduct(a, b)).toBe(true));

  const different = [
    ['Apple iPhone 15 128GB', 'Apple iPhone 15 Pro 128GB'], // variant word
    ['Samsung Galaxy A15', 'Samsung Galaxy A15 5G'], // variant word
    ['iPhone 15 128GB', 'iPhone 15 256GB'], // storage
    ['iPhone 15 128GB', 'iPhone 14 128GB'], // model number
    ['Samsung Galaxy S25 256GB', 'Apple iPhone 16 256GB'], // brand
    ['iPhone 15 128GB', 'iPhone 15 Silicone Case Cover'], // accessory
    ['JBL Flip 6 Portable Speaker', 'JBL Charge 5 Portable Speaker'], // model
  ];
  test.each(different)('%s != %s', (a, b) => expect(isSameProduct(a, b)).toBe(false));
});

describe('cleanTitle', () => {
  const { cleanTitle } = require('../src/services/ingest');
  test.each([
    ['Samsung Galaxy A55 5G - 8GB 256GB - 6.6" Display - PTA Approved', 'Samsung Galaxy A55 5G'],
    ['Air Fryer - 8 Litre Digital Display Oil Free Cooker', 'Air Fryer - 8 Litre Digital Display Oil Free Cooker'],
    ['Walkend || Sneakers for men || shoes for men ||', 'Walkend | Sneakers for men | shoes for men'],
    ['Infinix Smart 20', 'Infinix Smart 20'],
  ])('%s', (input, expected) => expect(cleanTitle(input)).toBe(expected));
});

describe('real store titles with spec noise', () => {
  const pairs = [
    ['Samsung Galaxy A55 5G 8GB 256GB', 'Samsung Galaxy A55 5G - 8GB 256GB - 6.6" Display - 5000 mAh Battery - PTA Approved 1 Year Official Warranty'],
    ['Samsung Galaxy A55 5G 8GB 256GB', 'Samsung Galaxy A55 5G || 8GB + 256GB || 6.6 Super AMOLED Display 120Hz'],
    ['Sony WH-1000XM5 Wireless Headphones', 'Sony WH-1000XM5 The Best Wireless Noise Canceling Headphones with Auto Noise Canceling Optimizer, Crystal Clear Hands-Free Calling'],
    ['Apple Watch Series 10 46mm', 'Apple Watch Series 10 Aluminum (46mm)'],
    // real PriceOye vs Daraz titles for the same phone (PriceOye's search card omits storage)
    ['Apple iPhone 16', 'Apple iPhone 16 - 128GB'],
    ['Xiaomi Redmi Note 14', 'Redmi Note 14  8GB RAM 256GB ROM 6.67 Inches  Display 5500 mAh  Battery PTA Approved Official One Year Brand Warranty'],
  ];
  test.each(pairs)('%s ~ %s', (a, b) => expect(isSameProduct(a, b)).toBe(true));

  test('still separates different sizes and generations', () => {
    expect(isSameProduct('Apple Watch Series 10 46mm', 'Apple Watch Series 10 Aluminum (42mm)')).toBe(false);
    expect(isSameProduct('Apple Watch Series 10 46mm', 'Apple Watch Series 11 46mm')).toBe(false);
    expect(isSameProduct('Apple AirPods Pro 2', 'Apple AirPods Pro 3')).toBe(false);
  });
});

describe('findBestMatch: storage-less listings and variant ambiguity', () => {
  test('a listing with no storage in its title can still match a product that names one', () => {
    const query = analyzeTitle('Apple iPhone 16');
    const result = findBestMatch(query, [{ title: 'Apple iPhone 16 128GB' }]);
    expect(result && result.candidate.title).toBe('Apple iPhone 16 128GB');
  });

  test('refuses to guess which variant a storage-less listing belongs to when siblings of different storage would equally match', () => {
    // same store omits storage, but two sibling products (different storage) already exist: showing this
    // listing's price under either one would misrepresent it as a specific variant it may not be
    const query = analyzeTitle('Apple iPhone 16');
    const candidates = [{ title: 'Apple iPhone 16 128GB' }, { title: 'Apple iPhone 16 256GB' }];
    expect(findBestMatch(query, candidates)).toBeNull();
  });

  test('a listing that does name its storage is not affected by sibling ambiguity', () => {
    const query = analyzeTitle('Apple iPhone 16 256GB');
    const candidates = [{ title: 'Apple iPhone 16 128GB' }, { title: 'Apple iPhone 16 256GB' }];
    const result = findBestMatch(query, candidates);
    expect(result && result.candidate.title).toBe('Apple iPhone 16 256GB');
  });
});
