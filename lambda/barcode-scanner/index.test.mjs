import { strict as assert } from "assert";
import { handlerWithFetch, matchToEpicureKey, sanitizeName, extractIngredients } from "./index.js";

const TEST_KEYS = [
  "garlic", "chicken", "olive_oil", "butter", "onion",
  "tomato", "pasta", "lemon", "egg", "sugar", "flour", "salt",
];

// ─── sanitizeName ─────────────────────────────────────────────────────────────

console.log("Testing sanitizeName...");

{
  assert.equal(sanitizeName("Garlic!!!"), "Garlic");
  console.log("  ✓ strips special characters");
}
{
  assert.equal(sanitizeName("   salt  "), "salt");
  console.log("  ✓ trims whitespace");
}
{
  const long = sanitizeName("a".repeat(200));
  assert.equal(long.length, 100);
  console.log("  ✓ truncates to 100 chars");
}
{
  assert.equal(sanitizeName("!!!"), null);
  console.log("  ✓ all-special-char input returns null");
}

// ─── extractIngredients ───────────────────────────────────────────────────────

console.log("\nTesting extractIngredients...");

{
  const product = { ingredients: [{ text: "Garlic" }, { text: "Salt" }, { noText: true }] };
  const result = extractIngredients(product);
  assert.deepEqual(result, ["Garlic", "Salt"]);
  console.log("  ✓ extracts text from structured ingredients array");
}
{
  const product = { ingredients_text: "Garlic; Tomato, Onion" };
  const result = extractIngredients(product);
  assert.deepEqual(result, ["Garlic", "Tomato", "Onion"]);
  console.log("  ✓ falls back to splitting ingredients_text on comma/semicolon");
}
{
  const result = extractIngredients({});
  assert.deepEqual(result, []);
  console.log("  ✓ returns empty array when no ingredient data");
}

// ─── matchToEpicureKey ────────────────────────────────────────────────────────

console.log("\nTesting matchToEpicureKey...");

{
  const r = matchToEpicureKey("Garlic", TEST_KEYS);
  assert.ok(r);
  assert.equal(r.epicureKey, "garlic");
  assert.equal(r.confident, true);
  assert.equal(r.matchScore, 1.0);
  console.log("  ✓ exact match (case-insensitive) returns confident: true, score: 1.0");
}
{
  const r = matchToEpicureKey("eggs", TEST_KEYS);
  assert.ok(r);
  assert.equal(r.epicureKey, "egg");
  assert.equal(r.confident, true);
  console.log("  ✓ trailing-s singularisation match");
}
{
  const r = matchToEpicureKey("chicken thighs", TEST_KEYS);
  assert.ok(r);
  assert.equal(r.epicureKey, "chicken");
  assert.equal(r.confident, false); // matchRatio 0.5 < 0.8
  console.log("  ✓ prefix match below 0.8 ratio returns confident: false");
}
{
  const r = matchToEpicureKey("olive oil", TEST_KEYS);
  assert.ok(r);
  assert.equal(r.epicureKey, "olive_oil");
  assert.equal(r.confident, true);
  console.log("  ✓ token overlap match (olive oil → olive_oil)");
}
{
  const r = matchToEpicureKey("xylophone", TEST_KEYS);
  assert.equal(r, null);
  console.log("  ✓ unrecognised ingredient returns null");
}

// ─── Barcode validation ───────────────────────────────────────────────────────

console.log("\nTesting barcode validation...");

const noFetch = async () => { throw new Error("fetch should not be called"); };

{
  const r = await handlerWithFetch({ body: JSON.stringify({ barcode: "ABC1234567890" }) }, noFetch);
  assert.equal(r.statusCode, 400);
  assert.deepEqual(JSON.parse(r.body), { error: "Invalid barcode format" });
  console.log("  ✓ non-numeric barcode returns 400");
}
{
  const r = await handlerWithFetch({ body: JSON.stringify({ barcode: "1234567" }) }, noFetch);
  assert.equal(r.statusCode, 400);
  console.log("  ✓ barcode shorter than 8 digits returns 400");
}
{
  const r = await handlerWithFetch({ body: JSON.stringify({ barcode: "123456789012345" }) }, noFetch);
  assert.equal(r.statusCode, 400);
  console.log("  ✓ barcode longer than 14 digits returns 400");
}
{
  const r = await handlerWithFetch({ body: JSON.stringify({}) }, noFetch);
  assert.equal(r.statusCode, 400);
  console.log("  ✓ missing barcode returns 400");
}
{
  const r = await handlerWithFetch({ body: "not json" }, noFetch);
  assert.equal(r.statusCode, 400);
  console.log("  ✓ invalid JSON body returns 400");
}

// ─── Open Food Facts responses ────────────────────────────────────────────────

console.log("\nTesting Open Food Facts responses...");

