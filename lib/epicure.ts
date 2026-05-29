import { readFileSync } from "fs";
import { join } from "path";

type EmbeddingMap = Record<string, number[]>;
type AllergenMap = Record<string, string[]>;

let _embeddings: EmbeddingMap | null = null;
let _allergenMap: AllergenMap | null = null;

function getEmbeddings(): EmbeddingMap {
  if (!_embeddings) {
    _embeddings = JSON.parse(
      readFileSync(join(process.cwd(), "data", "epicure-core.json"), "utf-8")
    ) as EmbeddingMap;
  }
  return _embeddings;
}

function getAllergenMap(): AllergenMap {
  if (!_allergenMap) {
    _allergenMap = JSON.parse(
      readFileSync(join(process.cwd(), "data", "allergen-map.json"), "utf-8")
    ) as AllergenMap;
  }
  return _allergenMap;
}

export const allIngredients: string[] = Object.keys(getEmbeddings());

// ─── Allergens ────────────────────────────────────────────────────────────────

/** EU Big 14 allergen codes used in allergen-map.json. */
export const ALLERGEN_CODES = [
  "celery", "crustaceans", "eggs", "fish", "gluten",
  "lupin", "milk", "molluscs", "mustard", "peanuts",
  "sesame", "soy", "sulphites", "tree_nuts",
] as const;

export type AllergenCode = (typeof ALLERGEN_CODES)[number];

/** Display labels for the EU Big 14, for the common-allergens quick-pick UI. */
export const COMMON_ALLERGENS: { code: AllergenCode; label: string }[] = [
  { code: "milk",        label: "Milk" },
  { code: "eggs",        label: "Eggs" },
  { code: "gluten",      label: "Gluten (wheat, rye, barley, oats)" },
  { code: "peanuts",     label: "Peanuts" },
  { code: "tree_nuts",   label: "Tree Nuts" },
  { code: "fish",        label: "Fish" },
  { code: "crustaceans", label: "Crustaceans" },
  { code: "molluscs",    label: "Molluscs" },
  { code: "soy",         label: "Soy" },
  { code: "sesame",      label: "Sesame" },
  { code: "mustard",     label: "Mustard" },
  { code: "celery",      label: "Celery" },
  { code: "sulphites",   label: "Sulphites" },
  { code: "lupin",       label: "Lupin" },
];

/** Returns the allergen codes for a single ingredient (empty array = allergen-free). */
export function getAllergensForIngredient(ingredient: string): string[] {
  return getAllergenMap()[ingredient] ?? [];
}

/**
 * Maps each allergen code to the dataset ingredients that contain it.
 * Computed once and cached — used to populate the full allergen dropdown.
 */
export const allergenIngredients: Record<string, string[]> = (() => {
  const map = getAllergenMap();
  const result: Record<string, string[]> = {};
  for (const code of ALLERGEN_CODES) result[code] = [];
  for (const [ingredient, codes] of Object.entries(map)) {
    for (const code of codes) {
      result[code]?.push(ingredient);
    }
  }
  return result;
})();

// ─── Similarity ───────────────────────────────────────────────────────────────

function dot(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}

function magnitude(v: number[]): number {
  return Math.sqrt(dot(v, v));
}

function cosineSimilarity(a: number[], b: number[]): number {
  const denom = magnitude(a) * magnitude(b);
  return denom === 0 ? 0 : dot(a, b) / denom;
}

function averageVectors(vecs: number[][]): number[] {
  const dim = vecs[0].length;
  const result = new Array<number>(dim).fill(0);
  for (const vec of vecs) {
    for (let i = 0; i < dim; i++) result[i] += vec[i];
  }
  return result.map((v) => v / vecs.length);
}

