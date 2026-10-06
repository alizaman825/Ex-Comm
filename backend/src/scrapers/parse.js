// Small parsing helpers shared by the adapters.

// "Rs. 127,000" / "127000" / "1,23,999.00" -> 127000 ; invalid -> null
function parsePrice(value) {
  const n = parseNumber(value);
  return n !== null && n > 0 ? Math.round(n) : null;
}

// First number in the string, ignoring thousands separators: "Rs. 1,299.50" -> 1299.5
function parseNumber(value) {
  const match = String(value ?? '').match(/\d[\d,]*(\.\d+)?/);
  if (!match) return null;
  const n = parseFloat(match[0].replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

function parseRating(value) {
  const n = parseNumber(value);
  return n !== null && n > 0 && n <= 5 ? Math.round(n * 10) / 10 : null;
}

function absoluteUrl(href, base) {
  if (!href) return null;
  if (href.startsWith('//')) return `https:${href}`;
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

module.exports = { parsePrice, parseNumber, parseRating, absoluteUrl };
