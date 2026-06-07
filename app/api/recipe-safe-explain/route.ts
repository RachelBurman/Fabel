import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { checkRateLimit, incrementRateLimit } from "@/lib/rate-limiter";
import { requireAuth, AuthRequiredError } from "@/lib/get-user-id";

const client = new Anthropic();

const SYSTEM_PROMPT =
  "You are a food safety assistant for people with dietary restrictions. Respond with valid JSON only, no markdown.";

export async function POST(req: NextRequest) {
  let userId: string;
  try {
    ({ userId } = await requireAuth());
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
    recipeTitle?: unknown;
    ingredients?: unknown;
    allergens?: unknown;
    dietPresets?: unknown;
    safeFoodsMode?: unknown;
    safeFoods?: unknown;
    lactoseMode?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body.recipeTitle !== "string" || !Array.isArray(body.ingredients)) {
    return NextResponse.json(
      { error: "recipeTitle and ingredients are required" },
      { status: 400 }
    );
  }

  const rateLimit = await checkRateLimit(userId, true);
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
  void incrementRateLimit(userId);

  const recipeTitle = body.recipeTitle;
  const ingredients = (body.ingredients as unknown[]).filter(
    (i): i is string => typeof i === "string"
  );
  const allergens = Array.isArray(body.allergens)
    ? (body.allergens as unknown[]).filter((a): a is string => typeof a === "string")
    : [];
  const dietPresets = Array.isArray(body.dietPresets)
    ? (body.dietPresets as unknown[]).filter((p): p is string => typeof p === "string")
    : [];
  const safeFoodsMode = body.safeFoodsMode === true;
  const safeFoods = Array.isArray(body.safeFoods)
    ? (body.safeFoods as unknown[]).filter((f): f is string => typeof f === "string")
    : [];
  const lactoseMode =
    body.lactoseMode === "reminder" || body.lactoseMode === "exclude"
      ? (body.lactoseMode as "reminder" | "exclude")
      : null;

  const allergensLine = allergens.length > 0 ? allergens.join(", ") : "none";
  const dietLine = dietPresets.length > 0 ? dietPresets.join(", ") : "no specific diet";
  const safeFoodsLine = safeFoodsMode
    ? `active — they can only eat: ${safeFoods.join(", ")}`
    : "not active";
  const lactoseLine =
    lactoseMode === "reminder"
      ? "they take Lactaid with dairy"
      : lactoseMode === "exclude"
      ? "they exclude dairy entirely"
      : null;

  const userPrompt =
    `A user has the following dietary profile:\n` +
    `- Allergens to avoid: ${allergensLine}\n` +
    `- Diet: ${dietLine}\n` +
    `- Safe Foods Mode: ${safeFoodsLine}\n` +
    (lactoseLine ? `- Lactose: ${lactoseLine}\n` : "") +
    `\nThis recipe is called "${recipeTitle}" and contains: ${ingredients.join(", ")}.\n\n` +
    `In 2-3 sentences, explain in warm, plain English why this recipe is safe for them ` +
    `specifically. Reference their actual restrictions by name. Be specific about which ` +
    `ingredients are doing the safe work. Do not use bullet points. Do not say "I" or ` +
    `"As an AI". End with one encouraging sentence.\n\n` +
    `If Safe Foods Mode is active, confirm the recipe stays within their safe list.\n\n` +
    `Return JSON: { "explanation": "..." }`;

  try {
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

    let result: unknown;
    try {
      result = JSON.parse(raw);
    } catch {
      return NextResponse.json(
        { error: "Claude returned malformed JSON" },
        { status: 500 }
      );
    }

    if (
      typeof result !== "object" ||
      result === null ||
      typeof (result as Record<string, unknown>).explanation !== "string"
    ) {
      return NextResponse.json(
        { error: "Unexpected response shape from Claude" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      explanation: (result as { explanation: string }).explanation,
    });
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: `Claude API error (${error.status}): ${error.message}` },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: "Failed to generate safety explanation" },
      { status: 500 }
    );
  }
}
