import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { dynamo } from "@/lib/dynamo";
import { allergenIngredients } from "@/lib/epicure";
import { type GeneratedRecipe } from "@/lib/types";
import { SEED_RECIPES, type SeedRecipe } from "@/lib/community-recipes-seed";

export type FallbackRecipe = GeneratedRecipe & { id: string };

export interface FindFallbackParams {
  allergens: string[];       // user's EU Big 14 allergen codes — hard filter
  safeFoods: string[] | null; // safe foods mode ingredient list — hard filter when set
  cuisine?: string;
  occasion?: string;
  mealType?: string;
  dietaryPresets?: string[]; // user's active diet presets — vegan/vegetarian are hard filters
  alcoholMode?: 'no_cooking' | 'exclude_entirely'; // if set, exclude recipes with alcohol
}

const ALCOHOL_TERMS = [
  'wine', 'beer', 'spirit', 'rum', 'gin', 'vodka', 'whiskey', 'whisky',
  'brandy', 'sherry', 'mirin', 'sake', 'champagne', 'prosecco', 'cider',
  'lager', 'stout', 'bourbon', 'tequila', 'vermouth', 'liqueur', 'port',
  'ale', 'cooking wine',
]

function ingredientHasAlcohol(name: string): boolean {
  const norm = name.toLowerCase()
  return ALCOHOL_TERMS.some(term => norm.includes(term))
}

function ingredientsHaveAlcohol(ingredientNames: string[]): boolean {
  return ingredientNames.some(ingredientHasAlcohol)
}

// Returns true if a recipe ingredient name plausibly contains the given allergen.
// Uses substring matching against known allergen ingredient keys from the truth table.
function ingredientNameHasAllergen(
  name: string,
  allergenCode: string
): boolean {
  const keys = allergenIngredients[allergenCode] ?? [];
  const norm = name.toLowerCase().replace(/[^a-z0-9\s]/g, " ").trim();
  return keys.some((key) => {
    const keyWords = key.replace(/_/g, " ");
    // Either the ingredient name contains the key term, or the first key word
    // appears in the name (handles "chicken breast" → "chicken" match)
    return (
      norm.includes(keyWords) ||
      norm.split(/\s+/)[0] === keyWords.split(/\s+/)[0]
    );
  });
}

function recipeIngredientsHaveAllergen(
  ingredientNames: string[],
  allergenCode: string
): boolean {
  return ingredientNames.some((n) => ingredientNameHasAllergen(n, allergenCode));
}

function isSafeForAllergens(
  ingredientNames: string[],
  allergens: string[]
): boolean {
  return allergens.every(
    (code) => !recipeIngredientsHaveAllergen(ingredientNames, code)
  );
}

function ingredientInSafeList(name: string, safeFoods: string[]): boolean {
  const norm = name.toLowerCase().replace(/_/g, " ").trim();
  return safeFoods.some((s) => {
    const sf = s.toLowerCase().replace(/_/g, " ").trim();
    return norm.includes(sf) || sf.includes(norm);
  });
}

function isSafeForSafeFoods(
  ingredientNames: string[],
  safeFoods: string[]
): boolean {
  return ingredientNames.every((n) => ingredientInSafeList(n, safeFoods));
}

function scoreCandidate(
  cuisine: string | undefined,
  mealType: string | undefined,
  occasion: string | undefined,
  dietaryPresets: string[] | undefined,
  recipeTagCuisine: string,
  recipeTagMealType: string,
  recipeTagPresets: string[] | undefined
): number {
  let score = 0;
  if (
    cuisine &&
    recipeTagCuisine &&
    recipeTagCuisine.toLowerCase().includes(cuisine.toLowerCase())
  ) {
    score += 3;
  }
  if (
    mealType &&
    recipeTagMealType &&
    recipeTagMealType.toLowerCase().includes(mealType.toLowerCase())
  ) {
    score += 2;
  }
  if (occasion) {
    // No occasion metadata on DB recipes — skip; seed recipes don't have occasion either
  }
  if (dietaryPresets && recipeTagPresets) {
    for (const preset of dietaryPresets) {
      if (recipeTagPresets.includes(preset)) score += 1;
    }
  }
  // Light randomisation so the same recipe isn't always returned
  score += (Math.random() - 0.5);
  return score;
}

