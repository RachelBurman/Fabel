import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import {
  rankSimilar,
  getAllergensForIngredient,
  cosineSimilarityBetween,
  toEpicureKey,
  getCategoryForIngredient,
} from "@/lib/epicure";
import { checkRateLimit, incrementRateLimit } from "@/lib/rate-limiter";
import { getUserId } from "@/lib/get-user-id";
import { ALCOHOL_INGREDIENT_KEYS } from "@/lib/alcohol-ingredients";
import { HIGH_HISTAMINE_INGREDIENT_KEYS } from "@/lib/high-histamine-ingredients";

// Grain ingredients must never substitute for these categories
const GRAIN_INCOMPATIBLE = new Set(["fat", "dairy_alternative", "cheese", "liquid"]);

const client = new Anthropic();

export async function POST(req: NextRequest) {
  let body: {
    ingredient?: unknown;
    context?: unknown;
    allergens?: unknown;
    safeIngredients?: unknown;
    userId?: unknown;
    adventurousness?: unknown;
    alcoholMode?: unknown;
    lowHistamine?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const bodyUserId =
    typeof body.userId === "string" && body.userId.trim() ? body.userId.trim() : undefined;
  let isAuthenticated = false;
  let rateLimitKey: string;
  try {
    const resolved = await getUserId(bodyUserId);
    isAuthenticated = resolved.isAuthenticated;
    rateLimitKey = resolved.userId;
  } catch {
    rateLimitKey = `ip:${(req.headers.get("x-forwarded-for") ?? "unknown").split(",")[0].trim()}`;
  }

  const rateLimit = await checkRateLimit(rateLimitKey, isAuthenticated);
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
  void incrementRateLimit(rateLimitKey);

  const ingredient =
    typeof body.ingredient === "string" ? toEpicureKey(body.ingredient) : "";
  if (!ingredient) {
    return NextResponse.json(
      { error: "ingredient is required" },
      { status: 400 }
    );
  }

  const context: string[] = Array.isArray(body.context)
    ? body.context
        .map((c: unknown) =>
          typeof c === "string" ? toEpicureKey(c) : ""
        )
        .filter(Boolean)
    : [];

  const allergens: string[] = Array.isArray(body.allergens)
    ? body.allergens.filter((a: unknown): a is string => typeof a === "string")
    : [];

  const safeSet: Set<string> | null = Array.isArray(body.safeIngredients)
    ? new Set(
        (body.safeIngredients as unknown[])
          .filter((s): s is string => typeof s === "string")
          .map(toEpicureKey)
      )
    : null;

  const alcoholMode =
    typeof body.alcoholMode === "string" &&
    (body.alcoholMode === "no_cooking" || body.alcoholMode === "exclude_entirely")
      ? body.alcoholMode
      : null;
  const alcoholKeySet = alcoholMode ? new Set(ALCOHOL_INGREDIENT_KEYS) : null;
  const lowHistamine = body.lowHistamine === true;
  const histamineKeySet = lowHistamine ? new Set(HIGH_HISTAMINE_INGREDIENT_KEYS) : null;

  // a. Top 50 similar — rankSimilar already excludes the target itself
  const ranked = rankSimilar(ingredient).slice(0, 50);

  const originalCategory = getCategoryForIngredient(ingredient);

  // b+c. Filter allergens, alcohol, safe-foods list, and hard category rules
  let candidates = ranked.filter(({ name }) => {
    if (safeSet && !safeSet.has(name)) return false;
    if (alcoholKeySet && alcoholKeySet.has(name)) return false;
    if (histamineKeySet && histamineKeySet.has(name)) return false;
    const codes = getAllergensForIngredient(name);
    if (codes.some((c) => allergens.includes(c))) return false;
    // Hard rule: grain ingredients must not substitute for fat/dairy/cheese/liquid
    const candidateCategory = getCategoryForIngredient(name);
    if (
      candidateCategory === "grain" &&
      originalCategory !== null &&
      GRAIN_INCOMPATIBLE.has(originalCategory)
    ) return false;
    return true;
  });

  // Drop exact co-ingredients — anything already in the dish context cannot substitute
  candidates = candidates.filter(({ name }) => !context.includes(name));

  const adventurousness =
    typeof body.adventurousness === "string" ? body.adventurousness : "occasional";

  // d. Context score + category adjustment
  const withScores = candidates.map(({ name, score: similarityToOriginal }) => {
    let contextFit = 0;
    if (context.length > 0) {
      const scores = context.map((ctx) => cosineSimilarityBetween(name, ctx));
      contextFit = scores.reduce((a, b) => a + b, 0) / scores.length;
    }
    // e. Weighted combination with functional category bonus/penalty.
    // A candidate more at home in the dish than it is close to the original
    // is likely a co-ingredient — penalise rather than reward its context fit.
    const isLikelyCoIngredient = contextFit > similarityToOriginal + 0.15;
    const contextContribution = isLikelyCoIngredient ? -0.2 : 0.3 * contextFit;
    const base = 0.6 * similarityToOriginal + contextContribution;
    const candidateCategory = getCategoryForIngredient(name);
    // adventurous mode: remove both the same-category bonus and the cross-category penalty
    // so more surprising but valid substitutes can surface
    const categoryAdj =
      adventurousness === "adventurous"
        ? 0
        : originalCategory && candidateCategory
        ? originalCategory === candidateCategory ? 0.1 : -0.3
        : 0;
    const combinedScore = Math.max(0, base + categoryAdj);
    return { name, similarityToOriginal, contextFit, combinedScore };
  });

  // familiar mode: restrict to high-similarity substitutes only
  const filtered =
    adventurousness === "familiar"
      ? withScores.filter((s) => s.similarityToOriginal > 0.7)
      : withScores;

  const top3 = filtered
    .sort((a, b) => b.combinedScore - a.combinedScore)
    .slice(0, 3);

  if (top3.length === 0) {
    return NextResponse.json({ substitutes: [] });
  }

  // Claude explanation for each substitute — authenticated users only
  let explanations: Record<string, string> = {};
  if (isAuthenticated) {
    const originalDisplay = ingredient.replace(/_/g, " ");
    const contextDisplay =
      context.length > 0
        ? context.map((c) => c.replace(/_/g, " ")).join(", ")
        : "various ingredients";
    const substitutesDisplay = top3.map((s) => s.name.replace(/_/g, " ")).join(", ");
    const userPrompt =
      `A dish contains: ${contextDisplay}. The ingredient being replaced is ${originalDisplay}. ` +
      `Considering what role ${originalDisplay} plays in this specific dish — whether it provides fat, protein, binding, acidity, texture, or flavour — ` +
      `in one sentence each, explain why each of these is a good substitute in this context: ${substitutesDisplay}. ` +
      `Return JSON: { ${top3.map((s) => `"${s.name}": "explanation"`).join(", ")} }`;
    try {
      const message = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 300,
        messages: [{ role: "user", content: userPrompt }],
      });
      const textBlock = message.content.find((b) => b.type === "text");
      if (textBlock && textBlock.type === "text") {
        const raw = textBlock.text
          .replace(/^```(?:json)?\s*/i, "")
          .replace(/```\s*$/, "")
          .trim();
        explanations = JSON.parse(raw);
      }
    } catch {
      // explanations remain empty — non-fatal
    }
  }

  function cap(n: number) {
    return Math.round(Math.min(1, Math.max(0, n)) * 100);
  }

  const substitutes = top3.map((s) => ({
    name: s.name,
    displayName: s.name
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase()),
    similarityToOriginal: cap(s.similarityToOriginal),
    contextFit: cap(s.contextFit),
    combinedScore: cap(s.combinedScore),
    explanation: explanations[s.name] ?? null,
  }));

  return NextResponse.json({ substitutes });
}
