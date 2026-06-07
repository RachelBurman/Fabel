import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { checkRateLimit, incrementRateLimit } from "@/lib/rate-limiter";
import { requireAuth, AuthRequiredError } from "@/lib/get-user-id";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { dynamo } from "@/lib/dynamo";
import { buildPreferenceProfile } from "@/lib/preference-profile";
import { deriveFlavourTerritory } from "@/lib/flavour-territory";
import { getEpicureVectors } from "@/lib/epicure";
import { type RecipeBrief } from "@/lib/types";

const client = new Anthropic();

const SYSTEM_PROMPT =
  "You are Fable's culinary intelligence. Your job is to reason about a user's cooking history and taste profile, then write a concise recipe brief that steers the next recipe toward genuinely novel territory for them — somewhere they haven't been, but will love based on where they have been.\n\nYou must respond with a valid JSON object and nothing else. No markdown, no preamble, no explanation outside the JSON.";

const GUEST_BRIEF: RecipeBrief = {
  direction: null,
  reasoning: null,
  keyIngredients: [],
  noveltyNote: null,
  loadingHints: [
    "Safe ingredients. Bold flavours. Food for everyone.",
    "Fable uses Epicure — the largest multilingual food embedding model ever built.",
    "The more you cook with Fable, the better it knows your taste.",
  ],
};