export function findSimilarIngredients(ingredient: string, k: number): string[] {
  const emb = getEmbeddings();
  const query = emb[ingredient];
  if (!query) return [];

  return Object.entries(emb)
    .filter(([name]) => name !== ingredient)
    .map(([name, vec]) => ({ name, score: cosineSimilarity(query, vec) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map(({ name }) => name);
}

/** Cosine similarity between two named Epicure ingredients. Returns 0 for unknown keys. */
export function cosineSimilarityBetween(a: string, b: string): number {
  const emb = getEmbeddings()
  const vecA = emb[a]
  const vecB = emb[b]
  if (!vecA || !vecB) return 0
  return cosineSimilarity(vecA, vecB)
}

/** Normalise a human-readable ingredient name to an Epicure key. */
export function toEpicureKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, '_')
}

// ─── Ingredient name normalisation ───────────────────────────────────────────

export const MODIFIER_PREFIXES = new Set([
  'tinned', 'canned', 'jarred', 'grated', 'fresh', 'dried', 'frozen',
  'smoked', 'brown', 'plain', 'ground', 'whole', 'chopped', 'sliced',
  'diced', 'minced', 'crushed', 'large', 'small', 'medium', 'baby',
  'ripe', 'raw', 'cooked', 'roasted', 'toasted',
])

export const INGREDIENT_SYNONYMS: Record<string, string> = {
  // Pasta shapes
  fusilli: 'pasta', spaghetti: 'pasta', penne: 'pasta', rigatoni: 'pasta',
  tagliatelle: 'pasta', linguine: 'pasta', fettuccine: 'pasta',
  farfalle: 'pasta', rotini: 'pasta', macaroni: 'pasta', orzo: 'pasta',
  // Corn
  'sweet corn': 'corn', sweetcorn: 'corn',
  // British / regional
  courgette: 'zucchini', aubergine: 'eggplant', capsicum: 'pepper',
  prawn: 'shrimp', coriander: 'cilantro', rocket: 'arugula',
  // Dairy
  'cheddar cheese': 'cheese', cheddar: 'cheese', parmesan: 'cheese',
  mozzarella: 'cheese', brie: 'cheese', feta: 'cheese',
  // Flour variants
  'self raising flour': 'flour', 'self-raising flour': 'flour',
  'strong flour': 'flour', 'bread flour': 'flour', 'wholemeal flour': 'flour',
}

/**
 * Generate normalised candidate strings to try for Epicure key resolution,
 * most specific first. Handles:
 *   - Parenthetical descriptions: "Pasta (Penne Or Rigatoni)" → tries "pasta",
 *     then "penne" / "rigatoni" as fallbacks
 *   - Comma-separated descriptors: "garlic cloves, thinly sliced" → "garlic cloves"
 *   - Modifier prefixes: "tinned tuna" → "tuna"
 *   - Prep-phrase suffixes: "onion, finely diced" → "onion"
 *   - Ingredient synonyms: "fusilli" → "pasta"
 *   - Individual-word fallbacks (longest first)
 */
export function normaliseCandidates(raw: string): string[] {
  // 1. Strip descriptor after the first top-level comma (ignore commas inside parens)
  let beforeComma = raw
  let depth = 0
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] === '(') { depth++; continue }
    if (raw[i] === ')') { depth--; continue }
    if (raw[i] === ',' && depth === 0) { beforeComma = raw.slice(0, i); break }
  }
  beforeComma = beforeComma.trim()

  // 2. Collect words from parenthetical alternatives before stripping them.
  //    Filter out stop words and prep/descriptor words so only real ingredient
  //    names (e.g. "penne", "cream") are kept as fallback candidates.
  const SKIP_WORDS = new Set(['or', 'and', 'the', 'a', 'an', 'to', 'of'])
  const PREP_WORDS = new Set([
    'salted', 'unsalted', 'softened', 'melted', 'chopped', 'diced', 'sliced',
    'crushed', 'minced', 'grated', 'shredded', 'rinsed', 'drained', 'peeled',
    'trimmed', 'finely', 'coarsely', 'roughly', 'thinly', 'thickly', 'optional',
  ])
  const parenWords: string[] = (beforeComma.match(/\(([^)]+)\)/g) ?? [])
    .flatMap((m) => m.slice(1, -1).split(/[\s/,]+/))
    .map((w) => w.trim().toLowerCase())
    .filter((w) => w.length > 2 && !SKIP_WORDS.has(w) && !PREP_WORDS.has(w) && !MODIFIER_PREFIXES.has(w))

  // 3. Strip parenthetical content from the base name
  const clean = beforeComma.replace(/\s*\(.*?\)/g, '').trim()
  const lower = clean.toLowerCase()

  const candidates: string[] = []
  const addWithSynonym = (s: string) => {
    candidates.push(s)
    const syn = INGREDIENT_SYNONYMS[s]
    if (syn) candidates.push(syn)
  }

  addWithSynonym(lower)

  // Strip trailing prep phrases ("finely chopped", "diced", etc.)
  const stripped = lower
    .replace(/,?\s*(finely\s+)?(chopped|diced|sliced|crushed|minced|grated|shredded|rinsed|drained|peeled|trimmed)\s*$/i, '')
    .trim()
  if (stripped !== lower) addWithSynonym(stripped)

  // Strip leading modifier prefix (first word only)
  const words = stripped.split(/\s+/)
  if (words.length > 1 && MODIFIER_PREFIXES.has(words[0])) {
    const noPrefix = words.slice(1).join(' ')
    addWithSynonym(noPrefix)
    // Strip second prefix if still present (e.g. "tinned chopped tomatoes")
    const words2 = noPrefix.split(/\s+/)
    if (words2.length > 1 && MODIFIER_PREFIXES.has(words2[0])) {
      addWithSynonym(words2.slice(1).join(' '))
    }
  }

  // Individual words from the base name as fallbacks (longest first).
  // Also try the singular form of each word ("tomatoes" → "tomato").
  const core = (candidates[candidates.length - 1] ?? lower).split(/\s+/).filter((w) => w.length > 2)
  for (const w of core.sort((a, b) => b.length - a.length)) {
    addWithSynonym(w)
    const sing =
      w.endsWith('ies') && w.length > 4 ? w.slice(0, -3) + 'y' :
      w.endsWith('ves') && w.length > 4 ? w.slice(0, -3) + 'f' :
      w.endsWith('es')  && w.length > 4 && !w.endsWith('ies') ? w.slice(0, -2) :
      w.endsWith('s')   && !w.endsWith('ss') && w.length > 4  ? w.slice(0, -1) :
      null
    if (sing && sing !== w) addWithSynonym(sing)
  }

  // Parenthetical alternatives as final fallbacks
  for (const w of parenWords) {
    addWithSynonym(w)
  }

  return [...new Set(candidates)]
}

