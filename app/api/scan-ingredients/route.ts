import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, incrementRateLimit } from "@/lib/rate-limiter";

const LAMBDA_URL = process.env.VISION_LAMBDA_URL;

export async function POST(req: NextRequest) {
  console.log("[scan-ingredients] LAMBDA_URL:", LAMBDA_URL ?? "(not set)");

  if (!LAMBDA_URL) {
    return NextResponse.json(
      { error: "Vision Lambda not configured" },
      { status: 503 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Rate limiting — use userId from body if present, else IP
  const userId = typeof body.userId === "string" && body.userId.trim()
    ? body.userId.trim()
    : `ip:${(req.headers.get("x-forwarded-for") ?? "unknown").split(",")[0].trim()}`;

  const rateLimit = await checkRateLimit(userId, false);
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

  console.log("[scan-ingredients] Forwarding to Lambda...");
  try {
    const res = await fetch(LAMBDA_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    console.log("[scan-ingredients] Lambda responded:", res.status);
    const data: unknown = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error("[scan-ingredients] Lambda call failed:", err);
    return NextResponse.json(
      { error: "Vision Lambda call failed" },
      { status: 502 }
    );
  }
}
