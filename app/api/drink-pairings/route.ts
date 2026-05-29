import { NextRequest, NextResponse } from "next/server";
import {
  rankSimilar,
  getAllergensForIngredient,
  ALLERGEN_CODES,
  type AllergenCode,
} from "@/lib/epicure";

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

export async function POST(req: NextRequest) {
  let body: { ingredients?: unknown; allergens?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { ingredients, allergens } = body;

  const inputIngredients: string[] = Array.isArray(ingredients)
    ? (ingredients as unknown[]).filter((i): i is string => typeof i === "string")
    : [];

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

  for (const ingredient of inputIngredients) {
    for (const { name, score } of rankSimilar(ingredient)) {
      if (BEVERAGE_KEYS.has(name) && !inputSet.has(name)) {
        const current = scoreMap.get(name) ?? -Infinity;
        if (score > current) scoreMap.set(name, score);
      }
    }
  }

  const pairings = Array.from(scoreMap.entries())
    .filter(([name]) => {
      const allergenList = getAllergensForIngredient(name);
      return !allergenList.some((a) => blockedSet.has(a));
    })
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([drink, score]) => ({ drink, score: Math.round(score * 10000) / 10000 }));

  return NextResponse.json({ pairings });
}
