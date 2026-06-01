import { NextRequest, NextResponse } from "next/server";
import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { dynamo } from "@/lib/dynamo";

export async function POST(req: NextRequest) {
  let body: {
    userId?: string;
    recipeId?: string;
    liked?: boolean;
    reasons?: string[];
    notes?: string;
    recipeTitle?: string;
    recipeIngredients?: string[];
    allergenProfile?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { userId, recipeId, liked, reasons, notes, recipeTitle, recipeIngredients, allergenProfile } = body;
  if (!userId || !recipeId) {
    return NextResponse.json({ error: "Missing userId or recipeId" }, { status: 400 });
  }

  await dynamo.send(
    new PutCommand({
      TableName: "fable-feedback",
      Item: {
        userId,
        recipeId,
        liked: liked ?? true,
        reasons: reasons ?? [],
        notes: notes ?? "",
        recipeTitle: recipeTitle ?? "",
        recipeIngredients: recipeIngredients ?? [],
        allergenProfile: allergenProfile ?? "global",
        timestamp: new Date().toISOString(),
      },
    })
  );

  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId")?.trim();
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") ?? "5", 10), 20);

  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  const result = await dynamo.send(
    new QueryCommand({
      TableName: "fable-feedback",
      KeyConditionExpression: "userId = :uid",
      ExpressionAttributeValues: { ":uid": userId },
    })
  );

  const items = (result.Items ?? []) as Array<{
    liked: boolean;
    reasons: string[];
    recipeIngredients: string[];
    timestamp: string;
  }>;

  const dislikes = items
    .filter((i) => i.liked === false)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, limit);

  const patterns = [...new Set(dislikes.flatMap((d) => d.reasons ?? []))];
  const ingredients = [...new Set(dislikes.flatMap((d) => d.recipeIngredients ?? []))];

  return NextResponse.json({ patterns, ingredients, count: dislikes.length });
}
