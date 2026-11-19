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

// Returns the JSON array that starts right after `marker` (e.g. '"products":['), found by bracket
// matching that is aware of quoted strings (so a "]" inside a title never ends the array early).
// null if the marker is not in the page. Shared by adapters that read a result list embedded in a
// script tag instead of server-rendered HTML (AliExpress, Shein, Temu).
function extractJsonArray(html, marker) {
  const at = html.indexOf(marker);
  if (at < 0) return null;
  const start = at + marker.length;
  if (html[start] !== '[') return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < html.length; i += 1) {
    const ch = html[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
    } else if (ch === '"') inString = true;
    else if (ch === '[' || ch === '{') depth += 1;
    else if (ch === ']' || ch === '}') {
      depth -= 1;
      if (depth === 0) return html.slice(start, i + 1);
    }
  }
  return null;
}

// Tries each marker in turn (sites move the embedded JSON around between redesigns) and returns the
// first array found, parsed. null if none of the markers matched or the match was not valid JSON.
function extractFirstJsonArray(html, markers) {
  for (const marker of markers) {
    const raw = extractJsonArray(String(html || ''), marker);
    if (!raw) continue;
    try {
      return JSON.parse(raw);
    } catch {
      /* try the next marker */
    }
  }
  return null;
}

module.exports = { parsePrice, parseNumber, parseRating, absoluteUrl, extractJsonArray, extractFirstJsonArray };
