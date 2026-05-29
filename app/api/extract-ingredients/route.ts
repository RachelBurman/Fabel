import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export async function POST(req: NextRequest) {
  let body: { text?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) return NextResponse.json({ ingredients: [] });

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      messages: [
        {
          role: "user",
          content:
            "Extract only the ingredient names from this recipe text. " +
            "Return one ingredient name per line, no quantities, no measurements, no cooking instructions. " +
            "Just the ingredient names. Nothing else.\n\n" +
            text,
        },
      ],
    });

    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json({ ingredients: [] });
    }

    const ingredients = textBlock.text
      .split("\n")
      .map((l) => l.replace(/^[-•*]\s*/, "").trim())
      .filter((l) => l.length > 0);

    return NextResponse.json({ ingredients });
  } catch {
    return NextResponse.json({ ingredients: [] });
  }
}
