import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getShelfLifeDays, addDays } from "@/lib/shelf-life";
import { buildTasteProfileClause } from "@/lib/feedback-preferences";
import { formatSignalsToClauses } from "@/lib/survey-signals";
import { buildPreferenceProfile } from "@/lib/preference-profile";
import { findSimilarIngredients } from "@/lib/epicure";
import {
  buildSafeSet,
  findInSafeSet,
  validateSafeFoods,
  LIQUID_TERMS,
  SALT_TERMS,
} from "@/lib/safe-foods";
import { checkRateLimit, incrementRateLimit } from "@/lib/rate-limiter";
import { findFallbackRecipe } from "@/lib/community-recipe-fallback";
import { getUserId } from "@/lib/get-user-id";

const client = new Anthropic();

const SYSTEM_PROMPT =
  "You are a creative chef who specialises in allergen-safe cooking. Generate exciting, restaurant-quality recipes. Always respond with valid JSON only, no markdown.";

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
    kitchenOnly?: unknown;
    dislikedPatterns?: unknown;
    dislikedIngredients?: unknown;
    showMacros?: unknown;
    recipeContext?: unknown;
    cuisine?: unknown;
    occasion?: unknown;
    servings?: unknown;
    kitchenEquipment?: unknown;
    userId?: unknown;
    seedIngredients?: unknown;
    recipeBrief?: unknown;
    spiceTolerance?: unknown;
    adventurousness?: unknown;
    alcoholMode?: unknown;
    activePresets?: unknown;
    existingRecipe?: unknown;
    lowHistamine?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Accept either string[] (legacy) or IngredientItem[] — normalize, enrich, sort by expiry
  type NormIngredient = {
    name: string;
    displayName?: string;
    subtype?: string;
    quantity?: string;
    unit?: string;
    dateType?: string;
    useByDate?: string;
    boughtDate?: string;
  };

  function effectiveExpiry(i: NormIngredient): string | undefined {
    if (i.dateType === "bought" && i.boughtDate) {
      return addDays(i.boughtDate, getShelfLifeDays(i.name));
    }
    return i.useByDate;
  }

  function buildIngredientDescription(i: NormIngredient): string {
    const label = i.displayName ?? i.name.replace(/_/g, " ");
    const qtyPart =
      i.quantity && i.unit && (i.quantity !== "1" || i.unit !== "pieces")
        ? `${i.quantity} ${i.unit} `
        : "";
    // Include the Epicure key when a displayName or subtype exists so Claude
    // knows the exact ingredient even when the cut/variety is specified.
    const epicurePart = i.displayName || i.subtype ? ` (Epicure: ${i.name})` : "";
    return `${qtyPart}${label}${epicurePart}`;
  }

  const sortedItems: NormIngredient[] = Array.isArray(body.ingredients)
    ? ((body.ingredients as unknown[])
        .map((i): NormIngredient | null => {
          if (typeof i === "string") return { name: i };
          if (typeof i === "object" && i !== null && "name" in i) {
            const obj = i as Record<string, unknown>;
            return {
              name: String(obj.name),
              displayName: obj.displayName ? String(obj.displayName) : undefined,
              subtype: obj.subtype ? String(obj.subtype) : undefined,
              quantity: obj.quantity ? String(obj.quantity) : undefined,
              unit: obj.unit ? String(obj.unit) : undefined,
              dateType: obj.dateType ? String(obj.dateType) : undefined,
              useByDate: obj.useByDate ? String(obj.useByDate) : undefined,
              boughtDate: obj.boughtDate ? String(obj.boughtDate) : undefined,
            };
          }
          return null;
        })
        .filter((x): x is NormIngredient => x !== null) as NormIngredient[])
        .sort((a, b) => {
          const ae = effectiveExpiry(a);
          const be = effectiveExpiry(b);
          if (!ae && !be) return 0;
          if (!ae) return 1;
          if (!be) return -1;
          return ae.localeCompare(be);
        })
    : [];

  const bodyUserId =
    typeof body.userId === "string" && body.userId.trim() ? body.userId.trim() : undefined;
  let userId: string | null = null;
  let isAuthenticated = false;
  try {
    const resolved = await getUserId(bodyUserId);
    userId = resolved.userId;
    isAuthenticated = resolved.isAuthenticated;
  } catch {
    // No userId — rate-limit by IP only
  }

  // Parse preference fields needed for both guest and rate-limited fallback paths
  const guestAllergens = Array.isArray(body.allergens)
    ? (body.allergens as unknown[]).filter((a): a is string => typeof a === "string")
    : [];
  const guestSafeFoodsMode = body.safeFoodsMode === true;
  const guestSafeIngredients = Array.isArray(body.safeIngredients)
    ? (body.safeIngredients as unknown[]).filter((s): s is string => typeof s === "string")
    : [];
  const guestActivePresets = Array.isArray(body.activePresets)
    ? (body.activePresets as unknown[]).filter((p): p is string => typeof p === "string")
    : [];
  const guestAlcoholMode =
    typeof body.alcoholMode === "string" &&
    (body.alcoholMode === "no_cooking" || body.alcoholMode === "exclude_entirely")
      ? (body.alcoholMode as 'no_cooking' | 'exclude_entirely')
      : undefined;

  const guestFallbackParams = {
    allergens: guestAllergens,
    safeFoods: guestSafeFoodsMode && guestSafeIngredients.length > 0 ? guestSafeIngredients : null,
    cuisine: typeof body.cuisine === "string" ? body.cuisine : undefined,
    occasion: typeof body.occasion === "string" ? body.occasion : undefined,
    mealType: typeof body.mealType === "string" ? body.mealType : undefined,
    dietaryPresets: guestActivePresets.length > 0 ? guestActivePresets : undefined,
    alcoholMode: guestAlcoholMode,
  };

  // ── Guest mode: return DB fallback, no Claude call, no rate limit consumed ──
  if (!isAuthenticated) {
    const fallback = await findFallbackRecipe(guestFallbackParams);

    return NextResponse.json({
      recipe: fallback ?? null,
      guestMode: true,
      fallbackSource: "community",
    });
  }

  // ── Rate limiting ──────────────────────────────────────────────────────────
  const rateLimitKey = userId ?? `ip:${(req.headers.get("x-forwarded-for") ?? "unknown").split(",")[0].trim()}`;
  const rateLimit = await checkRateLimit(rateLimitKey, isAuthenticated);

  if (!rateLimit.allowed) {
    // For generate-recipe: return a fallback community recipe rather than a hard error
    const fallback = await findFallbackRecipe(guestFallbackParams);

    if (fallback) {
      return NextResponse.json({
        recipe: fallback,
        rateLimited: true,
        fallbackSource: "community",
        hourRemaining: rateLimit.hourRemaining,
        dayRemaining: rateLimit.dayRemaining,
        resetAt: rateLimit.resetAt,
      });
    }

    return NextResponse.json(
      {
        error: "rate_limited",
        hourRemaining: rateLimit.hourRemaining,
        dayRemaining: rateLimit.dayRemaining,
        resetAt: rateLimit.resetAt,
      },
      { status: 429 }
    );
  }

  // Increment before the Claude call — fail open if DynamoDB write fails
  void incrementRateLimit(rateLimitKey);

  // ── Feedback-informed preference profile ────────────────────────────────────
  let tasteProfileClause = "";
  let adjustedItems = sortedItems;

  if (userId) {
    try {
      const profileResult = await buildPreferenceProfile(userId);

      if (profileResult) {
        const { scores, preferred: _preferred, avoided: _avoided, strength, formatSignals } = profileResult;

        tasteProfileClause = buildTasteProfileClause({ scores, preferred: _preferred, avoided: _avoided, strength });

        if (formatSignals.length > 0) {
          const formatClauses = formatSignalsToClauses(formatSignals);
          if (formatClauses.length > 0) {
            tasteProfileClause += `Recipe format preferences from feedback: ${formatClauses.join(' ')}\n\n`;
          }
        }

        // Auto-swap: silently replace any kitchen ingredient with a preference score
        // below -0.3 with its nearest Epicure neighbour that has a neutral/positive score
        if (Object.keys(scores).length > 0) {
          const swapNotes: string[] = [];
          adjustedItems = sortedItems.map((item) => {
            const displayKey = item.name.replace(/_/g, " ").toLowerCase();
            if ((scores[displayKey] ?? 0) >= -0.3) return item;

            const candidates = findSimilarIngredients(item.name, 20);
            const substitute = candidates.find(
              (c) => (scores[c.replace(/_/g, " ").toLowerCase()] ?? 0) >= -0.3
            );
            if (!substitute) return item;

            const subDisplay = substitute.replace(/_/g, " ");
            swapNotes.push(
              `${item.displayName ?? item.name.replace(/_/g, " ")} → ${subDisplay}`
            );
            return {
              ...item,
              name: substitute,
              displayName:
                subDisplay.charAt(0).toUpperCase() + subDisplay.slice(1),
              subtype: undefined,
            };
          });

          if (swapNotes.length > 0) {
            tasteProfileClause +=
              `Ingredient adjustments based on taste history: ${swapNotes.join("; ")}.\n\n`;
          }
        }
      }
    } catch (err) {
      // Non-fatal — preference history is best-effort
      console.warn("[feedback-preferences] Failed to compute taste profile:", err);
    }
  }

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
  const kitchenOnly = body.kitchenOnly === true;
  const safeIngredients = Array.isArray(body.safeIngredients)
    ? (body.safeIngredients as unknown[]).filter(
        (s): s is string => typeof s === "string"
      )
    : [];

  const showMacros = body.showMacros === true;

  const dislikedPatterns = Array.isArray(body.dislikedPatterns)
    ? (body.dislikedPatterns as unknown[]).filter((p): p is string => typeof p === "string")
    : [];
  const dislikedIngredients = Array.isArray(body.dislikedIngredients)
    ? (body.dislikedIngredients as unknown[]).filter((i): i is string => typeof i === "string")
    : [];

  const cuisine =
    typeof body.cuisine === "string" && body.cuisine.trim() ? body.cuisine.trim() : "";
  const occasion =
    typeof body.occasion === "string" && body.occasion.trim() ? body.occasion.trim() : "";
  const servings =
    typeof body.servings === "number" && body.servings >= 1
      ? Math.round(body.servings)
      : 2;
  const kitchenEquipment = Array.isArray(body.kitchenEquipment)
    ? (body.kitchenEquipment as unknown[]).filter((e): e is string => typeof e === "string")
    : [];
  const seedIngredients = Array.isArray(body.seedIngredients)
    ? (body.seedIngredients as unknown[]).filter((s): s is string => typeof s === "string")
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

