// Query relevance: decides whether a listing/product title actually answers a search.
// Needed because stores return loose results (PriceOye returns TVs for "galaxy a55",
// Daraz returns cases and screen protectors for phone queries).
const { significantTokens, hasAccessoryWord } = require('./matching');

const hasDigit = (t) => /\d/.test(t);

function tokenMatches(q, titleTokens) {
  if (titleTokens.has(q)) return true;
  if (titleTokens.has(`${q}s`)) return true;
  if (q.endsWith('s') && titleTokens.has(q.slice(0, -1))) return true;
  if (q.length >= 4) for (const t of titleTokens) if (t.length > q.length && t.startsWith(q)) return true;
  return false;
}

function parseQuery(q) {
  const tokens = significantTokens(q);
  return { tokens, wantsAccessory: hasAccessoryWord(tokens) };
}

// Model tokens (contain a digit, e.g. "a56", "15", "128gb") must all match; other words need >= 2/3.
function isRelevant(parsedQuery, title) {
  const { tokens, wantsAccessory } = parsedQuery;
  if (!tokens.length) return true;
  const titleTokens = new Set(significantTokens(title));
  if (!wantsAccessory && hasAccessoryWord([...titleTokens])) return false;

  const model = tokens.filter(hasDigit);
  if (!model.every((t) => tokenMatches(t, titleTokens))) return false;
  const words = tokens.filter((t) => !hasDigit(t));
  if (!words.length) return true;
  const hit = words.filter((t) => tokenMatches(t, titleTokens)).length;
  return hit >= Math.ceil((words.length * 2) / 3);
}

// 0..1 score used to order results by relevance.
function relevanceScore(parsedQuery, title) {
  const { tokens } = parsedQuery;
  if (!tokens.length) return 0;
  const titleTokens = new Set(significantTokens(title));
  const hit = tokens.filter((t) => tokenMatches(t, titleTokens)).length;
  // Prefer concise titles with the same hits (closer to the exact product).
  return hit / tokens.length - Math.min(titleTokens.size, 30) * 0.002;
}

module.exports = { parseQuery, isRelevant, relevanceScore };
