// Query relevance: decides whether a listing/product title answers a search.
// Stores return loose results (PriceOye returns TVs for "galaxy a55", Daraz returns cases for phone
// queries), so every title is checked against the query.
//
// Rules (docs/report_notes.md, "Search relevance"):
//  - Model tokens (anything with a digit: "a56", "15", "128gb", "15in") must all be present. Spacing, case
//    and word order do not matter, and glued forms are split first ("15promax" = "15 pro max").
//  - Other words ("iphone", "pro", "max") need at least two thirds present.
//  - Accessory words in the query ("cover", "case", "charger", "strap"...) are a PREFERENCE, never a
//    requirement: titles that contain them rank first, but a product is not hidden for lacking them.
//  - When the query contains no accessory word, accessories are dropped (a search for "iphone 15" should
//    not return cases).
//  - Nothing here looks at other stores: a product found on one store alone is a result.
const { significantTokens, accessoryWordsIn, normalizeText, brandOf } = require('./matching');

const hasDigit = (t) => /[0-9]/.test(t);

// Title without spaces/hyphens/dots, so "g-shock" matches "G Shock" and "rayban" matches "Ray Ban".
const compactOf = (title) => normalizeText(title).split(' ').join('').split('-').join('').split('.').join('');
const isWord = (t) => t.length >= 5 && !hasDigit(t);

// Words that mean the same thing in store titles. A query word is satisfied by any of its equivalents.
const TOKEN_SYNONYMS = {
  laptop: ['macbook', 'notebook', 'chromebook', 'ultrabook'],
  notebook: ['laptop'],
  headphones: ['headphone', 'earphones', 'headset'],
  earbuds: ['earbud', 'earphones', 'airpods'],
  tv: ['television'],
  fridge: ['refrigerator'],
  refrigerator: ['fridge'],
  ac: ['aircon', 'airconditioner'],
};

// "15in" (from "15 inch") -> "15"; anything else -> null
const sizeOf = (t) => (t.endsWith('in') && /^[0-9]+$/.test(t.slice(0, -2)) ? t.slice(0, -2) : null);

function tokenMatches(q, titleTokens, compact) {
  if (titleTokens.has(q)) return true;
  if (compact && isWord(q) && compact.includes(q)) return true;
  if (titleTokens.has(`${q}s`)) return true;
  if (q.endsWith('s') && titleTokens.has(q.slice(0, -1))) return true;
  if (q.length >= 4) for (const t of titleTokens) if (t.length > q.length && t.startsWith(q)) return true;
  for (const alt of TOKEN_SYNONYMS[q] || []) if (titleTokens.has(alt) || (alt.length >= 5 && compact.includes(alt))) return true;
  const size = sizeOf(q);
  if (size) {
    // "15 inch" also matches "15.6 inch" (same laptop size class)
    for (const t of titleTokens) if (t.endsWith('in') && t.slice(0, -2).startsWith(`${size}.`)) return true;
  }
  return false;
}

function parseQuery(q) {
  const tokens = significantTokens(q);
  const accessoryWords = accessoryWordsIn(tokens);
  const accessorySet = new Set(accessoryWords);
  return {
    tokens,
    brand: brandOf(q), // a recognised brand in the query is binding (see isRelevant)
    accessoryWords,
    wantsAccessory: accessoryWords.length > 0,
    model: tokens.filter(hasDigit),
    words: tokens.filter((t) => !hasDigit(t) && !accessorySet.has(t)),
  };
}

function titleInfo(title) {
  const tokens = new Set(significantTokens(title));
  return { tokens, compact: compactOf(title) };
}

