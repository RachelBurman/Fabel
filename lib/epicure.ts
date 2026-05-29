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
