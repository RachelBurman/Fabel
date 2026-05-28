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
  let body: { ingredients?: unknown; allergens?: unknown; customAllergens?: unknown; mode?: unknown; mealType?: unknown; cookTime?: unknown; safeIngredients?: unknown; safeFoodsMode?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { ingredients, allergens, customAllergens, mode, safeIngredients, safeFoodsMode } = body;

  if (mode !== "avoid" && mode !== "safe-only") {
    return NextResponse.json(
      { error: "mode must be 'avoid' or 'safe-only'" },
      { status: 400 }
    );
  }

  // Accept either string[] (legacy) or IngredientItem[] — normalize to sorted names
  type NormIngredient = { name: string; useByDate: string | undefined };
  const inputIngredients: string[] = Array.isArray(ingredients)
    ? ((ingredients as unknown[])
        .map((i): NormIngredient | null => {
          if (typeof i === "string") return { name: i, useByDate: undefined };
          if (typeof i === "object" && i !== null && "name" in i) {
            const obj = i as Record<string, unknown>;
            return { name: String(obj.name), useByDate: obj.useByDate as string | undefined };
          }
          return null;
        })
        .filter((x): x is NormIngredient => x !== null) as NormIngredient[])
        .sort((a, b) => {
          if (!a.useByDate && !b.useByDate) return 0;
          if (!a.useByDate) return 1;
          if (!b.useByDate) return -1;
          return a.useByDate.localeCompare(b.useByDate);
        })
        .map((x) => x.name)
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

  // Specific Epicure ingredients the user wants to avoid entirely
  const customBlockedSet = new Set<string>(
    Array.isArray(customAllergens)
      ? (customAllergens as unknown[]).filter((a): a is string => typeof a === "string")
      : []
  );

  // Safe Foods Mode: restrict suggestions to only the user's verified safe list
  const safeSet = new Set<string>(
    Array.isArray(safeIngredients)
      ? (safeIngredients as unknown[]).filter((a): a is string => typeof a === "string")
      : []
  );
  const isSafeFoodsMode = safeFoodsMode === true && safeSet.size > 0;

  const allCandidates = Array.from(scoreMap.entries()).map(([name, score]) => ({
    name,
    score,
    allergenList: getAllergensForIngredient(name),
  }));

  const kept = allCandidates.filter(({ name, allergenList }) => {
    if (isSafeFoodsMode) return safeSet.has(name);
    if (customBlockedSet.has(name)) return false;
    if (mode === "safe-only") return allergenList.length === 0;
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
