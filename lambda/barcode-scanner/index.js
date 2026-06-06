'use strict';

const allIngredientKeys = require('./ingredients.json');

const OFT_TIMEOUT_MS = 5000;
const VALID_BARCODE = /^\d{8,14}$/;

async function handler(event) {
  return handlerWithFetch(event, fetch);
}

async function handlerWithFetch(event, fetchFn) {
  let body;
  try {
    body = JSON.parse(event.body ?? '{}');
  } catch {
    return response(400, { error: 'Invalid JSON' });
  }

  const { barcode } = body;
  if (typeof barcode !== 'string' || !VALID_BARCODE.test(barcode)) {
    return response(400, { error: 'Invalid barcode format' });
  }

  let productData;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), OFT_TIMEOUT_MS);
    try {
      const res = await fetchFn(
        `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`,
        { signal: controller.signal }
      );
      productData = await res.json();
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      return response(504, { error: 'Product lookup timed out' });
    }
    console.error('[barcode-scanner] Open Food Facts call failed:', err);
    return response(500, { error: 'Barcode lookup failed' });
  }

  if (!productData || productData.status !== 1 || !productData.product) {
    return response(404, { error: 'Product not found' });
  }

  const rawIngredients = extractIngredients(productData.product);
  const seen = new Set();
  const matched = rawIngredients
    .map(name => {
      const sanitized = sanitizeName(name);
      if (!sanitized) return null;
      const result = matchToEpicureKey(sanitized, allIngredientKeys);
      if (!result) return null;
      if (seen.has(result.epicureKey)) return null;
      seen.add(result.epicureKey);
      return {
        displayName: sanitized,
        epicureKey: result.epicureKey,
        confident: result.confident,
        matchScore: result.matchScore,
      };
    })
    .filter(Boolean);

  return response(200, {
    inferredArea: 'cupboard',
    areaConfident: true,
    ingredients: matched,
  });
}

function extractIngredients(product) {
  if (Array.isArray(product.ingredients) && product.ingredients.length > 0) {
    return product.ingredients
      .map(i => (typeof i.text === 'string' ? i.text : ''))
      .filter(Boolean);
  }
  if (typeof product.ingredients_text === 'string' && product.ingredients_text.trim()) {
    return product.ingredients_text
      .split(/[,;]/)
      .map(s => s.trim())
      .filter(Boolean);
  }
  return [];
}

function sanitizeName(name) {
  const cleaned = name.replace(/[^a-zA-Z0-9 ]/g, '').trim().slice(0, 100);
  return cleaned || null;
}

function matchToEpicureKey(name, keys) {
  const normalized = name.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
  const asKey = normalized.replace(/\s+/g, '_');

  if (keys.includes(asKey)) {
    return { epicureKey: asKey, confident: true, matchScore: 1.0 };
  }

  if (asKey.endsWith('s')) {
    const singular = asKey.slice(0, -1);
    if (keys.includes(singular)) {
      return { epicureKey: singular, confident: true, matchScore: 1.0 };
    }
  }

  const tokens = normalized.split(/\s+/).filter(Boolean);

  for (let len = tokens.length; len >= 1; len--) {
    const candidate = tokens.slice(0, len).join('_');
    if (keys.includes(candidate)) {
      const matchRatio = len / tokens.length;
      return { epicureKey: candidate, confident: matchRatio >= 0.8, matchScore: matchRatio };
    }
  }

  let bestKey = null;
  let bestScore = 0;

  for (const key of keys) {
    const keyTokens = new Set(key.split('_'));
    const overlap = tokens.filter(t => keyTokens.has(t)).length;
    const score = overlap / Math.max(tokens.length, keyTokens.size);
    if (score > bestScore) {
      bestScore = score;
      bestKey = key;
    }
  }

  if (bestKey && bestScore >= 0.4) {
    return { epicureKey: bestKey, confident: bestScore >= 0.8, matchScore: bestScore };
  }

  return null;
}

function response(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify(body),
  };
}

module.exports = { handler, handlerWithFetch, matchToEpicureKey, sanitizeName, extractIngredients };
