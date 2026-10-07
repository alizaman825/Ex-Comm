// The six product categories: seed definitions, preset search keywords, and classification of
// scraped titles into a category.
const { Category } = require('../models');
const { significantTokens, normalizeText } = require('./matching');

// `keywords`: preset searches shown on the category page. `terms`: words/phrases that classify a title.
const CATEGORY_DEFS = [
  {
    slug: 'mobiles', name: 'Mobiles', icon: 'smartphone', sortOrder: 1,
    keywords: ['iphone 16', 'samsung galaxy a55', 'redmi note 14', 'google pixel 9', 'infinix note 40', 'vivo y29'],
    terms: ['phone', 'smartphone', 'iphone', / galaxy [asmz][0-9]/, 'redmi note', / redmi a?[0-9]/, / poco [xmf][0-9]/, 'google pixel', / infinix (note|hot|smart|zero)/, / tecno (spark|camon|pova)/, / oppo (a|reno|find)/, / realme (c|note|gt|[0-9])/, / honor (x|magic|[0-9])/, / vivo [yvx][0-9]/],
  },
  {
    slug: 'laptops', name: 'Laptops', icon: 'laptop', sortOrder: 2,
    keywords: ['macbook air', 'hp victus', 'lenovo ideapad', 'dell inspiron', 'asus vivobook', 'gaming laptop'],
    terms: ['laptop', 'notebook', 'macbook', 'thinkpad', 'ideapad', 'vivobook', 'inspiron', 'latitude', 'victus', 'elitebook', 'aspire', 'nitro', 'ryzen', 'core i3', 'core i5', 'core i7', 'core i9'],
  },
  {
    slug: 'audio', name: 'Audio', icon: 'headphones', sortOrder: 3,
    keywords: ['airpods pro', 'jbl speaker', 'sony headphones', 'wireless earbuds', 'galaxy buds', 'soundcore'],
    terms: ['earbuds', 'earphones', 'earphone', 'headphones', 'headphone', 'headset', 'airpods', 'buds', 'speaker', 'soundbar', 'airbud', 'earbud', 'tws'],
  },
  {
    slug: 'watches', name: 'Watches', icon: 'watch', sortOrder: 4,
    keywords: ['apple watch', 'smart watch', 'amazfit', 'fitness band', 'g-shock', 'galaxy watch'],
    terms: ['watch', 'smartwatch', 'band', 'gshock', 'tracker', 'forerunner', 'amazfit', 'garmin', 'fitbit'],
  },
  {
    slug: 'home-appliances', name: 'Home Appliances', icon: 'home', sortOrder: 5,
    keywords: ['air fryer', 'vacuum cleaner', 'blender', 'inverter ac', 'washing machine', 'led tv'],
    terms: ['air fryer', 'fryer', 'vacuum', 'blender', 'iron', 'inverter', 'refrigerator', 'fridge', 'washing machine', 'microwave', 'purifier', 'kettle', 'cooker', 'coffee maker', 'tv', 'router', 'oven', 'geyser', 'fan', 'heater', 'juicer'],
  },
  {
    slug: 'fashion', name: 'Fashion', icon: 'shirt', sortOrder: 6,
    keywords: ["men's sneakers", 'running shoes', 'jeans', 'hoodie', 'sunglasses', 'backpack'],
    terms: ['shoes', 'shoe', 'sneakers', 'sneaker', 'jeans', 'shirt', 'tshirt', 'hoodie', 'jacket', 'backpack', 'sunglasses', 'dress', 'kurta', 'clog', 'sandals', 'slippers', 'bag', 'wallet', 'cap'],
  },
];

const slugify = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

const bySlug = Object.fromEntries(CATEGORY_DEFS.map((c) => [c.slug, c]));
const byName = Object.fromEntries(CATEGORY_DEFS.map((c) => [slugify(c.name), c]));

// Accepts a slug ("home-appliances") or a name ("Home Appliances"); returns the slug or null.
function resolveCategory(value) {
  const s = slugify(value);
  return (bySlug[s] || byName[s])?.slug || null;
}

// Scraped title -> category slug (highest term hits wins; earlier category wins ties). Null if unsure.
function classify(title, hint) {
  const hinted = hint && resolveCategory(hint);
  const text = ` ${normalizeText(title)} `;
  const tokens = new Set(significantTokens(title));
  let best = null;
  let bestScore = 0;
  for (const def of CATEGORY_DEFS) {
    let score = 0;
    for (const term of def.terms) {
      const phrase = term instanceof RegExp || term.includes(' ');
      const hit = term instanceof RegExp ? term.test(text) : phrase ? text.includes(` ${term}`) : tokens.has(term);
      if (hit) score += phrase ? 2 : 1;
    }
    if (score > bestScore) {
      best = def.slug;
      bestScore = score;
    }
  }
  return best || hinted || null;
}

async function ensureCategories() {
  await Promise.all(
    CATEGORY_DEFS.map((c) =>
      Category.updateOne(
        { slug: c.slug },
        { $set: { name: c.name, icon: c.icon, keywords: c.keywords, sortOrder: c.sortOrder } },
        { upsert: true }
      )
    )
  );
}

module.exports = { CATEGORY_DEFS, slugify, resolveCategory, classify, ensureCategories };
