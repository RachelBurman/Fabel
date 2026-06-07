import { NextRequest, NextResponse } from "next/server";
import {
  rankSimilar,
  allIngredients,
  getAllergensForIngredient,
  ALLERGEN_CODES,
  type AllergenCode,
} from "@/lib/epicure";
import { resolveToEpicureKey } from "@/lib/drink-pairing-utils";
import { ALCOHOL_INGREDIENT_KEYS } from "@/lib/alcohol-ingredients";

// Keys verified to exist in data/epicure-core.json
const BEVERAGE_KEYS = new Set([
  // Teas
  "tea", "black_tea", "green_tea", "white_tea", "oolong_tea", "herbal_tea",
  "fruit_tea", "rooibos_tea", "earl_grey_tea", "jasmine_tea", "thai_tea",
  "milk_tea", "honey_citron_tea", "pu_erh_tea", "brick_tea",
  // Coffee
  "coffee",
  // Waters
  "water", "sparkling_water", "tonic_water", "coconut_water",
  // Juices
  "fruit_juice", "vegetable_juice", "clamato_juice",
  // Milks
  "milk", "oat_milk", "almond_milk", "soy_milk", "rice_milk",
  "coconut_milk", "plant_based_milk", "goat_milk", "buttermilk",
  // Wines (drinking wines only — cooking wines excluded)
  "wine", "red_wine", "white_wine", "rose_wine", "sparkling_wine",
  "champagne", "plum_wine", "ginger_wine", "port_wine", "madeira_wine",
  "moscatel_wine", "osmanthus_wine",
  // Beers, ciders & sodas
  "beer", "root_beer", "ginger_beer", "ginger_ale", "hard_cider", "apple_cider",
  // Spirits & liqueurs
  "whiskey", "rum", "gin", "vodka", "sake",
  "coffee_liqueur", "ginger_liqueur",
  // Other
  "kombucha",
]);

// Pre-build a Set for O(1) key existence checks
const epicureKeySet = new Set(allIngredients);

// resolveToEpicureKey imported from @/lib/drink-pairing-utils; pass epicureKeySet at call site

export async function POST(req: NextRequest) {
  console.log("[drink-pairings] POST received");

  let body: { ingredients?: unknown; allergens?: unknown; alcoholMode?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { ingredients, allergens } = body;

  const alcoholMode =
    typeof body.alcoholMode === "string" &&
    (body.alcoholMode === "no_cooking" || body.alcoholMode === "exclude_entirely")
      ? body.alcoholMode
      : null;

  const alcoholKeySet = new Set(ALCOHOL_INGREDIENT_KEYS);

  const NON_ALCOHOLIC_FALLBACKS = [
    "ginger_beer",       // non-alcoholic soft drink
    "sparkling_water",
    "green_tea",
    "mint_tea",
    "elderflower_cordial",
    "apple_juice",       // deliberately apple_juice not apple_cider (UK cider = alcoholic)
  ];

  const inputIngredients: string[] = Array.isArray(ingredients)
    ? (ingredients as unknown[]).filter((i): i is string => typeof i === "string")
    : [];

  console.log("[drink-pairings] ingredients received:", inputIngredients);

  const validAllergens: AllergenCode[] = Array.isArray(allergens)
    ? (allergens as unknown[]).filter(
        (a): a is AllergenCode =>
          typeof a === "string" && (ALLERGEN_CODES as readonly string[]).includes(a)
      )
    : [];

  const blockedSet = new Set<string>(validAllergens);

  // Score each beverage by cosine similarity to the input ingredients (max-pool)
  const scoreMap = new Map<string, number>();
  const inputSet = new Set(inputIngredients);

  for (const rawName of inputIngredients) {
    const epicureKey = resolveToEpicureKey(rawName, epicureKeySet);
    console.log(`[drink-pairings] resolving "${rawName}" → ${epicureKey ?? "NOT FOUND in Epicure"}`);
    if (!epicureKey) continue;

    for (const { name, score } of rankSimilar(epicureKey)) {
      if (BEVERAGE_KEYS.has(name) && !inputSet.has(name)) {
        const current = scoreMap.get(name) ?? -Infinity;
        if (score > current) scoreMap.set(name, score);
      }
    }
  }

  // Log all beverage scores before allergen filtering
  const allBeverageScores = Array.from(scoreMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name, score]) => `${name}=${score.toFixed(4)}`);
  console.log(
    "[drink-pairings] beverage scores before filtering:",
    allBeverageScores.length > 0 ? allBeverageScores.join(", ") : "NONE — all ingredients unresolved"
  );

  let pairings = Array.from(scoreMap.entries())
    .filter(([name]) => {
      if (alcoholMode && alcoholKeySet.has(name)) return false;
      const allergenList = getAllergensForIngredient(name);
      return !allergenList.some((a) => blockedSet.has(a));
    })
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([drink, score]) => ({ drink, score: Math.round(score * 10000) / 10000 }));

  // If alcohol filter removed all candidates, return safe non-alcoholic fallbacks
  if (alcoholMode && pairings.length === 0) {
    pairings = NON_ALCOHOLIC_FALLBACKS
      .filter(key => {
        const allergenList = getAllergensForIngredient(key);
        return !allergenList.some((a) => blockedSet.has(a));
      })
      .map(drink => ({ drink, score: 0 }));
  }

  console.log("[drink-pairings] returning:", pairings.map((p) => p.drink).join(", ") || "EMPTY");

  return NextResponse.json({ pairings });
}
