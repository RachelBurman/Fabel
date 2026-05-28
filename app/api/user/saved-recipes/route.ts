import { NextRequest, NextResponse } from "next/server";
import { QueryCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { dynamo } from "@/lib/dynamo";

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId")?.trim();
  if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

  const result = await dynamo.send(new QueryCommand({
    TableName: "fable-saved-recipes",
    KeyConditionExpression: "userId = :uid",
    ExpressionAttributeValues: { ":uid": userId },
  }));

  return NextResponse.json({ recipes: result.Items ?? [] });
}

export async function POST(req: NextRequest) {
  let body: { userId?: string; recipe?: Record<string, unknown> };
  try { body = await req.json() } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { userId, recipe } = body;
  if (!userId || !recipe) {
    return NextResponse.json({ error: "Missing userId or recipe" }, { status: 400 });
  }

  // Use the recipe's existing id as the sort key so we can delete by it later
  const recipeId = String(recipe.id ?? crypto.randomUUID());

  await dynamo.send(new PutCommand({
    TableName: "fable-saved-recipes",
    Item: { userId, recipeId, ...recipe, savedAt: new Date().toISOString() },
  }));

  return NextResponse.json({ recipeId });
}
