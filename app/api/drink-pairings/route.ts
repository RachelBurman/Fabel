import { NextRequest, NextResponse } from "next/server";
import {
  rankSimilar,
  getAllergensForIngredient,
  ALLERGEN_CODES,
  type AllergenCode,
} from "@/lib/epicure";

const BEVERAGE_KEYS = new Set([
  "wine", "red_wine", "white_wine", "beer", "tea", "green_tea", "coffee",
  "juice", "lemon_juice", "orange_juice", "sparkling_water", "water",
  "cider", "sake", "whiskey", "rum", "gin", "vodka", "champagne",
  "prosecco", "kombucha", "coconut_water", "milk", "oat_milk", "ginger_beer",
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