{
  // EAN-8 (8 digits) — passes validation
  const mockFetch = async () => ({ json: async () => ({ status: 0 }) });
  const r = await handlerWithFetch({ body: JSON.stringify({ barcode: "12345678" }) }, mockFetch);
  assert.equal(r.statusCode, 404);
  console.log("  ✓ 8-digit EAN-8 barcode passes validation");
}
{
  // EAN-13 (13 digits) — passes validation
  const mockFetch = async () => ({ json: async () => ({ status: 0 }) });
  const r = await handlerWithFetch({ body: JSON.stringify({ barcode: "5000112637922" }) }, mockFetch);
  assert.equal(r.statusCode, 404);
  console.log("  ✓ 13-digit EAN-13 barcode passes validation");
}
{
  // status 0 → 404
  const mockFetch = async () => ({ json: async () => ({ status: 0, product: null }) });
  const r = await handlerWithFetch({ body: JSON.stringify({ barcode: "5000112637922" }) }, mockFetch);
  assert.equal(r.statusCode, 404);
  assert.deepEqual(JSON.parse(r.body), { error: "Product not found" });
  console.log("  ✓ OFT status 0 (not found) returns 404");
}
{
  // AbortError → 504
  const mockFetch = () => {
    const err = new Error("The operation was aborted");
    err.name = "AbortError";
    return Promise.reject(err);
  };
  const r = await handlerWithFetch({ body: JSON.stringify({ barcode: "5000112637922" }) }, mockFetch);
  assert.equal(r.statusCode, 504);
  assert.deepEqual(JSON.parse(r.body), { error: "Product lookup timed out" });
  console.log("  ✓ timeout returns 504");
}
{
  // Network error → 500
  const mockFetch = async () => { throw new Error("Network failure"); };
  const r = await handlerWithFetch({ body: JSON.stringify({ barcode: "5000112637922" }) }, mockFetch);
  assert.equal(r.statusCode, 500);
  assert.deepEqual(JSON.parse(r.body), { error: "Barcode lookup failed" });
  console.log("  ✓ network error returns 500");
}

// ─── Valid barcode — ingredient matching ──────────────────────────────────────

console.log("\nTesting ingredient extraction and matching...");

{
  const mockFetch = async () => ({
    json: async () => ({
      status: 1,
      product: {
        ingredients: [
          { text: "Garlic" },
          { text: "Olive Oil" },
          { text: "Salt!!!" }, // special chars stripped → "Salt"
          { text: "xylophoneZ999" }, // no match
        ],
      },
    }),
  });
  const r = await handlerWithFetch({ body: JSON.stringify({ barcode: "5000112637922" }) }, mockFetch);
  assert.equal(r.statusCode, 200);
  const body = JSON.parse(r.body);
  assert.equal(body.inferredArea, "cupboard");
  assert.equal(body.areaConfident, true);
  assert.ok(Array.isArray(body.ingredients));
  assert.ok(body.ingredients.every(i => typeof i.epicureKey === "string"));
  assert.ok(body.ingredients.every(i => typeof i.confident === "boolean"));
  assert.ok(body.ingredients.every(i => typeof i.matchScore === "number"));
  const garlic = body.ingredients.find(i => i.epicureKey === "garlic");
  assert.ok(garlic, "garlic should be matched");
  assert.equal(garlic.confident, true);
  console.log("  ✓ valid barcode returns correct shape (inferredArea: cupboard)");
  console.log("  ✓ matched ingredients have epicureKey, confident, matchScore");
}
{
  // ingredients_text fallback
  const mockFetch = async () => ({
    json: async () => ({
      status: 1,
      product: { ingredients_text: "Garlic, Tomato, Onion" },
    }),
  });
  const r = await handlerWithFetch({ body: JSON.stringify({ barcode: "5000112637922" }) }, mockFetch);
  assert.equal(r.statusCode, 200);
  const body = JSON.parse(r.body);
  assert.ok(body.ingredients.length > 0, "should match some ingredients");
  console.log("  ✓ falls back to ingredients_text when ingredients array absent");
}
{
  // Ingredient sanitisation before matching
  const mockFetch = async () => ({
    json: async () => ({
      status: 1,
      product: {
        ingredients: [
          { text: "Salt!!!" }, // → sanitized "Salt" → matches "salt" key
        ],
      },
    }),
  });
  const r = await handlerWithFetch({ body: JSON.stringify({ barcode: "5000112637922" }) }, mockFetch);
  assert.equal(r.statusCode, 200);
  const body = JSON.parse(r.body);
  const salt = body.ingredients.find(i => i.epicureKey === "salt");
  assert.ok(salt, "salt should be matched after sanitisation");
  console.log("  ✓ ingredient names are sanitised before Epicure matching");
}

console.log("\nAll barcode Lambda tests passed.");