export async function POST(req: NextRequest) {
  let uid: string;
  try {
    ({ userId: uid } = await requireAuth());
  } catch (err) {
    if (err instanceof AuthRequiredError) {
      return NextResponse.json(
        { error: "auth_required", message: "Please sign in to use this feature" },
        { status: 401 }
      );
    }
    throw err;
  }

  let body: {
    userId?: unknown;
    preferences?: unknown;
    kitchenIngredients?: unknown;
    nudge?: unknown;
    forcedCuisine?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ brief: GUEST_BRIEF });
  }

  const VALID_NUDGES = ['spicier', 'vegetarian', 'quicker', 'surprise'] as const;
  type NudgeValue = (typeof VALID_NUDGES)[number];
  const nudge: NudgeValue | null =
    typeof body.nudge === 'string' && (VALID_NUDGES as readonly string[]).includes(body.nudge)
      ? (body.nudge as NudgeValue)
      : null;
  const forcedCuisine: string | null =
    typeof body.forcedCuisine === 'string' && body.forcedCuisine.trim()
      ? body.forcedCuisine.trim()
      : null;

  // Rate limit check
  const rateLimit = await checkRateLimit(uid, true);
  if (!rateLimit.allowed) {
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
  void incrementRateLimit(uid);

  try {
    const [profileResult, historyResult] = await Promise.all([
      buildPreferenceProfile(uid),
      dynamo.send(
        new QueryCommand({
          TableName: "fable-feedback",
          KeyConditionExpression: "userId = :uid",
          ExpressionAttributeValues: { ":uid": uid },
        })
      ),
    ]);

    if (!profileResult) return NextResponse.json({ brief: GUEST_BRIEF });

    const { preferred, avoided, formatSignals } = profileResult;

    const allHistoryItems = (historyResult.Items ?? []) as Array<{
      recipeTitle?: string;
      liked?: boolean;
      timestamp?: string;
    }>;
    const last10 = allHistoryItems
      .sort((a, b) => (b.timestamp ?? "").localeCompare(a.timestamp ?? ""))
      .slice(0, 10);

    const epicureVectors = getEpicureVectors();
    const resolvedPreferred = preferred
      .map((k) => k.replace(/\s+/g, "_"))
      .filter((k) => k in epicureVectors);
    const flavourTerritory = deriveFlavourTerritory(
      resolvedPreferred,
      epicureVectors
    );

    const prefs = (
      typeof body.preferences === "object" && body.preferences !== null
        ? body.preferences
        : {}
    ) as Record<string, unknown>;

    const mealType =
      typeof prefs.mealType === "string" ? prefs.mealType : "main";
    const cookTime =
      typeof prefs.cookTime === "string" ? prefs.cookTime : "medium";
    const cuisine =
      typeof prefs.cuisine === "string" && prefs.cuisine.trim()
        ? prefs.cuisine.trim()
        : "Surprise me";
    const occasion =
      typeof prefs.occasion === "string" && prefs.occasion.trim()
        ? prefs.occasion.trim()
        : "None";
    const spiceTolerance =
      typeof prefs.spiceTolerance === "string" ? prefs.spiceTolerance : "medium";
    const adventurousness =
      typeof prefs.adventurousness === "string" ? prefs.adventurousness : "occasional";
    const alcoholMode =
      typeof prefs.alcoholMode === "string" &&
      (prefs.alcoholMode === "no_cooking" || prefs.alcoholMode === "exclude_entirely")
        ? prefs.alcoholMode
        : null;

    const kitchenIngredients = Array.isArray(body.kitchenIngredients)
      ? (body.kitchenIngredients as unknown[])
          .filter((k): k is string => typeof k === "string")
          .slice(0, 10)
      : [];

    const historyLines =
      last10
        .map(
          (r) =>
            `- ${r.recipeTitle ?? "Unknown dish"} (${r.liked ? "liked" : "disliked"})`
        )
        .join("\n") || "- No history yet";

    const adventurousnessInstruction =
      adventurousness === "familiar"
        ? `Stay strictly within cuisines and techniques the user has already engaged with. Prioritise familiar, comforting combinations. Set noveltyNote to null.\n`
        : adventurousness === "adventurous"
        ? `The user is actively seeking new flavours. The noveltyNote should suggest something genuinely unexpected that still fits the direction. Push into less familiar flavour territory.\n`
        : "";

    const spiceInstruction =
      spiceTolerance === "none" || spiceTolerance === "mild"
        ? `Do not suggest spiced or heat-forward directions.\n`
        : spiceTolerance === "hot"
        ? `The user loves heat — bold spicing is welcome in the direction.\n`
        : "";

    const cookingStyleNote =
      adventurousnessInstruction || spiceInstruction
        ? `Cooking style guidance:\n${adventurousnessInstruction}${spiceInstruction}\n`
        : "";

    const noAlcoholNote = alcoholMode
      ? `This user does not consume alcohol. Do not suggest alcohol-forward directions or cuisines where alcohol is central to the dish (e.g. no coq au vin, sake-braised dishes, or beer-based stews).\n\n`
      : "";

    const nudgeInstruction = forcedCuisine
      ? `The user has selected ${forcedCuisine} cuisine. Build the direction around ${forcedCuisine} cooking. Acknowledge naturally in the reasoning — e.g. "Taking this in a ${forcedCuisine} direction as requested."\n\n`
      : nudge === 'spicier'
      ? `The user has requested a spicier direction. Adjust the direction toward bolder, hotter flavours. Acknowledge this naturally in the reasoning — e.g. "Taking this in a spicier direction as requested."\n\n`
      : nudge === 'vegetarian'
      ? `The user has requested a vegetarian direction. Remove any meat or fish from the direction and keyIngredients. Acknowledge naturally in the reasoning.\n\n`
      : nudge === 'quicker'
      ? `The user has requested a quicker recipe. Adjust the direction toward dishes that can be prepared in under 30 minutes. Acknowledge naturally in the reasoning.\n\n`
      : nudge === 'surprise'
      ? `The user wants something completely different from their recent history. Choose a direction that contrasts with what they have made before — an unexplored cuisine or unusual combination that still respects their allergens and restrictions.\n\n`
      : '';

    const userMessage =
      `Taste profile:\n` +
      `- Top loved ingredients: ${preferred.join(", ") || "not enough data yet"}\n` +
      `- Top avoided ingredients: ${avoided.join(", ") || "none"}\n` +
      `- Flavour territory: ${flavourTerritory.join(", ") || "unknown"}\n` +
      `- Format signals: ${formatSignals.join(", ") || "none"}\n\n` +
      `Recent recipe history (last 10):\n${historyLines}\n\n` +
      `Current request:\n` +
      `- Meal type: ${mealType}\n` +
      `- Cook time: ${cookTime}\n` +
      `- Cuisine: ${forcedCuisine ?? cuisine}\n` +
      `- Occasion: ${occasion}\n` +
      `- Kitchen includes: ${kitchenIngredients.join(", ") || "not specified"}\n\n` +
      cookingStyleNote +
      noAlcoholNote +
      nudgeInstruction +
      `Write a recipe brief. Identify what flavour territory this user hasn't explored yet that aligns with their taste profile. If cuisine is 'Surprise me', choose something genuinely novel for them. Be specific — name a dish direction, not just a cuisine.\n\n` +
      `Respond with this exact JSON shape:\n` +
      `{\n` +
      `  "direction": "One sentence naming the dish direction, e.g. 'A slow-cooked Moroccan lamb tagine'",\n` +
      `  "reasoning": "One or two sentences explaining why this is novel for them but aligned with what they love. Warm, direct, like a knowledgeable friend. Not clinical.",\n` +
      `  "keyIngredients": ["3-4 key ingredients that define this direction"],\n` +
      `  "noveltyNote": "One short phrase, e.g. 'First time in North African territory'",\n` +
      `  "loadingHints": [\n` +
      `    "A short cooking fact or tip related to this dish direction. Fun, not dry.",\n` +
      `    "A second tip. Different angle — technique, ingredient, history.",\n` +
      `    "A third tip."\n` +
      `  ]\n` +
      `}`;

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userMessage }],
    });

    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json({ brief: GUEST_BRIEF });
    }

    const raw = textBlock.text
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/, "")
      .trim();

    let brief: RecipeBrief;
    try {
      brief = JSON.parse(raw) as RecipeBrief;
    } catch {
      return NextResponse.json({ brief: GUEST_BRIEF });
    }

    return NextResponse.json({ brief });
  } catch {
    return NextResponse.json({ brief: GUEST_BRIEF });
  }
}
