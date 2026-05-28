import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

// Static system prompt — cached so repeated calls only pay for it once.
const SYSTEM_PROMPT =
  "You are a creative chef who specialises in allergen-safe cooking. Generate exciting, restaurant-quality recipes. Always respond with valid JSON only, no markdown.";

// ─── Safe-foods validation ─────────────────────────────────────────────────────

// Basics that are universally safe and don't need to appear on the user's list.
const UNIVERSAL_BASICS = new Set(["water", "salt", "ice"]);

/**
 * Build a normalised lookup set from Epicure-style keys (e.g. "olive_oil").
 * Each key is stored as its display form ("olive oil") for matching.
 */
function buildSafeSet(safeIngredients: string[]): Set<string> {
  return new Set(
    safeIngredients.map((s) => s.replace(/_/g, " ").toLowerCase().trim())
  );
}

/**
 * Returns true when `name` (from Claude's recipe) can be traced back to at
 * least one entry in the user's safe list.
 *
 * Matching rules (all case-insensitive):
 *  1. Always-safe basics (water, salt, ice).
 *  2. Exact match after normalisation.
 *  3. A safe ingredient appears as a whole-word substring of the recipe name
 *     e.g. safe="garlic" matches recipe="minced garlic" or "garlic cloves".
 *  4. The recipe name appears as a whole-word substring of a safe ingredient
 *     e.g. recipe="chicken" matches safe="chicken breast".
 */
function isSafe(name: string, safeSet: Set<string>): boolean {
  const norm = name.toLowerCase().trim();

  if (UNIVERSAL_BASICS.has(norm)) return true;
  if (safeSet.has(norm)) return true;

  for (const safe of safeSet) {
    // Escape for use in RegExp
    const escaped = safe.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`\\b${escaped}\\b`, "i").test(norm)) return true;
    // Reverse: recipe term as whole word inside safe entry
    const normEscaped = norm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`\\b${normEscaped}\\b`, "i").test(safe)) return true;
  }

  return false;
}

/**
 * Remove any recipe ingredients not on the safe list and return the cleaned
 * recipe along with a list of what was stripped out.
 */
function validateSafeFoods(
  recipe: Record<string, unknown>,
  safeSet: Set<string>
): { recipe: Record<string, unknown>; violations: string[] } {
  const raw = recipe.ingredients;
  if (!Array.isArray(raw)) return { recipe, violations: [] };

  const violations: string[] = [];
  const cleaned = raw.filter((item) => {
    if (typeof item !== "object" || item === null) return true;
    const ing = item as Record<string, unknown>;
    const name = typeof ing.name === "string" ? ing.name : "";
    if (!name) return true;
    if (isSafe(name, safeSet)) return true;
    violations.push(name);
    return false;
  });

  return {
    recipe: { ...recipe, ingredients: cleaned },
    violations,
  };
}

// ─── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: {
    ingredients?: unknown;
    suggestions?: unknown;
    allergens?: unknown;
    customAllergens?: unknown;
    mealType?: unknown;
    cookTime?: unknown;
    safeFoodsMode?: unknown;
    safeIngredients?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const ingredients = Array.isArray(body.ingredients)
    ? body.ingredients.filter((i): i is string => typeof i === "string")
    : [];

  const suggestions = Array.isArray(body.suggestions)
    ? body.suggestions.filter((s): s is string => typeof s === "string")
    : [];

  const allergens = Array.isArray(body.allergens)
    ? body.allergens.filter((a): a is string => typeof a === "string")
    : [];

  const customAllergens = Array.isArray(body.customAllergens)
    ? (body.customAllergens as unknown[]).filter(
        (a): a is string => typeof a === "string"
      )
    : [];

  const safeFoodsMode = body.safeFoodsMode === true;
  const safeIngredients = Array.isArray(body.safeIngredients)
    ? (body.safeIngredients as unknown[]).filter(
        (s): s is string => typeof s === "string"
      )
    : [];

  const mealType =
    typeof body.mealType === "string" ? body.mealType : "main course";

  const COOK_TIME_LABELS: Record<string, string> = {
    quick: "under 30 minutes",
    medium: "between 30 and 60 minutes",
    slow: "over 60 minutes, using slow cooking techniques where appropriate",
  };
  const cookTimeLabel =
    typeof body.cookTime === "string"
      ? (COOK_TIME_LABELS[body.cookTime] ?? body.cookTime)
      : "between 30 and 60 minutes";

  const allergenClause =
    allergens.length > 0 ? allergens.join(", ") : "none";

  const customClause =
    customAllergens.length > 0
      ? ` Also avoid these specific ingredients entirely: ${customAllergens.map((a) => a.replace(/_/g, " ")).join(", ")}.`
      : "";

  // Human-readable ingredient lists for prompts
  const humanSafe = safeIngredients
    .map((s) => s.replace(/_/g, " "))
    .join(", ");
  const humanAvailable = ingredients
    .map((i) => i.replace(/_/g, " "))
    .join(", ");

  const userPrompt =
    safeFoodsMode && safeIngredients.length > 0
      ? `CRITICAL CONSTRAINT: This user has severe dietary restrictions (MCAS or similar). ` +
        `They can ONLY eat these exact ingredients: ${humanSafe}. ` +
        `You MUST NOT suggest, add, or imply any ingredient not on this list. ` +
        `No substitutions, no optional additions, no garnishes from outside the list. ` +
        `If you cannot make a complete dish from these ingredients alone, make the simplest ` +
        `possible preparation that uses only what is available. ` +
        `The user's safety depends on strict adherence to this list.\n\n` +
        `Today the user has these safe ingredients available: ${humanAvailable}. ` +
        `Create a ${mealType} that takes ${cookTimeLabel}. ` +
        `Focus on technique, texture, and preparation to make the most of simple ingredients. ` +
        `Return JSON: { title, description, ingredients: [{name, amount, unit}], steps: [string], cookTime, servings, allergenFree: true }`
      : `Generate a ${mealType} recipe that takes ${cookTimeLabel} to prepare. ` +
        `Use some or all of these ingredients: ${ingredients.join(", ")} ` +
        `and suggested pairings: ${suggestions.join(", ")}. ` +
        `This recipe must contain absolutely zero of these allergens: ${allergenClause}.${customClause} ` +
        `Return JSON: { title, description, ingredients: [{name, amount, unit}], steps: [string], cookTime, servings, allergenFree: true }`;

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userPrompt }],
    });

    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json(
        { error: "No text response from Claude" },
        { status: 500 }
      );
    }

    // Strip any accidental markdown fencing before parsing.
    const raw = textBlock.text
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/, "")
      .trim();

    let recipe: unknown;
    try {
      recipe = JSON.parse(raw);
    } catch {
      return NextResponse.json(
        { error: "Claude returned malformed JSON", raw: textBlock.text },
        { status: 500 }
      );
    }

    // ── Safe Foods validation ───────────────────────────────────────────────
    if (safeFoodsMode && safeIngredients.length > 0 && typeof recipe === "object" && recipe !== null) {
      const safeSet = buildSafeSet(safeIngredients);
      const { recipe: cleaned, violations } = validateSafeFoods(
        recipe as Record<string, unknown>,
        safeSet
      );
      if (violations.length > 0) {
        console.warn(
          `[safe-foods] Removed ${violations.length} unsafe ingredient(s): ${violations.join(", ")}`
        );
      }
      return NextResponse.json({ ...cleaned, safeFoodsViolations: violations });
    }

    return NextResponse.json(recipe);
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: `Claude API error (${error.status}): ${error.message}` },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: "Failed to generate recipe" },
      { status: 500 }
    );
  }
}
