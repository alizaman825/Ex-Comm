// Cross-platform product matching: title normalization + fuzzy similarity.
// Limitations are documented in docs/report_notes.md.

const STOPWORDS = new Set(`
a an and the with for of by in on to new latest original genuine authentic official brand branded
pta approved non nonpta warranty year years month months local stock sealed box packed pack
free delivery shipping fast cod sale deal offer discount best quality premium hot top
global version international edition smartphone smart phone mobile cellphone cell dual sim
ram rom storage memory gb_ram internal colour color variant model series device gen generation
`.trim().split(/\s+/));

// CPU/laptop generation markers ("13th Gen", "ThinkPad E14 G5"): one store's title often states a
// generation, revision code or processor family that the same listing on another store just leaves out.
// Unlike a storage size or "Pro"/"Max", the generation never changes which physical product it is for a
// given specific CPU/model number (already present as its own token), so treating it as a hard-reject
// token like VARIANT_WORDS does produced false negatives (same laptop, one title says "13th Gen"/"G5",
// the other doesn't). Dropped like a colour instead of compared.
const isGenerationNoise = (t) => /^[0-9]{1,2}(st|nd|rd|th)$/.test(t) || /^g[0-9]{1,2}$/.test(t);

const COLOURS = new Set(`
black white blue red green yellow pink purple violet grey gray silver gold golden rose orange
midnight starlight graphite titanium natural desert cream beige navy mint lavender coral
onyx phantom cosmic aurora ocean sky jade obsidian charcoal space
`.trim().split(/\s+/));

// Words that change which product it is; must match exactly between two titles.
const VARIANT_WORDS = new Set(
  'pro max plus ultra mini lite fe se air neo prime note 5g 4g slim oled digital disc edition xl'.split(' ')
);

const ACCESSORY_WORDS = new Set(
  'case cover protector glass tempered screenguard skin strap holder stand pouch sleeve sticker film charger cable adapter bumper lanyard earphone earphones earbud earbuds headphone headphones'.split(' ')
);

// "for/compatible with/fits/suitable for": a title built around one of these words names a product only
// as what something ELSE fits ("For iPhone18ProMax", "Compatible with Galaxy A55") - the item for sale is an
// accessory even when it names no accessory noun at all (no "case"/"cover" in the title). Same set as
// relevance.js's FITS_WORDS, duplicated here because that module imports from this one.
const FITS_WORDS = new Set(['for', 'compatible', 'fits', 'suitable']);

// True when a title (its RAW words, before stopwords like "for" are dropped) marks the thing for sale as
// an accessory rather than the device itself.
function isAccessoryTitle(rawTokens) {
  return rawTokens.some((t) => ACCESSORY_WORDS.has(t) || FITS_WORDS.has(t));
}

const BRAND_ALIASES = {
  iphone: 'apple', ipad: 'apple', airpods: 'apple', macbook: 'apple', imac: 'apple',
  galaxy: 'samsung', redmi: 'xiaomi', poco: 'xiaomi', mi: 'xiaomi',
  pixel: 'google', playstation: 'sony', ps5: 'sony', dualsense: 'sony',
  vivobook: 'asus', zenbook: 'asus', ideapad: 'lenovo', thinkpad: 'lenovo', inspiron: 'dell',
  pavilion: 'hp', victus: 'hp', soundcore: 'anker', amazfit: 'amazfit', xbox: 'microsoft',
};

const BRANDS = new Set(
  `apple samsung xiaomi google sony asus lenovo dell hp anker microsoft infinix tecno vivo oppo realme
  oneplus huawei honor nokia motorola itel jbl audionic haylou baseus ugreen logitech sandisk redragon
  nintendo philips anex tp-link tplink gopro dji canon nikon acer msi amazfit lg tcl hisense haier
  dawlance kenwood westpoint qcy boat lenovo soundpeats realme zte
  nike adidas puma levi levis rayban converse vans skechers crocs herschel fjallraven casio garmin fossil
  ninja instant dyson tefal`.split(/\s+/)
);