// Human-readable forms for the prompt
  const humanSafe = safeIngredients.map((s) => s.replace(/_/g, " ")).join(", ");
  const humanAvailable = adjustedItems.map(buildIngredientDescription).join(", ");

  // ── Safe-foods liquid and salt detection ────────────────────────────────────
  // Build the safe set early so we can inspect it for the prompt.
  const safeSet = safeFoodsMode ? buildSafeSet(safeIngredients) : new Set<string>();
  const safeLiquids = safeFoodsMode ? findInSafeSet(safeSet, LIQUID_TERMS) : [];
  const safeSalts   = safeFoodsMode ? findInSafeSet(safeSet, SALT_TERMS)   : [];

  const liquidInstruction = safeFoodsMode
    ? safeLiquids.length > 0
      ? `Liquid handling: the following liquid(s) are on the safe list and may be used normally: ${safeLiquids.join(", ")}.`
      : `Liquid handling: NO liquid appears in the safe list. If the recipe would benefit from a liquid, use the ingredient name "liquid of choice" with the amount/unit as appropriate, and include this note in parentheses in the relevant step: "(use whatever liquid you can safely consume — water, broth, juice, or another suitable substitute)". If the recipe genuinely does not need a liquid, do not add one.`
    : "";

  const saltInstruction = safeFoodsMode
    ? safeSalts.length > 0
      ? `Salt/seasoning: the following is on the safe list and may be used normally: ${safeSalts.join(", ")}.`
      : `Salt/seasoning: NO salt or seasoning appears in the safe list. Do NOT add salt, pepper, spices, herbs, or any seasoning unless it explicitly appears in the approved list. If a step would normally call for seasoning, use the ingredient name "seasoning of choice" and include this note in the step: "(use any salt or seasoning you can safely consume, or omit entirely)".`
    : "";

  const cuisineClause =
    cuisine === "surprise"
      ? `Create a dish inspired by a cuisine of your choice — be adventurous and pick something unexpected. `
      : cuisine
      ? `Create a ${cuisine}-inspired dish. `
      : "";

  const occasionClause = occasion ? `This is for ${occasion}. ` : "";

  const seedIngredientsClause =
    seedIngredients.length > 0
      ? `Ingredient seeds from user's taste profile: [${seedIngredients.map((s) => s.replace(/_/g, " ")).join(", ")}]. Incorporate at least one if it suits the cuisine and occasion. Do not force it if it would be inappropriate.\n\n`
      : "";

  const rawBrief =
    typeof body.recipeBrief === "object" && body.recipeBrief !== null
      ? (body.recipeBrief as Record<string, unknown>)
      : null;
  const briefDirection =
    rawBrief && typeof rawBrief.direction === "string" && rawBrief.direction.trim()
      ? rawBrief.direction.trim()
      : null;
  const briefKeyIngredients = Array.isArray(rawBrief?.keyIngredients)
    ? (rawBrief!.keyIngredients as unknown[]).filter(
        (k): k is string => typeof k === "string"
      )
    : [];
  const recipeBriefClause = briefDirection
    ? `Recipe direction from taste analysis: ${briefDirection}\n` +
      (briefKeyIngredients.length > 0
        ? `Key ingredients to incorporate if they suit the dish: ${briefKeyIngredients.join(", ")}\n`
        : "") +
      `This direction was chosen because it's novel territory for this user while aligning with their taste profile. Follow it unless it conflicts with allergen constraints or the user's kitchen.\n\n`
    : "";

  const servingsClause = `Recipe should serve ${servings} ${servings === 1 ? "person" : "people"}, scale quantities accordingly. `;

  const equipmentClause =
    kitchenEquipment.length > 0
      ? `Only use cooking techniques compatible with: ${kitchenEquipment.join(", ")}. Do not suggest methods requiring equipment not in this list. `
      : "";

  const kitchenConstraint = kitchenOnly
    ? `KITCHEN CONSTRAINT: Only use the exact ingredients listed. Do not suggest, add, or imply any other ingredients. Work creatively within only what the user has available.\n\n`
    : "";

  const recipeContext =
    typeof body.recipeContext === "string" && body.recipeContext.trim()
      ? body.recipeContext.trim()
      : null;

  const adaptContext = recipeContext
    ? `Adapt this recipe: "${recipeContext}". Use the provided ingredients and maintain the spirit of the original dish where possible.\n\n`
    : "";

  const rawExistingRecipe =
    typeof body.existingRecipe === "object" && body.existingRecipe !== null
      ? (body.existingRecipe as Record<string, unknown>)
      : null;
  const existingRecipeClause =
    rawExistingRecipe && typeof rawExistingRecipe.title === "string"
      ? `This is a refinement of an existing recipe: "${rawExistingRecipe.title}". Apply the requested direction change while maintaining the spirit and technique of the original where possible.\n\n`
      : "";

  const dislikedPrefix =
    dislikedPatterns.length > 0 || dislikedIngredients.length > 0
      ? `User feedback from past recipes: ` +
        (dislikedPatterns.length > 0
          ? `They disliked recipes that were ${dislikedPatterns.join(", ")}. `
          : "") +
        (dislikedIngredients.length > 0
          ? `Avoid reusing these ingredients from recipes they didn't enjoy: ${dislikedIngredients.slice(0, 10).join(", ")}. `
          : "") +
        `Make this recipe noticeably different.\n\n`
      : "";

  const spiceTolerance =
    typeof body.spiceTolerance === "string" ? body.spiceTolerance : "medium";
  const adventurousness =
    typeof body.adventurousness === "string" ? body.adventurousness : "occasional";

  const spiceClause =
    spiceTolerance === "none"
      ? `This user cannot tolerate any heat or spice. Use no chilli, black pepper, cayenne, or spiced condiments. Flavour with herbs, citrus, and umami instead.\n\n`
      : spiceTolerance === "mild"
      ? `This user prefers very mild spice only. A pinch of black pepper or the faintest hint of chilli at most. Keep heat minimal.\n\n`
      : spiceTolerance === "hot"
      ? `This user loves bold heat. Strong spicing is encouraged — don't hold back on chilli, black pepper, and warming spices.\n\n`
      : "";

  const adventurousnessClause =
    adventurousness === "familiar"
      ? `Stay within cuisines and techniques the user has already engaged with. Prioritise familiar, comforting combinations over novelty.\n\n`
      : adventurousness === "adventurous"
      ? `Push into less familiar territory. Unusual ingredient combinations, less common cuisines, and novel techniques are all encouraged.\n\n`
      : "";

  const alcoholMode =
    typeof body.alcoholMode === "string" &&
    (body.alcoholMode === "no_cooking" || body.alcoholMode === "exclude_entirely")
      ? body.alcoholMode
      : null;

  const noAlcoholClause = alcoholMode
    ? `This user does not consume alcohol. Do not use any alcoholic ingredients in this recipe — no wine, beer, spirits, mirin, or cooking wines. Where a recipe would traditionally use alcohol (e.g. white wine in a risotto, mirin in a teriyaki), substitute with a non-alcoholic alternative (stock, rice vinegar, apple juice, or similar). Do not mention alcohol in the recipe at all.\n\n`
    : "";

  const lowHistamine = body.lowHistamine === true;
  const lowHistamineClause = lowHistamine
    ? `This user follows a low-histamine diet. Avoid fermented foods, aged cheeses, cured meats, alcohol, vinegar-based ingredients, tomatoes, spinach, avocado, citrus fruits, and chocolate. Use fresh ingredients over preserved or fermented ones. Fresh meat, rice, most vegetables (except those listed), and fresh herbs are all suitable.\n\n`
    : "";

  const userPrompt =
    safeFoodsMode && safeIngredients.length > 0
      ? tasteProfileClause + seedIngredientsClause + recipeBriefClause + dislikedPrefix + spiceClause + adventurousnessClause + noAlcoholClause + lowHistamineClause + existingRecipeClause + `CRITICAL CONSTRAINT: This user has severe dietary restrictions (MCAS or similar). ` +
        `They can ONLY eat these exact ingredients: ${humanSafe}. ` +
        `You MUST NOT suggest, add, or imply any ingredient not on this list. ` +
        `No substitutions, no optional additions, no garnishes from outside the list. ` +
        `The user's safety depends on strict adherence to this list.\n\n` +
        `${liquidInstruction}\n\n` +
        `${saltInstruction}\n\n` +
        `${kitchenConstraint}` +
        `${cuisineClause}${occasionClause}${servingsClause}${equipmentClause}` +
        `The user has these approved ingredients available today (listed in order of expiry — prioritise using those listed first): ${humanAvailable}. ` +
        `Prioritise using ingredients that expire soonest. ` +
        `Create a ${mealType} that takes ${cookTimeLabel}. ` +
        `Focus on technique, texture, and preparation to make the most of simple ingredients.\n\n` +
        `REMINDER: Every ingredient name in your JSON response MUST appear in this approved list (or be "liquid of choice" / "seasoning of choice" per the rules above): ${humanSafe}. ` +
        `Return JSON: { title, description, ingredients: [{name, amount, unit}], steps: [string], cookTime, servings, allergenFree: true` +
        (showMacros ? `, macros: { calories: number, protein: number, carbs: number, fat: number }` : ``) +
        ` }`
      : tasteProfileClause + seedIngredientsClause + recipeBriefClause + dislikedPrefix + spiceClause + adventurousnessClause + noAlcoholClause + lowHistamineClause + existingRecipeClause + adaptContext + `${kitchenConstraint}` +
        `${cuisineClause}${occasionClause}${servingsClause}${equipmentClause}` +
        `Generate a ${mealType} recipe that takes ${cookTimeLabel} to prepare. ` +
        `Use some or all of these ingredients (listed in order of expiry — prioritise using those listed first): ${humanAvailable}. ` +
        `Prioritise using ingredients that expire soonest. ` +
        (kitchenOnly ? `` : `Also consider these suggested pairings: ${suggestions.join(", ")}. `) +
        `This recipe must contain absolutely zero of these allergens: ${allergenClause}.${customClause} ` +
        `Return JSON: { title, description, ingredients: [{name, amount, unit}], steps: [string], cookTime, servings, allergenFree: true` +
        (showMacros ? `, macros: { calories: number, protein: number, carbs: number, fat: number }` : ``) +
        ` }`;

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
      const { recipe: cleaned, violations } = validateSafeFoods(
        recipe as Record<string, unknown>,
        safeSet,
        safeSalts
      );
      if (violations.length > 0) {
        console.warn(
          `[safe-foods] Stripped ${violations.length} unsafe ingredient(s): ${violations.join(", ")}`
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