// ─── Functional category system ───────────────────────────────────────────────

export const INGREDIENT_CATEGORIES: Record<string, string[]> = {
  fat:               ["butter", "olive_oil", "coconut_oil", "lard", "ghee", "margarine", "vegetable_oil"],
  dairy_alternative: ["oat_milk", "soy_milk", "almond_milk", "coconut_milk", "cashew_milk"],
  cheese:            ["nutritional_yeast", "cashew"],
  liquid:            ["milk", "water", "broth", "stock", "cream"],
  grain:             ["pasta", "rice", "flour", "bread", "oats", "quinoa", "couscous"],
  protein:           ["chicken", "beef", "tofu", "egg", "fish", "tuna", "salmon", "tempeh"],
  vegetable:         ["onion", "garlic", "tomato", "carrot", "celery", "pepper"],
}

// Reverse map for O(1) lookup. An ingredient can belong to at most one category
// (first-write wins if there were duplicates, which there are none of above).
const _ingredientToCategory: Record<string, string> = {}
for (const [cat, items] of Object.entries(INGREDIENT_CATEGORIES)) {
  for (const item of items) {
    if (!(_ingredientToCategory[item])) _ingredientToCategory[item] = cat
  }
}

/** Returns the functional category for an Epicure key, or null if uncategorised. */
export function getCategoryForIngredient(key: string): string | null {
  return _ingredientToCategory[key] ?? null
}

/** Returns every ingredient scored by cosine similarity to the query ingredient, sorted descending. Returns [] for unknown ingredients. */
export function rankSimilar(ingredient: string): { name: string; score: number }[] {
  const emb = getEmbeddings();
  const query = emb[ingredient];
  if (!query) return [];

  return Object.entries(emb)
    .filter(([name]) => name !== ingredient)
    .map(([name, vec]) => ({ name, score: cosineSimilarity(query, vec) }))
    .sort((a, b) => b.score - a.score);
}

/**
 * Finds flavour-matched suggestions for the given ingredients, excluding
 * anything that contains one or more of the specified allergen codes.
 */
export function findSafeIngredients(
  ingredients: string[],
  allergenCodes: AllergenCode[],
  k: number
): string[] {
  const emb = getEmbeddings();
  const map = getAllergenMap();
  const queryVecs = ingredients.map((i) => emb[i]).filter(Boolean);
  if (queryVecs.length === 0) return [];

  const query = queryVecs.length === 1 ? queryVecs[0] : averageVectors(queryVecs);
  const inputSet = new Set(ingredients);
  const blockedSet = new Set(allergenCodes);

  return Object.entries(emb)
    .filter(([name]) => !inputSet.has(name))
    .filter(([name]) => {
      const codes = map[name] ?? [];
      return !codes.some((c) => blockedSet.has(c as AllergenCode));
    })
    .map(([name, vec]) => ({ name, score: cosineSimilarity(query, vec) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map(({ name }) => name);
}