function normalizeText(title) {
  return String(title || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    // "8GB-256GB" -> "8gb 256gb" (RAM-storage shorthand with an explicit unit before the hyphen; must run
    // before the general hyphen-join below, which would otherwise glue it into one unmatchable token)
    .replace(/\b(\d{1,2})gb-(\d{2,4})(gb|tb)?\b/g, (_m, r, s, u) => `${r}gb ${s}${u || 'gb'}`)
    // 'wh-1000xm5' -> 'wh1000xm5', 'usb-c' / 'usb c' / 'type c' -> 'usbc' / 'typec'
    .replace(/([a-z0-9])-(?=[a-z0-9])/g, '$1')
    .replace(/\b(usb|type)\s+c\b/g, '$1c')
    // "8/256", "8+256", "8gb+256gb" -> "8gb 256gb"
    .replace(/\b(\d{1,2})\s*(?:gb)?\s*[/+]\s*(\d{2,4})\s*(gb|tb)?\b/g, (_m, r, s, u) => `${r}gb ${s}${u || 'gb'}`)
    // join numbers with units: "128 GB" -> "128gb", '6.1"' -> "6.1in"
    .replace(/(\d+(?:\.\d+)?)\s*(gb|tb|mah|w|hz|mp|mm|cm|inch(?:es)?|in|"|ml|l|kg)\b/g, (_m, n, u) => {
      const unit = /^(inch|inches|"|in)$/.test(u) ? 'in' : u;
      return `${n}${unit}`;
    })
    .replace(/(\d+(?:\.\d+)?)"/g, '$1in')
    .replace(/[^a-z0-9.\s-]/g, ' ')
    .replace(/(^|\s)[-.]+|[-.]+(?=\s|$)/g, ' ')
    .replace(/\s+/g, ' ')
    // noise numbers that are not part of the model: warranty length ("1 year") and bare decimals (screen size "6.6")
    .replace(/(^| )[0-9]+ ?(year|years|yr|yrs|month|months)(?= |$)/g, ' ')
    .replace(/(^| )[0-9]+[.][0-9]+(?= |$)/g, ' ')
    // glued model words (no backslashes: the text is single-space separated here)
    .replace(/(^| )(iphone|ipad|pixel|redmi|galaxy|poco|note)([0-9]{1,3})(?=[a-z]| |$)/g, '$1$2 $3')
    .replace(/(^| )([a-z]{0,2}[0-9]{1,3})(promax|proplus|pro|plus|max|ultra|mini|lite|fe)(?= |$)/g, '$1$2 $3')
    .replace(/(^| )(pro|ultra)(max|plus)(?= |$)/g, '$1$2 $3')
    .replace(/ +/g, ' ')
    .trim();
}

function detectBrand(tokens) {
  for (const t of tokens.slice(0, 4)) {
    if (BRANDS.has(t)) return t === 'tplink' ? 'tp-link' : t;
    if (BRAND_ALIASES[t]) return BRAND_ALIASES[t];
  }
  return null;
}

// Returns { brand, tokens (significant, in order), key (order-independent), accessory }.
function analyzeTitle(title) {
  const raw = normalizeText(title).split(' ').filter(Boolean);
  const accessory = isAccessoryTitle(raw);
  const tokens = [];
  for (const t of raw) {
    if (STOPWORDS.has(t) || COLOURS.has(t) || isGenerationNoise(t)) continue;
    if (t.length === 1 && !/\d/.test(t)) continue;
    if (!tokens.includes(t)) tokens.push(t);
  }
  const brand = detectBrand(tokens);
  const rest = tokens.filter((t) => t !== brand);
  // The accessory flag is folded into the key itself so an accessory listing never exact-key-matches the
  // real device it was titled after ("For iPhone18ProMax" normalizes to the same brand+model tokens as
  // "Apple iPhone 18 Pro Max", but must never become an offer on that phone's page).
  const key = [brand || '_', accessory ? '~acc' : '', ...[...rest].sort()].join(' ');
  return { brand, tokens: rest, key, accessory };
}

// All meaningful tokens of a text (brand included), for query relevance checks.
function significantTokens(text) {
  const out = [];
  for (const t of normalizeText(text).split(' ')) {
    if (!t || STOPWORDS.has(t) || COLOURS.has(t) || isGenerationNoise(t)) continue;
    if (t.length === 1 && !/\d/.test(t)) continue;
    if (!out.includes(t)) out.push(t);
  }
  return out;
}

const hasAccessoryWord = (tokens) => tokens.some((t) => ACCESSORY_WORDS.has(t));
const accessoryWordsIn = (tokens) => tokens.filter((t) => ACCESSORY_WORDS.has(t));

const isStorage = (t) => /^\d+(gb|tb)$/.test(t);
const isUnit = (t) => /^\d+(\.\d+)?(mah|w|hz|mp|mm|cm|in|ml|l|kg)$/.test(t);
const isModel = (t) => /\d/.test(t) && !isStorage(t) && !isUnit(t);

function setOf(tokens, pred) {
  return new Set(tokens.filter(pred));
}
function sameSet(a, b) {
  return a.size === b.size && [...a].every((x) => b.has(x));
}
function isSubset(a, b) {
  return [...a].every((x) => b.has(x));
}
const storageBytes = (t) => parseFloat(t) * (t.endsWith('tb') ? 1024 : 1);

// Similarity 0..1 between two analyzed titles. Hard rules return 0.
function similarity(a, b) {
  if (a.brand && b.brand && a.brand !== b.brand) return 0;
  if (a.accessory !== b.accessory) return 0;

  // Model numbers ("a55", "15", "1000xm5") and variant words ("pro", "5g") must agree exactly.
  if (!sameSet(setOf(a.tokens, isModel), setOf(b.tokens, isModel))) return 0;
  if (!sameSet(setOf(a.tokens, (t) => VARIANT_WORDS.has(t)), setOf(b.tokens, (t) => VARIANT_WORDS.has(t)))) return 0;

  // Storage: one title may omit RAM, but the largest (storage) size must match.
  const sA = setOf(a.tokens, isStorage);
  const sB = setOf(b.tokens, isStorage);
  if (sA.size && sB.size) {
    const maxA = Math.max(...[...sA].map(storageBytes));
    const maxB = Math.max(...[...sB].map(storageBytes));
    if (maxA !== maxB) return 0;
    if (!isSubset(sA, sB) && !isSubset(sB, sA)) return 0;
  }

  const A = new Set(a.tokens);
  const B = new Set(b.tokens);
  if (!A.size || !B.size) return 0;
  const inter = [...A].filter((t) => B.has(t)).length;
  const dice = (2 * inter) / (A.size + B.size);
  const overlap = inter / Math.min(A.size, B.size);
  // Weight containment higher: store titles often add many spec words around the same product name.
  return 0.35 * dice + 0.65 * overlap;
}

const MATCH_THRESHOLD = 0.7;

function isSameProduct(titleA, titleB) {
  const a = typeof titleA === 'string' ? analyzeTitle(titleA) : titleA;
  const b = typeof titleB === 'string' ? analyzeTitle(titleB) : titleB;
  return similarity(a, b) >= MATCH_THRESHOLD;
}

// Pick the best candidate (with .title) for an analyzed title, or null.
//
// A store sometimes sells a phone in several storage/RAM configs but doesn't say which one a given
// listing title is ("Apple iPhone 16" with no "128GB"/"256GB"). similarity() lets that listing match a
// stored product that does name a size (needed for the normal case: cross-store titles with one side
// more specific than the other). But if the listing's own title names no size and more than one
// candidate product - of a *different* size from each other - would equally match it, which one it
// really is is genuinely unknown; picking the first by iteration order would silently show that
// listing's price as if it were a specific variant it may not be. Treat that as no confident match
// instead (the UI's manual "pick the right product" fallback covers it).
function findBestMatch(analyzed, candidates) {
  const queryHasStorage = analyzed.tokens.some(isStorage);
  let best = null;
  let bestScore = 0;
  const scored = [];
  for (const c of candidates) {
    const cAnalyzed = c.analyzed || analyzeTitle(c.title);
    const score = similarity(analyzed, cAnalyzed);
    scored.push({ cAnalyzed, score });
    if (score > bestScore) {
      best = c;
      bestScore = score;
    }
  }
  if (bestScore < MATCH_THRESHOLD) return null;
  if (!queryHasStorage) {
    const bestStorage = setOf((best.analyzed || analyzeTitle(best.title)).tokens, isStorage);
    const conflicting = scored.some(({ cAnalyzed, score }) => score >= MATCH_THRESHOLD && !sameSet(setOf(cAnalyzed.tokens, isStorage), bestStorage));
    if (conflicting) return null;
  }
  return { candidate: best, score: bestScore };
}

// Spaces, hyphens and dots removed: "Sony WH-1000XM5" -> "sonywh1000xm5". Used to find stored products
// whose title spells a model code differently from the query ("wh-1000xm5", "wh1000xm5").
function searchKeyOf(...parts) {
  return normalizeText(parts.filter(Boolean).join(' ')).split(' ').join('').split('-').join('').split('.').join('');
}

// Recognised brand named in a text (null when none, e.g. unbranded store titles).
// Spelling variants of the same brand compare equal ("Levi's" is normalised to "levi", people type "levis").
const BRAND_CANON = { levis: 'levi', 'tp-link': 'tplink', 'ray-ban': 'rayban' };
const brandOf = (text) => {
  const b = analyzeTitle(text).brand;
  return b ? BRAND_CANON[b] || b : b;
};

module.exports = { brandOf, accessoryWordsIn, ACCESSORY_WORDS, FITS_WORDS, isAccessoryTitle, searchKeyOf, significantTokens, hasAccessoryWord, normalizeText, analyzeTitle, similarity, isSameProduct, findBestMatch, MATCH_THRESHOLD };
