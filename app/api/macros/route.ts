import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { checkRateLimit, incrementRateLimit } from "@/lib/rate-limiter";
import { requireAuth, AuthRequiredError } from "@/lib/get-user-id";

const client = new Anthropic();

const SYSTEM_PROMPT =
  "You are a nutritional expert. Estimate macro-nutrients for recipes accurately. Always respond with valid JSON only, no markdown.";

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
    title?: unknown;
    ingredients?: unknown;
    servings?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
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

  const title = typeof body.title === "string" ? body.title : "Recipe";
  const servings = typeof body.servings === "number" ? body.servings : 2;

  type IngredientInput = { name: string; amount: number | string; unit: string };
  const ingredients: IngredientInput[] = Array.isArray(body.ingredients)
    ? (body.ingredients as unknown[]).filter(
        (i): i is IngredientInput =>
          typeof i === "object" && i !== null && "name" in i
      )
    : [];

  const ingredientList = ingredients
    .map((i) => `${i.amount} ${i.unit} ${i.name}`)
    .join(", ");

  const userPrompt =
    `Estimate the nutritional macros per serving for this recipe. Recipe: "${title}". ` +
    `Serves ${servings}. Ingredients: ${ingredientList}. ` +
    `Return JSON: { calories: number, protein: number, carbs: number, fat: number } ` +
    `where protein, carbs and fat are in grams per serving and calories are kcal per serving.`;

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 256,
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

    let macros: unknown;
    try {
      macros = JSON.parse(raw);
    } catch {
      return NextResponse.json(
        { error: "Claude returned malformed JSON" },
        { status: 500 }
      );
    }

    return NextResponse.json(macros);
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: `Claude API error (${error.status}): ${error.message}` },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: "Failed to estimate macros" },
      { status: 500 }
    );
  }
}
