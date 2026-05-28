import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const SYSTEM_PROMPT =
  "You are a creative chef who specialises in allergen-safe cooking. Generate exciting, restaurant-quality recipes. Always respond with valid JSON only, no markdown.";

// ─── Safe-foods validation ─────────────────────────────────────────────────────

// Water, salt, and ice are universally fine even if not explicitly listed.
const UNIVERSAL_BASICS = new Set(["water", "salt", "ice"]);

// Words that describe cooking form, technique, or cut — they don't identify
// the ingredient itself. Stripped before matching against the safe list.
const QUALIFIERS = new Set([
  // freshness / state
  "fresh", "dried", "frozen", "raw", "cooked", "whole", "organic",
  "ripe", "firm", "baby", "unripe",
  // size
  "large", "small", "medium",
  // cooking techniques
  "minced", "chopped", "sliced", "diced", "grated", "roasted", "steamed",
  "shredded", "cubed", "mashed", "pureed", "blended", "crushed", "peeled",
  "ground", "toasted", "blanched", "sauteed", "fried", "grilled", "baked",
  // cut / piece nouns
  "piece", "pieces", "fillet", "fillets", "floret", "florets",
  "clove", "cloves", "stalk", "stalks", "leaf", "leaves",
  "sprig", "sprigs", "chunk", "chunks", "strip", "strips", "cube",
  "slice", "slices", "wedge", "wedges", "ring", "rings",
  // meat cuts
  "breast", "thigh", "wing", "drumstick", "tenderloin", "loin",
  "chop", "chops", "cutlet", "cutlets", "fillet", "rack",
  // misc
  "boneless", "skinless",
]);

/**
 * Build a normalised Set from Epicure-style keys ("olive_oil" → "olive oil").
 */
function buildSafeSet(safeIngredients: string[]): Set<string> {
  return new Set(
    safeIngredients.map((s) => s.replace(/_/g, " ").toLowerCase().trim())
  );
}

/**
 * Return the word itself plus common singular/plural variants so
 * "blueberries" matches "blueberry" and "mushroom" matches "mushrooms".
 */
function wordVariants(word: string): string[] {
  const out = [word];
  // ies → y  (berries → berry, cherries → cherry)
  if (word.endsWith("ies") && word.length > 4)
    out.push(word.slice(0, -3) + "y");
  // ves → f  (loaves → loaf)
  if (word.endsWith("ves") && word.length > 4)
    out.push(word.slice(0, -3) + "f");
  // es → (drop es)  (tomatoes → tomat — imperfect but harmless)
  if (word.endsWith("es") && word.length > 4 && !word.endsWith("ies"))
    out.push(word.slice(0, -2));
  // s → (drop s)  (mushrooms → mushroom, carrots → carrot)
  if (word.endsWith("s") && !word.endsWith("ss") && word.length > 4)
    out.push(word.slice(0, -1));
  return out;
}

/**
 * Returns true when the recipe ingredient `name` can be traced to an entry
 * in the user's safe list.
 *
 * Matching order:
 *  1. Universal basics (water, salt, ice).
 *  2. Exact normalised match.
 *  3. Any safe phrase appears verbatim (whole-word) inside the recipe name.
 *  4. After stripping cooking qualifiers, each remaining core word (plus
 *     its singular/plural variants) is checked against the first token of
 *     every safe ingredient — e.g. "broccoli" (core of "broccoli florets")
 *     matches safe entry "broccoli"; "blueberry" (singular of "blueberries"
 *     after stripping "fresh") matches safe entry "blueberry".
 */
function isSafe(name: string, safeSet: Set<string>): boolean {
  const norm = name.toLowerCase().trim();

  if (UNIVERSAL_BASICS.has(norm)) return true;
  if (safeSet.has(norm)) return true;

  // Whole-phrase match: safe entry appears verbatim inside recipe name
  for (const safe of safeSet) {
    const esc = safe.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`\\b${esc}\\b`, "i").test(norm)) return true;
  }

  // Core-word match: strip qualifiers, try singular/plural variants,
  // match against the leading token(s) of each safe ingredient.
  const cores = norm
    .split(/\s+/)
    .filter((w) => w.length > 1 && !QUALIFIERS.has(w));

  for (const core of cores) {
    for (const variant of wordVariants(core)) {
      for (const safe of safeSet) {
        const safeTokens = safe.split(/\s+/);
        // Variant must equal the whole safe entry OR its first token
        // (prevents "oil" matching "olive oil" while "olive" would match it).
        if (safe === variant || safeTokens[0] === variant) return true;
      }
    }
  }

  return false;
}

/**
 * Strip any ingredient in the recipe that is not on the user's safe list.
 * Returns the cleaned recipe and a list of what was removed.
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
    const ingName = typeof ing.name === "string" ? ing.name.trim() : "";
    if (!ingName) return true;
    if (isSafe(ingName, safeSet)) return true;
    violations.push(ingName);
    return false;
  });

  return { recipe: { ...recipe, ingredients: cleaned }, violations };
}

// ─── Route ────────────────────────────────────────────────────────────────────

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
      ? ` Also avoid these specific ingredients entirely: ${customAllergens
          .map((a) => a.replace(/_/g, " "))
          .join(", ")}.`
      : "";

  // Human-readable forms for the prompt (Epicure keys use underscores)
  const humanSafe = safeIngredients.map((s) => s.replace(/_/g, " ")).join(", ");
  const humanAvailable = ingredients.map((i) => i.replace(/_/g, " ")).join(", ");

  const userPrompt =
    safeFoodsMode && safeIngredients.length > 0
      ? `CRITICAL CONSTRAINT: This user has severe dietary restrictions (MCAS or similar). ` +
        `They can ONLY eat these exact ingredients: ${humanSafe}. ` +
        `You MUST NOT suggest, add, or imply any ingredient not on this list. ` +
        `No substitutions, no optional additions, no garnishes from outside the list. ` +
        `Do not add salt, oil, pepper, spices, or any seasoning unless it explicitly appears in the approved list above. ` +
        `If you cannot make a complete dish from these ingredients alone, make the simplest possible preparation that uses only what is available. ` +
        `The user's safety depends on strict adherence to this list.\n\n` +
        `The user has these approved ingredients available today: ${humanAvailable}. ` +
        `Create a ${mealType} that takes ${cookTimeLabel}. ` +
        `Focus on technique, texture, and preparation to make the most of simple ingredients.\n\n` +
        `REMINDER: Every ingredient name in your JSON response MUST be one of: ${humanSafe}. ` +
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

    // ── Safe Foods post-generation validation ──────────────────────────────
    if (
      safeFoodsMode &&
      safeIngredients.length > 0 &&
      typeof recipe === "object" &&
      recipe !== null
    ) {
      const safeSet = buildSafeSet(safeIngredients);
      const { recipe: cleaned, violations } = validateSafeFoods(
        recipe as Record<string, unknown>,
        safeSet
      );
      if (violations.length > 0) {
        console.warn(
          `[safe-foods] Stripped ${violations.length} unsafe ingredient(s) from recipe: ${violations.join(", ")}`
        );
      }
      return NextResponse.json({
        ...cleaned,
        safeFoodsViolations: violations,
      });
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
