import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requireAuth, AuthRequiredError } from "@/lib/get-user-id";
import { type GeneratedRecipe } from "@/lib/types";

const client = new Anthropic();

const SYSTEM_PROMPT =
  "You are a culinary assistant. When given a recipe JSON and an ingredient swap, return the complete updated recipe JSON with the substitute replacing the original throughout — in the ingredients list and any step text that references it. Keep all other fields identical. Respond with valid JSON only, no markdown, no explanation.";

export async function POST(req: NextRequest) {
  try {
    await requireAuth();
  } catch (err) {
    if (err instanceof AuthRequiredError) {
      return NextResponse.json(
        { error: "auth_required", message: "Please sign in to use this feature" },
        { status: 401 }
      );
    }
    throw err;
  }

  let body: { existingRecipe?: unknown; original?: unknown; substitute?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const existingRecipe = (body.existingRecipe as GeneratedRecipe) ?? null;
  const original = typeof body.original === "string" ? body.original.trim() : null;
  const substitute = typeof body.substitute === "string" ? body.substitute.trim() : null;

  if (!existingRecipe || !original || !substitute) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const userMessage =
    `Recipe to update:\n${JSON.stringify(existingRecipe, null, 2)}\n\n` +
    `Swap: replace "${original}" with "${substitute}" throughout the recipe.\n` +
    `Update the ingredient name in the ingredients array and any step text that mentions "${original}".\n` +
    `Return the complete updated recipe JSON with the same structure.`;

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
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
      return NextResponse.json({ error: "No response from model" }, { status: 500 });
    }

    const raw = textBlock.text
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/, "")
      .trim();

    const updatedRecipe = JSON.parse(raw) as GeneratedRecipe;
    return NextResponse.json({ recipe: updatedRecipe });
  } catch {
    return NextResponse.json({ error: "Failed to update recipe" }, { status: 500 });
  }
}