async function queryDBFallback(
  params: FindFallbackParams
): Promise<FallbackRecipe | null> {
  // DB recipes have no dietary preset metadata — skip when vegan/vegetarian is required
  // so we fall through to seed recipes which have proper tags.
  const strictPresets = ['vegan', 'vegetarian']
  if (params.dietaryPresets?.some(p => strictPresets.includes(p))) return null

  try {
    // Scan all saved (isSaved: true) recipes for community candidates.
    // At hackathon scale this is fine; at production scale add a GSI.
    const result = await dynamo.send(
      new ScanCommand({
        TableName: "fable-saved-recipes",
        FilterExpression: "isSaved = :t",
        ExpressionAttributeValues: { ":t": true },
        ProjectionExpression:
          "recipeId, title, description, cookTime, servings, allergenFree, ingredients, #st",
        ExpressionAttributeNames: { "#st": "steps" },
      })
    );

    const items = result.Items ?? [];
    if (items.length === 0) return null;

    type SavedItem = Record<string, unknown>;

    const candidates: { item: SavedItem; score: number }[] = [];

    for (const item of items as SavedItem[]) {
      // Extract ingredient names for allergen checking
      const rawIngredients: unknown = item.ingredients;
      const ingredientNames: string[] = [];
      if (Array.isArray(rawIngredients)) {
        for (const ing of rawIngredients) {
          if (typeof ing === "object" && ing !== null && "name" in ing) {
            ingredientNames.push(String((ing as Record<string, unknown>).name));
          } else if (typeof ing === "string") {
            ingredientNames.push(ing);
          }
        }
      }

      if (ingredientNames.length === 0) continue;

      // Hard filter: allergens
      if (!isSafeForAllergens(ingredientNames, params.allergens)) continue;

      // Hard filter: safe foods mode
      if (params.safeFoods && params.safeFoods.length > 0) {
        if (!isSafeForSafeFoods(ingredientNames, params.safeFoods)) continue;
      }

      // Hard filter: alcohol
      if (params.alcoholMode && ingredientsHaveAlcohol(ingredientNames)) continue;

      const score = scoreCandidate(
        params.cuisine,
        params.mealType,
        params.occasion,
        params.dietaryPresets,
        "", // DB recipes have no cuisine tag
        "",
        undefined
      );
      candidates.push({ item, score });
    }

    if (candidates.length === 0) return null;

    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0].item;

    return {
      id: String(best.recipeId ?? crypto.randomUUID()),
      title: String(best.title ?? "Community Recipe"),
      description: String(best.description ?? ""),
      cookTime: String(best.cookTime ?? "30 minutes"),
      servings: typeof best.servings === "number" ? best.servings : 2,
      allergenFree: true,
      ingredients: Array.isArray(best.ingredients)
        ? (best.ingredients as GeneratedRecipe["ingredients"])
        : [],
      steps: Array.isArray(best.steps)
        ? (best.steps as string[])
        : [],
    };
  } catch (err) {
    console.error("[community-recipe-fallback] DB scan failed:", err);
    return null;
  }
}

function querySeedFallback(params: FindFallbackParams): FallbackRecipe | null {
  const candidates: { seed: SeedRecipe; score: number }[] = [];
  const isVeganRequired = params.dietaryPresets?.includes('vegan')
  const isVegetarianRequired = params.dietaryPresets?.includes('vegetarian')

  for (const seed of SEED_RECIPES) {
    // Hard filter: allergens — seed.containsAllergens lists what's in the recipe
    const hasUserAllergen = params.allergens.some((a) =>
      seed.containsAllergens.includes(a)
    );
    if (hasUserAllergen) continue;

    // Hard filter: safe foods mode
    if (params.safeFoods && params.safeFoods.length > 0) {
      const ingredientNames = seed.ingredients.map((i) => i.name);
      if (!isSafeForSafeFoods(ingredientNames, params.safeFoods)) continue;
    }

    // Hard filter: alcohol
    if (params.alcoholMode) {
      const ingredientNames = seed.ingredients.map((i) => i.name)
      if (ingredientsHaveAlcohol(ingredientNames)) continue
    }

    // Hard filter: vegan (must be tagged vegan)
    if (isVeganRequired && !seed.tags.dietaryPresets?.includes('vegan')) continue

    // Hard filter: vegetarian (must be tagged vegetarian or vegan)
    if (isVegetarianRequired && !seed.tags.dietaryPresets?.some(p => p === 'vegetarian' || p === 'vegan')) continue

    const score = scoreCandidate(
      params.cuisine,
      params.mealType,
      params.occasion,
      params.dietaryPresets,
      seed.tags.cuisine,
      seed.tags.mealType,
      seed.tags.dietaryPresets
    );
    candidates.push({ seed, score });
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => b.score - a.score);
  const { seed } = candidates[0];
  return { ...seed };
}

export async function findFallbackRecipe(
  params: FindFallbackParams
): Promise<FallbackRecipe | null> {
  // 1. Try community recipes from saved-recipes table first
  const dbResult = await queryDBFallback(params);
  if (dbResult) return dbResult;

  // 2. Fall back to pre-seeded community recipes
  return querySeedFallback(params);
}
