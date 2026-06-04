import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { checkRateLimit, incrementRateLimit } from "@/lib/rate-limiter";

const client = new Anthropic();

export async function POST(req: NextRequest) {
  let body: { text?: unknown; userId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Rate limiting
  const rateLimitKey = typeof body.userId === "string" && body.userId.trim()
    ? body.userId.trim()
    : `ip:${(req.headers.get("x-forwarded-for") ?? "unknown").split(",")[0].trim()}`;

  const rateLimit = await checkRateLimit(rateLimitKey, false);
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
