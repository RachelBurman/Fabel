import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, incrementRateLimit } from "@/lib/rate-limiter";
import { requireAuth, AuthRequiredError } from "@/lib/get-user-id";

const LAMBDA_URL = process.env.BARCODE_LAMBDA_URL;

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

  if (!LAMBDA_URL) {
    return NextResponse.json(
      { error: "Barcode Lambda not configured" },
      { status: 503 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
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

  try {
    const res = await fetch(LAMBDA_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data: unknown = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error("[scan-barcode] Lambda call failed:", err);
    return NextResponse.json(
      { error: "Barcode Lambda call failed" },
      { status: 502 }
    );
  }
}
