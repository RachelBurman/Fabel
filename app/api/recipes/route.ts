import { NextRequest, NextResponse } from "next/server";
import {
  rankSimilar,
  getAllergensForIngredient,
  ALLERGEN_CODES,
  type AllergenCode,
} from "@/lib/epicure";

interface Suggestion {
  ingredient: string;
  score: number;
  allergens: string[];
}

export async function POST(req: NextRequest) {
  let body: { ingredients?: unknown; allergens?: unknown; mode?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { ingredients, allergens, mode } = body;

  if (mode !== "avoid" && mode !== "safe-only") {
    return NextResponse.json(
      { error: "mode must be 'avoid' or 'safe-only'" },
      { status: 400 }
    );
  }

  const inputIngredients: string[] = Array.isArray(ingredients)
    ? ingredients.filter((i): i is string => typeof i === "string")
    : [];

  // Silently drop any allergen codes that aren't in the EU Big 14 list
  const validAllergens: AllergenCode[] = Array.isArray(allergens)
    ? allergens.filter(
        (a): a is AllergenCode =>
          typeof a === "string" && (ALLERGEN_CODES as readonly string[]).includes(a)
      )
    : [];

  // For each known input ingredient, score all other ingredients by cosine
  // similarity. Keep the highest score across all query ingredients (max-pool).
  const scoreMap = new Map<string, number>();
  const inputSet = new Set(inputIngredients);

  for (const ingredient of inputIngredients) {
    for (const { name, score } of rankSimilar(ingredient)) {
      if (!inputSet.has(name)) {
        const current = scoreMap.get(name) ?? -Infinity;
        if (score > current) scoreMap.set(name, score);
      }
    }
  }

  const blockedSet = new Set<string>(validAllergens);

  const allCandidates = Array.from(scoreMap.entries()).map(([name, score]) => ({
    name,
    score,
    allergenList: getAllergensForIngredient(name),
  }));

  const kept = allCandidates.filter(({ allergenList }) => {
    if (mode === "safe-only") {
      // Only suggest ingredients that are completely allergen-free
      return allergenList.length === 0;
    }
    // avoid: drop anything containing one of the user's allergens
    return !allergenList.some((a) => blockedSet.has(a));
  });

  const filtered = allCandidates.length - kept.length;

  const suggestions: Suggestion[] = kept
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map(({ name, score, allergenList }) => ({
      ingredient: name,
      score: Math.round(score * 10000) / 10000,
      allergens: allergenList,
    }));

  return NextResponse.json({ suggestions, filtered, mode });
}
