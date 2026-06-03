import { strict as assert } from "assert";
import { matchToEpicureKey, handlerWithClient } from "./index.mjs";

// Small representative key list for unit tests
const TEST_KEYS = [
  "garlic",
  "chicken",
  "olive_oil",
  "cheddar",
  "butter",
  "onion",
  "tomato",
  "pasta",
  "lemon",
  "egg",
];

// ─── matchToEpicureKey ────────────────────────────────────────────────────────

console.log("Testing matchToEpicureKey...");

// Exact match → confident: true
{
  const r = matchToEpicureKey("garlic", false, TEST_KEYS);
  assert.ok(r, "should match garlic");
  assert.equal(r.epicureKey, "garlic");
  assert.equal(r.confident, true);
  console.log("  ✓ exact match returns confident: true");
}

// Exact match but Claude uncertain → confident: false
{
  const r = matchToEpicureKey("garlic", true, TEST_KEYS);
  assert.ok(r);
  assert.equal(r.confident, false);
  console.log("  ✓ exact match with uncertain flag → confident: false");
}

// Prefix match ("chicken thighs" → "chicken")
{
  const r = matchToEpicureKey("chicken thighs", false, TEST_KEYS);
  assert.ok(r);
  assert.equal(r.epicureKey, "chicken");
  // "chicken" is 1 of 2 tokens → matchRatio 0.5 < 0.8 → not confident
  assert.equal(r.confident, false);
  console.log("  ✓ prefix match (chicken thighs → chicken) returns confident: false");
}

// Exact single-word match
{
  const r = matchToEpicureKey("butter", false, TEST_KEYS);
  assert.ok(r);
  assert.equal(r.epicureKey, "butter");
  assert.equal(r.confident, true);
  console.log("  ✓ single-word exact match → confident: true");
}

// No match → null
{
  const r = matchToEpicureKey("xylophone", false, TEST_KEYS);
  assert.equal(r, null);
  console.log("  ✓ unrecognised ingredient returns null");
}

// Token overlap match
{
  const r = matchToEpicureKey("olive oil", false, TEST_KEYS);
  assert.ok(r);
  assert.equal(r.epicureKey, "olive_oil");
  assert.equal(r.confident, true); // "olive_oil" matches both tokens, overlap 2/2 = 1.0
  console.log("  ✓ token overlap match (olive oil → olive_oil) → confident: true");
}

// ─── handler shape ────────────────────────────────────────────────────────────

console.log("\nTesting handler shape...");

const fakeTextContent = JSON.stringify({
  area: "fridge",
  areaConfident: true,
  ingredients: [
    { name: "garlic", uncertain: false },
    { name: "chicken thighs", uncertain: false },
    { name: "xylophone", uncertain: true },
  ],
});

const mockClient = {
  messages: {
    create: async () => ({
      content: [{ type: "text", text: fakeTextContent }],
    }),
  },
};

const fakeEvent = {
  body: JSON.stringify({
    image: "ZmFrZWltYWdl", // base64 of "fakeimage"
    mediaType: "image/jpeg",
  }),
};

const result = await handlerWithClient(fakeEvent, mockClient);
assert.equal(result.statusCode, 200);
const body = JSON.parse(result.body);
assert.equal(body.inferredArea, "fridge");
assert.equal(body.areaConfident, true);
assert.ok(Array.isArray(body.ingredients));
// garlic → matched
const garlic = body.ingredients.find((i) => i.epicureKey === "garlic");
assert.ok(garlic, "garlic should be matched");
assert.equal(garlic.confident, true);
// chicken thighs → matched but not confident
const chicken = body.ingredients.find((i) => i.epicureKey === "chicken");
assert.ok(chicken, "chicken should be matched from chicken thighs");
assert.equal(chicken.confident, false);
// xylophone → excluded (no match)
const xylophone = body.ingredients.find((i) => i.epicureKey === "xylophone");
assert.equal(xylophone, undefined, "xylophone should be excluded");
console.log("  ✓ handler returns correct shape");
console.log("  ✓ confident: true for exact match");
console.log("  ✓ confident: false for prefix match");
console.log("  ✓ unmatched ingredients excluded from results");

// Missing image → 400
{
  const r = await handlerWithClient({ body: JSON.stringify({ mediaType: "image/jpeg" }) }, mockClient);
  assert.equal(r.statusCode, 400);
  console.log("  ✓ missing image returns 400");
}

// Invalid JSON body → 400
{
  const r = await handlerWithClient({ body: "not json" }, mockClient);
  assert.equal(r.statusCode, 400);
  console.log("  ✓ invalid JSON body returns 400");
}

console.log("\nAll Lambda tests passed.");