// "Mini Pearl Handbag for iPhone 15 Pro Max": the phone is only what the item fits. For a search that
// names a model number (and no accessory word) the model must appear BEFORE "for / compatible with ...".
const FITS_WORDS = new Set(['for', 'compatible', 'fits', 'suitable']);
function modelOnlyAfterFits(model, title) {
  const raw = normalizeText(title).split(' ');
  const at = raw.findIndex((t) => FITS_WORDS.has(t));
  if (at < 0) return false;
  const head = raw.slice(0, at).join(' ');
  const { tokens, compact } = titleInfo(head);
  return !model.every((t) => tokenMatches(t, tokens, compact));
}

function isRelevant(parsedQuery, title) {
  const { tokens, wantsAccessory, accessoryWords, model, words } = parsedQuery;
  if (!tokens.length) return true;
  const { tokens: titleTokens, compact } = titleInfo(title);
  if (!wantsAccessory && accessoryWordsIn([...titleTokens]).length) return false;
  // A title that names a DIFFERENT known brand is another product ("tefal air fryer" is not a Philips).
  // Titles with no recognised brand (common on Daraz) are still allowed.
  if (parsedQuery.brand) {
    const other = brandOf(title);
    if (other && other !== parsedQuery.brand) return false;
  }

  if (!model.every((t) => tokenMatches(t, titleTokens, compact))) return false;
  if (!wantsAccessory && model.length && modelOnlyAfterFits(model, title)) return false;
  if (!words.length) {
    // Only model numbers and/or accessory words in the query: with nothing else to go on, an
    // accessory-only query ("case") needs at least one of those words.
    return model.length > 0 || accessoryWords.some((t) => tokenMatches(t, titleTokens, compact));
  }
  // A word also counts when glued to a neighbouring query word in the title ("air fryer" ~ "airfryer").
  const glued = (i) => [i - 1, i + 1].some((j) => words[j] && compact.includes(j < i ? words[j] + words[i] : words[i] + words[j]));
  const brandNamed = parsedQuery.brand && brandOf(title) === parsedQuery.brand; // "Galaxy A15 Case" names Samsung
  const hit = words.filter((t, i) => tokenMatches(t, titleTokens, compact) || glued(i) || (brandNamed && t === parsedQuery.brand)).length;
  return hit >= Math.ceil((words.length * 2) / 3);
}

// Relevant if ANY of a product's names (title or the titles of its store listings) is relevant.
const isRelevantAny = (parsedQuery, titles) => titles.some((t) => isRelevant(parsedQuery, t));

// 0..1 score used to order results; accessory words in the query raise titles that contain them.
function relevanceScore(parsedQuery, title) {
  const { tokens, accessoryWords, model } = parsedQuery;
  if (!tokens.length) return 0;
  const { tokens: titleTokens, compact } = titleInfo(title);
  const hit = tokens.filter((t) => tokenMatches(t, titleTokens, compact)).length;
  let score = hit / tokens.length;
  if (accessoryWords.length) {
    const wanted = accessoryWords.filter((t) => tokenMatches(t, titleTokens, compact)).length;
    score += 0.25 * (wanted / accessoryWords.length);
    // an unrelated accessory (a case when a charger was asked for) ranks below the requested kind
    if (!wanted && accessoryWordsIn([...titleTokens]).length) score -= 0.15;
  }
  // Ranking only (nothing is hidden): when the query did not ask for accessories, titles that are clearly
  // accessories (case, cover, charger ... or "for / compatible with" the phone) rank below real products.
  if (!accessoryWords.length) {
    const accessoryLike = accessoryWordsIn([...titleTokens]).length > 0 || (model.length > 0 && normalizeText(title).split(' ').some((t) => FITS_WORDS.has(t)));
    if (accessoryLike) score -= 0.3;
  }
  // Prefer concise titles with the same hits (closer to the exact product).
  return score - Math.min(titleTokens.size, 30) * 0.002;
}

const bestScore = (parsedQuery, titles) => Math.max(...titles.map((t) => relevanceScore(parsedQuery, t)));

module.exports = { TOKEN_SYNONYMS, parseQuery, isRelevant, isRelevantAny, relevanceScore, bestScore };
