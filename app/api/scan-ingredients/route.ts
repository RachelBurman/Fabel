import { NextRequest, NextResponse } from "next/server";

const LAMBDA_URL = process.env.VISION_LAMBDA_URL;

export async function POST(req: NextRequest) {
  if (!LAMBDA_URL) {
    return NextResponse.json(
      { error: "Vision Lambda not configured" },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const res = await fetch(LAMBDA_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

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
